/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  SunMedium,
  Upload,
  Download,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Eye,
  SplitSquareVertical,
  ZoomIn,
  ZoomOut,
  Sliders,
  Clock,
  DollarSign,
  ShieldCheck,
  Loader2,
  Layers,
  ArrowRight,
  Info,
  Maximize2,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';

interface LightingPreset {
  id: 'warm-sunset' | 'cold-moonlight' | 'dramatic-side' | 'custom';
  name: string;
  description: string;
  prompt: string;
  initialLatent: 'Left' | 'Right' | 'Top' | 'Bottom' | 'None';
  guidanceScale: number;
  iconColor: string;
}

const LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'warm-sunset',
    name: 'Warm Sunset',
    description: 'Golden hour amber glow with warm directional rim illumination',
    prompt: 'Warm sunset, golden hour light, soft amber and orange rim illumination, cinematic sun flare, high quality',
    initialLatent: 'Right',
    guidanceScale: 5.0,
    iconColor: '#F59E0B',
  },
  {
    id: 'cold-moonlight',
    name: 'Cold Moonlight',
    description: 'Cool midnight ambient with soft cyan and silver highlights',
    prompt: 'Cold cinematic moonlight, midnight blue ambient illumination, soft silver and cyan rim highlights, moody contrast, high quality',
    initialLatent: 'Top',
    guidanceScale: 5.5,
    iconColor: '#38BDF8',
  },
  {
    id: 'dramatic-side',
    name: 'Dramatic Side Light',
    description: 'High-contrast directional side lighting with deep chiaroscuro shadows',
    prompt: 'Dramatic high-contrast side lighting, intense directional rim light, deep dark shadows, cinematic chiaroscuro, high quality',
    initialLatent: 'Left',
    guidanceScale: 6.0,
    iconColor: '#BA68C8',
  },
];

interface SampleImage {
  id: string;
  title: string;
  category: string;
  url: string;
}

const SAMPLE_IMAGES: SampleImage[] = [
  {
    id: 'cyberpunk',
    title: 'Cyberpunk Atlantis',
    category: 'Cinematic Sci-Fi',
    url: '/Cyberpank_Atlantis_1.png',
  },
  {
    id: 'desert',
    title: 'Desert Gold',
    category: 'High Dynamic Range',
    url: '/Desert_Gold.png',
  },
  {
    id: 'jungle',
    title: 'Jungle Emerald',
    category: 'Nature & Foliage',
    url: '/Jungle_Emerald.png',
  },
  {
    id: 'ice',
    title: 'Ice Blue',
    category: 'Cool Cinema Palette',
    url: '/Ice_Blue.png',
  },
];

interface RelightResult {
  rawAiUrl: string;
  transparentDataUrl: string;
  width: number;
  height: number;
  durationMs: number;
  estimatedCost: string;
  timings?: Record<string, number>;
  seed?: number;
}

export const RelightPocPage: React.FC = () => {
  const { addToast } = useShell();

  // API Config Status
  const [isConfigured, setIsConfigured] = useState<boolean>(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(true);

  // Active Source Image
  const [selectedSampleId, setSelectedSampleId] = useState<string>('cyberpunk');
  const [imageUrl, setImageUrl] = useState<string>(SAMPLE_IMAGES[0].url);
  const [imageTitle, setImageTitle] = useState<string>(SAMPLE_IMAGES[0].title);
  const [isCustomUpload, setIsCustomUpload] = useState<boolean>(false);

  // Original image state
  const [sourceImgElement, setSourceImgElement] = useState<HTMLImageElement | null>(null);
  const [hasSourceAlpha, setHasSourceAlpha] = useState<boolean>(false);
  const [originalAlphaCanvas, setOriginalAlphaCanvas] = useState<HTMLCanvasElement | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number }>({ width: 1024, height: 1024 });

  // Optional Custom Mask upload
  const [customMaskUrl, setCustomMaskUrl] = useState<string | null>(null);
  const [customMaskElement, setCustomMaskElement] = useState<HTMLImageElement | null>(null);

  // Active Preset & Custom Parameters
  const [activePreset, setActivePreset] = useState<LightingPreset>(LIGHTING_PRESETS[0]);
  const [customPrompt, setCustomPrompt] = useState<string>(LIGHTING_PRESETS[0].prompt);
  const [customDirection, setCustomDirection] = useState<'Left' | 'Right' | 'Top' | 'Bottom' | 'None'>('Right');
  const [customGuidance, setCustomGuidance] = useState<number>(5.0);

  // Relight Processing & Results
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<RelightResult | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Viewport & Comparison
  const [viewMode, setViewMode] = useState<'transparent' | 'raw-ai' | 'original' | 'split'>('transparent');
  const [splitPos, setSplitPos] = useState<number>(50); // percentage 0..100
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const isDraggingSplit = useRef<boolean>(false);

  // Input file refs
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const maskInputRef = useRef<HTMLInputElement | null>(null);

  // 1. Check server-side FAL_KEY configuration
  const checkApiStatus = useCallback(async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/relight/status');
      if (res.ok) {
        const data = await res.json();
        setIsConfigured(Boolean(data.configured));
        setMaskedKey(data.keyMasked || null);
      } else {
        setIsConfigured(false);
      }
    } catch {
      setIsConfigured(false);
    } finally {
      setIsCheckingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkApiStatus();
  }, [checkApiStatus]);

  // 2. Load source image and inspect its alpha transparency channel
  useEffect(() => {
    let isCancelled = false;
    const img = new Image();

    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      if (isCancelled) return;
      const w = img.naturalWidth || 1024;
      const h = img.naturalHeight || 1024;
      setSourceImgElement(img);
      setImageDimensions({ width: w, height: h });

      // Inspect alpha transparency channel
      try {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;

          let foundSemiOrTransparent = false;
          // Check pixel alpha values
          for (let i = 3; i < data.length; i += 16) {
            if (data[i] < 250) {
              foundSemiOrTransparent = true;
              break;
            }
          }

          setHasSourceAlpha(foundSemiOrTransparent);

          // Create dedicated alpha channel mask canvas
          const alphaCanvas = document.createElement('canvas');
          alphaCanvas.width = w;
          alphaCanvas.height = h;
          const aCtx = alphaCanvas.getContext('2d');
          if (aCtx) {
            aCtx.drawImage(img, 0, 0, w, h);
            setOriginalAlphaCanvas(alphaCanvas);
          }
        }
      } catch (err) {
        console.warn('[RelightPOC] Could not extract alpha channel:', err);
      }
    };

    img.src = imageUrl;

    return () => {
      isCancelled = true;
    };
  }, [imageUrl]);

  // 3. Load optional custom mask image if provided
  useEffect(() => {
    if (!customMaskUrl) {
      setCustomMaskElement(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setCustomMaskElement(img);
    };
    img.src = customMaskUrl;
  }, [customMaskUrl]);

  // 4. Preset Selection handler
  const handleSelectPreset = (preset: LightingPreset) => {
    setActivePreset(preset);
    setCustomPrompt(preset.prompt);
    setCustomDirection(preset.initialLatent);
    setCustomGuidance(preset.guidanceScale);
  };

  // 5. User file upload handler
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setImageTitle(file.name.replace(/\.[^/.]+$/, ''));
    setSelectedSampleId('');
    setIsCustomUpload(true);
    setLastResult(null);
    setLastError(null);

    addToast({
      type: 'info',
      title: 'Image Uploaded',
      message: `Loaded "${file.name}" for relighting.`,
    });
  };

  // 6. User mask upload handler
  const handleMaskUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setCustomMaskUrl(url);

    addToast({
      type: 'info',
      title: 'Mask Uploaded',
      message: 'Custom silhouette mask attached to relight pipeline.',
    });
  };

  // 7. Core Action: Call server-side fal.ai IC-Light V2 API & Composite Alpha Mask
  const handleRunRelight = async () => {
    if (!sourceImgElement || isProcessing) return;

    setLastError(null);
    setIsProcessing(true);

    try {
      // 1. Prepare base64 data URL from source image to ensure reliable transfer, resize if needed
      let targetW = imageDimensions.width;
      let targetH = imageDimensions.height;
      if (targetW > 1024 || targetH > 1024) {
        const ratio = Math.min(1024 / targetW, 1024 / targetH);
        targetW = Math.round(targetW * ratio);
        targetH = Math.round(targetH * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not allocate canvas 2D context.');

      ctx.drawImage(sourceImgElement, 0, 0, canvas.width, canvas.height);
      const base64ImageUrl = canvas.toDataURL('image/png');

      // 2. Prepare custom mask if available
      let base64MaskUrl: string | undefined = undefined;
      if (customMaskElement) {
        const mCanvas = document.createElement('canvas');
        mCanvas.width = targetW;
        mCanvas.height = targetH;
        const mCtx = mCanvas.getContext('2d');
        if (mCtx) {
          mCtx.drawImage(customMaskElement, 0, 0, mCanvas.width, mCanvas.height);
          base64MaskUrl = mCanvas.toDataURL('image/png');
        }
      }

      // 3. Dispatch to secure server endpoint
      const res = await fetch('/api/relight/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_url: base64ImageUrl,
          prompt: customPrompt,
          initial_latent: customDirection,
          guidance_scale: customGuidance,
          mask_image_url: base64MaskUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || `API error ${res.status}: ${data.error || 'Failed to relight image'}`);
      }

      // 4. Load resulting AI image from URL
      console.log("[RelightPOC] Attempting to load image:", data.imageUrl);
      const aiImg = new Image();
      aiImg.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        aiImg.onload = () => {
          console.log("[RelightPOC] Image loaded successfully");
          resolve();
        };
        aiImg.onerror = (e) => {
          console.error("[RelightPOC] Image load error:", e);
          reject(new Error('Failed to load generated AI output image from fal storage.'));
        };
        aiImg.src = data.imageUrl;
      });

      // 5. Composite original alpha/mask with AI output to preserve transparency!
      const compCanvas = document.createElement('canvas');
      const compW = imageDimensions.width;
      const compH = imageDimensions.height;
      compCanvas.width = compW;
      compCanvas.height = compH;
      const compCtx = compCanvas.getContext('2d');

      if (!compCtx) throw new Error('Could not initialize composite canvas.');

      // Draw the AI relit result scaled to target canvas dimensions
      compCtx.drawImage(aiImg, 0, 0, compW, compH);

      // If original image had alpha, apply it via destination-in
      if (hasSourceAlpha && originalAlphaCanvas) {
        compCtx.globalCompositeOperation = 'destination-in';
        compCtx.drawImage(originalAlphaCanvas, 0, 0, compW, compH);
        compCtx.globalCompositeOperation = 'source-over';
      } else if (customMaskElement) {
        compCtx.globalCompositeOperation = 'destination-in';
        compCtx.drawImage(customMaskElement, 0, 0, compW, compH);
        compCtx.globalCompositeOperation = 'source-over';
      }

      const transparentDataUrl = compCanvas.toDataURL('image/png');

      setLastResult({
        rawAiUrl: data.imageUrl,
        transparentDataUrl,
        width: data.width,
        height: data.height,
        durationMs: data.durationMs,
        estimatedCost: data.estimatedCost,
        timings: data.timings,
        seed: data.seed,
      });

      // Default to transparent view if source had transparency, else raw-ai
      setViewMode(hasSourceAlpha || customMaskElement ? 'transparent' : 'raw-ai');

      addToast({
        type: 'success',
        title: 'Relighting Complete',
        message: `Processed in ${(data.durationMs / 1000).toFixed(1)}s (${data.estimatedCost})`,
      });
    } catch (err) {
      console.error('[RelightPOC] Error:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setLastError(msg);
      addToast({
        type: 'error',
        title: 'Relighting Failed',
        message: msg,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 8. Download Result
  const handleDownloadResult = (transparent: boolean) => {
    if (!lastResult) return;

    const dataUrl = transparent ? lastResult.transparentDataUrl : lastResult.rawAiUrl;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${imageTitle}_relit_${activePreset.id}_${transparent ? 'cutout' : 'full'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    addToast({
      type: 'success',
      title: 'Downloaded PNG',
      message: `Exported ${transparent ? 'cutout with alpha' : 'full AI scene'} PNG.`,
    });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.75rem)] w-full bg-[#0D101A] text-[#D7DEED] overflow-hidden select-none">
      {/* 1. Header Bar */}
      <header className="h-14 px-5 bg-[#131724] border-b border-[#242B3F] flex items-center justify-between shrink-0 shadow-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#2E2010] border border-[#F59E0B]/50 flex items-center justify-center text-[#F59E0B] shadow-sm">
            <SunMedium className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-[#D7DEED]">Relight POC</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#F59E0B]/20 border border-[#F59E0B]/40 text-[#F59E0B]">
                fal.ai IC-Light V2
              </span>
              <span className="text-xs text-[#8E9AB8]">
                • {imageTitle} ({imageDimensions.width} × {imageDimensions.height} px)
              </span>
            </div>
            <p className="text-[11px] text-[#8E9AB8] mt-0.5">
              Isolated test of official IC-Light V2 relighting with alpha mask preservation.
            </p>
          </div>
        </div>

        {/* Header Right Status & Actions */}
        <div className="flex items-center gap-3">
          {/* API Status Badge */}
          <div
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono font-medium ${
              isConfigured
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-950/40 border-amber-500/40 text-amber-400'
            }`}
          >
            {isCheckingStatus ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isConfigured ? (
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            )}
            <span>{isConfigured ? `FAL_KEY: ${maskedKey || 'Active'}` : 'FAL_KEY: Not Configured'}</span>
          </div>

          {/* Hidden File Inputs */}
          <input
            type="file"
            ref={imageInputRef}
            onChange={handleImageUpload}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
          />
          <input
            type="file"
            ref={maskInputRef}
            onChange={handleMaskUpload}
            accept="image/png,image/jpeg"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2F] hover:bg-[#20273F] border border-[#293047] text-xs font-semibold text-[#D7DEED] transition-colors cursor-pointer"
            title="Upload any PNG (with or without transparency) or JPG"
          >
            <Upload className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Upload Image</span>
          </button>

          <button
            type="button"
            onClick={() => maskInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181D2F] hover:bg-[#20273F] border border-[#293047] text-xs font-semibold text-[#8E9AB8] hover:text-[#D7DEED] transition-colors cursor-pointer"
            title="Optionally upload a separate black & white silhouette mask"
          >
            <Layers className="w-3.5 h-3.5 text-[#BA68C8]" />
            <span>{customMaskUrl ? 'Mask Attached' : 'Upload Mask (Opt)'}</span>
          </button>

          {lastResult && (
            <button
              type="button"
              onClick={() => handleDownloadResult(viewMode !== 'raw-ai')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1E293B] hover:bg-[#293950] border border-[#38BDF8]/50 text-xs font-bold text-[#38BDF8] transition-colors cursor-pointer shadow-sm"
              title="Download relit PNG"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PNG</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleRunRelight}
            disabled={isProcessing || !sourceImgElement || !isConfigured}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#D97706] to-[#F59E0B] hover:from-[#B45309] hover:to-[#D97706] text-white text-xs font-bold shadow-md shadow-[#F59E0B]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run official fal.ai IC-Light V2 API"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Relighting...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Run Relight</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* 2. Main Viewport & Controls Split View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Interactive Canvas & Comparison Viewport */}
        <div className="flex-1 flex flex-col bg-[#0A0D16] relative overflow-hidden">
          {/* Viewport Top Bar */}
          <div className="h-10 px-4 bg-[#101422] border-b border-[#1E2538] flex items-center justify-between shrink-0 select-none text-xs">
            {/* Presets Quick Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto py-1">
              <span className="text-[11px] text-[#8E9AB8] mr-1 font-medium">Samples:</span>
              {SAMPLE_IMAGES.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => {
                    setSelectedSampleId(sample.id);
                    setIsCustomUpload(false);
                    setImageTitle(sample.title);
                    setImageUrl(sample.url);
                    setLastResult(null);
                    setLastError(null);
                  }}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedSampleId === sample.id
                      ? 'bg-[#2A2012] text-[#F59E0B] border border-[#F59E0B]/40'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#181D2F]'
                  }`}
                >
                  {sample.title}
                </button>
              ))}
            </div>

            {/* View Mode Selector */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[#151928] p-0.5 rounded-lg border border-[#293047]">
                <button
                  onClick={() => setViewMode('transparent')}
                  disabled={!lastResult}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                    viewMode === 'transparent'
                      ? 'bg-[#F59E0B] text-[#0A0D16] font-bold shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Relit result with original alpha cutout"
                >
                  Relit Cutout
                </button>

                <button
                  onClick={() => setViewMode('raw-ai')}
                  disabled={!lastResult}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                    viewMode === 'raw-ai'
                      ? 'bg-[#38BDF8] text-[#0A0D16] font-bold shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Full AI raw output with background"
                >
                  Full AI Scene
                </button>

                <button
                  onClick={() => setViewMode('original')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                    viewMode === 'original'
                      ? 'bg-[#BA68C8] text-[#0A0D16] font-bold shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Original unadjusted input"
                >
                  Original
                </button>

                <button
                  onClick={() => setViewMode('split')}
                  disabled={!lastResult}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-40 ${
                    viewMode === 'split'
                      ? 'bg-emerald-400 text-[#0A0D16] font-bold shadow-xs'
                      : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                  }`}
                  title="Interactive split-screen comparison"
                >
                  <SplitSquareVertical className="w-3 h-3" />
                  <span>Split</span>
                </button>
              </div>

              <div className="h-4 w-[1px] bg-[#293047]" />

              {/* Zoom Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(0.2, Math.round((z - 0.15) * 100) / 100))}
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

          {/* Canvas Viewport on High-Contrast Checkerboard */}
          <div
            className="flex-1 relative overflow-auto flex items-center justify-center p-6 bg-canvas-checker"
            style={{ backgroundSize: '16px 16px' }}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl bg-[#131724]/90 border border-[#242B3F] shadow-2xl backdrop-blur-md">
                <Loader2 className="w-8 h-8 animate-spin text-[#F59E0B]" />
                <div className="text-center">
                  <span className="text-xs font-bold text-[#D7DEED] block">
                    Generating IC-Light V2 Diffusion...
                  </span>
                  <span className="text-[11px] text-[#8E9AB8] block mt-1">
                    Preset: {activePreset.name} • Direction: {customDirection}
                  </span>
                </div>
              </div>
            ) : (
              <div
                className="relative shadow-2xl rounded-lg overflow-hidden border border-[#293047] transition-transform duration-75 select-none"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                }}
              >
                {/* View Mode: Original */}
                {viewMode === 'original' && (
                  <img
                    src={imageUrl}
                    alt="Original source"
                    className="block max-h-[75vh] w-auto h-auto object-contain"
                  />
                )}

                {/* View Mode: Raw AI Output */}
                {viewMode === 'raw-ai' && lastResult && (
                  <img
                    src={lastResult.rawAiUrl}
                    alt="Raw fal.ai IC-Light output"
                    className="block max-h-[75vh] w-auto h-auto object-contain"
                  />
                )}

                {/* View Mode: Transparent Cutout (Original Alpha Applied) */}
                {viewMode === 'transparent' && lastResult && (
                  <img
                    src={lastResult.transparentDataUrl}
                    alt="Relit cutout with preserved alpha"
                    className="block max-h-[75vh] w-auto h-auto object-contain"
                  />
                )}

                {/* View Mode: Fallback if no result yet */}
                {viewMode !== 'original' && !lastResult && (
                  <div className="relative">
                    <img
                      src={imageUrl}
                      alt="Source input preview"
                      className="block max-h-[75vh] w-auto h-auto object-contain opacity-90"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
                      <div className="text-center p-4 rounded-xl bg-[#121624]/90 border border-[#293047] shadow-xl">
                        <SunMedium className="w-6 h-6 text-[#F59E0B] mx-auto mb-2" />
                        <span className="text-xs font-bold text-[#D7DEED] block">
                          Ready to Relight
                        </span>
                        <span className="text-[11px] text-[#8E9AB8] block mt-1">
                          Select a lighting preset and click "Run Relight"
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* View Mode: Interactive Split Slider */}
                {viewMode === 'split' && lastResult && (
                  <div
                    className="relative max-h-[75vh] overflow-hidden cursor-ew-resize"
                    onMouseDown={(e) => {
                      isDraggingSplit.current = true;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setSplitPos(pos);
                    }}
                    onMouseMove={(e) => {
                      if (!isDraggingSplit.current) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const pos = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                      setSplitPos(pos);
                    }}
                    onMouseUp={() => {
                      isDraggingSplit.current = false;
                    }}
                    onMouseLeave={() => {
                      isDraggingSplit.current = false;
                    }}
                  >
                    {/* Underlying Relit Image */}
                    <img
                      src={hasSourceAlpha ? lastResult.transparentDataUrl : lastResult.rawAiUrl}
                      alt="Relit result"
                      className="block max-h-[75vh] w-auto h-auto pointer-events-none"
                    />

                    {/* Clipped Original Image on Left */}
                    <div
                      className="absolute inset-0 overflow-hidden pointer-events-none"
                      style={{ width: `${splitPos}%` }}
                    >
                      <img
                        src={imageUrl}
                        alt="Original source"
                        className="block max-h-[75vh] w-auto h-auto max-w-none"
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Divider bar */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-[#F59E0B] pointer-events-none"
                      style={{ left: `${splitPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#F59E0B] text-[#0A0D16] flex items-center justify-center shadow-lg text-[10px] font-bold">
                        ↔
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Status & Performance Metrics */}
            <div className="absolute bottom-3 left-4 px-3.5 py-2 rounded-xl bg-[#121624]/90 border border-[#232c45] text-[11px] text-[#8E9AB8] backdrop-blur-md flex items-center gap-3 shadow-xl">
              <span className="flex items-center gap-1.5 text-[#F59E0B] font-semibold">
                <SunMedium className="w-3.5 h-3.5" />
                <span>Preset: {activePreset.name}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>{lastResult ? `${(lastResult.durationMs / 1000).toFixed(2)}s` : 'Ready'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>Est: {lastResult?.estimatedCost || '$0.025'}</span>
              </span>
              <span>•</span>
              <span className="text-[#D7DEED]">
                Alpha: {hasSourceAlpha ? 'Native PNG Mask Active' : customMaskUrl ? 'Custom Mask' : 'Opaque RGB'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Lighting Controls & Configuration Panel */}
        <aside className="w-88 bg-[#131724] border-l border-[#242B3F] flex flex-col shrink-0 overflow-y-auto">
          {/* Panel Header */}
          <div className="p-4 border-b border-[#242B3F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#F59E0B]" />
              <h2 className="text-xs font-bold text-[#D7DEED] uppercase tracking-wider">
                Lighting Configuration
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-[#F59E0B]/20 border-[#F59E0B]/40 text-[#F59E0B]">
              V2 Official
            </span>
          </div>

          <div className="p-4 flex flex-col gap-4">
            {/* API Status Notice */}
            {!isConfigured && (
              <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-500/40 text-[11px] text-amber-300 flex flex-col gap-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>FAL_KEY Required for Real Generation</span>
                </div>
                <p>
                  To run live IC-Light V2 calls, set <code className="bg-black/50 px-1 py-0.2 rounded font-mono text-amber-200">FAL_KEY</code> in your AI Studio Secrets or <code className="bg-black/50 px-1 py-0.2 rounded font-mono text-amber-200">.env</code> file.
                </p>
              </div>
            )}

            {lastError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-[11px] text-rose-300 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 font-bold text-rose-200">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>API Error</span>
                </div>
                <p className="break-words">{lastError}</p>
              </div>
            )}

            {/* 3 Lighting Presets (Requirement 2) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[#D7DEED] flex items-center justify-between">
                <span>Lighting Presets</span>
                <span className="text-[10px] text-[#8E9AB8]">3 Verified</span>
              </label>

              <div className="flex flex-col gap-2">
                {LIGHTING_PRESETS.map((preset) => {
                  const isSelected = activePreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#1F1912] border-[#F59E0B] shadow-md shadow-[#F59E0B]/10'
                          : 'bg-[#10131E] border-[#293047] hover:border-[#3D4766] text-[#8E9AB8]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-xs font-bold flex items-center gap-1.5"
                          style={{ color: isSelected ? preset.iconColor : '#D7DEED' }}
                        >
                          <SunMedium className="w-3.5 h-3.5" />
                          <span>{preset.name}</span>
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 border border-[#293047] text-[#8E9AB8]">
                          {preset.initialLatent} Light
                        </span>
                      </div>
                      <p className="text-[11px] text-[#8E9AB8] leading-tight">
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="h-[1px] bg-[#242B3F]" />

            {/* Directional Light Vector (initial_latent) */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#D7DEED] flex items-center justify-between">
                <span>Light Direction Bias (initial_latent)</span>
                <span className="text-[10px] font-mono text-[#F59E0B]">
                  {customDirection}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['Left', 'Right', 'Top', 'Bottom', 'None'] as const).map((dir) => (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => setCustomDirection(dir)}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer border ${
                      customDirection === dir
                        ? 'bg-[#F59E0B] text-[#0A0D16] border-[#F59E0B] font-bold'
                        : 'bg-[#10131E] border-[#293047] text-[#8E9AB8] hover:text-[#D7DEED]'
                    }`}
                  >
                    {dir}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[#D7DEED] flex items-center justify-between">
                <span>Lighting Prompt Description</span>
              </label>
              <textarea
                rows={3}
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Describe desired ambient lighting and mood..."
                className="w-full bg-[#10131E] border border-[#293047] rounded-lg p-2.5 text-xs text-[#D7DEED] focus:outline-none focus:border-[#F59E0B] resize-none leading-relaxed"
              />
            </div>

            {/* Guidance Scale Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#8E9AB8]">Guidance Scale (CFG)</span>
                <span className="text-[#D7DEED] font-mono font-bold">{customGuidance.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={2.0}
                max={10.0}
                step={0.5}
                value={customGuidance}
                onChange={(e) => setCustomGuidance(Number(e.target.value))}
                className="w-full accent-[#F59E0B] cursor-pointer"
              />
            </div>

            <div className="h-[1px] bg-[#242B3F]" />

            {/* Technical Verification Details */}
            <div className="p-3 rounded-xl bg-[#101422] border border-[#20273D] text-[11px] text-[#8E9AB8] flex flex-col gap-1.5 leading-relaxed">
              <div className="flex items-center gap-1.5 text-[#F59E0B] font-bold text-xs">
                <Info className="w-3.5 h-3.5" />
                <span>IC-Light V2 Alpha Pipeline</span>
              </div>
              <p>
                <strong>Alpha Alignment:</strong> IC-Light V2 outputs an opaque RGB frame. This POC automatically extracts your source cutout's alpha mask and applies it via Canvas 2D destination-in compositing.
              </p>
              <p>
                <strong>Pricing:</strong> $0.10 / megapixel usage-based via official fal.ai endpoint (<code className="font-mono text-[#D7DEED]">fal-ai/iclight-v2</code>).
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
