const STATICIMGLY_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const JSDELIVR_PUBLIC_PATH = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.7.0/dist/';

type RemoveConfig = Record<string, unknown>;

const baseConfig: RemoveConfig = {
  output: { format: 'image/png' },
  device: 'cpu',
};

const MODELS = ['isnet_quint8', 'isnet_fp16', 'isnet'] as const;
const PUBLIC_PATHS: Array<string | undefined> = [undefined, STATICIMGLY_PUBLIC_PATH, JSDELIVR_PUBLIC_PATH];

const ATTEMPTS: RemoveConfig[] = MODELS.flatMap(model =>
  PUBLIC_PATHS.flatMap(publicPath => [
    { ...baseConfig, model, proxyToWorker: false, ...(publicPath ? { publicPath } : {}) },
    { ...baseConfig, model, proxyToWorker: true, ...(publicPath ? { publicPath } : {}) },
  ])
);

let preloadPromise: Promise<void> | null = null;

const withTimeout = async <T>(promise: Promise<T>, ms: number): Promise<T> => {
  let timeoutId: number | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error('Background removal timeout')), ms);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

async function ensureBackgroundModelReady() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const { preload } = await import('@imgly/background-removal');

    for (const cfg of ATTEMPTS.slice(0, 8)) {
      try {
        await withTimeout(preload(cfg as any), 25000);
        return;
      } catch {
        // Try next config
      }
    }
  })();

  return preloadPromise;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return await response.blob();
}

async function normalizeInputBlob(sourceBlob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(sourceBlob);
  const maxDimension = 1400;
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

async function removeWithFallback(source: Blob | string): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  let lastError: unknown;
  for (const cfg of ATTEMPTS) {
    try {
      const resultBlob = await withTimeout(removeBackground(source, cfg as any), 30000);
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

  let resultBlob: Blob;
  try {
    resultBlob = await removeWithFallback(normalizedBlob);
  } catch {
    // Last fallback: try direct data URL input in case Blob decoding backend fails on specific devices.
    resultBlob = await removeWithFallback(dataUrl);
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
