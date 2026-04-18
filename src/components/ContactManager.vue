<script setup lang="ts">
import { ref } from 'vue';
import { useContactStore } from '@/stores/contactStore';

const emit = defineEmits<{
  back: [];
}>();

const contactStore = useContactStore();

const newName = ref('');
const newPersonality = ref('');
const newTags = ref('');
const showForm = ref(false);

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
    <div class="space-y-2 max-h-[300px] overflow-y-auto">
      <div
        v-for="contact in contactStore.contacts"
        :key="contact.id"
        class="p-3 bg-white/50 rounded-xl group"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium text-gray-800">{{ contact.name }}</p>
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
          <button
            @click="handleRemove(contact.id)"
            class="p-1 text-gray-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="contactStore.contacts.length === 0" class="text-center py-6">
        <p class="text-gray-400 text-sm">暂无联系人</p>
        <p class="text-gray-300 text-xs mt-1">添加联系人后，AI 将根据性格特点定制回复</p>
      </div>
    </div>
  </div>
</template>
