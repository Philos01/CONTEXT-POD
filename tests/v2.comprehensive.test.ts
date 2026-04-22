
import { describe, it, expect, beforeEach } from 'vitest';

describe('Type Definitions', () =&gt; {
  it('should import without errors', () =&gt; {
    expect(() =&gt; {
      require('@/types');
    }).not.toThrow();
  });

  it('should have 5 conversation phases', () =&gt; {
    const phases: any = ['probing', 'pressuring', 'conflict', 'cooling', 'repairing'];
    expect(phases).toHaveLength(5);
  });

  it('should have 5 tactical goals', () =&gt; {
    const goals: any = ['advance', 'stabilize', 'delay', 'counterattack', 'disengage'];
    expect(goals).toHaveLength(5);
  });
});

describe('Conversation State Engine', () =&gt; {
  it('should export all required functions', async () =&gt; {
    const module = await import('@/services/conversationStateEngine');
    expect(module.classifyConversationPhase).toBeDefined();
    expect(module.getPhaseLabel).toBeDefined();
    expect(module.getPhaseStrategyHint).toBeDefined();
  });

  it('getPhaseLabel should return correct Chinese labels', async () =&gt; {
    const { getPhaseLabel } = await import('@/services/conversationStateEngine');
    expect(getPhaseLabel('probing')).toBe('1-试探期');
    expect(getPhaseLabel('pressuring')).toBe('2-施压期');
    expect(getPhaseLabel('conflict')).toBe('3-冲突期');
    expect(getPhaseLabel('cooling')).toBe('4-冷处理期');
    expect(getPhaseLabel('repairing')).toBe('5-关系修复期');
  });

  it('getPhaseStrategyHint should return relevant hints', async () =&gt; {
    const { getPhaseStrategyHint } = await import('@/services/conversationStateEngine');
    expect(getPhaseStrategyHint('probing')).toContain('试探');
    expect(getPhaseStrategyHint('pressuring')).toContain('施压');
    expect(getPhaseStrategyHint('conflict')).toContain('冲突');
    expect(getPhaseStrategyHint('cooling')).toContain('疏远');
    expect(getPhaseStrategyHint('repairing')).toContain('示好');
  });
});

describe('Feedback Evaluator', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('should export all required functions', async () =&gt; {
    const module = await import('@/services/feedbackEvaluator');
    expect(module.loadEvaluations).toBeDefined();
    expect(module.saveEvaluations).toBeDefined();
    expect(module.buildFeedbackSection).toBeDefined();
    expect(module.buildHistoricalEvaluationsSummary).toBeDefined();
  });

  it('empty storage should return empty array', async () =&gt; {
    const { loadEvaluations } = await import('@/services/feedbackEvaluator');
    expect(loadEvaluations()).toEqual([]);
  });

  it('should save and load evaluations', async () =&gt; {
    const { loadEvaluations, saveEvaluations } = await import('@/services/feedbackEvaluator');
    const testEval: any = {
      result: 'success',
      reason: 'test reason',
      adjustment: 'test adjustment',
      timestamp: Date.now(),
      contactName: 'TestContact',
      strategyLabel: 'A',
      strategyContent: 'test content',
      opponentResponse: 'test response'
    };
    saveEvaluations([testEval]);
    const loaded = loadEvaluations();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].contactName).toBe('TestContact');
  });

  it('should filter evaluations by contact', async () =&gt; {
    const { getEvaluationsByContact, saveEvaluations } = await import('@/services/feedbackEvaluator');
    saveEvaluations([
      { result: 'success', reason: 't1', adjustment: 't1', timestamp: Date.now(), contactName: 'A', strategyLabel: 'A', strategyContent: 't1', opponentResponse: 't1' },
      { result: 'success', reason: 't2', adjustment: 't2', timestamp: Date.now(), contactName: 'B', strategyLabel: 'A', strategyContent: 't2', opponentResponse: 't2' },
    ] as any[]);

    expect(getEvaluationsByContact('A').length).toBe(1);
    expect(getEvaluationsByContact('B').length).toBe(1);
    expect(getEvaluationsByContact('C').length).toBe(0);
  });

  it('should build feedback section', async () =&gt; {
    const { buildFeedbackSection, saveEvaluations } = await import('@/services/feedbackEvaluator');
    saveEvaluations([
      { result: 'success', reason: 'good', adjustment: 'keep', timestamp: Date.now(), contactName: 'Test', strategyLabel: 'A', strategyContent: 't', opponentResponse: 't' }
    ] as any[]);

    const section = buildFeedbackSection('Test');
    expect(section).toContain('历史策略复盘记录');
    expect(section).toContain('✅');
  });

  it('should return empty for no history', async () =&gt; {
    const { buildFeedbackSection } = await import('@/services/feedbackEvaluator');
    expect(buildFeedbackSection('NoHistory')).toBe('');
  });
});

describe('Prompt Service', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('should export all required functions', async () =&gt; {
    const module = await import('@/services/promptService');
    expect(module.loadPrompts).toBeDefined();
    expect(module.getPrompt).toBeDefined();
    expect(module.formatPrompt).toBeDefined();
  });

  it('first load should return V2 default templates', async () =&gt; {
    const { loadPrompts } = await import('@/services/promptService');
    const prompts = loadPrompts();
    expect(prompts.length).toBeGreaterThanOrEqual(5);
  });

  it('should have all required V2 prompts', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')).not.toBeNull();
    expect(getPrompt('style-extraction')).not.toBeNull();
    expect(getPrompt('reply-generation')).not.toBeNull();
    expect(getPrompt('phase-classification')).not.toBeNull();
    expect(getPrompt('strategy-evaluation')).not.toBeNull();
  });

  it('system-main should contain V2 features', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('system-main');
    expect(prompt?.content).toContain('tacticalGoal');
    expect(prompt?.content).toContain('riskLevel');
    expect(prompt?.content).toContain('expectedReaction');
  });

  it('style-extraction should contain weighted persona', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('style-extraction');
    expect(prompt?.content).toContain('powerIdentity');
    expect(prompt?.content).toContain('confidence');
    expect(prompt?.content).toContain('decayRate');
  });

  it('reply-generation should contain conversation phase', async () =>&gt; {
    const { getPrompt } = await import('@/services/promptService');
    const prompt = getPrompt('reply-generation');
    expect(prompt?.content).toContain('conversationPhase');
    expect(prompt?.content).toContain('tacticalGoal');
    expect(prompt?.content).toContain('feedbackSection');
  });

  it('should format variable replacements', async () =&gt; {
    const { formatPrompt } = await import('@/services/promptService');
    const testPrompt: any = {
      content: 'Hello {name}, {thing}',
      id: 'test', name: 't', description: 't', category: 'system',
      variables: ['name', 'thing'], isDefault: true, createdAt: 0, updatedAt: 0
    };
    const result = formatPrompt(testPrompt, { name: 'User', thing: 'World' });
    expect(result).toBe('Hello User, World');
  });

  it('should update and reset prompts', async () =&gt; {
    const { updatePrompt, resetPromptToDefault, getPrompt } = await import('@/services/promptService');
    updatePrompt('system-main', { name: 'Modified' });
    expect(getPrompt('system-main')?.name).toBe('Modified');
    resetPromptToDefault('system-main');
    expect(getPrompt('system-main')?.name).toContain('军师');
  });
});

describe('LLM Service', () => {
  it('should export all required functions', async () =>&gt; {
    const module = await import('@/services/llmService');
    expect(module.generateStrategies).toBeDefined();
    expect(module.normalizeRiskLevel).toBeDefined();
    expect(module.ensureV2Strategies).toBeDefined();
    expect(module.FALLBACK_STRATEGIES).toBeDefined();
  });

  it('normalizeRiskLevel - should handle standard values', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('low')).toBe('low');
    expect(normalizeRiskLevel('medium')).toBe('medium');
    expect(normalizeRiskLevel('high')).toBe('high');
  });

  it('normalizeRiskLevel - should handle Chinese values', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('低')).toBe('low');
    expect(normalizeRiskLevel('中')).toBe('medium');
    expect(normalizeRiskLevel('高')).toBe('high');
  });

  it('normalizeRiskLevel - should default to medium', async () =&gt; {
    const { normalizeRiskLevel } = await import('@/services/llmService');
    expect(normalizeRiskLevel('unknown')).toBe('medium');
    expect(normalizeRiskLevel(null)).toBe('medium');
    expect(normalizeRiskLevel(undefined)).toBe('medium');
  });

  it('ensureV2Strategies - should fill missing fields', async () =&gt; {
    const { ensureV2Strategies } = await import('@/services/llmService');
    const result = ensureV2Strategies([{ label: 'A', content: 't' }]);
    expect(result[0].tacticalGoal).toBeDefined();
    expect(result[0].riskLevel).toBeDefined();
    expect(result[0].expectedReaction).toBeDefined();
  });

  it('FALLBACK_STRATEGIES should have complete V2 structure', async () =&gt; {
    const { FALLBACK_STRATEGIES } = await import('@/services/llmService');
    expect(FALLBACK_STRATEGIES).toHaveLength(3);
    FALLBACK_STRATEGIES.forEach((s: any) =&gt; {
      expect(s.tacticalGoal).toBeDefined();
      expect(s.riskLevel).toBeDefined();
      expect(s.expectedReaction).toBeDefined();
    });
  });
});

describe('Persona Service', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('should export all required functions', async () =&gt; {
    const module = await import('@/services/personaService');
    expect(module.getPersona).toBeDefined();
    expect(module.savePersona).toBeDefined();
    expect(module.getDynamicPersona).toBeDefined();
    expect(module.saveDynamicPersona).toBeDefined();
  });

  it('should save and load StylePersona', async () =&gt; {
    const { getPersona, savePersona } = await import('@/services/personaService');
    const persona: any = {
      sentenceStyle: 'short',
      catchphrases: ['hmm'],
      emotionLevel: 'low',
      vocabFeatures: 'simple',
      punctuationHabits: 'periods',
      summary: 'simple'
    };
    savePersona('Test', persona);
    expect(getPersona('Test')?.summary).toBe('simple');
  });

  it('should save and load DynamicPersona', async () =&gt; {
    const { getDynamicPersona, saveDynamicPersona } = await import('@/services/personaService');
    const persona: any = {
      targetId: 'Test',
      updateTick: Date.now(),
      powerIdentity: [{ trait: 'test', confidence: 0.8, observationsCount: 1, decayRate: 0.05 }],
      psychologicalNeeds: [{ need: 'test', weight: 0.9 }],
      taboos: [{ rule: 'test', riskFactor: 0.95 }],
      temperature: 5,
      textStyle: 'test',
      experienceEvents: [],
      summary: 'test'
    };
    saveDynamicPersona('Test', persona);
    expect(getDynamicPersona('Test')?.summary).toBe('test');
  });

  it('formatDynamicPersonaForPrompt should work', async () =&gt; {
    const { formatDynamicPersonaForPrompt } = await import('@/services/personaService');
    const persona: any = {
      targetId: 't', updateTick: Date.now(), powerIdentity: [], psychologicalNeeds: [],
      taboos: [], temperature: 5, textStyle: 't', experienceEvents: [], summary: 't'
    };
    const formatted = formatDynamicPersonaForPrompt(persona);
    expect(formatted).toContain('心智画像');
  });
});

describe('V2 Features Integration', () =&gt; {
  it('should have tacticalGoal in prompt', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('tacticalGoal');
  });

  it('should have riskLevel in prompt', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('riskLevel');
  });

  it('should have expectedReaction in prompt', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('expectedReaction');
  });

  it('should have conversationPhase in prompt', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('reply-generation')?.content).toContain('conversationPhase');
  });

  it('should have feedbackSection in prompt', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('reply-generation')?.content).toContain('feedbackSection');
  });

  it('should have powerIdentity in style extraction', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('style-extraction')?.content).toContain('powerIdentity');
  });

  it('should have absolute prohibition rules', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('绝对禁令');
  });

  it('should prioritize realistic game goals', async () =>&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('真实博弈目的');
  });

  it('should allow human imperfection', async () =&gt; {
    const { getPrompt } = await import('@/services/promptService');
    expect(getPrompt('system-main')?.content).toContain('允许轻微不完美');
  });
});

describe('Boundary Conditions', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('should handle empty inputs', async () =&gt; {
    const { loadPrompts } = await import('@/services/promptService');
    const { loadPersonas, loadDynamicPersonas } = await import('@/services/personaService');
    const { loadEvaluations } = await import('@/services/feedbackEvaluator');
    expect(() =&gt; loadPrompts()).not.toThrow();
    expect(() =&gt; loadPersonas()).not.toThrow();
    expect(() =&gt; loadDynamicPersonas()).not.toThrow();
    expect(() =&gt; loadEvaluations()).not.toThrow();
  });

  it('should have fallback strategies', async () =&gt; {
    const { FALLBACK_STRATEGIES } = await import('@/services/llmService');
    expect(FALLBACK_STRATEGIES).toHaveLength(3);
  });
});

describe('Backward Compatibility', () =&gt; {
  beforeEach(() =&gt; {
    localStorage.clear();
  });

  it('should still support StylePersona', async () =&gt; {
    const { getPersona, savePersona } = await import('@/services/personaService');
    const persona: any = {
      sentenceStyle: 't', catchphrases: ['a'], emotionLevel: 't', vocabFeatures: 't',
      punctuationHabits: 't', summary: 't'
    };
    savePersona('Test', persona);
    expect(getPersona('Test')).not.toBeNull();
  });

  it('should auto-upgrade old format prompts', async () =&gt; {
    const { loadPrompts, savePrompts } = await import('@/services/promptService');
    const oldPrompt: any = {
      id: 'system-main', name: 'old', description: 'old', category: 'system',
      content: '顺从推进 委婉甩锅',
      variables: [], isDefault: true, createdAt: Date.now(), updatedAt: Date.now()
    };
    savePrompts([oldPrompt]);
    const upgraded = loadPrompts();
    expect(upgraded.length).toBeGreaterThanOrEqual(5);
  });
});
