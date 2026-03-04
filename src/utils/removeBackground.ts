const STATICIMGLY_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';
const JSDELIVR_PUBLIC_PATH = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal-data@1.7.0/dist/';
const UNPKG_PUBLIC_PATH = 'https://unpkg.com/@imgly/background-removal-data@1.7.0/dist/';

type RemoveConfig = Record<string, unknown>;

type Attempt = {
  key: string;
  config: RemoveConfig;
};

const baseConfig: RemoveConfig = {
  output: { format: 'image/png' },
  device: 'cpu',
};

const PATH_FALLBACKS = [STATICIMGLY_PUBLIC_PATH, JSDELIVR_PUBLIC_PATH, UNPKG_PUBLIC_PATH] as const;

const ATTEMPTS: Attempt[] = [
  { key: 'default-main', config: { ...baseConfig, proxyToWorker: false } },
  { key: 'default-worker', config: { ...baseConfig, proxyToWorker: true } },
  ...PATH_FALLBACKS.flatMap(publicPath => [
    { key: `fp16-${publicPath}-main`, config: { ...baseConfig, model: 'isnet_fp16', proxyToWorker: false, publicPath } },
    { key: `fp16-${publicPath}-worker`, config: { ...baseConfig, model: 'isnet_fp16', proxyToWorker: true, publicPath } },
    { key: `isnet-${publicPath}-main`, config: { ...baseConfig, model: 'isnet', proxyToWorker: false, publicPath } },
    { key: `isnet-${publicPath}-worker`, config: { ...baseConfig, model: 'isnet', proxyToWorker: true, publicPath } },
  ]),
];

let preloadPromise: Promise<void> | null = null;
let preferredAttemptKey: string | null = null;

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

const getOrderedAttempts = () => {
  if (!preferredAttemptKey) return ATTEMPTS;
  const preferred = ATTEMPTS.find(attempt => attempt.key === preferredAttemptKey);
  if (!preferred) return ATTEMPTS;
  return [preferred, ...ATTEMPTS.filter(attempt => attempt.key !== preferredAttemptKey)];
};

async function ensureBackgroundModelReady() {
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    const { preload } = await import('@imgly/background-removal');
    let lastError: unknown = null;

    for (const attempt of getOrderedAttempts()) {
      try {
        await withTimeout(preload(attempt.config as any), 20000);
        preferredAttemptKey = attempt.key;
        return;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError ?? new Error('Unable to preload background removal model');
  })();

  try {
    await preloadPromise;
  } catch (error) {
    preloadPromise = null;
    throw error;
  }
}

export async function warmupBackgroundRemoval(): Promise<void> {
  try {
    await ensureBackgroundModelReady();
  } catch (error) {
    console.warn('Background removal warmup failed, will retry on upload.', error);
  }
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const response = await fetch(dataUrl);
  return await response.blob();
}

async function normalizeInputBlob(sourceBlob: Blob): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(sourceBlob);
    const maxDimension = 1280;
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
  } catch {
    return sourceBlob;
  }
}

async function removeWithFallback(source: Blob | string): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  let lastError: unknown;
  for (const attempt of getOrderedAttempts()) {
    try {
      const resultBlob = await withTimeout(removeBackground(source, attempt.config as any), 35000);
      if (resultBlob && resultBlob.size > 0) {
        preferredAttemptKey = attempt.key;
        return resultBlob;
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('Background removal returned empty image');
}

export async function removeBackgroundFromDataUrl(dataUrl: string): Promise<string> {
  try {
    await ensureBackgroundModelReady();
  } catch {
    // lanjutkan ke removeWithFallback, karena beberapa browser gagal preload tapi sukses saat proses langsung
  }

  const sourceBlob = await dataUrlToBlob(dataUrl);
  const normalizedBlob = await normalizeInputBlob(sourceBlob);

  let resultBlob: Blob;
  try {
    resultBlob = await removeWithFallback(normalizedBlob);
  } catch {
    resultBlob = await removeWithFallback(dataUrl);
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
