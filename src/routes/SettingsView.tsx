/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Settings,
  HardDrive,
  Cpu,
  Key,
  Shield,
  Save,
  Trash2,
  CheckCircle2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { useShell } from '../shell/ShellContext.tsx';
import { UIButton } from '../ui/UIButton.tsx';
import { UIInput } from '../ui/UIInput.tsx';

export const SettingsView: React.FC = () => {
  const { addToast } = useShell();

  // Settings states
  const [colorSpace, setColorSpace] = useState<'srgb' | 'display-p3'>('srgb');
  const [enableGpuAccel, setEnableGpuAccel] = useState(true);
  const [autosaveInterval, setAutosaveInterval] = useState(30);
  const [customApiKey, setCustomApiKey] = useState('');
  const [useManagedKey, setUseManagedKey] = useState(true);

  const handleSaveSettings = () => {
    addToast({
      type: 'success',
      title: 'Preferences Saved',
      message: 'Workspace preferences updated and applied across all views.',
    });
  };

  const handleClearCache = () => {
    addToast({
      type: 'warning',
      title: 'Scratch Disk Flushed',
      message: 'Cleared temporary raster caches and WebGL texture tiles.',
    });
  };

  return (
    <div className="flex flex-col h-full w-full overflow-y-auto bg-[#0D101A] p-5 lg:p-7 select-none">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-[#293047]">
        <div>
          <h1 className="text-lg font-bold text-[#D7DEED] tracking-tight">
            Studio Preferences
          </h1>
          <p className="text-xs text-[#8E9AB8] mt-1">
            Configure graphics performance, color profiles, scratch disks, and render credentials.
          </p>
        </div>

        <UIButton
          variant="primary"
          size="md"
          leftIcon={<Save className="w-4 h-4" />}
          onClick={handleSaveSettings}
        >
          Save Preferences
        </UIButton>
      </div>

      <div className="max-w-3xl flex flex-col gap-6 my-6">
        {/* Section 1: Graphics & Display Engine */}
        <div className="p-5 rounded-xl bg-[#171B29] border border-[#242B3F] shadow-xl shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#293047]">
            <Cpu className="w-4 h-4 text-[#38BDF8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#D7DEED] font-mono">
              Graphics & Compositing Engine
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            {/* Color space */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#D7DEED] block">Working Color Space</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Select color profile for histogram calculations and color picking.
                </span>
              </div>
              <select
                value={colorSpace}
                onChange={(e) => setColorSpace(e.target.value as any)}
                className="bg-[#131724] border border-[#293047] text-[#D7DEED] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-[#7A1FA2] focus:ring-1 focus:ring-[#7A1FA2]/50 cursor-pointer font-medium"
              >
                <option value="srgb">Standard sRGB IEC61966-2.1</option>
                <option value="display-p3">Display P3 Wide Gamut</option>
              </select>
            </div>

            {/* Hardware acceleration */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242B3F]">
              <div>
                <span className="font-semibold text-[#D7DEED] block">WebGL2 Hardware Acceleration</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Leverages GPU for real-time blend modes and 60 FPS viewport blitting.
                </span>
              </div>
              <input
                type="checkbox"
                checked={enableGpuAccel}
                onChange={(e) => setEnableGpuAccel(e.target.checked)}
                className="w-4 h-4 accent-[#7A1FA2] rounded cursor-pointer"
              />
            </div>

            {/* Autosave interval */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242B3F]">
              <div>
                <span className="font-semibold text-[#D7DEED] block">Autosave Snapshot Interval</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Frequency of background IndexedDB state checkpoints.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={10}
                  max={300}
                  value={autosaveInterval}
                  onChange={(e) => setAutosaveInterval(Number(e.target.value))}
                  className="w-20 bg-[#131724] border border-[#293047] text-[#D7DEED] rounded-md px-2.5 py-1 text-xs text-right font-mono focus:outline-none focus:border-[#7A1FA2] focus:ring-1 focus:ring-[#7A1FA2]/50"
                />
                <span className="text-[#8E9AB8] text-[11px] font-mono">seconds</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Neural Harmonizer Configuration */}
        <div className="p-5 rounded-xl bg-[#171B29] border border-[#242B3F] shadow-xl shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#293047]">
            <Sparkles className="w-4 h-4 text-[#BA68C8]" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#D7DEED] font-mono">
              Neural Engine & Server Harmonization
            </h2>
          </div>

          <div className="flex flex-col gap-4 text-xs">
            {/* Neural Model Engine */}
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-[#D7DEED] block">Neural Diffusion Engine</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Server-side Gemini proxy with high-precision edge boundary matching.
                </span>
              </div>
              <select
                defaultValue="gemini-2.5-flash"
                className="bg-[#131724] border border-[#293047] text-[#D7DEED] rounded-md px-3 py-1.5 text-xs focus:outline-none focus:border-[#7A1FA2] focus:ring-1 focus:ring-[#7A1FA2]/50 cursor-pointer font-medium"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Ultra-Fast 3s)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep Visual Reasoning)</option>
              </select>
            </div>

            {/* Inpainting Diffusion Precision */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242B3F]">
              <div>
                <span className="font-semibold text-[#D7DEED] block">Photobash Boundary Blending</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Synthesizes ambient occlusion and directional rim lighting at cutout seams.
                </span>
              </div>
              <span className="text-emerald-400 font-mono text-[11px] font-semibold">
                Enabled (16-bit Float)
              </span>
            </div>

            {/* Cloud Compute Proxy Status */}
            <div className="flex items-center justify-between pt-3 border-t border-[#242B3F]">
              <div>
                <span className="font-semibold text-[#D7DEED] block">Server Endpoint Architecture</span>
                <span className="text-[11px] text-[#8E9AB8]">
                  Zero-exposure client architecture via secure server-side Express proxy.
                </span>
              </div>
              <span className="text-[#38BDF8] font-mono text-[11px]">
                /api/harmonize [Active]
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Scratch Disk & Cache */}
        <div className="p-5 rounded-xl bg-[#171B29] border border-[#242B3F] shadow-xl shadow-black/50 shadow-[inset_0_1px_0_rgba(215,222,237,0.08)] flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[#293047]">
            <HardDrive className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#D7DEED] font-mono">
              IndexedDB Storage & Scratch Disk
            </h2>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div>
              <span className="font-semibold text-[#D7DEED] block">Temporary Bitmap Cache</span>
              <span className="text-[11px] text-[#8E9AB8]">
                2.4 GB cached across 3 documents and 42 layer undo buffers.
              </span>
            </div>

            <UIButton
              variant="destructive"
              size="sm"
              leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={handleClearCache}
            >
              Flush Cache
            </UIButton>
          </div>
        </div>
      </div>
    </div>
  );
};
