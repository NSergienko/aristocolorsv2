/**
 * AristoColors Studio v2 — isolated raster selection extraction.
 *
 * Copies pixels of ONE layer into a PNG whose top-left corresponds to the
 * returned document-space bounds. Does not change the document or Studio canvas.
 *
 * The transform sequence mirrors CanvasEngine.applyTransform(). Note that the
 * current CanvasEngine renderer does not use LayerMask.density; this adapter
 * DOES apply density, so non-default density can differ from current preview.
 * Likewise, callers must supply the post-adjustment image if Copy should
 * include non-destructive color/lighting adjustments.
 */
import type { LayerNode, Transform2D, BoundingBox2D } from '../../types/DocumentModel';

export interface RasterCopyResult {
  blob: Blob;
  bounds: BoundingBox2D;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function sourceDimensions(source: CanvasImageSource): { width: number; height: number } {
  const candidate = source as HTMLImageElement & { videoWidth?: number; videoHeight?: number };
  return {
    width: candidate.naturalWidth || candidate.videoWidth || candidate.width || 0,
    height: candidate.naturalHeight || candidate.videoHeight || candidate.height || 0,
  };
}

function newCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width <= 0 || height <= 0) {
    throw new RangeError('Canvas dimensions must be positive safe integers.');
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  if (canvas.width !== width || canvas.height !== height) {
    throw new RangeError('Requested canvas dimensions are not supported.');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not acquire 2D canvas context.');
  return { canvas, ctx };
}

/** Exact operation order used by CanvasEngine.applyTransform(). */
function applyTransform(ctx: CanvasRenderingContext2D, transform: Transform2D): void {
  const { x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0,
    skewX = 0, skewY = 0, originX = 0, originY = 0 } = transform;
  const values = [x, y, scaleX, scaleY, rotation, skewX, skewY, originX, originY];
  if (!values.every(finite)) throw new RangeError('Layer transform contains non-finite values.');
  ctx.translate(x, y);
  if (originX !== 0 || originY !== 0) ctx.translate(originX, originY);
  if (rotation !== 0) ctx.rotate(rotation * Math.PI / 180);
  if (skewX !== 0 || skewY !== 0) {
    ctx.transform(1, Math.tan(skewY * Math.PI / 180), Math.tan(skewX * Math.PI / 180), 1, 0, 0);
  }
  if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
  if (originX !== 0 || originY !== 0) ctx.translate(-originX, -originY);
}

/**
 * Apply mask alpha to source pixels without replacing source RGB with mask RGB.
 * Normal: effective alpha = 1 - density * (1 - maskAlpha)
 * Inverted: effective alpha = 1 - density * maskAlpha
 * A mask's alpha channel is the opacity signal, as in CanvasEngine's
 * destination-in/destination-out implementation (NOT its grayscale RGB).
 */
function applyMask(
  sourceCtx: CanvasRenderingContext2D,
  maskSource: CanvasImageSource,
  width: number,
  height: number,
  inverted: boolean,
  density: number,
): void {
  if (!finite(density) || density < 0 || density > 1) {
    throw new RangeError('Mask density must be between 0 and 1.');
  }
  if (density === 0) return;
  const { ctx: maskCtx } = newCanvas(width, height);
  maskCtx.drawImage(maskSource, 0, 0, width, height);
  const maskPixels = maskCtx.getImageData(0, 0, width, height).data;
  const sourcePixels = sourceCtx.getImageData(0, 0, width, height);
  const pixels = sourcePixels.data;
  for (let i = 3; i < pixels.length; i += 4) {
    const alpha = maskPixels[i] / 255;
    const multiplier = inverted ? 1 - density * alpha : 1 - density * (1 - alpha);
    pixels[i] = Math.round(pixels[i] * multiplier);
  }
  sourceCtx.putImageData(sourcePixels, 0, 0);
}

export async function copyRasterSelection(
  layer: LayerNode,
  selectionRect: BoundingBox2D,
  imageSource: CanvasImageSource,
  maskSource?: CanvasImageSource,
): Promise<RasterCopyResult> {
  if (layer.type !== 'raster' && layer.type !== 'harmonized_clone') {
    throw new TypeError('Copy requires a raster layer.');
  }
  if (!layer.sourceAssetId) throw new Error('Raster layer has no source asset ID.');
  if (!layer.transform) throw new Error('Raster layer has no transform.');
  if (!finite(layer.opacity) || layer.opacity < 0 || layer.opacity > 1) {
    throw new RangeError('Layer opacity must be between 0 and 1.');
  }
  const { x, y, width: rectWidth, height: rectHeight } = selectionRect;
  if (![x, y, rectWidth, rectHeight].every(finite) || rectWidth <= 0 || rectHeight <= 0) {
    throw new RangeError('Selection bounds must be finite and have positive dimensions.');
  }
  // Outward rounding preserves every intersecting pixel for fractional selections.
  const left = Math.floor(x);
  const top = Math.floor(y);
  const right = Math.ceil(x + rectWidth);
  const bottom = Math.ceil(y + rectHeight);
  const bounds: BoundingBox2D = { x: left, y: top, width: right - left, height: bottom - top };
  const intrinsic = sourceDimensions(imageSource);
  const width = layer.sourceWidth ?? intrinsic.width;
  const height = layer.sourceHeight ?? intrinsic.height;
  const { canvas: sourceCanvas, ctx: sourceCtx } = newCanvas(width, height);
  sourceCtx.drawImage(imageSource, 0, 0, width, height);

  if (layer.mask?.isEnabled) {
    if (!maskSource) throw new Error('Enabled layer mask is missing its source image.');
    applyMask(sourceCtx, maskSource, width, height, !!layer.mask.isInverted, layer.mask.density ?? 1);
  }

  const { canvas: output, ctx } = newCanvas(bounds.width, bounds.height);
  ctx.save();
  try {
    ctx.translate(-bounds.x, -bounds.y);
    applyTransform(ctx, layer.transform);
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  } finally {
    ctx.restore();
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      output.toBlob(result => result ? resolve(result) : reject(new Error('PNG encoding failed.')), 'image/png');
    } catch (error) {
      reject(error);
    }
  });
  return { blob, bounds };
}
