import { useEffect, useState, useRef } from 'react';
import { FinanceTransaction, OrganizationSettings } from '../types';
import { formatCurrencyVND } from '../utils/numberToWords';
import { generateVoucherQR } from '../utils/voucherCode';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface VoucherA4ModalProps {
  isOpen: boolean;
  transaction: FinanceTransaction | null;
  settings: OrganizationSettings;
  onClose: () => void;
}

export function VoucherA4Modal({
  isOpen,
  transaction,
  settings,
  onClose,
}: VoucherA4ModalProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [downloading, setDownloading] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transaction) {
      const verifyUrl = `${window.location.origin}/#verify-${transaction.reconciliationCode}`;
      generateVoucherQR({
        reconciliationCode: transaction.reconciliationCode,
        voucherNumber: transaction.voucherNumber,
        transactionType: transaction.transactionType === 'INCOME' ? 'PHIẾU THU' : 'PHIẾU CHI',
        transactionDate: transaction.transactionDate,
        amount: transaction.amount,
        personName: transaction.personName,
        verifyUrl,
      }).then(setQrDataUrl);
    }
  }, [transaction]);

  if (!isOpen || !transaction) return null;

  const isIncome = transaction.transactionType === 'INCOME';
  const title = isIncome ? 'PHIẾU THU' : 'PHIẾU CHI';
  const personRoleLabel = isIncome ? 'Họ và tên người nộp tiền' : 'Họ và tên người nhận tiền';
  const dateObj = new Date(transaction.transactionDate);
  const day = dateObj.getDate();
  const month = dateObj.getMonth() + 1;
  const year = dateObj.getFullYear();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!printAreaRef.current) return;
    setDownloading(true);
    try {
      const element = printAreaRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfHeight, 297));

      const fileName = `${transaction.voucherNumber.replace(/[\/\\]/g, '-')}.pdf`;
      const blob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = blobUrl;
      downloadLink.download = fileName;
      downloadLink.style.display = 'none';
      document.body.appendChild(downloadLink);
      downloadLink.click();
      setTimeout(() => {
        if (downloadLink.parentNode) {
          downloadLink.parentNode.removeChild(downloadLink);
        }
        URL.revokeObjectURL(blobUrl);
      }, 1500);
    } catch (err) {
      console.error('Lỗi khi tải tệp PDF:', err);
      // Fallback khi trình duyệt chặn tải: gọi hộp thoại in chuẩn
      window.print();
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      {/* Container */}
      <div className="bg-surface-container-lowest max-w-4xl w-full rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Toolbar Header (No Print) */}
        <div className="no-print bg-surface-container px-6 py-3.5 border-b border-surface-container-high flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-xl">receipt_long</span>
            <span className="font-headline-sm font-semibold text-on-surface">
              Chứng từ điện tử A4 chuẩn hành chính
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-md font-semibold ${
                transaction.status === 'APPROVED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : transaction.status === 'DRAFT'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {transaction.status === 'APPROVED'
                ? 'Đã duyệt'
                : transaction.status === 'DRAFT'
                ? 'Bản nháp'
                : 'Đã hủy'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-surface-container-highest hover:bg-surface-dim text-xs font-semibold text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span>In phiếu</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary-container text-xs font-semibold text-white transition-colors"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>{downloading ? 'Đang tạo PDF...' : 'Tải tệp PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Scrollable Printable A4 Canvas */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100 flex justify-center">
          <div
            ref={printAreaRef}
            id="printable-voucher-sheet"
            className="bg-white text-slate-900 w-full max-w-[210mm] min-h-[297mm] p-10 sm:p-14 shadow-lg flex flex-col justify-between font-sans border border-slate-200 print:border-none print:shadow-none print:p-8 print:w-full"
            style={{ boxSizing: 'border-box' }}
          >
            <div>
              {/* Header section: Superior Agency & Form Spec */}
              <div className="flex items-start justify-between border-b pb-4 border-slate-300">
                <div>
                  <div className="font-bold text-xs uppercase text-slate-700 tracking-wider">
                    {settings.voucherSettings?.superiorAgency || (settings.communeName ? `UBND ${settings.communeName.toUpperCase()}` : 'UBND XÃ')}
                  </div>
                  <div className="font-extrabold text-sm uppercase text-slate-900 mt-0.5">
                    {settings.voucherSettings?.agencyName || (settings.hamletName ? `BAN ĐIỀU HÀNH ${settings.hamletName.toUpperCase()}` : 'BAN ĐIỀU HÀNH ẤP')}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 italic">
                    Địa chỉ: {settings.address || `${settings.hamletName}, ${settings.communeName}, ${settings.provinceName}`}
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-bold text-xs text-slate-800">
                    {settings.voucherSettings?.templateStandard || (isIncome ? 'Mẫu số 01 - TT' : 'Mẫu số 02 - TT')}
                  </div>
                  <div className="text-[10px] text-slate-500 italic mt-0.5 max-w-[200px]">
                    (Ban hành theo TT 70/2019/TT-BTC & TT 133/2016/TT-BTC của Bộ Tài chính)
                  </div>
                  <div className="text-xs font-semibold text-slate-700 mt-1">
                    Số: <span className="text-primary font-bold">{transaction.voucherNumber}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    Mã ĐS: {transaction.reconciliationCode}
                  </div>
                </div>
              </div>

              {/* Title and QR Code */}
              <div className="mt-8 flex items-center justify-between">
                <div className="flex-1 text-center pl-16">
                  <h2 className="text-3xl font-black text-slate-900 tracking-wider uppercase">
                    {title}
                  </h2>
                  <p className="text-xs italic text-slate-600 mt-1.5">
                    Ngày {day} tháng {month} năm {year}
                  </p>
                </div>

                {/* QR Code */}
                {qrDataUrl && (
                  <div className="shrink-0 flex flex-col items-center bg-slate-50 p-2 rounded-lg border border-slate-200">
                    <img src={qrDataUrl} alt="Mã QR Đối soát" className="w-20 h-20" />
                    <span className="text-[9px] text-slate-500 font-medium tracking-tight mt-1">
                      Quét kiểm tra
                    </span>
                  </div>
                )}
              </div>

              {/* Body Fields */}
              <div className="mt-8 space-y-3.5 text-sm text-slate-800 leading-relaxed">
                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">{personRoleLabel}:</span>
                  <span className="font-bold text-base text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {transaction.personName}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Địa chỉ:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {transaction.address} {transaction.groupNumber ? `(${transaction.groupNumber})` : ''}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Nội dung / Lý do:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {transaction.description}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Hạng mục thu/chi:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 pb-0.5 font-medium">
                    {transaction.categoryName}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Số tiền:</span>
                  <span className="text-lg font-black text-primary border-b border-dotted border-slate-400 flex-1 pb-0.5 font-mono">
                    {formatCurrencyVND(transaction.amount)}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Viết bằng chữ:</span>
                  <span className="italic font-bold text-slate-900 border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {transaction.amountInWords}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Hình thức thanh toán:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 pb-0.5">
                    {transaction.paymentMethod}
                  </span>
                </div>

                <div className="flex items-baseline">
                  <span className="w-52 font-semibold shrink-0">Chứng từ kèm theo:</span>
                  <span className="border-b border-dotted border-slate-400 flex-1 pb-0.5 italic text-slate-500">
                    {transaction.attachments?.length
                      ? `${transaction.attachments.length} hóa đơn/chứng từ gốc`
                      : 'Biên nhận gốc kèm sổ quỹ lưu'}
                  </span>
                </div>
              </div>

              {/* Signatures Section */}
              <div className="mt-14 pt-4">
                <div className="text-right text-xs italic text-slate-600 mb-2">
                  {settings.hamletName || 'Ấp'}, ngày {day} tháng {month} năm {year}
                </div>

                <div className="grid grid-cols-3 gap-6 text-center mt-4">
                  {/* Trưởng ấp */}
                  <div className="flex flex-col justify-between h-44">
                    <div>
                      <div className="font-bold text-xs uppercase text-slate-900">
                        {settings.voucherSettings?.signers?.[0]?.roleTitle || 'TRƯỞNG ẤP'}
                      </div>
                      <div className="text-[11px] text-slate-500 italic">
                        {settings.voucherSettings?.signers?.[0]?.actionSubtitle || '(Ký, đóng dấu)'}
                      </div>
                    </div>
                    <div>
                      {transaction.status === 'APPROVED' && (
                        <div className="text-xs text-emerald-700 font-semibold mb-1 italic">
                          ✓ Đã duyệt điện tử
                        </div>
                      )}
                      <div className="font-bold text-xs text-slate-900">
                        {transaction.approvedBy || settings.hamletLeaderName}
                      </div>
                    </div>
                  </div>

                  {/* Thủ quỹ */}
                  <div className="flex flex-col justify-between h-44">
                    <div>
                      <div className="font-bold text-xs uppercase text-slate-900">
                        {settings.voucherSettings?.signers?.find(s => s.roleTitle.includes('THỦ QUỸ'))?.roleTitle || 'THỦ QUỸ'}
                      </div>
                      <div className="text-[11px] text-slate-500 italic">
                        {settings.voucherSettings?.signers?.find(s => s.roleTitle.includes('THỦ QUỸ'))?.actionSubtitle || '(Ký, họ tên)'}
                      </div>
                    </div>
                    <div className="font-bold text-xs text-slate-900">
                      {settings.treasurerName}
                    </div>
                  </div>

                  {/* Người nộp / nhận */}
                  <div className="flex flex-col justify-between h-44">
                    <div>
                      <div className="font-bold text-xs uppercase text-slate-900">
                        {isIncome ? 'NGƯỜI NỘP TIỀN' : 'NGƯỜI NHẬN TIỀN'}
                      </div>
                      <div className="text-[11px] text-slate-500 italic">(Ký, ghi rõ họ tên)</div>
                    </div>
                    <div className="font-bold text-xs text-slate-900">
                      {transaction.personName}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
