/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { UIButton } from './UIButton.tsx';

export interface UIModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';
}

export const UIModal: React.FC<UIModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full ${maxWidthClasses[maxWidth]} bg-[#171B29] border border-[#293047] rounded-xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col max-h-[90vh] shadow-[inset_0_1px_0_rgba(215,222,237,0.1)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#293047] bg-[#131724]/90 backdrop-blur-xs">
          <div>
            <h3 className="text-sm font-bold text-[#D7DEED]">{title}</h3>
            {subtitle && <p className="text-xs text-[#8E9AB8] mt-0.5">{subtitle}</p>}
          </div>

          <UIButton
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-[#8E9AB8] hover:text-[#D7DEED] p-1 rounded-md"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </UIButton>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 text-[#D7DEED]">{children}</div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-[#293047] bg-[#131724]/90 backdrop-blur-xs flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
