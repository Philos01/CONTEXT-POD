import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';
import type { StylePersona, AppSettings } from '@/types';

const PERSONA_KEY = 'context-pod-personas';

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

export function getPersona(contactName: string): StylePersona | null {
  const personas = loadPersonas();
  return personas[contactName] || null;
}

export function savePersona(contactName: string, persona: StylePersona) {
  const personas = loadPersonas();
  personas[contactName] = persona;
  savePersonas(personas);
}

export async function extractStyleFromChat(
  chatText: string,
  settings: AppSettings
): Promise<StylePersona> {
  const client = getClient(settings);
  const model = client(settings.model);

  const systemPrompt = `你是一个语言学与心理学大师。请分析以下提供的一段真实微信聊天记录，提取出该用户的"聊天指纹"。
不需要关注聊天的具体内容（事件），请仅从以下 5 个维度输出 JSON 格式的风格参数：

1. sentenceStyle: 断句与排版 - 喜欢发长段落，还是喜欢把一句话拆成好几条短句连发？是否使用标点符号？
2. catchphrases: 口癖与语气词 - 常用哪些语气词（如：哈、呢、呗、滴、啊、hhh、笑哭emoji）？
3. emotionLevel: 情绪颗粒度 - 语气是高热量（热情洋溢）、低热量（高冷极简），还是阴阳怪气？
4. vocabFeatures: 词汇特征 - 是否喜欢混杂英文、缩写（yyds, xswl）或体制内/互联网黑话（对齐、抓手、收到）？
5. punctuationHabits: 标点习惯 - 喜欢用波浪号(~)、多个感叹号(!!)，还是全网句号结尾？

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "sentenceStyle": "描述",
  "catchphrases": ["词1", "词2"],
  "emotionLevel": "高热量/低热量/阴阳怪气",
  "vocabFeatures": "描述",
  "punctuationHabits": "描述",
  "summary": "一段50字以内的整体风格总结，用于后续生成回复时参考"
}`;

  try {
    const { text } = await generateText({
      model,
      system: systemPrompt,
      prompt: `【待分析的聊天记录】：\n${chatText}`,
    });

    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const persona: StylePersona = JSON.parse(cleaned);
    persona.updatedAt = Date.now();
    persona.sampleCount = chatText.split('\n').filter(l => l.trim()).length;
    return persona;
  } catch (error) {
    console.error('[Context-Pod] Style extraction failed:', error);
    return {
      sentenceStyle: '未知',
      catchphrases: [],
      emotionLevel: '未知',
      vocabFeatures: '未知',
      punctuationHabits: '未知',
      summary: '风格提取失败，将使用通用回复策略',
      sampleCount: 0,
      updatedAt: Date.now(),
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
    const persona: StylePersona = JSON.parse(cleaned);
    persona.updatedAt = Date.now();
    persona.sampleCount = 3;
    return persona;
  } catch (error) {
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

export function formatPersonaForPrompt(persona: StylePersona): string {
  return `【风格画像】
- 断句排版: ${persona.sentenceStyle}
- 口癖语气: ${persona.catchphrases.length > 0 ? persona.catchphrases.join('、') : '无特殊口癖'}
- 情绪风格: ${persona.emotionLevel}
- 词汇特征: ${persona.vocabFeatures}
- 标点习惯: ${persona.punctuationHabits}
- 风格总结: ${persona.summary}`;
}

export function renamePersona(oldName: string, newName: string): void {
  console.log(`[PersonaService] Renaming persona from "${oldName}" to "${newName}"`);
  const personas = loadPersonas();
  if (personas[oldName] && oldName !== newName) {
    console.log(`[PersonaService] Found persona for "${oldName}", transferring to "${newName}"`);
    personas[newName] = {
      ...personas[oldName],
      updatedAt: Date.now(),
    };
    delete personas[oldName];
    savePersonas(personas);
    console.log(`[PersonaService] Persona rename completed`);
  } else {
    console.log(`[PersonaService] No persona found for "${oldName}" or name didn't change`);
  }
}