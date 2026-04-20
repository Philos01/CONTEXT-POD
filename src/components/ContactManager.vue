<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useContactStore } from '@/stores/contactStore';
import { useAppStore } from '@/stores/appStore';
import { getPersona, savePersona } from '@/services/personaService';
import { 
  getBufferByContact, 
  getUnprocessedCount, 
  updateBufferEntry, 
  deleteBufferEntry,
  triggerPersonaUpdate,
  getEvolutionStatus,
  onEvolutionStatusChange,
  EVOLUTION_THRESHOLD,
  type ChatBufferEntry,
  type EvolutionStatus
} from '@/services/evolutionEngine';
import type { StylePersona } from '@/types';

const emit = defineEmits<{
  back: [];
  'open-extractor': [contactName: string];
}>();

const contactStore = useContactStore();
const appStore = useAppStore();

const newName = ref('');
const newPersonality = ref('');
const newTags = ref('');
const showForm = ref(false);
const editingContactId = ref<string | null>(null);
const editingName = ref('');
const editingPersonality = ref('');
const editingTags = ref('');
const expandedPersona = ref<string | null>(null);
const expandedBuffer = ref<string | null>(null);
const editingPersona = ref<StylePersona | null>(null);
const personaMap = ref<Record<string, StylePersona>>({});
const bufferEntries = ref<Record<string, ChatBufferEntry[]>>({});
const bufferCounts = ref<Record<string, number>>({});
const evolutionStatus = ref<EvolutionStatus>(getEvolutionStatus());
const isEvolving = ref<Record<string, boolean>>({});
const editingEntryId = ref<string | null>(null);
const editingContent = ref('');

onMounted(() => {
  for (const contact of contactStore.contacts) {
    const persona = getPersona(contact.name);
    if (persona) {
      personaMap.value[contact.name] = persona;
    }
    
    // 加载缓冲区数据
    loadBufferForContact(contact.name);
  }
  
  onEvolutionStatusChange((status) => {
    evolutionStatus.value = status;
    if (!status.isEvolving) {
      for (const name in isEvolving.value) {
        isEvolving.value[name] = false;
      }
      // 刷新缓冲区数据
      for (const contact of contactStore.contacts) {
        loadBufferForContact(contact.name);
      }
    }
  });
});

function loadBufferForContact(contactName: string) {
  bufferEntries.value[contactName] = getBufferByContact(contactName);
  bufferCounts.value[contactName] = getUnprocessedCount(contactName);
}

function refreshAllBufferCounts() {
  for (const contact of contactStore.contacts) {
    loadBufferForContact(contact.name);
  }
}

async function handleAddContact() {
  if (!newName.value.trim() || !newPersonality.value.trim()) return;

  const tags = newTags.value
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  await contactStore.addContact(newName.value.trim(), newPersonality.value.trim(), tags);

  newName.value = '';
  newPersonality.value = '';
  newTags.value = '';
  showForm.value = false;
}

function handleRemove(id: string) {
  contactStore.removeContact(id);
}

function startEditContact(contact: { id: string; name: string; personality: string; tags: string[] }) {
  editingContactId.value = contact.id;
  editingName.value = contact.name;
  editingPersonality.value = contact.personality;
  editingTags.value = contact.tags.join(', ');
}

function saveEditContact(id: string) {
  const contact = contactStore.contacts.find(c => c.id === id);
  const oldName = contact?.name || '';
  const newName = editingName.value.trim();
  
  console.log(`[ContactManager] Renaming contact from "${oldName}" to "${newName}"`);
  
  const tags = editingTags.value
    .split(/[,，\s]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  contactStore.updateContact(id, {
    name: newName,
    personality: editingPersonality.value.trim(),
    tags,
  });
  
  // 如果名字发生了变化，刷新当前页面的数据
  if (oldName && oldName !== newName) {
    console.log(`[ContactManager] Name changed, refreshing data`);
    
    // 重新初始化 personaMap
    for (const c of contactStore.contacts) {
      const persona = getPersona(c.name);
      if (persona) {
        personaMap.value[c.name] = persona;
      }
    }
    // 删除旧名字的条目
    if (personaMap.value[oldName]) {
      delete personaMap.value[oldName];
    }
    
    // 刷新缓冲区数据
    refreshAllBufferCounts();
  }
  
  editingContactId.value = null;
}

function cancelEdit() {
  editingContactId.value = null;
}

function togglePersona(name: string) {
  if (expandedPersona.value === name) {
    expandedPersona.value = null;
    editingPersona.value = null;
  } else {
    expandedPersona.value = name;
    const persona = getPersona(name);
    editingPersona.value = persona ? { ...persona, catchphrases: [...persona.catchphrases] } : null;
  }
}

function toggleBuffer(name: string) {
  if (expandedBuffer.value === name) {
    expandedBuffer.value = null;
    editingEntryId.value = null;
  } else {
    expandedBuffer.value = name;
    loadBufferForContact(name);
  }
}

function startEditPersona(name: string) {
  const persona = getPersona(name);
  if (persona) {
    editingPersona.value = { ...persona, catchphrases: [...persona.catchphrases] };
  }
}

function savePersonaEdit(name: string) {
  if (editingPersona.value) {
    savePersona(name, editingPersona.value);
    personaMap.value[name] = editingPersona.value;
    expandedPersona.value = null;
    editingPersona.value = null;
  }
}

function cancelPersonaEdit() {
  editingPersona.value = null;
}

function addCatchphrase() {
  if (editingPersona.value) {
    editingPersona.value.catchphrases.push('');
  }
}

function removeCatchphrase(index: number) {
  if (editingPersona.value) {
    editingPersona.value.catchphrases.splice(index, 1);
  }
}

function deletePersona(name: string) {
  const personas = JSON.parse(localStorage.getItem('context-pod-personas') || '{}');
  delete personas[name];
  localStorage.setItem('context-pod-personas', JSON.stringify(personas));
  delete personaMap.value[name];
  expandedPersona.value = null;
  editingPersona.value = null;
}

// 缓冲区编辑功能
function startEditEntry(entry: ChatBufferEntry) {
  editingEntryId.value = entry.id;
  editingContent.value = entry.content;
}

function saveEditEntry(entry: ChatBufferEntry) {
  if (updateBufferEntry(entry.id, editingContent.value)) {
    loadBufferForContact(entry.contactName);
  }
  editingEntryId.value = null;
}

function cancelEditEntry() {
  editingEntryId.value = null;
}

function handleDeleteEntry(entry: ChatBufferEntry) {
  if (deleteBufferEntry(entry.id)) {
    loadBufferForContact(entry.contactName);
  }
}

async function handleManualEvolution(contactName: string) {
  if (evolutionStatus.value.isEvolving) return;
  
  isEvolving.value[contactName] = true;
  
  try {
    const result = await triggerPersonaUpdate(contactName, appStore.settings, true);
    
    if (result.success && result.persona) {
      personaMap.value[contactName] = result.persona;
      alert(`✅ 成功进化 "${contactName}" 的风格画像！\n处理了 ${result.processedCount} 条消息`);
    } else {
      alert(`❌ 进化失败，请检查是否有足够的缓冲区消息`);
    }
  } catch (error) {
    console.error('[Context-Pod] Manual evolution failed:', error);
    alert('❌ 进化过程中发生错误');
  } finally {
    isEvolving.value[contactName] = false;
    loadBufferForContact(contactName);
  }
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

defineExpose({
  refreshAllBufferCounts,
});
</script>

<template>
  <div class="p-4">
    <div class="flex items-center justify-between mb-4">
      <button @click="emit('back')" class="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
        返回
      </button>
      <h3 class="text-sm font-medium text-gray-700">联系人管理</h3>
      <span class="text-xs text-gray-400">{{ contactStore.contactCount }} 人</span>
    </div>

    <!-- Add Button -->
    <button
      v-if="!showForm"
      @click="showForm = true"
      class="w-full py-2.5 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
    >
      + 添加联系人
    </button>

    <!-- Add Form -->
    <div v-if="showForm" class="mb-4 p-3 bg-white/50 rounded-xl space-y-2">
      <input
        v-model="newName"
        type="text"
        placeholder="联系人姓名"
        class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
      />
      <textarea
        v-model="newPersonality"
        placeholder="性格特点描述（如：脾气急躁，爱画大饼，喜欢被夸）"
        rows="2"
        class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400 resize-none"
      ></textarea>
      <input
        v-model="newTags"
        type="text"
        placeholder="标签（逗号分隔，如：领导, 急躁）"
        class="w-full px-3 py-2 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
      />
      <div class="flex gap-2">
        <button
          @click="handleAddContact"
          class="flex-1 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          保存
        </button>
        <button
          @click="showForm = false"
          class="flex-1 py-2 text-sm bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
        >
          取消
        </button>
      </div>
    </div>

    <!-- Contact List -->
    <div class="space-y-2 max-h-[450px] overflow-y-auto">
      <div
        v-for="contact in contactStore.contacts"
        :key="contact.id"
        class="bg-white/50 rounded-xl group"
      >
        <!-- Normal View -->
        <div v-if="editingContactId !== contact.id" class="p-3">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-sm font-medium text-gray-800">{{ contact.name }}</p>
                <span v-if="personaMap[contact.name]" class="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full">🎭 有风格</span>
              </div>
              <p class="text-xs text-gray-500 mt-0.5 line-clamp-2">{{ contact.personality }}</p>
              <div v-if="contact.tags.length" class="flex flex-wrap gap-1 mt-1.5">
                <span
                  v-for="tag in contact.tags"
                  :key="tag"
                  class="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                @click="startEditContact(contact)"
                class="p-1 text-gray-300 hover:text-blue-400 transition-colors"
                title="编辑"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="handleRemove(contact.id)"
                class="p-1 text-gray-300 hover:text-red-400 transition-colors"
                title="删除"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Persona Toggle -->
          <button
            @click="togglePersona(contact.name)"
            class="mt-2 w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors"
            :class="expandedPersona === contact.name ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'"
          >
            <span v-if="personaMap[contact.name]">
              {{ expandedPersona === contact.name ? '▼ 收起风格画像' : '▶ 查看风格画像' }}
            </span>
            <span v-else class="text-gray-300">
              未提取风格 · 点击 🎭提取风格 添加
            </span>
          </button>

          <!-- Buffer Toggle -->
          <button
            @click="toggleBuffer(contact.name)"
            class="mt-1 w-full text-left px-2 py-1.5 text-xs rounded-lg transition-colors"
            :class="[expandedBuffer === contact.name ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400 hover:bg-gray-100', bufferCounts[contact.name] > 0 ? '' : 'opacity-60']"
          >
            <span>
              {{ expandedBuffer === contact.name ? '▼ 收起缓冲区' : '▶ 聊天缓冲区' }}
              <span v-if="bufferCounts[contact.name] > 0" :class="bufferCounts[contact.name] >= EVOLUTION_THRESHOLD ? 'ml-1 px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full text-[10px]' : 'ml-1 text-blue-400'">
                {{ bufferCounts[contact.name] }}条{{ bufferCounts[contact.name] >= EVOLUTION_THRESHOLD ? ' · 可进化' : '' }}
              </span>
              <span v-else-if="!expandedBuffer" class="ml-1 text-gray-300">(空)</span>
            </span>
          </button>

          <!-- Persona Display / Edit -->
          <div v-if="expandedPersona === contact.name" class="mt-2">
            <!-- View Mode -->
            <div v-if="!editingPersona && personaMap[contact.name]" class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 space-y-1.5">
              <div v-for="(value, key) in { '断句排版': personaMap[contact.name].sentenceStyle, '情绪风格': personaMap[contact.name].emotionLevel, '词汇特征': personaMap[contact.name].vocabFeatures, '标点习惯': personaMap[contact.name].punctuationHabits }" :key="key">
                <span class="text-[10px] font-medium text-amber-600">{{ key }}：</span>
                <span class="text-[10px] text-amber-500">{{ value }}</span>
              </div>
              <div>
                <span class="text-[10px] font-medium text-amber-600">口癖语气：</span>
                <span class="text-[10px] text-amber-500">{{ personaMap[contact.name].catchphrases.join('、') || '无' }}</span>
              </div>
              <div class="pt-1 border-t border-amber-200">
                <span class="text-[10px] font-medium text-amber-600">风格总结：</span>
                <span class="text-[10px] text-amber-500">{{ personaMap[contact.name].summary }}</span>
              </div>
              <div class="flex gap-1.5 pt-1">
                <button
                  @click="startEditPersona(contact.name)"
                  class="flex-1 py-1.5 text-[10px] bg-amber-100 text-amber-600 rounded hover:bg-amber-200 transition-colors"
                >
                  ✏️ 编辑
                </button>
                <button
                  @click="deletePersona(contact.name)"
                  class="py-1.5 px-2 text-[10px] bg-red-50 text-red-400 rounded hover:bg-red-100 transition-colors"
                >
                  🗑️ 删除
                </button>
              </div>
            </div>

            <!-- Edit Mode -->
            <div v-if="editingPersona" class="p-2.5 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">断句排版</label>
                <input
                  v-model="editingPersona.sentenceStyle"
                  class="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">情绪风格</label>
                <input
                  v-model="editingPersona.emotionLevel"
                  class="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">词汇特征</label>
                <input
                  v-model="editingPersona.vocabFeatures"
                  class="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">标点习惯</label>
                <input
                  v-model="editingPersona.punctuationHabits"
                  class="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                />
              </div>
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">口癖语气</label>
                <div class="space-y-1">
                  <div v-for="(_, index) in editingPersona.catchphrases" :key="index" class="flex gap-1">
                    <input
                      v-model="editingPersona.catchphrases[index]"
                      class="flex-1 px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                    <button
                      @click="removeCatchphrase(index)"
                      class="px-1.5 text-xs text-red-400 hover:text-red-600"
                    >
                      ×
                    </button>
                  </div>
                  <button
                    @click="addCatchphrase"
                    class="text-[10px] text-amber-500 hover:text-amber-700"
                  >
                    + 添加口癖
                  </button>
                </div>
              </div>
              <div>
                <label class="text-[10px] font-medium text-amber-600 block mb-0.5">风格总结</label>
                <textarea
                  v-model="editingPersona.summary"
                  rows="2"
                  class="w-full px-2 py-1 text-xs border border-amber-200 rounded focus:outline-none focus:ring-1 focus:ring-amber-300 resize-none"
                ></textarea>
              </div>
              <div class="flex gap-1.5">
                <button
                  @click="savePersonaEdit(contact.name)"
                  class="flex-1 py-1.5 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors"
                >
                  💾 保存修改
                </button>
                <button
                  @click="cancelPersonaEdit"
                  class="flex-1 py-1.5 text-[10px] bg-gray-100 text-gray-500 rounded hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>

          <!-- Buffer Display / Edit -->
          <div v-if="expandedBuffer === contact.name" class="mt-2">
            <div class="p-2.5 bg-blue-50 rounded-lg border border-blue-200 space-y-2">
              <!-- Header with manual trigger button -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-medium text-blue-600">
                    缓冲区内容 ({{ bufferCounts[contact.name] || 0 }}条)
                  </span>
                  <span v-if="(bufferCounts[contact.name] || 0) >= EVOLUTION_THRESHOLD" class="text-[10px] px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded-full">
                    可自动进化
                  </span>
                </div>
                <button
                  @click="handleManualEvolution(contact.name)"
                  :disabled="evolutionStatus.isEvolving || isEvolving[contact.name] || (bufferCounts[contact.name] || 0) === 0"
                  class="py-1 px-2 text-[10px] rounded transition-colors"
                  :class="(bufferCounts[contact.name] || 0) > 0 ? 'bg-purple-500 text-white hover:bg-purple-600' : 'bg-gray-200 text-gray-400 cursor-not-allowed'"
                >
                  <span v-if="isEvolving[contact.name]" class="inline-flex items-center gap-1">
                    <svg class="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    进化中...
                  </span>
                  <span v-else>🧬 手动进化</span>
                </button>
              </div>

              <!-- Empty State -->
              <div v-if="!(bufferEntries[contact.name]?.length)" class="text-center py-3">
                <p class="text-[10px] text-gray-400">暂无缓冲区消息</p>
                <p class="text-[10px] text-gray-300 mt-0.5">捕获聊天后，消息会自动存入此处</p>
              </div>

              <!-- Buffer Entries List -->
              <div v-else class="space-y-1.5 max-h-[150px] overflow-y-auto">
                <div
                  v-for="entry in bufferEntries[contact.name]"
                  :key="entry.id"
                  class="p-1.5 bg-white/70 rounded border border-blue-100 group"
                >
                  <!-- View Mode -->
                  <div v-if="editingEntryId !== entry.id" class="flex items-start justify-between gap-1">
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1 mb-0.5">
                        <span class="text-[9px] px-1 py-0.25 rounded" :class="entry.role === 'partner' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'">
                          {{ entry.role === 'partner' ? contact.name : '我' }}
                        </span>
                        <span class="text-[9px] text-gray-400">{{ formatTime(entry.timestamp) }}</span>
                      </div>
                      <p class="text-[10px] text-gray-700 line-clamp-2 break-all">{{ entry.content }}</p>
                    </div>
                    <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        @click="startEditEntry(entry)"
                        class="p-0.5 text-gray-300 hover:text-blue-400 transition-colors"
                        title="编辑"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        @click="handleDeleteEntry(entry)"
                        class="p-0.5 text-gray-300 hover:text-red-400 transition-colors"
                        title="删除"
                      >
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Edit Mode -->
                  <div v-else class="space-y-1">
                    <textarea
                      v-model="editingContent"
                      rows="2"
                      class="w-full px-2 py-1 text-[10px] border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-300 resize-none"
                    ></textarea>
                    <div class="flex gap-1 justify-end">
                      <button
                        @click="saveEditEntry(entry)"
                        class="px-2 py-0.5 text-[9px] bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        保存
                      </button>
                      <button
                        @click="cancelEditEntry()"
                        class="px-2 py-0.5 text-[9px] bg-gray-100 text-gray-500 rounded hover:bg-gray-200"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Evolution Info -->
              <div class="pt-1.5 border-t border-blue-200">
                <p class="text-[9px] text-gray-400">
                  自动进化阈值：{{ EVOLUTION_THRESHOLD }}条 · 当前：{{ bufferCounts[contact.name] || 0 }}条
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Edit Contact View -->
        <div v-else class="p-3 space-y-2">
          <input
            v-model="editingName"
            type="text"
            class="w-full px-3 py-1.5 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <textarea
            v-model="editingPersonality"
            rows="2"
            class="w-full px-3 py-1.5 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400 resize-none"
          ></textarea>
          <input
            v-model="editingTags"
            type="text"
            placeholder="标签（逗号分隔）"
            class="w-full px-3 py-1.5 text-sm bg-white/80 rounded-lg border border-gray-200 focus:outline-none focus:border-blue-400"
          />
          <div class="flex gap-2">
            <button
              @click="saveEditContact(contact.id)"
              class="flex-1 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              保存
            </button>
            <button
              @click="cancelEdit"
              class="flex-1 py-1.5 text-xs bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      <div v-if="contactStore.contacts.length === 0" class="text-center py-6">
        <p class="text-gray-400 text-sm">暂无联系人</p>
        <p class="text-gray-300 text-xs mt-1">添加联系人后，AI 将根据性格特点定制回复</p>
      </div>
    </div>
  </div>
</template>
