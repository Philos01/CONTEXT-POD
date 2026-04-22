<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  getLogs,
  getLogStats,
  clearLogs,
  exportLogs,
  type LogLevel
} from '@/services/logger';

const logs = ref<any[]>([]);
const filterLevel = ref<LogLevel | 'all'>('all');
const filterModule = ref('');
const searchQuery = ref('');
const autoRefresh = ref(true);
const refreshInterval = ref(3000);

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

const levelOptions: { value: LogLevel | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'DEBUG', label: 'DEBUG' },
  { value: 'INFO', label: 'INFO' },
  { value: 'WARNING', label: 'WARNING' },
  { value: 'ERROR', label: 'ERROR' },
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
  <div class="px-5 py-5">
    <div class="flex items-center gap-4 mb-4 p-3 rounded-xl" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <span class="text-xs font-medium" style="color: var(--text-secondary);">总计: <strong style="color: var(--text-primary);">{{ stats.total }}</strong></span>
      <span class="text-xs" style="color: #9ca3af;">DEBUG: {{ stats.DEBUG }}</span>
      <span class="text-xs" style="color: #3b82f6;">INFO: {{ stats.INFO }}</span>
      <span class="text-xs" style="color: #f59e0b;">WARN: {{ stats.WARNING }}</span>
      <span class="text-xs" style="color: #ef4444;">ERROR: {{ stats.ERROR }}</span>

      <label class="ml-auto flex items-center gap-2 cursor-pointer">
        <input
          v-model="autoRefresh"
          @change="autoRefresh ? startAutoRefresh() : stopAutoRefresh()"
          type="checkbox"
          class="w-3.5 h-3.5 rounded"
        />
        <span class="text-xs" style="color: var(--text-tertiary);">自动刷新</span>
      </label>
    </div>

    <div class="flex gap-2 mb-3">
      <select
        v-model="filterLevel"
        @change="refresh"
        class="input-field w-28"
      >
        <option v-for="opt in levelOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
      </select>
      <input
        v-model="filterModule"
        @input="refresh"
        type="text"
        placeholder="模块筛选..."
        class="input-field flex-1"
      />
      <input
        v-model="searchQuery"
        @input="refresh"
        type="text"
        placeholder="搜索..."
        class="input-field w-24"
      />
    </div>

    <div class="flex gap-2 mb-3">
      <button
        @click="handleExport"
        class="btn-secondary flex-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        导出日志
      </button>
      <button
        @click="handleClear"
        class="btn-secondary flex-1"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        清除全部
      </button>
    </div>

    <div class="overflow-y-auto rounded-xl border" style="height: calc(500px - 280px); border-color: var(--border-light);">
      <table class="w-full text-xs">
        <thead class="sticky top-0" style="background: var(--bg-tertiary);">
          <tr>
            <th class="px-3 py-2.5 text-left font-medium text-left w-20" style="color: var(--text-tertiary);">时间</th>
            <th class="px-3 py-2.5 text-left font-medium w-14" style="color: var(--text-tertiary);">级别</th>
            <th class="px-3 py-2.5 text-left font-medium w-24" style="color: var(--text-tertiary);">模块</th>
            <th class="px-3 py-2.5 text-left font-medium" style="color: var(--text-tertiary);">消息</th>
            <th class="px-3 py-2.5 text-right font-medium w-16" style="color: var(--text-tertiary);">耗时</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(log, index) in filteredLogs.slice(-100).reverse()"
            :key="log.id || index"
            class="border-b transition-colors"
            style="border-color: var(--border-light);"
          >
            <td class="px-3 py-2" style="color: var(--text-tertiary);">{{ formatTime(log.timestamp) }}</td>
            <td class="px-3 py-2">
              <span
                class="inline-block px-2 py-0.5 rounded text-white font-medium text-[10px]"
                :style="{ backgroundColor: log.level === 'DEBUG' ? '#9ca3af' : log.level === 'INFO' ? '#3b82f6' : log.level === 'WARNING' ? '#f59e0b' : '#ef4444' }"
              >
                {{ log.level }}
              </span>
            </td>
            <td class="px-3 py-2 truncate max-w-[80px] text-[var(--text-tertiary)]" :title="log.module">{{ log.module }}</td>
            <td class="px-3 py-2" style="color: var(--text-primary);">
              {{ log.message }}
              <pre v-if="log.data" class="mt-1 p-2 rounded text-[10px] overflow-x-auto whitespace-pre-wrap" style="background: #1a1a1f; color: #22c55e;">{{ log.data }}</pre>
            </td>
            <td class="px-3 py-2 text-right" style="color: var(--text-tertiary);">
              {{ log.duration ? log.duration.toFixed(0) + 'ms' : '-' }}
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="filteredLogs.length === 0" class="py-12 text-center">
        <svg class="w-12 h-12 mx-auto mb-3" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p class="text-sm" style="color: var(--text-tertiary);">暂无日志记录</p>
      </div>
    </div>
  </div>
</template>
