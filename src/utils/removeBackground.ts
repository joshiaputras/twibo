let preloadPromise: Promise<void> | null = null;

const MODELS = ['medium', 'small'] as const;

async function ensureBackgroundModelReady() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const { preload } = await import('@imgly/background-removal');
      for (const model of MODELS) {
        try {
          await preload({ device: 'cpu', model } as any);
          return;
        } catch {
          // fallback to next model
        }
      }
      throw new Error('Background model preload failed');
    })();
  }
  await preloadPromise;
}

async function removeWithFallback(sourceBlob: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const resultBlob = await removeBackground(sourceBlob, {
        device: 'cpu',
        model,
        output: { format: 'image/png' },
        proxyToWorker: false,
      } as any);

      if (resultBlob && resultBlob.size > 0) {
        return resultBlob;
      }
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
