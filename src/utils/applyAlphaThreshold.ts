/**
 * Apply alpha threshold post-processing to a transparent PNG data URL.
 * 
 * threshold: 0–100
 *   0   = keep all transparency as-is (no change)
 *   50  = default — moderate cleanup
 *   100 = aggressive — only fully opaque pixels survive
 */
export async function applyAlphaThreshold(
  dataUrl: string,
  threshold: number
): Promise<string> {
  if (threshold <= 0) return dataUrl;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;

  ctx.drawImage(img, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Map threshold 0-100 to alpha cutoff 0-255
  const cutoff = Math.round((threshold / 100) * 255);

  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < cutoff) {
      data[i] = 0;
      data[i - 1] = 0;
      data[i - 2] = 0;
      data[i - 3] = 0;
    } else {
      data[i] = 255;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
