/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  FolderOpen,
  Palette,
  Layers,
  History,
  Settings,
  CreditCard,
  Plus,
  Download,
  X,
  Scissors,
  Sparkles,
  SunMedium,
} from 'lucide-react';
import { useShell } from './ShellContext.tsx';

interface CommandItem {
  id: string;
  category: 'Navigation' | 'Projects' | 'Actions';
  title: string;
  subtitle?: string;
  shortcut?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    navigateTo,
    projects,
    openProject,
    addToast,
  } = useShell();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!isCommandPaletteOpen);
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, setCommandPaletteOpen]);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const baseCommands: CommandItem[] = [
    {
      id: 'nav-projects',
      category: 'Navigation',
      title: 'Go to Projects Hub',
      subtitle: 'View, create, and manage all photobashing projects',
      shortcut: 'G P',
      icon: FolderOpen,
      action: () => {
        navigateTo('projects');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-studio',
      category: 'Navigation',
      title: 'Open Studio Canvas',
      subtitle: 'Switch to active non-destructive photobash canvas',
      shortcut: 'G S',
      icon: Palette,
      action: () => {
        navigateTo('studio');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-assets',
      category: 'Navigation',
      title: 'Open Assets Library',
      subtitle: 'Browse cutouts, backgrounds, and reference boards',
      shortcut: 'G A',
      icon: Layers,
      action: () => {
        navigateTo('assets');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-generations',
      category: 'Navigation',
      title: 'Open Generations Log',
      subtitle: 'View history of style harmonizations',
      shortcut: 'G H',
      icon: History,
      action: () => {
        navigateTo('generations');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-billing',
      category: 'Navigation',
      title: 'View Plans & WayForPay Billing',
      subtitle: 'Manage subscription and compute balance',
      icon: CreditCard,
      action: () => {
        navigateTo('billing');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-settings',
      category: 'Navigation',
      title: 'Studio Preferences',
      subtitle: 'Configure keymaps, display, and engine settings',
      icon: Settings,
      action: () => {
        navigateTo('settings');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-cutout-lab',
      category: 'Navigation',
      title: 'Open Cutout Lab',
      subtitle: 'Background removal and alpha channel inspection',
      icon: Scissors,
      action: () => {
        navigateTo('bria-poc');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-color-lab',
      category: 'Navigation',
      title: 'Open Color Lab',
      subtitle: 'Cinematic color correction, lighting & RGB curves grading',
      icon: Sparkles,
      action: () => {
        navigateTo('color-lab');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'nav-relight-poc',
      category: 'Navigation',
      title: 'Open Relight POC',
      subtitle: 'Isolated lighting & relighting test using fal.ai IC-Light V2',
      icon: SunMedium,
      action: () => {
        navigateTo('relight-poc');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-new',
      category: 'Actions',
      title: 'Create New Canvas',
      subtitle: 'Initialize canvas with preset resolution',
      shortcut: 'Ctrl+N',
      icon: Plus,
      action: () => {
        navigateTo('projects');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'act-export',
      category: 'Actions',
      title: 'Export Layered Canvas',
      subtitle: 'High-res PNG, JPEG or layered .aristo archive',
      shortcut: 'Ctrl+E',
      icon: Download,
      action: () => {
        addToast({
          type: 'info',
          title: 'Export Triggered',
          message: 'Exporting composition at full native resolution.',
        });
        setCommandPaletteOpen(false);
      },
    },
  ];

  const projectCommands: CommandItem[] = projects.map((p) => ({
    id: `proj-${p.id}`,
    category: 'Projects',
    title: p.title,
    subtitle: `${p.width} × ${p.height} px • ${p.layerCount} Layers • ${p.tags.join(', ')}`,
    icon: FolderOpen,
    action: () => {
      openProject(p.id);
      setCommandPaletteOpen(false);
    },
  }));

  const allCommands = [...baseCommands, ...projectCommands];

  const filteredCommands = allCommands.filter((cmd) => {
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredCommands.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCommands.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-100">
      <div
        className="fixed inset-0"
        onClick={() => setCommandPaletteOpen(false)}
      />

      <div className="relative z-10 w-full max-w-xl bg-[#171B29] border border-[#293047] rounded-xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col shadow-[inset_0_1px_0_rgba(215,222,237,0.1)]">
        {/* Search header */}
        <div className="flex items-center px-4 py-3 border-b border-[#293047] bg-[#131724]/90">
          <Search className="w-4 h-4 text-[#8E9AB8] mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, tool, or project name..."
            className="w-full bg-transparent border-none text-xs text-[#D7DEED] placeholder-[#5E6985] focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#8E9AB8] hover:text-[#D7DEED] p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <kbd className="ml-2 px-1.5 py-0.5 text-[9px] font-mono bg-black/50 border border-[#293047] rounded text-[#8E9AB8]">
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto p-2 flex flex-col gap-1">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#5E6985]">
              No matching commands or projects found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#1F1930] to-[#171B29] border border-[#7A1FA2]/60 text-[#D7DEED] shadow-xs ring-1 ring-[#7A1FA2]/40'
                      : 'text-[#8E9AB8] hover:bg-[#1E2436] hover:text-[#D7DEED]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-1.5 rounded-md ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] text-[#D7DEED] border border-[#BA68C8]/30'
                          : 'bg-[#131724] text-[#8E9AB8]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate text-[#D7DEED]">
                        {cmd.title}
                      </span>
                      {cmd.subtitle && (
                        <span className="text-[11px] text-[#8E9AB8] truncate">
                          {cmd.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[9px] uppercase font-mono text-[#38BDF8] px-1.5 py-0.5 rounded bg-[#131724] border border-[#293047]">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-black/50 border border-[#293047] rounded text-[#8E9AB8]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-[#293047] bg-[#131724]/90 flex items-center justify-between text-[11px] text-[#5E6985] font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>ESC Close</span>
          </div>
          <span className="text-[#8E9AB8]">AristoColors Studio v2.0</span>
        </div>
      </div>
    </div>
  );
};
