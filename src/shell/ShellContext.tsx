/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AppRoute,
  ProjectMetadata,
  ToastNotification,
  CanvasPreset,
  UserProfile,
} from '../types/shell.ts';
import {
  createDefaultProjectDocument,
  saveDocument,
} from '../services/DocumentPersistence.ts';

export const DEFAULT_CANVAS_PRESETS: CanvasPreset[] = [
  {
    id: 'cinema-4k',
    name: '4K Cinema DCI',
    category: 'Cinema',
    width: 4096,
    height: 2160,
    aspectRatio: '1.90:1',
    description: 'Industry matte painting and visual effects standard.',
    isPopular: true,
  },
  {
    id: 'concept-16-9',
    name: 'Concept Art 1440p',
    category: 'Digital Art',
    width: 2560,
    height: 1440,
    aspectRatio: '16:9',
    description: 'High-res concept art canvas with ideal viewport balance.',
    isPopular: true,
  },
  {
    id: 'full-hd',
    name: 'Full HD 1080p',
    category: 'Standard',
    width: 1920,
    height: 1080,
    aspectRatio: '16:9',
    description: 'Standard widescreen display format.',
  },
  {
    id: 'square-hero',
    name: 'Square Master 2048',
    category: 'Digital Art',
    width: 2048,
    height: 2048,
    aspectRatio: '1:1',
    description: 'Balanced square composition for character portraits and assets.',
    isPopular: true,
  },
  {
    id: 'ultrawide-epic',
    name: 'Ultrawide Panorama 21:9',
    category: 'Cinema',
    width: 3440,
    height: 1440,
    aspectRatio: '21:9',
    description: 'Epic landscape and sci-fi environment matte plate.',
  },
  {
    id: 'poster-a3',
    name: 'A3 Print Quality (300 DPI)',
    category: 'Standard',
    width: 3508,
    height: 4960,
    aspectRatio: '1:1.41',
    description: 'Print-ready resolution for illustrative key art.',
  },
];

import { SVG_ARTWORKS } from '../utils/artworkThumbnails.ts';

const INITIAL_PROJECTS: ProjectMetadata[] = [
  {
    id: 'proj-cyber-dusk',
    title: 'Neo-Tokyo Overpass Matte',
    description: 'Cyberpunk photobash with neon light bounce and atmospheric fog integration.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80',
    width: 2560,
    height: 1440,
    dpi: 300,
    colorSpace: 'srgb',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastOpenedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    layerCount: 8,
    tags: ['Concept Art', 'Cyberpunk', 'Matte Painting'],
    isFavorite: true,
  },
  {
    id: 'proj-valkyrie-ruins',
    title: 'Nordic Shrine in Mist',
    description: 'Foliage and stone cutouts harmonized with painterly dawn lighting.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80',
    width: 3440,
    height: 1440,
    dpi: 300,
    colorSpace: 'srgb',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    lastOpenedAt: new Date(Date.now() - 86400000 * 1).toISOString(),
    layerCount: 14,
    tags: ['Fantasy', 'Environment', 'Nature'],
  },
  {
    id: 'proj-mech-pilot',
    title: 'Orbital Salvage Mech Pilot',
    description: 'Character cutout photobashed against hard-surface sci-fi hangar interior.',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80',
    width: 2048,
    height: 2048,
    dpi: 300,
    colorSpace: 'srgb',
    createdAt: new Date(Date.now() - 86400000 * 9).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    lastOpenedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    layerCount: 6,
    tags: ['Sci-Fi', 'Character', 'Hard Surface'],
    isFavorite: true,
  },
];

interface ShellContextType {
  currentRoute: AppRoute;
  navigateTo: (route: AppRoute, projectId?: string) => void;
  isSidebarCollapsed: boolean;
  toggleSidebar: () => void;
  activeProjectId: string | null;
  activeProject: ProjectMetadata | null;
  projects: ProjectMetadata[];
  createProject: (
    title: string,
    width: number,
    height: number,
    dpi?: number,
    tags?: string[],
    thumbnailUrl?: string,
    description?: string
  ) => Promise<ProjectMetadata>;
  openProject: (id: string) => void;
  updateProject: (id: string, patch: Partial<ProjectMetadata>) => void;
  duplicateProject: (id: string) => void;
  deleteProject: (id: string) => void;
  toggleFavoriteProject: (id: string) => void;
  toasts: ToastNotification[];
  addToast: (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => void;
  removeToast: (id: string) => void;
  isCommandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  userProfile: UserProfile;
}

const ShellContext = createContext<ShellContextType | undefined>(undefined);

const getRouteFromPath = (path: string): AppRoute => {
  const clean = path.replace(/\/$/, '') || '/';
  if (clean === '/projects') return 'projects';
  if (clean === '/studio') return 'studio';
  if (clean === '/assets') return 'assets';
  if (clean === '/generations') return 'generations';
  if (clean === '/settings') return 'settings';
  if (clean === '/billing') return 'billing';
  if (clean === '/color-lab') return 'color-lab';
  if (clean === '/bria-poc') return 'bria-poc';
  if (clean === '/relight-poc') return 'relight-poc';
  return 'landing';
};

const getPathFromRoute = (route: AppRoute): string => {
  switch (route) {
    case 'landing':
      return '/';
    case 'projects':
      return '/projects';
    case 'studio':
      return '/studio';
    case 'color-lab':
      return '/color-lab';
    case 'assets':
      return '/assets';
    case 'generations':
      return '/generations';
    case 'settings':
      return '/settings';
    case 'billing':
      return '/billing';
    case 'bria-poc':
      return '/bria-poc';
    case 'relight-poc':
      return '/relight-poc';
    default:
      return '/';
  }
};

export const ShellProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(() => {
    try {
      return getRouteFromPath(window.location.pathname);
    } catch {
      return 'landing';
    }
  });

  useEffect(() => {
    const handlePopState = () => {
      try {
        setCurrentRoute(getRouteFromPath(window.location.pathname));
      } catch {
        // Fallback
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('aristo_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const [projects, setProjects] = useState<ProjectMetadata[]>(() => {
    try {
      const stored = localStorage.getItem('aristo_projects_v2');
      if (stored) {
        const parsed: ProjectMetadata[] = JSON.parse(stored);
        // Restore high-quality photographic previews for demo projects
        return parsed.map((p) => {
          if (p.id === 'proj-cyber-dusk') {
            return { ...p, thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&auto=format&fit=crop&q=80' };
          }
          if (p.id === 'proj-valkyrie-ruins') {
            return { ...p, thumbnailUrl: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1200&auto=format&fit=crop&q=80' };
          }
          if (p.id === 'proj-mech-pilot') {
            return { ...p, thumbnailUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=1200&auto=format&fit=crop&q=80' };
          }
          if (p.thumbnailUrl?.startsWith('blob:')) {
            return { ...p, thumbnailUrl: undefined };
          }
          return p;
        });
      }
    } catch {
      // Fallback
    }
    return INITIAL_PROJECTS;
  });

  const [activeProjectId, setActiveProjectId] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem('aristo_active_project_id');
      if (stored) return stored;
    } catch {}
    return null;
  });

  useEffect(() => {
    try {
      if (activeProjectId) {
        localStorage.setItem('aristo_active_project_id', activeProjectId);
      } else {
        localStorage.removeItem('aristo_active_project_id');
      }
    } catch {}
  }, [activeProjectId]);
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const [isCommandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const [userProfile] = useState<UserProfile>({
    name: 'Nataliya Sergienko',
    email: 'sergienkonataliya6@gmail.com',
    activePlan: 'pro',
    aiCreditsRemaining: 180,
  });

  useEffect(() => {
    try {
      localStorage.setItem('aristo_projects_v2', JSON.stringify(projects));
    } catch {
      try {
        const lean = projects.map((p) =>
          p.thumbnailUrl && p.thumbnailUrl.length > 500
            ? { ...p, thumbnailUrl: undefined }
            : p
        );
        localStorage.setItem('aristo_projects_v2', JSON.stringify(lean));
      } catch {}
    }
  }, [projects]);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('aristo_sidebar_collapsed', String(next));
      } catch {
        // LocalStorage fallback
      }
      return next;
    });
  };

  const addToast = (toast: Omit<ToastNotification, 'id' | 'timestamp'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newToast: ToastNotification = {
      ...toast,
      id,
      timestamp: Date.now(),
      durationMs: toast.durationMs || 4000,
    };

    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, newToast.durationMs);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const navigateTo = (route: AppRoute, projectId?: string) => {
    if (projectId) {
      setActiveProjectId(projectId);
    }
    setCurrentRoute(route);
    try {
      const targetPath = getPathFromRoute(route);
      if (window.location.pathname !== targetPath) {
        window.history.pushState({ route, projectId }, '', targetPath);
      }
    } catch {
      // History fallback
    }
  };

  const openProject = (id: string) => {
    const proj = projects.find((p) => p.id === id);
    if (proj) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, lastOpenedAt: new Date().toISOString() } : p
        )
      );
      setActiveProjectId(id);
      navigateTo('studio', id);
      addToast({
        type: 'info',
        title: 'Project Opened',
        message: `Opened "${proj.title}" in Studio (${proj.width} × ${proj.height} px)`,
      });
    }
  };

  const updateProject = (id: string, patch: Partial<ProjectMetadata>) => {
    setProjects((prev) => {
      const next = prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p
      );
      try {
        localStorage.setItem('aristo_projects_v2', JSON.stringify(next));
      } catch (err) {
        try {
          const lean = next.map((p) =>
            p.thumbnailUrl && p.thumbnailUrl.length > 500
              ? { ...p, thumbnailUrl: undefined }
              : p
          );
          localStorage.setItem('aristo_projects_v2', JSON.stringify(lean));
        } catch {
          console.warn('[ShellContext] Storage sync error:', err);
        }
      }
      return next;
    });
  };

  const createProject = async (
    title: string,
    width: number,
    height: number,
    dpi = 300,
    tags: string[] = [],
    thumbnailUrl?: string,
    description?: string
  ): Promise<ProjectMetadata> => {
    const newProj: ProjectMetadata = {
      id: `proj-${Date.now()}`,
      title: title.trim() || 'Untitled Photobash',
      description: description || 'New non-destructive photobashing composition.',
      thumbnailUrl,
      width,
      height,
      dpi,
      colorSpace: 'srgb',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
      layerCount: 1,
      tags: tags.length ? tags : ['Concept Art'],
    };

    try {
      const doc = createDefaultProjectDocument(newProj);
      if (doc.id !== newProj.id) {
        throw new Error(`Document ID mismatch: expected "${newProj.id}", got "${doc.id}"`);
      }

      await saveDocument(doc);

      setProjects((prev) => [newProj, ...prev]);
      setActiveProjectId(newProj.id);
      navigateTo('studio', newProj.id);
      addToast({
        type: 'success',
        title: 'Canvas Created',
        message: `Created canvas "${newProj.title}" (${width} × ${height} px)`,
      });

      return newProj;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addToast({
        type: 'error',
        title: 'Project Creation Failed',
        message: `Failed to persist project document to IndexedDB: ${errorMsg}`,
      });
      throw error;
    }
  };

  const duplicateProject = (id: string) => {
    const original = projects.find((p) => p.id === id);
    if (!original) return;

    const copy: ProjectMetadata = {
      ...original,
      id: `proj-${Date.now()}`,
      title: `${original.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastOpenedAt: new Date().toISOString(),
    };

    setProjects((prev) => [copy, ...prev]);
    addToast({
      type: 'info',
      title: 'Project Duplicated',
      message: `Created duplicate "${copy.title}"`,
    });
  };

  const deleteProject = (id: string) => {
    const toDelete = projects.find((p) => p.id === id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
      setCurrentRoute('projects');
    }
    if (toDelete) {
      addToast({
        type: 'warning',
        title: 'Project Removed',
        message: `"${toDelete.title}" was moved to trash.`,
      });
    }
  };

  const toggleFavoriteProject = (id: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
      )
    );
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <ShellContext.Provider
      value={{
        currentRoute,
        navigateTo,
        isSidebarCollapsed,
        toggleSidebar,
        activeProjectId,
        activeProject,
        projects,
        createProject,
        openProject,
        updateProject,
        duplicateProject,
        deleteProject,
        toggleFavoriteProject,
        toasts,
        addToast,
        removeToast,
        isCommandPaletteOpen,
        setCommandPaletteOpen,
        userProfile,
      }}
    >
      {children}
    </ShellContext.Provider>
  );
};

export const useShell = () => {
  const context = useContext(ShellContext);
  if (!context) {
    throw new Error('useShell must be used within a ShellProvider');
  }
  return context;
};
