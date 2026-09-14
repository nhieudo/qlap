import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Header } from './components/Header';
import { BottomNav, AppTab } from './components/BottomNav';
import { DashboardView } from './views/DashboardView';
import { ResidentsView } from './views/ResidentsView';
import { FinanceView } from './views/FinanceView';
import { GiftsView } from './views/GiftsView';
import { ReportsView } from './views/ReportsView';
import { SettingsView } from './views/SettingsView';
import { LoginView } from './views/LoginView';
import { VerifyVoucherPage } from './views/VerifyVoucherPage';
import { QRScannerModal } from './components/QRScannerModal';
import { InviteAcceptModal } from './components/InviteAcceptModal';

function MainAppContent() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<AppTab>('dashboard');
  const [verifyCode, setVerifyCode] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

  // Quick Action triggers
  const [openNewResident, setOpenNewResident] = useState(false);
  const [openNewIncome, setOpenNewIncome] = useState(false);
  const [openNewExpense, setOpenNewExpense] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  // Listen for hash change to handle #verify-CODE and #invite-TOKEN
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#verify-')) {
        const code = hash.replace('#verify-', '');
        setVerifyCode(code);
        setInviteToken(null);
      } else if (hash.startsWith('#invite-')) {
        const token = hash.replace('#invite-', '');
        setInviteToken(token);
        setVerifyCode(null);
      } else {
        setVerifyCode(null);
        setInviteToken(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // If user is on verification page
  if (verifyCode) {
    return (
      <VerifyVoucherPage
        code={verifyCode}
        onBack={() => {
          window.location.hash = '';
          setVerifyCode(null);
        }}
      />
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-amber-300 shadow-xl mb-4 animate-pulse">
          <span className="material-symbols-outlined text-3xl">account_balance</span>
        </div>
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
          Đang kết nối hệ thống Quản lý Ấp...
        </p>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <>
        <LoginView />
        {inviteToken && (
          <InviteAcceptModal
            token={inviteToken}
            onClose={() => {
              window.location.hash = '';
              setInviteToken(null);
            }}
            onSuccess={(roleName) => {
              window.location.hash = '';
              setInviteToken(null);
              alert(`Chúc mừng! Bạn đã nhận phân quyền: ${roleName}`);
            }}
          />
        )}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col text-on-surface">
      {/* Official Header */}
      <Header
        onOpenSearch={() => setIsQRScannerOpen(true)}
        onSelectTab={(tab) => setCurrentTab(tab as AppTab)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {currentTab === 'dashboard' && (
          <DashboardView
            onNavigate={(tab) => setCurrentTab(tab as AppTab)}
            onOpenNewResident={() => {
              setCurrentTab('residents');
              setOpenNewResident(true);
            }}
            onOpenNewIncome={() => {
              setCurrentTab('finance');
              setOpenNewIncome(true);
            }}
            onOpenNewExpense={() => {
              setCurrentTab('finance');
              setOpenNewExpense(true);
            }}
            onOpenQRScanner={() => setIsQRScannerOpen(true)}
          />
        )}

        {currentTab === 'residents' && (
          <ResidentsView
            initialOpenModal={openNewResident}
            onResetInitialModal={() => setOpenNewResident(false)}
          />
        )}

        {currentTab === 'finance' && (
          <FinanceView
            initialOpenIncome={openNewIncome}
            initialOpenExpense={openNewExpense}
            onResetInitialModals={() => {
              setOpenNewIncome(false);
              setOpenNewExpense(false);
            }}
          />
        )}

        {currentTab === 'gifts' && <GiftsView />}

        {currentTab === 'reports' && <ReportsView />}

        {currentTab === 'settings' && <SettingsView />}
      </main>

      {/* Persistent Bottom / Mobile Navigation */}
      <BottomNav currentTab={currentTab} onSelectTab={(tab) => setCurrentTab(tab)} />

      {/* QR Code Scanner & Manual Verification Modal */}
      <QRScannerModal
        isOpen={isQRScannerOpen}
        onClose={() => setIsQRScannerOpen(false)}
        onVerifyCode={(code) => {
          window.location.hash = `#verify-${code}`;
        }}
      />

      {/* Invite Confirmation Modal for Logged In User */}
      {inviteToken && (
        <InviteAcceptModal
          token={inviteToken}
          onClose={() => {
            window.location.hash = '';
            setInviteToken(null);
          }}
          onSuccess={(roleName) => {
            window.location.hash = '';
            setInviteToken(null);
            alert(`Chúc mừng! Bạn đã nhận phân quyền: ${roleName}`);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <MainAppContent />
      </SettingsProvider>
    </AuthProvider>
  );
}
