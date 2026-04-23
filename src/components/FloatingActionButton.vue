<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { isTauri, isMobile } from '@/utils/platform';
import { useCapture } from '@/composables/useCapture';

const { manualCapture } = useCapture();

const isMobileDevice = isMobile();
const isExpanded = ref(false);
const buttonPosition = ref({ x: 20, y: 100 });
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

const FAB_SIZE = 56;
const SCREEN_PADDING = 20;

const expandMenu = () => {
  isExpanded.value = !isExpanded.value;
};

const handleQuickCapture = async () => {
  const { readText } = await import('@tauri-apps/plugin-clipboard-manager');
  const text = await readText();
  if (text) {
    await manualCapture(text);
  } else {
    await manualCapture();
  }
  isExpanded.value = false;
};

const handleShowWindow = async () => {
  if (isTauri) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const appWindow = getCurrentWindow();
    await appWindow.show();
    await appWindow.setFocus();
  }
  isExpanded.value = false;
};

const startDrag = (e: MouseEvent | TouchEvent) => {
  if (!isMobileDevice) return;

  isDragging.value = true;
  e.preventDefault();

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  dragOffset.value = {
    x: clientX - buttonPosition.value.x,
    y: clientY - buttonPosition.value.y
  };
};

const onDrag = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !isMobileDevice) return;

  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

  const newX = clientX - dragOffset.value.x;
  const newY = clientY - dragOffset.value.y;

  const maxX = window.innerWidth - FAB_SIZE - SCREEN_PADDING;
  const maxY = window.innerHeight - FAB_SIZE - SCREEN_PADDING;

  buttonPosition.value = {
    x: Math.max(SCREEN_PADDING, Math.min(maxX, newX)),
    y: Math.max(SCREEN_PADDING, Math.min(maxY, newY))
  };
};

const stopDrag = () => {
  isDragging.value = false;
};

onMounted(() => {
  if (isMobileDevice) {
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', stopDrag);
  }
});

onUnmounted(() => {
  if (isMobileDevice) {
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);
  }
});
</script>

<template>
  <div
    v-if="isMobileDevice && isTauri"
    class="fab-container"
    :style="{
      left: buttonPosition.x + 'px',
      top: buttonPosition.y + 'px'
    }"
    @mousedown="startDrag"
    @touchstart="startDrag"
  >
    <button
      class="fab-main"
      :class="{ expanded: isExpanded }"
      @click.stop="expandMenu"
    >
      <svg
        class="fab-icon"
        :class="{ rotated: isExpanded }"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
        />
      </svg>
    </button>

    <Transition name="fab-menu">
      <div v-if="isExpanded" class="fab-menu">
        <button class="fab-action" @click="handleQuickCapture" title="快速捕获">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>快速捕获</span>
        </button>

        <button class="fab-action" @click="handleShowWindow" title="打开窗口">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          <span>打开窗口</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fab-container {
  position: fixed;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  touch-action: none;
  user-select: none;
}

.fab-main {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: linear-gradient(135deg, #8b7355 0%, #6b5a47 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(139, 115, 85, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
}

.fab-main:active {
  transform: scale(0.95);
}

.fab-main.expanded {
  background: linear-gradient(135deg, #6b5a47 0%, #5a4a3a 100%);
}

.fab-icon {
  width: 24px;
  height: 24px;
  color: white;
  transition: transform 0.3s ease;
}

.fab-icon.rotated {
  transform: rotate(45deg);
}

.fab-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-left: 4px;
}

.fab-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  background: white;
  border: 1px solid rgba(139, 115, 85, 0.2);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.fab-action:hover {
  background: #faf7f4;
  transform: translateX(4px);
}

.fab-action:active {
  transform: translateX(4px) scale(0.98);
}

.fab-action svg {
  width: 20px;
  height: 20px;
  color: #8b7355;
  flex-shrink: 0;
}

.fab-action span {
  font-size: 14px;
  color: #5a4a3a;
  font-weight: 500;
}

.fab-menu-enter-active,
.fab-menu-leave-active {
  transition: all 0.3s ease;
}

.fab-menu-enter-from,
.fab-menu-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}
</style>