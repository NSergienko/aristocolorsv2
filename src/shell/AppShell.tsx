/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppHeader } from './AppHeader.tsx';
import { AppSidebar } from './AppSidebar.tsx';
import { AppStatusBar } from './AppStatusBar.tsx';
import { CommandPalette } from './CommandPalette.tsx';
import { ToastContainer } from './ToastContainer.tsx';

export interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-[#0D101A] text-[#D7DEED] select-none">
      {/* 1. Global Application Header */}
      <AppHeader />

      {/* 2. Workspace Body (Sidebar + Active Viewport) */}
      <div className="flex flex-1 w-full min-h-0 overflow-hidden relative">
        <AppSidebar />
        <main className="flex-1 h-full min-h-0 overflow-hidden relative bg-[#0D101A]">
          {children}
        </main>
      </div>

      {/* 3. Global Status Bar */}
      <AppStatusBar />

      {/* 4. Global Modals & Notifications */}
      <CommandPalette />
      <ToastContainer />
    </div>
  );
};
