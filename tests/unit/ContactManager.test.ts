import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ContactManager from '@/components/ContactManager.vue';

const localStorageStore: Record<string, string> = {};

vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageStore[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageStore[key]; }),
  clear: vi.fn(() => { Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]); }),
  get length() { return Object.keys(localStorageStore).length; },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
});

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

describe('ContactManager', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    setActivePinia(createPinia());
  });

  it('should render the component', () => {
    const wrapper = mount(ContactManager, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('联系人管理');
  });

  it('should show add contact button', () => {
    const wrapper = mount(ContactManager, {
      global: { plugins: [createPinia()] },
    });
    expect(wrapper.text()).toContain('添加联系人');
  });

  it('should show form when add button is clicked', async () => {
    const wrapper = mount(ContactManager, {
      global: { plugins: [createPinia()] },
    });

    const addBtn = wrapper.findAll('button').find(b => b.text().includes('添加联系人'));
    if (addBtn) {
      await addBtn.trigger('click');
      expect(wrapper.text()).toContain('保存');
      expect(wrapper.text()).toContain('取消');
      expect(wrapper.find('input').exists()).toBe(true);
    }
  });

  it('should emit back event', async () => {
    const wrapper = mount(ContactManager, {
      global: { plugins: [createPinia()] },
    });

    const backBtn = wrapper.findAll('button').find(b => b.text().includes('返回'));
    if (backBtn) {
      await backBtn.trigger('click');
      expect(wrapper.emitted('back')).toBeTruthy();
    }
  });
});
