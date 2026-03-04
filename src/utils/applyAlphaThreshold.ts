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
 * 
 * Uses multi-pass Gaussian-approximated blur for professional smooth edges.
 */
export async function applyAlphaThreshold(
  dataUrl: string,
  threshold: number,
  feather: number = 3
): Promise<string> {
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

  // Apply feathering using multi-pass Gaussian-approximated blur on alpha edges
  if (feather > 0) {
    const radius = Math.min(feather, 20);

    // Extract alpha channel
    const alpha = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      alpha[i] = data[i * 4 + 3] / 255;
    }

    // Find edge zone: pixels within `radius` distance of an alpha boundary
    const edgeDistance = new Float32Array(w * h);
    edgeDistance.fill(radius + 1);

    // BFS from boundary pixels to mark edge zones
    const queue: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const a = alpha[idx];
        let isBoundary = false;

        if (a > 0) {
          // Check 4-neighbors for transparency
          if (x > 0 && alpha[idx - 1] === 0) isBoundary = true;
          else if (x < w - 1 && alpha[idx + 1] === 0) isBoundary = true;
          else if (y > 0 && alpha[idx - w] === 0) isBoundary = true;
          else if (y < h - 1 && alpha[idx + w] === 0) isBoundary = true;
        } else {
          if (x > 0 && alpha[idx - 1] > 0) isBoundary = true;
          else if (x < w - 1 && alpha[idx + 1] > 0) isBoundary = true;
          else if (y > 0 && alpha[idx - w] > 0) isBoundary = true;
          else if (y < h - 1 && alpha[idx + w] > 0) isBoundary = true;
        }

        if (isBoundary) {
          edgeDistance[idx] = 0;
          queue.push(idx);
        }
      }
    }

    // BFS expand edge zone
    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      const dist = edgeDistance[idx];
      if (dist >= radius) continue;

      const x = idx % w;
      const y = (idx - x) / w;
      const nd = dist + 1;

      const neighbors = [
        y > 0 ? idx - w : -1,
        y < h - 1 ? idx + w : -1,
        x > 0 ? idx - 1 : -1,
        x < w - 1 ? idx + 1 : -1,
      ];

      for (const ni of neighbors) {
        if (ni >= 0 && edgeDistance[ni] > nd) {
          edgeDistance[ni] = nd;
          queue.push(ni);
        }
      }
    }

    // 3-pass box blur (approximates Gaussian) only in edge zone
    // Each pass uses radius/3 for a tighter, smoother Gaussian approximation
    const passes = 3;
    const passRadius = Math.max(1, Math.round(radius / passes));

    let src = new Float32Array(alpha);
    let dst = new Float32Array(w * h);

    for (let pass = 0; pass < passes; pass++) {
      const temp = new Float32Array(w * h);

      // Horizontal pass
      for (let y = 0; y < h; y++) {
        // Sliding window sum for efficiency
        let sum = 0;
        let count = 0;

        // Initialize window
        for (let x = 0; x <= passRadius && x < w; x++) {
          sum += src[y * w + x];
          count++;
        }

        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          if (edgeDistance[idx] <= radius) {
            temp[idx] = sum / count;
          } else {
            temp[idx] = src[idx];
          }

          // Slide window right
          const addX = x + passRadius + 1;
          const removeX = x - passRadius;
          if (addX < w) { sum += src[y * w + addX]; count++; }
          if (removeX >= 0) { sum -= src[y * w + removeX]; count--; }
        }
      }

      // Vertical pass
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let count = 0;

        for (let y = 0; y <= passRadius && y < h; y++) {
          sum += temp[y * w + x];
          count++;
        }

        for (let y = 0; y < h; y++) {
          const idx = y * w + x;
          if (edgeDistance[idx] <= radius) {
            dst[idx] = sum / count;
          } else {
            dst[idx] = temp[idx];
          }

          const addY = y + passRadius + 1;
          const removeY = y - passRadius;
          if (addY < h) { sum += temp[addY * w + x]; count++; }
          if (removeY >= 0) { sum -= temp[removeY * w + x]; count--; }
        }
      }

      // Swap for next pass
      src = dst;
      dst = new Float32Array(w * h);
    }

    // Apply blurred alpha back to image data
    for (let i = 0; i < w * h; i++) {
      const newAlpha = Math.round(src[i] * 255);
      data[i * 4 + 3] = newAlpha;
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
