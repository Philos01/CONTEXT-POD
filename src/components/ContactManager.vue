<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useContactStore } from '@/stores/contactStore';
import { useAppStore } from '@/stores/appStore';
import type { Contact } from '@/types';
import {
  getBufferByContact,
  getPendingCountsByContact,
  triggerPersonaUpdate,
  deleteBufferEntry,
  type ChatBufferEntry,
} from '@/services/evolutionEngine';
import { getDynamicPersona, saveDynamicPersona } from '@/services/personaService';
import type { DynamicPersonaSchema } from '@/types';
import { alertService } from '@/services/alertService';

const contactStore = useContactStore();
const appStore = useAppStore();

const contacts = ref<Contact[]>([]);
const searchQuery = ref('');
const showAddForm = ref(false);
const newContactName = ref('');
const newContactPersonality = ref('');
const newContactIdentity = ref('');
const editingId = ref<string | null>(null);
const editName = ref('');
const editPersonality = ref('');
const editIdentity = ref('');
const expandedContactId = ref<string | null>(null);
const bufferExpandedContactId = ref<string | null>(null);
const contactBuffers = ref<Record<string, ChatBufferEntry[]>>({});
const isUpdatingPersona = ref<string | null>(null);
const isEditingPersona = ref<string | null>(null);
const editingPersonaData = ref<DynamicPersonaSchema | null>(null);

onMounted(async () => {
  await contactStore.initDb();
  contacts.value = contactStore.contacts;
  loadAllBuffers();
});

function loadAllBuffers() {
  const pendingCounts = getPendingCountsByContact();
  for (const contact of contacts.value) {
    if (pendingCounts[contact.name] > 0) {
      contactBuffers.value[contact.name] = getBufferByContact(contact.name);
    }
  }
}

function loadBufferForContact(contactName: string) {
  contactBuffers.value[contactName] = getBufferByContact(contactName);
}

async function refreshContacts() {
  contacts.value = [...contactStore.contacts];
}

async function addContact() {
  if (!newContactName.value.trim()) return;

  await contactStore.addContact(
    newContactName.value.trim(),
    newContactPersonality.value.trim() || '待观察',
    []
  );

  if (newContactIdentity.value.trim()) {
    const contacts = contactStore.contacts;
    const newContact = contacts[contacts.length - 1];
    if (newContact) {
      await contactStore.updateContact(newContact.id, {
        identity: newContactIdentity.value.trim(),
      });
    }
  }

  newContactName.value = '';
  newContactPersonality.value = '';
  newContactIdentity.value = '';
  showAddForm.value = false;
  await refreshContacts();
}

async function deleteContact(id: string) {
  if (!confirm('确定要删除这个联系人吗？')) return;

  await contactStore.removeContact(id);
  await refreshContacts();
}

async function updateContact(id: string) {
  if (!editName.value.trim()) return;

  await contactStore.updateContact(id, {
    name: editName.value.trim(),
    personality: editPersonality.value.trim(),
    identity: editIdentity.value.trim(),
  });

  editingId.value = null;
  editName.value = '';
  editPersonality.value = '';
  editIdentity.value = '';
  await refreshContacts();
}

function startEdit(contact: Contact) {
  editingId.value = contact.id;
  editName.value = contact.name;
  editPersonality.value = contact.personality || '';
  editIdentity.value = (contact as any).identity || '';
}

function cancelEdit() {
  editingId.value = null;
  editName.value = '';
  editPersonality.value = '';
  editIdentity.value = '';
}

function toggleExpand(contactId: string) {
  expandedContactId.value = expandedContactId.value === contactId ? null : contactId;
}

function toggleBufferExpand(contactName: string) {
  if (bufferExpandedContactId.value === contactName) {
    bufferExpandedContactId.value = null;
  } else {
    bufferExpandedContactId.value = contactName;
    loadBufferForContact(contactName);
  }
}

function getPersonaForContact(contactName: string) {
  return getDynamicPersona(contactName);
}

function hasPersonaData(contactName: string): boolean {
  const persona = getDynamicPersona(contactName);
  if (!persona) return false;
  const hasPowerIdentity = !!(persona.powerIdentity && persona.powerIdentity.length > 0);
  const hasPsychologicalNeeds = !!(persona.psychologicalNeeds && persona.psychologicalNeeds.length > 0);
  const hasTaboos = !!(persona.taboos && persona.taboos.length > 0);
  const hasTemperature = !!(persona.temperature && persona.temperature > 0);
  return hasPowerIdentity || hasPsychologicalNeeds || hasTaboos || hasTemperature;
 }

async function updatePersonality(contactName: string) {
  if (!appStore.isConfigured) {
    alertService.warning('请先在设置中配置 API Key');
    return;
  }

  isUpdatingPersona.value = contactName;
  
  try {
    const result = await triggerPersonaUpdate(contactName, appStore.settings, true);
    
    if (result.success) {
      // 显示简洁的成功提示
      alertService.success(`风格更新成功！\n已处理 ${result.processedCount} 条对话记录。`);
      loadBufferForContact(contactName);
    } else {
      const bufferCount = getBufferByContact(contactName).length;
      alertService.warning(`更新条件不足\n需要至少 1 条对话记录，当前有 ${bufferCount} 条。`);
    }
  } catch (error) {
    alertService.error(`更新失败: ${error}`);
  } finally {
    isUpdatingPersona.value = null;
  }
}

function clearContactBuffer(contactName: string) {
  if (!confirm(`确定要清除 ${contactName} 的所有对话缓存吗？`)) return;
  
  const buffer = getBufferByContact(contactName);
  const ids = buffer.map(e => e.id);
  
  for (const id of ids) {
    deleteBufferEntry(id);
  }
  
  loadBufferForContact(contactName);
  alertService.success('对话缓存已清除');
}

function getPendingCount(contactName: string): number {
  const counts = getPendingCountsByContact();
  return counts[contactName] || 0;
}

function startEditPersona(contactName: string) {
  const persona = getDynamicPersona(contactName);
  if (!persona) {
    editingPersonaData.value = {
      targetId: contactName,
      updateTick: 0,
      powerIdentity: [{ trait: '待补充', confidence: 0.5, observationsCount: 0, decayRate: 0 }],
      psychologicalNeeds: [{ need: '待补充', weight: 0.5 }],
      taboos: [{ rule: '待补充', riskFactor: 0.5 }],
      temperature: 5,
      textStyle: '待补充',
      experienceEvents: [],
      summary: '待补充',
      sampleCount: 0,
      updatedAt: Date.now(),
    };
  } else {
    editingPersonaData.value = JSON.parse(JSON.stringify(persona));
  }
  isEditingPersona.value = contactName;
}

function cancelEditPersona() {
  isEditingPersona.value = null;
  editingPersonaData.value = null;
}

function savePersonaEdit(contactName: string) {
  if (!editingPersonaData.value) return;
  
  editingPersonaData.value.updatedAt = Date.now();
  saveDynamicPersona(contactName, editingPersonaData.value);
  isEditingPersona.value = null;
  editingPersonaData.value = null;
}

function addPersonaTrait(type: 'powerIdentity' | 'psychologicalNeeds' | 'taboos') {
  if (!editingPersonaData.value) return;
  
  if (type === 'powerIdentity') {
    editingPersonaData.value.powerIdentity.push({ trait: '', confidence: 0.5, observationsCount: 0, decayRate: 0 });
  } else if (type === 'psychologicalNeeds') {
    editingPersonaData.value.psychologicalNeeds.push({ need: '', weight: 0.5 });
  } else {
    editingPersonaData.value.taboos.push({ rule: '', riskFactor: 0.5 });
  }
}

function removePersonaTrait(type: 'powerIdentity' | 'psychologicalNeeds' | 'taboos', index: number) {
  if (!editingPersonaData.value) return;
  
  if (type === 'powerIdentity') {
    editingPersonaData.value.powerIdentity.splice(index, 1);
  } else if (type === 'psychologicalNeeds') {
    editingPersonaData.value.psychologicalNeeds.splice(index, 1);
  } else {
    editingPersonaData.value.taboos.splice(index, 1);
  }
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getTagColor(tag: string): string {
  const colors = [
    'rgba(139, 115, 85, 0.08)',
    'rgba(59, 130, 246, 0.08)',
    'rgba(34, 197, 94, 0.08)',
    'rgba(234, 179, 8, 0.08)',
    'rgba(168, 85, 247, 0.08)',
  ];

  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}
</script>

<template>
  <div class="px-5 py-5 flex-1 flex flex-col">
    <div class="flex gap-2 mb-4">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="搜索联系人..."
        class="input-field flex-1"
      />
      <button
        @click="showAddForm = !showAddForm"
        class="btn-primary"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path v-if="!showAddForm" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4" />
          <path v-else stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 12H4" />
        </svg>
        {{ showAddForm ? '收起' : '添加' }}
      </button>
    </div>

    <div v-if="showAddForm" class="p-4 rounded-xl mb-4 space-y-3" style="background: var(--bg-secondary); border: 1px solid var(--border-light);">
      <input
        v-model="newContactName"
        type="text"
        placeholder="联系人名称"
        class="input-field"
      />
      <input
        v-model="newContactIdentity"
        type="text"
        placeholder="身份背景（可选）例：相亲对象、客户、同事、多年老友"
        class="input-field"
      />
      <textarea
        v-model="newContactPersonality"
        type="text"
        placeholder="性格描述（可选）例：内向、喜欢开玩笑、控制欲强"
        class="input-field resize-none"
        rows="2"
      ></textarea>
      <button
        @click="addContact"
        class="btn-primary w-full"
      >
        添加联系人
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div
        v-for="contact in contacts"
        :key="contact.id"
        class="mb-3"
      >
        <div
          class="p-4 rounded-2xl transition-all"
          style="background: var(--bg-secondary); border: 1px solid var(--border-light);"
        >
          <div v-if="editingId !== contact.id" class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <p class="text-sm font-medium" style="color: var(--text-primary);">{{ contact.name }}</p>
                <span
                  v-if="(contact as any).identity"
                  class="text-[10px] px-2 py-0.5 rounded-lg"
                  style="background: rgba(139, 115, 85, 0.08); color: var(--accent-warm);"
                >
                  {{ (contact as any).identity }}
                </span>
                <span
                  v-if="getPendingCount(contact.name) > 0"
                  class="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
                  style="background: rgba(139, 115, 85, 0.12); color: var(--accent-warm);"
                >
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {{ getPendingCount(contact.name) }}条缓存
                </span>
              </div>
              <p v-if="contact.personality" class="text-xs mt-0.5 truncate" style="color: var(--text-tertiary);">
                {{ contact.personality }}
              </p>
              <div v-if="contact.tags && contact.tags.length > 0" class="flex flex-wrap gap-1.5 mt-2">
                <span
                  v-for="tag in contact.tags"
                  :key="tag"
                  class="text-[10px] px-2 py-0.5 rounded-lg"
                  :style="{ background: getTagColor(tag), color: 'var(--text-secondary)' }"
                >
                  {{ tag }}
                </span>
              </div>
            </div>
            <div class="flex gap-1 ml-3">
              <button
                @click="toggleExpand(contact.id)"
                class="icon-btn"
                :class="expandedContactId === contact.id ? 'text-[var(--accent-warm)]' : ''"
                title="查看详情"
              >
                <svg class="w-4 h-4 transition-transform" :class="expandedContactId === contact.id ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                @click="startEdit(contact)"
                class="icon-btn"
                title="编辑"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                @click="deleteContact(contact.id)"
                class="icon-btn text-red-400 hover:text-red-600 hover:bg-red-50"
                title="删除"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          <div v-else class="space-y-3">
            <input
              v-model="editName"
              type="text"
              placeholder="联系人名称"
              class="input-field"
            />
            <input
              v-model="editIdentity"
              type="text"
              placeholder="身份背景（可选）例：相亲对象、客户、同事、多年老友"
              class="input-field"
            />
            <textarea
              v-model="editPersonality"
              type="text"
              placeholder="性格描述"
              class="input-field resize-none"
              rows="2"
            ></textarea>
            <div class="flex gap-2">
              <button @click="cancelEdit" class="btn-secondary flex-1">取消</button>
              <button @click="updateContact(contact.id)" class="btn-primary flex-1">保存</button>
            </div>
          </div>

          <div v-if="expandedContactId === contact.id" class="mt-4 pt-4 space-y-4" style="border-top: 1px solid var(--border-light);">
            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-medium" style="color: var(--text-secondary);">
                  <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  对话缓存
                  <span v-if="getPendingCount(contact.name) > 0" class="ml-1 text-[var(--accent-warm)]">({{ getPendingCount(contact.name) }}条)</span>
                </p>
                <div class="flex gap-1">
                  <button
                    @click="toggleBufferExpand(contact.name)"
                    class="icon-btn text-xs px-2 py-1"
                  >
                    {{ bufferExpandedContactId === contact.name ? '收起' : '展开' }}
                  </button>
                  <button
                    v-if="getPendingCount(contact.name) > 0"
                    @click="clearContactBuffer(contact.name)"
                    class="icon-btn text-xs px-2 py-1 text-red-400 hover:text-red-600"
                  >
                    清除
                  </button>
                </div>
              </div>

              <div v-if="bufferExpandedContactId === contact.name" class="space-y-2 max-h-40 overflow-y-auto">
                <div
                  v-for="entry in contactBuffers[contact.name]"
                  :key="entry.id"
                  class="p-2 rounded-lg text-xs"
                  :style="{ background: entry.role === 'partner' ? 'rgba(139, 115, 85, 0.06)' : 'rgba(59, 130, 246, 0.06)' }"
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="font-medium" :style="{ color: entry.role === 'partner' ? 'var(--accent-warm)' : '#3b82f6' }">
                      {{ entry.role === 'partner' ? contact.name : '我' }}
                    </span>
                    <span style="color: var(--text-tertiary);">{{ formatTime(entry.timestamp) }}</span>
                  </div>
                  <p class="truncate" style="color: var(--text-secondary);">{{ entry.content }}</p>
                </div>
                <p v-if="!contactBuffers[contact.name] || contactBuffers[contact.name].length === 0" class="text-xs text-center py-2" style="color: var(--text-tertiary);">
                  暂无缓存数据
                </p>
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-medium" style="color: var(--text-secondary);">
                  <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  人物风格画像
                </p>
                <div class="flex gap-2">
                  <button
                    @click="startEditPersona(contact.name)"
                    class="btn-secondary text-xs px-3 py-1.5"
                    title="手动编辑画像"
                  >
                    <svg class="w-3 h-3 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    编辑
                  </button>
                  <button
                    @click="updatePersonality(contact.name)"
                    :disabled="isUpdatingPersona === contact.name"
                    class="btn-secondary text-xs px-3 py-1.5"
                  >
                    <svg v-if="isUpdatingPersona === contact.name" class="w-3 h-3 animate-spin inline-block mr-1" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {{ isUpdatingPersona === contact.name ? '更新中...' : '更新画像' }}
                  </button>
                </div>
              </div>

              <div
                v-if="isEditingPersona === contact.name && editingPersonaData"
                class="p-4 rounded-xl space-y-4"
                style="background: rgba(139, 115, 85, 0.04); border: 1px solid rgba(139, 115, 85, 0.1);"
              >
                <div>
                  <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: var(--accent-warm);">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    权力身份特征
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="(trait, idx) in editingPersonaData.powerIdentity"
                      :key="idx"
                      class="p-3 rounded-xl space-y-2"
                      style="background: white; border: 1px solid var(--border-light);"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">特征 #{{ idx + 1 }}</span>
                        <button
                          @click="removePersonaTrait('powerIdentity', idx)"
                          class="text-red-400 hover:text-red-600 p-1 transition-colors"
                          title="删除"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        v-model="trait.trait"
                        type="text"
                        placeholder="输入特征描述，如：强势、控制欲强..."
                        class="input-field text-xs"
                      />
                      <div class="flex items-center gap-3">
                        <span class="text-[10px]" style="color: var(--text-tertiary);">置信度</span>
                        <input
                          v-model.number="trait.confidence"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="flex-1"
                        />
                        <span class="text-xs font-medium" style="color: var(--text-primary); min-width: 32px; text-align: right;">{{ (trait.confidence * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                    <button
                      @click="addPersonaTrait('powerIdentity')"
                      class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
                      style="border-color: var(--border-light); color: var(--accent-warm);"
                    >
                      <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加特征
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: var(--accent-warm);">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    核心诉求
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="(need, idx) in editingPersonaData.psychologicalNeeds"
                      :key="idx"
                      class="p-3 rounded-xl space-y-2"
                      style="background: white; border: 1px solid var(--border-light);"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">诉求 #{{ idx + 1 }}</span>
                        <button
                          @click="removePersonaTrait('psychologicalNeeds', idx)"
                          class="text-red-400 hover:text-red-600 p-1 transition-colors"
                          title="删除"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        v-model="need.need"
                        type="text"
                        placeholder="输入诉求描述，如：渴望被认可、需要安全感..."
                        class="input-field text-xs"
                      />
                      <div class="flex items-center gap-3">
                        <span class="text-[10px]" style="color: var(--text-tertiary);">权重</span>
                        <input
                          v-model.number="need.weight"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="flex-1"
                        />
                        <span class="text-xs font-medium" style="color: var(--text-primary); min-width: 32px; text-align: right;">{{ (need.weight * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                    <button
                      @click="addPersonaTrait('psychologicalNeeds')"
                      class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
                      style="border-color: var(--border-light); color: var(--accent-warm);"
                    >
                      <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加诉求
                    </button>
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-medium mb-2 flex items-center gap-1.5" style="color: #dc2626;">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    沟通禁区
                  </p>
                  <div class="space-y-2">
                    <div
                      v-for="(taboo, idx) in editingPersonaData.taboos"
                      :key="idx"
                      class="p-3 rounded-xl space-y-2"
                      style="background: white; border: 1px solid rgba(220, 38, 38, 0.15);"
                    >
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-medium" style="color: var(--text-tertiary);">禁区 #{{ idx + 1 }}</span>
                        <button
                          @click="removePersonaTrait('taboos', idx)"
                          class="text-red-400 hover:text-red-600 p-1 transition-colors"
                          title="删除"
                        >
                          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <input
                        v-model="taboo.rule"
                        type="text"
                        placeholder="输入禁区规则，如：避免谈论前任、不要催促..."
                        class="input-field text-xs"
                      />
                      <div class="flex items-center gap-3">
                        <span class="text-[10px]" style="color: var(--text-tertiary);">风险等级</span>
                        <input
                          v-model.number="taboo.riskFactor"
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          class="flex-1"
                        />
                        <span class="text-xs font-medium" style="color: #dc2626; min-width: 32px; text-align: right;">{{ (taboo.riskFactor * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                    <button
                      @click="addPersonaTrait('taboos')"
                      class="w-full py-2 text-xs rounded-xl border border-dashed transition-colors"
                      style="border-color: rgba(220, 38, 38, 0.2); color: #dc2626;"
                    >
                      <svg class="w-3.5 h-3.5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                      </svg>
                      添加禁区
                    </button>
                  </div>
                </div>

                <div class="pt-2" style="border-top: 1px solid var(--border-light);">
                  <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">情绪热度</p>
                  <div class="p-3 rounded-xl" style="background: white; border: 1px solid var(--border-light);">
                    <div class="flex items-center gap-3">
                      <span class="text-[10px]" style="color: var(--text-tertiary);">冷静</span>
                      <input
                        v-model.number="editingPersonaData.temperature"
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        class="flex-1"
                      />
                      <span class="text-[10px]" style="color: var(--text-tertiary);">激烈</span>
                      <span class="text-sm font-medium ml-2" style="color: var(--text-primary);">{{ editingPersonaData.temperature }}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">文本风格</p>
                  <textarea
                    v-model="editingPersonaData.textStyle"
                    placeholder="描述对方的文本风格特征，如：喜欢用短句、语气直接、偶尔使用表情符号..."
                    class="input-field resize-none text-xs"
                    rows="2"
                  ></textarea>
                </div>

                <div>
                  <p class="text-[10px] font-medium mb-2" style="color: var(--accent-warm);">综合总结</p>
                  <textarea
                    v-model="editingPersonaData.summary"
                    placeholder="总结该联系人的性格特征和沟通模式，如：性格强势但内心敏感，需要被尊重和理解..."
                    class="input-field resize-none text-xs"
                    rows="3"
                  ></textarea>
                </div>

                <div class="flex gap-2 pt-2" style="border-top: 1px solid var(--border-light);">
                  <button @click="cancelEditPersona" class="btn-secondary flex-1">取消</button>
                  <button @click="savePersonaEdit(contact.name)" class="btn-primary flex-1">
                    <svg class="w-3.5 h-3.5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    保存修改
                  </button>
                </div>
              </div>

              <div
                v-else-if="hasPersonaData(contact.name)"
                class="p-3 rounded-xl space-y-2"
                style="background: rgba(139, 115, 85, 0.04); border: 1px solid rgba(139, 115, 85, 0.1);"
              >
                <template v-if="getPersonaForContact(contact.name)">
                  <div v-if="getPersonaForContact(contact.name)!.powerIdentity && getPersonaForContact(contact.name)!.powerIdentity!.length > 0">
                    <p class="text-[10px] font-medium mb-1" style="color: var(--accent-warm);">权力身份特征</p>
                    <div class="space-y-1">
                      <div
                        v-for="(trait, idx) in getPersonaForContact(contact.name)!.powerIdentity"
                        :key="idx"
                        class="flex items-center justify-between"
                      >
                        <span class="text-xs truncate flex-1" style="color: var(--text-secondary);">{{ trait.trait }}</span>
                        <span class="text-[10px] ml-2" style="color: var(--text-tertiary);">{{ (trait.confidence * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="getPersonaForContact(contact.name)!.psychologicalNeeds && getPersonaForContact(contact.name)!.psychologicalNeeds!.length > 0">
                    <p class="text-[10px] font-medium mb-1 mt-2" style="color: var(--accent-warm);">核心诉求</p>
                    <div class="space-y-1">
                      <div
                        v-for="(need, idx) in getPersonaForContact(contact.name)!.psychologicalNeeds"
                        :key="idx"
                        class="flex items-center justify-between"
                      >
                        <span class="text-xs truncate flex-1" style="color: var(--text-secondary);">{{ need.need }}</span>
                        <span class="text-[10px] ml-2" style="color: var(--text-tertiary);">{{ (need.weight * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="getPersonaForContact(contact.name)!.taboos && getPersonaForContact(contact.name)!.taboos!.length > 0">
                    <p class="text-[10px] font-medium mb-1 mt-2" style="color: #dc2626;">沟通禁区</p>
                    <div class="space-y-1">
                      <div
                        v-for="(taboo, idx) in getPersonaForContact(contact.name)!.taboos"
                        :key="idx"
                        class="flex items-center justify-between"
                      >
                        <span class="text-xs truncate flex-1" style="color: var(--text-secondary);">{{ taboo.rule }}</span>
                        <span class="text-[10px] ml-2" style="color: var(--text-tertiary);">{{ (taboo.riskFactor * 100).toFixed(0) }}%</span>
                      </div>
                    </div>
                  </div>

                  <div v-if="getPersonaForContact(contact.name)!.temperature" class="mt-2 pt-2" style="border-top: 1px solid rgba(139, 115, 85, 0.1);">
                    <div class="flex items-center gap-2">
                      <span class="text-[10px]" style="color: var(--text-tertiary);">情绪热度</span>
                      <div class="flex-1 h-1.5 rounded-full" style="background: var(--bg-tertiary);">
                        <div
                          class="h-full rounded-full"
                          style="background: var(--accent-warm);"
                          :style="{ width: `${(getPersonaForContact(contact.name)!.temperature / 10) * 100}%` }"
                        ></div>
                      </div>
                      <span class="text-[10px] font-medium" style="color: var(--text-primary);">{{ getPersonaForContact(contact.name)!.temperature }}/10</span>
                    </div>
                  </div>

                  <p v-if="getPersonaForContact(contact.name)!.summary" class="text-xs mt-2 pt-2" style="border-top: 1px solid rgba(139, 115, 85, 0.1); color: var(--text-secondary);">
                    {{ getPersonaForContact(contact.name)!.summary }}
                  </p>
                </template>
              </div>

              <p v-else class="text-xs text-center py-2" style="color: var(--text-tertiary);">
                暂无风格画像，请先积累对话或使用"更新画像"按钮
              </p>
            </div>
          </div>
        </div>
      </div>

      <div v-if="contacts.length === 0" class="py-12 text-center">
        <svg class="w-14 h-14 mx-auto mb-4" style="color: var(--text-tertiary);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p class="text-sm" style="color: var(--text-tertiary);">还没有添加任何联系人</p>
        <button
          @click="showAddForm = true"
          class="btn-primary mt-3"
        >
          添加第一个联系人
        </button>
      </div>
    </div>
  </div>
</template>
