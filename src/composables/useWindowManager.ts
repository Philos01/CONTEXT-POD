import { ref, onMounted } from 'vue';
import { isTauri, isMobile } from '@/utils/platform';

export function useWindowManager() {
  const isVisible = ref(true);
  const isMobileDevice = isMobile();

  const show = async () => {
    if (isTauri && !isMobileDevice) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.show();
      await appWindow.setFocus();
    }
    isVisible.value = true;
  };

  const hide = async () => {
    if (isTauri && !isMobileDevice) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.hide();
    }
    isVisible.value = false;
  };

  const toggle = async () => {
    if (isVisible.value) {
      await hide();
    } else {
      await show();
    }
  };

  onMounted(async () => {
    if (isTauri && !isMobileDevice) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        isVisible.value = await appWindow.isVisible();
      } catch {
        // ignore
      }
    }
  });

  return {
    isVisible,
    show,
    hide,
    toggle,
    isMobileDevice,
  };
}
