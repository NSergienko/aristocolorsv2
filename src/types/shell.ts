/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppRoute =
  | 'landing'
  | 'projects'
  | 'studio'
  | 'color-lab'
  | 'assets'
  | 'generations'
  | 'settings'
  | 'billing'
  | 'bria-poc'
  | 'relight-poc';

export interface CanvasPreset {
  id: string;
  name: string;
  category: 'Standard' | 'Digital Art' | 'Cinema' | 'Social';
  width: number;
  height: number;
  aspectRatio: string;
  description: string;
  isPopular?: boolean;
}

export interface ProjectMetadata {
  id: string;
  title: string;
  description?: string;
  width: number;
  height: number;
  dpi: number;
  colorSpace: 'srgb' | 'display-p3';
  createdAt: string;
  updatedAt: string;
  lastOpenedAt: string;
  thumbnailUrl?: string;
  layerCount: number;
  tags: string[];
  isFavorite?: boolean;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface ToastNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  durationMs?: number;
  timestamp: number;
}

export type AssetCategory = 'cutout' | 'texture' | 'background' | 'reference';

export interface AssetRecord {
  id: string;
  title: string;
  category: AssetCategory;
  url: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  format: 'png' | 'webp' | 'jpeg' | 'svg';
  createdAt: string;
  tags: string[];
}

export interface GenerationAuditRecord {
  id: string;
  projectId: string;
  projectTitle: string;
  timestamp: string;
  prompt: string;
  sourceLayerName: string;
  styleSource: 'background' | 'reference' | 'preset';
  presetName?: string;
  status: 'completed' | 'processing' | 'failed';
  beforePreviewUrl: string;
  afterPreviewUrl: string;
  durationSeconds: number;
}

export interface BillingPlan {
  id: 'starter' | 'pro' | 'studio';
  name: string;
  priceUah: number;
  priceUsd: number;
  period: 'month' | 'year';
  description: string;
  features: string[];
  isPopular?: boolean;
  limits: {
    maxResolution: string;
    aiHarmonizationsPerMonth: number;
    cloudStorageGb: number;
    unlimitedLayers: boolean;
  };
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl?: string;
  activePlan: 'starter' | 'pro' | 'studio';
  aiCreditsRemaining: number;
}
