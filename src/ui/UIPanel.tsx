/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface UIPanelProps {
  title: string;
  badge?: string | number;
  actions?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  className?: string;
}

export const UIPanel: React.FC<UIPanelProps> = ({
  title,
  badge,
  actions,
  children,
  collapsible = true,
  defaultExpanded = true,
  className = '',
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`border-b border-[#1f2430] bg-[#12141a] ${className}`}>
      <div
        className="flex items-center justify-between px-3 py-2 select-none hover:bg-[#161822]/80 transition-colors cursor-pointer"
        onClick={() => collapsible && setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {collapsible && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 ${
                isExpanded ? '' : '-rotate-90'
              }`}
            />
          )}
          <span className="text-[11px] font-semibold tracking-wider text-zinc-300 uppercase">
            {title}
          </span>
          {badge !== undefined && (
            <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-[#1f2430] text-zinc-400">
              {badge}
            </span>
          )}
        </div>

        {actions && (
          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>

      {isExpanded && <div className="p-3 bg-[#12141a]">{children}</div>}
    </div>
  );
};
