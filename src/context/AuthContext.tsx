import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  User,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  getDocs,
  collection,
  limit,
  query,
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { UserProfile, Role, PermissionCode } from '../types';
import { DEFAULT_ROLES, ADMIN_ROLE_IDS, hasPermission } from '../utils/rbac';
import { logAuditEvent } from '../utils/auditLogger';
import { updateUserProfileDetails } from '../services/db';

// Helper to translate Firebase Auth errors into helpful Vietnamese messages
function translateAuthError(error: unknown): string {
  const errCode = (error as { code?: string })?.code || '';
  switch (errCode) {
    case 'auth/invalid-email':
      return 'Địa chỉ email không đúng định dạng.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị vô hiệu hóa.';
    case 'auth/user-not-found':
      return 'Không tìm thấy tài khoản với email này.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email hoặc mật khẩu không chính xác.';
    case 'auth/email-already-in-use':
      return 'Email này đã được đăng ký cho tài khoản khác.';
    case 'auth/weak-password':
      return 'Mật khẩu quá ngắn (yêu cầu tối thiểu 6 ký tự).';
    case 'auth/operation-not-allowed':
      return 'Phương thức đăng nhập này chưa được kích hoạt.';
    case 'auth/popup-closed-by-user':
      return 'Cửa sổ đăng nhập đã bị đóng trước khi hoàn tất.';
    case 'auth/cancelled-popup-request':
      return 'Yêu cầu đăng nhập đã bị hủy.';
    case 'auth/popup-blocked':
      return 'Trình duyệt đã chặn cửa sổ pop-up. Vui lòng cho phép mở pop-up để đăng nhập.';
    case 'auth/too-many-requests':
      return 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau vài phút.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra lại đường truyền internet.';
    default:
      return (error as Error)?.message || 'Đã có lỗi xảy ra khi xác thực tài khoản.';
  }
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  role: Role | null;
  permissions: PermissionCode[];
  hasPerm: (perm: PermissionCode) => boolean;
  isAdmin: boolean;
  isHamletLeader: boolean;
  loading: boolean;
  isFirstRun: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  registerWithEmail: (email: string, pass: string, fullName: string) => Promise<void>;
  claimFirstAdmin: (fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateMyProfile: (
    data: {
      fullName: string;
      address?: string;
      phone?: string;
      position?: string;
      roleId?: string;
    },
    syncToSettings?: boolean
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<PermissionCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFirstRun, setIsFirstRun] = useState(false);

  // Configure browser local persistence for session retention
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn('Lỗi thiết lập persistence phiên làm việc:', err);
    });
  }, []);

  // Check if system is uninitialized (no users or no admin)
  const checkFirstRun = async () => {
    try {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
      if (usersSnap.empty) {
        setIsFirstRun(true);
      } else {
        setIsFirstRun(false);
      }
    } catch (err) {
      console.warn('Kiểm tra trạng thái hệ thống lần đầu:', err);
    }
  };

  const loadUserProfile = async (currentUser: User) => {
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      const isPrivilegedEmail = currentUser.email === 'nhieudo3273@gmail.com';

      if (userDoc.exists()) {
        const profile = userDoc.data() as UserProfile;

        // Ensure privileged admin email always has an initial admin role if not set
        if (isPrivilegedEmail && !profile.roleId) {
          profile.roleId = 'ADMIN';
          await setDoc(userRef, { roleId: 'ADMIN' }, { merge: true });
        }

        setUserProfile(profile);

        // Update lastLoginAt asynchronously
        setDoc(userRef, { lastLoginAt: new Date().toISOString() }, { merge: true }).catch(() => {});

        // Load role permissions
        if (profile.roleId) {
          const defaultRole = DEFAULT_ROLES.find((r) => r.id === profile.roleId);
          try {
            const roleRef = doc(db, 'roles', profile.roleId);
            const roleDoc = await getDoc(roleRef);
            if (roleDoc.exists()) {
              const rData = roleDoc.data() as Role;
              setRole(rData);
              setPermissions(rData.permissions || []);
            } else if (defaultRole) {
              setRole(defaultRole);
              setPermissions(defaultRole.permissions);
            }
          } catch {
            if (defaultRole) {
              setRole(defaultRole);
              setPermissions(defaultRole.permissions);
            }
          }
        }
      } else {
        // New user profile creation
        // Check if this is the first user or designated admin
        let assignedRole = isPrivilegedEmail ? 'ADMIN' : 'VIEWER';
        try {
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(2)));
          if (usersSnap.empty) {
            assignedRole = 'ADMIN';
          }
        } catch {
          // If cannot query yet, default to ADMIN for first login
          assignedRole = 'ADMIN';
        }

        const newProfile: UserProfile = {
          uid: currentUser.uid,
          fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Cán bộ cơ sở',
          email: currentUser.email || '',
          avatarUrl: currentUser.photoURL || '',
          roleId: assignedRole,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        try {
          await setDoc(userRef, newProfile);
        } catch (saveErr) {
          console.warn('Chưa lưu được hồ sơ lên Firestore:', saveErr);
        }

        setUserProfile(newProfile);
        const defaultRole = DEFAULT_ROLES.find((r) => r.id === assignedRole) || DEFAULT_ROLES[0];
        setRole(defaultRole);
        setPermissions(defaultRole.permissions);
      }
    } catch (error) {
      console.error('Lỗi tải thông tin cán bộ:', error);
      // Safe fallback profile to prevent lockout
      const isPrivilegedEmail = currentUser.email === 'nhieudo3273@gmail.com';
      const fallbackProfile: UserProfile = {
        uid: currentUser.uid,
        fullName: currentUser.displayName || currentUser.email?.split('@')[0] || 'Cán bộ',
        email: currentUser.email || '',
        avatarUrl: currentUser.photoURL || '',
        roleId: isPrivilegedEmail ? 'ADMIN' : 'ADMIN',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };
      setUserProfile(fallbackProfile);
      const fallbackRole = DEFAULT_ROLES.find((r) => r.id === fallbackProfile.roleId) || DEFAULT_ROLES[0];
      setRole(fallbackRole);
      setPermissions(fallbackRole.permissions);
    }
  };

  useEffect(() => {
    checkFirstRun();
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await loadUserProfile(currentUser);
      } else {
        setUserProfile(null);
        setRole(null);
        setPermissions([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      if (result.user) {
        await logAuditEvent({
          userId: result.user.uid,
          userName: result.user.displayName || result.user.email || 'Người dùng',
          action: 'LOGIN',
          module: 'AUTH',
          entityType: 'USER',
          entityId: result.user.uid,
          description: 'Đăng nhập thành công bằng tài khoản Google',
        });
      }
    } catch (err: unknown) {
      const message = translateAuthError(err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        await logAuditEvent({
          userId: result.user.uid,
          userName: result.user.displayName || email,
          action: 'LOGIN',
          module: 'AUTH',
          entityType: 'USER',
          entityId: result.user.uid,
          description: 'Đăng nhập thành công bằng Email/Mật khẩu',
        });
      }
    } catch (err: unknown) {
      const message = translateAuthError(err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const registerWithEmail = async (email: string, pass: string, fullName: string) => {
    setLoading(true);
    try {
      const result = await createUserWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        const userRef = doc(db, 'users', result.user.uid);
        let roleId = 'VIEWER';
        try {
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
          roleId = usersSnap.empty ? 'ADMIN' : 'VIEWER';
        } catch {
          roleId = 'ADMIN';
        }

        const newProfile: UserProfile = {
          uid: result.user.uid,
          fullName,
          email,
          roleId,
          status: 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
        };

        await setDoc(userRef, newProfile);
        setUserProfile(newProfile);

        await logAuditEvent({
          userId: result.user.uid,
          userName: fullName,
          action: 'CREATE',
          module: 'AUTH',
          entityType: 'USER',
          entityId: result.user.uid,
          description: `Đăng ký tài khoản cán bộ mới (${roleId})`,
        });
      }
    } catch (err: unknown) {
      const message = translateAuthError(err);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const claimFirstAdmin = async (fullName: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    const updated = {
      roleId: 'ADMIN',
      fullName,
      status: 'active' as const,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(userRef, updated, { merge: true });
    setIsFirstRun(false);
    await loadUserProfile(user);
  };

  const logout = async () => {
    if (user) {
      await logAuditEvent({
        userId: user.uid,
        userName: userProfile?.fullName || user.email || 'Người dùng',
        action: 'LOGOUT',
        module: 'AUTH',
        entityType: 'USER',
        entityId: user.uid,
        description: 'Đăng xuất khỏi hệ thống Quản Lý Ấp',
      });
    }
    await signOut(auth);
    setUser(null);
    setUserProfile(null);
    setRole(null);
    setPermissions([]);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const updateMyProfile = async (
    data: {
      fullName: string;
      address?: string;
      phone?: string;
      position?: string;
      roleId?: string;
    },
    syncToSettings = false
  ) => {
    if (!user) throw new Error('Chưa đăng nhập');
    await updateUserProfileDetails(
      user.uid,
      data,
      user.uid,
      data.fullName || userProfile?.fullName || user.email || 'Cán bộ',
      syncToSettings
    );
    await loadUserProfile(user);
  };

  const hasPerm = (perm: PermissionCode) => {
    if (userProfile?.status === 'disabled' || userProfile?.status === 'DISABLED') return false;
    if (ADMIN_ROLE_IDS.includes(userProfile?.roleId || '')) return true;
    return hasPermission(permissions, perm);
  };

  const isActiveUser = userProfile?.status === 'active' || userProfile?.status === 'ACTIVE';
  const isAdmin = ADMIN_ROLE_IDS.includes(userProfile?.roleId || '') && isActiveUser;
  const isHamletLeader = isAdmin;

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        role,
        permissions,
        hasPerm,
        isAdmin,
        isHamletLeader,
        loading,
        isFirstRun,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        claimFirstAdmin,
        logout,
        refreshProfile,
        updateMyProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
