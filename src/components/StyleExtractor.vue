<script setup lang="ts">
import { ref } from 'vue';
import { useAppStore } from '@/stores/appStore';
import { useContactStore } from '@/stores/contactStore';
import { extractDynamicPersona, saveDynamicPersona } from '@/services/personaService';
import type { DynamicPersonaSchema } from '@/types';

const emit = defineEmits<{
  back: [];
}>();

const appStore = useAppStore();
const contactStore = useContactStore();

const step = ref<'input' | 'extracting' | 'result'>('input');
const chatInput = ref('');
const selectedContact = ref('');
const newContactName = ref('');
const extractedPersona = ref<DynamicPersonaSchema | null>(null);
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
    const persona = await extractDynamicPersona(chatInput.value, contactName, appStore.settings);
    extractedPersona.value = persona;
    saveDynamicPersona(contactName, persona);

    const isNewContact = !selectedContact.value && newContactName.value.trim();
    if (isNewContact) {
      await contactStore.addContact(contactName, persona.summary || '待观察', []);
    }

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
  <div class="px-5 py-5 flex-1">
    <div v-if="step === 'input'" class="space-y-5">
      <div class="space-y-3">
        <div>
          <p class="text-sm font-medium mb-2" style="color: var(--text-primary);">
            <svg class="w-4 h-4 inline-block mr-1.5 -mt-0.5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            粘贴聊天记录
          </p>
          <p class="text-xs mb-3" style="color: var(--text-tertiary);">在微信中框选对方的聊天记录，Ctrl+C 复制后粘贴到下方</p>
          <textarea
            v-model="chatInput"
            rows="6"
            placeholder="张三: 明天开会吗？&#10;张三: 下午三点&#10;张三: 记得带材料&#10;张三: 收到回复一下~&#10;..."
            class="input-field resize-none"
          ></textarea>
        </div>

        <div>
          <p class="text-sm font-medium mb-2" style="color: var(--text-primary);">
            <svg class="w-4 h-4 inline-block mr-1.5 -mt-0.5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            选择联系人
          </p>
          <div v-if="contacts.length > 0" class="flex flex-wrap gap-2 mb-3">
            <button
              v-for="contact in contacts"
              :key="contact.id"
              @click="selectedContact = contact.name; newContactName = ''"
              class="px-3 py-1.5 text-sm rounded-lg transition-all duration-200 font-medium border"
              :class="selectedContact === contact.name ? 'btn-primary' : 'btn-secondary'"
            >
              {{ contact.name }}
            </button>
          </div>
          <input
            v-model="newContactName"
            type="text"
            placeholder="或输入新联系人名称"
            class="input-field"
            @input="selectedContact = ''"
          />
        </div>
      </div>

      <div v-if="error" class="p-4 rounded-xl" style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.12);">
        <p class="text-sm" style="color: #dc2626;">{{ error }}</p>
      </div>

      <button
        @click="startExtraction"
        class="btn-primary w-full"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        开始提取风格
      </button>
    </div>

    <div v-if="step === 'extracting'" class="py-12 text-center">
      <div class="inline-flex flex-col items-center gap-3">
        <div class="w-12 h-12 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.1) 0%, rgba(139, 115, 85, 0.05) 100%);">
          <svg class="w-6 h-6 animate-spin-slow" style="color: var(--accent-warm);" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <span class="text-sm font-medium" style="color: var(--text-secondary);">正在分析聊天风格...</span>
        <span class="text-xs" style="color: var(--text-tertiary);">AI 正在逆向工程聊天指纹</span>
      </div>
    </div>

    <div v-if="step === 'result' && extractedPersona" class="space-y-5">
      <div class="text-center py-4">
        <div class="w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.15) 0%, rgba(139, 115, 85, 0.08) 100%); border: 1px solid rgba(139, 115, 85, 0.2);">
          <svg class="w-7 h-7" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p class="text-base font-semibold" style="color: var(--text-primary);">
          心智画像提取完成
        </p>
      </div>

      <div class="p-4 rounded-2xl space-y-4" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
        <div v-if="extractedPersona.powerIdentity && extractedPersona.powerIdentity.length > 0">
          <p class="text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--accent-warm);">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            权力身份特征
          </p>
          <div v-for="(trait, idx) in extractedPersona.powerIdentity" :key="idx" class="flex items-center gap-2 mb-1">
            <span class="text-sm" style="color: var(--text-secondary);">{{ trait.trait }}</span>
            <span class="text-xs" style="color: var(--text-tertiary);">({{ (trait.confidence * 100).toFixed(0) }}%)</span>
          </div>
        </div>

        <div v-if="extractedPersona.psychologicalNeeds && extractedPersona.psychologicalNeeds.length > 0">
          <p class="text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--accent-warm);">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            核心诉求
          </p>
          <div v-for="(need, idx) in extractedPersona.psychologicalNeeds" :key="idx" class="flex items-center gap-2 mb-1">
            <span class="text-sm" style="color: var(--text-secondary);">{{ need.need }}</span>
            <span class="text-xs" style="color: var(--text-tertiary);">({{ (need.weight * 100).toFixed(0) }}%)</span>
          </div>
        </div>

        <div v-if="extractedPersona.taboos && extractedPersona.taboos.length > 0">
          <p class="text-sm font-medium mb-2 flex items-center gap-2" style="color: #dc2626;">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            沟通禁区
          </p>
          <div v-for="(taboo, idx) in extractedPersona.taboos" :key="idx" class="flex items-center gap-2 mb-1">
            <span class="text-sm" style="color: var(--text-secondary);">{{ taboo.rule }}</span>
            <span class="text-xs" style="color: var(--text-tertiary);">({{ (taboo.riskFactor * 100).toFixed(0) }}%)</span>
          </div>
        </div>

        <div v-if="extractedPersona.textStyle">
          <p class="text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--accent-warm);">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            语用偏好
          </p>
          <p class="text-sm" style="color: var(--text-secondary);">{{ extractedPersona.textStyle }}</p>
        </div>

        <div v-if="typeof extractedPersona.temperature === 'number'">
          <p class="text-sm font-medium mb-2 flex items-center gap-2" style="color: var(--accent-warm);">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            情绪热度
          </p>
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 rounded-full" style="background: var(--bg-tertiary);">
              <div
                class="h-full rounded-full transition-all"
                style="background: var(--accent-warm);"
                :style="{ width: `${(extractedPersona.temperature / 10) * 100}%` }"
              ></div>
            </div>
            <span class="text-sm font-medium" style="color: var(--text-primary);">{{ extractedPersona.temperature }}/10</span>
          </div>
        </div>

        <div v-if="extractedPersona.summary" class="pt-3" style="border-top: 1px solid var(--border-light);">
          <p class="text-sm font-medium mb-1" style="color: var(--accent-warm);">心智画像总结</p>
          <p class="text-sm" style="color: var(--text-secondary);">{{ extractedPersona.summary }}</p>
        </div>
      </div>

      <button
        @click="goBack"
        class="btn-secondary w-full"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
    </div>
  </div>
</template>
