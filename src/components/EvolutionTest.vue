<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { 
  pushToBuffer, 
  clearBuffer, 
  triggerPersonaUpdate,
  getUnprocessedCount,
  getPendingCountsByContact
} from '@/services/evolutionEngine';
import { getPersona } from '@/services/personaService';
import { useAppStore } from '@/stores/appStore';
import type { StylePersona } from '@/types';

const appStore = useAppStore();

const testContactName = ref('测试用户');
const testMessages = ref([
  { content: '今天天气真好啊！', role: 'partner' as const },
  { content: '哈哈，是啊，要不要出去走走？', role: 'user' as const },
  { content: '好呀好呀，去哪里呢？', role: 'partner' as const },
  { content: '去公园吧，那边风景不错~', role: 'user' as const },
  { content: '太好了！我也正有此意呢！', role: 'partner' as const },
  { content: '那我们下午三点见？', role: 'user' as const },
  { content: '没问题，不见不散哦~', role: 'partner' as const },
  { content: '好的好的，到时候见！', role: 'user' as const },
  { content: '对了，要不要带点吃的？', role: 'partner' as const },
  { content: '好主意呀，我带点水果吧！', role: 'user' as const },
]);

const originalPersona = ref<StylePersona | null>(null);
const newPersona = ref<StylePersona | null>(null);
const testResult = ref('');
const isRunning = ref(false);
const bufferCount = ref(0);
const pendingCounts = ref<Record<string, number>>({});

function refreshStats() {
  bufferCount.value = getUnprocessedCount(testContactName.value);
  pendingCounts.value = getPendingCountsByContact();
}

async function addTestData() {
  clearBuffer();
  for (const msg of testMessages.value) {
    pushToBuffer(testContactName.value, msg.content, msg.role);
  }
  refreshStats();
  testResult.value = `✅ 已添加 ${testMessages.value.length} 条测试消息到缓冲区`;
}

async function runEvolutionTest() {
  if (!appStore.isConfigured) {
    testResult.value = '❌ 请先配置 API Key';
    return;
  }

  isRunning.value = true;
  testResult.value = '🧪 开始测试...';

  try {
    originalPersona.value = getPersona(testContactName.value);
    console.log('[EvolutionTest] Original persona:', originalPersona.value);

    const result = await triggerPersonaUpdate(testContactName.value, appStore.settings, true);
    
    newPersona.value = getPersona(testContactName.value);
    console.log('[EvolutionTest] New persona:', newPersona.value);

    if (result.success && result.persona) {
      testResult.value = `✅ 进化测试成功！\n\n📊 处理了 ${result.processedCount} 条消息\n\n🔍 对比结果：\n- 之前：${originalPersona.value ? JSON.stringify(originalPersona.value, null, 2) : '无'}\n- 现在：${JSON.stringify(newPersona.value, null, 2)}`;
    } else {
      testResult.value = '❌ 进化失败，请查看控制台日志';
    }
  } catch (error) {
    console.error('[EvolutionTest] Error:', error);
    testResult.value = `❌ 测试出错: ${error}`;
  } finally {
    isRunning.value = false;
    refreshStats();
  }
}

function clearTestData() {
  clearBuffer();
  originalPersona.value = null;
  newPersona.value = null;
  refreshStats();
  testResult.value = '🗑️ 测试数据已清除';
}

onMounted(() => {
  refreshStats();
  originalPersona.value = getPersona(testContactName.value);
});
</script>

<template>
  <div class="p-4 bg-gray-50 rounded-lg max-w-2xl mx-auto">
    <h2 class="text-lg font-bold text-gray-800 mb-4">🧬 用户画像进化测试工具</h2>
    
    <div class="space-y-4">
      <div class="bg-white p-4 rounded-lg border">
        <h3 class="font-medium text-gray-700 mb-2">📋 测试设置</h3>
        <div class="flex gap-2 flex-wrap">
          <button 
            @click="addTestData"
            :disabled="isRunning"
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            添加测试数据
          </button>
          <button 
            @click="runEvolutionTest"
            :disabled="isRunning || bufferCount === 0"
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {{ isRunning ? '进化中...' : '运行进化测试' }}
          </button>
          <button 
            @click="clearTestData"
            :disabled="isRunning"
            class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
          >
            清除测试数据
          </button>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border">
        <h3 class="font-medium text-gray-700 mb-2">📊 当前状态</h3>
        <div class="text-sm text-gray-600 space-y-1">
          <p>缓冲区消息数：<span class="font-bold">{{ bufferCount }}</span></p>
          <p>待处理计数：{{ JSON.stringify(pendingCounts) }}</p>
        </div>
      </div>

      <div class="bg-white p-4 rounded-lg border">
        <h3 class="font-medium text-gray-700 mb-2">📝 测试结果</h3>
        <pre class="text-xs bg-gray-100 p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap">{{ testResult || '等待测试...' }}</pre>
      </div>

      <div v-if="originalPersona || newPersona" class="bg-white p-4 rounded-lg border">
        <h3 class="font-medium text-gray-700 mb-2">🔍 画像对比</h3>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <h4 class="text-sm font-medium text-gray-600 mb-2">之前</h4>
            <pre class="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-48">{{ originalPersona ? JSON.stringify(originalPersona, null, 2) : '无' }}</pre>
          </div>
          <div>
            <h4 class="text-sm font-medium text-gray-600 mb-2">之后</h4>
            <pre class="text-xs bg-green-50 p-2 rounded overflow-auto max-h-48">{{ newPersona ? JSON.stringify(newPersona, null, 2) : '无' }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
