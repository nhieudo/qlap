import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';

interface PWAInstallButtonProps {
  variant?: 'header' | 'compact' | 'card' | 'badge' | 'floating';
  className?: string;
}

export function PWAInstallButton({ variant = 'header', className = '' }: PWAInstallButtonProps) {
  const { isInstalled, hasNativePrompt, install, isIOS } = usePWAInstall();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [installing, setInstalling] = useState(false);

  const handleClick = async () => {
    // If native prompt is available, try direct prompt first
    if (hasNativePrompt) {
      setInstalling(true);
      try {
        const result = await install();
        if (result === 'manual-guide') {
          setIsModalOpen(true);
        }
      } catch {
        setIsModalOpen(true);
      } finally {
        setInstalling(false);
      }
    } else {
      // For iOS or browsers without native prompt event, show guided modal
      setIsModalOpen(true);
    }
  };

  // If already running in standalone mode, show clean installed indicator or return null based on variant
  if (isInstalled) {
    if (variant === 'badge' || variant === 'card') {
      return (
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold ${className}`}>
          <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
          <span>Đã cài đặt ứng dụng</span>
        </div>
      );
    }
    return null;
  }

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          id="btn-header-install-pwa"
          onClick={handleClick}
          disabled={installing}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 text-primary border border-primary/20 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs ${className}`}
          title="Cài đặt ứng dụng Quản Lý Ấp lên điện thoại hoặc máy tính"
        >
          <span className="material-symbols-outlined text-base animate-bounce">install_mobile</span>
          <span className="hidden sm:inline">Cài Đặt App</span>
          <span className="sm:hidden">Cài App</span>
        </button>
      )}

      {variant === 'compact' && (
        <button
          type="button"
          id="btn-compact-install-pwa"
          onClick={handleClick}
          disabled={installing}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-900 border border-amber-400/40 text-[11px] font-bold transition-all cursor-pointer ${className}`}
          title="Cài đặt PWA lên màn hình chính"
        >
          <span className="material-symbols-outlined text-sm">download_for_offline</span>
          <span>{isIOS ? 'Cài lên iPhone' : 'Cài App'}</span>
        </button>
      )}

      {variant === 'card' && (
        <div className={`p-4 rounded-2xl bg-gradient-to-r from-primary/5 via-amber-500/5 to-primary/5 border border-primary/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-xl text-amber-300">install_mobile</span>
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                <span>Cài Đặt Ứng Dụng Quản Lý Ấp</span>
                <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[10px] font-bold">PWA</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Cài lên điện thoại (Android, iPhone) hoặc máy tính để mở nhanh và dùng ổn định mọi lúc.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClick}
            disabled={installing}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>{installing ? 'Đang xử lý...' : 'Cài Đặt Ngay'}</span>
          </button>
        </div>
      )}

      {variant === 'floating' && (
        <button
          type="button"
          onClick={handleClick}
          className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-primary text-on-primary font-bold text-xs shadow-lg ring-2 ring-white/50 hover:bg-primary-container transition-all active:scale-95 md:hidden animate-pulse cursor-pointer ${className}`}
        >
          <span className="material-symbols-outlined text-lg text-amber-300">install_mobile</span>
          <span>Cài App PWA</span>
        </button>
      )}

      <PWAInstallModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
