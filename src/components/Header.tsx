import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { EditProfileModal } from './EditProfileModal';

interface HeaderProps {
  onOpenSearch?: () => void;
  onOpenNotifications?: () => void;
  onSelectTab?: (tab: string) => void;
}

export function Header({ onSelectTab }: HeaderProps) {
  const { user, userProfile, role, logout } = useAuth();
  const { settings } = useSettings();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const positionText = userProfile?.position || '';
  const roleName = role?.name || (userProfile?.roleId === 'ADMIN' ? 'Quản trị viên' : 'Cán bộ');
  const roleLabel = positionText ? `${positionText} • ${roleName}` : roleName;

  return (
    <>
      <header className="sticky top-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container-high transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Emblem and Official Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm ring-2 ring-primary/20 shrink-0">
              {/* Vietnamese Emblem Style: Star with rice ears or official crest */}
              <span className="material-symbols-outlined text-2xl text-amber-300">verified</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-sm text-primary font-bold tracking-tight uppercase">
                  QUẢN LÝ ẤP - CẤP CƠ SỞ
                </h1>
                <span className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-semibold tracking-wider rounded-md bg-primary-fixed text-on-primary-fixed">
                  CHÍNH THỐNG
                </span>
              </div>
              <p className="text-xs text-on-surface-variant font-medium">
                {settings.hamletName} • {settings.communeName} • {settings.districtName}
              </p>
            </div>
          </div>

          {/* Right: Cloud Sync Status & User Profile */}
          <div className="flex items-center gap-3">
            {/* Cloud Sync Status Indicator */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-surface-container text-xs text-on-surface-variant font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Firestore Đã kết nối</span>
            </div>

            {/* User Profile / Menu */}
            {user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-container transition-colors text-left"
                  aria-label="Menu người dùng"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={userProfile?.fullName || 'Cán bộ'}
                      className="w-8 h-8 rounded-lg object-cover ring-1 ring-outline/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary-container text-on-primary font-bold text-xs flex items-center justify-center">
                      {(userProfile?.fullName || user.email || 'CB').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden lg:block max-w-[180px]">
                    <div className="text-xs font-semibold text-on-surface leading-tight truncate">
                      {userProfile?.fullName || user.email}
                    </div>
                    <div className="text-[10px] text-primary font-medium truncate" title={roleLabel}>
                      {positionText || roleName}
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-base text-on-surface-variant">
                    expand_more
                  </span>
                </button>

                {/* Dropdown Menu */}
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-surface-container-lowest border border-surface-container-high shadow-xl p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-2 border-b border-surface-container-high mb-1">
                      <div className="text-sm font-bold text-on-surface">
                        {userProfile?.fullName || 'Cán bộ cơ sở'}
                      </div>
                      <div className="text-xs text-on-surface-variant truncate">{user.email}</div>
                      {userProfile?.address && (
                        <div className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                          <span className="material-symbols-outlined text-xs">home_pin</span>
                          <span>{userProfile.address}</span>
                        </div>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {positionText && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-bold">
                            {positionText}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-surface-container text-[11px] font-semibold text-primary">
                          {roleName}
                        </span>
                      </div>
                    </div>

                    {/* Button: Edit Profile */}
                    <button
                      id="btn-header-edit-profile"
                      onClick={() => {
                        setIsEditProfileOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left font-semibold"
                    >
                      <span className="material-symbols-outlined text-lg">badge</span>
                      <span>Chỉnh sửa hồ sơ & chức vụ</span>
                    </button>

                    {onSelectTab && (
                      <button
                        onClick={() => {
                          onSelectTab('settings');
                          setMenuOpen(false);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-on-surface hover:bg-surface-container transition-colors text-left mt-1"
                      >
                        <span className="material-symbols-outlined text-lg text-on-surface-variant">
                          tune
                        </span>
                        <span>Cài đặt hệ thống & Đơn vị</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        logout();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xl text-error hover:bg-error-container/40 transition-colors text-left mt-1"
                    >
                      <span className="material-symbols-outlined text-lg">logout</span>
                      <span>Đăng xuất tài khoản</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isEditProfileOpen}
        onClose={() => setIsEditProfileOpen(false)}
      />
    </>
  );
}

