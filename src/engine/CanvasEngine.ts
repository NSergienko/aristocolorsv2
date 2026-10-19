/**
 * AristoColors v2 - Canvas Engine (Core Renderer)
 *
 * Implements Step 4 of the AristoColors Studio architecture.
 *
 * A framework-independent HTML5 Canvas 2D rendering engine responsible for
 * compositing ProjectDocument layers deterministically onto a provided HTMLCanvasElement.
 *
 * Architectural Invariants:
 * 1. Framework-decoupled: Zero React hooks, Zustand store imports, or DOM element creation.
 * 2. Immutable input: ProjectDocument is strictly read-only and never mutated.
 * 3. Decoupled asset store: Decoded CanvasImageSource objects are registered explicitly
 *    at runtime by asset ID, keeping decoded image buffers decoupled from document state.
 * 4. Context hygiene: Strict ctx.save() / ctx.restore() wrapping for every layer node,
 *    preventing transform, opacity, and blend mode state leaks.
 * 5. Deterministic rendering: No timers, subscriptions, or continuous animation loops.
 */

import { LightingEngine } from './LightingEngine.ts';
import type {
  ProjectDocument,
  LayerNode,
  BlendMode,
  Transform2D,
} from '../types/DocumentModel.ts';
import {
  processColorAdjustments,
  isAdjustmentActive,
  computeAdjustmentCacheKey,
} from '../services/ColorAdjustmentService.ts';

// ============================================================================
// Blend Mode Mapping & Utilities
// ============================================================================

/**
 * Standard Canvas 2D supported blend modes mapped to GlobalCompositeOperation.
 * 'normal' maps strictly to 'source-over'.
 */
export const CANVAS_BLEND_MODE_MAP: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'color-dodge': 'color-dodge',
  'color-burn': 'color-burn',
  'hard-light': 'hard-light',
  'soft-light': 'soft-light',
  difference: 'difference',
  exclusion: 'exclusion',
  hue: 'hue',
  saturation: 'saturation',
  color: 'color',
  luminosity: 'luminosity',
};

/**
 * Maps a DocumentModel BlendMode to the browser Canvas 2D globalCompositeOperation.
 * Falls back safely to 'source-over' if an unknown mode is encountered.
 */
export function resolveCompositeOperation(blendMode: BlendMode): GlobalCompositeOperation {
  const op = CANVAS_BLEND_MODE_MAP[blendMode];
  if (!op) {
    return 'source-over';
  }
  return op;
}

// ============================================================================
// Engine Options Interface
// ============================================================================

export interface CanvasEngineOptions {
  /**
   * Device pixel ratio multiplier for high-DPI displays (default: window.devicePixelRatio or 1).
   */
  devicePixelRatio?: number;
  /**
   * Background color fill for the canvas stage before layers are drawn (default: transparent / none).
   * Example: '#0a0b0e' or undefined for transparent.
   */
  backgroundColor?: string;
}

// ============================================================================
// CanvasEngine Class
// ============================================================================

export class CanvasEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  private document: ProjectDocument | null = null;
  private devicePixelRatio: number = 1;
  private backgroundColor?: string;

  /**
   * Registry for runtime-decoded image resources keyed by asset ID.
   * Keeps decoded ImageBitmap / HTMLImageElement / HTMLCanvasElement instances
   * decoupled from serializable ProjectDocument types.
   */
  private readonly imageRegistry: Map<string, CanvasImageSource> = new Map();
  private scratchCanvas: HTMLCanvasElement | null = null;
  /** Per-layer cache for glfx color-adjusted canvases */
  private readonly adjustmentCache: Map<string, { key: string; canvas: HTMLCanvasElement }> = new Map();
  /** Lighting is cached separately so source images and adjustment buffers stay immutable. */
  private readonly lightingCache: Map<string, { key: string; canvas: HTMLCanvasElement }> = new Map();
  private readonly assetVersions: Map<string, number> = new Map();

  private isDisposed: boolean = false;

  constructor(canvas: HTMLCanvasElement, options: CanvasEngineOptions = {}) {
    if (!canvas) {
      throw new Error('[CanvasEngine] Canvas element must be provided.');
    }

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('[CanvasEngine] Failed to acquire 2D rendering context from canvas element.');
    }

    this.canvas = canvas;
    this.ctx = context;
    this.devicePixelRatio = options.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
    this.backgroundColor = options.backgroundColor;
  }

  // --------------------------------------------------------------------------
  // Document & Presentation Lifecycle API
  // --------------------------------------------------------------------------

  /**
   * Sets or clears the active document to be rendered.
   * Automatically resizes the backing canvas store to match document dimensions.
   */
  public setDocument(document: ProjectDocument | null): void {
    if (this.isDisposed) {
      console.warn('[CanvasEngine] Attempted to set document on a disposed engine.');
      return;
    }

    if (this.document && document && this.document.id !== document.id) {
      this.clearImageSources();
    }

    this.document = document;

    if (this.document && this.document.width > 0 && this.document.height > 0) {
      this.resize(this.document.width, this.document.height);
    } else {
      this.clear();
    }
  }

  /**
   * Returns the currently attached document without exposing private properties.
   */
  public getDocument(): ProjectDocument | null {
    return this.document;
  }

  /**
   * Resizes the backing store of the canvas to support high-DPI (Retina) displays
   * while maintaining the document's logical coordinate space.
   */
  public resize(width: number, height: number): void {
    if (this.isDisposed) return;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      console.warn('[CanvasEngine] resize called with invalid dimensions:', { width, height });
      return;
    }

    const dpr = this.devicePixelRatio;
    const targetWidth = Math.round(width * dpr);
    const targetHeight = Math.round(height * dpr);

    // Only modify physical canvas dimensions if they changed, as setting width/height resets canvas state
    if (this.canvas.width !== targetWidth || this.canvas.height !== targetHeight) {
      this.canvas.width = targetWidth;
      this.canvas.height = targetHeight;
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }

    // Scale context so drawing calls operate in logical document coordinates
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Clears the entire canvas viewport.
   */
  public clear(): void {
    if (this.isDisposed) return;

    const dpr = this.devicePixelRatio;
    const width = this.canvas.width / dpr;
    const height = this.canvas.height / dpr;

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();

    if (this.backgroundColor) {
      this.ctx.save();
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.fillStyle = this.backgroundColor;
      this.ctx.fillRect(0, 0, width, height);
      this.ctx.restore();
    }

    // Ensure coordinate system remains in high-DPI logical scale
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /**
   * Sets the device pixel ratio multiplier and resizes the backing store if a document is present.
   */
  public setDevicePixelRatio(dpr: number): void {
    if (this.isDisposed) return;
    if (!Number.isFinite(dpr) || dpr <= 0) return;

    this.devicePixelRatio = dpr;
    if (this.document) {
      this.resize(this.document.width, this.document.height);
    }
  }

  // --------------------------------------------------------------------------
  // Decoded Asset Registry API
  // --------------------------------------------------------------------------

  /**
   * Registers a decoded CanvasImageSource (ImageBitmap, HTMLImageElement, HTMLCanvasElement)
   * for a given asset ID.
   */
  public registerImageSource(assetId: string, imageSource: CanvasImageSource): void {
    if (this.isDisposed) return;
    if (!assetId || !imageSource) return;
    this.imageRegistry.set(assetId, imageSource);
    this.assetVersions.set(assetId, (this.assetVersions.get(assetId) ?? 0) + 1);
    this.adjustmentCache.clear();
    this.lightingCache.clear();
  }

  /**
   * Unregisters a decoded image source.
   */
  public unregisterImageSource(assetId: string): void {
    this.imageRegistry.delete(assetId);
    this.assetVersions.delete(assetId);
    this.adjustmentCache.clear();
    this.lightingCache.clear();
  }

  /**
   * Checks if an image source is currently registered for the given asset ID.
   */
  public hasImageSource(assetId: string): boolean {
    return this.imageRegistry.has(assetId);
  }

  /**
   * Retrieves a decoded image source from the runtime registry if available.
   */
  public getImageSource(assetId: string): CanvasImageSource | undefined {
    return this.imageRegistry.get(assetId);
  }

  /**
   * Clears all registered image sources from runtime memory.
   */
  public clearImageSources(): void {
    this.imageRegistry.clear();
    this.assetVersions.clear();
    this.adjustmentCache.clear();
    this.lightingCache.clear();
  }

  // --------------------------------------------------------------------------
  // Core Render Pipeline
  // --------------------------------------------------------------------------

  /**
   * Executes a deterministic, top-to-bottom rendering pass of the current document.
   */
  public render(): void {
    if (this.isDisposed) {
      console.warn('[CanvasEngine] render called on a disposed engine.');
      return;
    }

    if (!this.document) {
      this.clear();
      return;
    }

    const doc = this.document;

    // Reset canvas to clear state before drawing
    this.clear();

    const rootLayerIds = doc.rootLayerIds;
    if (!Array.isArray(rootLayerIds) || rootLayerIds.length === 0) {
      return;
    }

    // Traverse root layers in bottom-to-top rendering order
    for (const rootId of rootLayerIds) {
      const layer = doc.layers[rootId];
      if (layer) {
        this.renderLayerNode(doc, layer, true);
      }
    }
  }

  /**
   * Renders a single layer node (or group node recursively), inheriting
   * visibility, transform, and opacity from parent containers.
   */
  private renderLayerNode(
    doc: ProjectDocument,
    layer: LayerNode,
    parentEffectiveVisible: boolean
  ): void {
    // 1. Inherited visibility check
    const effectiveVisible = parentEffectiveVisible && layer.visible;
    if (!effectiveVisible) {
      return;
    }

    // 2. Layer opacity validation
    const layerOpacity = Math.max(0, Math.min(1, layer.opacity));
    if (layerOpacity <= 0) {
      return;
    }

    // 3. Context isolation
    this.ctx.save();

    try {
      // 4. Apply blend mode (mapped to globalCompositeOperation)
      this.ctx.globalCompositeOperation = resolveCompositeOperation(layer.blendMode);

      // 5. Apply inherited opacity
      // In Canvas 2D, setting ctx.globalAlpha multiplies against the existing globalAlpha
      // established by any parent groups. Setting ctx.globalAlpha *= layerOpacity ensures
      // opacity is multiplied exactly once per hierarchy level, avoiding double-application.
      this.ctx.globalAlpha *= layerOpacity;

      // 6. Apply affine 2D transform
      this.applyTransform(layer.transform);

      // 7. Render by layer classification
      switch (layer.type) {
        case 'raster':
        case 'harmonized_clone':
          this.renderRasterLayer(doc, layer);
          break;

        case 'group':
          this.renderGroupLayer(doc, layer, effectiveVisible);
          break;

        case 'adjustment':
          // Explicitly unsupported in Canvas 2D Step 4 core renderer.
          // Adjustment layers will be supported in future steps via WebGL / OffscreenCanvas passes.
          break;

        default:
          break;
      }
    } finally {
      // 8. Always restore canvas state to prevent leaking transforms, opacity, or blend modes
      this.ctx.restore();
    }
  }

  /**
   * Returns the underlying canvas element.
   */
  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Returns whether the engine has been disposed.
   */
  public isEngineDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Renders a raster or harmonized_clone layer by resolving its asset from the registry.
   */
  private renderRasterLayer(doc: ProjectDocument, layer: LayerNode): void {
    if (!layer.sourceAssetId) {
      return;
    }

    // Resolve decoded CanvasImageSource from registry
    const rawImageSource = this.imageRegistry.get(layer.sourceAssetId);
    if (!rawImageSource) {
      // Missing or not-yet-decoded image resources are safely skipped
      return;
    }

    const assetMeta = doc.assets ? doc.assets[layer.sourceAssetId] : undefined;

    // Determine pixel dimensions, with robust fallback to intrinsic image dimensions
    const intrinsicWidth =
      typeof (rawImageSource as HTMLImageElement).naturalWidth === 'number' && (rawImageSource as HTMLImageElement).naturalWidth > 0
        ? (rawImageSource as HTMLImageElement).naturalWidth
        : typeof (rawImageSource as ImageBitmap).width === 'number'
        ? (rawImageSource as ImageBitmap).width
        : 0;

    const intrinsicHeight =
      typeof (rawImageSource as HTMLImageElement).naturalHeight === 'number' && (rawImageSource as HTMLImageElement).naturalHeight > 0
        ? (rawImageSource as HTMLImageElement).naturalHeight
        : typeof (rawImageSource as ImageBitmap).height === 'number'
        ? (rawImageSource as ImageBitmap).height
        : 0;

    const width = layer.sourceWidth ?? assetMeta?.width ?? intrinsicWidth;
    const height = layer.sourceHeight ?? assetMeta?.height ?? intrinsicHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    // Apply non-destructive color adjustments (cached per layer state)
    let imageSource: CanvasImageSource = rawImageSource;
    if (isAdjustmentActive(layer.adjustments)) {
      const cacheKey = `${this.assetVersions.get(layer.sourceAssetId) ?? 0}:${width}x${height}:${computeAdjustmentCacheKey(layer.id, layer.sourceAssetId, layer.adjustments)}`;
      const cached = this.adjustmentCache.get(layer.id);
      if (cached && cached.key === cacheKey) {
        imageSource = cached.canvas;
      } else {
        const adjustedCanvas = processColorAdjustments(rawImageSource, layer.adjustments!, width, height);
        if (adjustedCanvas) {
          this.adjustmentCache.set(layer.id, { key: cacheKey, canvas: adjustedCanvas });
          imageSource = adjustedCanvas;
        }
      }
    }

    // Apply optional per-layer lighting after color grading and before the mask.
    // Coordinates are local to the untransformed layer raster.
    if (layer.lighting?.enabled) {
      const lighting = layer.lighting;
      const sourceVersion = this.assetVersions.get(layer.sourceAssetId) ?? 0;
      const adjustmentKey = isAdjustmentActive(layer.adjustments)
        ? computeAdjustmentCacheKey(layer.id, layer.sourceAssetId, layer.adjustments)
        : 'no-adjustments';
        
      let shouldApplyLighting = true;
      let maskSource: CanvasImageSource | undefined;
      let maskKey = 'no-mask';
      let maskVersion = 0;

      if (lighting.maskAssetId) {
        maskSource = this.imageRegistry.get(lighting.maskAssetId);
        if (!maskSource) {
          console.warn('[CanvasEngine] Lighting mask asset not found:', lighting.maskAssetId);
          shouldApplyLighting = false;
        } else {
          maskKey = lighting.maskAssetId;
          maskVersion = this.assetVersions.get(lighting.maskAssetId) ?? 0;
        }
      }
      
      if (shouldApplyLighting) {
        const lightingKey = JSON.stringify([
          layer.sourceAssetId, sourceVersion, width, height, adjustmentKey,
          lighting.x, lighting.y, lighting.angle, lighting.intensity,
          lighting.radius, lighting.softness, lighting.color, lighting.blendMode,
          maskKey, maskVersion
        ]);
        
        const cachedLighting = this.lightingCache.get(layer.id);
        if (cachedLighting?.key === lightingKey) {
          imageSource = cachedLighting.canvas;
        } else {
          // LightingEngine accepts only HTMLCanvasElement, so normalize any
          // registered CanvasImageSource without modifying its pixel buffer.
          const sourceCanvas = document.createElement('canvas');
          sourceCanvas.width = Math.max(1, Math.round(width));
          sourceCanvas.height = Math.max(1, Math.round(height));
          const sourceCtx = sourceCanvas.getContext('2d');
          if (sourceCtx) {
            sourceCtx.drawImage(imageSource, 0, 0, sourceCanvas.width, sourceCanvas.height);
            try {
              const litCanvas = LightingEngine.render(sourceCanvas, lighting, maskSource);
              this.lightingCache.set(layer.id, { key: lightingKey, canvas: litCanvas });
              imageSource = litCanvas;
            } catch (error) {
              // A tainted or unreadable asset must not break normal layer rendering.
              console.warn('[CanvasEngine] Lighting preview unavailable:', error);
            }
          }
        }
      }
    }

    // Check if layer has an active, enabled mask registered
    const maskAssetId = layer.mask?.isEnabled ? layer.mask.maskAssetId : undefined;
    const maskSource = maskAssetId ? this.imageRegistry.get(maskAssetId) : undefined;

    if (maskSource) {
      const scratch = this.getScratchCanvas(width, height);
      const scratchCtx = scratch.getContext('2d');
      if (scratchCtx) {
        scratchCtx.clearRect(0, 0, width, height);
        scratchCtx.drawImage(imageSource, 0, 0, width, height);
        scratchCtx.globalCompositeOperation = layer.mask?.isInverted ? 'destination-out' : 'destination-in';
        scratchCtx.drawImage(maskSource, 0, 0, width, height);
        scratchCtx.globalCompositeOperation = 'source-over';
        this.ctx.drawImage(scratch, 0, 0, width, height);
        return;
      }
    }

    // Draw image at (0, 0)
    // Note: Translation and pivot rotation/scaling origin have been established in applyTransform.
    this.ctx.drawImage(imageSource, 0, 0, width, height);
  }

  /**
   * Lazily acquires or resizes a reusable scratch offscreen canvas for layer masking.
   */
  private getScratchCanvas(width: number, height: number): HTMLCanvasElement {
    if (!this.scratchCanvas) {
      this.scratchCanvas = document.createElement('canvas');
    }
    const targetW = Math.max(1, Math.round(width));
    const targetH = Math.max(1, Math.round(height));
    if (this.scratchCanvas.width !== targetW || this.scratchCanvas.height !== targetH) {
      this.scratchCanvas.width = targetW;
      this.scratchCanvas.height = targetH;
    }
    return this.scratchCanvas;
  }

  /**
   * Renders a group layer by recursively traversing its ordered childrenIds.
   *
   * Architectural Limitation Notice:
   * True isolated group compositing (Photoshop "Normal" / isolated group blending vs
   * "Pass Through") requires allocating offscreen buffers and compositing the merged
   * group result back to the parent stage.
   * In this Canvas 2D core renderer, true isolated group compositing is not yet supported.
   * Children inherit visibility, transforms, and multiplied opacity directly via the Canvas 2D
   * transformation matrix and globalAlpha stack.
   */
  private renderGroupLayer(
    doc: ProjectDocument,
    group: LayerNode,
    effectiveVisible: boolean
  ): void {
    if (!Array.isArray(group.childrenIds) || group.childrenIds.length === 0) {
      return;
    }

    for (const childId of group.childrenIds) {
      const child = doc.layers[childId];
      if (child) {
        this.renderLayerNode(doc, child, effectiveVisible);
      }
    }
  }

  /**
   * Applies affine 2D transformation in mathematically correct Canvas 2D matrix order:
   * 1. translate(x, y)                       - Move to layer translation coordinates
   * 2. translate(originX, originY)           - Move to the specified transform pivot origin
   * 3. rotate(radians)                       - Rotate around the pivot origin
   * 4. skew(skewX, skewY)                    - Skew around the pivot origin
   * 5. scale(scaleX, scaleY)                 - Scale around the pivot origin
   * 6. translate(-originX, -originY)         - Translate back from the pivot origin
   */
  private applyTransform(transform: Transform2D): void {
    if (!transform) return;

    const {
      x = 0,
      y = 0,
      scaleX = 1,
      scaleY = 1,
      rotation = 0,
      skewX = 0,
      skewY = 0,
      originX = 0,
      originY = 0,
    } = transform;

    // 1. Translate to layer position (x, y)
    this.ctx.translate(x, y);

    // 2. Translate to transform pivot origin
    if (originX !== 0 || originY !== 0) {
      this.ctx.translate(originX, originY);
    }

    // 3. Rotate around pivot origin (degrees to radians)
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      this.ctx.rotate(rad);
    }

    // 4. Skew around pivot origin
    if (skewX !== 0 || skewY !== 0) {
      const tanSkewX = Math.tan((skewX * Math.PI) / 180);
      const tanSkewY = Math.tan((skewY * Math.PI) / 180);
      this.ctx.transform(1, tanSkewY, tanSkewX, 1, 0, 0);
    }

    // 5. Scale around pivot origin
    if (scaleX !== 1 || scaleY !== 1) {
      this.ctx.scale(scaleX, scaleY);
    }

    // 6. Translate back from pivot origin
    if (originX !== 0 || originY !== 0) {
      this.ctx.translate(-originX, -originY);
    }
  }

  // --------------------------------------------------------------------------
  // Teardown & Disposal
  // --------------------------------------------------------------------------

  /**
   * Disposes of the engine, releasing registered runtime image references
   * and preventing any subsequent rendering passes.
   */
  public dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.document = null;
    this.imageRegistry.clear();
    this.assetVersions.clear();
    this.adjustmentCache.clear();
    this.lightingCache.clear();
    if (this.scratchCanvas) {
      this.scratchCanvas.width = 1;
      this.scratchCanvas.height = 1;
      this.scratchCanvas = null;
    }
    this.clear();
  }
}
