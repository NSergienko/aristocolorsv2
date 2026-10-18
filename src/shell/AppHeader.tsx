/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Search,
  Sparkles,
  ChevronRight,
  FolderOpen,
  ArrowLeft,
} from 'lucide-react';
import { useShell } from './ShellContext.tsx';

const ROUTE_LABELS: Record<string, string> = {
  landing: 'Overview',
  projects: 'Projects Hub',
  studio: 'Studio Canvas',
  assets: 'Assets Library',
  generations: 'Generations Log',
  settings: 'Preferences',
  billing: 'Plan & Billing',
  'color-lab': 'Color Lab',
  'bria-poc': 'Cutout Lab',
  'relight-poc': 'Relight POC',
};

export const AppHeader: React.FC = () => {
  const {
    currentRoute,
    navigateTo,
    setCommandPaletteOpen,
    userProfile,
  } = useShell();

  return (
    <header className="h-11 w-full bg-[#131724]/90 backdrop-blur-md border-b border-[#293047] px-3.5 flex items-center justify-between shrink-0 select-none z-30 font-sans shadow-[inset_0_1px_0_rgba(215,222,237,0.08)]">
      {/* Left: Brand Identity & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-2.5 group cursor-pointer text-left focus:outline-none"
          title="Return to AristoColors Landing Home"
        >
          {/* Distinct Aperture / Workstation Emblem with Pantone 254 PC purple & Ice Blue */}
          <div className="w-6.5 h-6.5 rounded-md bg-[#171B29] border border-[#7A1FA2]/60 flex items-center justify-center shadow-md shadow-black/40 group-hover:border-[#9135B7] transition-colors shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]">
            <span className="w-3 h-3 border-2 border-[#D7DEED] rotate-45 flex items-center justify-center">
              <span className="w-1 h-1 bg-[#38BDF8] rounded-full shadow-xs shadow-[#38BDF8]" />
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-bold text-xs tracking-wider text-[#D7DEED] group-hover:text-[#D7DEED] transition-colors uppercase font-mono">
              AristoColors
            </span>
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-[#7A1FA2]/25 text-[#D7DEED] border border-[#7A1FA2]/50 uppercase tracking-widest shadow-xs">
              Studio
            </span>
          </div>
        </button>

        {/* Back to Home / Landing Button */}
        <button
          onClick={() => navigateTo('landing')}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-[#8E9AB8] hover:text-[#D7DEED] bg-[#171B29]/80 hover:bg-[#1E2436] border border-[#293047] hover:border-[#7A1FA2]/60 transition-all cursor-pointer shadow-xs"
          title="Return to Landing Page (/)"
        >
          <ArrowLeft className="w-3 h-3 text-[#38BDF8]" />
          <span className="hidden sm:inline">Головна</span>
        </button>

        {/* Divider */}
        <div className="h-3.5 w-[1px] bg-[#293047] mx-0.5" />

        {/* Breadcrumb Path */}
        <div className="flex items-center gap-1.5 text-xs">
          <button
            onClick={() => navigateTo('projects')}
            className={`px-1.5 py-0.5 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29] transition-colors cursor-pointer ${
              currentRoute === 'projects' ? 'text-[#D7DEED] font-semibold' : ''
            }`}
          >
            <span className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-[#38BDF8]" />
              <span>Projects</span>
            </span>
          </button>

          {currentRoute !== 'projects' && (
            <>
              <ChevronRight className="w-3 h-3 text-[#5E6985]" />
              <span className="text-[#D7DEED] font-semibold">
                {ROUTE_LABELS[currentRoute] || currentRoute}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Middle: Universal Search / Command Palette Bar */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="flex items-center justify-between w-60 md:w-76 h-7 px-2.5 rounded bg-[#0D101A]/80 hover:bg-[#171B29] border border-[#293047] hover:border-[#384363] text-xs text-[#8E9AB8] transition-colors cursor-pointer group shadow-inner"
        >
          <span className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-[#5E6985] group-hover:text-[#D7DEED] transition-colors" />
            <span className="text-[#8E9AB8] group-hover:text-[#D7DEED] text-[11px]">
              Search actions, tools, layers...
            </span>
          </span>
          <kbd className="px-1.5 py-0.2 text-[9px] font-mono bg-black/60 border border-[#293047] rounded text-[#8E9AB8]">
            Ctrl+K
          </kbd>
        </button>
      </div>

      {/* Right: Balance & Profile */}
      <div className="flex items-center gap-2.5">
        {/* Compute Balance Pill */}
        <button
          onClick={() => navigateTo('billing')}
          className="flex items-center gap-1.5 px-2.5 py-0.8 rounded bg-[#171B29] hover:bg-[#1E2436] border border-[#7A1FA2]/40 hover:border-[#7A1FA2]/70 text-xs text-[#D7DEED] transition-colors cursor-pointer shadow-xs shadow-black/40"
          title="Compute Balance • Subscription"
        >
          <Sparkles className="w-3 h-3 text-[#38BDF8]" />
          <span className="font-bold tabular-nums font-mono text-[#D7DEED]">
            {userProfile.aiCreditsRemaining}
          </span>
          <span className="text-[10px] text-[#8E9AB8] font-mono">Credits</span>
        </button>

        {/* User Account Capsule */}
        <button
          onClick={() => navigateTo('settings')}
          className="flex items-center gap-2 pl-1 pr-2 py-0.5 rounded hover:bg-[#171B29] border border-transparent hover:border-[#293047] transition-colors cursor-pointer"
        >
          <div className="w-5.5 h-5.5 rounded bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] font-bold text-[10px] flex items-center justify-center font-mono shadow-xs shadow-black/40 border border-[#BA68C8]/30">
            NS
          </div>
          <span className="text-xs font-semibold text-[#D7DEED] hidden sm:inline">
            Nataliya
          </span>
          <span className="text-[9px] font-mono font-bold tracking-wider px-1.5 py-0.2 rounded bg-[#7A1FA2]/25 text-[#D7DEED] border border-[#7A1FA2]/50 uppercase">
            PRO
          </span>
        </button>
      </div>
    </header>
  );
};
