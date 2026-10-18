/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  Search,
  Layers,
  Sparkles,
  Tag,
  Plus,
  Eye,
  FileImage,
  Trash2,
  FolderOpen,
  ArrowRight,
  Maximize2,
  CheckCircle2,
  HardDrive,
  Info,
  Filter,
  Palette,
  Check,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { AssetRecord } from '../types/shell.ts';
import { UIButton } from '../ui/UIButton.tsx';
import { UIInput } from '../ui/UIInput.tsx';
import { UIModal } from '../ui/UIModal.tsx';
import { UIEmptyState } from '../ui/UIEmptyState.tsx';
import {
  loadBinaryAsset,
  storeBinaryAsset,
  deleteBinaryAsset,
} from '../services/DocumentPersistence.ts';
import { addCutoutAssetToProject } from '../services/CutoutToCanvasService.ts';

import { SVG_ARTWORKS } from '../utils/artworkThumbnails.ts';

// Fully verified 200 OK Stock Elements with tailored SVG artworks
const VERIFIED_STOCK_ASSETS: AssetRecord[] = [
  {
    id: 'stock-neon-kanji',
    title: 'Tokyo Neon Kanji Signboard Cutout',
    category: 'cutout',
    url: SVG_ARTWORKS.neonKanji,
    width: 1400,
    height: 933,
    fileSizeBytes: 2400000,
    format: 'png',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    tags: ['Cyberpunk', 'Neon', 'Kanji', 'Signboard'],
  },
  {
    id: 'stock-recon-drone',
    title: 'Recon Quadcopter Drone Cutout',
    category: 'cutout',
    url: SVG_ARTWORKS.reconDrone,
    width: 2048,
    height: 1365,
    fileSizeBytes: 3200000,
    format: 'png',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    tags: ['Sci-Fi', 'Drone', 'Prop', 'Mechanical'],
  },
  {
    id: 'stock-wet-asphalt',
    title: 'Wet Asphalt Rain Surface Texture',
    category: 'texture',
    url: SVG_ARTWORKS.wetAsphalt,
    width: 3840,
    height: 2160,
    fileSizeBytes: 4200000,
    format: 'webp',
    createdAt: new Date(Date.now() - 86400000 * 4).toISOString(),
    tags: ['Surface', 'Road', 'Wet Rain', 'Reflections'],
  },
  {
    id: 'stock-rusted-metal',
    title: 'Industrial Rusted Scaffolding Texture',
    category: 'texture',
    url: SVG_ARTWORKS.rustedMetal,
    width: 2560,
    height: 1440,
    fileSizeBytes: 3100000,
    format: 'png',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    tags: ['Texture', 'Metal', 'Rust', 'Hard Surface'],
  },
  {
    id: 'stock-nordic-alpine',
    title: 'Nordic Alpine Fog Matte Plate',
    category: 'background',
    url: SVG_ARTWORKS.nordic,
    width: 4096,
    height: 2160,
    fileSizeBytes: 6800000,
    format: 'jpeg',
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    tags: ['Matte Plate', 'Mountain', 'Atmospheric Mist'],
  },
  {
    id: 'stock-oil-palette',
    title: 'Impressionist Oil Impasto Palette',
    category: 'reference',
    url: SVG_ARTWORKS.oilPalette,
    width: 1920,
    height: 1080,
    fileSizeBytes: 1800000,
    format: 'jpeg',
    createdAt: new Date(Date.now() - 86400000 * 7).toISOString(),
    tags: ['Master Style', 'Oil Painting', 'Warm Pigment'],
  },
];

export const AssetsLibrary: React.FC = () => {
  const {
    activeProjectId,
    activeProject,
    projects,
    openProject,
    navigateTo,
    updateProject,
    addToast,
  } = useShell();

  // Load user assets from persistent storage, merging with verified stock
  const [assets, setAssets] = useState<AssetRecord[]>(() => {
    try {
      const stored = localStorage.getItem('aristo_assets_v2');
      if (stored) {
        const parsed: AssetRecord[] = JSON.parse(stored);
        const userUploaded = parsed.filter((a) => a.id.startsWith('asset-custom-'));
        return [...userUploaded, ...VERIFIED_STOCK_ASSETS];
      }
    } catch {
      // Fallback
    }
    return VERIFIED_STOCK_ASSETS;
  });

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [assetSourceFilter, setAssetSourceFilter] = useState<'all' | 'user' | 'stock'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAssetForPreview, setSelectedAssetForPreview] = useState<AssetRecord | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Project picker modal state for "Add to Canvas"
  const [isProjectPickerOpen, setIsProjectPickerOpen] = useState(false);
  const [projectPickerAsset, setProjectPickerAsset] = useState<AssetRecord | null>(null);
  const [isAddingToCanvas, setIsAddingToCanvas] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate custom user assets from IndexedDB project_assets store on mount/update
  useEffect(() => {
    let isCancelled = false;

    const hydrateBlobs = async () => {
      let changed = false;
      const updatedAssets = await Promise.all(
        assets.map(async (asset) => {
          if (asset.id.startsWith('asset-custom-')) {
            try {
              const blob = await loadBinaryAsset(asset.id);
              if (blob && !isCancelled) {
                const objectUrl = URL.createObjectURL(blob);
                if (asset.url !== objectUrl) {
                  changed = true;
                  return { ...asset, url: objectUrl };
                }
              }
            } catch (err) {
              console.warn('[AssetsLibrary] Error resolving asset blob:', asset.id, err);
            }
          }
          return asset;
        })
      );

      if (!isCancelled && changed) {
        setAssets(updatedAssets);
      }
    };

    hydrateBlobs();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      // Keep localStorage lean by not storing multi-megabyte data URLs
      const leanAssets = assets.map((a) => {
        if (a.id.startsWith('asset-custom-') && a.url.startsWith('data:')) {
          return { ...a, url: '' };
        }
        return a;
      });
      localStorage.setItem('aristo_assets_v2', JSON.stringify(leanAssets));
    } catch (e) {
      console.warn('[AssetsLibrary] Storage error:', e);
    }
  }, [assets]);

  const filteredAssets = assets.filter((asset) => {
    const isUserUpload = asset.id.startsWith('asset-custom-');
    if (assetSourceFilter === 'user' && !isUserUpload) return false;
    if (assetSourceFilter === 'stock' && isUserUpload) return false;

    const matchesCategory =
      activeCategory === 'all' || asset.category === activeCategory;

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      asset.title.toLowerCase().includes(q) ||
      asset.tags.some((t) => t.toLowerCase().includes(q)) ||
      asset.format.toLowerCase().includes(q);

    return matchesCategory && matchesSearch;
  });

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        addToast({
          type: 'error',
          title: 'Unsupported File Format',
          message: `"${file.name}" is not a supported image file.`,
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = async () => {
          const extension = file.name.split('.').pop()?.toLowerCase() || 'png';
          const validFormat = ['png', 'webp', 'jpeg', 'svg'].includes(extension)
            ? (extension as any)
            : 'png';
          const assetId = `asset-custom-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

          // Store native blob directly into IndexedDB project_assets
          try {
            await storeBinaryAsset(assetId, file);
          } catch (err) {
            console.warn('[AssetsLibrary] Failed to store file in IndexedDB:', err);
          }

          const newAsset: AssetRecord = {
            id: assetId,
            title: file.name.replace(/\.[^/.]+$/, ''),
            category: 'cutout',
            url: URL.createObjectURL(file),
            width: img.naturalWidth || 1920,
            height: img.naturalHeight || 1080,
            fileSizeBytes: file.size,
            format: validFormat,
            createdAt: new Date().toISOString(),
            tags: ['User Upload', 'Local File'],
          };

          setAssets((prev) => [newAsset, ...prev]);
          addToast({
            type: 'success',
            title: 'User Asset Imported',
            message: `"${newAsset.title}" (${newAsset.width}×${newAsset.height} px) saved to library.`,
          });
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteAsset = (id: string) => {
    const target = assets.find((a) => a.id === id);
    setAssets((prev) => prev.filter((a) => a.id !== id));
    if (selectedAssetForPreview?.id === id) {
      setSelectedAssetForPreview(null);
    }
    if (id.startsWith('asset-custom-')) {
      deleteBinaryAsset(id).catch(() => {});
    }
    addToast({
      type: 'info',
      title: 'Asset Removed',
      message: `"${target?.title}" removed from catalog.`,
    });
  };

  /**
   * Adds the specified asset into the target Studio project as a new independent layer,
   * preserving PNG transparency, aspect ratio, and persisting it to IndexedDB.
   */
  const executeAddToCanvas = async (asset: AssetRecord, targetProjectId: string) => {
    const targetMeta = projects.find((p) => p.id === targetProjectId) || activeProject;
    if (!targetMeta) {
      addToast({
        type: 'error',
        title: 'Project Not Found',
        message: 'Could not resolve the selected Studio project.',
      });
      return;
    }

    try {
      setIsAddingToCanvas(true);
      const res = await addCutoutAssetToProject(targetMeta, asset);

      if (!res.success || !res.document) {
        throw new Error(res.errorMessage || 'Failed to add cutout layer to canvas.');
      }

      // Update project layer count & composite thumbnail in shell
      updateProject(targetProjectId, {
        layerCount: res.document.rootLayerIds.length,
        thumbnailUrl: res.thumbnailUrl || targetMeta.thumbnailUrl,
        updatedAt: new Date().toISOString(),
      });

      setIsProjectPickerOpen(false);
      setProjectPickerAsset(null);
      setSelectedAssetForPreview(null);

      // Open in Studio Canvas
      openProject(targetProjectId);

      addToast({
        type: 'success',
        title: 'Cutout Added to Canvas',
        message: `"${asset.title}" added as a new layer in "${targetMeta.title}".`,
      });
    } catch (err: any) {
      console.error('[AssetsLibrary] Failed to add cutout to canvas:', err);
      addToast({
        type: 'error',
        title: 'Failed to Add to Canvas',
        message: err.message || 'Could not insert layer into project document.',
      });
    } finally {
      setIsAddingToCanvas(false);
    }
  };

  /**
   * Handles user clicking "Add to Canvas".
   * If a project is open, adds directly to that project.
   * If no project is open, opens the project selection modal.
   */
  const handleInitiateAddToCanvas = (asset: AssetRecord) => {
    if (activeProjectId && projects.some((p) => p.id === activeProjectId)) {
      executeAddToCanvas(asset, activeProjectId);
    } else {
      setProjectPickerAsset(asset);
      setIsProjectPickerOpen(true);
    }
  };

  const userAssetCount = assets.filter((a) => a.id.startsWith('asset-custom-')).length;
  const stockAssetCount = assets.filter((a) => !a.id.startsWith('asset-custom-')).length;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        handleFilesSelected(e.dataTransfer.files);
      }}
      className={`flex flex-col h-full w-full overflow-y-auto bg-[#0D101A] p-5 lg:p-7 select-none transition-colors ${
        isDragOver ? 'bg-[#7A1FA2]/10 ring-2 ring-[#7A1FA2] ring-inset' : ''
      }`}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* 1. Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#293047]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#D7DEED] tracking-tight">
              Assets Library
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#171B29] border border-[#293047] text-[#38BDF8] shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
              {assets.length} Total Elements
            </span>
          </div>
          <p className="text-xs text-[#8E9AB8] mt-1">
            Categorized cutout fragments, surface textures, background matte plates, and color reference swatches.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <UIButton
            variant="primary"
            size="md"
            leftIcon={<Upload className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import Real Asset
          </UIButton>
        </div>
      </div>

      {/* Drag & Drop Alert */}
      {isDragOver && (
        <div className="my-3 p-4 rounded-xl bg-[#7A1FA2]/15 border-2 border-dashed border-[#7A1FA2] text-center text-xs text-[#D7DEED] font-semibold animate-pulse shadow-lg">
          Release to import image files directly into your persistent Assets Library
        </div>
      )}

      {/* 2. Source Filter and Categories */}
      <div className="flex flex-col gap-3 my-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Source Tabs */}
          <div className="flex items-center gap-1 bg-[#131724] p-1 rounded-lg border border-[#293047]">
            <button
              onClick={() => setAssetSourceFilter('all')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                assetSourceFilter === 'all'
                  ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
              }`}
            >
              <span>All Items</span>
              <span className="text-[10px] font-mono opacity-80">({assets.length})</span>
            </button>
            <button
              onClick={() => setAssetSourceFilter('user')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                assetSourceFilter === 'user'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>User Uploads</span>
              <span className="text-[10px] font-mono opacity-80">({userAssetCount})</span>
            </button>
            <button
              onClick={() => setAssetSourceFilter('stock')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                assetSourceFilter === 'stock'
                  ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                  : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
              }`}
            >
              <span>Stock Elements</span>
              <span className="text-[10px] font-mono opacity-80">({stockAssetCount})</span>
            </button>
          </div>

          {/* Search */}
          <div className="w-full sm:w-72">
            <UIInput
              prefixIcon={<Search className="w-3.5 h-3.5" />}
              placeholder="Search by title, tag, format..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              size="sm"
            />
          </div>
        </div>

        {/* Category Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {['all', 'cutout', 'texture', 'background', 'reference'].map((cat) => {
            const count =
              cat === 'all'
                ? assets.length
                : assets.filter((a) => a.category === cat).length;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeCategory === cat
                    ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] border border-[#BA68C8]/40 shadow-sm shadow-black/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'bg-[#131724] text-[#8E9AB8] border border-[#293047] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
                }`}
              >
                <span>{cat === 'all' ? 'All Categories' : `${cat}s`}</span>
                <span className="text-[10px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Assets Grid */}
      {filteredAssets.length === 0 ? (
        <UIEmptyState
          icon={<FileImage className="w-6 h-6 text-[#38BDF8]" />}
          title="No assets match query"
          description={
            assetSourceFilter === 'user'
              ? 'You have not uploaded any local assets yet. Click "Import Real Asset" or drag image files onto this window.'
              : 'No elements match the active filters. Reset category or clear the search query.'
          }
          actionLabel="Import Image"
          actionIcon={<Upload className="w-3.5 h-3.5" />}
          onAction={() => fileInputRef.current?.click()}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4.5">
          {filteredAssets.map((asset) => {
            const isUserUpload = asset.id.startsWith('asset-custom-');

            return (
              <div
                key={asset.id}
                className="group bg-[#171B29] border border-[#242B3F] hover:border-[#7A1FA2]/70 rounded-xl overflow-hidden flex flex-col transition-all duration-200 shadow-xl shadow-black/50 hover:shadow-black/70 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]"
              >
                {/* Image Viewport with 16:10 aspect ratio and transparent grid */}
                <div
                  onClick={() => setSelectedAssetForPreview(asset)}
                  className="relative aspect-[16/10] w-full bg-canvas-checker border-b border-[#242B3F] overflow-hidden flex items-center justify-center cursor-pointer"
                >
                  {asset.url ? (
                    <img
                      src={asset.url}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const img = e.target as HTMLImageElement;
                        if (asset.category === 'cutout') img.src = SVG_ARTWORKS.neonKanji;
                        else if (asset.category === 'texture') img.src = SVG_ARTWORKS.wetAsphalt;
                        else if (asset.category === 'background') img.src = SVG_ARTWORKS.nordic;
                        else img.src = SVG_ARTWORKS.oilPalette;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-[#10131E] text-[#5E6985] text-xs font-mono">
                      Loading...
                    </div>
                  )}

                  {/* Origin Badge */}
                  <span
                    className={`absolute top-2.5 left-2.5 text-[9px] font-mono font-bold tracking-wider px-2 py-0.5 rounded backdrop-blur-md border ${
                      isUserUpload
                        ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                        : 'bg-black/80 text-[#D7DEED] border border-[#293047]'
                    }`}
                  >
                    {isUserUpload ? 'USER UPLOAD' : 'STUDIO ASSET'}
                  </span>

                  {/* Category Pill */}
                  <span className="absolute top-2.5 right-2.5 text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[#38BDF8] border border-[#293047]">
                    {asset.category}
                  </span>

                  {/* Format & Dimensions */}
                  <span className="absolute bottom-2.5 right-2.5 text-[10px] font-mono px-2 py-0.5 rounded bg-black/80 backdrop-blur-md text-[#D7DEED] border border-[#293047]">
                    {asset.format.toUpperCase()} • {asset.width}×{asset.height}
                  </span>

                  {/* Hover Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity p-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAssetForPreview(asset);
                      }}
                      className="p-2 rounded-lg bg-[#171B29] text-[#D7DEED] hover:text-[#38BDF8] border border-[#293047] cursor-pointer transition-colors"
                      title="Inspect Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleInitiateAddToCanvas(asset);
                      }}
                      className="px-3 py-2 rounded-lg bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg shadow-black/80 border border-[#BA68C8]/40 hover:brightness-110 cursor-pointer transition-all"
                      title="Add to Studio Canvas"
                    >
                      <Palette className="w-3.5 h-3.5 text-[#E1BEE7]" />
                      <span>Add to Canvas</span>
                    </button>
                  </div>
                </div>

                {/* Card Meta Content */}
                <div className="p-3.5 flex flex-col justify-between flex-1">
                  <div>
                    <h4
                      onClick={() => setSelectedAssetForPreview(asset)}
                      className="text-xs font-bold text-[#D7DEED] group-hover:text-[#D7DEED] transition-colors truncate cursor-pointer"
                      title={asset.title}
                    >
                      {asset.title}
                    </h4>

                    <div className="flex flex-wrap gap-1 mt-2">
                      {asset.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[10px] px-1.5 py-0.2 rounded bg-[#131724] text-[#8E9AB8] border border-[#293047]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[#242B3F] flex items-center justify-between gap-2">
                    <span className="text-[10px] text-[#8E9AB8] font-mono shrink-0">
                      {(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleInitiateAddToCanvas(asset);
                        }}
                        className="px-2 py-1 rounded text-[11px] font-semibold bg-[#7A1FA2]/25 hover:bg-[#7A1FA2]/50 text-[#BA68C8] hover:text-white border border-[#7A1FA2]/50 cursor-pointer transition-all flex items-center gap-1 shadow-xs"
                        title="Add to Studio Canvas as Layer"
                      >
                        <Palette className="w-3 h-3" />
                        <span>Add to Canvas</span>
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 rounded text-[#8E9AB8] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors shrink-0"
                        title={isUserUpload ? 'Delete Uploaded Asset' : 'Remove from Library'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. Detailed Asset Modal */}
      {selectedAssetForPreview && (
        <UIModal
          isOpen={true}
          onClose={() => setSelectedAssetForPreview(null)}
          title={selectedAssetForPreview.title}
          subtitle={`${
            selectedAssetForPreview.id.startsWith('asset-custom-')
              ? 'User Uploaded Asset'
              : 'Verified Studio Stock Element'
          } • ${selectedAssetForPreview.format.toUpperCase()}`}
          maxWidth="lg"
          footer={
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 w-full">
              <UIButton
                variant="ghost"
                size="sm"
                onClick={() => setSelectedAssetForPreview(null)}
              >
                Close
              </UIButton>
              <div className="flex items-center gap-2">
                {activeProjectId && (
                  <UIButton
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const asset = selectedAssetForPreview;
                      setSelectedAssetForPreview(null);
                      setProjectPickerAsset(asset);
                      setIsProjectPickerOpen(true);
                    }}
                  >
                    Choose Another Project...
                  </UIButton>
                )}
                <UIButton
                  variant="primary"
                  size="sm"
                  leftIcon={<Palette className="w-4 h-4" />}
                  onClick={() => {
                    const asset = selectedAssetForPreview;
                    setSelectedAssetForPreview(null);
                    handleInitiateAddToCanvas(asset);
                  }}
                >
                  {activeProject ? `Add to Canvas (${activeProject.title})` : 'Add to Canvas'}
                </UIButton>
              </div>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div className="relative h-64 w-full rounded-xl bg-canvas-checker border border-[#293047] overflow-hidden flex items-center justify-center">
              {selectedAssetForPreview.url ? (
                <img
                  src={selectedAssetForPreview.url}
                  alt={selectedAssetForPreview.title}
                  className="max-h-full max-w-full object-contain"
                />
              ) : null}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-[#131724] border border-[#293047]">
                <span className="text-[10px] text-[#8E9AB8] uppercase block font-mono">Resolution</span>
                <span className="font-mono text-[#38BDF8] font-bold">
                  {selectedAssetForPreview.width} × {selectedAssetForPreview.height}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#131724] border border-[#293047]">
                <span className="text-[10px] text-[#8E9AB8] uppercase block font-mono">File Size</span>
                <span className="font-mono text-[#D7DEED] font-bold">
                  {(selectedAssetForPreview.fileSizeBytes / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#131724] border border-[#293047]">
                <span className="text-[10px] text-[#8E9AB8] uppercase block font-mono">Channel Format</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {selectedAssetForPreview.format === 'png' || selectedAssetForPreview.format === 'webp'
                    ? 'RGBA 8bpc'
                    : 'RGB Opaque'}
                </span>
              </div>
              <div className="p-2.5 rounded-lg bg-[#131724] border border-[#293047]">
                <span className="text-[10px] text-[#8E9AB8] uppercase block font-mono">Category</span>
                <span className="capitalize text-[#38BDF8] font-bold">
                  {selectedAssetForPreview.category}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {selectedAssetForPreview.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-full bg-[#131724] border border-[#293047] text-xs text-[#8E9AB8]"
                >
                  #{t}
                </span>
              ))}
            </div>
          </div>
        </UIModal>
      )}

      {/* 5. Project Selection Modal (When no project is open or user wants to pick one) */}
      {isProjectPickerOpen && projectPickerAsset && (
        <UIModal
          isOpen={true}
          onClose={() => {
            if (!isAddingToCanvas) {
              setIsProjectPickerOpen(false);
              setProjectPickerAsset(null);
            }
          }}
          title="Select Studio Project"
          subtitle="Choose an existing Studio project to insert this transparent cutout as an independent layer."
          maxWidth="lg"
          footer={
            <UIButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsProjectPickerOpen(false);
                setProjectPickerAsset(null);
              }}
              disabled={isAddingToCanvas}
            >
              Cancel
            </UIButton>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Cutout Asset Summary Card */}
            <div className="p-3 rounded-xl bg-[#131724] border border-[#242B3F] flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-canvas-checker border border-[#293047] overflow-hidden flex items-center justify-center shrink-0">
                {projectPickerAsset.url ? (
                  <img
                    src={projectPickerAsset.url}
                    alt={projectPickerAsset.title}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[10px] font-mono text-[#BA68C8] uppercase tracking-wider font-bold">
                  Target Cutout Layer
                </span>
                <h4 className="text-xs font-bold text-[#D7DEED] truncate">
                  {projectPickerAsset.title}
                </h4>
                <div className="flex items-center gap-2 text-[11px] text-[#8E9AB8] font-mono mt-0.5">
                  <span>{projectPickerAsset.width} × {projectPickerAsset.height} px</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium">Alpha Channel</span>
                  <span>•</span>
                  <span>{projectPickerAsset.format.toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* List of Existing Projects */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#8E9AB8] uppercase tracking-wider font-mono">
                  Existing Projects ({projects.length})
                </span>
                <span className="text-[10px] text-[#5E6985]">
                  Select destination canvas
                </span>
              </div>

              {projects.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-[#131724] border border-[#242B3F]">
                  <p className="text-xs text-[#8E9AB8] mb-3">No projects found. Please create a project in Projects Hub first.</p>
                  <UIButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setIsProjectPickerOpen(false);
                      setProjectPickerAsset(null);
                      navigateTo('projects');
                    }}
                  >
                    Go to Projects Hub
                  </UIButton>
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                  {projects.map((proj) => {
                    const isActive = proj.id === activeProjectId;

                    return (
                      <div
                        key={proj.id}
                        className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                          isActive
                            ? 'bg-gradient-to-r from-[#1F1930] to-[#171B29] border-[#7A1FA2]/80 ring-1 ring-[#7A1FA2]/30'
                            : 'bg-[#171B29] hover:bg-[#1A1F30] border-[#242B3F]'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Project thumbnail */}
                          <div className="w-14 h-10 rounded-md bg-[#10131E] border border-[#293047] overflow-hidden shrink-0 flex items-center justify-center">
                            {proj.thumbnailUrl ? (
                              <img
                                src={proj.thumbnailUrl}
                                alt={proj.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <FolderOpen className="w-5 h-5 text-[#38BDF8]" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="text-xs font-bold text-[#D7DEED] truncate">
                                {proj.title}
                              </h5>
                              {isActive && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-[#7A1FA2]/40 text-[#E1BEE7] border border-[#BA68C8]/50">
                                  CURRENT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-[#8E9AB8] font-mono mt-0.5">
                              <span>{proj.width} × {proj.height} px</span>
                              <span>•</span>
                              <span>{proj.layerCount} layers</span>
                              <span>•</span>
                              <span>{proj.colorSpace.toUpperCase()}</span>
                            </div>
                          </div>
                        </div>

                        <UIButton
                          variant={isActive ? 'primary' : 'secondary'}
                          size="sm"
                          leftIcon={<Palette className="w-3.5 h-3.5" />}
                          onClick={() => executeAddToCanvas(projectPickerAsset, proj.id)}
                          disabled={isAddingToCanvas}
                        >
                          {isAddingToCanvas ? 'Adding...' : 'Add to Canvas'}
                        </UIButton>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </UIModal>
      )}
    </div>
  );
};
