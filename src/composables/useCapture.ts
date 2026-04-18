import { ref, watch } from 'vue';
import { useAppStore } from '@/stores/appStore';
import type { CaptureResult } from '@/types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

export function useCapture() {
  const isCapturing = ref(false);
  const lastCapture = ref<CaptureResult | null>(null);
  const appStore = useAppStore();
  const shortcutKey = ref(appStore.settings.shortcutKey);
  const isRegistered = ref(false);
  const lastError = ref<string>('');
  let currentShortcut = '';
  let onTriggerCallback: ((result: CaptureResult) => void) | null = null;

  console.log(`[Context-Pod] ============================================`);
  console.log(`[Context-Pod] 🚀 useCapture initialized`);
  console.log(`[Context-Pod]    Environment: ${isTauri ? 'Tauri (Desktop)' : 'Browser'}`);
  console.log(`[Context-Pod]    Shortcut: "${shortcutKey.value}"`);
  console.log(`[Context-Pod] ============================================`);

  watch(() => appStore.settings.shortcutKey, (newKey) => {
    console.log(`[Context-Pod] ⌨️  Shortcut changed: "${shortcutKey.value}" -> "${newKey}"`);
    shortcutKey.value = newKey;
    if (isTauri && currentShortcut) {
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
    try {
      console.log(`[Context-Pod] 🔁 Re-registering shortcut: "${currentShortcut}" -> "${newKey}"`);
      const { unregister, register } = await import('@tauri-apps/plugin-global-shortcut');
      
      if (currentShortcut) {
        try {
          await unregister(currentShortcut);
          console.log(`[Context-Pod] ✅ Unregistered old shortcut: "${currentShortcut}"`);
        } catch (e) {
          console.warn(`[Context-Pod] ⚠️ Failed to unregister old shortcut:`, e);
        }
      }
      
      await register(newKey, async () => {
        await handleGlobalShortcutTrigger();
      });

      currentShortcut = newKey;
      isRegistered.value = true;
      lastError.value = '';
      console.log(`[Context-Pod] ✅ Shortcut updated to: "${newKey}"`);
    } catch (error) {
      console.error('[Context-Pod] ❌ Failed to update shortcut:', error);
      lastError.value = `更新失败: ${error}`;
      isRegistered.value = false;
    }
  }

  async function handleGlobalShortcutTrigger() {
    console.log(`[Context-Pod] ================================`);
    console.log(`[Context-Pod] 🎯 GLOBAL SHORTCUT TRIGGERED!`);
    console.log(`[Context-Pod] ================================`);
    
    if (!onTriggerCallback) {
      console.error('[Context-Pod] ❌ No trigger callback registered!');
      lastError.value = '回调函数未注册';
      return;
    }
    
    if (isCapturing.value) {
      console.log('[Context-Pod] ⏳ Already capturing, ignoring duplicate trigger');
      lastError.value = '正在处理中';
      return;
    }
    
    isCapturing.value = true;

    try {
      console.log('[Context-Pod] 📋 Starting capture process...');
      
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      
      console.log('[Context-Pod] 👁️ Showing and focusing window...');
      await appWindow.show().catch(e => console.error('[Context-Pod] show error:', e));
      await appWindow.setFocus().catch(e => console.error('[Context-Pod] setFocus error:', e));

      console.log('[Context-Pod] ⏳ Waiting for window to be ready...');
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log('[Context-Pod] 📄 Reading clipboard directly...');
      const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
      const text = await readText();

      console.log(`[Context-Pod] ✅ Captured text (${text?.length || 0} chars):`, text?.substring(0, 80));
      
      if (!text || text.trim().length === 0) {
        console.warn('[Context-Pod] ⚠️ Clipboard is empty!');
        lastError.value = '剪贴板为空！请先选中文字并 Ctrl+C 复制';
        
        const result: CaptureResult = {
          text: '',
          timestamp: Date.now(),
        };
        lastCapture.value = result;
        onTriggerCallback(result);
        
        setTimeout(() => {
          isCapturing.value = false;
        }, 300);
        return;
      }

      const result: CaptureResult = {
        text: text,
        timestamp: Date.now(),
      };

      lastCapture.value = result;
      lastError.value = '';
      
      console.log('[Context-Pod] 📢 Calling onTrigger callback...');
      onTriggerCallback(result);
      console.log('[Context-Pod] ✅ Callback completed successfully');
    } catch (error) {
      console.error('[Context-Pod] ❌ Capture process failed:', error);
      lastError.value = `捕获失败: ${error}`;
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

    if (!onTriggerCallback) {
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
      onTriggerCallback(result);
      
      setTimeout(() => {
        isCapturing.value = false;
      }, 500);
    }
  }

  const initShortcut = async (onTrigger: (result: CaptureResult) => void) => {
    onTriggerCallback = onTrigger;
    console.log(`[Context-Pod] 📍 initShortcut called with callback`);

    if (!isTauri) {
      console.log(`[Context-Pod] 🌐 Browser mode - setting up keyboard listener for "${shortcutKey.value}"`);
      document.addEventListener('keydown', handleBrowserShortcut);
      isRegistered.value = true;
      console.log('[Context-Pod] ✅ Browser keyboard listener registered successfully');
      return;
    }

    try {
      console.log(`[Context-Pod] 📡 Attempting to register global shortcut: "${shortcutKey.value}"`);
      
      const { register } = await import('@tauri-apps/plugin-global-shortcut');
      
      await register(shortcutKey.value, async () => {
        await handleGlobalShortcutTrigger();
      });

      currentShortcut = shortcutKey.value;
      isRegistered.value = true;
      lastError.value = '';
      console.log(`[Context-Pod] ✅✅✅ Global shortcut registered SUCCESSFULLY: "${shortcutKey.value}"`);
      console.log(`[Context-Pod] 💡 Usage: 1) Select text in chat 2) Press Ctrl+C to copy 3) Press ${shortcutKey.value} to capture`);
    } catch (error) {
      console.error(`[Context-Pod] ❌❌❌ FAILED to register global shortcut:`, error);
      console.error(`[Context-Pod] Error details:`, JSON.stringify(error, Object.getOwnPropertyNames(error)));
      isRegistered.value = false;
      lastError.value = `快捷键注册失败: ${error}`;
      
      alert(`⚠️ 快捷键注册失败！\n\n错误信息: ${error}\n\n可能的原因:\n1. 该快捷键被其他程序占用\n2. 系统权限不足\n3. Tauri 插件未正确安装\n\n请尝试:\n- 更换其他快捷键（如 F10、F11）\n- 以管理员身份运行应用\n- 检查控制台详细日志`);
    }
  };

  const showWindow = async () => {
    if (!isTauri) {
      console.log('[Context-Pod] Browser mode - cannot show window via command');
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
    if (!isTauri) {
      console.log('[Context-Pod] Browser mode - cannot hide window via command');
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
    onTriggerCallback = null;
    
    if (!isTauri) {
      document.removeEventListener('keydown', handleBrowserShortcut);
      console.log('[Context-Pod] Browser keyboard listener removed');
      return;
    }
    
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      if (currentShortcut) {
        await unregister(currentShortcut);
        console.log(`[Context-Pod] Unregistered shortcut: ${currentShortcut}`);
      }
    } catch (error) {
      console.log('[Context-Pod] Cleanup shortcut error:', error);
    }
  };

  return {
    isCapturing,
    lastCapture,
    shortcutKey,
    isRegistered,
    lastError,
    initShortcut,
    cleanupShortcut,
    showWindow,
    hideWindow,
  };
}