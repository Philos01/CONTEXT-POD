import { ref, onMounted } from 'vue';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useWindowManager() {
  const isVisible = ref(false);

  const show = async () => {
    if (isTauri) {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.show();
      await appWindow.setFocus();
    }
    isVisible.value = true;
  };

  const hide = async () => {
    if (isTauri) {
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
    if (isTauri) {
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
  };
}
