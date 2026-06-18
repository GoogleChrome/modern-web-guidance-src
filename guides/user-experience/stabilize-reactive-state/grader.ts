import { test, expect } from '@playwright/test';
import * as path from 'path';

const TARGET_FILE = process.env.TARGET_FILE;

test.describe('Temporal Reactive State Grader', () => {
  // Test 1: Feature Detection
  test('should feature-detect the Temporal API before usage', async ({ page }) => {
    // Pre-define Temporal on globalThis to simulate native support
    await page.addInitScript(() => {
      (globalThis as any).Temporal = {
        PlainDateTime: class {
          static from() { return new (globalThis as any).Temporal.PlainDateTime(); }
          toPlainTime() {
            return {
              toLocaleString() { return '12:00 PM'; }
            };
          }
          add() { return new (globalThis as any).Temporal.PlainDateTime(); }
        },
        Now: {
          plainDateTimeISO() { return new (globalThis as any).Temporal.PlainDateTime(); }
        }
      };
    });

    let polyfillLoaded = false;
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('polyfill') || url.includes('@js-temporal')) {
        polyfillLoaded = true;
      }
      await route.continue();
    });

    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl);

    // Assert that the polyfill was NOT loaded since Temporal was pre-defined
    expect(polyfillLoaded).toBe(false);
  });

  // Test 2: Conditional Polyfill Loading
  test('should conditionally load a Temporal polyfill only if native support is absent', async ({ page }) => {
    // Pre-define Temporal on globalThis with a mock property
    await page.addInitScript(() => {
      (globalThis as any).Temporal = {
        isMock: true,
        PlainDateTime: class {
          static from() { return new (globalThis as any).Temporal.PlainDateTime(); }
          toPlainTime() {
            return {
              toLocaleString() { return '12:00 PM'; }
            };
          }
          add() { return new (globalThis as any).Temporal.PlainDateTime(); }
        },
        Now: {
          plainDateTimeISO() { return new (globalThis as any).Temporal.PlainDateTime(); }
        }
      };
    });

    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl);

    // Wait until the initial render of temporal-value has finished
    await page.locator('#temporal-value').waitFor({ state: 'visible' });
    await expect(page.locator('#temporal-value')).not.toHaveText('-');

    // If native support is present, the mock should NOT be overwritten by loading the polyfill
    const isMockOriginal = await page.evaluate(() => {
      return !!(globalThis as any).Temporal?.isMock;
    });

    expect(isMockOriginal).toBe(true);
  });

  // Helper setup for Tests 3 to 7
  async function setupInstrumentedPage(page: any) {
    await page.addInitScript(() => {
      let originalTemporal: any = undefined;

      (globalThis as any).__temporalInstanceCreated = false;
      (globalThis as any).__temporalInstanceCreatedCount = 0;
      (globalThis as any).__temporalInstanceAddCalled = false;
      (globalThis as any).__temporalInstanceSubtractCalled = false;
      (globalThis as any).__temporalInstanceWithCalled = false;
      (globalThis as any).__directMutationAttempted = false;

      function wrapTemporalInstance(instance: any): any {
        if (!instance || instance.__wrappedInstance) return instance;

        (globalThis as any).__temporalInstanceCreated = true;
        (globalThis as any).__temporalInstanceCreatedCount = ((globalThis as any).__temporalInstanceCreatedCount || 0) + 1;

        return new Proxy(instance, {
          get(target, prop) {
            if (prop === '__wrappedInstance') return true;

            // Do NOT pass receiver here to avoid brand check errors on native getters
            const value = Reflect.get(target, prop);
            if (typeof value === 'function') {
              return function(this: any, ...args: any[]) {
                if (prop === 'add') {
                  (globalThis as any).__temporalInstanceAddCalled = true;
                } else if (prop === 'subtract') {
                  (globalThis as any).__temporalInstanceSubtractCalled = true;
                } else if (prop === 'with') {
                  (globalThis as any).__temporalInstanceWithCalled = true;
                }
                const result = value.apply(target, args);
                if (result && typeof result === 'object' && result.constructor) {
                  return wrapTemporalInstance(result);
                }
                return result;
              };
            }
            return value;
          },
          set(target, prop, value) {
            (globalThis as any).__directMutationAttempted = true;
            // Do NOT pass receiver here to avoid brand check errors on native setters
            return Reflect.set(target, prop, value);
          }
        });
      }

      function instrumentTemporal(val: any) {
        if (!val || val.__instrumented) return val;

        const instrumented = { ...val, __instrumented: true };

        // Instrument Temporal.Now static methods
        if (val.Now) {
          instrumented.Now = Object.create(Object.getPrototypeOf(val.Now));
          for (const key of Object.getOwnPropertyNames(val.Now)) {
            const desc = Object.getOwnPropertyDescriptor(val.Now, key);
            if (desc) {
              if (typeof desc.value === 'function') {
                const originalMethod = desc.value;
                desc.value = function(this: any, ...args: any[]) {
                  const result = originalMethod.apply(val.Now, args);
                  return wrapTemporalInstance(result);
                };
              }
              Object.defineProperty(instrumented.Now, key, desc);
            }
          }
        }

        // Instrument all classes dynamically
        for (const key of Object.getOwnPropertyNames(val)) {
          if (key[0] === key[0].toUpperCase() && typeof val[key] === 'function' && val[key].prototype) {
            const OriginalClass = val[key];
            const InstrumentedClass = function(this: any, ...args: any[]) {
              const instance = new OriginalClass(...args);
              return wrapTemporalInstance(instance);
            };
            Object.setPrototypeOf(InstrumentedClass, OriginalClass);

            for (const staticKey of Object.getOwnPropertyNames(OriginalClass)) {
              if (staticKey !== 'prototype' && staticKey !== 'length' && staticKey !== 'name') {
                const desc = Object.getOwnPropertyDescriptor(OriginalClass, staticKey);
                if (desc) {
                  if (typeof desc.value === 'function') {
                    const originalMethod = desc.value;
                    desc.value = function(this: any, ...args: any[]) {
                      const result = originalMethod.apply(OriginalClass, args);
                      if (result && typeof result === 'object') {
                        return wrapTemporalInstance(result);
                      }
                      return result;
                    };
                  }
                  Object.defineProperty(InstrumentedClass, staticKey, desc);
                }
              }
            }

            instrumented[key] = InstrumentedClass;
          }
        }

        return instrumented;
      }

      Object.defineProperty(globalThis, 'Temporal', {
        configurable: true,
        enumerable: true,
        get() {
          return originalTemporal;
        },
        set(val) {
          if (val && !val.__wrapped) {
            originalTemporal = instrumentTemporal(val);
          } else {
            originalTemporal = val;
          }
        }
      });
    });

    const fileUrl = `file://${path.resolve(TARGET_FILE || '')}`;
    await page.goto(fileUrl);

    // Wait for the async polyfill and initial render to complete
    await page.waitForFunction(() => (globalThis as any).__temporalInstanceCreated === true);
  }

  // Test 3: Use specific Temporal type (PlainDateTime/PlainDate) in reactive state
  test('should use Temporal.PlainDateTime (or specific Temporal type) as the value in reactive state to ensure immutability', async ({ page }) => {
    await setupInstrumentedPage(page);

    // Prior to clicking, the state should be loaded with a Temporal type
    const initialCreated = await page.evaluate(() => {
      return (globalThis as any).__temporalInstanceCreated;
    });

    const initialValue = await page.locator('#temporal-value').textContent();

    // Then we click the extend button
    await page.click('#extend-temporal-btn');

    const finalValue = await page.locator('#temporal-value').textContent();

    expect(initialCreated && finalValue?.trim() !== initialValue?.trim()).toBe(true);
  });

  // Test 4: Update reactive state using methods returning new instance
  test('should update the reactive state by calling methods that return a new instance rather than mutating the existing object', async ({ page }) => {
    await setupInstrumentedPage(page);

    await page.click('#extend-temporal-btn');

    const methodCalled = await page.evaluate(() => {
      return (globalThis as any).__temporalInstanceAddCalled ||
             (globalThis as any).__temporalInstanceSubtractCalled ||
             (globalThis as any).__temporalInstanceWithCalled;
    });

    expect(methodCalled).toBe(true);
  });

  // Test 5: Assign new Temporal instance reference to state
  test('should assign the new Temporal instance reference to the state to trigger a UI update in reference-diffing systems', async ({ page }) => {
    await setupInstrumentedPage(page);

    await page.click('#extend-temporal-btn');

    // Verify memory reference changed indicator in UI
    const refChangedText = await page.locator('#temporal-ref-changed').textContent();
    expect(refChangedText?.trim()).toBe('Yes');
  });

  // Test 6: Do NOT mutate a legacy Date object in place
  test('should trigger a UI re-render when the state is updated', async ({ page }) => {
    await setupInstrumentedPage(page);

    const initialRenderCountText = await page.locator('#temporal-render-count').textContent();
    const initialRenderCount = Number(initialRenderCountText?.trim() || '0');

    await page.click('#extend-temporal-btn');

    // Verify render count in UI increments by 1
    const finalRenderCountText = await page.locator('#temporal-render-count').textContent();
    const finalRenderCount = Number(finalRenderCountText?.trim() || '0');

    expect(finalRenderCount).toBe(initialRenderCount + 1);
  });

  // Test 7: Do NOT attempt to modify properties of a Temporal instance directly
  test('should not attempt to modify properties of a Temporal instance directly', async ({ page }) => {
    await setupInstrumentedPage(page);

    await page.click('#extend-temporal-btn');

    const directMutationAttempted = await page.evaluate(() => {
      return (globalThis as any).__directMutationAttempted;
    });

    expect(directMutationAttempted).toBe(false);
  });
});
