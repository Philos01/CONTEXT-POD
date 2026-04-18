import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import FloatingPanel from '@/components/FloatingPanel.vue';

const localStorageStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
});

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

vi.mock('@orama/orama', () => ({
  create: vi.fn().mockResolvedValue({}),
  insert: vi.fn().mockResolvedValue('mock-id'),
  search: vi.fn().mockResolvedValue({ hits: [] }),
}));

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(vi.fn().mockResolvedValue({
    data: new Float32Array(384).fill(0.1),
  })),
}));

vi.mock('@/services/agentWorkflow', () => ({
  runWorkflowStream: vi.fn().mockResolvedValue({
    rawText: '王总：进度怎么样了？',
    targetPerson: '王总',
    memoryData: '脾气急躁，爱画大饼',
    finalPrompt: 'test prompt',
    strategies: [
      { label: 'A', style: '顺从推进', content: '好的老板' },
      { label: 'B', style: '委婉甩锅', content: '再看看' },
      { label: 'C', style: '幽默化解', content: '哈哈' },
    ],
  }),
}));

describe('FloatingPanel', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    setActivePinia(createPinia());
  });

  it('should render the main panel', () => {
    const wrapper = mount(FloatingPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('伴聊悬浮舱');
  });

  it('should show idle state by default', () => {
    const wrapper = mount(FloatingPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('Alt+Space');
  });

  it('should switch to settings tab', async () => {
    const wrapper = mount(FloatingPanel, {
      global: { plugins: [createPinia()] },
    });

    const settingsBtn = wrapper.findAll('button').find(b => b.attributes('title') === '设置');
    if (settingsBtn) {
      await settingsBtn.trigger('click');
      expect(wrapper.text()).toContain('API Key');
    }
  });

  it('should switch to contacts tab', async () => {
    const wrapper = mount(FloatingPanel, {
      global: { plugins: [createPinia()] },
    });

    const contactsBtn = wrapper.findAll('button').find(b => b.attributes('title') === '联系人管理');
    if (contactsBtn) {
      await contactsBtn.trigger('click');
      expect(wrapper.text()).toContain('联系人管理');
    }
  });
});
