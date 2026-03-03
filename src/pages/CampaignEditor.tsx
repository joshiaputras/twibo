import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, AlertTriangle, Square, RectangleVertical, Smartphone, Frame, Image, ChevronLeft, ChevronRight, Save, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CanvasEditor = lazy(() => import('@/components/CanvasEditor'));

const steps = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

type CampaignSize = 'square' | 'portrait' | 'story';
type CampaignType = 'frame' | 'background';

type FormState = {
  name: string;
  description: string;
  caption: string;
  slug: string;
  size: CampaignSize;
  type: CampaignType;
};

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
  const [simulationPhoto, setSimulationPhoto] = useState<string>('');
  const [form, setForm] = useState<FormState>({
    name: '', description: '', caption: '', slug: '',
    size: 'square',
    type: 'frame',
  });

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

  useEffect(() => {
    if (!isEdit || !id) return;

    const loadCampaign = async () => {
      const { data, error }: { data: any; error: any } = await supabase
        .from('campaigns' as any)
        .select('*')
        .eq('id', id)
        .single();

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

      const loadedDesign = typeof data.design_json === 'string'
        ? data.design_json
        : JSON.stringify(data.design_json ?? {});

      setCanvasState(loadedDesign === '{}' ? '' : loadedDesign);
    };

    loadCampaign();
  }, [id, isEdit, navigate, t.campaign.loadError]);

  const validateRequired = () => {
    if (!form.name.trim() || !form.slug.trim()) {
      toast.error(t.campaign.requiredFields);
      setStep(0);
      return false;
    }
    return true;
  };

  const saveCampaign = async (status: 'draft' | 'published') => {
    if (!user) return;
    if (!validateRequired()) return;

    setSaving(true);

    let parsedDesign: Record<string, unknown> = {};
    try {
      parsedDesign = canvasState ? JSON.parse(canvasState) : {};
    } catch {
      parsedDesign = {};
    }

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      description: form.description.trim(),
      caption: form.caption.trim(),
      slug: form.slug.trim().toLowerCase(),
      size: form.size,
      type: form.type,
      status,
      design_json: parsedDesign,
    };

    if (campaignId) {
      const { error } = await supabase
        .from('campaigns' as any)
        .update(payload)
        .eq('id', campaignId);

      if (error) {
        toast.error(error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error }: { data: any; error: any } = await supabase
        .from('campaigns' as any)
        .insert(payload)
        .select('id')
        .single();

      if (error) {
        toast.error(error.code === '23505' ? t.campaign.slugTaken : error.message);
        setSaving(false);
        return;
      }

      setCampaignId(data.id);
    }

    setSaving(false);

    if (status === 'published') {
      toast.success(t.campaign.publishSuccess);
      navigate('/dashboard');
    } else {
      toast.success(t.campaign.draftSaved);
    }
  };

  const handleSimulationUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => setSimulationPhoto((e.target?.result as string) ?? '');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <Layout>
      <section className="py-16 md:py-24">
        <div className={`container mx-auto px-4 ${step >= 3 ? 'max-w-7xl' : 'max-w-3xl'}`}>
          <div className="flex items-center justify-center gap-2 mb-10 overflow-x-auto pb-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => i <= step && setStep(i)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    i < step ? 'bg-primary text-primary-foreground' :
                    i === step ? 'bg-primary/20 text-primary border-2 border-primary' :
                    'bg-secondary text-muted-foreground'
                  }`}
                >
                  {i < step ? <Check className="w-4 h-4" /> : i + 1}
                </button>
                {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            ))}
          </div>

          <div className="glass-strong rounded-2xl p-5 md:p-8 border-gold-subtle">
            {step === 0 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step1}</h2>
                <div>
                  <Label className="text-sm text-muted-foreground">{t.campaign.nameLabel}</Label>
                  <Input value={form.name} onChange={e => update('name', e.target.value)} className="mt-1 bg-secondary/50 border-border" required />
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
                    <Input value={form.slug} onChange={e => update('slug', e.target.value)} className="bg-secondary/50 border-border" disabled={isEdit} />
                  </div>
                  <p className="text-xs text-amber-400 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{t.campaign.slugWarning}</p>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step2}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {sizes.map(s => (
                    <button key={s.key} onClick={() => update('size', s.key)} className={`p-6 rounded-xl border-2 transition-all text-center ${form.size === s.key ? 'border-primary bg-primary/10 gold-glow' : 'border-border hover:border-primary/30 bg-secondary/30'}`}>
                      <s.icon className={`w-10 h-10 mx-auto mb-3 ${form.size === s.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-semibold text-foreground text-sm">{s.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">{s.w}×{s.h}px</p>
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
                    <button key={tp.key} onClick={() => update('type', tp.key)} className={`p-6 rounded-xl border-2 transition-all text-left ${form.type === tp.key ? 'border-primary bg-primary/10 gold-glow' : 'border-border hover:border-primary/30 bg-secondary/30'}`}>
                      <tp.icon className={`w-10 h-10 mb-3 ${form.type === tp.key ? 'text-primary' : 'text-muted-foreground'}`} />
                      <p className="font-semibold text-foreground">{tp.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">{tp.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step4}</h2>
                <Suspense fallback={<div className="text-center text-muted-foreground py-12">{t.campaign.editor.loading}</div>}>
                  <CanvasEditor
                    width={selectedSize.w}
                    height={selectedSize.h}
                    type={form.type}
                    mode="edit"
                    initialState={canvasState}
                    onStateChange={setCanvasState}
                  />
                </Suspense>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground text-center">{t.campaign.publishSettings}</h2>
                <div className="glass rounded-xl p-6 border-gold-subtle max-w-xl mx-auto text-center">
                  <p className="text-foreground font-semibold">{form.name || 'Untitled Campaign'}</p>
                  <p className="text-xs text-muted-foreground mt-1">twibo.id/c/{form.slug || '...'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{selectedSize.label} • {form.type === 'frame' ? t.campaign.typeFrame : t.campaign.typeBg}</p>
                </div>

                <div className="glass rounded-xl p-5 border-gold-subtle max-w-xl mx-auto text-center space-y-3">
                  <h3 className="font-semibold text-foreground">{t.campaign.simulationTitle}</h3>
                  <p className="text-xs text-muted-foreground">{t.campaign.simulationDesc}</p>
                  <label className="inline-flex">
                    <input type="file" accept="image/*" className="hidden" onChange={handleSimulationUpload} />
                    <span className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-foreground cursor-pointer hover:bg-secondary/50 transition-colors">
                      <Upload className="w-4 h-4" />
                      {simulationPhoto ? t.campaign.replaceSimulationPhoto : t.campaign.uploadSimulationPhoto}
                    </span>
                  </label>
                </div>

                <Suspense fallback={<div className="text-center text-muted-foreground py-12">{t.campaign.editor.loading}</div>}>
                  <CanvasEditor
                    width={selectedSize.w}
                    height={selectedSize.h}
                    type={form.type}
                    mode="preview"
                    initialState={canvasState}
                    previewPhotoUrl={simulationPhoto || undefined}
                  />
                </Suspense>

                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="border-border gap-2" onClick={() => saveCampaign('draft')} disabled={saving}>
                    <Save className="w-4 h-4" />{t.campaign.saveDraft}
                  </Button>
                  <Button className="gold-glow font-semibold" onClick={() => saveCampaign('published')} disabled={saving}>
                    {saving ? t.campaign.saving : t.campaign.publish}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-6 border-t border-border/30">
              <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0} className="border-border gap-1">
                <ChevronLeft className="w-4 h-4" />{t.campaign.prev}
              </Button>
              {step < steps.length - 1 && (
                <Button onClick={() => setStep(s => s + 1)} className="gold-glow gap-1">
                  {t.campaign.next}<ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default CampaignEditor;
