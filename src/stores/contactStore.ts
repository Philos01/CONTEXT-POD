import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Contact } from '@/types';
import { addMemory, initMemoryService } from '@/services/memoryService';

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
    const idx = contacts.value.findIndex((c) => c.id !== id);
    if (idx >= 0) {
      contacts.value[idx] = {
        ...contacts.value[idx],
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