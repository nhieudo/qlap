import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { OrganizationSettings } from '../types';
import { DEFAULT_ORG_SETTINGS } from '../utils/defaults';
import { useAuth } from './AuthContext';
import { logAuditEvent } from '../utils/auditLogger';
import { sanitizeForFirestore } from '../services/db';

interface SettingsContextType {
  settings: OrganizationSettings;
  loading: boolean;
  updateSettings: (newSettings: Partial<OrganizationSettings>) => Promise<void>;
  saveSettings: (
    newSettings: Partial<OrganizationSettings>,
    userId?: string,
    userName?: string
  ) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OrganizationSettings>(DEFAULT_ORG_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { user, userProfile, hasPerm } = useAuth();

  useEffect(() => {
    const orgDocRef = doc(db, 'organizationSettings', 'default');
    const unsubscribe = onSnapshot(orgDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as OrganizationSettings;
        setSettings({
          ...DEFAULT_ORG_SETTINGS,
          ...data,
          voucherSettings: {
            ...DEFAULT_ORG_SETTINGS.voucherSettings,
            ...(data.voucherSettings || {}),
          },
        });
      } else {
        // Initialize default if document doesn't exist
        setSettings(DEFAULT_ORG_SETTINGS);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Lỗi lắng nghe cài đặt cơ sở (sử dụng cấu hình mặc định):', error);
      setSettings(DEFAULT_ORG_SETTINGS);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (
    newSettings: Partial<OrganizationSettings>,
    userId?: string,
    userName?: string
  ) => {
    if (!hasPerm('settings.update')) {
      throw new Error('Bạn không có quyền cập nhật cài đặt cơ sở!');
    }

    const orgDocRef = doc(db, 'organizationSettings', 'default');
    const merged: OrganizationSettings = {
      ...settings,
      ...newSettings,
      updatedAt: new Date().toISOString(),
      updatedBy: userName || userProfile?.fullName || user?.email || 'Quản trị viên',
    };

    await setDoc(orgDocRef, sanitizeForFirestore(merged), { merge: true });

    await logAuditEvent({
      userId: userId || user?.uid || 'system',
      userName: userName || userProfile?.fullName || 'Quản trị viên',
      action: 'SETTINGS_CHANGE',
      module: 'SETTINGS',
      entityType: 'ORGANIZATION_SETTINGS',
      entityId: 'default',
      description: 'Cập nhật thông tin hành chính đơn vị và mẫu biểu chứng từ (Ấp, Xã, Tỉnh)',
      before: settings,
      after: merged,
    });
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        loading,
        updateSettings,
        saveSettings: updateSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
