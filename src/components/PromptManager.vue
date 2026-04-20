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

const emit = defineEmits<{
  back: [];
}>();

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
  
  alert('✅ 提示词已保存！修改将立即生效。');
}

function resetToDefault() {
  if (!selectedId.value || !selectedPrompt.value?.isDefault) return;
  
  if (confirm('确定要重置为默认提示词吗？')) {
    resetPromptToDefault(selectedId.value);
    prompts.value = loadPrompts();
    selectPrompt(selectedId.value!);
    
    alert('✅ 已重置为默认提示词。');
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
  <div class="p-4">
    <!-- Header -->
    <div class="flex items-center justify-between mb-4">
      <button @click="emit('back')" class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h3 class="text-sm font-medium text-gray-700">📝 提示词管理</h3>
    </div>

    <!-- Filters -->
    <div class="flex gap-2 mb-3">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索提示词..."
        class="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
      />
      <select
        v-model="filterCategory"
        class="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400"
      >
        <option v-for="cat in categories" :key="cat.value" :value="cat.value">{{ cat.label }}</option>
      </select>
    </div>

    <!-- Two Column Layout -->
    <div class="flex gap-3" style="height: calc(500px - 180px);">
      <!-- Left: List -->
      <div class="w-1/2 overflow-y-auto space-y-1.5 pr-1">
        <p class="text-xs text-gray-400 mb-1">共 {{ filteredPrompts.length }} 个提示词模板</p>
        
        <div
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          @click="selectPrompt(prompt.id)"
          class="p-2.5 rounded-lg cursor-pointer transition-colors"
          :class="selectedId === prompt.id ? 'bg-blue-50 border border-blue-300' : 'bg-white/50 border border-transparent hover:bg-gray-50'"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-xs font-medium text-gray-800">{{ prompt.name }}</p>
              <p class="text-[10px] text-gray-400 mt-0.5 line-clamp-1">{{ prompt.description }}</p>
            </div>
            <span
              v-if="prompt.isDefault"
              class="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-500 rounded flex-shrink-0 ml-2"
            >默认</span>
            <span
              v-else
              class="text-[9px] px-1 py-0.5 bg-purple-50 text-purple-500 rounded flex-shrink-0 ml-2"
            >自定义</span>
          </div>
          <div class="flex items-center gap-1 mt-1">
            <span class="text-[9px] text-gray-300">{{ prompt.category }}</span>
            <span class="text-[9px] text-gray-300">·</span>
            <span class="text-[9px] text-gray-300">{{ new Date(prompt.updatedAt).toLocaleDateString() }}</span>
          </div>
        </div>

        <div v-if="filteredPrompts.length === 0" class="text-center py-4">
          <p class="text-gray-400 text-sm">无匹配的提示词</p>
        </div>
      </div>

      <!-- Right: Editor -->
      <div class="w-1/2 flex flex-col">
        <div v-if="selectedPrompt" class="h-full flex flex-col">
          <div class="mb-2 flex items-center justify-between">
            <div>
              <p class="text-xs font-medium text-gray-700">{{ selectedPrompt.name }}</p>
              <p class="text-[10px] text-gray-400">{{ selectedPrompt.description }}</p>
            </div>
            <button
              v-if="!selectedPrompt.isDefault"
              @click="deleteCustomPrompt(selectedPrompt.id)"
              class="p-1 text-red-400 hover:text-red-600"
              title="删除自定义提示词"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Variables hint -->
          <div class="mb-2 p-1.5 bg-yellow-50 rounded text-[10px] text-yellow-600">
            可用变量：{{ selectedPromptVariablesDisplay }}
          </div>

          <textarea
            v-model="editingContent"
            rows="15"
            class="flex-1 w-full p-2.5 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 resize-none"
            spellcheck="false"
          ></textarea>

          <div class="mt-2 flex gap-2">
            <button
              @click="saveEdit"
              class="flex-1 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              💾 保存修改（立即生效）
            </button>
            <button
              v-if="selectedPrompt.isDefault"
              @click="resetToDefault"
              class="py-2 px-3 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
            >
              ↩️ 重置默认
            </button>
          </div>
        </div>

        <div v-else class="h-full flex items-center justify-center text-gray-400 text-sm">
          ← 选择一个提示词进行编辑
        </div>
      </div>
    </div>
  </div>
</template>