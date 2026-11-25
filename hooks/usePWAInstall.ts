import { useCallback, useEffect, useMemo, useState } from 'react';

export type PWAPlatform = 'ios' | 'android' | 'desktop';

const BANNER_DISMISSED_KEY = 'olga_pwa_banner_dismissed_v1';

export interface UsePWAInstallResult {
  isStandalone: boolean;
  platform: PWAPlatform;
  isInAppBrowser: boolean;
  isIOSNonSafari: boolean;
  isIOSSafari: boolean;
  canNativeInstall: boolean;
  isGuideOpen: boolean;
  setIsGuideOpen: (open: boolean) => void;
  triggerInstall: () => Promise<void>;
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

const detectStandalone = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const mqStandalone = window.matchMedia?.('(display-mode: standalone)')?.matches;
    const navStandalone = (window.navigator as any)?.standalone === true;
    const androidReferrer =
      typeof document !== 'undefined' && document.referrer.startsWith('android-app://');
    return Boolean(mqStandalone || navStandalone || androidReferrer);
  } catch {
    return false;
  }
};

export const usePWAInstall = (): UsePWAInstallResult => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(() => detectStandalone());
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(BANNER_DISMISSED_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setIsGuideOpen(false);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    const mq = window.matchMedia?.('(display-mode: standalone)');
    const onDisplayModeChange = () => setIsStandalone(detectStandalone());
    mq?.addEventListener?.('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      mq?.removeEventListener?.('change', onDisplayModeChange);
    };
  }, []);

  const uaInfo = useMemo(() => {
    if (typeof navigator === 'undefined') {
      return {
        platform: 'desktop' as PWAPlatform,
        isInAppBrowser: false,
        isIOSNonSafari: false,
        isIOSSafari: false,
      };
    }
    const ua = navigator.userAgent || '';
    const isIPadDesktopMode =
      /Macintosh/i.test(ua) && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
    const isIOS = /iPhone|iPad|iPod/i.test(ua) || isIPadDesktopMode;
    const isAndroid = /Android/i.test(ua);
    const platform: PWAPlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop';

    const isInAppBrowser =
      /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line|MicroMessenger|BytedanceWebview|TikTok|LinkedInApp|Twitter|Telegram/i.test(
        ua
      );
    const isThirdPartyIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|GSA|DuckDuckGo/i.test(ua);
    const isIOSNonSafari =
      isIOS && (isInAppBrowser || isThirdPartyIOSBrowser || !/Safari/i.test(ua));
    const isIOSSafari = isIOS && !isIOSNonSafari;

    return { platform, isInAppBrowser, isIOSNonSafari, isIOSSafari };
  }, []);

  const triggerInstall = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice?.outcome === 'accepted') {
          setDeferredPrompt(null);
        }
        return;
      } catch {
        // Fallback a guía visual si el navegador bloqueó el prompt
      }
    }
    setIsGuideOpen(true);
  }, [deferredPrompt]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
    try {
      sessionStorage.setItem(BANNER_DISMISSED_KEY, '1');
    } catch {
      // Ignorar si sessionStorage no está disponible
    }
  }, []);

  return {
    isStandalone,
    platform: uaInfo.platform,
    isInAppBrowser: uaInfo.isInAppBrowser,
    isIOSNonSafari: uaInfo.isIOSNonSafari,
    isIOSSafari: uaInfo.isIOSSafari,
    canNativeInstall: Boolean(deferredPrompt),
    isGuideOpen,
    setIsGuideOpen,
    triggerInstall,
    bannerDismissed,
    dismissBanner,
  };
};
