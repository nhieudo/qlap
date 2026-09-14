import React, { useEffect } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: () => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 4500);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const bgStyles = {
    success: 'bg-emerald-800 text-white border-emerald-600',
    error: 'bg-red-800 text-white border-red-600',
    warning: 'bg-amber-800 text-white border-amber-600',
    info: 'bg-slate-800 text-white border-slate-600',
  }[toast.type];

  const iconName = {
    success: 'check_circle',
    error: 'error',
    warning: 'warning',
    info: 'info',
  }[toast.type];

  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-xl border ${bgStyles} transition-all duration-300 animate-in fade-in slide-in-from-top-4`}
    >
      <span className="material-symbols-outlined text-xl shrink-0 mt-0.5">{iconName}</span>
      <div className="flex-1">
        <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
        {toast.message && <p className="text-xs opacity-90 mt-1 leading-normal">{toast.message}</p>}
      </div>
      <button
        onClick={onDismiss}
        className="text-white/80 hover:text-white p-1 rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined text-sm">close</span>
      </button>
    </div>
  );
}
