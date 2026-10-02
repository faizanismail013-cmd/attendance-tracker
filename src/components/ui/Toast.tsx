import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  description?: string;
}

interface ToastProps {
  toast: ToastMessage | null;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onClose }) => {
  if (!toast) return null;

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600" />,
    info: <Info className="w-5 h-5 text-sky-600" />,
  };

  const bgStyles = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    error: 'border-rose-200 bg-rose-50 text-rose-950',
    info: 'border-sky-200 bg-sky-50 text-sky-950',
  };

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 max-w-sm w-full animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md',
          bgStyles[toast.type]
        )}
      >
        <div className="shrink-0">{icons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{toast.title}</p>
          {toast.description && (
            <p className="text-xs opacity-90 mt-0.5">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="shrink-0 p-1 opacity-60 hover:opacity-100 transition rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
