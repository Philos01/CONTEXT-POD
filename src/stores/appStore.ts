import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { AppSettings, LLMProvider, WorkflowStage } from '@/types';

const STORAGE_KEY = 'context-pod-settings';

const defaultSettings: AppSettings = {
  provider: 'deepseek',
  apiKey: '',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  shortcutKey: 'Alt+Space',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  theme: 'light',
};

const providerDefaults: Record<LLMProvider, Partial<AppSettings>> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-max',
  },
  custom: {
    baseUrl: '',
    model: '',
  },
};

function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaultSettings, ...parsed };
    }
  } catch {
    // ignore
  }
  return defaultSettings;
}

export const useAppStore = defineStore('app', () => {
  const settings = ref<AppSettings>(loadSettings());
  const isInitialized = ref(false);
  const workflowStage = ref<WorkflowStage>('idle');
  const workflowMessage = ref('');

  const isConfigured = computed(() => !!settings.value.apiKey);

  function updateSettings(partial: Partial<AppSettings>) {
    if (partial.provider && partial.provider !== settings.value.provider) {
      const defaults = providerDefaults[partial.provider];
      settings.value = { ...settings.value, ...partial, ...defaults };
    } else {
      settings.value = { ...settings.value, ...partial };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
  }

  function setWorkflowStage(stage: typeof workflowStage.value, message: string = '') {
    workflowStage.value = stage;
    workflowMessage.value = message;
  }

  return {
    settings,
    isInitialized,
    workflowStage,
    workflowMessage,
    isConfigured,
    updateSettings,
    setWorkflowStage,
  };
});
