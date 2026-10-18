/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Star,
  Copy,
  Trash2,
  Calendar,
  Layers,
  ArrowRight,
  Maximize2,
  SlidersHorizontal,
  Clock,
  Sparkles,
  Palette,
  FolderOpen,
  AlertTriangle,
  ArrowUpDown,
  ExternalLink,
} from 'lucide-react';
import { useShell, DEFAULT_CANVAS_PRESETS } from '../shell/ShellContext.tsx';
import { CanvasPreset, ProjectMetadata } from '../types/shell.ts';
import { UIButton } from '../ui/UIButton.tsx';
import { UIInput } from '../ui/UIInput.tsx';
import { UIModal } from '../ui/UIModal.tsx';
import { UIEmptyState } from '../ui/UIEmptyState.tsx';
import {
  loadDocument,
  loadBinaryAsset,
  storeBinaryAsset,
} from '../services/DocumentPersistence.ts';
import {
  generateCompositeThumbnailFromDocument,
  dataUrlToBlob,
  getCachedThumbnail,
  setCachedThumbnail,
} from '../utils/thumbnailGenerator.ts';

interface TemplateOption {
  id: string;
  name: string;
  tag: string;
  previewUrl: string;
  description: string;
}

const STARTER_TEMPLATES: TemplateOption[] = [
  {
    id: 'blank',
    name: 'Blank Canvas',
    tag: 'Custom',
    previewUrl: '',
    description: 'Pristine transparent checkerboard canvas with default background layer.',
  },
  {
    id: 'cyberpunk',
    name: 'Neo-Tokyo Cyberpunk Plate',
    tag: 'Cyberpunk',
    previewUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
    description: 'Nocturnal metropolis with neon reflections, light bloom, and rain atmosphere.',
  },
  {
    id: 'nordic',
    name: 'Nordic Mist Valley Plate',
    tag: 'Environment',
    previewUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
    description: 'Painterly misty mountain landscape with dawn rim lighting and atmospheric depth.',
  },
  {
    id: 'scifi',
    name: 'Orbital Hangar Interior',
    tag: 'Sci-Fi',
    previewUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80',
    description: 'Hard-surface architectural industrial space for character and mech compositing.',
  },
];

export const ProjectsHub: React.FC = () => {
  const {
    projects,
    openProject,
    createProject,
    duplicateProject,
    deleteProject,
    toggleFavoriteProject,
    updateProject,
  } = useShell();

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'favorites' | 'concept' | 'matte'>('all');
  const [sortBy, setSortBy] = useState<'updated' | 'title' | 'resolution'>('updated');

  // New Project Form State
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [projectTitle, setProjectTitle] = useState('New Concept Matte');
  const [projectDescription, setProjectDescription] = useState('High-resolution matte painting composition with layered lighting.');
  const [selectedPreset, setSelectedPreset] = useState<CanvasPreset>(DEFAULT_CANVAS_PRESETS[1]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateOption>(STARTER_TEMPLATES[1]);
  const [customWidth, setCustomWidth] = useState(2560);
  const [customHeight, setCustomHeight] = useState(1440);
  const [isCustomPreset, setIsCustomPreset] = useState(false);
  const [projectTag, setProjectTag] = useState('Concept Art');

  // Delete Confirmation State
  const [projectPendingDelete, setProjectPendingDelete] = useState<ProjectMetadata | null>(null);

  // In-memory cache for loaded composite thumbnail URLs keyed by project ID
  const [compositeThumbs, setCompositeThumbs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const p of projects) {
      const cached = getCachedThumbnail(p.id);
      if (cached) initial[p.id] = cached;
    }
    return initial;
  });

  const syncedIdsRef = useRef<Set<string>>(new Set());
  const projectIdsKey = projects.map((p) => p.id).join(',');

  // Synchronize and restore composite previews for all compositions
  useEffect(() => {
    let isCancelled = false;

    const syncThumbnails = async () => {
      await Promise.all(
        projects.map(async (proj) => {
          try {
            // Demo stock projects preserve their verified photographic preview
            if (
              proj.id === 'proj-cyber-dusk' ||
              proj.id === 'proj-valkyrie-ruins' ||
              proj.id === 'proj-mech-pilot' ||
              syncedIdsRef.current.has(proj.id)
            ) {
              return;
            }

            syncedIdsRef.current.add(proj.id);

            // 1. Check if already cached in memory
            const cached = getCachedThumbnail(proj.id);
            if (cached && !isCancelled) {
              setCompositeThumbs((prev) => (prev[proj.id] === cached ? prev : { ...prev, [proj.id]: cached }));
            }

            // 2. Load persistent binary composite thumbnail from IndexedDB
            const thumbBlob = await loadBinaryAsset(`thumb_${proj.id}`);
            if (thumbBlob && !isCancelled) {
              const url = URL.createObjectURL(thumbBlob);
              setCachedThumbnail(proj.id, url);
              setCompositeThumbs((prev) => ({ ...prev, [proj.id]: url }));
              return;
            }

            // 3. Fallback: If no persistent thumbnail exists yet, inspect document and generate full composite
            const doc = await loadDocument(proj.id);
            if (doc && doc.rootLayerIds && doc.rootLayerIds.length > 0 && !isCancelled) {
              const compositeUrl = await generateCompositeThumbnailFromDocument(doc, 640);
              if (compositeUrl && !isCancelled) {
                setCachedThumbnail(proj.id, compositeUrl);
                setCompositeThumbs((prev) => ({ ...prev, [proj.id]: compositeUrl }));
                updateProject(proj.id, {
                  thumbnailUrl: compositeUrl,
                  layerCount: doc.rootLayerIds.length,
                });
                const blob = dataUrlToBlob(compositeUrl);
                storeBinaryAsset(`thumb_${proj.id}`, blob).catch(() => {});
              }
            }
          } catch (err) {
            console.warn(`[ProjectsHub] Non-blocking thumbnail sync error for ${proj.id}:`, err);
          }
        })
      );
    };

    syncThumbnails();

    return () => {
      isCancelled = true;
    };
  }, [projectIdsKey]);

  // Filter & Sort
  const filteredProjects = projects
    .filter((p) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        p.title.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.tags.some((t) => t.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (activeFilter === 'favorites') return p.isFavorite;
      if (activeFilter === 'concept') return p.tags.includes('Concept Art');
      if (activeFilter === 'matte') return p.tags.includes('Matte Painting');

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.title.localeCompare(b.title);
      if (sortBy === 'resolution') return b.width * b.height - a.width * a.height;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const favoritesCount = projects.filter((p) => p.isFavorite).length;
  const conceptCount = projects.filter((p) => p.tags.includes('Concept Art')).length;
  const matteCount = projects.filter((p) => p.tags.includes('Matte Painting')).length;

  const handleCreateConfirm = async () => {
    if (isCreating) return;
    const width = isCustomPreset ? customWidth : selectedPreset.width;
    const height = isCustomPreset ? customHeight : selectedPreset.height;
    const thumb = selectedTemplate.previewUrl || undefined;

    try {
      setIsCreating(true);
      await createProject(
        projectTitle,
        width,
        height,
        300,
        [projectTag, selectedTemplate.tag, isCustomPreset ? 'Custom' : selectedPreset.category],
        thumb,
        projectDescription
      );
      setIsNewProjectModalOpen(false);
    } catch {
      // Keep modal open if creation fails so user can retry.
      // Error toast is already displayed by ShellContext.
    } finally {
      setIsCreating(false);
    }
  };

  const handleConfirmDelete = () => {
    if (projectPendingDelete) {
      deleteProject(projectPendingDelete.id);
      setProjectPendingDelete(null);
    }
  };

  const formatRelativeTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-gradient-to-b from-[#131724] via-[#10131E] to-[#0E111B] p-5 lg:p-7 select-none">
      {/* 1. Top Hub Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#293047]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#D7DEED] tracking-tight">
              Projects Hub
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-gradient-to-b from-[#1C2233] to-[#171B29] border border-[#293047] text-[#38BDF8] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]">
              {projects.length} Documents
            </span>
          </div>
          <p className="text-xs text-[#8E9AB8] mt-1">
            Non-destructive photobashing documents with layer hierarchies, masks, and harmonization profiles.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <UIButton
            variant="primary"
            size="md"
            leftIcon={<Plus className="w-4 h-4" />}
            onClick={() => {
              setProjectTitle(`Photobash #${projects.length + 1}`);
              setIsNewProjectModalOpen(true);
            }}
          >
            New Canvas
          </UIButton>
        </div>
      </div>

      {/* 2. Interactive Filter, Sort, and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-5">
        <div className="flex items-center gap-1.5 bg-gradient-to-b from-[#171B29] to-[#141824] p-1.5 rounded-lg border border-[#293047] overflow-x-auto shadow-sm shadow-black/30 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'all'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            <span>All Projects</span>
            <span className="text-[10px] font-mono opacity-80">({projects.length})</span>
          </button>
          <button
            onClick={() => setActiveFilter('favorites')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
              activeFilter === 'favorites'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span>Favorites</span>
            <span className="text-[10px] font-mono opacity-80">({favoritesCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('concept')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'concept'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            <span>Concept Art</span>
            <span className="text-[10px] font-mono opacity-80">({conceptCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('matte')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeFilter === 'matte'
                ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436]/60'
            }`}
          >
            <span>Matte Painting</span>
            <span className="text-[10px] font-mono opacity-80">({matteCount})</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-gradient-to-b from-[#171B29] to-[#141824] px-2.5 py-1.5 rounded-lg border border-[#293047] hover:border-[#384363] text-xs text-[#8E9AB8] shadow-sm shadow-black/30 shadow-[inset_0_1px_0_rgba(215,222,237,0.06)] transition-colors">
            <ArrowUpDown className="w-3.5 h-3.5 text-[#8E9AB8]" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-[#D7DEED] focus:outline-none text-xs cursor-pointer font-medium"
            >
              <option value="updated" className="bg-[#171B29]">Recent Edits</option>
              <option value="title" className="bg-[#171B29]">Title (A-Z)</option>
              <option value="resolution" className="bg-[#171B29]">Canvas Size</option>
            </select>
          </div>

          {/* Search Bar */}
          <div className="w-56 sm:w-64">
            <UIInput
              prefixIcon={<Search className="w-3.5 h-3.5" />}
              placeholder="Filter canvases or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onClear={() => setSearchQuery('')}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* 3. Projects Grid */}
      {filteredProjects.length === 0 ? (
        <UIEmptyState
          icon={<Layers className="w-6 h-6 text-[#38BDF8]" />}
          title="No projects match criteria"
          description={
            searchQuery
              ? `No documents matched "${searchQuery}". Clear query or switch active tab filter.`
              : 'Start your creative pipeline by creating your first high-res canvas.'
          }
          actionLabel="Create Canvas"
          actionIcon={<Plus className="w-3.5 h-3.5" />}
          onAction={() => setIsNewProjectModalOpen(true)}
          className="my-16"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => openProject(project.id)}
              className="group relative flex flex-col bg-gradient-to-b from-[#1A1F30] to-[#141824] hover:from-[#1E2438] hover:to-[#171B29] border border-[#293047] hover:border-[#384363] rounded-xl overflow-hidden shadow-md shadow-black/40 hover:shadow-lg transition-all duration-200 cursor-pointer shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]"
            >
              {/* Aspect-Ratio Canvas Preview */}
              <div className="relative aspect-[16/10] w-full bg-canvas-checker border-b border-[#293047] overflow-hidden flex items-center justify-center">
                {(() => {
                  const displayThumb =
                    getCachedThumbnail(project.id) ||
                    compositeThumbs[project.id] ||
                    project.thumbnailUrl;

                  const fallbackSrc =
                    project.tags.includes('Cyberpunk')
                      ? 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80'
                      : project.tags.includes('Fantasy') || project.tags.includes('Environment')
                      ? 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80'
                      : 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80';

                  return (
                    <img
                      src={displayThumb || fallbackSrc}
                      alt={project.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      onError={async () => {
                        try {
                          if (
                            project.id === 'proj-cyber-dusk' ||
                            project.id === 'proj-valkyrie-ruins' ||
                            project.id === 'proj-mech-pilot'
                          ) {
                            return;
                          }
                          const doc = await loadDocument(project.id);
                          if (doc && doc.rootLayerIds && doc.rootLayerIds.length > 0) {
                            const generated = await generateCompositeThumbnailFromDocument(doc, 640);
                            if (generated) {
                              setCachedThumbnail(project.id, generated);
                              setCompositeThumbs((prev) => ({ ...prev, [project.id]: generated }));
                              updateProject(project.id, {
                                thumbnailUrl: generated,
                                layerCount: doc.rootLayerIds.length,
                              });
                              const blob = dataUrlToBlob(generated);
                              storeBinaryAsset(`thumb_${project.id}`, blob).catch(() => {});
                            }
                          }
                        } catch {}
                      }}
                    />
                  );
                })()}

                {/* Subtle satin vignette shade for contrast */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#141824]/90 via-transparent to-black/20 pointer-events-none" />

                {/* Favorite Star Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFavoriteProject(project.id);
                  }}
                  className={`absolute top-2.5 right-2.5 p-1.5 rounded-md transition-all cursor-pointer ${
                    project.isFavorite
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-xs'
                      : 'bg-[#171B29]/80 text-[#8E9AB8] hover:text-[#D7DEED] border border-[#293047] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]'
                  }`}
                  title={project.isFavorite ? 'Remove Favorite' : 'Mark as Favorite'}
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      project.isFavorite ? 'fill-amber-400' : ''
                    }`}
                  />
                </button>

                {/* Resolution & Layer Pills */}
                <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded bg-[#171B29]/90 text-[10px] font-mono text-[#38BDF8] border border-[#293047] font-medium shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
                    {project.width} × {project.height}
                  </span>
                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#171B29]/90 text-[10px] font-mono text-[#D7DEED] border border-[#293047] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
                    <Layers className="w-3 h-3 text-[#BA68C8]" />
                    {project.layerCount}L
                  </span>
                </div>
              </div>

              {/* Card Meta Content */}
              <div className="p-3.5 flex flex-col justify-between flex-1">
                <div>
                  <h3 className="text-xs font-bold text-[#D7DEED] group-hover:text-[#D7DEED] transition-colors truncate">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-[11px] text-[#8E9AB8] mt-1 line-clamp-2 leading-relaxed">
                      {project.description}
                    </p>
                  )}
                </div>

                <div className="mt-3.5 pt-2.5 border-t border-[#293047] flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[10px] text-[#8E9AB8] font-mono">
                    <Clock className="w-3 h-3 text-[#5E6985]" />
                    <span>{formatRelativeTime(project.updatedAt)}</span>
                  </div>

                  {/* Actions Bar */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => duplicateProject(project.id)}
                      className="p-1 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#1E2436] cursor-pointer transition-colors"
                      title="Duplicate Canvas"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setProjectPendingDelete(project)}
                      className="p-1 rounded text-[#8E9AB8] hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                      title="Delete Canvas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. Delete Confirmation Modal */}
      {projectPendingDelete && (
        <UIModal
          isOpen={true}
          onClose={() => setProjectPendingDelete(null)}
          title="Delete Canvas"
          subtitle="This operation will permanently remove the project document and its layer buffers."
          maxWidth="sm"
          footer={
            <>
              <UIButton
                variant="ghost"
                size="sm"
                onClick={() => setProjectPendingDelete(null)}
              >
                Cancel
              </UIButton>
              <UIButton
                variant="destructive"
                size="sm"
                onClick={handleConfirmDelete}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Delete Canvas
              </UIButton>
            </>
          }
        >
          <div className="flex items-start gap-3 p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs shadow-inner">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" />
            <div>
              <span className="font-bold block text-[#D7DEED]">
                Are you sure you want to delete "{projectPendingDelete.title}"?
              </span>
              <span className="text-[11px] text-[#8E9AB8] mt-1 block">
                {projectPendingDelete.width} × {projectPendingDelete.height} px • {projectPendingDelete.layerCount} layers
              </span>
            </div>
          </div>
        </UIModal>
      )}

      {/* 5. Create Canvas Modal */}
      <UIModal
        isOpen={isNewProjectModalOpen}
        onClose={() => {
          if (!isCreating) {
            setIsNewProjectModalOpen(false);
          }
        }}
        title="Initialize New Canvas"
        subtitle="Configure resolution, canvas preset, and starting background plate"
        maxWidth="lg"
        footer={
          <>
            <UIButton
              variant="ghost"
              size="sm"
              disabled={isCreating}
              onClick={() => setIsNewProjectModalOpen(false)}
            >
              Cancel
            </UIButton>
            <UIButton
              variant="primary"
              size="sm"
              isLoading={isCreating}
              disabled={isCreating}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
              onClick={handleCreateConfirm}
            >
              Create Canvas
            </UIButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <UIInput
            label="Project Title"
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            placeholder="e.g. Cyberpunk Overpass Key Art"
          />

          <UIInput
            label="Project Description"
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.target.value)}
            placeholder="Brief artistic description or concept notes"
            size="sm"
          />

          {/* Starter Plate Selector */}
          <div>
            <label className="text-xs font-semibold text-[#D7DEED] block mb-1.5">
              Starter Background Plate
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STARTER_TEMPLATES.map((tmpl) => {
                const isSelected = selectedTemplate.id === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    type="button"
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={`flex flex-col p-2 rounded-lg border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-b from-[#1F1930] to-[#171B29] border-[#7A1FA2] shadow-xs shadow-black/40 ring-1 ring-[#7A1FA2]/60 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]'
                        : 'bg-gradient-to-b from-[#171B29] to-[#141824] border-[#293047] hover:border-[#384363] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.04)]'
                    }`}
                  >
                    <div className="h-16 w-full rounded bg-canvas-checker overflow-hidden mb-1.5 border border-[#293047]">
                      {tmpl.previewUrl ? (
                        <img
                          src={tmpl.previewUrl}
                          alt={tmpl.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#5E6985] text-[10px] font-mono">
                          Checkerboard
                        </div>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-[#D7DEED] truncate">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] text-[#38BDF8] line-clamp-1 mt-0.5">
                      {tmpl.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Resolution Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-[#D7DEED]">
                Resolution Preset
              </label>
              <button
                type="button"
                onClick={() => setIsCustomPreset(!isCustomPreset)}
                className="text-xs text-[#BA68C8] hover:text-[#D7DEED] hover:underline cursor-pointer font-medium transition-colors"
              >
                {isCustomPreset ? 'Use Standard Presets' : 'Custom Dimensions'}
              </button>
            </div>

            {!isCustomPreset ? (
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                {DEFAULT_CANVAS_PRESETS.map((preset) => {
                  const isSelected = selectedPreset.id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setSelectedPreset(preset)}
                      className={`flex flex-col text-left p-2.5 rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#1F1930] to-[#171B29] border-[#7A1FA2] text-[#D7DEED] shadow-xs shadow-black/40 ring-1 ring-[#7A1FA2]/60 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]'
                          : 'bg-gradient-to-b from-[#171B29] to-[#141824] border-[#293047] hover:border-[#384363] text-[#8E9AB8] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.04)]'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-bold text-[#D7DEED]">
                          {preset.name}
                        </span>
                        {preset.isPopular && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7A1FA2]/25 border border-[#BA68C8]/30 text-[#D7DEED] font-mono font-bold">
                            POPULAR
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-mono text-[#38BDF8] mt-1 font-medium">
                        {preset.width} × {preset.height} ({preset.aspectRatio})
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 bg-gradient-to-b from-[#171B29] to-[#141824] p-3 rounded-lg border border-[#293047] shadow-[inset_0_1px_0_rgba(215,222,237,0.05)]">
                <div>
                  <label className="text-[11px] text-[#8E9AB8] block mb-1">
                    Width (px)
                  </label>
                  <input
                    type="number"
                    value={customWidth}
                    onChange={(e) => setCustomWidth(Number(e.target.value))}
                    min={512}
                    max={8192}
                    className="w-full h-8 px-2.5 rounded bg-[#10131E] border border-[#293047] text-xs text-[#D7DEED] focus:outline-none focus:border-[#7A1FA2] focus:ring-1 focus:ring-[#7A1FA2]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#8E9AB8] block mb-1">
                    Height (px)
                  </label>
                  <input
                    type="number"
                    value={customHeight}
                    onChange={(e) => setCustomHeight(Number(e.target.value))}
                    min={512}
                    max={8192}
                    className="w-full h-8 px-2.5 rounded bg-[#10131E] border border-[#293047] text-xs text-[#D7DEED] focus:outline-none focus:border-[#7A1FA2] focus:ring-1 focus:ring-[#7A1FA2]/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </UIModal>
    </div>
  );
};
