/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Layers,
  Image as ImageIcon,
  Save,
  Download,
  Sliders,
  Move,
  Hand,
  Paintbrush,
  SquareDot,
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ChevronRight,
  ChevronDown,
  Sparkles,
  BookmarkPlus,
  Loader2,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { useDocumentStore } from '../state/useDocumentStore.ts';
import { CanvasEngine } from '../engine/CanvasEngine.ts';
import {
  loadDocument,
  saveDocument,
  storeBinaryAsset,
  loadBinaryAsset,
  createDefaultProjectDocument,
} from '../services/DocumentPersistence.ts';
import {
  generateCompositeThumbnailFromCanvas,
  generateCompositeThumbnailFromDocument,
  computeDocumentContentBounds,
  dataUrlToBlob,
  setCachedThumbnail,
} from '../utils/thumbnailGenerator.ts';
import type {
  ProjectDocument,
  LayerNode,
  ProjectAsset,
  BlendMode,
  LayerMask,
  LayerAdjustments,
  LayerLighting,
} from '../types/DocumentModel.ts';
import { CANVAS_BLEND_MODE_MAP } from '../engine/CanvasEngine.ts';
import {
  CURVE_PRESETS,
  CurvePresetId,
  isAdjustmentActive,
  saveLayerToAssetsLibrary,
} from '../services/ColorAdjustmentService.ts';
import { UIButton } from '../ui/UIButton.tsx';
import { UILoader } from '../ui/UILoader.tsx';
import { LayerMaskModal } from '../components/LayerMaskModal.tsx';

const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'multiply', label: 'Multiply' },
  { value: 'screen', label: 'Screen' },
  { value: 'overlay', label: 'Overlay' },
  { value: 'darken', label: 'Darken' },
  { value: 'lighten', label: 'Lighten' },
  { value: 'color-dodge', label: 'Color Dodge' },
  { value: 'color-burn', label: 'Color Burn' },
  { value: 'hard-light', label: 'Hard Light' },
  { value: 'soft-light', label: 'Soft Light' },
  { value: 'difference', label: 'Difference' },
  { value: 'exclusion', label: 'Exclusion' },
  { value: 'hue', label: 'Hue' },
  { value: 'saturation', label: 'Saturation' },
  { value: 'color', label: 'Color' },
  { value: 'luminosity', label: 'Luminosity' },
];

/**
 * Transforms canvas document coordinates into layer-local mask pixel coordinates,
 * correctly handling layer translation, rotation, and scaling.
 */
function docToLayerCoords(
  docX: number,
  docY: number,
  layer: LayerNode
): { x: number; y: number } {
  const lx = layer.transform.x || 0;
  const ly = layer.transform.y || 0;
  const scaleX = layer.transform.scaleX || 1;
  const scaleY = layer.transform.scaleY || 1;
  const rotation = layer.transform.rotation || 0;
  const originX = layer.transform.originX || 0;
  const originY = layer.transform.originY || 0;

  // 1. Shift by layer translation
  let dx = docX - lx;
  let dy = docY - ly;

  // 2. Shift to pivot origin
  dx -= originX;
  dy -= originY;

  // 3. Inverse rotate if layer is rotated
  if (rotation !== 0) {
    const rad = (-rotation * Math.PI) / 180;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    dx = rx;
    dy = ry;
  }

  // 4. Inverse scale to layer native pixel space
  const localX = (dx / scaleX) + originX;
  const localY = (dy / scaleY) + originY;

  return { x: localX, y: localY };
}

/**
 * Paints a continuous, anti-aliased mask stroke between two points.
 * - Black erases alpha (destination-out), hiding parts of the layer.
 * - White restores alpha (source-over), revealing parts of the layer.
 */
function paintMaskStroke(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  radius: number,
  hardness: number,
  color: 'black' | 'white'
): void {
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const step = Math.max(1, radius * 0.2);
  const numSteps = Math.ceil(dist / step);

  ctx.save();
  if (color === 'black') {
    // Hide layer by cutting out alpha
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    // Reveal layer by restoring opaque white
    ctx.globalCompositeOperation = 'source-over';
  }

  for (let i = 0; i <= numSteps; i++) {
    const t = numSteps === 0 ? 1 : i / numSteps;
    const x = fromX + (toX - fromX) * t;
    const y = fromY + (toY - fromY) * t;

    if (hardness >= 0.95) {
      ctx.fillStyle = color === 'black' ? '#000000' : '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const innerRadius = radius * Math.max(0, hardness);
      const grad = ctx.createRadialGradient(x, y, innerRadius, x, y, radius);
      if (color === 'black') {
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}

export const StudioWorkspace: React.FC = () => {
  const {
    activeProjectId,
    activeProject,
    projects,
    openProject,
    navigateTo,
    updateProject,
    addToast,
  } = useShell();

  // Document SSOT from Zustand store
  const doc = useDocumentStore((state) => state.document);
  const setStoreDocument = useDocumentStore((state) => state.setDocument);
  const addStoreLayer = useDocumentStore((state) => state.addLayer);
  const removeStoreLayer = useDocumentStore((state) => state.removeLayer);
  const updateStoreLayer = useDocumentStore((state) => state.updateLayer);
  const setStoreActiveLayer = useDocumentStore((state) => state.setActiveLayer);
  const addStoreAsset = useDocumentStore((state) => state.addAsset);

  // Active Layer node lookup
  const activeLayer = doc && doc.activeLayerId ? doc.layers[doc.activeLayerId] : null;

  // Loading & sync state
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<number | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  // Viewport transforms (Pan & Zoom)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [activeTool, setActiveTool] = useState<'move' | 'pan' | 'brush'>('move');
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Move Tool: Layer dragging state
  const [isDraggingLayer, setIsDraggingLayer] = useState(false);
  const dragStartRef = useRef<{
    startX: number;
    startY: number;
    layerStartX: number;
    layerStartY: number;
    layerId: string;
  } | null>(null);

  // Move Tool: Interactive corner handle resizing state
  type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';
  const [isResizingLayer, setIsResizingLayer] = useState(false);
  const resizeStartRef = useRef<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    layerId: string;
    initialX: number;
    initialY: number;
    initialScaleX: number;
    initialScaleY: number;
    baseWidth: number;
    baseHeight: number;
    rotation: number;
  } | null>(null);

  // Layer Mask & Brush Tool State
  const [activeEditTarget, setActiveEditTarget] = useState<'layer' | 'mask'>('layer');
  const [brushColor, setBrushColor] = useState<'black' | 'white'>('black');
  const [brushSize, setBrushSize] = useState<number>(50);
  const [brushHardness, setBrushHardness] = useState<number>(0.8);
  const [isPainting, setIsPainting] = useState(false);
  const lastPaintPosRef = useRef<{ x: number; y: number } | null>(null);
  const maskCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [maskPreviews, setMaskPreviews] = useState<Record<string, string>>({});
  const [mouseCanvasPos, setMouseCanvasPos] = useState<{ x: number; y: number } | null>(null);

  // Universal Layer Mask Editor Modal State (react-canvas-masker)
  const [isMaskModalOpen, setIsMaskModalOpen] = useState<boolean>(false);
  const [maskModalImageUrl, setMaskModalImageUrl] = useState<string | null>(null);

  // Right sidebar layers panel collapsed state
  const [isLayersPanelOpen, setIsLayersPanelOpen] = useState(true);

  // Layer thumbnail previews cached as object URLs keyed by assetId
  const [assetThumbnails, setAssetThumbnails] = useState<Record<string, string>>({});
  const assetThumbnailsRef = useRef<Record<string, string>>({});

  // DOM References
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleSaveDocumentRef = useRef<() => void>(() => {});

  // --------------------------------------------------------------------------
  // 1. Helper: Calculate Fit-to-Viewport Zoom
  // --------------------------------------------------------------------------
  const fitToViewport = useCallback(
    (canvasWidth: number, canvasHeight: number) => {
      if (!viewportRef.current || canvasWidth <= 0 || canvasHeight <= 0) return;
      const vpWidth = viewportRef.current.clientWidth - 80;
      const vpHeight = viewportRef.current.clientHeight - 80;

      if (vpWidth <= 0 || vpHeight <= 0) return;

      const scaleX = vpWidth / canvasWidth;
      const scaleY = vpHeight / canvasHeight;
      const optimalZoom = Math.min(scaleX, scaleY);

      // Round to 2 decimal places and clamp between 5% and 400%
      const clampedZoom = Math.max(0.05, Math.min(4, Math.round(optimalZoom * 100) / 100));
      setZoom(clampedZoom);
      setPan({ x: 0, y: 0 });
    },
    []
  );

  const hasInitialFittedRef = useRef(false);

  // Reset initial fit flag when active project changes
  useEffect(() => {
    hasInitialFittedRef.current = false;
  }, [activeProjectId]);

  // Auto-fit document when viewport layout is measured
  useEffect(() => {
    if (!doc || hasInitialFittedRef.current) return;

    const tryFit = () => {
      if (
        viewportRef.current &&
        viewportRef.current.clientWidth > 0 &&
        viewportRef.current.clientHeight > 0
      ) {
        fitToViewport(doc.width, doc.height);
        hasInitialFittedRef.current = true;
        return true;
      }
      return false;
    };

    if (tryFit()) return;

    if (viewportRef.current && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
            if (!hasInitialFittedRef.current && doc) {
              fitToViewport(doc.width, doc.height);
              hasInitialFittedRef.current = true;
            }
            observer.disconnect();
          }
        }
      });
      observer.observe(viewportRef.current);
      return () => observer.disconnect();
    }
  }, [doc, fitToViewport]);

  // --------------------------------------------------------------------------
  // 2. Texture Synchronization and Render Pipeline
  // --------------------------------------------------------------------------
  const syncAssetsAndRender = useCallback(async (targetDoc: ProjectDocument) => {
    if (!targetDoc) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Ensure engine is active and bound to the current canvas element
    if (
      !engineRef.current ||
      engineRef.current.isEngineDisposed() ||
      engineRef.current.getCanvas() !== canvas
    ) {
      if (engineRef.current) {
        engineRef.current.dispose();
      }
      engineRef.current = new CanvasEngine(canvas, {
        backgroundColor: '#131724',
        devicePixelRatio: window.devicePixelRatio || 1,
      });
    }

    const engine = engineRef.current;
    engine.setDocument(targetDoc);

    const assets = targetDoc.assets || {};
    const newThumbs: Record<string, string> = {};

    for (const [assetId, assetMeta] of Object.entries(assets)) {
      try {
        const needsSource = !engine.hasImageSource(assetId);
        const needsThumb = !assetThumbnailsRef.current[assetId];

        if (needsSource || needsThumb) {
          const blob = await loadBinaryAsset(assetMeta.storageKey || assetId);
          if (blob) {
            if (needsThumb) {
              const url = URL.createObjectURL(blob);
              assetThumbnailsRef.current[assetId] = url;
              newThumbs[assetId] = url;
            }

            if (needsSource) {
              try {
                if (typeof createImageBitmap === 'function') {
                  const bitmap = await createImageBitmap(blob);
                  engine.registerImageSource(assetId, bitmap);
                } else {
                  throw new Error('createImageBitmap unavailable');
                }
              } catch {
                const img = new Image();
                const url = assetThumbnailsRef.current[assetId] || URL.createObjectURL(blob);
                await new Promise<void>((resolve, reject) => {
                  img.onload = () => resolve();
                  img.onerror = reject;
                  img.src = url;
                });
                engine.registerImageSource(assetId, img);
              }
            }
          }
        }
      } catch (err) {
        console.warn(`[StudioWorkspace] Failed loading asset "${assetId}":`, err);
      }
    }

    if (Object.keys(newThumbs).length > 0) {
      setAssetThumbnails((prev) => ({ ...prev, ...newThumbs }));
    }

    // Synchronize and restore layer masks from IndexedDB
    for (const layer of Object.values(targetDoc.layers)) {
      if (layer?.mask?.maskAssetId) {
        const maskAssetId = layer.mask.maskAssetId;
        if (!maskCanvasesRef.current.has(maskAssetId)) {
          try {
            const maskBlob = await loadBinaryAsset(maskAssetId);
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = layer.mask.width || layer.sourceWidth || targetDoc.width;
            maskCanvas.height = layer.mask.height || layer.sourceHeight || targetDoc.height;
            const mCtx = maskCanvas.getContext('2d');
            if (mCtx) {
              if (maskBlob) {
                const img = new Image();
                const url = URL.createObjectURL(maskBlob);
                await new Promise<void>((resolve) => {
                  img.onload = () => {
                    mCtx.drawImage(img, 0, 0);
                    URL.revokeObjectURL(url);
                    resolve();
                  };
                  img.onerror = () => {
                    mCtx.fillStyle = '#ffffff';
                    mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                    URL.revokeObjectURL(url);
                    resolve();
                  };
                  img.src = url;
                });
              } else {
                mCtx.fillStyle = '#ffffff';
                mCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
              }
            }
            maskCanvasesRef.current.set(maskAssetId, maskCanvas);
            engine.registerImageSource(maskAssetId, maskCanvas);
            setMaskPreviews((prev) => ({
              ...prev,
              [maskAssetId]: maskCanvas.toDataURL(),
            }));
          } catch (mErr) {
            console.warn('[StudioWorkspace] Failed restoring mask:', mErr);
          }
        } else {
          const existing = maskCanvasesRef.current.get(maskAssetId);
          if (existing && !engine.hasImageSource(maskAssetId)) {
            engine.registerImageSource(maskAssetId, existing);
          }
        }
      }
    }

    engine.render();

    // Auto-sync composite thumbnail to project metadata if canvas is mounted
    const targetProjectId = targetDoc.id;
    if (canvas && targetProjectId && targetDoc.rootLayerIds.length > 0) {
      try {
        const compositeThumb = generateCompositeThumbnailFromCanvas(canvas, 640);
        if (compositeThumb) {
          setCachedThumbnail(targetProjectId, compositeThumb);
          updateProject(targetProjectId, {
            thumbnailUrl: compositeThumb,
            layerCount: targetDoc.rootLayerIds.length,
          });
          const blob = dataUrlToBlob(compositeThumb);
          storeBinaryAsset(`thumb_${targetProjectId}`, blob).catch(() => {});
        }
      } catch {
        // Non-blocking thumbnail sync
      }
    }
  }, [updateProject]);

  // --------------------------------------------------------------------------
  // 3. Canvas Engine Ref Callback & Cleanup
  // --------------------------------------------------------------------------
  const canvasCallbackRef = useCallback(
    (node: HTMLCanvasElement | null) => {
      canvasRef.current = node;
      if (!node) return;

      if (
        engineRef.current &&
        !engineRef.current.isEngineDisposed() &&
        engineRef.current.getCanvas() === node
      ) {
        return;
      }

      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }

      try {
        const engine = new CanvasEngine(node, {
          backgroundColor: '#131724',
          devicePixelRatio: window.devicePixelRatio || 1,
        });
        engineRef.current = engine;

        const currentDoc = useDocumentStore.getState().document;
        if (currentDoc) {
          engine.setDocument(currentDoc);
          syncAssetsAndRender(currentDoc);
        }
      } catch (err) {
        console.error('[StudioWorkspace] Failed to initialize CanvasEngine:', err);
      }
    },
    [syncAssetsAndRender]
  );

  useEffect(() => {
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // 4. Load ProjectDocument & Restore Asset Bitmaps
  // --------------------------------------------------------------------------
  useEffect(() => {
    let isCancelled = false;

    const loadProjectData = async () => {
      setIsLoading(true);
      setLoadError(null);

      // Resolve valid project ID
      const targetId = activeProjectId || (projects.length > 0 ? projects[0].id : null);
      if (!targetId) {
        setIsLoading(false);
        setLoadError('No project document selected. Return to Projects Hub to open a canvas.');
        return;
      }

      const targetMeta = projects.find((p) => p.id === targetId) || activeProject;

      try {
        let loadedDoc = await loadDocument(targetId);

        // Self-healing fallback: If metadata exists but document is missing in IndexedDB
        if (!loadedDoc && targetMeta) {
          const synthesizedDoc = createDefaultProjectDocument(targetMeta);
          await saveDocument(synthesizedDoc);
          loadedDoc = synthesizedDoc;
        }

        if (!loadedDoc) {
          throw new Error(`Project document "${targetId}" could not be retrieved from IndexedDB.`);
        }

        if (isCancelled) return;

        // Populate Zustand SSOT store
        setStoreDocument(loadedDoc);
        fitToViewport(loadedDoc.width, loadedDoc.height);
        setLastSavedTime(loadedDoc.updatedAt || Date.now());
        setIsLoading(false);

        // Synchronize texture cache and trigger render
        await syncAssetsAndRender(loadedDoc);
      } catch (err) {
        if (isCancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[StudioWorkspace] Error loading document:', err);
        setLoadError(msg);
        setIsLoading(false);
      }
    };

    loadProjectData();

    return () => {
      isCancelled = true;
    };
  }, [activeProjectId]);

  // --------------------------------------------------------------------------
  // 5. Synchronize CanvasEngine rendering when document updates
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!doc) return;
    syncAssetsAndRender(doc);
  }, [doc, syncAssetsAndRender]);

  // Keyboard tool switching: V for Move, H for Hand/Pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        handleSaveDocumentRef.current();
        return;
      }

      if (e.key === 'v' || e.key === 'V') {
        setActiveTool('move');
      } else if (e.key === 'h' || e.key === 'H') {
        setActiveTool('pan');
      } else if (e.key === 'b' || e.key === 'B') {
        setActiveTool('brush');
        setActiveEditTarget('mask');
      } else if (e.key === 'x' || e.key === 'X') {
        setBrushColor((c) => (c === 'black' ? 'white' : 'black'));
      } else if (e.key === '[') {
        setBrushSize((s) => Math.max(5, s - 5));
      } else if (e.key === ']') {
        setBrushSize((s) => Math.min(300, s + 5));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --------------------------------------------------------------------------
  // 5. Image & Background Plate Ingestion Pipeline
  // --------------------------------------------------------------------------
  const handleAddImageFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'warning',
        title: 'Unsupported File Format',
        message: 'Please choose an image file (PNG, JPEG, WebP, SVG).',
      });
      return;
    }

    try {
      setIsProcessingImage(true);
      const assetId = `asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const blob: Blob = file;

      // Cache preview thumbnail object URL immediately for UI
      const thumbUrl = URL.createObjectURL(blob);
      assetThumbnailsRef.current[assetId] = thumbUrl;
      setAssetThumbnails((prev) => ({ ...prev, [assetId]: thumbUrl }));

      // Decode image to extract true dimensions and acquire CanvasImageSource
      let imageSource: CanvasImageSource;
      let width = 0;
      let height = 0;

      try {
        if (typeof createImageBitmap === 'function') {
          const bitmap = await createImageBitmap(blob);
          imageSource = bitmap;
          width = bitmap.width;
          height = bitmap.height;
        } else {
          throw new Error('createImageBitmap unavailable');
        }
      } catch {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = reject;
          img.src = thumbUrl;
        });
        imageSource = img;
        width = img.naturalWidth;
        height = img.naturalHeight;
      }

      // Ensure CanvasEngine is bound to the mounted canvas element
      if (canvasRef.current) {
        if (
          !engineRef.current ||
          engineRef.current.isEngineDisposed() ||
          engineRef.current.getCanvas() !== canvasRef.current
        ) {
          if (engineRef.current) engineRef.current.dispose();
          engineRef.current = new CanvasEngine(canvasRef.current, {
            backgroundColor: '#131724',
            devicePixelRatio: window.devicePixelRatio || 1,
          });
        }
      }

      // 1. Immediately register decoded image buffer with CanvasEngine
      if (engineRef.current) {
        engineRef.current.registerImageSource(assetId, imageSource);
      }

      // 2. Persist binary blob into IndexedDB project_assets store
      await storeBinaryAsset(assetId, blob);

      // 3. Register asset metadata in document state
      const mime =
        file.type === 'image/jpeg'
          ? 'image/jpeg'
          : file.type === 'image/webp'
          ? 'image/webp'
          : file.type === 'image/svg+xml'
          ? 'image/svg+xml'
          : 'image/png';

      const projectAsset: ProjectAsset = {
        id: assetId,
        name: file.name,
        mimeType: mime,
        width,
        height,
        sizeBytes: blob.size,
        storageKey: assetId,
        createdAt: Date.now(),
      };

      const assetSuccess = addStoreAsset(projectAsset);
      if (!assetSuccess) {
        throw new Error('Failed to register asset in document state.');
      }

      // 4. Create and attach new LayerNode
      const currentDoc = useDocumentStore.getState().document;
      const isFirstLayer = (currentDoc?.rootLayerIds.length ?? 0) === 0;
      const layerId = `layer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').trim() || 'Layer';

      const layerNode: LayerNode = {
        id: layerId,
        parentId: null,
        name: isFirstLayer ? 'Background Plate' : cleanName,
        type: 'raster',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        transform: {
          x: 0,
          y: 0,
          scaleX: 1,
          scaleY: 1,
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

      const layerSuccess = addStoreLayer(layerNode);
      if (!layerSuccess) {
        throw new Error('Failed to attach layer to document.');
      }

      setStoreActiveLayer(layerId);

      // 5. Persist document changes
      const updatedDoc = useDocumentStore.getState().document;
      if (updatedDoc) {
        await saveDocument(updatedDoc);
        setLastSavedTime(Date.now());
      }

      // 5. Render updated stage first so canvasRef contains the complete composite
      if (engineRef.current && updatedDoc) {
        engineRef.current.setDocument(updatedDoc);
        engineRef.current.registerImageSource(assetId, imageSource);
        engineRef.current.render();
      }

      // 6. Generate composite thumbnail representing the COMPLETE visible composition
      let compositeThumb = '';
      if (canvasRef.current) {
        compositeThumb = generateCompositeThumbnailFromCanvas(canvasRef.current);
      }

      // 7. Sync layer count & composite thumbnail in shell project metadata
      if (activeProjectId && updatedDoc) {
        updateProject(activeProjectId, {
          layerCount: updatedDoc.rootLayerIds.length,
          thumbnailUrl: compositeThumb || thumbUrl,
          updatedAt: new Date().toISOString(),
        });

        if (compositeThumb) {
          setCachedThumbnail(activeProjectId, compositeThumb);
          try {
            const thumbBlob = dataUrlToBlob(compositeThumb);
            await storeBinaryAsset(`thumb_${activeProjectId}`, thumbBlob);
          } catch (blobErr) {
            console.warn('[StudioWorkspace] Error storing thumb blob:', blobErr);
          }
        }
      }

      addToast({
        type: 'success',
        title: isFirstLayer ? 'Background Plate Loaded' : 'Layer Added',
        message: `Mounted "${layerNode.name}" (${width} × ${height} px)`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[StudioWorkspace] Error loading image:', err);
      addToast({
        type: 'error',
        title: 'Image Import Failed',
        message: msg,
      });
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // --------------------------------------------------------------------------
  // 6. Demo Plate One-Click Loader (for instant gratification)
  // --------------------------------------------------------------------------
  const handleLoadDemoPlate = async () => {
    const demoUrl =
      activeProject?.thumbnailUrl ||
      'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1600&auto=format&fit=crop&q=80';

    try {
      setIsProcessingImage(true);
      const res = await fetch(demoUrl);
      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const blob = await res.blob();
      const file = new File([blob], 'Starter_Background_Plate.jpg', { type: 'image/jpeg' });
      await handleAddImageFile(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast({
        type: 'error',
        title: 'Failed to load demo plate',
        message: msg,
      });
      setIsProcessingImage(false);
    }
  };

  // --------------------------------------------------------------------------
  // 6.5. Layer Mask Management Actions
  // --------------------------------------------------------------------------
  const handleAddMask = useCallback(() => {
    if (!doc || !activeLayer || activeLayer.locked || activeLayer.mask) return;

    const maskW = activeLayer.sourceWidth ?? doc.width;
    const maskH = activeLayer.sourceHeight ?? doc.height;
    const maskAssetId = `mask_asset_${activeLayer.id}_${Date.now()}`;

    // Register asset in SSOT store to satisfy validateDocumentIntegrity
    const maskAsset: ProjectAsset = {
      id: maskAssetId,
      name: `${activeLayer.name} Mask`,
      mimeType: 'image/png',
      width: maskW,
      height: maskH,
      sizeBytes: 0,
      storageKey: maskAssetId,
      createdAt: Date.now(),
    };
    addStoreAsset(maskAsset);

    const newMask: LayerMask = {
      id: `mask_${activeLayer.id}_${Date.now()}`,
      maskAssetId,
      width: maskW,
      height: maskH,
      isEnabled: true,
      isLinked: true,
      isInverted: false,
      isClamping: true,
      feather: 0,
      density: 1.0,
    };

    // Create in-memory white mask canvas
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskW;
    maskCanvas.height = maskH;
    const mCtx = maskCanvas.getContext('2d');
    if (mCtx) {
      mCtx.fillStyle = '#ffffff';
      mCtx.fillRect(0, 0, maskW, maskH);
    }
    maskCanvasesRef.current.set(maskAssetId, maskCanvas);

    if (engineRef.current) {
      engineRef.current.registerImageSource(maskAssetId, maskCanvas);
    }

    updateStoreLayer(activeLayer.id, { mask: newMask });
    setActiveEditTarget('mask');
    setActiveTool('brush');

    setMaskPreviews((prev) => ({
      ...prev,
      [maskAssetId]: maskCanvas.toDataURL(),
    }));

    if (engineRef.current) {
      const currentDoc = useDocumentStore.getState().document;
      if (currentDoc) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }
    }

    // Initial background save of mask blob
    maskCanvas.toBlob((blob) => {
      if (blob) {
        storeBinaryAsset(maskAssetId, blob).catch(console.error);
      }
    }, 'image/png');

    addToast({
      type: 'success',
      title: 'Layer Mask Added',
      message: 'White mask created. Paint with Black (B) to hide, White to reveal.',
    });
  }, [doc, activeLayer, addStoreAsset, updateStoreLayer, addToast]);

  const handleRemoveMask = useCallback(() => {
    if (!doc || !activeLayer || !activeLayer.mask || activeLayer.locked) return;

    const maskAssetId = activeLayer.mask.maskAssetId;
    if (engineRef.current) {
      engineRef.current.unregisterImageSource(maskAssetId);
    }
    maskCanvasesRef.current.delete(maskAssetId);
    setMaskPreviews((prev) => {
      const next = { ...prev };
      delete next[maskAssetId];
      return next;
    });

    updateStoreLayer(activeLayer.id, { mask: null });
    setActiveEditTarget('layer');

    if (engineRef.current) {
      const currentDoc = useDocumentStore.getState().document;
      if (currentDoc) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }
    }

    addToast({
      type: 'info',
      title: 'Layer Mask Removed',
      message: 'Layer mask deleted. Original image fully visible.',
    });
  }, [doc, activeLayer, updateStoreLayer, addToast]);

  // Universal Modal: Open react-canvas-masker editor for active layer
  const handleOpenMaskModal = useCallback(async () => {
    if (!activeLayer || activeLayer.locked) return;
    if (activeLayer.type !== 'raster' && activeLayer.type !== 'harmonized_clone') {
      addToast({
        type: 'warning',
        title: 'Unsupported Layer',
        message: 'Layer masking is supported on raster and cutout image layers.',
      });
      return;
    }

    let url: string | null = null;
    if (activeLayer.sourceAssetId) {
      url =
        assetThumbnailsRef.current[activeLayer.sourceAssetId] ||
        assetThumbnails[activeLayer.sourceAssetId] ||
        null;

      if (!url) {
        try {
          const blob = await loadBinaryAsset(activeLayer.sourceAssetId);
          if (blob) {
            url = URL.createObjectURL(blob);
            assetThumbnailsRef.current[activeLayer.sourceAssetId] = url;
            setAssetThumbnails((prev) => ({ ...prev, [activeLayer.sourceAssetId!]: url! }));
          }
        } catch (err) {
          console.warn('[StudioWorkspace] Error loading layer image for mask modal:', err);
        }
      }

      // Robust fallback: Extract from CanvasEngine registry if available
      if (!url && engineRef.current) {
        const cachedSource = engineRef.current.getImageSource(activeLayer.sourceAssetId);
        if (cachedSource) {
          try {
            const w = activeLayer.sourceWidth || 800;
            const h = activeLayer.sourceHeight || 600;
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const cx = c.getContext('2d');
            if (cx) {
              cx.drawImage(cachedSource, 0, 0, w, h);
              url = c.toDataURL('image/png');
              assetThumbnailsRef.current[activeLayer.sourceAssetId] = url;
            }
          } catch (e) {
            console.warn('[StudioWorkspace] Error extracting canvas from engine:', e);
          }
        }
      }
    }

    if (!url) {
      addToast({
        type: 'error',
        title: 'Image Unavailable',
        message: 'Cannot open mask editor: layer source image could not be resolved.',
      });
      return;
    }

    setMaskModalImageUrl(url);
    setIsMaskModalOpen(true);
  }, [activeLayer, assetThumbnails, addToast]);

  // Universal Modal: Apply mask changes and persist to IndexedDB
  const handleApplyMaskFromModal = useCallback(
    async (
      alphaCanvas: HTMLCanvasElement,
      alphaBlob: Blob,
      rawBwBlob: Blob,
      maskWidth: number,
      maskHeight: number
    ) => {
      if (!doc || !activeLayer || activeLayer.locked) return;

      const maskAssetId =
        activeLayer.mask?.maskAssetId || `mask_asset_${activeLayer.id}_${Date.now()}`;

      try {
        // 1. Persist Alpha Mask into IndexedDB (for CanvasEngine destination-in compositing)
        await storeBinaryAsset(maskAssetId, alphaBlob);

        // 2. Persist Raw B/W Mask into IndexedDB (for lossless roundtrip initialMask editing)
        await storeBinaryAsset(`bw_${maskAssetId}`, rawBwBlob);

        // 3. Register Alpha Canvas in CanvasEngine runtime image registry
        maskCanvasesRef.current.set(maskAssetId, alphaCanvas);
        if (engineRef.current) {
          engineRef.current.registerImageSource(maskAssetId, alphaCanvas);
        }

        // 4. Update Mask Preview thumbnail for the Layers panel
        setMaskPreviews((prev) => ({
          ...prev,
          [maskAssetId]: alphaCanvas.toDataURL(),
        }));

        // 5. Register asset in document state if not already present
        if (!doc.assets?.[maskAssetId]) {
          const maskAsset: ProjectAsset = {
            id: maskAssetId,
            name: `${activeLayer.name} Mask`,
            mimeType: 'image/png',
            width: maskWidth,
            height: maskHeight,
            sizeBytes: alphaBlob.size,
            storageKey: maskAssetId,
            createdAt: Date.now(),
          };
          addStoreAsset(maskAsset);
        }

        // 6. Update or Create LayerMask metadata on the LayerNode in Zustand SSOT
        const updatedMask: LayerMask = {
          id: activeLayer.mask?.id || `mask_${activeLayer.id}_${Date.now()}`,
          maskAssetId,
          width: maskWidth,
          height: maskHeight,
          isEnabled: true,
          isLinked: activeLayer.mask?.isLinked ?? true,
          isInverted: activeLayer.mask?.isInverted ?? false,
          isClamping: activeLayer.mask?.isClamping ?? true,
          feather: activeLayer.mask?.feather ?? 0,
          density: activeLayer.mask?.density ?? 1.0,
        };

        updateStoreLayer(activeLayer.id, { mask: updatedMask });
        setActiveEditTarget('mask');

        // 7. Persist document changes to IndexedDB immediately
        const currentDoc = useDocumentStore.getState().document;
        if (currentDoc) {
          await saveDocument(currentDoc);
          setLastSavedTime(Date.now());
          if (engineRef.current) {
            engineRef.current.setDocument(currentDoc);
            engineRef.current.render();
          }
        }

        addToast({
          type: 'success',
          title: 'Layer Mask Applied',
          message: `Mask for "${activeLayer.name}" has been updated and saved.`,
        });
      } catch (err) {
        console.error('[StudioWorkspace] Error saving applied mask:', err);
        addToast({
          type: 'error',
          title: 'Mask Save Failed',
          message: 'An error occurred while saving the layer mask.',
        });
      }
    },
    [doc, activeLayer, updateStoreLayer, addStoreAsset, addToast]
  );

  const handleToggleMaskEnabled = useCallback(() => {
    if (!activeLayer || !activeLayer.mask || activeLayer.locked) return;

    const isEnabled = !activeLayer.mask.isEnabled;
    updateStoreLayer(activeLayer.id, {
      mask: { ...activeLayer.mask, isEnabled },
    });

    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc) {
      saveDocument(currentDoc).catch(console.error);
      setLastSavedTime(Date.now());
      if (engineRef.current) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }
    }
  }, [activeLayer, updateStoreLayer]);

  const handleToggleMaskInverted = useCallback(() => {
    if (!activeLayer || !activeLayer.mask || activeLayer.locked) return;

    const isInverted = !activeLayer.mask.isInverted;
    updateStoreLayer(activeLayer.id, {
      mask: { ...activeLayer.mask, isInverted },
    });

    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc) {
      saveDocument(currentDoc).catch(console.error);
      setLastSavedTime(Date.now());
      if (engineRef.current) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }
    }
  }, [activeLayer, updateStoreLayer]);

  const handleClearMask = useCallback(() => {
    if (!activeLayer || !activeLayer.mask || activeLayer.locked) return;

    const maskAssetId = activeLayer.mask.maskAssetId;
    const mCanvas = maskCanvasesRef.current.get(maskAssetId);
    if (mCanvas) {
      const mCtx = mCanvas.getContext('2d');
      if (mCtx) {
        mCtx.fillStyle = '#ffffff';
        mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
      }
      setMaskPreviews((prev) => ({
        ...prev,
        [maskAssetId]: mCanvas.toDataURL(),
      }));
      mCanvas.toBlob((blob) => {
        if (blob) {
          storeBinaryAsset(maskAssetId, blob).catch(console.error);
          storeBinaryAsset(`bw_${maskAssetId}`, blob).catch(console.error);
        }
      }, 'image/png');
    }

    if (engineRef.current) {
      engineRef.current.render();
    }

    addToast({
      type: 'info',
      title: 'Mask Reset',
      message: 'Reset mask to fully reveal layer (white).',
    });
  }, [activeLayer, addToast]);

  // --------------------------------------------------------------------------
  // Color Correction (glfx.js) & Asset Export Handlers
  // --------------------------------------------------------------------------
  const [isSavingToAssets, setIsSavingToAssets] = useState(false);

  const handleUpdateAdjustments = useCallback(
    (patch: Partial<LayerAdjustments>) => {
      if (!activeLayer || activeLayer.locked) return;

      const currentAdj: LayerAdjustments = activeLayer.adjustments || {
        brightness: 0,
        contrast: 0,
        saturation: 0,
        hue: 0,
        temperature: 0,
        tint: 0,
        vibrance: 0,
        curvePreset: 'linear',
      };

      const newAdj: LayerAdjustments = {
        ...currentAdj,
        ...patch,
      };

      updateStoreLayer(activeLayer.id, { adjustments: newAdj });

      // Immediate canvas update
      if (engineRef.current) {
        const currentDoc = useDocumentStore.getState().document;
        if (currentDoc) {
          engineRef.current.setDocument(currentDoc);
          engineRef.current.render();
        }
      }
    },
    [activeLayer, updateStoreLayer]
  );

  const handleCommitAdjustments = useCallback(() => {
    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc) {
      saveDocument(currentDoc).catch(console.error);
      setLastSavedTime(Date.now());
    }
  }, []);

  const handleResetAdjustments = useCallback(() => {
    if (!activeLayer || activeLayer.locked) return;

    const resetAdj: LayerAdjustments = {
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      curvePreset: 'linear',
    };

    updateStoreLayer(activeLayer.id, { adjustments: resetAdj });

    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc) {
      saveDocument(currentDoc).catch(console.error);
      setLastSavedTime(Date.now());
      if (engineRef.current) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }
    }

    addToast({
      type: 'info',
      title: 'Adjustments Reset',
      message: `Color corrections reset to neutral for "${activeLayer.name}".`,
    });
  }, [activeLayer, updateStoreLayer, addToast]);

  const handleSaveLayerToAssets = useCallback(async () => {
    if (!activeLayer || !activeLayer.sourceAssetId || isSavingToAssets) return;

    try {
      setIsSavingToAssets(true);

      // Resolve source image from engine registry or binary storage
      let sourceImage: CanvasImageSource | undefined =
        engineRef.current?.getImageSource(activeLayer.sourceAssetId);

      if (!sourceImage) {
        const blob = await loadBinaryAsset(activeLayer.sourceAssetId);
        if (blob) {
          sourceImage = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(blob);
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = url;
          });
        }
      }

      if (!sourceImage) {
        throw new Error('Layer image data could not be retrieved.');
      }

      const w = activeLayer.sourceWidth || 800;
      const h = activeLayer.sourceHeight || 600;

      const newAsset = await saveLayerToAssetsLibrary(
        activeLayer,
        sourceImage,
        activeLayer.adjustments,
        w,
        h
      );

      addToast({
        type: 'success',
        title: 'Saved to Assets Library',
        message: `"${newAsset.title}" is now available in your Assets Library.`,
      });
    } catch (err) {
      console.error('[StudioWorkspace] Error saving layer to assets library:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not export layer to Assets Library.',
      });
    } finally {
      setIsSavingToAssets(false);
    }
  }, [activeLayer, isSavingToAssets, addToast]);

  // Non-destructive per-layer lighting controls.
  const handleUpdateLighting = useCallback((patch: Partial<LayerLighting>) => {
    if (!activeLayer || activeLayer.locked ||
        (activeLayer.type !== 'raster' && activeLayer.type !== 'harmonized_clone')) return;

    const w = activeLayer.sourceWidth ?? (activeLayer.sourceAssetId ? doc?.assets?.[activeLayer.sourceAssetId]?.width : undefined) ?? doc?.width ?? 1000;
    const h = activeLayer.sourceHeight ?? (activeLayer.sourceAssetId ? doc?.assets?.[activeLayer.sourceAssetId]?.height : undefined) ?? doc?.height ?? 1000;
    const defaults: LayerLighting = {
      enabled: false,
      x: w / 2,
      y: h / 2,
      angle: 0,
      intensity: 0.5,
      radius: Math.max(1, Math.round(Math.min(w, h) * 0.5)),
      softness: 0.7,
      color: '#ffffff',
      blendMode: 'screen',
    };
    updateStoreLayer(activeLayer.id, {
      lighting: { ...defaults, ...activeLayer.lighting, ...patch },
    });
    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc && engineRef.current) {
      engineRef.current.setDocument(currentDoc);
      engineRef.current.render();
    }
  }, [activeLayer, doc, updateStoreLayer]);

  const handleCommitLighting = useCallback(() => {
    const currentDoc = useDocumentStore.getState().document;
    if (currentDoc) {
      saveDocument(currentDoc).then(() => setLastSavedTime(Date.now())).catch(console.error);
    }
  }, []);

  // --------------------------------------------------------------------------
  // 7. Manual Save Action (with Complete Composition Thumbnail Persistence)
  // --------------------------------------------------------------------------
  const handleSaveDocument = async () => {
    const currentDoc = useDocumentStore.getState().document;
    if (!currentDoc) return;

    try {
      setIsSaving(true);

      // Persist any active layer masks to IndexedDB
      for (const layer of Object.values(currentDoc.layers)) {
        if (layer?.mask?.maskAssetId) {
          const mCanvas = maskCanvasesRef.current.get(layer.mask.maskAssetId);
          if (mCanvas) {
            await new Promise<void>((resolve) => {
              mCanvas.toBlob(async (blob) => {
                if (blob) {
                  try {
                    await storeBinaryAsset(layer.mask!.maskAssetId, blob);
                  } catch (mErr) {
                    console.warn('[StudioWorkspace] Error saving mask blob:', mErr);
                  }
                }
                resolve();
              }, 'image/png');
            });
          }
        }
      }

      await saveDocument(currentDoc);
      setLastSavedTime(Date.now());

      const targetProjectId = activeProjectId || currentDoc.id;

      // 1. Force canvas engine to synchronize and render so the backing canvas element
      // contains the EXACT complete visible composition with all active layers, transforms, opacity, and blend modes.
      if (engineRef.current && canvasRef.current) {
        engineRef.current.setDocument(currentDoc);
        engineRef.current.render();
      }

      // 2. Generate composite thumbnail directly from the rendered active canvas
      let compositeThumb = '';
      if (canvasRef.current && canvasRef.current.width > 0 && canvasRef.current.height > 0) {
        compositeThumb = generateCompositeThumbnailFromCanvas(canvasRef.current, 640);
      }

      // 3. Fallback to offscreen composite document renderer if canvas capture is not available
      if (!compositeThumb) {
        compositeThumb = await generateCompositeThumbnailFromDocument(currentDoc, 640);
      }

      if (targetProjectId && compositeThumb) {
        // Cache in memory immediately for instantaneous display across route switches
        setCachedThumbnail(targetProjectId, compositeThumb);

        // Persist binary thumbnail blob to IndexedDB for permanent survival across sessions & reloads
        try {
          const blob = dataUrlToBlob(compositeThumb);
          await storeBinaryAsset(`thumb_${targetProjectId}`, blob);
        } catch (blobErr) {
          console.warn('[StudioWorkspace] Error storing thumbnail blob in IndexedDB:', blobErr);
        }

        updateProject(targetProjectId, {
          thumbnailUrl: compositeThumb,
          layerCount: currentDoc.rootLayerIds.length,
          updatedAt: new Date().toISOString(),
        });
      }

      addToast({
        type: 'success',
        title: 'Document Saved',
        message: `Saved all ${currentDoc.rootLayerIds.length} layers, transforms, and composite preview.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  handleSaveDocumentRef.current = handleSaveDocument;

  // --------------------------------------------------------------------------
  // 8. Quick Export Canvas as PNG
  // --------------------------------------------------------------------------
  const handleExportPNG = () => {
    if (!canvasRef.current || !doc) return;

    try {
      if (engineRef.current) {
        engineRef.current.setDocument(doc);
        engineRef.current.render();
      }

      let exportCanvas: HTMLCanvasElement = canvasRef.current;
      if (canvasRef.current.width !== doc.width || canvasRef.current.height !== doc.height) {
        exportCanvas = document.createElement('canvas');
        exportCanvas.width = doc.width;
        exportCanvas.height = doc.height;
        const eCtx = exportCanvas.getContext('2d');
        if (eCtx) {
          eCtx.drawImage(canvasRef.current, 0, 0, doc.width, doc.height);
        }
      }

      const dataUrl = exportCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${doc.name.replace(/\s+/g, '_')}_composite.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addToast({
        type: 'success',
        title: 'Canvas Exported',
        message: `Exported composite PNG (${doc.width} × ${doc.height} px)`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Could not export canvas composite.',
      });
    }
  };

  // --------------------------------------------------------------------------
  // 9. Viewport Pan & Zoom Handlers
  // --------------------------------------------------------------------------
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoom((prev) => Math.max(0.05, Math.min(4, Math.round(prev * zoomFactor * 100) / 100)));
    } else {
      // Pan
      setPan((prev) => ({
        x: Math.round(prev.x - e.deltaX),
        y: Math.round(prev.y - e.deltaY),
      }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 1. Pan the workspace if middle mouse button, pan tool, or Alt key
    if (e.button === 1 || activeTool === 'pan' || e.altKey) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      return;
    }

    // 1.5. Paint on Layer Mask with Brush Tool (Left click)
    if (e.button === 0 && activeTool === 'brush' && doc && canvasRef.current) {
      if (!activeLayer) {
        addToast({
          type: 'warning',
          title: 'No Layer Selected',
          message: 'Select an image layer to paint on its mask.',
        });
        return;
      }
      if (activeLayer.locked) {
        addToast({
          type: 'warning',
          title: 'Layer Locked',
          message: 'Unlock the layer to paint on its mask.',
        });
        return;
      }

      // If active layer doesn't have a mask yet, auto-create a white mask
      let currentMask = activeLayer.mask;
      let maskAssetId = currentMask?.maskAssetId;

      if (!currentMask) {
        const maskW = activeLayer.sourceWidth ?? doc.width;
        const maskH = activeLayer.sourceHeight ?? doc.height;
        maskAssetId = `mask_asset_${activeLayer.id}_${Date.now()}`;

        const maskAsset: ProjectAsset = {
          id: maskAssetId,
          name: `${activeLayer.name} Mask`,
          mimeType: 'image/png',
          width: maskW,
          height: maskH,
          sizeBytes: 0,
          storageKey: maskAssetId,
          createdAt: Date.now(),
        };
        addStoreAsset(maskAsset);

        currentMask = {
          id: `mask_${activeLayer.id}_${Date.now()}`,
          maskAssetId,
          width: maskW,
          height: maskH,
          isEnabled: true,
          isLinked: true,
          isInverted: false,
          isClamping: true,
          feather: 0,
          density: 1.0,
        };

        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = maskW;
        maskCanvas.height = maskH;
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.fillStyle = '#ffffff';
          mCtx.fillRect(0, 0, maskW, maskH);
        }
        maskCanvasesRef.current.set(maskAssetId, maskCanvas);
        if (engineRef.current) {
          engineRef.current.registerImageSource(maskAssetId, maskCanvas);
        }

        updateStoreLayer(activeLayer.id, { mask: currentMask });
        setActiveEditTarget('mask');
      }

      if (!maskAssetId) return;

      let mCanvas = maskCanvasesRef.current.get(maskAssetId);
      if (!mCanvas) {
        mCanvas = document.createElement('canvas');
        mCanvas.width = currentMask.width || (activeLayer.sourceWidth ?? doc.width);
        mCanvas.height = currentMask.height || (activeLayer.sourceHeight ?? doc.height);
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          mCtx.fillStyle = '#ffffff';
          mCtx.fillRect(0, 0, mCanvas.width, mCanvas.height);
        }
        maskCanvasesRef.current.set(maskAssetId, mCanvas);
        if (engineRef.current) {
          engineRef.current.registerImageSource(maskAssetId, mCanvas);
        }
      }

      e.preventDefault();
      setIsPainting(true);

      const rect = canvasRef.current.getBoundingClientRect();
      const clickDocX = (e.clientX - rect.left) / zoom;
      const clickDocY = (e.clientY - rect.top) / zoom;
      const { x: localX, y: localY } = docToLayerCoords(clickDocX, clickDocY, activeLayer);

      const mCtx = mCanvas.getContext('2d');
      if (mCtx) {
        const layerScale = activeLayer.transform.scaleX || 1;
        const localRadius = Math.max(1, (brushSize / 2) / layerScale);
        paintMaskStroke(mCtx, localX, localY, localX, localY, localRadius, brushHardness, brushColor);

        lastPaintPosRef.current = { x: localX, y: localY };

        if (engineRef.current) {
          engineRef.current.render();
        }
      }
      return;
    }

    // 2. Select and drag layer with Move tool (Left click)
    if (e.button === 0 && activeTool === 'move' && doc && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const clickDocX = (e.clientX - rect.left) / zoom;
      const clickDocY = (e.clientY - rect.top) / zoom;

      // Reverse order: topmost layers checked first for hit-testing
      const reversedLayers = [...doc.rootLayerIds]
        .reverse()
        .map((id) => doc.layers[id])
        .filter(Boolean);

      let hitLayer: LayerNode | null = null;
      for (const l of reversedLayers) {
        if (!l.visible) continue;
        const lx = l.transform.x;
        const ly = l.transform.y;
        const lw = (l.sourceWidth ?? doc.width) * (l.transform.scaleX ?? 1);
        const lh = (l.sourceHeight ?? doc.height) * (l.transform.scaleY ?? 1);
        if (clickDocX >= lx && clickDocX <= lx + lw && clickDocY >= ly && clickDocY <= ly + lh) {
          hitLayer = l;
          break;
        }
      }

      let targetLayer: LayerNode | null = null;
      if (activeLayer && !activeLayer.locked) {
        const alx = activeLayer.transform.x;
        const aly = activeLayer.transform.y;
        const alw = (activeLayer.sourceWidth ?? doc.width) * (activeLayer.transform.scaleX ?? 1);
        const alh = (activeLayer.sourceHeight ?? doc.height) * (activeLayer.transform.scaleY ?? 1);
        const isClickInActive =
          clickDocX >= alx && clickDocX <= alx + alw && clickDocY >= aly && clickDocY <= aly + alh;

        if (isClickInActive) {
          targetLayer = activeLayer;
        } else if (hitLayer && !hitLayer.locked) {
          targetLayer = hitLayer;
          setStoreActiveLayer(hitLayer.id);
        } else {
          targetLayer = activeLayer;
        }
      } else if (hitLayer && !hitLayer.locked) {
        targetLayer = hitLayer;
        setStoreActiveLayer(hitLayer.id);
      }

      if (targetLayer && !targetLayer.locked) {
        e.preventDefault();
        setIsDraggingLayer(true);
        dragStartRef.current = {
          startX: e.clientX,
          startY: e.clientY,
          layerStartX: targetLayer.transform.x,
          layerStartY: targetLayer.transform.y,
          layerId: targetLayer.id,
        };
      }
    }
  };

  const handleResizeStart = (
    e: React.MouseEvent,
    handle: 'nw' | 'ne' | 'se' | 'sw'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!doc || !activeLayer || activeLayer.locked) return;

    setIsResizingLayer(true);
    resizeStartRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      layerId: activeLayer.id,
      initialX: activeLayer.transform.x,
      initialY: activeLayer.transform.y,
      initialScaleX: activeLayer.transform.scaleX ?? 1,
      initialScaleY: activeLayer.transform.scaleY ?? 1,
      baseWidth: activeLayer.sourceWidth ?? doc.width,
      baseHeight: activeLayer.sourceHeight ?? doc.height,
      rotation: activeLayer.transform.rotation ?? 0,
    };
  };

  const handleMouseMove = (e: React.MouseEvent | MouseEvent) => {
    if (activeTool === 'brush' && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMouseCanvasPos({
        x: (e.clientX - rect.left) / zoom,
        y: (e.clientY - rect.top) / zoom,
      });
    }

    if (isPainting && activeLayer?.mask && canvasRef.current && lastPaintPosRef.current) {
      const maskAssetId = activeLayer.mask.maskAssetId;
      const mCanvas = maskCanvasesRef.current.get(maskAssetId);
      if (mCanvas) {
        const rect = canvasRef.current.getBoundingClientRect();
        const docX = (e.clientX - rect.left) / zoom;
        const docY = (e.clientY - rect.top) / zoom;
        const { x: localX, y: localY } = docToLayerCoords(docX, docY, activeLayer);

        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          const layerScale = activeLayer.transform.scaleX || 1;
          const localRadius = Math.max(1, (brushSize / 2) / layerScale);
          paintMaskStroke(
            mCtx,
            lastPaintPosRef.current.x,
            lastPaintPosRef.current.y,
            localX,
            localY,
            localRadius,
            brushHardness,
            brushColor
          );
          lastPaintPosRef.current = { x: localX, y: localY };

          if (engineRef.current) {
            engineRef.current.render();
          }
        }
      }
      return;
    }

    if (isPanning) {
      setPan({
        x: Math.round(e.clientX - panStartRef.current.x),
        y: Math.round(e.clientY - panStartRef.current.y),
      });
      return;
    }

    if (isResizingLayer && resizeStartRef.current && canvasRef.current) {
      const {
        handle,
        layerId,
        initialX,
        initialY,
        initialScaleX,
        baseWidth,
        baseHeight,
        rotation,
      } = resizeStartRef.current;

      const currentDoc = useDocumentStore.getState().document;
      if (!currentDoc) return;
      const currentLayer = currentDoc.layers[layerId];
      if (!currentLayer) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const mouseDocX = (e.clientX - rect.left) / zoom;
      const mouseDocY = (e.clientY - rect.top) / zoom;

      const initW = baseWidth * initialScaleX;
      const initH = baseHeight * initialScaleX;
      const diag = Math.hypot(baseWidth, baseHeight);
      if (diag <= 0) return;

      let anchorX = initialX;
      let anchorY = initialY;
      let uX = baseWidth / diag;
      let uY = baseHeight / diag;

      if (handle === 'se') {
        anchorX = initialX;
        anchorY = initialY;
        uX = baseWidth / diag;
        uY = baseHeight / diag;
      } else if (handle === 'nw') {
        anchorX = initialX + initW;
        anchorY = initialY + initH;
        uX = -baseWidth / diag;
        uY = -baseHeight / diag;
      } else if (handle === 'ne') {
        anchorX = initialX;
        anchorY = initialY + initH;
        uX = baseWidth / diag;
        uY = -baseHeight / diag;
      } else if (handle === 'sw') {
        anchorX = initialX + initW;
        anchorY = initialY;
        uX = -baseWidth / diag;
        uY = baseHeight / diag;
      }

      let dx = mouseDocX - anchorX;
      let dy = mouseDocY - anchorY;

      if (rotation !== 0) {
        const rad = (-rotation * Math.PI) / 180;
        const rotatedDx = dx * Math.cos(rad) - dy * Math.sin(rad);
        const rotatedDy = dx * Math.sin(rad) + dy * Math.cos(rad);
        dx = rotatedDx;
        dy = rotatedDy;
      }

      const proj = dx * uX + dy * uY;
      const calculatedScale = proj / diag;
      const clampedScale = Math.max(0.05, Math.min(10, Math.round(calculatedScale * 1000) / 1000));

      let newX = initialX;
      let newY = initialY;

      if (handle === 'se') {
        newX = anchorX;
        newY = anchorY;
      } else if (handle === 'nw') {
        newX = Math.round(anchorX - baseWidth * clampedScale);
        newY = Math.round(anchorY - baseHeight * clampedScale);
      } else if (handle === 'ne') {
        newX = anchorX;
        newY = Math.round(anchorY - baseHeight * clampedScale);
      } else if (handle === 'sw') {
        newX = Math.round(anchorX - baseWidth * clampedScale);
        newY = anchorY;
      }

      updateStoreLayer(layerId, {
        transform: {
          ...currentLayer.transform,
          scaleX: clampedScale,
          scaleY: clampedScale,
          x: newX,
          y: newY,
        },
      });

      if (engineRef.current) {
        const latestDoc = useDocumentStore.getState().document;
        if (latestDoc) {
          engineRef.current.setDocument(latestDoc);
          engineRef.current.render();
        }
      }
      return;
    }

    if (isDraggingLayer && dragStartRef.current && doc) {
      const deltaX = (e.clientX - dragStartRef.current.startX) / zoom;
      const deltaY = (e.clientY - dragStartRef.current.startY) / zoom;

      const newX = Math.round(dragStartRef.current.layerStartX + deltaX);
      const newY = Math.round(dragStartRef.current.layerStartY + deltaY);

      const targetId = dragStartRef.current.layerId;
      const currentLayer = doc.layers[targetId];
      if (!currentLayer) return;

      updateStoreLayer(targetId, {
        transform: {
          ...currentLayer.transform,
          x: newX,
          y: newY,
        },
      });

      if (engineRef.current) {
        const currentDoc = useDocumentStore.getState().document;
        if (currentDoc) {
          engineRef.current.setDocument(currentDoc);
          engineRef.current.render();
        }
      }
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
    }

    if (isPainting) {
      setIsPainting(false);
      lastPaintPosRef.current = null;

      if (activeLayer?.mask?.maskAssetId) {
        const maskAssetId = activeLayer.mask.maskAssetId;
        const mCanvas = maskCanvasesRef.current.get(maskAssetId);
        if (mCanvas) {
          setMaskPreviews((prev) => ({
            ...prev,
            [maskAssetId]: mCanvas.toDataURL(),
          }));

          mCanvas.toBlob((blob) => {
            if (blob) {
              storeBinaryAsset(maskAssetId, blob).catch(console.error);
            }
          }, 'image/png');
        }
      }

      const currentDoc = useDocumentStore.getState().document;
      const targetProjectId = activeProjectId || currentDoc?.id;
      if (canvasRef.current && targetProjectId) {
        try {
          const thumb = generateCompositeThumbnailFromCanvas(canvasRef.current, 640);
          if (thumb) {
            setCachedThumbnail(targetProjectId, thumb);
            updateProject(targetProjectId, {
              thumbnailUrl: thumb,
              updatedAt: new Date().toISOString(),
            });
            const blob = dataUrlToBlob(thumb);
            storeBinaryAsset(`thumb_${targetProjectId}`, blob).catch(() => {});
          }
        } catch {}
      }
    }

    if (isResizingLayer) {
      setIsResizingLayer(false);
      resizeStartRef.current = null;

      // Persist resized layer transform to IndexedDB
      const currentDoc = useDocumentStore.getState().document;
      if (currentDoc) {
        saveDocument(currentDoc).catch((err) => {
          console.error('[StudioWorkspace] Auto-save after resize failed:', err);
        });
        setLastSavedTime(Date.now());

        // Update composite preview thumbnail reflecting resized layer
        const targetProjectId = activeProjectId || currentDoc.id;
        if (canvasRef.current && targetProjectId) {
          try {
            const thumb = generateCompositeThumbnailFromCanvas(canvasRef.current, 640);
            if (thumb) {
              setCachedThumbnail(targetProjectId, thumb);
              updateProject(targetProjectId, {
                thumbnailUrl: thumb,
                updatedAt: new Date().toISOString(),
              });
              const blob = dataUrlToBlob(thumb);
              storeBinaryAsset(`thumb_${targetProjectId}`, blob).catch(() => {});
            }
          } catch {
            // Non-blocking thumbnail sync
          }
        }
      }
    }

    if (isDraggingLayer) {
      setIsDraggingLayer(false);
      dragStartRef.current = null;

      // Persist moved layer transform to IndexedDB
      const currentDoc = useDocumentStore.getState().document;
      if (currentDoc) {
        saveDocument(currentDoc).catch((err) => {
          console.error('[StudioWorkspace] Auto-save after drag failed:', err);
        });
        setLastSavedTime(Date.now());

        // Update composite preview thumbnail reflecting new layer position
        const targetProjectId = activeProjectId || currentDoc.id;
        if (canvasRef.current && targetProjectId) {
          try {
            const thumb = generateCompositeThumbnailFromCanvas(canvasRef.current, 640);
            if (thumb) {
              setCachedThumbnail(targetProjectId, thumb);
              updateProject(targetProjectId, {
                thumbnailUrl: thumb,
                updatedAt: new Date().toISOString(),
              });
              const blob = dataUrlToBlob(thumb);
              storeBinaryAsset(`thumb_${targetProjectId}`, blob).catch(() => {});
            }
          } catch {
            // Non-blocking thumbnail sync
          }
        }
      }
    }
  };

  // Global window listeners for drag, resize & paint to prevent stuttering when mouse moves quickly
  useEffect(() => {
    if (!isResizingLayer && !isDraggingLayer && !isPainting) return;

    const onWindowMouseMove = (e: MouseEvent) => {
      handleMouseMove(e);
    };

    const onWindowMouseUp = () => {
      handleMouseUp();
    };

    window.addEventListener('mousemove', onWindowMouseMove);
    window.addEventListener('mouseup', onWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', onWindowMouseMove);
      window.removeEventListener('mouseup', onWindowMouseUp);
    };
  }, [isResizingLayer, isDraggingLayer, isPainting]);

  // --------------------------------------------------------------------------
  // 10. Drag & Drop Image Handlers
  // --------------------------------------------------------------------------
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDraggingOver) setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await handleAddImageFile(files[0]);
    }
  };

  // Ordered list of top-level layers in visual display order (topmost layer first)
  const orderedLayers = doc
    ? [...doc.rootLayerIds].reverse().map((id) => doc.layers[id]).filter(Boolean)
    : [];

  // --------------------------------------------------------------------------
  // Render: Loading / Error States
  // --------------------------------------------------------------------------
  if (isLoading && !doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#0E111B] select-none p-6">
        <UILoader label="Mounting Studio Canvas & Restoring Buffers..." size="lg" />
      </div>
    );
  }

  if (loadError || !doc) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#0E111B] select-none p-6 text-center">
        <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4">
          <AlertTriangle className="w-6 h-6 text-rose-400" />
        </div>
        <h2 className="text-base font-bold text-[#D7DEED] mb-2">Unable to Open Canvas</h2>
        <p className="text-xs text-[#8E9AB8] max-w-md mb-6 leading-relaxed">
          {loadError || 'The requested project document could not be found or has invalid data.'}
        </p>
        <UIButton
          variant="primary"
          size="md"
          leftIcon={<ArrowLeft className="w-4 h-4" />}
          onClick={() => navigateTo('projects')}
        >
          Return to Projects Hub
        </UIButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0E111B] overflow-hidden select-none">
      {/* Hidden native file input for layer import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleAddImageFile(file);
        }}
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
      />

      {/* -------------------------------------------------------------------- */}
      {/* 1. Studio Header Toolbar */}
      {/* -------------------------------------------------------------------- */}
      <div className="h-11 w-full bg-[#131724] border-b border-[#293047] px-3 flex items-center justify-between shrink-0 z-30 shadow-xs">
        {/* Left: Project title & Back link */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={async () => {
              const currentDoc = useDocumentStore.getState().document;
              if (currentDoc) {
                try {
                  await handleSaveDocument();
                } catch {}
              }
              navigateTo('projects');
            }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1C2233] border border-[#293047] transition-all cursor-pointer"
            title="Back to Projects Hub"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span className="hidden sm:inline">Projects</span>
          </button>

          <div className="h-4 w-[1px] bg-[#293047] mx-0.5" />

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#D7DEED] truncate max-w-[200px] md:max-w-[320px]">
              {doc.name}
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#171B29] border border-[#293047] text-[#38BDF8]">
              {doc.width} × {doc.height} px
            </span>
          </div>
        </div>

        {/* Center: Viewport Zoom Controls */}
        <div className="flex items-center gap-1 bg-[#171B29] px-1.5 py-0.5 rounded-lg border border-[#293047]">
          <button
            onClick={() => setZoom((z) => Math.max(0.05, Math.round((z - 0.1) * 100) / 100))}
            className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="text-[11px] font-mono font-medium text-[#D7DEED] hover:text-[#38BDF8] px-1.5 min-w-[50px] text-center cursor-pointer transition-colors"
            title="Actual Size (100%)"
          >
            {Math.round(zoom * 100)}%
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(4, Math.round((z + 0.1) * 100) / 100))}
            className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="h-3 w-[1px] bg-[#293047] mx-0.5" />

          <button
            onClick={() => fitToViewport(doc.width, doc.height)}
            className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
            title="Actual Size (100%)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Right: Actions (Add Image, Save, Export) */}
        <div className="flex items-center gap-2">
          <UIButton
            variant="primary"
            size="sm"
            leftIcon={<Upload className="w-3.5 h-3.5" />}
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessingImage}
          >
            {orderedLayers.length === 0 ? 'Load Background Plate' : 'Add Image Layer'}
          </UIButton>

          <UIButton
            variant="ghost"
            size="sm"
            leftIcon={<Download className="w-3.5 h-3.5" />}
            onClick={handleExportPNG}
            title="Export full composite as PNG"
          >
            <span className="hidden md:inline">Export PNG</span>
          </UIButton>

          <UIButton
            variant="secondary"
            size="sm"
            leftIcon={<Save className="w-3.5 h-3.5" />}
            onClick={handleSaveDocument}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </UIButton>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Main Studio Canvas Workspace & Sidebars */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 flex w-full overflow-hidden relative">
        {/* Left Miniature Tool Shelf */}
        <div className="w-10 bg-[#131724] border-r border-[#293047] flex flex-col items-center py-2 gap-1.5 shrink-0 z-20">
          <button
            onClick={() => setActiveTool('move')}
            className={`p-2 rounded-lg cursor-pointer transition-all ${
              activeTool === 'move'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-xs'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29]'
            }`}
            title="Select & Move Tool (V)"
          >
            <Move className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setActiveTool('brush');
              if (activeLayer?.mask) {
                setActiveEditTarget('mask');
              }
            }}
            className={`p-2 rounded-lg cursor-pointer transition-all ${
              activeTool === 'brush'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-xs'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29]'
            }`}
            title="Brush Tool (B) - Paint on Layer Mask"
          >
            <Paintbrush className="w-4 h-4" />
          </button>
          <button
            onClick={() => setActiveTool('pan')}
            className={`p-2 rounded-lg cursor-pointer transition-all ${
              activeTool === 'pan'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-xs'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29]'
            }`}
            title="Hand & Pan Canvas Tool (H / Space+Drag)"
          >
            <Hand className="w-4 h-4" />
          </button>
        </div>

        {/* Center: Interactive Canvas Stage Container */}
        <div
          ref={viewportRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setMouseCanvasPos(null)}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`flex-1 h-full w-full relative overflow-hidden bg-[#0a0b10] flex items-center justify-center ${
            activeTool === 'pan' || isPanning
              ? 'cursor-grab active:cursor-grabbing'
              : isResizingLayer
              ? resizeStartRef.current?.handle === 'nw' || resizeStartRef.current?.handle === 'se'
                ? 'cursor-nwse-resize'
                : 'cursor-nesw-resize'
              : isDraggingLayer
              ? 'cursor-grabbing'
              : activeTool === 'brush'
              ? 'cursor-crosshair'
              : activeTool === 'move'
              ? 'cursor-move'
              : 'cursor-default'
          }`}
        >
          {/* Contextual Brush & Mask Options Bar */}
          {activeTool === 'brush' && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#131724]/95 border border-[#293047] shadow-xl backdrop-blur-md">
              {/* Target / Mode Indicator */}
              <div className="flex items-center gap-1.5 pr-2 border-r border-[#293047]">
                <Paintbrush className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span className="text-xs font-bold text-[#D7DEED]">
                  {activeEditTarget === 'mask' ? 'Mask Brush' : 'Brush Tool'}
                </span>
                {activeLayer && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#10131E] border border-[#293047] text-[#BA68C8] truncate max-w-[110px]">
                    {activeLayer.name}
                  </span>
                )}
              </div>

              {/* Edit Target Toggle (Image vs Mask) */}
              {activeLayer?.mask && (
                <div className="flex items-center bg-[#10131E] p-0.5 rounded-md border border-[#293047]">
                  <button
                    type="button"
                    onClick={() => setActiveEditTarget('layer')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      activeEditTarget === 'layer'
                        ? 'bg-[#1E2436] text-[#38BDF8] font-bold'
                        : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                    }`}
                  >
                    Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveEditTarget('mask')}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all cursor-pointer ${
                      activeEditTarget === 'mask'
                        ? 'bg-[#7A1FA2]/50 text-[#BA68C8] font-bold'
                        : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                    }`}
                  >
                    Mask
                  </button>
                </div>
              )}

              {/* Color Swatches: Black (Hide) vs White (Reveal) */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setBrushColor('black')}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                    brushColor === 'black'
                      ? 'bg-[#10131E] text-white border border-[#38BDF8] shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED] border border-transparent'
                  }`}
                  title="Paint Black (Hide): erases opacity to reveal background"
                >
                  <span className="w-3 h-3 rounded-full bg-black border border-white/60 inline-block shadow-xs shrink-0" />
                  <span>Hide (Black)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBrushColor('white')}
                  className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium cursor-pointer transition-all ${
                    brushColor === 'white'
                      ? 'bg-[#10131E] text-white border border-[#38BDF8] shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED] border border-transparent'
                  }`}
                  title="Paint White (Reveal): restores opacity"
                >
                  <span className="w-3 h-3 rounded-full bg-white border border-black inline-block shadow-xs shrink-0" />
                  <span>Reveal (White)</span>
                </button>

                {/* Swap Colors Shortcut Button (X) */}
                <button
                  type="button"
                  onClick={() => setBrushColor((c) => (c === 'black' ? 'white' : 'black'))}
                  className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
                  title="Swap Colors (X)"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                </button>
              </div>

              <div className="h-4 w-[1px] bg-[#293047]" />

              {/* Brush Size Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#8E9AB8]">Size:</span>
                <input
                  type="range"
                  min={5}
                  max={300}
                  value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="w-16 accent-[#38BDF8] cursor-pointer"
                  title="Brush Size (px)"
                />
                <span className="text-[10px] font-mono font-semibold text-[#D7DEED] min-w-[32px]">
                  {brushSize}px
                </span>
              </div>

              <div className="h-4 w-[1px] bg-[#293047]" />

              {/* Brush Hardness Slider */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#8E9AB8]">Hardness:</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={brushHardness}
                  onChange={(e) => setBrushHardness(Number(e.target.value))}
                  className="w-14 accent-[#BA68C8] cursor-pointer"
                  title="Brush Hardness (0% = soft edge, 100% = hard edge)"
                />
                <span className="text-[10px] font-mono font-semibold text-[#D7DEED] min-w-[28px]">
                  {Math.round(brushHardness * 100)}%
                </span>
              </div>

              {/* Edit / Add Mask action */}
              {activeLayer && !activeLayer.locked && (activeLayer.type === 'raster' || activeLayer.type === 'harmonized_clone') && (
                <>
                  <div className="h-4 w-[1px] bg-[#293047]" />
                  <button
                    type="button"
                    onClick={handleOpenMaskModal}
                    className="flex items-center gap-1.5 px-2.5 py-0.8 rounded text-xs font-semibold bg-[#7A1FA2]/30 hover:bg-[#7A1FA2]/50 text-[#D7DEED] border border-[#BA68C8]/40 transition-colors cursor-pointer"
                    title={activeLayer.mask ? 'Edit Layer Mask in Mask Editor' : 'Create & Edit Layer Mask'}
                  >
                    <Paintbrush className="w-3.5 h-3.5 text-[#BA68C8]" />
                    <span>{activeLayer.mask ? 'Edit Mask' : 'Add Mask'}</span>
                  </button>
                </>
              )}

              {/* Reset Mask action if layer has mask */}
              {activeLayer?.mask && !activeLayer.locked && (
                <>
                  <div className="h-4 w-[1px] bg-[#293047]" />
                  <button
                    type="button"
                    onClick={handleClearMask}
                    className="px-1.5 py-0.5 rounded text-[10px] text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] transition-colors cursor-pointer"
                    title="Reset mask to fully reveal (white)"
                  >
                    Reset Mask
                  </button>
                </>
              )}
            </div>
          )}

          {/* Subtle Stage Grid / Checkerboard Backdrop */}
          <div className="absolute inset-0 bg-canvas-checker opacity-40 pointer-events-none" />

          {/* Drag & drop overlay indicator */}
          {isDraggingOver && (
            <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-[#BA68C8] bg-[#7A1FA2]/15 backdrop-blur-xs z-40 flex flex-col items-center justify-center gap-2 pointer-events-none">
              <Upload className="w-10 h-10 text-[#38BDF8] animate-bounce" />
              <span className="text-sm font-bold text-[#D7DEED]">
                Drop image here to create a new canvas layer
              </span>
            </div>
          )}

          {/* Empty Canvas Starter Plate Prompt (When 0 layers exist) */}
          {orderedLayers.length === 0 && !isProcessingImage && (
            <div className="absolute z-20 flex flex-col items-center justify-center p-8 bg-[#171B29]/95 border border-[#293047] rounded-2xl shadow-2xl max-w-md text-center backdrop-blur-md">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-b from-[#7A1FA2]/30 to-[#1F1930] border border-[#7A1FA2]/50 flex items-center justify-center mb-3.5 shadow-md">
                <ImageIcon className="w-6 h-6 text-[#BA68C8]" />
              </div>

              <h3 className="text-sm font-bold text-[#D7DEED] mb-1">Canvas Initialized</h3>
              <p className="text-xs text-[#8E9AB8] mb-5 leading-relaxed">
                Your canvas resolution is{' '}
                <strong className="text-[#38BDF8] font-mono">
                  {doc.width} × {doc.height} px
                </strong>
                . Load your first background plate or drag an image onto the stage to begin photobashing.
              </p>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full">
                <UIButton
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  leftIcon={<Upload className="w-4 h-4" />}
                  onClick={() => fileInputRef.current?.click()}
                >
                  Upload Background Plate
                </UIButton>

                <UIButton
                  variant="secondary"
                  size="md"
                  className="w-full justify-center"
                  leftIcon={<ImageIcon className="w-4 h-4" />}
                  onClick={handleLoadDemoPlate}
                >
                  Load Starter Plate
                </UIButton>
              </div>
            </div>
          )}

          {/* Processing Spinner Overlay */}
          {isProcessingImage && (
            <div className="absolute inset-0 bg-[#0a0b10]/70 backdrop-blur-xs z-30 flex flex-col items-center justify-center gap-3">
              <UILoader label="Decoding image buffer & registering layer..." size="md" />
            </div>
          )}

          {/* Canvas Wrapper transformed by Pan and Zoom */}
          <div
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isPanning || isDraggingLayer || isResizingLayer ? 'none' : 'transform 0.05s ease-out',
            }}
            className="relative shadow-2xl shadow-black ring-1 ring-[#293047] bg-[#131724] shrink-0"
          >
            <canvas ref={canvasCallbackRef} className="block select-none pointer-events-none" />

            {/* Active Layer Visual Selection & Transform Box */}
            {activeLayer && activeLayer.visible && (
              <div
                style={{
                  position: 'absolute',
                  left: `${activeLayer.transform.x}px`,
                  top: `${activeLayer.transform.y}px`,
                  width: `${(activeLayer.sourceWidth ?? doc.width) * (activeLayer.transform.scaleX ?? 1)}px`,
                  height: `${(activeLayer.sourceHeight ?? doc.height) * (activeLayer.transform.scaleY ?? 1)}px`,
                  transform: activeLayer.transform.rotation
                    ? `rotate(${activeLayer.transform.rotation}deg)`
                    : undefined,
                  transformOrigin: `${activeLayer.transform.originX}px ${activeLayer.transform.originY}px`,
                }}
                className={`pointer-events-none ring-2 ${
                  activeLayer.locked
                    ? 'ring-amber-500/70 border border-dashed border-amber-400/40'
                    : 'ring-[#38BDF8] shadow-sm shadow-[#38BDF8]/20'
                } z-10`}
              >
                {/* 4 Interactive Draggable Corner Handles (Active when Move tool is selected & layer unlocked) */}
                {activeTool === 'move' && !activeLayer.locked ? (
                  <>
                    {/* Top-Left (NW) Corner Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'nw')}
                      style={{
                        left: '0%',
                        top: '0%',
                        width: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        height: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute bg-white border-2 border-[#38BDF8] rounded-[2px] shadow-md hover:bg-[#38BDF8] hover:border-white transition-colors cursor-nwse-resize pointer-events-auto z-20"
                      title="Drag to resize layer (maintains aspect ratio)"
                    />

                    {/* Top-Right (NE) Corner Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'ne')}
                      style={{
                        left: '100%',
                        top: '0%',
                        width: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        height: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute bg-white border-2 border-[#38BDF8] rounded-[2px] shadow-md hover:bg-[#38BDF8] hover:border-white transition-colors cursor-nesw-resize pointer-events-auto z-20"
                      title="Drag to resize layer (maintains aspect ratio)"
                    />

                    {/* Bottom-Left (SW) Corner Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'sw')}
                      style={{
                        left: '0%',
                        top: '100%',
                        width: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        height: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute bg-white border-2 border-[#38BDF8] rounded-[2px] shadow-md hover:bg-[#38BDF8] hover:border-white transition-colors cursor-nesw-resize pointer-events-auto z-20"
                      title="Drag to resize layer (maintains aspect ratio)"
                    />

                    {/* Bottom-Right (SE) Corner Handle */}
                    <div
                      onMouseDown={(e) => handleResizeStart(e, 'se')}
                      style={{
                        left: '100%',
                        top: '100%',
                        width: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        height: `${Math.max(10, Math.min(32, Math.round(12 / zoom)))}px`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute bg-white border-2 border-[#38BDF8] rounded-[2px] shadow-md hover:bg-[#38BDF8] hover:border-white transition-colors cursor-nwse-resize pointer-events-auto z-20"
                      title="Drag to resize layer (maintains aspect ratio)"
                    />
                  </>
                ) : (
                  <>
                    <div className="absolute -top-1 -left-1 w-2 h-2 bg-[#38BDF8] border border-black shadow-xs pointer-events-none" />
                    <div className="absolute -top-1 -right-1 w-2 h-2 bg-[#38BDF8] border border-black shadow-xs pointer-events-none" />
                    <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-[#38BDF8] border border-black shadow-xs pointer-events-none" />
                    <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-[#38BDF8] border border-black shadow-xs pointer-events-none" />
                  </>
                )}

                {/* Layer Name & Coordinate / Scale / Mask Tag */}
                <div className="absolute -top-6 left-0 px-2 py-0.5 rounded bg-[#10131E]/95 border border-[#38BDF8]/40 text-[9px] font-mono text-[#38BDF8] truncate max-w-[340px] shadow-md backdrop-blur-xs flex items-center gap-1.5 pointer-events-none">
                  <span className="font-semibold">{activeLayer.name}</span>
                  <span className="text-[#8E9AB8]">
                    ({Math.round(activeLayer.transform.x)}, {Math.round(activeLayer.transform.y)})
                  </span>
                  <span className="text-[#BA68C8] font-bold">
                    {(activeLayer.transform.scaleX ?? 1).toFixed(2)}x
                  </span>
                  {activeLayer.mask && activeEditTarget === 'mask' && (
                    <span className="px-1.5 py-0.2 rounded bg-[#7A1FA2]/60 text-[#BA68C8] border border-[#BA68C8]/50 font-bold">
                      [Editing Mask]
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Brush Stamp Preview Ring (Follows mouse on Canvas when Brush tool is active) */}
            {activeTool === 'brush' && mouseCanvasPos && (
              <div
                style={{
                  position: 'absolute',
                  left: `${mouseCanvasPos.x}px`,
                  top: `${mouseCanvasPos.y}px`,
                  width: `${brushSize}px`,
                  height: `${brushSize}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`rounded-full border pointer-events-none z-30 shadow-[0_0_2px_black] ${
                  brushColor === 'black'
                    ? 'border-white/80 bg-black/10'
                    : 'border-[#38BDF8] bg-white/10'
                }`}
              />
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* 3. Right Sidebar: Layers & Layer Properties */}
        {/* ------------------------------------------------------------------ */}
        <aside
          className={`h-full bg-[#131724] border-l border-[#293047] flex flex-col shrink-0 transition-all duration-200 z-20 ${
            isLayersPanelOpen ? 'w-72' : 'w-10'
          }`}
        >
          {/* Layers Panel Toggle Header */}
          <div className="h-10 border-b border-[#293047] px-3 flex items-center justify-between bg-[#171B29] shrink-0">
            {isLayersPanelOpen ? (
              <>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#BA68C8]" />
                  <span className="text-xs font-bold text-[#D7DEED] uppercase tracking-wider font-mono">
                    Layers
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#10131E] border border-[#293047] text-[#38BDF8]">
                    {orderedLayers.length}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleAddMask}
                    disabled={!activeLayer || !!activeLayer.mask || activeLayer.locked}
                    className="p-1 rounded text-[#8E9AB8] hover:text-[#38BDF8] hover:bg-[#1E2436] cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={
                      !activeLayer
                        ? 'Select an image layer to add a mask'
                        : activeLayer.mask
                        ? 'Selected layer already has a mask'
                        : activeLayer.locked
                        ? 'Selected layer is locked'
                        : 'Add Layer Mask'
                    }
                  >
                    <SquareDot className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
                    title="Add Image Layer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsLayersPanelOpen(false)}
                    className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
                    title="Collapse Panel"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => setIsLayersPanelOpen(true)}
                className="w-full flex items-center justify-center text-[#8E9AB8] hover:text-[#D7DEED] cursor-pointer"
                title="Expand Layers Panel"
              >
                <Layers className="w-4 h-4 text-[#BA68C8]" />
              </button>
            )}
          </div>

          {/* Panel Content (Visible when expanded) */}
          {isLayersPanelOpen && (
            <div className="flex-1 flex flex-col overflow-y-auto divide-y divide-[#293047]">
              {/* Layer Stack */}
              <div className="p-2 flex flex-col gap-1.5">
                {orderedLayers.length === 0 ? (
                  <div className="py-8 px-4 text-center">
                    <p className="text-xs text-[#8E9AB8] mb-3">No layers added yet.</p>
                    <UIButton
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus className="w-3.5 h-3.5" />}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full justify-center"
                    >
                      Add First Layer
                    </UIButton>
                  </div>
                ) : (
                  orderedLayers.map((layer) => {
                    const isActive = doc.activeLayerId === layer.id;

                    return (
                      <div
                        key={layer.id}
                        onClick={() => {
                          setStoreActiveLayer(layer.id);
                          if (!layer.mask && activeEditTarget === 'mask') {
                            setActiveEditTarget('layer');
                          }
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-b from-[#1F1930] to-[#171B29] border-[#7A1FA2]/80 text-[#D7DEED] shadow-sm shadow-black/40 ring-1 ring-[#7A1FA2]/40'
                            : 'bg-[#171B29]/60 hover:bg-[#1A1F30] border-[#293047] text-[#8E9AB8] hover:text-[#D7DEED]'
                        }`}
                      >
                        {/* Layer preview thumbnails (Image & Mask) & Name */}
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Image Thumbnail */}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setStoreActiveLayer(layer.id);
                              setActiveEditTarget('layer');
                            }}
                            className={`w-8 h-8 rounded bg-[#10131E] border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer transition-all ${
                              isActive && activeEditTarget === 'layer'
                                ? 'ring-2 ring-[#38BDF8] border-[#38BDF8]'
                                : 'border-[#293047] hover:border-[#8E9AB8]'
                            }`}
                            title="Click to select & edit image layer"
                          >
                            {layer.sourceAssetId && assetThumbnails[layer.sourceAssetId] ? (
                              <img
                                src={assetThumbnails[layer.sourceAssetId]}
                                alt={layer.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-[#38BDF8]" />
                            )}
                          </div>

                          {/* Mask Thumbnail (if present on layer) */}
                          {layer.mask && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setStoreActiveLayer(layer.id);
                                handleOpenMaskModal();
                              }}
                              className={`w-8 h-8 rounded bg-black border overflow-hidden flex items-center justify-center shrink-0 cursor-pointer transition-all relative ${
                                isActive && activeEditTarget === 'mask'
                                  ? 'ring-2 ring-[#BA68C8] border-[#BA68C8]'
                                  : 'border-[#293047] hover:border-[#8E9AB8]'
                              } ${!layer.mask.isEnabled ? 'opacity-40' : ''}`}
                              title="Layer mask: Click to open Mask Editor"
                            >
                              {maskPreviews[layer.mask.maskAssetId] ? (
                                <img
                                  src={maskPreviews[layer.mask.maskAssetId]}
                                  alt="Mask"
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-white" />
                              )}
                              {!layer.mask.isEnabled && (
                                <div className="absolute inset-0 flex items-center justify-center text-rose-500 font-bold text-xs select-none">
                                  ✕
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-semibold truncate leading-tight flex items-center gap-1">
                              {layer.name}
                            </span>
                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-[#5E6985] truncate">
                              <span>
                                {layer.sourceWidth && layer.sourceHeight
                                  ? `${layer.sourceWidth} × ${layer.sourceHeight} px`
                                  : layer.type}
                              </span>
                              {layer.mask && (
                                <span className={isActive && activeEditTarget === 'mask' ? 'text-[#BA68C8] font-bold' : 'text-[#8E9AB8]'}>
                                  {isActive && activeEditTarget === 'mask' ? '• Mask Active' : '• Mask'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Layer quick controls */}
                        <div
                          className="flex items-center gap-1 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Add Mask action or Mask Enable/Disable Toggle */}
                          {!layer.mask ? (
                            <button
                              onClick={() => {
                                setStoreActiveLayer(layer.id);
                                handleOpenMaskModal();
                              }}
                              disabled={layer.locked}
                              className="p-1 rounded text-[#5E6985] hover:text-[#BA68C8] cursor-pointer transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title="Create & Edit Layer Mask"
                            >
                              <SquareDot className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                if (isActive) {
                                  handleToggleMaskEnabled();
                                } else {
                                  updateStoreLayer(layer.id, {
                                    mask: { ...layer.mask!, isEnabled: !layer.mask!.isEnabled },
                                  });
                                  if (engineRef.current) {
                                    const d = useDocumentStore.getState().document;
                                    if (d) {
                                      engineRef.current.setDocument(d);
                                      engineRef.current.render();
                                    }
                                  }
                                }
                              }}
                              className={`p-1 rounded cursor-pointer transition-colors ${
                                layer.mask.isEnabled
                                  ? 'text-[#BA68C8] hover:text-[#D7DEED]'
                                  : 'text-[#5E6985] hover:text-[#8E9AB8]'
                              }`}
                              title={layer.mask.isEnabled ? 'Disable Mask' : 'Enable Mask'}
                            >
                              <SquareDot className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Visibility Toggle */}
                          <button
                            onClick={() =>
                              updateStoreLayer(layer.id, { visible: !layer.visible })
                            }
                            className={`p-1 rounded cursor-pointer transition-colors ${
                              layer.visible
                                ? 'text-[#8E9AB8] hover:text-[#D7DEED]'
                                : 'text-[#5E6985] hover:text-[#8E9AB8]'
                            }`}
                            title={layer.visible ? 'Hide Layer' : 'Show Layer'}
                          >
                            {layer.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Lock Toggle */}
                          <button
                            onClick={() => updateStoreLayer(layer.id, { locked: !layer.locked })}
                            className={`p-1 rounded cursor-pointer transition-colors ${
                              layer.locked
                                ? 'text-amber-400'
                                : 'text-[#5E6985] hover:text-[#8E9AB8]'
                            }`}
                            title={layer.locked ? 'Unlock Layer' : 'Lock Layer'}
                          >
                            {layer.locked ? (
                              <Lock className="w-3.5 h-3.5" />
                            ) : (
                              <Unlock className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Delete Layer */}
                          <button
                            onClick={() => removeStoreLayer(layer.id)}
                            className="p-1 rounded text-[#5E6985] hover:text-rose-400 cursor-pointer transition-colors"
                            title="Delete Layer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Active Layer Inspector / Properties */}
              {activeLayer && (
                <div className="p-3 flex flex-col gap-3.5 bg-[#171B29]/30">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[#D7DEED]">
                    <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
                    <span>Layer Properties</span>
                  </div>

                  {/* Opacity Slider */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#8E9AB8]">Opacity</span>
                      <span className="text-[#D7DEED] font-mono font-bold">
                        {Math.round(activeLayer.opacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(activeLayer.opacity * 100)}
                      onChange={(e) =>
                        updateStoreLayer(activeLayer.id, {
                          opacity: Number(e.target.value) / 100,
                        })
                      }
                      className="w-full accent-[#BA68C8] cursor-pointer"
                    />
                  </div>

                  {/* Blend Mode Dropdown */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] text-[#8E9AB8]">Blending Mode</span>
                    <select
                      value={activeLayer.blendMode}
                      onChange={(e) =>
                        updateStoreLayer(activeLayer.id, {
                          blendMode: e.target.value as BlendMode,
                        })
                      }
                      className="w-full bg-[#10131E] border border-[#293047] rounded-md px-2.5 py-1.5 text-xs text-[#D7DEED] focus:outline-none focus:border-[#7A1FA2] cursor-pointer"
                    >
                      {BLEND_MODES.map((bm) => (
                        <option key={bm.value} value={bm.value}>
                          {bm.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Layer Transform Controls (Position, Scale, Rotation) */}
                  <div className="pt-2 border-t border-[#293047] flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#8E9AB8] font-medium">Transform</span>
                      {activeLayer.locked && (
                        <span className="text-[10px] text-amber-400 font-mono flex items-center gap-1">
                          <Lock className="w-3 h-3" /> Locked
                        </span>
                      )}
                    </div>

                    {/* Position X / Y Inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center bg-[#10131E] border border-[#293047] rounded px-2 py-1 focus-within:border-[#7A1FA2]">
                        <span className="text-[10px] font-mono text-[#5E6985] mr-1.5 select-none">X:</span>
                        <input
                          type="number"
                          value={Math.round(activeLayer.transform.x)}
                          disabled={activeLayer.locked}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val)) {
                              updateStoreLayer(activeLayer.id, {
                                transform: { ...activeLayer.transform, x: val },
                              });
                            }
                          }}
                          onBlur={() => {
                            const d = useDocumentStore.getState().document;
                            if (d) saveDocument(d).catch(console.error);
                          }}
                          className="w-full bg-transparent text-xs font-mono text-[#D7DEED] focus:outline-none disabled:opacity-40"
                          title="Layer X Position (px)"
                        />
                        <span className="text-[9px] text-[#5E6985] select-none">px</span>
                      </div>

                      <div className="flex items-center bg-[#10131E] border border-[#293047] rounded px-2 py-1 focus-within:border-[#7A1FA2]">
                        <span className="text-[10px] font-mono text-[#5E6985] mr-1.5 select-none">Y:</span>
                        <input
                          type="number"
                          value={Math.round(activeLayer.transform.y)}
                          disabled={activeLayer.locked}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val)) {
                              updateStoreLayer(activeLayer.id, {
                                transform: { ...activeLayer.transform, y: val },
                              });
                            }
                          }}
                          onBlur={() => {
                            const d = useDocumentStore.getState().document;
                            if (d) saveDocument(d).catch(console.error);
                          }}
                          className="w-full bg-transparent text-xs font-mono text-[#D7DEED] focus:outline-none disabled:opacity-40"
                          title="Layer Y Position (px)"
                        />
                        <span className="text-[9px] text-[#5E6985] select-none">px</span>
                      </div>
                    </div>

                    {/* Scale & Rotation Inputs */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center bg-[#10131E] border border-[#293047] rounded px-2 py-1 focus-within:border-[#7A1FA2]">
                        <span className="text-[10px] font-mono text-[#5E6985] mr-1.5 select-none">Scale:</span>
                        <input
                          type="number"
                          step="0.05"
                          min="0.05"
                          max="10"
                          value={Number(activeLayer.transform.scaleX.toFixed(2))}
                          disabled={activeLayer.locked}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val > 0) {
                              updateStoreLayer(activeLayer.id, {
                                transform: { ...activeLayer.transform, scaleX: val, scaleY: val },
                              });
                            }
                          }}
                          onBlur={() => {
                            const d = useDocumentStore.getState().document;
                            if (d) saveDocument(d).catch(console.error);
                          }}
                          className="w-full bg-transparent text-xs font-mono text-[#D7DEED] focus:outline-none disabled:opacity-40"
                          title="Layer Uniform Scale"
                        />
                        <span className="text-[9px] text-[#5E6985] select-none">x</span>
                      </div>

                      <div className="flex items-center bg-[#10131E] border border-[#293047] rounded px-2 py-1 focus-within:border-[#7A1FA2]">
                        <span className="text-[10px] font-mono text-[#5E6985] mr-1.5 select-none">Rot:</span>
                        <input
                          type="number"
                          step="1"
                          value={Math.round(activeLayer.transform.rotation)}
                          disabled={activeLayer.locked}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val)) {
                              updateStoreLayer(activeLayer.id, {
                                transform: { ...activeLayer.transform, rotation: val },
                              });
                            }
                          }}
                          onBlur={() => {
                            const d = useDocumentStore.getState().document;
                            if (d) saveDocument(d).catch(console.error);
                          }}
                          className="w-full bg-transparent text-xs font-mono text-[#D7DEED] focus:outline-none disabled:opacity-40"
                          title="Layer Rotation (degrees)"
                        />
                        <span className="text-[9px] text-[#5E6985] select-none">°</span>
                      </div>
                    </div>

                    {/* Reset Layer Transform Button */}
                    <button
                      type="button"
                      disabled={activeLayer.locked}
                      onClick={() => {
                        updateStoreLayer(activeLayer.id, {
                          transform: {
                            x: 0,
                            y: 0,
                            scaleX: 1,
                            scaleY: 1,
                            rotation: 0,
                            skewX: 0,
                            skewY: 0,
                            originX: 0,
                            originY: 0,
                          },
                        });
                        const d = useDocumentStore.getState().document;
                        if (d) saveDocument(d).catch(console.error);
                      }}
                      className="text-[10px] text-[#8E9AB8] hover:text-[#38BDF8] py-1 px-2 rounded bg-[#10131E] border border-[#293047] hover:border-[#38BDF8]/40 transition-colors cursor-pointer text-center disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Reset Layer Position & Scale
                    </button>
                  </div>

                  {/* Layer Mask Inspector Section */}
                  <div className="pt-2.5 border-t border-[#293047] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-[#D7DEED]">
                        <SquareDot className="w-3.5 h-3.5 text-[#BA68C8]" />
                        <span>Layer Mask</span>
                      </div>
                      {activeLayer.mask && (
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            activeLayer.mask.isEnabled
                              ? 'bg-[#7A1FA2]/30 border-[#BA68C8]/40 text-[#BA68C8]'
                              : 'bg-[#10131E] border-[#293047] text-[#5E6985]'
                          }`}
                        >
                          {activeLayer.mask.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                      )}
                    </div>

                    {!activeLayer.mask ? (
                      <div className="flex flex-col gap-1.5">
                        <p className="text-[10px] text-[#8E9AB8] leading-tight">
                          Non-destructive mask. Paint with black to hide parts of this layer, white to reveal.
                        </p>
                        <button
                          type="button"
                          disabled={activeLayer.locked}
                          onClick={handleOpenMaskModal}
                          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold py-2 px-3 rounded-md bg-[#1F1930] hover:bg-[#2A2045] border border-[#7A1FA2]/60 hover:border-[#BA68C8] text-[#D7DEED] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
                        >
                          <Plus className="w-3.5 h-3.5 text-[#BA68C8]" />
                          <span>Add Layer Mask</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {/* Primary Edit Mask Action */}
                        <button
                          type="button"
                          disabled={activeLayer.locked}
                          onClick={handleOpenMaskModal}
                          className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2 px-3 rounded-lg bg-gradient-to-r from-[#7A1FA2] to-[#9C27B0] hover:from-[#8E24AA] hover:to-[#AB47BC] text-white shadow-md shadow-[#7A1FA2]/30 transition-all cursor-pointer disabled:opacity-40"
                        >
                          <Paintbrush className="w-4 h-4" />
                          <span>Edit Mask</span>
                        </button>

                        {/* Mask Quick Actions */}
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={handleToggleMaskEnabled}
                            className="text-[10px] text-[#8E9AB8] hover:text-[#D7DEED] py-1 px-1.5 rounded bg-[#10131E] border border-[#293047] hover:border-[#8E9AB8] transition-colors cursor-pointer text-center"
                          >
                            {activeLayer.mask.isEnabled ? 'Disable Mask' : 'Enable Mask'}
                          </button>
                          <button
                            type="button"
                            onClick={handleToggleMaskInverted}
                            className="text-[10px] text-[#8E9AB8] hover:text-[#D7DEED] py-1 px-1.5 rounded bg-[#10131E] border border-[#293047] hover:border-[#8E9AB8] transition-colors cursor-pointer text-center"
                          >
                            {activeLayer.mask.isInverted ? 'Un-invert' : 'Invert Mask'}
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={handleClearMask}
                            className="text-[10px] text-[#8E9AB8] hover:text-[#38BDF8] py-1 px-1.5 rounded bg-[#10131E] border border-[#293047] hover:border-[#38BDF8]/40 transition-colors cursor-pointer text-center"
                          >
                            Reset (White)
                          </button>
                          <button
                            type="button"
                            onClick={handleRemoveMask}
                            className="text-[10px] text-rose-400 hover:text-rose-300 py-1 px-1.5 rounded bg-[#10131E] border border-[#293047] hover:border-rose-400/40 transition-colors cursor-pointer text-center"
                          >
                            Delete Mask
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Non-destructive per-layer Lighting */}
                  {(activeLayer.type === 'raster' || activeLayer.type === 'harmonized_clone') && (() => {
                    const lw = activeLayer.sourceWidth ?? (activeLayer.sourceAssetId ? doc?.assets?.[activeLayer.sourceAssetId]?.width : undefined) ?? doc?.width ?? 1000;
                    const lh = activeLayer.sourceHeight ?? (activeLayer.sourceAssetId ? doc?.assets?.[activeLayer.sourceAssetId]?.height : undefined) ?? doc?.height ?? 1000;
                    const lighting: LayerLighting = activeLayer.lighting ?? {
                      enabled: false, x: lw / 2, y: lh / 2, angle: 0, intensity: 0.5,
                      radius: Math.max(1, Math.round(Math.min(lw, lh) * 0.5)),
                      softness: 0.7, color: '#ffffff', blendMode: 'screen',
                    };
                    const fields: { key: 'x' | 'y' | 'angle' | 'intensity' | 'radius' | 'softness'; label: string; min: number; max: number; step: number }[] = [
                      { key: 'x', label: 'Light X', min: 0, max: lw, step: 1 },
                      { key: 'y', label: 'Light Y', min: 0, max: lh, step: 1 },
                      { key: 'angle', label: 'Direction', min: 0, max: 360, step: 1 },
                      { key: 'intensity', label: 'Intensity', min: 0, max: 1, step: 0.01 },
                      { key: 'radius', label: 'Radius', min: 0, max: Math.max(lw, lh) * 2, step: 1 },
                      { key: 'softness', label: 'Softness', min: 0, max: 1, step: 0.01 },
                    ];
                    return (
                      <div className="pt-2.5 border-t border-[#293047] flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#D7DEED]">Lighting</span>
                          <label className="flex items-center gap-2 text-[11px] text-[#8E9AB8]">
                            <input type="checkbox" checked={lighting.enabled} disabled={activeLayer.locked}
                              onChange={(e) => { handleUpdateLighting({ enabled: e.target.checked }); handleCommitLighting(); }} />
                            Enabled
                          </label>
                        </div>
                        {fields.map(({ key, label, min, max, step }) => (
                          <label key={key} className="flex flex-col gap-1 text-[11px] text-[#8E9AB8]">
                            <span className="flex justify-between"><span>{label}</span><span className="font-mono text-[#D7DEED]">{Number(lighting[key].toFixed(2))}</span></span>
                            <input type="range" min={min} max={max} step={step} value={lighting[key]}
                              disabled={activeLayer.locked}
                              onChange={(e) => handleUpdateLighting({ [key]: Number(e.target.value) })}
                              onPointerUp={handleCommitLighting} onKeyUp={handleCommitLighting}
                              className="w-full accent-[#BA68C8] cursor-pointer" />
                          </label>
                        ))}
                        <label className="flex items-center justify-between text-[11px] text-[#8E9AB8]">
                          Light color
                          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(lighting.color) ? lighting.color : '#ffffff'}
                            disabled={activeLayer.locked}
                            onChange={(e) => handleUpdateLighting({ color: e.target.value })}
                            onBlur={handleCommitLighting} className="w-12 h-7 cursor-pointer" />
                        </label>
                        <label className="flex flex-col gap-1 text-[11px] text-[#8E9AB8]">
                          Lighting blend mode
                          <select value={lighting.blendMode} disabled={activeLayer.locked}
                            onChange={(e) => { handleUpdateLighting({ blendMode: e.target.value as LayerLighting['blendMode'] }); handleCommitLighting(); }}
                            className="w-full bg-[#10131E] border border-[#293047] rounded-md px-2 py-1.5 text-xs text-[#D7DEED]">
                            <option value="screen">Screen</option>
                            <option value="multiply">Multiply</option>
                            <option value="soft-light">Soft Light</option>
                          </select>
                        </label>
                        <button type="button" disabled={activeLayer.locked}
                          onClick={() => { handleUpdateLighting({ enabled: false }); handleCommitLighting(); }}
                          className="w-full py-1.5 rounded-md bg-[#10131E] border border-[#293047] text-xs text-[#D7DEED] disabled:opacity-40">
                          Disable Lighting
                        </button>
                      </div>
                    );
                  })()}

                  {/* Color Correction Section (glfx.js) */}
                  {(activeLayer.type === 'raster' || activeLayer.type === 'harmonized_clone') && (
                    <div className="pt-2.5 border-t border-[#293047] flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#D7DEED]">
                          <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                          <span>Color Correction</span>
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                            isAdjustmentActive(activeLayer.adjustments)
                              ? 'bg-[#38BDF8]/20 border-[#38BDF8]/40 text-[#38BDF8]'
                              : 'bg-[#10131E] border-[#293047] text-[#5E6985]'
                          }`}
                        >
                          {isAdjustmentActive(activeLayer.adjustments) ? 'Graded' : 'Neutral'}
                        </span>
                      </div>

                      {/* Brightness Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8E9AB8]">Brightness</span>
                          <span className="text-[#D7DEED] font-mono font-bold text-[10px]">
                            {(activeLayer.adjustments?.brightness ?? 0) > 0
                              ? `+${activeLayer.adjustments?.brightness ?? 0}`
                              : (activeLayer.adjustments?.brightness ?? 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={1}
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.brightness ?? 0}
                          onChange={(e) =>
                            handleUpdateAdjustments({ brightness: Number(e.target.value) })
                          }
                          onPointerUp={handleCommitAdjustments}
                          onKeyUp={handleCommitAdjustments}
                          className="w-full accent-[#38BDF8] cursor-pointer"
                        />
                      </div>

                      {/* Contrast Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8E9AB8]">Contrast</span>
                          <span className="text-[#D7DEED] font-mono font-bold text-[10px]">
                            {(activeLayer.adjustments?.contrast ?? 0) > 0
                              ? `+${activeLayer.adjustments?.contrast ?? 0}`
                              : (activeLayer.adjustments?.contrast ?? 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={1}
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.contrast ?? 0}
                          onChange={(e) =>
                            handleUpdateAdjustments({ contrast: Number(e.target.value) })
                          }
                          onPointerUp={handleCommitAdjustments}
                          onKeyUp={handleCommitAdjustments}
                          className="w-full accent-[#38BDF8] cursor-pointer"
                        />
                      </div>

                      {/* Saturation Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8E9AB8]">Saturation</span>
                          <span className="text-[#D7DEED] font-mono font-bold text-[10px]">
                            {(activeLayer.adjustments?.saturation ?? 0) > 0
                              ? `+${activeLayer.adjustments?.saturation ?? 0}`
                              : (activeLayer.adjustments?.saturation ?? 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={1}
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.saturation ?? 0}
                          onChange={(e) =>
                            handleUpdateAdjustments({ saturation: Number(e.target.value) })
                          }
                          onPointerUp={handleCommitAdjustments}
                          onKeyUp={handleCommitAdjustments}
                          className="w-full accent-[#38BDF8] cursor-pointer"
                        />
                      </div>

                      {/* Hue Shift Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8E9AB8]">Hue Shift</span>
                          <span className="text-[#D7DEED] font-mono font-bold text-[10px]">
                            {(activeLayer.adjustments?.hue ?? 0) > 0
                              ? `+${activeLayer.adjustments?.hue ?? 0}°`
                              : `${activeLayer.adjustments?.hue ?? 0}°`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-180}
                          max={180}
                          step={1}
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.hue ?? 0}
                          onChange={(e) =>
                            handleUpdateAdjustments({ hue: Number(e.target.value) })
                          }
                          onPointerUp={handleCommitAdjustments}
                          onKeyUp={handleCommitAdjustments}
                          className="w-full accent-[#BA68C8] cursor-pointer"
                        />
                      </div>

                      {/* Vibrance Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8E9AB8]">Vibrance</span>
                          <span className="text-[#D7DEED] font-mono font-bold text-[10px]">
                            {(activeLayer.adjustments?.vibrance ?? 0) > 0
                              ? `+${activeLayer.adjustments?.vibrance ?? 0}`
                              : (activeLayer.adjustments?.vibrance ?? 0)}
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={1}
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.vibrance ?? 0}
                          onChange={(e) =>
                            handleUpdateAdjustments({ vibrance: Number(e.target.value) })
                          }
                          onPointerUp={handleCommitAdjustments}
                          onKeyUp={handleCommitAdjustments}
                          className="w-full accent-[#38BDF8] cursor-pointer"
                        />
                      </div>

                      {/* RGB Curves Presets Selector */}
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] text-[#8E9AB8]">RGB Curves Preset</span>
                        <select
                          disabled={activeLayer.locked}
                          value={activeLayer.adjustments?.curvePreset ?? 'linear'}
                          onChange={(e) => {
                            handleUpdateAdjustments({
                              curvePreset: e.target.value as CurvePresetId,
                            });
                            handleCommitAdjustments();
                          }}
                          className="w-full bg-[#10131E] border border-[#293047] rounded-md px-2.5 py-1.5 text-xs text-[#D7DEED] focus:outline-none focus:border-[#38BDF8] cursor-pointer disabled:opacity-40"
                        >
                          {CURVE_PRESETS.map((preset) => (
                            <option key={preset.id} value={preset.id}>
                              {preset.name}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] text-[#5E6985] italic">
                          {
                            CURVE_PRESETS.find(
                              (p) =>
                                p.id === (activeLayer.adjustments?.curvePreset ?? 'linear')
                            )?.description
                          }
                        </p>
                      </div>

                      {/* Reset Adjustments & Save to Assets Library actions */}
                      <div className="flex flex-col gap-2 pt-1">
                        <button
                          type="button"
                          disabled={
                            activeLayer.locked || !isAdjustmentActive(activeLayer.adjustments)
                          }
                          onClick={handleResetAdjustments}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md bg-[#10131E] hover:bg-[#1A2030] border border-[#293047] hover:border-[#8E9AB8] text-xs font-semibold text-[#8E9AB8] hover:text-[#D7DEED] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title="Reset color adjustments to neutral zero"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reset Color Adjustments</span>
                        </button>

                        <button
                          type="button"
                          disabled={isSavingToAssets || !activeLayer.sourceAssetId}
                          onClick={handleSaveLayerToAssets}
                          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-md bg-[#162238] hover:bg-[#1D2E4D] border border-[#38BDF8]/40 hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8] transition-colors cursor-pointer disabled:opacity-40 shadow-xs"
                          title="Save this graded layer as a separate reusable asset in the Assets Library"
                        >
                          {isSavingToAssets ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Saving to Library...</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span>Save to Assets Library</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {/* Universal Production Layer Mask Editor Modal (react-canvas-masker) */}
      <LayerMaskModal
        isOpen={isMaskModalOpen}
        layer={activeLayer}
        layerImageUrl={maskModalImageUrl}
        onApply={handleApplyMaskFromModal}
        onClose={() => setIsMaskModalOpen(false)}
      />
    </div>
  );
};
