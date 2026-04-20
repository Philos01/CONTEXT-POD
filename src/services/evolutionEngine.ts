import { getPersona, savePersona, mergePersona, extractStyleFromChat } from './personaService';
import type { StylePersona, AppSettings } from '@/types';

const BUFFER_KEY = 'context-pod-chat-buffer';
const EVOLUTION_THRESHOLD = 50;
const IDLE_TIMEOUT_MS = 30000;

export interface ChatBufferEntry {
  id: string;
  contactName: string;
  content: string;
  role: 'user' | 'partner';
  timestamp: number;
  processed: boolean;
}

export interface EvolutionStatus {
  isEvolving: boolean;
  currentContact: string | null;
  progress: number;
  totalEntries: number;
  lastEvolutionTime: number | null;
  pendingCounts: Record<string, number>;
}

let idleTimer: ReturnType<typeof setTimeout> | null = null;
let isEvolving = false;
let evolutionStatus: EvolutionStatus = {
  isEvolving: false,
  currentContact: null,
  progress: 0,
  totalEntries: 0,
  lastEvolutionTime: null,
  pendingCounts: {},
};

const statusListeners: Array<(status: EvolutionStatus) => void> = [];

function loadBuffer(): ChatBufferEntry[] {
  try {
    const saved = localStorage.getItem(BUFFER_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [];
}

function saveBuffer(buffer: ChatBufferEntry[]) {
  localStorage.setItem(BUFFER_KEY, JSON.stringify(buffer));
}

export function pushToBuffer(contactName: string, content: string, role: 'user' | 'partner'): ChatBufferEntry {
  const buffer = loadBuffer();
  const entry: ChatBufferEntry = {
    id: crypto.randomUUID(),
    contactName,
    content,
    role,
    timestamp: Date.now(),
    processed: false,
  };
  buffer.push(entry);
  saveBuffer(buffer);
  updatePendingCounts();
  return entry;
}

export function pushMultipleToBuffer(entries: Array<{ contactName: string; content: string; role: 'user' | 'partner' }>): void {
  const buffer = loadBuffer();
  for (const e of entries) {
    buffer.push({
      id: crypto.randomUUID(),
      contactName: e.contactName,
      content: e.content,
      role: e.role,
      timestamp: Date.now(),
      processed: false,
    });
  }
  saveBuffer(buffer);
  updatePendingCounts();
}

export function getBufferByContact(contactName: string): ChatBufferEntry[] {
  const buffer = loadBuffer();
  return buffer.filter(e => e.contactName === contactName && !e.processed);
}

export function getUnprocessedCount(contactName?: string): number {
  const buffer = loadBuffer();
  const unprocessed = buffer.filter(e => !e.processed);
  if (contactName) {
    return unprocessed.filter(e => e.contactName === contactName).length;
  }
  return unprocessed.length;
}

export function getPendingCountsByContact(): Record<string, number> {
  const buffer = loadBuffer();
  const counts: Record<string, number> = {};
  for (const entry of buffer) {
    if (!entry.processed) {
      counts[entry.contactName] = (counts[entry.contactName] || 0) + 1;
    }
  }
  return counts;
}

function updatePendingCounts() {
  evolutionStatus.pendingCounts = getPendingCountsByContact();
  evolutionStatus.totalEntries = loadBuffer().filter(e => !e.processed).length;
  notifyStatusListeners();
}

export function markAsProcessed(ids: string[]): void {
  const buffer = loadBuffer();
  const idSet = new Set(ids);
  for (const entry of buffer) {
    if (idSet.has(entry.id)) {
      entry.processed = true;
    }
  }
  saveBuffer(buffer);
  updatePendingCounts();
}

export function deleteProcessedEntries(): number {
  const buffer = loadBuffer();
  const remaining = buffer.filter(e => !e.processed);
  const deletedCount = buffer.length - remaining.length;
  saveBuffer(remaining);
  updatePendingCounts();
  return deletedCount;
}

export function atomicDeleteByIds(ids: string[]): number {
  const buffer = loadBuffer();
  const idSet = new Set(ids);
  const remaining = buffer.filter(e => !idSet.has(e.id));
  const deletedCount = buffer.length - remaining.length;
  saveBuffer(remaining);
  updatePendingCounts();
  return deletedCount;
}

export function clearBuffer(): void {
  localStorage.removeItem(BUFFER_KEY);
  updatePendingCounts();
}

// 更新缓冲区条目内容
export function updateBufferEntry(id: string, content: string): boolean {
  const buffer = loadBuffer();
  const index = buffer.findIndex(e => e.id === id && !e.processed);
  if (index >= 0) {
    buffer[index].content = content;
    saveBuffer(buffer);
    return true;
  }
  return false;
}

// 删除单个缓冲区条目
export function deleteBufferEntry(id: string): boolean {
  const buffer = loadBuffer();
  const index = buffer.findIndex(e => e.id === id);
  if (index >= 0) {
    buffer.splice(index, 1);
    saveBuffer(buffer);
    updatePendingCounts();
    return true;
  }
  return false;
}

export async function triggerPersonaUpdate(
  contactName: string,
  settings: AppSettings,
  forceManual: boolean = false // 新增：是否强制手动触发
): Promise<{ success: boolean; persona: StylePersona | null; processedCount: number }> {
  if (isEvolving) {
    console.log(`[Context-Pod] Evolution already in progress, skipping`);
    return { success: false, persona: null, processedCount: 0 };
  }

  const entries = getBufferByContact(contactName);
  
  // 如果不是手动触发且条数不足，则不执行
  if (!forceManual && entries.length < EVOLUTION_THRESHOLD) {
    console.log(`[Context-Pod] Not enough entries for ${contactName}: ${entries.length}/${EVOLUTION_THRESHOLD}`);
    return { success: false, persona: null, processedCount: 0 };
  }

  // 手动触发时，即使条数不足也允许（至少需要1条）
  if (forceManual && entries.length < 1) {
    console.log(`[Context-Pod] No entries available for ${contactName}`);
    return { success: false, persona: null, processedCount: 0 };
  }

  isEvolving = true;
  evolutionStatus.isEvolving = true;
  evolutionStatus.currentContact = contactName;
  evolutionStatus.progress = 0;
  notifyStatusListeners();

  try {
    // 使用所有可用条目或最多50条
    const targetEntries = entries.slice(0, Math.min(entries.length, EVOLUTION_THRESHOLD));
    const targetIds = targetEntries.map(e => e.id);

    console.log(`[Context-Pod] 🧬 Starting persona evolution for "${contactName}" with ${targetEntries.length} entries${forceManual ? ' (manual trigger)' : ''}`);

    evolutionStatus.progress = 20;
    notifyStatusListeners();

    const chatText = targetEntries
      .map(e => `${e.role === 'partner' ? contactName : '我'}: ${e.content}`)
      .join('\n');

    evolutionStatus.progress = 40;
    notifyStatusListeners();

    const newPersona = await extractStyleFromChat(chatText, settings);

    evolutionStatus.progress = 70;
    notifyStatusListeners();

    const existingPersona = getPersona(contactName);
    let finalPersona: StylePersona;

    if (existingPersona && existingPersona.summary !== '风格提取失败') {
      finalPersona = mergePersona(existingPersona, chatText, newPersona);
      console.log(`[Context-Pod] Merged persona for "${contactName}"`);
    } else {
      finalPersona = newPersona;
      console.log(`[Context-Pod] Created new persona for "${contactName}"`);
    }

    savePersona(contactName, finalPersona);

    evolutionStatus.progress = 90;
    notifyStatusListeners();

    atomicDeleteByIds(targetIds);

    evolutionStatus.progress = 100;
    evolutionStatus.lastEvolutionTime = Date.now();
    console.log(`[Context-Pod] ✅ Persona evolution complete for "${contactName}"`);

    return { success: true, persona: finalPersona, processedCount: targetEntries.length };
  } catch (error) {
    console.error(`[Context-Pod] ❌ Persona evolution failed for "${contactName}":`, error);
    return { success: false, persona: null, processedCount: 0 };
  } finally {
    isEvolving = false;
    evolutionStatus.isEvolving = false;
    evolutionStatus.currentContact = null;
    evolutionStatus.progress = 0;
    notifyStatusListeners();
  }
}

export function checkAndTriggerEvolution(settings: AppSettings): void {
  if (isEvolving) return;

  const pendingCounts = getPendingCountsByContact();

  for (const [contactName, count] of Object.entries(pendingCounts)) {
    if (count >= EVOLUTION_THRESHOLD) {
      console.log(`[Context-Pod] 🔄 Contact "${contactName}" has ${count} entries (threshold: ${EVOLUTION_THRESHOLD}), triggering evolution`);
      triggerPersonaUpdate(contactName, settings);
      return;
    }
  }
}

export function startIdleDetector(settings: AppSettings): void {
  if (typeof window === 'undefined') return;

  const onBlur = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      console.log('[Context-Pod] 💤 Idle detected (window blur 30s), checking evolution conditions...');
      checkAndTriggerEvolution(settings);
    }, IDLE_TIMEOUT_MS);
  };

  const onFocus = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
  };

  window.addEventListener('blur', onBlur);
  window.addEventListener('focus', onFocus);

  console.log('[Context-Pod] Idle detector started (30s blur threshold)');
}

export function stopIdleDetector(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  window.removeEventListener('blur', () => {});
  window.removeEventListener('focus', () => {});
}

export function getEvolutionStatus(): EvolutionStatus {
  return { ...evolutionStatus };
}

export function onEvolutionStatusChange(listener: (status: EvolutionStatus) => void): () => void {
  statusListeners.push(listener);
  return () => {
    const index = statusListeners.indexOf(listener);
    if (index >= 0) statusListeners.splice(index, 1);
  };
}

function notifyStatusListeners() {
  for (const listener of statusListeners) {
    try {
      listener({ ...evolutionStatus });
    } catch {
      // ignore
    }
  }
}

export function renameBufferEntries(oldName: string, newName: string): void {
  console.log(`[EvolutionEngine] Renaming buffer entries from "${oldName}" to "${newName}"`);
  if (oldName === newName) return;
  
  const buffer = loadBuffer();
  let updated = false;
  let count = 0;
  
  for (const entry of buffer) {
    if (entry.contactName === oldName) {
      entry.contactName = newName;
      updated = true;
      count++;
    }
  }
  
  if (updated) {
    console.log(`[EvolutionEngine] Updated ${count} buffer entries for "${newName}"`);
    saveBuffer(buffer);
    updatePendingCounts();
  } else {
    console.log(`[EvolutionEngine] No buffer entries found for "${oldName}"`);
  }
}

// 保存用户自定义回复，用于学习用户风格
export function saveUserReply(
  fullContext: string,
  contactName: string,
  userReply: string
): boolean {
  console.log(`[Context-Pod] 💾 Saving user custom reply for "${contactName}"`);
  
  try {
    // 首先保存原始上下文（对方的消息）
    if (fullContext.trim()) {
      // 解析对方的消息（简单解析，识别对方的内容）
      const partnerMessages = extractPartnerMessages(fullContext, contactName);
      for (const msg of partnerMessages) {
        pushToBuffer(contactName, msg, 'partner');
      }
    }
    
    // 保存用户自己的回复（标记为user，重点用于学习用户风格）
    if (userReply.trim()) {
      pushToBuffer(contactName, userReply, 'user');
      console.log(`[Context-Pod] ✅ User reply saved: "${userReply.substring(0, 100)}..."`);
    }
    
    // 不立即触发风格学习，遵循正常的进化策略
    // 回复会积累到缓冲区，当达到阈值（50条）或闲时自动触发进化
    
    return true;
  } catch (error) {
    console.error(`[Context-Pod] ❌ Failed to save user reply:`, error);
    return false;
  }
}

// 从完整上下文中提取对方的消息
function extractPartnerMessages(fullContext: string, _contactName: string): string[] {
  const messages: string[] = [];
  const lines = fullContext.split('\n').filter(l => l.trim());
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 跳过空行
    if (!trimmed) continue;
    
    // 识别对方的消息（排除明显是用户的消息）
    if (!trimmed.startsWith('我:') && !trimmed.startsWith('我：')) {
      // 尝试提取纯文本内容
      let content = trimmed;
      
      // 如果包含冒号分隔，提取后面的内容
      const colonIndex = trimmed.indexOf(':');
      const chineseColonIndex = trimmed.indexOf('：');
      
      if (colonIndex > 0 || chineseColonIndex > 0) {
        const splitIndex = colonIndex > 0 ? colonIndex : chineseColonIndex;
        const speaker = trimmed.substring(0, splitIndex).trim();
        
        // 如果说话人不是"我"，则认为是对方的消息
        if (speaker !== '我' && speaker.trim()) {
          content = trimmed.substring(splitIndex + 1).trim();
        }
      }
      
      if (content && content.length > 0) {
        messages.push(content);
      }
    }
  }
  
  return messages;
}

export { EVOLUTION_THRESHOLD, IDLE_TIMEOUT_MS };
