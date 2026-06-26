import { describe, it } from 'node:test';
import assert from 'node:assert';
import { registerModernWebTools } from './modern-web.ts';

describe('modern-web tools (Unit Tests with Mocks)', () => {
  it('should register all three modern-web tools', () => {
    let mockToolCalls = 0;
    const mockServer = {
      registerTool: () => {
        mockToolCalls++;
      },
    } as any;

    registerModernWebTools(mockServer);

    assert.strictEqual(mockToolCalls, 3);
  });

  describe('get_best_practices handler', () => {
    it('should return guide content if found', async () => {
      const handlers: { [key: string]: Function } = {};
      const mockServer = {
        registerTool: (name: string, schema: any, handler: Function) => {
          handlers[name] = handler;
        },
      } as any;

      registerModernWebTools(mockServer);

      const result = await handlers['get_best_practices']({ use_case_id: 'batch-analytics-events' });

      assert.ok(result.content[0].text.includes('# Debounce and batch multiple analytics events'));
    });

    it('should return error if guide not found', async () => {
      const handlers: { [key: string]: Function } = {};
      const mockServer = {
        registerTool: (name: string, schema: any, handler: Function) => {
          handlers[name] = handler;
        },
      } as any;

      registerModernWebTools(mockServer);

      const result = await handlers['get_best_practices']({ use_case_id: 'unknown-id' });

      assert.strictEqual(result.isError, true);
      assert.ok(result.content[0].text.includes('No guide found'));
    });
  });
});

describe('modern-web tools (Functional / Integration Tests)', () => {
  it('should read real guide content from disk', async () => {
    const handlers: { [key: string]: Function } = {};
    const mockServer = {
      registerTool: (name: string, schema: any, handler: Function) => {
        handlers[name] = handler;
      },
    } as any;

    registerModernWebTools(mockServer);

    const result = await handlers['get_best_practices']({ use_case_id: 'batch-analytics-events' });

    assert.ok(result.content[0].text.includes('# Debounce and batch multiple analytics events'));
  });

  it('should run real search without mocks', async () => {
    const handlers: { [key: string]: Function } = {};
    const mockServer = {
      registerTool: (name: string, schema: any, handler: Function) => {
        handlers[name] = handler;
      },
    } as any;

    registerModernWebTools(mockServer);

    const result = await handlers['search_use_cases']({ query: 'tooltip' });

    assert.ok(result.content[0].text.includes('tooltip'));
    assert.ok(Array.isArray(JSON.parse(result.content[0].text)));
  });

  it('should list all use cases without mocks', async () => {
    const handlers: { [key: string]: Function } = {};
    const mockServer = {
      registerTool: (name: string, schema: any, handler: Function) => {
        handlers[name] = handler;
      },
    } as any;

    registerModernWebTools(mockServer);

    const result = await handlers['list_use_cases']({});

    assert.ok(result.content[0].text.includes('accessible-error-announcement'));
    const catalog = JSON.parse(result.content[0].text);
    assert.ok(Array.isArray(catalog));
    assert.ok(catalog.length > 100);
  });
});