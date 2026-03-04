import { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, FabricImage, Circle, Rect, FabricText, FabricObject } from 'fabric';
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
  mode?: 'edit' | 'preview';
}

interface LayerItem {
  id: string;
  name: string;
  visible: boolean;
}

const PLACEHOLDER_PREFIX = '__placeholder__';
const LEGACY_PLACEHOLDER_FILL = 'rgba(255,255,255,0.14';
const LEGACY_PLACEHOLDER_STROKE = 'rgba(255,255,255,0.9';

FabricObject.customProperties = Array.from(
  new Set([...(FabricObject.customProperties ?? []), 'id', 'name', 'isPlaceholder'])
);

const normalizeColor = (value: unknown) => String(value ?? '').toLowerCase().replace(/\s+/g, '');
const isPlaceholderId = (id?: string) => !!id && (id === PLACEHOLDER_PREFIX || id.startsWith(`${PLACEHOLDER_PREFIX}-`));
const isLegacyPlaceholder = (obj: any) => {
  const type = String(obj?.type ?? '').toLowerCase();
  const fill = normalizeColor(obj?.fill);
  const stroke = normalizeColor(obj?.stroke);
  return type === 'rect' && fill.startsWith(LEGACY_PLACEHOLDER_FILL) && stroke.startsWith(LEGACY_PLACEHOLDER_STROKE);
};
const isPlaceholderObject = (obj: any) => obj?.isPlaceholder === true || isPlaceholderId(obj?.id) || isLegacyPlaceholder(obj);

const FONTS = [
  'Space Grotesk', 'Playfair Display', 'Montserrat', 'Nunito',
  'Roboto', 'Open Sans', 'Lato', 'Oswald', 'Raleway', 'Georgia', 'Verdana',
];

const FONT_WEIGHTS = ['300', '400', '500', '600', '700', '800'];

const CHECKERBOARD_SIZE = 16;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CanvasEditor = ({
  width,
  height,
  type,
  initialState,
  onStateChange,
  mode = 'edit',
}: CanvasEditorProps) => {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layers, setLayers] = useState<LayerItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [userZoom, setUserZoom] = useState(1);
  const [tool, setTool] = useState<'select' | 'pan'>('select');
  const [textSettings, setTextSettings] = useState({
    text: 'Text',
    font: 'Space Grotesk',
    weight: '700',
    size: 40,
    color: '#ffffff',
  });
  const [shapeColor, setShapeColor] = useState('#ffffff');
  const [shapeRoundness, setShapeRoundness] = useState(0);
  const [placeholderRoundness, setPlaceholderRoundness] = useState(20);
  const [hasPlaceholder, setHasPlaceholder] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState(0);
  const [textStrokeColor, setTextStrokeColor] = useState('#000000');
  const [textStrokeWidth, setTextStrokeWidth] = useState(0);

  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const skipHistory = useRef(false);
  const initialLoadedRef = useRef(false);
  const syncLayersRef = useRef<() => void>(() => {});
  const saveHistoryRef = useRef<() => void>(() => {});

  // Compute display size: fit canvas into available viewport
  const maxW = typeof window !== 'undefined' ? Math.min(window.innerWidth - 40, 800) : 800;
  const maxH = 600;
  const baseScale = Math.min(maxW / width, maxH / height, 1);
  const displayW = Math.round(width * baseScale);
  const displayH = Math.round(height * baseScale);

  const serializeCanvas = useCallback(() => {
    if (!fabricRef.current) return '';
    return JSON.stringify((fabricRef.current as any).toJSON(['id', 'name', 'isPlaceholder', 'selectable', 'evented', 'stroke', 'strokeWidth']));
  }, []);

  const syncLayers = useCallback(() => {
    if (!fabricRef.current) return;
    const objs = fabricRef.current.getObjects();
    const items = objs
      .map((obj: any, i: number) => ({
        id: obj.id || `layer-${i}`,
        name:
          obj.name ||
          (isPlaceholderObject(obj)
            ? t.campaign.editor.placeholder
            : String(obj.type).toLowerCase() === 'image'
              ? t.campaign.editor.imageLayer
              : String(obj.type).toLowerCase() === 'text'
                ? t.campaign.editor.textLayer
                : `${t.campaign.editor.layer} ${i + 1}`),
        visible: obj.visible !== false,
      }));
    setHasPlaceholder(objs.some((obj: any) => isPlaceholderObject(obj)));
    setLayers(items.reverse());
  }, [t.campaign.editor]);

  const saveHistory = useCallback(() => {
    if (skipHistory.current || !fabricRef.current || mode !== 'edit') return;
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

  useEffect(() => { syncLayersRef.current = syncLayers; }, [syncLayers]);
  useEffect(() => { saveHistoryRef.current = saveHistory; }, [saveHistory]);

  // Initialize canvas at DISPLAY size, using Fabric zoom = baseScale
  // so all object coordinates are stored at FULL resolution (width x height).
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new Canvas(canvasRef.current, {
      width: displayW,
      height: displayH,
      backgroundColor: 'transparent',
      selection: mode === 'edit',
      preserveObjectStacking: true,
    });

    // Set zoom so logical coords map to full resolution
    canvas.setZoom(baseScale);

    fabricRef.current = canvas;
    initialLoadedRef.current = false;

    const onModified = () => {
      saveHistoryRef.current();
      syncLayersRef.current();
    };

    canvas.on('object:modified', onModified);
    canvas.on('object:added', onModified);
    canvas.on('object:removed', onModified);
    const syncSelectionState = (selected: any) => {
      setSelectedId(selected?.id ?? null);

      if (String(selected?.type).toLowerCase() === 'rect' || String(selected?.type).toLowerCase() === 'circle') {
        if (isPlaceholderObject(selected)) {
          const size = String(selected?.type).toLowerCase() === 'circle'
            ? Math.max(1, (selected.radius ?? 0) * 2)
            : Math.max(1, Math.min(selected.width ?? 1, selected.height ?? 1));
          const rx = selected.rx ?? selected.radius ?? 0;
          const normalized = clamp((rx / (size / 2)) * 100, 0, 100);
          setPlaceholderRoundness(normalized);
        } else {
          if (typeof selected.fill === 'string' && selected.fill.startsWith('#')) {
            setShapeColor(selected.fill);
          }

          if (String(selected?.type).toLowerCase() === 'rect') {
            const size = Math.max(1, Math.min(selected.width ?? 1, selected.height ?? 1));
            const rx = selected.rx ?? 0;
            const normalized = clamp((rx / (size / 2)) * 100, 0, 100);
            setShapeRoundness(normalized);
          } else {
            setShapeRoundness(100);
          }
        }
      }
    };

    const syncSelectedAngle = (obj: any) => {
      if (obj) setSelectedAngle(Math.round(obj.angle ?? 0));
      if (obj && String(obj.type).toLowerCase() === 'text') {
        setTextStrokeColor(typeof obj.stroke === 'string' && obj.stroke.startsWith('#') ? obj.stroke : '#000000');
        setTextStrokeWidth(Number(obj.strokeWidth ?? 0));
      }
    };

    canvas.on('selection:created', (e: any) => { syncSelectionState(e.selected?.[0]); syncSelectedAngle(e.selected?.[0]); });
    canvas.on('selection:updated', (e: any) => { syncSelectionState(e.selected?.[0]); syncSelectedAngle(e.selected?.[0]); });
    canvas.on('selection:cleared', () => { setSelectedId(null); setSelectedAngle(0); });

    return () => { canvas.dispose(); fabricRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayH, displayW, mode, baseScale]);

  // Load initial state
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || initialLoadedRef.current) return;

    const load = async () => {
      try {
        if (initialState) {
          skipHistory.current = true;
          await canvas.loadFromJSON(JSON.parse(initialState));
          // Restore zoom after load (loadFromJSON may reset it)
          canvas.setZoom(baseScale);
          canvas.renderAll();
          skipHistory.current = false;
        }
      } catch { skipHistory.current = false; }

      const json = serializeCanvas();
      if (json) {
        setHistory([json]);
        setHistoryIdx(0);
        if (mode === 'edit') onStateChange?.(json);
      }

      syncLayers();
      syncLayers();
      initialLoadedRef.current = true;
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialState, mode, baseScale]);

  // Tool mode
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || mode !== 'edit') return;

    if (tool === 'pan') {
      canvas.selection = false;
      canvas.defaultCursor = 'grab';
      canvas.forEachObject((o: any) => { o.selectable = false; o.evented = false; });
    } else {
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.forEachObject((o: any) => {
        o.selectable = true; o.evented = true;
      });
    }
  }, [tool, mode]);

  // Pan handling
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

  const handleUndo = useCallback(() => {
    if (historyIdx <= 0 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx - 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.setZoom(baseScale * userZoom);
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      onStateChange?.(history[newIdx]);
      skipHistory.current = false;
    });
  }, [history, historyIdx, onStateChange, syncLayers, baseScale, userZoom]);

  const handleRedo = useCallback(() => {
    if (historyIdx >= history.length - 1 || !fabricRef.current) return;
    skipHistory.current = true;
    const newIdx = historyIdx + 1;
    fabricRef.current.loadFromJSON(JSON.parse(history[newIdx])).then(() => {
      fabricRef.current?.setZoom(baseScale * userZoom);
      fabricRef.current?.renderAll();
      setHistoryIdx(newIdx);
      syncLayers();
      onStateChange?.(history[newIdx]);
      skipHistory.current = false;
    });
  }, [history, historyIdx, onStateChange, syncLayers, baseScale, userZoom]);

  const handleZoom = useCallback((dir: 'in' | 'out' | 'reset') => {
    if (!fabricRef.current) return;
    let newZoom = userZoom;
    if (dir === 'in') newZoom = Math.min(userZoom * 1.2, 5);
    if (dir === 'out') newZoom = Math.max(userZoom / 1.2, 0.2);
    if (dir === 'reset') newZoom = 1;
    fabricRef.current.setZoom(baseScale * newZoom);
    setUserZoom(newZoom);
  }, [userZoom, baseScale]);

  const handleUpload = useCallback(() => fileInputRef.current?.click(), []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const url = ev.target?.result as string;
      const img = await FabricImage.fromURL(url);
      const canvas = fabricRef.current!;
      // Scale image to fit ~80% of full-res canvas
      const maxScale = Math.min(width * 0.8 / (img.width || 1), height * 0.8 / (img.height || 1));
      const imgScale = Math.min(maxScale, 1);
      (img as any).id = `img-${Date.now()}`;
      (img as any).name = file.name.substring(0, 20);
      // Position at center of full-res coordinates
      img.set({ scaleX: imgScale, scaleY: imgScale, left: width / 2, top: height / 2, originX: 'center', originY: 'center' });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      saveHistory();
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }, [width, height, saveHistory]);

  const addText = useCallback(() => {
    if (!fabricRef.current) return;
    const text = new FabricText(textSettings.text, {
      left: width / 2, top: height / 2, originX: 'center', originY: 'center',
      fontFamily: textSettings.font, fontWeight: textSettings.weight, fontSize: textSettings.size, fill: textSettings.color, editable: true,
    });
    (text as any).id = `text-${Date.now()}`;
    (text as any).name = textSettings.text.substring(0, 15) || t.campaign.editor.textLayer;
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
    saveHistory();
  }, [width, height, saveHistory, t.campaign.editor.textLayer, textSettings]);

  const addShape = useCallback((shape: 'rect' | 'circle') => {
    if (!fabricRef.current) return;
    const size = Math.min(width, height) * 0.2;
    let obj: any;
    if (shape === 'rect') {
      const cornerRadius = (size / 2) * (clamp(shapeRoundness, 0, 100) / 100);
      obj = new Rect({ width: size, height: size, left: width / 2, top: height / 2, originX: 'center', originY: 'center', fill: shapeColor, rx: cornerRadius, ry: cornerRadius });
      obj.name = t.campaign.editor.rectangle;
    } else {
      obj = new Circle({ radius: size / 2, left: width / 2, top: height / 2, originX: 'center', originY: 'center', fill: shapeColor });
      obj.name = t.campaign.editor.circle;
    }
    obj.id = `shape-${Date.now()}`;
    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    saveHistory();
  }, [width, height, saveHistory, shapeColor, shapeRoundness, t.campaign.editor.circle, t.campaign.editor.rectangle]);

  const updateSelectedShapeColor = useCallback((color: string) => {
    setShapeColor(color);

    const active = fabricRef.current?.getActiveObject() as any;
    if (!active || isPlaceholderObject(active)) return;
    const activeType = String(active.type).toLowerCase();
    if (activeType !== 'rect' && activeType !== 'circle') return;

    active.set('fill', color);
    fabricRef.current?.renderAll();
    saveHistory();
  }, [saveHistory]);


  const updateSelectedShapeRoundness = useCallback((roundness: number) => {
    setShapeRoundness(roundness);

    const active = fabricRef.current?.getActiveObject() as any;
    if (!active || isPlaceholderObject(active)) return;
    const activeType = String(active.type).toLowerCase();
    if (activeType !== 'rect') return;

    const w = Math.max(1, active.width ?? 1);
    const h = Math.max(1, active.height ?? 1);
    const minDim = Math.min(w, h);
    const cornerRadius = (minDim / 2) * (clamp(roundness, 0, 100) / 100);
    active.set({ rx: cornerRadius, ry: cornerRadius });
    fabricRef.current?.renderAll();
    saveHistory();
  }, [saveHistory]);

  const addPlaceholder = useCallback(() => {
    if (type === 'background') {
      toast.info(t.campaign.editor.placeholderNotNeeded ?? 'Mode Background tidak membutuhkan placeholder.');
      return;
    }

    if (!fabricRef.current) return;
    if (hasPlaceholder) {
      toast.info(t.campaign.editor.onePlaceholderOnly);
      return;
    }

    const size = Math.min(width, height) * 0.42;

    const obj = new Rect({
      width: size,
      height: size,
      left: width / 2,
      top: height / 2,
      originX: 'center',
      originY: 'center',
      fill: 'rgba(255, 255, 255, 0.14)',
      stroke: 'rgba(255, 255, 255, 0.9)',
      strokeWidth: 2,
      rx: 0,
      ry: 0,
    });

    (obj as any).id = PLACEHOLDER_PREFIX;
    (obj as any).name = t.campaign.editor.placeholder;
    (obj as any).isPlaceholder = true;

    fabricRef.current.add(obj);
    fabricRef.current.setActiveObject(obj);
    fabricRef.current.renderAll();
    setPlaceholderRoundness(0);
    saveHistory();
    syncLayers();
    toast.success(t.campaign.editor.placeholderAdded);
  }, [width, height, type, hasPlaceholder, saveHistory, syncLayers, t.campaign.editor]);

  const updatePlaceholderRoundness = useCallback((roundness: number) => {
    setPlaceholderRoundness(roundness);
    if (!fabricRef.current) return;

    const placeholder = fabricRef.current.getObjects().find((o: any) => isPlaceholderObject(o)) as any;
    if (!placeholder) return;

    const size = Math.max(1, placeholder.width ?? 1);
    const cornerRadius = (size / 2) * (clamp(roundness, 0, 100) / 100);
    placeholder.set({ rx: cornerRadius, ry: cornerRadius });
    fabricRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  const deleteSelected = useCallback(() => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (!active) return;
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

  const updateSelectedAngle = useCallback((angle: number) => {
    setSelectedAngle(angle);
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject() as any;
    if (!active) return;
    active.set('angle', angle);
    fabricRef.current.renderAll();
    saveHistory();
  }, [saveHistory]);

  const updateTextStroke = useCallback((color: string, width: number) => {
    setTextStrokeColor(color);
    setTextStrokeWidth(width);
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject() as any;
    if (!active || String(active.type).toLowerCase() !== 'text') return;
    active.set({ stroke: color, strokeWidth: width });
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

  // Keyboard shortcuts
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
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deleteSelected, handleRedo, handleUndo, mode]);

  // Checkerboard background style
  const checkerboardStyle = {
    backgroundImage: `
      linear-gradient(45deg, hsl(0 0% 20%) 25%, transparent 25%),
      linear-gradient(-45deg, hsl(0 0% 20%) 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, hsl(0 0% 20%) 75%),
      linear-gradient(-45deg, transparent 75%, hsl(0 0% 20%) 75%)
    `,
    backgroundSize: `${CHECKERBOARD_SIZE}px ${CHECKERBOARD_SIZE}px`,
    backgroundPosition: `0 0, 0 ${CHECKERBOARD_SIZE / 2}px, ${CHECKERBOARD_SIZE / 2}px -${CHECKERBOARD_SIZE / 2}px, -${CHECKERBOARD_SIZE / 2}px 0px`,
    backgroundColor: 'hsl(0 0% 15%)',
  };

  return (
    <div className="space-y-3">
      {mode === 'edit' && (
        <>
          {/* Mobile toggle for sidebar */}
          <div className="xl:hidden">
            <Button variant="outline" size="sm" className="border-border w-full" onClick={() => setShowSidebar(!showSidebar)}>
              {showSidebar ? t.campaign.editor.hideTools ?? 'Hide Tools' : t.campaign.editor.showTools ?? 'Show Tools'}
            </Button>
          </div>

          {/* Toolbar */}
          <div className="flex gap-1.5 flex-wrap items-center">
            <Button variant={tool === 'select' ? 'default' : 'outline'} size="sm" className="gap-1 border-border text-xs" onClick={() => setTool('select')}>
              <MousePointer className="w-3 h-3" /> {t.campaign.editor.select}
            </Button>
            <Button variant={tool === 'pan' ? 'default' : 'outline'} size="sm" className="gap-1 border-border text-xs" onClick={() => setTool('pan')}>
              <Move className="w-3 h-3" /> {t.campaign.editor.pan}
            </Button>
            <div className="w-px h-5 bg-border" />
            <Button variant="outline" size="sm" className="border-border gap-1 text-xs" onClick={handleUpload}>
              <Upload className="w-3 h-3" /> {t.campaign.editor.image}
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => addShape('rect')} title={t.campaign.editor.rectangle}>
              <Square className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => addShape('circle')} title={t.campaign.editor.circle}>
              <CircleIcon className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => flipSelected('x')}>
              <FlipHorizontal2 className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => flipSelected('y')}>
              <FlipVertical2 className="w-3 h-3" />
            </Button>
            {selectedId && (
              <div className="flex items-center gap-1">
                <RotateCcw className="w-3 h-3 text-muted-foreground" />
                <Input
                  type="number"
                  value={selectedAngle}
                  onChange={e => updateSelectedAngle(Number(e.target.value) % 360)}
                  className="w-16 h-8 text-xs bg-secondary/50 border-border"
                  min={-360}
                  max={360}
                />
                <span className="text-[10px] text-muted-foreground">°</span>
              </div>
            )}
            <div className="w-px h-5 bg-border" />
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={handleUndo} disabled={historyIdx <= 0}>
              <Undo2 className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={handleRedo} disabled={historyIdx >= history.length - 1}>
              <Redo2 className="w-3 h-3" />
            </Button>
            <div className="w-px h-5 bg-border" />
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => handleZoom('out')}>
              <ZoomOut className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(userZoom * 100)}%</span>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => handleZoom('in')}>
              <ZoomIn className="w-3 h-3" />
            </Button>
            <Button variant="outline" size="icon" className="border-border h-8 w-8" onClick={() => handleZoom('reset')}>
              <RotateCcw className="w-3 h-3" />
            </Button>
            <div className="w-px h-5 bg-border" />
            <Button variant="outline" size="sm" className="border-destructive/30 text-destructive gap-1 text-xs" onClick={deleteSelected}>
              <Trash2 className="w-3 h-3" /> {t.campaign.editor.delete}
            </Button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </>
      )}

      <div className="flex flex-col xl:flex-row gap-4">
        {/* Left sidebar - tools */}
        {mode === 'edit' && (
          <div className={`w-full xl:w-64 space-y-3 shrink-0 ${showSidebar ? 'block' : 'hidden xl:block'}`}>
            {/* Text tool */}
            <div className="glass rounded-xl p-3 border-gold-subtle space-y-2">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Type className="w-3.5 h-3.5 text-primary" /> {t.campaign.editor.textTool}</h3>
              <Input value={textSettings.text} onChange={e => setTextSettings(s => ({ ...s, text: e.target.value }))} placeholder={t.campaign.editor.textPlaceholder} className="bg-secondary/50 border-border text-xs h-8" />
              <Select value={textSettings.font} onValueChange={v => setTextSettings(s => ({ ...s, font: v }))}>
                <SelectTrigger className="bg-secondary/50 border-border text-xs h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTS.map(font => <SelectItem key={font} value={font} style={{ fontFamily: font }}>{font}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="grid grid-cols-3 gap-1.5">
                <Input type="number" value={textSettings.size} onChange={e => setTextSettings(s => ({ ...s, size: Number(e.target.value) || 16 }))} min={8} max={220} className="bg-secondary/50 border-border text-xs h-8" />
                <Select value={textSettings.weight} onValueChange={v => setTextSettings(s => ({ ...s, weight: v }))}>
                  <SelectTrigger className="bg-secondary/50 border-border text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FONT_WEIGHTS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input type="color" value={textSettings.color} onChange={e => setTextSettings(s => ({ ...s, color: e.target.value }))} className="h-8 p-0.5 bg-secondary/50 border-border" />
              </div>
              <Button size="sm" className="w-full gap-1 h-8 text-xs" onClick={addText}>
                <Type className="w-3 h-3" /> {t.campaign.editor.addText}
              </Button>
              {/* Text stroke/border */}
              <div className="border-t border-border/30 pt-2 mt-2 space-y-1.5">
                <label className="text-[10px] text-muted-foreground">Text Border</label>
                <div className="flex items-center gap-2">
                  <Input type="color" value={textStrokeColor} onChange={e => updateTextStroke(e.target.value, textStrokeWidth)} className="h-7 w-9 p-0.5 bg-secondary/50 border-border" />
                  <Input
                    type="number"
                    value={textStrokeWidth}
                    onChange={e => updateTextStroke(textStrokeColor, Math.max(0, Number(e.target.value)))}
                    min={0}
                    max={20}
                    className="w-16 h-7 text-xs bg-secondary/50 border-border"
                  />
                  <span className="text-[10px] text-muted-foreground">px</span>
                </div>
              </div>
            </div>

            {/* Shape tool */}
            <div className="glass rounded-xl p-3 border-gold-subtle space-y-2">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Square className="w-3.5 h-3.5 text-primary" /> {t.campaign.editor.shapeTool}</h3>
              <div className="flex items-center gap-2">
                <Input type="color" value={shapeColor} onChange={e => updateSelectedShapeColor(e.target.value)} className="h-8 w-10 p-0.5 bg-secondary/50 border-border" />
                <span className="text-xs text-muted-foreground">{t.campaign.editor.shapeColor}</span>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Rounded: {Math.round(shapeRoundness)}%</label>
                <Input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={shapeRoundness}
                  onChange={e => updateSelectedShapeRoundness(Number(e.target.value))}
                  className="bg-secondary/50 border-border h-8"
                />
              </div>
            </div>

            {type === 'frame' && (
              <div className="glass rounded-xl p-3 border-gold-subtle space-y-2">
                <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Crosshair className="w-3.5 h-3.5 text-primary" /> {t.campaign.editor.placeholderTool}</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">Placeholder hanya 1; tambahkan dulu lalu atur roundness untuk lihat bentuk real-time.</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-1 border-primary/30 text-primary h-8 text-xs"
                  onClick={addPlaceholder}
                  disabled={hasPlaceholder}
                >
                  <Crosshair className="w-3 h-3" /> {hasPlaceholder ? t.campaign.editor.placeholderExists : t.campaign.editor.addPlaceholder}
                </Button>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Roundness: {Math.round(placeholderRoundness)}%</label>
                  <Input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={placeholderRoundness}
                    onChange={e => updatePlaceholderRoundness(Number(e.target.value))}
                    disabled={!hasPlaceholder}
                    className="bg-secondary/50 border-border h-8"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Canvas area */}
        <div className="flex-1 min-w-0">
          <div
            ref={wrapperRef}
            className="rounded-xl border-2 border-primary/30 overflow-auto p-4 md:p-6"
            style={{ background: 'hsl(240 6% 10%)' }}
          >
            <div
              className="mx-auto rounded-md overflow-hidden shadow-lg shadow-primary/5"
              style={{ width: `${displayW}px`, height: `${displayH}px`, ...checkerboardStyle }}
            >
              <canvas ref={canvasRef} />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            {type === 'frame' ? t.campaign.editor.frameHint : t.campaign.editor.backgroundHint}
            {' '}• {t.campaign.editor.outputSize}: {width}×{height}px
            {mode === 'edit' ? ` • ${t.campaign.editor.shortcuts}` : ''}
          </p>
        </div>

        {/* Right sidebar - layers */}
        {mode === 'edit' && (
          <div className={`w-full xl:w-56 shrink-0 ${showSidebar ? 'block' : 'hidden xl:block'}`}>
            <div className="glass rounded-xl p-3 border-gold-subtle">
              <h3 className="text-xs font-semibold text-foreground mb-2">{t.campaign.editor.layers}</h3>
              {layers.length === 0 ? (
                <p className="text-[10px] text-muted-foreground">{t.campaign.editor.noLayers}</p>
              ) : (
                <div className="space-y-0.5 max-h-72 overflow-y-auto">
                  {layers.map(layer => (
                    <div
                      key={layer.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer transition-colors ${
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
                      <button onClick={e => { e.stopPropagation(); toggleVisibility(layer.id); }} className="shrink-0">
                        {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3 text-muted-foreground/50" />}
                      </button>
                      <span className="truncate flex-1">{layer.name}</span>
                      <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 'up'); }} className="shrink-0 hover:text-foreground"><ChevronUp className="w-3 h-3" /></button>
                      <button onClick={e => { e.stopPropagation(); moveLayer(layer.id, 'down'); }} className="shrink-0 hover:text-foreground"><ChevronDown className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CanvasEditor;
