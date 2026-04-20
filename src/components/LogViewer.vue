<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  getLogs,
  getLogStats,
  clearLogs,
  exportLogs,
  type LogLevel
} from '@/services/logger';

const emit = defineEmits<{
  back: [];
}>();

const logs = ref<any[]>([]);
const filterLevel = ref<LogLevel | 'all'>('all');
const filterModule = ref('');
const searchQuery = ref('');
const autoRefresh = ref(true);
const refreshInterval = ref(1000);

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  refresh();
  if (autoRefresh.value) {
    startAutoRefresh();
  }
});

function startAutoRefresh() {
  stopAutoRefresh();
  timer = setInterval(refresh, refreshInterval.value);
}

function stopAutoRefresh() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function refresh() {
  logs.value = getLogs({
    level: filterLevel.value === 'all' ? undefined : filterLevel.value,
    module: filterModule.value || undefined,
    search: searchQuery.value || undefined,
    limit: 200,
  });
  stats.value = getLogStats();
}

const stats = ref(getLogStats());

const filteredLogs = computed(() => {
  let result = [...logs.value];
  
  if (filterModule.value) {
    const search = filterModule.value.toLowerCase();
    result = result.filter(l => l.module.toLowerCase().includes(search));
  }
  
  if (searchQuery.value) {
    const search = searchQuery.value.toLowerCase();
    result = result.filter(l =>
      l.message.toLowerCase().includes(search) ||
      (l.data && l.data.toLowerCase().includes(search))
    );
  }
  
  return result;
});

const levelOptions: { value: LogLevel | 'all'; label: string; color: string }[] = [
  { value: 'all', label: '全部', color: '#6b7280' },
  { value: 'DEBUG', label: 'DEBUG', color: '#9ca3af' },
  { value: 'INFO', label: 'INFO', color: '#3b82f6' },
  { value: 'WARNING', label: 'WARNING', color: '#f59e0b' },
  { value: 'ERROR', label: 'ERROR', color: '#ef4444' },
];

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN');
}

function handleExport() {
  const content = exportLogs();
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `context-pod-logs-${new Date().toISOString().slice(0,10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function handleClear() {
  if (confirm('确定要清除所有日志吗？此操作不可恢复。')) {
    clearLogs();
    refresh();
  }
}
</script>

<template>
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-3">
      <button @click="emit('back')" class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h3 class="text-sm font-medium text-gray-700">📋 系统日志</h3>
    </div>

    <!-- Stats Bar -->
    <div class="flex items-center gap-3 mb-3 p-2 bg-gray-50 rounded-lg text-[10px]">
      <span>总计: <strong>{{ stats.total }}</strong></span>
      <span style="color:#9ca3af">DEBUG: {{ stats.DEBUG }}</span>
      <span style="color:#3b82f6">INFO: {{ stats.INFO }}</span>
      <span style="color:#f59e0b">WARN: {{ stats.WARNING }}</span>
      <span style="color:#ef4444">ERROR: {{ stats.ERROR }}</span>
      
      <label class="ml-auto flex items-center gap-1 cursor-pointer">
        <input
          v-model="autoRefresh"
          @change="autoRefresh ? startAutoRefresh() : stopAutoRefresh()"
          type="checkbox"
          class="w-3 h-3"
        />
        自动刷新
      </label>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-2">
      <select
        v-model="filterLevel"
        @change="refresh"
        class="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
      >
        <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <input
        v-model="filterModule"
        @input="refresh"
        type="text"
        placeholder="模块筛选..."
        class="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
      />
      <input
        v-model="searchQuery"
        @input="refresh"
        type="text"
        placeholder="搜索..."
        class="w-24 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
      />
    </div>

    <!-- Actions -->
    <div class="flex gap-2 mb-2">
      <button
        @click="handleExport"
        class="px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 border border-blue-200 transition-colors"
      >
        📥 导出日志
      </button>
      <button
        @click="handleClear"
        class="px-3 py-1.5 text-xs bg-red-50 text-red-500 rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
      >
        🗑️ 清除全部
      </button>
    </div>

    <!-- Log List -->
    <div class="overflow-y-auto rounded-lg border border-gray-200" style="height: calc(500px - 260px);">
      <table class="w-full text-[10px]">
        <thead class="bg-gray-50 sticky top-0">
          <tr>
            <th class="px-2 py-1.5 text-left font-medium text-gray-500 w-20">时间</th>
            <th class="px-2 py-1.5 text-left font-medium text-gray-500 w-14">级别</th>
            <th class="px-2 py-1.5 text-left font-medium text-gray-500 w-24">模块</th>
            <th class="px-2 py-1.5 text-left font-medium text-gray-500">消息</th>
            <th class="px-2 py-1.5 text-right font-medium text-gray-500 w-16">耗时</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(log, index) in filteredLogs.slice(-100).reverse()"
            :key="log.id || index"
            class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td class="px-2 py-1.5 text-gray-400 whitespace-nowrap">{{ formatTime(log.timestamp) }}</td>
            <td class="px-2 py-1.5">
              <span
                class="inline-block px-1.5 py-0.5 rounded text-white font-medium"
                :style="{ backgroundColor: levelOptions.find(o => o.value === log.level)?.color || '#9ca3af' }"
              >
                {{ log.level }}
              </span>
            </td>
            <td class="px-2 py-1.5 text-gray-500 truncate max-w-[80px]" :title="log.module">{{ log.module }}</td>
            <td class="px-2 py-1.5 text-gray-700 break-all">
              {{ log.message }}
              <pre v-if="log.data" class="mt-0.5 p-1 bg-gray-800 text-green-400 rounded text-[9px] overflow-x-auto whitespace-pre-wrap">{{ log.data }}</pre>
            </td>
            <td class="px-2 py-1.5 text-right text-gray-400 whitespace-nowrap">
              {{ log.duration ? log.duration.toFixed(0) + 'ms' : '-' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredLogs.length === 0" class="py-8 text-center text-gray-400 text-sm">
        暂无日志记录
      </div>
    </div>
  </div>
</template>