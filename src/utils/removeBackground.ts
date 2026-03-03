let preloadPromise: Promise<void> | null = null;

async function ensureBackgroundModelReady() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const { preload } = await import('@imgly/background-removal');
      await preload({ device: 'cpu', model: 'medium' } as any);
    })();
  }
  await preloadPromise;
}

export async function removeBackgroundFromDataUrl(dataUrl: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');

  await ensureBackgroundModelReady();

  const sourceBlob = await (await fetch(dataUrl)).blob();
  const resultBlob = await removeBackground(sourceBlob, {
    device: 'cpu',
    model: 'medium',
    output: { format: 'image/png' },
    proxyToWorker: true,
  } as any);

  if (!resultBlob || resultBlob.size === 0) {
    throw new Error('Background removal returned empty image');
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
