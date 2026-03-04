export type CampaignPreviewMeta = {
  photoDataUrl?: string;
  photoScale?: number;
  photoOffsetX?: number;
  photoOffsetY?: number;
  previewImageDataUrl?: string;
};

export type PlaceholderMeta = {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  rx: number;
  ry: number;
  angle: number;
};

const PREVIEW_KEY = '__twiboPreview';
const PLACEHOLDER_PREFIX = '__placeholder__';
const LEGACY_PLACEHOLDER_FILL = 'rgba(255,255,255,0.14';
const LEGACY_PLACEHOLDER_STROKE = 'rgba(255,255,255,0.9';

function parseDesignJson(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {};
}

const normalizeColor = (value: unknown) => String(value ?? '').toLowerCase().replace(/\s+/g, '');

const isPlaceholderObject = (obj: any) => {
  const id = String(obj?.id ?? '');
  const name = String(obj?.name ?? '').toLowerCase();
  const explicitFlag = obj?.isPlaceholder === true;
  const type = String(obj?.type ?? '').toLowerCase();
  const fill = normalizeColor(obj?.fill);
  const stroke = normalizeColor(obj?.stroke);

  if (explicitFlag) return true;
  if (id && (id === PLACEHOLDER_PREFIX || id.startsWith(`${PLACEHOLDER_PREFIX}-`))) return true;
  if (name.includes('placeholder')) return true;

  return type === 'rect' && fill.startsWith(LEGACY_PLACEHOLDER_FILL) && stroke.startsWith(LEGACY_PLACEHOLDER_STROKE);
};

export function extractPreviewMeta(raw: unknown): CampaignPreviewMeta {
  const parsed = parseDesignJson(raw);
  const preview = parsed?.[PREVIEW_KEY] ?? {};

  return {
    photoDataUrl: typeof preview.photoDataUrl === 'string' ? preview.photoDataUrl : '',
    photoScale: typeof preview.photoScale === 'number' ? preview.photoScale : 100,
    photoOffsetX: typeof preview.photoOffsetX === 'number' ? preview.photoOffsetX : 0,
    photoOffsetY: typeof preview.photoOffsetY === 'number' ? preview.photoOffsetY : 0,
    previewImageDataUrl: typeof preview.previewImageDataUrl === 'string' ? preview.previewImageDataUrl : '',
  };
}

export function extractCanvasDesign(raw: unknown): Record<string, any> {
  const parsed = parseDesignJson(raw);
  if (!(PREVIEW_KEY in parsed)) return parsed;

  const { [PREVIEW_KEY]: _preview, ...canvasOnly } = parsed;
  return canvasOnly;
}

export function extractPlaceholderMeta(raw: unknown): PlaceholderMeta | null {
  const canvasDesign = extractCanvasDesign(raw);
  const objects = Array.isArray(canvasDesign?.objects) ? canvasDesign.objects : [];
  const placeholder = objects.find(isPlaceholderObject);
  if (!placeholder) return null;

  const rawLeft = Number(placeholder.left ?? 0);
  const rawTop = Number(placeholder.top ?? 0);
  const width = Number(placeholder.width ?? 0);
  const height = Number(placeholder.height ?? 0);
  const scaleX = Number(placeholder.scaleX ?? 1) || 1;
  const scaleY = Number(placeholder.scaleY ?? 1) || 1;

  // Fabric.js v6 defaults to originX/Y = 'center', so left/top is the center point.
  // Convert to top-left corner for consumers.
  const originX = String(placeholder.originX ?? 'center').toLowerCase();
  const originY = String(placeholder.originY ?? 'center').toLowerCase();
  const w = width * scaleX;
  const h = height * scaleY;

  let left = rawLeft;
  let top = rawTop;
  if (originX === 'center') left = rawLeft - w / 2;
  else if (originX === 'right') left = rawLeft - w;
  if (originY === 'center') top = rawTop - h / 2;
  else if (originY === 'bottom') top = rawTop - h;

  return {
    left,
    top,
    width,
    height,
    scaleX,
    scaleY,
    rx: Number(placeholder.rx ?? 0) || 0,
    ry: Number(placeholder.ry ?? 0) || 0,
    angle: Number(placeholder.angle ?? 0) || 0,
  };
}

export function mergeDesignWithPreview(rawCanvasDesign: unknown, previewMeta: CampaignPreviewMeta): Record<string, any> {
  const canvasDesign = parseDesignJson(rawCanvasDesign);
  return {
    ...canvasDesign,
    [PREVIEW_KEY]: {
      photoDataUrl: previewMeta.photoDataUrl ?? '',
      photoScale: typeof previewMeta.photoScale === 'number' ? previewMeta.photoScale : 100,
      photoOffsetX: typeof previewMeta.photoOffsetX === 'number' ? previewMeta.photoOffsetX : 0,
      photoOffsetY: typeof previewMeta.photoOffsetY === 'number' ? previewMeta.photoOffsetY : 0,
      previewImageDataUrl: previewMeta.previewImageDataUrl ?? '',
    },
  };
}
