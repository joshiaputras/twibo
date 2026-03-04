import { useState, useRef, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';

interface AvatarCropDialogProps {
  file: File | null;
  open: boolean;
  onClose: () => void;
  onCropped: (blob: Blob) => void;
  uploading?: boolean;
}

const CROP_SIZE = 280;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

const AvatarCropDialog = ({ file, open, onClose, onCropped, uploading }: AvatarCropDialogProps) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);

  // Load image when file changes
  useEffect(() => {
    if (!file) return;
    setImgLoaded(false);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgLoaded(true);
    };
    img.src = URL.createObjectURL(file);
    return () => URL.revokeObjectURL(img.src);
  }, [file]);

  // Draw preview
  useEffect(() => {
    if (!imgLoaded || !imgRef.current || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;

    ctx.clearRect(0, 0, CROP_SIZE, CROP_SIZE);

    // Cover fit
    const aspect = img.width / img.height;
    let drawW: number, drawH: number;
    if (aspect > 1) {
      drawH = CROP_SIZE * scale;
      drawW = drawH * aspect;
    } else {
      drawW = CROP_SIZE * scale;
      drawH = drawW / aspect;
    }

    const dx = (CROP_SIZE - drawW) / 2 + offset.x;
    const dy = (CROP_SIZE - drawH) / 2 + offset.y;

    ctx.drawImage(img, dx, dy, drawW, drawH);
  }, [imgLoaded, scale, offset]);

  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY, ox: offset.x, oy: offset.y };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: dragStart.current.ox + (clientX - dragStart.current.x),
      y: dragStart.current.oy + (clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev - e.deltaY * 0.002)));
  }, []);

  const handleCrop = () => {
    if (!imgRef.current) return;
    const outputSize = 400; // Output 400x400
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d')!;
    const img = imgRef.current;

    const aspect = img.width / img.height;
    let drawW: number, drawH: number;
    if (aspect > 1) {
      drawH = CROP_SIZE * scale;
      drawW = drawH * aspect;
    } else {
      drawW = CROP_SIZE * scale;
      drawH = drawW / aspect;
    }

    const ratio = outputSize / CROP_SIZE;
    const dx = ((CROP_SIZE - drawW) / 2 + offset.x) * ratio;
    const dy = ((CROP_SIZE - drawH) / 2 + offset.y) * ratio;

    ctx.drawImage(img, dx, dy, drawW * ratio, drawH * ratio);

    // Compress to JPEG at 0.8 quality
    canvas.toBlob(
      blob => { if (blob) onCropped(blob); },
      'image/jpeg',
      0.8
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-border max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{t.profile?.cropAvatar ?? 'Crop Avatar'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <div
            className="relative rounded-full overflow-hidden border-2 border-primary/30 cursor-grab active:cursor-grabbing select-none touch-none"
            style={{ width: CROP_SIZE, height: CROP_SIZE }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchMove={handleMouseMove}
            onTouchEnd={handleMouseUp}
            onWheel={handleWheel}
          >
            <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} className="w-full h-full" />
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => setScale(s => Math.max(MIN_SCALE, s - 0.2))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <input
              type="range"
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.05}
              value={scale}
              onChange={e => setScale(Number(e.target.value))}
              className="w-32 accent-primary"
            />
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => setScale(s => Math.min(MAX_SCALE, s + 0.2))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-border">{t.dashboard?.cancel ?? 'Batal'}</Button>
          <Button className="gold-glow font-semibold" onClick={handleCrop} disabled={uploading || !imgLoaded}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            {uploading ? '...' : (t.profile?.uploadAvatar ?? 'Upload')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AvatarCropDialog;
