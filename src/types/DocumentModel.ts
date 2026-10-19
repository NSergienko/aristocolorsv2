/**
 * AristoColors v2 - Project Document Model & Scene Graph Definitions
 *
 * This file defines the serializable, normalized document data structures
 * for the photobashing canvas engine, layer scene graph, non-destructive
 * adjustments, vector selections, and neural harmonization workflows.
 *
 * All types in this file are strictly JSON-serializable to enable effortless
 * persistence to IndexedDB, history snapshotting (undo/redo), and lossless
 * serialization. Runtime pixel buffers (ImageBitmap, Canvas, WebGL textures)
 * are managed decoupled via stable asset and buffer IDs.
 */

// ============================================================================
// 1. Core Canvas & Color Space Types
// ============================================================================

export type ColorSpace = 'srgb' | 'display-p3';

export interface CanvasDimensions {
  /** Width in document pixels (>= 1, typically 512 to 8192) */
  width: number;
  /** Height in document pixels (>= 1, typically 512 to 8192) */
  height: number;
  /** Output dots-per-inch for print/export (standard: 72, 150, 300) */
  dpi: number;
}

// ============================================================================
// 2. Transform & Geometry Types
// ============================================================================

export interface Transform2D {
  /** Translation along X axis in document pixel units */
  x: number;
  /** Translation along Y axis in document pixel units */
  y: number;
  /** Horizontal scale multiplier (1.0 = 100%, negative values flip horizontally) */
  scaleX: number;
  /** Vertical scale multiplier (1.0 = 100%, negative values flip vertically) */
  scaleY: number;
  /** Clockwise rotation angle in degrees (-360.0 to 360.0) */
  rotation: number;
  /** Horizontal skew factor in degrees (-89.0 to 89.0, default 0) */
  skewX: number;
  /** Vertical skew factor in degrees (-89.0 to 89.0, default 0) */
  skewY: number;
  /** Normalized pivot X coordinate for rotation and scaling (0.0 = left, 0.5 = center, 1.0 = right) */
  originX: number;
  /** Normalized pivot Y coordinate for rotation and scaling (0.0 = top, 0.5 = center, 1.0 = bottom) */
  originY: number;
}

export interface BoundingBox2D {
  /** Top-left X coordinate in document space */
  x: number;
  /** Top-left Y coordinate in document space */
  y: number;
  /** Width in document space pixels (>= 0) */
  width: number;
  /** Height in document space pixels (>= 0) */
  height: number;
}

export interface Point2D {
  /** Coordinate along the X axis */
  x: number;
  /** Coordinate along the Y axis */
  y: number;
}

// ============================================================================
// 3. Layer Nodes, Blend Modes & Adjustments
// ============================================================================

/**
 * Functional classification of a layer in the document scene graph.
 */
export type LayerType =
  | 'raster'           // Standard bitmap layer containing photo cutout, paint, or generated asset
  | 'group'            // Structural folder containing ordered children layer IDs
  | 'adjustment'       // Non-destructive adjustment layer affecting layers rendered beneath it
  | 'harmonized_clone'; // Cloned fragment derived from an AristoColors neural color match pass

/**
 * Compositing blend modes mapped to Canvas 2D `globalCompositeOperation`
 * and hardware shader blending pipelines.
 *
 * The future Canvas 2D renderer must map 'normal' to `globalCompositeOperation = 'source-over'`.
 * All other blend modes match standard Canvas 2D compositing operation identifiers.
 */
export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'color-dodge'
  | 'color-burn'
  | 'hard-light'
  | 'soft-light'
  | 'difference'
  | 'exclusion'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

/**
 * Color input/output levels configuration for non-destructive grading.
 */
export interface LevelAdjustmentChannel {
  /** Input black point cutoff [0, 255], default 0 */
  blackIn: number;
  /** Input white point cutoff [0, 255], default 255 */
  whiteIn: number;
  /** Midtone gamma curve exponent [0.1, 9.9], default 1.0 */
  gamma: number;
  /** Output black level clamp [0, 255], default 0 */
  blackOut: number;
  /** Output white level clamp [0, 255], default 255 */
  whiteOut: number;
}

/**
 * Non-destructive raster adjustment parameters.
 * All properties are unit-bounded numerical values suitable for both
 * Canvas 2D filter pipelines and WebGL fragment shaders.
 */
export interface LayerAdjustments {
  /** Brightness adjustment offset: [-100, 100], default 0 */
  brightness: number;
  /** Contrast adjustment multiplier: [-100, 100], default 0 */
  contrast: number;
  /** Color saturation adjustment: [-100, 100], default 0 (-100 = full grayscale) */
  saturation: number;
  /** Hue rotation in degrees: [-180, 180], default 0 */
  hue: number;
  /** White balance temperature: [-100, 100], default 0 (-100 = cool blue, +100 = warm amber) */
  temperature: number;
  /** White balance tint: [-100, 100], default 0 (-100 = green, +100 = magenta) */
  tint: number;
  /** Exposure compensation in photographic EV stops: [-5.0, 5.0], default 0.0 */
  exposure?: number;
  /** Highlights compression/recovery: [-100, 100], default 0 */
  highlights?: number;
  /** Shadows compression/recovery: [-100, 100], default 0 */
  shadows?: number;
  /** Vibrance (intelligent saturation for skin tones): [-100, 100], default 0 */
  vibrance?: number;
  /** Combined RGB tone curve levels */
  levels?: LevelAdjustmentChannel;
  /** RGB Curves Preset */
  curvePreset?: 'linear' | 's-curve' | 'matte' | 'cold-teal' | 'warm-sunset';
}

/**
 * Non-destructive 2D lighting settings for a raster layer.
 * Coordinates and radius are in the layer's untransformed source pixel space.
 * The rendering engine interprets these settings; no pixel data is stored here.
 */
export interface LayerLighting {
  /** Whether lighting is applied during layer rendering. */
  enabled: boolean;
  /** Light center X in source image pixels. */
  x: number;
  /** Light center Y in source image pixels. */
  y: number;
  /** Direction in degrees (0 = right, 90 = down). */
  angle: number;
  /** Effect intensity [0, 1]. */
  intensity: number;
  /** Light influence radius in source image pixels (>= 0). */
  radius: number;
  /** Falloff softness [0, 1]. */
  softness: number;
  /** CSS color string, e.g. '#ffffff'. */
  color: string;
  /** RGB blend operation within the light's area. */
  blendMode: 'screen' | 'multiply' | 'soft-light';
  /** Optional asset ID of a grayscale influence mask. */
  maskAssetId?: string;
}

/**
 * Serializable 8-bit alpha mask metadata attached to a layer node.
 * Pixel mask data is backed by an IndexedDB binary asset storage key.
 */
export interface LayerMask {
  /** Unique identifier for the mask entity */
  id: string;
  /** Reference key to binary mask asset in project storage (8-bit grayscale alpha) */
  maskAssetId: string;
  /** Mask width in pixels (typically matches layer raster bounds or document bounds) */
  width: number;
  /** Mask height in pixels */
  height: number;
  /** Whether the mask is actively evaluated during compositing */
  isEnabled: boolean;
  /** Whether mask moves synchronously with layer transforms */
  isLinked: boolean;
  /** Whether mask values invert (black becomes opaque, white becomes transparent) */
  isInverted: boolean;
  /** Mask boundary clipping state */
  isClamping: boolean;
  /** Soft edge feather radius in pixels: [0, 250], default 0 */
  feather: number;
  /** Mask density multiplier: [0.0, 1.0], default 1.0 */
  density: number;
}

/**
 * AristoColors Engine harmonization metadata stamped onto layers
 * processed with the neural or analytical photobash match pipeline.
 */
export interface HarmonizationMetadata {
  /** Indicates whether this layer was produced or altered by the AristoColors harmonization pipeline */
  isHarmonized: boolean;
  /** Target style profile used ('cyberpunk', 'ghibli-anime', 'cinematic-film', 'matte-painting', 'oil-canvas', 'custom') */
  targetStyle: string;
  /** Layer ID of the background or reference plate used as color source */
  referenceLayerId?: string;
  /** Asset ID of external style reference image, if one was provided */
  referenceAssetId?: string;
  /** Harmonization intensity blending factor: [0.0, 1.0], default 1.0 */
  intensity: number;
  /** Luminance matching strength: [0.0, 1.0], default 1.0 */
  matchLuminance: number;
  /** Atmospheric light wrap bleeding intensity: [0.0, 1.0], default 0.0 */
  ambientWrap: number;
  /** Grain matching strength: [0.0, 1.0], default 0.0 */
  grainMatch: number;
  /** Unix timestamp (ms) when harmonization occurred */
  harmonizedAt: number;
}

/**
 * Normalized Scene Graph Layer Node.
 * Fully serializable, independent of DOM, Canvas or WebGL instances.
 */
export interface LayerNode {
  /** Unique UUID of the layer node */
  id: string;
  /** Parent folder group layer ID, or null if placed at document root */
  parentId: string | null;
  /** Display name of the layer in the Studio hierarchy (e.g., 'Character Cutout', 'Atmosphere') */
  name: string;
  /** Node classification */
  type: LayerType;
  /** Layer visibility toggle */
  visible: boolean;
  /** Layer edit lock toggle (prevents transformation and stroke editing) */
  locked: boolean;
  /** Layer opacity multiplier: [0.0, 1.0] where 1.0 is 100% opaque */
  opacity: number;
  /** Compositing blend mode */
  blendMode: BlendMode;
  /** Affine 2D transformation matrix parameters */
  transform: Transform2D;
  /** Optional non-destructive raster mask */
  mask: LayerMask | null;

  // --- Raster Storage References ---
  /**
   * Reference ID to the stored binary image asset in project asset storage (IndexedDB).
   * Populated when type is 'raster' or 'harmonized_clone'.
   */
  sourceAssetId?: string;
  /** Original native pixel width of the raster asset before layer scaling */
  sourceWidth?: number;
  /** Original native pixel height of the raster asset before layer scaling */
  sourceHeight?: number;

  // --- Non-destructive Adjustments ---
  /** Non-destructive color, tone, and grading adjustments */
  adjustments?: LayerAdjustments;

  /** Optional, non-destructive lighting effect for raster layers. */
  lighting?: LayerLighting;

  // --- Folder Group Hierarchy ---
  /**
   * Ordered child layer IDs (from bottom to top) if type is 'group'.
   * Empty or undefined for leaf raster and adjustment nodes.
   */
  childrenIds?: string[];
  /** Whether the folder group is expanded in the Studio layer panel */
  isExpanded?: boolean;

  // --- Photobashing & Harmonization Records ---
  /** AristoColors neural or palette harmonization provenance metadata */
  harmonization?: HarmonizationMetadata;
}

// ============================================================================
// 4. Selection State & Contour Geometry
// ============================================================================

export type SelectionGeometryType = 'rectangle' | 'ellipse' | 'lasso' | 'polygon';

export interface SelectionState {
  /** Type of geometry defining the selection border */
  type: SelectionGeometryType;
  /** Bounding box rectangle enclosing the active selection in document coordinates */
  bounds: BoundingBox2D;
  /** Ordered vector contour vertices for lasso and polygon selections */
  polygonPoints?: Point2D[];
  /** Feather radius in document pixels applied to selection perimeter: [0, 100] */
  feather: number;
  /** Whether the selection is active and displaying marching ants */
  isActive: boolean;
  /**
   * Optional asset storage key referencing a rasterized 8-bit alpha mask of the selection
   * (used for complex feathered or brush-based quick selections).
   */
  maskAssetId?: string;
  /** Whether selection boundary is inverted */
  isInverted?: boolean;
}

// ============================================================================
// 5. Assets Catalog & Binary Asset References
// ============================================================================

export type AssetMimeType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/svg+xml'
  | 'application/octet-stream';

/**
 * Serializable metadata descriptor for assets stored in persistent IndexedDB storage.
 */
export interface ProjectAsset {
  /** Unique asset UUID */
  id: string;
  /** Original filename or human-readable label */
  name: string;
  /** Media type */
  mimeType: AssetMimeType;
  /** Image width in pixels */
  width: number;
  /** Image height in pixels */
  height: number;
  /** File size in bytes */
  sizeBytes: number;
  /** Storage key in IndexedDB object store (`project_assets`) */
  storageKey: string;
  /** Hash fingerprint for deduplication and cache validation */
  sha256?: string;
  /** Unix timestamp (ms) when asset was imported or generated */
  createdAt: number;
}

// ============================================================================
// 6. Project Document Root
// ============================================================================

/**
 * Root Project Document Model.
 *
 * Fully serializable data representation of an AristoColors v2 photobash project.
 * Compatible with Zustand state stores, Immer immutability drafts, IndexedDB
 * persistence, and undo/redo history snapshot deltas.
 */
export interface ProjectDocument {
  /** Unique project UUID (matches project route id) */
  id: string;
  /** Document title */
  name: string;
  /** Canvas width in document pixels (>= 1) */
  width: number;
  /** Canvas height in document pixels (>= 1) */
  height: number;
  /** Output dots-per-inch (e.g., 72 or 300) */
  dpi: number;
  /** Color space profile */
  colorSpace: ColorSpace;
  /** Document creation timestamp in milliseconds */
  createdAt: number;
  /** Document last modification timestamp in milliseconds */
  updatedAt: number;

  /**
   * Ordered list of top-level layer IDs, rendered from bottom (index 0) to top.
   */
  rootLayerIds: string[];

  /**
   * Normalized lookup map of all layers (both root layers and nested group children)
   * indexed by layer UUID.
   */
  layers: Record<string, LayerNode>;

  /** ID of the currently focused/active layer in the Studio hierarchy */
  activeLayerId: string | null;

  /** Multi-selection array of layer IDs for batch transforms or grouping */
  selectedLayerIds: string[];

  /** Active vector or raster selection state, or null if no selection exists */
  selection: SelectionState | null;

  /**
   * Normalized dictionary of asset descriptors embedded or referenced by the project,
   * indexed by asset UUID.
   */
  assets: Record<string, ProjectAsset>;

  /**
   * Viewport presentation state (saved for seamless workspace restoration).
   */
  viewport?: {
    /** Zoom magnification level (e.g., 1.0 = 100%, 0.5 = 50%, 2.0 = 200%) */
    zoom: number;
    /** Canvas viewport pan horizontal offset in display pixels */
    panX: number;
    /** Canvas viewport pan vertical offset in display pixels */
    panY: number;
  };
}
