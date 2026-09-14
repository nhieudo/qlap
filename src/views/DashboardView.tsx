import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { getResidents, getHouseholds, getFinanceTransactions, getGiftCampaigns, getAuditLogs } from '../services/db';
import { Resident, Household, FinanceTransaction, GiftCampaign, AuditLog } from '../types';
import { formatCurrencyVND, formatDateVN } from '../utils/numberToWords';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
  onOpenNewResident: () => void;
  onOpenNewIncome: () => void;
  onOpenNewExpense: () => void;
  onOpenQRScanner: () => void;
}

export function DashboardView({
  onNavigate,
  onOpenNewResident,
  onOpenNewIncome,
  onOpenNewExpense,
  onOpenQRScanner,
}: DashboardViewProps) {
  const { userProfile, hasPerm } = useAuth();
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [campaigns, setCampaigns] = useState<GiftCampaign[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [res, hh, tx, camp, logs] = await Promise.all([
          getResidents(),
          getHouseholds(),
          getFinanceTransactions(),
          getGiftCampaigns(),
          getAuditLogs(6),
        ]);
        setResidents(res);
        setHouseholds(hh);
        setTransactions(tx);
        setCampaigns(camp);
        setAuditLogs(logs);
      } catch (err) {
        console.error('Lỗi tải dữ liệu tổng quan:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Compute financial totals
  const approvedTx = transactions.filter(t => t.status === 'APPROVED');
  const totalIncome = approvedTx
    .filter(t => t.transactionType === 'INCOME')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = approvedTx
    .filter(t => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const currentBalance = totalIncome - totalExpense;
  const pendingDraftCount = transactions.filter(t => t.status === 'DRAFT').length;

  // Demographics
  const maleCount = residents.filter(r => r.gender === 'Nam').length;
  const femaleCount = residents.filter(r => r.gender === 'Nữ').length;
  const poorCount = residents.filter(r => r.isPoorHousehold).length;
  const nearPoorCount = residents.filter(r => r.isNearPoorHousehold).length;
  const policyCount = residents.filter(r => r.isPolicyBeneficiary).length;
  const elderlyCount = residents.filter(r => {
    if (!r.dateOfBirth) return false;
    const age = new Date().getFullYear() - new Date(r.dateOfBirth).getFullYear();
    return age >= 60 || r.isElderly;
  }).length;

  // Active campaign
  const activeCampaign = campaigns.find(c => c.status === 'DISTRIBUTING') || campaigns[0];
  const deliveredPercentage = activeCampaign && activeCampaign.totalQuantity > 0
    ? Math.min(100, Math.round(((activeCampaign.deliveredCount || 0) / activeCampaign.totalQuantity) * 100))
    : 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs text-on-surface-variant font-medium">Đang tải dữ liệu điều hành Ấp...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Welcome Banner */}
      <div className="bg-surface-container-low border border-surface-container-high rounded-3xl p-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-primary text-white uppercase tracking-wider">
                Trung tâm chỉ huy
              </span>
              <span className="text-xs text-on-surface-variant font-medium">
                Cập nhật lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h2 className="font-headline-lg font-bold text-on-surface mt-1.5">
              Hệ thống Hành chính & Quản lý Dân cư {settings.hamletName}
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Địa bàn {settings.communeName}, {settings.districtName}. Trưởng ấp điều hành: <span className="font-semibold text-on-surface">{settings.hamletLeaderName}</span>
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {hasPerm('residents.create') && (
              <button
                onClick={onOpenNewResident}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-98"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>Thêm nhân khẩu</span>
              </button>
            )}
            {hasPerm('finance.create') && (
              <button
                onClick={onOpenNewIncome}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 text-white text-xs font-semibold hover:bg-emerald-900 transition-all shadow-xs active:scale-98"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Lập Phiếu Thu</span>
              </button>
            )}
            {hasPerm('finance.create') && (
              <button
                onClick={onOpenNewExpense}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 transition-all shadow-xs active:scale-98"
              >
                <span className="material-symbols-outlined text-base">remove_circle</span>
                <span>Lập Phiếu Chi</span>
              </button>
            )}
            <button
              onClick={onOpenQRScanner}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-all border border-surface-container-highest"
            >
              <span className="material-symbols-outlined text-base">qr_code_scanner</span>
              <span>Quét mã đối soát</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Dân số & Hộ */}
        <div
          onClick={() => onNavigate('residents')}
          className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-xs hover:border-primary/40 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Dân cư cơ sở
            </span>
            <div className="w-8 h-8 rounded-xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">groups</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-on-surface font-numeric-data">
              {residents.length}{' '}
              <span className="text-xs font-medium text-on-surface-variant">nhân khẩu</span>
            </div>
            <div className="text-xs text-on-surface-variant mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-primary">{households.length}</span> hộ gia đình
              <span>•</span>
              <span>{poorCount + nearPoorCount} hộ nghèo/cận nghèo</span>
            </div>
          </div>
        </div>

        {/* Card 2: Sổ quỹ tiền mặt */}
        <div
          onClick={() => onNavigate('finance')}
          className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-xs hover:border-emerald-600/40 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Tồn quỹ tiền mặt
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-black text-emerald-800 font-numeric-data">
              {formatCurrencyVND(currentBalance)}
            </div>
            <div className="text-xs text-on-surface-variant mt-1 flex items-center justify-between">
              <span>Thu: {formatCurrencyVND(totalIncome)}</span>
              <span>Chi: {formatCurrencyVND(totalExpense)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Quà An Sinh */}
        <div
          onClick={() => onNavigate('gifts')}
          className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-xs hover:border-amber-600/40 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              An sinh & Quà tặng
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">redeem</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-on-surface font-numeric-data">
              {activeCampaign ? `${activeCampaign.deliveredCount || 0}/${activeCampaign.totalQuantity}` : '0'}{' '}
              <span className="text-xs font-medium text-on-surface-variant">suất</span>
            </div>
            <div className="mt-2">
              <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-secondary h-1.5 rounded-full transition-all"
                  style={{ width: `${deliveredPercentage}%` }}
                ></div>
              </div>
              <div className="text-[11px] text-on-surface-variant mt-1 flex justify-between">
                <span>Tiến độ phát</span>
                <span className="font-bold text-secondary">{deliveredPercentage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card 4: Hồ sơ & Duyệt */}
        <div
          onClick={() => onNavigate('finance')}
          className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high shadow-xs hover:border-primary/40 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
              Phiếu chờ duyệt
            </span>
            <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">pending_actions</span>
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-800 font-numeric-data">
              {pendingDraftCount}{' '}
              <span className="text-xs font-medium text-on-surface-variant">chứng từ</span>
            </div>
            <div className="text-xs text-on-surface-variant mt-1">
              {pendingDraftCount > 0
                ? 'Cần Trưởng ấp đối soát và phê duyệt'
                : 'Sổ quỹ hiện đã đối soát hoàn tất'}
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Demographics & Recent Audit Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Phân loại Dân cư & Chính sách */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">
                Cơ cấu Dân cư & Diện Chính sách
              </h3>
              <p className="text-xs text-on-surface-variant">Số liệu thống kê nhân khẩu Ấp Bình Hòa</p>
            </div>
            <button
              onClick={() => onNavigate('residents')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Xem chi tiết
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Nam / Nữ</div>
              <div className="text-lg font-bold text-on-surface mt-1 font-numeric-data">
                {maleCount} / {femaleCount}
              </div>
              <div className="text-[11px] text-primary font-medium mt-0.5">
                {residents.length ? Math.round((maleCount / residents.length) * 100) : 0}% Nam
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Người cao tuổi (≥60)</div>
              <div className="text-lg font-bold text-amber-800 mt-1 font-numeric-data">
                {elderlyCount}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">Được ưu tiên an sinh</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Gia đình chính sách</div>
              <div className="text-lg font-bold text-primary mt-1 font-numeric-data">
                {policyCount}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">Thương binh / Liệt sĩ</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Hộ nghèo</div>
              <div className="text-lg font-bold text-red-800 mt-1 font-numeric-data">
                {poorCount}
              </div>
              <div className="text-[11px] text-red-700 mt-0.5 font-medium">Hưởng trợ cấp 100%</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Hộ cận nghèo</div>
              <div className="text-lg font-bold text-orange-800 mt-1 font-numeric-data">
                {nearPoorCount}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">Hỗ trợ BHYT</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high">
              <div className="text-xs text-on-surface-variant">Sổ hộ gia đình</div>
              <div className="text-lg font-bold text-slate-800 mt-1 font-numeric-data">
                {households.length}
              </div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">8 Tổ dân cư</div>
            </div>
          </div>
        </div>

        {/* Right: Hoạt động Kiểm toán gần đây */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 border border-surface-container-high space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">
                Nhật ký Hoạt động Cơ sở
              </h3>
              <p className="text-xs text-on-surface-variant">Lịch sử thao tác nghiệp vụ của cán bộ</p>
            </div>
            <button
              onClick={() => onNavigate('settings')}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Toàn bộ nhật ký
            </button>
          </div>

          <div className="space-y-3">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-on-surface-variant text-center py-6">Chưa có nhật ký hoạt động nào.</p>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 text-xs">
                  <div className="w-6 h-6 rounded-lg bg-surface-container flex items-center justify-center shrink-0 text-primary mt-0.5">
                    <span className="material-symbols-outlined text-sm">
                      {log.action === 'CREATE'
                        ? 'add'
                        : log.action === 'APPROVE'
                        ? 'check'
                        : log.action === 'UPDATE'
                        ? 'edit'
                        : log.action === 'CANCEL'
                        ? 'close'
                        : 'history'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-on-surface truncate">{log.description}</p>
                    <div className="text-[11px] text-on-surface-variant flex items-center gap-2 mt-0.5">
                      <span className="font-medium text-slate-700">{log.userName}</span>
                      <span>•</span>
                      <span>{log.timestamp ? formatDateVN(log.timestamp) : ''}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
