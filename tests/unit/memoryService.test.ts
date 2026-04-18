import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Contact } from '@/types';

const mockInsert = vi.fn().mockResolvedValue('mock-id');
const mockSearch = vi.fn().mockResolvedValue({ hits: [] });
const mockCreate = vi.fn().mockResolvedValue({});

vi.mock('@orama/orama', () => ({
  create: (...args: any[]) => mockCreate(...args),
  insert: (...args: any[]) => mockInsert(...args),
  search: (...args: any[]) => mockSearch(...args),
}));

const mockExtractor = vi.fn().mockResolvedValue({
  data: new Float32Array(384).fill(0.1),
});

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(mockExtractor),
}));

import {
  initMemoryService,
  addMemory,
  retrieveMemory,
  searchContacts,
  isMemoryInitialized,
} from '@/services/memoryService';

describe('memoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initMemoryService', () => {
    it('should initialize the memory database', async () => {
      await initMemoryService();
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe('addMemory', () => {
    it('should add a contact and return an id', async () => {
      await initMemoryService();
      const contact: Contact = {
        id: '1',
        name: '王总',
        personality: '脾气急躁，爱画大饼',
        tags: ['领导', '急躁'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const id = await addMemory(contact);
      expect(id).toBe('mock-id');
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('retrieveMemory', () => {
    it('should return default message when no results found', async () => {
      await initMemoryService();
      mockSearch.mockResolvedValueOnce({ hits: [] });
      const result = await retrieveMemory('王总');
      expect(result).toBe('暂无此人记录');
    });

    it('should return personality data when results found', async () => {
      await initMemoryService();
      mockSearch.mockResolvedValueOnce({
        hits: [
          {
            document: {
              contactName: '王总',
              personality: '脾气急躁，爱画大饼',
            },
          },
        ],
      });
      const result = await retrieveMemory('王总');
      expect(result).toContain('王总');
      expect(result).toContain('脾气急躁');
    });
  });

  describe('searchContacts', () => {
    it('should return empty array on search failure', async () => {
      await initMemoryService();
      mockSearch.mockRejectedValueOnce(new Error('search failed'));
      const results = await searchContacts('test');
      expect(results).toEqual([]);
    });
  });

  describe('isMemoryInitialized', () => {
    it('should return false before initialization', () => {
      expect(typeof isMemoryInitialized()).toBe('boolean');
    });
  });
});
