export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'style-extraction' | 'quiz' | 'reply-generation';
  content: string;
  variables: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

const PROMPTS_KEY = 'context-pod-prompts';

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'system-main',
    name: '主系统提示词',
    description: 'AI 回复生成的核心指令',
    category: 'system',
    content: `你是一个语言学与心理学大师。请分析以下我提供的一段真实微信聊天记录，提取出该用户的"聊天指纹"。
不需要关注聊天的具体内容（事件），请仅从以下 5 个维度输出 JSON 格式的风格参数：

1. [断句与排版]: 喜欢发长段落，还是喜欢把一句话拆成好几条短句连发？是否使用标点符号？
2. [口癖与语气词]: 常用哪些语气词（如：哈、呢、呗、滴、啊、hhh、笑哭emoji）？
3. [情绪颗粒度]: 语气是高热量（热情洋溢）、低热量（高冷极简），还是阴阳怪气？
4. [词汇特征]: 是否喜欢混杂英文、缩写（yyds, xswl）或体制内/互联网黑话（对齐、抓手、收到）？
5. [标点习惯]: 喜欢用波浪号(~)、多个感叹号(!!)，还是全网句尾号结尾？

严格按以下 JSON 格式输出，不要有任何其他内容：
{
  "sentenceStyle": "描述",
  "catchphrases": ["词1", "词2"],
  "emotionLevel": "高热量/低热量/阴阳怪气",
  "vocabFeatures": "描述",
  "punctuationHabits": "描述",
  "summary": "一段50字以内的整体风格总结"
}`,
    variables: ['chatText'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'style-extraction',
    name: '风格提取提示词',
    description: '从聊天记录中提取用户风格的提示词',
    category: 'style-extraction',
    content: `你是一个顶尖的公关专家和高情商对话大师。
根据上下文和对方性格特点，生成三种不同风格的高情商回复策略。

严格按以下 JSON 格式输出：
[
  {"label": "A", "style": "顺从推进", "content": "回复内容"},
  {"label": "B", "style": "委婉甩锅", "content": "回复内容"},
  {"label": "C", "style": "幽默化解", "content": "回复内容"}
]`,
    variables: ['context', 'personality', 'persona'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'reply-generation',
    name: '回复生成提示词',
    description: '生成最终回复策略的提示词',
    category: 'reply-generation',
    content: `你正在和【{targetPerson}】对话。
{memorySection}
{personaSection}
{historySection}

【当前聊天上下文】
{rawText}

请根据以上所有信息（风格画像+历史对话+性格档案+当前上下文），生成三种高情商的回复策略。

要求：
1. 回复要结合历史对话的语境，保持连贯性
2. 考虑对方性格特点，选择最合适的措辞
3. 如果历史对话中有未完成的话题，要延续下去`,
    variables: ['targetPerson', 'memorySection', 'personaSection', 'historySection', 'rawText'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function loadPrompts(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(PROMPTS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // ignore
  }
  savePrompts(DEFAULT_PROMPTS);
  return [...DEFAULT_PROMPTS];
}

export function savePrompts(prompts: PromptTemplate[]) {
  localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
}

export function getPrompt(id: string): PromptTemplate | null {
  const prompts = loadPrompts();
  return prompts.find(p => p.id === id) || null;
}

export function updatePrompt(id: string, updates: Partial<PromptTemplate>) {
  const prompts = loadPrompts();
  const index = prompts.findIndex(p => p.id === id);
  if (index >= 0) {
    prompts[index] = { ...prompts[index], ...updates, updatedAt: Date.now() };
    savePrompts(prompts);
  }
}

export function resetPromptToDefault(id: string): boolean {
  const defaults = DEFAULT_PROMPTS.find(p => p.id === id);
  if (!defaults) return false;
  
  updatePrompt(id, { ...defaults, updatedAt: Date.now() });
  return true;
}

export function getPromptsByCategory(category: PromptTemplate['category']): PromptTemplate[] {
  const prompts = loadPrompts();
  return prompts.filter(p => p.category === category);
}

export function createCustomPrompt(prompt: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isDefault'>): PromptTemplate {
  const newPrompt: PromptTemplate = {
    ...prompt,
    id: crypto.randomUUID(),
    isDefault: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  const prompts = loadPrompts();
  prompts.push(newPrompt);
  savePrompts(prompts);
  
  return newPrompt;
}

export function deletePrompt(id: string): boolean {
  const prompt = getPrompt(id);
  if (!prompt || prompt.isDefault) return false;
  
  const prompts = loadPrompts().filter(p => p.id !== id);
  savePrompts(prompts);
  return true;
}