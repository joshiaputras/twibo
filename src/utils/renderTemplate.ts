import { StaticCanvas } from 'fabric';
import { extractCanvasDesign } from './campaignDesign';

const PLACEHOLDER_PREFIX = '__placeholder__';
const LEGACY_PLACEHOLDER_FILL = 'rgba(255,255,255,0.14';
const LEGACY_PLACEHOLDER_STROKE = 'rgba(255,255,255,0.9';

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

  // Backward compatibility for older saved designs that lost custom props
  return type === 'rect' && fill.startsWith(LEGACY_PLACEHOLDER_FILL) && stroke.startsWith(LEGACY_PLACEHOLDER_STROKE);
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/**
 * Render campaign design_json to PNG data URL.
 * For frame mode, placeholder is cut out (transparent hole).
 */
export async function renderTemplatePNG(
  designJson: any,
  w: number,
  h: number,
  campaignType: 'frame' | 'background' = 'frame'
): Promise<string> {
  const parsed = extractCanvasDesign(designJson);
  if (!parsed || Object.keys(parsed).length === 0) return '';

  const tmpEl = document.createElement('canvas');
  tmpEl.width = w;
  tmpEl.height = h;

  const fc = new StaticCanvas(tmpEl, {
    width: w,
    height: h,
    backgroundColor: 'transparent',
  });

  await fc.loadFromJSON(parsed);

  const placeholders = fc.getObjects().filter((o: any) => isPlaceholderObject(o));

  placeholders.forEach((placeholder: any) => {
    placeholder.set({
      visible: false,
      stroke: 'transparent',
      strokeWidth: 0,
      fill: 'transparent',
      opacity: 0,
    });
  });

  fc.renderAll();

  if (campaignType === 'frame' && placeholders.length > 0) {
    const ctx = tmpEl.getContext('2d');
    if (ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';

      placeholders.forEach((placeholder: any) => {
        const center = placeholder.getCenterPoint();
        const angle = ((placeholder.angle ?? 0) * Math.PI) / 180;

        const scaledW = Math.max(1, placeholder.getScaledWidth?.() ?? placeholder.width ?? 1);
        const scaledH = Math.max(1, placeholder.getScaledHeight?.() ?? placeholder.height ?? 1);

        ctx.save();
        ctx.translate(center.x, center.y);
        ctx.rotate(angle);
        ctx.beginPath();

        const radiusX = Math.min((placeholder.rx ?? 0) * (placeholder.scaleX ?? 1), scaledW / 2);
        const radiusY = Math.min((placeholder.ry ?? 0) * (placeholder.scaleY ?? 1), scaledH / 2);
        const radius = Math.max(0, Math.min(radiusX, radiusY));

        if (radius <= 0) {
          ctx.rect(-scaledW / 2, -scaledH / 2, scaledW, scaledH);
        } else if (typeof (ctx as any).roundRect === 'function') {
          (ctx as any).roundRect(-scaledW / 2, -scaledH / 2, scaledW, scaledH, radius);
        } else {
          const x = -scaledW / 2;
          const y = -scaledH / 2;
          const r = Math.min(radius, scaledW / 2, scaledH / 2);
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + scaledW - r, y);
          ctx.quadraticCurveTo(x + scaledW, y, x + scaledW, y + r);
          ctx.lineTo(x + scaledW, y + scaledH - r);
          ctx.quadraticCurveTo(x + scaledW, y + scaledH, x + scaledW - r, y + scaledH);
          ctx.lineTo(x + r, y + scaledH);
          ctx.quadraticCurveTo(x, y + scaledH, x, y + scaledH - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });

      ctx.restore();
    }
  }

  const dataUrl = tmpEl.toDataURL('image/png');
  fc.dispose();
  return dataUrl;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) return Promise.reject(new Error('Image source is empty'));

  const cached = imageCache.get(src);
  if (cached) return cached;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = (err) => {
      imageCache.delete(src);
      reject(err);
    };
    img.src = src;
  });

  imageCache.set(src, promise);
  return promise;
}

export async function composeResult(opts: {
  templateDataUrl: string;
  userPhotoDataUrl?: string;
  fullWidth: number;
  fullHeight: number;
  photoScale: number;
  photoOffsetX: number;
  photoOffsetY: number;
  addWatermark: boolean;
  campaignType?: 'frame' | 'background';
  previewMaxW?: number;
  previewMaxH?: number;
}): Promise<string> {
  const {
    templateDataUrl,
    userPhotoDataUrl,
    fullWidth,
    fullHeight,
    photoScale,
    photoOffsetX,
    photoOffsetY,
    addWatermark,
    campaignType = 'frame',
  } = opts;

  const maxW = opts.previewMaxW ?? 500;
  const maxH = opts.previewMaxH ?? 600;

  const previewScale = Math.min(maxW / fullWidth, maxH / fullHeight, 1);
  const pw = Math.round(fullWidth * previewScale);
  const ph = Math.round(fullHeight * previewScale);

  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Cannot get canvas context');

  ctx.clearRect(0, 0, pw, ph);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const drawPhoto = async () => {
    if (!userPhotoDataUrl) return;
    const photo = await loadImage(userPhotoDataUrl);
    const s = Math.max(0.05, photoScale / 100) * previewScale;
    const imgW = photo.width * s;
    const imgH = photo.height * s;
    const ox = pw / 2 + photoOffsetX * previewScale - imgW / 2;
    const oy = ph / 2 + photoOffsetY * previewScale - imgH / 2;
    ctx.drawImage(photo, ox, oy, imgW, imgH);
  };

  const tpl = await loadImage(templateDataUrl);

  if (campaignType === 'background') {
    ctx.drawImage(tpl, 0, 0, pw, ph);
    await drawPhoto();
  } else {
    await drawPhoto();
    ctx.drawImage(tpl, 0, 0, pw, ph);
  }

  if (addWatermark) {
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

  return canvas.toDataURL('image/png');
}
