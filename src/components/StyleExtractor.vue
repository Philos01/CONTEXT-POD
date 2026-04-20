<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useContactStore } from '@/stores/contactStore';
import { extractStyleFromChat, savePersona } from '@/services/personaService';
import type { StylePersona } from '@/types';

const emit = defineEmits<{
  back: [];
}>();

const appStore = useAppStore();
const contactStore = useContactStore();

const step = ref<'input' | 'extracting' | 'result'>('input');
const chatInput = ref('');
const selectedContact = ref('');
const newContactName = ref('');
const extractedPersona = ref<StylePersona | null>(null);
const error = ref('');

const contacts = contactStore.contacts;

async function startExtraction() {
  if (!chatInput.value.trim()) {
    error.value = '请粘贴聊天记录';
    return;
  }

  if (!selectedContact.value && !newContactName.value.trim()) {
    error.value = '请选择或输入联系人名称';
    return;
  }

  if (!appStore.isConfigured) {
    error.value = '请先在设置中配置 API Key';
    return;
  }

  const contactName = selectedContact.value || newContactName.value.trim();
  step.value = 'extracting';
  error.value = '';

  try {
    const persona = await extractStyleFromChat(chatInput.value, appStore.settings);
    extractedPersona.value = persona;
    savePersona(contactName, persona);
    step.value = 'result';
  } catch (e) {
    error.value = `提取失败: ${e}`;
    step.value = 'input';
  }
}

function goBack() {
  step.value = 'input';
  chatInput.value = '';
  selectedContact.value = '';
  newContactName.value = '';
  extractedPersona.value = null;
  error.value = '';
  emit('back');
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center gap-2 mb-4">
      <button @click="goBack" class="text-gray-400 hover:text-gray-600">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h2 class="text-sm font-medium text-gray-700">🎭 风格提取</h2>
    </div>

    <!-- Step 1: Input -->
    <div v-if="step === 'input'">
      <div class="mb-3">
        <p class="text-xs text-gray-500 mb-2">📋 粘贴聊天记录（10-20条最佳）</p>
        <p class="text-xs text-gray-400 mb-2">在微信中框选对方的聊天记录，Ctrl+C 复制后粘贴到下方</p>
        <textarea
          v-model="chatInput"
          rows="6"
          placeholder="张三: 明天开会吗？&#10;张三: 下午三点&#10;张三: 记得带材料&#10;张三: 收到回复一下~&#10;..."
          class="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
        ></textarea>
      </div>

      <div class="mb-3">
        <p class="text-xs text-gray-500 mb-2">👤 选择联系人</p>
        <div v-if="contacts.length > 0" class="flex flex-wrap gap-1.5 mb-2">
          <button
            v-for="contact in contacts"
            :key="contact.id"
            @click="selectedContact = contact.name; newContactName = ''"
            class="px-2.5 py-1 text-xs rounded-full border transition-colors"
            :class="selectedContact === contact.name ? 'bg-blue-500 text-white border-blue-500' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'"
          >
            {{ contact.name }}
          </button>
        </div>
        <input
          v-model="newContactName"
          type="text"
          placeholder="或输入新联系人名称"
          class="w-full px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
          @input="selectedContact = ''"
        />
      </div>

      <div v-if="error" class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
        {{ error }}
      </div>

      <button
        @click="startExtraction"
        class="w-full py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
      >
        🔍 开始提取风格
      </button>
    </div>

    <!-- Step 2: Extracting -->
    <div v-if="step === 'extracting'" class="py-8 text-center">
      <div class="inline-flex items-center gap-2 text-blue-500">
        <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="text-sm">正在分析聊天风格...</span>
      </div>
      <p class="text-xs text-gray-400 mt-2">AI 正在逆向工程聊天指纹</p>
    </div>

    <!-- Step 3: Result -->
    <div v-if="step === 'result' && extractedPersona" class="space-y-3">
      <div class="text-center mb-3">
        <div class="text-2xl mb-1">✨</div>
        <p class="text-sm font-medium text-gray-700">风格提取完成！</p>
      </div>

      <div class="p-3 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
        <div>
          <span class="text-xs font-medium text-blue-600">断句排版：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.sentenceStyle }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-blue-600">口癖语气：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.catchphrases.join('、') || '无特殊口癖' }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-blue-600">情绪风格：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.emotionLevel }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-blue-600">词汇特征：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.vocabFeatures }}</span>
        </div>
        <div>
          <span class="text-xs font-medium text-blue-600">标点习惯：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.punctuationHabits }}</span>
        </div>
        <div class="pt-1 border-t border-blue-200">
          <span class="text-xs font-medium text-blue-600">风格总结：</span>
          <span class="text-xs text-blue-500">{{ extractedPersona.summary }}</span>
        </div>
      </div>

      <button
        @click="goBack"
        class="w-full py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
      >
        ← 返回
      </button>
    </div>
  </div>
</template>