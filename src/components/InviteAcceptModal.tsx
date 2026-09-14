import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getInvitationByToken, acceptInvitation } from '../services/db';
import { UserInvitation } from '../types';
import { formatDateVN } from '../utils/numberToWords';

interface InviteAcceptModalProps {
  token: string;
  onClose: () => void;
  onSuccess: (roleName: string) => void;
}

export function InviteAcceptModal({ token, onClose, onSuccess }: InviteAcceptModalProps) {
  const { user, userProfile, loginWithGoogle, refreshUserProfile } = useAuth();
  const [invitation, setInvitation] = useState<UserInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvite() {
      setLoading(true);
      setError(null);
      try {
        const inv = await getInvitationByToken(token);
        if (!inv) {
          setError('Liên kết phân quyền không tồn tại hoặc đã bị xóa.');
        } else if (inv.status === 'ACCEPTED') {
          setError('Lời mời phân quyền này đã được chấp nhận trước đó.');
        } else if (inv.status === 'REVOKED') {
          setError('Lời mời phân quyền này đã bị thu hồi bởi quản trị viên.');
        } else if (new Date(inv.expiresAt) < new Date()) {
          setError('Lời mời phân quyền đã hết hạn hiệu lực (quá 14 ngày).');
        } else {
          setInvitation(inv);
        }
      } catch (err: any) {
        setError(err.message || 'Lỗi khi kiểm tra mã phân quyền.');
      } finally {
        setLoading(false);
      }
    }
    if (token) {
      fetchInvite();
    }
  }, [token]);

  const handleAccept = async () => {
    if (!invitation || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      await acceptInvitation(
        token,
        user.uid,
        user.email || invitation.email,
        userProfile?.fullName || user.displayName || invitation.fullName
      );
      await refreshUserProfile();
      setSuccess(true);
      setTimeout(() => {
        onSuccess(invitation.roleName);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi kích hoạt quyền.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest max-w-md w-full rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-2xl">verified_user</span>
            <div>
              <h3 className="font-bold text-base leading-tight">Thư Mời & Phân Quyền Cán Bộ</h3>
              <p className="text-[11px] text-white/80">Ban Quản Lý & Điều Hành Ấp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors text-white/90"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {loading ? (
            <div className="py-10 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-on-surface-variant font-medium">Đang xác thực liên kết phân quyền...</p>
            </div>
          ) : error ? (
            <div className="py-6 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">error</span>
              </div>
              <p className="font-bold text-sm text-red-900">{error}</p>
              <p className="text-[11px] text-on-surface-variant">
                Vui lòng liên hệ Trưởng ấp hoặc Bí thư chi bộ để được gửi liên kết mới.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold"
              >
                Đóng thông báo
              </button>
            </div>
          ) : success ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <p className="font-bold text-base text-emerald-900">Xác Nhận Thành Công!</p>
              <p className="text-on-surface-variant">
                Bạn đã được cấp quyền <span className="font-bold text-primary">{invitation?.roleName}</span> vào hệ thống Quản lý Ấp.
              </p>
            </div>
          ) : invitation ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-primary-fixed/30 border border-primary/20 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Đồng chí được mời:</span>
                  <span className="font-bold text-sm text-on-surface">{invitation.fullName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Email chỉ định:</span>
                  <span className="font-mono text-primary font-semibold">{invitation.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-on-surface-variant font-medium">Vai trò bổ nhiệm:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-primary text-white font-bold text-xs">
                    {invitation.roleName}
                  </span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-on-surface-variant pt-1 border-t border-primary/10">
                  <span>Người gửi thư mời:</span>
                  <span className="font-medium text-slate-700">{invitation.invitedByName}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                  <span>Hạn nhận quyền:</span>
                  <span className="font-medium text-slate-700">{formatDateVN(invitation.expiresAt)}</span>
                </div>
              </div>

              {/* Login Check */}
              {!user ? (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                    Vui lòng đăng nhập với tài khoản Google (khuyên dùng địa chỉ <strong className="font-mono">{invitation.email}</strong>) để nhận phân quyền cán bộ.
                  </div>
                  <button
                    onClick={() => loginWithGoogle()}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-bold flex items-center justify-center gap-2 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-lg">login</span>
                    <span>Đăng nhập với Google để kích hoạt</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  <div className="p-3 rounded-xl bg-surface-container border border-surface-container-high text-[11px] space-y-1">
                    <div className="text-on-surface-variant">Tài khoản đang đăng nhập:</div>
                    <div className="font-bold text-on-surface text-xs">{userProfile?.fullName || user.displayName}</div>
                    <div className="font-mono text-primary">{user.email}</div>
                  </div>

                  <button
                    onClick={handleAccept}
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-bold flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Đang kích hoạt...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">how_to_reg</span>
                        <span>Xác Nhận Tham Gia & Nhận Phân Quyền</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
