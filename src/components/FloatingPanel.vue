<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useCapture } from '@/composables/useCapture';
import { useWindowManager } from '@/composables/useWindowManager';
import { useAppStore } from '@/stores/appStore';
import { useContactStore } from '@/stores/contactStore';
import { runWorkflowStream, clearHistory, getHistory } from '@/services/agentWorkflow';
import { getClient } from '@/services/llmService';
import {
  startIdleDetector,
  stopIdleDetector,
  getEvolutionStatus,
  onEvolutionStatusChange,
  saveUserReply,
  pushToBuffer,
  type EvolutionStatus
} from '@/services/evolutionEngine';
import ReplyCard from './ReplyCard.vue';
import ContactManager from './ContactManager.vue';
import SettingsPanel from './SettingsPanel.vue';
import StyleExtractor from './StyleExtractor.vue';
import PersonaQuiz from './PersonaQuiz.vue';
import PromptManager from './PromptManager.vue';
import LogViewer from './LogViewer.vue';
import EvolutionTest from './EvolutionTest.vue';
import DiagnosticTest from './DiagnosticTest.vue';
import CustomAlert from './CustomAlert.vue';
import type { ReplyStrategy, AgentState, TacticalGoal } from '@/types';
import { CONVERSATION_PHASE_LABELS, TACTICAL_GOAL_LABELS } from '@/types';
import { getPhaseStrategyHint } from '@/services/conversationStateEngine';
import { alertService } from '@/services/alertService';
import { isTauri, isMobile } from '@/utils/platform';

const isMobileDevice = isMobile();

const appStore = useAppStore();
const contactStore = useContactStore();
const { initShortcut, cleanupShortcut, isRegistered, lastError, manualCapture } = useCapture();
useWindowManager();

const rawContext = ref('');
const manualInputText = ref('');
const strategies = ref<ReplyStrategy[]>([]);
const streamingText = ref('');
const isWorking = ref(false);
const activeTab = ref<'main' | 'contacts' | 'settings' | 'style-extractor' | 'persona-quiz' | 'prompt-manager' | 'log-viewer' | 'evolution-test' | 'diagnostic-test'>('main');
const agentResult = ref<AgentState | null>(null);
const manualContactName = ref('');
const manualContactIdentity = ref('');
const showContactPicker = ref(false);
const selectedTacticalGoal = ref<TacticalGoal>('stabilize');
const lastSelectedStrategy = ref<string>('');
const historyCount = computed(() => getHistory().length);
const personaCount = computed(() => {
  const dynamicPersonas = localStorage.getItem('context-pod-dynamic-personas');
  const contactNames = contactStore.contacts.map(c => c.name);
  let count = 0;
  
  if (dynamicPersonas) {
    const dynamicPersonaData = JSON.parse(dynamicPersonas);
    const personaKeys = Object.keys(dynamicPersonaData);
    // 计算所有有效的动态人物画像（包括"自我"和联系人）
    count = personaKeys.filter(name => {
      // 包含"自我"风格和所有联系人
      return name === '自我' || contactNames.includes(name);
    }).length;
  }
  
  return count;
});
const evolutionStatus = ref<EvolutionStatus>(getEvolutionStatus());
const contactManagerRef = ref<any>(null);

const showCustomReply = ref(false);
const customReplyText = ref('');
const isSavingReply = ref(false);

let unsubscribeEvolution: (() => void) | null = null;

const stageMessages: Record<string, string> = {
  idle: '',
  capturing: '正在抓取上下文...',
  extracting: '正在识别对话对象...',
  classifying: '正在分析对话局势...',
  evaluating: '正在复盘历史策略...',
  retrieving: '正在检索记忆档案...',
  generating: '正在推演回复策略...',
  ready: '推演完成',
};

const isSubPage = computed(() => activeTab.value !== 'main');

const tabTitles: Record<string, string> = {
  contacts: '联系人管理',
  settings: '设置',
  'style-extractor': '风格提取',
  'persona-quiz': '赛博捏脸',
  'prompt-manager': '提示词管理',
  'log-viewer': '系统日志',
  'evolution-test': '进化测试',
  'diagnostic-test': '风格诊断',
};

onMounted(async () => {
  console.log('[Context-Pod] App mounted, initializing...');
  
  console.log('[Context-Pod] Step 1: Initializing shortcut...');
  await initShortcut(handleCapture);
  console.log('[Context-Pod] Step 1 done: Shortcut initialized');
  
  console.log('[Context-Pod] Step 2: Initializing database...');
  contactStore.initDb().catch(e => {
    console.error('[Context-Pod] Database init failed (non-blocking):', e);
  });

  console.log('[Context-Pod] Step 3: Starting idle detector...');
  startIdleDetector(appStore.settings);
  
  unsubscribeEvolution = onEvolutionStatusChange((status) => {
    evolutionStatus.value = status;
  });
  
  if (!appStore.isConfigured) {
    console.log('[Context-Pod] API Key not configured, please go to Settings');
    activeTab.value = 'settings';
  } else {
    console.log('[Context-Pod] Step 4: Preloading LLM client...');
    try {
      getClient(appStore.settings);
      console.log('[Context-Pod] LLM client preloaded');
    } catch (e) {
      console.error('[Context-Pod] LLM client preload failed (non-blocking):', e);
    }
  }
});

onUnmounted(async () => {
  await cleanupShortcut();
  stopIdleDetector();
  if (unsubscribeEvolution) {
    unsubscribeEvolution();
    unsubscribeEvolution = null;
  }
});

async function handleCapture(result: { text: string }) {
  if (!appStore.isConfigured) {
    activeTab.value = 'settings';
    return;
  }

  if (!result.text || result.text.trim().length === 0) {
    streamingText.value = '剪贴板为空';
    setTimeout(() => { streamingText.value = ''; }, 3000);
    return;
  }

  rawContext.value = result.text;
  isWorking.value = false;
  strategies.value = [];
  streamingText.value = '';
  activeTab.value = 'main';

  showContactPicker.value = true;
  streamingText.value = '请选择或输入联系人';
}

async function handleManualCapture() {
  if (!manualInputText.value.trim()) {
    alertService.warning('请输入对话内容');
    return;
  }
  
  const result = await manualCapture(manualInputText.value);
  if (result) {
    rawContext.value = result.text;
    manualInputText.value = '';
    isWorking.value = false;
    strategies.value = [];
    streamingText.value = '';
    activeTab.value = 'main';
    showContactPicker.value = true;
    streamingText.value = '请选择或输入联系人';
  }
}

async function executeWorkflow(text: string, overrideName?: string, overrideIdentity?: string) {
  isWorking.value = true;
  showContactPicker.value = false;

  try {
    const contactName = overrideName || manualContactName.value;
    const contactIdentity = overrideIdentity || manualContactIdentity.value;
    
    const workflowText = overrideName && !text.includes(overrideName)
      ? `${overrideName}: [消息]\n${text}`
      : text;

    const state = await runWorkflowStream(
      workflowText,
      appStore.settings,
      (stage, message) => {
        appStore.setWorkflowStage(stage as any, message);
        streamingText.value = stageMessages[stage] || message;
      },
      selectedTacticalGoal.value,
      contactName,
      contactIdentity
    );

    agentResult.value = state;
    strategies.value = state.strategies;
  } catch (error) {
    streamingText.value = '推演失败，请重试';
    console.error(error);
  } finally {
    isWorking.value = false;
    appStore.setWorkflowStage('idle');
  }
}

function skipContactSelection() {
  showContactPicker.value = false;
  executeWorkflow(rawContext.value);
}

async function injectToChat(selectedReply: string) {
  try {
    lastSelectedStrategy.value = selectedReply;

    pushToBuffer('自我', selectedReply, 'user');

    if (isTauri) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(selectedReply);
    } else {
      await navigator.clipboard.writeText(selectedReply);
    }
  } catch (error) {
    console.error('Copy failed:', error);
  }
}

function resetToIdle() {
  strategies.value = [];
  agentResult.value = null;
  rawContext.value = '';
  streamingText.value = '';
  isWorking.value = false;
  showContactPicker.value = false;
  manualContactName.value = '';
  manualContactIdentity.value = '';
  activeTab.value = 'main';
  console.log('[Context-Pod] Reset to idle state');
}

function selectExistingContact(name: string, identity?: string) {
  manualContactName.value = name;
  manualContactIdentity.value = identity || '';
  showContactPicker.value = false;
  executeWorkflow(rawContext.value, name, identity);
}

function submitManualContact() {
  if (manualContactName.value.trim()) {
    showContactPicker.value = false;
    executeWorkflow(rawContext.value, manualContactName.value.trim(), manualContactIdentity.value.trim());
  }
}

function toggleCustomReply() {
  showCustomReply.value = !showCustomReply.value;
  if (showCustomReply.value) {
    customReplyText.value = '';
  }
}

function saveCustomReply(_modelReply: string) {
  if (!customReplyText.value.trim() || !agentResult.value) {
    return;
  }

  isSavingReply.value = true;
  try {
    const contactName = agentResult.value.targetPerson;
    
    console.log('[Context-Pod] Saving user custom reply...');
    
    const combinedText = `${rawContext.value}\n我: ${customReplyText.value}`;
    saveUserReply(combinedText, contactName, customReplyText.value);
    
    // 保存到赛博捏脸对话缓存
    pushToBuffer('自我', customReplyText.value, 'user');
    
    alertService.success('回复已保存！当积累足够数据后，系统会在闲时自动学习您的风格。');
    
    customReplyText.value = '';
    showCustomReply.value = false;
  } catch (error) {
    console.error('[Context-Pod] Save failed:', error);
    alertService.error('保存失败，请稍后重试');
  } finally {
    isSavingReply.value = false;
  }
}

function handleClearHistory() {
  clearHistory();
  console.log('[Context-Pod] Conversation history cleared');
}

async function minimizeToTray() {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (error) {
    console.error('Minimize failed:', error);
  }
}

async function closeWindow() {
  if (!isTauri) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.hide();
  } catch (error) {
    console.error('Close failed:', error);
  }
}

function setTacticalGoalAndExecute(key: string) {
  selectedTacticalGoal.value = key as TacticalGoal;
  executeWorkflow(rawContext.value);
}

function goBack() {
  activeTab.value = 'main';
}
</script>

<template>
  <div class="glass-panel w-full h-full overflow-hidden flex flex-col" data-tauri-drag-region>
    <div class="flex items-center justify-between px-5 py-4 border-b" style="border-color: var(--border-light);" data-tauri-drag-region>
      <div class="flex items-center gap-3 cursor-default">
        <button
          v-if="isSubPage"
          @click="goBack"
          class="icon-btn"
          title="返回主页"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div class="w-2 h-2 rounded-full" :class="isWorking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></div>
        <span class="text-sm font-semibold tracking-tight" style="color: var(--text-primary);">{{ isSubPage ? tabTitles[activeTab] || '详情' : 'Context Pod' }}</span>
      </div>
      <div class="flex items-center gap-0.5" data-tauri-drag-region="false">
        <button
          v-if="historyCount > 0"
          @click="handleClearHistory"
          class="icon-btn"
          title="清除对话历史"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button
          v-if="!isSubPage"
          @click="activeTab = 'contacts'"
          class="icon-btn"
          title="联系人管理"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          v-if="!isSubPage"
          @click="activeTab = 'settings'"
          class="icon-btn"
          title="设置"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          v-if="isTauri && !isMobileDevice"
          @click="minimizeToTray"
          class="icon-btn"
          title="最小化到托盘"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12H4" />
          </svg>
        </button>
        <button
          v-if="isTauri && !isMobileDevice"
          @click="closeWindow"
          class="icon-btn hover:text-red-500 hover:bg-red-50"
          title="关闭"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <div v-if="activeTab === 'main'" class="flex-1 overflow-auto">
      <div class="px-5 py-5">
      <div v-if="!isWorking && strategies.length === 0 && !showContactPicker" class="space-y-5">
        <div class="text-center py-6">
          <div class="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center" style="background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%); border: 1px solid var(--border-light);">
            <svg class="w-7 h-7" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 class="text-base font-semibold mb-1" style="color: var(--text-primary);">准备就绪</h2>
          <p class="text-sm" style="color: var(--text-tertiary);">等待您的下一个对话</p>
        </div>

        <div v-if="isMobileDevice" class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
          <p class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
            <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            输入对话内容
          </p>
          <textarea
            v-model="manualInputText"
            placeholder="粘贴或输入对话内容，例如：&#10;张三: 明天下午开会吗？&#10;我: 是的，三点开始"
            class="input-field resize-none"
            rows="4"
          ></textarea>
          <button
            @click="handleManualCapture"
            :disabled="!manualInputText.trim()"
            class="btn-primary w-full mt-3"
          >
            开始推演
          </button>
        </div>

        <div v-if="!isMobileDevice" class="flex items-center justify-between p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
          <span class="text-sm font-medium flex items-center gap-2" style="color: var(--text-secondary);">
            <svg class="w-4 h-4" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            快捷键状态
          </span>
          <span class="text-xs px-2.5 py-1 rounded-lg font-medium" :class="isRegistered ? 'badge-success' : 'badge-error'">
            {{ isRegistered ? '已连接' : '未连接' }} {{ appStore.settings.shortcutKey }}
          </span>
        </div>

        <div v-if="lastError" class="p-4 rounded-xl" style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.12);">
          <div class="flex items-center gap-2 mb-2">
            <svg class="w-4 h-4" style="color: #dc2626;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span class="text-sm font-medium" style="color: #dc2626;">错误详情</span>
          </div>
          <p class="text-xs" style="color: #dc2626; word-break: break-all;">{{ lastError }}</p>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <button
            @click="activeTab = 'style-extractor'"
            class="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200"
            style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.1) 0%, rgba(139, 115, 85, 0.05) 100%);">
              <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium" style="color: var(--text-primary);">提取风格</p>
              <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">学习语气</p>
            </div>
          </button>

          <button
            @click="activeTab = 'persona-quiz'"
            class="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200"
            style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.08) 0%, rgba(139, 115, 85, 0.04) 100%);">
              <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium" style="color: var(--text-primary);">赛博捏脸</p>
              <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">定义人设</p>
            </div>
          </button>

          <button
            @click="activeTab = 'prompt-manager'"
            class="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200"
            style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.06) 0%, rgba(139, 115, 85, 0.03) 100%);">
              <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium" style="color: var(--text-primary);">提示词</p>
              <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">自定义配置</p>
            </div>
          </button>

          <button
            @click="activeTab = 'log-viewer'"
            class="group flex flex-col items-center gap-3 p-5 rounded-2xl transition-all duration-200"
            style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
          >
            <div class="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.04) 0%, rgba(139, 115, 85, 0.02) 100%);">
              <svg class="w-5 h-5" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div class="text-center">
              <p class="text-sm font-medium" style="color: var(--text-primary);">系统日志</p>
              <p class="text-xs mt-0.5" style="color: var(--text-tertiary);">查看记录</p>
            </div>
          </button>
        </div>

        <div v-if="personaCount > 0" class="flex items-center gap-3 p-4 rounded-xl" style="background: rgba(34, 197, 94, 0.06); border: 1px solid rgba(34, 197, 94, 0.1);">
          <svg class="w-5 h-5 flex-shrink-0" style="color: #16a34a;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span class="text-sm font-medium" style="color: #16a34a;">已建立 {{ personaCount }} 个风格画像</span>
        </div>

        <div v-if="!isTauri && !isMobileDevice" class="flex items-center gap-3 p-4 rounded-xl" style="background: rgba(139, 115, 85, 0.06); border: 1px solid rgba(139, 115, 85, 0.1);">
          <svg class="w-5 h-5 flex-shrink-0" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
          </svg>
          <div>
            <p class="text-sm font-medium" style="color: var(--text-primary);">浏览器测试模式</p>
            <p class="text-xs mt-0.5" style="color: var(--text-secondary);">按 {{ appStore.settings.shortcutKey }} 模拟快捷键</p>
          </div>
        </div>

        <div v-if="isMobileDevice" class="flex items-center gap-3 p-4 rounded-xl" style="background: rgba(139, 115, 85, 0.06); border: 1px solid rgba(139, 115, 85, 0.1);">
          <svg class="w-5 h-5 flex-shrink-0" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <div>
            <p class="text-sm font-medium" style="color: var(--text-primary);">移动端模式</p>
            <p class="text-xs mt-0.5" style="color: var(--text-secondary);">在上方输入对话内容开始使用</p>
          </div>
        </div>

        <div v-if="!appStore.isConfigured && isTauri" class="p-4 rounded-xl" style="background: rgba(234, 179, 8, 0.06); border: 1px solid rgba(234, 179, 8, 0.1);">
          <div class="flex items-start gap-3">
            <svg class="w-5 h-5 flex-shrink-0 mt-0.5" style="color: #ca8a04;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div class="flex-1">
              <p class="text-sm font-semibold mb-2" style="color: #92400e;">首次使用请先配置</p>
              <button 
                @click="activeTab = 'settings'"
                class="btn-primary w-full"
              >
                前往设置
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showContactPicker" class="space-y-5">
        <button
          @click="showContactPicker = false; resetToIdle()"
          class="flex items-center gap-2 text-sm transition-colors"
          style="color: var(--text-secondary);"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
          </svg>
          返回首页
        </button>

        <div class="text-center py-4">
          <div class="w-14 h-14 mx-auto mb-3 rounded-2xl flex items-center justify-center" style="background: var(--bg-tertiary); border: 1px solid var(--border-light);">
            <svg class="w-6 h-6" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h3 class="text-base font-semibold mb-1" style="color: var(--text-primary);">选择联系人</h3>
          <p class="text-sm" style="color: var(--text-tertiary);">请选择或输入对话对象的名称</p>
        </div>

        <div v-if="contactStore.contacts.length > 0" class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
          <p class="text-sm font-medium mb-3" style="color: var(--text-secondary);">已有联系人</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="contact in contactStore.contacts"
              :key="contact.id"
              @click="selectExistingContact(contact.name, (contact as any).identity)"
              class="px-4 py-2 text-sm rounded-xl transition-all duration-200 font-medium"
              style="background: white; border: 1px solid var(--border-subtle); color: var(--text-primary);"
            >
              {{ contact.name }}
              <span v-if="(contact as any).identity" class="text-xs opacity-60 ml-1">({{ (contact as any).identity }})</span>
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <p class="text-sm font-medium" style="color: var(--text-secondary);">或手动输入</p>
          <div class="flex gap-2">
            <input
              v-model="manualContactName"
              type="text"
              placeholder="输入联系人名称"
              class="input-field"
              @keyup.enter="submitManualContact"
            />
            <button
              @click="submitManualContact"
              class="btn-primary px-6"
            >
              确认
            </button>
          </div>
          <input
            v-model="manualContactIdentity"
            type="text"
            placeholder="对方身份（可选）例：相亲对象、客户、同事"
            class="input-field"
            @keyup.enter="submitManualContact"
          />
        </div>

        <button
          @click="skipContactSelection"
          class="w-full py-3 text-sm rounded-xl transition-colors font-medium"
          style="background: var(--bg-tertiary); color: var(--text-secondary);"
        >
          跳过，使用通用回复
        </button>
      </div>

      <div v-if="isWorking" class="py-12 text-center">
        <div class="inline-flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl flex items-center justify-center" style="background: linear-gradient(135deg, rgba(139, 115, 85, 0.1) 0%, rgba(139, 115, 85, 0.05) 100%);">
            <svg class="w-4 h-4 animate-spin-slow" style="color: var(--accent-warm);" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <span class="text-sm font-medium" style="color: var(--text-secondary);">{{ streamingText }}</span>
        </div>
      </div>

      <div v-if="!isWorking && strategies.length > 0" class="space-y-4">
        <button
          @click="resetToIdle"
          class="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl transition-all duration-200 text-sm font-medium"
          style="background: var(--bg-tertiary); color: var(--text-secondary);"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          返回首页
        </button>

        <div v-if="agentResult" class="p-4 rounded-2xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl flex items-center justify-center" style="background: white; border: 1px solid var(--border-subtle);">
                <svg class="w-4 h-4" style="color: var(--accent-warm);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <p class="text-xs font-medium" style="color: var(--text-tertiary);">对话对象</p>
                <p class="text-base font-semibold" style="color: var(--text-primary);">{{ agentResult.targetPerson }}</p>
              </div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 mb-3">
            <span class="badge" style="background: rgba(139, 115, 85, 0.08); color: var(--accent-warm);">
              {{ CONVERSATION_PHASE_LABELS[agentResult.conversationPhase] || agentResult.conversationPhase }}
            </span>
            <span class="badge">
              {{ TACTICAL_GOAL_LABELS[agentResult.tacticalGoal] || agentResult.tacticalGoal }}
            </span>
          </div>
          <p class="text-sm leading-relaxed" style="color: var(--text-secondary);">
            {{ getPhaseStrategyHint(agentResult.conversationPhase) }}
          </p>
          <div v-if="agentResult.memoryData !== '暂无此人记录'" class="mt-3 pt-3" style="border-top: 1px solid var(--border-light);">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p class="text-xs truncate" style="color: var(--text-secondary);">记忆：{{ agentResult.memoryData }}</p>
            </div>
          </div>
          <div v-if="historyCount > 0" class="mt-2">
            <div class="flex items-start gap-2">
              <svg class="w-4 h-4 mt-0.5 flex-shrink-0" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <p class="text-xs" style="color: var(--text-tertiary);">已结合 {{ historyCount }} 条历史对话</p>
            </div>
          </div>
        </div>

        <div class="p-4 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
          <p class="text-sm font-medium mb-3 flex items-center gap-2" style="color: var(--text-secondary);">
            <svg class="w-4 h-4" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            切换战略目标
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(label, key) in TACTICAL_GOAL_LABELS"
              :key="key"
              @click="setTacticalGoalAndExecute(key)"
              class="px-3 py-1.5 text-sm rounded-lg transition-all duration-200 font-medium"
              :class="selectedTacticalGoal === key ? 'btn-primary' : 'btn-secondary'"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div class="space-y-3">
          <ReplyCard
            v-for="(strategy, index) in strategies"
            :key="index"
            :strategy="strategy"
            :index="index"
            @select="injectToChat"
          />
        </div>

        <div class="pt-2">
          <button
            @click="toggleCustomReply"
            class="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium"
            :style="showCustomReply ? 'background: var(--bg-tertiary); color: var(--text-secondary);' : 'background: var(--bg-secondary); border: 1px solid var(--border-light); color: var(--text-secondary);'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!showCustomReply" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12H4" />
            </svg>
            {{ showCustomReply ? '收起自定义回复' : '添加自己的回复，让系统学习您的风格' }}
          </button>

          <div v-if="showCustomReply" class="mt-3 space-y-3">
            <div class="p-4 rounded-xl" style="background: rgba(234, 179, 8, 0.06); border: 1px solid rgba(234, 179, 8, 0.1);">
              <div class="flex items-center gap-2 mb-1">
                <svg class="w-4 h-4" style="color: #ca8a04;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p class="text-sm font-medium" style="color: #92400e;">隐私保护</p>
              </div>
              <p class="text-xs" style="color: #92400e;">您的回复将只保存在本地用于学习您的回复风格，不会发送到任何服务器。</p>
            </div>

            <textarea
              v-model="customReplyText"
              placeholder="输入您想要的回复内容..."
              class="input-field resize-none"
              rows="3"
            ></textarea>

            <button
              @click="saveCustomReply(strategies[0]?.content || '')"
              :disabled="!customReplyText.trim() || isSavingReply"
              class="btn-primary w-full"
            >
              <svg v-if="isSavingReply" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isSavingReply ? '保存中...' : '保存并学习我的风格' }}
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>

    <div v-if="activeTab === 'contacts'" class="flex-1 flex flex-col overflow-auto">
      <ContactManager
        ref="contactManagerRef"
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'settings'" class="flex-1 flex flex-col overflow-auto">
      <SettingsPanel
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'style-extractor'" class="flex-1 flex flex-col overflow-auto">
      <StyleExtractor
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'persona-quiz'" class="flex-1 flex flex-col overflow-auto">
      <PersonaQuiz
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'prompt-manager'" class="flex-1 flex flex-col overflow-auto">
      <PromptManager
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'log-viewer'" class="flex-1 flex flex-col overflow-auto">
      <LogViewer
        @back="goBack"
      />
    </div>

    <div v-if="activeTab === 'evolution-test'" class="flex-1 flex flex-col overflow-auto">
      <EvolutionTest @back="goBack" />
    </div>

    <div v-if="activeTab === 'diagnostic-test'" class="flex-1 flex flex-col overflow-auto">
      <DiagnosticTest @back="goBack" />
    </div>

    <!-- 自定义提示框 -->
    <CustomAlert
      :show="alertService.isVisibleRef.value"
      :message="alertService.options.message"
      :title="alertService.options.title"
      :type="alertService.options.type"
      :confirm-text="alertService.options.confirmText"
      :cancel-text="alertService.options.cancelText"
      @close="alertService.close()"
      @confirm="alertService.confirm()"
    />
  </div>
</template>
