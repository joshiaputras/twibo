export async function removeBackgroundFromDataUrl(dataUrl: string): Promise<string> {
  const { removeBackground } = await import('@imgly/background-removal');

  const sourceBlob = await (await fetch(dataUrl)).blob();
  const resultBlob = await removeBackground(sourceBlob);

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string) ?? dataUrl);
    reader.onerror = reject;
    reader.readAsDataURL(resultBlob);
  });
}
