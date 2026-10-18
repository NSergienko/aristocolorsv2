/**
 * AristoColors v2 - Document State Store (SSOT)
 *
 * Implements Step 2 of the AristoColors Studio architecture.
 *
 * A strongly-typed Zustand + Immer state store for the single source of truth
 * `ProjectDocument` model. Guarantees:
 * 1. Normalized layer management with strict parent-child referential consistency.
 * 2. Circular group nesting prevention.
 * 3. Recursive lock enforcement (layer and all ancestor groups).
 * 4. Cascading cleanup for group deletion (removes descendants, cleans active/selected IDs).
 * 5. Safe validation rejecting silent corruption.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  ProjectDocument,
  LayerNode,
  Transform2D,
  LayerAdjustments,
  SelectionState,
  ProjectAsset,
  ColorSpace,
} from '../types/DocumentModel.ts';

// ============================================================================
// 1. Auxiliary Mutation & Patch Types
// ============================================================================

export interface DocumentMetadataPatch {
  name?: string;
  width?: number;
  height?: number;
  dpi?: number;
  colorSpace?: ColorSpace;
}

export type LayerPatch = Partial<
  Omit<LayerNode, 'id' | 'parentId' | 'type' | 'childrenIds' | 'transform' | 'adjustments'>
> & {
  transform?: Partial<Transform2D>;
  adjustments?: Partial<LayerAdjustments>;
};

// ============================================================================
// 2. Pure Hierarchy & Lock Validation Helpers
// ============================================================================

/**
 * Checks whether a layer is effectively locked (either directly or via any ancestor).
 */
export function isLayerEffectivelyLocked(
  layers: Record<string, LayerNode>,
  layerId: string
): boolean {
  let current: LayerNode | undefined = layers[layerId];
  const visited = new Set<string>();

  while (current) {
    if (visited.has(current.id)) {
      // Loop protection
      return true;
    }
    visited.add(current.id);

    if (current.locked) {
      return true;
    }

    if (!current.parentId) {
      break;
    }
    current = layers[current.parentId];
  }

  return false;
}

/**
 * Checks whether any ancestor of the layer is locked (excluding the layer itself).
 */
export function hasLockedAncestor(
  layers: Record<string, LayerNode>,
  layerId: string
): boolean {
  const current = layers[layerId];
  if (!current || !current.parentId) {
    return false;
  }

  let ancestorId: string | null = current.parentId;
  const visited = new Set<string>();

  while (ancestorId) {
    if (visited.has(ancestorId)) {
      return true;
    }
    visited.add(ancestorId);

    const ancestor: LayerNode | undefined = layers[ancestorId];
    if (!ancestor) {
      break;
    }

    if (ancestor.locked) {
      return true;
    }
    ancestorId = ancestor.parentId;
  }

  return false;
}

/**
 * Checks whether `candidateDescendantId` is within the subtree rooted at `ancestorId`.
 */
export function isDescendantOf(
  layers: Record<string, LayerNode>,
  candidateDescendantId: string,
  ancestorId: string
): boolean {
  if (candidateDescendantId === ancestorId) {
    return false;
  }

  let current: LayerNode | undefined = layers[candidateDescendantId];
  const visited = new Set<string>();

  while (current && current.parentId) {
    if (visited.has(current.id)) {
      break;
    }
    visited.add(current.id);

    if (current.parentId === ancestorId) {
      return true;
    }
    current = layers[current.parentId];
  }

  return false;
}

/**
 * Gathers all descendant layer IDs beneath a group layer (breadth-first traversal).
 */
export function getDescendantLayerIds(
  layers: Record<string, LayerNode>,
  groupId: string
): string[] {
  const target = layers[groupId];
  if (!target || target.type !== 'group' || !target.childrenIds) {
    return [];
  }

  const results: string[] = [];
  const queue = [...target.childrenIds];
  const visited = new Set<string>([groupId]);

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);
    results.push(currentId);

    const node = layers[currentId];
    if (node && node.type === 'group' && Array.isArray(node.childrenIds)) {
      for (const childId of node.childrenIds) {
        if (!visited.has(childId)) {
          queue.push(childId);
        }
      }
    }
  }

  return results;
}

/**
 * Validates document tree consistency, confirming referential integrity.
 * Detects:
 * - Duplicate rootLayerIds or child references
 * - Missing hierarchy membership (layers not reachable from root or parent)
 * - Invalid parent-child relationships
 * - Circular group nesting
 * - Invalid active/selected layer references
 * - Unregistered referenced assets
 */
export function validateDocumentIntegrity(doc: ProjectDocument): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!doc) {
    return { isValid: false, errors: ['Document is null or undefined.'] };
  }

  // 1. Check rootLayerIds array validity & duplicate detection
  if (!Array.isArray(doc.rootLayerIds)) {
    errors.push('doc.rootLayerIds must be an array.');
  } else {
    const seenRootIds = new Set<string>();
    for (const rootId of doc.rootLayerIds) {
      if (seenRootIds.has(rootId)) {
        errors.push(`Duplicate root layer ID "${rootId}" found in rootLayerIds.`);
      }
      seenRootIds.add(rootId);

      const layer = doc.layers?.[rootId];
      if (!layer) {
        errors.push(`Root layer ID "${rootId}" does not exist in layers dictionary.`);
      } else if (layer.parentId !== null) {
        errors.push(`Root layer "${rootId}" has non-null parentId "${layer.parentId}".`);
      }
    }
  }

  // 2. Track hierarchy membership (layers reachable from root)
  const reachableLayerIds = new Set<string>();

  function traverseHierarchy(nodeId: string, path: string[]) {
    if (path.includes(nodeId)) {
      errors.push(`Circular group nesting detected: ${path.join(' -> ')} -> ${nodeId}`);
      return;
    }
    reachableLayerIds.add(nodeId);

    const layer = doc.layers?.[nodeId];
    if (!layer) return;

    if (layer.type === 'group') {
      if (layer.childrenIds) {
        if (!Array.isArray(layer.childrenIds)) {
          errors.push(`Group "${nodeId}" childrenIds must be an array.`);
        } else {
          const seenChildIds = new Set<string>();
          for (const childId of layer.childrenIds) {
            if (seenChildIds.has(childId)) {
              errors.push(`Duplicate child ID "${childId}" found in group "${nodeId}".`);
            }
            seenChildIds.add(childId);

            traverseHierarchy(childId, [...path, nodeId]);
          }
        }
      }
    }
  }

  if (Array.isArray(doc.rootLayerIds)) {
    for (const rootId of doc.rootLayerIds) {
      if (doc.layers?.[rootId]) {
        traverseHierarchy(rootId, []);
      }
    }
  }

  // 3. Validate doc dimensions are finite positive numbers
  if (doc.width !== undefined) {
    if (typeof doc.width !== 'number' || !Number.isFinite(doc.width) || doc.width <= 0) {
      errors.push(`Document width must be a finite positive number.`);
    }
  }
  if (doc.height !== undefined) {
    if (typeof doc.height !== 'number' || !Number.isFinite(doc.height) || doc.height <= 0) {
      errors.push(`Document height must be a finite positive number.`);
    }
  }
  if (doc.dpi !== undefined) {
    if (typeof doc.dpi !== 'number' || !Number.isFinite(doc.dpi) || doc.dpi <= 0) {
      errors.push(`Document dpi must be a finite positive number.`);
    }
  }

  // 4. Check all layers in doc.layers and verify asset references
  if (!doc.layers || typeof doc.layers !== 'object') {
    errors.push('doc.layers must be an object.');
  } else {
    for (const [id, layer] of Object.entries(doc.layers)) {
      if (!layer) {
        errors.push(`Layer entry "${id}" is null or undefined.`);
        continue;
      }

      if (layer.id !== id) {
        errors.push(`Layer ID mismatch: dictionary key "${id}" vs layer.id "${layer.id}".`);
      }

      // Check hierarchy membership: every layer must be reachable from root
      if (!reachableLayerIds.has(id)) {
        errors.push(`Layer "${id}" is orphaned (missing hierarchy membership from root).`);
      }

      // Check parent relationships
      if (layer.parentId !== null) {
        const parent = doc.layers[layer.parentId];
        if (!parent) {
          errors.push(`Layer "${id}" references non-existent parent "${layer.parentId}".`);
        } else if (parent.type !== 'group') {
          errors.push(`Layer "${id}" parent "${layer.parentId}" is not of type "group".`);
        } else if (!parent.childrenIds?.includes(id)) {
          errors.push(`Layer "${id}" has parent "${layer.parentId}" but is not listed in parent's childrenIds.`);
        }
      }

      // Check group child relationships
      if (layer.type === 'group') {
        if (layer.childrenIds) {
          if (!Array.isArray(layer.childrenIds)) {
            errors.push(`Group "${id}" childrenIds is not an array.`);
          } else {
            for (const childId of layer.childrenIds) {
              const child = doc.layers[childId];
              if (!child) {
                errors.push(`Group "${id}" lists non-existent child "${childId}".`);
              } else if (child.parentId !== id) {
                errors.push(`Child "${childId}" of group "${id}" has parentId "${child.parentId}".`);
              }
            }
          }
        }
      } else {
        // Non-group layers should not have childrenIds
        if (layer.childrenIds !== undefined && layer.childrenIds.length > 0) {
          errors.push(`Non-group layer "${id}" of type "${layer.type}" cannot contain childrenIds.`);
        }
      }

      // Check transform finite numbers
      if (layer.transform) {
        const t = layer.transform;
        const transformProps: (keyof Transform2D)[] = [
          'x', 'y', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY', 'originX', 'originY'
        ];
        for (const p of transformProps) {
          if (t[p] !== undefined && (typeof t[p] !== 'number' || !Number.isFinite(t[p]))) {
            errors.push(`Layer "${id}" transform property "${p}" must be a finite number.`);
          }
        }
      }

      // Check opacity finite number
      if (layer.opacity !== undefined && (typeof layer.opacity !== 'number' || !Number.isFinite(layer.opacity))) {
        errors.push(`Layer "${id}" opacity must be a finite number.`);
      }

      // Verify layer sourceAssetId exists in doc.assets
      if (layer.sourceAssetId) {
        if (!doc.assets || !doc.assets[layer.sourceAssetId]) {
          errors.push(`Layer "${id}" references non-existent asset "${layer.sourceAssetId}" in doc.assets.`);
        }
      }

      // Verify layer mask maskAssetId exists in doc.assets
      if (layer.mask && layer.mask.maskAssetId) {
        if (!doc.assets || !doc.assets[layer.mask.maskAssetId]) {
          errors.push(`Layer "${id}" mask references non-existent asset "${layer.mask.maskAssetId}" in doc.assets.`);
        }
      }

      // Check cycle from this node upwards if not already checked
      let currentParentId: string | null = layer.parentId;
      const upwardVisited = new Set<string>([id]);
      while (currentParentId) {
        if (upwardVisited.has(currentParentId)) {
          errors.push(`Circular ancestor reference detected starting at layer "${id}" with parent "${currentParentId}".`);
          break;
        }
        upwardVisited.add(currentParentId);
        const pNode = doc.layers[currentParentId];
        if (!pNode) break;
        currentParentId = pNode.parentId;
      }
    }
  }

  // 5. Check activeLayerId
  if (doc.activeLayerId !== null && doc.activeLayerId !== undefined) {
    if (!doc.layers || !doc.layers[doc.activeLayerId]) {
      errors.push(`activeLayerId "${doc.activeLayerId}" does not exist in layers dictionary.`);
    }
  }

  // 6. Check selectedLayerIds
  if (doc.selectedLayerIds) {
    if (!Array.isArray(doc.selectedLayerIds)) {
      errors.push('selectedLayerIds must be an array.');
    } else {
      const seenSelected = new Set<string>();
      for (const selId of doc.selectedLayerIds) {
        if (seenSelected.has(selId)) {
          errors.push(`Duplicate layer ID "${selId}" in selectedLayerIds.`);
        }
        seenSelected.add(selId);
        if (!doc.layers || !doc.layers[selId]) {
          errors.push(`selectedLayerId "${selId}" does not exist in layers dictionary.`);
        }
      }
    }
  }

  // 7. Verify selection maskAssetId if present
  if (doc.selection && doc.selection.maskAssetId) {
    if (!doc.assets || !doc.assets[doc.selection.maskAssetId]) {
      errors.push(`Selection references non-existent asset "${doc.selection.maskAssetId}" in doc.assets.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// 3. Document Store Interfaces
// ============================================================================

export interface DocumentState {
  /** The currently loaded ProjectDocument or null if no canvas is open */
  document: ProjectDocument | null;
}

export interface DocumentActions {
  // Document lifecycle
  setDocument: (document: ProjectDocument) => boolean;
  clearDocument: () => void;
  updateDocumentMetadata: (patch: DocumentMetadataPatch) => boolean;

  // Layer management
  addLayer: (layer: LayerNode, parentId?: string | null) => boolean;
  removeLayer: (layerId: string) => boolean;
  updateLayer: (layerId: string, patch: LayerPatch) => boolean;
  setActiveLayer: (layerId: string | null) => boolean;
  setSelectedLayerIds: (layerIds: string[]) => void;
  reorderLayer: (layerId: string, targetParentId: string | null, targetIndex: number) => boolean;

  // Canvas presentation
  setViewport: (zoom: number, panX: number, panY: number) => void;
  setSelection: (selection: SelectionState | null) => void;

  // Asset management
  addAsset: (asset: ProjectAsset) => boolean;
  removeAsset: (assetId: string) => boolean;

  // Query helpers
  isLayerLocked: (layerId: string) => boolean;
  getDescendantIds: (layerId: string) => string[];
  getLayer: (layerId: string) => LayerNode | undefined;
}

export type DocumentStore = DocumentState & DocumentActions;

// ============================================================================
// 4. Zustand Store Implementation (with Immer)
// ============================================================================

export const useDocumentStore = create<DocumentStore>()(
  immer((set, get) => ({
    document: null,

    // ------------------------------------------------------------------------
    // Document Lifecycle
    // ------------------------------------------------------------------------

    setDocument: (incomingDoc: ProjectDocument): boolean => {
      // Reject null or undefined
      if (!incomingDoc) {
        console.warn('[useDocumentStore] setDocument rejected: document is null or undefined.');
        return false;
      }

      // Strictly validate document integrity before loading - do NOT silently repair corrupted hierarchies
      const validation = validateDocumentIntegrity(incomingDoc);
      if (!validation.isValid) {
        console.warn('[useDocumentStore] setDocument rejected: Document failed integrity check:', validation.errors);
        return false;
      }

      // Document passed strict integrity validation, deep-clone to ensure no mutable state is shared
      const clonedDoc: ProjectDocument = JSON.parse(JSON.stringify(incomingDoc));

      set((state) => {
        state.document = clonedDoc;
      });

      return true;
    },

    clearDocument: () => {
      set((state) => {
        state.document = null;
      });
    },

    updateDocumentMetadata: (patch: DocumentMetadataPatch): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] updateDocumentMetadata failed: No active document.');
        return false;
      }

      if (!patch || typeof patch !== 'object') {
        console.warn('[useDocumentStore] updateDocumentMetadata failed: Invalid patch.');
        return false;
      }

      // Reject non-finite numeric inputs (NaN and Infinity)
      if (patch.width !== undefined && (!Number.isFinite(patch.width) || patch.width <= 0)) {
        console.warn('[useDocumentStore] updateDocumentMetadata failed: Width must be a finite positive number.');
        return false;
      }
      if (patch.height !== undefined && (!Number.isFinite(patch.height) || patch.height <= 0)) {
        console.warn('[useDocumentStore] updateDocumentMetadata failed: Height must be a finite positive number.');
        return false;
      }
      if (patch.dpi !== undefined && (!Number.isFinite(patch.dpi) || patch.dpi <= 0)) {
        console.warn('[useDocumentStore] updateDocumentMetadata failed: DPI must be a finite positive number.');
        return false;
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;

        if (patch.name !== undefined && patch.name.trim().length > 0) {
          doc.name = patch.name.trim();
        }
        if (patch.width !== undefined && patch.width > 0) {
          doc.width = Math.round(patch.width);
        }
        if (patch.height !== undefined && patch.height > 0) {
          doc.height = Math.round(patch.height);
        }
        if (patch.dpi !== undefined && patch.dpi > 0) {
          doc.dpi = Math.round(patch.dpi);
        }
        if (patch.colorSpace !== undefined) {
          doc.colorSpace = patch.colorSpace;
        }

        doc.updatedAt = Date.now();
      });

      return true;
    },

    // ------------------------------------------------------------------------
    // Layer Management
    // ------------------------------------------------------------------------

    addLayer: (layer: LayerNode, parentId: string | null = null): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] addLayer failed: No active document.');
        return false;
      }

      if (!layer || typeof layer !== 'object' || !layer.id) {
        console.warn('[useDocumentStore] addLayer failed: Invalid layer node input.');
        return false;
      }

      // 1. Prevent duplicate IDs
      if (currentDoc.layers[layer.id]) {
        console.warn(`[useDocumentStore] addLayer failed: Duplicate layer ID "${layer.id}".`);
        return false;
      }

      // 2. Reject malformed layer inputs that could introduce inconsistent hierarchy references
      // If adding a non-group layer, it must not have childrenIds
      if (layer.type !== 'group' && layer.childrenIds !== undefined && layer.childrenIds.length > 0) {
        console.warn(`[useDocumentStore] addLayer failed: Non-group layer cannot contain childrenIds.`);
        return false;
      }

      // If adding a group layer, newly created groups must be initialized with empty childrenIds.
      // Reject inputs with pre-populated childrenIds that don't match or could corrupt hierarchy.
      if (layer.type === 'group' && layer.childrenIds && layer.childrenIds.length > 0) {
        console.warn(`[useDocumentStore] addLayer failed: Newly created group layer cannot have pre-populated children.`);
        return false;
      }

      // 3. Validate parent if specified
      const targetParentId = parentId ?? null;
      if (targetParentId !== null) {
        const parent = currentDoc.layers[targetParentId];
        if (!parent) {
          console.warn(`[useDocumentStore] addLayer failed: Parent group "${targetParentId}" does not exist.`);
          return false;
        }
        if (parent.type !== 'group') {
          console.warn(`[useDocumentStore] addLayer failed: Target parent "${targetParentId}" is not a group.`);
          return false;
        }
        if (isLayerEffectivelyLocked(currentDoc.layers, targetParentId)) {
          console.warn(`[useDocumentStore] addLayer failed: Target parent group "${targetParentId}" is locked.`);
          return false;
        }
      }

      // 4. Validate non-finite numeric inputs for transforms and opacity
      if (layer.transform) {
        const t = layer.transform;
        const transformProps: (keyof Transform2D)[] = [
          'x', 'y', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY', 'originX', 'originY'
        ];
        for (const p of transformProps) {
          if (t[p] !== undefined && (typeof t[p] !== 'number' || !Number.isFinite(t[p]))) {
            console.warn(`[useDocumentStore] addLayer failed: Transform property "${p}" must be a finite number.`);
            return false;
          }
        }
      }
      if (layer.opacity !== undefined && (typeof layer.opacity !== 'number' || !Number.isFinite(layer.opacity))) {
        console.warn(`[useDocumentStore] addLayer failed: Opacity must be a finite number.`);
        return false;
      }

      // 5. Verify asset references if specified
      if (layer.sourceAssetId) {
        if (!currentDoc.assets || !currentDoc.assets[layer.sourceAssetId]) {
          console.warn(`[useDocumentStore] addLayer failed: Referenced sourceAssetId "${layer.sourceAssetId}" does not exist in doc.assets.`);
          return false;
        }
      }
      if (layer.mask && layer.mask.maskAssetId) {
        if (!currentDoc.assets || !currentDoc.assets[layer.mask.maskAssetId]) {
          console.warn(`[useDocumentStore] addLayer failed: Referenced maskAssetId "${layer.mask.maskAssetId}" does not exist in doc.assets.`);
          return false;
        }
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;

        const newLayer: LayerNode = {
          ...layer,
          parentId: targetParentId,
          // Newly created groups are initialized with empty childrenIds
          childrenIds: layer.type === 'group' ? [] : undefined,
        };

        // Add to normalized layer dictionary
        doc.layers[newLayer.id] = newLayer;

        // Maintain parent-child arrays
        if (targetParentId === null) {
          doc.rootLayerIds.push(newLayer.id);
        } else {
          const parent = doc.layers[targetParentId];
          if (parent) {
            if (!Array.isArray(parent.childrenIds)) {
              parent.childrenIds = [];
            }
            parent.childrenIds.push(newLayer.id);
          }
        }

        // Set active & selected
        doc.activeLayerId = newLayer.id;
        doc.selectedLayerIds = [newLayer.id];
        doc.updatedAt = Date.now();
      });

      return true;
    },

    removeLayer: (layerId: string): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] removeLayer failed: No active document.');
        return false;
      }

      const target = currentDoc.layers[layerId];
      if (!target) {
        console.warn(`[useDocumentStore] removeLayer failed: Layer "${layerId}" not found.`);
        return false;
      }

      // 1. Check if the target layer itself or any ancestor is locked
      if (isLayerEffectivelyLocked(currentDoc.layers, layerId)) {
        console.warn(`[useDocumentStore] removeLayer rejected: Layer "${layerId}" or an ancestor is locked.`);
        return false;
      }

      // 2. If it's a group, check if any descendant is locked
      const descendantIds = getDescendantLayerIds(currentDoc.layers, layerId);
      for (const dId of descendantIds) {
        if (currentDoc.layers[dId]?.locked) {
          console.warn(`[useDocumentStore] removeLayer rejected: Group contains locked descendant "${dId}".`);
          return false;
        }
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;
        const layerToDelete = doc.layers[layerId];
        if (!layerToDelete) return;

        // 3. Remove from parent list
        if (layerToDelete.parentId === null) {
          doc.rootLayerIds = doc.rootLayerIds.filter((id) => id !== layerId);
        } else {
          const parentNode = doc.layers[layerToDelete.parentId];
          if (parentNode && Array.isArray(parentNode.childrenIds)) {
            parentNode.childrenIds = parentNode.childrenIds.filter((id) => id !== layerId);
          }
        }

        // 4. Delete target and all descendants from layers map
        const allIdsToRemove = new Set([layerId, ...descendantIds]);
        for (const id of allIdsToRemove) {
          delete doc.layers[id];
        }

        // 5. Clean up activeLayerId and selectedLayerIds
        if (doc.activeLayerId && allIdsToRemove.has(doc.activeLayerId)) {
          doc.activeLayerId = null;
        }

        doc.selectedLayerIds = doc.selectedLayerIds.filter((id) => !allIdsToRemove.has(id));

        // If activeLayerId was cleared but selections remain, pick the first selected layer
        if (doc.activeLayerId === null && doc.selectedLayerIds.length > 0) {
          doc.activeLayerId = doc.selectedLayerIds[0];
        }

        doc.updatedAt = Date.now();
      });

      return true;
    },

    updateLayer: (layerId: string, patch: LayerPatch): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] updateLayer failed: No active document.');
        return false;
      }

      if (!patch || typeof patch !== 'object') {
        console.warn('[useDocumentStore] updateLayer failed: Invalid patch input.');
        return false;
      }

      const target = currentDoc.layers[layerId];
      if (!target) {
        console.warn(`[useDocumentStore] updateLayer failed: Layer "${layerId}" not found.`);
        return false;
      }

      // 1. If any ancestor is locked, all modifications to children are strictly rejected
      if (hasLockedAncestor(currentDoc.layers, layerId)) {
        console.warn(`[useDocumentStore] updateLayer rejected: Ancestor of layer "${layerId}" is locked.`);
        return false;
      }

      // 2. If the layer itself is locked:
      // Allow unlocking ONLY if the patch contains exactly { locked: false }.
      // Reject combined unlocking and editing.
      if (target.locked) {
        const patchKeys = Object.keys(patch);
        const isExactUnlock = patchKeys.length === 1 && patchKeys[0] === 'locked' && patch.locked === false;

        if (!isExactUnlock) {
          console.warn(`[useDocumentStore] updateLayer rejected: Layer "${layerId}" is locked. Unlocking must only contain { locked: false }.`);
          return false;
        }
      }

      // 3. Reject nonexistent sourceAssetId and mask asset references before mutation.
      // Allow explicitly clearing an existing asset reference (undefined or null or empty string).
      if (patch.sourceAssetId) {
        if (!currentDoc.assets || !currentDoc.assets[patch.sourceAssetId]) {
          console.warn(`[useDocumentStore] updateLayer failed: Referenced sourceAssetId "${patch.sourceAssetId}" does not exist in doc.assets.`);
          return false;
        }
      }

      if (patch.mask && patch.mask.maskAssetId) {
        if (!currentDoc.assets || !currentDoc.assets[patch.mask.maskAssetId]) {
          console.warn(`[useDocumentStore] updateLayer failed: Referenced maskAssetId "${patch.mask.maskAssetId}" does not exist in doc.assets.`);
          return false;
        }
      }

      // 4. Reject non-finite numeric inputs (NaN and Infinity) for opacity and transforms
      if (patch.opacity !== undefined && (!Number.isFinite(patch.opacity))) {
        console.warn(`[useDocumentStore] updateLayer failed: Opacity must be a finite number.`);
        return false;
      }

      if (patch.transform) {
        const t = patch.transform;
        const transformProps: (keyof Transform2D)[] = [
          'x', 'y', 'scaleX', 'scaleY', 'rotation', 'skewX', 'skewY', 'originX', 'originY'
        ];
        for (const p of transformProps) {
          if (t[p] !== undefined && (typeof t[p] !== 'number' || !Number.isFinite(t[p]))) {
            console.warn(`[useDocumentStore] updateLayer failed: Transform property "${p}" must be a finite number.`);
            return false;
          }
        }
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;
        const layer = doc.layers[layerId];
        if (!layer) return;

        // Apply scalar patches
        if (patch.name !== undefined && patch.name.trim().length > 0) {
          layer.name = patch.name.trim();
        }
        if (patch.visible !== undefined) {
          layer.visible = Boolean(patch.visible);
        }
        if (patch.locked !== undefined) {
          layer.locked = Boolean(patch.locked);
        }
        if (patch.opacity !== undefined) {
          layer.opacity = Math.max(0, Math.min(1, patch.opacity));
        }
        if (patch.blendMode !== undefined) {
          layer.blendMode = patch.blendMode;
        }
        if (patch.isExpanded !== undefined && layer.type === 'group') {
          layer.isExpanded = Boolean(patch.isExpanded);
        }
        if ('sourceAssetId' in patch) {
          layer.sourceAssetId = patch.sourceAssetId || undefined;
        }
        if (patch.sourceWidth !== undefined) {
          layer.sourceWidth = patch.sourceWidth;
        }
        if (patch.sourceHeight !== undefined) {
          layer.sourceHeight = patch.sourceHeight;
        }

        // Apply non-destructive adjustments (merge)
        if (patch.adjustments !== undefined) {
          layer.adjustments = layer.adjustments
            ? { ...layer.adjustments, ...patch.adjustments }
            : {
                brightness: 0,
                contrast: 0,
                saturation: 0,
                hue: 0,
                temperature: 0,
                tint: 0,
                ...patch.adjustments,
              };
        }

        // Apply affine 2D transform (merge)
        if (patch.transform !== undefined) {
          layer.transform = {
            ...layer.transform,
            ...patch.transform,
          };
        }

        // Apply mask
        if (patch.mask !== undefined) {
          layer.mask = patch.mask;
        }

        // Apply harmonization metadata
        if (patch.harmonization !== undefined) {
          layer.harmonization = patch.harmonization;
        }

        doc.updatedAt = Date.now();
      });

      return true;
    },

    setActiveLayer: (layerId: string | null): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] setActiveLayer failed: No active document.');
        return false;
      }

      if (layerId !== null && !currentDoc.layers[layerId]) {
        console.warn(`[useDocumentStore] setActiveLayer failed: Layer "${layerId}" does not exist.`);
        return false;
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;

        doc.activeLayerId = layerId;

        // Automatically sync selectedLayerIds to include active layer
        if (layerId !== null && !doc.selectedLayerIds.includes(layerId)) {
          doc.selectedLayerIds = [layerId];
        }
      });

      return true;
    },

    setSelectedLayerIds: (layerIds: string[]) => {
      const currentDoc = get().document;
      if (!currentDoc) return;

      // Filter out non-existent layer IDs and remove duplicates while preserving selection order
      const seen = new Set<string>();
      const validIds: string[] = [];
      for (const id of layerIds) {
        if (Boolean(currentDoc.layers[id]) && !seen.has(id)) {
          seen.add(id);
          validIds.push(id);
        }
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;

        doc.selectedLayerIds = validIds;

        // If active layer is no longer among selected, update it
        if (doc.activeLayerId && !validIds.includes(doc.activeLayerId)) {
          doc.activeLayerId = validIds.length > 0 ? validIds[validIds.length - 1] : null;
        } else if (!doc.activeLayerId && validIds.length > 0) {
          doc.activeLayerId = validIds[0];
        }
      });
    },

    reorderLayer: (
      layerId: string,
      targetParentId: string | null,
      targetIndex: number
    ): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] reorderLayer failed: No active document.');
        return false;
      }

      const layer = currentDoc.layers[layerId];
      if (!layer) {
        console.warn(`[useDocumentStore] reorderLayer failed: Layer "${layerId}" does not exist.`);
        return false;
      }

      // 1. Moving layer cannot be locked or have locked ancestors
      if (isLayerEffectivelyLocked(currentDoc.layers, layerId)) {
        console.warn(`[useDocumentStore] reorderLayer rejected: Layer "${layerId}" or its ancestor is locked.`);
        return false;
      }

      // 2. Current parent cannot be locked
      if (layer.parentId && isLayerEffectivelyLocked(currentDoc.layers, layer.parentId)) {
        console.warn(`[useDocumentStore] reorderLayer rejected: Current parent "${layer.parentId}" is locked.`);
        return false;
      }

      // 3. Validate target parent if moving into a group
      if (targetParentId !== null) {
        const targetParent = currentDoc.layers[targetParentId];
        if (!targetParent) {
          console.warn(`[useDocumentStore] reorderLayer failed: Target parent "${targetParentId}" does not exist.`);
          return false;
        }
        if (targetParent.type !== 'group') {
          console.warn(`[useDocumentStore] reorderLayer failed: Target parent "${targetParentId}" is not a group.`);
          return false;
        }
        if (isLayerEffectivelyLocked(currentDoc.layers, targetParentId)) {
          console.warn(`[useDocumentStore] reorderLayer rejected: Target parent "${targetParentId}" is locked.`);
          return false;
        }

        // 4. Circular hierarchy check: cannot move into self or into one of its own descendants
        if (targetParentId === layerId || isDescendantOf(currentDoc.layers, targetParentId, layerId)) {
          console.warn(`[useDocumentStore] reorderLayer rejected: Cannot move group into itself or its descendants.`);
          return false;
        }
      }

      set((state) => {
        if (!state.document) return;
        const doc = state.document;
        const movingLayer = doc.layers[layerId];
        if (!movingLayer) return;

        const currentParentId = movingLayer.parentId;

        // Remove from current parent container
        if (currentParentId === null) {
          doc.rootLayerIds = doc.rootLayerIds.filter((id) => id !== layerId);
        } else {
          const currentParentNode = doc.layers[currentParentId];
          if (currentParentNode && Array.isArray(currentParentNode.childrenIds)) {
            currentParentNode.childrenIds = currentParentNode.childrenIds.filter(
              (id) => id !== layerId
            );
          }
        }

        // Update layer's parentId
        movingLayer.parentId = targetParentId;

        // Insert into target parent container at clamped index
        if (targetParentId === null) {
          const list = doc.rootLayerIds;
          const clampedIndex = Math.max(0, Math.min(targetIndex, list.length));
          list.splice(clampedIndex, 0, layerId);
        } else {
          const targetParentNode = doc.layers[targetParentId];
          if (targetParentNode) {
            if (!Array.isArray(targetParentNode.childrenIds)) {
              targetParentNode.childrenIds = [];
            }
            const list = targetParentNode.childrenIds;
            const clampedIndex = Math.max(0, Math.min(targetIndex, list.length));
            list.splice(clampedIndex, 0, layerId);
          }
        }

        doc.updatedAt = Date.now();
      });

      return true;
    },

    // ------------------------------------------------------------------------
    // Canvas Presentation State
    // ------------------------------------------------------------------------

    setViewport: (zoom: number, panX: number, panY: number) => {
      if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) {
        console.warn('[useDocumentStore] setViewport ignored: zoom, panX, and panY must be finite numbers.');
        return;
      }
      set((state) => {
        if (!state.document) return;
        state.document.viewport = { zoom, panX, panY };
      });
    },

    setSelection: (selection: SelectionState | null) => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] setSelection failed: No active document.');
        return;
      }

      // If clearing selection with null
      if (selection === null) {
        set((state) => {
          if (!state.document) return;
          state.document.selection = null;
        });
        return;
      }

      // If selection specifies a maskAssetId, verify it exists in current document's assets
      if (selection.maskAssetId) {
        if (!currentDoc.assets || !currentDoc.assets[selection.maskAssetId]) {
          console.warn(`[useDocumentStore] setSelection rejected: maskAssetId "${selection.maskAssetId}" does not exist in doc.assets.`);
          return;
        }
      }

      set((state) => {
        if (!state.document) return;
        state.document.selection = selection;
      });
    },

    // ------------------------------------------------------------------------
    // Asset Management
    // ------------------------------------------------------------------------

    addAsset: (asset: ProjectAsset): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] addAsset failed: No active document.');
        return false;
      }

      if (!asset || typeof asset !== 'object' || !asset.id) {
        console.warn('[useDocumentStore] addAsset failed: Invalid asset input.');
        return false;
      }

      // Prevent duplicate asset IDs
      if (currentDoc.assets && currentDoc.assets[asset.id]) {
        console.warn(`[useDocumentStore] addAsset failed: Asset ID "${asset.id}" already exists.`);
        return false;
      }

      set((state) => {
        if (!state.document) return;
        if (!state.document.assets) {
          state.document.assets = {};
        }
        state.document.assets[asset.id] = asset;
        state.document.updatedAt = Date.now();
      });

      return true;
    },

    removeAsset: (assetId: string): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) {
        console.warn('[useDocumentStore] removeAsset failed: No active document.');
        return false;
      }

      if (!currentDoc.assets || !currentDoc.assets[assetId]) {
        console.warn(`[useDocumentStore] removeAsset failed: Asset "${assetId}" does not exist.`);
        return false;
      }

      // Reject deletion if the asset is referenced by:
      // 1. Any layer's sourceAssetId
      // 2. Any layer mask's maskAssetId
      for (const [lId, layer] of Object.entries(currentDoc.layers)) {
        if (layer.sourceAssetId === assetId) {
          console.warn(`[useDocumentStore] removeAsset rejected: Asset "${assetId}" is referenced by layer "${lId}" sourceAssetId.`);
          return false;
        }
        if (layer.mask && layer.mask.maskAssetId === assetId) {
          console.warn(`[useDocumentStore] removeAsset rejected: Asset "${assetId}" is referenced by layer "${lId}" maskAssetId.`);
          return false;
        }
      }

      // 3. The active selection's maskAssetId
      if (currentDoc.selection && currentDoc.selection.maskAssetId === assetId) {
        console.warn(`[useDocumentStore] removeAsset rejected: Asset "${assetId}" is referenced by active selection maskAssetId.`);
        return false;
      }

      set((state) => {
        if (!state.document || !state.document.assets) return;
        delete state.document.assets[assetId];
        state.document.updatedAt = Date.now();
      });

      return true;
    },

    // ------------------------------------------------------------------------
    // Query Helpers
    // ------------------------------------------------------------------------

    isLayerLocked: (layerId: string): boolean => {
      const currentDoc = get().document;
      if (!currentDoc) return false;
      return isLayerEffectivelyLocked(currentDoc.layers, layerId);
    },

    getDescendantIds: (layerId: string): string[] => {
      const currentDoc = get().document;
      if (!currentDoc) return [];
      return getDescendantLayerIds(currentDoc.layers, layerId);
    },

    getLayer: (layerId: string): LayerNode | undefined => {
      return get().document?.layers[layerId];
    },
  }))
);
