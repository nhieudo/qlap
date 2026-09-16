import { useState, useEffect, FormEvent } from 'react';
import { UserProfile, UserStatus } from '../types';
import { DEFAULT_ROLES, GRASSROOTS_POSITIONS, getDefaultRoleIdForPosition } from '../utils/rbac';
import { createOfficialUser, updateOfficialUser } from '../services/db';

interface EditOfficialModalProps {
  isOpen: boolean;
  onClose: () => void;
  official: UserProfile | null;
  currentUserId: string;
  currentUserName: string;
  onSuccess: () => void;
}

export function EditOfficialModal({
  isOpen,
  onClose,
  official,
  currentUserId,
  currentUserName,
  onSuccess,
}: EditOfficialModalProps) {
  const isEdit = Boolean(official);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState('');
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [customPosition, setCustomPosition] = useState('');
  const [roleId, setRoleId] = useState('SECRETARY');
  const [status, setStatus] = useState<UserStatus>('active');
  const [notes, setNotes] = useState('');
  const [syncToSettings, setSyncToSettings] = useState(true);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (official) {
        setFullName(official.fullName || '');
        setEmail(official.email || '');
        setPhone(official.phone || '');
        setAddress(official.address || '');
        setRoleId(official.roleId || 'SECRETARY');
        setStatus(official.status || 'active');
        setNotes(official.notes || '');

        const existingPos = (official.position || '').trim();
        const matchedPreset = GRASSROOTS_POSITIONS.find(
          (p) => p.title.toLowerCase() === existingPos.toLowerCase()
        );

        if (matchedPreset) {
          setPosition(matchedPreset.title);
          setIsCustomPosition(false);
          setCustomPosition('');
        } else if (existingPos) {
          setPosition('CUSTOM');
          setIsCustomPosition(true);
          setCustomPosition(existingPos);
        } else {
          setPosition(GRASSROOTS_POSITIONS[2]?.title || 'Trưởng ấp');
          setIsCustomPosition(false);
          setCustomPosition('');
        }
      } else {
        // Reset form for creating new official
        setFullName('');
        setEmail('');
        setPhone('');
        setAddress('');
        setPosition(GRASSROOTS_POSITIONS[2]?.title || 'Trưởng ấp');
        setIsCustomPosition(false);
        setCustomPosition('');
        setRoleId('SECRETARY');
        setStatus('active');
        setNotes('');
      }
    }
  }, [isOpen, official]);

  if (!isOpen) return null;

  const handlePositionChange = (val: string) => {
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

  const handleCustomPosInput = (val: string) => {
    setCustomPosition(val);
    const suggestedRole = getDefaultRoleIdForPosition(val);
    setRoleId(suggestedRole);
  };

  const effectivePosition = isCustomPosition ? customPosition.trim() : position;
  const isKeySigner =
    effectivePosition.toLowerCase().includes('trưởng ấp') ||
    effectivePosition.toLowerCase().includes('trưởng thôn') ||
    effectivePosition.toLowerCase().includes('kế toán') ||
    effectivePosition.toLowerCase().includes('thư ký') ||
    effectivePosition.toLowerCase().includes('thủ quỹ');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Vui lòng nhập họ và tên cán bộ.');
      return;
    }
    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập địa chỉ email.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      if (isEdit && official) {
        await updateOfficialUser(
          official.uid || official.id || '',
          {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address.trim(),
            position: effectivePosition,
            roleId,
            status,
            notes: notes.trim(),
            syncToSettings,
          },
          currentUserId,
          currentUserName
        );
      } else {
        await createOfficialUser(
          {
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            address: address.trim(),
            position: effectivePosition,
            roleId,
            status,
            notes: notes.trim(),
            syncToSettings,
          },
          currentUserId,
          currentUserName
        );
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || 'Có lỗi xảy ra khi lưu thông tin cán bộ.');
    } finally {
      setSaving(false);
    }
  };

  const selectedRoleObj = DEFAULT_ROLES.find((r) => r.id === roleId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-surface-container-high flex items-center justify-between bg-surface-container/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-fixed text-primary flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-xl">
                {isEdit ? 'manage_accounts' : 'person_add'}
              </span>
            </div>
            <div>
              <h3 className="font-headline-sm font-bold text-on-surface">
                {isEdit ? 'Chỉnh Sửa Thông Tin Cán Bộ' : 'Thêm Cán Bộ Điều Hành Ấp'}
              </h3>
              <p className="text-xs text-on-surface-variant">
                {isEdit
                  ? 'Cập nhật chức vụ, thông tin liên lạc và vai trò phân quyền'
                  : 'Đăng ký thành viên vào danh sách Ban điều hành ấp'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-surface-container-highest text-on-surface-variant cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-error-container/30 text-error border border-error/20 flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {/* Row 1: Full Name & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Họ và tên Cán bộ (*)
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn Hùng"
                className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Chức vụ công tác (*)
              </label>
              <select
                value={isCustomPosition ? 'CUSTOM' : position}
                onChange={(e) => handlePositionChange(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary font-medium"
              >
                {GRASSROOTS_POSITIONS.map((p) => (
                  <option key={p.title} value={p.title}>
                    {p.title}
                  </option>
                ))}
                <option value="CUSTOM">-- Nhập chức danh khác --</option>
              </select>
            </div>
          </div>

          {/* Custom position text input if chosen */}
          {isCustomPosition && (
            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Nhập tên chức vụ công tác cụ thể (*)
              </label>
              <input
                type="text"
                required
                value={customPosition}
                onChange={(e) => handleCustomPosInput(e.target.value)}
                placeholder="VD: Chi hội trưởng Khuyến học, Cán bộ phụ trách Thống kê..."
                className="w-full px-3.5 py-2 rounded-xl border border-primary/40 bg-primary/5 text-on-surface focus:outline-hidden focus:border-primary"
              />
            </div>
          )}

          {/* Row 2: Email & Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Email tài khoản (*)
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="canbo@apbinhhoa.gov.vn"
                className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Số điện thoại liên hệ
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0912.345.678"
                className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block font-semibold text-on-surface mb-1">
              Địa chỉ cư trú / thường trực
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="VD: Tổ 1, Ấp Hưng An, Xã An Nhơn Tây"
              className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Row 3: Role & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Vai trò phân quyền hệ thống (*)
              </label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-primary/40 bg-surface text-primary font-bold focus:outline-hidden focus:border-primary"
              >
                {DEFAULT_ROLES.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              {selectedRoleObj && (
                <p className="text-[11px] text-on-surface-variant mt-1 leading-snug">
                  {selectedRoleObj.description}
                </p>
              )}
            </div>

            <div>
              <label className="block font-semibold text-on-surface mb-1">
                Trạng thái hoạt động
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface font-semibold focus:outline-hidden focus:border-primary"
              >
                <option value="active">Đang công tác / Hoạt động</option>
                <option value="disabled">Tạm khóa / Ngưng công tác</option>
              </select>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Khi tạm khóa, cán bộ sẽ không thể truy cập các tính năng nghiệp vụ.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-on-surface mb-1">
              Ghi chú nhiệm vụ phụ trách
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ghi chú phân công địa bàn phụ trách, tổ dân cư quản lý..."
              className="w-full px-3.5 py-2 rounded-xl border border-surface-container-highest bg-surface text-on-surface focus:outline-hidden focus:border-primary resize-none"
            />
          </div>

          {/* Sync to voucher settings checkbox if key position */}
          {isKeySigner && (
            <div className="p-3 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-2.5">
              <input
                type="checkbox"
                id="syncToSettings"
                checked={syncToSettings}
                onChange={(e) => setSyncToSettings(e.target.checked)}
                className="mt-0.5 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
              />
              <label htmlFor="syncToSettings" className="text-[11px] text-amber-900 leading-snug cursor-pointer">
                <strong>Đồng bộ chức danh ký mẫu biểu chứng từ A4 (Mẫu C40-BB & C41-BB):</strong> Tự động gán họ tên cán bộ vào vị trí ký tương ứng (Trưởng ấp / Kế toán / Thủ quỹ) trên phiếu thu chi toàn ấp.
              </label>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-surface-container-high flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs font-semibold cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-base">
                {saving ? 'hourglass_top' : isEdit ? 'save' : 'check'}
              </span>
              <span>{saving ? 'Đang lưu...' : isEdit ? 'Cập Nhật Cán Bộ' : 'Thêm Cán Bộ'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
