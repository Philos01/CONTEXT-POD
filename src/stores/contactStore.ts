import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import type { Contact } from '@/types';
import { addMemory, initMemoryService, updateContactIndex } from '@/services/memoryService';
import { renamePersona } from '@/services/personaService';
import { renameBufferEntries } from '@/services/evolutionEngine';

const CONTACTS_KEY = 'context-pod-contacts';

function loadContacts(): Contact[] {
  try {
    const saved = localStorage.getItem(CONTACTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [];
}

export const useContactStore = defineStore('contacts', () => {
  const contacts = ref<Contact[]>(loadContacts());
  const isDbReady = ref(false);

  const contactCount = computed(() => contacts.value.length);

  // 监听联系人变化，自动更新快速索引
  watch(contacts, (newContacts) => {
    updateContactIndex(newContacts);
  }, { immediate: true, deep: true });

  async function initDb() {
    if (isDbReady.value) return;
    
    try {
      console.log('[Context-Pod] Initializing memory service...');
      await initMemoryService();
      
      console.log('[Context-Pod] Adding contacts to memory...');
      for (const contact of contacts.value) {
        try {
          await addMemory(contact);
        } catch (e) {
          console.warn('[Context-Pod] Failed to add contact to memory:', contact.name, e);
        }
      }
      
      isDbReady.value = true;
      console.log('[Context-Pod] ✅ Memory service ready');
    } catch (error) {
      console.error('[Context-Pod] ❌ Memory service init failed, continuing without vector search:', error);
      isDbReady.value = true;
    }
  }

  async function addContact(name: string, personality: string, tags: string[] = []) {
    const contact: Contact = {
      id: crypto.randomUUID(),
      name,
      personality,
      tags,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    contacts.value.push(contact);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.value));

    if (isDbReady.value) {
      try {
        await addMemory(contact);
      } catch (e) {
        console.warn('[Context-Pod] Failed to add contact to memory:', e);
      }
    }

    return contact;
  }

  function removeContact(id: string) {
    contacts.value = contacts.value.filter((c) => c.id !== id);
    localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.value));
  }

  function updateContact(id: string, updates: Partial<Contact>) {
    const idx = contacts.value.findIndex((c) => c.id === id);
    if (idx >= 0) {
      const oldContact = contacts.value[idx];
      
      // 如果名字有变化，同步更新风格画像和缓冲区
      if (updates.name && updates.name !== oldContact.name) {
        renamePersona(oldContact.name, updates.name);
        renameBufferEntries(oldContact.name, updates.name);
      }
      
      contacts.value[idx] = {
        ...oldContact,
        ...updates,
        updatedAt: Date.now(),
      };
      localStorage.setItem(CONTACTS_KEY, JSON.stringify(contacts.value));
    }
  }

  return {
    contacts,
    isDbReady,
    contactCount,
    initDb,
    addContact,
    removeContact,
    updateContact,
  };
});