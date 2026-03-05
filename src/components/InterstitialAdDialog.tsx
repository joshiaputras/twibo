import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import AdSenseBanner from '@/components/AdSenseBanner';

interface InterstitialAdDialogProps {
  open: boolean;
  onClose: () => void;
  onDownload: () => void;
}

const InterstitialAdDialog = ({ open, onClose, onDownload }: InterstitialAdDialogProps) => {
  const [countdown, setCountdown] = useState(3);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setCountdown(3);
      setReady(false);
      return;
    }
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setReady(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [open]);

  const handleDownload = () => {
    onDownload();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-strong border-border max-w-md text-center space-y-4">
        <h3 className="font-display text-lg font-bold text-foreground">Download akan dimulai...</h3>
        
        <AdSenseBanner />

        <div className="py-2">
          {!ready ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-16 h-16 flex items-center justify-center">
                <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
                  <circle
                    cx="32" cy="32" r="28" fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="4"
                    strokeDasharray={`${2 * Math.PI * 28}`}
                    strokeDashoffset={`${2 * Math.PI * 28 * (countdown / 3)}`}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <span className="font-display text-2xl font-bold text-primary">{countdown}</span>
              </div>
              <p className="text-sm text-muted-foreground">Mohon tunggu sebentar...</p>
            </div>
          ) : (
            <Button className="gold-glow font-semibold gap-2 w-full" onClick={handleDownload}>
              <Download className="w-4 h-4" />
              Download Sekarang
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Upgrade ke Premium untuk download tanpa iklan
        </p>
      </DialogContent>
    </Dialog>
  );
};

export default InterstitialAdDialog;
