/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles,
  Upload,
  Download,
  RotateCcw,
  Sliders,
  Check,
  BookmarkPlus,
  Layers,
  ArrowRight,
  Eye,
  Columns,
  SplitSquareVertical,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FolderOpen,
  Image as ImageIcon,
  CheckCircle2,
  Palette,
  Loader2,
  Info,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import {
  CURVE_PRESETS,
  CurvePresetId,
  isAdjustmentActive,
  processColorAdjustments,
} from '../services/ColorAdjustmentService.ts';
import { storeBinaryAsset, loadBinaryAsset, saveDocument, createDefaultProjectDocument } from '../services/DocumentPersistence.ts';
import type { LayerAdjustments, ProjectDocument, LayerNode, ProjectAsset } from '../types/DocumentModel.ts';
import type { AssetRecord } from '../types/shell.ts';
import { useDocumentStore } from '../state/useDocumentStore.ts';

interface SamplePresetImage {
  id: string;
  title: string;
  category: string;
  url: string;
  width: number;
  height: number;
}

const SAMPLE_IMAGES: SamplePresetImage[] = [
  {
    id: 'cyberpunk',
    title: 'Cyberpunk Atlantis',
    category: 'Cinematic Sci-Fi',
    url: '/Cyberpank_Atlantis_1.png',
    width: 1920,
    height: 1080,
  },
  {
    id: 'desert',
    title: 'Desert Gold',
    category: 'High Dynamic Range',
    url: '/Desert_Gold.png',
    width: 1920,
    height: 1080,
  },
  {
    id: 'nature',
    title: 'Jungle Emerald',
    category: 'Nature & Foliage',
    url: '/Jungle_Emerald.png',
    width: 1920,
    height: 1080,
  },
  {
    id: 'neon',
    title: 'Neon City',
    category: 'Night City & Glow',
    url: '/Neon_city.png',
    width: 1920,
    height: 1080,
  },
  {
    id: 'cosmic',
    title: 'Cosmic Frontier',
    category: 'Deep Space & Stars',
    url: '/Cosmic_Frontier.png',
    width: 1920,
    height: 1080,
  },
  {
    id: 'ice',
    title: 'Ice Blue',
    category: 'Cool Cinema Palette',
    url: '/Ice_Blue.png',
    width: 1920,
    height: 1080,
  },
];

export const ColorLabPage: React.FC = () => {
  const { addToast, navigateTo, activeProjectId } = useShell();

  // Selected source image
  const [activeSampleId, setActiveSampleId] = useState<string>('cyberpunk');
  const [currentImageUrl, setCurrentImageUrl] = useState<string>(SAMPLE_IMAGES[0].url);
  const [currentImageTitle, setCurrentImageTitle] = useState<string>(SAMPLE_IMAGES[0].title);
  const [isCustomUpload, setIsCustomUpload] = useState<boolean>(false);

  // Loaded raw image element
  const [sourceImage, setSourceImage] = useState<HTMLImageElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({
    width: 1920,
    height: 1080,
  });
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);

  // Color adjustment state
  const [adjustments, setAdjustments] = useState<LayerAdjustments>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    hue: 0,
    temperature: 0,
    tint: 0,
    vibrance: 0,
    curvePreset: 'linear',
  });

  // Comparison & Viewport state
  const [viewMode, setViewMode] = useState<'graded' | 'split' | 'side-by-side'>('graded');
  const [splitPos, setSplitPos] = useState<number>(50); // percentage 0..100
  const [isHoldingOriginal, setIsHoldingOriginal] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [renderTimeMs, setRenderTimeMs] = useState<number>(0);

  // Action status
  const [isSavingToAssets, setIsSavingToAssets] = useState<boolean>(false);
  const [isSendingToStudio, setIsSendingToStudio] = useState<boolean>(false);

  // Canvas refs
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingSplitRef = useRef<boolean>(false);

  // 1. Load source image element when URL changes
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingImage(true);

    const img = new Image();

    // Only set crossOrigin if loading from external HTTP/HTTPS origin
    if (currentImageUrl.startsWith('http://') || currentImageUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (isCancelled) return;
      setSourceImage(img);
      setImageDimensions({
        width: img.naturalWidth || 1920,
        height: img.naturalHeight || 1080,
      });
      setIsLoadingImage(false);
    };

    img.onerror = () => {
      if (isCancelled) return;
      console.warn('[ColorLab] Failed to load image URL:', currentImageUrl);
      setIsLoadingImage(false);
      addToast({
        type: 'error',
        title: 'Image Load Error',
        message: 'Could not load selected image source.',
      });
    };

    img.src = currentImageUrl;

    return () => {
      isCancelled = true;
    };
  }, [currentImageUrl, addToast]);

  // 2. Render color graded result using unified glfx pipeline
  const renderGradedCanvas = useCallback(() => {
    if (!sourceImage || !displayCanvasRef.current) return;

    const displayCanvas = displayCanvasRef.current;
    const w = imageDimensions.width;
    const h = imageDimensions.height;

    const startTime = performance.now();

    // Ensure display canvas matches resolution
    if (displayCanvas.width !== w || displayCanvas.height !== h) {
      displayCanvas.width = w;
      displayCanvas.height = h;
    }

    const ctx = displayCanvas.getContext('2d');
    if (!ctx) return;

    // Check if user is holding compare to view original
    if (isHoldingOriginal || !isAdjustmentActive(adjustments)) {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sourceImage, 0, 0, w, h);
      setRenderTimeMs(Math.round(performance.now() - startTime));
      return;
    }

    // Process through unified glfx.js pipeline
    const processedCanvas = processColorAdjustments(sourceImage, adjustments, w, h);

    if (processedCanvas) {
      ctx.clearRect(0, 0, w, h);

      if (viewMode === 'split') {
        // Draw full processed image
        ctx.drawImage(processedCanvas, 0, 0, w, h);

        // Clip and draw original on left side of split slider
        const splitX = Math.round((w * splitPos) / 100);
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, splitX, h);
        ctx.clip();
        ctx.drawImage(sourceImage, 0, 0, w, h);
        ctx.restore();

        // Draw divider line
        ctx.save();
        ctx.strokeStyle = '#38BDF8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(splitX, 0);
        ctx.lineTo(splitX, h);
        ctx.stroke();
        ctx.restore();
      } else {
        // Regular full graded view
        ctx.drawImage(processedCanvas, 0, 0, w, h);
      }
    } else {
      // Fallback: draw clean source
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(sourceImage, 0, 0, w, h);
    }

    setRenderTimeMs(Math.round((performance.now() - startTime) * 10) / 10);
  }, [sourceImage, imageDimensions, adjustments, isHoldingOriginal, viewMode, splitPos]);

  useEffect(() => {
    renderGradedCanvas();
  }, [renderGradedCanvas]);

  // 3. User adjustments update
  const handleAdjustmentChange = (patch: Partial<LayerAdjustments>) => {
    setAdjustments((prev) => ({ ...prev, ...patch }));
  };

  const handleResetAdjustments = () => {
    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      hue: 0,
      temperature: 0,
      tint: 0,
      vibrance: 0,
      curvePreset: 'linear',
    });
    addToast({
      type: 'info',
      title: 'Adjustments Reset',
      message: 'All color sliders reset to neutral values.',
    });
  };

  // 4. Custom file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setIsCustomUpload(true);
    setActiveSampleId('');
    setCurrentImageTitle(file.name.replace(/\.[^/.]+$/, ''));
    setCurrentImageUrl(url);

    addToast({
      type: 'success',
      title: 'Custom Image Loaded',
      message: `Loaded "${file.name}" into Color Lab.`,
    });
  };

  // 5. Save to Assets Library
  const handleSaveToAssets = async () => {
    if (!sourceImage || !displayCanvasRef.current || isSavingToAssets) return;

    try {
      setIsSavingToAssets(true);
      const w = imageDimensions.width;
      const h = imageDimensions.height;

      // Render graded image to a fresh offscreen canvas
      let finalCanvas: HTMLCanvasElement;
      if (isAdjustmentActive(adjustments)) {
        const processed = processColorAdjustments(sourceImage, adjustments, w, h);
        finalCanvas = processed || displayCanvasRef.current;
      } else {
        finalCanvas = displayCanvasRef.current;
      }

      // Generate lossless PNG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        finalCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create PNG blob'));
        }, 'image/png');
      });

      const assetId = `asset-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const title = `${currentImageTitle} (Color Graded)`;

      // Persist binary into IndexedDB
      await storeBinaryAsset(assetId, blob);

      // Register metadata in localStorage
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
        tags: ['Color Lab', 'glfx', 'Color Graded', adjustments.curvePreset || 'linear'],
      };

      try {
        const stored = localStorage.getItem('aristo_assets_v2');
        const existing: AssetRecord[] = stored ? JSON.parse(stored) : [];
        const leanAssets = [
          { ...newAsset, url: '' },
          ...existing.filter((a) => a.id !== assetId),
        ];
        localStorage.setItem('aristo_assets_v2', JSON.stringify(leanAssets));
      } catch (err) {
        console.warn('[ColorLab] Error writing asset to localStorage:', err);
      }

      addToast({
        type: 'success',
        title: 'Saved to Assets Library',
        message: `"${title}" is now available in your Assets Library!`,
      });
    } catch (err) {
      console.error('[ColorLab] Error saving to Assets Library:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: 'Could not export graded asset to library.',
      });
    } finally {
      setIsSavingToAssets(false);
    }
  };

  // 6. Direct PNG Export
  const handleExportPNG = () => {
    if (!displayCanvasRef.current) return;

    try {
      const dataUrl = displayCanvasRef.current.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${currentImageTitle.replace(/\s+/g, '_')}_color_graded.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      addToast({
        type: 'success',
        title: 'PNG Exported',
        message: `Exported ${imageDimensions.width} × ${imageDimensions.height} px graded image.`,
      });
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        message: 'Failed to export image.',
      });
    }
  };

  // 7. Send to Studio Canvas (Create new project or add layer)
  const handleSendToStudio = async () => {
    if (!sourceImage || !displayCanvasRef.current || isSendingToStudio) return;

    try {
      setIsSendingToStudio(true);
      const w = imageDimensions.width;
      const h = imageDimensions.height;

      // 1. Export PNG blob of graded image
      const finalCanvas = isAdjustmentActive(adjustments)
        ? processColorAdjustments(sourceImage, adjustments, w, h) || displayCanvasRef.current
        : displayCanvasRef.current;

      const blob = await new Promise<Blob>((resolve, reject) => {
        finalCanvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('Failed to create PNG blob'));
        }, 'image/png');
      });

      const assetId = `asset-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await storeBinaryAsset(assetId, blob);

      // 2. Create project metadata & document
      const projectId = `proj-colorlab-${Date.now()}`;
      const projectTitle = `${currentImageTitle} Graded`;

      const projectAsset: ProjectAsset = {
        id: assetId,
        name: `${currentImageTitle} (Color Graded)`,
        mimeType: 'image/png',
        width: w,
        height: h,
        sizeBytes: blob.size,
        storageKey: assetId,
        createdAt: Date.now(),
      };

      const rootLayerId = `layer-graded-${Date.now()}`;
      const gradedLayer: LayerNode = {
        id: rootLayerId,
        parentId: null,
        name: `${currentImageTitle} Graded`,
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
        sourceWidth: w,
        sourceHeight: h,
        // Retain the editable adjustments on the layer in Studio!
        adjustments: { ...adjustments },
        childrenIds: [],
      };

      const doc: ProjectDocument = {
        id: projectId,
        name: projectTitle,
        width: w,
        height: h,
        dpi: 72,
        colorSpace: 'srgb',
        rootLayerIds: [rootLayerId],
        layers: {
          [rootLayerId]: gradedLayer,
        },
        assets: {
          [assetId]: projectAsset,
        },
        activeLayerId: rootLayerId,
        selectedLayerIds: [rootLayerId],
        selection: null,
        viewport: {
          zoom: 1,
          panX: 0,
          panY: 0,
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await saveDocument(doc);

      // Register project in localStorage
      const projMeta = {
        id: projectId,
        title: projectTitle,
        width: w,
        height: h,
        dpi: 72,
        colorSpace: 'srgb' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastOpenedAt: new Date().toISOString(),
        layerCount: 1,
        tags: ['Color Lab', 'Graded'],
      };

      try {
        const stored = localStorage.getItem('aristo_projects_v2');
        const list = stored ? JSON.parse(stored) : [];
        localStorage.setItem('aristo_projects_v2', JSON.stringify([projMeta, ...list]));
      } catch (e) {
        console.warn('[ColorLab] Error saving project meta:', e);
      }

      // Set active document in Zustand store & open Studio
      useDocumentStore.getState().setDocument(doc);
      useDocumentStore.getState().setActiveLayer(rootLayerId);

      addToast({
        type: 'success',
        title: 'Project Created',
        message: 'Opened graded image in Studio Canvas.',
      });

      navigateTo('studio');
    } catch (err) {
      console.error('[ColorLab] Error sending to Studio:', err);
      addToast({
        type: 'error',
        title: 'Error Opening Studio',
        message: 'Could not create new Studio project.',
      });
    } finally {
      setIsSendingToStudio(false);
    }
  };

  // Keyboard shortcut: hold space to view original
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setIsHoldingOriginal(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        setIsHoldingOriginal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-2.75rem)] w-full bg-[#0D101A] text-[#D7DEED] overflow-hidden select-none">
      {/* 1. Header Bar */}
      <header className="h-14 px-5 bg-[#131724] border-b border-[#242B3F] flex items-center justify-between shrink-0 shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#18233C] border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8] shadow-sm">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#D7DEED]">Color Lab</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#38BDF8]/20 border border-[#38BDF8]/40 text-[#38BDF8]">
                GPU glfx.js Core
              </span>
              <span className="text-xs text-[#8E9AB8]">
                • {currentImageTitle} ({imageDimensions.width} × {imageDimensions.height} px)
              </span>
            </div>
            <p className="text-[11px] text-[#8E9AB8] mt-0.5">
              Full-screen cinematic color grading, tone mapping, and lighting laboratory.
            </p>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2F] hover:bg-[#20273F] border border-[#293047] text-xs font-semibold text-[#D7DEED] transition-colors cursor-pointer"
            title="Upload local PNG or JPG"
          >
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Upload Image</span>
          </button>

          <button
            type="button"
            onClick={handleExportPNG}
            disabled={isLoadingImage}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2F] hover:bg-[#20273F] border border-[#293047] text-xs font-semibold text-[#D7DEED] transition-colors cursor-pointer disabled:opacity-40"
            title="Download graded PNG"
          >
            <Download className="w-3.5 h-3.5 text-[#BA68C8]" />
            <span>Export PNG</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToAssets}
            disabled={isLoadingImage || isSavingToAssets}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#18233C] hover:bg-[#1F2F52] border border-[#38BDF8]/60 text-xs font-bold text-[#38BDF8] shadow-sm transition-colors cursor-pointer disabled:opacity-40"
            title="Save as reusable asset in Assets Library"
          >
            {isSavingToAssets ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <BookmarkPlus className="w-3.5 h-3.5" />
            )}
            <span>Save to Library</span>
          </button>

          <button
            type="button"
            onClick={handleSendToStudio}
            disabled={isLoadingImage || isSendingToStudio}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#7A1FA2] to-[#9C27B0] hover:from-[#8E24AA] hover:to-[#AB47BC] text-white text-xs font-bold shadow-md shadow-[#7A1FA2]/30 transition-all cursor-pointer disabled:opacity-50"
            title="Open in Studio Canvas as an editable project"
          >
            {isSendingToStudio ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Palette className="w-3.5 h-3.5" />
            )}
            <span>Open in Studio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* 2. Main Content Split View: Viewport (Left) + Inspector Controls (Right) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Viewport and Preset Strip */}
        <div className="flex-1 flex flex-col bg-[#0A0D16] relative overflow-hidden">
          {/* Viewport Top Bar (Comparison Mode & Zoom) */}
          <div className="h-10 px-4 bg-[#101422] border-b border-[#1E2538] flex items-center justify-between shrink-0 select-none text-xs">
            {/* Sample Preset Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[11px] text-[#8E9AB8] mr-1 font-medium">Presets:</span>
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    setActiveSampleId(sample.id);
                    setIsCustomUpload(false);
                    setCurrentImageTitle(sample.title);
                    setCurrentImageUrl(sample.url);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    activeSampleId === sample.id
                      ? 'bg-[#1F2B48] text-[#38BDF8] border border-[#38BDF8]/40'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#181D2F]'
                  }`}
                >
                  {sample.title}
                </button>
              ))}
            </div>

            {/* View Mode & Hold to Compare */}
            <div className="flex items-center gap-3">
              {/* Compare Button */}
              <button
                type="button"
                onMouseDown={() => setIsHoldingOriginal(true)}
                onMouseUp={() => setIsHoldingOriginal(false)}
                onMouseLeave={() => setIsHoldingOriginal(false)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                  isHoldingOriginal
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400'
                    : 'bg-[#181D2F] hover:bg-[#20273F] text-[#8E9AB8] hover:text-[#D7DEED] border border-[#293047]'
                }`}
                title="Hold spacebar or click and hold to preview original unadjusted image"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{isHoldingOriginal ? 'Viewing Original' : 'Hold to Compare'}</span>
              </button>

              <div className="h-4 w-[1px] bg-[#293047]" />

              {/* View Mode: Graded vs Split Slider */}
              <div className="flex items-center bg-[#151928] p-0.5 rounded-lg border border-[#293047]">
                <button
                  onClick={() => setViewMode('graded')}
                  className={`px-2 py-0.8 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    viewMode === 'graded'
                      ? 'bg-[#38BDF8] text-[#0A0D16] font-bold'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Full graded image preview"
                >
                  Graded
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`flex items-center gap-1 px-2 py-0.8 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    viewMode === 'split'
                      ? 'bg-[#38BDF8] text-[#0A0D16] font-bold'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Interactive split-screen comparison slider"
                >
                  <SplitSquareVertical className="w-3 h-3" />
                  <span>Split</span>
                </button>
              </div>

              <div className="h-4 w-[1px] bg-[#293047]" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.25, Math.round((z - 0.15) * 100) / 100))}
                  className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#181D2F]"
                  title="Zoom out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono text-[#D7DEED] w-10 text-center">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(3, Math.round((z + 0.15) * 100) / 100))}
                  className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#181D2F]"
                  title="Zoom in"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setZoomLevel(1)}
                  className="px-1.5 py-0.5 rounded text-[10px] text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#181D2F]"
                  title="Reset Zoom to 100%"
                >
                  100%
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Canvas Viewport Area */}
          <div
            ref={containerRef}
            className="flex-1 relative overflow-auto flex items-center justify-center p-6 bg-canvas-checker"
            style={{
              backgroundSize: '16px 16px',
            }}
          >
            {isLoadingImage ? (
              <div className="flex flex-col items-center justify-center gap-3 text-xs text-[#8E9AB8]">
                <Loader2 className="w-6 h-6 animate-spin text-[#38BDF8]" />
                <span>Loading high-resolution asset into GPU pipeline...</span>
              </div>
            ) : (
              <div
                className="relative shadow-2xl rounded-lg overflow-hidden border border-[#293047] transition-transform duration-75"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              >
                <canvas
                  ref={displayCanvasRef}
                  className="block max-w-none cursor-default"
                  style={{
                    maxHeight: '75vh',
                    width: 'auto',
                    height: 'auto',
                  }}
                />

                {/* Split slider overlay handle if viewMode === 'split' */}
                {viewMode === 'split' && (
                  <div
                    className="absolute inset-0 cursor-ew-resize select-none pointer-events-auto"
                    onMouseDown={(e) => {
                      isDraggingSplitRef.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setSplitPos(pos);
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingSplitRef.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setSplitPos(pos);
                    }}
                    onMouseUp={() => {
                      isDraggingSplitRef.current = false;
                    }}
                    onMouseLeave={() => {
                      isDraggingSplitRef.current = false;
                    }}
                  >
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#38BDF8] pointer-events-none"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#38BDF8] text-[#0A0D16] flex items-center justify-center shadow-lg text-[10px] font-bold">
                        ↔
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Status Overlay */}
            <div className="absolute bottom-3 left-4 px-3 py-1.5 rounded-lg bg-[#121624]/90 border border-[#232c45] text-[11px] text-[#8E9AB8] backdrop-blur-md pointer-events-none flex items-center gap-3 shadow-lg">
              <span className="flex items-center gap-1 text-[#38BDF8]">
                <CheckCircle2 className="w-3 h-3" />
                <span>WebGL Ready</span>
              </span>
              <span>•</span>
              <span>Render time: <strong className="text-[#D7DEED] font-mono">{renderTimeMs}ms</strong></span>
              <span>•</span>
              <span>Hold Space to view original</span>
            </div>
          </div>
        </div>

        {/* Right: Color Correction Controls Inspector Sidebar */}
        <aside className="w-80 bg-[#131724] border-l border-[#242B3F] flex flex-col shrink-0 overflow-y-auto">
          {/* Panel Header */}
          <div className="p-4 border-b border-[#242B3F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#38BDF8]" />
              <h2 className="text-xs font-bold text-[#D7DEED] uppercase tracking-wider">
                Grading Controls
              </h2>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                isAdjustmentActive(adjustments)
                  ? 'bg-[#38BDF8]/20 border-[#38BDF8]/40 text-[#38BDF8]'
                  : 'bg-[#10131E] border-[#293047] text-[#5E6985]'
              }`}
            >
              {isAdjustmentActive(adjustments) ? 'Graded' : 'Neutral'}
            </span>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* RGB Curves Presets */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#D7DEED] flex items-center justify-between">
                <span>RGB Curves Preset</span>
                <span className="text-[10px] text-[#38BDF8] font-mono">
                  {adjustments.curvePreset}
                </span>
              </label>
              <select
                value={adjustments.curvePreset || 'linear'}
                onChange={(e) => handleAdjustmentChange({ curvePreset: e.target.value as CurvePresetId })}
                className="w-full bg-[#10131E] border border-[#293047] rounded-lg px-2.5 py-1.5 text-xs text-[#D7DEED] focus:outline-none focus:border-[#38BDF8] cursor-pointer"
              >
                {CURVE_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-[#8E9AB8] italic">
                {CURVE_PRESETS.find((p) => p.id === (adjustments.curvePreset || 'linear'))?.description}
              </p>
            </div>

            <div className="h-[1px] bg-[#242B3F]" />

            {/* Tone & Exposure */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold text-[#8E9AB8] uppercase tracking-wider">
                Tone & Exposure
              </span>

              {/* Brightness */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9AB8]">Brightness</span>
                  <span className="text-[#D7DEED] font-mono font-bold">
                    {(adjustments.brightness ?? 0) > 0 ? `+${adjustments.brightness}` : adjustments.brightness}
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={adjustments.brightness ?? 0}
                  onChange={(e) => handleAdjustmentChange({ brightness: Number(e.target.value) })}
                  className="w-full accent-[#38BDF8] cursor-pointer"
                />
              </div>

              {/* Contrast */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9AB8]">Contrast</span>
                  <span className="text-[#D7DEED] font-mono font-bold">
                    {(adjustments.contrast ?? 0) > 0 ? `+${adjustments.contrast}` : adjustments.contrast}
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={adjustments.contrast ?? 0}
                  onChange={(e) => handleAdjustmentChange({ contrast: Number(e.target.value) })}
                  className="w-full accent-[#38BDF8] cursor-pointer"
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#242B3F]" />

            {/* Color & Saturation */}
            <div className="flex flex-col gap-3">
              <span className="text-[11px] font-bold text-[#8E9AB8] uppercase tracking-wider">
                Color & Chrominance
              </span>

              {/* Saturation */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9AB8]">Saturation</span>
                  <span className="text-[#D7DEED] font-mono font-bold">
                    {(adjustments.saturation ?? 0) > 0 ? `+${adjustments.saturation}` : adjustments.saturation}
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={adjustments.saturation ?? 0}
                  onChange={(e) => handleAdjustmentChange({ saturation: Number(e.target.value) })}
                  className="w-full accent-[#38BDF8] cursor-pointer"
                />
              </div>

              {/* Vibrance */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9AB8]">Vibrance</span>
                  <span className="text-[#D7DEED] font-mono font-bold">
                    {(adjustments.vibrance ?? 0) > 0 ? `+${adjustments.vibrance}` : adjustments.vibrance}
                  </span>
                </div>
                <input
                  type="range"
                  min={-100}
                  max={100}
                  step={1}
                  value={adjustments.vibrance ?? 0}
                  onChange={(e) => handleAdjustmentChange({ vibrance: Number(e.target.value) })}
                  className="w-full accent-[#38BDF8] cursor-pointer"
                />
              </div>

              {/* Hue Shift */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#8E9AB8]">Hue Shift</span>
                  <span className="text-[#D7DEED] font-mono font-bold">
                    {(adjustments.hue ?? 0) > 0 ? `+${adjustments.hue}°` : `${adjustments.hue}°`}
                  </span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={adjustments.hue ?? 0}
                  onChange={(e) => handleAdjustmentChange({ hue: Number(e.target.value) })}
                  className="w-full accent-[#BA68C8] cursor-pointer"
                />
              </div>
            </div>

            <div className="h-[1px] bg-[#242B3F]" />

            {/* Reset Action */}
            <button
              type="button"
              disabled={!isAdjustmentActive(adjustments)}
              onClick={handleResetAdjustments}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-[#10131E] hover:bg-[#181D2F] border border-[#293047] hover:border-[#8E9AB8] text-xs font-semibold text-[#8E9AB8] hover:text-[#D7DEED] transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Adjustments</span>
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
