import { useState, useEffect, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { GRASSROOTS_POSITIONS, getDefaultRoleIdForPosition, DEFAULT_ROLES } from '../utils/rbac';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditProfileModal({ isOpen, onClose, onSuccess }: EditProfileModalProps) {
  const { user, userProfile, updateMyProfile } = useAuth();

  const [fullName, setFullName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [customPosition, setCustomPosition] = useState('');
  const [roleId, setRoleId] = useState('VIEWER');
  const [syncToSettings, setSyncToSettings] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Initialize form when opened or userProfile changes
  useEffect(() => {
    if (isOpen) {
      const initialName = userProfile?.fullName || user?.displayName || '';
      const initialAddress = userProfile?.address || '';
      const initialPhone = userProfile?.phone || '';
      const initialPos = userProfile?.position || '';
      const initialRole = userProfile?.roleId || 'VIEWER';

      setFullName(initialName);
      setAddress(initialAddress);
      setPhone(initialPhone);
      setRoleId(initialRole);
      setError(null);
      setSuccess(false);

      // Check if position matches a preset
      const matchedPreset = GRASSROOTS_POSITIONS.find(
        (p) => p.title.toLowerCase() === initialPos.trim().toLowerCase()
      );

      if (matchedPreset) {
        setPosition(matchedPreset.title);
        setIsCustomPosition(false);
        setCustomPosition('');
      } else if (initialPos) {
        setPosition('CUSTOM');
        setIsCustomPosition(true);
        setCustomPosition(initialPos);
      } else {
        // Default to Hamlet Leader if admin, or Secretary
        const defaultPreset = GRASSROOTS_POSITIONS.find((p) => p.defaultRoleId === initialRole);
        if (defaultPreset) {
          setPosition(defaultPreset.title);
          setIsCustomPosition(false);
          setCustomPosition('');
        } else {
          setPosition(GRASSROOTS_POSITIONS[2].title); // Trưởng ấp
          setIsCustomPosition(false);
          setCustomPosition('');
        }
      }
    }
  }, [isOpen, userProfile, user]);

  if (!isOpen) return null;

  // Handle position select
  const handlePositionSelect = (val: string) => {
    setPosition(val);
    if (val === 'CUSTOM') {
      setIsCustomPosition(true);
    } else {
      setIsCustomPosition(false);
      const matched = GRASSROOTS_POSITIONS.find((p) => p.title === val);
      if (matched) {
        setRoleId(matched.defaultRoleId);
      }
    }
  };

  // Handle custom position input
  const handleCustomPositionChange = (val: string) => {
    setCustomPosition(val);
    const calculatedRole = getDefaultRoleIdForPosition(val);
    setRoleId(calculatedRole);
  };

  const currentEffectivePosition = isCustomPosition ? customPosition.trim() : position;
  const currentRoleObj = DEFAULT_ROLES.find((r) => r.id === roleId) || DEFAULT_ROLES[0];
  const isKeyLeadershipPosition =
    currentEffectivePosition.toLowerCase().includes('trưởng ấp') ||
    currentEffectivePosition.toLowerCase().includes('trưởng thôn') ||
    currentEffectivePosition.toLowerCase().includes('kế toán') ||
    currentEffectivePosition.toLowerCase().includes('thư ký') ||
    currentEffectivePosition.toLowerCase().includes('thủ quỹ');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Vui lòng nhập họ và tên.');
      return;
    }

    const finalPosition = isCustomPosition ? customPosition.trim() : position;
    if (!finalPosition) {
      setError('Vui lòng chọn hoặc nhập chức vụ công tác.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await updateMyProfile(
        {
          fullName: fullName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          position: finalPosition,
          roleId,
        },
        syncToSettings && isKeyLeadershipPosition
      );

      setSuccess(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error('Lỗi cập nhật hồ sơ:', err);
      setError((err as Error)?.message || 'Không thể cập nhật hồ sơ. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Group positions by category
  const categories = Array.from(new Set(GRASSROOTS_POSITIONS.map((p) => p.category)));

  return (
    <div
      id="edit-profile-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="edit-profile-modal-content"
        className="bg-surface-container-lowest border border-surface-container-high rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-6 border-b border-surface-container-high flex items-start justify-between gap-4 bg-surface-container-low/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center font-bold text-xl shadow-xs">
              <span className="material-symbols-outlined text-2xl">badge</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface">Chỉnh sửa Hồ sơ & Chức vụ</h2>
              <p className="text-xs text-on-surface-variant">
                Cập nhật thông tin cán bộ. Chức vụ thay đổi sẽ cập nhật toàn hệ thống.
              </p>
            </div>
          </div>

          <button
            id="btn-close-profile-modal"
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs">
          {success && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2.5 font-medium">
              <span className="material-symbols-outlined text-xl text-emerald-600">check_circle</span>
              <span>Cập nhật hồ sơ thành công! Hệ thống đã ghi nhận chức vụ và phân quyền mới.</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-error-container/30 text-error border border-error/20 flex items-center gap-2.5 font-medium">
              <span className="material-symbols-outlined text-xl">error</span>
              <span>{error}</span>
            </div>
          )}

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
                  id="profile-fullname-input"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
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
                  id="profile-phone-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
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
                  id="profile-address-input"
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="VD: Tổ 2, Ấp Bình Hòa..."
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface"
                />
              </div>
            </div>
          </div>

          {/* Position Section */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high space-y-3">
            <div className="flex items-center justify-between">
              <label className="block font-bold text-on-surface text-sm">
                Chức vụ công tác tại Ấp / Cơ sở <span className="text-error">*</span>
              </label>
              <span className="text-[11px] text-primary font-semibold">Tự động cập nhật phân quyền</span>
            </div>

            <div>
              <select
                id="profile-position-select"
                value={position}
                onChange={(e) => handlePositionSelect(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface font-semibold text-on-surface text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {categories.map((cat) => (
                  <optgroup key={cat} label={`─── ${cat} ───`}>
                    {GRASSROOTS_POSITIONS.filter((p) => p.category === cat).map((p) => (
                      <option key={p.title} value={p.title}>
                        {p.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value="CUSTOM">Chức vụ khác (Tự nhập tên chức vụ)...</option>
              </select>
            </div>

            {isCustomPosition && (
              <div className="pt-2">
                <label className="block font-semibold text-on-surface mb-1">
                  Nhập tên chức vụ cụ thể:
                </label>
                <input
                  id="profile-custom-position-input"
                  type="text"
                  required
                  value={customPosition}
                  onChange={(e) => handleCustomPositionChange(e.target.value)}
                  placeholder="VD: Phó Bí thư Chi đoàn, Tổ phó tổ tự quản..."
                  className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface focus:border-primary focus:ring-2 focus:ring-primary/20 text-on-surface"
                />
              </div>
            )}

            {/* Position and Role mapping explanation card */}
            <div className="p-3 rounded-xl bg-surface-container border border-surface-container-high flex items-start gap-2.5">
              <span className="material-symbols-outlined text-primary text-xl mt-0.5 shrink-0">
                admin_panel_settings
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface">Vai trò phân quyền tương ứng:</span>
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold text-[11px]">
                    {currentRoleObj.name}
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  {currentRoleObj.description}
                </p>
              </div>
            </div>

            {/* Custom Role Override selector if user wants specific role assignment */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-600 font-medium">
                Tùy chỉnh vai trò hệ thống:
              </span>
              <select
                id="profile-roleid-select"
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="px-2.5 py-1 rounded-lg border border-surface-container-highest bg-surface text-xs font-bold text-primary"
              >
                {DEFAULT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sync to voucher signatures checkbox */}
            {isKeyLeadershipPosition && (
              <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={syncToSettings}
                  onChange={(e) => setSyncToSettings(e.target.checked)}
                  className="mt-0.5 rounded text-primary focus:ring-primary h-4 w-4"
                />
                <span className="text-[11px] text-on-surface leading-tight">
                  Tự động đồng bộ họ tên <strong>{fullName || 'của bạn'}</strong> vào chức danh{' '}
                  <strong>{currentEffectivePosition}</strong> trên các mẫu biểu chứng từ (Phiếu thu,
                  Phiếu chi, Báo cáo) của ấp.
                </span>
              </label>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-surface-container-highest text-on-surface hover:bg-surface-container font-semibold transition-colors"
            >
              Hủy bỏ
            </button>

            <button
              id="btn-submit-save-profile"
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-container text-white font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
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
    </div>
  );
}
