/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useShell } from './ShellContext.tsx';
import { Wifi, Cpu, Eye } from 'lucide-react';

export const AppStatusBar: React.FC = () => {
  const { currentRoute, activeProject } = useShell();

  const routeLabels: Record<string, string> = {
    studio: 'Studio Canvas',
    projects: 'Projects Hub',
    assets: 'Assets Library',
    generations: 'Generations Log',
    settings: 'Preferences',
    billing: 'Plan & Billing',
    'bria-poc': 'Cutout Lab',
  };

  return (
    <footer className="h-6 w-full bg-[#131724] border-t border-[#293047] px-3.5 flex items-center justify-between text-[11px] text-[#8E9AB8] select-none z-20 font-mono shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
      {/* Left info: Active Route / Open Project */}
      <div className="flex items-center gap-2.5">
        <span className="text-[#D7DEED] font-medium">
          {routeLabels[currentRoute] || currentRoute}
        </span>

        {activeProject && (
          <>
            <span className="text-[#293047]">·</span>
            <span className="text-[#38BDF8] truncate max-w-[200px]">
              {activeProject.title}
            </span>
            <span className="text-[#293047]">·</span>
            <span className="text-[#8E9AB8]">
              {activeProject.width} × {activeProject.height} px
            </span>
          </>
        )}
      </div>

      {/* Middle info: Workflow guidance */}
      <div className="hidden md:flex items-center gap-2 text-[#5E6985] text-[10px]">
        <span>AristoColors Studio v2.0</span>
        <span>·</span>
        <span>Press <kbd className="text-[#8E9AB8] bg-[#171B29] px-1 py-0.2 rounded border border-[#293047]">Ctrl+K</kbd> for command menu</span>
      </div>

      {/* Right status: Storage and sync state */}
      <div className="flex items-center gap-3 text-[11px] text-[#8E9AB8]">
        <span className="text-[#8E9AB8]">
          Storage: <span className="text-[#D7DEED]">IndexedDB Local</span>
        </span>
        <span className="text-[#293047]">·</span>
        <span className="text-emerald-400 font-medium">
          Ready
        </span>
      </div>
    </footer>
  );
};
