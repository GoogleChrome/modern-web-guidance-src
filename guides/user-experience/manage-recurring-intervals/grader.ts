/// <reference types="node" />

import { test, expect } from '@playwright/test';
import * as path from 'path';

declare global {
  var Temporal: any;
  interface Window {
    __temporalAccessed?: boolean;
    __mockTemporalCalled?: boolean;
    Temporal?: any;
    __temporalPlainDateAccessed?: boolean;
    __plainDateFromCalled?: boolean;
    __plainDateAddCalled?: boolean;
    __newTemporalInstanceUsed?: boolean;
    __legacyDateMutationCalled?: boolean;
  }
}

const targetFileRaw = process.env.TARGET_FILE || 'demo.html';
const targetFile = path.isAbsolute(targetFileRaw) ? targetFileRaw : path.resolve(process.cwd(), targetFileRaw);
const targetUrl = `file://${targetFile}`;

test.describe('Temporal Interval Manager Grader', () => {

  // 1. Feature Detect Temporal
  test('should feature-detect Temporal via typeof Temporal', async ({ page }) => {
    await page.addInitScript(() => {
      window.__temporalAccessed = false;
      Object.defineProperty(window, 'Temporal', {
        get() {
          window.__temporalAccessed = true;
          return undefined;
        },
        configurable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(500);
    const accessed = await page.evaluate(() => window.__temporalAccessed);
    expect(accessed).toBe(true);
  });

  // 2. Conditionally load polyfill (present scenario)
  test('should not load polyfill if native Temporal is present', async ({ page }) => {
    let polyfillRequested = false;
    await page.route('**/@js-temporal/polyfill*', route => {
      polyfillRequested = true;
      route.continue();
    });
    await page.addInitScript(() => {
      window.__mockTemporalCalled = false;
      window.Temporal = {
        PlainDate: {
          from: (_str: string) => {
            window.__mockTemporalCalled = true;
            return {
              add: () => ({
                toString: () => '2024-02-29'
              })
            };
          }
        }
      };
    });
    await page.goto(targetUrl);
    const startDateInput = page.locator('#startDateInput');
    await startDateInput.fill('2024-01-31');
    await startDateInput.dispatchEvent('change');
    await page.waitForTimeout(500);

    const result = await page.evaluate(() => {
      return window.__mockTemporalCalled === true;
    });
    expect(result && !polyfillRequested).toBe(true);
  });

  // 3. Conditionally load polyfill (absent scenario)
  test('should load polyfill when native Temporal is absent', async ({ page }) => {
    let polyfillRequested = false;
    await page.route('**/@js-temporal/polyfill*', route => {
      polyfillRequested = true;
      route.continue();
    });
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Temporal', {
        value: undefined,
        configurable: true,
        writable: true
      });
      Object.defineProperty(globalThis, 'Temporal', {
        value: undefined,
        configurable: true,
        writable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    expect(polyfillRequested).toBe(true);
  });

  // 4. Assign loaded polyfill to globalThis.Temporal
  test('should manually assign loaded polyfill to globalThis.Temporal', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'Temporal', {
        value: undefined,
        configurable: true,
        writable: true
      });
      Object.defineProperty(globalThis, 'Temporal', {
        value: undefined,
        configurable: true,
        writable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    const isGlobalTemporalDefined = await page.evaluate(() => {
      return typeof globalThis.Temporal !== 'undefined' && typeof globalThis.Temporal.PlainDate === 'function';
    });
    expect(isGlobalTemporalDefined).toBe(true);
  });

  // 5. Use Temporal.PlainDate
  test('should use Temporal.PlainDate as primary type for calculating intervals', async ({ page }) => {
    await page.addInitScript(() => {
      window.__temporalPlainDateAccessed = false;
      let realTemporal: any = undefined;

      function wrapTemporal(orig: any) {
        return new Proxy(orig, {
          get(target, prop) {
            if (prop === 'PlainDate') {
              window.__temporalPlainDateAccessed = true;
            }
            return Reflect.get(target, prop);
          }
        });
      }

      if (typeof window.Temporal !== 'undefined') {
        realTemporal = wrapTemporal(window.Temporal);
      }

      Object.defineProperty(window, 'Temporal', {
        get() { return realTemporal; },
        set(val) {
          realTemporal = wrapTemporal(val);
        },
        configurable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    const accessed = await page.evaluate(() => window.__temporalPlainDateAccessed);
    expect(accessed).toBe(true);
  });

  // 6. Use Temporal.PlainDate.from()
  test('should use Temporal.PlainDate.from to parse starting date', async ({ page }) => {
    await page.addInitScript(() => {
      window.__plainDateFromCalled = false;
      let realTemporal: any = undefined;

      function wrapTemporal(orig: any) {
        return new Proxy(orig, {
          get(target, prop) {
            if (prop === 'PlainDate') {
              const origPD = target.PlainDate;
              return new Proxy(origPD, {
                get(pdTarget, pdProp) {
                  if (pdProp === 'from') {
                    return function(...args: any[]) {
                      window.__plainDateFromCalled = true;
                      return origPD.from.apply(origPD, args);
                    };
                  }
                  return Reflect.get(pdTarget, pdProp);
                }
              });
            }
            return Reflect.get(target, prop);
          }
        });
      }

      if (typeof window.Temporal !== 'undefined') {
        realTemporal = wrapTemporal(window.Temporal);
      }

      Object.defineProperty(window, 'Temporal', {
        get() { return realTemporal; },
        set(val) {
          realTemporal = wrapTemporal(val);
        },
        configurable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    const called = await page.evaluate(() => window.__plainDateFromCalled);
    expect(called).toBe(true);
  });

  // 7. Use .add() on PlainDate instance
  test('should use .add() on PlainDate instance to calculate next interval date', async ({ page }) => {
    await page.addInitScript(() => {
      window.__plainDateAddCalled = false;
      let realTemporal: any = undefined;

      function wrapTemporal(orig: any) {
        return new Proxy(orig, {
          get(target, prop) {
            if (prop === 'PlainDate') {
              const origPD = target.PlainDate;
              return new Proxy(origPD, {
                get(pdTarget, pdProp) {
                  if (pdProp === 'from') {
                    return function(...args: any[]) {
                      const inst = origPD.from.apply(origPD, args);
                      return new Proxy(inst, {
                        get(instTarget, instProp) {
                          if (instProp === 'add') {
                            return function(...addArgs: any[]) {
                              window.__plainDateAddCalled = true;
                              return instTarget.add.apply(instTarget, addArgs);
                            };
                          }
                          return Reflect.get(instTarget, instProp);
                        }
                      });
                    };
                  }
                  return Reflect.get(pdTarget, pdProp);
                }
              });
            }
            return Reflect.get(target, prop);
          }
        });
      }

      if (typeof window.Temporal !== 'undefined') {
        realTemporal = wrapTemporal(window.Temporal);
      }

      Object.defineProperty(window, 'Temporal', {
        get() { return realTemporal; },
        set(val) {
          realTemporal = wrapTemporal(val);
        },
        configurable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    const called = await page.evaluate(() => window.__plainDateAddCalled);
    expect(called).toBe(true);
  });

  // 8. Handle month-end transitions by default by clamping
  test('should handle month-end transitions by default by clamping to end of month', async ({ page }) => {
    await page.goto(targetUrl);
    const startDateInput = page.locator('#startDateInput');
    const yearsInput = page.locator('#yearsInput');
    const monthsInput = page.locator('#monthsInput');

    await startDateInput.fill('2024-01-31');
    await yearsInput.fill('0');
    await monthsInput.fill('1');

    await startDateInput.dispatchEvent('change');
    await monthsInput.dispatchEvent('change');

    const resultDate = page.locator('#resultDate');
    await expect(resultDate).toContainText('2024-02-29');
  });

  // 9. Support reject overflow strategy
  test('should support reject overflow strategy and display an error message', async ({ page }) => {
    await page.goto(targetUrl);
    const overflowSelect = page.locator('#overflowSelect');
    await overflowSelect.selectOption('reject');

    const startDateInput = page.locator('#startDateInput');
    await startDateInput.fill('2024-01-31');
    const monthsInput = page.locator('#monthsInput');
    await monthsInput.fill('1');

    await startDateInput.dispatchEvent('change');
    await monthsInput.dispatchEvent('change');

    const resultDate = page.locator('#resultDate');
    await expect(resultDate).toContainText(/Error|RangeError/i);
  });

  // 10. Use new instances returned by operations
  test('should use new Temporal instance returned by operations like add', async ({ page }) => {
    await page.addInitScript(() => {
      window.__newTemporalInstanceUsed = false;
      let realTemporal: any = undefined;

      function wrapTemporal(orig: any) {
        return new Proxy(orig, {
          get(target, prop) {
            if (prop === 'PlainDate') {
              const origPD = target.PlainDate;
              return new Proxy(origPD, {
                get(pdTarget, pdProp) {
                  if (pdProp === 'from') {
                    return function(...args: any[]) {
                      const inst = origPD.from.apply(origPD, args);
                      return new Proxy(inst, {
                        get(instTarget, instProp) {
                          if (instProp === 'add') {
                            return function(...addArgs: any[]) {
                              const newInst = instTarget.add.apply(instTarget, addArgs);
                              return new Proxy(newInst, {
                                get(newInstTarget, newInstProp) {
                                  if (newInstProp === 'toString') {
                                    return function(...tsArgs: any[]) {
                                      window.__newTemporalInstanceUsed = true;
                                      return newInstTarget.toString.apply(newInstTarget, tsArgs);
                                    };
                                  }
                                  return Reflect.get(newInstTarget, newInstProp);
                                }
                              });
                            };
                          }
                          return Reflect.get(instTarget, instProp);
                        }
                      });
                    };
                  }
                  return Reflect.get(pdTarget, pdProp);
                }
              });
            }
            return Reflect.get(target, prop);
          }
        });
      }

      if (typeof window.Temporal !== 'undefined') {
        realTemporal = wrapTemporal(window.Temporal);
      }

      Object.defineProperty(window, 'Temporal', {
        get() { return realTemporal; },
        set(val) {
          realTemporal = wrapTemporal(val);
        },
        configurable: true
      });
    });
    await page.goto(targetUrl);
    await page.waitForTimeout(1000);
    const called = await page.evaluate(() => window.__newTemporalInstanceUsed);
    expect(called).toBe(true);
  });

  // 11. Do not use legacy Date object
  test('should not use legacy Date object for core interval calculations', async ({ page }) => {
    await page.addInitScript(() => {
      window.__legacyDateMutationCalled = false;
      const originalSetMonth = Date.prototype.setMonth;
      Date.prototype.setMonth = function(...args: any[]) {
        window.__legacyDateMutationCalled = true;
        return Reflect.apply(originalSetMonth, this, args);
      };
      const originalSetFullYear = Date.prototype.setFullYear;
      Date.prototype.setFullYear = function(...args: any[]) {
        window.__legacyDateMutationCalled = true;
        return Reflect.apply(originalSetFullYear, this, args);
      };
      const originalSetDate = Date.prototype.setDate;
      Date.prototype.setDate = function(...args: any[]) {
        window.__legacyDateMutationCalled = true;
        return Reflect.apply(originalSetDate, this, args);
      };
    });
    await page.goto(targetUrl);
    const startDateInput = page.locator('#startDateInput');
    await startDateInput.fill('2024-01-31');
    await startDateInput.dispatchEvent('change');
    await page.waitForTimeout(1000);

    const mutationCalled = await page.evaluate(() => window.__legacyDateMutationCalled);
    expect(mutationCalled).toBe(false);
  });

});
