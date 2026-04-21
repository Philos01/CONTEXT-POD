<script setup lang="ts">
import { ref } from 'vue';
import type { ReplyStrategy } from '@/types';

defineProps<{
  strategy: ReplyStrategy;
  index: number;
}>();

const emit = defineEmits<{
  select: [content: string];
}>();

const isExpanded = ref(false);

function getTagColor(label: string): string {
  const colors: Record<string, string> = {
    '舔狗软泥版': 'rgba(139, 115, 85, 0.08)',
    '官方滴水不漏': 'rgba(59, 130, 246, 0.08)',
    '高强度开火对拼': 'rgba(239, 68, 68, 0.08)',
    '冷眼观察陪伴': 'rgba(107, 114, 128, 0.08)',
    '冷嘲热讽版': 'rgba(168, 85, 247, 0.08)',
    '直球警告版': 'rgba(236, 72, 153, 0.08)',
    '反向输出版': 'rgba(234, 179, 8, 0.08)',
    '理性分析版': 'rgba(34, 197, 94, 0.08)',
    '共情倾听版': 'rgba(139, 92, 246, 0.08)',
    '站队拱火版': 'rgba(225, 29, 72, 0.08)',
    '默认推荐': 'rgba(139, 115, 85, 0.08)',
  };
  return colors[label] || 'rgba(139, 115, 85, 0.08)';
}

function getTagTextColor(label: string): string {
  const colors: Record<string, string> = {
    '舔狗软泥版': '#8b7355',
    '官方滴水不漏': '#3b82f6',
    '高强度开火对拼': '#dc2626',
    '冷眼观察陪伴': '#6b7280',
    '冷嘲热讽版': '#a855f7',
    '直球警告版': '#ec4899',
    '反向输出版': '#ca8a04',
    '理性分析版': '#16a34a',
    '共情倾听版': '#8b5cf6',
    '站队拱火版': '#e11d48',
    '默认推荐': '#8b7355',
  };
  return colors[label] || '#8b7355';
}

function getRiskColor(riskLevel: string): string {
  const colors: Record<string, string> = {
    'low': '#16a34a',
    'medium': '#ca8a04',
    'high': '#dc2626',
  };
  return colors[riskLevel] || '#6b7280';
}

function getRiskBg(riskLevel: string): string {
  const colors: Record<string, string> = {
    'low': 'rgba(34, 197, 94, 0.08)',
    'medium': 'rgba(234, 179, 8, 0.08)',
    'high': 'rgba(239, 68, 68, 0.08)',
  };
  return colors[riskLevel] || 'rgba(107, 114, 128, 0.08)';
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div
    class="rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer"
    :class="isExpanded ? 'ring-2 ring-[var(--accent-warm)]' : ''"
    :style="{
      background: 'white',
      border: '1px solid var(--border-subtle)',
      ...(isExpanded ? { boxShadow: 'var(--shadow-md)' } : {})
    }"
    @click="emit('select', strategy.content)"
  >
    <div class="p-4">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" :style="{ background: getTagColor(strategy.style) }">
          <span class="text-xs font-bold" :style="{ color: getTagTextColor(strategy.style) }">#{{ index + 1 }}</span>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center justify-between mb-1.5">
            <span
              class="text-[10px] px-2 py-0.5 rounded-lg font-medium"
              :style="{ background: getTagColor(strategy.style), color: getTagTextColor(strategy.style) }"
            >
              {{ strategy.style }}
            </span>

            <div class="flex items-center gap-2">
              <span
                class="text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1"
                :style="{ background: getRiskBg(strategy.riskLevel), color: getRiskColor(strategy.riskLevel) }"
              >
                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {{ strategy.riskLevel === 'low' ? '低风险' : strategy.riskLevel === 'medium' ? '中风险' : '高风险' }}
              </span>
              <button
                @click.stop="toggleExpand"
                class="p-1 rounded-lg transition-colors"
                :class="isExpanded ? 'text-[var(--accent-warm)]' : 'text-[var(--text-tertiary)]'"
                :style="!isExpanded ? { background: 'var(--bg-tertiary)' } : {}"
              >
                <svg class="w-3.5 h-3.5 transition-transform" :class="isExpanded ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

          <p
            class="text-sm leading-relaxed"
            :class="isExpanded ? 'text-[var(--text-primary)]' : 'line-clamp-2'"
            style="color: var(--text-primary);"
          >
            {{ strategy.content }}
          </p>

          <div v-if="isExpanded" class="mt-3 pt-3" style="border-top: 1px solid var(--border-light);">
            <p class="text-xs font-medium mb-1" style="color: var(--text-secondary);">
              <svg class="w-3 h-3 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              战术目标
            </p>
            <p class="text-xs leading-relaxed" style="color: var(--text-tertiary);">{{ strategy.tacticalGoal }}</p>

            <p class="text-xs font-medium mt-2 mb-1" style="color: var(--text-secondary);">
              <svg class="w-3 h-3 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              预期反应
            </p>
            <p class="text-xs leading-relaxed" style="color: var(--text-tertiary);">{{ strategy.expectedReaction }}</p>
          </div>
        </div>
      </div>

      <div v-if="isExpanded" class="mt-4 flex gap-2">
        <button
          class="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2"
          style="background: linear-gradient(135deg, var(--accent-warm) 0%, #6b5544 100%); color: white;"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          复制回复
        </button>
      </div>
    </div>
  </div>
</template>
