<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAppStore } from '@/stores/appStore';
import type { LLMProvider } from '@/types';

const emit = defineEmits<{
  back: [];
}>();

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

watch(provider, (newProvider) => {
  appStore.updateSettings({ provider: newProvider });
  apiKey.value = appStore.settings.apiKey;
  baseUrl.value = appStore.settings.baseUrl;
  model.value = appStore.settings.model;
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
  <div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <button @click="emit('back')" class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h3 class="text-sm font-medium text-gray-700">设置</h3>
      <div class="w-10"></div>
    </div>

    <div class="space-y-3">
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">大模型提供商</label>
        <select
          v-model="provider"
          class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        >
          <option v-for="opt in providerOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">API Key *</label>
        <input
          v-model="apiKey"
          type="password"
          placeholder="sk-..."
          class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">API Base URL</label>
        <input
          v-model="baseUrl"
          type="text"
          :placeholder="
            provider === 'deepseek' ? 'https://api.deepseek.com' :
            provider === 'openai' ? 'https://api.openai.com/v1' :
            provider === 'qwen' ? 'https://dashscope.aliyuncs.com/compatible-mode/v1' :
            '输入您的API地址'
          "
          class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">模型名称</label>
        <input
          v-model="model"
          type="text"
          :placeholder="
            provider === 'deepseek' ? 'deepseek-chat' :
            provider === 'openai' ? 'gpt-4o-mini' :
            provider === 'qwen' ? 'qwen-max' :
            '输入模型名称'
          "
          class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
      </div>

      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">快捷键</label>
        <input
          v-model="shortcutKey"
          type="text"
          placeholder="Alt+Space"
          class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
        />
      </div>

      <button
        @click="handleSave"
        class="w-full py-2.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        :class="{ 'bg-emerald-500 hover:bg-emerald-600': saved }"
      >
        {{ saved ? '已保存 ✓' : '保存设置' }}
      </button>

      <div class="pt-2 border-t border-gray-100">
        <p class="text-[10px] text-gray-400 leading-relaxed">
          Context-Pod v0.1.0 · 数据全部本地存储 · 零隐私泄露风险
        </p>
      </div>
    </div>
  </div>
</template>
