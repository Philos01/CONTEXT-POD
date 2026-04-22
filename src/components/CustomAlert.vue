<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const props = withDefaults(defineProps<{
  show: boolean;
  message: string;
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmText?: string;
  cancelText?: string;
}>(), {
  type: 'info',
  confirmText: '确定',
  cancelText: '取消'
});

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);

function handleClose() {
  isVisible.value = false;
  setTimeout(() => {
    emit('close');
  }, 200);
}

function handleConfirm() {
  emit('confirm');
  handleClose();
}

function handleCancel() {
  handleClose();
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

watch(() => props.show, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      isVisible.value = true;
    }, 10);
  } else {
    isVisible.value = false;
  }
}, { immediate: true });

const confirmBtnColor = props.type === 'confirm' ? '#ef4444' : '#1f2937';
const confirmBtnShadow = props.type === 'confirm' ? '0 4px 12px rgba(239, 68, 68, 0.35)' : '0 4px 12px rgba(0, 0, 0, 0.15)';
</script>

<template>
  <Transition name="modal">
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      @click="handleOverlayClick"
    >
      <div class="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-300" :class="{ 'opacity-0': !isVisible, 'opacity-100': isVisible }"></div>

      <div
        ref="dialogRef"
        class="relative z-10 w-full mx-auto transform transition-all duration-300 ease-out"
        :class="{
          'scale-95 opacity-0': !isVisible,
          'scale-100 opacity-100': isVisible
        }"
        style="max-width: 280px;"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="rounded-xl p-4 shadow-lg"
          style="background: white;"
        >
          <!-- Message -->
          <div
            class="text-sm font-medium mb-3"
            style="color: #374151; white-space: pre-line; line-height: 1.5;"
          >
            {{ message }}
          </div>

          <!-- Actions -->
          <div class="flex justify-end gap-2">
            <button
              v-if="type === 'confirm'"
              @click="handleCancel"
              class="px-4 py-1.5 text-sm rounded-lg transition-colors"
              style="color: #6b7280; background: #f3f4f6; border: 1px solid #e5e7eb;"
              @mouseenter="(e: Event) => (e.target as HTMLElement).style.background = '#e5e7eb'"
              @mouseleave="(e: Event) => (e.target as HTMLElement).style.background = '#f3f4f6'"
            >
              {{ cancelText }}
            </button>
            <button
              @click="handleConfirm"
              class="px-4 py-1.5 text-sm font-medium text-white rounded-lg transition-colors"
              :style="{
                background: confirmBtnColor,
                boxShadow: confirmBtnShadow
              }"
            >
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: all 0.2s ease-out;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  opacity: 0;
  transform: scale(0.95);
}

@media (max-width: 640px) {
  .relative.z-10 {
    max-width: calc(100vw - 32px) !important;
  }
}
</style>
