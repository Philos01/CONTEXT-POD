import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { StrategyEvaluation, AppSettings } from '@/types';

const EVALUATION_KEY = 'context-pod-strategy-evaluations';

function getClient(settings: AppSettings) {
  return createOpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
  });
}

const EVALUATION_PROMPT = `你是一位社交策略复盘专家。请评估上次建议的回复策略是否有效。

根据以下信息判断：
1. 我们上次建议的回复策略
2. 对方在收到回复后的反应

请评估策略效果，必须严格按以下 JSON 格式输出：
{
  "result": "success/failure/neutral",
  "reason": "判断原因（不超过30字）",
  "adjustment": "下次遇到类似情况应如何调整（不超过30字）"
}`;

export function loadEvaluations(): StrategyEvaluation[] {
  try {
    const saved = localStorage.getItem(EVALUATION_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return [];
}

export function saveEvaluations(evaluations: StrategyEvaluation[]) {
  localStorage.setItem(EVALUATION_KEY, JSON.stringify(evaluations.slice(-50)));
}

export function getEvaluationsByContact(contactName: string): StrategyEvaluation[] {
  return loadEvaluations().filter(e => e.contactName === contactName);
}

export function getRecentEvaluations(contactName: string, limit: number = 3): StrategyEvaluation[] {
  return getEvaluationsByContact(contactName)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function evaluateStrategy(
  contactName: string,
  strategyLabel: string,
  strategyContent: string,
  opponentResponse: string,
  settings: AppSettings
): Promise<StrategyEvaluation> {
  try {
    const client = getClient(settings);
    const model = client(settings.model);

    const prompt = `【上次建议的回复策略】
方案${strategyLabel}：${strategyContent}

【对方在收到回复后的反应】
${opponentResponse}

请评估这个策略的效果。`;

    const { text } = await generateText({
      model,
      system: EVALUATION_PROMPT,
      prompt,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const evaluation: StrategyEvaluation = {
      result: ['success', 'failure', 'neutral'].includes(parsed.result) ? parsed.result : 'neutral',
      reason: parsed.reason || '无法判断',
      adjustment: parsed.adjustment || '暂无调整建议',
      timestamp: Date.now(),
      contactName,
      strategyLabel,
      strategyContent,
      opponentResponse,
    };

    const evaluations = loadEvaluations();
    evaluations.push(evaluation);
    saveEvaluations(evaluations);

    console.log(`[Context-Pod] 📊 Strategy evaluation for "${contactName}": ${evaluation.result} - ${evaluation.reason}`);
    return evaluation;
  } catch (error) {
    console.error('[Context-Pod] Strategy evaluation failed:', error);
    const evaluation: StrategyEvaluation = {
      result: 'neutral',
      reason: '评估失败',
      adjustment: '暂无调整建议',
      timestamp: Date.now(),
      contactName,
      strategyLabel,
      strategyContent,
      opponentResponse,
    };

    const evaluations = loadEvaluations();
    evaluations.push(evaluation);
    saveEvaluations(evaluations);

    return evaluation;
  }
}

export function buildFeedbackSection(contactName: string): string {
  const evaluations = getRecentEvaluations(contactName);

  if (evaluations.length === 0) {
    return '';
  }

  const lines = evaluations.map(e => {
    const icon = e.result === 'success' ? '✅' : e.result === 'failure' ? '❌' : '➖';
    return `${icon} 方案${e.strategyLabel}：${e.reason} | 调整：${e.adjustment}`;
  });

  return `【历史策略复盘记录】\n${lines.join('\n')}`;
}

export function buildHistoricalEvaluationsSummary(contactName: string): string {
  const evaluations = getEvaluationsByContact(contactName);

  if (evaluations.length === 0) {
    return '暂无历史策略复盘数据';
  }

  const successCount = evaluations.filter(e => e.result === 'success').length;
  const failureCount = evaluations.filter(e => e.result === 'failure').length;
  const neutralCount = evaluations.filter(e => e.result === 'neutral').length;

  const recentAdjustments = evaluations
    .filter(e => e.adjustment && e.adjustment !== '暂无调整建议')
    .slice(-3)
    .map(e => e.adjustment);

  return `共${evaluations.length}次策略评估：成功${successCount}次，失败${failureCount}次，中性${neutralCount}次。${
    recentAdjustments.length > 0 ? '近期调整建议：' + recentAdjustments.join('；') : ''
  }`;
}

export function detectFeedbackOpportunity(
  contactName: string,
  currentMessages: string[],
  lastStrategyContent: string
): string | null {
  if (!lastStrategyContent) return null;

  const lastUserMsg = currentMessages
    .filter(m => !m.startsWith(contactName) && !m.startsWith('我'))
    .pop();

  if (!lastUserMsg) return null;

  const similarity = calculateSimpleSimilarity(lastUserMsg, lastStrategyContent);
  if (similarity > 0.4) {
    return lastUserMsg;
  }

  return null;
}

function calculateSimpleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}
