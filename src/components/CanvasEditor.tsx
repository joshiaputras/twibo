import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, FabricImage, Circle, Rect } from 'fabric';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface CanvasEditorProps {
  width: number;
  height: number;
  type: 'frame' | 'background';
}

const CanvasEditor = ({ width, height, type }: CanvasEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasDesign, setHasDesign] = useState(false);

  // Scale canvas to fit container (max 500px wide)
  const scale = Math.min(500 / width, 500 / height);
  const displayW = Math.round(width * scale);
  const displayH = Math.round(height * scale);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: displayW,
      height: displayH,
      backgroundColor: '#1a1a2e',
      selection: true,
    });

    fabricRef.current = canvas;

    // Add placeholder circle for user photo area
    const placeholderSize = Math.min(displayW, displayH) * 0.4;
    const placeholder = new Circle({
      radius: placeholderSize / 2,
      left: displayW / 2,
      top: displayH / 2,
      originX: 'center',
      originY: 'center',
      fill: 'rgba(255,255,255,0.1)',
      stroke: 'rgba(212,175,55,0.5)',
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: true,
      evented: true,
    });

    canvas.add(placeholder);
    canvas.renderAll();

    return () => {
      canvas.dispose();
    };
  }, [displayW, displayH]);

  const handleUpload = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const img = await FabricImage.fromURL(url);
      const canvas = fabricRef.current!;

      // Scale image to fit canvas
      const scaleX = displayW / (img.width || 1);
      const scaleY = displayH / (img.height || 1);
      const imgScale = Math.max(scaleX, scaleY);

      img.set({
        scaleX: imgScale,
        scaleY: imgScale,
        left: displayW / 2,
        top: displayH / 2,
        originX: 'center',
        originY: 'center',
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      setHasDesign(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [displayW, displayH]);

  const handleClear = useCallback(() => {
    if (!fabricRef.current) return;
    fabricRef.current.clear();
    fabricRef.current.backgroundColor = '#1a1a2e';

    // Re-add placeholder
    const placeholderSize = Math.min(displayW, displayH) * 0.4;
    const placeholder = new Circle({
      radius: placeholderSize / 2,
      left: displayW / 2,
      top: displayH / 2,
      originX: 'center',
      originY: 'center',
      fill: 'rgba(255,255,255,0.1)',
      stroke: 'rgba(212,175,55,0.5)',
      strokeWidth: 2,
      strokeDashArray: [8, 4],
      selectable: true,
      evented: true,
    });
    fabricRef.current.add(placeholder);
    fabricRef.current.renderAll();
    setHasDesign(false);
  }, [displayW, displayH]);

  const handleZoom = useCallback((direction: 'in' | 'out') => {
    if (!fabricRef.current) return;
    const obj = fabricRef.current.getActiveObject();
    if (!obj) return;
    const factor = direction === 'in' ? 1.1 : 0.9;
    obj.scaleX = (obj.scaleX || 1) * factor;
    obj.scaleY = (obj.scaleY || 1) * factor;
    fabricRef.current.renderAll();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={handleUpload}>
          <Upload className="w-3 h-3" /> Upload {type === 'frame' ? 'Frame' : 'Background'}
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleZoom('in')}>
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleZoom('out')}>
          <ZoomOut className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1" onClick={handleClear}>
          <Trash2 className="w-3 h-3" /> Reset
        </Button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      <div className="flex justify-center">
        <div className="rounded-xl overflow-hidden border-2 border-border" style={{ width: displayW, height: displayH }}>
          <canvas ref={canvasRef} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {type === 'frame'
          ? 'Upload gambar frame transparan (PNG). Area lingkaran putus-putus = tempat foto supporter.'
          : 'Upload gambar background. Foto supporter akan ditempatkan di area lingkaran putus-putus.'}
      </p>
      <p className="text-xs text-muted-foreground text-center">
        Ukuran output: {width}×{height}px
      </p>
    </div>
  );
};

export default CanvasEditor;
