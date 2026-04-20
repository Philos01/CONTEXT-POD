import { retrieveMemory } from './memoryService';
import { getPersona, formatPersonaForPrompt } from './personaService';
import { pushMultipleToBuffer, getPendingCountsByContact, EVOLUTION_THRESHOLD } from './evolutionEngine';
import type { AgentState, AppSettings, ConversationMessage, StylePersona } from '@/types';
import { generateStrategies } from './llmService';

const conversationHistory: ConversationMessage[] = [];
const MAX_HISTORY = 10;

// 性能监控工具
class PerformanceMonitor {
  private timings: Map<string, number> = new Map();
  
  start(label: string) {
    this.timings.set(label, performance.now());
  }
  
  end(label: string): number {
    const start = this.timings.get(label);
    if (start === undefined) return 0;
    const duration = performance.now() - start;
    console.log(`[Context-Pod] ⏱️ ${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }
}

const perf = new PerformanceMonitor();

function extractPersonName(rawText: string): string {
  const patterns = [
    /^([^：:\n]+)[：:]\s/m,
    /@([^\s@]+)/,
    /与\s*([^\s]+)\s*的对话/,
    /和\s*([^\s]+)\s*聊天/,
    /【([^】]+)】/,
    /「([^」]+)」/,
    /"([^"]+)"/,
    /"([^"]+)"/,
  ];

  for (const pattern of patterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 0 && name.length < 20 && !isCommonWord(name)) {
        return name;
      }
    }
  }

  return extractWeChatNickname(rawText) || '未知联系人';
}

function isCommonWord(word: string): boolean {
  const commonWords = [
    '我', '你', '他', '她', '它', '我们', '你们', '他们',
    '这', '那', '什么', '怎么', '为什么', '哪里', '谁',
    '的', '了', '是', '在', '有', '和', '与', '或',
    '好', '嗯', '哦', '啊', '哈', '嘿', '呀',
    '收到', '好的', '明白', '知道', '可以', '行',
    'me', 'you', 'he', 'she', 'it', 'we', 'they',
    'ok', 'yes', 'no', 'hi', 'hello', 'hey',
  ];
  return commonWords.includes(word.toLowerCase());
}

function extractWeChatNickname(rawText: string): string | null {
  const wechatPatterns = [
    /([^\n]{1,15})\n\d{1,2}:\d{2}/,
    /([^\n]{1,15})\s+\d{1,2}:\d{2}[:：]/,
    /([^\n]{1,15})\s+(上午|下午|晚上|凌晨)\s*\d{1,2}:\d{2}/,
  ];

  for (const pattern of wechatPatterns) {
    const match = rawText.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (name.length > 0 && name.length < 15 && !isCommonWord(name) && !/^\d/.test(name)) {
        return name;
      }
    }
  }

  return null;
}

function parseConversation(rawText: string, _targetPerson: string): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  const lines = rawText.split('\n').filter(line => line.trim());

  for (const line of lines) {
    const colonMatch = line.match(/^([^：:]+)[：:]\s*(.+)$/);
    if (colonMatch) {
      const sender = colonMatch[1].trim();
      const content = colonMatch[2].trim();
      if (content.length > 0) {
        messages.push({
          role: sender === '我' ? 'user' : 'other',
          sender,
          content,
          timestamp: Date.now(),
        });
      }
    } else if (line.trim().length > 0 && messages.length > 0) {
      messages[messages.length - 1].content += '\n' + line.trim();
    }
  }

  return messages;
}

function buildContextPrompt(
  rawText: string,
  targetPerson: string,
  memoryData: string,
  history: ConversationMessage[],
  persona: StylePersona | null
): string {
  let contextSection = '';

  if (history.length > 0) {
    const recentHistory = history.slice(-MAX_HISTORY);
    contextSection = '\n\n【历史对话记录】\n';
    for (const msg of recentHistory) {
      contextSection += `${msg.sender}: ${msg.content}\n`;
    }
  }

  let memorySection = '';
  if (memoryData !== '暂无此人记录') {
    memorySection = `\n\n【${targetPerson}的性格档案】\n${memoryData}`;
  }

  let personaSection = '';
  if (persona && persona.summary && persona.summary !== '风格提取失败') {
    personaSection = `\n\n【${targetPerson}的聊天风格画像】\n${formatPersonaForPrompt(persona)}`;
  }

  let personaInstruction = '';
  if (persona && persona.summary && persona.summary !== '风格提取失败') {
    personaInstruction = `
4. 模仿对方的聊天风格！根据风格画像中的口癖、断句习惯、情绪风格来组织回复
5. 使用对方常用的语气词和标点习惯，让回复看起来像是你自然说出来的`;
  }

  return `你正在和【${targetPerson}】对话。${memorySection}${personaSection}
${contextSection}

【当前聊天上下文】
${rawText}

请根据以上所有信息（风格画像+历史对话+性格档案+当前上下文），生成三种高情商的回复策略。

要求：
1. 回复要结合历史对话的语境，保持连贯性
2. 考虑对方性格特点，选择最合适的措辞
3. 如果历史对话中有未完成的话题，要延续下去${personaInstruction}`;
}

export function addToHistory(messages: ConversationMessage[]) {
  conversationHistory.push(...messages);
  if (conversationHistory.length > MAX_HISTORY * 3) {
    conversationHistory.splice(0, conversationHistory.length - MAX_HISTORY);
  }
}

export function pushToChatBuffer(targetPerson: string, messages: ConversationMessage[]): void {
  const bufferEntries = messages.map(m => ({
    contactName: targetPerson,
    content: m.content,
    role: m.role === 'other' ? 'partner' as const : 'user' as const,
  }));
  pushMultipleToBuffer(bufferEntries);
  console.log(`[Context-Pod] Pushed ${bufferEntries.length} entries to chat buffer for "${targetPerson}"`);

  const pending = getPendingCountsByContact();
  if (pending[targetPerson] && pending[targetPerson] >= EVOLUTION_THRESHOLD) {
    console.log(`[Context-Pod] 💡 "${targetPerson}" has ${pending[targetPerson]} pending entries (threshold: ${EVOLUTION_THRESHOLD}), evolution will trigger on idle`);
  }
}

export function clearHistory() {
  conversationHistory.length = 0;
}

export function getHistory(): ConversationMessage[] {
  return [...conversationHistory];
}

export async function identifyContactAsync(rawText: string): Promise<{ name: string; confidence: number; source: string }> {
  // 简化版本：只使用文本分析识别联系人
  console.log('[Context-Pod] � Identifying contact from text...');
  
  const wechatName = extractWeChatNickname(rawText);
  if (wechatName) {
    return { name: wechatName, confidence: 0.8, source: '微信格式' };
  }

  const normalName = extractPersonName(rawText);
  if (normalName !== '未知联系人') {
    return { name: normalName, confidence: 0.9, source: '聊天格式' };
  }

  return { name: '未知联系人', confidence: 0, source: '' };
}

export function identifyContact(rawText: string): { name: string; confidence: number; source: string } {
  const wechatName = extractWeChatNickname(rawText);
  if (wechatName) {
    return { name: wechatName, confidence: 0.8, source: '微信格式' };
  }

  const normalName = extractPersonName(rawText);
  if (normalName !== '未知联系人') {
    return { name: normalName, confidence: 0.9, source: '聊天格式' };
  }

  return { name: '未知联系人', confidence: 0, source: '' };
}

export async function runWorkflow(
  rawText: string,
  settings: AppSettings
): Promise<AgentState> {
  try {
    const targetPerson = extractPersonName(rawText);

    let memoryData = '暂无此人记录';
    if (targetPerson !== '未知联系人') {
      try {
        memoryData = await retrieveMemory(targetPerson);
      } catch {
        // use default
      }
    }

    const parsedMessages = parseConversation(rawText, targetPerson);
    if (parsedMessages.length > 0) {
      addToHistory(parsedMessages);
    }

    const finalPrompt = buildContextPrompt(rawText, targetPerson, memoryData, conversationHistory, null);

    const strategies = await generateStrategies(finalPrompt, settings);

    return {
      rawText,
      targetPerson,
      memoryData,
      finalPrompt,
      strategies,
    };
  } catch (error) {
    console.error('Workflow execution failed:', error);
    return {
      rawText,
      targetPerson: extractPersonName(rawText),
      memoryData: '工作流执行异常',
      finalPrompt: rawText,
      strategies: [
        { label: 'A', style: '顺从推进', content: '好的，收到！' },
        { label: 'B', style: '委婉甩锅', content: '这个我再确认下' },
        { label: 'C', style: '幽默化解', content: '收到，安排上了' },
      ],
    };
  }
}

export async function runWorkflowStream(
  rawText: string,
  settings: AppSettings,
  onProgress: (stage: string, message: string) => void
): Promise<AgentState> {
  perf.start('Total Workflow');
  
  // 步骤 1：识别联系人
  perf.start('Identify Contact');
  onProgress('extracting', '正在识别对话对象...');
  const identification = await identifyContactAsync(rawText);
  const targetPerson = identification.name;
  perf.end('Identify Contact');
  console.log(`[Context-Pod] Identified: "${targetPerson}" (confidence: ${identification.confidence}, source: ${identification.source})`);
  
  // 步骤 2：并行获取记忆和读取画像
  perf.start('Retrieve Data');
  onProgress('retrieving', `正在检索【${targetPerson}】的记忆档案...`);
  
  // 并行执行，减少总耗时
  const [memoryData, persona] = await Promise.all([
    // 获取记忆
    (async () => {
      if (targetPerson !== '未知联系人') {
        try {
          const data = await retrieveMemory(targetPerson);
          console.log(`[Context-Pod] Memory data: "${data}"`);
          return data;
        } catch {
          return '暂无此人记录';
        }
      }
      return '暂无此人记录';
    })(),
    // 获取风格画像（同步操作，但很快）
    targetPerson !== '未知联系人' ? getPersona(targetPerson) : null
  ]);
  
  perf.end('Retrieve Data');
  
  if (persona) {
    console.log(`[Context-Pod] Found style persona for "${targetPerson}": ${persona.summary}`);
  }

  // 步骤 3：解析和保存消息（与上面并行）
  const parsedMessages = parseConversation(rawText, targetPerson);
  if (parsedMessages.length > 0) {
    addToHistory(parsedMessages);
    console.log(`[Context-Pod] Added ${parsedMessages.length} messages to history (total: ${conversationHistory.length})`);
    
    if (targetPerson !== '未知联系人') {
      pushToChatBuffer(targetPerson, parsedMessages);
    }
  }

  // 步骤 4：生成回复策略
  perf.start('Generate Strategies');
  onProgress('generating', '正在推演回复策略...');

  const finalPrompt = buildContextPrompt(rawText, targetPerson, memoryData, conversationHistory, persona);
  const strategies = await generateStrategies(finalPrompt, settings);
  perf.end('Generate Strategies');

  onProgress('ready', '推演完成');
  perf.end('Total Workflow');

  return {
    rawText,
    targetPerson,
    memoryData,
    finalPrompt,
    strategies,
  };
}

export { extractPersonName };
