import { useState, FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

interface LoginViewProps {
  onSuccess?: () => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const { loginWithGoogle, loginWithEmail, registerWithEmail, isFirstRun, claimFirstAdmin } = useAuth();
  const { settings } = useSettings();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      onSuccess?.();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      setErrorMsg(error.message || 'Đăng nhập Google thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isFirstRun) {
        if (!fullName.trim()) {
          throw new Error('Vui lòng nhập họ và tên của Quản trị viên khởi tạo.');
        }
        await registerWithEmail(email, password, fullName);
        await claimFirstAdmin(fullName);
      } else if (isRegistering) {
        if (!fullName.trim()) {
          throw new Error('Vui lòng nhập họ và tên cán bộ.');
        }
        await registerWithEmail(email, password, fullName);
      } else {
        await loginWithEmail(email, password);
      }
      onSuccess?.();
    } catch (err: unknown) {
      const error = err as Error;
      console.error(error);
      let msg = error.message;
      if (msg.includes('auth/invalid-credential') || msg.includes('auth/wrong-password')) {
        msg = 'Email hoặc mật khẩu không chính xác.';
      } else if (msg.includes('auth/email-already-in-use')) {
        msg = 'Email này đã được đăng ký tài khoản cán bộ trước đó.';
      } else if (msg.includes('auth/weak-password')) {
        msg = 'Mật khẩu phải có ít nhất 6 ký tự.';
      }
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl border border-surface-container-high overflow-hidden p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary text-amber-300 mx-auto flex items-center justify-center shadow-lg ring-4 ring-primary/10">
            <span className="material-symbols-outlined text-3xl">account_balance</span>
          </div>
          <h2 className="font-headline-lg font-bold text-on-surface uppercase tracking-tight">
            QUẢN LÝ CƠ SỞ ẤP
          </h2>
          <p className="text-xs text-on-surface-variant font-medium">
            {settings.hamletName} • {settings.communeName}
          </p>
        </div>

        {/* First Run Notice */}
        {isFirstRun && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed flex items-start gap-2.5">
            <span className="material-symbols-outlined text-lg shrink-0 text-amber-700">security</span>
            <div>
              <span className="font-bold">Khởi tạo hệ thống lần đầu:</span> Tài khoản đầu tiên bạn đăng ký sẽ được chỉ định làm <span className="font-bold">Quản trị viên tối cao (ADMIN)</span> toàn quyền điều hành hệ thống.
            </div>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-error-container text-on-error-container text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-base shrink-0">error</span>
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Google Sign In Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-surface-container-highest bg-surface-container-low hover:bg-surface-container text-on-surface font-semibold text-sm transition-all shadow-xs active:scale-98"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Đăng nhập bằng tài khoản Google</span>
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-surface-container-high w-full"></div>
          <span className="bg-surface-container-lowest px-3 text-[11px] font-medium text-on-surface-variant uppercase tracking-wider">
            hoặc Email công vụ
          </span>
        </div>

        {/* Email Form */}
        <form onSubmit={handleEmailSubmit} className="space-y-4">
          {(isFirstRun || isRegistering) && (
            <div>
              <label className="block text-xs font-semibold text-on-surface mb-1">
                Họ và tên cán bộ
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ví dụ: Nguyễn Văn Hùng"
                className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Địa chỉ Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="canbo@annhontay.tphcm.gov.vn"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface mb-1">
              Mật khẩu truy cập
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-surface-container-highest bg-surface text-sm focus:outline-hidden focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-container text-white font-semibold text-sm transition-all shadow-md active:scale-98"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Đang xử lý...</span>
              </span>
            ) : isFirstRun ? (
              'Khởi tạo Quản trị viên tối cao'
            ) : isRegistering ? (
              'Đăng ký tài khoản cán bộ'
            ) : (
              'Đăng nhập hệ thống'
            )}
          </button>
        </form>

        {/* Toggle Login / Register */}
        {!isFirstRun && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setErrorMsg(null);
              }}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {isRegistering
                ? 'Đã có tài khoản cán bộ? Đăng nhập ngay'
                : 'Chưa có tài khoản? Đăng ký tài khoản mới'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
