import { useState } from 'react';
import { UserProfile } from '../types';
import { DEFAULT_ROLES } from '../utils/rbac';
import { formatDateVN, formatDateTimeVN } from '../utils/numberToWords';

interface OfficialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  official: UserProfile | null;
  onEdit?: (official: UserProfile) => void;
  canEdit?: boolean;
}

export function OfficialDetailModal({
  isOpen,
  onClose,
  official,
  onEdit,
  canEdit = true,
}: OfficialDetailModalProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  if (!isOpen || !official) return null;

  const roleObj = DEFAULT_ROLES.find((r) => r.id === official.roleId);
  const isActive = official.status === 'active' || (official as unknown as { isActive?: boolean }).isActive !== false;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-surface-container-lowest border border-surface-container-high rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header with profile banner */}
        <div className="relative bg-gradient-to-r from-primary/15 via-primary/5 to-transparent px-4 sm:px-6 pt-5 pb-4 border-b border-surface-container-high shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-primary text-white flex items-center justify-center font-bold text-lg sm:text-xl shadow-md shrink-0">
                {(official.fullName || 'C')[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h3 className="font-headline-sm font-bold text-base sm:text-lg text-on-surface truncate">
                    {official.fullName || 'Chưa đặt tên'}
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-red-100 text-red-800 border border-red-300'
                    }`}
                  >
                    {isActive ? 'Đang hoạt động' : 'Tạm khóa'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                  {official.position ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs truncate">
                      {official.position}
                    </span>
                  ) : (
                    <span className="text-xs text-on-surface-variant italic">Chưa phân chức vụ</span>
                  )}
                  <span className="text-xs text-primary font-semibold">
                    • {roleObj?.name || official.roleId}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-container-highest text-on-surface-variant cursor-pointer transition-colors shrink-0"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Modal Body - Detailed Information Table / Cards */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs overflow-y-auto flex-1">
          {/* Group 1: Contact & Address Information */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">badge</span>
              <span>Thông Tin Liên Hệ & Cư Trú</span>
            </h4>

            <div className="bg-surface-container/40 rounded-2xl p-3.5 border border-surface-container-high space-y-2.5">
              {/* Phone */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-base text-primary">call</span>
                  <span className="font-semibold">Số điện thoại:</span>
                </div>
                <div className="flex items-center gap-2">
                  {official.phone ? (
                    <>
                      <a
                        href={`tel:${official.phone}`}
                        className="font-bold text-on-surface hover:text-primary hover:underline"
                      >
                        {official.phone}
                      </a>
                      <button
                        type="button"
                        onClick={() => handleCopy(official.phone || '', 'phone')}
                        className="p-1 rounded-lg hover:bg-surface-container-highest text-slate-500 hover:text-primary cursor-pointer transition-colors"
                        title="Sao chép số điện thoại"
                      >
                        <span className="material-symbols-outlined text-sm">
                          {copiedField === 'phone' ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400 italic">Chưa cập nhật</span>
                  )}
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-on-surface-variant shrink-0">
                  <span className="material-symbols-outlined text-base text-primary">mail</span>
                  <span className="font-semibold">Email tài khoản:</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-on-surface break-all">
                    {official.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(official.email, 'email')}
                    className="p-1 rounded-lg hover:bg-surface-container-highest text-slate-500 hover:text-primary cursor-pointer transition-colors shrink-0"
                    title="Sao chép email"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedField === 'email' ? 'check' : 'content_copy'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start justify-between gap-2 pt-1 border-t border-surface-container-high/60">
                <div className="flex items-center gap-2 text-on-surface-variant shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-base text-primary">home_pin</span>
                  <span className="font-semibold">Địa chỉ thường trú:</span>
                </div>
                <div className="text-right">
                  {official.address ? (
                    <span className="font-medium text-on-surface leading-snug">
                      {official.address}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">Chưa cập nhật địa chỉ</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Group 2: Organization Position & Roles */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>Công Tác & Phân Quyền Hệ Thống</span>
            </h4>

            <div className="bg-surface-container/40 rounded-2xl p-3.5 border border-surface-container-high space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-on-surface-variant font-semibold">Chức vụ điều hành:</span>
                <span className="font-bold text-on-surface">
                  {official.position || 'Cán bộ điều hành'}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2">
                <span className="text-on-surface-variant font-semibold shrink-0">
                  Vai trò phân quyền:
                </span>
                <div className="text-right">
                  <span className="font-bold text-primary">{roleObj?.name || official.roleId}</span>
                  {roleObj?.description && (
                    <p className="text-[10px] text-on-surface-variant mt-0.5 leading-snug">
                      {roleObj.description}
                    </p>
                  )}
                </div>
              </div>

              {official.notes && (
                <div className="pt-2 border-t border-surface-container-high/60">
                  <span className="text-on-surface-variant font-semibold block mb-1">
                    Ghi chú phân công:
                  </span>
                  <p className="text-on-surface bg-surface p-2.5 rounded-xl border border-surface-container italic leading-relaxed">
                    {official.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Group 3: History & Timestamps */}
          <div className="space-y-3">
            <h4 className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              <span>Thông Tin Tham Gia & Lịch Sử</span>
            </h4>

            <div className="bg-surface-container/40 rounded-2xl p-3.5 border border-surface-container-high divide-y divide-surface-container-high/60 space-y-2">
              {/* Ngày tham gia */}
              <div className="flex items-center justify-between gap-2 pt-1 first:pt-0">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-base text-primary">person_add</span>
                  <span className="font-semibold">Ngày tham gia hệ thống:</span>
                </div>
                <span className="font-bold text-on-surface">
                  {official.createdAt ? formatDateVN(official.createdAt) : 'Chưa ghi nhận'}
                </span>
              </div>

              {/* Đăng nhập gần nhất */}
              <div className="flex items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-2 text-on-surface-variant">
                  <span className="material-symbols-outlined text-base text-primary">login</span>
                  <span className="font-semibold">Đăng nhập gần nhất:</span>
                </div>
                <span className="font-mono text-on-surface">
                  {official.lastLoginAt ? formatDateTimeVN(official.lastLoginAt) : 'Chưa đăng nhập'}
                </span>
              </div>

              {/* Cập nhật gần nhất */}
              {official.updatedAt && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-2 text-on-surface-variant">
                    <span className="material-symbols-outlined text-base text-primary">update</span>
                    <span className="font-semibold">Cập nhật gần nhất:</span>
                  </div>
                  <span className="font-mono text-slate-500">
                    {formatDateTimeVN(official.updatedAt)}
                    {official.updatedBy ? ` (${official.updatedBy})` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-surface-container-high bg-surface-container/30 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container font-semibold cursor-pointer transition-colors"
          >
            Đóng
          </button>

          {canEdit && onEdit && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onEdit(official);
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-container text-white font-bold shadow-xs cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-base">edit</span>
              <span>Chỉnh Sửa Hồ Sơ</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
