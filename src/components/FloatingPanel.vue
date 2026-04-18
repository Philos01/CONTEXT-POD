<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useCapture } from '@/composables/useCapture';
import { useWindowManager } from '@/composables/useWindowManager';
import { useAppStore } from '@/stores/appStore';
import { useContactStore } from '@/stores/contactStore';
import { runWorkflowStream, identifyContact, clearHistory, getHistory } from '@/services/agentWorkflow';
import ReplyCard from './ReplyCard.vue';
import ContactManager from './ContactManager.vue';
import SettingsPanel from './SettingsPanel.vue';
import type { ReplyStrategy, AgentState } from '@/types';

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const appStore = useAppStore();
const contactStore = useContactStore();
const { initShortcut, cleanupShortcut, isRegistered, lastError } = useCapture();
useWindowManager();

const rawContext = ref('');
const strategies = ref<ReplyStrategy[]>([]);
const streamingText = ref('');
const isWorking = ref(false);
const activeTab = ref<'main' | 'contacts' | 'settings'>('main');
const agentResult = ref<AgentState | null>(null);
const identifiedContact = ref<{ name: string; confidence: number; source: string } | null>(null);
const manualContactName = ref('');
const showContactPicker = ref(false);
const historyCount = computed(() => getHistory().length);

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
  
  if (!appStore.isConfigured) {
    console.log('[Context-Pod] ⚠️ API Key not configured, please go to Settings');
    activeTab.value = 'settings';
  }
});

onUnmounted(async () => {
  await cleanupShortcut();
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

  const identification = identifyContact(result.text);
  identifiedContact.value = identification;
  console.log(`[Context-Pod] Contact identified:`, identification);

  if (identification.name === '未知联系人') {
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

function selectExistingContact(name: string) {
  manualContactName.value = name;
  showContactPicker.value = false;
  executeWorkflow(rawContext.value, name);
}

function submitManualContact() {
  if (manualContactName.value.trim()) {
    showContactPicker.value = false;
    executeWorkflow(rawContext.value, manualContactName.value.trim());
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

function testCapture() {
  const testText = '张三: 明天下午开会吗？\n我: 是的，三点开始\n张三: 好的，收到，记得准备材料';
  handleCapture({ text: testText });
}
</script>

<template>
  <div class="glass-panel rounded-2xl shadow-2xl w-[420px] max-h-[500px] overflow-hidden animate-fade-in flex flex-col" data-tauri-drag-region>
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
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
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
        
        <!-- 托盘提示 -->
        <div v-if="isTauri" class="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
          <p class="text-xs text-gray-500">💡 最小化后在系统托盘找回</p>
          <p class="text-xs text-gray-400 mt-0.5">双击托盘图标或右键菜单显示窗口</p>
        </div>
        
        <!-- 测试按钮 -->
        <button
          @click="testCapture"
          class="mt-3 px-4 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          🧪 测试功能（模拟捕获）
        </button>

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
        <div class="text-center mb-3">
          <div class="text-2xl mb-2">👤</div>
          <p class="text-sm text-gray-600 font-medium">未识别到联系人</p>
          <p class="text-xs text-gray-400 mt-1">请选择或输入对话对象的名称</p>
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
      </div>
    </div>

    <!-- Contacts Panel -->
    <ContactManager
      v-if="activeTab === 'contacts'"
      @back="goBack"
    />

    <!-- Settings Panel -->
    <SettingsPanel
      v-if="activeTab === 'settings'"
      @back="goBack"
    />
  </div>
</template>