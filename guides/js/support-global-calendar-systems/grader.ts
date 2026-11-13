import { test, expect } from '../../test-fixture.ts';
import * as fs from 'fs';
import * as path from 'path';

declare const process: any;

function getTargetCode(): string {
  const currentTargetFile = process.env.TARGET_FILE;
  if (!currentTargetFile || !fs.existsSync(currentTargetFile)) return '';
  const currentFilePath = path.resolve(currentTargetFile);
  const visited = new Set<string>();
  const chunks: string[] = [];

  function readRecursive(filePath: string) {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved) || !fs.existsSync(resolved)) return;
    visited.add(resolved);

    const content = fs.readFileSync(resolved, 'utf-8');
    // Skip large vendored polyfill bundles so polyfill internals don't trip source checks.
    if (
      resolved !== currentFilePath &&
      (/polyfill|vendor/i.test(resolved) || content.length >= 100_000)
    ) {
      return;
    }
    chunks.push(content);

    const dir = path.dirname(resolved);
    const refs = [
      ...[...content.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]),
      ...[...content.matchAll(/(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["'](\.[^"']+)["']/g)].map(m => m[1]),
      ...[...content.matchAll(/import\s*\(\s*["'](\.[^"']+)["']\s*\)/g)].map(m => m[1]),
    ];
    for (const ref of refs) {
      if (!ref.startsWith('http') && !ref.startsWith('//')) {
        const candidate = ref.startsWith('/')
          ? path.join(path.dirname(currentFilePath), ref.slice(1))
          : path.join(dir, ref);
        readRecursive(candidate);
      }
    }
  }

  readRecursive(currentFilePath);
  return chunks.join('\n');
}

interface GraderStats {
  assignCount: number;
  hasGlobalTemporal: boolean;
  polyfillLoaded: boolean;
  localPolyfillLoaded: boolean;
  renderedCalendarOutput: boolean;
  originalWithCalendarCalled: boolean;
  originalCompareCalled: boolean;
  monthCodeGetterCalled: boolean;
  monthsInYearGetterCalled: boolean;
  daysInMonthGetterCalled: boolean;
  toLocaleStringCalls: { locales: any; options: any }[];
  supportedValuesCalls: string[];
  legacyDateConstructorCalledWithArgs: boolean;
  legacyDateCallStacks?: string[];
  temporalUsed: boolean;
  requestedScripts?: string[];
}

function isLocalPolyfillContent(localFilePath: string, content: string): boolean {
  return (
    /\.m?js$/i.test(localFilePath) &&
    content.includes('Temporal') &&
    (content.length > 50_000 || /polyfill/i.test(path.basename(localFilePath)))
  );
}

async function handleLocalhostRoute(
  page: any,
  targetUrl?: string,
  onLocalFileServed?: (localFilePath: string, content: string) => void
) {
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
        if (onLocalFileServed && /\.m?js$/i.test(localFilePath)) {
          onLocalFileServed(localFilePath, fs.readFileSync(localFilePath, 'utf-8'));
        }
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
  let cdnPolyfillLoaded = false;
  let localPolyfillLoaded = false;
  const localPolyfillBasenames = new Set<string>();
  const requestedScripts = new Set<string>();
  let hasUncaughtPageError = false;
  page.on('request', (req: any) => {
    if (req.resourceType() === 'script') {
      requestedScripts.add(req.url());
    }
  });
  page.on('pageerror', () => {
    hasUncaughtPageError = true;
  });

  await page.addInitScript(() => {
    const stats: GraderStats = {
      assignCount: 0,
      hasGlobalTemporal: false,
      polyfillLoaded: false,
      localPolyfillLoaded: false,
      renderedCalendarOutput: false,
      originalWithCalendarCalled: false,
      originalCompareCalled: false,
      monthCodeGetterCalled: false,
      monthsInYearGetterCalled: false,
      daysInMonthGetterCalled: false,
      toLocaleStringCalls: [],
      supportedValuesCalls: [],
      legacyDateConstructorCalledWithArgs: false,
      legacyDateCallStacks: [],
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
            stats.legacyDateCallStacks?.push(stack);
          }
        }
        return Reflect.construct(target, args);
      }
    });
    globalThis.Date = dateProxy;

    function spyOnTemporal(val: any) {
      if (val && typeof val === 'object') {
        const spyOnMethod = (targetObj: any, prop: string, callback: (...args: any[]) => void) => {
          let curr = targetObj;
          while (curr && curr !== Object.prototype) {
            if (Object.prototype.hasOwnProperty.call(curr, prop) || typeof curr[prop] === 'function') {
              const origFn = curr[prop];
              if (typeof origFn === 'function') {
                curr[prop] = function(...args: any[]) {
                  const res = origFn.apply(this, args);
                  callback(...args);
                  return res;
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

        if (val.Now) {
          spyOnMethod(val.Now, 'plainDateISO', () => {
            stats.temporalUsed = true;
          });
        }

        if (val.PlainDate) {
          spyOnMethod(val.PlainDate, 'from', () => {
            stats.temporalUsed = true;
          });

          if (val.PlainDate.prototype) {
            spyOnMethod(val.PlainDate.prototype, 'withCalendar', () => {
              stats.temporalUsed = true;
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
            stats.temporalUsed = true;
            stats.originalCompareCalled = true;
          });
        }
      }
    }

    (globalThis as any).__spyOnTemporal = spyOnTemporal;

    // Remove native Temporal so `'Temporal' in globalThis` is false and polyfill loading is exercised.
    delete (globalThis as any).Temporal;
  });

  await page.route(/^https?:\/\/.*(?:@js-temporal\/polyfill|temporal-polyfill).*/i, async (route: any) => {
    cdnPolyfillLoaded = true;
    const mockPolyfillEsm = `
      class PlainDate {
        constructor(y = 2026, m = 5, d = 15, calId = 'iso8601') {
          this._cal = calId;
          this._y = y;
          this._m = m;
          this._d = d;
        }
        get calendarId() { return this._cal; }
        get year() { return this._y; }
        get month() { return this._m; }
        get day() { return this._d; }
        get monthCode() { return 'M' + String(this._m).padStart(2, '0'); }
        get monthsInYear() { return 12; }
        get daysInMonth() { return 30; }
        get inLeapYear() { return false; }
        get era() { return this._cal === 'japanese' ? 'reiwa' : undefined; }
        get eraYear() { return this._cal === 'japanese' ? 8 : undefined; }
        toString() {
          return String(this._y).padStart(4, '0') + '-' + String(this._m).padStart(2, '0') + '-' + String(this._d).padStart(2, '0');
        }
        add() { return this; }
        subtract() { return this; }
        withCalendar(newCal) {
          if (typeof newCal !== 'string' && !(newCal instanceof PlainDate)) {
            throw new TypeError('Temporal error: Calendar must be string or calendared Temporal object.');
          }
          const id = typeof newCal === 'string' ? newCal : newCal.calendarId;
          return new PlainDate(this._y, this._m, this._d, id);
        }
        with(fields) {
          return new PlainDate(
            fields?.year ?? this._y,
            fields?.month ?? this._m,
            fields?.day ?? this._d,
            this._cal
          );
        }
        toLocaleString(locales, options) {
          const loc = String(locales || '');
          if (this._cal === 'japanese' || loc.includes('japanese') || options?.calendar === 'japanese') {
            return 'May 15, Reiwa 8';
          }
          return '1447 AH';
        }
        toPlainYearMonth() {
          return { year: this._y, month: this._m, monthCode: this.monthCode, daysInMonth: 30 };
        }
      }

      const T = {
        Now: {
          plainDateISO() { return new PlainDate(2026, 5, 15, 'iso8601'); }
        },
        PlainDate: Object.assign(PlainDate, {
          from(val) {
            if (val instanceof PlainDate) {
              return new PlainDate(val.year, val.month, val.day, val.calendarId);
            }
            if (typeof val === 'string') {
              const calMatch = val.match(/\\[u-ca=([^\\]]+)\\]/i);
              const parsedCal = calMatch ? calMatch[1] : 'iso8601';
              const m = val.match(/^(\\d{4})-(\\d{2})-(\\d{2})/);
              if (m) return new PlainDate(+m[1], +m[2], +m[3], parsedCal);
            }
            if (typeof val === 'object' && val !== null && val.calendar !== undefined) {
              if (typeof val.calendar !== 'string' && !(val.calendar instanceof PlainDate)) {
                throw new TypeError('Temporal error: Calendar must be string or calendared Temporal object.');
              }
            }
            const calId = typeof val === 'object' && val?.calendar
              ? (typeof val.calendar === 'string' ? val.calendar : val.calendar.calendarId)
              : 'iso8601';
            return new PlainDate(val?.year ?? 2026, val?.month ?? 5, val?.day ?? 15, calId);
          },
          compare() { return 0; }
        })
      };

      if (typeof globalThis !== 'undefined' && globalThis.__spyOnTemporal) {
        globalThis.__spyOnTemporal(T);
      }

      export const Temporal = T;
      export default { Temporal: T };
    `;

    await route.fulfill({
      contentType: 'application/javascript',
      body: mockPolyfillEsm
    });
  });

  await handleLocalhostRoute(page, targetUrl, (localFilePath, content) => {
    if (isLocalPolyfillContent(localFilePath, content)) {
      localPolyfillLoaded = true;
      localPolyfillBasenames.add(path.basename(localFilePath));
    }
  });

  const url = targetUrl || ('file://' + process.env.TARGET_FILE);
  await page.goto(url);
  await page.waitForLoadState('load');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page
    .waitForFunction(
      () => {
        const text = document.getElementById('islamic-date')?.textContent?.trim() || '';
        return Boolean(
          text && !/^(?:loading\.{0,3}|calculating\.{0,3}|[-–—]+|\.{2,3}|…)$/i.test(text)
        );
      },
      undefined,
      { timeout: 400 }
    )
    .catch(() => {});

  const pageData = await page.evaluate(() => {
    const stats = (globalThis as any).__grader_stats__;
    const islamic = document.getElementById('islamic-date')?.textContent?.trim() || '';
    const isPlaceholder = /^(?:loading\.{0,3}|calculating\.{0,3}|[-–—]+|\.{2,3}|…)$/i.test(islamic);
    const isErrorText =
      /^(?:null|n\/a)$/i.test(islamic) ||
      /\b(?:error|failed|unavailable|unsupported|not supported|invalid|undefined|nan|typeerror|referenceerror|rangeerror|syntaxerror|temporal error|cannot read propert(?:y|ies)|is not a function|is not defined)\b/i.test(islamic);
    const renderedCalendarOutput = Boolean(islamic && !isPlaceholder && !isErrorText);
    return {
      stats,
      hasGlobalTemporal: typeof (globalThis as any).Temporal !== 'undefined',
      renderedCalendarOutput
    };
  });

  const legacyDateConstructorCalledWithArgs = (pageData.stats.legacyDateCallStacks || []).some(
    (stack: string) => ![...localPolyfillBasenames].some(name => stack.includes(name))
  );

  return {
    ...pageData.stats,
    legacyDateConstructorCalledWithArgs,
    hasGlobalTemporal: pageData.hasGlobalTemporal,
    polyfillLoaded: cdnPolyfillLoaded || localPolyfillLoaded,
    localPolyfillLoaded,
    renderedCalendarOutput: pageData.renderedCalendarOutput && !hasUncaughtPageError,
    requestedScripts: [...requestedScripts]
  };
}

async function setupNativePage(
  page: any,
  targetUrl?: string
): Promise<{ stats: GraderStats; polyfillRequested: boolean; requestedScripts: string[] }> {
  let polyfillRequested = false;
  const requestedScripts = new Set<string>();
  page.on('request', (req: any) => {
    if (req.resourceType() === 'script') {
      requestedScripts.add(req.url());
    }
  });

  await page.route('**/*', async (route: any) => {
    const url = route.request().url();
    if (url.includes('temporal-polyfill') || url.includes('@js-temporal/polyfill')) {
      polyfillRequested = true;
    }
    await route.continue();
  });

  await handleLocalhostRoute(page, targetUrl, (localFilePath, content) => {
    if (isLocalPolyfillContent(localFilePath, content)) {
      polyfillRequested = true;
    }
  });

  await page.addInitScript(() => {
    const stats: GraderStats = {
      assignCount: 0,
      hasGlobalTemporal: false,
      polyfillLoaded: false,
      localPolyfillLoaded: false,
      renderedCalendarOutput: false,
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
            calendarId: 'iso8601',
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
            withCalendar(calInput: any) {
              const cal = typeof calInput === 'string'
                ? calInput
                : (calInput && typeof calInput === 'object' && typeof calInput.calendarId === 'string'
                    ? calInput.calendarId
                    : '');
              if (!cal) {
                throw new TypeError('Temporal error: Calendar must be string or calendared Temporal object.');
              }
              stats.originalWithCalendarCalled = true;
              return {
                calendarId: cal,
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
            year: 2026,
            month: 5,
            monthCode: 'M05',
            monthsInYear: 12,
            daysInMonth: 31,
            add(_duration: any) { return this; },
            subtract(_duration: any) { return this; },
            withCalendar(calInput: any) {
              const cal = typeof calInput === 'string'
                ? calInput
                : (calInput && typeof calInput === 'object' && typeof calInput.calendarId === 'string'
                    ? calInput.calendarId
                    : '');
              if (!cal) {
                throw new TypeError('Temporal error: Calendar must be string or calendared Temporal object.');
              }
              stats.originalWithCalendarCalled = true;
              return {
                calendarId: cal,
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
  await page.waitForLoadState('load');
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page
    .waitForFunction(
      () => {
        const text = document.getElementById('islamic-date')?.textContent?.trim() || '';
        return Boolean(
          (globalThis as any).__grader_stats__?.temporalUsed ||
            (text && !/^(?:loading\.{0,3}|calculating\.{0,3}|[-–—]+|\.{2,3}|…)$/i.test(text))
        );
      },
      undefined,
      { timeout: 400 }
    )
    .catch(() => {});

  const stats = await page.evaluate(() => (globalThis as any).__grader_stats__);
  return { stats, polyfillRequested, requestedScripts: [...requestedScripts] };
}

function usedLocalPolyfillRuntime(stats: GraderStats): boolean {
  return stats.localPolyfillLoaded && stats.renderedCalendarOutput;
}

test.describe('Temporal API Support Grader', () => {
  test.setTimeout(30000);

  test('The implementation feature-detects Temporal and assigns the loaded polyfill to `globalThis.Temporal`.', async ({ page, browser, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    let hasDynamicPolyfill = false;
    if (stats.hasGlobalTemporal) {
      const nativeContext = await browser.newContext();
      const nativePage = await nativeContext.newPage();
      try {
        const { requestedScripts: nativeScripts } = await setupNativePage(nativePage, TARGET_URL);
        const nativeSet = new Set(nativeScripts);
        hasDynamicPolyfill = (stats.requestedScripts || []).some(url => !nativeSet.has(url));
      } finally {
        await nativeContext.close();
      }
    }
    expect(hasDynamicPolyfill && stats.hasGlobalTemporal).toBe(true);
  });

  test('The implementation conditionally loads a Temporal polyfill only if native support is absent.', async ({ page, TARGET_URL }) => {
    const { stats, polyfillRequested } = await setupNativePage(page, TARGET_URL);
    expect(polyfillRequested).toBe(false);
    expect(stats.temporalUsed).toBe(true);
  });

  test('The implementation verifies target calendar support using `Intl.supportedValuesOf(\'calendar\')`.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedSupportedValues = stats.supportedValuesCalls.includes('calendar')
      || (usedLocalPolyfillRuntime(stats) && /supportedValuesOf\s*\(\s*['"]calendar['"]\s*\)/.test(code));
    expect(usedSupportedValues).toBe(true);
  });

  test('The implementation uses `withCalendar()` to associate non-ISO calendar systems.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedWithCalendar = stats.originalWithCalendarCalled
      || (usedLocalPolyfillRuntime(stats) && /\.withCalendar\s*\(/.test(code));
    expect(usedWithCalendar).toBe(true);
  });

  test('The implementation uses `monthCode` instead of numeric month for lunisolar calendars.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedMonthCode = stats.monthCodeGetterCalled
      || (usedLocalPolyfillRuntime(stats) && /\.monthCode\b/.test(code));
    expect(usedMonthCode).toBe(true);
  });

  test('The implementation uses `monthsInYear` as the upper bound when iterating through months.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedMonthsInYear = stats.monthsInYearGetterCalled
      || (usedLocalPolyfillRuntime(stats) && /\.monthsInYear\b/.test(code));
    expect(usedMonthsInYear).toBe(true);
  });

  test('The implementation uses `toLocaleString()` specifying the calendar in locale or options.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const hasRuntimeLocales = stats.toLocaleStringCalls.some(call => {
      const localesStr = String(call.locales || '');
      return localesStr.includes('-u-ca-') || (call.options && call.options.calendar);
    });
    const hasCodeLocales = usedLocalPolyfillRuntime(stats)
      && /\.toLocaleString\s*\(/.test(code)
      && (/-u-ca-/.test(code) || /calendar\s*:/.test(code) || /dateStyle/.test(code));
    expect(hasRuntimeLocales || hasCodeLocales).toBe(true);
  });

  test('The implementation uses `Temporal.PlainDate.compare()` to compare dates.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedCompare = stats.originalCompareCalled
      || (usedLocalPolyfillRuntime(stats) && (/PlainDate\.compare\b/.test(code) || /Temporal\.compare\b/.test(code)));
    expect(usedCompare).toBe(true);
  });

  test('The implementation uses `daysInMonth` when checking month invariants or doing day iterations.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usedDaysInMonth = stats.daysInMonthGetterCalled
      || (usedLocalPolyfillRuntime(stats) && /\.daysInMonth\b/.test(code));
    expect(usedDaysInMonth).toBe(true);
  });

  test('The implementation uses `Temporal` instead of the legacy `Date` object for non-Gregorian calculations.', async ({ page, TARGET_URL }) => {
    const stats = await setupNormalPage(page, TARGET_URL);
    const code = getTargetCode();
    const usesTemporal = stats.temporalUsed
      || (usedLocalPolyfillRuntime(stats) && (/\bTemporal\./.test(code) || /\bPlainDate\.from\b/.test(code)));
    expect(usesTemporal).toBe(true);
    expect(stats.legacyDateConstructorCalledWithArgs).toBe(false);
  });

  test('The implementation accounts for era names in systems relying on eras.', async ({ page, TARGET_URL }) => {
    await handleLocalhostRoute(page, TARGET_URL);
    const url = TARGET_URL || ('file://' + process.env.TARGET_FILE);
    await page.goto(url);
    await page.waitForLoadState('load');
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));

    const bodyText = await page.textContent('body') || '';
    const code = getTargetCode();
    const hasEra = /Reiwa|Heisei|Showa|Taisho|Meiji|令和|平成|昭和|大正|明治/i.test(bodyText)
      || /era\s*:\s*['"](?:long|short|narrow)['"]/i.test(code)
      || /\beraYear\b/.test(code);
    expect(hasEra).toBe(true);
  });
});
