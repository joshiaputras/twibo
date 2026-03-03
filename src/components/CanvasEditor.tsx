import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, FabricImage, Circle, Rect, FabricText, ActiveSelection } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Trash2, ZoomIn, ZoomOut, Undo2, Redo2,
  Type, Square, CircleIcon, RectangleHorizontal, Image,
  Eye, EyeOff, ChevronUp, ChevronDown, Crosshair, RotateCcw,
  Move, MousePointer,
} from 'lucide-react';
import { toast } from 'sonner';

interface CanvasEditorProps {
  width: number;
  height: number;
  type: 'frame' | 'background';
}

interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
  type: string;
  obj: any;
}

const PLACEHOLDER_ID = '__placeholder__';

const FONTS = [
  'Inter', 'Space Grotesk', 'Arial', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS',
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald',
  'Raleway', 'Nunito', 'Playfair Display', 'Lobster',
];

const CanvasEditor = ({ width, height, type }: CanvasEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [textSettings, setTextSettings] = useState({ text: 'Text', font: 'Inter', size: 32, color: '#ffffff' });
  const [placeholderShape, setPlaceholderShape] = useState<'circle' | 'square' | 'rounded'>('circle');
  const [hasPlaceholder, setHasPlaceholder] = useState(false);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const skipHistory = useRef(false);

  const scale = Math.min(600 / width, 500 / height, 1);
  const displayW = Math.round(width * scale);
  const displayH = Math.round(height * scale);

  // Save state to history
  const saveHistory = useCallback(() => {
    if (skipHistory.current || !fabricRef.current) return;
    const json = JSON.stringify((fabricRef.current as any).toJSON(['id', 'name', 'selectable', 'evented']));
    setHistory(prev => {
      const newHistory = [...prev.slice(0, historyIdx + 1), json];
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIdx(prev => prev + 1);
  }, [historyIdx]);

  // Sync layers from canvas
  const syncLayers = useCallback(() => {
    if (!fabricRef.current) return;
    const objs = fabricRef.current.getObjects();
    const items: LayerItem[] = objs.map((obj: any, i: number) => ({
      id: obj.id || `layer-${i}`,
      name: obj.name || (obj.type === 'image' ? 'Image' : obj.type === 'text' ? 'Text' : obj.id === PLACEHOLDER_ID ? 'Placeholder' : `Layer ${i + 1}`),
      visible: obj.visible !== false,
      type: obj.type || 'object',
      obj,
    }));
    setLayers(items.reverse());
  }, []);

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: displayW,
      height: displayH,
      backgroundColor: '#1a1a2e',
      selection: true,
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    canvas.on('object:modified', () => { saveHistory(); syncLayers(); });
    canvas.on('object:added', () => syncLayers());
    canvas.on('object:removed', () => syncLayers());
    canvas.on('selection:created', (e: any) => {
      const obj = e.selected?.[0];
      if (obj?.id) setSelectedId(obj.id);
    });
    canvas.on('selection:updated', (e: any) => {
      const obj = e.selected?.[0];
      if (obj?.id) setSelectedId(obj.id);
    });
    canvas.on('selection:cleared', () => setSelectedId(null));

    // Initial history
    const json = JSON.stringify((canvas as any).toJSON(['id', 'name', 'selectable', 'evented']));
    setHistory([json]);
    setHistoryIdx(0);

    return () => { canvas.dispose(); };
  }, [displayW, displayH]);

  // Pan mode handling
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (tool === 'pan') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.forEachObject((o: any) => { o.selectable = false; o.evented = false; });
    } else {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.forEachObject((o: any) => { o.selectable = true; o.evented = true; });
    }
  }, [tool]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const onMouseDown = (opt: any) => {
      if (tool !== 'pan') return;
      isPanning.current = true;
      canvas.defaultCursor = 'grabbing';
      const e = opt.e as MouseEvent;
      lastPan.current = { x: e.clientX, y: e.clientY };
    };
    const onMouseMove = (opt: any) => {
      if (!isPanning.current) return;
      const e = opt.e as MouseEvent;
      const vpt = canvas.viewportTransform;
      if (!vpt) return;
      vpt[4] += e.clientX - lastPan.current.x;
      vpt[5] += e.clientY - lastPan.current.y;
      lastPan.current = { x: e.clientX, y: e.clientY };
      canvas.requestRenderAll();
    };
    const onMouseUp = () => {
      isPanning.current = false;
      if (tool === 'pan') canvas.defaultCursor = 'grab';
    };

    canvas.on('mouse:down', onMouseDown);
    canvas.on('mouse:move', onMouseMove);
    canvas.on('mouse:up', onMouseUp);

    return () => {
      canvas.off('mouse:down', onMouseDown);
      canvas.off('mouse:move', onMouseMove);
      canvas.off('mouse:up', onMouseUp);
    };
  }, [tool]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIdx <= 0 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx - 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      const objs = fabricRef.current?.getObjects() || [];
      setHasPlaceholder(objs.some((o: any) => o.id === PLACEHOLDER_ID));
      skipHistory.current = false;
    });
  }, [history, historyIdx, syncLayers]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx + 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      const objs = fabricRef.current?.getObjects() || [];
      setHasPlaceholder(objs.some((o: any) => o.id === PLACEHOLDER_ID));
      skipHistory.current = false;
    });
  }, [history, historyIdx, syncLayers]);

  // Zoom
  const handleZoom = useCallback((dir: 'in' | 'out' | 'reset') => {
    if (!fabricRef.current) return;
    let newZoom = zoom;
    if (dir === 'in') newZoom = Math.min(zoom * 1.2, 5);
    else if (dir === 'out') newZoom = Math.max(zoom / 1.2, 0.2);
    else newZoom = 1;

    fabricRef.current.setZoom(newZoom);
    setZoom(newZoom);
  }, [zoom]);

  // Upload image
  const handleUpload = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const img = await FabricImage.fromURL(url);
      const canvas = fabricRef.current!;

      const maxScale = Math.min(displayW * 0.8 / (img.width || 1), displayH * 0.8 / (img.height || 1));
      const imgScale = Math.min(maxScale, 1);

      (img as any).id = `img-${Date.now()}`;
      (img as any).name = file.name.substring(0, 20);
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
      saveHistory();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [displayW, displayH, saveHistory]);

  // Add text
  const addText = useCallback(() => {
    if (!fabricRef.current) return;
    const text = new FabricText(textSettings.text, {
      left: displayW / 2,
      top: displayH / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: textSettings.font,
      fontSize: textSettings.size,
      fill: textSettings.color,
      editable: true,
    });
    (text as any).id = `text-${Date.now()}`;
    (text as any).name = textSettings.text.substring(0, 15);
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
    saveHistory();
  }, [textSettings, displayW, displayH, saveHistory]);

  // Add shape
  const addShape = useCallback((shape: 'rect' | 'circle') => {
    if (!fabricRef.current) return;
    const size = Math.min(displayW, displayH) * 0.2;
    let obj: any;
    if (shape === 'rect') {
      obj = new Rect({
        width: size, height: size,
        left: displayW / 2, top: displayH / 2,
        originX: 'center', originY: 'center',
        fill: 'rgba(255,215,0,0.3)',
        stroke: 'hsl(45 100% 50%)', strokeWidth: 2,
      });
    } else {
      obj = new Circle({
        radius: size / 2,
        left: displayW / 2, top: displayH / 2,
        originX: 'center', originY: 'center',
        fill: 'rgba(255,215,0,0.3)',
        stroke: 'hsl(45 100% 50%)', strokeWidth: 2,
      });
    }
    obj.id = `shape-${Date.now()}`;
    obj.name = shape === 'rect' ? 'Rectangle' : 'Circle';
    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    saveHistory();
  }, [displayW, displayH, saveHistory]);

  // Add placeholder
  const addPlaceholder = useCallback(() => {
    if (!fabricRef.current || hasPlaceholder) {
      toast.error('Hanya satu placeholder per campaign');
      return;
    }
    const size = Math.min(displayW, displayH) * 0.4;
    let obj: any;

    if (placeholderShape === 'circle') {
      obj = new Circle({
        radius: size / 2,
        left: displayW / 2, top: displayH / 2,
        originX: 'center', originY: 'center',
        fill: 'rgba(255,255,255,0.08)',
        stroke: 'rgba(212,175,55,0.7)', strokeWidth: 3,
        strokeDashArray: [10, 5],
      });
    } else {
      obj = new Rect({
        width: size, height: size,
        left: displayW / 2, top: displayH / 2,
        originX: 'center', originY: 'center',
        fill: 'rgba(255,255,255,0.08)',
        stroke: 'rgba(212,175,55,0.7)', strokeWidth: 3,
        strokeDashArray: [10, 5],
        rx: placeholderShape === 'rounded' ? size * 0.15 : 0,
        ry: placeholderShape === 'rounded' ? size * 0.15 : 0,
      });
    }
    obj.id = PLACEHOLDER_ID;
    obj.name = 'Photo Placeholder';
    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    setHasPlaceholder(true);
    saveHistory();
    toast.success('Placeholder ditambahkan — area ini untuk foto supporter');
  }, [displayW, displayH, placeholderShape, hasPlaceholder, saveHistory]);

  // Delete selected
  const deleteSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (!active) return;
    if ((active as any).id === PLACEHOLDER_ID) setHasPlaceholder(false);
    fabricRef.current.remove(active);
    fabricRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  // Layer controls
  const toggleVisibility = useCallback((id: string) => {
    if (!fabricRef.current) return;
    const obj = fabricRef.current.getObjects().find((o: any) => o.id === id);
    if (!obj) return;
    obj.visible = !obj.visible;
    fabricRef.current.renderAll();
    syncLayers();
  }, [syncLayers]);

  const moveLayer = useCallback((id: string, dir: 'up' | 'down') => {
    if (!fabricRef.current) return;
    const objs = fabricRef.current.getObjects();
    const obj = objs.find((o: any) => o.id === id);
    if (!obj) return;
    const idx = objs.indexOf(obj);
    if (dir === 'up' && idx < objs.length - 1) {
      fabricRef.current.moveObjectTo(obj, idx + 1);
    } else if (dir === 'down' && idx > 0) {
      fabricRef.current.moveObjectTo(obj, idx - 1);
    }
    fabricRef.current.renderAll();
    syncLayers();
    saveHistory();
  }, [syncLayers, saveHistory]);

  // Preview photo upload
  const handlePreviewUpload = useCallback(() => { previewInputRef.current?.click(); }, []);

  const handlePreviewFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    // Remove existing preview if any
    const existing = fabricRef.current.getObjects().find((o: any) => o.id === '__preview_photo__');
    if (existing) fabricRef.current.remove(existing);

    // Find placeholder position
    const placeholder = fabricRef.current.getObjects().find((o: any) => o.id === PLACEHOLDER_ID);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const img = await FabricImage.fromURL(url);
      const canvas = fabricRef.current!;

      if (placeholder) {
        const bounds = placeholder.getBoundingRect();
        const scaleX = bounds.width / (img.width || 1);
        const scaleY = bounds.height / (img.height || 1);
        const imgScale = Math.max(scaleX, scaleY);
        img.set({
          scaleX: imgScale, scaleY: imgScale,
          left: bounds.left + bounds.width / 2,
          top: bounds.top + bounds.height / 2,
          originX: 'center', originY: 'center',
        });
        // Place preview behind placeholder
        const placeholderIdx = canvas.getObjects().indexOf(placeholder);
        canvas.add(img);
        canvas.moveObjectTo(img, placeholderIdx);
      } else {
        const scaleX = displayW * 0.5 / (img.width || 1);
        const scaleY = displayH * 0.5 / (img.height || 1);
        img.set({
          scaleX: Math.min(scaleX, scaleY),
          scaleY: Math.min(scaleX, scaleY),
          left: displayW / 2, top: displayH / 2,
          originX: 'center', originY: 'center',
        });
        canvas.add(img);
        canvas.sendObjectToBack(img);
      }

      (img as any).id = '__preview_photo__';
      (img as any).name = 'Preview Photo';
      canvas.renderAll();
      syncLayers();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [displayW, displayH, syncLayers]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, handleUndo, handleRedo]);

  return (
    <div className="space-y-4">
      {/* Main toolbar */}
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant={tool === 'select' ? 'default' : 'outline'} size="sm" className="gap-1 border-border" onClick={() => setTool('select')}>
          <MousePointer className="w-3 h-3" /> Select
        </Button>
        <Button variant={tool === 'pan' ? 'default' : 'outline'} size="sm" className="gap-1 border-border" onClick={() => setTool('pan')}>
          <Move className="w-3 h-3" /> Pan
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={handleUpload}>
          <Upload className="w-3 h-3" /> Image
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => addShape('rect')}>
          <Square className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => addShape('circle')}>
          <CircleIcon className="w-3 h-3" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={handleUndo} disabled={historyIdx <= 0}>
          <Undo2 className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={handleRedo} disabled={historyIdx >= history.length - 1}>
          <Redo2 className="w-3 h-3" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleZoom('out')}>
          <ZoomOut className="w-3 h-3" />
        </Button>
        <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleZoom('in')}>
          <ZoomIn className="w-3 h-3" />
        </Button>
        <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => handleZoom('reset')}>
          <RotateCcw className="w-3 h-3" />
        </Button>
        <div className="w-px h-6 bg-border" />
        <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1" onClick={deleteSelected}>
          <Trash2 className="w-3 h-3" /> Hapus
        </Button>
      </div>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <input ref={previewInputRef} type="file" accept="image/*" className="hidden" onChange={handlePreviewFile} />

      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Left sidebar: tools */}
        <div className="lg:w-64 space-y-4 shrink-0">
          {/* Text tool */}
          <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Type className="w-4 h-4 text-primary" /> Teks</h3>
            <Input value={textSettings.text} onChange={e => setTextSettings(s => ({ ...s, text: e.target.value }))} placeholder="Masukkan teks..." className="bg-secondary/50 border-border text-sm" />
            <Select value={textSettings.font} onValueChange={v => setTextSettings(s => ({ ...s, font: v }))}>
              <SelectTrigger className="bg-secondary/50 border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONTS.map(f => (
                  <SelectItem key={f} value={f} style={{ fontFamily: f }}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input type="number" value={textSettings.size} onChange={e => setTextSettings(s => ({ ...s, size: Number(e.target.value) || 16 }))} className="bg-secondary/50 border-border text-sm w-20" min={8} max={200} />
              <Input type="color" value={textSettings.color} onChange={e => setTextSettings(s => ({ ...s, color: e.target.value }))} className="w-10 h-9 p-1 bg-secondary/50 border-border cursor-pointer" />
            </div>
            <Button size="sm" className="w-full gap-1" onClick={addText}>
              <Type className="w-3 h-3" /> Tambah Teks
            </Button>
          </div>

          {/* Placeholder tool */}
          <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Crosshair className="w-4 h-4 text-primary" /> Placeholder Foto</h3>
            <p className="text-xs text-muted-foreground">Area tempat foto supporter akan ditaruh</p>
            <Select value={placeholderShape} onValueChange={v => setPlaceholderShape(v as any)}>
              <SelectTrigger className="bg-secondary/50 border-border text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="circle">Lingkaran</SelectItem>
                <SelectItem value="square">Kotak</SelectItem>
                <SelectItem value="rounded">Kotak Bulat</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="w-full gap-1 border-primary/30 text-primary" onClick={addPlaceholder} disabled={hasPlaceholder}>
              <Crosshair className="w-3 h-3" /> {hasPlaceholder ? 'Sudah Ada' : 'Tambah Placeholder'}
            </Button>
          </div>

          {/* Preview photo */}
          <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Image className="w-4 h-4 text-primary" /> Preview Foto</h3>
            <p className="text-xs text-muted-foreground">Upload foto contoh untuk melihat hasil</p>
            <Button size="sm" variant="outline" className="w-full gap-1 border-border" onClick={handlePreviewUpload}>
              <Upload className="w-3 h-3" /> Upload Preview
            </Button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 flex justify-center">
          <div className="rounded-xl overflow-hidden border-2 border-border" style={{ width: displayW, height: displayH }}>
            <canvas ref={canvasRef} />
          </div>
        </div>

        {/* Right sidebar: layers */}
        <div className="lg:w-56 shrink-0">
          <div className="glass rounded-xl p-4 border-gold-subtle">
            <h3 className="text-sm font-semibold text-foreground mb-3">Layers</h3>
            {layers.length === 0 ? (
              <p className="text-xs text-muted-foreground">Belum ada layer</p>
            ) : (
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {layers.map(layer => (
                  <div
                    key={layer.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                      selectedId === layer.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
                    }`}
                    onClick={() => {
                      if (!fabricRef.current) return;
                      const obj = fabricRef.current.getObjects().find((o: any) => o.id === layer.id);
                      if (obj) {
                        fabricRef.current.setActiveObject(obj);
                        fabricRef.current.renderAll();
                        setSelectedId(layer.id);
                      }
                    }}
                  >
                    <button onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }} className="shrink-0">
                      {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground/50" />}
                    </button>
                    <span className="truncate flex-1">{layer.name}</span>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} className="shrink-0 hover:text-foreground">
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); moveLayer(layer.id, 'down'); }} className="shrink-0 hover:text-foreground">
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {type === 'frame'
          ? 'Upload frame transparan (PNG). Placeholder = area foto supporter.'
          : 'Upload background. Placeholder = area foto supporter.'}
        {' '}• Ukuran output: {width}×{height}px • Shortcuts: Ctrl+Z undo, Ctrl+Shift+Z redo, Delete hapus
      </p>
    </div>
  );
};

export default CanvasEditor;
