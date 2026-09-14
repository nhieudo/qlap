import { useState, FormEvent } from 'react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifyCode: (code: string) => void;
}

export function QRScannerModal({ isOpen, onClose, onVerifyCode }: QRScannerModalProps) {
  const [inputCode, setInputCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) return;

    let cleanCode = inputCode.trim();
    // If it's a URL like http://.../#verify-PT-2025-0428 or containing verify-
    if (cleanCode.includes('#verify-')) {
      cleanCode = cleanCode.split('#verify-')[1];
    } else if (cleanCode.includes('verify=')) {
      cleanCode = cleanCode.split('verify=')[1];
    }

    onVerifyCode(cleanCode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
        <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">qr_code_scanner</span>
            <h3 className="font-headline-sm font-bold text-on-surface">
              Quét & Đối Soát Chứng Từ
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-on-primary-fixed mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">document_scanner</span>
            </div>
            <h4 className="font-bold text-sm text-on-surface">Đối soát mã QR chứng từ điện tử</h4>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Nhập mã đối soát độc bản in ở góc trên bên phải Phiếu Thu/Chi hoặc liên kết quét từ điện thoại:
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Mã đối soát hoặc URL QR:
              </label>
              <input
                type="text"
                autoFocus
                required
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder="Ví dụ: PT-2025-0428 hoặc quét liên kết..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface font-mono text-sm text-center font-bold text-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
              >
                Kiểm tra đối soát ngay
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
