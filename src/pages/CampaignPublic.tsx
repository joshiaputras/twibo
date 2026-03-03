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
import { removeBackgroundFromDataUrl } from '@/utils/removeBackground';
import { extractPreviewMeta } from '@/utils/campaignDesign';

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
  const [photoScale, setPhotoScale] = useState(100);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isComposingResult, setIsComposingResult] = useState(false);

  const isFree = campaign?.tier !== 'premium';
  const composeVersionRef = useRef(0);
  const supporterTrackedRef = useRef(false);
  const previewInteractionRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef({ startScale: 100, startDistance: 0, startOffsetX: 0, startOffsetY: 0, startCenterX: 0, startCenterY: 0 });

  const sizeMap: Record<string, [number, number]> = {
    square: [1080, 1080],
    portrait: [1080, 1350],
    story: [1080, 1920],
  };

  const [fw, fh] = sizeMap[campaign?.size] || [1080, 1080];
  const previewScale = Math.min(500 / fw, 600 / fh, 1);

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      setLoading(true);
      const { data, error }: { data: any; error: any } = await supabase
        .from('campaigns' as any)
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (error || !data) {
        setLoading(false);
        return;
      }

      setCampaign(data);
      if (user && data.user_id === user.id) setIsOwner(true);

      const previewMeta = extractPreviewMeta(data.design_json);
      setUserPhoto(previewMeta.photoDataUrl ?? '');
      setPhotoScale(previewMeta.photoScale ?? 100);
      setPhotoOffsetX(previewMeta.photoOffsetX ?? 0);
      setPhotoOffsetY(previewMeta.photoOffsetY ?? 0);

      setLoading(false);

      try {
        const [w, h] = sizeMap[data.size] || [1080, 1080];
        const tplDataUrl = await renderTemplatePNG(data.design_json, w, h, data.type ?? 'frame');
        setTemplateImage(tplDataUrl);
      } catch (err) {
        console.error('Template render error:', err);
      }
    };
    load();
  }, [slug, user]);

  const updateResult = useCallback(async () => {
    if (!templateImage || !campaign) return;
    const current = ++composeVersionRef.current;
    setIsComposingResult(true);

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
        previewMaxW: 500,
        previewMaxH: 600,
      });
      if (current === composeVersionRef.current) {
        setResultImage(result);
      }
    } catch (err) {
      console.error('Compose error:', err);
    } finally {
      if (current === composeVersionRef.current) {
        setIsComposingResult(false);
      }
    }
  }, [templateImage, userPhoto, photoScale, photoOffsetX, photoOffsetY, campaign, isFree, fw, fh]);

  useEffect(() => {
    updateResult();
  }, [updateResult]);

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
    if (!resultImage) return;

    const a = document.createElement('a');
    a.href = resultImage;
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

  const isPreviewBusy = processingPhoto || isComposingResult;

  useEffect(() => {
    const el = previewInteractionRef.current;
    if (!el) return;

    const preventWheel = (event: WheelEvent) => {
      event.preventDefault();
    };

    el.addEventListener('wheel', preventWheel, { passive: false });
    return () => el.removeEventListener('wheel', preventWheel);
  }, [resultImage, templateImage]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy) return;
    event.preventDefault();
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
    if (isPreviewBusy || !pointersRef.current.has(event.pointerId)) return;
    event.preventDefault();

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
        setPhotoScale(clamp(gestureRef.current.startScale * ratio, 20, 400));
      }

      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      setPhotoOffsetX(gestureRef.current.startOffsetX + (centerX - gestureRef.current.startCenterX) / previewScale);
      setPhotoOffsetY(gestureRef.current.startOffsetY + (centerY - gestureRef.current.startCenterY) / previewScale);
      return;
    }

    if (points.length === 1) {
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      setPhotoOffsetX(v => v + dx / previewScale);
      setPhotoOffsetY(v => v + dy / previewScale);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    if (previewInteractionRef.current?.hasPointerCapture(event.pointerId)) {
      previewInteractionRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isPreviewBusy) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? -6 : 6;
    setPhotoScale(v => clamp(v + delta, 20, 400));
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
        <div className="container mx-auto px-4 max-w-2xl">
          {isFree && (
            <div className="mb-6 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">— {t.public?.adSpace ?? 'Advertisement'} —</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
              </div>
            </div>
          )}

          <div className="glass-strong rounded-2xl p-6 md:p-8 border-gold-subtle">
            <h1 className="font-display text-2xl font-bold text-gold-gradient mb-1">{campaign.name}</h1>
            {campaign.description ? (
              <p className="text-muted-foreground text-sm mb-6">{campaign.description}</p>
            ) : (
              <p className="text-muted-foreground text-sm mb-6">{t.public?.uploadPrompt ?? 'Upload foto kamu untuk membuat twibbon'}</p>
            )}

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

            <div
              ref={previewInteractionRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerLeave={onPointerUp}
              onWheel={onWheel}
              className="relative rounded-xl overflow-hidden border border-border bg-secondary/20 mb-4 flex items-center justify-center p-2 touch-none"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(-45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(0 0% 20%) 75%), linear-gradient(-45deg, transparent 75%, hsl(0 0% 20%) 75%)',
                backgroundSize: '16px 16px',
                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                backgroundColor: 'hsl(0 0% 15%)',
              }}
            >
              {resultImage ? (
                <img src={resultImage} alt="Result" draggable={false} className="pointer-events-none select-none max-w-full h-auto rounded" style={{ maxHeight: 500 }} />
              ) : (
                <div className="py-12 text-muted-foreground text-sm">{t.campaign?.editor?.loading ?? 'Loading...'}</div>
              )}

              {isPreviewBusy && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {processingPhoto ? 'Processing photo...' : 'Generating preview...'}
                  </div>
                </div>
              )}
            </div>

            {!userPhoto ? (
              <div className="space-y-4">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors text-center">
                    <Upload className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                    <p className="text-foreground font-medium">{t.public?.uploadPhoto ?? 'Upload foto kamu'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.public?.clickOrDrag ?? 'Klik atau drag untuk upload'}</p>
                    {processingPhoto && <p className="text-xs text-muted-foreground mt-2">Processing photo...</p>}
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="glass rounded-xl p-4 border-gold-subtle space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">{t.public?.adjustPhoto ?? 'Atur Posisi Foto'}</h3>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Move className="w-3 h-3" /> Drag untuk geser
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ZoomIn className="w-3 h-3" /> Scroll / pinch untuk zoom
                  </p>
                  <p className="text-xs text-muted-foreground">Scale: {Math.round(photoScale)}% • X: {Math.round(photoOffsetX)} • Y: {Math.round(photoOffsetY)}</p>
                  <label className="inline-flex cursor-pointer mt-1">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <span className="text-xs text-primary underline">{t.public?.changePhoto ?? 'Ganti Foto'}</span>
                  </label>
                </div>

                <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
                  <Download className="w-4 h-4" />
                  {t.public?.downloadResult ?? 'Download Hasil'}
                </Button>

                {campaign.caption && (
                  <div className="glass rounded-xl p-4 border-gold-subtle text-left">
                    <p className="text-sm text-foreground mb-2">{campaign.caption}</p>
                    <Button variant="outline" size="sm" className="border-border gap-1 text-xs" onClick={handleCopyCaption}>
                      <Copy className="w-3 h-3" />
                      {t.public?.copyCaption ?? 'Salin Caption'}
                    </Button>
                  </div>
                )}

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
