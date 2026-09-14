import { ReactNode } from 'react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string | ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDangerous?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Xác nhận',
  cancelText = 'Hủy bỏ',
  isDangerous = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-surface-container-lowest border border-outline-variant/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDangerous ? 'bg-error-container text-on-error-container' : 'bg-primary-fixed text-on-primary-fixed'
            }`}
          >
            <span className="material-symbols-outlined text-2xl">
              {isDangerous ? 'warning' : 'help_outline'}
            </span>
          </div>
          <div>
            <h3 className="font-headline-sm text-on-surface font-semibold">{title}</h3>
            <div className="text-body-md text-on-surface-variant mt-1 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        {children && <div className="pt-2">{children}</div>}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-highest">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-xl text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-5 py-2 text-sm font-semibold rounded-xl text-white transition-all shadow-sm ${
              isDangerous
                ? 'bg-error hover:bg-error/90 active:scale-98'
                : 'bg-primary hover:bg-primary-container active:scale-98'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmModal;
