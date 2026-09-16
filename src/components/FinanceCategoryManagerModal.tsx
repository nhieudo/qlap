import { useState, useMemo, FormEvent } from 'react';
import { FinanceCategory, Role, TransactionType, UserProfile } from '../types';
import {
  createFinanceCategory,
  updateFinanceCategory,
  deleteFinanceCategory,
} from '../services/db';
import { DEFAULT_ROLES } from '../utils/rbac';
import { formatCurrencyVND } from '../utils/numberToWords';
import ConfirmModal from './ConfirmModal';

interface FinanceCategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: FinanceCategory[];
  usageCounts: Record<string, number>;
  onRefresh: () => Promise<void>;
  user?: { uid: string } | null;
  userProfile?: UserProfile | null;
  userRoleId?: string;
  hasPerm?: (perm: any) => boolean;
}

export default function FinanceCategoryManagerModal({
  isOpen,
  onClose,
  categories,
  usageCounts,
  onRefresh,
  user = null,
  userProfile = null,
  userRoleId,
  hasPerm = () => true,
}: FinanceCategoryManagerModalProps) {
  const [filterType, setFilterType] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing or creating state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<FinanceCategory | null>(null);
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TransactionType>('INCOME');
  const [formSuggestedAmount, setFormSuggestedAmount] = useState<number | ''>('');
  const [formDescription, setFormDescription] = useState('');

  // Per-category permission controls
  const [restrictView, setRestrictView] = useState(false);
  const [selectedViewRoles, setSelectedViewRoles] = useState<string[]>([]);

  const [restrictEdit, setRestrictEdit] = useState(false);
  const [selectedEditRoles, setSelectedEditRoles] = useState<string[]>([]);

  const [restrictDelete, setRestrictDelete] = useState(false);
  const [selectedDeleteRoles, setSelectedDeleteRoles] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Deletion confirm
  const [deleteTarget, setDeleteTarget] = useState<FinanceCategory | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // All available system roles for assignment
  const systemRoles: Role[] = useMemo(() => DEFAULT_ROLES, []);

  // Filtered categories
  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (filterType !== 'ALL' && c.type !== filterType) return false;
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        const match =
          c.name.toLowerCase().includes(s) ||
          (c.description && c.description.toLowerCase().includes(s));
        if (!match) return false;
      }
      return true;
    });
  }, [categories, filterType, searchTerm]);

  if (!isOpen) return null;

  const openCreateForm = () => {
    setEditingCategory(null);
    setFormName('');
    setFormType('INCOME');
    setFormSuggestedAmount('');
    setFormDescription('');
    setRestrictView(false);
    setSelectedViewRoles([]);
    setRestrictEdit(false);
    setSelectedEditRoles(['PARTY_SECRETARY', 'HAMLET_LEADER', 'SECRETARY', 'ADMIN']);
    setRestrictDelete(false);
    setSelectedDeleteRoles(['PARTY_SECRETARY', 'HAMLET_LEADER', 'ADMIN']);
    setFormError(null);
    setIsFormOpen(true);
  };

  const openEditForm = (cat: FinanceCategory) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormType(cat.type);
    setFormSuggestedAmount(cat.suggestedAmount ?? '');
    setFormDescription(cat.description || '');

    const hasViewRoles = Array.isArray(cat.viewRoles) && cat.viewRoles.length > 0;
    setRestrictView(hasViewRoles);
    setSelectedViewRoles(hasViewRoles ? cat.viewRoles! : []);

    const hasEditRoles = Array.isArray(cat.editRoles) && cat.editRoles.length > 0;
    setRestrictEdit(hasEditRoles);
    setSelectedEditRoles(
      hasEditRoles
        ? cat.editRoles!
        : ['PARTY_SECRETARY', 'HAMLET_LEADER', 'SECRETARY', 'ADMIN']
    );

    const hasDeleteRoles = Array.isArray(cat.deleteRoles) && cat.deleteRoles.length > 0;
    setRestrictDelete(hasDeleteRoles);
    setSelectedDeleteRoles(
      hasDeleteRoles ? cat.deleteRoles! : ['PARTY_SECRETARY', 'HAMLET_LEADER', 'ADMIN']
    );

    setFormError(null);
    setIsFormOpen(true);
  };

  const toggleRoleSelection = (
    list: string[],
    setList: (val: string[]) => void,
    roleId: string
  ) => {
    if (list.includes(roleId)) {
      setList(list.filter((r) => r !== roleId));
    } else {
      setList([...list, roleId]);
    }
  };

  const handleSaveForm = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Vui lòng nhập tên danh mục thu/chi.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const payload: Partial<FinanceCategory> = {
        name: formName.trim(),
        type: formType,
        description: formDescription.trim(),
        suggestedAmount:
          formSuggestedAmount !== '' && !isNaN(Number(formSuggestedAmount))
            ? Number(formSuggestedAmount)
            : undefined,
        viewRoles: restrictView ? selectedViewRoles : [],
        editRoles: restrictEdit ? selectedEditRoles : [],
        deleteRoles: restrictDelete ? selectedDeleteRoles : [],
        isCustom: true,
      };

      if (editingCategory) {
        await updateFinanceCategory(
          editingCategory.id,
          payload,
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      } else {
        await createFinanceCategory(
          payload as any,
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      }

      await onRefresh();
      setIsFormOpen(false);
      setEditingCategory(null);
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu danh mục thu/chi.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (cat: FinanceCategory) => {
    const count =
      (usageCounts[cat.id] || 0) + (usageCounts[`name:${cat.name.trim()}`] || 0);

    if (count > 0) {
      setDeleteError(
        `Không thể xóa danh mục "${cat.name}" vì hiện đang có ${count} chứng từ thu/chi sử dụng danh mục này. Theo quy định tài chính, hệ thống không cho phép xóa danh mục khi có dữ liệu bên trong!`
      );
      return;
    }

    // Check delete permission for this category
    if (
      cat.deleteRoles &&
      cat.deleteRoles.length > 0 &&
      userRoleId &&
      !cat.deleteRoles.includes(userRoleId) &&
      !['ADMIN', 'PARTY_SECRETARY', 'HAMLET_LEADER'].includes(userRoleId)
    ) {
      setDeleteError(
        `Bạn không có quyền xóa danh mục "${cat.name}". Chỉ các vai trò được phân quyền mới có thể xóa!`
      );
      return;
    }

    setDeleteError(null);
    setDeleteTarget(cat);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteFinanceCategory(
        deleteTarget.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      await onRefresh();
      setDeleteTarget(null);
    } catch (err: any) {
      setDeleteError(err.message || 'Lỗi khi xóa danh mục.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  // Helper to get role display name
  const getRoleName = (roleId: string) => {
    const r = systemRoles.find((sr) => sr.id === roleId);
    return r ? r.name : roleId;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-surface-container-high bg-surface-container-low flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary-fixed text-on-primary-fixed flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">category</span>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-on-surface flex items-center gap-2">
                <span>Quản Lý Danh Mục Thu / Chi & Phân Quyền Hạng Mục</span>
              </h3>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Chỉ định quyền xem, sửa, xóa từng danh mục và kiểm soát an toàn dữ liệu thu chi
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

        {/* Global Error Banner */}
        {deleteError && (
          <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-900 flex items-start justify-between gap-2 animate-in fade-in">
            <div className="flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-red-700 mt-0.5">
                warning
              </span>
              <div>
                <span className="font-bold">Cảnh báo bảo toàn dữ liệu:</span> {deleteError}
              </div>
            </div>
            <button
              onClick={() => setDeleteError(null)}
              className="p-1 hover:bg-red-100 rounded-lg text-red-700"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>
        )}

        {/* Content View: Category List OR Form */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {isFormOpen ? (
            /* ADD / EDIT CATEGORY FORM */
            <form onSubmit={handleSaveForm} className="space-y-5">
              <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
                <h4 className="font-bold text-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">
                    {editingCategory ? 'edit_note' : 'add_circle'}
                  </span>
                  <span>
                    {editingCategory
                      ? `Chỉnh Sửa Danh Mục: ${editingCategory.name}`
                      : 'Tạo Danh Mục Thu / Chi Mới'}
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="text-xs text-on-surface-variant hover:text-on-surface font-medium"
                >
                  ← Quay lại danh sách
                </button>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tên danh mục / hạng mục quỹ <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="VD: Quỹ Vì Người Nghèo, Chi sửa chữa nhà văn hóa, ..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Phân loại nghiệp vụ <span className="text-error">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormType('INCOME')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        formType === 'INCOME'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-2xs'
                          : 'bg-surface border-surface-container-highest text-slate-700 hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">add_circle</span>
                      <span>Khoản Thu (Phiếu Thu)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType('EXPENSE')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                        formType === 'EXPENSE'
                          ? 'bg-amber-800 text-white border-amber-900 shadow-2xs'
                          : 'bg-surface border-surface-container-highest text-slate-700 hover:bg-surface-container'
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">remove_circle</span>
                      <span>Khoản Chi (Phiếu Chi)</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số tiền gợi ý mặc định (VNĐ)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    value={formSuggestedAmount}
                    onChange={(e) =>
                      setFormSuggestedAmount(
                        e.target.value === '' ? '' : Number(e.target.value)
                      )
                    }
                    placeholder="Không bắt buộc (VD: 100000)"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20 font-numeric-data"
                  />
                  {formSuggestedAmount !== '' && (
                    <div className="text-[11px] text-primary mt-1 font-semibold">
                      {formatCurrencyVND(Number(formSuggestedAmount))}
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Diễn giải / Ghi chú mục đích sử dụng
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Mô tả nguồn vận động, quy chế sử dụng quỹ..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* PER-CATEGORY PERMISSION CONFIGURATION */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-surface-container space-y-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-lg">
                    verified_user
                  </span>
                  <h5 className="font-bold text-xs text-on-surface uppercase tracking-wider">
                    Chỉ định Quyền Truy Cập Danh Mục Này (Xem / Sửa / Xóa)
                  </h5>
                </div>
                <p className="text-[11px] text-on-surface-variant">
                  Cấu hình vai trò cụ thể được phép thao tác với danh mục này. Nếu không giới hạn, tất cả cán bộ có quyền tài chính đều được thao tác theo quy định chung.
                </p>

                {/* 1. Quyền Xem */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-container-highest space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-base">
                        visibility
                      </span>
                      <span className="text-xs font-bold text-on-surface">1. Quyền Xem danh mục</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={restrictView}
                        onChange={(e) => setRestrictView(e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-slate-700">
                        {restrictView ? 'Chỉ định vai trò cụ thể' : 'Tất cả mọi người được xem'}
                      </span>
                    </label>
                  </div>
                  {restrictView && (
                    <div className="pt-2 border-t border-surface-container flex flex-wrap gap-2">
                      {systemRoles.map((r) => {
                        const checked = selectedViewRoles.includes(r.id);
                        return (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() =>
                              toggleRoleSelection(
                                selectedViewRoles,
                                setSelectedViewRoles,
                                r.id
                              )
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              checked
                                ? 'bg-primary-fixed text-on-primary-fixed border-primary font-bold'
                                : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. Quyền Chỉnh sửa / Lập phiếu */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-container-highest space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-800 text-base">
                        edit
                      </span>
                      <span className="text-xs font-bold text-on-surface">
                        2. Quyền Chỉnh sửa & Lập phiếu với danh mục này
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={restrictEdit}
                        onChange={(e) => setRestrictEdit(e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-slate-700">
                        {restrictEdit ? 'Chỉ định vai trò cụ thể' : 'Mọi cán bộ có quyền tài chính'}
                      </span>
                    </label>
                  </div>
                  {restrictEdit && (
                    <div className="pt-2 border-t border-surface-container flex flex-wrap gap-2">
                      {systemRoles.map((r) => {
                        const checked = selectedEditRoles.includes(r.id);
                        return (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() =>
                              toggleRoleSelection(
                                selectedEditRoles,
                                setSelectedEditRoles,
                                r.id
                              )
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              checked
                                ? 'bg-amber-100 text-amber-900 border-amber-400 font-bold'
                                : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Quyền Xóa danh mục */}
                <div className="p-3.5 rounded-xl bg-surface border border-surface-container-highest space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-red-700 text-base">
                        delete
                      </span>
                      <span className="text-xs font-bold text-on-surface">
                        3. Quyền Xóa danh mục (Khi không có dữ liệu)
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={restrictDelete}
                        onChange={(e) => setRestrictDelete(e.target.checked)}
                        className="rounded text-primary focus:ring-primary"
                      />
                      <span className="font-semibold text-slate-700">
                        {restrictDelete
                          ? 'Chỉ định vai trò cụ thể'
                          : 'Mặc định: Ban điều hành & Quản trị viên'}
                      </span>
                    </label>
                  </div>
                  {restrictDelete && (
                    <div className="pt-2 border-t border-surface-container flex flex-wrap gap-2">
                      {systemRoles.map((r) => {
                        const checked = selectedDeleteRoles.includes(r.id);
                        return (
                          <button
                            type="button"
                            key={r.id}
                            onClick={() =>
                              toggleRoleSelection(
                                selectedDeleteRoles,
                                setSelectedDeleteRoles,
                                r.id
                              )
                            }
                            className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                              checked
                                ? 'bg-red-100 text-red-900 border-red-400 font-bold'
                                : 'bg-surface-container-low text-on-surface-variant border-surface-container hover:bg-surface-container'
                            }`}
                          >
                            {checked ? '✓ ' : '+ '}
                            {r.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-container text-white shadow-xs disabled:opacity-50"
                >
                  {saving ? 'Đang lưu...' : editingCategory ? 'Lưu cập nhật' : 'Tạo danh mục'}
                </button>
              </div>
            </form>
          ) : (
            /* CATEGORY LIST VIEW */
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <div className="relative flex-1 max-w-sm">
                    <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm danh mục thu chi..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex items-center gap-1 bg-surface-container p-1 rounded-xl">
                    <button
                      onClick={() => setFilterType('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        filterType === 'ALL'
                          ? 'bg-white shadow-2xs text-on-surface'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      Tất cả ({categories.length})
                    </button>
                    <button
                      onClick={() => setFilterType('INCOME')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        filterType === 'INCOME'
                          ? 'bg-emerald-700 text-white shadow-2xs'
                          : 'text-emerald-800 hover:bg-emerald-50'
                      }`}
                    >
                      Khoản Thu ({categories.filter((c) => c.type === 'INCOME').length})
                    </button>
                    <button
                      onClick={() => setFilterType('EXPENSE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        filterType === 'EXPENSE'
                          ? 'bg-amber-800 text-white shadow-2xs'
                          : 'text-amber-900 hover:bg-amber-50'
                      }`}
                    >
                      Khoản Chi ({categories.filter((c) => c.type === 'EXPENSE').length})
                    </button>
                  </div>
                </div>

                <button
                  onClick={openCreateForm}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  <span>Tạo Danh Mục Mới</span>
                </button>
              </div>

              {/* Notice note */}
              <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-800 text-lg">shield</span>
                <span>
                  <strong>Quy tắc bảo toàn dữ liệu:</strong> Danh mục nào đang có chứng từ thu/chi bên trong sẽ được hệ thống <strong>khóa quyền xóa</strong> để bảo vệ tính toàn vẹn của sổ sách tài chính ấp.
                </span>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-2xl border border-surface-container-high bg-surface-container-lowest">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-surface-container-high">
                      <th className="py-3 px-3.5 w-12 text-center">STT</th>
                      <th className="py-3 px-4">Tên danh mục / Hạng mục quỹ</th>
                      <th className="py-3 px-3">Loại</th>
                      <th className="py-3 px-3 text-right">Định mức gợi ý</th>
                      <th className="py-3 px-3 text-center">Dữ liệu phát sinh</th>
                      <th className="py-3 px-4">Phân quyền thao tác</th>
                      <th className="py-3 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {filteredCategories.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                          Không tìm thấy danh mục thu chi nào phù hợp.
                        </td>
                      </tr>
                    ) : (
                      filteredCategories.map((cat, idx) => {
                        const count =
                          (usageCounts[cat.id] || 0) +
                          (usageCounts[`name:${cat.name.trim()}`] || 0);
                        const hasData = count > 0;

                        return (
                          <tr
                            key={cat.id}
                            className="hover:bg-surface-container-low/60 transition-colors"
                          >
                            <td className="py-3.5 px-3.5 text-center font-medium text-slate-500">
                              {idx + 1}
                            </td>

                            <td className="py-3.5 px-4">
                              <div className="font-bold text-on-surface text-xs">
                                {cat.name}
                              </div>
                              {cat.description && (
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {cat.description}
                                </div>
                              )}
                            </td>

                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 ${
                                  cat.type === 'INCOME'
                                    ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                    : 'bg-amber-100 text-amber-900 border border-amber-300'
                                }`}
                              >
                                <span>{cat.type === 'INCOME' ? '↓ Thu' : '↑ Chi'}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-3 text-right font-mono font-semibold text-slate-700">
                              {cat.suggestedAmount
                                ? formatCurrencyVND(cat.suggestedAmount)
                                : '—'}
                            </td>

                            <td className="py-3.5 px-3 text-center">
                              {hasData ? (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-900 border border-blue-200 inline-flex items-center gap-1">
                                  <span className="material-symbols-outlined text-xs">receipt_long</span>
                                  <span>{count} chứng từ</span>
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-600">
                                  0 chứng từ (Chưa có)
                                </span>
                              )}
                            </td>

                            {/* Permissions Summary Badges */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="text-[11px] flex items-center gap-1">
                                  <span className="text-slate-400 font-medium">Xem:</span>
                                  {cat.viewRoles && cat.viewRoles.length > 0 ? (
                                    <span className="font-semibold text-primary">
                                      {cat.viewRoles.map(getRoleName).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic">Tất cả cán bộ</span>
                                  )}
                                </div>
                                <div className="text-[11px] flex items-center gap-1">
                                  <span className="text-slate-400 font-medium">Sửa:</span>
                                  {cat.editRoles && cat.editRoles.length > 0 ? (
                                    <span className="font-semibold text-amber-900">
                                      {cat.editRoles.map(getRoleName).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic">Theo quyền thu/chi</span>
                                  )}
                                </div>
                                <div className="text-[11px] flex items-center gap-1">
                                  <span className="text-slate-400 font-medium">Xóa:</span>
                                  {cat.deleteRoles && cat.deleteRoles.length > 0 ? (
                                    <span className="font-semibold text-red-800">
                                      {cat.deleteRoles.map(getRoleName).join(', ')}
                                    </span>
                                  ) : (
                                    <span className="text-slate-500 italic">Ban điều hành / Admin</span>
                                  )}
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => openEditForm(cat)}
                                  className="p-1.5 rounded-xl hover:bg-surface-container text-slate-700 hover:text-primary transition-colors"
                                  title="Chỉnh sửa & Cấu hình phân quyền"
                                >
                                  <span className="material-symbols-outlined text-base">edit</span>
                                </button>

                                {hasData ? (
                                  <button
                                    onClick={() => handleDeleteClick(cat)}
                                    className="p-1.5 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed transition-colors"
                                    title={`Không thể xóa vì đang có ${count} chứng từ sử dụng`}
                                  >
                                    <span className="material-symbols-outlined text-base">lock</span>
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleDeleteClick(cat)}
                                    className="p-1.5 rounded-xl hover:bg-red-50 text-slate-500 hover:text-red-700 transition-colors"
                                    title="Xóa danh mục (Chưa có dữ liệu)"
                                  >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-surface-container-high bg-surface-container-low flex items-center justify-between">
          <div className="text-xs text-on-surface-variant">
            Tổng cộng: <strong className="text-on-surface">{categories.length}</strong> danh mục quỹ
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Xóa Danh Mục Thu / Chi"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa danh mục "${deleteTarget?.name}"? Danh mục này hiện chưa có chứng từ phát sinh nên có thể xóa an toàn.`}
        confirmText={deleting ? 'Đang xóa...' : 'Xác nhận xóa danh mục'}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
