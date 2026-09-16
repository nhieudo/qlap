import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PWAInstallModal({ isOpen, onClose }: PWAInstallModalProps) {
  const { isInstalled, isIOS, isAndroid, hasNativePrompt, install, platform } = usePWAInstall();
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [activeGuideTab, setActiveGuideTab] = useState<'auto' | 'ios' | 'android' | 'desktop'>('auto');
  const [installing, setInstalling] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Generate QR code for the current URL so users can scan from desktop to install on mobile
  useEffect(() => {
    if (isOpen) {
      const currentUrl = window.location.origin + window.location.pathname;
      QRCode.toDataURL(currentUrl, {
        width: 220,
        margin: 1.5,
        color: {
          dark: '#760009',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error generating install QR:', err));

      // Auto pick guide tab
      if (isIOS) {
        setActiveGuideTab('ios');
      } else if (isAndroid) {
        setActiveGuideTab('android');
      } else {
        setActiveGuideTab('auto');
      }
    }
  }, [isOpen, isIOS, isAndroid]);

  if (!isOpen) return null;

  const handleTriggerInstall = async () => {
    setInstalling(true);
    setFeedbackMsg(null);
    try {
      const outcome = await install();
      if (outcome === 'accepted') {
        setFeedbackMsg('Đã chấp nhận cài đặt! Ứng dụng đang được thêm vào màn hình chính.');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else if (outcome === 'dismissed') {
        setFeedbackMsg('Bạn đã đóng thông báo cài đặt. Bạn có thể cài đặt lại bất kỳ lúc nào.');
      } else {
        // Switch to guide
        if (isIOS) {
          setActiveGuideTab('ios');
        } else if (isAndroid) {
          setActiveGuideTab('android');
        } else {
          setActiveGuideTab('desktop');
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setInstalling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-primary-container p-5 text-on-primary flex items-start justify-between relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 opacity-15 pointer-events-none">
            <span className="material-symbols-outlined text-[140px]">install_mobile</span>
          </div>

          <div className="flex items-center gap-3.5 z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/30 flex items-center justify-center shrink-0 shadow-md">
              <img src="/icon.svg" alt="App Logo" className="w-9 h-9" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white leading-tight">Cài Đặt Ứng Dụng PWA</h3>
                <span className="px-2 py-0.5 rounded-full bg-amber-400 text-amber-950 font-bold text-[10px] tracking-wide uppercase">
                  Mọi Thiết Bị
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5 font-medium">
                Quản Lý Ấp • Dùng mượt như ứng dụng gốc không cần tải từ kho ứng dụng
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10 cursor-pointer"
            aria-label="Đóng"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Status banner if already installed */}
          {isInstalled && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-600 text-2xl shrink-0">
                check_circle
              </span>
              <div>
                <p className="text-xs font-bold">Ứng dụng đã được cài đặt trên thiết bị này!</p>
                <p className="text-[11px] text-emerald-700 mt-0.5">
                  Bạn có thể mở ứng dụng trực tiếp từ biểu tượng ngoài màn hình chính (Home Screen) để có trải nghiệm tốt nhất.
                </p>
              </div>
            </div>
          )}

          {/* Quick 1-Click Install Button if Native Prompt is Available */}
          {hasNativePrompt && !isInstalled && (
            <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
              <div className="flex items-center gap-2 text-primary font-bold text-sm">
                <span className="material-symbols-outlined text-lg">touch_app</span>
                <span>Cài đặt nhanh 1 chạm</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Trình duyệt hỗ trợ cài đặt trực tiếp. Nhấn nút bên dưới để thêm ứng dụng vào màn hình điện thoại hoặc máy tính ngay lập tức.
              </p>
              <button
                type="button"
                id="btn-trigger-pwa-install"
                onClick={handleTriggerInstall}
                disabled={installing}
                className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.99] cursor-pointer"
              >
                <span className="material-symbols-outlined text-xl">download</span>
                <span>{installing ? 'Đang kích hoạt...' : 'Cài Đặt Lên Thiết Bị Ngay'}</span>
              </button>
            </div>
          )}

          {feedbackMsg && (
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium">
              {feedbackMsg}
            </div>
          )}

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-surface-container border border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-xl">bolt</span>
              <div className="font-bold text-[11px] text-on-surface mt-1">Mở cực nhanh</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">Lưu đệm sẵn, tiết kiệm 4G</div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container border border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-xl">fullscreen</span>
              <div className="font-bold text-[11px] text-on-surface mt-1">Toàn màn hình</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">Ẩn thanh URL vướng víu</div>
            </div>
            <div className="p-2.5 rounded-xl bg-surface-container border border-surface-container-high">
              <span className="material-symbols-outlined text-primary text-xl">offline_pin</span>
              <div className="font-bold text-[11px] text-on-surface mt-1">Đi cơ sở tiện lợi</div>
              <div className="text-[10px] text-on-surface-variant mt-0.5">Dữ liệu ổn định, an toàn</div>
            </div>
          </div>

          {/* Platform Tab Navigation */}
          <div className="pt-2">
            <div className="text-xs font-bold text-on-surface mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base text-primary">help_outline</span>
              <span>Hướng dẫn chi tiết theo từng loại thiết bị:</span>
            </div>

            <div className="flex rounded-xl bg-surface-container p-1 gap-1">
              <button
                type="button"
                onClick={() => setActiveGuideTab('ios')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeGuideTab === 'ios'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">phone_iphone</span>
                <span>iPhone / iPad</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('android')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeGuideTab === 'android'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">android</span>
                <span>Android</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveGuideTab('desktop')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeGuideTab === 'desktop' || activeGuideTab === 'auto'
                    ? 'bg-surface-container-lowest text-primary shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">laptop</span>
                <span>Máy tính / PC</span>
              </button>
            </div>
          </div>

          {/* Guide Content: iOS Safari */}
          {activeGuideTab === 'ios' && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-amber-950 text-xs uppercase tracking-wide">
                <span className="material-symbols-outlined text-base text-amber-700">apple</span>
                <span>Cách cài đặt trên iPhone / iPad (Safari)</span>
              </div>
              <ol className="text-xs text-amber-950 space-y-2.5 list-decimal list-inside">
                <li className="leading-relaxed">
                  Mở liên kết này bằng trình duyệt <strong>Safari</strong> trên iPhone/iPad.
                </li>
                <li className="leading-relaxed">
                  Nhấp vào biểu tượng <strong>Chia sẻ (Share)</strong>{' '}
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-200 font-bold text-amber-900 mx-1">
                    <span className="material-symbols-outlined text-sm inline align-middle">ios_share</span>
                  </span>{' '}
                  ở thanh công cụ phía dưới màn hình (hoặc góc trên iPad).
                </li>
                <li className="leading-relaxed">
                  Cuộn xuống và chọn mục <strong>"Thêm vào Màn hình chính" (Add to Home Screen)</strong>{' '}
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-amber-200 font-bold text-amber-900 mx-1">
                    <span className="material-symbols-outlined text-sm inline align-middle">add_box</span>
                  </span>.
                </li>
                <li className="leading-relaxed">
                  Nhấn nút <strong>"Thêm" (Add)</strong> ở góc phải trên cùng. Biểu tượng ứng dụng sẽ xuất hiện ngay trên màn hình chính của bạn!
                </li>
              </ol>
            </div>
          )}

          {/* Guide Content: Android */}
          {activeGuideTab === 'android' && (
            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-3 animate-in fade-in">
              <div className="flex items-center gap-2 font-bold text-emerald-950 text-xs uppercase tracking-wide">
                <span className="material-symbols-outlined text-base text-emerald-700">smartphone</span>
                <span>Cách cài đặt trên điện thoại Android (Chrome, Cốc Cốc, Samsung Internet)</span>
              </div>
              <ol className="text-xs text-emerald-950 space-y-2.5 list-decimal list-inside">
                <li className="leading-relaxed">
                  Nếu có thông báo <strong>"Thêm vào Màn hình chính"</strong> ở đáy màn hình, chạm vào để cài đặt ngay.
                </li>
                <li className="leading-relaxed">
                  Hoặc chạm vào biểu tượng <strong>3 dấu chấm (⋮)</strong> ở góc trên bên phải trình duyệt Chrome.
                </li>
                <li className="leading-relaxed">
                  Chọn dòng <strong>"Cài đặt ứng dụng"</strong> hoặc <strong>"Thêm vào Màn hình chính"</strong>.
                </li>
                <li className="leading-relaxed">
                  Xác nhận <strong>"Cài đặt"</strong>. Biểu tượng ứng dụng Quản Lý Ấp sẽ xuất hiện trên màn hình điện thoại như ứng dụng CH Play.
                </li>
              </ol>
            </div>
          )}

          {/* Guide Content: Desktop & QR Code Scan */}
          {(activeGuideTab === 'desktop' || activeGuideTab === 'auto') && (
            <div className="p-4 rounded-2xl bg-surface-container border border-surface-container-high space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-on-surface text-xs uppercase tracking-wide">
                  <span className="material-symbols-outlined text-base text-primary">computer</span>
                  <span>Cài trên máy tính & Quét mã QR cho điện thoại</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                {/* Desktop instructions */}
                <div className="text-xs text-on-surface-variant space-y-2">
                  <p className="font-semibold text-on-surface">Trên máy tính (Chrome / Edge):</p>
                  <p className="leading-relaxed">
                    Nhìn vào <strong>thanh địa chỉ (URL bar)</strong> ở góc trên cùng bên phải, nhấp vào biểu tượng{' '}
                    <strong className="text-primary font-bold">Cài đặt (⊕ hoặc biểu tượng máy tính)</strong> để cài ứng dụng lên máy tính bàn/laptop.
                  </p>
                  <div className="p-2 rounded-lg bg-surface-container-lowest border border-surface-container-high text-[11px]">
                    💡 Ứng dụng sẽ có cửa sổ riêng biệt, mở trực tiếp từ Desktop/Taskbar.
                  </div>
                </div>

                {/* QR Code for Mobile */}
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xs">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QR Code cài đặt trên điện thoại"
                      className="w-32 h-32 rounded-lg"
                    />
                  ) : (
                    <div className="w-32 h-32 flex items-center justify-center bg-slate-100 rounded-lg">
                      <span className="material-symbols-outlined text-2xl animate-spin text-primary">
                        sync
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] font-bold text-primary mt-2 text-center">
                    Quét camera điện thoại
                  </p>
                  <p className="text-[10px] text-on-surface-variant text-center">
                    Để mở & cài đặt ngay trên điện thoại
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-surface-container-high bg-surface-container flex items-center justify-between">
          <div className="text-[11px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
            <span>Tiêu chuẩn PWA (Progressive Web App)</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-surface-container-highest hover:bg-outline-variant/30 text-on-surface font-semibold text-xs transition-colors cursor-pointer"
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
}
