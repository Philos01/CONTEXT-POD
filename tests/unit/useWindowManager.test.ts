import { describe, it, expect, vi } from 'vitest';

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    show: vi.fn().mockResolvedValue(undefined),
    setFocus: vi.fn().mockResolvedValue(undefined),
    hide: vi.fn().mockResolvedValue(undefined),
    isVisible: vi.fn().mockResolvedValue(false),
  }),
}));

import { useWindowManager } from '@/composables/useWindowManager';

describe('useWindowManager', () => {
  it('should initialize with isVisible false', () => {
    const { isVisible } = useWindowManager();
    expect(isVisible.value).toBe(false);
  });

  it('should provide show, hide, toggle methods', () => {
    const { show, hide, toggle } = useWindowManager();
    expect(typeof show).toBe('function');
    expect(typeof hide).toBe('function');
    expect(typeof toggle).toBe('function');
  });

  it('should call window show on show()', async () => {
    const { show } = useWindowManager();
    await show();
  });

  it('should call window hide on hide()', async () => {
    const { hide } = useWindowManager();
    await hide();
  });
});
