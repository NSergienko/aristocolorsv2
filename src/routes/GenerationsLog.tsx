/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  History,
  Sparkles,
  ArrowRight,
  Clock,
  ExternalLink,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { GenerationAuditRecord } from '../types/shell.ts';
import { UIButton } from '../ui/UIButton.tsx';
import { UIModal } from '../ui/UIModal.tsx';

import { SVG_ARTWORKS } from '../utils/artworkThumbnails.ts';

const SAMPLE_GENERATIONS: GenerationAuditRecord[] = [
  {
    id: 'gen-101',
    projectId: 'proj-cyber-dusk',
    projectTitle: 'Neo-Tokyo Overpass Matte',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    prompt: 'Harmonize sci-fi drone cutout with rainy neon backdrop: match pink/cyan key bounce, wet surface gloss, and soft edge atmospheric diffusion.',
    sourceLayerName: 'Drone_Scout_Alpha',
    styleSource: 'background',
    status: 'completed',
    beforePreviewUrl: SVG_ARTWORKS.reconDrone,
    afterPreviewUrl: SVG_ARTWORKS.cyberpunk,
    durationSeconds: 3.4,
  },
  {
    id: 'gen-102',
    projectId: 'proj-valkyrie-ruins',
    projectTitle: 'Nordic Shrine in Mist',
    timestamp: new Date(Date.now() - 3600000 * 26).toISOString(),
    prompt: 'Transfer painterly oil impasto texture and warm dawn chiaroscuro to knight statue fragment. Preserve silhouette contours.',
    sourceLayerName: 'Statue_Hero_Cutout',
    styleSource: 'preset',
    presetName: 'Classic Oil Painting',
    status: 'completed',
    beforePreviewUrl: SVG_ARTWORKS.nordic,
    afterPreviewUrl: SVG_ARTWORKS.oilPalette,
    durationSeconds: 4.1,
  },
];

export const GenerationsLog: React.FC = () => {
  const { openProject } = useShell();
  const [selectedRecord, setSelectedRecord] = useState<GenerationAuditRecord | null>(null);
  const [compareMode, setCompareMode] = useState<'after' | 'before'>('after');

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#0D101A] p-5 lg:p-7 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#293047]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-[#D7DEED] tracking-tight">
              Generations Log
            </h1>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#171B29] border border-[#293047] text-[#38BDF8] shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
              {SAMPLE_GENERATIONS.length} Harmonizations
            </span>
          </div>
          <p className="text-xs text-[#8E9AB8] mt-1">
            Audit history of neural transformations, prompt parameters, and before/after comparisons.
          </p>
        </div>
      </div>

      {/* Generations Table */}
      <div className="my-6 border border-[#242B3F] rounded-xl bg-[#171B29] overflow-hidden shadow-xl shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#293047] bg-[#131724] text-[11px] font-bold tracking-wider text-[#8E9AB8] uppercase font-mono">
              <th className="py-3 px-4">Preview</th>
              <th className="py-3 px-4">Project & Layer</th>
              <th className="py-3 px-4">Prompt & Style Source</th>
              <th className="py-3 px-4">Time & Speed</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#242B3F] text-xs text-[#D7DEED]">
            {SAMPLE_GENERATIONS.map((gen) => (
              <tr key={gen.id} className="hover:bg-[#1E2436] transition-colors">
                {/* Thumbnails */}
                <td className="py-3 px-4 w-32">
                  <div
                    onClick={() => setSelectedRecord(gen)}
                    className="relative w-20 h-14 rounded-lg bg-canvas-checker border border-[#293047] overflow-hidden cursor-pointer group shadow-sm shadow-black/40"
                  >
                    <img
                      src={gen.afterPreviewUrl}
                      alt="Output"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Sparkles className="w-4 h-4 text-[#38BDF8]" />
                    </div>
                  </div>
                </td>

                {/* Project */}
                <td className="py-3 px-4">
                  <span className="font-bold text-[#D7DEED] block truncate max-w-xs">
                    {gen.projectTitle}
                  </span>
                  <span className="text-[11px] text-[#8E9AB8] font-mono mt-0.5 block">
                    Layer: {gen.sourceLayerName}
                  </span>
                </td>

                {/* Prompt & Source */}
                <td className="py-3 px-4 max-w-md">
                  <p className="line-clamp-2 text-[#D7DEED] leading-snug">
                    {gen.prompt}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#7A1FA2]/25 text-[#D7DEED] border border-[#7A1FA2]/50 capitalize font-medium">
                      Source: {gen.styleSource} {gen.presetName ? `(${gen.presetName})` : ''}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3 h-3" />
                      Neural Harmonized
                    </span>
                  </div>
                </td>

                {/* Time & Speed */}
                <td className="py-3 px-4 font-mono text-[#8E9AB8] text-[11px]">
                  <div className="flex items-center gap-1 text-[#38BDF8]">
                    <Clock className="w-3 h-3" />
                    {gen.durationSeconds}s
                  </div>
                  <span className="text-[#5E6985] text-[10px] block mt-0.5">
                    {new Date(gen.timestamp).toLocaleDateString()}
                  </span>
                </td>

                {/* Actions */}
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <UIButton
                      variant="secondary"
                      size="xs"
                      onClick={() => setSelectedRecord(gen)}
                    >
                      Compare
                    </UIButton>
                    <UIButton
                      variant="primary"
                      size="xs"
                      rightIcon={<ExternalLink className="w-3 h-3" />}
                      onClick={() => openProject(gen.projectId)}
                    >
                      Open Canvas
                    </UIButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Compare Modal */}
      {selectedRecord && (
        <UIModal
          isOpen={true}
          onClose={() => setSelectedRecord(null)}
          title="Harmonization Audit & Comparison"
          subtitle={`${selectedRecord.projectTitle} • Layer: ${selectedRecord.sourceLayerName}`}
          maxWidth="2xl"
          footer={
            <UIButton
              variant="primary"
              size="sm"
              onClick={() => {
                openProject(selectedRecord.projectId);
                setSelectedRecord(null);
              }}
            >
              Select Project Canvas
            </UIButton>
          }
        >
          <div className="flex flex-col gap-4">
            {/* Before / After Switcher */}
            <div className="flex items-center justify-center gap-2 bg-[#131724] p-1 rounded-lg border border-[#293047] w-fit mx-auto shadow-inner">
              <button
                onClick={() => setCompareMode('before')}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                  compareMode === 'before'
                    ? 'bg-[#1E2436] text-[#D7DEED] border border-[#293047]'
                    : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                }`}
              >
                Original Raw Cutout
              </button>
              <button
                onClick={() => setCompareMode('after')}
                className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-all ${
                  compareMode === 'after'
                    ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] shadow-sm shadow-black/40 border border-[#BA68C8]/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                    : 'text-[#8E9AB8] hover:text-[#D7DEED]'
                }`}
              >
                Harmonized Output
              </button>
            </div>

            {/* Image Viewer */}
            <div className="relative h-72 w-full rounded-xl bg-canvas-checker border border-[#293047] overflow-hidden flex items-center justify-center shadow-inner">
              <img
                src={
                  compareMode === 'after'
                    ? selectedRecord.afterPreviewUrl
                    : selectedRecord.beforePreviewUrl
                }
                alt="Compare view"
                className="max-h-full max-w-full object-contain"
              />
              <span className="absolute bottom-3 left-3 text-xs font-mono font-bold px-2 py-1 rounded bg-black/80 backdrop-blur-md text-[#38BDF8] border border-[#293047] uppercase">
                {compareMode === 'after' ? 'Harmonized' : 'Original Source'}
              </span>
            </div>

            {/* Prompt details */}
            <div className="p-3.5 rounded-lg bg-[#131724] border border-[#293047] flex flex-col gap-1.5 shadow-inner">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#8E9AB8] font-mono">
                Conditioning Instruction Prompt
              </span>
              <p className="text-xs text-[#D7DEED] leading-relaxed font-mono">
                {selectedRecord.prompt}
              </p>
            </div>
          </div>
        </UIModal>
      )}
    </div>
  );
};
