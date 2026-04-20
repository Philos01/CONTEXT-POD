<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useCapture } from '@/composables/useCapture';
import { useWindowManager } from '@/composables/useWindowManager';
import { useAppStore } from '@/stores/appStore';
import { useContactStore } from '@/stores/contactStore';
import { runWorkflowStream, identifyContactAsync, clearHistory, getHistory } from '@/services/agentWorkflow';
import {
  startIdleDetector,
  stopIdleDetector,
  getEvolutionStatus,
  onEvolutionStatusChange,
  saveUserReply,
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
import type { ReplyStrategy, AgentState } from '@/types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const appStore = useAppStore();
const contactStore = useContactStore();
const { initShortcut, cleanupShortcut, isRegistered, lastError } = useCapture();
useWindowManager();

// 记住上一次选择的联系人
let lastSelectedContact = '';

const rawContext = ref('');
const strategies = ref<ReplyStrategy[]>([]);
const streamingText = ref('');
const isWorking = ref(false);
const activeTab = ref<'main' | 'contacts' | 'settings' | 'style-extractor' | 'persona-quiz' | 'prompt-manager' | 'log-viewer' | 'evolution-test'>('main');
const agentResult = ref<AgentState | null>(null);
const identifiedContact = ref<{ name: string; confidence: number; source: string } | null>(null);
const manualContactName = ref('');
const showContactPicker = ref(false);
const historyCount = computed(() => getHistory().length);
const personaCount = computed(() => {
  const personas = localStorage.getItem('context-pod-personas');
  if (!personas) return 0;
  return Object.keys(JSON.parse(personas)).length;
});
const evolutionStatus = ref<EvolutionStatus>(getEvolutionStatus());
const contactManagerRef = ref<any>(null);

// 用户自定义回复相关
const showCustomReply = ref(false);
const customReplyText = ref('');
const isSavingReply = ref(false);

let unsubscribeEvolution: (() => void) | null = null;

const stageMessages: Record<string, string> = {
  idle: '',
  capturing: '正在抓取上下文...',
  extracting: '正在识别对话对象...',
  retrieving: '正在检索记忆档案...',
  generating: '正在推演回复策略...',
  ready: '推演完成',
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
    console.log('[Context-Pod] ⚠️ API Key not configured, please go to Settings');
    activeTab.value = 'settings';
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

watch(activeTab, (newTab) => {
  if (newTab === 'contacts' && contactManagerRef.value) {
    contactManagerRef.value.refreshAllBufferCounts();
  }
});

async function handleCapture(result: { text: string }) {
  if (!appStore.isConfigured) {
    activeTab.value = 'settings';
    return;
  }

  if (!result.text || result.text.trim().length === 0) {
    streamingText.value = '剪贴板为空！请先选中文字并 Ctrl+C 复制';
    setTimeout(() => { streamingText.value = ''; }, 3000);
    return;
  }

  rawContext.value = result.text;
  isWorking.value = true;
  strategies.value = [];
  streamingText.value = '';
  activeTab.value = 'main';

  const identification = await identifyContactAsync(result.text);
  identifiedContact.value = identification;
  console.log(`[Context-Pod] Contact identified:`, identification);

  // 如果识别失败，但有记住的联系人，直接使用
  if (identification.name === '未知联系人') {
    if (lastSelectedContact) {
      console.log(`[Context-Pod] Using remembered contact: ${lastSelectedContact}`);
      await executeWorkflow(result.text, lastSelectedContact);
      return;
    }
    showContactPicker.value = true;
    isWorking.value = false;
    streamingText.value = '请选择或输入联系人';
    return;
  }

  await executeWorkflow(result.text);
}

async function executeWorkflow(text: string, overrideName?: string) {
  isWorking.value = true;
  showContactPicker.value = false;

  try {
    const workflowText = overrideName && !text.includes(overrideName)
      ? `${overrideName}: [消息]\n${text}`
      : text;

    const state = await runWorkflowStream(
      workflowText,
      appStore.settings,
      (stage, message) => {
        appStore.setWorkflowStage(stage as any, message);
        streamingText.value = stageMessages[stage] || message;
      }
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
    if (isTauri) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(selectedReply);
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      const appWindow = getCurrentWindow();
      await appWindow.hide();
      setTimeout(async () => {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('simulate_paste_action');
      }, 100);
    } else {
      await navigator.clipboard.writeText(selectedReply);
      alert('已复制到剪贴板！\n\n' + selectedReply);
    }
    
    resetToIdle();
  } catch (error) {
    console.error('Injection failed:', error);
  }
}

function resetToIdle() {
  strategies.value = [];
  agentResult.value = null;
  rawContext.value = '';
  streamingText.value = '';
  isWorking.value = false;
  showContactPicker.value = false;
  identifiedContact.value = null;
  manualContactName.value = '';
  activeTab.value = 'main';
  console.log('[Context-Pod] Reset to idle state');
}

function selectExistingContact(name: string) {
  lastSelectedContact = name;
  manualContactName.value = name;
  showContactPicker.value = false;
  executeWorkflow(rawContext.value, name);
}

function submitManualContact() {
  if (manualContactName.value.trim()) {
    lastSelectedContact = manualContactName.value.trim();
    showContactPicker.value = false;
    executeWorkflow(rawContext.value, manualContactName.value.trim());
  }
}

// 用户自定义回复相关函数
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
    
    console.log('[Context-Pod] 💾 保存用户自定义回复，学习用户风格...');
    
    // 保存用户回复到聊天缓冲区
    // 同时保存原始上下文和用户回复
    const combinedText = `${rawContext.value}\n我: ${customReplyText.value}`;
    saveUserReply(combinedText, contactName, customReplyText.value);
    
    alert('✅ 回复已保存！当积累足够数据后，系统会在闲时自动学习您的风格！');
    
    // 清空输入并隐藏区域
    customReplyText.value = '';
    showCustomReply.value = false;
  } catch (error) {
    console.error('[Context-Pod] ❌ 保存失败:', error);
    alert('保存失败，请稍后重试');
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

function goBack() {
  activeTab.value = 'main';
}
</script>

<template>
  <div class="glass-panel rounded-2xl shadow-2xl w-[420px] max-h-[600px] overflow-hidden animate-fade-in flex flex-col border-none" data-tauri-drag-region>
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/20 select-none" data-tauri-drag-region>
      <div class="flex items-center gap-2 cursor-default">
        <div class="w-2 h-2 rounded-full" :class="isWorking ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"></div>
        <span class="text-sm font-medium text-gray-700">伴聊悬浮舱</span>
        <span v-if="historyCount > 0" class="text-xs text-gray-400">({{ historyCount }}条记录)</span>
      </div>
      <div class="flex items-center gap-1" data-tauri-drag-region="false">
        <button
          v-if="historyCount > 0"
          @click="handleClearHistory"
          class="p-1.5 rounded-lg hover:bg-white/40 transition-colors text-gray-400 hover:text-red-500"
          title="清除对话历史"
        >
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
        <button
          @click="activeTab = 'contacts'"
          class="p-1.5 rounded-lg hover:bg-white/40 transition-colors text-gray-500 hover:text-gray-700"
          title="联系人管理"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          @click="activeTab = 'settings'"
          class="p-1.5 rounded-lg hover:bg-white/40 transition-colors text-gray-500 hover:text-gray-700"
          title="设置"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <button
          v-if="isTauri"
          @click="minimizeToTray"
          class="p-1.5 rounded-lg hover:bg-white/40 transition-colors text-gray-500 hover:text-gray-700"
          title="最小化到托盘"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
          </svg>
        </button>
        <button
          v-if="isTauri"
          @click="closeWindow"
          class="p-1.5 rounded-lg hover:bg-red-100 transition-colors text-gray-500 hover:text-red-600"
          title="关闭（最小化到托盘）"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Main Panel -->
    <div v-if="activeTab === 'main'" class="p-4 flex-1 overflow-auto">
      <!-- Idle State -->
      <div v-if="!isWorking && strategies.length === 0 && !showContactPicker" class="text-center py-6">
        <div class="text-4xl mb-3">🛸</div>
        
        <!-- 快捷键状态 -->
        <div class="mb-3 p-2 rounded-lg" :class="isRegistered ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'">
          <div class="flex items-center justify-center gap-2">
            <span class="text-xs" :class="isRegistered ? 'text-green-600' : 'text-red-600'">
              {{ isRegistered ? '✅ 快捷键已注册' : '❌ 快捷键未注册' }}
            </span>
          </div>
          <p class="text-gray-500 text-sm mt-1">
            按下 <kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono">{{ appStore.settings.shortcutKey }}</kbd> 唤醒
          </p>
          <div v-if="lastError" class="mt-2 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-700 text-left">
            <div class="font-bold mb-1">⚠️ 错误详情：</div>
            <div class="break-all">{{ lastError }}</div>
          </div>
          <div class="mt-2 text-xs text-gray-400">
            环境: {{ isTauri ? 'Tauri 桌面' : '浏览器' }}
          </div>
        </div>
        
        <p class="text-gray-400 text-xs">在聊天窗口中使用快捷键抓取上下文</p>
        
        <!-- 使用说明 -->
        <div class="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200 text-left">
          <p class="text-xs text-blue-600 font-medium mb-1">📖 使用步骤</p>
          <ol class="text-xs text-blue-500 space-y-0.5 list-decimal list-inside">
            <li>在微信中选中聊天文字</li>
            <li>按 Ctrl+C 复制</li>
            <li>按 {{ appStore.settings.shortcutKey }} 触发捕获</li>
            <li>选择合适的回复策略</li>
          </ol>
        </div>

        <!-- 调试工具 -->
        <!-- <div class="mt-2 p-2 bg-red-50 rounded-lg border border-red-200 text-left">
          <p class="text-xs text-red-600 font-medium mb-1">🛠️ 调试工具</p>
          <p class="text-xs text-red-500 mb-2">如果捕获结果是 "0.52.0"，说明剪贴板有残留内容，请按下面按钮处理。</p>
          <div class="flex gap-2">
            <button
              @click="clearClipboard"
              class="flex-1 py-1.5 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition"
            >
              🗑️ 清空剪贴板
            </button>
            <button
              @click="debugClipboard"
              class="flex-1 py-1.5 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition"
            >
              🔍 查看剪贴板
            </button>
          </div>
        </div> -->

        <!-- 风格功能入口 -->
        <div class="mt-3 flex gap-2">
          <button
            @click="activeTab = 'style-extractor'"
            class="flex-1 py-2 text-xs bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100 border border-amber-200 transition-colors"
          >
            🎭 提取风格
          </button>
          <button
            @click="activeTab = 'persona-quiz'"
            class="flex-1 py-2 text-xs bg-purple-50 text-purple-600 rounded-lg hover:bg-purple-100 border border-purple-200 transition-colors"
          >
            🧬 赛博捏脸
          </button>
        </div>

        <!-- 高级功能入口 -->
        <div class="mt-2 flex gap-2">
          <button
            @click="activeTab = 'prompt-manager'"
            class="flex-1 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            📝 提示词
          </button>
          <button
            @click="activeTab = 'log-viewer'"
            class="flex-1 py-1.5 text-xs bg-gray-50 text-gray-500 rounded-lg hover:bg-gray-100 border border-gray-200 transition-colors"
          >
            📋 日志
          </button>
        </div>
        <!-- 测试工具入口 -->
        <div class="mt-2">
          <button
            @click="activeTab = 'evolution-test'"
            class="w-full py-2 text-xs bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-100 border border-teal-200 transition-colors"
          >
            🧪 进化测试工具
          </button>
        </div>

        <!-- 风格画像统计 -->
        <div v-if="personaCount > 0" class="mt-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <p class="text-xs text-green-600">✅ 已建立 {{ personaCount }} 个风格画像</p>
        </div>

        <!-- 浏览器模式提示 -->
        <div v-if="!isTauri" class="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p class="text-xs text-blue-600 font-medium mb-1">🌐 浏览器测试模式</p>
          <p class="text-xs text-blue-500">按 {{ appStore.settings.shortcutKey }} 模拟快捷键</p>
        </div>

        <!-- 未配置提示 -->
        <div v-if="!appStore.isConfigured && isTauri" class="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
          <p class="text-xs text-yellow-700 font-medium mb-1">⚠️ 首次使用请先配置</p>
          <button 
            @click="activeTab = 'settings'"
            class="mt-2 px-4 py-1.5 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
          >
            前往设置 →
          </button>
        </div>
      </div>

      <!-- Contact Picker (when contact not identified) -->
      <div v-if="showContactPicker" class="py-4">
        <!-- 返回按钮 -->
        <button
          @click="showContactPicker = false; resetToIdle()"
          class="mb-4 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7"></path>
          </svg>
          返回首页
        </button>
        
        <div class="text-center mb-3">
          <div class="text-2xl mb-2">👤</div>
          <p class="text-sm text-gray-600 font-medium">未识别到联系人</p>
          <p class="text-xs text-gray-400 mt-1">请选择或输入对话对象的名称</p>
        </div>

        <!-- Last used contact -->
        <div v-if="lastSelectedContact" class="mb-3 p-2 bg-green-50 rounded-lg border border-green-200">
          <p class="text-xs text-green-600 mb-2">上一次选择的联系人：</p>
          <div class="flex gap-2">
            <button
              @click="selectExistingContact(lastSelectedContact)"
              class="flex-1 px-3 py-2 text-xs bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              使用 {{ lastSelectedContact }}
            </button>
            <button
              @click="lastSelectedContact = ''"
              class="px-3 py-2 text-xs bg-gray-200 text-gray-600 rounded-lg hover:bg-gray-300 transition-colors"
            >
              清除
            </button>
          </div>
        </div>

        <!-- Existing contacts -->
        <div v-if="contactStore.contacts.length > 0" class="mb-3">
          <p class="text-xs text-gray-500 mb-2">从已有联系人中选择：</p>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="contact in contactStore.contacts"
              :key="contact.id"
              @click="selectExistingContact(contact.name)"
              class="px-2.5 py-1 text-xs bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 border border-blue-200 transition-colors"
            >
              {{ contact.name }}
            </button>
          </div>
        </div>

        <!-- Manual input -->
        <div class="mb-3">
          <p class="text-xs text-gray-500 mb-2">或手动输入名称：</p>
          <div class="flex gap-2">
            <input
              v-model="manualContactName"
              type="text"
              placeholder="输入联系人名称"
              class="flex-1 px-3 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
              @keyup.enter="submitManualContact"
            />
            <button
              @click="submitManualContact"
              class="px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              确认
            </button>
          </div>
        </div>

        <!-- Skip -->
        <button
          @click="skipContactSelection"
          class="w-full px-3 py-2 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
        >
          跳过，使用通用回复
        </button>
      </div>

      <!-- Working State -->
      <div v-if="isWorking" class="py-6 text-center">
        <div class="inline-flex items-center gap-2 text-blue-500">
          <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span class="text-sm">{{ streamingText }}</span>
        </div>
      </div>

      <!-- Results -->
      <div v-if="!isWorking && strategies.length > 0" class="space-y-2 animate-slide-up">
        <div v-if="agentResult" class="mb-3 px-3 py-2 bg-blue-50/60 rounded-lg">
          <p class="text-xs text-blue-600">
            对话对象：<span class="font-medium">{{ agentResult.targetPerson }}</span>
          </p>
          <p v-if="agentResult.memoryData !== '暂无此人记录'" class="text-xs text-blue-500 mt-0.5 truncate">
            记忆：{{ agentResult.memoryData }}
          </p>
          <p v-if="historyCount > 0" class="text-xs text-blue-400 mt-0.5">
            📚 已结合 {{ historyCount }} 条历史对话
          </p>
        </div>

        <!-- 返回按钮 -->
        <button
          @click="resetToIdle"
          class="mb-2 w-full px-3 py-2 text-xs bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-1"
        >
          ← 返回首页 / 重新捕获
        </button>

        <div class="space-y-2">
          <ReplyCard
            v-for="(strategy, index) in strategies"
            :key="index"
            :strategy="strategy"
            :index="index"
            @select="injectToChat"
          />
        </div>

        <!-- 用户自定义回复区域 -->
        <div class="mt-4 pt-3 border-t border-gray-200">
          <!-- 展开/收起按钮 -->
          <button
            @click="toggleCustomReply"
            class="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path v-if="!showCustomReply" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
            </svg>
            {{ showCustomReply ? '收起自定义回复' : '💡 添加自己的回复，让系统学习您的风格' }}
          </button>

          <!-- 自定义回复输入区域 -->
          <div v-if="showCustomReply" class="mt-3 space-y-3">
            <!-- 隐私提示 -->
            <div class="p-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p class="text-xs text-amber-700 font-medium">🔒 隐私保护提示</p>
              <p class="text-xs text-amber-600 mt-1">您的回复将只保存在本地用于学习您的回复风格，不会发送到任何服务器。</p>
            </div>

            <!-- 输入框 -->
            <textarea
              v-model="customReplyText"
              placeholder="输入您想要的回复内容..."
              class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              rows="3"
            ></textarea>

            <!-- 保存按钮 -->
            <button
              @click="saveCustomReply(strategies[0]?.content || '')"
              :disabled="!customReplyText.trim() || isSavingReply"
              class="w-full px-3 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:bg-gray-300 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg v-if="isSavingReply" class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {{ isSavingReply ? '保存中...' : '✅ 保存并学习我的风格' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Contacts Panel -->
    <div v-if="activeTab === 'contacts'" class="flex-1 overflow-auto">
      <ContactManager
        ref="contactManagerRef"
        @back="goBack"
      />
    </div>

    <!-- Settings Panel -->
    <div v-if="activeTab === 'settings'" class="flex-1 overflow-auto">
      <SettingsPanel
        @back="goBack"
      />
    </div>

    <!-- Style Extractor -->
    <div v-if="activeTab === 'style-extractor'" class="flex-1 overflow-auto">
      <StyleExtractor
        @back="goBack"
      />
    </div>

    <!-- Persona Quiz -->
    <div v-if="activeTab === 'persona-quiz'" class="flex-1 overflow-auto">
      <PersonaQuiz
        @back="goBack"
      />
    </div>

    <!-- Prompt Manager -->
    <div v-if="activeTab === 'prompt-manager'" class="flex-1 overflow-auto">
      <PromptManager
        @back="goBack"
      />
    </div>

    <!-- Log Viewer -->
    <div v-if="activeTab === 'log-viewer'" class="flex-1 overflow-auto">
      <LogViewer
        @back="goBack"
      />
    </div>

    <!-- Evolution Test -->
    <div v-if="activeTab === 'evolution-test'" class="flex-1 overflow-auto">
      <div class="p-4">
        <button
          @click="goBack"
          class="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path d="M15 19l-7-7 7-7"></path>
          </svg>
          返回
        </button>
        <EvolutionTest />
      </div>
    </div>
  </div>
</template>
