import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Upload, Download, Copy, MessageCircle, Move, ZoomIn, Crown, Loader2 } from 'lucide-react';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { renderTemplatePNG, composeResult } from '@/utils/renderTemplate';
import { removeBackgroundFromDataUrl, warmupBackgroundRemoval } from '@/utils/removeBackground';
import { extractPlaceholderMeta, extractPreviewMeta } from '@/utils/campaignDesign';
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

  const [fw, fh] = sizeMap[campaign?.size] || [1080, 1080];
  const previewScale = Math.min(500 / fw, 600 / fh, 1);
  const exampleImage = previewImage;
  const placeholderMeta = extractPlaceholderMeta(campaign?.design_json);

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
        setUserPhoto(photoDataUrl);
      } catch {
        setUserPhoto(rawDataUrl);
        toast.error('Gagal remove background, memakai foto original.');
      } finally {
        setProcessingPhoto(false);
      }

      setPhotoScale(100);
      setPhotoOffsetX(0);
      setPhotoOffsetY(0);
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

  const handleShareWhatsApp = () => {
    const url = `${window.location.origin}/c/${slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(url)}`, '_blank');
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
                    <div className="mx-auto w-[72%] sm:w-[64%] rounded-xl border border-border bg-secondary/20 p-2">
                      <img src={exampleImage} alt="Preview hasil twibbon" className="w-full h-auto rounded-lg" loading="lazy" />
                    </div>
                  </div>
                )}

                {campaign.caption && (
                  <div className="rounded-xl border border-border bg-secondary/20 p-4 text-left space-y-3">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.caption}</p>
                    <Button variant="outline" size="sm" className="border-border gap-1 text-xs" onClick={handleCopyCaption}>
                      <Copy className="w-3 h-3" />
                      {t.public?.copyCaption ?? 'Salin Caption'} / Copy Caption
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-strong rounded-2xl p-6 md:p-8 border-gold-subtle">
              {isOwner && isFree && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
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

                  <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
                    <Download className="w-4 h-4" />
                    {t.public?.downloadResult ?? 'Download Hasil'}
                  </Button>

                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="icon" className="border-border" title="WhatsApp" onClick={handleShareWhatsApp}>
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="border-border" title="Copy Link" onClick={handleCopyLink}>
                      <Copy className="w-4 h-4" />
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
