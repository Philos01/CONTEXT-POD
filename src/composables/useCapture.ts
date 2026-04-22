import { ref, watch } from 'vue';
import { useAppStore } from '@/stores/appStore';
import type { CaptureResult } from '@/types';
import { alertService } from '@/services/alertService';
import { isTauri, isMobile, getPlatform } from '@/utils/platform';

let cachedActiveWindowTitle = '';

let moduleLevelCurrentShortcut = '';
const moduleIsRegistered = ref(false);
const moduleLastError = ref<string>('');
let moduleOnTriggerCallback: ((result: CaptureResult) => void) | null = null;

export function useCapture() {
  const isCapturing = ref(false);
  const lastCapture = ref<CaptureResult | null>(null);
  const appStore = useAppStore();
  const shortcutKey = ref(appStore.settings.shortcutKey);
  const platform = getPlatform();
  const isMobileDevice = isMobile();

  console.log(`[Context-Pod] ============================================`);
  console.log(`[Context-Pod] 🚀 useCapture initialized`);
  console.log(`[Context-Pod]    Environment: ${isTauri ? 'Tauri' : 'Browser'}`);
  console.log(`[Context-Pod]    Platform: ${platform}`);
  console.log(`[Context-Pod]    Is Mobile: ${isMobileDevice}`);
  console.log(`[Context-Pod]    Shortcut: "${shortcutKey.value}"`);
  console.log(`[Context-Pod] ============================================`);

  watch(() => appStore.settings.shortcutKey, (newKey) => {
    console.log(`[Context-Pod] ⌨️  Shortcut changed: "${shortcutKey.value}" -> "${newKey}"`);
    shortcutKey.value = newKey;
    if (isTauri && !isMobileDevice && moduleLevelCurrentShortcut) {
      reRegisterShortcut(newKey);
    }
  });

  function parseShortcut(shortcut: string) {
    const parts = shortcut.toLowerCase().split('+').map(p => p.trim());
    return {
      ctrl: parts.includes('ctrl'),
      alt: parts.includes('alt'),
      shift: parts.includes('shift'),
      key: parts[parts.length - 1] || 'space',
    };
  }

  async function reRegisterShortcut(newKey: string) {
    if (isMobileDevice) {
      console.log('[Context-Pod] Mobile device - skipping shortcut registration');
      return;
    }

    try {
      console.log(`[Context-Pod] 🔁 Re-registering shortcut: "${moduleLevelCurrentShortcut}" -> "${newKey}"`);
      const { unregister, register } = await import('@tauri-apps/plugin-global-shortcut');
      
      if (moduleLevelCurrentShortcut) {
        try {
          await unregister(moduleLevelCurrentShortcut);
          console.log(`[Context-Pod] ✅ Unregistered old shortcut: "${moduleLevelCurrentShortcut}"`);
        } catch (e) {
          console.warn(`[Context-Pod] ⚠️ Failed to unregister old shortcut:`, e);
        }
      }
      
      await register(newKey, async () => {
        await handleGlobalShortcutTrigger();
      });

      moduleLevelCurrentShortcut = newKey;
      moduleIsRegistered.value = true;
      moduleLastError.value = '';
      console.log(`[Context-Pod] ✅ Shortcut updated to: "${newKey}"`);
    } catch (error) {
      console.error('[Context-Pod] ❌ Failed to update shortcut:', error);
      moduleLastError.value = `更新失败: ${error}`;
      moduleIsRegistered.value = false;
    }
  }

  async function handleGlobalShortcutTrigger() {
    console.log(`[Context-Pod] ================================`);
    console.log(`[Context-Pod] 🎯 GLOBAL SHORTCUT TRIGGERED!`);
    console.log(`[Context-Pod] ================================`);
    
    if (!moduleOnTriggerCallback) {
      console.error('[Context-Pod] ❌ No trigger callback registered!');
      moduleLastError.value = '回调函数未注册';
      return;
    }
    
    if (isCapturing.value) {
      console.log('[Context-Pod] ⏳ Already capturing, ignoring duplicate trigger');
      return;
    }
    
    isCapturing.value = true;

    try {
      console.log('[Context-Pod] 📋 Starting capture process...');
      
      if (isTauri && !isMobileDevice) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          cachedActiveWindowTitle = await invoke('get_active_window_title');
          console.log(`[Context-Pod] 🪟 Cached active window BEFORE show: "${cachedActiveWindowTitle}"`);
        } catch (e) {
          console.warn('[Context-Pod] Failed to get active window:', e);
          cachedActiveWindowTitle = '';
        }
      }
      
      if (isTauri && !isMobileDevice) {
        console.log('[Context-Pod] 📋 Auto-copying selected text...');
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('simulate_copy_action');
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      
      if (isTauri && !isMobileDevice) {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const appWindow = getCurrentWindow();
        
        console.log('[Context-Pod] 👁️ Showing and focusing window...');
        await appWindow.show().catch(e => console.error('[Context-Pod] show error:', e));
        await appWindow.setFocus().catch(e => console.error('[Context-Pod] setFocus error:', e));

        console.log('[Context-Pod] ⏳ Waiting for window to be ready...');
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      console.log('[Context-Pod] 📄 Reading clipboard directly...');
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const text = await readText();

      console.log(`[Context-Pod] ✅ Captured text (${text?.length || 0} chars):`, text?.substring(0, 80));
      
      if (!text || text.trim().length === 0) {
        console.warn('[Context-Pod] ⚠️ Clipboard is empty!');
        moduleLastError.value = '剪贴板为空！请先选中文字并复制';
        
        const result: CaptureResult = {
          text: '',
          timestamp: Date.now(),
        };
        lastCapture.value = result;
        moduleOnTriggerCallback(result);
        
        setTimeout(() => {
          isCapturing.value = false;
          setTimeout(() => { moduleLastError.value = ''; }, 3000);
        }, 300);
        return;
      }

      const result: CaptureResult = {
        text: text,
        timestamp: Date.now(),
      };

      lastCapture.value = result;
      moduleLastError.value = '';
      
      console.log('[Context-Pod] 📢 Calling onTrigger callback...');
      moduleOnTriggerCallback(result);
      console.log('[Context-Pod] ✅ Callback completed successfully');
    } catch (error) {
      console.error('[Context-Pod] ❌ Capture process failed:', error);
      moduleLastError.value = `捕获失败: ${error}`;
    } finally {
      setTimeout(() => {
        isCapturing.value = false;
        console.log('[Context-Pod] ✅ Capture state reset');
      }, 300);
    }
  }

  function handleBrowserShortcut(e: KeyboardEvent) {
    console.log(`[Context-Pod] ================================`);
    console.log(`[Context-Pod] ⌨️ KEYBOARD EVENT DETECTED`);
    console.log(`[Context-Pod] ================================`);
    console.log(`[Context-Pod]    e.key: "${e.key}"`);
    console.log(`[Context-Pod]    e.code: "${e.code}"`);
    console.log(`[Context-Pod]    e.ctrlKey: ${e.ctrlKey}`);
    console.log(`[Context-Pod]    e.altKey: ${e.altKey}`);
    console.log(`[Context-Pod]    e.shiftKey: ${e.shiftKey}`);
    console.log(`[Context-Pod]    Target shortcut: "${shortcutKey.value}"`);

    if (!moduleOnTriggerCallback) {
      console.warn('[Context-Pod] ❌ No trigger callback registered');
      return;
    }

    const parsed = parseShortcut(shortcutKey.value);
    
    const ctrlMatch = parsed.ctrl ? e.ctrlKey : !e.ctrlKey;
    const altMatch = parsed.alt ? e.altKey : !e.altKey;
    const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
    
    let keyMatch = false;
    const keyLower = parsed.key.toLowerCase();
    
    if (/^f\d{1,2}$/i.test(keyLower)) {
      const fNum = keyLower.substring(1);
      keyMatch = e.code === `F${fNum}` || e.key === `F${fNum}`;
    } else if (keyLower === 'space') {
      keyMatch = e.code === 'Space';
    } else if (keyLower.length === 1) {
      keyMatch = e.key.toLowerCase() === keyLower;
    } else {
      keyMatch = e.code.toLowerCase() === keyLower || e.key.toLowerCase() === keyLower;
    }

    const isMatch = ctrlMatch && altMatch && shiftMatch && keyMatch;

    if (isMatch) {
      e.preventDefault();
      e.stopPropagation();
      
      console.log(`[Context-Pod] 🎯 Browser shortcut "${shortcutKey.value}" TRIGGERED!`);
      
      if (isCapturing.value) {
        console.log('[Context-Pod] ⏳ Already capturing, skip');
        return;
      }
      
      isCapturing.value = true;

      const result: CaptureResult = {
        text: '[浏览器测试模式] 张三: 明天下午开会吗？\n我: 是的，三点开始\n张三: 好的，收到',
        timestamp: Date.now(),
      };

      lastCapture.value = result;
      
      console.log('[Context-Pod] Calling onTrigger callback...');
      moduleOnTriggerCallback(result);
      
      setTimeout(() => {
        isCapturing.value = false;
      }, 500);
    }
  }

  const initShortcut = async (onTrigger: (result: CaptureResult) => void) => {
    moduleOnTriggerCallback = onTrigger;
    console.log(`[Context-Pod] 📍 initShortcut called with callback`);
    console.log(`[Context-Pod] 📊 Module state - currentShortcut: "${moduleLevelCurrentShortcut}", isRegistered: ${moduleIsRegistered.value}`);

    if (!isTauri) {
      console.log(`[Context-Pod] 🌐 Browser mode - setting up keyboard listener for "${shortcutKey.value}"`);
      document.addEventListener('keydown', handleBrowserShortcut);
      moduleIsRegistered.value = true;
      console.log('[Context-Pod] ✅ Browser keyboard listener registered successfully');
      return;
    }

    if (isMobileDevice) {
      console.log('[Context-Pod] 📱 Mobile device - shortcut registration skipped, use manual capture');
      moduleIsRegistered.value = true;
      return;
    }

    try {
      console.log(`[Context-Pod] 📡 Attempting to register global shortcut: "${shortcutKey.value}"`);

      const { unregister, register } = await import('@tauri-apps/plugin-global-shortcut');

      if (moduleLevelCurrentShortcut) {
        try {
          await unregister(moduleLevelCurrentShortcut);
          console.log(`[Context-Pod] 🧹 Unregistered module-level shortcut: "${moduleLevelCurrentShortcut}"`);
        } catch (e) {
          console.warn(`[Context-Pod] ⚠️ Failed to unregister module-level shortcut:`, e);
        }
      }

      try {
        await unregister(shortcutKey.value);
        console.log(`[Context-Pod] 🧹 Proactively unregistered target shortcut: "${shortcutKey.value}"`);
      } catch (e) {
        console.log(`[Context-Pod] ℹ️ Target shortcut not previously registered (this is ok): ${shortcutKey.value}`);
      }

      await register(shortcutKey.value, async () => {
        await handleGlobalShortcutTrigger();
      });

      moduleLevelCurrentShortcut = shortcutKey.value;
      moduleIsRegistered.value = true;
      moduleLastError.value = '';
      console.log(`[Context-Pod] ✅✅✅ Global shortcut registered SUCCESSFULLY: "${shortcutKey.value}"`);
      console.log(`[Context-Pod] 💡 Usage: 1) Select text in chat 2) Press ${shortcutKey.value} to capture (text auto-copy now!)`);
    } catch (error) {
      const errorMessage = error?.toString() || JSON.stringify(error);
      const isAlreadyRegistered = errorMessage.includes('already registered') || errorMessage.includes('HotKey already');

      if (isAlreadyRegistered) {
        console.log(`[Context-Pod] ℹ️ Shortcut "${shortcutKey.value}" already registered (likely from previous instance or HMR)`);
        console.log(`[Context-Pod] ✅ Treating as SUCCESS - shortcut is active and functional`);

        moduleLevelCurrentShortcut = shortcutKey.value;
        moduleIsRegistered.value = true;
        moduleLastError.value = '';
        return;
      }

      console.error(`[Context-Pod] ❌❌❌ FAILED to register global shortcut:`, error);
      console.error(`[Context-Pod] Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      moduleIsRegistered.value = false;
      moduleLastError.value = `快捷键注册失败: ${error}`;

      alertService.warning(`⚠️ 快捷键注册失败！\n\n错误信息: ${error}\n\n可能的原因:\n1. 该快捷键被其他程序占用\n2. 系统权限不足\n3. Tauri 插件未正确安装\n\n请尝试:\n- 更换其他快捷键（如 F10、F11）\n- 以管理员身份运行应用\n- 检查控制台详细日志`);
    }
  };

  const manualCapture = async (text?: string): Promise<CaptureResult | null> => {
    console.log('[Context-Pod] 📱 Manual capture triggered');
    
    if (!moduleOnTriggerCallback) {
      console.error('[Context-Pod] ❌ No trigger callback registered!');
      return null;
    }
    
    if (isCapturing.value) {
      console.log('[Context-Pod] ⏳ Already capturing, skip');
      return null;
    }
    
    isCapturing.value = true;

    try {
      let capturedText = text;
      
      if (!capturedText && isTauri) {
        console.log('[Context-Pod] 📄 Reading clipboard...');
        const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
        capturedText = await readText() || undefined;
      }
      
      if (!capturedText) {
        console.warn('[Context-Pod] ⚠️ No text provided and clipboard is empty');
        moduleLastError.value = '请输入文字或复制内容到剪贴板';
        return null;
      }

      const result: CaptureResult = {
        text: capturedText,
        timestamp: Date.now(),
      };

      lastCapture.value = result;
      moduleLastError.value = '';
      
      console.log('[Context-Pod] 📢 Calling onTrigger callback...');
      moduleOnTriggerCallback(result);
      console.log('[Context-Pod] ✅ Manual capture completed');
      
      return result;
    } catch (error) {
      console.error('[Context-Pod] ❌ Manual capture failed:', error);
      moduleLastError.value = `捕获失败: ${error}`;
      return null;
    } finally {
      setTimeout(() => {
        isCapturing.value = false;
      }, 300);
    }
  };

  const showWindow = async () => {
    if (!isTauri || isMobileDevice) {
      console.log('[Context-Pod] Non-desktop mode - cannot show window via command');
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('show_window');
      console.log('[Context-Pod] Window shown via command');
    } catch (error) {
      console.error('[Context-Pod] Failed to show window:', error);
    }
  };

  const hideWindow = async () => {
    if (!isTauri || isMobileDevice) {
      console.log('[Context-Pod] Non-desktop mode - cannot hide window via command');
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('hide_window');
      console.log('[Context-Pod] Window hidden via command');
    } catch (error) {
      console.error('[Context-Pod] Failed to hide window:', error);
    }
  };

  const cleanupShortcut = async () => {
    console.log('[Context-Pod] 🧹 Cleaning up shortcuts...');
    moduleOnTriggerCallback = null;
    
    if (!isTauri) {
      document.removeEventListener('keydown', handleBrowserShortcut);
      console.log('[Context-Pod] Browser keyboard listener removed');
      return;
    }

    if (isMobileDevice) {
      console.log('[Context-Pod] Mobile device - no shortcut to cleanup');
      return;
    }
    
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      if (moduleLevelCurrentShortcut) {
        await unregister(moduleLevelCurrentShortcut);
        console.log(`[Context-Pod] Unregistered shortcut: ${moduleLevelCurrentShortcut}`);
        moduleLevelCurrentShortcut = '';
      }
    } catch (error) {
      console.log('[Context-Pod] Cleanup shortcut error:', error);
    }
  };

  const getCachedActiveWindow = () => cachedActiveWindowTitle;

  return {
    isCapturing,
    lastCapture,
    shortcutKey,
    isRegistered: moduleIsRegistered,
    lastError: moduleLastError,
    initShortcut,
    cleanupShortcut,
    showWindow,
    hideWindow,
    getCachedActiveWindow,
    manualCapture,
    isMobileDevice,
    platform,
  };
}
