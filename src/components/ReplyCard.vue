<script setup lang="ts">
import type { ReplyStrategy } from '@/types';

defineProps<{
  strategy: ReplyStrategy;
  index: number;
}>();

const emit = defineEmits<{
  select: [content: string];
}>();

const styleIcons: Record<string, string> = {
  '顺从推进': '😊',
  '委婉甩锅': '🤔',
  '幽默化解': '😄',
};
</script>

<template>
  <div
    class="group relative p-3 rounded-xl border transition-all duration-150 hover:shadow-md cursor-pointer"
    :class="[
      index === 0 ? 'bg-emerald-50/60 border-emerald-200/60 hover:border-emerald-300' :
      index === 1 ? 'bg-amber-50/60 border-amber-200/60 hover:border-amber-300' :
      'bg-violet-50/60 border-violet-200/60 hover:border-violet-300'
    ]"
    @click="emit('select', strategy.content)"
  >
    <div class="flex items-start gap-2">
      <span class="text-lg flex-shrink-0">{{ styleIcons[strategy.style] || '💬' }}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-1">
          <span class="text-xs font-semibold px-1.5 py-0.5 rounded"
            :class="[
              index === 0 ? 'bg-emerald-100 text-emerald-700' :
              index === 1 ? 'bg-amber-100 text-amber-700' :
              'bg-violet-100 text-violet-700'
            ]"
          >
            {{ strategy.label }}
          </span>
          <span class="text-xs text-gray-500">{{ strategy.style }}</span>
        </div>
        <p class="text-sm text-gray-800 leading-relaxed">{{ strategy.content }}</p>
      </div>
      <svg class="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    </div>
  </div>
</template>
