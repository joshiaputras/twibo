const DEFAULT_PUBLIC_PATH = 'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

type RemoveConfig = Record<string, unknown>;

const baseConfig: RemoveConfig = {
  device: 'cpu',
  output: { format: 'image/png' },
};

const ATTEMPTS: RemoveConfig[] = [
  { ...baseConfig, proxyToWorker: false },
  { ...baseConfig, proxyToWorker: true },
  { ...baseConfig, proxyToWorker: false, publicPath: DEFAULT_PUBLIC_PATH },
  { ...baseConfig, proxyToWorker: true, publicPath: DEFAULT_PUBLIC_PATH },
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

  const sourceBlob = await (await fetch(dataUrl)).blob();
  const resultBlob = await removeWithFallback(sourceBlob);

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
