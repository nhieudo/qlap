import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import {
  getAuditLogs,
  getAllUsers,
  updateUserProfileRole,
  backupDatabaseToJson,
  restoreDatabaseFromJson,
  getFinanceCategories,
  createFinanceCategory,
  deleteFinanceCategory,
  createInvitation,
  getInvitations,
  revokeInvitation,
} from '../services/db';
import { seedDemoData } from '../services/seedData';
import { AuditLog, UserProfile, FinanceCategory, UserInvitation } from '../types';
import { formatDateVN } from '../utils/numberToWords';
import { DEFAULT_ROLES, GRASSROOTS_POSITIONS, getDefaultRoleIdForPosition } from '../utils/rbac';
import { ConfirmModal } from '../components/ConfirmModal';

interface SettingsViewProps {
  initialTab?: 'info' | 'users' | 'categories' | 'backup' | 'audit' | 'profile';
}

export function SettingsView({ initialTab }: SettingsViewProps = {}) {
  const { user, userProfile, isAdmin, role, hasPerm, updateMyProfile } = useAuth();
  const { settings, saveSettings } = useSettings();

  const [activeTab, setActiveTab] = useState<'info' | 'users' | 'categories' | 'backup' | 'audit' | 'profile'>(
    initialTab || (isAdmin ? 'info' : 'profile')
  );

  // Profile Form States
  const [profileFullName, setProfileFullName] = useState(userProfile?.fullName || user?.displayName || '');
  const [profileAddress, setProfileAddress] = useState(userProfile?.address || '');
  const [profilePhone, setProfilePhone] = useState(userProfile?.phone || '');
  const [profilePosition, setProfilePosition] = useState(userProfile?.position || '');
  const [isCustomPos, setIsCustomPos] = useState(false);
  const [customPosText, setCustomPosText] = useState('');
  const [profileRoleId, setProfileRoleId] = useState(userProfile?.roleId || 'VIEWER');
  const [syncToVoucherSignatures, setSyncToVoucherSignatures] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null);
  const [profileErrorMsg, setProfileErrorMsg] = useState<string | null>(null);

  // Admin Info Form State (Chỉ còn Ấp, Xã, Tỉnh theo quy định mới)
  const [hamletName, setHamletName] = useState(settings.hamletName || '');
  const [communeName, setCommuneName] = useState(settings.communeName || '');
  const [provinceName, setProvinceName] = useState(settings.provinceName || '');
  const [hamletLeaderName, setHamletLeaderName] = useState(settings.hamletLeaderName || '');
  const [financeOfficerName, setFinanceOfficerName] = useState(settings.financeOfficerName || '');
  const [treasurerName, setTreasurerName] = useState(settings.treasurerName || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [address, setAddress] = useState(settings.address || '');
  const [superiorAgency, setSuperiorAgency] = useState(settings.voucherSettings?.superiorAgency || '');
  const [agencyName, setAgencyName] = useState(settings.voucherSettings?.agencyName || '');
  const [templateStandard, setTemplateStandard] = useState(settings.voucherSettings?.templateStandard || '');
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Users Management & Invitations
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [invitations, setInvitations] = useState<UserInvitation[]>([]);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRoleId, setInviteRoleId] = useState('SECRETARY');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [createdInviteLink, setCreatedInviteLink] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // Categories Management
  const [categories, setCategories] = useState<FinanceCategory[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<'INCOME' | 'EXPENSE'>('INCOME');

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Backup & Restore
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreMode, setRestoreMode] = useState<'MERGE' | 'REPLACE'>('MERGE');
  const [restoring, setRestoring] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Seed Data Modal
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Sync settings when changed externally
  useEffect(() => {
    if (settings) {
      setHamletName(settings.hamletName || '');
      setCommuneName(settings.communeName || '');
      setProvinceName(settings.provinceName || '');
      setHamletLeaderName(settings.hamletLeaderName || '');
      setFinanceOfficerName(settings.financeOfficerName || '');
      setTreasurerName(settings.treasurerName || '');
      setPhone(settings.phone || '');
      setAddress(settings.address || '');
      setSuperiorAgency(settings.voucherSettings?.superiorAgency || '');
      setAgencyName(settings.voucherSettings?.agencyName || '');
      setTemplateStandard(settings.voucherSettings?.templateStandard || '');
    }
  }, [settings]);

  // Sync profile state when userProfile is loaded or updated
  useEffect(() => {
    if (userProfile) {
      setProfileFullName(userProfile.fullName || user?.displayName || '');
      setProfileAddress(userProfile.address || '');
      setProfilePhone(userProfile.phone || '');
      setProfileRoleId(userProfile.roleId || 'VIEWER');

      const initialPos = (userProfile.position || '').trim();
      const matched = GRASSROOTS_POSITIONS.find(
        (p) => p.title.toLowerCase() === initialPos.toLowerCase()
      );
      if (matched) {
        setProfilePosition(matched.title);
        setIsCustomPos(false);
        setCustomPosText('');
      } else if (initialPos) {
        setProfilePosition('CUSTOM');
        setIsCustomPos(true);
        setCustomPosText(initialPos);
      } else {
        const defaultPreset = GRASSROOTS_POSITIONS.find((p) => p.defaultRoleId === userProfile.roleId);
        if (defaultPreset) {
          setProfilePosition(defaultPreset.title);
          setIsCustomPos(false);
        } else {
          setProfilePosition(GRASSROOTS_POSITIONS[2].title);
        }
      }
    }
  }, [userProfile, user]);

  const handleProfilePositionSelect = (posTitle: string) => {
    setProfilePosition(posTitle);
    if (posTitle === 'CUSTOM') {
      setIsCustomPos(true);
    } else {
      setIsCustomPos(false);
      const matched = GRASSROOTS_POSITIONS.find((p) => p.title === posTitle);
      if (matched) {
        setProfileRoleId(matched.defaultRoleId);
      }
    }
  };

  const handleProfileCustomPosChange = (text: string) => {
    setCustomPosText(text);
    const calculatedRole = getDefaultRoleIdForPosition(text);
    setProfileRoleId(calculatedRole);
  };

  const currentEffectivePos = isCustomPos ? customPosText.trim() : profilePosition.trim();
  const isKeyPosition =
    currentEffectivePos.toLowerCase().includes('trưởng ấp') ||
    currentEffectivePos.toLowerCase().includes('trưởng thôn') ||
    currentEffectivePos.toLowerCase().includes('kế toán') ||
    currentEffectivePos.toLowerCase().includes('thư ký') ||
    currentEffectivePos.toLowerCase().includes('thủ quỹ');

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!profileFullName.trim()) {
      setProfileErrorMsg('Vui lòng nhập họ và tên cán bộ.');
      return;
    }
    const finalPos = isCustomPos ? customPosText.trim() : profilePosition.trim();
    if (!finalPos) {
      setProfileErrorMsg('Vui lòng chọn hoặc nhập chức vụ công tác.');
      return;
    }

    setSavingProfile(true);
    setProfileErrorMsg(null);
    setProfileSuccessMsg(null);

    try {
      await updateMyProfile(
        {
          fullName: profileFullName.trim(),
          address: profileAddress.trim(),
          phone: profilePhone.trim(),
          position: finalPos,
          roleId: profileRoleId,
        },
        syncToVoucherSignatures && isKeyPosition
      );

      setProfileSuccessMsg(
        `Cập nhật hồ sơ thành công! Đã ghi nhận chức vụ "${finalPos}" và cập nhật phân quyền hệ thống.`
      );
      setTimeout(() => {
        setProfileSuccessMsg(null);
      }, 4000);
    } catch (err: unknown) {
      console.error(err);
      setProfileErrorMsg((err as Error)?.message || 'Lỗi khi lưu hồ sơ.');
    } finally {
      setSavingProfile(false);
    }
  };

  const loadUsersAndInvites = async () => {
    if (isAdmin) {
      try {
        const [uList, invList] = await Promise.all([getAllUsers(), getInvitations()]);
        setUsers(uList);
        setInvitations(invList);
      } catch (err) {
        console.error(err);
      }
    }
  };

  useEffect(() => {
    async function loadTabData() {
      try {
        if (activeTab === 'users' && isAdmin) {
          await loadUsersAndInvites();
        } else if (activeTab === 'categories') {
          const cList = await getFinanceCategories();
          setCategories(cList);
        } else if (activeTab === 'audit' && isAdmin) {
          const logs = await getAuditLogs(100);
          setAuditLogs(logs);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadTabData();
  }, [activeTab, isAdmin]);

  // Handle saving organization info (Không còn huyện)
  const handleSaveInfo = async (e: FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      alert('Chỉ có Quản trị viên mới có quyền cập nhật cấu hình đơn vị.');
      return;
    }
    setSavingSettings(true);
    setSuccessMsg(null);
    try {
      await saveSettings(
        {
          hamletName: hamletName.trim(),
          communeName: communeName.trim(),
          provinceName: provinceName.trim(),
          hamletLeaderName: hamletLeaderName.trim(),
          financeOfficerName: financeOfficerName.trim(),
          treasurerName: treasurerName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          voucherSettings: {
            ...settings.voucherSettings,
            superiorAgency: superiorAgency.trim(),
            agencyName: agencyName.trim(),
            templateStandard: templateStandard.trim(),
          },
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Quản trị viên'
      );
      setSuccessMsg('Đã lưu cấu hình đơn vị hành chính và mẫu chứng từ thành công!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Change user role
  const handleRoleChange = async (userId: string, newRoleId: string) => {
    if (!isAdmin) return;
    try {
      await updateUserProfileRole(
        userId,
        newRoleId,
        user?.uid || 'user',
        userProfile?.fullName || 'Admin'
      );
      await loadUsersAndInvites();
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  // Create Invitation & Send Email
  const handleCreateInvitation = async (e: FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !inviteName.trim()) return;

    setCreatingInvite(true);
    try {
      const matchedRole = DEFAULT_ROLES.find((r) => r.id === inviteRoleId);
      const roleName = matchedRole ? matchedRole.name : inviteRoleId;

      const newInvite = await createInvitation(
        {
          email: inviteEmail.trim().toLowerCase(),
          fullName: inviteName.trim(),
          roleId: inviteRoleId,
          roleName,
        },
        user?.uid || 'system',
        userProfile?.fullName || 'Quản trị viên'
      );

      const baseUrl = window.location.origin + window.location.pathname;
      const link = `${baseUrl}#invite-${newInvite.inviteToken}`;
      setCreatedInviteLink(link);

      await loadUsersAndInvites();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi tạo lời mời.');
    } finally {
      setCreatingInvite(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!confirm('Bạn có chắc chắn muốn thu hồi lời mời phân quyền này?')) return;
    try {
      await revokeInvitation(inviteId, user?.uid || 'system', userProfile?.fullName || 'Admin');
      await loadUsersAndInvites();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thu hồi lời mời.');
    }
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 3000);
  };

  // Categories
  const handleAddCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      await createFinanceCategory(
        {
          name: newCatName.trim(),
          type: newCatType,
          isCustom: true,
        },
        user?.uid || 'user',
        userProfile?.fullName || 'Admin'
      );
      setNewCatName('');
      const cList = await getFinanceCategories();
      setCategories(cList);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa danh mục này?')) return;
    try {
      await deleteFinanceCategory(catId, user?.uid || 'user', userProfile?.fullName || 'Admin');
      const cList = await getFinanceCategories();
      setCategories(cList);
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  // Backup & Restore
  const handleExportBackup = async () => {
    try {
      await backupDatabaseToJson(
        user?.uid || 'user',
        userProfile?.fullName || 'Admin',
        settings
      );
    } catch (err: unknown) {
      const error = err as Error;
      alert(error.message);
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const text = await restoreFile.text();
      const backupData = JSON.parse(text);
      await restoreDatabaseFromJson(
        backupData,
        restoreMode,
        user?.uid || 'user',
        userProfile?.fullName || 'Admin'
      );
      setIsRestoreModalOpen(false);
      setRestoreFile(null);
      alert('Phục hồi dữ liệu thành công!');
      window.location.reload();
    } catch (err: unknown) {
      const error = err as Error;
      alert('Lỗi phục hồi: ' + error.message);
    } finally {
      setRestoring(false);
    }
  };

  const handleSeedData = async () => {
    setSeeding(true);
    try {
      await seedDemoData(user?.uid || 'seed', userProfile?.fullName || 'Admin', settings);
      setIsSeedModalOpen(false);
      alert('Nạp dữ liệu mẫu thành công!');
      window.location.reload();
    } catch (err: unknown) {
      const error = err as Error;
      alert('Lỗi nạp dữ liệu: ' + error.message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="border-b border-surface-container-high pb-4">
        <h2 className="font-headline-lg font-bold text-on-surface">
          Cấu Hình Hệ Thống & Quản Trị
        </h2>
        <p className="text-xs text-on-surface-variant">
          Quản lý thông tin hành chính, phân quyền cán bộ, mẫu biểu chứng từ và sao lưu CSDL
        </p>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-surface-container-high">
        {/* Profile Tab - Always accessible */}
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'profile'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-base">account_circle</span>
          <span>Hồ sơ cá nhân</span>
        </button>

        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'info'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined text-base">corporate_fare</span>
          <span>Thông tin Đơn vị</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'users'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-base">manage_accounts</span>
            <span>Cán bộ & Phân quyền</span>
          </button>
        )}

        {(isAdmin || hasPerm('finance.view')) && (
          <button
            onClick={() => setActiveTab('categories')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'categories'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
            }`}
          >
            <span className="material-symbols-outlined text-base">category</span>
            <span>Danh mục Thu/Chi</span>
          </button>
        )}

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'backup'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-base">cloud_sync</span>
              <span>Sao lưu & Khôi phục</span>
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'audit'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              <span className="material-symbols-outlined text-base">history_edu</span>
              <span>Nhật ký Kiểm toán</span>
            </button>
          </>
        )}
      </div>

      {/* TAB: HỒ SƠ CÁ NHÂN & CHỨC VỤ CÁN BỘ */}
      {activeTab === 'profile' && (
        <div className="space-y-6 max-w-3xl">
          {/* Officer Preview Card */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high shadow-xs">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-surface-container-high">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center font-bold text-2xl shadow-xs">
                  {profileFullName?.charAt(0) || userProfile?.fullName?.charAt(0) || user?.displayName?.charAt(0) || 'U'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-on-surface">
                      {profileFullName || userProfile?.fullName || user?.displayName || 'Người dùng'}
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs">
                      {currentEffectivePos || 'Cán bộ'}
                    </span>
                  </div>
                  <p className="font-mono text-xs text-primary mt-0.5">{user?.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-[11px]">
                      Vai trò: {DEFAULT_ROLES.find((r) => r.id === profileRoleId)?.name || profileRoleId}
                    </span>
                    {profileAddress && (
                      <span className="text-[11px] text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">home_pin</span>
                        <span>{profileAddress}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Tài khoản chính thức</span>
                </span>
              </div>
            </div>

            {/* Profile Edit Form */}
            <form onSubmit={handleSaveProfile} className="pt-5 space-y-5 text-xs">
              {profileSuccessMsg && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2.5 font-medium">
                  <span className="material-symbols-outlined text-xl text-emerald-600">check_circle</span>
                  <span>{profileSuccessMsg}</span>
                </div>
              )}

              {profileErrorMsg && (
                <div className="p-3.5 rounded-2xl bg-error-container/30 text-error border border-error/20 flex items-center gap-2.5 font-medium">
                  <span className="material-symbols-outlined text-xl">error</span>
                  <span>{profileErrorMsg}</span>
                </div>
              )}

              <div className="border-b border-surface-container-high pb-2">
                <h4 className="font-bold text-on-surface text-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">edit_document</span>
                  <span>Cập nhật Thông tin & Chức vụ Công tác</span>
                </h4>
                <p className="text-[11px] text-on-surface-variant mt-0.5">
                  Khi thay đổi chức vụ, hệ thống sẽ tự động cập nhật phân quyền và chức danh tương ứng.
                </p>
              </div>

              {/* Row 1: Full name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-on-surface mb-1.5">
                    Họ và tên cán bộ <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">
                      person
                    </span>
                    <input
                      id="settings-profile-fullname"
                      type="text"
                      required
                      value={profileFullName}
                      onChange={(e) => setProfileFullName(e.target.value)}
                      placeholder="VD: Nguyễn Văn An"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-medium text-on-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1.5">
                    Email đăng nhập <span className="text-slate-400 font-normal">(Cố định)</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">
                      mail
                    </span>
                    <input
                      type="text"
                      disabled
                      value={user?.email || ''}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface-container text-slate-500 font-mono text-[11px]"
                    />
                  </div>
                </div>
              </div>

              {/* Row 2: Phone & Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-on-surface mb-1.5">Số điện thoại liên hệ</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">
                      call
                    </span>
                    <input
                      id="settings-profile-phone"
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      placeholder="VD: 0912 345 678"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-on-surface mb-1.5">
                    Địa chỉ thường trú / Nơi ở <span className="text-error">*</span>
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-lg">
                      home_pin
                    </span>
                    <input
                      id="settings-profile-address"
                      type="text"
                      required
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      placeholder="VD: Tổ 2, Ấp Bình Hòa, Xã Bình An"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                    />
                  </div>
                </div>
              </div>

              {/* Position & Role Selection */}
              <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <label className="block font-bold text-on-surface text-sm">
                    Chức vụ trong Ban điều hành / Ấp <span className="text-error">*</span>
                  </label>
                  <span className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">sync</span>
                    <span>Hệ thống tự động cập nhật quyền hạn theo chức vụ</span>
                  </span>
                </div>

                <div>
                  <select
                    id="settings-profile-position"
                    value={profilePosition}
                    onChange={(e) => handleProfilePositionSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface font-semibold text-on-surface text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {Array.from(new Set(GRASSROOTS_POSITIONS.map((p) => p.category))).map((cat) => (
                      <optgroup key={cat} label={`─── ${cat} ───`}>
                        {GRASSROOTS_POSITIONS.filter((p) => p.category === cat).map((p) => (
                          <option key={p.title} value={p.title}>
                            {p.title}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                    <option value="CUSTOM">Chức vụ khác (Nhập tùy chỉnh)...</option>
                  </select>
                </div>

                {isCustomPos && (
                  <div className="pt-1">
                    <label className="block font-semibold text-on-surface mb-1">
                      Nhập tên chức vụ cụ thể:
                    </label>
                    <input
                      id="settings-profile-custom-position"
                      type="text"
                      required
                      value={customPosText}
                      onChange={(e) => handleProfileCustomPosChange(e.target.value)}
                      placeholder="VD: Phó Bí thư Chi bộ, Phó Thôn đội trưởng..."
                      className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
                    />
                  </div>
                )}

                {/* Role Mapping explanation banner */}
                <div className="p-3.5 rounded-xl bg-surface-container border border-surface-container-high flex items-start gap-3">
                  <span className="material-symbols-outlined text-primary text-2xl shrink-0 mt-0.5">
                    verified_user
                  </span>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-on-surface">Vai trò phân quyền hệ thống:</span>
                      <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                        {DEFAULT_ROLES.find((r) => r.id === profileRoleId)?.name || profileRoleId}
                      </span>
                    </div>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed">
                      {DEFAULT_ROLES.find((r) => r.id === profileRoleId)?.description}
                    </p>
                  </div>
                </div>

                {/* Role Override dropdown */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-600 font-medium">
                    Tùy chỉnh vai trò hệ thống:
                  </span>
                  <select
                    id="settings-profile-roleid"
                    value={profileRoleId}
                    onChange={(e) => setProfileRoleId(e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-surface-container-highest bg-surface text-xs font-bold text-primary"
                  >
                    {DEFAULT_ROLES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sync to voucher signatures checkbox */}
                {isKeyPosition && (
                  <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none border-t border-surface-container-high mt-2">
                    <input
                      type="checkbox"
                      checked={syncToVoucherSignatures}
                      onChange={(e) => setSyncToVoucherSignatures(e.target.checked)}
                      className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                    />
                    <span className="text-[11px] text-on-surface leading-tight">
                      Đồng bộ họ tên <strong>{profileFullName || 'của bạn'}</strong> vào chức danh{' '}
                      <strong>{currentEffectivePos}</strong> trên chữ ký mẫu biểu (Phiếu thu, Phiếu
                      chi, Báo cáo tài chính) của ấp.
                    </span>
                  </label>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-surface-container-high">
                <button
                  type="button"
                  onClick={() => {
                    if (userProfile) {
                      setProfileFullName(userProfile.fullName || '');
                      setProfileAddress(userProfile.address || '');
                      setProfilePhone(userProfile.phone || '');
                      setProfileRoleId(userProfile.roleId || 'VIEWER');
                    }
                  }}
                  disabled={savingProfile}
                  className="px-4 py-2.5 rounded-xl border border-surface-container-highest text-on-surface hover:bg-surface-container font-semibold transition-colors"
                >
                  Khôi phục ban đầu
                </button>

                <button
                  id="btn-settings-save-profile"
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  {savingProfile ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">save</span>
                      <span>Lưu Hồ Sơ & Cập Nhật Chức Vụ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Detailed Permissions Overview */}
          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
            <h4 className="font-bold text-on-surface text-sm flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">security</span>
              <span>Chi tiết quyền hạn theo chức vụ hiện tại:</span>
            </h4>
            <div className="p-4 rounded-2xl bg-surface-container border border-surface-container-high space-y-2.5 text-xs">
              {profileRoleId === 'ADMIN' ? (
                <div className="space-y-1.5 text-emerald-900">
                  <div className="font-bold flex items-center gap-2 text-emerald-800">
                    <span className="material-symbols-outlined text-base">verified</span>
                    <span>Toàn quyền Quản trị viên cao nhất:</span>
                  </div>
                  <p>• Quản lý toàn diện nhân hộ khẩu, dân cư, chia tổ và xuất biểu mẫu A4.</p>
                  <p>• Thu/chi, duyệt chứng từ tài chính quỹ ấp, lập báo cáo phân bổ và cân đối quỹ.</p>
                  <p>• Quản lý các đợt phát quà an sinh, tạo phiếu nhận quà, quét QR và xuất danh sách ký nhận (.xlsx).</p>
                  <p>• Mời cán bộ mới, phân quyền, cấu hình thông tin đơn vị và sao lưu khôi phục cơ sở dữ liệu.</p>
                </div>
              ) : profileRoleId === 'SECRETARY' ? (
                <div className="space-y-1.5 text-slate-800">
                  <div className="font-bold text-primary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">edit_note</span>
                    <span>Quyền Nghiệp vụ Thư ký / Kế toán / Ban ấp:</span>
                  </div>
                  <p>• Quản lý thông tin cư dân, tổ dân cư và biến động hộ khẩu.</p>
                  <p>• Tạo và cập nhật phiếu thu, phiếu chi, quản lý các khoản quỹ vận động nhân dân.</p>
                  <p>• Quản lý phát quà an sinh xã hội, điểm danh nhận quà và xuất báo cáo.</p>
                  <p>• Không có quyền thay đổi cấu hình cơ sở và phân quyền tài khoản quản trị.</p>
                </div>
              ) : (
                <div className="space-y-1.5 text-slate-700">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">visibility</span>
                    <span>Quyền Người xem / Giám sát:</span>
                  </div>
                  <p>• Xem tổng quan tình hình dân cư và báo cáo tài chính công khai.</p>
                  <p>• Tự quản lý và cập nhật hồ sơ cá nhân của mình.</p>
                  <p>• Không có quyền chỉnh sửa dữ liệu mật, sổ quỹ và phân quyền cán bộ.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: THÔNG TIN ĐƠN VỊ & MẪU BIỂU (BỎ HUYỆN, CHỈ CÒN ẤP, XÃ, TỈNH) */}
      {activeTab === 'info' && (
        <form onSubmit={handleSaveInfo} className="space-y-6">
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base">check_circle</span>
              <span>{successMsg}</span>
            </div>
          )}

          {!isAdmin && (
            <div className="p-3.5 rounded-xl bg-amber-50 text-amber-800 text-xs border border-amber-200 flex items-center gap-2">
              <span className="material-symbols-outlined text-base">lock</span>
              <span>Chỉ có Quản trị viên (Bí thư chi bộ, Trưởng ấp, Trưởng ban CTMT) mới có quyền chỉnh sửa cấu hình đơn vị.</span>
            </div>
          )}

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Thông tin Địa giới Hành chính (Không còn cấp Huyện)
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Cơ cấu tổ chức hiện hành: Ấp, Xã, Tỉnh / Thành phố
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Tên Ấp (*)</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={hamletName}
                  onChange={(e) => setHamletName(e.target.value)}
                  placeholder="VD: Ấp Bình Hòa"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Tên Xã (*)</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={communeName}
                  onChange={(e) => setCommuneName(e.target.value)}
                  placeholder="VD: Xã An Nhơn Tây"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Tỉnh / Thành phố (*)</label>
                <input
                  type="text"
                  required
                  disabled={!isAdmin}
                  value={provinceName}
                  onChange={(e) => setProvinceName(e.target.value)}
                  placeholder="VD: TP. Hồ Chí Minh"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-on-surface mb-1">Địa chỉ trụ sở Ấp</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Tổ 2, Đường Bình Hòa, Xã An Nhơn Tây, TP. Hồ Chí Minh"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Số điện thoại liên hệ</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
            <h3 className="font-headline-sm font-bold text-on-surface">
              Chức Danh Ký Chứng Từ & Điều Hành
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Họ tên Trưởng Ấp</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={hamletLeaderName}
                  onChange={(e) => setHamletLeaderName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Họ tên Kế toán / Thư ký</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={financeOfficerName}
                  onChange={(e) => setFinanceOfficerName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Họ tên Thủ quỹ</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={treasurerName}
                  onChange={(e) => setTreasurerName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest p-6 rounded-3xl border border-surface-container-high space-y-4 shadow-xs">
            <h3 className="font-headline-sm font-bold text-on-surface">
              Mẫu Biểu Phiếu Thu / Chi A4 Chuẩn Nhà Nước (Mẫu C40-BB)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-on-surface mb-1">Cơ quan cấp trên</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={superiorAgency}
                  onChange={(e) => setSuperiorAgency(e.target.value)}
                  placeholder="VD: UBND XÃ AN NHƠN TÂY"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface uppercase disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Tên đơn vị ban hành</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="VD: BAN ĐIỀU HÀNH ẤP BÌNH HÒA"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface uppercase disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-on-surface mb-1">Mẫu số quy định</label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={templateStandard}
                  onChange={(e) => setTemplateStandard(e.target.value)}
                  placeholder="VD: Mẫu số C40-BB"
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface disabled:bg-surface-container disabled:text-slate-500"
                />
              </div>
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingSettings}
                className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-semibold shadow-xs"
              >
                {savingSettings ? 'Đang lưu...' : 'Lưu cấu hình đơn vị'}
              </button>
            </div>
          )}
        </form>
      )}

      {/* TAB 2: CÁN BỘ & PHÂN QUYỀN (CHỈ ADMIN MỚI CÓ QUYỀN PHÂN QUYỀN & MỜI) */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          {/* Active Users Table */}
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-surface-container-high pb-3">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Danh sách Cán bộ Điều hành Ấp
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Chỉ Quản trị viên (Bí thư chi bộ, Trưởng ấp, Trưởng ban CTMT) mới có quyền phân quyền
                </p>
              </div>

              <button
                onClick={() => {
                  setIsInviteModalOpen(true);
                  setCreatedInviteLink(null);
                  setInviteEmail('');
                  setInviteName('');
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-container transition-all shadow-xs shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base">forward_to_inbox</span>
                <span>Mời Cán Bộ Qua Email</span>
              </button>
            </div>

            <div className="divide-y divide-surface-container-high">
              {users.map((u) => (
                <div key={u.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-sm text-on-surface">{u.fullName || 'Chưa đặt tên'}</div>
                      {u.position && (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px]">
                          {u.position}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 font-mono text-[11px]">
                      <span>{u.email}</span>
                      {u.phone && (
                        <span className="flex items-center gap-0.5 text-slate-600 font-sans">
                          <span className="material-symbols-outlined text-xs">call</span>
                          <span>{u.phone}</span>
                        </span>
                      )}
                      {u.address && (
                        <span className="flex items-center gap-0.5 text-slate-600 font-sans">
                          <span className="material-symbols-outlined text-xs">home_pin</span>
                          <span>{u.address}</span>
                        </span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[10px]">
                      Đăng nhập lần cuối: {u.lastLoginAt ? formatDateVN(u.lastLoginAt) : 'Chưa có'}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-700">Vai trò:</span>
                    <select
                      value={u.roleId}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      disabled={u.id === user?.uid}
                      className="px-3 py-1.5 rounded-xl border border-surface-container-highest bg-surface text-xs font-bold text-primary"
                    >
                      {DEFAULT_ROLES.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Invitations Table */}
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
              <div>
                <h3 className="font-headline-sm font-bold text-on-surface">
                  Danh Sách Thư Mời Phân Quyền Đã Tạo
                </h3>
                <p className="text-xs text-on-surface-variant">
                  Theo dõi trạng thái xác nhận và liên kết mời tham gia khu phố
                </p>
              </div>
            </div>

            {invitations.length === 0 ? (
              <div className="py-8 text-center text-xs text-on-surface-variant">
                Chưa có thư mời phân quyền nào được tạo. Nhấn "Mời Cán Bộ Qua Email" để gửi lời mời.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-semibold">
                      <th className="py-2.5 px-3">Cán bộ được mời</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Vai trò chỉ định</th>
                      <th className="py-2.5 px-3">Trạng thái</th>
                      <th className="py-2.5 px-3">Thời hạn</th>
                      <th className="py-2.5 px-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {invitations.map((inv) => {
                      const link = `${window.location.origin}${window.location.pathname}#invite-${inv.inviteToken}`;
                      return (
                        <tr key={inv.id} className="hover:bg-surface-container-low/50">
                          <td className="py-2 px-3 font-bold text-on-surface">{inv.fullName}</td>
                          <td className="py-2 px-3 font-mono text-slate-600">{inv.email}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-md bg-primary-fixed text-on-primary-fixed font-bold text-[10px]">
                              {inv.roleName}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                inv.status === 'ACCEPTED'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : inv.status === 'REVOKED'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {inv.status === 'ACCEPTED'
                                ? 'Đã nhận quyền'
                                : inv.status === 'REVOKED'
                                ? 'Đã thu hồi'
                                : 'Đang chờ xác nhận'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-numeric-data">
                            {formatDateVN(inv.expiresAt)}
                          </td>
                          <td className="py-2 px-3 text-right">
                            {inv.status === 'PENDING' && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleCopyLink(link)}
                                  title="Sao chép link xác nhận"
                                  className="p-1 rounded-lg hover:bg-surface-container text-primary"
                                >
                                  <span className="material-symbols-outlined text-base">link</span>
                                </button>
                                <a
                                  href={`mailto:${inv.email}?subject=${encodeURIComponent(
                                    `Thư mời phân quyền cán bộ: ${inv.roleName} - Ấp Bình Hòa`
                                  )}&body=${encodeURIComponent(
                                    `Kính gửi đồng chí ${inv.fullName},\n\nBan Quản lý Ấp trân trọng mời đồng chí tham gia điều hành khu phố với vai trò: ${inv.roleName}.\n\nVui lòng truy cập đường dẫn sau để xác nhận và nhận phân quyền:\n${link}\n\nTrân trọng!`
                                  )}`}
                                  title="Gửi email cho cán bộ"
                                  className="p-1 rounded-lg hover:bg-surface-container text-emerald-700"
                                >
                                  <span className="material-symbols-outlined text-base">mail</span>
                                </a>
                                <button
                                  onClick={() => handleRevokeInvite(inv.id)}
                                  title="Thu hồi lời mời"
                                  className="p-1 rounded-lg hover:bg-surface-container text-red-600"
                                >
                                  <span className="material-symbols-outlined text-base">block</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: DANH MỤC THU / CHI */}
      {activeTab === 'categories' && (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">
                Quản lý Danh mục Quỹ Tài chính
              </h3>
              <p className="text-xs text-on-surface-variant">
                Các nguồn quỹ thu đóng góp và các hạng mục chi công cộng tại Ấp
              </p>
            </div>
          </div>

          {/* Add Category Form */}
          {isAdmin && (
            <form onSubmit={handleAddCategory} className="flex flex-col sm:flex-row gap-3">
              <select
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as 'INCOME' | 'EXPENSE')}
                className="px-3 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs font-bold text-primary"
              >
                <option value="INCOME">Hạng mục Thu (+)</option>
                <option value="EXPENSE">Hạng mục Chi (-)</option>
              </select>

              <input
                type="text"
                required
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Tên hạng mục (Ví dụ: Quỹ Khuyến học Ấp Bình Hòa)..."
                className="flex-1 px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-xs"
              />

              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container transition-colors shadow-xs"
              >
                Thêm hạng mục
              </button>
            </form>
          )}

          {/* Categories Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {categories.map((c) => (
              <div
                key={c.id}
                className="p-3.5 rounded-2xl bg-surface-container-low border border-surface-container-high flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                      c.type === 'INCOME'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {c.type === 'INCOME' ? 'Thu' : 'Chi'}
                  </span>
                  <span className="font-semibold text-on-surface">{c.name}</span>
                </div>
                {isAdmin && c.isCustom && (
                  <button
                    onClick={() => handleDeleteCategory(c.id)}
                    className="p-1 text-slate-400 hover:text-error transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">delete</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: SAO LƯU & PHỤC HỒI & DỮ LIỆU MẪU (ADMIN ONLY) */}
      {activeTab === 'backup' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-4 shadow-xs">
            <h3 className="font-headline-sm font-bold text-on-surface">
              Sao lưu Dữ liệu Toàn diện (Backup JSON)
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Tải toàn bộ cơ sở dữ liệu (Nhân khẩu, Hộ gia đình, Sổ quỹ tài chính, Đợt quà an sinh, Cài đặt đơn vị) về máy tính dưới dạng tệp tin JSON an toàn.
            </p>
            <button
              onClick={handleExportBackup}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-container shadow-xs transition-all"
            >
              <span className="material-symbols-outlined text-base">download</span>
              <span>Tải xuống tệp tin sao lưu (.json)</span>
            </button>
          </div>

          <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-4 shadow-xs">
            <h3 className="font-headline-sm font-bold text-on-surface">
              Phục hồi Cơ sở Dữ liệu từ Tệp tin
            </h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Nhập tệp tin sao lưu JSON để khôi phục dữ liệu điều hành Ấp. Hãy cẩn trọng khi chọn chế độ Ghi đè (Replace).
            </p>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="file"
                accept=".json"
                onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                className="text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-surface-container file:text-on-surface hover:file:bg-surface-container-high"
              />

              {restoreFile && (
                <button
                  onClick={() => setIsRestoreModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-800 text-white text-xs font-semibold hover:bg-amber-900 shadow-xs"
                >
                  Tiến hành khôi phục
                </button>
              )}
            </div>
          </div>

          {/* Seed Demo Data Section */}
          <div className="bg-amber-50 rounded-3xl border border-amber-200 p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-amber-900 font-bold text-sm">
              <span className="material-symbols-outlined text-xl">science</span>
              <span>Nạp Dữ liệu Mẫu Khảo sát (Seed Demo Data)</span>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed">
              Bạn có thể nạp ngay ~12 hồ sơ nhân khẩu, 4 sổ hộ gia đình, danh mục quỹ tiền mặt chuẩn, 4 chứng từ thu chi mẫu, và 1 chiến dịch phát quà an sinh để chạy thử nghiệm toàn bộ quy trình ngay lập tức.
            </p>
            <button
              onClick={() => setIsSeedModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-amber-800 hover:bg-amber-900 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              Nạp dữ liệu mẫu Ấp Bình Hòa
            </button>
          </div>
        </div>
      )}

      {/* TAB 5: NHẬT KÝ KIỂM TOÁN (ADMIN ONLY, KHÔNG HIỂN THỊ CHO NGƯỜI XEM) */}
      {activeTab === 'audit' && isAdmin && (
        <div className="bg-surface-container-lowest rounded-3xl border border-surface-container-high p-6 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-surface-container-high pb-3">
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">
                Sổ Nhật Ký Kiểm Toán Nghiệp Vụ
              </h3>
              <p className="text-xs text-on-surface-variant">
                Toàn bộ thao tác thêm, sửa, phê duyệt, hủy chứng từ đều được ghi nhận bất biến
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-container border-b border-surface-container-high text-on-surface-variant font-semibold">
                  <th className="py-3 px-4">Thời gian</th>
                  <th className="py-3 px-4">Cán bộ thực hiện</th>
                  <th className="py-3 px-4">Hành động</th>
                  <th className="py-3 px-4">Thực thể</th>
                  <th className="py-3 px-4">Nội dung chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-container-high">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                      Chưa có ghi nhận nhật ký nào.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-container-low/60 transition-colors">
                      <td className="py-2.5 px-4 font-numeric-data text-slate-500 whitespace-nowrap">
                        {log.timestamp ? formatDateVN(log.timestamp) : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-on-surface">{log.userName}</td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                            log.action === 'CREATE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'APPROVE'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'CANCEL'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono font-medium text-primary">
                        {log.entityType}
                      </td>
                      <td className="py-2.5 px-4 text-slate-800">{log.description}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MỜI CÁN BỘ QUA EMAIL */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-surface-container px-6 py-4 border-b border-surface-container-high flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="material-symbols-outlined text-primary text-2xl">person_add</span>
                <div>
                  <h3 className="font-bold text-base text-on-surface">Mời Cán Bộ & Phân Quyền</h3>
                  <p className="text-[11px] text-on-surface-variant">
                    Gửi liên kết phân quyền cho cán bộ tham gia điều hành khu phố
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-surface-container-high flex items-center justify-center transition-colors text-on-surface-variant"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {!createdInviteLink ? (
                <form onSubmit={handleCreateInvitation} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-on-surface mb-1">
                      Địa chỉ Email cán bộ (*)
                    </label>
                    <input
                      type="email"
                      required
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="VD: canbo.apbinhhoa@gmail.com"
                      className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1">
                      Họ và tên cán bộ (*)
                    </label>
                    <input
                      type="text"
                      required
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="VD: Nguyễn Văn Nam"
                      className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-on-surface mb-1">
                      Phân quyền vai trò:
                    </label>
                    <select
                      value={inviteRoleId}
                      onChange={(e) => setInviteRoleId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface font-bold text-primary"
                    >
                      <option value="PARTY_SECRETARY">Bí thư Chi bộ (Toàn quyền Admin)</option>
                      <option value="HAMLET_LEADER">Trưởng ấp (Toàn quyền Admin)</option>
                      <option value="FRONT_COMMITTEE_LEADER">Trưởng Ban CT Mặt trận (Toàn quyền Admin)</option>
                      <option value="SECRETARY">Thư ký (Thêm/sửa/xóa tài chính, quyền khác chỉ xem)</option>
                      <option value="VIEWER">Người xem (Chỉ xem cơ bản & thông tin cá nhân)</option>
                      <option value="ADMIN">Quản trị viên Hệ thống</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1 italic">
                      {inviteRoleId === 'SECRETARY'
                        ? 'Thư ký có quyền thêm, sửa, xóa giao dịch tài chính thu/chi; các chức năng khác chỉ được xem.'
                        : inviteRoleId === 'VIEWER'
                        ? 'Người xem không có quyền xem dữ liệu dân cư, nhật ký hoạt động hay chỉnh sửa phân quyền.'
                        : 'Vai trò này có đầy đủ thẩm quyền quản trị điều hành của Ấp.'}
                    </p>
                  </div>

                  <div className="pt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-semibold"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={creatingInvite}
                      className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold shadow-xs flex items-center gap-1.5"
                    >
                      {creatingInvite ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">mail</span>
                          <span>Tạo Lời Mời & Lấy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2">
                    <div className="font-bold text-sm flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
                      <span>Đã tạo lời mời phân quyền thành công!</span>
                    </div>
                    <p className="text-[11px] text-emerald-800">
                      Cán bộ <strong className="text-slate-900">{inviteName}</strong> ({inviteEmail}) có thể mở liên kết dưới đây để nhận vai trò trong hệ thống:
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-on-surface">Liên kết phân quyền bảo mật:</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={createdInviteLink}
                        className="flex-1 px-3 py-2 rounded-xl border border-surface-container-highest bg-surface-container font-mono text-[11px] text-slate-800 select-all"
                      />
                      <button
                        type="button"
                        onClick={() => handleCopyLink(createdInviteLink)}
                        className="px-3 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold flex items-center gap-1 shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">content_copy</span>
                        <span>{copySuccess ? 'Đã chép' : 'Chép'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <a
                      href={`mailto:${inviteEmail}?subject=${encodeURIComponent(
                        `Thư mời nhận phân quyền cán bộ tại Ấp Bình Hòa`
                      )}&body=${encodeURIComponent(
                        `Kính gửi đồng chí ${inviteName},\n\nBan Quản lý Ấp trân trọng mời đồng chí tham gia điều hành với vai trò cán bộ.\n\nVui lòng truy cập đường dẫn sau để xác nhận và nhận phân quyền:\n${createdInviteLink}\n\nLiên kết có giá trị trong vòng 14 ngày.\nTrân trọng!`
                      )}`}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1.5 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-base">outgoing_mail</span>
                      <span>Mở ứng dụng Email gửi ngay</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => setIsInviteModalOpen(false)}
                      className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold"
                    >
                      Xong
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirm Modal */}
      <ConfirmModal
        isOpen={isRestoreModalOpen}
        title="Xác nhận khôi phục dữ liệu"
        isDangerous={true}
        description={`Bạn đang chuẩn bị phục hồi cơ sở dữ liệu từ tệp tin "${restoreFile?.name}".`}
        confirmText={restoring ? 'Đang phục hồi...' : 'Bắt đầu phục hồi'}
        onConfirm={handleConfirmRestore}
        onCancel={() => setIsRestoreModalOpen(false)}
      >
        <div className="space-y-3 pt-2">
          <label className="block text-xs font-semibold text-on-surface">Chế độ khôi phục:</label>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-container-high bg-surface cursor-pointer">
              <input
                type="radio"
                name="restoreMode"
                value="MERGE"
                checked={restoreMode === 'MERGE'}
                onChange={() => setRestoreMode('MERGE')}
                className="text-primary"
              />
              <div>
                <div className="font-bold text-on-surface">Gộp dữ liệu (Merge - Khuyên dùng)</div>
                <div className="text-[11px] text-on-surface-variant">
                  Giữ lại dữ liệu hiện tại, cập nhật hoặc bổ sung các bản ghi mới từ tệp tin sao lưu.
                </div>
              </div>
            </label>

            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-surface-container-high bg-surface cursor-pointer">
              <input
                type="radio"
                name="restoreMode"
                value="REPLACE"
                checked={restoreMode === 'REPLACE'}
                onChange={() => setRestoreMode('REPLACE')}
                className="text-error"
              />
              <div>
                <div className="font-bold text-error">Thay thế hoàn toàn (Replace)</div>
                <div className="text-[11px] text-on-surface-variant">
                  Xóa sạch toàn bộ dữ liệu đang có và khôi phục chính xác trạng thái từ tệp tin.
                </div>
              </div>
            </label>
          </div>
        </div>
      </ConfirmModal>

      {/* Seed Demo Data Modal */}
      <ConfirmModal
        isOpen={isSeedModalOpen}
        title="Nạp dữ liệu mẫu khảo sát Ấp Bình Hòa"
        description="Thao tác này sẽ khởi tạo sẵn các bản ghi dân cư, danh mục quỹ, chứng từ tài chính và đợt phát quà để bạn thử nghiệm đầy đủ các tính năng."
        confirmText={seeding ? 'Đang nạp dữ liệu...' : 'Nạp dữ liệu ngay'}
        onConfirm={handleSeedData}
        onCancel={() => setIsSeedModalOpen(false)}
      />
    </div>
  );
}
