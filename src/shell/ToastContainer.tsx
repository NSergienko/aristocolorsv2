/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useShell } from './ShellContext.tsx';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import { NotificationType } from '../types/shell.ts';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useShell();

  if (toasts.length === 0) return null;

  const iconMap: Record<NotificationType, React.ReactNode> = {
    info: <Info className="w-4 h-4 text-cyan-400" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-400" />,
    error: <AlertCircle className="w-4 h-4 text-rose-400" />,
  };

  const borderMap: Record<NotificationType, string> = {
    info: 'border-cyan-500/30',
    success: 'border-emerald-500/30',
    warning: 'border-amber-500/30',
    error: 'border-rose-500/30',
  };

  return (
    <div className="fixed bottom-9 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none select-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`pointer-events-auto flex items-start gap-3 p-3 rounded-lg bg-[#12141a]/95 backdrop-blur-md border ${
            borderMap[toast.type]
          } shadow-xl shadow-black/50 text-zinc-200 animate-in slide-in-from-right-5 fade-in duration-150`}
        >
          <div className="shrink-0 mt-0.5">{iconMap[toast.type]}</div>
          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-semibold text-zinc-100">{toast.title}</h4>
            {toast.message && (
              <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                {toast.message}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-zinc-500 hover:text-zinc-200 p-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
