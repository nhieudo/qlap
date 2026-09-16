import { useEffect, useState, useCallback } from 'react';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PlatformType = 'android' | 'ios' | 'desktop-chrome' | 'desktop-edge' | 'desktop-safari' | 'other';

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [platform, setPlatform] = useState<PlatformType>('other');

  useEffect(() => {
    // Detect standalone mode (already installed as PWA)
    const checkStandalone = () => {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://');
      setIsInstalled(Boolean(isStandalone));
    };

    checkStandalone();

    // Detect platform
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroidDevice = /android/.test(ua);
    
    setIsIOS(isIOSDevice);
    setIsAndroid(isAndroidDevice);

    if (isIOSDevice) {
      setPlatform('ios');
    } else if (isAndroidDevice) {
      setPlatform('android');
    } else if (/edg\//.test(ua)) {
      setPlatform('desktop-edge');
    } else if (/chrome\//.test(ua)) {
      setPlatform('desktop-chrome');
    } else if (/safari\//.test(ua)) {
      setPlatform('desktop-safari');
    } else {
      setPlatform('other');
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mql = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    mql.addEventListener('change', handleDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mql.removeEventListener('change', handleDisplayModeChange);
    };
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'manual-guide'> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          setIsInstalled(true);
          setDeferredPrompt(null);
          return 'accepted';
        }
        return 'dismissed';
      } catch (err) {
        console.error('PWA install prompt error:', err);
        return 'manual-guide';
      }
    }
    // If prompt is not directly available (e.g. iOS Safari, desktop without prompt event),
    // guide user manually.
    return 'manual-guide';
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isAndroid,
    platform,
    install,
    hasNativePrompt: Boolean(deferredPrompt),
  };
}
