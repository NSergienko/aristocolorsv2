/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  loadDocument,
  saveDocument,
  storeBinaryAsset,
  loadBinaryAsset,
  createDefaultProjectDocument,
} from './DocumentPersistence.ts';
import { validateDocumentIntegrity, useDocumentStore } from '../state/useDocumentStore.ts';
import type {
  ProjectDocument,
  LayerNode,
  ProjectAsset,
} from '../types/DocumentModel.ts';
import type { AssetRecord, ProjectMetadata } from '../types/shell.ts';
import {
  generateCompositeThumbnailFromDocument,
  dataUrlToBlob,
  setCachedThumbnail,
} from '../utils/thumbnailGenerator.ts';

export interface AddCutoutResult {
  success: boolean;
  document?: ProjectDocument;
  layer?: LayerNode;
  thumbnailUrl?: string;
  errorMessage?: string;
}

/**
 * Inserts a saved cutout (or library asset) as a new independent layer
 * into an existing Studio project document.
 *
 * Guarantees:
 * 1. Preserves original PNG transparency, resolution, and aspect ratio.
 * 2. Centers the cutout within the visible canvas area with a sensible initial scale.
 * 3. Never distorts or stretches the image (uniform scaleX == scaleY).
 * 4. Preserves all existing layers; never flattens or alters existing nodes.
 * 5. Persists the updated document and binary asset to IndexedDB so it survives reload.
 * 6. Synchronizes active Zustand store if currently loaded.
 */
export async function addCutoutAssetToProject(
  projectMeta: ProjectMetadata,
  asset: AssetRecord
): Promise<AddCutoutResult> {
  try {
    const projectId = projectMeta.id;

    // 1. Retrieve the project document from IndexedDB or synthesize from metadata
    let doc = await loadDocument(projectId);
    if (!doc) {
      doc = createDefaultProjectDocument(projectMeta);
      await saveDocument(doc);
    }

    // 2. Ensure binary asset Blob is available in IndexedDB project_assets store
    const assetId = asset.id;
    let blob = await loadBinaryAsset(assetId);

    if (!blob) {
      if (asset.url) {
        try {
          const res = await fetch(asset.url);
          if (res.ok) {
            blob = await res.blob();
            await storeBinaryAsset(assetId, blob);
          }
        } catch (fetchErr) {
          console.warn('[CutoutToCanvas] Could not fetch asset blob from URL:', fetchErr);
        }
      }
    }

    // 3. Register asset descriptor in document assets catalog
    const width = asset.width || 1024;
    const height = asset.height || 1024;
    const sizeBytes = blob ? blob.size : asset.fileSizeBytes || 0;
    const mimeType =
      asset.format === 'jpeg'
        ? 'image/jpeg'
        : asset.format === 'webp'
        ? 'image/webp'
        : asset.format === 'svg'
        ? 'image/svg+xml'
        : 'image/png';

    const projectAsset: ProjectAsset = {
      id: assetId,
      name: asset.title,
      mimeType: mimeType as any,
      width,
      height,
      sizeBytes,
      storageKey: assetId,
      createdAt: Date.now(),
    };

    if (!doc.assets) {
      doc.assets = {};
    }
    doc.assets[assetId] = projectAsset;

    // 4. Calculate sensible initial size and position in visible canvas
    // Preserve exact aspect ratio (scaleX === scaleY)
    const canvasW = doc.width;
    const canvasH = doc.height;

    // A cutout should occupy at most ~65% of canvas width or height, centered
    const maxAllowedW = canvasW * 0.65;
    const maxAllowedH = canvasH * 0.65;
    const fitRatio = Math.min(maxAllowedW / width, maxAllowedH / height);
    // If the asset is smaller than 65% of the canvas, keep 100% scale (scale = 1.0)
    // Otherwise scale down uniformly to fit comfortably within the stage
    const scale = Math.min(1.0, Math.max(0.05, Math.round(fitRatio * 100) / 100));

    const renderedW = width * scale;
    const renderedH = height * scale;

    // Center within visible canvas bounds
    const x = Math.round((canvasW - renderedW) / 2);
    const y = Math.round((canvasH - renderedH) / 2);

    // 5. Create new independent LayerNode
    const layerId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const isFirstLayer = doc.rootLayerIds.length === 0;

    const layerNode: LayerNode = {
      id: layerId,
      parentId: null,
      name: isFirstLayer && asset.category === 'background' ? 'Background Plate' : asset.title,
      type: 'raster',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      transform: {
        x,
        y,
        scaleX: scale,
        scaleY: scale,
        rotation: 0,
        skewX: 0,
        skewY: 0,
        originX: 0,
        originY: 0,
      },
      mask: null,
      sourceAssetId: assetId,
      sourceWidth: width,
      sourceHeight: height,
    };

    // 6. Append layer at top of visual hierarchy
    doc.layers[layerId] = layerNode;
    doc.rootLayerIds.push(layerId);
    doc.activeLayerId = layerId;
    doc.selectedLayerIds = [layerId];
    doc.updatedAt = Date.now();

    // 7. Validate document integrity
    const validation = validateDocumentIntegrity(doc);
    if (!validation.isValid) {
      throw new Error(`Document integrity check failed:\n- ${validation.errors.join('\n- ')}`);
    }

    // 8. Persist document to IndexedDB
    await saveDocument(doc);

    // 9. Generate composite thumbnail representing the COMPLETE visible composition
    let compositeThumb = '';
    try {
      compositeThumb = await generateCompositeThumbnailFromDocument(doc);
      if (compositeThumb) {
        setCachedThumbnail(projectId, compositeThumb);
        const thumbBlob = dataUrlToBlob(compositeThumb);
        await storeBinaryAsset(`thumb_${projectId}`, thumbBlob);
      }
    } catch (thumbErr) {
      console.warn('[CutoutToCanvas] Could not generate composite thumbnail:', thumbErr);
    }

    // 10. Synchronize Zustand store if active
    const activeStoreDoc = useDocumentStore.getState().document;
    if (activeStoreDoc && activeStoreDoc.id === projectId) {
      useDocumentStore.getState().setDocument(doc);
    }

    return {
      success: true,
      document: doc,
      layer: layerNode,
      thumbnailUrl: compositeThumb || undefined,
    };
  } catch (err: any) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[CutoutToCanvas] Failed to add cutout asset to project:', err);
    return {
      success: false,
      errorMessage: errorMsg,
    };
  }
}
