import { StaticCanvas } from 'fabric';
import { extractCanvasDesign, type PlaceholderMeta } from './campaignDesign';

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

const createRoundedRectPath = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radiusX: number,
  radiusY: number
) => {
  const rx = Math.max(0, Math.min(radiusX, width / 2));
  const ry = Math.max(0, Math.min(radiusY, height / 2));

  ctx.beginPath();
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + width - rx, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + ry);
  ctx.lineTo(x + width, y + height - ry);
  ctx.quadraticCurveTo(x + width, y + height, x + width - rx, y + height);
  ctx.lineTo(x + rx, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - ry);
  ctx.lineTo(x, y + ry);
  ctx.quadraticCurveTo(x, y, x + rx, y);
  ctx.closePath();
};

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

  if (campaignType === 'frame') {
    // Keep stacking order from editor: placeholder punches a hole only on layers below it.
    placeholders.forEach((placeholder: any) => {
      placeholder.set({
        visible: true,
        opacity: 1,
        fill: 'rgba(0,0,0,1)',
        stroke: 'rgba(0,0,0,1)',
        strokeWidth: 0,
        globalCompositeOperation: 'destination-out',
      });
    });
  } else {
    // Background mode does not need a hole.
    placeholders.forEach((placeholder: any) => {
      placeholder.set({
        visible: false,
        stroke: 'transparent',
        strokeWidth: 0,
        fill: 'transparent',
        opacity: 0,
        globalCompositeOperation: 'source-over',
      });
    });
  }

  fc.renderAll();

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
  placeholderMeta?: PlaceholderMeta | null;
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
    placeholderMeta = null,
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

  const drawBlurFill = async () => {
    if (!userPhotoDataUrl || campaignType !== 'frame') return;
    const photo = await loadImage(userPhotoDataUrl);

    const coverScale = Math.max(pw / photo.width, ph / photo.height) * 1.08;
    const blurW = photo.width * coverScale;
    const blurH = photo.height * coverScale;
    const blurX = (pw - blurW) / 2;
    const blurY = (ph - blurH) / 2;

    ctx.save();
    if (placeholderMeta) {
      const bleed = 2;
      const left = placeholderMeta.left * previewScale - bleed;
      const top = placeholderMeta.top * previewScale - bleed;
      const clipW = placeholderMeta.width * placeholderMeta.scaleX * previewScale + bleed * 2;
      const clipH = placeholderMeta.height * placeholderMeta.scaleY * previewScale + bleed * 2;
      const radiusX = placeholderMeta.rx * placeholderMeta.scaleX * previewScale;
      const radiusY = placeholderMeta.ry * placeholderMeta.scaleY * previewScale;
      createRoundedRectPath(ctx, left, top, clipW, clipH, radiusX, radiusY);
      ctx.clip();
    }
    ctx.filter = `blur(${Math.max(16, Math.round(24 * previewScale))}px)`;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(photo, blurX, blurY, blurW, blurH);
    ctx.restore();
  };

  const drawPhoto = async () => {
    if (!userPhotoDataUrl) return;
    const photo = await loadImage(userPhotoDataUrl);
    const s = Math.max(0.05, photoScale / 100) * previewScale;
    const imgW = photo.width * s;
    const imgH = photo.height * s;
    const ox = pw / 2 + photoOffsetX * previewScale - imgW / 2;
    const oy = ph / 2 + photoOffsetY * previewScale - imgH / 2;

    if (campaignType === 'frame' && placeholderMeta) {
      const bleed = 2;
      const left = placeholderMeta.left * previewScale - bleed;
      const top = placeholderMeta.top * previewScale - bleed;
      const clipW = placeholderMeta.width * placeholderMeta.scaleX * previewScale + bleed * 2;
      const clipH = placeholderMeta.height * placeholderMeta.scaleY * previewScale + bleed * 2;
      const radiusX = placeholderMeta.rx * placeholderMeta.scaleX * previewScale;
      const radiusY = placeholderMeta.ry * placeholderMeta.scaleY * previewScale;

      ctx.save();
      createRoundedRectPath(ctx, left, top, clipW, clipH, radiusX, radiusY);
      ctx.clip();
      ctx.drawImage(photo, ox, oy, imgW, imgH);
      ctx.restore();
      return;
    }

    ctx.drawImage(photo, ox, oy, imgW, imgH);
  };

  const tpl = await loadImage(templateDataUrl);

  if (campaignType === 'background') {
    ctx.drawImage(tpl, 0, 0, pw, ph);
    await drawPhoto();
  } else {
    await drawBlurFill();
    await drawPhoto();
    ctx.drawImage(tpl, 0, 0, pw, ph);
  }

  if (addWatermark) {
    const label = 'Made with TWIBO.id';
    const fontSize = Math.max(10, Math.round(pw * 0.028));
    const padX = Math.max(10, Math.round(fontSize * 0.9));
    const padY = Math.max(6, Math.round(fontSize * 0.45));
    const margin = Math.max(10, Math.round(pw * 0.03));

    ctx.save();
    ctx.font = `700 ${fontSize}px "Space Grotesk", "Segoe UI", sans-serif`;
    const textWidth = ctx.measureText(label).width;
    const badgeW = textWidth + padX * 2;
    const badgeH = fontSize + padY * 2;
    const x = pw - margin - badgeW;
    const y = ph - margin - badgeH;
    const radius = badgeH / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
      (ctx as any).roundRect(x, y, badgeW, badgeH, radius);
    } else {
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + badgeW - radius, y);
      ctx.quadraticCurveTo(x + badgeW, y, x + badgeW, y + radius);
      ctx.lineTo(x + badgeW, y + badgeH - radius);
      ctx.quadraticCurveTo(x + badgeW, y + badgeH, x + badgeW - radius, y + badgeH);
      ctx.lineTo(x + radius, y + badgeH);
      ctx.quadraticCurveTo(x, y + badgeH, x, y + badgeH - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
    }
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'hsl(46 95% 48%)';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + padX, y + badgeH / 2);
    ctx.restore();
  }

  return canvas.toDataURL('image/png');
}
