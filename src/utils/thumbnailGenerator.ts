/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ProjectDocument, Transform2D } from '../types/DocumentModel.ts';
import { loadBinaryAsset } from '../services/DocumentPersistence.ts';
import { CANVAS_BLEND_MODE_MAP } from '../engine/CanvasEngine.ts';

// ============================================================================
// 1. In-Memory Session Cache for Composite Thumbnails
// ============================================================================
// Prevents thumbnail flickering, empty states, or fallback reversion during navigation
const memoryThumbnailCache = new Map<string, string>();

export function getCachedThumbnail(projectId: string): string | undefined {
  return memoryThumbnailCache.get(projectId);
}

export function setCachedThumbnail(projectId: string, url: string): void {
  if (projectId && url) {
    memoryThumbnailCache.set(projectId, url);
  }
}

export function clearCachedThumbnail(projectId: string): void {
  memoryThumbnailCache.delete(projectId);
}

// ============================================================================
// 2. Data URL <-> Blob Utilities
// ============================================================================

/**
 * Converts a base64 data URL into a native Blob instance for IndexedDB binary storage.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const binaryString = atob(parts[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

// ============================================================================
// 3. Document Content Bounds Utility
// ============================================================================

export function computeDocumentContentBounds(doc: ProjectDocument): {
  minX: number;
  minY: number;
  width: number;
  height: number;
  hasLayers: boolean;
} {
  const rootLayerIds = doc.rootLayerIds || [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasLayers = false;

  for (const layerId of rootLayerIds) {
    const layer = doc.layers?.[layerId];
    if (!layer || !layer.visible) continue;

    const t = layer.transform || { x: 0, y: 0, scaleX: 1, scaleY: 1 };
    const lx = t.x ?? 0;
    const ly = t.y ?? 0;
    const sx = Math.abs(t.scaleX ?? 1);
    const sy = Math.abs(t.scaleY ?? 1);

    const assetMeta = layer.sourceAssetId && doc.assets ? doc.assets[layer.sourceAssetId] : undefined;
    const lw = (layer.sourceWidth ?? assetMeta?.width ?? doc.width) * sx;
    const lh = (layer.sourceHeight ?? assetMeta?.height ?? doc.height) * sy;

    if (lw > 0 && lh > 0) {
      minX = Math.min(minX, lx);
      minY = Math.min(minY, ly);
      maxX = Math.max(maxX, lx + lw);
      maxY = Math.max(maxY, ly + lh);
      hasLayers = true;
    }
  }

  if (!hasLayers || !Number.isFinite(minX) || maxX <= minX || maxY <= minY) {
    return {
      minX: 0,
      minY: 0,
      width: doc.width || 1920,
      height: doc.height || 1080,
      hasLayers: false,
    };
  }

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
    hasLayers: true,
  };
}

// ============================================================================
// 4. Composite Thumbnail Generation From Rendered Canvas Element
// ============================================================================

/**
 * Generates an aspect-ratio preserving composite thumbnail data URL directly
 * from an active HTMLCanvasElement that contains the rendered composition.
 *
 * Guarantees:
 * 1. Captures 100% of the visible stage (all layers, transforms, scaling, opacities, and blend modes).
 * 2. Works reliably across all device pixel ratios (Retina/high-DPI) without clipping layers.
 * 3. Never cuts off centered or offset cutouts (e.g. transparent tree over landscape).
 * 4. Fills the card aspect ratio (16:10) cleanly with dark backdrop letterboxing where needed.
 */
export function generateCompositeThumbnailFromCanvas(
  canvas: HTMLCanvasElement,
  maxDimension = 640
): string {
  try {
    if (!canvas || canvas.width <= 0 || canvas.height <= 0) return '';

    // Standard card aspect ratio: 16/10 (matching Projects Hub cards)
    const thumbWidth = maxDimension;
    const thumbHeight = Math.round(maxDimension * (10 / 16));

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const ctx = thumbCanvas.getContext('2d');
    if (!ctx) {
      return canvas.toDataURL('image/jpeg', 0.90);
    }

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Neutral dark stage base matching Aristo dark studio aesthetic
    ctx.fillStyle = '#131724';
    ctx.fillRect(0, 0, thumbWidth, thumbHeight);

    // Compute aspect-ratio preserving fit into the 16:10 frame
    const canvasAspect = canvas.width / canvas.height;
    const thumbAspect = thumbWidth / thumbHeight;

    let destW = thumbWidth;
    let destH = thumbHeight;
    let destX = 0;
    let destY = 0;

    if (canvasAspect > thumbAspect) {
      // Canvas is wider than 16:10 (e.g. 16:9 or 21:9) -> fit width, center vertically
      destH = Math.round(thumbWidth / canvasAspect);
      destY = Math.round((thumbHeight - destH) / 2);
    } else {
      // Canvas is taller than 16:10 -> fit height, center horizontally
      destW = Math.round(thumbHeight * canvasAspect);
      destX = Math.round((thumbWidth - destW) / 2);
    }

    // Draw full canvas composition into thumbCanvas
    ctx.drawImage(canvas, 0, 0, canvas.width, canvas.height, destX, destY, destW, destH);

    return thumbCanvas.toDataURL('image/jpeg', 0.90);
  } catch (err) {
    console.error('[ThumbnailGenerator] Failed to generate thumbnail from canvas:', err);
    try {
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return '';
    }
  }
}

// ============================================================================
// 5. Offscreen Composite Thumbnail Generation From ProjectDocument
// ============================================================================

/**
 * Renders an offscreen composite thumbnail from a ProjectDocument by loading
 * the binary asset blobs for all visible layers and compositing them in order.
 *
 * Guarantees:
 * 1. Traverses all visible layers from bottom to top.
 * 2. Applies layer transforms, opacity, and blend modes identically to CanvasEngine.
 * 3. Frames the entire document coordinate space into the 16:10 thumbnail cleanly.
 * 4. Resolves binary assets from IndexedDB, doc.assets, and localStorage catalogs.
 */
export async function generateCompositeThumbnailFromDocument(
  doc: ProjectDocument,
  maxDimension = 640
): Promise<string> {
  try {
    if (!doc || !doc.width || !doc.height) return '';

    const rootLayerIds = doc.rootLayerIds || [];
    if (rootLayerIds.length === 0) {
      return '';
    }

    // Target thumbnail canvas dimensions (16:10 aspect ratio matching project cards)
    const thumbWidth = maxDimension;
    const thumbHeight = Math.round(maxDimension * (10 / 16));

    const offscreen = document.createElement('canvas');
    offscreen.width = thumbWidth;
    offscreen.height = thumbHeight;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return '';

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Fill neutral dark theme background
    ctx.fillStyle = '#131724';
    ctx.fillRect(0, 0, thumbWidth, thumbHeight);

    // Frame the complete document canvas into the thumbnail card
    const docW = doc.width;
    const docH = doc.height;
    const docAspect = docW / docH;
    const thumbAspect = thumbWidth / thumbHeight;

    let drawW = thumbWidth;
    let drawH = thumbHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (docAspect > thumbAspect) {
      // Document is wider than 16:10 -> fit width, center vertically
      drawH = Math.round(thumbWidth / docAspect);
      offsetY = Math.round((thumbHeight - drawH) / 2);
    } else {
      // Document is taller -> fit height, center horizontally
      drawW = Math.round(thumbHeight * docAspect);
      offsetX = Math.round((thumbWidth - drawW) / 2);
    }

    const scale = drawW / docW;

    // Coordinate space maps document pixels (0..docW, 0..docH) directly into framed area
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    let renderedLayerCount = 0;
    const createdBlobUrls: string[] = [];

    // Render each root layer in bottom-to-top order
    for (const layerId of rootLayerIds) {
      const layer = doc.layers?.[layerId];
      if (!layer || !layer.visible) continue;

      const layerOpacity = typeof layer.opacity === 'number' ? Math.max(0, Math.min(1, layer.opacity)) : 1;
      if (layerOpacity <= 0) continue;

      if (!layer.sourceAssetId) continue;
      const assetMeta = doc.assets?.[layer.sourceAssetId];
      const storageKey = assetMeta?.storageKey || layer.sourceAssetId;

      let imageSource: CanvasImageSource | null = null;

      // 1. Try loading binary Blob from IndexedDB project_assets store
      try {
        let blob = await loadBinaryAsset(storageKey);
        if (!blob && storageKey !== layer.sourceAssetId) {
          blob = await loadBinaryAsset(layer.sourceAssetId);
        }

        if (blob) {
          try {
            if (typeof createImageBitmap === 'function') {
              imageSource = await createImageBitmap(blob);
            }
          } catch {
            // Fallback for formats not supported by createImageBitmap
          }

          if (!imageSource) {
            const url = URL.createObjectURL(blob);
            createdBlobUrls.push(url);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = reject;
              img.src = url;
            });
            imageSource = img;
          }
        }
      } catch (assetErr) {
        console.warn(`[ThumbnailGenerator] Could not load binary asset "${storageKey}":`, assetErr);
      }

      // 2. Fallback: check Assets Library catalog in localStorage
      if (!imageSource) {
        try {
          const storedAssets = localStorage.getItem('aristo_assets_v2');
          if (storedAssets) {
            const parsed = JSON.parse(storedAssets);
            const found = parsed.find(
              (a: any) => a.id === layer.sourceAssetId || a.id === storageKey
            );
            if (found && found.url) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = reject;
                img.src = found.url;
              });
              imageSource = img;
            }
          }
        } catch {}
      }

      if (!imageSource) continue;

      ctx.save();

      ctx.globalAlpha = layerOpacity;

      const blendMode = layer.blendMode || 'normal';
      ctx.globalCompositeOperation = CANVAS_BLEND_MODE_MAP[blendMode] || 'source-over';

      const t: Transform2D = layer.transform || {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        originX: 0,
        originY: 0,
      };

      const x = t.x ?? 0;
      const y = t.y ?? 0;
      const scaleX = t.scaleX ?? 1;
      const scaleY = t.scaleY ?? 1;
      const rotation = t.rotation ?? 0;
      const skewX = t.skewX ?? 0;
      const skewY = t.skewY ?? 0;
      const ox = t.originX ?? 0;
      const oy = t.originY ?? 0;

      // Affine transform identical to CanvasEngine:
      // 1. Move to layer position
      ctx.translate(x, y);
      // 2. Move to pivot
      if (ox !== 0 || oy !== 0) ctx.translate(ox, oy);
      // 3. Rotate
      if (rotation !== 0) ctx.rotate((rotation * Math.PI) / 180);
      // 4. Skew
      if (skewX !== 0 || skewY !== 0) {
        const tanSkewX = Math.tan((skewX * Math.PI) / 180);
        const tanSkewY = Math.tan((skewY * Math.PI) / 180);
        ctx.transform(1, tanSkewY, tanSkewX, 1, 0, 0);
      }
      // 5. Scale
      if (scaleX !== 1 || scaleY !== 1) ctx.scale(scaleX, scaleY);
      // 6. Translate back from pivot
      if (ox !== 0 || oy !== 0) ctx.translate(-ox, -oy);

      const renderW =
        layer.sourceWidth ?? assetMeta?.width ?? (imageSource as any).width ?? (imageSource as any).naturalWidth ?? docW;
      const renderH =
        layer.sourceHeight ?? assetMeta?.height ?? (imageSource as any).height ?? (imageSource as any).naturalHeight ?? docH;

      ctx.drawImage(imageSource, 0, 0, renderW, renderH);

      ctx.restore();
      renderedLayerCount++;
    }

    ctx.restore();

    // Revoke any intermediate object URLs
    for (const url of createdBlobUrls) {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    }

    if (renderedLayerCount === 0) {
      return '';
    }

    return offscreen.toDataURL('image/jpeg', 0.90);
  } catch (err) {
    console.error('[ThumbnailGenerator] Failed to generate thumbnail from document:', err);
    return '';
  }
}
