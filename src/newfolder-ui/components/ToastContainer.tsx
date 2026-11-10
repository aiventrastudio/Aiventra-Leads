import React from 'react';
import { useThemeStyle } from '../context/ThemeStyleContext.tsx';
import { CheckCircle2, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useThemeStyle();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl bg-slate-900/95 text-white shadow-2xl backdrop-blur-md border border-white/10 animate-in slide-in-from-bottom-3 duration-200"
        >
          {toast.type === 'success' ? (
            <div className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          ) : (
            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400 shrink-0">
              <Info className="w-4 h-4" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold">{toast.title}</div>
            <div className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">{toast.message}</div>
          </div>

          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-400 hover:text-white transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
