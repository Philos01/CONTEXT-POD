export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export const isDesktop = isTauri && !isMobile();

export const isMobileDevice = (): boolean => {
  if (!isTauri) return false;
  
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('android') || ua.includes('iphone') || ua.includes('ipad');
};

export function isMobile(): boolean {
  if (typeof window === 'undefined') return false;
  
  const ua = navigator.userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isIOS = /iphone|ipad|ipod/.test(ua);
  
  if (isAndroid || isIOS) return true;
  
  if (isTauri) {
    const platform = (window as any).__TAURI_INTERNALS__?.platform;
    return platform === 'android' || platform === 'ios';
  }
  
  return false;
}

export function getPlatform(): 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web' {
  if (!isTauri) return 'web';
  
  const ua = navigator.userAgent.toLowerCase();
  
  if (ua.includes('android')) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  
  const platform = (window as any).__TAURI_INTERNALS__?.platform;
  if (platform) return platform;
  
  return 'web';
}

export const platformFeatures = {
  hasGlobalShortcut: isDesktop,
  hasSystemTray: isDesktop,
  hasFloatingWindow: isDesktop,
  hasClipboard: true,
  hasWindowManager: isDesktop,
};
