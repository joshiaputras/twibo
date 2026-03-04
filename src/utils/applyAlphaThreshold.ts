/**
 * Apply alpha threshold post-processing to a transparent PNG data URL.
 * 
 * threshold: 0–100
 *   0   = keep all transparency as-is (no change)
 *   50  = default — moderate cleanup
 *   100 = aggressive — only fully opaque pixels survive
 * 
 * feather: 0–20 (pixel radius for edge softening)
 *   0   = no feathering (hard edges)
 *   1-5 = subtle softening
 *   5-20 = smooth, feathered edges
 */
export async function applyAlphaThreshold(
  dataUrl: string,
  threshold: number,
  feather: number = 3
): Promise<string> {
  // threshold 0 and no feather means no processing
  if (threshold <= 0 && feather <= 0) return dataUrl;

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
  const w = canvas.width;
  const h = canvas.height;

  // Map threshold 0-100 to alpha cutoff 0-255
  const cutoff = Math.round((threshold / 100) * 255);

  if (threshold > 0) {
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
  }

  // Apply feathering (Gaussian-like blur on alpha channel edges)
  if (feather > 0) {
    // Extract alpha channel
    const alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      alpha[i] = data[i * 4 + 3] / 255;
    }

    // Find edge pixels (alpha boundary)
    const isEdge = new Uint8Array(w * h);
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const a = alpha[idx];
        if (a > 0 && a < 1) {
          isEdge[idx] = 1;
          continue;
        }
        // Check if this is at the boundary (opaque pixel next to transparent)
        if (a > 0) {
          const neighbors = [
            alpha[idx - 1], alpha[idx + 1],
            alpha[idx - w], alpha[idx + w],
          ];
          if (neighbors.some(n => n === 0)) {
            isEdge[idx] = 1;
          }
        }
      }
    }

    // Blur alpha channel near edges using box blur approximation
    const radius = Math.min(feather, 20);
    const blurredAlpha = new Float32Array(alpha);

    // Two-pass separable box blur (horizontal then vertical)
    const temp = new Float32Array(w * h);
    
    // Horizontal pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        // Only blur near edges
        let nearEdge = false;
        for (let dx = -radius; dx <= radius && !nearEdge; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w && isEdge[y * w + nx]) nearEdge = true;
        }
        if (!nearEdge) {
          temp[idx] = alpha[idx];
          continue;
        }
        
        let sum = 0;
        let count = 0;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx >= 0 && nx < w) {
            sum += alpha[y * w + nx];
            count++;
          }
        }
        temp[idx] = sum / count;
      }
    }

    // Vertical pass
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        let nearEdge = false;
        for (let dy = -radius; dy <= radius && !nearEdge; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < h && isEdge[ny * w + x]) nearEdge = true;
        }
        if (!nearEdge) {
          blurredAlpha[idx] = temp[idx];
          continue;
        }

        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = y + dy;
          if (ny >= 0 && ny < h) {
            sum += temp[ny * w + x];
            count++;
          }
        }
        blurredAlpha[idx] = sum / count;
      }
    }

    // Apply blurred alpha back to image data
    for (let i = 0; i < w * h; i++) {
      const newAlpha = Math.round(blurredAlpha[i] * 255);
      data[i * 4 + 3] = newAlpha;
      // Pre-multiply alpha for transparent pixels
      if (newAlpha === 0) {
        data[i * 4] = 0;
        data[i * 4 + 1] = 0;
        data[i * 4 + 2] = 0;
      }
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}
