import { Canvas as FabricCanvas } from 'fabric';

const PLACEHOLDER_ID = '__placeholder__';

/**
 * Render a campaign design_json to a PNG data URL.
 * The placeholder shape is made transparent (cut out) so supporter photos show through.
 */
export async function renderTemplatePNG(
  designJson: any,
  w: number,
  h: number
): Promise<string> {
  const parsed = typeof designJson === 'string' ? JSON.parse(designJson) : designJson;
  if (!parsed || Object.keys(parsed).length === 0) return '';

  const tmpEl = document.createElement('canvas');
  tmpEl.width = w;
  tmpEl.height = h;

  const fc = new FabricCanvas(tmpEl, {
    width: w,
    height: h,
    backgroundColor: 'transparent',
  });

  await fc.loadFromJSON(parsed);

  // Make placeholder transparent (cut-out hole)
  const placeholder = fc.getObjects().find((o: any) => o.id === PLACEHOLDER_ID);
  if (placeholder) {
    (placeholder as any).set({
      fill: '#000000',
      stroke: 'transparent',
      strokeWidth: 0,
      globalCompositeOperation: 'destination-out',
    });
  }

  fc.renderAll();

  const dataUrl = tmpEl.toDataURL('image/png');
  fc.dispose();
  return dataUrl;
}

/**
 * Load an image as HTMLImageElement via Promise.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Compose a result image: user photo behind template, with optional watermark.
 * Returns a data URL.
 */
export async function composeResult(opts: {
  templateDataUrl: string;
  userPhotoDataUrl?: string;
  fullWidth: number;
  fullHeight: number;
  photoScale: number;
  photoOffsetX: number;
  photoOffsetY: number;
  addWatermark: boolean;
  previewMaxW?: number;
  previewMaxH?: number;
}): Promise<string> {
  const { templateDataUrl, userPhotoDataUrl, fullWidth, fullHeight, photoScale, photoOffsetX, photoOffsetY, addWatermark } = opts;
  const maxW = opts.previewMaxW ?? 500;
  const maxH = opts.previewMaxH ?? 600;

  const previewScale = Math.min(maxW / fullWidth, maxH / fullHeight, 1);
  const pw = Math.round(fullWidth * previewScale);
  const ph = Math.round(fullHeight * previewScale);

  const canvas = document.createElement('canvas');
  canvas.width = pw;
  canvas.height = ph;
  const ctx = canvas.getContext('2d')!;

  // White background
  ctx.fillStyle = '#f0f0f0';
  ctx.fillRect(0, 0, pw, ph);

  // Draw user photo behind if provided
  if (userPhotoDataUrl) {
    const photo = await loadImage(userPhotoDataUrl);
    const s = (photoScale / 100) * previewScale;
    const imgW = photo.width * s;
    const imgH = photo.height * s;
    const ox = (pw / 2) + (photoOffsetX * previewScale) - imgW / 2;
    const oy = (ph / 2) + (photoOffsetY * previewScale) - imgH / 2;
    ctx.drawImage(photo, ox, oy, imgW, imgH);
  }

  // Draw template on top
  const tpl = await loadImage(templateDataUrl);
  ctx.drawImage(tpl, 0, 0, pw, ph);

  // Watermark
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
