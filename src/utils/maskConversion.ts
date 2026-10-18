/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Universal Mask Conversion Adapter for AristoColors Studio & react-canvas-masker.
 *
 * Polarity specification:
 * - In react-canvas-masker:
 *     Background = #ffffff (White, unmasked)
 *     Brush paint (maskColor = #000000) = Black (Masked area)
 * - In CanvasEngine (globalCompositeOperation = 'destination-in'):
 *     Alpha 255 = Fully visible (White/reveal)
 *     Alpha 0 = Fully transparent/concealed (Black/mask)
 *     Alpha A = Proportional visibility (Grayscale luminance)
 *
 * This adapter guarantees 100% mathematical reversibility for repeated
 * Edit -> Apply -> Reopen -> Edit cycles with zero data loss.
 */

/**
 * Converts a 1-bit or grayscale B/W canvas from react-canvas-masker into
 * an 8-bit alpha channel canvas suitable for CanvasEngine's destination-in compositing.
 */
export function bwCanvasToAlphaCanvas(bwCanvas: HTMLCanvasElement): HTMLCanvasElement {
  const width = Math.max(1, bwCanvas.width);
  const height = Math.max(1, bwCanvas.height);

  const alphaCanvas = document.createElement('canvas');
  alphaCanvas.width = width;
  alphaCanvas.height = height;

  const srcCtx = bwCanvas.getContext('2d');
  const destCtx = alphaCanvas.getContext('2d');

  if (!srcCtx || !destCtx) {
    return alphaCanvas;
  }

  const srcImgData = srcCtx.getImageData(0, 0, width, height);
  const destImgData = destCtx.createImageData(width, height);

  const srcData = srcImgData.data;
  const destData = destImgData.data;
  const len = srcData.length;

  for (let i = 0; i < len; i += 4) {
    const r = srcData[i];
    const g = srcData[i + 1];
    const b = srcData[i + 2];

    // Standard grayscale luminance:
    // Black (0, 0, 0) -> lum 0 (Alpha 0 = fully hidden)
    // White (255, 255, 255) -> lum 255 (Alpha 255 = fully visible)
    const lum = Math.round((r + g + b) / 3);

    destData[i] = 255;
    destData[i + 1] = 255;
    destData[i + 2] = 255;
    destData[i + 3] = lum;
  }

  destCtx.putImageData(destImgData, 0, 0);
  return alphaCanvas;
}

/**
 * Converts an existing alpha-channel mask Blob or ImageBitmap back into an opaque
 * black-and-white data URL required by react-canvas-masker's initialMask prop.
 *
 * Conversion rule:
 * Alpha 0 (hidden) -> (0, 0, 0, 255) [Pure Black]
 * Alpha 255 (visible) -> (255, 255, 255, 255) [Pure White]
 */
export async function alphaBlobToBwDataUrl(
  alphaBlob: Blob,
  width: number,
  height: number
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return createDefaultWhiteMaskDataUrl(width, height);
  }

  const url = URL.createObjectURL(alphaBlob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load alpha blob for B/W conversion'));
      img.src = url;
    });

    // Draw alpha mask onto temporary offscreen canvas
    ctx.drawImage(img, 0, 0, width, height);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const alpha = data[i + 3];
      // Map alpha directly to grayscale RGB
      data[i] = alpha;
      data[i + 1] = alpha;
      data[i + 2] = alpha;
      data[i + 3] = 255; // Keep B/W image completely opaque for react-canvas-masker
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Creates a pristine, fully unmasked white canvas base64 PNG data URL.
 */
export function createDefaultWhiteMaskDataUrl(width: number, height: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return canvas.toDataURL('image/png');
}
