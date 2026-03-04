import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Upload, Download, Copy, Move, ZoomIn, Crown, Loader2, Share2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { renderTemplatePNG, composeResult, loadImage } from '@/utils/renderTemplate';
import { removeBackgroundFromDataUrl, warmupBackgroundRemoval } from '@/utils/removeBackground';
import { extractPlaceholderMeta, extractPreviewMeta } from '@/utils/campaignDesign';
import { useIsMobile } from '@/hooks/use-mobile';
import PhotoComposerPreview from '@/components/PhotoComposerPreview';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CampaignPublic = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  const [userPhoto, setUserPhoto] = useState<string>('');
  const [templateImage, setTemplateImage] = useState<string>('');
  const [resultImage, setResultImage] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string>('');
  const [photoScale, setPhotoScale] = useState(100);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isInteractingPreview, setIsInteractingPreview] = useState(false);

  const isFree = campaign?.tier !== 'premium';
  const composeVersionRef = useRef(0);
  const supporterTrackedRef = useRef(false);
  const previewInteractionRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef({ startScale: 100, startDistance: 0, startOffsetX: 0, startOffsetY: 0, startCenterX: 0, startCenterY: 0 });
  const dragRafRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, dy: 0 });
  const transformRafRef = useRef<number | null>(null);
  const transformPendingRef = useRef<{ scale?: number; offsetX?: number; offsetY?: number }>({});
  const wheelPendingRef = useRef(0);
  const wheelIdleTimerRef = useRef<number | null>(null);

  const sizeMap: Record<string, [number, number]> = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    story: [1080, 1920],
  };

  const isMobile = useIsMobile();
  const previewMeta = extractPreviewMeta(campaign?.design_json);
  const placeholderMeta = extractPlaceholderMeta(campaign?.design_json);
  const [fw, fh] = sizeMap[campaign?.size] || [1080, 1080];
  const previewMaxW = isMobile ? 320 : 500;
  const previewMaxH = isMobile ? 420 : 600;
  const previewScale = Math.min(previewMaxW / fw, previewMaxH / fh, 1);
  const exampleImage = previewImage;

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data, error }: { data: any; error: any } = await supabase
        .from('campaigns' as any)
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (cancelled) return;

      if (error || !data) {
        setCampaign(null);
        setLoading(false);
        return;
      }

      setCampaign(data);

      const previewMeta = extractPreviewMeta(data.design_json);
      setPreviewImage(previewMeta.previewImageDataUrl ?? '');
      setUserPhoto('');
      setPhotoScale(100);
      setPhotoOffsetX(0);
      setPhotoOffsetY(0);

      try {
        const [w, h] = sizeMap[data.size] || [1080, 1080];
        const tplDataUrl = await renderTemplatePNG(data.design_json, w, h, data.type ?? 'frame');
        if (!cancelled) setTemplateImage(tplDataUrl);
      } catch (err) {
        console.error('Template render error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    setIsOwner(!!user?.id && !!campaign?.user_id && campaign.user_id === user.id);
  }, [user?.id, campaign?.user_id]);

  useEffect(() => {
    if (campaign?.type !== 'background') return;
    void warmupBackgroundRemoval();
  }, [campaign?.type]);

  const updateResult = useCallback(async () => {
    if (!templateImage || !campaign) return;
    const current = ++composeVersionRef.current;

    try {
      const result = await composeResult({
        templateDataUrl: templateImage,
        userPhotoDataUrl: userPhoto || undefined,
        fullWidth: fw,
        fullHeight: fh,
        photoScale,
        photoOffsetX,
        photoOffsetY,
        addWatermark: isFree,
        campaignType: campaign.type ?? 'frame',
        placeholderMeta,
        previewMaxW: 420,
        previewMaxH: 520,
      });
      if (current === composeVersionRef.current) {
        setResultImage(result);
      }
    } catch (err) {
      console.error('Compose error:', err);
    }
  }, [templateImage, userPhoto, photoScale, photoOffsetX, photoOffsetY, campaign, isFree, fw, fh, placeholderMeta]);

  useEffect(() => {
    if (isInteractingPreview) return;

    const timer = window.setTimeout(() => {
      updateResult();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [updateResult, isInteractingPreview]);

  const trackSupporter = async () => {
    if (!slug || supporterTrackedRef.current) return;
    supporterTrackedRef.current = true;
    await supabase.rpc('increment_campaign_stats' as any, { _slug: slug, _event: 'supporter' });
  };

  const getInitialPhotoTransform = useCallback(
    async (photoDataUrl: string) => {
      if (!photoDataUrl) {
        return { scale: 100, offsetX: 0, offsetY: 0 };
      }

      if (campaign?.type === 'frame' && placeholderMeta) {
        const photo = await loadImage(photoDataUrl);
        const targetW = Math.max(1, placeholderMeta.width * placeholderMeta.scaleX);
        const targetH = Math.max(1, placeholderMeta.height * placeholderMeta.scaleY);
        const coverScale = Math.max(targetW / Math.max(1, photo.width), targetH / Math.max(1, photo.height)) * 1.2;

        return {
          scale: clamp(coverScale * 100, 20, 400),
          offsetX: placeholderMeta.left + targetW / 2 - fw / 2,
          offsetY: placeholderMeta.top + targetH / 2 - fh / 2,
        };
      }

      return {
        scale: clamp(previewMeta.photoScale ?? 100, 20, 400),
        offsetX: previewMeta.photoOffsetX ?? 0,
        offsetY: previewMeta.photoOffsetY ?? 0,
      };
    },
    [campaign?.type, placeholderMeta, fw, fh, previewMeta.photoScale, previewMeta.photoOffsetX, previewMeta.photoOffsetY]
  );

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async ev => {
      const rawDataUrl = (ev.target?.result as string) ?? '';
      if (!rawDataUrl) return;

      try {
        setProcessingPhoto(true);
        const photoDataUrl = campaign?.type === 'background' ? await removeBackgroundFromDataUrl(rawDataUrl) : rawDataUrl;
        const initialTransform = await getInitialPhotoTransform(photoDataUrl);
        setUserPhoto(photoDataUrl);
        setPhotoScale(initialTransform.scale);
        setPhotoOffsetX(initialTransform.offsetX);
        setPhotoOffsetY(initialTransform.offsetY);
      } catch {
        const initialTransform = await getInitialPhotoTransform(rawDataUrl);
        setUserPhoto(rawDataUrl);
        setPhotoScale(initialTransform.scale);
        setPhotoOffsetX(initialTransform.offsetX);
        setPhotoOffsetY(initialTransform.offsetY);
        toast.error('Gagal remove background, memakai foto original.');
      } finally {
        setProcessingPhoto(false);
      }

      await trackSupporter();
    };

    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownload = async () => {
    if (!campaign || !templateImage) return;

    const downloadableImage = await composeResult({
      templateDataUrl: templateImage,
      userPhotoDataUrl: userPhoto || undefined,
      fullWidth: fw,
      fullHeight: fh,
      photoScale,
      photoOffsetX,
      photoOffsetY,
      addWatermark: isFree,
      campaignType: campaign.type ?? 'frame',
      placeholderMeta,
      previewMaxW: fw,
      previewMaxH: fh,
    }).catch(() => resultImage);

    if (!downloadableImage) return;

    const a = document.createElement('a');
    a.href = downloadableImage;
    a.download = `twibbon-${slug}.png`;
    a.click();

    if (slug) {
      await supabase.rpc('increment_campaign_stats' as any, { _slug: slug, _event: 'download' });
    }
  };

  const handleCopyCaption = () => {
    if (!campaign?.caption) return;
    navigator.clipboard.writeText(campaign.caption);
    toast.success(t.public?.captionCopied ?? 'Caption disalin!');
  };

  const handleShareWhatsApp = async () => {
    const url = `${window.location.origin}/c/${slug}`;
    const text = campaign?.caption ? `${campaign.caption}\n\n${url}` : url;
    if (campaign?.caption) {
      try { await navigator.clipboard.writeText(campaign.caption); toast.success(t.public?.captionCopied ?? 'Caption disalin!'); } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleShareInstagram = async () => {
    if (campaign?.caption) {
      try { await navigator.clipboard.writeText(campaign.caption); } catch {}
    }
    toast.success(t.public?.instagramHint ?? 'Caption disalin! Buka Instagram dan paste caption saat posting.');
  };

  const handleShareUniversal = async () => {
    const url = `${window.location.origin}/c/${slug}`;
    if (campaign?.caption) {
      try { await navigator.clipboard.writeText(campaign.caption); toast.success(t.public?.captionCopied ?? 'Caption disalin!'); } catch {}
    }
    const shareData: ShareData = {
      title: campaign?.name ?? 'Twibbon',
      text: campaign?.caption ?? '',
      url,
    };

    // Try to include the result image as a file if available
    if (resultImage && navigator.canShare) {
      try {
        const res = await fetch(resultImage);
        const blob = await res.blob();
        const file = new File([blob], `twibbon-${slug}.png`, { type: 'image/png' });
        const fileShareData = { ...shareData, files: [file] };
        if (navigator.canShare(fileShareData)) {
          await navigator.share(fileShareData);
          return;
        }
      } catch { /* fallback to text share */ }
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(t.public?.linkCopied ?? 'Link disalin!');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    toast.success(t.public?.linkCopied ?? 'Link disalin!');
  };

  const handleRemoveWatermark = async () => {
    if (!campaign) return;
    await supabase.from('campaigns' as any).update({ tier: 'premium' }).eq('id', campaign.id);
    setCampaign((prev: any) => ({ ...prev, tier: 'premium' }));
    toast.success(t.public?.watermarkRemoved ?? 'Watermark berhasil dihapus!');
  };

  const isPreviewBusy = processingPhoto;

  useEffect(() => {
    const el = previewInteractionRef.current;
    if (!el) return;

    const preventNativeScroll = (event: Event) => {
      if (event.cancelable) {
        event.preventDefault();
      }
      event.stopPropagation();
    };

    el.addEventListener('touchmove', preventNativeScroll, { passive: false });

    return () => {
      el.removeEventListener('touchmove', preventNativeScroll);
    };
  }, [resultImage, templateImage]);

  useEffect(() => {
    return () => {
      if (dragRafRef.current) window.cancelAnimationFrame(dragRafRef.current);
      if (transformRafRef.current) window.cancelAnimationFrame(transformRafRef.current);
      if (wheelIdleTimerRef.current) window.clearTimeout(wheelIdleTimerRef.current);
    };
  }, []);

  const scheduleTransformFlush = () => {
    if (transformRafRef.current) return;
    transformRafRef.current = window.requestAnimationFrame(() => {
      const pending = transformPendingRef.current;
      transformPendingRef.current = {};
      transformRafRef.current = null;

      if (typeof pending.scale === 'number') setPhotoScale(clamp(pending.scale, 20, 400));
      if (typeof pending.offsetX === 'number') setPhotoOffsetX(pending.offsetX);
      if (typeof pending.offsetY === 'number') setPhotoOffsetY(pending.offsetY);
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !userPhoto) return;
    setIsInteractingPreview(true);
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    const el = previewInteractionRef.current;
    if (!el) return;
    el.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const points = [...pointersRef.current.values()];
    if (points.length === 2) {
      const [a, b] = points;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      gestureRef.current.startDistance = Math.hypot(dx, dy);
      gestureRef.current.startScale = photoScale;
      gestureRef.current.startOffsetX = photoOffsetX;
      gestureRef.current.startOffsetY = photoOffsetY;
      gestureRef.current.startCenterX = (a.x + b.x) / 2;
      gestureRef.current.startCenterY = (a.y + b.y) / 2;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !userPhoto || !pointersRef.current.has(event.pointerId)) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();

    const prev = pointersRef.current.get(event.pointerId)!;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointersRef.current.values()];

    if (points.length === 2) {
      const [a, b] = points;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      if (gestureRef.current.startDistance > 0) {
        const ratio = distance / gestureRef.current.startDistance;
        transformPendingRef.current.scale = gestureRef.current.startScale * ratio;
      }

      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      transformPendingRef.current.offsetX = gestureRef.current.startOffsetX + (centerX - gestureRef.current.startCenterX) / previewScale;
      transformPendingRef.current.offsetY = gestureRef.current.startOffsetY + (centerY - gestureRef.current.startCenterY) / previewScale;
      scheduleTransformFlush();
      return;
    }

    if (points.length === 1) {
      const dx = (event.clientX - prev.x) / previewScale;
      const dy = (event.clientY - prev.y) / previewScale;

      dragPendingRef.current.dx += dx;
      dragPendingRef.current.dy += dy;

      if (dragRafRef.current) return;

      dragRafRef.current = window.requestAnimationFrame(() => {
        const { dx: pendingDx, dy: pendingDy } = dragPendingRef.current;
        dragPendingRef.current = { dx: 0, dy: 0 };
        dragRafRef.current = null;

        if (pendingDx !== 0) setPhotoOffsetX(v => v + pendingDx);
        if (pendingDy !== 0) setPhotoOffsetY(v => v + pendingDy);
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    pointersRef.current.delete(event.pointerId);
    if (previewInteractionRef.current?.hasPointerCapture(event.pointerId)) {
      previewInteractionRef.current.releasePointerCapture(event.pointerId);
    }

    if (pointersRef.current.size < 2) {
      gestureRef.current.startDistance = 0;
    }

    if (pointersRef.current.size === 0) {
      setIsInteractingPreview(false);
      updateResult();
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !userPhoto) return;
    setIsInteractingPreview(true);
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    wheelPendingRef.current += -event.deltaY * 0.04;

    if (wheelIdleTimerRef.current) window.clearTimeout(wheelIdleTimerRef.current);
    wheelIdleTimerRef.current = window.setTimeout(() => {
      setIsInteractingPreview(false);
      updateResult();
    }, 140);

    if (transformRafRef.current) return;
    transformRafRef.current = window.requestAnimationFrame(() => {
      const delta = wheelPendingRef.current;
      wheelPendingRef.current = 0;
      transformRafRef.current = null;
      if (delta !== 0) setPhotoScale(v => clamp(v + delta, 20, 400));
    });
  };

  if (loading) {
    return (
      <Layout>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 text-center text-muted-foreground">Loading...</div>
        </section>
      </Layout>
    );
  }

  if (!campaign) {
    return (
      <Layout>
        <section className="py-24 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="font-display text-2xl font-bold text-foreground mb-2">{t.public?.notFound ?? 'Campaign tidak ditemukan'}</h1>
            <p className="text-muted-foreground text-sm">{t.public?.notFoundDesc ?? 'Link ini tidak valid atau campaign sudah dihapus.'}</p>
          </div>
        </section>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-6xl">
          {isFree && (
            <div className="mb-6 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">— {t.public?.adSpace ?? 'Advertisement'} —</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <div className="glass-strong rounded-2xl p-6 border-gold-subtle space-y-4">
                <h1 className="font-display text-2xl font-bold text-gold-gradient">{campaign.name}</h1>
                {campaign.description ? (
                  <p className="text-muted-foreground text-sm">{campaign.description}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">{t.public?.uploadPrompt ?? 'Upload foto kamu untuk membuat twibbon'}</p>
                )}

                {exampleImage && (
                  <div className="pt-1">
                    <div className="mx-auto w-[70%] max-w-[320px] rounded-xl border border-border bg-secondary/20 p-2">
                      <img src={exampleImage} alt="Preview hasil twibbon" className="w-full h-auto rounded-lg" loading="lazy" />
                    </div>
                  </div>
                )}

                {campaign.caption && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 text-left space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.caption}</p>
                    <Button variant="outline" size="sm" className="border-border gap-1 text-xs" onClick={handleCopyCaption}>
                      <Copy className="w-3 h-3" />
                      {t.public?.copyCaption ?? 'Salin Caption'}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-4 sm:p-6 md:p-8 border-gold-subtle min-w-0">
              {isOwner && isFree && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                  <Crown className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm text-foreground font-medium">{t.public?.ownerWatermarkNotice ?? 'Campaign ini masih menggunakan watermark'}</p>
                    <p className="text-xs text-muted-foreground">{t.public?.ownerWatermarkDesc ?? 'Upgrade ke Premium untuk menghapus watermark dan iklan.'}</p>
                  </div>
                  <Button size="sm" className="gold-glow text-xs gap-1 shrink-0" onClick={handleRemoveWatermark}>
                    <Crown className="w-3 h-3" /> {t.public?.removeWatermark ?? 'Remove Watermark'}
                  </Button>
                </div>
              )}

              {!userPhoto ? (
                <div className="space-y-4">
                  <label className={`block ${processingPhoto ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                    <div className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors text-center">
                      <Upload className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                      <p className="text-foreground font-medium">{t.public?.uploadPhoto ?? 'Upload foto kamu'}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t.public?.clickOrDrag ?? 'Klik atau drag untuk upload'}</p>
                      {processingPhoto && <p className="text-xs text-muted-foreground mt-2">Processing photo...</p>}
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={processingPhoto} />
                  </label>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    ref={previewInteractionRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onWheelCapture={onWheel}
                    className="relative rounded-xl overflow-hidden border border-border bg-secondary/20 mb-2 flex items-center justify-center p-2"
                    onDragStart={event => event.preventDefault()}
                    style={{
                      touchAction: 'none',
                      overscrollBehavior: 'contain',
                      backgroundImage:
                        'linear-gradient(45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(-45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(0 0% 20%) 75%), linear-gradient(-45deg, transparent 75%, hsl(0 0% 20%) 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: 'hsl(0 0% 15%)',
                    }}
                  >
                    {resultImage || templateImage ? (
                      <PhotoComposerPreview
                        templateImage={templateImage}
                        userPhoto={userPhoto}
                        campaignType={(campaign?.type ?? 'frame') as 'frame' | 'background'}
                        width={fw}
                        height={fh}
                        previewScale={previewScale}
                        photoScale={photoScale}
                        photoOffsetX={photoOffsetX}
                        photoOffsetY={photoOffsetY}
                        placeholderMeta={placeholderMeta}
                      />
                    ) : (
                      <div className="py-12 text-muted-foreground text-sm">{t.campaign?.editor?.loading ?? 'Loading...'}</div>
                    )}

                    {processingPhoto && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing photo...
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="glass rounded-xl p-4 border-gold-subtle space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{t.public?.adjustPhoto ?? 'Atur Posisi Foto'}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Move className="w-3 h-3" /> Drag untuk geser
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> Scroll / pinch untuk zoom
                    </p>
                    <p className="text-xs text-muted-foreground">Scale: {Math.round(photoScale)}% • X: {Math.round(photoOffsetX)} • Y: {Math.round(photoOffsetY)}</p>
                    <label className={`inline-flex mt-1 ${processingPhoto ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={processingPhoto} />
                      <span className="text-xs text-primary underline">{t.public?.changePhoto ?? 'Ganti Foto'}</span>
                    </label>
                  </div>

                  {campaign?.caption && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.caption}</p>
                      <Button variant="outline" size="sm" className="border-border gap-1 text-xs w-full" onClick={handleCopyCaption}>
                        <Copy className="w-3 h-3" />
                        {t.public?.copyCaption ?? 'Salin Caption'}
                      </Button>
                    </div>
                  )}

                  <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                    {t.public?.downloadResult ?? 'Download Hasil'}
                  </Button>

                  <div className="flex gap-2 justify-center flex-wrap">
                    <Button variant="outline" className="border-border gap-2 flex-1 min-w-0" title="WhatsApp" onClick={handleShareWhatsApp}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
                      WhatsApp
                    </Button>
                    <Button variant="outline" className="border-border gap-2 flex-1 min-w-0" title="Instagram" onClick={handleShareInstagram}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 100 12.324 6.162 6.162 0 100-12.324zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405a1.441 1.441 0 11-2.882 0 1.441 1.441 0 012.882 0z"/></svg>
                      Instagram
                    </Button>
                    <Button variant="outline" className="border-border gap-2 flex-1 min-w-0" title={t.public?.shareUniversal ?? 'Share'} onClick={handleShareUniversal}>
                      <Share2 className="w-4 h-4" />
                      {t.public?.shareUniversal ?? 'Share'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {isFree && (
            <div className="mt-6 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">— {t.public?.adSpace ?? 'Advertisement'} —</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
              </div>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default CampaignPublic;
