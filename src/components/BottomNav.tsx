export type AppTab = 'dashboard' | 'residents' | 'finance' | 'gifts' | 'reports' | 'settings';

interface BottomNavProps {
  currentTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
}

export function BottomNav({ currentTab, onSelectTab }: BottomNavProps) {
  const tabs = [
    {
      id: 'dashboard' as AppTab,
      label: 'Tổng quan',
      icon: 'dashboard',
    },
    {
      id: 'residents' as AppTab,
      label: 'Dân cư',
      icon: 'groups',
    },
    {
      id: 'finance' as AppTab,
      label: 'Tài chính',
      icon: 'account_balance_wallet',
    },
    {
      id: 'gifts' as AppTab,
      label: 'Phát quà',
      icon: 'featured_seasonal_and_gifts',
    },
    {
      id: 'reports' as AppTab,
      label: 'Báo cáo',
      icon: 'monitoring',
    },
    {
      id: 'settings' as AppTab,
      label: 'Cài đặt',
      icon: 'tune',
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high pb-safe transition-colors">
      <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-around px-2 py-1.5">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-2xl transition-all ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div
                className={`w-10 h-7 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-primary-fixed text-on-primary-fixed scale-105' : 'bg-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-xl">{tab.icon}</span>
              </div>
              <span className="text-[11px] font-medium mt-0.5 tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
