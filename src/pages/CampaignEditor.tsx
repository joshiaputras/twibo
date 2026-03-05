import Layout from '@/components/Layout';
import PhotoComposerPreview from '@/components/PhotoComposerPreview';
import { Switch } from '@/components/ui/switch';
import BannerCropDialog from '@/components/BannerCropDialog';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, lazy, Suspense, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Check,
  AlertTriangle,
  Square,
  RectangleVertical,
  Smartphone,
  Frame,
  Image,
  ChevronLeft,
  ChevronRight,
  Save,
  Upload,
  Crown,
  CreditCard,
  Move,
  ZoomIn,
  Loader2,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useMidtransPayment } from '@/hooks/useMidtransPayment';
import { usePricing } from '@/hooks/usePricing';
import PaymentConfirmDialog from '@/components/PaymentConfirmDialog';
import { renderTemplatePNG, renderBackgroundOverlayPNG, renderBackgroundUnderPNG, composeResult, loadImage } from '@/utils/renderTemplate';
import { removeBackgroundFromDataUrl, warmupBackgroundRemoval } from '@/utils/removeBackground';
import { applyAlphaThreshold } from '@/utils/applyAlphaThreshold';
import { extractCanvasDesign, extractPlaceholderMeta, extractPreviewMeta, mergeDesignWithPreview } from '@/utils/campaignDesign';
import { useIsMobile } from '@/hooks/use-mobile';

const CanvasEditor = lazy(() => import('@/components/CanvasEditor'));

const STEPS_FREE = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6'] as const;
const STEPS_PREMIUM = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;
type StepsArray = typeof STEPS_FREE | typeof STEPS_PREMIUM;

type CampaignSize = 'square' | 'portrait' | 'story';
type CampaignType = 'frame' | 'background';
type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

type FormState = {
  name: string;
  description: string;
  caption: string;
  slug: string;
  size: CampaignSize;
  type: CampaignType;
  is_private: boolean;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CampaignEditor = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { pay, paying, initializing: paymentInitializing } = useMidtransPayment();
  const { premiumPrice, originalPrice, paypalEnabled, paypalClientId, paypalMode, paypalPriceUsd, paypalOriginalPriceUsd } = usePricing();
  const { id } = useParams();
  const isEdit = !!id;

  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(id ?? null);
  const [saving, setSaving] = useState(false);
  const [canvasState, setCanvasState] = useState<string>('');
  const [campaignTier, setCampaignTier] = useState<string>('free');
  const [bannerUrl, setBannerUrl] = useState<string>('');
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [showBannerCrop, setShowBannerCrop] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    caption: '',
    slug: '',
    size: 'square',
    type: 'frame',
    is_private: false,
  });

  const [templateImage, setTemplateImage] = useState<string>('');
  const [bgOverlayImage, setBgOverlayImage] = useState<string>('');
  const [bgUnderImage, setBgUnderImage] = useState<string>('');
  const [simulationPhoto, setSimulationPhoto] = useState<string>('');
  const [simScale, setSimScale] = useState(100);
  const [simOffsetX, setSimOffsetX] = useState(0);
  const [simOffsetY, setSimOffsetY] = useState(0);
  const [previewResult, setPreviewResult] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);
  const [justPaid, setJustPaid] = useState(false);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [isInteractingPreview, setIsInteractingPreview] = useState(false);
  const [loadingCampaign, setLoadingCampaign] = useState(isEdit);
  const [rawRemovedBg, setRawRemovedBg] = useState<string>('');
  const [bgThreshold, setBgThreshold] = useState(50);
  const [applyingThreshold, setApplyingThreshold] = useState(false);

  const composeVersionRef = useRef(0);
  const previewInteractionRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef({ startScale: 100, startDistance: 0, startOffsetX: 0, startOffsetY: 0, startCenterX: 0, startCenterY: 0 });
  const dragRafRef = useRef<number | null>(null);
  const dragPendingRef = useRef({ dx: 0, dy: 0 });
  const transformRafRef = useRef<number | null>(null);
  const transformPendingRef = useRef<{ scale?: number; offsetX?: number; offsetY?: number }>({});
  const wheelPendingRef = useRef(0);
  const wheelIdleTimerRef = useRef<number | null>(null);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm(prev => ({ ...prev, [key]: value }));

  const sizes = [
    { key: 'square' as const, label: t.campaign.sizeSquare, icon: Square, w: 1080, h: 1080 },
    { key: 'portrait' as const, label: t.campaign.sizePortrait, icon: RectangleVertical, w: 1080, h: 1350 },
    { key: 'story' as const, label: t.campaign.sizeStory, icon: Smartphone, w: 1080, h: 1920 },
  ];

  const types = [
    { key: 'frame' as const, label: t.campaign.typeFrame, desc: t.campaign.typeFrameDesc, icon: Frame },
    { key: 'background' as const, label: t.campaign.typeBg, desc: t.campaign.typeBgDesc, icon: Image },
  ];

  const selectedSize = sizes.find(s => s.key === form.size)!;
  const steps = campaignTier === 'premium' ? STEPS_PREMIUM : STEPS_FREE;
  const isMobile = useIsMobile();
  const previewScale = Math.min((isMobile ? 320 : 500) / selectedSize.w, (isMobile ? 420 : 600) / selectedSize.h, 1);
  const placeholderMeta = extractPlaceholderMeta(canvasState);

  useEffect(() => {
    if (!isEdit || !id) return;
    const loadCampaign = async () => {
      setLoadingCampaign(true);
      const { data, error }: { data: any; error: any } = await supabase.from('campaigns' as any).select('*').eq('id', id).single();
      if (error || !data) {
        toast.error(t.campaign.loadError);
        navigate('/dashboard');
        return;
      }
      setCampaignId(data.id);
      setCampaignTier(data.tier ?? 'free');
      setBannerUrl(data.banner_url ?? '');
      setForm({
        name: data.name ?? '',
        description: data.description ?? '',
        caption: data.caption ?? '',
        slug: data.slug ?? '',
        size: (data.size as CampaignSize) ?? 'square',
        type: (data.type as CampaignType) ?? 'frame',
        is_private: data.is_private ?? false,
      });
      setSlugStatus('available');

      const canvasOnly = extractCanvasDesign(data.design_json);
      const previewMeta = extractPreviewMeta(data.design_json);
      const loadedDesign = JSON.stringify(canvasOnly ?? {});
      setCanvasState(loadedDesign === '{}' ? '' : loadedDesign);
      setSimulationPhoto(previewMeta.photoDataUrl ?? '');
      setSimScale(previewMeta.photoScale ?? 100);
      setSimOffsetX(previewMeta.photoOffsetX ?? 0);
      setSimOffsetY(previewMeta.photoOffsetY ?? 0);
      setPreviewResult(previewMeta.previewImageDataUrl ?? '');
      setLoadingCampaign(false);
    };
    loadCampaign();
  }, [id, isEdit, navigate, t.campaign.loadError]);

  useEffect(() => {
    if (step !== 4 || !canvasState) return;
    const render = async () => {
      try {
        const dataUrl = await renderTemplatePNG(canvasState, selectedSize.w, selectedSize.h, form.type);
        setTemplateImage(dataUrl);

        if (form.type === 'background') {
          const [overlay, under] = await Promise.all([
            renderBackgroundOverlayPNG(canvasState, selectedSize.w, selectedSize.h),
            renderBackgroundUnderPNG(canvasState, selectedSize.w, selectedSize.h),
          ]);
          setBgOverlayImage(overlay);
          setBgUnderImage(under);
        } else {
          setBgOverlayImage('');
          setBgUnderImage('');
        }
      } catch (err) {
        console.error('Template render error:', err);
      }
    };
    render();
  }, [step, canvasState, selectedSize.w, selectedSize.h, form.type]);

  useEffect(() => {
    if (form.type !== 'background') return;
    void warmupBackgroundRemoval();
  }, [form.type]);

  const updatePreview = useCallback(async () => {
    if (!templateImage) return;
    const current = ++composeVersionRef.current;

    try {
      const result = await composeResult({
        templateDataUrl: templateImage,
        userPhotoDataUrl: simulationPhoto || undefined,
        fullWidth: selectedSize.w,
        fullHeight: selectedSize.h,
        photoScale: simScale,
        photoOffsetX: simOffsetX,
        photoOffsetY: simOffsetY,
        addWatermark: false,
        campaignType: form.type,
        placeholderMeta,
        previewMaxW: 420,
        previewMaxH: 520,
        bgOverlayDataUrl: bgOverlayImage || undefined,
        bgUnderDataUrl: bgUnderImage || undefined,
      });
      if (current === composeVersionRef.current) {
        setPreviewResult(result);
      }
    } catch (err) {
      console.error('Preview compose error:', err);
    }
  }, [templateImage, simulationPhoto, simScale, simOffsetX, simOffsetY, selectedSize.w, selectedSize.h, form.type, placeholderMeta, bgOverlayImage, bgUnderImage]);

  useEffect(() => {
    if (isInteractingPreview) return;

    const timer = window.setTimeout(() => {
      updatePreview();
    }, 40);

    return () => window.clearTimeout(timer);
  }, [updatePreview, isInteractingPreview]);

  const normalizeSlug = (value: string) =>
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const checkSlugAvailability = async (rawSlug: string): Promise<boolean> => {
    const slug = normalizeSlug(rawSlug);
    if (!slug) {
      setSlugStatus('idle');
      return false;
    }

    setSlugStatus('checking');

    let query = supabase.from('campaigns' as any).select('id', { count: 'exact', head: true }).eq('slug', slug);
    if (campaignId) query = query.neq('id', campaignId);

    const { count, error } = await query;

    if (error) {
      setSlugStatus('idle');
      toast.error(error.message);
      return false;
    }

    const isAvailable = (count ?? 0) === 0;
    setSlugStatus(isAvailable ? 'available' : 'taken');
    return isAvailable;
  };

  const validateStep1 = async () => {
    const normalized = normalizeSlug(form.slug);
    update('slug', normalized);

    if (!form.name.trim() || !normalized) {
      toast.error(t.campaign.requiredFields);
      return false;
    }

    return await checkSlugAvailability(normalized);
  };

  const saveCampaign = async (status: 'draft' | 'published') => {
    if (!user) return;
    if (!(await validateStep1())) return;

    setSaving(true);

    let parsedDesign: Record<string, unknown> = {};
    try {
      parsedDesign = canvasState ? JSON.parse(canvasState) : {};
    } catch {
      parsedDesign = {};
    }

    const finalPreviewImageDataUrl = templateImage
      ? await composeResult({
          templateDataUrl: templateImage,
          userPhotoDataUrl: simulationPhoto || undefined,
          fullWidth: selectedSize.w,
          fullHeight: selectedSize.h,
          photoScale: simScale,
          photoOffsetX: simOffsetX,
          photoOffsetY: simOffsetY,
          addWatermark: false,
          campaignType: form.type,
          placeholderMeta,
          previewMaxW: 420,
          previewMaxH: 520,
          bgOverlayDataUrl: bgOverlayImage || undefined,
          bgUnderDataUrl: bgUnderImage || undefined,
        }).catch(() => previewResult)
      : previewResult;

    const designWithPreview = mergeDesignWithPreview(parsedDesign, {
      photoDataUrl: simulationPhoto,
      photoScale: simScale,
      photoOffsetX: simOffsetX,
      photoOffsetY: simOffsetY,
      previewImageDataUrl: finalPreviewImageDataUrl,
    });

    const payload: any = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      caption: form.caption.trim(),
      slug: normalizeSlug(form.slug),
      size: form.size,
      type: form.type,
      status,
      design_json: designWithPreview,
      banner_url: bannerUrl || null,
      is_private: form.is_private,
    };

    if (campaignId) {
      const { error } = await supabase.from('campaigns' as any).update(payload).eq('id', campaignId);
      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error }: { data: any; error: any } = await supabase.from('campaigns' as any).insert(payload).select('id').single();
      if (error) {
        toast.error(error.code === '23505' ? t.campaign.slugTaken : error.message);
        setSaving(false);
        return;
      }
      setCampaignId(data.id);
    }

    setSaving(false);

    if (campaignTier === 'premium') {
      toast.success(status === 'published' ? t.campaign.publishSuccess : t.campaign.draftSaved);
      navigate('/dashboard');
    } else if (status === 'published') {
      setStep(5); // go to step 6 (upgrade prompt)
    } else {
      toast.success(t.campaign.draftSaved);
      setStep(5);
    }
  };

  const getInitialSimulationTransform = useCallback(
    async (photoDataUrl: string) => {
      if (!photoDataUrl) {
        return { scale: 100, offsetX: 0, offsetY: 0 };
      }

      if (form.type === 'frame' && placeholderMeta) {
        const photo = await loadImage(photoDataUrl);
        const targetW = Math.max(1, placeholderMeta.width * placeholderMeta.scaleX);
        const targetH = Math.max(1, placeholderMeta.height * placeholderMeta.scaleY);
        const coverScale = Math.max(targetW / Math.max(1, photo.width), targetH / Math.max(1, photo.height)) * 1.2;

        return {
          scale: clamp(coverScale * 100, 20, 400),
          offsetX: placeholderMeta.left + targetW / 2 - selectedSize.w / 2,
          offsetY: placeholderMeta.top + targetH / 2 - selectedSize.h / 2,
        };
      }

      return { scale: 100, offsetX: 0, offsetY: 0 };
    },
    [form.type, placeholderMeta, selectedSize.w, selectedSize.h]
  );

  const applyBgProcessing = useCallback(async (threshold: number) => {
    if (!rawRemovedBg) return;
    setApplyingThreshold(true);
    try {
      const processed = await applyAlphaThreshold(rawRemovedBg, threshold);
      setSimulationPhoto(processed);
    } catch { /* ignore */ }
    setApplyingThreshold(false);
  }, [rawRemovedBg]);

  const handleThresholdChange = useCallback(async (values: number[]) => {
    const v = values[0];
    setBgThreshold(v);
    await applyBgProcessing(v);
  }, [applyBgProcessing]);

  const handleSimulationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      const rawDataUrl = (e.target?.result as string) ?? '';
      if (!rawDataUrl) return;

      try {
        setProcessingPhoto(true);
        if (form.type === 'background') {
          const removedBgDataUrl = await removeBackgroundFromDataUrl(rawDataUrl);
          setRawRemovedBg(removedBgDataUrl);
          setBgThreshold(50);
          const processed = await applyAlphaThreshold(removedBgDataUrl, 50);
          const initialTransform = await getInitialSimulationTransform(processed);
          setSimulationPhoto(processed);
          setSimScale(initialTransform.scale);
          setSimOffsetX(initialTransform.offsetX);
          setSimOffsetY(initialTransform.offsetY);
        } else {
          const initialTransform = await getInitialSimulationTransform(rawDataUrl);
          setSimulationPhoto(rawDataUrl);
          setSimScale(initialTransform.scale);
          setSimOffsetX(initialTransform.offsetX);
          setSimOffsetY(initialTransform.offsetY);
        }
      } catch {
        const initialTransform = await getInitialSimulationTransform(rawDataUrl);
        setSimulationPhoto(rawDataUrl);
        setSimScale(initialTransform.scale);
        setSimOffsetX(initialTransform.offsetX);
        setSimOffsetY(initialTransform.offsetY);
        toast.error(t.campaign?.bgRemoveFailed ?? 'Failed to remove background, using original photo.');
      } finally {
        setProcessingPhoto(false);
      }
    };

    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleSkipPayment = () => {
    toast.success(t.campaign.publishSuccess);
    navigate('/dashboard');
  };

  const handleMidtransPayment = async (voucherCode?: string) => {
    if (!campaignId) return;
    const result = await pay(campaignId, voucherCode);
    if (result.success) {
      setCampaignTier('premium');
      setStep(4);
      setShowPayment(true);
      setJustPaid(true);
      toast.success(t.campaign.premiumSuccess ?? 'Campaign berhasil diupgrade ke Premium!');
    }
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await validateStep1();
      if (!ok) return;
    }
    setStep(s => Math.min(s + 1, steps.length - 1));
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
  }, [step, previewResult, templateImage]);

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

      if (typeof pending.scale === 'number') setSimScale(clamp(pending.scale, 20, 400));
      if (typeof pending.offsetX === 'number') setSimOffsetX(pending.offsetX);
      if (typeof pending.offsetY === 'number') setSimOffsetY(pending.offsetY);
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !simulationPhoto) return;
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
      gestureRef.current.startScale = simScale;
      gestureRef.current.startOffsetX = simOffsetX;
      gestureRef.current.startOffsetY = simOffsetY;
      gestureRef.current.startCenterX = (a.x + b.x) / 2;
      gestureRef.current.startCenterY = (a.y + b.y) / 2;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !simulationPhoto || !pointersRef.current.has(event.pointerId)) return;
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

        if (pendingDx !== 0) setSimOffsetX(v => v + pendingDx);
        if (pendingDy !== 0) setSimOffsetY(v => v + pendingDy);
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
      updatePreview();
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !simulationPhoto) return;
    setIsInteractingPreview(true);
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    wheelPendingRef.current += -event.deltaY * 0.04;

    if (wheelIdleTimerRef.current) window.clearTimeout(wheelIdleTimerRef.current);
    wheelIdleTimerRef.current = window.setTimeout(() => {
      setIsInteractingPreview(false);
      updatePreview();
    }, 140);

    if (transformRafRef.current) return;
    transformRafRef.current = window.requestAnimationFrame(() => {
      const delta = wheelPendingRef.current;
      wheelPendingRef.current = 0;
      transformRafRef.current = null;
      if (delta !== 0) setSimScale(v => clamp(v + delta, 20, 400));
    });
  };

  return (
    <Layout>
      <section className="py-16 md:py-24">
        <div className={`container mx-auto px-4 ${step >= 3 ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => i <= step && i < 5 && setStep(i)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    i < step
                      ? 'bg-primary text-primary-foreground'
                      : i === step
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i === 5 ? <Crown className="w-4 h-4" /> : i + 1}
                </button>
                {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="glass-strong rounded-2xl p-4 md:p-8 border-gold-subtle relative">
            {loadingCampaign && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-2xl">
                <div className="inline-flex items-center gap-2 text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">{t.campaign.editor?.loading ?? 'Loading...'}</span>
                </div>
              </div>
            )}
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step1}</h2>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.nameLabel} <span className="text-destructive">*</span></Label>
                  <Input
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="mt-1 bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.descLabel} <span className="text-destructive">*</span></Label>
                  <Textarea value={form.description} onChange={e => update('description', e.target.value)} className="mt-1 bg-secondary/50 border-border" rows={4} required />
                  <p className="text-xs mt-1 text-muted-foreground">
                    {form.description.length} {t.campaign?.descCharLabel ?? 'characters'}
                    {form.description.length >= 150 ? <span className="text-primary"> ✓</span> : <span> — disarankan 150+ karakter</span>}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.captionLabel}</Label>
                  <Textarea value={form.caption} onChange={e => update('caption', e.target.value)} className="mt-1 bg-secondary/50 border-border" rows={2} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.slugLabel} <span className="text-destructive">*</span></Label>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">twibo.id/c/</span>
                    <Input
                      value={form.slug}
                      onChange={e => {
                        update('slug', normalizeSlug(e.target.value));
                        if (!isEdit) setSlugStatus('idle');
                      }}
                      onBlur={() => !isEdit && checkSlugAvailability(form.slug)}
                      className="bg-secondary/50 border-border"
                      disabled={isEdit}
                      required
                    />
                  </div>
                  {!isEdit && slugStatus === 'checking' && <p className="text-xs text-muted-foreground mt-1">{t.campaign?.slugChecking ?? 'Checking slug...'}</p>}
                  {!isEdit && slugStatus === 'available' && <p className="text-xs text-primary mt-1">{t.campaign?.slugAvailable ?? 'Slug available'}</p>}
                  {!isEdit && slugStatus === 'taken' && <p className="text-xs text-destructive mt-1">{t.campaign.slugTaken}</p>}
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t.campaign.slugWarning}
                  </p>
                </div>

                {/* Banner Image Upload - Premium Only */}
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign?.bannerLabel ?? 'Banner Image'} ({t.campaign?.optionalLabel ?? 'optional'})</Label>
                  <p className="text-xs text-muted-foreground mb-2">{t.campaign?.bannerDesc ?? 'Displayed above the campaign title on the public page. Ratio 3:1 (1200×400px).'}</p>
                  {campaignTier === 'premium' ? (
                    <div className="space-y-2">
                      {bannerUrl && (
                        <div className="relative rounded-xl overflow-hidden border border-border">
                          <img src={bannerUrl} alt="Banner" className="w-full h-auto object-cover" style={{ maxHeight: '150px' }} />
                          <Button
                            variant="outline"
                            size="sm"
                            className="absolute top-2 right-2 border-border bg-background/80 text-xs"
                            onClick={() => { setBannerUrl(''); }}
                           >
                             {t.campaign?.bannerRemove ?? 'Remove'}
                          </Button>
                        </div>
                      )}
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          id="banner-upload"
                          className="hidden"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (f) { setBannerFile(f); setShowBannerCrop(true); }
                            e.target.value = '';
                          }}
                        />
                        <label htmlFor="banner-upload">
                          <Button variant="outline" size="sm" className="border-border gap-1 cursor-pointer" asChild>
                            <span><Upload className="w-3.5 h-3.5" /> {bannerUrl ? (t.campaign?.bannerReplace ?? 'Replace Banner') : (t.campaign?.bannerUpload ?? 'Upload Banner')}</span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-xl overflow-hidden border border-border p-6 text-center">
                      <div className="absolute inset-0 bg-secondary/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2">
                        <Crown className="w-6 h-6 text-primary" />
                         <p className="text-sm font-semibold text-foreground">{t.campaign?.premiumFeatureLabel ?? 'Premium Feature'}</p>
                         <p className="text-xs text-muted-foreground">{t.campaign?.bannerUpgradeHint ?? 'Upgrade to Premium to upload custom banner'}</p>
                      </div>
                      <div className="h-16 bg-secondary/30 rounded-lg" />
                    </div>
                  )}
                </div>

                {/* Private Campaign Toggle */}
                <div>
                  <div className="relative rounded-xl border border-border p-4">
                    {campaignTier !== 'premium' && (
                      <div className="absolute inset-0 bg-secondary/60 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
                        <Crown className="w-6 h-6 text-primary" />
                        <p className="text-sm font-semibold text-foreground">{t.campaign?.premiumFeatureLabel ?? 'Premium Feature'}</p>
                        <p className="text-xs text-muted-foreground text-center px-4">{t.campaign?.privateUpgradeHint ?? 'Upgrade ke Premium untuk menyembunyikan campaign dari mesin pencari'}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <Label className="text-sm font-medium text-foreground">{t.campaign?.privateCampaign ?? 'Private Campaign'}</Label>
                        <p className="text-xs text-muted-foreground mt-0.5">{t.campaign?.privateCampaignDesc ?? 'Sembunyikan halaman ini dari Google & Mesin Pencari'}</p>
                      </div>
                      <Switch
                        checked={form.is_private}
                        onCheckedChange={v => update('is_private', v)}
                        disabled={campaignTier !== 'premium'}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <BannerCropDialog
              file={bannerFile}
              open={showBannerCrop}
              onClose={() => setShowBannerCrop(false)}
              uploading={uploadingBanner}
              onCropped={async (blob) => {
                if (!user) return;
                setUploadingBanner(true);
                try {
                  const fileName = `${user.id}/${Date.now()}-banner.jpg`;
                  const { error: uploadError } = await supabase.storage.from('banner-images').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
                  if (uploadError) throw uploadError;
                  const { data: urlData } = supabase.storage.from('banner-images').getPublicUrl(fileName);
                  setBannerUrl(urlData.publicUrl);
                  setShowBannerCrop(false);
                  setBannerFile(null);
                  toast.success(t.campaign?.bannerSuccess ?? 'Banner uploaded successfully!');
                } catch (err: any) {
                  toast.error(err.message || (t.campaign?.bannerFailed ?? 'Failed to upload banner'));
                } finally {
                  setUploadingBanner(false);
                }
              }}
            />

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step2}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {sizes.map(s => (
                    <button
                      key={s.key}
                      onClick={() => update('size', s.key)}
                      className={`p-6 rounded-xl border-2 transition-all text-center ${
                        form.size === s.key ? 'border-primary bg-primary/10 gold-glow' : 'border-border hover:border-primary/30 bg-secondary/30'
                      }`}
                    >
                      <s.icon className={`w-10 h-10 mx-auto mb-3 ${form.size === s.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-semibold text-foreground text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.w}×{s.h}px
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step3}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {types.map(tp => (
                    <button
                      key={tp.key}
                      onClick={() => update('type', tp.key)}
                      className={`p-6 rounded-xl border-2 transition-all text-left ${
                        form.type === tp.key ? 'border-primary bg-primary/10 gold-glow' : 'border-border hover:border-primary/30 bg-secondary/30'
                      }`}
                    >
                      <tp.icon className={`w-10 h-10 mb-3 ${form.type === tp.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-semibold text-foreground">{tp.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">{tp.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step4}</h2>
                <Suspense fallback={<div className="text-center text-muted-foreground py-12">{t.campaign.editor.loading}</div>}>
                  <CanvasEditor width={selectedSize.w} height={selectedSize.h} type={form.type} mode="edit" initialState={canvasState} onStateChange={setCanvasState} />
                </Suspense>
              </div>
            )}

            {step === 4 && !showPayment && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground text-center">{t.campaign.publishSettings}</h2>

                <div className="glass rounded-xl p-5 border-gold-subtle max-w-xl mx-auto text-center">
                  <p className="text-foreground font-semibold text-lg">{form.name || 'Untitled Campaign'}</p>
                  <p className="text-xs text-muted-foreground mt-1">twibo.id/c/{form.slug || '...'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedSize.label} • {form.type === 'frame' ? t.campaign.typeFrame : t.campaign.typeBg}
                  </p>
                </div>

                <div className="w-full mx-auto" style={{ maxWidth: Math.max(1, Math.round(selectedSize.w * previewScale)) + 'px' }}>
                  <p className="text-sm text-muted-foreground text-center mb-2">{t.campaign.templatePreview ?? 'Template Preview'}</p>
                  <div
                    ref={previewInteractionRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onWheelCapture={onWheel}
                    className="relative rounded-xl overflow-hidden border border-border mx-auto"
                    onDragStart={event => event.preventDefault()}
                    style={{
                      touchAction: 'none',
                      overscrollBehavior: 'contain',
                      width: Math.max(1, Math.round(selectedSize.w * previewScale)),
                      height: Math.max(1, Math.round(selectedSize.h * previewScale)),
                      backgroundImage:
                        'linear-gradient(45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(-45deg, hsl(0 0% 20%) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, hsl(0 0% 20%) 75%), linear-gradient(-45deg, transparent 75%, hsl(0 0% 20%) 75%)',
                      backgroundSize: '16px 16px',
                      backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                      backgroundColor: 'hsl(0 0% 15%)',
                    }}
                  >
                    {templateImage ? (
                      <PhotoComposerPreview
                        templateImage={templateImage}
                        userPhoto={simulationPhoto}
                        campaignType={form.type}
                        width={selectedSize.w}
                        height={selectedSize.h}
                        previewScale={previewScale}
                        photoScale={simScale}
                        photoOffsetX={simOffsetX}
                        photoOffsetY={simOffsetY}
                        placeholderMeta={placeholderMeta}
                        bgOverlayImage={bgOverlayImage}
                        bgUnderImage={bgUnderImage}
                      />
                    ) : (
                      <div className="py-12 text-muted-foreground text-sm">{t.campaign.editor.loading}</div>
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
                </div>

                <div className="glass rounded-xl p-4 border-gold-subtle max-w-md mx-auto space-y-3">
                  <h3 className="font-semibold text-foreground text-sm text-center">{t.campaign.simulationTitle}</h3>
                  <p className="text-xs text-muted-foreground text-center">{t.campaign.simulationDesc}</p>
                  <div className="flex justify-center">
                    <label className={`inline-flex ${processingPhoto ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                      <input type="file" accept="image/*" className="hidden" onChange={handleSimulationUpload} disabled={processingPhoto} />
                      <span
                        className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors"
                        aria-disabled={processingPhoto}
                      >
                        <Upload className="w-4 h-4" />
                        {simulationPhoto ? t.campaign.replaceSimulationPhoto : t.campaign.uploadSimulationPhoto}
                      </span>
                    </label>
                  </div>

                  {processingPhoto && <p className="text-xs text-center text-muted-foreground">Processing photo...</p>}

                  {simulationPhoto && (
                    <div className="rounded-lg border border-border p-3 bg-secondary/30 space-y-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Move className="w-3 h-3" /> Drag untuk geser
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <ZoomIn className="w-3 h-3" /> Scroll / pinch untuk zoom
                      </p>
                      <p className="text-xs text-muted-foreground">Scale: {Math.round(simScale)}% • X: {Math.round(simOffsetX)} • Y: {Math.round(simOffsetY)}</p>
                    </div>
                  )}

                  {form.type === 'background' && simulationPhoto && rawRemovedBg && (
                    <div className="glass rounded-xl p-4 border-gold-subtle space-y-3 mt-3">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold text-foreground">Background Settings</h3>
                        {applyingThreshold && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Tolerance</span>
                          <span>{bgThreshold}%</span>
                        </div>
                        <Slider value={[bgThreshold]} onValueChange={handleThresholdChange} min={0} max={100} step={1} disabled={applyingThreshold} />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="outline" className="border-border gap-2" onClick={() => saveCampaign('draft')} disabled={saving}>
                    <Save className="w-4 h-4" />
                    {t.campaign.saveDraft}
                  </Button>
                  <Button className="gold-glow font-semibold" onClick={() => saveCampaign('published')} disabled={saving}>
                    {saving ? t.campaign.saving : t.campaign.publish}
                  </Button>
                </div>
              </div>
            )}

            {step === 4 && showPayment && campaignTier === 'premium' && justPaid && (
              <div className="space-y-6 text-center py-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-green-500/20 blur-3xl w-32 h-32 mx-auto" />
                  <div className="relative w-20 h-20 mx-auto rounded-full bg-green-500/20 flex items-center justify-center">
                    <Check className="w-10 h-10 text-green-500" />
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">🎉 Campaign Berhasil Dipublish!</h2>
                <p className="text-muted-foreground text-sm">Campaign <strong>{form.name}</strong> sudah berstatus <span className="text-primary font-semibold">Premium</span> dan siap digunakan.</p>

                {previewResult && (
                  <div className="mx-auto max-w-[280px] rounded-xl border border-border overflow-hidden shadow-lg">
                    <img src={previewResult} alt="Campaign preview" className="w-full h-auto" />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">twibo.id/c/{form.slug}</p>
                <div className="flex gap-3 justify-center flex-wrap pt-2">
                  <Button variant="outline" className="border-border gap-2" onClick={() => navigate(`/c/${form.slug}`)}>
                    <Eye className="w-4 h-4" /> Lihat Campaign
                  </Button>
                  <Button className="gold-glow font-semibold gap-2" onClick={() => navigate('/dashboard')}>
                    <ChevronLeft className="w-4 h-4" /> Kembali ke Dashboard
                  </Button>
                </div>
              </div>
            )}

            {/* Step 6: Upgrade to Premium (free tier only) */}
            {step === 5 && (
              <div className="space-y-6 text-center py-8">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-3xl w-32 h-32 mx-auto" />
                  <Crown className="w-16 h-16 text-primary mx-auto relative" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.upgradeToPremium ?? 'Upgrade ke Premium'}</h2>
                <p className="text-muted-foreground text-sm max-w-md mx-auto">{t.campaign.upgradeDesc ?? 'Hapus watermark dan iklan dari campaign kamu dengan upgrade ke Premium.'}</p>
                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="outline" className="border-border" onClick={handleSkipPayment}>
                    {t.campaign.skipForNow ?? 'Lewati, Coba Gratis'}
                  </Button>
                  <Button className="gold-glow font-semibold gap-2" onClick={() => setShowPaymentDialog(true)}>
                    <CreditCard className="w-4 h-4" /> {t.campaign.payNow ?? 'Bayar Sekarang'}
                  </Button>
                </div>
              </div>
            )}

            {!showPayment && step !== 5 && (
              <div className="flex justify-between mt-8 pt-6 border-t border-border/30">
                {step === 0 ? (
                  <Button variant="outline" onClick={() => navigate('/dashboard')} className="border-border gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    {t.campaign.backToDashboard ?? 'Back to Dashboard'}
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => setStep(s => s - 1)} className="border-border gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    {t.campaign.prev}
                  </Button>
                )}
                {step < steps.length - 1 && step !== 4 && (
                  <Button onClick={handleNext} className="gold-glow gap-1">
                    {t.campaign.next}
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Payment Confirmation Dialog */}
      <PaymentConfirmDialog
        open={showPaymentDialog}
        onClose={() => setShowPaymentDialog(false)}
        onConfirm={(voucherCode) => {
          setShowPaymentDialog(false);
          handleMidtransPayment(voucherCode);
        }}
        onPayPalSuccess={() => {
          setCampaignTier('premium');
          setShowPaymentDialog(false);
          setStep(4);
          setShowPayment(true);
          setJustPaid(true);
          toast.success(t.campaign.premiumSuccess ?? 'Campaign berhasil diupgrade ke Premium!');
        }}
        basePrice={premiumPrice}
        originalPrice={originalPrice}
        campaignName={form.name || 'Untitled Campaign'}
        campaignId={campaignId ?? undefined}
        paying={paying}
        paypalEnabled={paypalEnabled}
        paypalClientId={paypalClientId}
        paypalMode={paypalMode}
        paypalPriceUsd={paypalPriceUsd}
        paypalOriginalPriceUsd={paypalOriginalPriceUsd}
      />

      {/* Full-screen loading overlay while Midtrans initialises */}
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

export default CampaignEditor;
