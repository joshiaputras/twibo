import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Upload, Download, Copy, MessageCircle, Move, ZoomIn, Crown } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { Canvas as FabricCanvas } from 'fabric';

const CampaignPublic = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);

  // Photo upload & result
  const [userPhoto, setUserPhoto] = useState<string>('');
  const [templateImage, setTemplateImage] = useState<string>('');
  const [resultImage, setResultImage] = useState<string>('');
  const [photoScale, setPhotoScale] = useState(100);
  const [photoOffsetX, setPhotoOffsetX] = useState(0);
  const [photoOffsetY, setPhotoOffsetY] = useState(0);
  const resultCanvasRef = useRef<HTMLCanvasElement>(null);

  const isFree = campaign?.tier !== 'premium';

  // Load campaign
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

      if (error || !data) { setLoading(false); return; }
      setCampaign(data);
      if (user && data.user_id === user.id) setIsOwner(true);
      setLoading(false);

      // Render template to PNG
      renderTemplate(data);
    };
    load();
  }, [slug, user]);

  const renderTemplate = async (c: any) => {
    try {
      const designJson = typeof c.design_json === 'string' ? JSON.parse(c.design_json) : c.design_json;
      if (!designJson || Object.keys(designJson).length === 0) return;

      const sizeMap: Record<string, [number, number]> = {
        square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920],
      };
      const [w, h] = sizeMap[c.size] || [1080, 1080];

      const tmpEl = document.createElement('canvas');
      tmpEl.width = w; tmpEl.height = h;
      const fc = new FabricCanvas(tmpEl, { width: w, height: h, backgroundColor: 'transparent' });
      await fc.loadFromJSON(designJson);
      fc.renderAll();
      setTemplateImage(tmpEl.toDataURL('image/png'));
      fc.dispose();
    } catch (err) { console.error('Template render error:', err); }
  };

  // Draw result when photo or adjustments change
  const drawResult = useCallback(() => {
    const canvas = resultCanvasRef.current;
    if (!canvas || !templateImage || !campaign) return;

    const sizeMap: Record<string, [number, number]> = {
      square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920],
    };
    const [fw, fh] = sizeMap[campaign.size] || [1080, 1080];

    const previewScale = Math.min(400 / fw, 500 / fh, 1);
    const pw = Math.round(fw * previewScale);
    const ph = Math.round(fh * previewScale);
    canvas.width = pw; canvas.height = ph;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, pw, ph);
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, pw, ph);

    const draw = () => {
      if (userPhoto) {
        const photo = new window.Image();
        photo.crossOrigin = 'anonymous';
        photo.onload = () => {
          const s = (photoScale / 100) * previewScale;
          const imgW = photo.width * s;
          const imgH = photo.height * s;
          const ox = (pw / 2) + (photoOffsetX * previewScale) - imgW / 2;
          const oy = (ph / 2) + (photoOffsetY * previewScale) - imgH / 2;
          ctx.drawImage(photo, ox, oy, imgW, imgH);

          const tpl = new window.Image();
          tpl.onload = () => {
            ctx.drawImage(tpl, 0, 0, pw, ph);

            // Draw watermark if free
            if (isFree) {
              ctx.save();
              ctx.globalAlpha = 0.3;
              ctx.font = `bold ${pw * 0.06}px sans-serif`;
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.translate(pw / 2, ph / 2);
              ctx.rotate(-Math.PI / 6);
              ctx.fillText('TWIBO.id', 0, 0);
              ctx.restore();
            }

            setResultImage(canvas.toDataURL('image/png'));
          };
          tpl.src = templateImage;
        };
        photo.src = userPhoto;
      } else {
        const tpl = new window.Image();
        tpl.onload = () => {
          ctx.drawImage(tpl, 0, 0, pw, ph);
          if (isFree) {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.font = `bold ${pw * 0.06}px sans-serif`;
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.translate(pw / 2, ph / 2);
            ctx.rotate(-Math.PI / 6);
            ctx.fillText('TWIBO.id', 0, 0);
            ctx.restore();
          }
        };
        tpl.src = templateImage;
      }
    };
    draw();
  }, [templateImage, userPhoto, photoScale, photoOffsetX, photoOffsetY, campaign, isFree]);

  useEffect(() => { drawResult(); }, [drawResult]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setUserPhoto((ev.target?.result as string) ?? '');
      setPhotoScale(100); setPhotoOffsetX(0); setPhotoOffsetY(0);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownload = () => {
    if (!resultImage) return;
    const a = document.createElement('a');
    a.href = resultImage;
    a.download = `twibbon-${slug}.png`;
    a.click();
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
    // For now, demo upgrade
    await supabase.from('campaigns' as any).update({ tier: 'premium' }).eq('id', campaign.id);
    setCampaign((prev: any) => ({ ...prev, tier: 'premium' }));
    toast.success(t.public?.watermarkRemoved ?? 'Watermark berhasil dihapus!');
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
          {/* Google Ads placeholder (free only) */}
          {isFree && (
            <div className="mb-6 rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
              <p className="text-xs text-muted-foreground">— {t.public?.adSpace ?? 'Advertisement'} —</p>
              <div className="h-16 flex items-center justify-center">
                <span className="text-muted-foreground/40 text-xs">Google AdSense</span>
              </div>
            </div>
          )}

          <div className="glass-strong rounded-2xl p-6 md:p-8 border-gold-subtle">
            {/* Title & description */}
            <h1 className="font-display text-2xl font-bold text-gold-gradient mb-1">{campaign.name}</h1>
            {campaign.description && (
              <p className="text-muted-foreground text-sm mb-6">{campaign.description}</p>
            )}
            {!campaign.description && (
              <p className="text-muted-foreground text-sm mb-6">{t.public?.uploadPrompt ?? 'Upload foto kamu untuk membuat twibbon'}</p>
            )}

            {/* Owner watermark notice */}
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

            {/* Result preview */}
            <div className="rounded-xl overflow-hidden border border-border bg-secondary/20 mb-4 flex items-center justify-center p-2">
              <canvas ref={resultCanvasRef} className="max-w-full h-auto rounded" />
            </div>

            {!userPhoto ? (
              /* Upload area */
              <div className="space-y-4">
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 transition-colors text-center">
                    <Upload className="w-10 h-10 text-primary/50 mx-auto mb-2" />
                    <p className="text-foreground font-medium">{t.public?.uploadPhoto ?? 'Upload foto kamu'}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t.public?.clickOrDrag ?? 'Klik atau drag untuk upload'}</p>
                  </div>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
            ) : (
              /* After upload - adjust & download */
              <div className="space-y-4">
                {/* Adjustment controls */}
                <div className="glass rounded-xl p-4 border-gold-subtle space-y-2">
                  <h3 className="text-sm font-semibold text-foreground">{t.public?.adjustPhoto ?? 'Atur Posisi Foto'}</h3>
                  <div className="flex items-center gap-2">
                    <ZoomIn className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-10">{t.campaign.scale ?? 'Scale'}</span>
                    <Slider value={[photoScale]} onValueChange={v => setPhotoScale(v[0])} min={20} max={300} step={5} className="flex-1" />
                    <span className="text-xs text-muted-foreground w-10">{photoScale}%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Move className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-10">X</span>
                    <Slider value={[photoOffsetX]} onValueChange={v => setPhotoOffsetX(v[0])} min={-500} max={500} step={5} className="flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Move className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-10">Y</span>
                    <Slider value={[photoOffsetY]} onValueChange={v => setPhotoOffsetY(v[0])} min={-500} max={500} step={5} className="flex-1" />
                  </div>
                  <label className="inline-flex cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                    <span className="text-xs text-primary underline">{t.public?.changePhoto ?? 'Ganti Foto'}</span>
                  </label>
                </div>

                <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
                  <Download className="w-4 h-4" />{t.public?.downloadResult ?? 'Download Hasil'}
                </Button>

                {/* Caption & share */}
                {campaign.caption && (
                  <div className="glass rounded-xl p-4 border-gold-subtle text-left">
                    <p className="text-sm text-foreground mb-2">{campaign.caption}</p>
                    <Button variant="outline" size="sm" className="border-border gap-1 text-xs" onClick={handleCopyCaption}>
                      <Copy className="w-3 h-3" />{t.public?.copyCaption ?? 'Salin Caption'}
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

          {/* Bottom ad space (free only) */}
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
