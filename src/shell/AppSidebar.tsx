/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Home,
  FolderOpen,
  Palette,
  Layers,
  History,
  Settings,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  HelpCircle,
  ArrowLeft,
  Scissors,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { useShell } from './ShellContext.tsx';
import { AppRoute } from '../types/shell.ts';

interface NavItem {
  id: AppRoute;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  requiresProject?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'landing', label: 'Home / Landing', icon: Home },
  { id: 'projects', label: 'Projects Hub', icon: FolderOpen },
  { id: 'studio', label: 'Studio Canvas', icon: Palette, requiresProject: true },
  { id: 'color-lab', label: 'Color Lab', icon: Sparkles },
  { id: 'bria-poc', label: 'Cutout Lab', icon: Scissors },
  { id: 'relight-poc', label: 'Relight POC', icon: SunMedium, badge: 'AI' },
  { id: 'assets', label: 'Assets Library', icon: Layers, badge: '6' },
  { id: 'generations', label: 'Generations Log', icon: History },
  { id: 'billing', label: 'Plan & Billing', icon: CreditCard, badge: 'PRO' },
  { id: 'settings', label: 'Preferences', icon: Settings },
];

export const AppSidebar: React.FC = () => {
  const {
    currentRoute,
    navigateTo,
    isSidebarCollapsed,
    toggleSidebar,
    activeProjectId,
    activeProject,
    addToast,
  } = useShell();

  const handleNavClick = (item: NavItem) => {
    if (item.requiresProject && !activeProjectId) {
      addToast({
        type: 'warning',
        title: 'No Active Canvas',
        message: 'Open or create a canvas from Projects Hub first.',
      });
      navigateTo('projects');
      return;
    }
    navigateTo(item.id);
  };

  const renderNavButton = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = currentRoute === item.id;
    const isDisabled = item.requiresProject && !activeProjectId;

    return (
      <button
        key={item.id}
        onClick={() => handleNavClick(item)}
        title={isSidebarCollapsed ? item.label : undefined}
        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-semibold transition-all group relative cursor-pointer ${
          isActive
            ? 'bg-gradient-to-b from-[#1F1930] to-[#171B29] text-[#D7DEED] border border-[#7A1FA2]/60 shadow-xs shadow-black/40 ring-1 ring-[#7A1FA2]/40'
            : isDisabled
            ? 'text-[#5E6985] hover:text-[#5E6985]'
            : 'text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29]'
        }`}
      >
        <Icon
          className={`w-4 h-4 shrink-0 transition-colors ${
            isActive
              ? 'text-[#BA68C8]'
              : isDisabled
              ? 'text-[#5E6985]'
              : 'text-[#8E9AB8] group-hover:text-[#D7DEED]'
          }`}
        />

        {!isSidebarCollapsed && (
          <div className="flex items-center justify-between w-full min-w-0">
            <span className="truncate">{item.label}</span>
            {item.badge && (
              <span
                className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isActive
                    ? 'bg-[#7A1FA2]/30 text-[#D7DEED] border border-[#7A1FA2]/60'
                    : 'bg-[#171B29] text-[#8E9AB8] border border-[#293047]'
                }`}
              >
                {item.badge}
              </span>
            )}
          </div>
        )}

        {/* Active indicator bar */}
        {isActive && (
          <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#7A1FA2] rounded-r shadow-xs shadow-black/40" />
        )}
      </button>
    );
  };

  return (
    <aside
      className={`h-[calc(100vh-2.75rem)] bg-[#131724]/90 backdrop-blur-md border-r border-[#293047] flex flex-col justify-between shrink-0 transition-all duration-200 select-none z-20 font-sans shadow-xl ${
        isSidebarCollapsed ? 'w-13' : 'w-52'
      }`}
    >
      {/* Top Navigation Links */}
      <div className="flex flex-col p-2 gap-1">
        {NAV_ITEMS.map(renderNavButton)}
      </div>

      {/* Middle: Active Document Card */}
      {!isSidebarCollapsed && activeProject && (
        <div className="mx-2 p-2.5 rounded-lg bg-[#171B29] border border-[#293047] flex flex-col gap-1.5 shadow-sm shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase font-bold tracking-wider text-[#8E9AB8] font-mono">
              Working Canvas
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>
          <span className="text-xs font-semibold text-[#D7DEED] truncate">
            {activeProject.title}
          </span>
          <div className="flex items-center justify-between text-[10px] text-[#38BDF8] font-mono">
            <span>{activeProject.width} × {activeProject.height}</span>
            <span className="text-[#8E9AB8]">{activeProject.layerCount}L</span>
          </div>
        </div>
      )}

      {/* Bottom Controls: Memory & Collapse */}
      <div className="flex flex-col p-2 gap-2 border-t border-[#293047] bg-[#0D101A]/80">
        {!isSidebarCollapsed && (
          <div className="px-1 py-0.5 flex flex-col gap-1 text-[11px] text-[#8E9AB8]">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[#8E9AB8] text-[10px] font-mono">
                <HardDrive className="w-3 h-3 text-[#38BDF8]" />
                IndexedDB Cache
              </span>
              <span className="text-[#8E9AB8] font-mono text-[10px]">2.4 / 10 GB</span>
            </div>
            <div className="w-full h-1 bg-[#171B29] rounded-full overflow-hidden border border-[#293047]">
              <div className="h-full bg-[#7A1FA2] rounded-full w-[24%]" />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <button
            onClick={() =>
              addToast({
                type: 'info',
                title: 'Photobashing Hotkeys',
                message:
                  'V: Transform | M: Marquee | L: Lasso | B: Brush | E: Eraser | S: Clone | H: Harmonize | Space: Pan.',
              })
            }
            className="p-1.5 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29] cursor-pointer"
            title="Shortcuts & Workflow"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded text-[#8E9AB8] hover:text-[#D7DEED] hover:bg-[#171B29] cursor-pointer"
            title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
};
