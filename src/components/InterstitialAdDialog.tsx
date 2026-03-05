import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download } from 'lucide-react';
import AdSenseBanner from '@/components/AdSenseBanner';
import { useLanguage } from '@/i18n/LanguageContext';

interface InterstitialAdDialogProps {
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

const TOTAL_MS = 4000;
const INTERVAL_MS = 50;
const STEPS = TOTAL_MS / INTERVAL_MS;

const InterstitialAdDialog = ({ open, onClose, onDownload }: InterstitialAdDialogProps) => {
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);

  const messages = [
    t.interstitial?.msg1 ?? 'Menyiapkan twibbon kamu...',
    t.interstitial?.msg2 ?? 'Memproses gambar...',
    t.interstitial?.msg3 ?? 'Menerapkan efek visual...',
    t.interstitial?.msg4 ?? 'Hampir selesai...',
  ];

  useEffect(() => {
    if (!open) {
      setProgress(0);
      setReady(false);
      return;
    }
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const pct = Math.min(100, (step / STEPS) * 100);
      setProgress(pct);
      if (step >= STEPS) {
        clearInterval(interval);
        setReady(true);
      }
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [open]);

  const messageIndex = Math.min(Math.floor(progress / 25), messages.length - 1);

  const handleDownload = () => {
    onDownload();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong border-border max-w-[calc(100vw-2rem)] sm:max-w-sm mx-auto rounded-2xl text-center space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground">
          {t.interstitial?.title ?? 'Download akan dimulai...'}
        </h3>

        <div className="rounded-xl border border-dashed border-border bg-secondary/20 p-4 text-center">
          <AdSenseBanner />
        </div>

        <div className="py-2 space-y-3">
          {!ready ? (
            <div className="space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-muted-foreground animate-pulse">{messages[messageIndex]}</p>
            </div>
          ) : (
            <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              {t.interstitial?.downloadNow ?? 'Download Sekarang'}
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          {t.interstitial?.upgradeHint ?? 'Upgrade ke Premium untuk download tanpa iklan'}
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default InterstitialAdDialog;
