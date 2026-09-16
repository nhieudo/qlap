import { useState, useEffect, useMemo, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getResidents,
  getHouseholds,
  createResident,
  updateResident,
  archiveResident,
  deleteResident,
  createHousehold,
  updateHousehold,
  deleteHousehold,
} from '../services/db';
import { Resident, Household } from '../types';
import { formatDateVN } from '../utils/numberToWords';
import { exportResidentsToExcel } from '../utils/excelExport';
import { ConfirmModal } from '../components/ConfirmModal';
import { ImportResidentsModal } from '../components/ImportResidentsModal';
import HouseholdDetailModal from '../components/HouseholdDetailModal';
import { getHamletAbbreviation, suggestNextHouseholdCode } from '../utils/household';
import { useSettings } from '../context/SettingsContext';

interface ResidentsViewProps {
  initialOpenModal?: boolean;
  onResetInitialModal?: () => void;
}

export function ResidentsView({ initialOpenModal, onResetInitialModal }: ResidentsViewProps) {
  const { user, userProfile, hasPerm } = useAuth();
  const { settings } = useSettings();

  const [activeSubTab, setActiveSubTab] = useState<'residents' | 'households'>('residents');
  const [residents, setResidents] = useState<Resident[]>([]);
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [houseNumberFilter, setHouseNumberFilter] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('ALL');
  const [selectedClassification, setSelectedClassification] = useState('ALL');
  const [selectedResidenceStatus, setSelectedResidenceStatus] = useState('ALL');
  const [maskCCCD, setMaskCCCD] = useState(true);

  // Modals state
  const [isResidentModalOpen, setIsResidentModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [editingResident, setEditingResident] = useState<Resident | null>(null);

  const [isHouseholdModalOpen, setIsHouseholdModalOpen] = useState(false);
  const [editingHousehold, setEditingHousehold] = useState<Household | null>(null);

  const [archiveTarget, setArchiveTarget] = useState<Resident | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Resident | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form states for resident
  const [resFullName, setResFullName] = useState('');
  const [resDob, setResDob] = useState('');
  const [resGender, setResGender] = useState<'Nam' | 'Nữ' | 'Khác'>('Nam');
  const [resNationalId, setResNationalId] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resHouseholdId, setResHouseholdId] = useState('');
  const [resRelationship, setResRelationship] = useState('Chủ hộ');
  const [resGroup, setResGroup] = useState('Tổ 1');
  const [resAddress, setResAddress] = useState('');
  const [resStatus, setResStatus] = useState<'Thường trú' | 'Tạm trú' | 'Tạm vắng'>('Thường trú');
  const [resIsPoor, setResIsPoor] = useState(false);
  const [resIsNearPoor, setResIsNearPoor] = useState(false);
  const [resIsPolicy, setResIsPolicy] = useState(false);
  const [resIsElderly, setResIsElderly] = useState(false);
  const [resIsChild, setResIsChild] = useState(false);
  const [resIsDisabled, setResIsDisabled] = useState(false);
  const [resNotes, setResNotes] = useState('');

  // Form states for household
  const [hhCode, setHhCode] = useState('');
  const [hhHeadName, setHhHeadName] = useState('');
  const [hhAddress, setHhAddress] = useState('');
  const [hhGroup, setHhGroup] = useState('Tổ 1');
  const [hhPhone, setHhPhone] = useState('');
  const [hhClassification, setHhClassification] = useState<
    'Bình thường' | 'Hộ nghèo' | 'Cận nghèo' | 'Gia đình chính sách'
  >('Bình thường');
  const [hhNotes, setHhNotes] = useState('');

  // Household Details Modal and Delete Target
  const [selectedHouseholdForDetail, setSelectedHouseholdForDetail] = useState<Household | null>(null);
  const [isHouseholdDetailOpen, setIsHouseholdDetailOpen] = useState(false);
  const [deleteHouseholdTarget, setDeleteHouseholdTarget] = useState<Household | null>(null);
  const [deletingHousehold, setDeletingHousehold] = useState(false);

  // Household Tab Filters
  const [hhSearch, setHhSearch] = useState('');
  const [hhGroupFilter, setHhGroupFilter] = useState('ALL');
  const [hhClassificationFilter, setHhClassificationFilter] = useState('ALL');

  const loadAll = async () => {
    setLoading(true);
    try {
      const [res, hh] = await Promise.all([getResidents(), getHouseholds()]);
      setResidents(res);
      setHouseholds(hh);
      if (selectedHouseholdForDetail) {
        const updated = hh.find((x) => x.id === selectedHouseholdForDetail.id);
        if (updated) setSelectedHouseholdForDetail(updated);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (initialOpenModal) {
      openCreateResidentModal();
      onResetInitialModal?.();
    }
  }, [initialOpenModal]);

  // Open modal helpers
  const openCreateResidentModal = () => {
    setEditingResident(null);
    setResFullName('');
    setResDob('');
    setResGender('Nam');
    setResNationalId('');
    setResPhone('');
    setResHouseholdId('');
    setResRelationship('Chủ hộ');
    setResGroup('Tổ 1');
    setResAddress('Ấp Bình Hòa, Xã An Nhơn Tây');
    setResStatus('Thường trú');
    setResIsPoor(false);
    setResIsNearPoor(false);
    setResIsPolicy(false);
    setResIsElderly(false);
    setResIsChild(false);
    setResIsDisabled(false);
    setResNotes('');
    setErrorMsg(null);
    setIsResidentModalOpen(true);
  };

  const openEditResidentModal = (r: Resident) => {
    setEditingResident(r);
    setResFullName(r.fullName);
    setResDob(r.dateOfBirth || '');
    setResGender(r.gender);
    setResNationalId(r.nationalId || '');
    setResPhone(r.phone || '');
    setResHouseholdId(r.householdId || '');
    setResRelationship(r.relationshipToHead || 'Thành viên');
    setResGroup(r.groupNumber || 'Tổ 1');
    setResAddress(r.address || '');
    setResStatus(r.residenceStatus);
    setResIsPoor(!!r.isPoorHousehold);
    setResIsNearPoor(!!r.isNearPoorHousehold);
    setResIsPolicy(!!r.isPolicyBeneficiary);
    setResIsElderly(!!r.isElderly);
    setResIsChild(!!r.isChild);
    setResIsDisabled(!!r.isDisabled);
    setResNotes(r.notes || '');
    setErrorMsg(null);
    setIsResidentModalOpen(true);
  };

  const openCreateHouseholdModal = () => {
    const nextCode = suggestNextHouseholdCode(households, settings.hamletName);
    setEditingHousehold(null);
    setHhCode(nextCode);
    setHhHeadName('');
    setHhAddress(settings.address || `${settings.hamletName || 'Ấp Hưng An'}, ${settings.communeName || 'Xã An Nhơn Tây'}`);
    setHhGroup('Tổ 1');
    setHhPhone('');
    setHhClassification('Bình thường');
    setHhNotes('');
    setErrorMsg(null);
    setIsHouseholdModalOpen(true);
  };

  const openEditHouseholdModal = (h: Household) => {
    setEditingHousehold(h);
    setHhCode(h.householdCode || suggestNextHouseholdCode(households, settings.hamletName));
    setHhHeadName(h.headResidentName);
    setHhAddress(h.address);
    setHhGroup(h.groupNumber);
    setHhPhone(h.phone || '');
    setHhClassification(h.classification as any);
    setHhNotes(h.notes || '');
    setErrorMsg(null);
    setIsHouseholdModalOpen(true);
  };

  const openHouseholdDetailModal = (h: Household) => {
    setSelectedHouseholdForDetail(h);
    setIsHouseholdDetailOpen(true);
  };

  const handleAddNewMemberFromHousehold = (h: Household) => {
    setEditingResident(null);
    setResFullName('');
    setResDob('');
    setResGender('Nam');
    setResNationalId('');
    setResPhone('');
    setResHouseholdId(h.id);
    setResRelationship('Con');
    setResGroup(h.groupNumber || 'Tổ 1');
    setResAddress(h.address);
    setResStatus('Thường trú');
    setResIsPoor(h.classification === 'Hộ nghèo');
    setResIsNearPoor(h.classification === 'Cận nghèo');
    setResIsPolicy(h.classification === 'Gia đình chính sách');
    setResIsElderly(false);
    setResIsChild(false);
    setResIsDisabled(false);
    setResNotes('');
    setErrorMsg(null);
    setIsResidentModalOpen(true);
  };

  // Submit resident
  const handleSaveResident = async (e: FormEvent) => {
    e.preventDefault();
    if (!resFullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên nhân khẩu.');
      return;
    }
    if (resNationalId && resNationalId.length !== 12) {
      setErrorMsg('Số CCCD chuẩn phải đủ đúng 12 chữ số.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const selectedHh = households.find(h => h.id === resHouseholdId);

      const residentData = {
        fullName: resFullName.trim().toUpperCase(),
        dateOfBirth: resDob,
        gender: resGender,
        nationalId: resNationalId.trim(),
        phone: resPhone.trim(),
        householdId: resHouseholdId?.trim() || '',
        householdCode: selectedHh?.householdCode || '',
        relationshipToHead: resRelationship,
        groupNumber: resGroup,
        address: resAddress.trim(),
        residenceStatus: resStatus,
        isPoorHousehold: resIsPoor,
        isNearPoorHousehold: resIsNearPoor,
        isPolicyBeneficiary: resIsPolicy,
        isElderly: resIsElderly,
        isChild: resIsChild,
        isDisabled: resIsDisabled,
        notes: resNotes.trim(),
      };

      if (editingResident) {
        await updateResident(
          editingResident.id,
          residentData,
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      } else {
        await createResident(
          residentData,
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      }

      setIsResidentModalOpen(false);
      await loadAll();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Lỗi khi lưu nhân khẩu.');
    } finally {
      setSaving(false);
    }
  };

  // Submit household
  const handleSaveHousehold = async (e: FormEvent) => {
    e.preventDefault();
    if (!hhHeadName.trim()) {
      setErrorMsg('Vui lòng nhập tên chủ hộ.');
      return;
    }

    const cleanCode = (hhCode.trim() || suggestNextHouseholdCode(households, settings.hamletName)).toUpperCase();

    setSaving(true);
    setErrorMsg(null);

    try {
      if (editingHousehold) {
        await updateHousehold(
          editingHousehold.id,
          {
            householdCode: cleanCode,
            headResidentName: hhHeadName.trim(),
            address: hhAddress.trim(),
            groupNumber: hhGroup,
            phone: hhPhone.trim(),
            classification: hhClassification,
            notes: hhNotes.trim(),
          },
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ'
        );
      } else {
        const newHh = await createHousehold(
          {
            householdCode: cleanCode,
            headResidentName: hhHeadName.trim(),
            address: hhAddress.trim(),
            groupNumber: hhGroup,
            phone: hhPhone.trim(),
            classification: hhClassification,
            notes: hhNotes.trim(),
            memberCount: 1,
          },
          user?.uid || 'user',
          userProfile?.fullName || 'Cán bộ',
          settings.hamletName
        );

        // Tự động liên kết hoặc tạo nhân khẩu Chủ hộ
        const existingHead = residents.find(
          (r) =>
            !r.isArchived &&
            r.fullName.trim().toUpperCase() === hhHeadName.trim().toUpperCase() &&
            (!r.householdId || r.householdId === newHh.id)
        );

        if (!existingHead) {
          await createResident(
            {
              fullName: hhHeadName.trim().toUpperCase(),
              dateOfBirth: '',
              gender: 'Nam',
              nationalId: '',
              phone: hhPhone.trim(),
              householdId: newHh.id,
              householdCode: newHh.householdCode,
              relationshipToHead: 'Chủ hộ',
              groupNumber: hhGroup,
              address: hhAddress.trim(),
              residenceStatus: 'Thường trú',
              isPoorHousehold: hhClassification === 'Hộ nghèo',
              isNearPoorHousehold: hhClassification === 'Cận nghèo',
              isPolicyBeneficiary: hhClassification === 'Gia đình chính sách',
              isElderly: false,
              isChild: false,
              isDisabled: false,
              notes: 'Chủ hộ (được tạo cùng sổ hộ gia đình)',
            },
            user?.uid || 'user',
            userProfile?.fullName || 'Cán bộ'
          );
        } else {
          await updateResident(
            existingHead.id,
            {
              householdId: newHh.id,
              householdCode: newHh.householdCode,
              relationshipToHead: 'Chủ hộ',
            },
            user?.uid || 'user',
            userProfile?.fullName || 'Cán bộ'
          );
        }
      }

      setIsHouseholdModalOpen(false);
      await loadAll();
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || 'Lỗi khi lưu sổ hộ.');
    } finally {
      setSaving(false);
    }
  };

  // Delete Household
  const handleDeleteHouseholdConfirm = async () => {
    if (!deleteHouseholdTarget) return;
    setDeletingHousehold(true);
    try {
      await deleteHousehold(
        deleteHouseholdTarget.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      if (selectedHouseholdForDetail?.id === deleteHouseholdTarget.id) {
        setIsHouseholdDetailOpen(false);
        setSelectedHouseholdForDetail(null);
      }
      setDeleteHouseholdTarget(null);
      await loadAll();
    } catch (err) {
      console.error('Lỗi khi xóa sổ hộ:', err);
    } finally {
      setDeletingHousehold(false);
    }
  };

  // Archive resident
  const handleArchiveConfirm = async () => {
    if (!archiveTarget) return;
    try {
      await archiveResident(
        archiveTarget.id,
        archiveReason || 'Chuyển đi nơi khác / Xóa',
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setArchiveTarget(null);
      setArchiveReason('');
      await loadAll();
    } catch (err) {
      console.error(err);
    }
  };

  // Permanently delete resident
  const handleDeleteResidentConfirm = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteResident(
        deleteTarget.id,
        user?.uid || 'user',
        userProfile?.fullName || 'Cán bộ'
      );
      setDeleteTarget(null);
      if (editingResident?.id === deleteTarget.id) {
        setIsResidentModalOpen(false);
        setEditingResident(null);
      }
      await loadAll();
    } catch (err) {
      console.error('Lỗi khi xóa nhân khẩu:', err);
    } finally {
      setDeleting(false);
    }
  };

  // Dynamic list of groups (allows custom neighborhood groups)
  const availableGroups = useMemo(() => {
    const base = ['Tổ 1', 'Tổ 2', 'Tổ 3', 'Tổ 4', 'Tổ 5', 'Tổ 6', 'Tổ 7', 'Tổ 8'];
    const fromResidents = residents.map((r) => r.groupNumber).filter(Boolean);
    const fromHouseholds = households.map((h) => h.groupNumber).filter(Boolean);
    return Array.from(new Set([...base, ...fromResidents, ...fromHouseholds]));
  }, [residents, households]);

  // Filtered residents
  const filteredResidents = useMemo(() => {
    return residents.filter((r) => {
      // Search
      const s = search.toLowerCase();
      const matchSearch =
        !search ||
        r.fullName.toLowerCase().includes(s) ||
        (r.nationalId && r.nationalId.includes(s)) ||
        r.residentCode.toLowerCase().includes(s) ||
        (r.householdCode && r.householdCode.toLowerCase().includes(s)) ||
        (r.phone && r.phone.includes(s));

      // Filter by House Number / Address
      const matchHouse =
        !houseNumberFilter ||
        (r.address && r.address.toLowerCase().includes(houseNumberFilter.toLowerCase().trim()));

      // Group
      const matchGroup = selectedGroup === 'ALL' || r.groupNumber === selectedGroup;

      // Status
      const matchStatus =
        selectedResidenceStatus === 'ALL' || r.residenceStatus === selectedResidenceStatus;

      // Classification
      let matchClass = true;
      if (selectedClassification === 'POOR') matchClass = !!r.isPoorHousehold;
      else if (selectedClassification === 'NEAR_POOR') matchClass = !!r.isNearPoorHousehold;
      else if (selectedClassification === 'POLICY') matchClass = !!r.isPolicyBeneficiary;
      else if (selectedClassification === 'ELDERLY') matchClass = !!r.isElderly;
      else if (selectedClassification === 'CHILD') matchClass = !!r.isChild;
      else if (selectedClassification === 'DISABLED') matchClass = !!r.isDisabled;

      return matchSearch && matchHouse && matchGroup && matchStatus && matchClass;
    });
  }, [residents, search, houseNumberFilter, selectedGroup, selectedResidenceStatus, selectedClassification]);

  // Filtered households
  const filteredHouseholds = useMemo(() => {
    return households.filter((h) => {
      if (hhSearch) {
        const s = hhSearch.toLowerCase().trim();
        const matchBasic =
          h.householdCode.toLowerCase().includes(s) ||
          h.headResidentName.toLowerCase().includes(s) ||
          (h.phone && h.phone.toLowerCase().includes(s)) ||
          (h.address && h.address.toLowerCase().includes(s));

        if (matchBasic) return true;

        // Search members in this household
        const hasMemberMatch = residents.some(
          (r) =>
            !r.isArchived &&
            ((r.householdId && r.householdId === h.id) ||
              (r.householdCode && r.householdCode.trim().toLowerCase() === h.householdCode.trim().toLowerCase())) &&
            (r.fullName.toLowerCase().includes(s) || (r.nationalId && r.nationalId.includes(s)))
        );
        if (hasMemberMatch) return true;
        return false;
      }

      if (hhGroupFilter !== 'ALL' && h.groupNumber !== hhGroupFilter) return false;
      if (hhClassificationFilter !== 'ALL' && h.classification !== hhClassificationFilter) return false;

      return true;
    });
  }, [households, residents, hhSearch, hhGroupFilter, hhClassificationFilter]);

  // Household stats
  const householdStats = useMemo(() => {
    const totalHh = households.length;
    const poorCount = households.filter((h) => h.classification === 'Hộ nghèo').length;
    const nearPoorCount = households.filter((h) => h.classification === 'Cận nghèo').length;
    const policyCount = households.filter((h) => h.classification === 'Gia đình chính sách').length;
    const residentsInHouseholds = residents.filter(
      (r) => !r.isArchived && (r.householdId || r.householdCode)
    ).length;

    return { totalHh, poorCount, nearPoorCount, policyCount, residentsInHouseholds };
  }, [households, residents]);

  // Mask helper
  const displayCCCD = (cccd?: string) => {
    if (!cccd) return 'Chưa có';
    if (!maskCCCD) return cccd;
    return cccd.slice(0, 6) + '******';
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Sub Tabs and Top Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-container-high pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveSubTab('residents')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'residents'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Sổ Nhân khẩu ({residents.length})
          </button>
          <button
            onClick={() => setActiveSubTab('households')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeSubTab === 'households'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            Sổ Hộ gia đình ({households.length})
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeSubTab === 'residents' && hasPerm('residents.export') && (
            <button
              onClick={() => exportResidentsToExcel(filteredResidents)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors"
            >
              <span className="material-symbols-outlined text-base text-emerald-700">file_download</span>
              <span>Xuất Excel (.xlsx)</span>
            </button>
          )}

          {activeSubTab === 'residents' && hasPerm('residents.create') && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-highest transition-colors"
              >
                <span className="material-symbols-outlined text-base text-primary">upload_file</span>
                <span>Nhập từ file mẫu</span>
              </button>

              <button
                onClick={openCreateResidentModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-98"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                <span>Thêm nhân khẩu</span>
              </button>
            </>
          )}

          {activeSubTab === 'households' && hasPerm('households.create') && (
            <button
              onClick={openCreateHouseholdModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-98"
            >
              <span className="material-symbols-outlined text-base">add_home</span>
              <span>Tạo sổ hộ mới</span>
            </button>
          )}
        </div>
      </div>

      {activeSubTab === 'residents' ? (
        <>
          {/* Filter and Search Toolbar */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high space-y-3 shadow-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Tìm theo tên cử tri, CCCD, Mã nhân khẩu (NK-...), Hộ khẩu, Số ĐT..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Quick Filter by House Number */}
              <div className="relative w-full md:w-52">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-base">
                  home
                </span>
                <input
                  type="text"
                  value={houseNumberFilter}
                  onChange={(e) => setHouseNumberFilter(e.target.value)}
                  placeholder="Lọc số nhà / đường..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
                {houseNumberFilter && (
                  <button
                    onClick={() => setHouseNumberFilter('')}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>

              {/* Group Filter */}
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium text-on-surface"
              >
                <option value="ALL">Tất cả Tổ dân cư</option>
                {availableGroups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedResidenceStatus}
                onChange={(e) => setSelectedResidenceStatus(e.target.value)}
                className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium text-on-surface"
              >
                <option value="ALL">Tất cả cư trú</option>
                <option value="Thường trú">Thường trú</option>
                <option value="Tạm trú">Tạm trú</option>
                <option value="Tạm vắng">Tạm vắng</option>
              </select>

              {/* Mask CCCD Toggle */}
              <button
                onClick={() => setMaskCCCD(!maskCCCD)}
                className={`flex items-center gap-1 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                  maskCCCD
                    ? 'bg-surface-container border-surface-container-highest text-on-surface-variant'
                    : 'bg-primary-fixed border-primary/20 text-on-primary-fixed'
                }`}
                title="Bật/Tắt che số CCCD bảo mật"
              >
                <span className="material-symbols-outlined text-base">
                  {maskCCCD ? 'visibility_off' : 'visibility'}
                </span>
                <span>{maskCCCD ? 'Ẩn CCCD' : 'Hiện CCCD'}</span>
              </button>
            </div>

            {/* Quick Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold text-on-surface-variant mr-1">Lọc nhanh:</span>
              {[
                { id: 'ALL', label: 'Tất cả' },
                { id: 'POOR', label: 'Hộ nghèo' },
                { id: 'NEAR_POOR', label: 'Cận nghèo' },
                { id: 'POLICY', label: 'Chính sách/Người có công' },
                { id: 'ELDERLY', label: 'Cao tuổi (≥60)' },
                { id: 'CHILD', label: 'Trẻ em (<16)' },
                { id: 'DISABLED', label: 'Khuyết tật' },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setSelectedClassification(chip.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    selectedClassification === chip.id
                      ? 'bg-primary text-white font-bold shadow-2xs'
                      : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Residents Table / List */}
          <div className="bg-surface-container-lowest rounded-2xl border border-surface-container-high overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-semibold">
                    <th className="py-3 px-4 w-28">Mã NK</th>
                    <th className="py-3 px-4">Họ và tên</th>
                    <th className="py-3 px-4">Ngày sinh</th>
                    <th className="py-3 px-4">CCCD</th>
                    <th className="py-3 px-4">Tổ / Hộ</th>
                    <th className="py-3 px-4">Quan hệ</th>
                    <th className="py-3 px-4">Đối tượng</th>
                    <th className="py-3 px-4">Cư trú</th>
                    <th className="py-3 px-4 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                        Đang tải danh sách nhân khẩu...
                      </td>
                    </tr>
                  ) : filteredResidents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-on-surface-variant">
                        Không tìm thấy nhân khẩu nào phù hợp tiêu chí lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredResidents.map((r) => (
                      <tr key={r.id} className="hover:bg-surface-container-low/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {r.residentCode}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-on-surface">{r.fullName}</div>
                          <div className="text-[11px] text-on-surface-variant">{r.phone || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-numeric-data">
                          {formatDateVN(r.dateOfBirth)}
                          <div className="text-[10px] text-on-surface-variant">{r.gender}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-medium text-slate-700">
                          {displayCCCD(r.nationalId)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-1.5 py-0.5 rounded-md bg-surface-container font-semibold text-slate-700">
                            {r.groupNumber}
                          </span>
                          {r.householdCode && (
                            <div className="text-[10px] text-primary font-mono mt-0.5">
                              {r.householdCode}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-medium">{r.relationshipToHead || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {r.isPoorHousehold && (
                              <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-semibold">
                                Hộ nghèo
                              </span>
                            )}
                            {r.isNearPoorHousehold && (
                              <span className="px-1.5 py-0.5 rounded-md bg-orange-100 text-orange-800 text-[10px] font-semibold">
                                Cận nghèo
                              </span>
                            )}
                            {r.isPolicyBeneficiary && (
                              <span className="px-1.5 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed text-[10px] font-semibold">
                                Chính sách
                              </span>
                            )}
                            {r.isElderly && (
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-semibold">
                                Cao tuổi
                              </span>
                            )}
                            {r.isDisabled && (
                              <span className="px-1.5 py-0.5 rounded-md bg-purple-100 text-purple-900 text-[10px] font-semibold">
                                Khuyết tật
                              </span>
                            )}
                            {!r.isPoorHousehold &&
                              !r.isNearPoorHousehold &&
                              !r.isPolicyBeneficiary &&
                              !r.isElderly &&
                              !r.isDisabled && (
                                <span className="text-[11px] text-on-surface-variant italic">Bình thường</span>
                              )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                              r.residenceStatus === 'Thường trú'
                                ? 'bg-emerald-100 text-emerald-800'
                                : r.residenceStatus === 'Tạm trú'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {r.residenceStatus}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {hasPerm('residents.update') && (
                              <button
                                onClick={() => openEditResidentModal(r)}
                                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                                title="Chỉnh sửa hồ sơ"
                              >
                                <span className="material-symbols-outlined text-lg">edit</span>
                              </button>
                            )}
                            {hasPerm('residents.archive') && (
                              <button
                                onClick={() => {
                                  setArchiveTarget(r);
                                  setArchiveReason('');
                                }}
                                className="p-1 rounded-lg hover:bg-surface-container text-on-surface-variant hover:text-amber-700 transition-colors"
                                title="Lưu trữ nhân khẩu"
                              >
                                <span className="material-symbols-outlined text-lg">archive</span>
                              </button>
                            )}
                            <button
                              onClick={() => setDeleteTarget(r)}
                              className="p-1 rounded-lg hover:bg-error-container/40 text-on-surface-variant hover:text-error transition-colors"
                              title="Xóa vĩnh viễn dữ liệu người dân"
                            >
                              <span className="material-symbols-outlined text-lg">delete_forever</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Households Tab */
        <div className="space-y-4">
          {/* Quick Statistics Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container-high flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">home</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-on-surface-variant">Tổng số hộ</p>
                <p className="text-lg font-bold text-on-surface">{householdStats.totalHh} <span className="text-xs font-normal text-slate-500">hộ</span></p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container-high flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">groups</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-on-surface-variant">Đã vào sổ hộ</p>
                <p className="text-lg font-bold text-on-surface">{householdStats.residentsInHouseholds} <span className="text-xs font-normal text-slate-500">nhân khẩu</span></p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container-high flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">volunteer_activism</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-on-surface-variant">Nghèo / Cận nghèo</p>
                <p className="text-lg font-bold text-on-surface">
                  {householdStats.poorCount + householdStats.nearPoorCount}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    ({householdStats.poorCount} nghèo)
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-3.5 rounded-2xl border border-surface-container-high flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">military_tech</span>
              </div>
              <div>
                <p className="text-[11px] font-medium text-on-surface-variant">Hộ chính sách</p>
                <p className="text-lg font-bold text-on-surface">{householdStats.policyCount} <span className="text-xs font-normal text-slate-500">hộ</span></p>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high space-y-3 shadow-xs">
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-lg">
                  search
                </span>
                <input
                  type="text"
                  value={hhSearch}
                  onChange={(e) => setHhSearch(e.target.value)}
                  placeholder="Tìm theo mã hộ (HA_...), tên chủ hộ, tên thành viên trong hộ, SĐT, địa chỉ..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:outline-hidden focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Group Filter */}
                <select
                  value={hhGroupFilter}
                  onChange={(e) => setHhGroupFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">Tất cả tổ dân cư</option>
                  {availableGroups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>

                {/* Classification Filter */}
                <select
                  value={hhClassificationFilter}
                  onChange={(e) => setHhClassificationFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium focus:ring-2 focus:ring-primary/20"
                >
                  <option value="ALL">Tất cả phân loại</option>
                  <option value="Bình thường">Bình thường</option>
                  <option value="Hộ nghèo">Hộ nghèo</option>
                  <option value="Cận nghèo">Cận nghèo</option>
                  <option value="Gia đình chính sách">Gia đình chính sách</option>
                </select>

                {(hhSearch || hhGroupFilter !== 'ALL' || hhClassificationFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setHhSearch('');
                      setHhGroupFilter('ALL');
                      setHhClassificationFilter('ALL');
                    }}
                    className="p-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs font-medium"
                    title="Xóa bộ lọc"
                  >
                    <span className="material-symbols-outlined text-base">filter_alt_off</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Household Cards Grid */}
          {filteredHouseholds.length === 0 ? (
            <div className="p-12 text-center bg-surface-container-lowest rounded-3xl border border-dashed border-surface-container-high space-y-3">
              <span className="material-symbols-outlined text-4xl text-slate-400">roofing</span>
              <p className="text-sm font-semibold text-on-surface">Không tìm thấy sổ hộ gia đình nào phù hợp</p>
              <p className="text-xs text-on-surface-variant max-w-md mx-auto">
                Hãy thử thay đổi từ khóa tìm kiếm hoặc bấm nút Tạo sổ hộ mới để thêm hộ gia đình vào danh bạ số.
              </p>
              {hasPerm('households.create') && (
                <button
                  onClick={openCreateHouseholdModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container shadow-xs"
                >
                  <span className="material-symbols-outlined text-base">add_home</span>
                  <span>Tạo sổ hộ mới ngay</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredHouseholds.map((h) => {
                const hhMembers = residents.filter(
                  (r) =>
                    !r.isArchived &&
                    ((r.householdId && r.householdId === h.id) ||
                      (r.householdCode &&
                        r.householdCode.trim().toLowerCase() === h.householdCode.trim().toLowerCase()))
                );

                const headMember = hhMembers.find(
                  (m) =>
                    m.relationshipToHead === 'Chủ hộ' ||
                    m.fullName.trim().toUpperCase() === h.headResidentName.trim().toUpperCase()
                );
                const otherMembers = hhMembers.filter((m) => m.id !== headMember?.id);

                return (
                  <div
                    key={h.id}
                    className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high space-y-3 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      {/* Top bar with Household Code and Classification */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-lg border border-primary/20">
                              {h.householdCode}
                            </span>
                            <span className="text-[11px] font-semibold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-md">
                              {h.groupNumber}
                            </span>
                          </div>
                          <h4 className="font-bold text-base text-on-surface pt-0.5 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-amber-600 text-lg">hotel_class</span>
                            <span>{h.headResidentName}</span>
                          </h4>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            h.classification === 'Hộ nghèo'
                              ? 'bg-red-100 text-red-800'
                              : h.classification === 'Cận nghèo'
                              ? 'bg-orange-100 text-orange-800'
                              : h.classification === 'Gia đình chính sách'
                              ? 'bg-primary-fixed text-on-primary-fixed'
                              : 'bg-surface-container text-on-surface-variant'
                          }`}
                        >
                          {h.classification}
                        </span>
                      </div>

                      {/* Address & Phone */}
                      <div className="text-xs text-on-surface-variant space-y-1 pt-2 border-t border-surface-container-high">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-slate-400">location_on</span>
                          <span className="truncate">{h.address}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-slate-400">call</span>
                          <span>{h.phone || 'Chưa cập nhật SĐT'}</span>
                        </div>
                        {h.notes && (
                          <div className="italic text-[11px] text-slate-500 pt-0.5">
                            <span className="font-medium">Ghi chú:</span> {h.notes}
                          </div>
                        )}
                      </div>

                      {/* Members Preview */}
                      <div className="pt-2 border-t border-surface-container-high space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-on-surface flex items-center gap-1">
                            <span className="material-symbols-outlined text-primary text-sm">groups</span>
                            <span>Thành viên trong sổ ({hhMembers.length}):</span>
                          </span>
                          <span className="text-[11px] font-mono text-slate-500">
                            {hhMembers.length > 0 ? `${hhMembers.length} người` : 'Trống'}
                          </span>
                        </div>

                        {hhMembers.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic bg-surface-container/50 px-2.5 py-1.5 rounded-lg">
                            Chưa có thành viên nào được liên kết vào sổ hộ này. Bấm nút bên dưới để xem & thêm.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {headMember && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-900 border border-amber-500/30 text-[11px] font-medium">
                                <span>👑 {headMember.fullName}</span>
                                <span className="text-[9px] text-amber-700 font-normal">(Chủ hộ)</span>
                              </span>
                            )}
                            {otherMembers.slice(0, 3).map((m) => (
                              <span
                                key={m.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-container text-on-surface text-[11px]"
                              >
                                <span>{m.fullName}</span>
                                <span className="text-[9px] text-slate-400">
                                  ({m.relationshipToHead || 'TV'})
                                </span>
                              </span>
                            ))}
                            {otherMembers.length > 3 && (
                              <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant text-[11px] font-medium">
                                +{otherMembers.length - 3} người khác
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="pt-3 border-t border-surface-container-high space-y-2">
                      <button
                        onClick={() => openHouseholdDetailModal(h)}
                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-all shadow-xs active:scale-98"
                      >
                        <span className="material-symbols-outlined text-base">family_restroom</span>
                        <span>Xem & Chỉnh sửa thành viên ({hhMembers.length})</span>
                      </button>

                      <div className="flex items-center justify-between gap-2 pt-1 text-xs">
                        {hasPerm('residents.create') && (
                          <button
                            onClick={() => handleAddNewMemberFromHousehold(h)}
                            className="flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-800 hover:underline"
                            title="Thêm nhân khẩu mới vào sổ hộ này"
                          >
                            <span className="material-symbols-outlined text-sm">person_add</span>
                            <span>Thêm nhân khẩu</span>
                          </button>
                        )}

                        <div className="flex items-center gap-2 ml-auto">
                          {hasPerm('households.update') && (
                            <button
                              onClick={() => openEditHouseholdModal(h)}
                              className="font-medium text-primary hover:underline"
                            >
                              Sửa hộ
                            </button>
                          )}

                          {hasPerm('households.delete') && (
                            <button
                              onClick={() => setDeleteHouseholdTarget(h)}
                              className="font-medium text-error hover:underline"
                            >
                              Xóa sổ
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Create/Edit Resident */}
      {isResidentModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-2xl w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  {editingResident ? 'Cập nhật hồ sơ nhân khẩu' : 'Thêm nhân khẩu mới'}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Nhập thông tin nhân khẩu vào cơ sở dữ liệu số {settings.hamletName || 'Ấp Bình Hòa'}
                </p>
              </div>
              <button
                onClick={() => setIsResidentModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveResident} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Họ và tên <span className="text-error">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={resFullName}
                    onChange={(e) => setResFullName(e.target.value)}
                    placeholder="NGUYỄN VĂN HÙNG"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs uppercase focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số CCCD (12 số)
                  </label>
                  <input
                    type="text"
                    maxLength={12}
                    value={resNationalId}
                    onChange={(e) => setResNationalId(e.target.value.replace(/\D/g, ''))}
                    placeholder="079068001234"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface font-mono text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Ngày sinh (YYYY-MM-DD)
                  </label>
                  <input
                    type="date"
                    value={resDob}
                    onChange={(e) => setResDob(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Giới tính
                  </label>
                  <select
                    value={resGender}
                    onChange={(e) => setResGender(e.target.value as 'Nam' | 'Nữ' | 'Khác')}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    placeholder="0918.234.567"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tổ dân cư <span className="text-slate-400 font-normal">(chọn hoặc gõ tên tổ tùy chỉnh)</span>
                  </label>
                  <input
                    type="text"
                    list="resGroupSuggestions"
                    required
                    value={resGroup}
                    onChange={(e) => setResGroup(e.target.value)}
                    placeholder="VD: Tổ 1, Tổ Tự Quản..."
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="resGroupSuggestions">
                    {availableGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Thuộc Sổ Hộ gia đình
                  </label>
                  <select
                    value={resHouseholdId}
                    onChange={(e) => setResHouseholdId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="">-- Không chọn / Hộ riêng --</option>
                    {households.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.householdCode} - {h.headResidentName} ({h.groupNumber})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Quan hệ với chủ hộ
                  </label>
                  <select
                    value={resRelationship}
                    onChange={(e) => setResRelationship(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="Chủ hộ">Chủ hộ</option>
                    <option value="Vợ/Chồng">Vợ/Chồng</option>
                    <option value="Con">Con</option>
                    <option value="Cha/Mẹ">Cha/Mẹ</option>
                    <option value="Ông/Bà">Ông/Bà</option>
                    <option value="Cháu">Cháu</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tình trạng cư trú
                  </label>
                  <select
                    value={resStatus}
                    onChange={(e) =>
                      setResStatus(e.target.value as 'Thường trú' | 'Tạm trú' | 'Tạm vắng')
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  >
                    <option value="Thường trú">Thường trú</option>
                    <option value="Tạm trú">Tạm trú</option>
                    <option value="Tạm vắng">Tạm vắng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Địa chỉ chi tiết
                  </label>
                  <input
                    type="text"
                    value={resAddress}
                    onChange={(e) => setResAddress(e.target.value)}
                    placeholder="Số 45, Đường số 2, Ấp Bình Hòa"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>
              </div>

              {/* Classifications Checkboxes */}
              <div className="pt-2 border-t border-surface-container-high">
                <label className="block text-xs font-semibold text-on-surface mb-2">
                  Diện chính sách & Phân loại an sinh xã hội:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsPoor}
                      onChange={(e) => setResIsPoor(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Hộ nghèo</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsNearPoor}
                      onChange={(e) => setResIsNearPoor(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Hộ cận nghèo</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsPolicy}
                      onChange={(e) => setResIsPolicy(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Gia đình chính sách</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsElderly}
                      onChange={(e) => setResIsElderly(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Người cao tuổi (≥60)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsChild}
                      onChange={(e) => setResIsChild(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Trẻ em (&lt;16)</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-xl bg-surface border border-surface-container-highest cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resIsDisabled}
                      onChange={(e) => setResIsDisabled(e.target.checked)}
                      className="rounded-sm text-primary"
                    />
                    <span>Khuyết tật</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Ghi chú nghiệp vụ
                </label>
                <textarea
                  rows={2}
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  placeholder="Ghi chú đặc thù (khó khăn đi lại, hoàn cảnh gia đình...)"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-surface-container-high">
                {editingResident ? (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(editingResident)}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-error hover:bg-error-container/40 transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete_forever</span>
                    <span>Xóa người dân này</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsResidentModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                  >
                    {saving ? 'Đang lưu...' : editingResident ? 'Lưu thay đổi' : 'Đăng ký nhân khẩu'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create/Edit Household */}
      {isHouseholdModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in">
            <div className="p-6 border-b border-surface-container-high flex items-center justify-between">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  {editingHousehold ? 'Chỉnh sửa Sổ Hộ gia đình' : 'Tạo Sổ Hộ gia đình mới'}
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Mã hộ quy ước viết tắt theo ấp (ví dụ Ấp Hưng An là <span className="font-mono font-bold text-primary">HA_...</span>)
                </p>
              </div>
              <button
                onClick={() => setIsHouseholdModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveHousehold} className="p-6 space-y-4">
              {errorMsg && (
                <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Household Code Field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-on-surface">
                    Mã hộ gia đình <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Viết tắt theo ấp: <strong className="text-primary font-mono">{getHamletAbbreviation(settings.hamletName)}_...</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      required
                      value={hhCode}
                      onChange={(e) => setHhCode(e.target.value.toUpperCase())}
                      placeholder={`VD: ${getHamletAbbreviation(settings.hamletName)}_001`}
                      className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface font-mono font-bold text-xs uppercase tracking-wider focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setHhCode(suggestNextHouseholdCode(households, settings.hamletName))}
                    className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface-container text-xs font-medium text-primary hover:bg-surface-container-high transition-colors whitespace-nowrap"
                    title="Gợi ý mã số tự động tiếp theo"
                  >
                    Gợi ý mã
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Họ và tên chủ hộ <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={hhHeadName}
                  onChange={(e) => setHhHeadName(e.target.value)}
                  placeholder="NGUYỄN VĂN HÙNG"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Tổ dân cư <span className="text-slate-400 font-normal">(tùy chỉnh hoặc chọn)</span>
                  </label>
                  <input
                    type="text"
                    list="hhGroupSuggestions"
                    required
                    value={hhGroup}
                    onChange={(e) => setHhGroup(e.target.value)}
                    placeholder="VD: Tổ 1"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium focus:ring-2 focus:ring-primary/20"
                  />
                  <datalist id="hhGroupSuggestions">
                    {availableGroups.map((g) => (
                      <option key={g} value={g} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-on-surface mb-1">
                    Số điện thoại
                  </label>
                  <input
                    type="text"
                    value={hhPhone}
                    onChange={(e) => setHhPhone(e.target.value)}
                    placeholder="0918.234.567"
                    className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Địa chỉ thường trú hộ
                </label>
                <input
                  type="text"
                  required
                  value={hhAddress}
                  onChange={(e) => setHhAddress(e.target.value)}
                  placeholder="Số 45, Đường số 2, Ấp Hưng An"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Phân loại mức sống hộ
                </label>
                <select
                  value={hhClassification}
                  onChange={(e) =>
                    setHhClassification(
                      e.target.value as 'Bình thường' | 'Hộ nghèo' | 'Cận nghèo' | 'Gia đình chính sách'
                    )
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-medium"
                >
                  <option value="Bình thường">Hộ dân cư bình thường</option>
                  <option value="Hộ nghèo">Hộ nghèo (Hưởng chuẩn nghèo)</option>
                  <option value="Cận nghèo">Hộ cận nghèo</option>
                  <option value="Gia đình chính sách">Gia đình chính sách (Người có công)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">
                  Ghi chú sổ hộ
                </label>
                <textarea
                  rows={2}
                  value={hhNotes}
                  onChange={(e) => setHhNotes(e.target.value)}
                  placeholder="Ghi chú về hoàn cảnh, mã số sổ hộ..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => setIsHouseholdModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:bg-surface-container"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
                >
                  {saving ? 'Đang lưu...' : editingHousehold ? 'Lưu thay đổi' : 'Tạo sổ hộ mới'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Household Detail Modal (View & Edit Members) */}
      <HouseholdDetailModal
        isOpen={isHouseholdDetailOpen}
        onClose={() => {
          setIsHouseholdDetailOpen(false);
          setSelectedHouseholdForDetail(null);
        }}
        household={selectedHouseholdForDetail}
        residents={residents}
        onRefresh={loadAll}
        onAddNewResident={(hh) => {
          setIsHouseholdDetailOpen(false);
          handleAddNewMemberFromHousehold(hh);
        }}
        onEditHousehold={openEditHouseholdModal}
        onEditResident={openEditResidentModal}
        hasPerm={hasPerm}
        user={user}
        userProfile={userProfile}
        hamletName={settings.hamletName}
      />

      {/* Delete Household Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteHouseholdTarget}
        title="Xóa Sổ Hộ gia đình"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa sổ hộ gia đình của chủ hộ "${deleteHouseholdTarget?.headResidentName}" (Mã hộ: ${deleteHouseholdTarget?.householdCode})? Các nhân khẩu thuộc sổ hộ này sẽ không bị xóa vĩnh viễn mà chỉ được gỡ liên kết khỏi mã hộ này.`}
        confirmText={deletingHousehold ? 'Đang xóa...' : 'Xóa sổ hộ'}
        onConfirm={handleDeleteHouseholdConfirm}
        onCancel={() => setDeleteHouseholdTarget(null)}
      />

      {/* Archive Modal Confirmation */}
      <ConfirmModal
        isOpen={!!archiveTarget}
        title="Lưu trữ / Xóa nhân khẩu"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn lưu trữ hồ sơ nhân khẩu ${archiveTarget?.fullName} (${archiveTarget?.residentCode})? Hồ sơ sẽ được ẩn khỏi danh sách thường trực.`}
        confirmText="Xác nhận lưu trữ"
        onConfirm={handleArchiveConfirm}
        onCancel={() => setArchiveTarget(null)}
      >
        <div>
          <label className="block text-xs font-semibold text-on-surface mb-1">
            Lý do giải trình (Bắt buộc theo quy định kiểm toán):
          </label>
          <input
            type="text"
            required
            value={archiveReason}
            onChange={(e) => setArchiveReason(e.target.value)}
            placeholder="Ví dụ: Chuyển hộ khẩu sang nơi khác, qua đời..."
            className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
          />
        </div>
      </ConfirmModal>

      {/* Permanent Delete Modal Confirmation */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Xóa vĩnh viễn dữ liệu người dân"
        isDangerous={true}
        description={`Bạn có chắc chắn muốn xóa hoàn toàn dữ liệu hồ sơ của người dân ${deleteTarget?.fullName} (${deleteTarget?.residentCode})? Dữ liệu sẽ bị xóa vĩnh viễn khỏi hệ thống và không thể khôi phục.`}
        confirmText={deleting ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
        onConfirm={handleDeleteResidentConfirm}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Import Residents Modal */}
      <ImportResidentsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={loadAll}
        availableGroups={availableGroups}
      />
    </div>
  );
}
