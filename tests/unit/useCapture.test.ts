import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: vi.fn().mockResolvedValue(undefined),
  unregister: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-clipboard-manager', () => ({
  readText: vi.fn().mockResolvedValue('测试文本'),
  writeText: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(false),
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue(undefined),
}));

import { useCapture } from '@/composables/useCapture';

describe('useCapture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default values', () => {
    const { isCapturing, lastCapture, shortcutKey } = useCapture();
    expect(isCapturing.value).toBe(false);
    expect(lastCapture.value).toBeNull();
    expect(shortcutKey.value).toBe('Alt+Space');
  });

  it('should skip shortcut registration in browser mode (no __TAURI_INTERNALS__)', async () => {
    const { initShortcut } = useCapture();
    const onTrigger = vi.fn();
    await initShortcut(onTrigger);

    const { register } = await import('@tauri-apps/plugin-global-shortcut');
    expect(register).not.toHaveBeenCalled();
  });

  it('should skip cleanup in browser mode', async () => {
    const { cleanupShortcut } = useCapture();
    await cleanupShortcut();

    const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
    expect(unregister).not.toHaveBeenCalled();
  });

  it('should not set isCapturing in browser mode', async () => {
    const { isCapturing, initShortcut } = useCapture();
    const onTrigger = vi.fn();
    await initShortcut(onTrigger);
    expect(isCapturing.value).toBe(false);
  });
});
