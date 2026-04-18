import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGenerateText = vi.fn().mockResolvedValue({
  text: '[{"label":"A","style":"顺从推进","content":"好的"},{"label":"B","style":"委婉甩锅","content":"再看看"},{"label":"C","style":"幽默化解","content":"哈哈"}]',
});

vi.mock('ai', () => ({
  generateText: (...args: any[]) => mockGenerateText(...args),
  streamText: vi.fn(),
  createOpenAI: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn().mockReturnValue(() => ({})),
}));

import { generateStrategies } from '@/services/llmService';
import type { AppSettings } from '@/types';

const mockSettings: AppSettings = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.deepseek.com',
  model: 'deepseek-chat',
  shortcutKey: 'Alt+Space',
  embeddingModel: 'Xenova/all-MiniLM-L6-v2',
  theme: 'light',
};

describe('llmService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateStrategies', () => {
    it('should parse LLM response into ReplyStrategy array', async () => {
      const strategies = await generateStrategies('测试提示词', mockSettings);
      expect(strategies).toHaveLength(3);
      expect(strategies[0].label).toBe('A');
      expect(strategies[0].style).toBe('顺从推进');
      expect(strategies[0].content).toBe('好的');
    });

    it('should return fallback strategies on error', async () => {
      mockGenerateText.mockRejectedValueOnce(new Error('API error'));
      const strategies = await generateStrategies('测试提示词', mockSettings);
      expect(strategies).toHaveLength(3);
      expect(strategies[0].label).toBe('A');
    });

    it('should handle markdown-wrapped JSON', async () => {
      mockGenerateText.mockResolvedValueOnce({
        text: '```json\n[{"label":"A","style":"顺从推进","content":"好的"},{"label":"B","style":"委婉甩锅","content":"再看看"},{"label":"C","style":"幽默化解","content":"哈哈"}]\n```',
      });
      const strategies = await generateStrategies('测试提示词', mockSettings);
      expect(strategies).toHaveLength(3);
    });
  });
});
