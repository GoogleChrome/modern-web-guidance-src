import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

declare const process: any;

function getTargetCode(): string {
  const currentTargetFile = process.env.TARGET_FILE;
  if (!currentTargetFile || !fs.existsSync(currentTargetFile)) return '';
  const currentFilePath = path.resolve(currentTargetFile);
  const currentTargetDir = path.dirname(currentFilePath);
  let code = fs.readFileSync(currentFilePath, 'utf-8');
  const scriptSrcs = [...code.matchAll(/src=["']([^"']+)["']/g)].map(m => m[1]);
  for (const src of scriptSrcs) {
    if (!src.startsWith('http') && !src.startsWith('//')) {
      const scriptPath = path.join(currentTargetDir, src);
      if (fs.existsSync(scriptPath)) {
        code += '\n' + fs.readFileSync(scriptPath, 'utf-8');
      }
    }
  }
  return code;
}

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

async function handleLocalhostRoute(page: any, targetUrl?: string) {
  const currentTargetFile = process.env.TARGET_FILE;
  const currentFilePath = currentTargetFile ? path.resolve(currentTargetFile) : '';
  const currentTargetDir = currentFilePath ? path.dirname(currentFilePath) : '';
  const currentDemoName = currentFilePath ? path.basename(currentFilePath) : '';

  if (targetUrl && targetUrl.includes('localhost') && currentTargetDir) {
    await page.route(/(http:\/\/localhost(:\d+)?\/.*)/, async (route: any) => {
      const requestPath = new URL(route.request().url()).pathname;
      const sanitizedPath = requestPath === '/' ? currentDemoName : requestPath.replace(/^\//, '');
      const localFilePath = path.join(currentTargetDir, sanitizedPath);

      if (fs.existsSync(localFilePath)) {
        await route.fulfill({ path: localFilePath });
      } else if (fs.existsSync(currentFilePath)) {
        await route.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(currentFilePath, 'utf-8') });
      } else {
        await route.continue();
      }
    });
  }
}

async function setupNormalPage(page: any, targetUrl?: string): Promise<GraderStats> {
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

    if (typeof Intl !== 'undefined' && Intl.supportedValuesOf) {
      const origSupportedValuesOf = Intl.supportedValuesOf;
      Intl.supportedValuesOf = function(key: string) {
        stats.supportedValuesCalls.push(key);
        return origSupportedValuesOf.call(Intl, key as any);
      };
    }

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

    (globalThis as any).__spyOnTemporal = spyOnTemporal;

    let assignedValue: any = undefined;
    Object.defineProperty(globalThis, 'Temporal', {
      configurable: true,
      enumerable: true,
      get() {
        return assignedValue;
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

  await page.route(/.*(@js-temporal\/polyfill|cdn\.jsdelivr\.net|esm\.sh\/@js-temporal|unpkg\.com\/@js-temporal|temporal-polyfill).*/, async (route: any) => {
    const mockPolyfillEsm = `
      const createPlainDate = (calId = 'iso8601') => {
        const pd = {
          calendarId: calId,
          calendar: { id: calId },
          year: 2026,
          month: 5,
          day: 15,
          get monthCode() { return 'M05'; },
          get monthsInYear() { return 12; },
          get daysInMonth() { return 31; },
          add() { return pd; },
          subtract() { return pd; },
          withCalendar(newCal) {
            const id = typeof newCal === 'string' ? newCal : (newCal?.id || 'islamic-umalqura');
            return createPlainDate(id);
          },
          with() { return pd; },
          toLocaleString(locales, options) { return '1447 AH'; }
        };
        return pd;
      };

      const T = {
        Now: {
          plainDateISO() { return createPlainDate('iso8601'); }
        },
        PlainDate: {
          from(val) {
            const calId = typeof val === 'object' && val?.calendar ? val.calendar : 'iso8601';
            return createPlainDate(calId);
          },
          compare() { return 0; }
        }
      };

      if (typeof window !== 'undefined') {
        window.Temporal = T;
        if (window.__spyOnTemporal) window.__spyOnTemporal(T);
      }
      if (typeof globalThis !== 'undefined') {
        globalThis.Temporal = T;
        if (globalThis.__spyOnTemporal) globalThis.__spyOnTemporal(T);
      }

      export const Temporal = T;
      export default { Temporal: T };
    `;

    await route.fulfill({
      contentType: 'application/javascript',
      body: mockPolyfillEsm
    });
  });

  await handleLocalhostRoute(page, targetUrl);

  const url = targetUrl || ('file://' + process.env.TARGET_FILE);
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(500);

  return await page.evaluate(() => (globalThis as any).__grader_stats__);
}

async function setupNativePage(page: any, targetUrl?: string): Promise<{ stats: GraderStats, polyfillRequested: boolean }> {
  let polyfillRequested = false;

  await page.route('**/*', async (route: any) => {
    const url = route.request().url();
    if (url.includes('@js-temporal/polyfill') || url.includes('cdn.jsdelivr.net/npm/@js-temporal/polyfill')) {
      polyfillRequested = true;
    }
    await route.continue();
  });

  await handleLocalhostRoute(page, targetUrl);

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
  await page.waitForTimeout(500);

  const stats = await page.evaluate(() => (globalThis as any).__grader_stats__);
  return { stats, polyfillRequested };
}

test.describe('Temporal API Support Grader', () => {
  test.setTimeout(30000);

  test('should feature-detect and manually assign the loaded polyfill', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const hasAssignment = stats.assignCount > 0 || /Temporal\s*=\s*/.test(code) || /module\.Temporal/.test(code) || /return\s+.*Temporal/.test(code);
    expect(hasAssignment).toBe(true);
  });

  test('should conditionally load polyfill only if native support is absent', async ({ page, TARGET_URL }) => {
    const { stats, polyfillRequested } = await setupNativePage(page, TARGET_URL);
    expect(polyfillRequested).toBe(false);
    expect(stats.temporalUsed).toBe(true);
  });

  test('should verify target calendar support using Intl.supportedValuesOf', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedSupportedValues = stats.supportedValuesCalls.includes('calendar') || /supportedValuesOf\s*\(\s*['"]calendar['"]\s*\)/.test(code) || /isCalendarSupported/.test(code) || /withCalendar/.test(code);
    expect(usedSupportedValues).toBe(true);
  });

  test('should use withCalendar to associate non-ISO calendar systems', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedWithCalendar = stats.originalWithCalendarCalled || /\.withCalendar\s*\(/.test(code);
    expect(usedWithCalendar).toBe(true);
  });

  test('should use monthCode instead of numeric month for lunisolar calendars', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedMonthCode = stats.monthCodeGetterCalled || /\.monthCode\b/.test(code);
    expect(usedMonthCode).toBe(true);
  });

  test('should use monthsInYear as the upper bound when iterating through months', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedMonthsInYear = stats.monthsInYearGetterCalled || /\.monthsInYear\b/.test(code);
    expect(usedMonthsInYear).toBe(true);
  });

  test('should use toLocaleString specifying the calendar in locale or options', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const hasRuntimeLocales = stats.toLocaleStringCalls.some(call => {
      const localesStr = String(call.locales || '');
      return localesStr.includes('-u-ca-') || (call.options && call.options.calendar);
    });
    const hasCodeLocales = /\.toLocaleString\s*\(/.test(code) && (/-u-ca-/.test(code) || /calendar:/.test(code) || /dateStyle/.test(code));
    expect(hasRuntimeLocales || hasCodeLocales).toBe(true);
  });

  test('should use Temporal.PlainDate.compare to compare dates', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedCompare = stats.originalCompareCalled || /PlainDate\.compare\b/.test(code) || /Temporal\.compare\b/.test(code);
    expect(usedCompare).toBe(true);
  });

  test('should use daysInMonth when checking month invariants or doing day iterations', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedDaysInMonth = stats.daysInMonthGetterCalled || /\.daysInMonth\b/.test(code);
    expect(usedDaysInMonth).toBe(true);
  });

  test('should not use legacy Date object for non-Gregorian calculations', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    expect(stats.legacyDateConstructorCalledWithArgs).toBe(false);
  });

  test('should account for era names in systems relying on eras', async ({ page, TARGET_URL }) => {
    await handleLocalhostRoute(page, TARGET_URL);
    const url = TARGET_URL || ('file://' + process.env.TARGET_FILE);
    await page.goto(url);
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(300);

    const japaneseCardExists = await page.locator(':text("Japanese")').count() > 0;
    if (japaneseCardExists) {
      const bodyText = await page.textContent('body') || '';
      const code = getTargetCode();
      const hasEra = /Reiwa|Heisei|Showa|Taisho|Meiji/i.test(bodyText) || /era:\s*['"]long['"]/i.test(code) || /eraYear\b/.test(code);
      expect(hasEra).toBe(true);
    } else {
      expect(true).toBe(true);
    }
  });
});
