const STATICIMGLY_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const JSDELIVR_PUBLIC_PATH = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.7.0/dist/';

type RemoveConfig = Record<string, unknown>;

const baseConfig: RemoveConfig = {
  device: 'cpu',
  output: { format: 'image/png' },
};

const ATTEMPTS: RemoveConfig[] = [
  { ...baseConfig, proxyToWorker: false },
  { ...baseConfig, proxyToWorker: true },
  { ...baseConfig, proxyToWorker: false, publicPath: STATICIMGLY_PUBLIC_PATH },
  { ...baseConfig, proxyToWorker: true, publicPath: STATICIMGLY_PUBLIC_PATH },
  { ...baseConfig, proxyToWorker: false, publicPath: JSDELIVR_PUBLIC_PATH },
  { ...baseConfig, proxyToWorker: true, publicPath: JSDELIVR_PUBLIC_PATH },
];

let preloadPromise: Promise<void> | null = null;

async function ensureBackgroundModelReady() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const { preload } = await import('@imgly/background-removal');

    for (const cfg of ATTEMPTS) {
      try {
        await preload(cfg as any);
        return;
      } catch {
        // Try next config
      }
    }

    // Keep going: removeBackground below still has additional retries.
  })();

  return preloadPromise;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return await response.blob();
}

async function normalizeInputBlob(sourceBlob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(sourceBlob);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

  const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
  const targetHeight = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return sourceBlob;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const normalizedBlob = await new Promise<Blob | null>(resolve => {
    canvas.toBlob(blob => resolve(blob), 'image/png');
  });

  return normalizedBlob ?? sourceBlob;
}

async function removeWithFallback(sourceBlob: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  let lastError: unknown;
  for (const cfg of ATTEMPTS) {
    try {
      const resultBlob = await removeBackground(sourceBlob, cfg as any);
      if (resultBlob && resultBlob.size > 0) return resultBlob;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('Background removal returned empty image');
}

export async function removeBackgroundFromDataUrl(dataUrl: string): Promise<string> {
  await ensureBackgroundModelReady();

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const normalizedBlob = await normalizeInputBlob(sourceBlob);
  const resultBlob = await removeWithFallback(normalizedBlob);

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
