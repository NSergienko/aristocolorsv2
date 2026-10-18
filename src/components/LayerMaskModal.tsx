/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MaskEditor, toMask, MaskEditorCanvasRef } from 'react-canvas-masker';
import 'react-canvas-masker/dist/style.css';
import {
  X,
  Undo2,
  Redo2,
  Trash2,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Paintbrush,
  Eraser,
  Eye,
  Info,
  Loader2,
} from 'lucide-react';
import {
  bwCanvasToAlphaCanvas,
  alphaBlobToBwDataUrl,
  createDefaultWhiteMaskDataUrl,
} from '../utils/maskConversion.ts';
import { loadBinaryAsset } from '../services/DocumentPersistence.ts';
import type { LayerNode } from '../types/DocumentModel.ts';

export interface LayerMaskModalProps {
  isOpen: boolean;
  layer: LayerNode | null;
  layerImageUrl: string | null;
  onApply: (
    alphaCanvas: HTMLCanvasElement,
    alphaBlob: Blob,
    rawBwBlob: Blob,
    maskWidth: number,
    maskHeight: number
  ) => Promise<void>;
  onClose: () => void;
}

export const LayerMaskModal: React.FC<LayerMaskModalProps> = ({
  isOpen,
  layer,
  layerImageUrl,
  onApply,
  onClose,
}) => {
  const maskCanvasRef = useRef<MaskEditorCanvasRef>(null as unknown as MaskEditorCanvasRef);

  // Editor states
  const [brushSize, setBrushSize] = useState<number>(30);
  const [maskColor, setMaskColor] = useState<string>('#000000'); // #000000 is Black (Hide/Conceal)
  const [maskOpacity, setMaskOpacity] = useState<number>(0.65);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [isLoadingMask, setIsLoadingMask] = useState<boolean>(true);
  const [initialMaskDataUrl, setInitialMaskDataUrl] = useState<string | undefined>(undefined);
  const [editorKey, setEditorKey] = useState<number>(1);

  // Width & height of layer mask
  const maskWidth = layer?.sourceWidth || 800;
  const maskHeight = layer?.sourceHeight || 600;

  // Hydrate existing mask when modal opens
  useEffect(() => {
    if (!isOpen || !layer) return;

    let isCancelled = false;
    setIsLoadingMask(true);

    const prepareMask = async () => {
      try {
        if (layer.mask?.maskAssetId) {
          const maskAssetId = layer.mask.maskAssetId;

          // 1. First priority: Check if raw B/W editable mask was saved to IndexedDB
          const rawBwBlob = await loadBinaryAsset(`bw_${maskAssetId}`);
          if (rawBwBlob && !isCancelled) {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(rawBwBlob);
            });
            setInitialMaskDataUrl(dataUrl);
            setEditorKey((k) => k + 1);
            setIsLoadingMask(false);
            return;
          }

          // 2. Second priority: Load alpha mask from IndexedDB and convert back to B/W
          const alphaBlob = await loadBinaryAsset(maskAssetId);
          if (alphaBlob && !isCancelled) {
            const bwUrl = await alphaBlobToBwDataUrl(alphaBlob, maskWidth, maskHeight);
            if (!isCancelled) {
              setInitialMaskDataUrl(bwUrl);
              setEditorKey((k) => k + 1);
              setIsLoadingMask(false);
              return;
            }
          }
        }

        // 3. Fallback: If no mask exists on layer, initialize pristine white mask (fully visible)
        if (!isCancelled) {
          const whiteMaskUrl = createDefaultWhiteMaskDataUrl(maskWidth, maskHeight);
          setInitialMaskDataUrl(whiteMaskUrl);
          setEditorKey((k) => k + 1);
          setIsLoadingMask(false);
        }
      } catch (err) {
        console.warn('[LayerMaskModal] Error preparing initial mask:', err);
        if (!isCancelled) {
          const whiteMaskUrl = createDefaultWhiteMaskDataUrl(maskWidth, maskHeight);
          setInitialMaskDataUrl(whiteMaskUrl);
          setEditorKey((k) => k + 1);
          setIsLoadingMask(false);
        }
      }
    };

    prepareMask();

    return () => {
      isCancelled = true;
    };
  }, [isOpen, layer, maskWidth, maskHeight]);

  // Imperative actions via ref
  const handleUndo = useCallback(() => {
    maskCanvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    maskCanvasRef.current?.redo();
  }, []);

  const handleClear = useCallback(() => {
    maskCanvasRef.current?.clear();
  }, []);

  const handleZoomIn = useCallback(() => {
    maskCanvasRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    maskCanvasRef.current?.zoomOut();
  }, []);

  const handleResetZoom = useCallback(() => {
    maskCanvasRef.current?.resetZoom();
  }, []);

  // Keyboard shortcuts when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Hide (Black) / Reveal (White)
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault();
        setMaskColor('#000000');
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        setMaskColor('#ffffff');
      }

      // Brush size adjustments with [ and ]
      if (e.key === '[') {
        e.preventDefault();
        setBrushSize((s) => Math.max(5, s - 5));
      } else if (e.key === ']') {
        e.preventDefault();
        setBrushSize((s) => Math.min(150, s + 5));
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
      }

      // Escape to close
      if (e.key === 'Escape' && !isApplying) {
        e.preventDefault();
        onClose();
      }

      // Ctrl/Cmd + Enter to apply
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isApplying && !isLoadingMask) {
        e.preventDefault();
        handleApply();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isApplying, isLoadingMask, handleUndo, handleRedo, onClose]);

  // Apply Mask action
  const handleApply = async () => {
    if (!maskCanvasRef.current?.maskCanvas || isApplying) return;

    try {
      setIsApplying(true);
      const bwCanvas = maskCanvasRef.current.maskCanvas;

      // 1. Convert B/W canvas to Alpha canvas for CanvasEngine (Alpha 0 = hide, Alpha 255 = reveal)
      const alphaCanvas = bwCanvasToAlphaCanvas(bwCanvas);

      // 2. Export Alpha PNG Blob for CanvasEngine persistence
      const alphaBlob = await new Promise<Blob>((resolve, reject) => {
        alphaCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate alpha mask blob'));
        }, 'image/png');
      });

      // 3. Export Raw B/W PNG Blob for lossless round-trip re-editing
      const rawBwBlob = await new Promise<Blob>((resolve, reject) => {
        bwCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to generate B/W mask blob'));
        }, 'image/png');
      });

      // 4. Dispatch to StudioWorkspace persistence handler
      await onApply(alphaCanvas, alphaBlob, rawBwBlob, bwCanvas.width, bwCanvas.height);
      onClose();
    } catch (err) {
      console.error('[LayerMaskModal] Failed to apply mask:', err);
    } finally {
      setIsApplying(false);
    }
  };

  if (!isOpen || !layer) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-5xl h-[88vh] bg-[#121624] border border-[#293047] rounded-2xl shadow-2xl overflow-hidden shadow-black/80">
        {/* Header Bar */}
        <div className="h-14 px-6 border-b border-[#232c45] bg-[#151a2b] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#1F1930] border border-[#7A1FA2]/60 flex items-center justify-center text-[#BA68C8] shadow-sm">
              <Paintbrush className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#D7DEED] flex items-center gap-2">
                <span>Edit Layer Mask</span>
                <span className="text-xs font-mono font-medium text-[#8E9AB8]">
                  • {layer.name}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#7A1FA2]/30 text-[#BA68C8] border border-[#BA68C8]/30">
                  {maskWidth} × {maskHeight} px
                </span>
              </h2>
              <p className="text-[11px] text-[#8E9AB8] mt-0.5">
                Black brush conceals (transparent), White brush reveals (visible).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="p-1.5 rounded-lg text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] transition-colors cursor-pointer disabled:opacity-40"
              title="Cancel and discard edits"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="px-6 py-2.5 bg-[#171B29] border-b border-[#232c45] flex flex-wrap items-center justify-between gap-3 shrink-0 select-none">
          {/* Tool mode: Conceal (Black) vs Reveal (White) */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#10131E] p-0.5 rounded-lg border border-[#293047]">
              <button
                type="button"
                onClick={() => setMaskColor('#000000')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  maskColor === '#000000'
                    ? 'bg-[#7A1FA2] text-white shadow-xs'
                    : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                }`}
                title="Paint with Black to conceal/hide"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-black border border-white/40" />
                <span>Hide (Black)</span>
              </button>

              <button
                type="button"
                onClick={() => setMaskColor('#ffffff')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  maskColor === '#ffffff'
                    ? 'bg-[#38BDF8] text-[#0D101A] shadow-xs'
                    : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                }`}
                title="Paint with White to reveal/erase mask"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-white border border-black/40" />
                <span>Reveal (White)</span>
              </button>
            </div>

            <div className="h-4 w-[1px] bg-[#293047]" />

            {/* Brush Size Slider */}
            <div className="flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span className="text-xs text-[#8E9AB8] font-medium">Size:</span>
              <input
                type="range"
                min={5}
                max={150}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 accent-[#38BDF8] cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-[#D7DEED] w-8">
                {brushSize}px
              </span>
            </div>

            <div className="h-4 w-[1px] bg-[#293047]" />

            {/* Mask Overlay Opacity Slider */}
            <div className="flex items-center gap-2">
              <Eye className="w-3.5 h-3.5 text-[#BA68C8]" />
              <span className="text-xs text-[#8E9AB8] font-medium">Overlay:</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={maskOpacity}
                onChange={(e) => setMaskOpacity(Number(e.target.value))}
                className="w-20 accent-[#BA68C8] cursor-pointer"
              />
              <span className="text-xs font-mono text-[#D7DEED] w-8">
                {Math.round(maskOpacity * 100)}%
              </span>
            </div>
          </div>

          {/* History & Zoom Actions */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-xs font-semibold text-[#D7DEED] transition-colors cursor-pointer"
              title="Undo stroke (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={handleRedo}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-xs font-semibold text-[#D7DEED] transition-colors cursor-pointer"
              title="Redo stroke (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Redo</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
              title="Clear all mask paint (reset to fully visible)"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>

            <div className="h-4 w-[1px] bg-[#293047]" />

            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-[#8E9AB8] hover:text-[#D7DEED] cursor-pointer"
              title="Zoom in"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-[#8E9AB8] hover:text-[#D7DEED] cursor-pointer"
              title="Zoom out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1 rounded-lg bg-[#121624] hover:bg-[#1E2436] border border-[#293047] text-[#8E9AB8] hover:text-[#D7DEED] cursor-pointer"
              title="Reset view"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Canvas Editing Viewport */}
        <div className="relative flex-1 bg-[#0A0D16] overflow-hidden flex items-center justify-center p-4">
          {isLoadingMask || !layerImageUrl ? (
            <div className="flex flex-col items-center justify-center gap-3 text-xs text-[#8E9AB8]">
              <Loader2 className="w-6 h-6 animate-spin text-[#BA68C8]" />
              <span>Loading layer image and mask state...</span>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center relative">
              <MaskEditor
                key={editorKey}
                src={layerImageUrl}
                canvasRef={maskCanvasRef}
                cursorSize={brushSize}
                maskColor={maskColor}
                maskOpacity={maskOpacity}
                onDrawingChange={() => {}}
                onCursorSizeChange={(size) => setBrushSize(size)}
                initialMask={initialMaskDataUrl}
                maxWidth={1400}
                maxHeight={900}
              />
            </div>
          )}

          {/* Bottom Help Tag */}
          <div className="absolute bottom-3 left-4 px-3 py-1.5 rounded-lg bg-[#121624]/90 border border-[#232c45] text-[11px] text-[#8E9AB8] backdrop-blur-md pointer-events-none flex items-center gap-2 shadow-lg">
            <Info className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>B: Hide (Black) • W: Reveal (White) • [/]: Brush Size • Ctrl+Z: Undo • Space+Drag: Pan • Wheel: Zoom</span>
          </div>
        </div>

        {/* Footer Actions Bar */}
        <div className="h-16 px-6 border-t border-[#232c45] bg-[#151a2b] flex items-center justify-between shrink-0 select-none">
          <div className="text-xs text-[#8E9AB8]">
            <span>Changes will apply directly to layer </span>
            <strong className="text-[#D7DEED]">{layer.name}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8E9AB8] hover:text-[#D7DEED] bg-[#181D2F] hover:bg-[#20273F] border border-[#232C45] transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              disabled={isApplying || isLoadingMask}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-[#7A1FA2] to-[#9C27B0] hover:from-[#8E24AA] hover:to-[#AB47BC] text-white shadow-lg shadow-[#7A1FA2]/40 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Applying Mask...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Apply Mask</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
