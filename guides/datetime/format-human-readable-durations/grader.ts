import { test, expect } from '@playwright/test';

declare const process: any;

// Helper mock class for Temporal.Duration that we inject before page scripts run.
// It matches Temporal.Duration API and lets us spy on constructor, methods, and property access/mutation.
const defineMockTemporal = () => {
  (window as any).__attemptedMutation = false;
  (window as any).__fromCalled = false;
  (window as any).__roundCalledWith = null;
  (window as any).__accessedProperties = [];

  class MockDuration {
    _hours: number;
    _minutes: number;
    _seconds: number;

    constructor(...args: any[]) {
      this._hours = args[4] || 0;
      this._minutes = args[5] || 0;
      this._seconds = args[6] || 0;
    }

    get hours() {
      (window as any).__accessedProperties.push('hours');
      return this._hours;
    }
    set hours(val: number) {
      (window as any).__attemptedMutation = true;
      this._hours = val;
    }

    get minutes() {
      (window as any).__accessedProperties.push('minutes');
      return this._minutes;
    }
    set minutes(val: number) {
      (window as any).__attemptedMutation = true;
      this._minutes = val;
    }

    get seconds() {
      (window as any).__accessedProperties.push('seconds');
      return this._seconds;
    }
    set seconds(val: number) {
      (window as any).__attemptedMutation = true;
      this._seconds = val;
    }

    static from(obj: any) {
      (window as any).__fromCalled = true;
      return new MockDuration(0, 0, 0, 0, obj.hours || 0, obj.minutes || 0, obj.seconds || 0);
    }

    round(options?: any) {
      (window as any).__roundCalledWith = options;
      const largestUnit = options?.largestUnit;
      const totalSeconds = this._hours * 3600 + this._minutes * 60 + this._seconds;
      let rh = 0, rm = 0, rs = 0;
      if (largestUnit === 'hours') {
        rh = Math.floor(totalSeconds / 3600);
        rm = Math.floor((totalSeconds % 3600) / 60);
        rs = totalSeconds % 60;
      } else if (largestUnit === 'minutes') {
        rm = Math.floor(totalSeconds / 60);
        rs = totalSeconds % 60;
      } else if (largestUnit === 'seconds') {
        rs = totalSeconds;
      } else {
        rh = this._hours;
        rm = this._minutes;
        rs = this._seconds;
      }
      return new MockDuration(0, 0, 0, 0, rh, rm, rs);
    }

    toString() {
      let str = 'PT';
      if (this._hours > 0) str += `${this._hours}H`;
      if (this._minutes > 0) str += `${this._minutes}M`;
      if (this._seconds > 0) str += `${this._seconds}S`;
      if (str === 'PT') str += '0S';
      return str;
    }
  }

  const wrapTemporal = (rawTemporal: any) => {
    return new Proxy(rawTemporal, {
      get(target, prop) {
        if (prop === 'Duration') {
          return new Proxy(target.Duration, {
            construct(clazz, argumentsList) {
              const instance = Reflect.construct(clazz, argumentsList);
              return wrapDurationInstance(instance);
            },
            get(clazz, staticProp) {
              if (staticProp === 'from') {
                return new Proxy(clazz.from, {
                  apply(fromFunc, thisArg, argumentsList) {
                    (window as any).__fromCalled = true;
                    const instance = Reflect.apply(fromFunc, thisArg, argumentsList);
                    return wrapDurationInstance(instance);
                  }
                });
              }
              return Reflect.get(clazz, staticProp);
            }
          });
        }
        return Reflect.get(target, prop);
      }
    });
  };

  const wrapDurationInstance = (instance: any) => {
    return new Proxy(instance, {
      get(obj, key) {
        if (typeof key === 'string' && ['hours', 'minutes', 'seconds'].includes(key)) {
          (window as any).__accessedProperties.push(key);
        }
        if (key === 'round') {
          return new Proxy(obj.round, {
            apply(roundFunc, thisArg, argumentsList) {
              const options = argumentsList[0];
              (window as any).__roundCalledWith = options;
              const result = Reflect.apply(roundFunc, thisArg, argumentsList);
              return wrapDurationInstance(result);
            }
          });
        }
        return Reflect.get(obj, key);
      },
      set(obj, key, value) {
        if (typeof key === 'string' && ['hours', 'minutes', 'seconds'].includes(key)) {
          (window as any).__attemptedMutation = true;
        }
        return Reflect.set(obj, key, value);
      }
    });
  };

  let currentTemporal = wrapTemporal({ Duration: MockDuration });

  Object.defineProperty(globalThis, 'Temporal', {
    get() {
      return currentTemporal;
    },
    set(val) {
      currentTemporal = wrapTemporal(val);
    },
    configurable: true
  });
};

test.describe('Format Human-Readable Durations Requirements', () => {

  test('Feature detects Temporal and loads polyfill conditionally', async ({ page }) => {
    await page.addInitScript(defineMockTemporal);

    let polyfillRequested = false;
    await page.route('**/@js-temporal/polyfill*', async (route) => {
      polyfillRequested = true;
      await route.continue();
    });

    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    expect(polyfillRequested).toBe(false);
  });

  test('Uses Temporal.Duration.from to create duration objects', async ({ page }) => {
    await page.addInitScript(defineMockTemporal);

    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const minutesInput = page.locator('#minutesInput');
    await minutesInput.fill('120');
    await page.waitForTimeout(200);

    const fromCalled = await page.evaluate(() => (window as any).__fromCalled);
    expect(fromCalled).toBe(true);
  });

  test('Uses the .round() method with largestUnit option to balance', async ({ page }) => {
    await page.addInitScript(defineMockTemporal);

    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const radioHours = page.locator('input[name="largestUnit"][value="hours"]');
    if (await radioHours.count() > 0) {
      await radioHours.check();
    }
    await page.waitForTimeout(200);

    const roundCalledWith = await page.evaluate(() => (window as any).__roundCalledWith);
    expect(roundCalledWith).toEqual(expect.objectContaining({ largestUnit: 'hours' }));
  });

  test('Uses Intl.DurationFormat to build human-readable display string when supported', async ({ page }) => {
    await page.addInitScript(() => {
      const mockDuration = (units: any) => {
        const h = Number(units.hours || 0);
        const m = Number(units.minutes || 0);
        const s = Number(units.seconds || 0);
        return {
          hours: h, minutes: m, seconds: s,
          round: () => mockDuration({ hours: h, minutes: m, seconds: s }),
          toString: () => 'PT1H30M'
        };
      };
      Object.defineProperty(globalThis, 'Temporal', {
        value: {
          Duration: {
            from: (obj: any) => mockDuration(obj)
          }
        },
        writable: false,
        configurable: true
      });

      (window as any).__durationFormatCalled = false;
      class MockDurationFormat {
        constructor() {
          (window as any).__durationFormatCalled = true;
        }
        format() {
          return "1 hour and 30 minutes";
        }
      }
      Object.defineProperty(Intl, 'DurationFormat', {
        value: MockDurationFormat,
        configurable: true,
        writable: true
      });
    });

    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const minutesInput = page.locator('#minutesInput');
    await minutesInput.fill('90');
    await page.waitForTimeout(200);

    const durationFormatCalled = await page.evaluate(() => (window as any).__durationFormatCalled);
    expect(durationFormatCalled).toBe(true);
  });

  test('Falls back to extracting individual unit properties manually when Intl.DurationFormat is unsupported', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Intl, 'DurationFormat', {
        value: undefined,
        configurable: true,
        writable: true
      });

      (window as any).__accessedProperties = [];
      const mockDuration = (units: any) => {
        const h = Number(units.hours || 0);
        const m = Number(units.minutes || 0);
        const s = Number(units.seconds || 0);
        return {
          get hours() {
            (window as any).__accessedProperties.push('hours');
            return h;
          },
          get minutes() {
            (window as any).__accessedProperties.push('minutes');
            return m;
          },
          get seconds() {
            (window as any).__accessedProperties.push('seconds');
            return s;
          },
          round: () => mockDuration({ hours: h, minutes: m, seconds: s }),
          toString: () => 'PT1H30M'
        };
      };
      Object.defineProperty(globalThis, 'Temporal', {
        value: {
          Duration: {
            from: (obj: any) => mockDuration(obj)
          }
        },
        writable: false,
        configurable: true
      });
    });

    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const accessedProps = await page.evaluate(() => (window as any).__accessedProperties);
    expect(accessedProps).toContain('minutes');
  });

  test('Does not use the ISO 8601 toString format for user-facing text', async ({ page }) => {
    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const hoursInput = page.locator('#hoursInput');
    const minutesInput = page.locator('#minutesInput');
    await hoursInput.fill('1');
    await minutesInput.fill('30');
    await page.waitForTimeout(200);

    const displayValue = await page.locator('#humanValue').textContent();
    expect(displayValue?.trim()).not.toContain('PT');
  });

  test('Does not attempt to modify Temporal.Duration instances directly', async ({ page }) => {
    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const scripts = await page.locator('script').allTextContents();
    const combinedScripts = scripts.join('\n');
    const hasMutationAssignments = /\.\s*(hours|minutes|seconds)\s*=/.test(combinedScripts);

    expect(hasMutationAssignments).toBe(false);
  });

  test('Does not use legacy manual calculations for duration balancing when Temporal is available', async ({ page }) => {
    await page.goto(`file://${process.env.TARGET_FILE}`);
    await page.waitForTimeout(500);

    const scripts = await page.locator('script').allTextContents();
    const combinedScripts = scripts.join('\n');
    const hasManualBalancingMath = /\/\s*3600|%\s*3600|\/\s*60|%\s*60/.test(combinedScripts);

    expect(hasManualBalancingMath).toBe(false);
  });

});
