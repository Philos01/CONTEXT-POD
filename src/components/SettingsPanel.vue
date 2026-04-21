<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAppStore } from '@/stores/appStore';
import type { LLMProvider } from '@/types';

const appStore = useAppStore();

const provider = ref<LLMProvider>('deepseek');
const apiKey = ref('');
const baseUrl = ref('');
const model = ref('');
const shortcutKey = ref('');
const saved = ref(false);

const providerOptions: { value: LLMProvider; label: string }[] = [
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openai', label: 'OpenAI (GPT)' },
  { value: 'qwen', label: '通义千问 (Qwen)' },
  { value: 'custom', label: '自定义 (兼容 OpenAI 格式)' },
];

onMounted(() => {
  provider.value = appStore.settings.provider;
  apiKey.value = appStore.settings.apiKey;
  baseUrl.value = appStore.settings.baseUrl;
  model.value = appStore.settings.model;
  shortcutKey.value = appStore.settings.shortcutKey;
});

function handleSave() {
  appStore.updateSettings({
    apiKey: apiKey.value.trim(),
    baseUrl: baseUrl.value.trim(),
    model: model.value.trim(),
    shortcutKey: shortcutKey.value.trim(),
  });
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 2000);
}
</script>

<template>
  <div class="px-5 py-5 flex-1 space-y-4">
    <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <label class="block text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--text-primary);">
        <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        大模型提供商
      </label>
      <select
        v-model="provider"
        class="input-field"
      >
        <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

    <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <label class="block text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--text-primary);">
        <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        API Key
      </label>
      <input
        v-model="apiKey"
        type="password"
        placeholder="sk-..."
        class="input-field"
      />
    </div>

    <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <label class="block text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--text-primary);">
        <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
        API Base URL
      </label>
      <input
        v-model="baseUrl"
        type="text"
        :placeholder="
          provider === 'deepseek' ? 'https://api.deepseek.com' :
          provider === 'openai' ? 'https://api.openai.com/v1' :
          provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' :
          '输入您的API地址'
        "
        class="input-field"
      />
    </div>

    <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <label class="block text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--text-primary);">
        <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        模型名称
      </label>
      <input
        v-model="model"
        type="text"
        :placeholder="
          provider === 'deepseek' ? 'deepseek-chat' :
          provider === 'openai' ? 'gpt-4o-mini' :
          provider === 'qwen' ? 'qwen-max' :
          '输入模型名称'
        "
        class="input-field"
      />
    </div>

    <div class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <label class="block text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--text-primary);">
        <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100 4m0-4a2 2 0 110 4m0 0v6m0-6v6m6-6v6m-6-6v6" />
        </svg>
        快捷键
      </label>
      <input
        v-model="shortcutKey"
        type="text"
        placeholder="Alt+Space"
        class="input-field"
      />
    </div>

    <button
      @click="handleSave"
      class="btn-primary w-full"
      :class="{ 'bg-emerald-600 hover:bg-emerald-500': saved }"
    >
      <svg v-if="saved" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{ saved ? '已保存' : '保存设置' }}
    </button>

    <div class="text-center pt-2">
      <p class="text-xs" style="color: var(--text-tertiary);">
        Context-Pod v0.1.0 · 数据全部本地存储 · 零隐私泄露风险
      </p>
    </div>
  </div>
</template>
