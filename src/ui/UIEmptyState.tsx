/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { UIButton } from './UIButton.tsx';

export interface UIEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: React.ReactNode;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  className?: string;
}

export const UIEmptyState: React.FC<UIEmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  secondaryActionLabel,
  onSecondaryAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto select-none ${className}`}
    >
      <div className="w-12 h-12 rounded-xl bg-[#191c24] border border-[#2e3648] flex items-center justify-center text-zinc-400 mb-4 shadow-inner">
        {icon}
      </div>

      <h3 className="text-sm font-semibold text-zinc-200 mb-1.5">{title}</h3>

      <p className="text-xs text-zinc-400 mb-6 leading-relaxed max-w-xs">{description}</p>

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-3">
          {actionLabel && onAction && (
            <UIButton
              variant="primary"
              size="sm"
              leftIcon={actionIcon}
              onClick={onAction}
            >
              {actionLabel}
            </UIButton>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <UIButton
              variant="secondary"
              size="sm"
              onClick={onSecondaryAction}
            >
              {secondaryActionLabel}
            </UIButton>
          )}
        </div>
      )}
    </div>
  );
};
