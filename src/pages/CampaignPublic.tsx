import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Upload, Download, Copy, Move, ZoomIn, Crown, Loader2, SlidersHorizontal, Users, Link2, Calendar } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Slider } from '@/components/ui/slider';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { renderTemplatePNG, renderBackgroundOverlayPNG, renderBackgroundUnderPNG, composeResult, loadImage } from '@/utils/renderTemplate';
import { removeBackgroundFromDataUrl, warmupBackgroundRemoval } from '@/utils/removeBackground';
import { applyAlphaThreshold } from '@/utils/applyAlphaThreshold';
import { extractPlaceholderMeta, extractPreviewMeta } from '@/utils/campaignDesign';
import { useIsMobile } from '@/hooks/use-mobile';
import PhotoComposerPreview from '@/components/PhotoComposerPreview';
import AdSenseBanner from '@/components/AdSenseBanner';
import AnchorAd from '@/components/AnchorAd';
import InterstitialAdDialog from '@/components/InterstitialAdDialog';
import { useMidtransPayment } from '@/hooks/useMidtransPayment';
import { usePricing } from '@/hooks/usePricing';
import PaymentConfirmDialog from '@/components/PaymentConfirmDialog';

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CampaignPublic = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [creatorName, setCreatorName] = useState('');
  const [creatorAvatarUrl, setCreatorAvatarUrl] = useState('');
  const [supportersCount, setSupportersCount] = useState(0);

  const [userPhoto, setUserPhoto] = useState<string>('');
  const [templateImage, setTemplateImage] = useState<string>('');
  const [bgOverlayImage, setBgOverlayImage] = useState<string>('');
  const [bgUnderImage, setBgUnderImage] = useState<string>('');
  const [resultImage, setResultImage] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string>('');
  const [bakedPreviewImage, setBakedPreviewImage] = useState<string>('');
  const [photoScale, setPhotoScale] = useState(100);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isInteractingPreview, setIsInteractingPreview] = useState(false);
  const [rawRemovedBg, setRawRemovedBg] = useState<string>('');
  const [bgThreshold, setBgThreshold] = useState(50);
  const [applyingThreshold, setApplyingThreshold] = useState(false);

  const { pay, paying, initializing: paymentInitializing } = useMidtransPayment();
  const { premiumPrice, originalPrice } = usePricing();
  const [showPaymentConfirm, setShowPaymentConfirm] = useState(false);
  const isFree = campaign?.tier !== 'premium';
  const [showInterstitialAd, setShowInterstitialAd] = useState(false);
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
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setCampaign(null);
        setLoading(false);
        return;
      }

      setCampaign(data);

      // Fetch creator profile (name + avatar)
      const { data: profile } = await supabase
        .from('profiles' as any)
        .select('name, avatar_url')
        .eq('id', data.user_id)
        .maybeSingle();
      if (!cancelled && profile) {
        setCreatorName((profile as any).name || '');
        setCreatorAvatarUrl((profile as any).avatar_url || '');
      }

      // Fetch supporters count
      const { data: stats } = await supabase
        .from('campaign_stats' as any)
        .select('supporters_count')
        .eq('campaign_id', data.id)
        .maybeSingle();
      if (!cancelled && stats) {
        setSupportersCount((stats as any).supporters_count || 0);
      }

      const previewMeta = extractPreviewMeta(data.design_json);
      setPreviewImage(previewMeta.previewImageDataUrl ?? '');
      setUserPhoto('');
      setPhotoScale(100);
      setPhotoOffsetX(0);
      setPhotoOffsetY(0);

      try {
        const [w, h] = sizeMap[data.size] || [1080, 1080];
        const campaignType = data.type ?? 'frame';
        const tplDataUrl = await renderTemplatePNG(data.design_json, w, h, campaignType);
        if (!cancelled) setTemplateImage(tplDataUrl);

        if (campaignType === 'background') {
          const [overlay, under] = await Promise.all([
            renderBackgroundOverlayPNG(data.design_json, w, h),
            renderBackgroundUnderPNG(data.design_json, w, h),
          ]);
          if (!cancelled) {
            setBgOverlayImage(overlay);
            setBgUnderImage(under);
          }
        }
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
    if (!previewImage) { setBakedPreviewImage(''); return; }
    if (!isFree) { setBakedPreviewImage(previewImage); return; }

    let cancelled = false;
    const bake = async () => {
      try {
        const img = await loadImage(previewImage);
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);

        const pvFontSize = Math.max(28, Math.round(img.width * 0.13));
        ctx.save();
        ctx.translate(img.width / 2, img.height / 2);
        ctx.rotate(-20 * Math.PI / 180);
        ctx.font = `900 ${pvFontSize}px "Inter", "Segoe UI", sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.3)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetY = 2;
        ctx.fillText('PREVIEW', 0, 0);
        ctx.restore();

        const label = 'Made with TWIBO.id';
        const fontSize = Math.max(10, Math.round(img.width * 0.034));
        const padX = Math.max(10, Math.round(fontSize * 0.9));
        const padY = Math.max(4, Math.round(fontSize * 0.38));
        const margin = Math.max(8, Math.round(img.width * 0.025));
        ctx.save();
        ctx.font = `700 ${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`;
        const tw = ctx.measureText(label).width;
        const badgeW = tw + padX * 2;
        const badgeH = fontSize + padY * 2;
        const bx = img.width - margin - badgeW;
        const by = img.height - margin - badgeH;
        const radius = badgeH / 2;
        ctx.shadowColor = 'rgba(0,0,0,0.25)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.fillStyle = 'rgba(255,255,255,0.94)';
        ctx.beginPath();
        if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(bx, by, badgeW, badgeH, radius);
        } else {
          ctx.moveTo(bx + radius, by);
          ctx.lineTo(bx + badgeW - radius, by);
          ctx.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + radius);
          ctx.lineTo(bx + badgeW, by + badgeH - radius);
          ctx.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - radius, by + badgeH);
          ctx.lineTo(bx + radius, by + badgeH);
          ctx.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - radius);
          ctx.lineTo(bx, by + radius);
          ctx.quadraticCurveTo(bx, by, bx + radius, by);
        }
        ctx.closePath();
        ctx.fill();

        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        ctx.fillStyle = 'hsl(46, 95%, 48%)';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + padX, by + badgeH / 2);
        ctx.restore();

        if (!cancelled) setBakedPreviewImage(canvas.toDataURL('image/png'));
      } catch {
        if (!cancelled) setBakedPreviewImage(previewImage);
      }
    };
    bake();
    return () => { cancelled = true; };
  }, [previewImage, isFree]);

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
        bgOverlayDataUrl: bgOverlayImage || undefined,
        bgUnderDataUrl: bgUnderImage || undefined,
      });
      if (current === composeVersionRef.current) {
        setResultImage(result);
      }
    } catch (err) {
      console.error('Compose error:', err);
    }
  }, [templateImage, userPhoto, photoScale, photoOffsetX, photoOffsetY, campaign, isFree, fw, fh, placeholderMeta, bgOverlayImage, bgUnderImage]);

  useEffect(() => {
    if (isInteractingPreview) return;
    const timer = window.setTimeout(() => { updateResult(); }, 40);
    return () => window.clearTimeout(timer);
  }, [updateResult, isInteractingPreview]);

  const trackSupporter = async () => {
    if (!slug || supporterTrackedRef.current) return;
    supporterTrackedRef.current = true;
    await supabase.rpc('increment_campaign_stats' as any, { _slug: slug, _event: 'supporter' });
  };

  const getInitialPhotoTransform = useCallback(
    async (photoDataUrl: string) => {
      if (!photoDataUrl) return { scale: 100, offsetX: 0, offsetY: 0 };
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
        if (campaign?.type === 'background') {
          const removedBgDataUrl = await removeBackgroundFromDataUrl(rawDataUrl);
          setRawRemovedBg(removedBgDataUrl);
          setBgThreshold(50);
          const processed = await applyAlphaThreshold(removedBgDataUrl, 50);
          const initialTransform = await getInitialPhotoTransform(processed);
          setUserPhoto(processed);
          setPhotoScale(initialTransform.scale);
          setPhotoOffsetX(initialTransform.offsetX);
          setPhotoOffsetY(initialTransform.offsetY);
        } else {
          const initialTransform = await getInitialPhotoTransform(rawDataUrl);
          setUserPhoto(rawDataUrl);
          setRawRemovedBg('');
          setPhotoScale(initialTransform.scale);
          setPhotoOffsetX(initialTransform.offsetX);
          setPhotoOffsetY(initialTransform.offsetY);
        }
      } catch {
        const initialTransform = await getInitialPhotoTransform(rawDataUrl);
        setUserPhoto(rawDataUrl);
        setRawRemovedBg('');
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
      fullWidth: fw, fullHeight: fh,
      photoScale, photoOffsetX, photoOffsetY,
      addWatermark: isFree,
      campaignType: campaign.type ?? 'frame',
      placeholderMeta,
      previewMaxW: fw, previewMaxH: fh,
      bgOverlayDataUrl: bgOverlayImage || undefined,
      bgUnderDataUrl: bgUnderImage || undefined,
    }).catch(() => resultImage);
    if (!downloadableImage) return;
    const a = document.createElement('a');
    a.href = downloadableImage;
    const safeName = (campaign.name || slug || 'twibbon').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `${safeName}-twibo.id.png`;
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
      } catch {}
    }
    if (navigator.share) {
      try { await navigator.share(shareData); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success(t.public?.linkCopied ?? 'Link disalin!');
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/c/${slug}`);
    toast.success(t.public?.linkCopied ?? 'Link disalin!');
  };

  const applyBgProcessing = useCallback(async (threshold: number) => {
    if (!rawRemovedBg) return;
    setApplyingThreshold(true);
    try {
      const processed = await applyAlphaThreshold(rawRemovedBg, threshold);
      setUserPhoto(processed);
    } catch {} finally { setApplyingThreshold(false); }
  }, [rawRemovedBg]);

  const handleThresholdChange = useCallback(async (values: number[]) => {
    const newThreshold = values[0];
    setBgThreshold(newThreshold);
    await applyBgProcessing(newThreshold);
  }, [applyBgProcessing]);

  const handleRemoveWatermark = async (voucherCode?: string) => {
    if (!campaign) return;
    const result = await pay(campaign.id, voucherCode);
    if (result.success) {
      setCampaign((prev: any) => ({ ...prev, tier: 'premium' }));
    }
    setShowPaymentConfirm(false);
  };

  const isPreviewBusy = processingPhoto;

  useEffect(() => {
    const el = previewInteractionRef.current;
    if (!el) return;
    const preventNativeScroll = (event: Event) => {
      if (event.cancelable) event.preventDefault();
      event.stopPropagation();
    };
    el.addEventListener('touchmove', preventNativeScroll, { passive: false });
    return () => { el.removeEventListener('touchmove', preventNativeScroll); };
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
      gestureRef.current.startDistance = Math.hypot(b.x - a.x, b.y - a.y);
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
      const distance = Math.hypot(b.x - a.x, b.y - a.y);
      if (gestureRef.current.startDistance > 0) {
        transformPendingRef.current.scale = gestureRef.current.startScale * (distance / gestureRef.current.startDistance);
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
    if (pointersRef.current.size < 2) gestureRef.current.startDistance = 0;
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
      <section className="py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          {isFree && (
            <div className="mb-6">
              <AdSenseBanner />
            </div>
          )}

          {/* Campaign Header - banner INSIDE this container */}
          <div className="glass-strong rounded-2xl border-gold-subtle mb-6 overflow-hidden">
            {/* Banner Image inside container */}
            {campaign.banner_url && (
              <div className="w-full">
                <img
                  src={campaign.banner_url}
                  alt={`${campaign.name} banner`}
                  className="w-full h-auto object-cover"
                  style={{ maxHeight: '280px' }}
                  loading="lazy"
                />
              </div>
            )}

            <div className="p-6 md:p-8 space-y-4">
              <h1 className="font-display text-2xl md:text-3xl font-bold text-gold-gradient">{campaign.name}</h1>

              {/* Line 1: Avatar, name, premium badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <Avatar className="w-7 h-7">
                  {creatorAvatarUrl && (
                    <AvatarImage src={creatorAvatarUrl} alt={creatorName} />
                  )}
                  <AvatarFallback className="bg-primary/20 text-primary text-xs font-bold">
                    {(creatorName || 'U').charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm text-foreground font-medium">{creatorName || 'User'}</span>
                {campaign.tier === 'premium' && (
                  <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                    <Crown className="w-3 h-3" />
                    Premium
                  </span>
                )}
              </div>

              {/* Line 2: Date and supporters */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(campaign.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" /> {supportersCount} supporters
                </span>
              </div>

              {/* About This Campaign */}
              {campaign.description && (
                <div>
                  <hr className="border-border/40 my-2" />
                  <h3 className="text-lg font-display font-semibold text-foreground mb-2">Tentang Campaign Ini</h3>
                  <p className="text-foreground/80 text-sm">{campaign.description}</p>
                </div>
              )}

              {/* Share bar - share title + link only */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-0 flex items-center gap-2 glass rounded-lg px-3 py-2 text-xs text-foreground/70">
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{window.location.origin}/c/{slug}</span>
                </div>
                <Button variant="outline" size="sm" className="border-border gap-1 text-xs text-foreground/80" onClick={() => {
                  const url = `${window.location.origin}/c/${slug}`;
                  const text = `${campaign.name}\n${url}`;
                  navigator.clipboard.writeText(text);
                  toast.success(t.public?.linkCopied ?? 'Link disalin!');
                }}>
                  <Copy className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            {/* Left column: preview image + caption directly below */}
            <div className="space-y-0">
              {bakedPreviewImage && (
                <div className="glass-strong rounded-t-2xl p-4 border-gold-subtle border-b-0">
                  <div className="relative mx-auto max-w-[400px] rounded-xl border border-border bg-secondary/20 p-2">
                    <img src={bakedPreviewImage} alt="Preview hasil twibbon" className="w-full h-auto rounded-lg" loading="lazy" draggable={false} onContextMenu={e => e.preventDefault()} />
                  </div>
                </div>
              )}

              {/* Caption directly under preview image - no separate container */}
              {campaign.caption && !userPhoto && (
                <div className={`${bakedPreviewImage ? 'rounded-b-2xl border-t-0' : 'rounded-2xl'} border border-border bg-secondary/20 p-4`}>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.caption}</p>
                </div>
              )}
            </div>

            {/* Right column: upload & compose */}
            <div className="glass-strong rounded-2xl p-4 sm:p-6 md:p-8 border-gold-subtle min-w-0">
              {isOwner && isFree && (
                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <Crown className="w-5 h-5 text-primary shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground font-medium">{t.public?.ownerWatermarkNotice ?? 'Campaign ini masih menggunakan watermark'}</p>
                      <p className="text-xs text-muted-foreground">{t.public?.ownerWatermarkDesc ?? 'Upgrade ke Premium untuk menghapus watermark dan iklan.'}</p>
                    </div>
                  </div>
                  <Button size="sm" className="gold-glow text-xs gap-1 w-full" onClick={() => setShowPaymentConfirm(true)} disabled={paying}>
                    {paying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crown className="w-3 h-3" />}
                    {paying ? 'Processing...' : `Upgrade Premium — Rp ${premiumPrice.toLocaleString('id-ID')}`}
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
                    className="relative rounded-xl overflow-hidden border border-border mb-2 mx-auto"
                    onDragStart={event => event.preventDefault()}
                    style={{
                      touchAction: 'none',
                      overscrollBehavior: 'contain',
                      width: Math.max(1, Math.round(fw * previewScale)),
                      height: Math.max(1, Math.round(fh * previewScale)),
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
                        bgOverlayImage={bgOverlayImage}
                        bgUnderImage={bgUnderImage}
                        showWatermark={isFree}
                      />
                    ) : (
                      <div className="py-12 text-muted-foreground text-sm">{t.campaign?.editor?.loading ?? 'Loading...'}</div>
                    )}

                    {processingPhoto && (
                      <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.public?.processingPhoto ?? 'Processing photo...'}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="glass rounded-xl p-4 border-gold-subtle space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">{t.public?.adjustPhoto ?? 'Atur Posisi Foto'}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Move className="w-3 h-3" /> {t.campaign?.dragToMove ?? 'Drag to move'}
                    </p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <ZoomIn className="w-3 h-3" /> {t.campaign?.scrollToZoom ?? 'Scroll / pinch to zoom'}
                    </p>
                    <p className="text-xs text-muted-foreground">Scale: {Math.round(photoScale)}% • X: {Math.round(photoOffsetX)} • Y: {Math.round(photoOffsetY)}</p>
                    <label className={`inline-flex mt-1 ${processingPhoto ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={processingPhoto} />
                      <span className="text-xs text-primary underline">{t.public?.changePhoto ?? 'Ganti Foto'}</span>
                    </label>
                  </div>

                  {rawRemovedBg && campaign?.type === 'background' && (
                    <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">{t.public?.bgSettings ?? 'Background Settings'}</h3>
                        {applyingThreshold && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{t.public?.tolerance ?? 'Tolerance'}</span>
                          <span>{bgThreshold}%</span>
                        </div>
                        <Slider value={[bgThreshold]} onValueChange={handleThresholdChange} min={0} max={100} step={5} className="w-full" />
                      </div>
                    </div>
                  )}

                  {/* Caption below interactive preview */}
                  {campaign?.caption && (
                    <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap">{campaign.caption}</p>
                      <Button variant="outline" size="sm" className="border-border gap-1 text-xs w-full" onClick={handleCopyCaption}>
                        <Copy className="w-3 h-3" />
                        {t.public?.copyCaption ?? 'Salin Caption'}
                      </Button>
                    </div>
                  )}

                  <Button className="gold-glow font-semibold gap-2 w-full" onClick={() => {
                    if (isFree) {
                      setShowInterstitialAd(true);
                    } else {
                      handleDownload();
                    }
                  }}>
                    <Download className="w-4 h-4" />
                    {t.public?.downloadResult ?? 'Download Hasil'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {isFree && (
            <div className="mt-6">
              <AdSenseBanner />
            </div>
          )}
        </div>
        {isFree && <AnchorAd />}
      </section>

      <InterstitialAdDialog
        open={showInterstitialAd}
        onClose={() => setShowInterstitialAd(false)}
        onDownload={handleDownload}
      />
      <PaymentConfirmDialog
        open={showPaymentConfirm}
        onClose={() => setShowPaymentConfirm(false)}
        onConfirm={(voucherCode) => handleRemoveWatermark(voucherCode)}
        basePrice={premiumPrice}
        originalPrice={originalPrice}
        campaignName={campaign?.name ?? ''}
        paying={paying}
      />

      {paymentInitializing && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-foreground font-semibold">Memproses pembayaran...</p>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default CampaignPublic;
