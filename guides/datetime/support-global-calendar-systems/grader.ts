import { test, expect } from '@playwright/test';

declare const process: any;

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

async function setupNormalPage(page: any): Promise<GraderStats> {
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
        
        if (val.PlainDate) {
          if (val.PlainDate.prototype && val.PlainDate.prototype.withCalendar) {
            const origWithCalendar = val.PlainDate.prototype.withCalendar;
            val.PlainDate.prototype.withCalendar = function(...args: any[]) {
              stats.originalWithCalendarCalled = true;
              return origWithCalendar.apply(this, args);
            };
          }

          if (val.PlainDate.compare) {
            const origCompare = val.PlainDate.compare;
            val.PlainDate.compare = function(...args: any[]) {
              stats.originalCompareCalled = true;
              return origCompare.apply(this, args);
            };
          }

          if (val.PlainDate.prototype) {
            const descMonthCode = Object.getOwnPropertyDescriptor(val.PlainDate.prototype, 'monthCode');
            if (descMonthCode && descMonthCode.get) {
              const origGet = descMonthCode.get;
              Object.defineProperty(val.PlainDate.prototype, 'monthCode', {
                configurable: true,
                get() {
                  stats.monthCodeGetterCalled = true;
                  return origGet.call(this);
                }
              });
            }

            const descMonthsInYear = Object.getOwnPropertyDescriptor(val.PlainDate.prototype, 'monthsInYear');
            if (descMonthsInYear && descMonthsInYear.get) {
              const origGet = descMonthsInYear.get;
              Object.defineProperty(val.PlainDate.prototype, 'monthsInYear', {
                configurable: true,
                get() {
                  stats.monthsInYearGetterCalled = true;
                  return origGet.call(this);
                }
              });
            }

            const descDaysInMonth = Object.getOwnPropertyDescriptor(val.PlainDate.prototype, 'daysInMonth');
            if (descDaysInMonth && descDaysInMonth.get) {
              const origGet = descDaysInMonth.get;
              Object.defineProperty(val.PlainDate.prototype, 'daysInMonth', {
                configurable: true,
                get() {
                  stats.daysInMonthGetterCalled = true;
                  return origGet.call(this);
                }
              });
            }

            if (val.PlainDate.prototype.toLocaleString) {
              const origToLocaleString = val.PlainDate.prototype.toLocaleString;
              val.PlainDate.prototype.toLocaleString = function(locales: any, options: any) {
                stats.toLocaleStringCalls.push({ locales, options });
                return origToLocaleString.call(this, locales, options);
              };
            }
          }
        }
      }
    }

    let assignedValue: any = undefined;
    Object.defineProperty(globalThis, 'Temporal', {
      configurable: true,
      enumerable: true,
      get() {
        return assignedValue;
      },
      set(val) {
        spyOnTemporal(val);
        assignedValue = val;
        stats.assignCount++;
      }
    });
  });

  // Intercept js-temporal polyfill requests to dynamically inject our ESM spies wrapper!
  await page.route(/.*\/@js-temporal\/polyfill(@[0-9.]+)?$/, async (route: any) => {
    const reqUrl = route.request().url();
    const targetUrlWithParam = reqUrl.includes('?') ? `${reqUrl}&bypass=true` : `${reqUrl}?bypass=true`;
    
    const wrapperScript = `
      import * as realModule from '${targetUrlWithParam}';
      
      const stats = (globalThis || window).__grader_stats__;
      const Temporal = realModule.Temporal;
      
      if (stats && Temporal) {
        stats.temporalUsed = true;
        
        if (Temporal.PlainDate) {
          if (Temporal.PlainDate.prototype && Temporal.PlainDate.prototype.withCalendar) {
            const origWithCalendar = Temporal.PlainDate.prototype.withCalendar;
            Temporal.PlainDate.prototype.withCalendar = function(...args) {
              stats.originalWithCalendarCalled = true;
              return origWithCalendar.apply(this, args);
            };
          }
          if (Temporal.PlainDate.compare) {
            const origCompare = Temporal.PlainDate.compare;
            Temporal.PlainDate.compare = function(...args) {
              stats.originalCompareCalled = true;
              return origCompare.apply(this, args);
            };
          }
          
          const descMonthCode = Object.getOwnPropertyDescriptor(Temporal.PlainDate.prototype, 'monthCode');
          if (descMonthCode && descMonthCode.get) {
            const origGet = descMonthCode.get;
            Object.defineProperty(Temporal.PlainDate.prototype, 'monthCode', {
              configurable: true,
              get() {
                stats.monthCodeGetterCalled = true;
                return origGet.call(this);
              }
            });
          }
          
          const descMonthsInYear = Object.getOwnPropertyDescriptor(Temporal.PlainDate.prototype, 'monthsInYear');
          if (descMonthsInYear && descMonthsInYear.get) {
            const origGet = descMonthsInYear.get;
            Object.defineProperty(Temporal.PlainDate.prototype, 'monthsInYear', {
              configurable: true,
              get() {
                stats.monthsInYearGetterCalled = true;
                return origGet.call(this);
              }
            });
          }
          
          const descDaysInMonth = Object.getOwnPropertyDescriptor(Temporal.PlainDate.prototype, 'daysInMonth');
          if (descDaysInMonth && descDaysInMonth.get) {
            const origGet = descDaysInMonth.get;
            Object.defineProperty(Temporal.PlainDate.prototype, 'daysInMonth', {
              configurable: true,
              get() {
                stats.daysInMonthGetterCalled = true;
                return origGet.call(this);
              }
            });
          }
          
          if (Temporal.PlainDate.prototype.toLocaleString) {
            const origToLocaleString = Temporal.PlainDate.prototype.toLocaleString;
            Temporal.PlainDate.prototype.toLocaleString = function(locales, options) {
              stats.toLocaleStringCalls.push({ locales, options });
              return origToLocaleString.call(this, locales, options);
            };
          }
        }
        
        // Dynamically reassign to window/globalThis to satisfy global test assumptions
        globalThis.Temporal = Temporal;
      }
      
      export * from '${targetUrlWithParam}';
      export { Temporal };
    `;
    
    await route.fulfill({
      contentType: 'application/javascript',
      body: wrapperScript
    });
  });

  const url = 'file://' + process.env.TARGET_FILE;
  await page.goto(url);

  // Wait for the UI to be fully updated
  await page.waitForFunction(() => {
    const el = document.getElementById('islamic-date');
    return el && el.innerText !== 'Loading...' && el.innerText !== '';
  }, { timeout: 3000 }).catch(() => {});

  // Return the stats from the browser context
  return await page.evaluate(() => (globalThis as any).__grader_stats__);
}

async function setupNativePage(page: any): Promise<{ stats: GraderStats, polyfillRequested: boolean }> {
  let polyfillRequested = false;
  await page.route('**/*', (route: any) => {
    const url = route.request().url();
    if (url.includes('@js-temporal/polyfill')) {
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

  const url = 'file://' + process.env.TARGET_FILE;
  await page.goto(url);

  await page.waitForFunction(() => {
    const el = document.getElementById('islamic-date');
    return el && el.innerText !== 'Loading...' && el.innerText !== '';
  }, { timeout: 3000 }).catch(() => {});

  const stats = await page.evaluate(() => (globalThis as any).__grader_stats__);
  return { stats, polyfillRequested };
}

test.describe('Temporal API Support Grader', () => {
  
  test('should feature-detect and manually assign the loaded polyfill', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.assignCount).toBeGreaterThan(0);
  });

  test('should conditionally load polyfill only if native support is absent', async ({ page }) => {
    const { stats, polyfillRequested } = await setupNativePage(page);
    expect(polyfillRequested).toBe(false);
    expect(stats.temporalUsed).toBe(true);
  });

  test('should verify target calendar support using Intl.supportedValuesOf', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.supportedValuesCalls).toContain('calendar');
  });

  test('should use withCalendar to associate non-ISO calendar systems', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.originalWithCalendarCalled).toBe(true);
  });

  test('should use monthCode instead of numeric month for lunisolar calendars', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.monthCodeGetterCalled).toBe(true);
  });

  test('should use monthsInYear as the upper bound when iterating through months', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.monthsInYearGetterCalled).toBe(true);
  });

  test('should use toLocaleString specifying the calendar in locale or options', async ({ page }) => {
    const stats = await setupNormalPage(page);
    const hasLocalizedCalendar = stats.toLocaleStringCalls.some(call => {
      const localesStr = String(call.locales || '');
      return localesStr.includes('-u-ca-') || (call.options && call.options.calendar);
    });
    expect(hasLocalizedCalendar).toBe(true);
  });

  test('should use Temporal.PlainDate.compare to compare dates', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.originalCompareCalled).toBe(true);
  });

  test('should use daysInMonth when checking month invariants or doing day iterations', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.daysInMonthGetterCalled).toBe(true);
  });

  test('should not use legacy Date object for non-Gregorian calculations', async ({ page }) => {
    const stats = await setupNormalPage(page);
    expect(stats.legacyDateConstructorCalledWithArgs).toBe(false);
  });

  test('should account for era names in systems relying on eras', async ({ page }) => {
    await page.goto('file://' + process.env.TARGET_FILE);
    await page.waitForFunction(() => {
      const el = document.getElementById('islamic-date');
      return el && el.innerText !== 'Loading...' && el.innerText !== '';
    }, { timeout: 3000 }).catch(() => {});

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
