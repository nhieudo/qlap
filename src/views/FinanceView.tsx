import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  getFinanceTransactions,
  getFinanceCategories,
  getCategoryUsageCounts,
  createFinanceTransaction,
  updateFinanceTransaction,
  approveFinanceTransaction,
  cancelFinanceTransaction,
} from '../services/db';
import { FinanceTransaction, FinanceCategory, TransactionType } from '../types';
import { formatCurrencyVND, formatDateVN, convertNumberToWords } from '../utils/numberToWords';
import { exportFinanceToExcel } from '../utils/excelExport';
import { VoucherA4Modal } from '../components/VoucherA4Modal';
import { ConfirmModal } from '../components/ConfirmModal';
import { ReconciliationModal } from '../components/ReconciliationModal';
import FinanceCategoryManagerModal from '../components/FinanceCategoryManagerModal';

interface FinanceViewProps {
  initialOpenIncome?: boolean;
  initialOpenExpense?: boolean;
  onResetInitialModals?: () => void;
}

export function FinanceView({
  initialOpenIncome,
  initialOpenExpense,
  onResetInitialModals,
}: FinanceViewProps) {
  const { user, userProfile, hasPerm } = useAuth();
  const { settings } = useSettings();

  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE' | 'DRAFT' | 'APPROVED' | 'CANCELLED'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // A4 Modal
  const [selectedVoucherForA4, setSelectedVoucherForA4] = useState<FinanceTransaction | null>(null);

  // Reconciliation Modal
  const [isReconModalOpen, setIsReconModalOpen] = useState(false);

  // Category Manager Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryUsageCounts, setCategoryUsageCounts] = useState<{ [key: string]: number }>({});

  // Create / Edit Voucher Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<FinanceTransaction | null>(null);
  const [txType, setTxType] = useState<TransactionType>('INCOME');
  const [personName, setPersonName] = useState('');
  const [address, setAddress] = useState('Ấp Bình Hòa, Xã An Nhơn Tây');
  const [groupNumber, setGroupNumber] = useState('Tổ 1');
  const [txDate, setTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [amount, setAmount] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Tiền mặt tại Ấp' | 'Chuyển khoản QR'>('Tiền mặt tại Ấp');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cancel Voucher Modal
  const [cancelTarget, setCancelTarget] = useState<FinanceTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  // Category RBAC helpers
  const canViewCategory = (c: FinanceCategory) => {
    if (!userProfile) return true;
    if (userProfile.roleId === 'ADMIN' || userProfile.roleId === 'PARTY_SECRETARY' || userProfile.roleId === 'HAMLET_LEADER') return true;
    if (!c.viewRoles || c.viewRoles.length === 0) return true;
    return c.viewRoles.includes(userProfile.roleId);
  };

  const canUseCategory = (c: FinanceCategory) => {
    if (!userProfile) return true;
    if (userProfile.roleId === 'ADMIN' || userProfile.roleId === 'PARTY_SECRETARY' || userProfile.roleId === 'HAMLET_LEADER') return true;
    if (!c.editRoles || c.editRoles.length === 0) return true;
    return c.editRoles.includes(userProfile.roleId);
  };

  const visibleCategories = useMemo(() => {
    return categories.filter(canViewCategory);
  }, [categories, userProfile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [txList, catList, counts] = await Promise.all([
        getFinanceTransactions(),
        getFinanceCategories(),
        getCategoryUsageCounts(),
      ]);
      setTransactions(txList);
      setCategories(catList);
      setCategoryUsageCounts(counts);
      if (catList.length > 0 && !categoryId) {
        setCategoryId(catList[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialOpenIncome) {
      openCreateModal('INCOME');
      onResetInitialModals?.();
    } else if (initialOpenExpense) {
      openCreateModal('EXPENSE');
      onResetInitialModals?.();
    }
  }, [initialOpenIncome, initialOpenExpense]);

  // Available groups for selection and custom addition
  const availableGroups = useMemo(() => {
    const base = ['Tổ 1', 'Tổ 2', 'Tổ 3', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8'];
    const fromTx = transactions.map((t) => t.groupNumber).filter(Boolean);
    return Array.from(new Set([...base, ...fromTx]));
  }, [transactions]);

  const openCreateModal = (type: TransactionType) => {
    setEditingTransaction(null);
    setTxType(type);
    setPersonName('');
    const defaultAddr = `${settings.hamletName || 'Ấp Bình Hòa'}, ${settings.communeName || 'Xã An Nhơn Tây'}`;
    setAddress(defaultAddr);
    setGroupNumber('Tổ 1');
    setTxDate(new Date().toISOString().split('T')[0]);
    setAmount('');
    setDescription('');
    setPaymentMethod('Tiền mặt tại Ấp');
    // Select first matching category
    const matchCat = categories.find((c) => c.type === type);
    if (matchCat) setCategoryId(matchCat.id);
    setErrorMsg(null);
    setIsCreateModalOpen(true);
  };

  const openEditModal = (tx: FinanceTransaction) => {
    setEditingTransaction(tx);
    setTxType(tx.transactionType);
    setPersonName(tx.personName);
    setAddress(tx.address || `${settings.hamletName || 'Ấp'}, ${settings.communeName || 'Xã'}`);
    setGroupNumber(tx.groupNumber || 'Tổ 1');
    setTxDate(tx.transactionDate || new Date().toISOString().split('T')[0]);
    setAmount(tx.amount);
    setDescription(tx.description);
    setPaymentMethod((tx.paymentMethod as 'Tiền mặt tại Ấp' | 'Chuyển khoản QR') || 'Tiền mặt tại Ấp');
    setCategoryId(tx.categoryId);
    setErrorMsg(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveTransaction = async (e: FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên người nộp/nhận.');
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setErrorMsg('Số tiền chứng từ phải lớn hơn 0.');
      return;
    }
    if (!categoryId) {
      setErrorMsg('Vui lòng chọn hạng mục quỹ.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const catObj = categories.find((c) => c.id === categoryId);
      const catName = catObj ? catObj.name : 'Khác';

      if (editingTransaction) {
        await updateFinanceTransaction(
          editingTransaction.id,
          {
            transactionType: txType,
            transactionDate: txDate,
            personName: personName.trim(),
            address: address.trim(),
            groupNumber: groupNumber.trim(),
            description: description.trim() || `${txType === 'INCOME' ? 'Thu' : 'Chi'} ${catName}`,
            amount: numAmount,
            amountInWords: convertNumberToWords(numAmount),
            categoryId,
            categoryName: catName,
            paymentMethod,
          },
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      } else {
        await createFinanceTransaction(
          {
            transactionType: txType,
            transactionDate: txDate,
            personName: personName.trim(),
            address: address.trim(),
            groupNumber: groupNumber.trim(),
            description: description.trim() || `${txType === 'INCOME' ? 'Thu' : 'Chi'} ${catName}`,
            amount: numAmount,
            categoryId,
            categoryName: catName,
            paymentMethod,
            status: 'DRAFT',
            preparedBy: userProfile?.fullName || 'Kế toán',
            createdBy: userProfile?.fullName || 'Kế toán',
            updatedBy: userProfile?.fullName || 'Kế toán',
          },
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      }

      setIsCreateModalOpen(false);
      setEditingTransaction(null);
      await loadData();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Lỗi khi lưu chứng từ.');
    } finally {
      setSaving(false);
    }
  };

  // Approval
  const handleApprove = async (tx: FinanceTransaction) => {
    try {
      await approveFinanceTransaction(
        tx.id,
        user?.uid || 'user',
        userProfile?.fullName || settings.hamletLeaderName || 'Trưởng ấp'
      );
      await loadData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  // Cancel voucher
  const handleCancelConfirm = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    try {
      await cancelFinanceTransaction(
        cancelTarget.id,
        cancelReason.trim(),
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setCancelTarget(null);
      setCancelReason('');
      await loadData();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  // Financial summary numbers
  const approvedTx = transactions.filter((t) => t.status === 'APPROVED');
  const totalIncome = approvedTx
    .filter((t) => t.transactionType === 'INCOME')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpense = approvedTx
    .filter((t) => t.transactionType === 'EXPENSE')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
  const currentBalance = totalIncome - totalExpense;
  const draftCount = transactions.filter((t) => t.status === 'DRAFT').length;

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // Active filter tab
      if (activeFilter === 'INCOME' && t.transactionType !== 'INCOME') return false;
      if (activeFilter === 'EXPENSE' && t.transactionType !== 'EXPENSE') return false;
      if (activeFilter === 'DRAFT' && t.status !== 'DRAFT') return false;
      if (activeFilter === 'APPROVED' && t.status !== 'APPROVED') return false;
      if (activeFilter === 'CANCELLED' && t.status !== 'CANCELLED') return false;

      // Category
      if (selectedCategory !== 'ALL' && t.categoryId !== selectedCategory) return false;

      // Search
      if (search) {
        const s = search.toLowerCase();
        const match =
          t.voucherNumber.toLowerCase().includes(s) ||
          t.reconciliationCode.toLowerCase().includes(s) ||
          t.personName.toLowerCase().includes(s) ||
          t.description.toLowerCase().includes(s) ||
          t.categoryName.toLowerCase().includes(s);
        if (!match) return false;
      }

      return true;
    });
  }, [transactions, activeFilter, selectedCategory, search]);

  return (
    <div className="space-y-6 pb-20 min-w-0 max-w-full">
      {/* Top Header and Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-surface-container-high pb-4 min-w-0">
        <div className="min-w-0">
          <h2 className="font-headline-lg font-bold text-on-surface text-lg sm:text-xl md:text-2xl tracking-tight">
            Sổ Quỹ Tiền Mặt & Quản Lý Chứng Từ
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Theo dõi dòng tiền thu chi, đối soát mã hóa và in phiếu chuẩn Mẫu C40-BB
          </p>
        </div>

        {/* Action Buttons Cluster */}
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          {/* Secondary Utilities */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors shadow-2xs whitespace-nowrap cursor-pointer"
              title="Quản lý danh mục thu/chi và phân quyền xem/chỉnh sửa/xóa"
            >
              <span className="material-symbols-outlined text-base text-primary">category</span>
              <span>Danh Mục Quỹ</span>
            </button>
            <button
              type="button"
              onClick={() => setIsReconModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors whitespace-nowrap cursor-pointer"
              title="Đối chiếu mã chứng từ và kiểm tra tính hợp lệ"
            >
              <span className="material-symbols-outlined text-base text-primary">fact_check</span>
              <span>Đối Chiếu Mã</span>
            </button>
            {hasPerm('finance.export') && (
              <button
                type="button"
                onClick={() => exportFinanceToExcel(filteredTransactions)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors whitespace-nowrap cursor-pointer"
                title="Xuất Sổ Quỹ ra định dạng Excel (.xlsx)"
              >
                <span className="material-symbols-outlined text-base text-emerald-700">file_download</span>
                <span>Xuất Excel</span>
              </button>
            )}
          </div>

          {/* Primary Create Actions */}
          {hasPerm('finance.create') && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openCreateModal('INCOME')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold transition-all shadow-xs active:scale-98 whitespace-nowrap cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Lập Phiếu Thu</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('EXPENSE')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition-all shadow-xs active:scale-98 whitespace-nowrap cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">remove_circle</span>
                <span>Lập Phiếu Chi</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-xs min-w-0">
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider truncate">
            Tồn quỹ thực tế
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-800 font-numeric-data mt-2 truncate">
            {formatCurrencyVND(currentBalance)}
          </div>
          <div className="text-[11px] text-on-surface-variant mt-1 truncate">
            Số dư tiền mặt đã kiểm toán
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-xs min-w-0">
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider truncate">
            Tổng thu lũy kế
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-numeric-data mt-2 truncate">
            {formatCurrencyVND(totalIncome)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1 truncate">
            Đã duyệt: {approvedTx.filter((t) => t.transactionType === 'INCOME').length} phiếu
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-xs min-w-0">
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider truncate">
            Tổng chi lũy kế
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-800 font-numeric-data mt-2 truncate">
            {formatCurrencyVND(totalExpense)}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1 truncate">
            Đã duyệt: {approvedTx.filter((t) => t.transactionType === 'EXPENSE').length} phiếu
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border border-surface-container-high shadow-xs min-w-0">
          <div className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider truncate">
            Bản nháp chờ duyệt
          </div>
          <div className="text-xl sm:text-2xl font-black text-orange-800 font-numeric-data mt-2 truncate">
            {draftCount} <span className="text-xs font-medium text-slate-600">phiếu</span>
          </div>
          <div className="text-[11px] text-orange-700 font-medium mt-1 truncate">
            {draftCount > 0 ? 'Cần Trưởng ấp ký duyệt' : 'Đã duyệt toàn bộ'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high space-y-3 shadow-xs">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">
              search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo số phiếu (PT-..., PC-...), mã đối soát, họ tên, nội dung chi..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-1.5 min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="flex-1 sm:flex-initial px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium text-on-surface max-w-full sm:max-w-xs truncate cursor-pointer"
            >
              <option value="ALL">Tất cả hạng mục ({visibleCategories.length})</option>
              {visibleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === 'INCOME' ? '[Thu]' : '[Chi]'} {c.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="p-2 rounded-xl border border-surface-container-highest bg-surface hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors shrink-0 cursor-pointer"
              title="Cài đặt và phân quyền danh mục thu/chi"
            >
              <span className="material-symbols-outlined text-base">settings</span>
            </button>
          </div>
        </div>

        {/* Tab Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'ALL', label: 'Tất cả' },
            { id: 'INCOME', label: 'Phiếu Thu' },
            { id: 'EXPENSE', label: 'Phiếu Chi' },
            { id: 'DRAFT', label: `Chờ duyệt (${draftCount})` },
            { id: 'APPROVED', label: 'Đã phê duyệt' },
            { id: 'CANCELLED', label: 'Đã hủy bỏ' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                activeFilter === tab.id
                  ? 'bg-primary text-white shadow-2xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transaction Table */}
      <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high overflow-hidden shadow-xs min-w-0 max-w-full">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-left border-collapse text-xs min-w-[720px]">
            <thead>
              <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-semibold">
                <th className="py-3 px-4 w-32">Số chứng từ</th>
                <th className="py-3 px-4 w-24">Loại</th>
                <th className="py-3 px-4">Ngày</th>
                <th className="py-3 px-4">Người nộp / nhận</th>
                <th className="py-3 px-4">Hạng mục quỹ</th>
                <th className="py-3 px-4">Số tiền</th>
                <th className="py-3 px-4">Trạng thái</th>
                <th className="py-3 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    Đang tải sổ quỹ...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-on-surface-variant">
                    Không tìm thấy chứng từ tài chính nào.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((tx) => (
                  <tr key={tx.id} className="hover:bg-surface-container-low/60 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-primary">{tx.voucherNumber}</div>
                      <div className="font-mono text-[10px] text-slate-500 bg-surface-container px-1 rounded-sm mt-0.5 inline-block">
                        {tx.reconciliationCode}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          tx.transactionType === 'INCOME'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {tx.transactionType === 'INCOME' ? 'Thu' : 'Chi'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-numeric-data">
                      {formatDateVN(tx.transactionDate)}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-on-surface">{tx.personName}</div>
                      <div className="text-[11px] text-on-surface-variant truncate max-w-xs">
                        {tx.description}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">
                      {tx.categoryName}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-sm">
                      <span
                        className={
                          tx.transactionType === 'INCOME' ? 'text-emerald-800' : 'text-amber-900'
                        }
                      >
                        {tx.transactionType === 'INCOME' ? '+' : '-'} {formatCurrencyVND(tx.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          tx.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : tx.status === 'DRAFT'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {tx.status === 'APPROVED'
                          ? 'Đã duyệt'
                          : tx.status === 'DRAFT'
                          ? 'Bản nháp'
                          : 'Đã hủy'}
                      </span>
                      {tx.status === 'APPROVED' && tx.approvedBy && (
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          Duyệt: {tx.approvedBy}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Print / View A4 */}
                        <button
                          onClick={() => setSelectedVoucherForA4(tx)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold border border-surface-container-highest transition-colors"
                          title="Xem & In phiếu A4"
                        >
                          <span className="material-symbols-outlined text-sm text-primary">
                            description
                          </span>
                          <span>In A4</span>
                        </button>

                        {/* Edit Button */}
                        {tx.status !== 'CANCELLED' && hasPerm('finance.create') && (
                          <button
                            onClick={() => openEditModal(tx)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface text-[11px] font-semibold border border-surface-container-highest transition-colors"
                            title="Chỉnh sửa chứng từ"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            <span>Sửa</span>
                          </button>
                        )}

                        {/* Approve Button */}
                        {tx.status === 'DRAFT' && hasPerm('finance.approve') && (
                          <button
                            onClick={() => handleApprove(tx)}
                            className="flex items-center gap-0.5 px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-semibold transition-colors"
                            title="Phê duyệt chứng từ"
                          >
                            <span className="material-symbols-outlined text-sm">check</span>
                            <span>Duyệt</span>
                          </button>
                        )}

                        {/* Cancel Button */}
                        {tx.status !== 'CANCELLED' && hasPerm('finance.cancel') && (
                          <button
                            onClick={() => {
                              setCancelTarget(tx);
                              setCancelReason('');
                            }}
                            className="p-1 rounded-lg hover:bg-red-100 text-slate-500 hover:text-red-700 transition-colors"
                            title="Hủy chứng từ"
                          >
                            <span className="material-symbols-outlined text-base">block</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create Voucher */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-xl w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center text-white ${
                    txType === 'INCOME' ? 'bg-emerald-700' : 'bg-amber-700'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">
                    {txType === 'INCOME' ? 'add' : 'remove'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm font-bold text-on-surface">
                    {editingTransaction
                      ? `Sửa ${txType === 'INCOME' ? 'Phiếu Thu' : 'Phiếu Chi'}: ${editingTransaction.voucherNumber}`
                      : txType === 'INCOME'
                      ? 'Lập Phiếu Thu Quỹ'
                      : 'Lập Phiếu Chi Quỹ'}
                  </h3>
                  <p className="text-xs text-on-surface-variant">
                    {editingTransaction
                      ? 'Cập nhật thông tin giao dịch tài chính'
                      : 'Chứng từ sẽ được lưu dạng bản nháp để Trưởng ấp ký duyệt'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 bg-surface-container p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setTxType('INCOME')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    txType === 'INCOME' ? 'bg-emerald-800 text-white shadow-xs' : 'text-on-surface-variant'
                  }`}
                >
                  Phiếu Thu Quỹ (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType('EXPENSE')}
                  className={`py-2 rounded-xl text-xs font-bold transition-all ${
                    txType === 'EXPENSE' ? 'bg-amber-800 text-white shadow-xs' : 'text-on-surface-variant'
                  }`}
                >
                  Phiếu Chi Quỹ (-)
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Ngày chứng từ <span className="text-error">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Phương thức thanh toán
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(e.target.value as 'Tiền mặt tại Ấp' | 'Chuyển khoản QR')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="Tiền mặt tại Ấp">Tiền mặt tại Ấp</option>
                    <option value="Chuyển khoản QR">Chuyển khoản QR</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  {txType === 'INCOME' ? 'Họ tên người nộp tiền' : 'Họ tên người nhận tiền'}{' '}
                  <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  placeholder="Ví dụ: Lê Văn Sáu"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tổ dân cư
                  </label>
                  <input
                    type="text"
                    list="financeGroupList"
                    value={groupNumber}
                    onChange={(e) => setGroupNumber(e.target.value)}
                    placeholder="VD: Tổ 1 hoặc nhập tổ mới..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="financeGroupList">
                    {availableGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Hạng mục thu/chi <span className="text-error">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    {visibleCategories
                      .filter((c) => c.type === txType)
                      .map((c) => {
                        const canUse = canUseCategory(c);
                        return (
                          <option key={c.id} value={c.id} disabled={!canUse}>
                            {c.name} {!canUse ? '(Giới hạn quyền lập)' : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Số nhà, hẻm, đường tại Ấp Bình Hòa"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              {/* Amount and Auto Vietnamese Words */}
              <div className="bg-surface-container-low p-4 rounded-2xl border border-surface-container-high space-y-2">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số tiền (VNĐ) <span className="text-error">*</span>
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                    placeholder="Ví dụ: 200000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-white font-mono text-base font-bold text-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Auto Words Preview */}
                <div className="text-xs text-on-surface-variant leading-relaxed">
                  <span className="font-semibold text-slate-700">Viết bằng chữ:</span>{' '}
                  <span className="font-bold text-primary italic">
                    {amount ? convertNumberToWords(amount) : 'Không đồng chẵn.'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Nội dung / Lý do diễn giải
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ví dụ: Đóng góp Quỹ An ninh trật tự & Chiếu sáng ngõ xóm năm 2026..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                >
                  {saving ? 'Đang tạo...' : 'Lưu chứng từ (Bản nháp)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cancel Voucher */}
      <ConfirmModal
        isOpen={!!cancelTarget}
        title="Hủy bỏ chứng từ tài chính"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn hủy chứng từ ${cancelTarget?.voucherNumber} (${cancelTarget?.reconciliationCode}) số tiền ${formatCurrencyVND(cancelTarget?.amount)}? Theo quy định, chứng từ đã duyệt không thể xóa vật lý khỏi cơ sở dữ liệu mà chỉ chuyển trạng thái ĐÃ HỦY kèm lý do giải trình.`}
        confirmText="Xác nhận hủy chứng từ"
        onConfirm={handleCancelConfirm}
        onCancel={() => setCancelTarget(null)}
      >
        <div>
          <label className="block text-xs font-semibold text-on-surface mb-1">
            Lý do hủy bỏ chứng từ (Bắt buộc):
          </label>
          <input
            type="text"
            required
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Ví dụ: Lập nhầm họ tên, hủy theo yêu cầu đối soát..."
            className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
          />
        </div>
      </ConfirmModal>

      {/* A4 Modal */}
      <VoucherA4Modal
        isOpen={!!selectedVoucherForA4}
        transaction={selectedVoucherForA4}
        settings={settings}
        onClose={() => setSelectedVoucherForA4(null)}
      />

      {/* Reconciliation Modal */}
      <ReconciliationModal
        isOpen={isReconModalOpen}
        onClose={() => setIsReconModalOpen(false)}
        onViewVoucher={(tx) => setSelectedVoucherForA4(tx)}
        settings={settings}
      />

      {/* Category Manager & RBAC Modal */}
      <FinanceCategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        usageCounts={categoryUsageCounts}
        userProfile={userProfile}
        user={user}
        hasPerm={hasPerm}
        onRefresh={loadData}
      />
    </div>
  );
}
