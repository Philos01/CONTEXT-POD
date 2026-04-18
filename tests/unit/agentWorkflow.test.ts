import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/services/memoryService', () => ({
  retrieveMemory: vi.fn().mockResolvedValue('脾气急躁，爱画大饼'),
}));

vi.mock('@/services/llmService', () => ({
  generateStrategies: vi.fn().mockResolvedValue([
    { label: 'A', style: '顺从推进', content: '好的老板，马上办！' },
    { label: 'B', style: '委婉甩锅', content: '有个难点想当面请教' },
    { label: 'C', style: '幽默化解', content: '已经在光速推进了' },
  ]),
}));

import { runWorkflow, runWorkflowStream, extractPersonName } from '@/services/agentWorkflow';
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

describe('agentWorkflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractPersonName', () => {
    it('should extract name from colon-separated format', () => {
      expect(extractPersonName('王总：进度怎么样了？')).toBe('王总');
    });

    it('should extract name from @ mention', () => {
      expect(extractPersonName('@张三 你好')).toBe('张三');
    });

    it('should return 未知联系人 for unrecognized format', () => {
      expect(extractPersonName('随便一段文字')).toBe('未知联系人');
    });

    it('should extract name from 和...聊天 format', () => {
      expect(extractPersonName('和李总聊天')).toBe('李总');
    });
  });

  describe('runWorkflow', () => {
    it('should execute workflow and return strategies', async () => {
      const result = await runWorkflow('王总：进度怎么样了？', mockSettings);
      expect(result.rawText).toBe('王总：进度怎么样了？');
      expect(result.targetPerson).toBe('王总');
      expect(result.strategies).toHaveLength(3);
      expect(result.strategies[0].label).toBe('A');
    });

    it('should handle unknown person', async () => {
      const result = await runWorkflow('随便一段文字', mockSettings);
      expect(result.targetPerson).toBe('未知联系人');
      expect(result.memoryData).toBe('暂无此人记录');
    });

    it('should handle workflow errors gracefully', async () => {
      vi.mocked(generateStrategies).mockRejectedValueOnce(new Error('API error'));
      const result = await runWorkflow('test', mockSettings);
      expect(result.strategies).toHaveLength(3);
    });
  });

  describe('runWorkflowStream', () => {
    it('should call onProgress with stages', async () => {
      const onProgress = vi.fn();
      const result = await runWorkflowStream('王总：进度？', mockSettings, onProgress);

      expect(onProgress).toHaveBeenCalledWith('extracting', expect.any(String));
      expect(onProgress).toHaveBeenCalledWith('retrieving', expect.any(String));
      expect(onProgress).toHaveBeenCalledWith('generating', expect.any(String));
      expect(onProgress).toHaveBeenCalledWith('ready', expect.any(String));
      expect(result.strategies).toHaveLength(3);
    });
  });
});
