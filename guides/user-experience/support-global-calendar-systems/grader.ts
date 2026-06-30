import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

declare const process: any;

const targetFile = process.env.TARGET_FILE;
const filePath = targetFile ? path.resolve(targetFile) : '';
const targetDir = filePath ? path.dirname(filePath) : '';
const demoName = filePath ? path.basename(filePath) : '';

interface GraderStats {
  assignCount: number;
  originalWithCalendarCalled: boolean;
  originalCompareCalled: boolean;
  monthCodeGetterCalled: boolean;
  monthsInYearGetterCalled: boolean;
  daysInMonthGetterCalled: boolean;
  toLocaleStringCalls: { locales: any; options: any }[];
  supportedValuesCalls: string[];
  legacyDateConstructorCalledWithArgs: boolean;
  temporalUsed: boolean;
}

async function setupNormalPage(page: any, targetUrl?: string): Promise<GraderStats> {
  if (targetUrl && targetUrl.includes('localhost') && targetDir) {
    await page.route(/(http:\/\/localhost(:\d+)?\/.*)/, async (route: any) => {
      const requestPath = new URL(route.request().url()).pathname;
      const sanitizedPath = requestPath === '/' ? demoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(targetDir, sanitizedPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else {
        await route.continue();
      }
    });
  }
  await page.addInitScript(() => {
    const stats: GraderStats = {
      assignCount: 0,
      originalWithCalendarCalled: false,
      originalCompareCalled: false,
      monthCodeGetterCalled: false,
      monthsInYearGetterCalled: false,
      daysInMonthGetterCalled: false,
      toLocaleStringCalls: [],
      supportedValuesCalls: [],
      legacyDateConstructorCalledWithArgs: false,
      temporalUsed: false
    };
    (globalThis as any).__grader_stats__ = stats;

    // 1. Intl.supportedValuesOf spy
    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      const origSupportedValuesOf = Intl.supportedValuesOf;
      Intl.supportedValuesOf = function(key: string) {
        stats.supportedValuesCalls.push(key);
        return origSupportedValuesOf.call(Intl, key as any);
      };
    }

    // 2. Date constructor proxy spy
    const originalDate = globalThis.Date;
    const dateProxy = new Proxy(originalDate, {
      construct(target, args) {
        if (args.length > 0) {
          const stack = new Error().stack || '';
          const isInternal = stack.includes('polyfill') || stack.includes('esm.sh') || stack.includes('playwright');
          if (!isInternal) {
            stats.legacyDateConstructorCalledWithArgs = true;
          }
        }
        return Reflect.construct(target, args);
      }
    });
    globalThis.Date = dateProxy;

    // Helper to install spies on a Temporal object
    function spyOnTemporal(val: any) {
      if (val && typeof val === 'object') {
        stats.temporalUsed = true;
        
        const spyOnMethod = (targetObj: any, prop: string, callback: (...args: any[]) => void) => {
          let curr = targetObj;
          while (curr && curr !== Object.prototype) {
            if (Object.prototype.hasOwnProperty.call(curr, prop) || typeof curr[prop] === 'function') {
              const origFn = curr[prop];
              if (typeof origFn === 'function') {
                curr[prop] = function(...args: any[]) {
                  callback(...args);
                  return origFn.apply(this, args);
                };
                return;
              }
            }
            curr = Object.getPrototypeOf(curr);
          }
        };

        const spyOnGetter = (targetObj: any, prop: string, callback: () => void) => {
          let curr = targetObj;
          while (curr && curr !== Object.prototype) {
            const desc = Object.getOwnPropertyDescriptor(curr, prop);
            if (desc && desc.get) {
              const origGet = desc.get;
              Object.defineProperty(curr, prop, {
                configurable: true,
                get() {
                  callback();
                  return origGet.call(this);
                }
              });
              return;
            }
            curr = Object.getPrototypeOf(curr);
          }
        };

        if (val.PlainDate) {
          if (val.PlainDate.prototype) {
            spyOnMethod(val.PlainDate.prototype, 'withCalendar', () => {
              stats.originalWithCalendarCalled = true;
            });
            spyOnGetter(val.PlainDate.prototype, 'monthCode', () => {
              stats.monthCodeGetterCalled = true;
            });
            spyOnGetter(val.PlainDate.prototype, 'monthsInYear', () => {
              stats.monthsInYearGetterCalled = true;
            });
            spyOnGetter(val.PlainDate.prototype, 'daysInMonth', () => {
              stats.daysInMonthGetterCalled = true;
            });
            spyOnMethod(val.PlainDate.prototype, 'toLocaleString', (locales: any, options: any) => {
              stats.toLocaleStringCalls.push({ locales, options });
            });
          }

          spyOnMethod(val.PlainDate, 'compare', () => {
            stats.originalCompareCalled = true;
          });
        }
      }
    }

    // A functional dummy Temporal object with spies built in
    const createSpiedTemporal = () => {
      const createPlainDate = (calId = 'iso8601'): any => {
        const pd = {
          calendarId: calId,
          calendar: { id: calId },
          year: 2026,
          month: 5,
          day: 15,
          get monthCode() {
            stats.monthCodeGetterCalled = true;
            return 'M05';
          },
          get monthsInYear() {
            stats.monthsInYearGetterCalled = true;
            return 12;
          },
          get daysInMonth() {
            stats.daysInMonthGetterCalled = true;
            return 31;
          },
          add() { return pd; },
          subtract() { return pd; },
          withCalendar(newCal: any) {
            stats.originalWithCalendarCalled = true;
            const id = typeof newCal === 'string' ? newCal : (newCal?.id || 'islamic-umalqura');
            return createPlainDate(id);
          },
          with() { return pd; },
          toLocaleString(locales: any, options: any) {
            stats.toLocaleStringCalls.push({ locales, options });
            return '1447 AH';
          }
        };
        return pd;
      };

      const spied = {
        Now: {
          plainDateISO() {
            stats.temporalUsed = true;
            return createPlainDate('iso8601');
          }
        },
        PlainDate: {
          from(val: any) {
            stats.temporalUsed = true;
            const calId = typeof val === 'object' && val?.calendar ? val.calendar : 'iso8601';
            return createPlainDate(calId);
          },
          compare() {
            stats.originalCompareCalled = true;
            return 0;
          }
        }
      };
      spyOnTemporal(spied);
      return spied;
    };

    (globalThis as any).__createSpiedTemporal = createSpiedTemporal;

    let assignedValue: any = undefined;
    Object.defineProperty(globalThis, 'Temporal', {
      configurable: true,
      enumerable: true,
      get() {
        return assignedValue || createSpiedTemporal();
      },
      set(val) {
        if (val) {
          spyOnTemporal(val);
        }
        assignedValue = val;
        stats.assignCount++;
      }
    });
  });

  // Intercept js-temporal polyfill requests to fulfill locally without network calls
  await page.route(/.*(@js-temporal\/polyfill|cdn\.jsdelivr\.net|esm\.sh\/@js-temporal|unpkg\.com\/@js-temporal|temporal-polyfill).*/, async (route: any) => {
    const url = route.request().url();
    const isEsm = url.includes('.esm') || url.includes('.mjs') || url.includes('esm.sh');

    if (isEsm) {
      const wrapperScript = `
        const T = (globalThis || window).__createSpiedTemporal ? (globalThis || window).__createSpiedTemporal() : {};
        if (typeof window !== 'undefined') window.Temporal = T;
        if (typeof globalThis !== 'undefined') globalThis.Temporal = T;
        export const Temporal = T;
        export default { Temporal: T };
      `;
      await route.fulfill({
        contentType: 'application/javascript',
        body: wrapperScript
      });
    } else {
      const scriptBody = `
        (function() {
          const T = (globalThis || window).__createSpiedTemporal ? (globalThis || window).__createSpiedTemporal() : {};
          if (typeof window !== 'undefined') window.Temporal = T;
          if (typeof globalThis !== 'undefined') globalThis.Temporal = T;
        })();
      `;
      await route.fulfill({
        contentType: 'application/javascript',
        body: scriptBody
      });
    }
  });

  const url = targetUrl || ('file://' + process.env.TARGET_FILE);
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  // Wait deterministically for Temporal API method execution (not tied to DOM element IDs)
  await page.waitForFunction(() => {
    const stats = (globalThis as any).__grader_stats__;
    return !!(stats && (
      stats.originalWithCalendarCalled ||
      stats.originalCompareCalled ||
      stats.monthCodeGetterCalled ||
      stats.monthsInYearGetterCalled ||
      stats.daysInMonthGetterCalled ||
      stats.toLocaleStringCalls.length > 0
    ));
  }, { timeout: 5000 }).catch(() => {});

  // Brief pause to allow any remaining async microtasks or rendering steps to settle
  await page.waitForTimeout(300);

  // Return the stats from the browser context
  return await page.evaluate(() => (globalThis as any).__grader_stats__);
}

async function setupNativePage(page: any, targetUrl?: string): Promise<{ stats: GraderStats, polyfillRequested: boolean }> {
  let polyfillRequested = false;
  await page.route('**/*', (route: any) => {
    const url = route.request().url();
    if (url.includes('@js-temporal/polyfill') || url.includes('cdn.jsdelivr.net/npm/@js-temporal/polyfill')) {
      polyfillRequested = true;
    }
    route.continue();
  });

  await page.addInitScript(() => {
    const stats: GraderStats = {
      assignCount: 0,
      originalWithCalendarCalled: false,
      originalCompareCalled: false,
      monthCodeGetterCalled: false,
      monthsInYearGetterCalled: false,
      daysInMonthGetterCalled: false,
      toLocaleStringCalls: [],
      supportedValuesCalls: [],
      legacyDateConstructorCalledWithArgs: false,
      temporalUsed: false
    };
    (globalThis as any).__grader_stats__ = stats;

    // A fully functional dummy Temporal object to satisfy page initialization
    const dummyTemporalObj = {
      Now: {
        plainDateISO() {
          stats.temporalUsed = true;
          return {
            toString() { return '2026-05-28'; },
            add(_duration: any) {
              return {
                toString() { return '2226-05-28'; }
              };
            },
            subtract(_duration: any) {
              return {
                toString() { return '1826-05-28'; }
              };
            },
            withCalendar(cal: string) {
              stats.originalWithCalendarCalled = true;
              return {
                calendarId: cal,
                calendar: { id: cal },
                year: 2026,
                month: 5,
                monthCode: 'M05',
                monthsInYear: 12,
                daysInMonth: 31,
                add(_duration: any) { return this; },
                subtract(_duration: any) { return this; },
                with() { return this; },
                toLocaleString() {
                  stats.toLocaleStringCalls.push({ locales: 'en-u-ca-' + cal, options: {} });
                  return 'mock-date';
                }
              };
            }
          };
        }
      },
      PlainDate: {
        from() {
          stats.temporalUsed = true;
          return {
            calendarId: 'iso8601',
            calendar: { id: 'iso8601' },
            year: 2026,
            month: 5,
            monthCode: 'M05',
            monthsInYear: 12,
            daysInMonth: 31,
            add(_duration: any) { return this; },
            subtract(_duration: any) { return this; },
            withCalendar(cal: string) {
              stats.originalWithCalendarCalled = true;
              return {
                calendarId: cal,
                calendar: { id: cal },
                year: 2026,
                month: 5,
                monthCode: 'M05',
                monthsInYear: 12,
                daysInMonth: 31,
                add(_duration: any) { return this; },
                subtract(_duration: any) { return this; },
                with() { return this; },
                toLocaleString() {
                  stats.toLocaleStringCalls.push({ locales: 'en-u-ca-' + cal, options: {} });
                  return 'mock-date';
                }
              };
            },
            with() { return this; },
            toLocaleString() { return 'mock-date'; }
          };
        },
        compare() {
          stats.originalCompareCalled = true;
          return 0;
        }
      }
    };

    let assignedValue: any = dummyTemporalObj;
    Object.defineProperty(globalThis, 'Temporal', {
      configurable: true,
      enumerable: true,
      get() {
        return assignedValue;
      },
      set(val) {
        assignedValue = val;
        stats.assignCount++;
      }
    });
  });

  const url = targetUrl || ('file://' + process.env.TARGET_FILE);
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  await page.waitForFunction(() => {
    const stats = (globalThis as any).__grader_stats__;
    return !!(stats && (
      stats.originalWithCalendarCalled ||
      stats.originalCompareCalled ||
      stats.monthCodeGetterCalled ||
      stats.toLocaleStringCalls.length > 0 ||
      stats.temporalUsed
    ));
  }, { timeout: 5000 }).catch(() => {});

  await page.waitForTimeout(300);

  const stats = await page.evaluate(() => (globalThis as any).__grader_stats__);
  return { stats, polyfillRequested };
}

test.describe('Temporal API Support Grader', () => {
  test.setTimeout(30000);
  
  test('should feature-detect and manually assign the loaded polyfill', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.assignCount).toBeGreaterThan(0);
  });

  test('should conditionally load polyfill only if native support is absent', async ({ page, TARGET_URL }) => {
    const { stats, polyfillRequested } = await setupNativePage(page, TARGET_URL);
    expect(polyfillRequested).toBe(false);
    expect(stats.temporalUsed).toBe(true);
  });

  test('should verify target calendar support using Intl.supportedValuesOf', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.supportedValuesCalls).toContain('calendar');
  });

  test('should use withCalendar to associate non-ISO calendar systems', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.originalWithCalendarCalled).toBe(true);
  });

  test('should use monthCode instead of numeric month for lunisolar calendars', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.monthCodeGetterCalled).toBe(true);
  });

  test('should use monthsInYear as the upper bound when iterating through months', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.monthsInYearGetterCalled).toBe(true);
  });

  test('should use toLocaleString specifying the calendar in locale or options', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const hasLocalizedCalendar = stats.toLocaleStringCalls.some(call => {
      const localesStr = String(call.locales || '');
      return localesStr.includes('-u-ca-') || (call.options && call.options.calendar);
    });
    expect(hasLocalizedCalendar).toBe(true);
  });

  test('should use Temporal.PlainDate.compare to compare dates', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.originalCompareCalled).toBe(true);
  });

  test('should use daysInMonth when checking month invariants or doing day iterations', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.daysInMonthGetterCalled).toBe(true);
  });

  test('should not use legacy Date object for non-Gregorian calculations', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.legacyDateConstructorCalledWithArgs).toBe(false);
  });

  test('should account for era names in systems relying on eras', async ({ page, TARGET_URL }) => {
    await page.goto(TARGET_URL);
    await page.waitForFunction(() => {
      const stats = (globalThis as any).__grader_stats__;
      if (stats && (stats.temporalUsed || stats.originalWithCalendarCalled || stats.toLocaleStringCalls.length > 0)) {
        return true;
      }
      const el = document.getElementById('islamic-date');
      return el && el.innerText !== 'Loading...' && el.innerText !== '';
    }, { timeout: 5000 }).catch(() => {});

    const japaneseCardExists = await page.locator(':text("Japanese")').count() > 0;
    if (japaneseCardExists) {
      const bodyText = await page.textContent('body') || '';
      const hasEra = /Reiwa|Heisei|Showa|Taisho|Meiji/i.test(bodyText);
      expect(hasEra).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
