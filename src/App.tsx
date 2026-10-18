/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShellProvider, useShell } from './shell/ShellContext.tsx';
import { AppShell } from './shell/AppShell.tsx';
import { LandingPage } from './routes/LandingPage.tsx';
import { ProjectsHub } from './routes/ProjectsHub.tsx';
import { StudioWorkspace } from './routes/StudioWorkspace.tsx';
import { AssetsLibrary } from './routes/AssetsLibrary.tsx';
import { GenerationsLog } from './routes/GenerationsLog.tsx';
import { SettingsView } from './routes/SettingsView.tsx';
import { BillingView } from './routes/BillingView.tsx';
import { BriaPocPage } from './routes/BriaPocPage.tsx';
import { ColorLabPage } from './routes/ColorLabPage.tsx';
import { RelightPocPage } from './routes/RelightPocPage.tsx';

const RouteDispatcher: React.FC = () => {
  const { currentRoute } = useShell();

  switch (currentRoute) {
    case 'projects':
      return <ProjectsHub />;
    case 'studio':
      return <StudioWorkspace />;
    case 'color-lab':
      return <ColorLabPage />;
    case 'assets':
      return <AssetsLibrary />;
    case 'generations':
      return <GenerationsLog />;
    case 'settings':
      return <SettingsView />;
    case 'billing':
      return <BillingView />;
    case 'bria-poc':
      return <BriaPocPage />;
    case 'relight-poc':
      return <RelightPocPage />;
    default:
      return <ProjectsHub />;
  }
};

const RootView: React.FC = () => {
  const { currentRoute } = useShell();

  if (currentRoute === 'landing') {
    return <LandingPage />;
  }

  return (
    <AppShell>
      <RouteDispatcher />
    </AppShell>
  );
};

export default function App() {
  return (
    <ShellProvider>
      <RootView />
    </ShellProvider>
  );
}
