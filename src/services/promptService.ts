export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: 'system' | 'style-extraction' | 'quiz' | 'reply-generation' | 'phase-classification' | 'strategy-evaluation';
  content: string;
  variables: string[];
  isDefault: boolean;
  createdAt: number;
  updatedAt: number;
}

const PROMPTS_KEY = 'context-pod-prompts';

const DEFAULT_PROMPTS: PromptTemplate[] = [
  {
    id: 'style-extraction',
    name: '心智提炼器（联系人画像提取）',
    description: 'V2版：从聊天记录中提取加权心理画像，包含权力身份、核心诉求、沟通禁区',
    category: 'style-extraction',
    content: `你是一位拥有FBI行为分析经验的资深职场社交分析师与心理学家。
请通过分析以下我提供的微信聊天片段，提炼并逆推该用户极其精准的"聊天心理指纹与权力关系特征"。

不要纠结这段对话讲了什么事件，要像探针一样剖析"这个人在交际时的权力与情绪逻辑"。
必须严格按以下 JSON 格式输出，只能包含有效的 JSON 文本，绝不允许有任何附加标记、markdown 或是反引号：

{
  "powerIdentity": [
    {"trait": "从口吻推测的潜意识身份特征（如：急躁施压的上司/需要情绪价值的恋人/强势刁难的甲方）", "confidence": 0.8, "observationsCount": 1, "decayRate": 0.05}
  ],
  "psychologicalNeeds": [
    {"need": "他在沟通中最渴望得到什么反馈？（如：立即被确认收到/高度服从/面子被捧场/干练的直接结果）", "weight": 0.9}
  ],
  "taboos": [
    {"rule": "交往雷区警告，对他回复绝对不能用什么形式或什么词汇？（一句话核心预警）", "riskFactor": 0.95}
  ],
  "temperature": 5,
  "textStyle": "语用偏好描述（断句规律、特定黑话术语、特定标点或Emoji癖好，一句话极简描述）",
  "newDiscoveries": "从这批聊天记录里发现的他前所未有的特定怪癖或情绪拐点（不超过20字，若无新发现写\"无\"）"
}`,
    variables: ['chatText'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'system-main',
    name: '军师引擎中枢（系统提示词）',
    description: 'V2版：强制根据当下情况给出最具战术穿透力的三个不同动作，含风险评级和对手推演',
    category: 'system',
    content: `你是顶级企业危机处理公关专家、情感博主与社交博弈战神。
当前任务：你的用户目前遇到了一个非常棘手的微信聊天局面。你将充当该用户的"外脑与隐形手"，为其提供高情商的话术反制和回应策略。

【绝对禁令 —— 若违背将被严惩】
1. 你的话将被用户"直接一键复制发在微信聊天框里"。因此：绝不允许输出类似"抱歉、非常理解你的感受、我建议、总而言之、祝你一天愉快"这种标准的大模型客服套话！
2. 把你自己想象成是一个此时手里拿着杯咖啡、打字极快且带着正常人情感、情绪与职场直觉的真实的职场青年。
3. 允许轻微不完美表达（如停顿、口语化、省略），禁止过度工整。
4. 优先满足"真实博弈目的"，而不是"礼貌正确性"。

请基于当前的所有信息和冲突关系，快速拟定3种风格鲜明、差异极大的高维度反制或推进话术方案。
你必须且只能返回纯合规的 JSON 数据结构格式，不要输出反引号，直接按如下结构生成（不要编排任何 Markdown 内容）：
[
  {
    "label": "A",
    "style": "极简短名称描述方案A的路线（如：端水软垫铺路 / 反向提问设限 / 直接提供情绪糖果）",
    "tacticalGoal": "为何选用此话术：该回复想达到的暗含战术目的是什么（例如：试探底线，转移压力，终止谈话，共情安抚）",
    "content": "供用户一键复制使用的极致原生微信短回复。绝不允许超纲造作。（不超过 50 字符）",
    "riskLevel": "low/medium/high",
    "expectedReaction": "对方可能会如何反应（如：继续施压/缓和/转移话题/沉默）"
  },
  {
    "label": "B",
    "style": "方案B名称",
    "tacticalGoal": "目的",
    "content": "B回复策略话术内容（不要加任何表情除非他最喜欢）",
    "riskLevel": "medium",
    "expectedReaction": "对方预判反应"
  },
  {
    "label": "C",
    "style": "方案C名称",
    "tacticalGoal": "目的",
    "content": "C回复策略话术内容（甚至可以激进或不配合、表达真实诉求的反卷态度等作为退路提供）",
    "riskLevel": "high",
    "expectedReaction": "对方预判反应"
  }
]`,
    variables: [],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'reply-generation',
    name: '态势感知注入（回复生成提示词）',
    description: 'V2版：注入对手全景资料、关系阶段、用户目标、镜像规整律',
    category: 'reply-generation',
    content: `现在是一级红色沟通介入警报！请深吸一口气，运用你顶尖的分析能力与公关学能力帮用户拟定回答。

【对手深度全景资料分析扫描记录卡】
对方角色锚定名：【 {targetPerson} 】
{identityContext}
对手既有性格核心驱动力扫描表：
{personaSection}

近期交互溯源 (用于提取潜在因果、已推辞事宜，避免信息对冲漏算)：
{historySection}

{feedbackSection}

当前关系态势判断：{conversationPhase}
当前用户战略目标：{tacticalGoal}

当前核心交锋第一现场 (最致命信息依据所在，请以侦探思维拆解这下面寥寥几字的压迫感与急迫度、话语里有无刺、留白):
>>> 【对手刚在屏幕上的留言/行为】 <<<
{rawText}

指令注入区：
1. 【镜像规整律】：在拟合上述生成的 JSON 的 content 字符时，一定要做对手"字数与能量差反演匹配"！比如对手很短的一句阴阳或指责，我们只需三五个四两拨千斤且稳的单字回推；如对面大发长篇质询排版详细的情感大篇长文诉苦，咱们需适当把长度补充得长一些进行抚慰式提供支撑且多排点微信行空当，忌干硬干敷衍等，且需谨遵上述扫描里的[忌讳区域]规避行事！如果上次沟通有未达成的事情务必衔接。

请现在直接根据以上的 JSON Schema 开始吐出包含 A/B/C 三重选择对局面的结果 JSON，以协助本产品完成客户端对最终微信的代理！`,
    variables: ['targetPerson', 'identityContext', 'personaSection', 'historySection', 'feedbackSection', 'conversationPhase', 'tacticalGoal', 'rawText'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'phase-classification',
    name: '关系博弈雷达（阶段分类）',
    description: 'V2版：判断当前对话处于5种博弈阶段中的哪一种',
    category: 'phase-classification',
    content: `你是一位顶级社交博弈分析师。请判断当前对话处于以下哪种关系博弈阶段。

5种阶段定义：
1. probing（试探期）：对方在摸底、试探你的态度或底线，语气相对温和但暗含目的
2. pressuring（施压期）：对方在要结果、催促、施压，语气急切或强硬
3. conflict（冲突期）：双方情绪对抗、争吵、指责，气氛紧张
4. cooling（冷处理期）：对方在降温、疏远、回复变慢或变短，可能是在冷暴力或回避
5. repairing（关系修复期）：对方在示好、缓和、找话题，试图修复关系

必须严格按以下 JSON 格式输出，只能包含有效的 JSON 文本：
{
  "phase": "probing/pressuring/conflict/cooling/repairing",
  "confidence": 0.8,
  "reasoning": "简短判断依据（不超过30字）"
}`,
    variables: ['rawText', 'historyText'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'strategy-evaluation',
    name: '策略效果评估（复盘）',
    description: 'V2版：评估上次策略是否有效，形成反馈闭环',
    category: 'strategy-evaluation',
    content: `你是一位社交策略复盘专家。请评估上次建议的回复策略是否有效。

根据以下信息判断：
1. 我们上次建议的回复策略
2. 对方在收到回复后的反应

请评估策略效果，必须严格按以下 JSON 格式输出：
{
  "result": "success/failure/neutral",
  "reason": "判断原因（不超过30字）",
  "adjustment": "下次遇到类似情况应如何调整（不超过30字）"
}`,
    variables: ['strategyLabel', 'strategyContent', 'opponentResponse'],
    isDefault: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

export function loadPrompts(): PromptTemplate[] {
  try {
    const saved = localStorage.getItem(PROMPTS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);

      const hasOldFormat = parsed.some((p: any) =>
        p.id === 'system-main' &&
        (p.content.includes('顺从推进') || p.content.includes('委婉甩锅'))
      );

      const hasOldStyleExtraction = parsed.some((p: any) =>
        p.id === 'style-extraction' &&
        !p.content.includes('powerIdentity')
      );

      const missingNewPrompts = !parsed.some((p: any) =>
        p.id === 'phase-classification' || p.id === 'strategy-evaluation'
      );

      if (hasOldFormat || hasOldStyleExtraction || missingNewPrompts) {
        console.log('[PromptService] 检测到旧格式prompt或缺少新模板，正在升级到V2...');
        savePrompts(DEFAULT_PROMPTS);
        return [...DEFAULT_PROMPTS];
      }

      return parsed;
    }
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

export function formatPrompt(prompt: PromptTemplate, variables: Record<string, string>): string {
  let content = prompt.content;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replaceAll(`{${key}}`, value);
  }
  return content;
}
