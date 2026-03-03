import Layout from '@/components/Layout';
import { useLanguage } from '@/i18n/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, AlertTriangle, Square, RectangleVertical, Smartphone, Frame, Image, ChevronLeft, ChevronRight, Save, Upload as UploadIcon } from 'lucide-react';

const steps = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;

const CampaignEditor = () => {
  const { t } = useLanguage();
  const { id } = useParams();
  const isEdit = !!id;
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '', description: '', caption: '', slug: '',
    size: 'square' as 'square' | 'portrait' | 'story',
    type: 'frame' as 'frame' | 'background',
  });

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const sizes = [
    { key: 'square', label: t.campaign.sizeSquare, icon: Square, w: 1080, h: 1080 },
    { key: 'portrait', label: t.campaign.sizePortrait, icon: RectangleVertical, w: 1080, h: 1350 },
    { key: 'story', label: t.campaign.sizeStory, icon: Smartphone, w: 1080, h: 1920 },
  ];

  const types = [
    { key: 'frame', label: t.campaign.typeFrame, desc: t.campaign.typeFrameDesc, icon: Frame },
    { key: 'background', label: t.campaign.typeBg, desc: t.campaign.typeBgDesc, icon: Image },
  ];

  return (
    <Layout>
      <section className="py-24 md:py-32">
        <div className="container mx-auto px-4 max-w-3xl">
          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 mb-10">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
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

          <div className="glass-strong rounded-2xl p-8 border-gold-subtle">
            {/* Step 1: Details */}
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

            {/* Step 2: Size */}
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

            {/* Step 3: Type */}
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

            {/* Step 4: Canvas Editor placeholder */}
            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step4}</h2>
                <div className="aspect-square max-w-md mx-auto rounded-xl border-2 border-dashed border-border bg-secondary/20 flex flex-col items-center justify-center text-muted-foreground">
                  <UploadIcon className="w-12 h-12 mb-3 text-primary/50" />
                  <p className="text-sm">Canvas Editor</p>
                  <p className="text-xs mt-1">Fabric.js editor will be integrated here</p>
                </div>
              </div>
            )}

            {/* Step 5: Publish */}
            {step === 4 && (
              <div className="space-y-5 text-center">
                <h2 className="font-display text-2xl font-bold text-foreground">{t.campaign.step5}</h2>
                <div className="glass rounded-xl p-6 border-gold-subtle max-w-sm mx-auto">
                  <p className="text-foreground font-semibold">{form.name || 'Untitled Campaign'}</p>
                  <p className="text-xs text-muted-foreground mt-1">twibo.id/c/{form.slug || '...'}</p>
                  <p className="text-xs text-muted-foreground mt-1">{sizes.find(s => s.key === form.size)?.label} • {form.type === 'frame' ? t.campaign.typeFrame : t.campaign.typeBg}</p>
                </div>
                <div className="flex gap-3 justify-center">
                  <Button variant="outline" className="border-border gap-2"><Save className="w-4 h-4" />{t.campaign.saveDraft}</Button>
                  <Button className="gold-glow font-semibold">{t.campaign.publish}</Button>
                </div>
              </div>
            )}

            {/* Navigation */}
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