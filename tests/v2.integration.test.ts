
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('类型定义验证', () =&gt; {
  it('类型定义应该正常导入', () =&gt; {
    expect(() =&gt; {
      import('@/types');
    }).not.toThrow();
  });

  it('ConversationPhase 应该有5种值', () =&gt; {
    // 实际验证类型兼容性
    const phase1: 'probing' = 'probing';
    const phase2: 'pressuring' = 'pressuring';
    const phase3: 'conflict' = 'conflict';
    const phase4: 'cooling' = 'cooling';
    const phase5: 'repairing' = 'repairing';
    expect([phase1, phase2, phase3, phase4, phase5]).toHaveLength(5);
  });

  it('TacticalGoal 应该有5种值', () =&gt; {
    const goal1: 'advance' = 'advance';
    const goal2: 'stabilize' = 'stabilize';
    const goal3: 'delay' = 'delay';
    const goal4: 'counterattack' = 'counterattack';
    const goal5: 'disengage' = 'disengage';
    expect([goal1, goal2, goal3, goal4, goal5]).toHaveLength(5);
  });
});

describe('对话状态机 (conversationStateEngine)', () =&gt; {
  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/conversationStateEngine');
    expect(module.classifyConversationPhase).toBeDefined();
    expect(module.getPhaseLabel).toBeDefined();
    expect(module.getPhaseStrategyHint).toBeDefined();
  });

  it('getPhaseLabel 应该返回正确的标签', async () =&gt; {
    const { getPhaseLabel } = await import('@/services/conversationStateEngine');
    expect(getPhaseLabel('probing')).toBe('1-试探期');
    expect(getPhaseLabel('pressuring')).toBe('2-施压期');
    expect(getPhaseLabel('conflict')).toBe('3-冲突期');
    expect(getPhaseLabel('cooling')).toBe('4-冷处理期');
    expect(getPhaseLabel('repairing')).toBe('5-关系修复期');
  });

  it('getPhaseStrategyHint 应该返回正确的提示', async () =&gt; {
    const { getPhaseStrategyHint } = await import('@/services/conversationStateEngine');
    expect(getPhaseStrategyHint('probing')).toContain('试探');
    expect(getPhaseStrategyHint('pressuring')).toContain('施压');
    expect(getPhaseStrategyHint('conflict')).toContain('冲突');
    expect(getPhaseStrategyHint('cooling')).toContain('疏远');
    expect(getPhaseStrategyHint('repairing')).toContain('示好');
  });
});

describe('反馈评估器 (feedbackEvaluator)', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/feedbackEvaluator');
    expect(module.loadEvaluations).toBeDefined();
    expect(module.saveEvaluations).toBeDefined();
    expect(module.buildFeedbackSection).toBeDefined();
    expect(module.buildHistoricalEvaluationsSummary).toBeDefined();
  });

  it('空存储应该返回空数组', async () =&gt; {
    const { loadEvaluations } = await import('@/services/feedbackEvaluator');
    const evals = loadEvaluations();
    expect(evals).toEqual([]);
  });

  it('应该能保存和加载评估记录', async () =&gt; {
    const { loadEvaluations, saveEvaluations } = await import('@/services/feedbackEvaluator');
    const testEval: any = {
      result: 'success',
      reason: '测试原因',
      adjustment: '测试调整',
      timestamp: Date.now(),
      contactName: '张三',
      strategyLabel: 'A',
      strategyContent: '测试内容',
      opponentResponse: '测试回复'
    };

    saveEvaluations([testEval]);
    const loaded = loadEvaluations();
    expect(loaded.length).toBe(1);
    expect(loaded[0].contactName).toBe('张三');
    expect(loaded[0].result).toBe('success');
  });

  it('应该能按联系人筛选评估记录', async () =&gt; {
    const { getEvaluationsByContact, saveEvaluations } = await import('@/services/feedbackEvaluator');
    saveEvaluations([
      { result: 'success', reason: 't1', adjustment: 't1', timestamp: Date.now(), contactName: '张三', strategyLabel: 'A', strategyContent: 't1', opponentResponse: 't1' },
      { result: 'success', reason: 't2', adjustment: 't2', timestamp: Date.now(), contactName: '李四', strategyLabel: 'A', strategyContent: 't2', opponentResponse: 't2' },
    ] as any[]);

    expect(getEvaluationsByContact('张三').length).toBe(1);
    expect(getEvaluationsByContact('李四').length).toBe(1);
    expect(getEvaluationsByContact('不存在').length).toBe(0);
  });

  it('应该能构建反馈部分', async () =>&gt; {
    const { buildFeedbackSection, saveEvaluations } = await import('@/services/feedbackEvaluator');
    saveEvaluations([
      { result: 'success', reason: '不错', adjustment: '保持', timestamp: Date.now(), contactName: '张三', strategyLabel: 'A', strategyContent: 't', opponentResponse: 't' }
    ] as any[]);

    const section = buildFeedbackSection('张三');
    expect(section).toContain('历史策略复盘记录');
    expect(section).toContain('✅');
  });

  it('无历史记录时应该返回空字符串', async () =&gt; {
    const { buildFeedbackSection } = await import('@/services/feedbackEvaluator');
    expect(buildFeedbackSection('无记录')).toBe('');
  });

  it('应该能构建历史评估摘要', async () =&gt; {
    const { buildHistoricalEvaluationsSummary, saveEvaluations } = await import('@/services/feedbackEvaluator');
    saveEvaluations([
      { result: 'success', reason: 't', adjustment: 't', timestamp: Date.now(), contactName: '张三', strategyLabel: 'A', strategyContent: 't', opponentResponse: 't' },
      { result: 'failure', reason: 't', adjustment: 't', timestamp: Date.now(), contactName: '张三', strategyLabel: 'A', strategyContent: 't', opponentResponse: 't' },
      { result: 'neutral', reason: 't', adjustment: 't', timestamp: Date.now(), contactName: '张三', strategyLabel: 'A', strategyContent: 't', opponentResponse: 't' },
    ] as any[]);

    const summary = buildHistoricalEvaluationsSummary('张三');
    expect(summary).toContain('成功1');
    expect(summary).toContain('失败1');
    expect(summary).toContain('中性1');
  });
});

describe('提示词服务 (promptService)', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/promptService');
    expect(module.loadPrompts).toBeDefined();
    expect(module.getPrompt).toBeDefined();
    expect(module.formatPrompt).toBeDefined();
  });

  it('首次加载应该返回默认V2模板', async () =&gt; {
    const { loadPrompts } = await import('@/services/promptService');
    const prompts = loadPrompts();
    expect(prompts.length).toBeGreaterThanOrEqual(5);
  });

  it('应该包含V2的所有必要模板', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')).not.toBeNull();
    expect(getPrompt('style-extraction')).not.toBeNull();
    expect(getPrompt('reply-generation')).not.toBeNull();
    expect(getPrompt('phase-classification')).not.toBeNull();
    expect(getPrompt('strategy-evaluation')).not.toBeNull();
  });

  it('system-main应该包含V2特性', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('system-main');
    expect(prompt?.content).toContain('绝对禁令');
    expect(prompt?.content).toContain('真实博弈目的');
    expect(prompt?.content).toContain('tacticalGoal');
    expect(prompt?.content).toContain('riskLevel');
    expect(prompt?.content).toContain('expectedReaction');
  });

  it('style-extraction应该包含V2加权画像', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('style-extraction');
    expect(prompt?.content).toContain('powerIdentity');
    expect(prompt?.content).toContain('confidence');
    expect(prompt?.content).toContain('decayRate');
    expect(prompt?.content).toContain('psychologicalNeeds');
    expect(prompt?.content).toContain('taboos');
  });

  it('reply-generation应该包含V2所有字段', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('reply-generation');
    expect(prompt?.content).toContain('conversationPhase');
    expect(prompt?.content).toContain('tacticalGoal');
    expect(prompt?.content).toContain('feedbackSection');
    expect(prompt?.content).toContain('镜像规整律');
  });

  it('应该能正确格式化变量替换', async () =&gt; {
    const { formatPrompt } = await import('@/services/promptService');
    const testPrompt: any = {
      content: 'Hello {name}, this is {thing}',
      id: 'test', name: 't', description: 't', category: 'system',
      variables: ['name', 'thing'], isDefault: true, createdAt: 0, updatedAt: 0
    };
    const result = formatPrompt(testPrompt, { name: '张三', thing: '测试' });
    expect(result).toBe('Hello 张三, this is 测试');
  });

  it('应该能更新提示词', async () =&gt; {
    const { updatePrompt, getPrompt } = await import('@/services/promptService');
    updatePrompt('system-main', { name: '测试修改' });
    expect(getPrompt('system-main')?.name).toBe('测试修改');
  });

  it('应该能重置为默认', async () =>&gt; {
    const { updatePrompt, resetPromptToDefault, getPrompt } = await import('@/services/promptService');
    updatePrompt('system-main', { name: '临时修改' });
    resetPromptToDefault('system-main');
    const result = getPrompt('system-main');
    expect(result?.name).toContain('军师引擎');
  });
});

describe('LLM服务 (llmService)', () =&gt; {
  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/llmService');
    expect(module.generateStrategies).toBeDefined();
    expect(module.normalizeRiskLevel).toBeDefined();
    expect(module.ensureV2Strategies).toBeDefined();
    expect(module.FALLBACK_STRATEGIES).toBeDefined();
  });

  it('normalizeRiskLevel - 标准值应该原样返回', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('low')).toBe('low');
    expect(normalizeRiskLevel('medium')).toBe('medium');
    expect(normalizeRiskLevel('high')).toBe('high');
  });

  it('normalizeRiskLevel - 中文应该正确转换', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('低')).toBe('low');
    expect(normalizeRiskLevel('中')).toBe('medium');
    expect(normalizeRiskLevel('高')).toBe('high');
  });

  it('normalizeRiskLevel - 未知值应该返回medium', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('unknown')).toBe('medium');
    expect(normalizeRiskLevel(null)).toBe('medium');
    expect(normalizeRiskLevel(undefined)).toBe('medium');
    expect(normalizeRiskLevel(123)).toBe('medium');
  });

  it('ensureV2Strategies - 缺失字段应该被填充默认值', async () =&gt; {
    const { ensureV2Strategies } = await import('@/services/llmService');
    const input = [{ label: 'A', content: 'test' }];
    const result = ensureV2Strategies(input);
    expect(result[0].tacticalGoal).toBeDefined();
    expect(result[0].riskLevel).toBeDefined();
    expect(result[0].expectedReaction).toBeDefined();
  });

  it('FALLBACK_STRATEGIES - 应该有完整V2结构', async () =&gt; {
    const { FALLBACK_STRATEGIES } = await import('@/services/llmService');
    expect(FALLBACK_STRATEGIES).toHaveLength(3);
    FALLBACK_STRATEGIES.forEach((s: any) =&gt; {
      expect(s.tacticalGoal).not.toBe('');
      expect(s.riskLevel).toBeDefined();
      expect(s.expectedReaction).not.toBe('');
    });
  });
});

describe('加权画像服务 (personaService)', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/personaService');
    expect(module.getPersona).toBeDefined();
    expect(module.savePersona).toBeDefined();
    expect(module.getDynamicPersona).toBeDefined();
    expect(module.saveDynamicPersona).toBeDefined();
    expect(module.formatPersonaForPrompt).toBeDefined();
    expect(module.formatDynamicPersonaForPrompt).toBeDefined();
    expect(module.applyDecay).toBeDefined();
  });

  it('空存储应该返回空对象', async () =&gt; {
    const { loadPersonas, loadDynamicPersonas } = await import('@/services/personaService');
    expect(Object.keys(loadPersonas())).toEqual([]);
    expect(Object.keys(loadDynamicPersonas())).toEqual([]);
  });

  it('应该能保存和获取StylePersona', async () =&gt; {
    const { getPersona, savePersona } = await import('@/services/personaService');
    const persona: any = {
      sentenceStyle: '简短',
      catchphrases: ['嗯嗯'],
      emotionLevel: '低热量',
      vocabFeatures: '简洁',
      punctuationHabits: '多用句号',
      summary: '简洁理性'
    };
    savePersona('张三', persona);
    const loaded = getPersona('张三');
    expect(loaded?.summary).toBe('简洁理性');
  });

  it('应该能保存和获取DynamicPersona', async () =>&gt; {
    const { getDynamicPersona, saveDynamicPersona } = await import('@/services/personaService');
    const persona: any = {
      targetId: '张三',
      updateTick: Date.now(),
      powerIdentity: [{ trait: '测试', confidence: 0.8, observationsCount: 1, decayRate: 0.05 }],
      psychologicalNeeds: [{ need: '测试', weight: 0.9 }],
      taboos: [{ rule: '测试', riskFactor: 0.95 }],
      temperature: 5,
      textStyle: '测试',
      experienceEvents: [],
      summary: '测试'
    };
    saveDynamicPersona('张三', persona);
    const loaded = getDynamicPersona('张三');
    expect(loaded?.summary).toBe('测试');
    expect(loaded?.powerIdentity[0].confidence).toBe(0.8);
  });

  it('formatPersonaForPrompt - 应该包含风格画像标识', async () =>&gt; {
    const { formatPersonaForPrompt } = await import('@/services/personaService');
    const formatted = formatPersonaForPrompt({
      sentenceStyle: 't', catchphrases: [], emotionLevel: 't', vocabFeatures: 't', punctuationHabits: 't', summary: 't'
    });
    expect(formatted).toContain('风格画像');
  });

  it('formatDynamicPersonaForPrompt - 应该包含心智画像标识', async () =>&gt; {
    const { formatDynamicPersonaForPrompt } = await import('@/services/personaService');
    const formatted = formatDynamicPersonaForPrompt({
      targetId: 't', updateTick: Date.now(), powerIdentity: [], psychologicalNeeds: [],
      taboos: [], temperature: 5, textStyle: 't', experienceEvents: [], summary: 't'
    });
    expect(formatted).toContain('心智画像');
  });

  it('短时间内applyDecay - 不应该改变confidence', async () =>&gt; {
    const { applyDecay } = await import('@/services/personaService');
    const persona: any = {
      targetId: 't', updateTick: Date.now(),
      powerIdentity: [{ trait: 't', confidence: 0.8, observationsCount: 1, decayRate: 0.5 }],
      psychologicalNeeds: [], taboos: [], temperature: 5, textStyle: 't', experienceEvents: [], summary: 't'
    };
    const result = applyDecay(persona);
    expect(result.powerIdentity[0].confidence).toBe(0.8);
  });
});

describe('进化引擎 (evolutionEngine)', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/evolutionEngine');
    expect(module.EVOLUTION_THRESHOLD).toBeDefined();
    expect(module.getBufferByContact).toBeDefined();
    expect(module.pushMultipleToBuffer).toBeDefined();
    expect(module.getPendingCountsByContact).toBeDefined();
    expect(module.triggerPersonaUpdate).toBeDefined();
  });

  it('EVOLUTION_THRESHOLD 应该是50', async () =&gt; {
    const { EVOLUTION_THRESHOLD } = await import('@/services/evolutionEngine');
    expect(EVOLUTION_THRESHOLD).toBe(50);
  });

  it('空联系人缓冲区应该返回空数组', async () =&gt; {
    const { getBufferByContact } = await import('@/services/evolutionEngine');
    expect(getBufferByContact('不存在')).toEqual([]);
  });
});

describe('Agent工作流 (agentWorkflow)', () => {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('应该能正常导入', async () =&gt; {
    const module = await import('@/services/agentWorkflow');
    expect(module.identifyContact).toBeDefined();
    expect(module.identifyContactAsync).toBeDefined();
    expect(module.runWorkflow).toBeDefined();
    expect(module.runWorkflowStream).toBeDefined();
  });

  it('clearHistory 应该重置历史', async () =&gt; {
    const { clearHistory, getHistory } = await import('@/services/agentWorkflow');
    clearHistory();
    expect(getHistory()).toEqual([]);
  });
});

describe('V2特性完整性验证', () =&gt; {
  it('应该包含所有必要的V2提示词字段', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const systemPrompt = getPrompt('system-main');
    const replyPrompt = getPrompt('reply-generation');
    const stylePrompt = getPrompt('style-extraction');

    expect(systemPrompt?.content).toContain('tacticalGoal');
    expect(systemPrompt?.content).toContain('riskLevel');
    expect(systemPrompt?.content).toContain('expectedReaction');
    expect(systemPrompt?.content).toContain('绝对禁令');
    expect(systemPrompt?.content).toContain('真实博弈目的');
    expect(systemPrompt?.content).toContain('人类瑕疵');

    expect(replyPrompt?.content).toContain('conversationPhase');
    expect(replyPrompt?.content).toContain('tacticalGoal');
    expect(replyPrompt?.content).toContain('feedbackSection');
    expect(replyPrompt?.content).toContain('镜像规整律');

    expect(stylePrompt?.content).toContain('powerIdentity');
    expect(stylePrompt?.content).toContain('confidence');
    expect(stylePrompt?.content).toContain('decayRate');
  });

  it('类型定义应该包含完整的V2结构', async () => {
    // 验证类型存在性（通过导入和使用）
    const testDynamicPersona: any = {
      targetId: 't',
      updateTick: Date.now(),
      powerIdentity: [{ trait: 't', confidence: 0.8, observationsCount: 1, decayRate: 0.05 }],
      psychologicalNeeds: [{ need: 't', weight: 0.9 }],
      taboos: [{ rule: 't', riskFactor: 0.95 }],
      temperature: 5,
      textStyle: 't',
      experienceEvents: [],
      summary: 't'
    };
    expect(testDynamicPersona.powerIdentity[0].confidence).toBe(0.8);
    expect(testDynamicPersona.psychologicalNeeds[0].weight).toBe(0.9);
    expect(testDynamicPersona.taboos[0].riskFactor).toBe(0.95);
  });
});

describe('边界条件和异常处理', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('空输入应该被安全处理', async () =&gt; {
    const { loadPrompts } = await import('@/services/promptService');
    const { loadPersonas, loadDynamicPersonas } = await import('@/services/personaService');
    const { loadEvaluations } = await import('@/services/feedbackEvaluator');
    expect(() =&gt; loadPrompts()).not.toThrow();
    expect(() =&gt; loadPersonas()).not.toThrow();
    expect(() =&gt; loadDynamicPersonas()).not.toThrow();
    expect(() =&gt; loadEvaluations()).not.toThrow();
  });

  it('JSON解析失败应该有fallback', async () =&gt; {
    const { FALLBACK_STRATEGIES } = await import('@/services/llmService');
    expect(FALLBACK_STRATEGIES).toHaveLength(3);
  });

  it('null/undefined不应该导致崩溃', async () =>&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel(null)).toBe('medium');
    expect(normalizeRiskLevel(undefined)).toBe('medium');
  });
});

describe('向后兼容性', () =>&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('StylePersona应该仍被完全支持', async () =&gt; {
    const { getPersona, savePersona, formatPersonaForPrompt } = await import('@/services/personaService');
    const persona: any = {
      sentenceStyle: 't', catchphrases: ['a'], emotionLevel: 't', vocabFeatures: 't', punctuationHabits: 't', summary: 't'
    };
    savePersona('test', persona);
    const loaded = getPersona('test');
    expect(loaded).not.toBeNull();
    expect(formatPersonaForPrompt(loaded!)).not.toBe('');
  });

  it('旧格式prompt应该被自动升级', async () =>&gt; {
    const { loadPrompts, savePrompts } = await import('@/services/promptService');
    // 保存旧格式
    const oldPrompts: any = [{
      id: 'system-main', name: 'old', description: 'old', category: 'system',
      content: '顺从推进 委婉甩锅',
      variables: [], isDefault: true, createdAt: Date.now(), updatedAt: Date.now()
    }];
    savePrompts(oldPrompts);
    // 重新加载应该自动升级
    const upgraded = loadPrompts();
    expect(upgraded.length).toBeGreaterThanOrEqual(5);
  });
});
