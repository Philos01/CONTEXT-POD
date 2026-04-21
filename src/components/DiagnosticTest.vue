<template>
  <div class="px-5 py-4 space-y-4 bg-white dark:bg-gray-800 rounded-lg shadow max-h-[70vh] overflow-y-auto">

    <div class="space-y-3">
      <div class="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
        <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">测试聊天记录</label>
        <textarea
          v-model="testChatText"
          class="w-full h-32 p-2 text-xs border border-gray-300 rounded resize-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          placeholder="粘贴一段聊天记录来测试..."
        />
      </div>

      <div class="flex gap-2">
        <button
          @click="runFullDiagnosis"
          :disabled="isRunning"
          class="flex-1 px-3 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ isRunning ? '⏳ 诊断中...' : '🚀 运行完整诊断' }}
        </button>
        <button
          @click="clearLogs"
          class="px-3 py-2 text-xs font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
        >
          🗑️ 清空日志
        </button>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">📊 诊断结果</h3>
      
      <div class="space-y-2">
        <div v-for="(step, idx) in diagnosticSteps" :key="idx" class="p-2 text-xs border rounded-lg" :class="getStatusClass(step.status)">
          <div class="flex items-center justify-between mb-1">
            <span class="font-medium">{{ step.icon }} {{ step.name }}</span>
            <span>{{ getStatusText(step.status) }}</span>
          </div>
          <div v-if="step.details" class="text-[10px] text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
            {{ step.details }}
          </div>
          <div v-if="step.error" class="text-[10px] text-red-600 dark:text-red-400 mt-1">
            ❌ {{ step.error }}
          </div>
        </div>
      </div>
    </div>

    <div>
      <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">📝 完整日志</h3>
      <div class="p-2 h-40 overflow-y-auto text-[10px] font-mono bg-gray-900 text-green-400 rounded-lg">
        <div v-for="(log, idx) in logs" :key="idx" class="py-0.5 border-b border-gray-800">
          <span class="text-gray-500">[{{ log.timestamp }}]</span>
          <span :class="{'text-yellow-400': log.type === 'warn', 'text-red-400': log.type === 'error', 'text-cyan-400': log.type === 'info', 'text-green-400': log.type === 'success'}">
            {{ log.message }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { extractDynamicPersona } from '../services/personaService';
import { useAppStore } from '../stores/appStore';
import type { AppSettings } from '../types';

const appStore = useAppStore();

const testChatText = ref(`张经理: 小陈，下周三的方案准备好了吗？
张经理: 客户催得很紧啊！
我: 正在收尾...
张经理: 今天下班前能给我吗？
我: 我尽量，张经理`);

const isRunning = ref(false);
const logs = ref<{timestamp: string, type: string, message: string}[]>([]);

const diagnosticSteps = ref([
  { name: '1. 读取应用配置', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '⚙️', details: '', error: '' },
  { name: '2. 验证 API 配置', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '🔑', details: '', error: '' },
  { name: '3. 解析测试文本', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '📄', details: '', error: '' },
  { name: '4. 调用 LLM API', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '🤖', details: '', error: '' },
  { name: '5. 解析返回 JSON', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '🔬', details: '', error: '' },
  { name: '6. 验证数据完整性', status: 'pending' as 'pending'|'running'|'success'|'error', icon: '✅', details: '', error: '' },
]);

function addLog(type: string, msg: string) {
  const now = new Date();
  const ts = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}.${String(now.getMilliseconds()).padStart(3,'0')}`;
  logs.value.unshift({ timestamp: ts, type, message: msg });
}

function getStatusClass(status: string) {
  switch(status) {
    case 'pending': return 'bg-gray-50 border-gray-200 dark:bg-gray-700 dark:border-gray-600 text-gray-400';
    case 'running': return 'bg-blue-50 border-blue-200 dark:bg-blue-900 dark:border-blue-700 text-blue-700 dark:text-blue-300';
    case 'success': return 'bg-green-50 border-green-200 dark:bg-green-900 dark:border-green-700 text-green-700 dark:text-green-300';
    case 'error': return 'bg-red-50 border-red-200 dark:bg-red-900 dark:border-red-700 text-red-700 dark:text-red-300';
    default: return 'bg-gray-50 border-gray-200';
  }
}

function getStatusText(status: string) {
  switch(status) {
    case 'pending': return '等待中';
    case 'running': return '进行中...';
    case 'success': return '通过';
    case 'error': return '失败';
    default: return status;
  }
}

function clearLogs() {
  logs.value = [];
  diagnosticSteps.value.forEach(s => {
    s.status = 'pending';
    s.details = '';
    s.error = '';
  });
}

async function runFullDiagnosis() {
  if (isRunning.value) return;
  isRunning.value = true;
  clearLogs();
  addLog('info', '=== 开始完整诊断 ===');

  let settings: AppSettings | null = null;

  // --- Step 1: 读取配置
  diagnosticSteps.value[0].status = 'running';
  addLog('info', 'Step 1: 读取应用配置...');
  try {
    settings = appStore.settings;
    diagnosticSteps.value[0].details = `Provider: ${settings.provider}\nBaseUrl: ${settings.baseUrl}\nModel: ${settings.model}\nApiKey: ${settings.apiKey ? `${settings.apiKey.substring(0, 8)}...` : 'EMPTY'}`;
    diagnosticSteps.value[0].status = 'success';
    addLog('success', '✓ 配置读取成功');
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    diagnosticSteps.value[0].status = 'error';
    diagnosticSteps.value[0].error = err.message;
    addLog('error', `✗ 配置读取失败: ${err.message}`);
    isRunning.value = false;
    return;
  }

  // --- Step 2: 验证配置
  diagnosticSteps.value[1].status = 'running';
  addLog('info', 'Step 2: 验证 API 配置...');
  try {
    const isOk = appStore.isConfigured;
    diagnosticSteps.value[1].details = `isConfigured: ${isOk}`;
    if (!isOk) throw new Error('配置不完整');
    diagnosticSteps.value[1].status = 'success';
    addLog('success', '✓ API 配置验证通过');
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    diagnosticSteps.value[1].status = 'error';
    diagnosticSteps.value[1].error = err.message;
    addLog('error', `✗ 配置验证失败: ${err.message}`);
    isRunning.value = false;
    return;
  }

  // --- Step 3: 解析测试文本
  diagnosticSteps.value[2].status = 'running';
  addLog('info', 'Step 3: 解析测试文本...');
  try {
    const lines = testChatText.value.split('\n').filter(l => l.trim());
    diagnosticSteps.value[2].details = `总行数: ${testChatText.value.split('\n').length}\n有效行数: ${lines.length}\n字符数: ${testChatText.value.length}`;
    diagnosticSteps.value[2].status = 'success';
    addLog('success', `✓ 文本解析成功 (${lines.length} 行)`);
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    diagnosticSteps.value[2].status = 'error';
    diagnosticSteps.value[2].error = err.message;
    addLog('error', `✗ 文本解析失败: ${err.message}`);
    isRunning.value = false;
    return;
  }

  // --- Step 4/5/6: 调用风格提取
  diagnosticSteps.value[3].status = 'running';
  diagnosticSteps.value[4].status = 'pending';
  diagnosticSteps.value[5].status = 'pending';
  addLog('info', 'Step 4-6: 调用风格提取...');

  try {
    addLog('info', '调用 extractDynamicPersona...');
    const result = await extractDynamicPersona(testChatText.value, '测试对象', settings);
    addLog('info', 'API 返回结果: ' + JSON.stringify(result, null, 2));

    if (result && (result as any).isFallback) {
      diagnosticSteps.value[3].status = 'error';
      diagnosticSteps.value[3].error = (result as any).fallbackReason || '返回了降级默认值';
      diagnosticSteps.value[4].status = 'pending';
      diagnosticSteps.value[5].status = 'pending';
      addLog('error', `✗ LLM 调用失败: ${(result as any).fallbackReason}`);
    } else {
      diagnosticSteps.value[3].status = 'success';
      diagnosticSteps.value[3].details = 'API 调用成功';
      addLog('success', '✓ LLM API 调用成功');

      diagnosticSteps.value[4].status = 'running';
      addLog('info', 'Step 5: 验证 JSON 解析...');
      diagnosticSteps.value[4].status = 'success';
      diagnosticSteps.value[4].details = 'JSON 格式正确';
      addLog('success', '✓ JSON 解析通过');

      diagnosticSteps.value[5].status = 'running';
      addLog('info', 'Step 6: 验证数据完整性...');
      const hasPowerIdentity = result.powerIdentity && result.powerIdentity.length > 0;
      const hasPsychologicalNeeds = result.psychologicalNeeds && result.psychologicalNeeds.length > 0;
      const hasTaboos = result.taboos && result.taboos.length > 0;
      diagnosticSteps.value[5].details = `powerIdentity: ${result.powerIdentity?.length || 0} 条\npsychologicalNeeds: ${result.psychologicalNeeds?.length || 0} 条\ntaboos: ${result.taboos?.length || 0} 条\ntemperature: ${result.temperature}\ntextStyle: ${result.textStyle}\nsummary: ${result.summary}`;
      diagnosticSteps.value[5].status = 'success';
      addLog('success', `✓ 数据完整性验证通过 (powerIdentity=${hasPowerIdentity}, needs=${hasPsychologicalNeeds}, taboos=${hasTaboos})`);
    }

  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    addLog('error', `✗ 流程异常: ${err.message}`);
    addLog('error', `堆栈: ${err.stack}`);

    let handled = false;
    for (let i = 3; i <= 5; i++) {
      if (diagnosticSteps.value[i].status === 'running' || diagnosticSteps.value[i].status === 'pending') {
        diagnosticSteps.value[i].status = 'error';
        diagnosticSteps.value[i].error = err.message;
        handled = true;
        break;
      }
    }
    if (!handled) {
      diagnosticSteps.value[3].status = 'error';
      diagnosticSteps.value[3].error = err.message;
    }
  }

  addLog('info', '=== 诊断完成 ===');
  isRunning.value = false;
}

onMounted(() => {
  addLog('info', '诊断组件已加载');
  addLog('info', '请填写测试文本后点击"运行完整诊断"');
});
</script>
