import { describe, it, expect, vi, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

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

import { useContactStore } from '@/stores/contactStore';
import { useAppStore } from '@/stores/appStore';

describe('Integration: Contact Store + App Store', () => {
  beforeEach(() => {
    Object.keys(localStorageStore).forEach(k => delete localStorageStore[k]);
    setActivePinia(createPinia());
  });

  it('should add contact and persist to localStorage', async () => {
    const store = useContactStore();
    const contact = await store.addContact('王总', '脾气急躁', ['领导']);

    expect(store.contacts).toHaveLength(1);
    expect(store.contacts[0].name).toBe('王总');
    expect(store.contactCount).toBe(1);

    const saved = JSON.parse(localStorageStore['context-pod-contacts'] || '[]');
    expect(saved).toHaveLength(1);
  });

  it('should remove contact and update localStorage', async () => {
    const store = useContactStore();
    const contact = await store.addContact('王总', '脾气急躁', ['领导']);

    store.removeContact(contact.id);
    expect(store.contacts).toHaveLength(0);

    const saved = JSON.parse(localStorageStore['context-pod-contacts'] || '[]');
    expect(saved).toHaveLength(0);
  });

  it('should update contact', async () => {
    const store = useContactStore();
    const contact = await store.addContact('王总', '脾气急躁', ['领导']);

    store.updateContact(contact.id, { personality: '温和可亲' });
    expect(store.contacts[0].personality).toBe('温和可亲');
  });

  it('should persist and load app settings', () => {
    const store = useAppStore();

    store.updateSettings({ apiKey: 'sk-test-key' });
    expect(store.settings.apiKey).toBe('sk-test-key');
    expect(store.isConfigured).toBe(true);

    const saved = JSON.parse(localStorageStore['context-pod-settings'] || '{}');
    expect(saved.apiKey).toBe('sk-test-key');
  });

  it('should track workflow stage', () => {
    const store = useAppStore();

    store.setWorkflowStage('generating', '正在推演...');
    expect(store.workflowStage).toBe('generating');
    expect(store.workflowMessage).toBe('正在推演...');

    store.setWorkflowStage('idle');
    expect(store.workflowStage).toBe('idle');
  });
});
