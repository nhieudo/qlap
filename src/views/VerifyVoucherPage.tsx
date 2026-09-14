import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { FinanceTransaction } from '../types';
import { formatCurrencyVND, formatDateVN } from '../utils/numberToWords';

interface VerifyVoucherPageProps {
  code: string;
  onBack: () => void;
}

export function VerifyVoucherPage({ code, onBack }: VerifyVoucherPageProps) {
  const [loading, setLoading] = useState(true);
  const [transaction, setTransaction] = useState<FinanceTransaction | null>(null);
  const [searchCode, setSearchCode] = useState(code);

  const fetchTransaction = async (verifyCode: string) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'financeTransactions'),
        where('reconciliationCode', '==', verifyCode.trim().toUpperCase())
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setTransaction({ id: snap.docs[0].id, ...snap.docs[0].data() } as FinanceTransaction);
      } else {
        setTransaction(null);
      }
    } catch (err) {
      console.error('Lỗi tra cứu chứng từ:', err);
      setTransaction(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) {
      fetchTransaction(code);
    } else {
      setLoading(false);
    }
  }, [code]);

  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6 flex flex-col items-center justify-center">
      <div className="max-w-xl w-full bg-surface-container-lowest rounded-3xl shadow-xl border border-surface-container-high overflow-hidden p-6 sm:p-8 space-y-6 animate-in fade-in">
        {/* Header with National Crest */}
        <div className="flex items-center justify-between border-b border-surface-container-high pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-amber-300 shadow-md">
              <span className="material-symbols-outlined text-2xl">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline-sm font-bold text-on-surface uppercase">
                CỔNG TRA CỨU ĐỐI SOÁT CHỨNG TỪ
              </h2>
              <p className="text-xs text-on-surface-variant">
                Ấp Bình Hòa • Xã An Nhơn Tây • Huyện Củ Chi
              </p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant"
            title="Quay lại"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Search input if wanting to check another code */}
        <div className="flex gap-2">
          <input
            type="text"
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            placeholder="Nhập mã đối soát (Ví dụ: PT-2025-0428)..."
            className="flex-1 px-4 py-2.5 rounded-xl border border-surface-container-highest bg-surface font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
          />
          <button
            onClick={() => fetchTransaction(searchCode)}
            className="px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-container transition-colors"
          >
            Tra cứu
          </button>
        </div>

        {/* Verification Result */}
        {loading ? (
          <div className="py-12 text-center text-on-surface-variant flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
            <span className="text-sm">Đang đối soát chứng từ trên cơ sở dữ liệu quốc gia...</span>
          </div>
        ) : transaction ? (
          <div className="space-y-4">
            {/* Status Badge */}
            <div
              className={`p-4 rounded-2xl flex items-center gap-3 border ${
                transaction.status === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : transaction.status === 'DRAFT'
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span className="material-symbols-outlined text-3xl">
                {transaction.status === 'APPROVED'
                  ? 'check_circle'
                  : transaction.status === 'DRAFT'
                  ? 'pending'
                  : 'cancel'}
              </span>
              <div>
                <h4 className="font-bold text-base">
                  {transaction.status === 'APPROVED'
                    ? 'CHỨNG TỪ HỢP LỆ VÀ ĐÃ PHÊ DUYỆT'
                    : transaction.status === 'DRAFT'
                    ? 'CHỨNG TỪ BẢN NHÁP (CHƯA PHÊ DUYỆT)'
                    : 'CHỨNG TỪ ĐÃ BỊ HỦY BỎ'}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {transaction.status === 'APPROVED'
                    ? 'Chứng từ được số hóa hợp lệ, đã qua kiểm toán và đối soát quỹ tiền mặt.'
                    : transaction.status === 'DRAFT'
                    ? 'Chứng từ vừa được lập, chưa có chữ ký duyệt của Trưởng ấp.'
                    : `Chứng từ đã bị hủy. Lý do: ${transaction.cancellationReason || 'Theo quyết định'}`}
                </p>
              </div>
            </div>

            {/* Details Table */}
            <div className="bg-surface rounded-2xl p-4 border border-surface-container-high space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Số chứng từ:</span>
                <span className="font-bold text-primary font-mono">{transaction.voucherNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Mã đối soát độc bản:</span>
                <span className="font-mono text-xs font-bold text-on-surface bg-surface-container px-2 py-0.5 rounded-md">
                  {transaction.reconciliationCode}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Loại chứng từ:</span>
                <span className="font-semibold text-on-surface">
                  {transaction.transactionType === 'INCOME' ? 'Phiếu Thu Quỹ' : 'Phiếu Chi Quỹ'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Ngày phát sinh:</span>
                <span className="font-medium text-on-surface">{formatDateVN(transaction.transactionDate)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Họ tên người nộp/nhận:</span>
                <span className="font-bold text-on-surface">{transaction.personName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Hạng mục:</span>
                <span className="text-on-surface">{transaction.categoryName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Số tiền:</span>
                <span className="font-mono font-black text-primary text-base">
                  {formatCurrencyVND(transaction.amount)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-surface-container-high">
                <span className="text-on-surface-variant font-medium">Bằng chữ:</span>
                <span className="italic text-xs text-on-surface-variant">{transaction.amountInWords}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-on-surface-variant font-medium">Người duyệt:</span>
                <span className="font-semibold text-emerald-800">
                  {transaction.approvedBy || 'Chưa duyệt'}
                </span>
              </div>
            </div>

            <div className="text-center text-xs text-on-surface-variant italic">
              Tra cứu tại hệ thống cơ sở dữ liệu quản lý công khai Ấp Bình Hòa
            </div>
          </div>
        ) : (
          <div className="py-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-error-container text-on-error-container mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">search_off</span>
            </div>
            <h4 className="font-semibold text-on-surface">Không tìm thấy chứng từ</h4>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Không có chứng từ nào khớp với mã đối soát{' '}
              <span className="font-mono font-bold text-error">{searchCode}</span> trong hệ thống Ấp. Vui lòng kiểm tra lại mã hoặc liên hệ Ban điều hành Ấp.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
