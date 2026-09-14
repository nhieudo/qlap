import { useState, useMemo } from 'react';
import { Household, Resident, UserProfile, PermissionAction } from '../types';
import { updateResident, updateHousehold, deleteResident } from '../services/db';
import ConfirmModal from './ConfirmModal';

interface HouseholdDetailModalProps {
  isOpen: boolean;
  household: Household | null;
  onClose: () => void;
  residents: Resident[];
  hamletName?: string;
  onRefresh: () => Promise<void>;
  onEditHousehold: (household: Household) => void;
  onEditResident: (resident: Resident) => void;
  onAddNewMember: (household: Household) => void;
  hasPerm: (perm: PermissionAction) => boolean;
  user: { uid: string } | null;
  userProfile: UserProfile | null;
}

export default function HouseholdDetailModal({
  isOpen,
  household,
  onClose,
  residents,
  hamletName = 'Ấp Hưng An',
  onRefresh,
  onEditHousehold,
  onEditResident,
  onAddNewMember,
  hasPerm,
  user,
  userProfile,
}: HouseholdDetailModalProps) {
  const [printMode, setPrintMode] = useState(false);
  const [showAddExisting, setShowAddExisting] = useState(false);
  const [selectedExistingResId, setSelectedExistingResId] = useState('');
  const [selectedRelationship, setSelectedRelationship] = useState('Con');
  const [assigning, setAssigning] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Confirm modals
  const [removeTarget, setRemoveTarget] = useState<Resident | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Resident | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [processing, setProcessing] = useState(false);

  // Lọc ra các thành viên trực thuộc hộ gia đình này
  const members = useMemo(() => {
    if (!household) return [];
    return residents.filter(
      (r) =>
        !r.isArchived &&
        ((r.householdId && r.householdId === household.id) ||
          (r.householdCode && r.householdCode.trim().toLowerCase() === household.householdCode.trim().toLowerCase()))
    ).sort((a, b) => {
      // Chủ hộ luôn ưu tiên đứng đầu
      const aIsHead = (a.relationshipToHead || a.relationshipWithHead) === 'Chủ hộ' || a.fullName === household.headResidentName;
      const bIsHead = (b.relationshipToHead || b.relationshipWithHead) === 'Chủ hộ' || b.fullName === household.headResidentName;
      if (aIsHead && !bIsHead) return -1;
      if (!aIsHead && bIsHead) return 1;
      return a.fullName.localeCompare(b.fullName);
    });
  }, [household, residents]);

  // Danh sách các nhân khẩu trong ấp chưa thuộc hộ này (để gán nhanh vào hộ)
  const nonMembers = useMemo(() => {
    if (!household) return [];
    return residents
      .filter((r) => !r.isArchived && r.householdId !== household.id && r.householdCode !== household.householdCode)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [household, residents]);

  if (!isOpen || !household) return null;

  // Tính tuổi từ ngày sinh
  const calculateAge = (dobString?: string) => {
    if (!dobString) return '';
    try {
      const birthYear = parseInt(dobString.split('-')[0], 10);
      if (isNaN(birthYear)) return '';
      const currentYear = new Date().getFullYear();
      const age = currentYear - birthYear;
      return `${age} tuổi`;
    } catch {
      return '';
    }
  };

  // Gán người dân có sẵn vào hộ
  const handleAssignExistingMember = async () => {
    if (!selectedExistingResId) {
      setActionError('Vui lòng chọn nhân khẩu cần thêm vào hộ.');
      return;
    }
    setAssigning(true);
    setActionError(null);
    try {
      const res = residents.find((r) => r.id === selectedExistingResId);
      if (!res) throw new Error('Không tìm thấy thông tin nhân khẩu.');

      await updateResident(
        res.id,
        {
          householdId: household.id,
          householdCode: household.householdCode,
          relationshipToHead: selectedRelationship,
          address: res.address || household.address,
          groupNumber: res.groupNumber || household.groupNumber,
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      // Cập nhật số lượng thành viên của hộ
      await updateHousehold(
        household.id,
        { memberCount: members.length + 1 },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      setShowAddExisting(false);
      setSelectedExistingResId('');
      await onRefresh();
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Lỗi khi thêm thành viên vào hộ.');
    } finally {
      setAssigning(false);
    }
  };

  // Tách / Gỡ thành viên ra khỏi hộ
  const handleConfirmRemoveMember = async () => {
    if (!removeTarget) return;
    setProcessing(true);
    try {
      await updateResident(
        removeTarget.id,
        {
          householdId: '',
          householdCode: '',
          relationshipToHead: 'Khác',
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      await updateHousehold(
        household.id,
        { memberCount: Math.max(0, members.length - 1) },
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );

      setRemoveTarget(null);
      await onRefresh();
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Lỗi khi tách thành viên khỏi hộ.');
    } finally {
      setProcessing(false);
    }
  };

  // Đặt thành viên làm Chủ hộ mới
  const handleConfirmPromoteToHead = async () => {
    if (!promoteTarget) return;
    setProcessing(true);
    try {
      const nowUser = user?.uid || 'user';
      const nowName = userProfile?.fullName || 'Cán bộ';

      // 1. Cập nhật chủ hộ cũ thành "Khác" hoặc "Bố/Mẹ" nếu có
      const oldHead = members.find(
        (m) =>
          (m.relationshipToHead || m.relationshipWithHead) === 'Chủ hộ' ||
          m.fullName === household.headResidentName
      );
      if (oldHead && oldHead.id !== promoteTarget.id) {
        await updateResident(
          oldHead.id,
          { relationshipToHead: 'Khác' },
          nowUser,
          nowName
        );
      }

      // 2. Cập nhật thành viên mới thành Chủ hộ
      await updateResident(
        promoteTarget.id,
        { relationshipToHead: 'Chủ hộ' },
        nowUser,
        nowName
      );

      // 3. Cập nhật thông tin sổ hộ
      await updateHousehold(
        household.id,
        {
          headResidentName: promoteTarget.fullName,
          headResidentId: promoteTarget.id,
          phone: promoteTarget.phone || household.phone,
        },
        nowUser,
        nowName
      );

      setPromoteTarget(null);
      await onRefresh();
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Lỗi khi chuyển quyền chủ hộ.');
    } finally {
      setProcessing(false);
    }
  };

  // Xóa vĩnh viễn thành viên
  const handleConfirmDeleteResident = async () => {
    if (!deleteTarget) return;
    setProcessing(true);
    try {
      await deleteResident(
        deleteTarget.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setDeleteTarget(null);
      await onRefresh();
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Lỗi khi xóa nhân khẩu.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 print:p-0 print:bg-white print:static">
      <div
        className={`bg-surface-container-lowest max-w-4xl w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in transition-all ${
          printMode ? 'max-w-4xl' : ''
        }`}
      >
        {/* Header bar */}
        <div className="p-5 sm:p-6 border-b border-surface-container-high flex items-center justify-between gap-3 bg-surface-container-low print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-2xl">family_restroom</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-sm font-extrabold px-3 py-1 rounded-xl bg-primary text-white tracking-wide shadow-xs">
                  {household.householdCode}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    household.classification === 'Hộ nghèo'
                      ? 'bg-red-100 text-red-800 border border-red-200'
                      : household.classification === 'Cận nghèo'
                      ? 'bg-orange-100 text-orange-800 border border-orange-200'
                      : household.classification === 'Gia đình chính sách'
                      ? 'bg-blue-100 text-blue-800 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}
                >
                  {household.classification}
                </span>
              </div>
              <h3 className="font-headline-sm font-bold text-on-surface mt-1">
                Sổ Hộ gia đình: {household.headResidentName}
              </h3>
              <p className="text-xs text-on-surface-variant">
                Quản lý nhân khẩu và chi tiết các thành viên thuộc địa bàn {hamletName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPrintMode(!printMode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                printMode
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface-container-lowest text-slate-700 border-surface-container-highest hover:bg-surface-container'
              }`}
              title="Xem bản in Sổ hộ A4"
            >
              <span className="material-symbols-outlined text-base">print</span>
              <span className="hidden sm:inline">{printMode ? 'Đóng bản in' : 'In Sổ hộ A4'}</span>
            </button>

            {hasPerm('households.update') && (
              <button
                onClick={() => onEditHousehold(household)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-primary-container/60 hover:bg-primary-container text-primary transition-all"
                title="Sửa thông tin mã hộ, địa chỉ, tổ"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                <span className="hidden sm:inline">Sửa Sổ hộ</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
        </div>

        {/* PRINTABLE A4 VIEW */}
        {printMode ? (
          <div className="p-6 sm:p-10 max-h-[80vh] overflow-y-auto bg-white text-black font-serif print:max-h-none print:overflow-visible">
            <div className="flex items-center justify-between pb-4 border-b border-gray-300 print:hidden mb-6">
              <span className="text-xs font-sans text-slate-500">
                Chế độ xem trước biểu mẫu in Sổ Hộ Gia Đình A4 chuẩn quản lý hành chính cấp Ấp.
              </span>
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-sans text-xs font-semibold flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">print</span>
                <span>Bấm in ngay</span>
              </button>
            </div>

            {/* Form standard header */}
            <div className="grid grid-cols-2 text-center text-xs mb-6">
              <div>
                <div className="font-bold uppercase">ỦY BAN NHÂN DÂN CẤP CƠ SỞ</div>
                <div className="font-bold uppercase tracking-wide">BAN ĐIỀU HÀNH {hamletName.toUpperCase()}</div>
                <div className="text-[11px] mt-0.5">Số: {household.householdCode}/SHGĐ</div>
              </div>
              <div>
                <div className="font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div className="italic font-bold">Độc lập - Tự do - Hạnh phúc</div>
                <div className="text-[11px] italic mt-1">
                  Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </div>
              </div>
            </div>

            <div className="text-center my-6">
              <h1 className="text-xl font-bold uppercase tracking-wider">SỔ THEO DÕI HỘ GIA ĐÌNH</h1>
              <div className="text-sm font-sans font-semibold text-slate-700 mt-1">
                MÃ SỐ HỘ: <span className="font-mono font-bold text-black">{household.householdCode}</span>
              </div>
            </div>

            {/* General Info */}
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 mb-6 text-xs font-sans space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-gray-700">Họ và tên chủ hộ:</span>{' '}
                  <span className="font-bold text-black uppercase">{household.headResidentName}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Tổ dân cư:</span>{' '}
                  <span className="font-medium text-black">{household.groupNumber}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-gray-700">Địa chỉ thường trú:</span>{' '}
                  <span className="text-black">{household.address}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Điện thoại liên hệ:</span>{' '}
                  <span className="text-black">{household.phone || 'Chưa có'}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-gray-700">Phân loại diện an sinh:</span>{' '}
                  <span className="font-bold text-black">{household.classification}</span>
                </div>
                <div>
                  <span className="font-semibold text-gray-700">Tổng số nhân khẩu:</span>{' '}
                  <span className="font-bold text-black">{members.length} người</span>
                </div>
              </div>
              {household.notes && (
                <div>
                  <span className="font-semibold text-gray-700">Ghi chú hoàn cảnh:</span>{' '}
                  <span className="italic text-gray-800">{household.notes}</span>
                </div>
              )}
            </div>

            {/* Member list in print */}
            <div className="mb-8">
              <h3 className="font-sans font-bold text-xs uppercase mb-2">
                DANH SÁCH NHÂN KHẨU THƯỜNG TRỰC TRONG SỔ HỘ ({members.length} THÀNH VIÊN)
              </h3>
              <table className="w-full text-left text-[11px] font-sans border-collapse border border-gray-400">
                <thead>
                  <tr className="bg-gray-100 text-center font-bold">
                    <th className="border border-gray-400 p-2 w-8">STT</th>
                    <th className="border border-gray-400 p-2">HỌ VÀ TÊN</th>
                    <th className="border border-gray-400 p-2">QUAN HỆ CHỦ HỘ</th>
                    <th className="border border-gray-400 p-2 text-center">NGÀY SINH</th>
                    <th className="border border-gray-400 p-2 text-center">GIỚI TÍNH</th>
                    <th className="border border-gray-400 p-2 text-center">SỐ CCCD / ĐỊNH DANH</th>
                    <th className="border border-gray-400 p-2 text-center">TÌNH TRẠNG</th>
                  </tr>
                </thead>
                <tbody>
                  {members.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="border border-gray-400 p-4 text-center italic text-gray-500">
                        Chưa có dữ liệu thành viên trong sổ hộ.
                      </td>
                    </tr>
                  ) : (
                    members.map((m, idx) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        <td className="border border-gray-400 p-2 text-center font-medium">{idx + 1}</td>
                        <td className="border border-gray-400 p-2 font-bold uppercase">{m.fullName}</td>
                        <td className="border border-gray-400 p-2 font-semibold">
                          {m.relationshipToHead || m.relationshipWithHead || 'Thành viên'}
                        </td>
                        <td className="border border-gray-400 p-2 text-center">{m.dateOfBirth || '-'}</td>
                        <td className="border border-gray-400 p-2 text-center">{m.gender}</td>
                        <td className="border border-gray-400 p-2 text-center font-mono">{m.nationalId || '-'}</td>
                        <td className="border border-gray-400 p-2 text-center">{m.residenceStatus || 'Thường trú'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Signatures */}
            <div className="grid grid-cols-2 text-center text-xs mt-12 gap-8">
              <div>
                <div className="font-bold uppercase">CHỦ HỘ GIA ĐÌNH</div>
                <div className="italic text-[11px] text-gray-500">(Ký và ghi rõ họ tên)</div>
                <div className="h-20" />
                <div className="font-bold uppercase">{household.headResidentName}</div>
              </div>
              <div>
                <div className="font-bold uppercase">TM. BAN ĐIỀU HÀNH {hamletName.toUpperCase()}</div>
                <div className="italic text-[11px] text-gray-500">(Ký, đóng dấu xác nhận)</div>
                <div className="h-20" />
                <div className="font-bold uppercase">TRƯỞNG ẤP</div>
              </div>
            </div>
          </div>
        ) : (
          /* STANDARD MODAL VIEW */
          <div className="p-5 sm:p-6 space-y-6 max-h-[82vh] overflow-y-auto">
            {actionError && (
              <div className="p-3 rounded-2xl bg-error-container text-on-error-container text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{actionError}</span>
                </div>
                <button
                  onClick={() => setActionError(null)}
                  className="p-1 hover:bg-black/5 rounded-lg"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            )}

            {/* Overview cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div className="text-xs text-on-surface-variant font-medium">Chủ hộ gia đình</div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center justify-center font-bold text-sm">
                    👑
                  </div>
                  <div>
                    <div className="font-bold text-sm text-on-surface uppercase leading-tight">
                      {household.headResidentName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {household.phone || 'Chưa có SĐT'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div className="text-xs text-on-surface-variant font-medium">Địa bàn cư trú</div>
                <div className="mt-2">
                  <div className="font-bold text-sm text-on-surface">
                    {household.groupNumber || 'Chưa phân tổ'}
                  </div>
                  <div className="text-[11px] text-slate-600 line-clamp-1 mt-0.5" title={household.address}>
                    {household.address || 'Chưa cập nhật địa chỉ'}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container flex flex-col justify-between">
                <div className="text-xs text-on-surface-variant font-medium">Quy mô nhân khẩu</div>
                <div className="mt-2 flex items-baseline justify-between">
                  <div>
                    <span className="text-2xl font-black text-primary">{members.length}</span>
                    <span className="text-xs text-slate-600 ml-1.5 font-medium">người trong sổ</span>
                  </div>
                  <span className="font-mono text-[11px] font-bold text-primary bg-primary-fixed px-2 py-0.5 rounded-md">
                    {household.householdCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Member list section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-on-surface flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-primary text-lg">groups</span>
                    <span>Danh sách thành viên trong hộ ({members.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    - Sắp xếp theo thứ tự chủ hộ và các thành viên
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAddExisting(!showAddExisting)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface-container border border-surface-container-highest text-slate-700 hover:bg-surface-container-high transition-all"
                  >
                    <span className="material-symbols-outlined text-base">person_add</span>
                    <span>Gán người dân có sẵn</span>
                  </button>

                  <button
                    onClick={() => onAddNewMember(household)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-container text-white shadow-xs transition-all"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                    <span>Thêm nhân khẩu mới</span>
                  </button>
                </div>
              </div>

              {/* Form gán nhanh nhân khẩu có sẵn vào hộ */}
              {showAddExisting && (
                <div className="p-4 rounded-2xl bg-primary-fixed/20 border border-primary/20 space-y-3 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">link</span>
                      <span>Chọn nhân khẩu trong ấp để gắn vào sổ hộ {household.householdCode}:</span>
                    </span>
                    <button
                      onClick={() => setShowAddExisting(false)}
                      className="text-xs text-slate-500 hover:text-slate-800"
                    >
                      Đóng
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Chọn người dân (chưa thuộc hộ này):
                      </label>
                      <select
                        value={selectedExistingResId}
                        onChange={(e) => setSelectedExistingResId(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-surface-container-highest bg-surface text-xs"
                      >
                        <option value="">-- Chọn nhân khẩu trong danh sách ({nonMembers.length} người) --</option>
                        {nonMembers.map((nm) => (
                          <option key={nm.id} value={nm.id}>
                            {nm.fullName} ({nm.nationalId ? `CCCD: ${nm.nationalId}` : 'Chưa có CCCD'}) - {nm.groupNumber} {nm.householdCode ? `[Đang ở hộ: ${nm.householdCode}]` : '[Chưa có mã hộ]'}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        Quan hệ với chủ hộ:
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedRelationship}
                          onChange={(e) => setSelectedRelationship(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-surface-container-highest bg-surface text-xs"
                        >
                          <option value="Vợ">Vợ</option>
                          <option value="Chồng">Chồng</option>
                          <option value="Con">Con</option>
                          <option value="Bố">Bố</option>
                          <option value="Mẹ">Mẹ</option>
                          <option value="Ông">Ông</option>
                          <option value="Bà">Bà</option>
                          <option value="Cháu">Cháu</option>
                          <option value="Anh">Anh</option>
                          <option value="Chị">Chị</option>
                          <option value="Em">Em</option>
                          <option value="Khác">Khác</option>
                        </select>
                        <button
                          onClick={handleAssignExistingMember}
                          disabled={assigning || !selectedExistingResId}
                          className="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container disabled:opacity-50 whitespace-nowrap shadow-xs"
                        >
                          {assigning ? 'Đang gán...' : 'Gán vào hộ'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Members table */}
              <div className="overflow-x-auto rounded-2xl border border-surface-container-high bg-surface-container-lowest">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-surface-container text-on-surface-variant font-semibold border-b border-surface-container-high">
                      <th className="py-2.5 px-3 w-10 text-center">STT</th>
                      <th className="py-2.5 px-3">Họ và tên</th>
                      <th className="py-2.5 px-3">Quan hệ với chủ hộ</th>
                      <th className="py-2.5 px-3">Năm sinh / Tuổi</th>
                      <th className="py-2.5 px-3">Giới tính</th>
                      <th className="py-2.5 px-3">Số CCCD</th>
                      <th className="py-2.5 px-3">Cư trú</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {members.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-slate-500 italic">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-3xl text-slate-400">group_off</span>
                            <span>Sổ hộ này chưa có nhân khẩu nào được liên kết.</span>
                            <button
                              onClick={() => onAddNewMember(household)}
                              className="mt-2 text-xs font-bold text-primary hover:underline"
                            >
                              + Đăng ký nhân khẩu đầu tiên cho hộ
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      members.map((m, index) => {
                        const isHead =
                          (m.relationshipToHead || m.relationshipWithHead) === 'Chủ hộ' ||
                          m.fullName === household.headResidentName;

                        return (
                          <tr
                            key={m.id}
                            className={`hover:bg-surface-container-low/80 transition-colors ${
                              isHead ? 'bg-amber-50/40' : ''
                            }`}
                          >
                            <td className="py-3 px-3 text-center font-medium text-slate-500">
                              {index + 1}
                            </td>

                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-on-surface uppercase text-xs">
                                  {m.fullName}
                                </span>
                                {isHead && (
                                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center gap-0.5">
                                    <span>👑</span>
                                    <span>Chủ hộ</span>
                                  </span>
                                )}
                              </div>
                              {m.phone && (
                                <div className="text-[11px] text-slate-500 font-mono">
                                  {m.phone}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                                  isHead
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300 font-bold'
                                    : 'bg-surface-container-high text-on-surface-variant'
                                }`}
                              >
                                {m.relationshipToHead || m.relationshipWithHead || 'Thành viên'}
                              </span>
                            </td>

                            <td className="py-3 px-3">
                              <div className="font-medium text-slate-700">{m.dateOfBirth || '-'}</div>
                              {m.dateOfBirth && (
                                <div className="text-[10px] text-slate-500 font-medium">
                                  {calculateAge(m.dateOfBirth)}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-slate-700">{m.gender}</td>

                            <td className="py-3 px-3 font-mono font-medium text-slate-700">
                              {m.nationalId || (
                                <span className="text-slate-400 italic font-sans text-[11px]">
                                  Chưa cấp
                                </span>
                              )}
                            </td>

                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                  m.residenceStatus === 'Thường trú'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : m.residenceStatus === 'Tạm trú'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {m.residenceStatus || 'Thường trú'}
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                {hasPerm('residents.update') && (
                                  <button
                                    onClick={() => onEditResident(m)}
                                    className="p-1 rounded-lg hover:bg-surface-container text-slate-600 hover:text-primary transition-colors"
                                    title="Chỉnh sửa thông tin thành viên"
                                  >
                                    <span className="material-symbols-outlined text-base">edit</span>
                                  </button>
                                )}

                                {!isHead && hasPerm('households.update') && (
                                  <button
                                    onClick={() => setPromoteTarget(m)}
                                    className="p-1 rounded-lg hover:bg-amber-100 text-amber-700 transition-colors"
                                    title="Chuyển quyền Chủ hộ cho người này"
                                  >
                                    <span className="material-symbols-outlined text-base">star</span>
                                  </button>
                                )}

                                {hasPerm('households.update') && (
                                  <button
                                    onClick={() => setRemoveTarget(m)}
                                    className="p-1 rounded-lg hover:bg-orange-100 text-orange-700 transition-colors"
                                    title="Tách / Gỡ khỏi sổ hộ này"
                                  >
                                    <span className="material-symbols-outlined text-base">person_remove</span>
                                  </button>
                                )}

                                {hasPerm('residents.archive') && (
                                  <button
                                    onClick={() => setDeleteTarget(m)}
                                    className="p-1 rounded-lg hover:bg-red-100 text-red-600 transition-colors"
                                    title="Xóa nhân khẩu khỏi hệ thống"
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

            {/* Quick stats and notes footer */}
            {household.notes && (
              <div className="p-3.5 rounded-2xl bg-surface-container border border-surface-container-high text-xs space-y-1">
                <div className="font-bold text-slate-700 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">sticky_note_2</span>
                  <span>Ghi chú của Sổ hộ:</span>
                </div>
                <div className="text-slate-600 italic whitespace-pre-wrap">{household.notes}</div>
              </div>
            )}
          </div>
        )}

        {/* Footer controls */}
        <div className="p-4 sm:p-5 border-t border-surface-container-high bg-surface-container-low flex items-center justify-between gap-3 print:hidden">
          <div className="text-xs text-on-surface-variant">
            Mã định danh sổ hộ:{' '}
            <span className="font-mono font-bold text-primary">{household.householdCode}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-surface-container hover:bg-surface-container-high text-on-surface"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>

      {/* MODAL CONFIRM: Tách thành viên khỏi hộ */}
      <ConfirmModal
        isOpen={!!removeTarget}
        title="Tách thành viên khỏi sổ hộ"
        description={`Bạn có chắc chắn muốn tách nhân khẩu ${removeTarget?.fullName} ra khỏi sổ hộ ${household.householdCode}? Nhân khẩu này sẽ không còn thuộc sổ hộ này nữa nhưng vẫn tồn tại trong cơ sở dữ liệu nhân khẩu của ấp.`}
        confirmText={processing ? 'Đang tách...' : 'Xác nhận tách hộ'}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => setRemoveTarget(null)}
      />

      {/* MODAL CONFIRM: Chuyển làm Chủ hộ mới */}
      <ConfirmModal
        isOpen={!!promoteTarget}
        title="Chuyển quyền Chủ hộ mới"
        description={`Bạn có chắc chắn muốn chuyển quyền Chủ hộ của sổ hộ ${household.householdCode} sang cho nhân khẩu ${promoteTarget?.fullName}? Chủ hộ hiện tại (${household.headResidentName}) sẽ được chuyển thành thành viên.`}
        confirmText={processing ? 'Đang chuyển...' : 'Xác nhận đổi chủ hộ'}
        onConfirm={handleConfirmPromoteToHead}
        onCancel={() => setPromoteTarget(null)}
      />

      {/* MODAL CONFIRM: Xóa nhân khẩu */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Xóa nhân khẩu khỏi hệ thống"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa hoàn toàn hồ sơ của nhân khẩu ${deleteTarget?.fullName}? Dữ liệu sẽ bị xóa khỏi cơ sở dữ liệu.`}
        confirmText={processing ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
        onConfirm={handleConfirmDeleteResident}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
