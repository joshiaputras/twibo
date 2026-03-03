import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, FabricImage, Circle, Rect, FabricText } from 'fabric';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Upload, Trash2, ZoomIn, ZoomOut, Undo2, Redo2,
  Type, Square, CircleIcon, Eye, EyeOff, ChevronUp, ChevronDown, Crosshair, RotateCcw,
  Move, MousePointer, FlipHorizontal2, FlipVertical2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

interface CanvasEditorProps {
  width: number;
  height: number;
  type: 'frame' | 'background';
  initialState?: string;
  onStateChange?: (state: string) => void;
  previewPhotoUrl?: string;
  mode?: 'edit' | 'preview';
}

interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
}

const PLACEHOLDER_ID = '__placeholder__';
const PREVIEW_ID = '__preview_photo__';

const FONTS = [
  'Space Grotesk', 'Playfair Display', 'Montserrat', 'Nunito',
  'Roboto', 'Open Sans', 'Lato', 'Oswald', 'Raleway', 'Georgia', 'Verdana',
];

const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const CANVAS_BG = 'hsl(240 8% 12%)';

const CanvasEditor = ({
  width,
  height,
  type,
  initialState,
  onStateChange,
  previewPhotoUrl,
  mode = 'edit',
}: CanvasEditorProps) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [zoom, setZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [textSettings, setTextSettings] = useState({
    text: 'Text',
    font: 'Space Grotesk',
    weight: '700',
    size: 40,
    color: '#ffffff',
  });
  const [shapeColor, setShapeColor] = useState('#d4af37');
  const [placeholderShape, setPlaceholderShape] = useState<'circle' | 'square' | 'rounded'>('circle');
  const [hasPlaceholder, setHasPlaceholder] = useState(false);

  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const skipHistory = useRef(false);
  const initialLoadedRef = useRef(false);
  const syncLayersRef = useRef<() => void>(() => {});
  const saveHistoryRef = useRef<() => void>(() => {});

  const scale = Math.min(900 / width, 640 / height, 1);
  const displayW = Math.round(width * scale);
  const displayH = Math.round(height * scale);

  const serializeCanvas = useCallback(() => {
    if (!fabricRef.current) return '';
    return JSON.stringify((fabricRef.current as any).toJSON(['id', 'name', 'selectable', 'evented']));
  }, []);

  const syncLayers = useCallback(() => {
    if (!fabricRef.current) return;
    const objs = fabricRef.current.getObjects();
    const items = objs
      .filter((obj: any) => obj.id !== PREVIEW_ID)
      .map((obj: any, i: number) => ({
        id: obj.id || `layer-${i}`,
        name:
          obj.name ||
          (obj.id === PLACEHOLDER_ID
            ? t.campaign.editor.placeholder
            : obj.type === 'image'
              ? t.campaign.editor.imageLayer
              : obj.type === 'text'
                ? t.campaign.editor.textLayer
                : `${t.campaign.editor.layer} ${i + 1}`),
        visible: obj.visible !== false,
      }));
    setLayers(items.reverse());
  }, [t.campaign.editor]);

  const saveHistory = useCallback(() => {
    if (skipHistory.current || !fabricRef.current || mode === 'preview') return;
    const json = serializeCanvas();
    if (!json) return;

    setHistory(prev => {
      const base = prev.slice(0, historyIdx + 1);
      if (base[base.length - 1] === json) return base;
      const next = [...base, json];
      return next.length > 50 ? next.slice(next.length - 50) : next;
    });

    setHistoryIdx(prev => prev + 1);
    onStateChange?.(json);
  }, [historyIdx, mode, onStateChange, serializeCanvas]);

  useEffect(() => {
    syncLayersRef.current = syncLayers;
  }, [syncLayers]);

  useEffect(() => {
    saveHistoryRef.current = saveHistory;
  }, [saveHistory]);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: displayW,
      height: displayH,
      backgroundColor: CANVAS_BG,
      selection: mode === 'edit',
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;
    initialLoadedRef.current = false;

    const onModified = () => {
      saveHistoryRef.current();
      syncLayersRef.current();
    };

    canvas.on('object:modified', onModified);
    canvas.on('object:added', onModified);
    canvas.on('object:removed', onModified);

    canvas.on('selection:created', (e: any) => setSelectedId(e.selected?.[0]?.id ?? null));
    canvas.on('selection:updated', (e: any) => setSelectedId(e.selected?.[0]?.id ?? null));
    canvas.on('selection:cleared', () => setSelectedId(null));

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [displayH, displayW, mode]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || initialLoadedRef.current) return;

    const load = async () => {
      try {
        if (initialState) {
          skipHistory.current = true;
          await canvas.loadFromJSON(JSON.parse(initialState));
          canvas.renderAll();
          skipHistory.current = false;
        }
      } catch {
        skipHistory.current = false;
      }

      const json = serializeCanvas();
      if (json) {
        setHistory([json]);
        setHistoryIdx(0);
        if (mode === 'edit') onStateChange?.(json);
      }

      const objs = canvas.getObjects();
      setHasPlaceholder(objs.some((o: any) => o.id === PLACEHOLDER_ID));
      syncLayers();
      initialLoadedRef.current = true;
    };

    load();
  }, [displayH, displayW, initialState, mode, onStateChange, serializeCanvas, syncLayers]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || mode !== 'edit') return;

    if (tool === 'pan') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.forEachObject((o: any) => {
        o.selectable = false;
        o.evented = false;
      });
    } else {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.forEachObject((o: any) => {
        if (o.id === PREVIEW_ID) {
          o.selectable = false;
          o.evented = false;
          return;
        }
        o.selectable = true;
        o.evented = true;
      });
    }
  }, [tool, mode]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || mode !== 'edit') return;

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
  }, [tool, mode]);

  useEffect(() => {
    if (!previewPhotoUrl || !fabricRef.current) return;

    const applyPreview = async () => {
      const canvas = fabricRef.current!;
      const existing = canvas.getObjects().find((o: any) => o.id === PREVIEW_ID);
      if (existing) canvas.remove(existing);

      const img = await FabricImage.fromURL(previewPhotoUrl);
      (img as any).id = PREVIEW_ID;
      (img as any).name = 'Preview';
      img.set({ selectable: false, evented: false });

      const placeholder = canvas.getObjects().find((o: any) => o.id === PLACEHOLDER_ID);
      if (placeholder) {
        const bounds = placeholder.getBoundingRect();
        const scaleX = bounds.width / (img.width || 1);
        const scaleY = bounds.height / (img.height || 1);
        const imgScale = Math.max(scaleX, scaleY);

        img.set({
          scaleX: imgScale,
          scaleY: imgScale,
          left: bounds.left + bounds.width / 2,
          top: bounds.top + bounds.height / 2,
          originX: 'center',
          originY: 'center',
        });

        canvas.add(img);
        const placeholderIndex = canvas.getObjects().indexOf(placeholder);
        canvas.moveObjectTo(img, Math.max(0, placeholderIndex));
      } else {
        const fitX = displayW / (img.width || 1);
        const fitY = displayH / (img.height || 1);
        const fit = Math.min(fitX, fitY);

        img.set({
          scaleX: fit,
          scaleY: fit,
          left: displayW / 2,
          top: displayH / 2,
          originX: 'center',
          originY: 'center',
        });

        canvas.add(img);
        canvas.sendObjectToBack(img);
      }

      canvas.renderAll();
    };

    applyPreview();
  }, [displayH, displayW, previewPhotoUrl]);

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx - 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      setHasPlaceholder((fabricRef.current?.getObjects() || []).some((o: any) => o.id === PLACEHOLDER_ID));
      onStateChange?.(history[newIdx]);
      skipHistory.current = false;
    });
  }, [history, historyIdx, onStateChange, syncLayers]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx + 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      setHasPlaceholder((fabricRef.current?.getObjects() || []).some((o: any) => o.id === PLACEHOLDER_ID));
      onStateChange?.(history[newIdx]);
      skipHistory.current = false;
    });
  }, [history, historyIdx, onStateChange, syncLayers]);

  const handleZoom = useCallback((dir: 'in' | 'out' | 'reset') => {
    if (!fabricRef.current) return;
    let newZoom = zoom;
    if (dir === 'in') newZoom = Math.min(zoom * 1.2, 5);
    if (dir === 'out') newZoom = Math.max(zoom / 1.2, 0.2);
    if (dir === 'reset') newZoom = 1;

    fabricRef.current.setZoom(newZoom);
    setZoom(newZoom);
  }, [zoom]);

  const handleUpload = useCallback(() => fileInputRef.current?.click(), []);

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
  }, [displayH, displayW, saveHistory]);

  const addText = useCallback(() => {
    if (!fabricRef.current) return;
    const text = new FabricText(textSettings.text, {
      left: displayW / 2,
      top: displayH / 2,
      originX: 'center',
      originY: 'center',
      fontFamily: textSettings.font,
      fontWeight: textSettings.weight,
      fontSize: textSettings.size,
      fill: textSettings.color,
      editable: true,
    });

    (text as any).id = `text-${Date.now()}`;
    (text as any).name = textSettings.text.substring(0, 15) || t.campaign.editor.textLayer;

    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
    saveHistory();
  }, [displayH, displayW, saveHistory, t.campaign.editor.textLayer, textSettings]);

  const addShape = useCallback((shape: 'rect' | 'circle') => {
    if (!fabricRef.current) return;

    const size = Math.min(displayW, displayH) * 0.2;
    let obj: any;

    if (shape === 'rect') {
      obj = new Rect({
        width: size,
        height: size,
        left: displayW / 2,
        top: displayH / 2,
        originX: 'center',
        originY: 'center',
        fill: shapeColor,
      });
      obj.name = t.campaign.editor.rectangle;
    } else {
      obj = new Circle({
        radius: size / 2,
        left: displayW / 2,
        top: displayH / 2,
        originX: 'center',
        originY: 'center',
        fill: shapeColor,
      });
      obj.name = t.campaign.editor.circle;
    }

    obj.id = `shape-${Date.now()}`;

    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    saveHistory();
  }, [displayH, displayW, saveHistory, shapeColor, t.campaign.editor.circle, t.campaign.editor.rectangle]);

  const addPlaceholder = useCallback(() => {
    if (!fabricRef.current || hasPlaceholder) {
      toast.error(t.campaign.editor.onePlaceholderOnly);
      return;
    }

    const size = Math.min(displayW, displayH) * 0.42;
    let obj: any;

    if (placeholderShape === 'circle') {
      obj = new Circle({
        radius: size / 2,
        left: displayW / 2,
        top: displayH / 2,
        originX: 'center',
        originY: 'center',
        fill: 'hsl(0 0% 100% / 0.08)',
        stroke: 'hsl(46 65% 52% / 0.9)',
        strokeWidth: 3,
        strokeDashArray: [10, 6],
      });
    } else {
      obj = new Rect({
        width: size,
        height: size,
        left: displayW / 2,
        top: displayH / 2,
        originX: 'center',
        originY: 'center',
        fill: 'hsl(0 0% 100% / 0.08)',
        stroke: 'hsl(46 65% 52% / 0.9)',
        strokeWidth: 3,
        strokeDashArray: [10, 6],
        rx: placeholderShape === 'rounded' ? size * 0.15 : 0,
        ry: placeholderShape === 'rounded' ? size * 0.15 : 0,
      });
    }

    obj.id = PLACEHOLDER_ID;
    obj.name = t.campaign.editor.placeholder;

    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    setHasPlaceholder(true);
    saveHistory();
    toast.success(t.campaign.editor.placeholderAdded);
  }, [displayH, displayW, hasPlaceholder, placeholderShape, saveHistory, t.campaign.editor]);

  const deleteSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (!active || (active as any).id === PREVIEW_ID) return;
    if ((active as any).id === PLACEHOLDER_ID) setHasPlaceholder(false);
    fabricRef.current.remove(active);
    fabricRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  const flipSelected = useCallback((axis: 'x' | 'y') => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject() as any;
    if (!active) return;
    if (axis === 'x') active.set('flipX', !active.flipX);
    if (axis === 'y') active.set('flipY', !active.flipY);
    fabricRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  const toggleVisibility = useCallback((id: string) => {
    if (!fabricRef.current) return;
    const obj = fabricRef.current.getObjects().find((o: any) => o.id === id);
    if (!obj) return;
    obj.visible = !obj.visible;
    fabricRef.current.renderAll();
    syncLayers();
    saveHistory();
  }, [saveHistory, syncLayers]);

  const moveLayer = useCallback((id: string, dir: 'up' | 'down') => {
    if (!fabricRef.current) return;
    const objs = fabricRef.current.getObjects();
    const obj = objs.find((o: any) => o.id === id);
    if (!obj) return;
    const idx = objs.indexOf(obj);
    if (dir === 'up' && idx < objs.length - 1) fabricRef.current.moveObjectTo(obj, idx + 1);
    if (dir === 'down' && idx > 0) fabricRef.current.moveObjectTo(obj, idx - 1);
    fabricRef.current.renderAll();
    syncLayers();
    saveHistory();
  }, [saveHistory, syncLayers]);

  useEffect(() => {
    if (mode !== 'edit') return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA') return;
        deleteSelected();
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, handleRedo, handleUndo, mode]);

  return (
    <div className="space-y-4">
      {mode === 'edit' && (
        <>
          <div className="flex gap-2 flex-wrap items-center">
            <Button variant={tool === 'select' ? 'default' : 'outline'} size="sm" className="gap-1 border-border" onClick={() => setTool('select')}>
              <MousePointer className="w-3 h-3" /> {t.campaign.editor.select}
            </Button>
            <Button variant={tool === 'pan' ? 'default' : 'outline'} size="sm" className="gap-1 border-border" onClick={() => setTool('pan')}>
              <Move className="w-3 h-3" /> {t.campaign.editor.pan}
            </Button>
            <div className="w-px h-6 bg-border" />
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={handleUpload}>
              <Upload className="w-3 h-3" /> {t.campaign.editor.image}
            </Button>
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => addShape('rect')}>
              <Square className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => addShape('circle')}>
              <CircleIcon className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => flipSelected('x')}>
              <FlipHorizontal2 className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="sm" className="border-border gap-1" onClick={() => flipSelected('y')}>
              <FlipVertical2 className="w-3 h-3" />
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
              <Trash2 className="w-3 h-3" /> {t.campaign.editor.delete}
            </Button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </>
      )}

      <div className="flex flex-col xl:flex-row gap-4">
        {mode === 'edit' && (
          <div className="w-full xl:w-72 space-y-4 shrink-0">
            <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Type className="w-4 h-4 text-primary" /> {t.campaign.editor.textTool}</h3>
              <Input value={textSettings.text} onChange={e => setTextSettings(s => ({ ...s, text: e.target.value }))} placeholder={t.campaign.editor.textPlaceholder} className="bg-secondary/50 border-border text-sm" />

              <Select value={textSettings.font} onValueChange={v => setTextSettings(s => ({ ...s, font: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTS.map(font => (
                    <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="grid grid-cols-3 gap-2">
                <Input type="number" value={textSettings.size} onChange={e => setTextSettings(s => ({ ...s, size: Number(e.target.value) || 16 }))} min={8} max={220} className="bg-secondary/50 border-border text-sm col-span-1" />
                <Select value={textSettings.weight} onValueChange={v => setTextSettings(s => ({ ...s, weight: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border text-sm col-span-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_WEIGHTS.map(weight => (
                      <SelectItem key={weight} value={weight}>{weight}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="color" value={textSettings.color} onChange={e => setTextSettings(s => ({ ...s, color: e.target.value }))} className="h-9 p-1 bg-secondary/50 border-border col-span-1" />
              </div>

              <Button size="sm" className="w-full gap-1" onClick={addText}>
                <Type className="w-3 h-3" /> {t.campaign.editor.addText}
              </Button>
            </div>

            <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Square className="w-4 h-4 text-primary" /> {t.campaign.editor.shapeTool}</h3>
              <div className="flex items-center gap-2">
                <Input type="color" value={shapeColor} onChange={e => setShapeColor(e.target.value)} className="h-9 w-12 p-1 bg-secondary/50 border-border" />
                <span className="text-xs text-muted-foreground">{t.campaign.editor.shapeColor}</span>
              </div>
            </div>

            <div className="glass rounded-xl p-4 border-gold-subtle space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Crosshair className="w-4 h-4 text-primary" /> {t.campaign.editor.placeholderTool}</h3>
              <p className="text-xs text-muted-foreground">{t.campaign.editor.placeholderDesc}</p>
              <Select value={placeholderShape} onValueChange={v => setPlaceholderShape(v as 'circle' | 'square' | 'rounded')}>
                <SelectTrigger className="bg-secondary/50 border-border text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="circle">{t.campaign.editor.circle}</SelectItem>
                  <SelectItem value="square">{t.campaign.editor.square}</SelectItem>
                  <SelectItem value="rounded">{t.campaign.editor.roundedSquare}</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="w-full gap-1 border-primary/30 text-primary" onClick={addPlaceholder} disabled={hasPlaceholder}>
                <Crosshair className="w-3 h-3" /> {hasPlaceholder ? t.campaign.editor.placeholderExists : t.campaign.editor.addPlaceholder}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="rounded-xl border-2 border-border overflow-auto p-3 bg-secondary/20">
            <div className="mx-auto" style={{ width: `${displayW}px`, minWidth: `${Math.min(displayW, 280)}px` }}>
              <canvas ref={canvasRef} />
            </div>
          </div>
        </div>

        {mode === 'edit' && (
          <div className="w-full xl:w-64 shrink-0">
            <div className="glass rounded-xl p-4 border-gold-subtle">
              <h3 className="text-sm font-semibold text-foreground mb-3">{t.campaign.editor.layers}</h3>
              {layers.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t.campaign.editor.noLayers}</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {layers.map(layer => (
                    <div
                      key={layer.id}
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                        selectedId === layer.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-secondary/50'
                      }`}
                      onClick={() => {
                        if (!fabricRef.current) return;
                        const obj = fabricRef.current.getObjects().find((o: any) => o.id === layer.id);
                        if (!obj) return;
                        fabricRef.current.setActiveObject(obj);
                        fabricRef.current.renderAll();
                        setSelectedId(layer.id);
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
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">
        {type === 'frame' ? t.campaign.editor.frameHint : t.campaign.editor.backgroundHint}
        {' '}• {t.campaign.editor.outputSize}: {width}×{height}px
        {mode === 'edit' ? ` • ${t.campaign.editor.shortcuts}` : ''}
      </p>
    </div>
  );
};

export default CanvasEditor;
