import { createOpenAI } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';
import type { ReplyStrategy, AppSettings } from '@/types';
import { getPrompt } from './promptService';

// 缓存 LLM 客户端
const clientCache = new Map<string, any>();
// 缓存系统提示词
const systemPromptCache = new Map<string, string>();

function getCacheKey(settings: AppSettings): string {
  return `${settings.provider}:${settings.apiKey.substring(0, 8)}:${settings.baseUrl}:${settings.model}`;
}

export function getClient(settings: AppSettings) {
  const cacheKey = getCacheKey(settings);
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }
  
  const client = createOpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
  });
  clientCache.set(cacheKey, client);
  return client;
}

function getCachedSystemPrompt(): string {
  const key = 'system-main';
  if (systemPromptCache.has(key)) {
    return systemPromptCache.get(key) as string;
  }
  
  const prompt = getPrompt(key)?.content || FALLBACK_SYSTEM_PROMPT;
  systemPromptCache.set(key, prompt);
  return prompt;
}

function normalizeRiskLevel(risk: any): 'low' | 'medium' | 'high' {
  if (risk === 'low' || risk === 'medium' || risk === 'high') return risk;
  if (typeof risk === 'string') {
    const lower = risk.toLowerCase();
    if (lower.includes('低') || lower.includes('low')) return 'low';
    if (lower.includes('中') || lower.includes('medium') || lower.includes('mid')) return 'medium';
    if (lower.includes('高') || lower.includes('high')) return 'high';
  }
  return 'medium';
}

function ensureV2Strategies(strategies: any[]): ReplyStrategy[] {
  return strategies.map((s, idx) => ({
    label: s.label || String.fromCharCode(65 + idx),
    style: s.style || '策略' + String.fromCharCode(65 + idx),
    tacticalGoal: s.tacticalGoal || s.tactical_goal || '',
    content: s.content || '',
    riskLevel: normalizeRiskLevel(s.riskLevel || s.risk_level),
    expectedReaction: s.expectedReaction || s.expected_reaction || '',
  }));
}

const FALLBACK_STRATEGIES: ReplyStrategy[] = [
  { label: 'A', style: '端水软垫铺路', tacticalGoal: '稳住局面，给确定性', content: '好的，收到！', riskLevel: 'low', expectedReaction: '对方可能暂时缓和' },
  { label: 'B', style: '反向提问设限', tacticalGoal: '转移压力，争取时间', content: '这个需要再确认一下细节', riskLevel: 'medium', expectedReaction: '对方可能继续追问' },
  { label: 'C', style: '直接表达诉求', tacticalGoal: '表明立场，不配合内卷', content: '收到，已经在推进了', riskLevel: 'high', expectedReaction: '对方可能不满但会接受' },
];

export async function generateStrategies(
  prompt: string,
  settings: AppSettings
): Promise<ReplyStrategy[]> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = getCachedSystemPrompt();

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (Array.isArray(parsed)) {
      return ensureV2Strategies(parsed);
    }

    return FALLBACK_STRATEGIES;
  } catch (error) {
    console.error('LLM generation failed:', error);
    return FALLBACK_STRATEGIES;
  }
}

export async function streamStrategies(
  prompt: string,
  settings: AppSettings,
  onChunk: (text: string) => void,
  onDone: (strategies: ReplyStrategy[]) => void
): Promise<void> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = getCachedSystemPrompt();

  try {
    const result = streamText({
      model,
      system: systemPrompt,
      prompt,
    });

    let fullText = '';
    for await (const chunk of result.textStream) {
      fullText += chunk;
      onChunk(fullText);
    }

    try {
      const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (Array.isArray(parsed)) {
        onDone(ensureV2Strategies(parsed));
      } else {
        onDone(FALLBACK_STRATEGIES);
      }
    } catch {
      onDone(FALLBACK_STRATEGIES);
    }
  } catch (error) {
    console.error('LLM streaming failed:', error);
    onChunk('生成失败，请检查API配置');
    onDone([]);
  }
}

const FALLBACK_SYSTEM_PROMPT = `你是顶级企业危机处理公关专家、情感博主与社交博弈战神。
当前任务：你的用户目前遇到了一个非常棘手的微信聊天局面。你将充当该用户的"外脑与隐形手"，为其提供高情商的话术反制和回应策略。

【绝对禁令】
1. 绝不允许输出类似"抱歉、非常理解你的感受、我建议"这种标准的大模型客服套话！
2. 把你自己想象成是一个真实的职场青年。
3. 允许轻微不完美表达，禁止过度工整。
4. 优先满足"真实博弈目的"，而不是"礼貌正确性"。

请生成3种风格鲜明的回复方案，严格按 JSON 数组格式输出：
[
  {"label": "A", "style": "方案描述", "tacticalGoal": "战术目的", "content": "回复内容", "riskLevel": "low/medium/high", "expectedReaction": "对方预判反应"},
  {"label": "B", "style": "方案描述", "tacticalGoal": "战术目的", "content": "回复内容", "riskLevel": "medium", "expectedReaction": "对方预判反应"},
  {"label": "C", "style": "方案描述", "tacticalGoal": "战术目的", "content": "回复内容", "riskLevel": "high", "expectedReaction": "对方预判反应"}
]`;
