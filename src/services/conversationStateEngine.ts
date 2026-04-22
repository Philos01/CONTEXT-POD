import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { ConversationPhase, AppSettings } from '@/types';
import { CONVERSATION_PHASE_LABELS } from '@/types';

function getClient(settings: AppSettings) {
  return createOpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
  });
}

const PHASE_CLASSIFICATION_PROMPT = `你是一位顶级社交博弈分析师。请判断当前对话处于以下哪种关系博弈阶段。

5种阶段定义：
1. probing（试探期）：对方在摸底、试探你的态度或底线，语气相对温和但暗含目的
2. pressuring（施压期）：对方在要结果、催促、施压，语气急切或强硬
3. conflict（冲突期）：双方情绪对抗、争吵、指责，气氛紧张
4. cooling（冷处理期）：对方在降温、疏远、回复变慢或变短，可能是在冷暴力或回避
5. repairing（关系修复期）：对方在示好、缓和、找话题，试图修复关系

请根据以下对话内容，判断当前处于哪个阶段。

必须严格按以下 JSON 格式输出，只能包含有效的 JSON 文本：
{
  "phase": "probing/pressuring/conflict/cooling/repairing",
  "confidence": 0.8,
  "reasoning": "简短判断依据（不超过30字）"
}`;

export async function classifyConversationPhase(
  rawText: string,
  historyText: string,
  settings: AppSettings
): Promise<{ phase: ConversationPhase; confidence: number; reasoning: string }> {
  try {
    const client = getClient(settings);
    const model = client(settings.model);

    const prompt = `【当前对话内容】
${rawText}

${historyText ? `【近期对话历史】\n${historyText}` : '【近期对话历史】无'}

请判断当前对话阶段。`;

    const { text } = await generateText({
      model,
      system: PHASE_CLASSIFICATION_PROMPT,
      prompt,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const validPhases: ConversationPhase[] = ['probing', 'pressuring', 'conflict', 'cooling', 'repairing'];
    const phase = validPhases.includes(parsed.phase) ? parsed.phase : 'probing';

    return {
      phase,
      confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
      reasoning: parsed.reasoning || '',
    };
  } catch (error) {
    console.error('[Context-Pod] Phase classification failed:', error);
    return {
      phase: classifyPhaseByHeuristics(rawText),
      confidence: 0.3,
      reasoning: '基于关键词的启发式判断',
    };
  }
}

function classifyPhaseByHeuristics(text: string): ConversationPhase {
  const conflictKeywords = ['生气', '愤怒', '不满', '凭什么', '过分', '忍不了', '吵', '骂', '滚', '烦死'];
  const pressureKeywords = ['赶紧', '马上', '催', '什么时候', '怎么还没', '到底', '快点', '立刻', '现在'];
  const coolingKeywords = ['嗯', '哦', '好的', '随便', '无所谓', '不知道', '还行'];
  const repairKeywords = ['对不起', '抱歉', '不好意思', '和好', '原谅', '想你了', '别生气'];
  const probeKeywords = ['你觉得', '怎么样', '是不是', '能不能', '有没有', '想不想'];

  const lowerText = text.toLowerCase();

  const scores: Record<ConversationPhase, number> = {
    conflict: conflictKeywords.filter(k => lowerText.includes(k)).length,
    pressuring: pressureKeywords.filter(k => lowerText.includes(k)).length,
    cooling: coolingKeywords.filter(k => lowerText.includes(k)).length,
    repairing: repairKeywords.filter(k => lowerText.includes(k)).length,
    probing: probeKeywords.filter(k => lowerText.includes(k)).length,
  };

  const maxPhase = Object.entries(scores).reduce((a, b) => a[1] >= b[1] ? a : b);
  return maxPhase[1] > 0 ? maxPhase[0] as ConversationPhase : 'probing';
}

export function getPhaseLabel(phase: ConversationPhase): string {
  return CONVERSATION_PHASE_LABELS[phase] || phase;
}

export function getPhaseStrategyHint(phase: ConversationPhase): string {
  const hints: Record<ConversationPhase, string> = {
    probing: '对方在试探，建议轻解释、不露底牌',
    pressuring: '对方在施压，建议给确定性、留缓冲',
    conflict: '冲突升级中，建议先降温、不硬刚',
    cooling: '对方在疏远，建议反拉关系、找共同点',
    repairing: '对方在示好，建议接住善意、顺势修复',
  };
  return hints[phase];
}
