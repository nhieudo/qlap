import { useState, useMemo } from 'react';
import {
  Resident,
  Household,
  FinanceTransaction,
  FinanceCategory,
  GiftCampaign,
  OrganizationSettings,
} from '../types';
import {
  exportComprehensiveAllTimeReportToExcel,
  exportFinanceToExcel,
  exportResidentsToExcel,
  exportHouseholdsToExcel,
} from '../utils/excelExport';
import * as XLSX from 'xlsx';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  residents: Resident[];
  households: Household[];
  transactions: FinanceTransaction[];
  categories: FinanceCategory[];
  campaigns: GiftCampaign[];
  settings?: OrganizationSettings;
}

export type ReportType =
  | 'ALL_IN_ONE'
  | 'FINANCE_BOOK'
  | 'FINANCE_BY_CATEGORY'
  | 'RESIDENTS'
  | 'HOUSEHOLDS'
  | 'WELFARE_GIFTS';

export default function ReportExportModal({
  isOpen,
  onClose,
  residents,
  households,
  transactions,
  categories,
  campaigns,
  settings,
}: ReportExportModalProps) {
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('ALL_IN_ONE');

  // Time filters for Finance
  const [timeScope, setTimeScope] = useState<'ALL_TIME' | 'CURRENT_YEAR' | 'CUSTOM_RANGE'>('ALL_TIME');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [txStatusFilter, setTxStatusFilter] = useState<'APPROVED' | 'ALL'>('APPROVED');

  // Filter for Residents
  const [residentGroupFilter, setResidentGroupFilter] = useState('ALL');
  const [residentTagFilter, setResidentTagFilter] = useState<'ALL' | 'POOR' | 'NEAR_POOR' | 'POLICY' | 'ELDERLY' | 'CHILD' | 'DISABLED'>('ALL');

  // Filter for Households
  const [householdClassFilter, setHouseholdClassFilter] = useState('ALL');

  // Exporting state
  const [exporting, setExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  // Dynamic group list
  const availableGroups = useMemo(() => {
    return Array.from(
      new Set([
        ...residents.map((r) => r.groupNumber?.trim()).filter(Boolean),
        ...households.map((h) => h.groupNumber?.trim()).filter(Boolean),
      ]) as Set<string>
    ).sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10);
      const numB = parseInt(b.replace(/\D/g, ''), 10);
      if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      return a.localeCompare(b, 'vi');
    });
  }, [residents, households]);

  if (!isOpen) return null;

  const handleExportQuickAllTime = () => {
    setExporting(true);
    try {
      exportComprehensiveAllTimeReportToExcel({
        residents,
        households,
        transactions,
        categories,
        campaigns,
        settings,
      });
      setExportSuccess('Đã xuất thành công Báo cáo Tổng hợp toàn bộ (Excel đa sheet)!');
      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Có lỗi khi tạo file Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleExportSelected = () => {
    setExporting(true);
    const hamlet = settings?.hamletName || 'Ap_Binh_Hoa';
    const now = new Date();
    const stamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;

    try {
      if (selectedReportType === 'ALL_IN_ONE') {
        exportComprehensiveAllTimeReportToExcel({
          residents,
          households,
          transactions,
          categories,
          campaigns,
          settings,
        });
        setExportSuccess('Đã xuất thành công Báo cáo Tổng hợp toàn bộ!');
      } else if (selectedReportType === 'FINANCE_BOOK') {
        // Filter transactions based on selection
        let txList = transactions;
        if (txStatusFilter === 'APPROVED') {
          txList = txList.filter((t) => t.status === 'APPROVED');
        }
        if (timeScope === 'CURRENT_YEAR') {
          const curYear = new Date().getFullYear().toString();
          txList = txList.filter((t) => (t.transactionDate || '').startsWith(curYear));
        } else if (timeScope === 'CUSTOM_RANGE') {
          if (startDate) {
            txList = txList.filter((t) => (t.transactionDate || '') >= startDate);
          }
          if (endDate) {
            txList = txList.filter((t) => (t.transactionDate || '') <= endDate);
          }
        }
        exportFinanceToExcel(txList, `So_quy_thu_chi_${hamlet}_${stamp}.xlsx`);
        setExportSuccess(`Đã xuất Sổ quỹ thu chi với ${txList.length} chứng từ!`);
      } else if (selectedReportType === 'FINANCE_BY_CATEGORY') {
        // Category balance sheet
        const approvedTx = transactions.filter((t) => t.status === 'APPROVED');
        const catMap = new Map<string, { income: number; expense: number; count: number }>();
        approvedTx.forEach((tx) => {
          const c = tx.categoryName || 'Chung';
          if (!catMap.has(c)) catMap.set(c, { income: 0, expense: 0, count: 0 });
          const cur = catMap.get(c)!;
          cur.count++;
          if (tx.transactionType === 'INCOME') cur.income += tx.amount;
          else cur.expense += tx.amount;
        });

        const data = Array.from(catMap.entries()).map(([name, stat], idx) => ({
          'STT': idx + 1,
          'Hạng mục Quỹ': name,
          'Tổng Thu (VNĐ)': stat.income,
          'Tổng Chi (VNĐ)': stat.expense,
          'Tồn Chênh Lệch (VNĐ)': stat.income - stat.expense,
          'Số Chứng Từ': stat.count,
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 6 }, { wch: 32 }, { wch: 20 }, { wch: 20 }, { wch: 22 }, { wch: 14 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Thu Chi Theo Quỹ');
        XLSX.writeFile(wb, `Bao_cao_thu_chi_theo_quy_${hamlet}_${stamp}.xlsx`);
        setExportSuccess('Đã xuất Báo cáo Thu chi theo Hạng mục Quỹ!');
      } else if (selectedReportType === 'RESIDENTS') {
        let resList = residents;
        if (residentGroupFilter !== 'ALL') {
          resList = resList.filter((r) => r.groupNumber?.trim() === residentGroupFilter);
        }
        if (residentTagFilter === 'POOR') resList = resList.filter((r) => r.isPoorHousehold);
        else if (residentTagFilter === 'NEAR_POOR') resList = resList.filter((r) => r.isNearPoorHousehold);
        else if (residentTagFilter === 'POLICY') resList = resList.filter((r) => r.isPolicyBeneficiary);
        else if (residentTagFilter === 'ELDERLY') resList = resList.filter((r) => r.isElderly);
        else if (residentTagFilter === 'CHILD') resList = resList.filter((r) => r.isChild);
        else if (residentTagFilter === 'DISABLED') resList = resList.filter((r) => r.isDisabled);

        exportResidentsToExcel(resList, `Danh_sach_nhan_khau_${hamlet}_${stamp}.xlsx`);
        setExportSuccess(`Đã xuất danh sách ${resList.length} nhân khẩu!`);
      } else if (selectedReportType === 'HOUSEHOLDS') {
        let hhList = households;
        if (householdClassFilter !== 'ALL') {
          hhList = hhList.filter((h) => h.classification === householdClassFilter);
        }
        exportHouseholdsToExcel(hhList, `Danh_sach_so_ho_gia_dinh_${hamlet}_${stamp}.xlsx`);
        setExportSuccess(`Đã xuất danh sách ${hhList.length} sổ hộ gia đình!`);
      } else if (selectedReportType === 'WELFARE_GIFTS') {
        const campData = campaigns.map((c, idx) => ({
          'STT': idx + 1,
          'Mã Đợt': c.campaignCode,
          'Tên Đợt Quà Tặng': c.campaignName,
          'Thời Gian / Ngày Phát': c.distributionDate || 'Chưa định ngày',
          'Đối Tượng Thụ Hưởng': (c.targetGroups || []).join(', ') || 'Diện thụ hưởng',
          'Tổng Suất Quà': c.totalQuantity || c.totalBeneficiaries || 0,
          'Đã Trao': c.deliveredCount || 0,
          'Kinh Phí (VNĐ)': c.totalBudget || 0,
          'Trạng Thái': c.status === 'COMPLETED' ? 'Hoàn tất' : 'Đang triển khai',
        }));
        const ws = XLSX.utils.json_to_sheet(campData);
        ws['!cols'] = [{ wch: 6 }, { wch: 14 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 16 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'An Sinh Xã Hội');
        XLSX.writeFile(wb, `Bao_cao_an_sinh_qua_tang_${hamlet}_${stamp}.xlsx`);
        setExportSuccess(`Đã xuất báo cáo các đợt phát quà an sinh!`);
      }

      setTimeout(() => setExportSuccess(null), 4000);
    } catch (err: any) {
      console.error(err);
      alert('Có lỗi khi xuất Excel: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-surface-container-high bg-surface-container-low flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">table_chart</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-on-surface">
                Xuất Báo Cáo Thống Kê Ra File Excel (.xlsx)
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Xuất báo cáo tổng hợp từ trước đến nay hoặc tùy chọn từng phân hệ theo yêu cầu
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Success message banner */}
        {exportSuccess && (
          <div className="mx-6 mt-4 p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
            <span>{exportSuccess}</span>
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* QUICK EXPORT ACTION BOX: ALL-IN-ONE */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] uppercase tracking-wider">
                    Khuyến nghị
                  </span>
                  <h4 className="font-bold text-sm text-emerald-950">
                    Xuất Báo Cáo Tổng Hợp Toàn Bộ Từ Trước Đến Nay
                  </h4>
                </div>
                <p className="text-xs text-emerald-900/80 mt-1">
                  Xuất 1 tệp Excel chuẩn hành chính tích hợp <strong>6 Sheet đầy đủ</strong>: Tổng hợp chỉ số, Sổ quỹ thu chi lũy kế, Thu chi theo quỹ, Dân cư toàn ấp, Sổ hộ gia đình và Quà tặng an sinh.
                </p>
              </div>
            </div>

            <button
              onClick={handleExportQuickAllTime}
              disabled={exporting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>{exporting ? 'Đang khởi tạo tệp Excel...' : '⚡ Xuất Ngay Báo Cáo Tổng Hợp Toàn Diện (All-in-One)'}</span>
            </button>
          </div>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-surface-container-high"></div>
            <span className="flex-shrink mx-3 text-[11px] font-bold text-on-surface-variant uppercase tracking-wider">
              Hoặc Tùy Chọn Xuất Từng Loại Báo Cáo
            </span>
            <div className="flex-grow border-t border-surface-container-high"></div>
          </div>

          {/* CHOOSE REPORT TYPE */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-on-surface">
              1. Chọn loại phân hệ báo cáo cần xuất:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedReportType('FINANCE_BOOK')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedReportType === 'FINANCE_BOOK'
                    ? 'border-primary bg-primary-fixed/20 shadow-2xs font-bold'
                    : 'border-surface-container-highest bg-surface hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">receipt_long</span>
                  <span className="text-xs text-on-surface font-semibold">Sổ Quỹ Thu - Chi Tiền Mặt</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Bảng kê chi tiết phiếu thu, phiếu chi, tồn lũy kế
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('FINANCE_BY_CATEGORY')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedReportType === 'FINANCE_BY_CATEGORY'
                    ? 'border-primary bg-primary-fixed/20 shadow-2xs font-bold'
                    : 'border-surface-container-highest bg-surface hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">pie_chart</span>
                  <span className="text-xs text-on-surface font-semibold">Thu Chi Theo Quỹ / Hạng Mục</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Tổng thu, chi, net chênh lệch theo từng quỹ
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('RESIDENTS')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedReportType === 'RESIDENTS'
                    ? 'border-primary bg-primary-fixed/20 shadow-2xs font-bold'
                    : 'border-surface-container-highest bg-surface hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">badge</span>
                  <span className="text-xs text-on-surface font-semibold">Danh Sách Dân Cư & Nhân Khẩu</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Trích xuất danh sách nhân khẩu, CCCD, nhóm chính sách
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('HOUSEHOLDS')}
                className={`p-3 rounded-2xl border text-left transition-all ${
                  selectedReportType === 'HOUSEHOLDS'
                    ? 'border-primary bg-primary-fixed/20 shadow-2xs font-bold'
                    : 'border-surface-container-highest bg-surface hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">menu_book</span>
                  <span className="text-xs text-on-surface font-semibold">Sổ Hộ Gia Đình Toàn Ấp</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Mã hộ, chủ hộ, phân loại hộ, số lượng thành viên
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedReportType('WELFARE_GIFTS')}
                className={`p-3 rounded-2xl border text-left transition-all sm:col-span-2 ${
                  selectedReportType === 'WELFARE_GIFTS'
                    ? 'border-primary bg-primary-fixed/20 shadow-2xs font-bold'
                    : 'border-surface-container-highest bg-surface hover:bg-surface-container-low'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">featured_seasonal_and_gifts</span>
                  <span className="text-xs text-on-surface font-semibold">Báo Cáo Quà Tặng & An Sinh Xã Hội</span>
                </div>
                <div className="text-[11px] text-on-surface-variant mt-1">
                  Tổng hợp các đợt phát quà, số lượng suất quà và ngân sách an sinh
                </div>
              </button>
            </div>
          </div>

          {/* DYNAMIC PARAMETERS BASED ON SELECTED REPORT */}
          {selectedReportType === 'FINANCE_BOOK' && (
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
              <div className="text-xs font-bold text-on-surface">2. Bộ lọc Sổ Quỹ Thu - Chi:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                    Kỳ báo cáo
                  </label>
                  <select
                    value={timeScope}
                    onChange={(e) => setTimeScope(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="ALL_TIME">Toàn thời gian (Từ trước đến nay)</option>
                    <option value="CURRENT_YEAR">Năm hiện tại ({new Date().getFullYear()})</option>
                    <option value="CUSTOM_RANGE">Khoảng ngày tùy chọn...</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                    Trạng thái chứng từ
                  </label>
                  <select
                    value={txStatusFilter}
                    onChange={(e) => setTxStatusFilter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="APPROVED">Chỉ chứng từ Đã Duyệt (Chuẩn kế toán)</option>
                    <option value="ALL">Tất cả (Bao gồm cả Bản nháp & Đã hủy)</option>
                  </select>
                </div>

                {timeScope === 'CUSTOM_RANGE' && (
                  <>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                        Từ ngày
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                        Đến ngày
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {selectedReportType === 'RESIDENTS' && (
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
              <div className="text-xs font-bold text-on-surface">2. Bộ lọc Dân cư:</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                    Lọc theo Tổ dân cư
                  </label>
                  <select
                    value={residentGroupFilter}
                    onChange={(e) => setResidentGroupFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="ALL">Tất cả các tổ ({residents.length} người)</option>
                    {availableGroups.map((g) => (
                      <option key={g} value={g}>
                        {g} ({residents.filter((r) => r.groupNumber?.trim() === g).length} người)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-on-surface-variant mb-1 font-medium">
                    Đối tượng đặc thù
                  </label>
                  <select
                    value={residentTagFilter}
                    onChange={(e) => setResidentTagFilter(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="ALL">Tất cả đối tượng</option>
                    <option value="POOR">Hộ nghèo ({residents.filter((r) => r.isPoorHousehold).length})</option>
                    <option value="NEAR_POOR">Hộ cận nghèo ({residents.filter((r) => r.isNearPoorHousehold).length})</option>
                    <option value="POLICY">Gia đình chính sách ({residents.filter((r) => r.isPolicyBeneficiary).length})</option>
                    <option value="ELDERLY">Người cao tuổi (≥60) ({residents.filter((r) => r.isElderly).length})</option>
                    <option value="CHILD">Trẻ em (&lt;16) ({residents.filter((r) => r.isChild).length})</option>
                    <option value="DISABLED">Người khuyết tật ({residents.filter((r) => r.isDisabled).length})</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {selectedReportType === 'HOUSEHOLDS' && (
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container space-y-3">
              <div className="text-xs font-bold text-on-surface">2. Phân loại sổ hộ:</div>
              <select
                value={householdClassFilter}
                onChange={(e) => setHouseholdClassFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
              >
                <option value="ALL">Tất cả các sổ hộ ({households.length} hộ)</option>
                <option value="Bình thường">Hộ bình thường</option>
                <option value="Hộ nghèo">Hộ nghèo</option>
                <option value="Cận nghèo">Hộ cận nghèo</option>
                <option value="Gia đình chính sách">Gia đình chính sách</option>
              </select>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 sm:p-5 border-t border-surface-container-high bg-surface-container-low flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExportSelected}
            disabled={exporting}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-container text-white shadow-xs disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-base">download</span>
            <span>{exporting ? 'Đang xuất file...' : 'Tải Xuống File Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
