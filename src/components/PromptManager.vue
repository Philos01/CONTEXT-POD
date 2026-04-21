<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import {
  loadPrompts,
  getPrompt,
  updatePrompt,
  resetPromptToDefault,
  deletePrompt,
  type PromptTemplate
} from '@/services/promptService';
import { alertService } from '@/services/alertService';

const prompts = ref<PromptTemplate[]>([]);
const selectedId = ref<string | null>(null);
const editingContent = ref('');
const filterCategory = ref<'all' | PromptTemplate['category']>('all');
const searchQuery = ref('');

const categories = [
  { value: 'all', label: '全部' },
  { value: 'system', label: '系统提示词' },
  { value: 'style-extraction', label: '风格提取' },
  { value: 'quiz', label: '赛博捏脸' },
  { value: 'reply-generation', label: '回复生成' },
];

onMounted(() => {
  prompts.value = loadPrompts();
});

const filteredPrompts = computed(() => {
  let result = prompts.value;
  
  if (filterCategory.value !== 'all') {
    result = result.filter(p => p.category === filterCategory.value);
  }
  
  if (searchQuery.value.trim()) {
    const search = searchQuery.value.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.description.toLowerCase().includes(search)
    );
  }
  
  return result;
});

const selectedPrompt = computed(() => {
  if (!selectedId.value) return null;
  return prompts.value.find(p => p.id === selectedId.value) || null;
});

const selectedPromptVariablesDisplay = computed(() => {
  if (!selectedPrompt.value) return '';
  return selectedPrompt.value.variables.map(v => `{${v}}`).join(', ');
});

function selectPrompt(id: string) {
  selectedId.value = id;
  const prompt = getPrompt(id);
  if (prompt) {
    editingContent.value = prompt.content;
  }
}

function saveEdit() {
  if (!selectedId.value || !selectedPrompt.value) return;
  
  updatePrompt(selectedId.value, {
    content: editingContent.value,
  });
  
  prompts.value = loadPrompts();
  
  alertService.success('提示词已保存！修改将立即生效。');
}

function resetToDefault() {
  if (!selectedId.value || !selectedPrompt.value?.isDefault) return;
  
  if (confirm('确定要重置为默认提示词吗？')) {
    resetPromptToDefault(selectedId.value);
    prompts.value = loadPrompts();
    selectPrompt(selectedId.value!);
    
    alertService.success('已重置为默认提示词。');
  }
}

function deleteCustomPrompt(id: string) {
  const prompt = getPrompt(id);
  if (!prompt || prompt.isDefault) return;
  
  if (confirm(`确定要删除自定义提示词 "${prompt.name}" 吗？`)) {
    deletePrompt(id);
    prompts.value = loadPrompts();
    
    if (selectedId.value === id) {
      selectedId.value = null;
      editingContent.value = '';
    }
  }
}
</script>

<template>
  <div class="px-5 py-5 flex-1 flex flex-col">
    <div class="flex gap-2 mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索提示词..."
        class="input-field flex-1"
      />
      <select
        v-model="filterCategory"
        class="input-field w-32"
      >
        <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
      </select>
    </div>

    <div class="flex gap-4 flex-1 min-h-0">
      <div class="w-1/2 overflow-y-auto pr-1">
        <p class="text-xs mb-3" style="color: var(--text-tertiary);">共 {{ filteredPrompts.length }} 个提示词模板</p>
        
        <div
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          @click="selectPrompt(prompt.id)"
          class="p-3 rounded-xl cursor-pointer transition-all duration-200 mb-2 border"
          :class="selectedId === prompt.id ? 'border-[var(--accent-warm)]' : 'border-transparent hover:border-[var(--border-subtle)]'"
          :style="selectedId === prompt.id ? 'background: rgba(139, 115, 85, 0.06);' : 'background: var(--bg-secondary);'"
        >
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium truncate" style="color: var(--text-primary);">{{ prompt.name }}</p>
              <p class="text-xs mt-0.5 truncate" style="color: var(--text-tertiary);">{{ prompt.description }}</p>
            </div>
            <span
              v-if="prompt.isDefault"
              class="ml-2 text-[10px] px-2 py-0.5 rounded-lg flex-shrink-0"
              style="background: var(--bg-tertiary); color: var(--text-tertiary);"
            >默认</span>
            <span
              v-else
              class="ml-2 text-[10px] px-2 py-0.5 rounded-lg flex-shrink-0"
              style="background: rgba(139, 115, 85, 0.08); color: var(--accent-warm);"
            >自定义</span>
          </div>
          <div class="flex items-center gap-1.5 mt-2">
            <span class="text-[10px]" style="color: var(--text-tertiary);">{{ prompt.category }}</span>
            <span class="text-[10px]" style="color: var(--text-tertiary);">·</span>
            <span class="text-[10px]" style="color: var(--text-tertiary);">{{ new Date(prompt.updatedAt).toLocaleDateString() }}</span>
          </div>
        </div>

        <div v-if="filteredPrompts.length === 0" class="py-8 text-center">
          <svg class="w-10 h-10 mx-auto mb-2" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p class="text-sm" style="color: var(--text-tertiary);">无匹配的提示词</p>
        </div>
      </div>

      <div class="w-1/2 flex flex-col">
        <div v-if="selectedPrompt" class="flex flex-col flex-1">
          <div class="mb-3 flex items-start justify-between">
            <div>
              <p class="text-sm font-medium" style="color: var(--text-primary);">{{ selectedPrompt.name }}</p>
              <p class="text-xs" style="color: var(--text-tertiary);">{{ selectedPrompt.description }}</p>
            </div>
            <button
              v-if="!selectedPrompt.isDefault"
              @click="deleteCustomPrompt(selectedPrompt.id)"
              class="icon-btn text-red-400 hover:text-red-600 hover:bg-red-50"
              title="删除自定义提示词"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div class="mb-3 p-3 rounded-xl" style="background: rgba(139, 115, 85, 0.06); border: 1px solid rgba(139, 115, 85, 0.1);">
            <p class="text-xs font-medium" style="color: var(--accent-warm);">可用变量：{{ selectedPromptVariablesDisplay }}</p>
          </div>

          <textarea
            v-model="editingContent"
            rows="12"
            class="flex-1 w-full p-3 text-sm rounded-xl border resize-none"
            style="font-family: monospace; background: white; border-color: var(--border-subtle); color: var(--text-primary);"
            spellcheck="false"
          ></textarea>

          <div class="mt-3 flex gap-2">
            <button
              @click="saveEdit"
              class="btn-primary flex-1"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              保存修改
            </button>
            <button
              v-if="selectedPrompt.isDefault"
              @click="resetToDefault"
              class="btn-secondary"
            >
              重置默认
            </button>
          </div>
        </div>

        <div v-else class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <svg class="w-12 h-12 mx-auto mb-3" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
            </svg>
            <p class="text-sm" style="color: var(--text-tertiary);">选择一个提示词进行编辑</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
