import { retrieveMemory } from './memoryService';
import type { AgentState, AppSettings, ConversationMessage } from '@/types';
import { generateStrategies } from './llmService';

const conversationHistory: ConversationMessage[] = [];
const MAX_HISTORY = 10;

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

  const lines = rawText.split('\n').filter(line => line.trim());
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const colonMatch = firstLine.match(/^([^：:]+)[：:]/);
    if (colonMatch && colonMatch[1]) {
      const name = colonMatch[1].trim();
      if (name.length > 0 && name.length < 20 && !isCommonWord(name)) {
        return name;
      }
    }
  }

  const senderPattern = /([^\n：:]+)[：:][^\n]*(?:\n|$)/g;
  const senders = new Set<string>();
  let match;
  while ((match = senderPattern.exec(rawText)) !== null) {
    const name = match[1].trim();
    if (name.length > 0 && name.length < 20 && !isCommonWord(name)) {
      senders.add(name);
    }
  }
  
  const senderList = Array.from(senders);
  if (senderList.length === 2) {
    const meKeywords = ['我', 'me', '自己', '本人'];
    for (let i = 0; i < senderList.length; i++) {
      const name = senderList[i].toLowerCase();
      if (meKeywords.some(kw => name.includes(kw))) {
        return senderList[1 - i];
      }
    }
    return senderList[0];
  }

  if (senderList.length === 1) {
    return senderList[0];
  }

  return '未知联系人';
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

function parseConversation(rawText: string, targetPerson: string): ConversationMessage[] {
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
  history: ConversationMessage[]
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

  return `你正在和【${targetPerson}】对话。${memorySection}
${contextSection}

【当前聊天上下文】
${rawText}

请根据以上所有信息（历史对话+性格档案+当前上下文），生成三种高情商的回复策略。

要求：
1. 回复要结合历史对话的语境，保持连贯性
2. 考虑对方性格特点，选择最合适的措辞
3. 如果历史对话中有未完成的话题，要延续下去`;
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

export function addToHistory(messages: ConversationMessage[]) {
  conversationHistory.push(...messages);
  if (conversationHistory.length > MAX_HISTORY * 3) {
    conversationHistory.splice(0, conversationHistory.length - MAX_HISTORY);
  }
}

export function clearHistory() {
  conversationHistory.length = 0;
}

export function getHistory(): ConversationMessage[] {
  return [...conversationHistory];
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

    const finalPrompt = buildContextPrompt(rawText, targetPerson, memoryData, conversationHistory);

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
  onProgress('extracting', '正在识别对话对象...');

  const identification = identifyContact(rawText);
  const targetPerson = identification.name;
  console.log(`[Context-Pod] Identified: "${targetPerson}" (confidence: ${identification.confidence}, source: ${identification.source})`);
  
  onProgress('retrieving', `正在检索【${targetPerson}】的记忆档案...`);

  let memoryData = '暂无此人记录';
  if (targetPerson !== '未知联系人') {
    try {
      memoryData = await retrieveMemory(targetPerson);
      console.log(`[Context-Pod] Memory data: "${memoryData}"`);
    } catch {
      // use default
    }
  }

  const parsedMessages = parseConversation(rawText, targetPerson);
  if (parsedMessages.length > 0) {
    addToHistory(parsedMessages);
    console.log(`[Context-Pod] Added ${parsedMessages.length} messages to history (total: ${conversationHistory.length})`);
  }

  onProgress('generating', '正在推演回复策略...');

  const finalPrompt = buildContextPrompt(rawText, targetPerson, memoryData, conversationHistory);

  const strategies = await generateStrategies(finalPrompt, settings);

  onProgress('ready', '推演完成');

  return {
    rawText,
    targetPerson,
    memoryData,
    finalPrompt,
    strategies,
  };
}

export { extractPersonName };