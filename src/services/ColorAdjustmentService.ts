/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fx from 'glfx';
import type { FXCanvas, FXTexture } from 'glfx';
import type { LayerAdjustments, LayerNode } from '../types/DocumentModel.ts';
import type { AssetRecord } from '../types/shell.ts';
import { storeBinaryAsset } from './DocumentPersistence.ts';

export type CurvePresetId = 'linear' | 's-curve' | 'matte' | 'cold-teal' | 'warm-sunset';

export interface CurvePresetDefinition {
  id: CurvePresetId;
  name: string;
  description: string;
  r: [number, number][];
  g: [number, number][];
  b: [number, number][];
}

export const CURVE_PRESETS: CurvePresetDefinition[] = [
  {
    id: 'linear',
    name: 'Linear (Default)',
    description: 'Neutral 1:1 pass-through',
    r: [[0, 0], [1, 1]],
    g: [[0, 0], [1, 1]],
    b: [[0, 0], [1, 1]],
  },
  {
    id: 's-curve',
    name: 'Contrast S-Curve',
    description: 'Compresses darks and expands highlights for cinematic punch',
    r: [[0, 0], [0.3, 0.18], [0.7, 0.82], [1, 1]],
    g: [[0, 0], [0.3, 0.18], [0.7, 0.82], [1, 1]],
    b: [[0, 0], [0.3, 0.18], [0.7, 0.82], [1, 1]],
  },
  {
    id: 'matte',
    name: 'Matte / Faded Film',
    description: 'Lifted black pedestal with softened highlights',
    r: [[0, 0.14], [0.5, 0.5], [1, 0.88]],
    g: [[0, 0.14], [0.5, 0.5], [1, 0.88]],
    b: [[0, 0.14], [0.5, 0.5], [1, 0.88]],
  },
  {
    id: 'cold-teal',
    name: 'Cold Cinema Teal',
    description: 'Subtle teal shadow tint with cooled highlights',
    r: [[0, 0], [0.5, 0.42], [1, 0.88]],
    g: [[0, 0], [0.5, 0.52], [1, 0.98]],
    b: [[0, 0.12], [0.5, 0.62], [1, 1]],
  },
  {
    id: 'warm-sunset',
    name: 'Warm Sunset Gold',
    description: 'Warm amber tones with soft golden glow',
    r: [[0, 0.08], [0.5, 0.6], [1, 1]],
    g: [[0, 0.02], [0.5, 0.52], [1, 0.94]],
    b: [[0, 0], [0.5, 0.4], [1, 0.78]],
  },
];

/**
 * Checks if layer adjustments differ from default neutral state.
 */
export function isAdjustmentActive(adj?: LayerAdjustments): boolean {
  if (!adj) return false;
  const b = adj.brightness ?? 0;
  const c = adj.contrast ?? 0;
  const s = adj.saturation ?? 0;
  const h = adj.hue ?? 0;
  const v = adj.vibrance ?? 0;
  const curve = adj.curvePreset ?? 'linear';

  return b !== 0 || c !== 0 || s !== 0 || h !== 0 || v !== 0 || curve !== 'linear';
}

/**
 * Generates a cache key to avoid unnecessary recalculations during canvas pan/zoom/movement.
 */
export function computeAdjustmentCacheKey(
  layerId: string,
  assetId: string,
  adj?: LayerAdjustments
): string {
  if (!adj || !isAdjustmentActive(adj)) {
    return `${layerId}:${assetId}:neutral`;
  }
  return `${layerId}:${assetId}:b${adj.brightness ?? 0}:c${adj.contrast ?? 0}:s${adj.saturation ?? 0}:h${adj.hue ?? 0}:v${adj.vibrance ?? 0}:cp${adj.curvePreset ?? 'linear'}`;
}

// Singleton WebGL processor instance
let sharedFxCanvas: FXCanvas | null = null;
let sharedFxTexture: FXTexture | null = null;
let isGlAvailable = true;

function getSharedFxCanvas(): FXCanvas | null {
  if (!isGlAvailable) return null;
  if (!sharedFxCanvas) {
    try {
      sharedFxCanvas = fx.canvas();
    } catch (err) {
      console.warn('[ColorAdjustmentService] WebGL initialization failed:', err);
      isGlAvailable = false;
      return null;
    }
  }
  return sharedFxCanvas;
}

/**
 * Applies glfx color correction pipeline to an image source.
 * Returns an HTMLCanvasElement with the processed pixels.
 */
export function processColorAdjustments(
  source: CanvasImageSource,
  adj: LayerAdjustments,
  width: number,
  height: number
): HTMLCanvasElement | null {
  if (!isAdjustmentActive(adj)) return null;

  const fxCanvas = getSharedFxCanvas();
  if (!fxCanvas) return null;

  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  try {
    // 1. Prepare texture
    if (
      !sharedFxTexture ||
      fxCanvas.width !== w ||
      fxCanvas.height !== h
    ) {
      if (sharedFxTexture) {
        try {
          sharedFxTexture.destroy();
        } catch {
          // ignore
        }
      }
      sharedFxTexture = fxCanvas.texture(source as any);
    } else {
      sharedFxTexture.loadContentsOf(source as any);
    }

    // 2. Base draw to WebGL pipeline
    fxCanvas.draw(sharedFxTexture, w, h);

    // 3. Brightness & Contrast (ranges: normalized to [-1, 1])
    const b = (adj.brightness ?? 0) / 100;
    const c = (adj.contrast ?? 0) / 100;
    if (b !== 0 || c !== 0) {
      fxCanvas.brightnessContrast(b, c);
    }

    // 4. Hue & Saturation (hue: -180..180 -> -1..1, sat: -100..100 -> -1..1)
    const hueVal = (adj.hue ?? 0) / 180;
    const satVal = (adj.saturation ?? 0) / 100;
    if (hueVal !== 0 || satVal !== 0) {
      fxCanvas.hueSaturation(hueVal, satVal);
    }

    // 5. Vibrance (range: -100..100 -> -1..1)
    const vibVal = (adj.vibrance ?? 0) / 100;
    if (vibVal !== 0) {
      fxCanvas.vibrance(vibVal);
    }

    // 6. RGB Curves
    const curveId = adj.curvePreset || 'linear';
    if (curveId !== 'linear') {
      const preset = CURVE_PRESETS.find((p) => p.id === curveId) || CURVE_PRESETS[0];
      fxCanvas.curves(preset.r, preset.g, preset.b);
    }

    // 7. Flush WebGL pipeline to canvas
    fxCanvas.update();

    // 8. Snapshot to offscreen Canvas 2D
    const resultCanvas = document.createElement('canvas');
    resultCanvas.width = w;
    resultCanvas.height = h;
    const ctx = resultCanvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(fxCanvas, 0, 0, w, h);
    return resultCanvas;
  } catch (err) {
    console.error('[ColorAdjustmentService] Error during glfx processing:', err);
    return null;
  }
}

/**
 * Saves a layer's rendered color-corrected output as a new independent asset in the Assets Library.
 */
export async function saveLayerToAssetsLibrary(
  layer: LayerNode,
  sourceImage: CanvasImageSource,
  adj: LayerAdjustments | undefined,
  width: number,
  height: number
): Promise<AssetRecord> {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));

  // 1. Render adjusted (or clean) layer
  let finalCanvas: HTMLCanvasElement;
  if (adj && isAdjustmentActive(adj)) {
    const processed = processColorAdjustments(sourceImage, adj, w, h);
    if (processed) {
      finalCanvas = processed;
    } else {
      finalCanvas = document.createElement('canvas');
      finalCanvas.width = w;
      finalCanvas.height = h;
      const ctx = finalCanvas.getContext('2d');
      if (ctx) ctx.drawImage(sourceImage, 0, 0, w, h);
    }
  } else {
    finalCanvas = document.createElement('canvas');
    finalCanvas.width = w;
    finalCanvas.height = h;
    const ctx = finalCanvas.getContext('2d');
    if (ctx) ctx.drawImage(sourceImage, 0, 0, w, h);
  }

  // 2. Export lossless PNG blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((b) => {
      if (b) resolve(b);
      else reject(new Error('Failed to create PNG blob from canvas'));
    }, 'image/png');
  });

  const assetId = `asset-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const title = `${layer.name} (Graded)`;

  // 3. Persist binary blob into IndexedDB
  await storeBinaryAsset(assetId, blob);

  // 4. Create AssetRecord and update localStorage
  const dataUrl = finalCanvas.toDataURL('image/png');
  const newAsset: AssetRecord = {
    id: assetId,
    title,
    category: 'cutout',
    url: dataUrl,
    width: w,
    height: h,
    fileSizeBytes: blob.size,
    format: 'png',
    createdAt: new Date().toISOString(),
    tags: ['Color Corrected', 'Studio Export', layer.name],
  };

  try {
    const stored = localStorage.getItem('aristo_assets_v2');
    const existing: AssetRecord[] = stored ? JSON.parse(stored) : [];
    // Store with lean payload for localStorage (url hydrated via IndexedDB)
    const leanAssets = [
      { ...newAsset, url: '' },
      ...existing.filter((a) => a.id !== assetId),
    ];
    localStorage.setItem('aristo_assets_v2', JSON.stringify(leanAssets));
  } catch (err) {
    console.warn('[ColorAdjustmentService] Error writing asset to localStorage:', err);
  }

  return newAsset;
}
