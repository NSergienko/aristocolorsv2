/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Scissors,
  Upload,
  CheckCircle2,
  AlertCircle,
  Download,
  RotateCcw,
  Sparkles,
  Layers,
  ArrowRight,
  Check,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { storeBinaryAsset } from '../services/DocumentPersistence.ts';
import { AssetRecord } from '../types/shell.ts';

interface ImageItem {
  id: string;
  title: string;
  category: string;
  imageUrl: string;
  isCustom?: boolean;
}

interface ImageCutoutState {
  status: 'idle' | 'processing' | 'completed' | 'failed';
  resultDataUrl?: string;
  width?: number;
  height?: number;
  savedToLibrary?: boolean;
  errorMessage?: string;
}

const DEFAULT_PRESETS: ImageItem[] = [
  {
    id: 'tree',
    title: 'Foliage & Fine Branches',
    category: 'Nature & Foliage',
    imageUrl:
      'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'character',
    title: 'Portrait & Intricate Hair',
    category: 'Character & Hair',
    imageUrl:
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&auto=format&fit=crop&q=80',
  },
  {
    id: 'vehicle',
    title: 'Vehicle & Sharp Edges',
    category: 'Hard Surface',
    imageUrl:
      'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=1200&auto=format&fit=crop&q=80',
  },
];

export const BriaPocPage: React.FC = () => {
  const { addToast, navigateTo } = useShell();

  // Connection indicator state
  const [isServiceReady, setIsServiceReady] = useState(false);
  const [isCheckingService, setIsCheckingService] = useState(true);

  // Images list (default presets + custom user uploads)
  const [images, setImages] = useState<ImageItem[]>(DEFAULT_PRESETS);
  const [activeImageId, setActiveImageId] = useState<string>(DEFAULT_PRESETS[0].id);

  // Cutout results dictionary keyed by image id — preserves cutouts across image switching
  const [cutouts, setCutouts] = useState<Record<string, ImageCutoutState>>({
    tree: { status: 'idle' },
    character: { status: 'idle' },
    vehicle: { status: 'idle' },
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check connection status
  const checkServiceStatus = async () => {
    setIsCheckingService(true);
    try {
      const res = await fetch('/api/bria/status');
      if (res.ok) {
        const data = await res.json();
        setIsServiceReady(!!data.configured);
      } else {
        setIsServiceReady(false);
      }
    } catch {
      setIsServiceReady(false);
    } finally {
      setIsCheckingService(false);
    }
  };

  useEffect(() => {
    checkServiceStatus();
  }, []);

  const activeImage = images.find((img) => img.id === activeImageId) || images[0];
  const activeCutoutState = cutouts[activeImageId] || { status: 'idle' };

  // Handle image upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      addToast({
        type: 'error',
        title: 'Unsupported File',
        message: 'Please choose an image file (PNG, JPG, WEBP).',
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const customId = `custom-${Date.now()}`;
      const customName = file.name.replace(/\.[^/.]+$/, '');

      const newImage: ImageItem = {
        id: customId,
        title: customName,
        category: 'Custom Upload',
        imageUrl: dataUrl,
        isCustom: true,
      };

      setImages((prev) => [newImage, ...prev]);
      setActiveImageId(customId);
      setCutouts((prev) => ({
        ...prev,
        [customId]: { status: 'idle' },
      }));

      addToast({
        type: 'info',
        title: 'Image Loaded',
        message: `"${customName}" loaded into Cutout Lab.`,
      });
    };
    reader.readAsDataURL(file);
    if (e.target) e.target.value = '';
  };

  // Run background removal
  const handleRemoveBackground = async () => {
    if (!activeImage) return;

    setCutouts((prev) => ({
      ...prev,
      [activeImageId]: {
        ...(prev[activeImageId] || {}),
        status: 'processing',
        errorMessage: undefined,
      },
    }));

    try {
      const response = await fetch('/api/bria/cutout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: activeImage.imageUrl,
          testType: activeImage.id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Background removal processing failed.');
      }

      setCutouts((prev) => ({
        ...prev,
        [activeImageId]: {
          status: 'completed',
          resultDataUrl: data.resultDataUrl,
          width: data.width,
          height: data.height,
          savedToLibrary: false,
        },
      }));

      addToast({
        type: 'success',
        title: 'Background Removed',
        message: `Completed transparent cutout for "${activeImage.title}".`,
      });
    } catch (err: any) {
      console.error('[Cutout] Request failed:', err);
      const errorMsg = err.message || 'Background removal request failed.';

      setCutouts((prev) => ({
        ...prev,
        [activeImageId]: {
          ...(prev[activeImageId] || {}),
          status: 'failed',
          errorMessage: errorMsg,
        },
      }));

      addToast({
        type: 'error',
        title: 'Removal Failed',
        message: errorMsg,
      });
    }
  };

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binaryString = atob(parts[1]);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

  // Save cutout to Assets Library
  const handleSaveToLibrary = async () => {
    if (!activeImage || !activeCutoutState.resultDataUrl) return;

    try {
      const assetId = `asset-custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const title = `${activeImage.title} (Cutout)`;

      // 1. Convert base64 data to native binary Blob
      const blob = dataUrlToBlob(activeCutoutState.resultDataUrl);

      // 2. Persist binary blob directly into IndexedDB project_assets store FIRST
      await storeBinaryAsset(assetId, blob);

      // 3. Create active in-memory object URL for immediate display
      const objectUrl = URL.createObjectURL(blob);

      // 4. Create standard AssetRecord metadata
      const newAsset: AssetRecord = {
        id: assetId,
        title,
        category: 'cutout',
        url: objectUrl,
        width: activeCutoutState.width || 1024,
        height: activeCutoutState.height || 1024,
        fileSizeBytes: blob.size,
        format: 'png',
        createdAt: new Date().toISOString(),
        tags: ['Cutout', 'Transparent', activeImage.category],
      };

      // 5. Persist lightweight metadata to existing Assets Library catalog in localStorage
      let existingAssets: AssetRecord[] = [];
      try {
        const stored = localStorage.getItem('aristo_assets_v2');
        if (stored) {
          existingAssets = JSON.parse(stored);
        }
      } catch (e) {
        console.warn('Failed reading existing assets:', e);
      }

      const updatedAssets = [newAsset, ...existingAssets.filter((a) => a.id !== assetId)];
      try {
        localStorage.setItem('aristo_assets_v2', JSON.stringify(updatedAssets));
      } catch (lsErr) {
        console.warn('Could not update localStorage directly, IndexedDB record saved:', lsErr);
      }

      // 6. Update status in local component state
      setCutouts((prev) => ({
        ...prev,
        [activeImageId]: {
          ...prev[activeImageId],
          savedToLibrary: true,
        },
      }));

      addToast({
        type: 'success',
        title: 'Saved to Assets Library',
        message: `"${title}" is now available in your Assets Library.`,
      });
    } catch (err: any) {
      console.error('[Cutout Lab] Failed to save asset:', err);
      addToast({
        type: 'error',
        title: 'Save Failed',
        message: err.message || 'Failed to save cutout to Assets Library.',
      });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-y-auto bg-[#0A0D16] text-[#D7DEED] p-6 lg:p-8 font-sans selection:bg-[#BA68C8]/30">
      <div className="max-w-7xl w-full mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#1E2538]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#7A1FA2] to-[#4A148C] flex items-center justify-center text-white shadow-lg shadow-[#7A1FA2]/30 ring-1 ring-[#BA68C8]/40">
              <Scissors className="w-5 h-5 text-[#E1BEE7]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Cutout Lab
              </h1>
              <p className="text-xs text-[#8E9AB8]">
                Professional background removal and transparent asset compositing.
              </p>
            </div>
          </div>

          {/* Minimal Neutral Connection Indicator */}
          <div className="flex items-center gap-3">
            <div
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                isServiceReady
                  ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : 'bg-[#1C161D] border-[#382635] text-[#D4A3C2]'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isServiceReady
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                    : 'bg-[#A85577]'
                }`}
              />
              <span className="text-[#8E9AB8]">Status:</span>
              <span className="font-semibold text-white">
                {isServiceReady ? 'Ready' : 'Unavailable'}
              </span>
            </div>

            <button
              onClick={checkServiceStatus}
              disabled={isCheckingService}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-[#141A29] hover:bg-[#1D253A] border border-[#27324E] text-[#B0BDD9] transition-colors cursor-pointer"
              title="Refresh connection status"
            >
              <RotateCcw
                className={`w-3.5 h-3.5 ${isCheckingService ? 'animate-spin text-[#BA68C8]' : ''}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* 1. Image Selection Strip */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[#8E9AB8] font-mono">
              Source Images
            </span>
            <span className="text-xs text-[#5E6985]">
              Select an image to preview or upload your own
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img) => {
              const isSelected = activeImageId === img.id;
              const imgState = cutouts[img.id] || { status: 'idle' };

              return (
                <div
                  key={img.id}
                  onClick={() => setActiveImageId(img.id)}
                  className={`relative p-2.5 rounded-xl border transition-all cursor-pointer group flex flex-col justify-between ${
                    isSelected
                      ? 'bg-[#1F1930] border-[#9C27B0] ring-2 ring-[#BA68C8]/50 shadow-lg shadow-black/50'
                      : 'bg-[#121624] border-[#232C45] hover:border-[#384363] hover:bg-[#171C2E]'
                  }`}
                >
                  <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/40 mb-2 relative">
                    <img
                      src={img.imageUrl}
                      alt={img.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />

                    {/* Status Badge on thumbnail */}
                    {imgState.status === 'completed' && (
                      <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/90 text-white shadow">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Cutout
                      </span>
                    )}
                    {imgState.status === 'processing' && (
                      <span className="absolute top-1.5 right-1.5 flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-[#7A1FA2]/90 text-white shadow animate-pulse">
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        Processing
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-xs font-semibold text-white truncate">
                      {img.title}
                    </h3>
                    <p className="text-[10px] text-[#8E9AB8] truncate mt-0.5">
                      {img.category}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Upload Tile */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 rounded-xl border border-dashed border-[#384363] hover:border-[#9C27B0] bg-[#121624]/60 hover:bg-[#1A182E]/50 transition-all cursor-pointer flex flex-col items-center justify-center gap-2 group min-h-[110px]"
            >
              <div className="w-9 h-9 rounded-full bg-[#1F1930] border border-[#7A1FA2]/40 flex items-center justify-center text-[#CE93D8] group-hover:scale-110 transition-transform">
                <Upload className="w-4 h-4" />
              </div>
              <span className="text-xs font-semibold text-[#B0BDD9] group-hover:text-white text-center">
                + Upload Image
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
        </div>

        {/* 2. Large Preview & Cutout Workbench */}
        <div className="p-5 rounded-2xl bg-[#121624] border border-[#232C45] shadow-2xl space-y-5">
          {/* Action Header in Preview */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#232C45]">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-white">
                  {activeImage.title}
                </h2>

                {/* State Indicator */}
                {activeCutoutState.status === 'idle' && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#1C2237] text-[#8E9AB8] border border-[#2E3B5C]">
                    Ready
                  </span>
                )}
                {activeCutoutState.status === 'processing' && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#7A1FA2]/20 text-[#CE93D8] border border-[#7A1FA2]/50 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin text-[#BA68C8]" />
                    Processing
                  </span>
                )}
                {activeCutoutState.status === 'completed' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    <CheckCircle2 className="w-3 h-3" />
                    Completed
                  </span>
                )}
                {activeCutoutState.status === 'failed' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/40">
                    <AlertCircle className="w-3 h-3" />
                    Failed
                  </span>
                )}
              </div>
              <p className="text-xs text-[#8E9AB8]">
                {activeImage.category}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Primary Remove Background action */}
              {activeCutoutState.status !== 'completed' ? (
                <button
                  onClick={handleRemoveBackground}
                  disabled={activeCutoutState.status === 'processing' || !isServiceReady}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                    activeCutoutState.status === 'processing'
                      ? 'bg-[#7A1FA2]/50 text-white cursor-wait animate-pulse'
                      : !isServiceReady
                      ? 'bg-[#2C3347] text-[#697594] cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#8E24AA] to-[#6A1B9A] hover:from-[#9C27B0] hover:to-[#7B1FA2] text-white shadow-[#7A1FA2]/30 hover:scale-[1.02]'
                  }`}
                >
                  {activeCutoutState.status === 'processing' ? (
                    <>
                      <Sparkles className="w-4 h-4 animate-spin text-[#E1BEE7]" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Scissors className="w-4 h-4 text-[#E1BEE7]" />
                      Remove Background
                    </>
                  )}
                </button>
              ) : (
                <>
                  {/* Re-process option if needed */}
                  <button
                    onClick={handleRemoveBackground}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-[#1A2033] hover:bg-[#252E48] text-[#B0BDD9] border border-[#2E3A59] transition-colors cursor-pointer"
                    title="Run background removal again"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-[#BA68C8]" />
                    <span>Re-process</span>
                  </button>

                  {/* 1. Download PNG */}
                  <a
                    href={activeCutoutState.resultDataUrl}
                    download={`cutout-${activeImage.title.toLowerCase().replace(/\s+/g, '-')}.png`}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#1F293D] hover:bg-[#2A3752] text-white border border-[#38486B] transition-colors shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-[#38BDF8]" />
                    <span>Download PNG</span>
                  </a>

                  {/* 2. Save to Assets Library */}
                  <button
                    onClick={handleSaveToLibrary}
                    disabled={activeCutoutState.savedToLibrary}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                      activeCutoutState.savedToLibrary
                        ? 'bg-emerald-950/60 border border-emerald-500/50 text-emerald-300'
                        : 'bg-gradient-to-r from-[#7A1FA2] to-[#512DA8] hover:from-[#8E24AA] hover:to-[#5E35B1] text-white hover:scale-[1.02]'
                    }`}
                  >
                    {activeCutoutState.savedToLibrary ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-400" />
                        <span>Saved to Library</span>
                      </>
                    ) : (
                      <>
                        <Layers className="w-4 h-4 text-[#E1BEE7]" />
                        <span>Save to Library</span>
                      </>
                    )}
                  </button>

                  {/* Quick link to view in Library */}
                  {activeCutoutState.savedToLibrary && (
                    <button
                      onClick={() => navigateTo('assets')}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-[#BA68C8] hover:text-white bg-[#7A1FA2]/15 hover:bg-[#7A1FA2]/30 border border-[#7A1FA2]/30 transition-colors cursor-pointer"
                    >
                      <span>View in Assets Library</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Failure notice */}
          {activeCutoutState.status === 'failed' && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-950/30 border border-rose-500/40 text-rose-300 text-xs">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
              <div className="flex-1">
                <span className="font-bold block text-white">Background removal failed</span>
                <span>{activeCutoutState.errorMessage || 'Please try again or check image format.'}</span>
              </div>
              <button
                onClick={handleRemoveBackground}
                className="px-3 py-1.5 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Viewports Container */}
          {activeCutoutState.status === 'completed' && activeCutoutState.resultDataUrl ? (
            /* Side by Side Display: Original + Cutout with Checkerboard */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Original Image */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#8E9AB8]">
                  <span className="text-white flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-[#38BDF8]" />
                    Original Source Image
                  </span>
                  <span className="font-mono text-[11px] text-[#5E6985]">
                    Preserved Plate
                  </span>
                </div>
                <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[#232C45] bg-[#0A0D16] flex items-center justify-center p-2 relative">
                  <img
                    src={activeImage.imageUrl}
                    alt={activeImage.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>

              {/* Right: Transparent Cutout on Checkerboard */}
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#8E9AB8]">
                  <span className="text-[#CE93D8] flex items-center gap-1.5 font-bold">
                    <Scissors className="w-3.5 h-3.5 text-[#BA68C8]" />
                    Transparent Cutout
                  </span>
                  <span className="font-mono text-[11px] text-emerald-400 font-semibold">
                    Alpha Verified
                  </span>
                </div>
                <div
                  className="aspect-video w-full rounded-2xl overflow-hidden border border-[#232C45] flex items-center justify-center p-2 relative shadow-inner"
                  style={{
                    backgroundImage: `
                      linear-gradient(45deg, #1C202F 25%, transparent 25%),
                      linear-gradient(-45deg, #1C202F 25%, transparent 25%),
                      linear-gradient(45deg, transparent 75%, #1C202F 75%),
                      linear-gradient(-45deg, transparent 75%, #1C202F 75%)
                    `,
                    backgroundSize: '20px 20px',
                    backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                    backgroundColor: '#0E111C',
                  }}
                >
                  <img
                    src={activeCutoutState.resultDataUrl}
                    alt="Transparent Cutout"
                    className="w-full h-full object-contain filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Large Preview of Selected Image before processing */
            <div className="flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[#8E9AB8]">
                <span>Source Image Preview</span>
                <span className="font-mono text-[11px] text-[#5E6985]">
                  Click "Remove Background" above to process
                </span>
              </div>
              <div className="w-full aspect-[21/9] min-h-[320px] max-h-[500px] rounded-2xl overflow-hidden border border-[#232C45] bg-[#0A0D16] flex items-center justify-center p-4 relative group">
                <img
                  src={activeImage.imageUrl}
                  alt={activeImage.title}
                  className="w-full h-full object-contain"
                />

                {/* Subtle overlay button inside preview if idle */}
                {activeCutoutState.status === 'idle' && isServiceReady && (
                  <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={handleRemoveBackground}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-[#8E24AA] to-[#6A1B9A] hover:from-[#9C27B0] hover:to-[#7B1FA2] text-white shadow-xl shadow-black/80 cursor-pointer transform group-hover:scale-105 transition-transform"
                    >
                      <Scissors className="w-5 h-5 text-[#E1BEE7]" />
                      Remove Background
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
