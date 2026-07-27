import { test, expect } from '@playwright/test';

const targetFile = process.env.TARGET_FILE;

// Helper to check target file
function checkTargetFile() {
  if (!targetFile) {
    throw new Error('TARGET_FILE environment variable is not defined');
  }
}

// Test 1: "The code checks for modelContext in navigator before registering a tool."
test('1. Checks for modelContext in navigator before registering', async ({ page }) => {
  checkTargetFile();

  const errors: string[] = [];
  page.on('pageerror', (err) => {
    errors.push(err.message);
  });

  // Load the page WITHOUT mocking navigator.modelContext
  await page.goto(`file://${targetFile}`);

  // Give any scripts half a second to execute and possibly crash
  await page.waitForTimeout(500);

  // If the page does not support WebMCP and has no feature detection/checks,
  // it will throw an error immediately because navigator.modelContext is undefined.
  expect(errors.length).toBe(0);
});

// For tests 2-6, we mock the navigator.modelContext to record the registration calls
// and verify their details.
test.describe('With mocked WebMCP API', () => {
  test.beforeEach(async ({ page }) => {
    checkTargetFile();

    await page.addInitScript(() => {
      const registerCalls: any[][] = [];
      const calls: any[] = [];

      const mockModelContext = {
        provideContext(...args: any[]) {
          calls.push({ method: 'provideContext', args });
        },
        clearContext(...args: any[]) {
          calls.push({ method: 'clearContext', args });
        },
        unregisterTool(...args: any[]) {
          calls.push({ method: 'unregisterTool', args });
        },
        registerTool(...args: any[]) {
          calls.push({ method: 'registerTool', args });
          registerCalls.push(args);
        }
      };

      // Define it on navigator
      Object.defineProperty(window.navigator, 'modelContext', {
        get() {
          return mockModelContext;
        },
        configurable: true,
        enumerable: true
      });

      // Expose properties to window
      (window as any).__webmcp_calls = calls;
      (window as any).__webmcp_register_calls = registerCalls;

      // Mock fetch so we can safely execute functions returning a promise from fetch
      window.fetch = async function() {
        return new Response(JSON.stringify({ mock: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      };
    });

    await page.goto(`file://${targetFile}`);
    // Wait for page load and execution
    await page.waitForTimeout(500);
  });

  // Test 2: "document.modelContext.registerTool is called with a tool definition object."
  test('2. document.modelContext.registerTool is called with a tool definition object', async ({ page }) => {
    const registerCalls = await page.evaluate(() => (window as any).__webmcp_register_calls);
    
    expect(registerCalls).toBeDefined();
    expect(registerCalls.length).toBeGreaterThan(0);

    const firstCallArgs = registerCalls[0];
    expect(firstCallArgs).toBeDefined();
    
    const toolDef = firstCallArgs[0];
    // Check that the tool definition is an object
    expect(typeof toolDef).toBe('object');
    expect(toolDef).not.toBeNull();
    expect(Array.isArray(toolDef)).toBe(false);
  });

  // Test 3: "The tool definition includes a name, description, inputSchema, and execute."
  test('3. Tool definition includes name, description, inputSchema, and execute', async ({ page }) => {
    const registerCalls = await page.evaluate(() => (window as any).__webmcp_register_calls);
    
    expect(registerCalls).toBeDefined();
    expect(registerCalls.length).toBeGreaterThan(0);

    const firstCallArgs = registerCalls[0];
    const toolDef = firstCallArgs[0];

    // Assert that the tool definition includes name, description, inputSchema, and execute
    expect(toolDef).toBeDefined();
    expect(typeof toolDef).toBe('object');
    expect(toolDef).not.toBeNull();

    expect(toolDef.name).toBeDefined();
    expect(typeof toolDef.name).toBe('string');
    expect(toolDef.name.length).toBeGreaterThan(0);

    expect(toolDef.description).toBeDefined();
    expect(typeof toolDef.description).toBe('string');
    expect(toolDef.description.length).toBeGreaterThan(0);

    expect(toolDef.inputSchema).toBeDefined();
    expect(typeof toolDef.inputSchema).toBe('object');
    expect(toolDef.inputSchema).not.toBeNull();

    // Since functions don't serialize perfectly over page.evaluate unless we handle them,
    // let's check if the function property exists and is a function by evaluating inside the page context!
    const isExecuteAFunction = await page.evaluate(() => {
      const calls = (window as any).__webmcp_register_calls;
      if (!calls || calls.length === 0) return false;
      const toolDef = calls[0][0];
      return toolDef && typeof toolDef.execute === 'function';
    });
    expect(isExecuteAFunction).toBe(true);
  });

  // Test 4: "The inputSchema is a valid JSON Schema object with property descriptions."
  test('4. The inputSchema is a valid JSON Schema object with property descriptions', async ({ page }) => {
    const registerCalls = await page.evaluate(() => (window as any).__webmcp_register_calls);
    
    expect(registerCalls).toBeDefined();
    expect(registerCalls.length).toBeGreaterThan(0);

    const firstCallArgs = registerCalls[0];
    const toolDef = firstCallArgs[0];

    expect(toolDef).toBeDefined();
    expect(typeof toolDef).toBe('object');
    expect(toolDef).not.toBeNull();

    const inputSchema = toolDef.inputSchema;
    expect(inputSchema).toBeDefined();
    expect(typeof inputSchema).toBe('object');
    expect(inputSchema).not.toBeNull();

    // Verify it is a valid JSON Schema object of type "object"
    expect(inputSchema.type).toBe('object');
    expect(inputSchema.properties).toBeDefined();
    expect(typeof inputSchema.properties).toBe('object');
    expect(inputSchema.properties).not.toBeNull();

    // Verify each property has a type and a non-empty description
    const properties = inputSchema.properties;
    const propKeys = Object.keys(properties);
    expect(propKeys.length).toBeGreaterThan(0);

    for (const key of propKeys) {
      const prop = properties[key];
      expect(prop).toBeDefined();
      expect(typeof prop).toBe('object');
      expect(prop).not.toBeNull();

      expect(prop.type).toBeDefined();
      expect(typeof prop.type).toBe('string');

      expect(prop.description).toBeDefined();
      expect(typeof prop.description).toBe('string');
      expect(prop.description.trim().length).toBeGreaterThan(0);
    }
  });

  // Test 5: "An AbortController is created and its signal is passed to registerTool."
  test('5. An AbortController is created and its signal is passed to registerTool', async ({ page }) => {
    const registerCalls = await page.evaluate(() => (window as any).__webmcp_register_calls);
    
    expect(registerCalls).toBeDefined();
    expect(registerCalls.length).toBeGreaterThan(0);

    const firstCallArgs = registerCalls[0];
    const options = firstCallArgs[1];

    // Assert that the options object is passed and contains an AbortSignal
    expect(options).toBeDefined();
    expect(typeof options).toBe('object');
    expect(options).not.toBeNull();

    // Evaluate in the browser to check if signal is an instance of AbortSignal
    const isSignalAnAbortSignal = await page.evaluate(() => {
      const calls = (window as any).__webmcp_register_calls;
      if (!calls || calls.length === 0) return false;
      const options = calls[0][1];
      return options && options.signal instanceof AbortSignal;
    });
    expect(isSignalAnAbortSignal).toBe(true);
  });

  // Test 6: "The execute function is asynchronous if it performs any async operations."
  test('6. The execute function is asynchronous if it performs any async operations', async ({ page }) => {
    const registerCalls = await page.evaluate(() => (window as any).__webmcp_register_calls);
    
    expect(registerCalls).toBeDefined();
    expect(registerCalls.length).toBeGreaterThan(0);

    // Evaluate in browser because functions cannot be inspected via serializable return values
    const executeCheck = await page.evaluate(async () => {
      const calls = (window as any).__webmcp_register_calls;
      if (!calls || calls.length === 0) {
        return { error: 'No register calls' };
      }

      const firstCallArgs = calls[0];
      const toolDef = firstCallArgs[0];
      
      // If toolDef is not an object, let's fall back to looking for a function in the arguments to see if they passed it legacystyle
      let executeFn: any = null;
      if (toolDef && typeof toolDef === 'object' && typeof toolDef.execute === 'function') {
        executeFn = toolDef.execute;
      } else {
        // Find any function in the arguments
        executeFn = firstCallArgs.find((arg: any) => typeof arg === 'function');
      }

      if (!executeFn) {
        return { error: 'No execute function found' };
      }

      const isAsyncFunction = executeFn.constructor.name === 'AsyncFunction';

      // Execute the function with some dummy arguments to see if it returns a promise
      let returnedPromise = false;
      try {
        const res = executeFn({ a: 1, b: 2, url: 'http://example.com' });
        if (res && typeof res.then === 'function') {
          returnedPromise = true;
          // Clean up the promise if needed
          await Promise.resolve(res).catch(() => {});
        }
      } catch (e) {
        // Ignore runtime execution errors of the mock call
      }

      // Check source code of the function for async patterns if it is not defined as an async function
      const source = executeFn.toString();
      const hasAsyncKeywords = source.includes('fetch') || source.includes('.then(') || source.includes('Promise') || source.includes('await');

      const performsAsyncOperations = returnedPromise || hasAsyncKeywords;

      return {
        isAsyncFunction,
        performsAsyncOperations,
        source
      };
    });

    if ('error' in executeCheck) {
      throw new Error(executeCheck.error);
    }

    // "The execute function is asynchronous if it performs any async operations."
    // This means: performsAsyncOperations => isAsyncFunction.
    if (executeCheck.performsAsyncOperations) {
      expect(executeCheck.isAsyncFunction).toBe(true);
    } else {
      // If it doesn't perform async operations, it can be synchronous, which is correct (e.g., demo.html).
      expect(true).toBe(true);
    }
  });
});
