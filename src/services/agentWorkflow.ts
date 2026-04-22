import { retrieveMemory } from './memoryService';
import { getPersona, getDynamicPersona, formatPersonaForPrompt, formatDynamicPersonaForPrompt, applyDecay } from './personaService';
import { pushMultipleToBuffer, getPendingCountsByContact, EVOLUTION_THRESHOLD } from './evolutionEngine';
import { classifyConversationPhase, getPhaseLabel } from './conversationStateEngine';
import { buildFeedbackSection } from './feedbackEvaluator';
import type { AgentState, AppSettings, ConversationMessage, StylePersona, DynamicPersonaSchema, ConversationPhase, TacticalGoal } from '@/types';
import { CONVERSATION_PHASE_LABELS, TACTICAL_GOAL_LABELS } from '@/types';
import { generateStrategies } from './llmService';
import { getPrompt, formatPrompt } from './promptService';
import { getLogger } from './logger';

const logger = getLogger('agentWorkflow');

const conversationHistory: ConversationMessage[] = [];
const MAX_HISTORY = 10;

class PerformanceMonitor {
  private timings: Map<string, number> = new Map();

  start(label: string) {
    this.timings.set(label, performance.now());
  }

  end(label: string): number {
    const start = this.timings.get(label);
    if (start === undefined) return 0;
    const duration = performance.now() - start;
    console.log(`[Context-Pod] Timer ${label}: ${duration.toFixed(2)}ms`);
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

function buildHistoryText(history: ConversationMessage[]): string {
  if (history.length === 0) return '';
  const recentHistory = history.slice(-MAX_HISTORY);
  return recentHistory.map(msg => `${msg.sender}: ${msg.content}`).join('\n');
}

function buildContextPrompt(
  rawText: string,
  targetPerson: string,
  memoryData: string,
  history: ConversationMessage[],
  persona: StylePersona | null,
  dynamicPersona: DynamicPersonaSchema | null,
  conversationPhase: ConversationPhase,
  tacticalGoal: TacticalGoal,
  feedbackSection: string,
  selfPersona: DynamicPersonaSchema | null,
  contactIdentity?: string
): string {
  let historySection = '';
  if (history.length > 0) {
    historySection = buildHistoryText(history);
  }

  let memorySection = '';
  if (memoryData !== '暂无此人记录') {
    memorySection = `【${targetPerson}的性格档案】\n${memoryData}`;
  }

  let personaSection = '';
  if (dynamicPersona && dynamicPersona.summary && dynamicPersona.summary !== '画像提取失败') {
    personaSection = formatDynamicPersonaForPrompt(dynamicPersona);
  } else if (persona && persona.summary && persona.summary !== '风格提取失败') {
    personaSection = formatPersonaForPrompt(persona);
  }

  let selfPersonaSection = '';
  if (selfPersona && selfPersona.summary && selfPersona.summary !== '画像提取失败') {
    const identityStr = selfPersona.powerIdentity
      .filter(p => p.confidence >= 0.3)
      .map(p => p.trait)
      .join('；');
    const eventsStr = selfPersona.experienceEvents.length > 0
      ? selfPersona.experienceEvents.slice(-3).map(e => e.behaviorTrendDesc).join('；')
      : '无';
    selfPersonaSection = `【你的社交画像】
- 社交定位: ${identityStr || '待探索'}
- 综合热度: ${selfPersona.temperature}/10
- 沟通风格: ${selfPersona.textStyle}
- 近期特征: ${eventsStr}
- 总结: ${selfPersona.summary}`;
  }

  const phaseLabel = CONVERSATION_PHASE_LABELS[conversationPhase] || conversationPhase;
  const goalLabel = TACTICAL_GOAL_LABELS[tacticalGoal] || tacticalGoal;
  const identityContext = contactIdentity ? `\n背景提示：对方是你的${contactIdentity}，请据此选择合适的语气和分寸。` : '';

  const replyPrompt = getPrompt('reply-generation');
  if (replyPrompt) {
    return formatPrompt(replyPrompt, {
      targetPerson,
      personaSection: personaSection || '暂无对手画像数据',
      selfPersonaSection: selfPersonaSection || '',
      historySection: historySection || '暂无近期交互记录',
      feedbackSection: feedbackSection || '',
      conversationPhase: phaseLabel,
      tacticalGoal: goalLabel,
      rawText,
      identityContext,
    });
  }

  return `你正在和【${targetPerson}】对话。${identityContext}
${memorySection}

${selfPersonaSection ? selfPersonaSection + '\n\n' : ''}${personaSection}

${historySection ? `【历史对话】\n${historySection}` : ''}

${feedbackSection}

当前关系态势：${phaseLabel}
当前用户目标：${goalLabel}

【当前聊天上下文】
${rawText}

请生成三种高情商的回复策略。`;
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
  console.log('[Context-Pod] Identifying contact from text...');

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
  settings: AppSettings,
  tacticalGoal: TacticalGoal = 'stabilize',
  targetPersonOverride?: string,
  contactIdentity?: string
): Promise<AgentState> {
  logger.info('Starting workflow execution', { targetPerson: targetPersonOverride, identity: contactIdentity });
  
  try {
    const identifiedName = targetPersonOverride || extractPersonName(rawText);
    logger.debug('Contact identified', { name: identifiedName });

    let memoryData = '暂无此人记录';
    if (identifiedName !== '未知联系人') {
      try {
        memoryData = await retrieveMemory(identifiedName);
        logger.debug('Memory retrieved', { name: identifiedName });
      } catch {
        logger.warning('Memory retrieval failed', { name: identifiedName });
      }
    }

    const parsedMessages = parseConversation(rawText, identifiedName);
    if (parsedMessages.length > 0) {
      addToHistory(parsedMessages);
    }

    const dynamicPersona = identifiedName !== '未知联系人' ? getDynamicPersona(identifiedName) : null;
    const persona = identifiedName !== '未知联系人' ? getPersona(identifiedName) : null;
    const selfPersona = getDynamicPersona('自我');
    const feedbackSection = identifiedName !== '未知联系人' ? buildFeedbackSection(identifiedName) : '';

    let conversationPhase: ConversationPhase = 'probing';
    try {
      const historyText = buildHistoryText(conversationHistory);
      const phaseResult = await classifyConversationPhase(rawText, historyText, settings);
      conversationPhase = phaseResult.phase;
      logger.debug('Conversation phase classified', { phase: getPhaseLabel(conversationPhase), confidence: phaseResult.confidence });
    } catch (error) {
      logger.error('Phase classification failed', error);
    }

    logger.info('Building context prompt');
    const finalPrompt = buildContextPrompt(
      rawText, identifiedName, memoryData, conversationHistory,
      persona, dynamicPersona, conversationPhase, tacticalGoal, feedbackSection, selfPersona,
      contactIdentity
    );

    logger.info('Generating strategies');
    const strategies = await generateStrategies(finalPrompt, settings);
    logger.info('Workflow completed successfully', { strategyCount: strategies.length, phase: getPhaseLabel(conversationPhase) });

    return {
      rawText,
      targetPerson: identifiedName,
      memoryData,
      finalPrompt,
      strategies,
      conversationPhase,
      tacticalGoal,
      personaSection: dynamicPersona ? formatDynamicPersonaForPrompt(dynamicPersona) : (persona ? formatPersonaForPrompt(persona) : ''),
      feedbackSection,
    };
  } catch (error) {
    logger.error('Workflow execution failed', error);
    console.error('Workflow execution failed:', error);
    return {
      rawText,
      targetPerson: extractPersonName(rawText),
      memoryData: '工作流执行异常',
      finalPrompt: rawText,
      strategies: [
        { label: 'A', style: '端水软垫铺路', tacticalGoal: '稳住局面', content: '好的，收到！', riskLevel: 'low', expectedReaction: '对方可能暂时缓和' },
        { label: 'B', style: '反向提问设限', tacticalGoal: '转移压力', content: '这个我再确认下', riskLevel: 'medium', expectedReaction: '对方可能继续追问' },
        { label: 'C', style: '直接表达诉求', tacticalGoal: '表明立场', content: '收到，安排上了', riskLevel: 'high', expectedReaction: '对方可能不满' },
      ],
      conversationPhase: 'probing',
      tacticalGoal,
      personaSection: '',
      feedbackSection: '',
    };
  }
}

export async function runWorkflowStream(
  rawText: string,
  settings: AppSettings,
  onProgress: (stage: string, message: string) => void,
  tacticalGoal: TacticalGoal = 'stabilize',
  targetPerson?: string,
  contactIdentity?: string
): Promise<AgentState> {
  perf.start('Total Workflow');

  let identifiedName = targetPerson;
  if (!identifiedName) {
    perf.start('Identify Contact');
    onProgress('extracting', '正在识别对话对象...');
    const identification = await identifyContactAsync(rawText);
    identifiedName = identification.name;
    perf.end('Identify Contact');
    console.log(`[Context-Pod] Identified: "${identifiedName}" (confidence: ${identification.confidence}, source: ${identification.source})`);
  }

  perf.start('Retrieve Data');
  onProgress('retrieving', `正在检索【${identifiedName}】的记忆档案...`);

  const [memoryData, persona, dynamicPersona, selfPersona] = await Promise.all([
    (async () => {
      if (identifiedName !== '未知联系人') {
        try {
          const data = await retrieveMemory(identifiedName);
          console.log(`[Context-Pod] Memory data: "${data}"`);
          return data;
        } catch {
          return '暂无此人记录';
        }
      }
      return '暂无此人记录';
    })(),
    Promise.resolve(identifiedName !== '未知联系人' ? getPersona(identifiedName) : null),
    Promise.resolve(identifiedName !== '未知联系人' ? getDynamicPersona(identifiedName) : null),
    Promise.resolve(getDynamicPersona('自我')), // 加载赛博捏脸结果
  ]);

  perf.end('Retrieve Data');

  if (dynamicPersona) {
    console.log(`[Context-Pod] Found dynamic persona for "${identifiedName}": ${dynamicPersona.summary}`);
    applyDecay(dynamicPersona);
  } else if (persona) {
    console.log(`[Context-Pod] Found style persona for "${identifiedName}": ${persona.summary}`);
  }

  const parsedMessages = parseConversation(rawText, identifiedName);
  if (parsedMessages.length > 0) {
    addToHistory(parsedMessages);
    console.log(`[Context-Pod] Added ${parsedMessages.length} messages to history (total: ${conversationHistory.length})`);

    if (identifiedName !== '未知联系人') {
      pushToChatBuffer(identifiedName, parsedMessages);
    }
  }

  // 提前构建历史文本（供并行使用）
  const historyText = buildHistoryText(conversationHistory);

  // 🔄 并行执行：对话阶段分类 + 反馈评估
  perf.start('Classify Phase');
  perf.start('Evaluate Feedback');

  const [phaseResult, feedbackSection] = await Promise.all([
    (async () => {
      onProgress('classifying', '正在分析对话局势...');
      try {
        const result = await classifyConversationPhase(rawText, historyText, settings);
        perf.end('Classify Phase');
        console.log(`[Context-Pod] Phase: ${getPhaseLabel(result.phase)} (${result.reasoning})`);
        return result;
      } catch (error) {
        perf.end('Classify Phase');
        console.error('[Context-Pod] Phase classification failed:', error);
        console.log('[Context-Pod] Phase classification failed, using default');
        return { phase: 'probing' as ConversationPhase, confidence: 0, reasoning: '默认' };
      }
    })(),
    (async () => {
      onProgress('evaluating', '正在复盘历史策略...');
      const section = identifiedName !== '未知联系人' ? buildFeedbackSection(identifiedName) : '';
      perf.end('Evaluate Feedback');
      return section;
    })()
  ]);

  const conversationPhase = phaseResult.phase;

  perf.start('Generate Strategies');
  onProgress('generating', `正在推演回复策略（${getPhaseLabel(conversationPhase)}·${TACTICAL_GOAL_LABELS[tacticalGoal]}）...`);

  const finalPrompt = buildContextPrompt(
    rawText, identifiedName, memoryData, conversationHistory,
    persona, dynamicPersona, conversationPhase, tacticalGoal, feedbackSection, selfPersona,
    contactIdentity
  );

  const strategies = await generateStrategies(finalPrompt, settings);
  perf.end('Generate Strategies');

  onProgress('ready', '推演完成');
  perf.end('Total Workflow');

  return {
    rawText,
    targetPerson: identifiedName,
    memoryData,
    finalPrompt,
    strategies,
    conversationPhase,
    tacticalGoal,
    personaSection: dynamicPersona ? formatDynamicPersonaForPrompt(dynamicPersona) : (persona ? formatPersonaForPrompt(persona) : ''),
    feedbackSection,
  };
}

export { extractPersonName };
