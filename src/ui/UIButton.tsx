/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'icon' | 'destructive' | 'outline';
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface UIButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  shortcut?: string;
}

export const UIButton = forwardRef<HTMLButtonElement, UIButtonProps>(
  (
    {
      children,
      variant = 'secondary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      shortcut,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    // Base studio button
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-all duration-150 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#7A1FA2] disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] cursor-pointer';

    // Size variants
    const sizeStyles: Record<ButtonSize, string> = {
      xs: 'text-xs px-2 py-1 gap-1.5 h-6',
      sm: 'text-xs px-2.5 py-1.5 gap-1.5 h-7.5',
      md: 'text-xs px-3.5 py-2 gap-2 h-9',
      lg: 'text-sm px-4 py-2.5 gap-2.5 h-10.5',
    };

    // Color/Visual variants using Pantone 254 PC purple (#7A1FA2), Graphite, Slate, Silver
    const variantStyles: Record<ButtonVariant, string> = {
      primary:
        'bg-gradient-to-b from-[#8E24AA] to-[#7A1FA2] hover:from-[#9C27B0] hover:to-[#8E24AA] active:from-[#7A1FA2] active:to-[#642083] text-[#D7DEED] font-semibold shadow-md shadow-black/40 border border-[#BA68C8]/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]',
      secondary:
        'bg-[#171B29] hover:bg-[#1E2436] text-[#D7DEED] border border-[#293047] hover:border-[#384363] shadow-xs shadow-[inset_0_1px_0_rgba(215,222,237,0.06)]',
      outline:
        'bg-transparent hover:bg-[#171B29] text-[#D7DEED] border border-[#293047] hover:border-[#384363]',
      ghost:
        'bg-transparent hover:bg-[#171B29] text-[#8E9AB8] hover:text-[#D7DEED]',
      icon:
        'bg-transparent hover:bg-[#171B29] text-[#8E9AB8] hover:text-[#D7DEED] p-1.5 aspect-square border border-transparent hover:border-[#293047]',
      destructive:
        'bg-rose-600/90 hover:bg-rose-600 text-white border border-rose-500/50 shadow-sm shadow-rose-950/40',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
        )}

        {children && <span>{children}</span>}

        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
        )}

        {shortcut && (
          <kbd className="ml-1.5 px-1.5 py-0.5 text-[10px] font-mono tracking-wider bg-black/40 rounded border border-[#293047] text-[#8E9AB8]">
            {shortcut}
          </kbd>
        )}
      </button>
    );
  }
);

UIButton.displayName = 'UIButton';
