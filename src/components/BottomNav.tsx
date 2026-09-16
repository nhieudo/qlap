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
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-lowest/95 backdrop-blur-md border-t border-surface-container-high transition-colors shadow-lg pb-[calc(env(safe-area-inset-bottom,0px)+6px)] pt-1">
      <div className="max-w-md md:max-w-2xl mx-auto flex items-center justify-around px-1">
        {tabs.map((tab) => {
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 px-0.5 rounded-xl transition-all min-h-[48px] active:scale-95 select-none cursor-pointer ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant/80 hover:text-on-surface'
              }`}
            >
              <div
                className={`w-11 h-7 rounded-full flex items-center justify-center transition-all ${
                  isActive ? 'bg-primary-fixed text-on-primary-fixed scale-105 shadow-xs' : 'bg-transparent'
                }`}
              >
                <span className={`material-symbols-outlined text-[20px] transition-transform ${isActive ? 'scale-110' : ''}`}>
                  {tab.icon}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-medium mt-0.5 tracking-tight whitespace-nowrap leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
