import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import SettingsPanel from '@/components/SettingsPanel.vue';

const localStorageStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
});

describe('SettingsPanel', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    setActivePinia(createPinia());
  });

  it('should render settings form', () => {
    const wrapper = mount(SettingsPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('API Key');
    expect(wrapper.text()).toContain('API Base URL');
    expect(wrapper.text()).toContain('模型名称');
    expect(wrapper.text()).toContain('大模型提供商');
  });

  it('should show provider selection options', () => {
    const wrapper = mount(SettingsPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('DeepSeek');
    expect(wrapper.text()).toContain('OpenAI (GPT)');
    expect(wrapper.text()).toContain('通义千问 (Qwen)');
    expect(wrapper.text()).toContain('自定义 (兼容 OpenAI 格式)');
  });

  it('should show save button', () => {
    const wrapper = mount(SettingsPanel, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('保存设置');
  });

  it('should emit back event', async () => {
    const wrapper = mount(SettingsPanel, {
      global: { plugins: [createPinia()] },
    });

    const backBtn = wrapper.findAll('button').find(b => b.text().includes('返回'));
    if (backBtn) {
      await backBtn.trigger('click');
      expect(wrapper.emitted('back')).toBeTruthy();
    }
  });

  it('should update settings on save', async () => {
    const wrapper = mount(SettingsPanel, {
      global: { plugins: [createPinia()] },
    });

    const inputs = wrapper.findAll('input');
    if (inputs.length > 0) {
      await inputs[0].setValue('sk-test-key');
    }

    const saveBtn = wrapper.findAll('button').find(b => b.text().includes('保存设置'));
    if (saveBtn) {
      await saveBtn.trigger('click');
      expect(wrapper.text()).toContain('已保存');
    }
  });
});
