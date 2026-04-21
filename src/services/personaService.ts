import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { DynamicPersonaSchema, StylePersona, AppSettings, PowerIdentityTrait, PsychologicalNeed, TabooRule, ExperienceEvent } from '@/types';
import { getPrompt } from '@/services/promptService';
import { getLogger } from './logger';

const logger = getLogger('personaService');

const PERSONA_KEY = 'context-pod-personas';
const DYNAMIC_PERSONA_KEY = 'context-pod-dynamic-personas';

function getClient(settings: AppSettings) {
  return createOpenAI({
    apiKey: settings.apiKey,
    baseURL: settings.baseUrl,
  });
}

export function loadPersonas(): Record<string, StylePersona> {
  try {
    const saved = localStorage.getItem(PERSONA_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {};
}

export function savePersonas(personas: Record<string, StylePersona>) {
  localStorage.setItem(PERSONA_KEY, JSON.stringify(personas));
}

export function loadDynamicPersonas(): Record<string, DynamicPersonaSchema> {
  try {
    const saved = localStorage.getItem(DYNAMIC_PERSONA_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  return {};
}

export function saveDynamicPersonas(personas: Record<string, DynamicPersonaSchema>) {
  localStorage.setItem(DYNAMIC_PERSONA_KEY, JSON.stringify(personas));
}

export function getPersona(contactName: string): StylePersona | null {
  const personas = loadPersonas();
  return personas[contactName] || null;
}

export function savePersona(contactName: string, persona: StylePersona) {
  const personas = loadPersonas();
  personas[contactName] = persona;
  savePersonas(personas);
}

export function getDynamicPersona(contactName: string): DynamicPersonaSchema | null {
  const personas = loadDynamicPersonas();
  return personas[contactName] || null;
}

export function saveDynamicPersona(contactName: string, persona: DynamicPersonaSchema) {
  logger.info('Saving dynamic persona', { contactName, temperature: persona.temperature });
  const personas = loadDynamicPersonas();
  personas[contactName] = persona;
  saveDynamicPersonas(personas);
  logger.debug('Dynamic persona saved successfully');
}

export async function extractDynamicPersona(
  chatText: string,
  contactName: string,
  settings: AppSettings
): Promise<DynamicPersonaSchema> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = getPrompt('style-extraction')?.content || `你是一位拥有FBI行为分析经验的资深职场社交分析师与心理学家。
请通过分析以下我提供的微信聊天片段，提炼并逆推该用户极其精准的"聊天心理指纹与权力关系特征"。

不要纠结这段对话讲了什么事件，要像探针一样剖析"这个人在交际时的权力与情绪逻辑"。
必须严格按以下 JSON 格式输出，只能包含有效的 JSON 文本，绝不允许有任何附加标记、markdown 或是反引号：

{
  "powerIdentity": [
    {"trait": "从口吻推测的潜意识身份特征", "confidence": 0.8, "observationsCount": 1, "decayRate": 0.05}
  ],
  "psychologicalNeeds": [
    {"need": "他在沟通中最渴望得到什么反馈", "weight": 0.9}
  ],
  "taboos": [
    {"rule": "交往雷区警告，绝对不能用什么形式或词汇", "riskFactor": 0.95}
  ],
  "temperature": 5,
  "textStyle": "语用偏好描述（断句规律、特定黑话术语、标点癖好，一句话极简描述）",
  "newDiscoveries": "从这批聊天记录里发现的他前所未有的特定怪癖或情绪拐点（不超过20字，若无新发现写\"无\"）"
}`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `【待分析的聊天记录】：\n${chatText}`,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);

    const persona: DynamicPersonaSchema = {
      targetId: contactName,
      updateTick: Date.now(),
      powerIdentity: (parsed.powerIdentity || []).map((p: any) => ({
        trait: p.trait || '',
        confidence: Math.min(1, Math.max(0, p.confidence || 0.5)),
        observationsCount: p.observationsCount || 1,
        decayRate: p.decayRate || 0.05,
      })),
      psychologicalNeeds: (parsed.psychologicalNeeds || []).map((n: any) => ({
        need: n.need || '',
        weight: Math.min(1, Math.max(0, n.weight || 0.5)),
      })),
      taboos: (parsed.taboos || []).map((t: any) => ({
        rule: t.rule || '',
        riskFactor: Math.min(1, Math.max(0, t.riskFactor || 0.5)),
      })),
      temperature: parsed.temperature || 5,
      textStyle: parsed.textStyle || '未知',
      experienceEvents: parsed.newDiscoveries && parsed.newDiscoveries !== '无'
        ? [{ behaviorTrendDesc: parsed.newDiscoveries, timestamp: Date.now() }]
        : [],
      summary: buildSummaryFromDynamic(parsed),
      sampleCount: chatText.split('\n').filter(l => l.trim()).length,
      updatedAt: Date.now(),
    };

    return persona;
  } catch (error) {
    console.error('[Context-Pod] Dynamic persona extraction failed:', error);
    return createEmptyDynamicPersona(contactName);
  }
}

function buildSummaryFromDynamic(parsed: any): string {
  const identity = (parsed.powerIdentity || []).map((p: any) => p.trait).join('；');
  const needs = (parsed.psychologicalNeeds || []).map((n: any) => n.need).join('；');
  const temp = parsed.temperature || 5;
  const tempDesc = temp >= 8 ? '极度外向话痨' : temp >= 6 ? '偏外向健谈' : temp >= 4 ? '中性平稳' : temp >= 2 ? '偏内敛沉默' : '极度高冷疏离';
  return `${identity || '身份未明'} | 需要：${needs || '待观察'} | 热度：${tempDesc}`;
}

function createEmptyDynamicPersona(contactName: string): DynamicPersonaSchema {
  return {
    targetId: contactName,
    updateTick: Date.now(),
    powerIdentity: [],
    psychologicalNeeds: [],
    taboos: [],
    temperature: 5,
    textStyle: '未知',
    experienceEvents: [],
    summary: '画像提取失败，将使用通用回复策略',
    sampleCount: 0,
    updatedAt: Date.now(),
  };
}

export async function extractStyleFromChat(
  chatText: string,
  settings: AppSettings
): Promise<StylePersona> {
  console.log('[Context-Pod:Diagnostic] ================ extractStyleFromChat START ================');
  console.log('[Context-Pod:Diagnostic] chatText length:', chatText.length);
  console.log('[Context-Pod:Diagnostic] settings.provider:', settings.provider);
  console.log('[Context-Pod:Diagnostic] settings.baseUrl:', settings.baseUrl);
  console.log('[Context-Pod:Diagnostic] settings.model:', settings.model);
  console.log('[Context-Pod:Diagnostic] settings.apiKey:', settings.apiKey ? `${settings.apiKey.substring(0, 8)}...` : 'EMPTY/NULL');
  
  try {
    console.log('[Context-Pod:Diagnostic] Step 1: Getting client & model...');
    const client = getClient(settings);
    const model = client(settings.model);
    console.log('[Context-Pod:Diagnostic] ✓ Client & model ready');

    const systemPrompt = getPrompt('style-extraction')?.content || `你是一个语言学与心理学大师。请分析以下提供的一段真实微信聊天记录，提取出该用户的"聊天指纹"。
不需要关注聊天的具体内容（事件），请仅从以下 5 个维度输出 JSON 格式的风格参数：

1. sentenceStyle: 断句与排版
2. catchphrases: 口癖与语气词
3. emotionLevel: 情绪颗粒度
4. vocabFeatures: 词汇特征
5. punctuationHabits: 标点习惯

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "sentenceStyle": "描述",
  "catchphrases": ["词1", "词2"],
  "emotionLevel": "高热量/低热量/阴阳怪气",
  "vocabFeatures": "描述",
  "punctuationHabits": "描述",
  "summary": "一段50字以内的整体风格总结"
}`;

    console.log('[Context-Pod:Diagnostic] Step 2: Calling generateText...');
    const startTime = performance.now();
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `【待分析的聊天记录】：\n${chatText}`,
    });
    const endTime = performance.now();
    console.log(`[Context-Pod:Diagnostic] ✓ generateText returned in ${Math.round(endTime - startTime)}ms`);
    console.log('[Context-Pod:Diagnostic] LLM Response (length):', text.length, 'characters');
    console.log('[Context-Pod:Diagnostic] LLM Response (first 200 chars):', text.substring(0, 200));

    console.log('[Context-Pod:Diagnostic] Step 3: Cleaning & parsing JSON...');
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    console.log('[Context-Pod:Diagnostic] Cleaned JSON:', cleaned);
    
    const parsed = JSON.parse(cleaned);
    console.log('[Context-Pod:Diagnostic] ✓ JSON.parse successful');
    console.log('[Context-Pod:Diagnostic] Parsed object keys:', Object.keys(parsed));

    const persona: StylePersona = {
      sentenceStyle: parsed.sentenceStyle || '未知',
      catchphrases: parsed.catchphrases || [],
      emotionLevel: parsed.emotionLevel || '未知',
      vocabFeatures: parsed.vocabFeatures || '未知',
      punctuationHabits: parsed.punctuationHabits || '未知',
      summary: parsed.summary || '风格提取失败，将使用通用回复策略',
      sampleCount: chatText.split('\n').filter(l => l.trim()).length,
      updatedAt: Date.now(),
    };
    
    console.log('[Context-Pod:Diagnostic] ✓ Final persona constructed:', persona);
    console.log('[Context-Pod:Diagnostic] ================ extractStyleFromChat END (SUCCESS) ================');
    return persona;
    
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : '';
    console.error('[Context-Pod:Diagnostic] ================ extractStyleFromChat END (FAIL) ================');
    console.error('[Context-Pod:Diagnostic] ERROR:', error);
    console.error('[Context-Pod:Diagnostic] Error message:', errMsg);
    console.error('[Context-Pod:Diagnostic] Stack trace:', errStack);
    
    return {
      sentenceStyle: '未知',
      catchphrases: [],
      emotionLevel: '未知',
      vocabFeatures: '未知',
      punctuationHabits: '未知',
      summary: '风格提取失败，将使用通用回复策略',
      sampleCount: 0,
      updatedAt: Date.now(),
      isFallback: true,
      fallbackReason: errMsg,
    };
  }
}

export async function extractStyleFromQuiz(
  answers: string[],
  mbti: string,
  settings: AppSettings
): Promise<StylePersona> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = `你是一个语言学与心理学大师。用户刚刚完成了一个"赛博捏脸"快问快答测试，提供了3个极端场景下的本能回复。
同时用户提供了自己的MBTI人格属性。
请从这些回复中提取用户的"聊天指纹"，仅从以下 5 个维度输出 JSON 格式的风格参数：

1. sentenceStyle: 断句与排版
2. catchphrases: 口癖与语气词
3. emotionLevel: 情绪颗粒度
4. vocabFeatures: 词汇特征
5. punctuationHabits: 标点习惯

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "sentenceStyle": "描述",
  "catchphrases": ["词1", "词2"],
  "emotionLevel": "高热量/低热量/阴阳怪气",
  "vocabFeatures": "描述",
  "punctuationHabits": "描述",
  "summary": "一段50字以内的整体风格总结"
}`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `用户MBTI: ${mbti}

场景1 - 老板深夜找你改方案，用户回复："${answers[0]}"
场景2 - 相亲对象约饭但想打游戏，用户回复："${answers[1]}"
场景3 - 朋友发了搞笑视频，用户回复："${answers[2]}"`,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    const persona: StylePersona = {
      sentenceStyle: parsed.sentenceStyle || '未知',
      catchphrases: parsed.catchphrases || [],
      emotionLevel: parsed.emotionLevel || '未知',
      vocabFeatures: parsed.vocabFeatures || '未知',
      punctuationHabits: parsed.punctuationHabits || '未知',
      summary: parsed.summary || '风格提取失败',
      sampleCount: 3,
      updatedAt: Date.now(),
    };
    
    return persona;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error('[Context-Pod] Quiz style extraction failed:', error);
    return {
      sentenceStyle: '未知',
      catchphrases: [],
      emotionLevel: '未知',
      vocabFeatures: '未知',
      punctuationHabits: '未知',
      summary: '风格提取失败',
      sampleCount: 0,
      updatedAt: Date.now(),
      isFallback: true,
      fallbackReason: errMsg,
    };
  }
}

export function mergePersona(existing: StylePersona, _newSamples: string, updatedPersona: StylePersona): StylePersona {
  const merged: StylePersona = {
    ...existing,
    ...updatedPersona,
    catchphrases: [...new Set([...existing.catchphrases, ...updatedPersona.catchphrases])],
    sampleCount: (existing.sampleCount || 0) + (updatedPersona.sampleCount || 0),
    updatedAt: Date.now(),
  };

  if (updatedPersona.summary && updatedPersona.summary !== '风格提取失败') {
    merged.summary = updatedPersona.summary;
  }

  return merged;
}

export function mergeDynamicPersona(
  existing: DynamicPersonaSchema,
  updated: DynamicPersonaSchema
): DynamicPersonaSchema {
  const mergedPowerIdentity = mergePowerIdentity(existing.powerIdentity, updated.powerIdentity);
  const mergedNeeds = mergePsychologicalNeeds(existing.psychologicalNeeds, updated.psychologicalNeeds);
  const mergedTaboos = mergeTaboos(existing.taboos, updated.taboos);

  const mergedEvents: ExperienceEvent[] = [
    ...existing.experienceEvents,
    ...updated.experienceEvents,
  ].slice(-20);

  const temperature = updated.temperature > 0
    ? Math.round((existing.temperature * 0.6 + updated.temperature * 0.4) * 10) / 10
    : existing.temperature;

  return {
    targetId: existing.targetId,
    updateTick: Date.now(),
    powerIdentity: mergedPowerIdentity,
    psychologicalNeeds: mergedNeeds,
    taboos: mergedTaboos,
    temperature,
    textStyle: updated.textStyle !== '未知' ? updated.textStyle : existing.textStyle,
    experienceEvents: mergedEvents,
    summary: updated.summary !== '画像提取失败' ? updated.summary : existing.summary,
    sampleCount: (existing.sampleCount || 0) + (updated.sampleCount || 0),
    updatedAt: Date.now(),
  };
}

function mergePowerIdentity(
  existing: PowerIdentityTrait[],
  updated: PowerIdentityTrait[]
): PowerIdentityTrait[] {
  const merged = [...existing];

  for (const newTrait of updated) {
    const existingIdx = merged.findIndex(
      e => e.trait === newTrait.trait || similarity(e.trait, newTrait.trait) > 0.6
    );

    if (existingIdx >= 0) {
      const existingTrait = merged[existingIdx];
      merged[existingIdx] = {
        trait: newTrait.trait || existingTrait.trait,
        confidence: Math.min(1, existingTrait.confidence + 0.1),
        observationsCount: existingTrait.observationsCount + 1,
        decayRate: existingTrait.decayRate * 0.9,
      };
    } else {
      merged.push({
        ...newTrait,
        observationsCount: 1,
        decayRate: 0.1,
      });
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence).slice(0, 10);
}

function mergePsychologicalNeeds(
  existing: PsychologicalNeed[],
  updated: PsychologicalNeed[]
): PsychologicalNeed[] {
  const merged = [...existing];

  for (const newNeed of updated) {
    const existingIdx = merged.findIndex(
      e => e.need === newNeed.need || similarity(e.need, newNeed.need) > 0.6
    );

    if (existingIdx >= 0) {
      merged[existingIdx] = {
        need: newNeed.need || merged[existingIdx].need,
        weight: Math.min(1, merged[existingIdx].weight * 0.7 + newNeed.weight * 0.3),
      };
    } else {
      merged.push({ ...newNeed });
    }
  }

  return merged.sort((a, b) => b.weight - a.weight).slice(0, 8);
}

function mergeTaboos(existing: TabooRule[], updated: TabooRule[]): TabooRule[] {
  const merged = [...existing];

  for (const newTaboo of updated) {
    const existingIdx = merged.findIndex(
      e => e.rule === newTaboo.rule || similarity(e.rule, newTaboo.rule) > 0.6
    );

    if (existingIdx >= 0) {
      merged[existingIdx] = {
        rule: newTaboo.rule || merged[existingIdx].rule,
        riskFactor: Math.max(merged[existingIdx].riskFactor, newTaboo.riskFactor),
      };
    } else {
      merged.push({ ...newTaboo });
    }
  }

  return merged.sort((a, b) => b.riskFactor - a.riskFactor).slice(0, 8);
}

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(a.split(''));
  const setB = new Set(b.split(''));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function applyDecay(persona: DynamicPersonaSchema): DynamicPersonaSchema {
  const now = Date.now();
  const hoursSinceUpdate = (now - persona.updateTick) / (1000 * 60 * 60);

  if (hoursSinceUpdate < 24) return persona;

  const decayedPowerIdentity = persona.powerIdentity.map(trait => ({
    ...trait,
    confidence: Math.max(0.1, trait.confidence - trait.decayRate * hoursSinceUpdate / 24),
  }));

  return {
    ...persona,
    powerIdentity: decayedPowerIdentity,
    updateTick: now,
  };
}

export function formatPersonaForPrompt(persona: StylePersona): string {
  return `【风格画像】
- 断句排版: ${persona.sentenceStyle}
- 口癖语气: ${persona.catchphrases.length > 0 ? persona.catchphrases.join('、') : '无特殊口癖'}
- 情绪风格: ${persona.emotionLevel}
- 词汇特征: ${persona.vocabFeatures}
- 标点习惯: ${persona.punctuationHabits}
- 风格总结: ${persona.summary}`;
}

export function formatDynamicPersonaForPrompt(persona: DynamicPersonaSchema): string {
  const identityStr = persona.powerIdentity
    .filter(p => p.confidence >= 0.3)
    .map(p => `${p.trait}(把握${Math.round(p.confidence * 100)}%)`)
    .join('；');

  const needsStr = persona.psychologicalNeeds
    .filter(n => n.weight >= 0.3)
    .map(n => `${n.need}(优先${Math.round(n.weight * 100)}%)`)
    .join('；');

  const taboosStr = persona.taboos
    .filter(t => t.riskFactor >= 0.3)
    .map(t => `⚠️${t.rule}(危险度${Math.round(t.riskFactor * 100)}%)`)
    .join('；');

  const eventsStr = persona.experienceEvents.length > 0
    ? persona.experienceEvents.slice(-3).map(e => e.behaviorTrendDesc).join('；')
    : '无';

  return `【对手深度全景资料分析扫描记录卡】
- 权力身份: ${identityStr || '待观察'}
- 核心诉求: ${needsStr || '待观察'}
- 沟通禁区: ${taboosStr || '暂无明确禁忌'}
- 热度评分: ${persona.temperature}/10
- 语用偏好: ${persona.textStyle}
- 近期行为趋势: ${eventsStr}
- 综合总结: ${persona.summary}`;
}

export function renamePersona(oldName: string, newName: string): void {
  console.log(`[PersonaService] Renaming persona from "${oldName}" to "${newName}"`);

  const personas = loadPersonas();
  if (personas[oldName] && oldName !== newName) {
    personas[newName] = { ...personas[oldName], updatedAt: Date.now() };
    delete personas[oldName];
    savePersonas(personas);
  }

  const dynamicPersonas = loadDynamicPersonas();
  if (dynamicPersonas[oldName] && oldName !== newName) {
    dynamicPersonas[newName] = { ...dynamicPersonas[oldName], targetId: newName, updatedAt: Date.now() };
    delete dynamicPersonas[oldName];
    saveDynamicPersonas(dynamicPersonas);
  }
}

export function deletePersona(contactName: string): void {
  console.log(`[PersonaService] Deleting persona for "${contactName}"`);
  
  const personas = loadPersonas();
  if (personas[contactName]) {
    delete personas[contactName];
    savePersonas(personas);
  }
  
  const dynamicPersonas = loadDynamicPersonas();
  if (dynamicPersonas[contactName]) {
    delete dynamicPersonas[contactName];
    saveDynamicPersonas(dynamicPersonas);
  }
}
