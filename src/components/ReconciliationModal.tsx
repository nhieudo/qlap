import React, { useState } from 'react';
import { FinanceTransaction, OrganizationSettings } from '../types';
import { getFinanceTransactions } from '../services/db';
import { formatCurrencyVND, formatDateVN } from '../utils/numberToWords';

interface ReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewVoucher: (tx: FinanceTransaction) => void;
  settings: OrganizationSettings;
}

export function ReconciliationModal({
  isOpen,
  onClose,
  onViewVoucher,
  settings,
}: ReconciliationModalProps) {
  const [inputCode, setInputCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<FinanceTransaction | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = inputCode.trim();
    if (!query) return;

    setSearching(true);
    setHasSearched(true);
    setNotFound(false);
    setResult(null);

    try {
      const allTx = await getFinanceTransactions();
      const clean = query.toUpperCase();
      const match = allTx.find(
        (t) =>
          t.reconciliationCode?.toUpperCase() === clean ||
          t.voucherNumber?.toUpperCase() === clean ||
          t.id === query
      );

      if (match) {
        setResult(match);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error(err);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-surface-container px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-primary text-2xl">fact_check</span>
            <div>
              <h3 className="font-bold text-base text-on-surface">Đối Chiếu Mã Chứng Từ Điện Tử</h3>
              <p className="text-[11px] text-on-surface-variant">
                Xác thực tính toàn vẹn và đối soát mã phiếu thu/chi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs">
          <form onSubmit={handleSearch} className="space-y-2">
            <label className="block font-semibold text-on-surface">
              Nhập mã đối chiếu hoặc số chứng từ:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                  qr_code
                </span>
                <input
                  type="text"
                  required
                  value={inputCode}
                  onChange={(e) => setInputCode(e.target.value)}
                  placeholder="VD: PT-2026-..., PT-000001/2026..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-mono uppercase focus:ring-2 focus:ring-primary/20 focus:outline-hidden"
                />
              </div>
              <button
                type="submit"
                disabled={searching}
                className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition-all shadow-xs flex items-center gap-1.5 shrink-0"
              >
                {searching ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">search</span>
                    <span>Đối soát</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[11px] text-on-surface-variant italic">
              Mã đối soát được in trực tiếp dưới mã QR và góc phải trên mỗi phiếu thu/chi A4.
            </p>
          </form>

          {/* Results Display */}
          {hasSearched && (
            <div>
              {notFound ? (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-center space-y-1">
                  <div className="font-bold">Không tìm thấy chứng từ khớp với mã này</div>
                  <div className="text-[11px] text-amber-800">
                    Vui lòng kiểm tra lại ký tự trên chứng từ hoặc liên hệ Ban điều hành Ấp.
                  </div>
                </div>
              ) : result ? (
                <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-300 space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-emerald-200">
                    <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-sm">
                      <span className="material-symbols-outlined text-base text-emerald-700">verified</span>
                      <span>Chứng từ Hợp lệ & Đã Đối Chiếu</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        result.status === 'APPROVED'
                          ? 'bg-emerald-200 text-emerald-900'
                          : result.status === 'DRAFT'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-red-100 text-red-900'
                      }`}
                    >
                      {result.status === 'APPROVED' ? 'ĐÃ PHÊ DUYỆT' : result.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Loại chứng từ:</span>
                      <div className="font-bold text-slate-900">
                        {result.transactionType === 'INCOME' ? 'PHIẾU THU' : 'PHIẾU CHI'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Số chứng từ:</span>
                      <div className="font-mono font-bold text-primary">{result.voucherNumber}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Mã đối chiếu:</span>
                      <div className="font-mono text-slate-800 font-semibold">{result.reconciliationCode}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Ngày lập phiếu:</span>
                      <div className="font-medium text-slate-800">{formatDateVN(result.transactionDate)}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">
                        {result.transactionType === 'INCOME' ? 'Người nộp tiền:' : 'Người nhận tiền:'}
                      </span>
                      <div className="font-bold text-slate-900 text-xs">{result.personName}</div>
                      <div className="text-[10px] text-slate-600">{result.address}</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Số tiền:</span>
                      <div className="text-sm font-black text-emerald-800 font-numeric-data">
                        {formatCurrencyVND(result.amount)}
                      </div>
                      <div className="text-[10px] italic text-slate-600">({result.amountInWords})</div>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-500">Nội dung thu/chi:</span>
                      <div className="font-medium text-slate-800">{result.description}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Người duyệt / Ký:</span>
                      <div className="font-medium text-slate-800">{result.approvedByNameSnapshot || result.approvedBy || 'Chưa duyệt'}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">Đơn vị quản lý:</span>
                      <div className="font-medium text-slate-800">{settings.hamletName} - {settings.communeName}</div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-emerald-200 flex justify-end">
                    <button
                      onClick={() => {
                        onClose();
                        onViewVoucher(result);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold text-xs shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base">print</span>
                      <span>Mở Bản In A4 Chuẩn Nhà Nước</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
