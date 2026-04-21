<script setup lang="ts">
import { ref, onMounted } from 'vue';

defineProps<{
  show: boolean;
  message: string;
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  confirmText?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);

function handleClose() {
  emit('close');
}

function handleConfirm() {
  emit('confirm');
  emit('close');
}

function handleOverlayClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    handleClose();
  }
}

onMounted(() => {
  if (dialogRef.value) {
    dialogRef.value.focus();
  }
});

const typeIcon = {
  info: '📝',
  success: '✅',
  warning: '⚠️',
  error: '❌'
};

const typeColor = {
  info: 'var(--text-secondary)',
  success: '#16a34a',
  warning: '#ca8a04',
  error: '#dc2626'
};
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
    @click="handleOverlayClick"
  >
    <div class="absolute inset-0 bg-black/10 backdrop-blur-sm"></div>
    <div
      ref="dialogRef"
      class="relative z-10 w-full max-w-md mx-auto"
      style="max-width: 320px;"
    >
      <div
        class="rounded-2xl p-5 space-y-4"
        style="background: white; border: 1px solid var(--border-light); box-shadow: var(--shadow-lg);"
      >
        <!-- Header -->
        <div v-if="title" class="flex items-center gap-2">
          <span
            class="text-lg"
            :style="{ color: typeColor[type || 'info'] }"
          >
            {{ typeIcon[type || 'info'] }}
          </span>
          <h3
            class="text-sm font-semibold flex-1"
            style="color: var(--text-primary);"
          >
            {{ title }}
          </h3>
        </div>

        <!-- Message -->
        <div
          class="text-sm leading-relaxed"
          style="color: var(--text-secondary); white-space: pre-line;"
        >
          {{ message }}
        </div>

        <!-- Actions -->
        <div class="flex justify-end gap-2 pt-2">
          <button
            @click="handleConfirm"
            class="btn-primary"
            style="padding: 8px 16px; font-size: 14px;"
          >
            {{ confirmText || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>