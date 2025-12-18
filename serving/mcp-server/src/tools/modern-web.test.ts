import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerModernWebTools } from './modern-web.js';
import * as modernPractices from '../data/modern-practices.js';

// Mock mocks
const mockEmbed = vi.fn();
const mockSearch = vi.fn();

// Mock dependencies
vi.mock('../lib/embedder.js', () => ({
  Embedder: {
    getInstance: () => ({
      embed: mockEmbed,
    }),
  },
}));

vi.mock('../lib/store.js', () => ({
  Store: class {
    search = mockSearch;
  },
}));

vi.mock('../data/modern-practices.js');

// Mock McpServer
const mockTool = vi.fn();
const mockServer = {
  tool: mockTool,
  registerTool: mockTool,
} as any;

describe('modern-web tools', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register search_use_cases and get_best_practices tools', () => {
    registerModernWebTools(mockServer);

    expect(mockTool).toHaveBeenCalledTimes(2);
    expect(mockTool).toHaveBeenCalledWith(
      'search_use_cases',
      expect.any(Object),
      expect.any(Function)
    );
    expect(mockTool).toHaveBeenCalledWith(
      'get_best_practices',
      expect.any(Object),
      expect.any(Function)
    );
  });

  describe('search_use_cases handler', () => {
    it('should return search results', async () => {
      const mockVector = [0.1, 0.2, 0.3];
      const mockResults = [{ id: 'test', description: 'test desc', category: 'test cat' }];

      mockEmbed.mockResolvedValue(mockVector);
      mockSearch.mockResolvedValue(mockResults);

      registerModernWebTools(mockServer);
      const handler = mockTool.mock.calls.find(call => call[0] === 'search_use_cases')![2];

      const result = await handler({ query: 'test query' });

      expect(mockEmbed).toHaveBeenCalledWith('test query');
      expect(mockSearch).toHaveBeenCalledWith(mockVector);
      expect(JSON.parse(result.content[0].text)).toEqual(mockResults);
    });
  });

  describe('get_best_practices handler', () => {
    it('should return guide content if found', async () => {
      const mockGuide = '# Guide Content';
      vi.mocked(modernPractices.getGuide).mockResolvedValue(mockGuide);

      registerModernWebTools(mockServer);
      const handler = mockTool.mock.calls.find(call => call[0] === 'get_best_practices')![2];

      const result = await handler({ use_case_id: 'test-id' });

      expect(result.content[0].text).toBe(mockGuide);
      expect(modernPractices.getGuide).toHaveBeenCalledWith('test-id');
    });

    it('should return error if guide not found', async () => {
      vi.mocked(modernPractices.getGuide).mockResolvedValue(null);

      registerModernWebTools(mockServer);
      const handler = mockTool.mock.calls.find(call => call[0] === 'get_best_practices')![2];

      const result = await handler({ use_case_id: 'unknown-id' });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('No guide found');
    });
  });
});
