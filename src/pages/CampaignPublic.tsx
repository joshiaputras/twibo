import Layout from '@/components/Layout';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Upload, Download, Copy, MessageCircle, Move, ZoomIn, Crown } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { renderTemplatePNG, composeResult } from '@/utils/renderTemplate';

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

      // Render template to PNG with transparent placeholder
      const sizeMap: Record<string, [number, number]> = {
        square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920],
      };
      const [w, h] = sizeMap[data.size] || [1080, 1080];
      try {
        const tplDataUrl = await renderTemplatePNG(data.design_json, w, h);
        setTemplateImage(tplDataUrl);
      } catch (err) { console.error('Template render error:', err); }
    };
    load();
  }, [slug, user]);

  // Compose result when photo or adjustments change
  const updateResult = useCallback(async () => {
    if (!templateImage || !campaign) return;

    const sizeMap: Record<string, [number, number]> = {
      square: [1080, 1080], portrait: [1080, 1350], story: [1080, 1920],
    };
    const [fw, fh] = sizeMap[campaign.size] || [1080, 1080];

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
        previewMaxW: 500,
        previewMaxH: 600,
      });
      setResultImage(result);
    } catch (err) {
      console.error('Compose error:', err);
    }
  }, [templateImage, userPhoto, photoScale, photoOffsetX, photoOffsetY, campaign, isFree]);

  useEffect(() => { updateResult(); }, [updateResult]);

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
              {resultImage ? (
                <img src={resultImage} alt="Result" className="max-w-full h-auto rounded" style={{ maxHeight: 500 }} />
              ) : (
                <div className="py-12 text-muted-foreground text-sm">{t.campaign?.editor?.loading ?? 'Loading...'}</div>
              )}
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
                    <span className="text-xs text-muted-foreground w-10">{t.campaign?.scale ?? 'Scale'}</span>
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
