/**
 * Compress and resize an image file to WebP format.
 * Returns a new File object with the compressed image.
 *
 * @param file - Original image File
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @param quality - WebP quality (0-1), default 0.8
 */
export async function compressImageToWebP(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality = 0.8
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context failed')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Blob conversion failed')); return; }
          const baseName = file.name.replace(/\.[^.]+$/, '');
          const newFile = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
          resolve(newFile);
        },
        'image/webp',
        quality
      );
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
}

/** Preset sizes for different upload contexts */
export const IMAGE_PRESETS = {
  avatar: { maxWidth: 400, maxHeight: 400, quality: 0.8 },
  blogCover: { maxWidth: 1200, maxHeight: 800, quality: 0.82 },
  campaignBanner: { maxWidth: 1200, maxHeight: 400, quality: 0.85 },
  favicon: { maxWidth: 128, maxHeight: 128, quality: 0.9 },
  logo: { maxWidth: 512, maxHeight: 512, quality: 0.9 },
} as const;
