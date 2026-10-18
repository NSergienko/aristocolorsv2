/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { forwardRef } from 'react';
import { X } from 'lucide-react';

export interface UIInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  prefixIcon?: React.ReactNode;
  suffix?: React.ReactNode;
  onClear?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const UIInput = forwardRef<HTMLInputElement, UIInputProps>(
  (
    {
      label,
      error,
      prefixIcon,
      suffix,
      onClear,
      size = 'md',
      value,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: 'h-7.5 text-xs px-2.5',
      md: 'h-9 text-xs px-3',
      lg: 'h-10 text-sm px-3.5',
    };

    const hasValue = value !== undefined && value !== '';

    return (
      <div className="flex flex-col gap-1 w-full">
        {label && (
          <label className="text-xs font-semibold text-[#D7DEED] select-none flex justify-between">
            <span>{label}</span>
          </label>
        )}

        <div className="relative flex items-center w-full">
          {prefixIcon && (
            <div className="absolute left-2.5 flex items-center pointer-events-none text-[#8E9AB8]">
              {prefixIcon}
            </div>
          )}

          <input
            ref={ref}
            value={value}
            disabled={disabled}
            className={`w-full rounded-md bg-[#131724] border text-[#D7DEED] placeholder-[#5E6985]
              transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-[#7A1FA2] focus:border-[#7A1FA2]
              disabled:opacity-40 disabled:cursor-not-allowed
              ${error ? 'border-rose-500/70 focus:border-rose-500' : 'border-[#293047]'}
              ${prefixIcon ? 'pl-8' : ''}
              ${hasValue && onClear ? 'pr-8' : suffix ? 'pr-8' : ''}
              ${sizeStyles[size]}
              ${className}
            `}
            {...props}
          />

          {hasValue && onClear && !disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute right-2 text-[#8E9AB8] hover:text-[#D7DEED] p-0.5 rounded cursor-pointer transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {!hasValue && suffix && (
            <div className="absolute right-2.5 flex items-center pointer-events-none text-[#5E6985] text-xs">
              {suffix}
            </div>
          )}
        </div>

        {error && <span className="text-[11px] text-rose-400 mt-0.5">{error}</span>}
      </div>
    );
  }
);

UIInput.displayName = 'UIInput';
