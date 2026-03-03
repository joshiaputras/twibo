import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { renderTemplatePNG, composeResult } from '@/utils/renderTemplate';
import { removeBackgroundFromDataUrl } from '@/utils/removeBackground';
import { extractCanvasDesign, extractPreviewMeta, mergeDesignWithPreview } from '@/utils/campaignDesign';

const CanvasEditor = lazy(() => import('@/components/CanvasEditor'));

const steps = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

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
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CampaignEditor = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = !!id;

  const [step, setStep] = useState(0);
  const [campaignId, setCampaignId] = useState<string | null>(id ?? null);
  const [saving, setSaving] = useState(false);
  const [canvasState, setCanvasState] = useState<string>('');
  const [form, setForm] = useState<FormState>({
    name: '',
    description: '',
    caption: '',
    slug: '',
    size: 'square',
    type: 'frame',
  });

  const [templateImage, setTemplateImage] = useState<string>('');
  const [simulationPhoto, setSimulationPhoto] = useState<string>('');
  const [simScale, setSimScale] = useState(100);
  const [simOffsetX, setSimOffsetX] = useState(0);
  const [simOffsetY, setSimOffsetY] = useState(0);
  const [previewResult, setPreviewResult] = useState<string>('');
  const [showPayment, setShowPayment] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [processingPhoto, setProcessingPhoto] = useState(false);

  const composeVersionRef = useRef(0);
  const previewInteractionRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureRef = useRef({ startScale: 100, startDistance: 0, startOffsetX: 0, startOffsetY: 0, startCenterX: 0, startCenterY: 0 });

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
  const previewScale = Math.min(500 / selectedSize.w, 600 / selectedSize.h, 1);

  useEffect(() => {
    if (!isEdit || !id) return;
    const loadCampaign = async () => {
      const { data, error }: { data: any; error: any } = await supabase.from('campaigns' as any).select('*').eq('id', id).single();
      if (error || !data) {
        toast.error(t.campaign.loadError);
        navigate('/dashboard');
        return;
      }
      setCampaignId(data.id);
      setForm({
        name: data.name ?? '',
        description: data.description ?? '',
        caption: data.caption ?? '',
        slug: data.slug ?? '',
        size: (data.size as CampaignSize) ?? 'square',
        type: (data.type as CampaignType) ?? 'frame',
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
    };
    loadCampaign();
  }, [id, isEdit, navigate, t.campaign.loadError]);

  useEffect(() => {
    if (step !== 4 || !canvasState) return;
    const render = async () => {
      try {
        const dataUrl = await renderTemplatePNG(canvasState, selectedSize.w, selectedSize.h, form.type);
        setTemplateImage(dataUrl);
      } catch (err) {
        console.error('Template render error:', err);
      }
    };
    render();
  }, [step, canvasState, selectedSize.w, selectedSize.h, form.type]);

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
        previewMaxW: 500,
        previewMaxH: 600,
      });
      if (current === composeVersionRef.current) {
        setPreviewResult(result);
      }
    } catch (err) {
      console.error('Preview compose error:', err);
    }
  }, [templateImage, simulationPhoto, simScale, simOffsetX, simOffsetY, selectedSize.w, selectedSize.h, form.type]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      updatePreview();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [updatePreview]);

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

    const designWithPreview = mergeDesignWithPreview(parsedDesign, {
      photoDataUrl: simulationPhoto,
      photoScale: simScale,
      photoOffsetX: simOffsetX,
      photoOffsetY: simOffsetY,
    });

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      caption: form.caption.trim(),
      slug: normalizeSlug(form.slug),
      size: form.size,
      type: form.type,
      status,
      design_json: designWithPreview,
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

    if (status === 'published') {
      setShowPayment(true);
    } else {
      toast.success(t.campaign.draftSaved);
    }
  };

  const handleSimulationUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async e => {
      const rawDataUrl = (e.target?.result as string) ?? '';
      if (!rawDataUrl) return;

      try {
        setProcessingPhoto(true);
        const photoDataUrl = form.type === 'background' ? await removeBackgroundFromDataUrl(rawDataUrl) : rawDataUrl;
        setSimulationPhoto(photoDataUrl);
        setSimScale(100);
        setSimOffsetX(0);
        setSimOffsetY(0);
      } catch {
        setSimulationPhoto(rawDataUrl);
        toast.error('Gagal remove background, memakai foto original.');
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

  const handlePayment = async () => {
    toast.info(t.campaign.paymentPending ?? 'Pembayaran sedang diproses...');
    if (campaignId) {
      await supabase.from('campaigns' as any).update({ tier: 'premium' }).eq('id', campaignId);
    }
    toast.success(t.campaign.premiumSuccess ?? 'Campaign berhasil diupgrade ke Premium!');
    navigate('/dashboard');
  };

  const handleNext = async () => {
    if (step === 0) {
      const ok = await validateStep1();
      if (!ok) {
        toast.error(t.campaign.slugTaken);
        return;
      }
    }
    setStep(s => Math.min(s + 1, steps.length - 1));
  };

  const isPreviewBusy = processingPhoto;

  useEffect(() => {
    const el = previewInteractionRef.current;
    if (!el) return;

    const preventNativeScroll = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    el.addEventListener('wheel', preventNativeScroll, { passive: false });
    el.addEventListener('touchmove', preventNativeScroll, { passive: false });

    return () => {
      el.removeEventListener('wheel', preventNativeScroll);
      el.removeEventListener('touchmove', preventNativeScroll);
    };
  }, [step, previewResult, templateImage]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !simulationPhoto) return;
    event.preventDefault();
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
    event.preventDefault();
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
        setSimScale(clamp(gestureRef.current.startScale * ratio, 20, 400));
      }

      const centerX = (a.x + b.x) / 2;
      const centerY = (a.y + b.y) / 2;
      setSimOffsetX(gestureRef.current.startOffsetX + (centerX - gestureRef.current.startCenterX) / previewScale);
      setSimOffsetY(gestureRef.current.startOffsetY + (centerY - gestureRef.current.startCenterY) / previewScale);
      return;
    }

    if (points.length === 1) {
      const dx = event.clientX - prev.x;
      const dy = event.clientY - prev.y;
      setSimOffsetX(v => v + dx / previewScale);
      setSimOffsetY(v => v + dy / previewScale);
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    pointersRef.current.delete(event.pointerId);
    if (previewInteractionRef.current?.hasPointerCapture(event.pointerId)) {
      previewInteractionRef.current.releasePointerCapture(event.pointerId);
    }
  };

  const onWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (isPreviewBusy || !simulationPhoto) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = event.deltaY > 0 ? -6 : 6;
    setSimScale(v => clamp(v + delta, 20, 400));
  };

  return (
    <Layout>
      <section className="py-16 md:py-24">
        <div className={`container mx-auto px-4 ${step >= 3 ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-center gap-2 mb-8 overflow-x-auto pb-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    i < step
                      ? 'bg-primary text-primary-foreground'
                      : i === step
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </button>
                {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="glass-strong rounded-2xl p-4 md:p-8 border-gold-subtle">
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step1}</h2>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.nameLabel}</Label>
                  <Input
                    value={form.name}
                    onChange={e => update('name', e.target.value)}
                    className="mt-1 bg-secondary/50 border-border"
                    required
                  />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.descLabel}</Label>
                  <Textarea value={form.description} onChange={e => update('description', e.target.value)} className="mt-1 bg-secondary/50 border-border" rows={3} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.captionLabel}</Label>
                  <Textarea value={form.caption} onChange={e => update('caption', e.target.value)} className="mt-1 bg-secondary/50 border-border" rows={2} />
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.slugLabel}</Label>
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
                  {!isEdit && slugStatus === 'checking' && <p className="text-xs text-muted-foreground mt-1">Checking slug...</p>}
                  {!isEdit && slugStatus === 'available' && <p className="text-xs text-primary mt-1">Slug tersedia</p>}
                  {!isEdit && slugStatus === 'taken' && <p className="text-xs text-destructive mt-1">{t.campaign.slugTaken}</p>}
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {t.campaign.slugWarning}
                  </p>
                </div>
              </div>
            )}

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

                <div className="max-w-md mx-auto">
                  <p className="text-sm text-muted-foreground text-center mb-2">{t.campaign.templatePreview ?? 'Template Preview'}</p>
                  <div
                    ref={previewInteractionRef}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onPointerLeave={onPointerUp}
                    onWheel={onWheel}
                    className="relative rounded-xl overflow-hidden border border-border bg-secondary/20 flex items-center justify-center p-2 touch-none"
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
                    {previewResult ? (
                      <img src={previewResult} alt="Preview" draggable={false} className="pointer-events-none select-none max-w-full h-auto rounded" style={{ maxHeight: 500 }} />
                    ) : templateImage ? (
                      <img src={templateImage} alt="Template" draggable={false} className="pointer-events-none select-none max-w-full h-auto rounded" style={{ maxHeight: 500 }} />
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
                    <label className="inline-flex cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={handleSimulationUpload} />
                      <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-secondary/50 transition-colors">
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

            {step === 4 && showPayment && (
              <div className="space-y-6 max-w-lg mx-auto text-center">
                <Crown className="w-12 h-12 text-primary mx-auto" />
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.upgradeToPremium ?? 'Upgrade ke Premium'}</h2>
                <p className="text-muted-foreground text-sm">{t.campaign.upgradeDesc ?? 'Hapus watermark dan iklan dari campaign kamu dengan upgrade ke Premium.'}</p>

                <div className="glass rounded-xl p-6 border-gold-subtle space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-foreground font-semibold">{t.campaign.premiumPlan ?? 'Premium Access'}</span>
                    <div>
                      <span className="text-xs text-muted-foreground line-through mr-2">Rp 149.000</span>
                      <span className="text-primary font-bold text-lg">Rp 50.000</span>
                    </div>
                  </div>
                  <ul className="text-left text-sm text-muted-foreground space-y-1">
                    <li>✓ {t.pricing.premiumFeatures.f2}</li>
                    <li>✓ {t.pricing.premiumFeatures.f3}</li>
                    <li>✓ {t.pricing.premiumFeatures.f4}</li>
                    <li>✓ {t.pricing.premiumFeatures.f5}</li>
                  </ul>
                </div>

                <div className="flex gap-3 justify-center flex-wrap">
                  <Button variant="outline" className="border-border" onClick={handleSkipPayment}>
                    {t.campaign.skipForNow ?? 'Lewati, Coba Gratis'}
                  </Button>
                  <Button className="gold-glow font-semibold gap-2" onClick={handlePayment}>
                    <CreditCard className="w-4 h-4" /> {t.campaign.payNow ?? 'Bayar Sekarang'}
                  </Button>
                </div>
              </div>
            )}

            {!showPayment && (
              <div className="flex justify-between mt-8 pt-6 border-t border-border/30">
                <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="border-border gap-1">
                  <ChevronLeft className="w-4 h-4" />
                  {t.campaign.prev}
                </Button>
                {step < steps.length - 1 && (
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
    </Layout>
  );
};

export default CampaignEditor;
