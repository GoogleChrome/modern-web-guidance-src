import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const targetFileRaw = process.env.TARGET_FILE || path.join(process.cwd(), 'demo.html');
const targetFile = path.isAbsolute(targetFileRaw) ? targetFileRaw : path.resolve(process.cwd(), targetFileRaw);
const targetDir = path.dirname(targetFile);
const targetFileName = path.basename(targetFile);
const targetUrl = `http://localhost/${targetFileName}`;

let polyfillRequested = false;

test.beforeEach(async ({ page }) => {
  polyfillRequested = false;

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.route('http://localhost/**', async route => {
    const requestPath = decodeURIComponent(new URL(route.request().url()).pathname);
    const relPath = requestPath === '/' ? targetFileName : requestPath.replace(/^\/+/, '');
    const localFilePath = path.resolve(targetDir, relPath);
    if (localFilePath.startsWith(targetDir + path.sep) && fs.existsSync(localFilePath) && fs.statSync(localFilePath).isFile()) {
      await route.fulfill({ path: localFilePath });
    } else {
      await route.continue();
    }
  });

  // Intercept the polyfill request to record if it's requested, but continue
  await page.route('**/@js-temporal/polyfill*', async route => {
    polyfillRequested = true;
    await route.continue();
  });

  // Inject the Temporal spy/interceptor before the page loads
  await page.addInitScript(() => {
    (window as any).__temporalSpies = {
      zonedDateTimeFromCalled: 0,
      plainDateTimeFromCalled: 0,
      plainDateTimeAddCalled: 0,
      withTimeZoneCalled: 0,
      disambiguationOptions: [],
      mutationsAttempted: 0
    };

    let realTemporal = (window as any).__nativeTemporalMock || (typeof (window as any).Temporal !== 'undefined' ? (window as any).Temporal : undefined);
    if (realTemporal) {
      monkeypatchTemporal(realTemporal);
    }

    function monkeypatchTemporal(T: any) {
      if (!T || T.__patched) return;
      T.__patched = true;

      // 1. ZonedDateTime.from
      if (T.ZonedDateTime && typeof T.ZonedDateTime.from === 'function') {
        const originalZonedDateTimeFrom = T.ZonedDateTime.from;
        T.ZonedDateTime.from = function(this: any, ...args: any[]) {
          (window as any).__temporalSpies.zonedDateTimeFromCalled++;
          if (args[1] && args[1].disambiguation) {
            (window as any).__temporalSpies.disambiguationOptions.push(args[1].disambiguation);
          }
          return originalZonedDateTimeFrom.apply(this, args);
        };
      }

      // 2. ZonedDateTime.prototype.withTimeZone
      if (T.ZonedDateTime && T.ZonedDateTime.prototype) {
        const originalWithTimeZone = T.ZonedDateTime.prototype.withTimeZone;
        if (typeof originalWithTimeZone === 'function') {
          T.ZonedDateTime.prototype.withTimeZone = function(this: any, ...args: any[]) {
            (window as any).__temporalSpies.withTimeZoneCalled++;
            return originalWithTimeZone.apply(this, args);
          };
        }
      }

      // 3. PlainDateTime.from and PlainDateTime.prototype.add
      if (T.PlainDateTime && typeof T.PlainDateTime.from === 'function') {
        const originalPlainDateTimeFrom = T.PlainDateTime.from;
        T.PlainDateTime.from = function(this: any, ...args: any[]) {
          (window as any).__temporalSpies.plainDateTimeFromCalled++;
          return originalPlainDateTimeFrom.apply(this, args);
        };
      }
      if (T.PlainDateTime && T.PlainDateTime.prototype && typeof T.PlainDateTime.prototype.add === 'function') {
        const originalPlainDateTimeAdd = T.PlainDateTime.prototype.add;
        T.PlainDateTime.prototype.add = function(this: any, ...args: any[]) {
          (window as any).__temporalSpies.plainDateTimeAddCalled++;
          return originalPlainDateTimeAdd.apply(this, args);
        };
      }

      // 4. Setters for properties on prototypes (to detect direct mutations)
      const propsToTrack = ['year', 'month', 'day', 'hour', 'minute', 'second', 'millisecond', 'microsecond', 'nanosecond'];
      [T.PlainDateTime?.prototype, T.ZonedDateTime?.prototype].forEach(proto => {
        if (!proto) return;
        propsToTrack.forEach(prop => {
          try {
            const desc = Object.getOwnPropertyDescriptor(proto, prop);
            if (desc) {
              Object.defineProperty(proto, prop, {
                configurable: true,
                enumerable: true,
                get: desc.get,
                set(val) {
                  (window as any).__temporalSpies.mutationsAttempted++;
                  if (desc.set) {
                    desc.set.call(this, val);
                  } else {
                    throw new TypeError(`Cannot set property ${prop} of ${this} which has only a getter`);
                  }
                }
              });
            }
          } catch (e) {
            // Silence any non-configurable descriptors if any
          }
        });
      });
    }

    Object.defineProperty(window, 'Temporal', {
      configurable: true,
      enumerable: true,
      get() {
        if ((window as any).__nativeTemporalMock && realTemporal !== (window as any).__nativeTemporalMock) {
          realTemporal = (window as any).__nativeTemporalMock;
          monkeypatchTemporal(realTemporal);
        }
        return realTemporal;
      },
      set(val) {
        if (val) {
          monkeypatchTemporal(val);
        }
        realTemporal = val;
      }
    });
  });
});

test('should conditionally load polyfill only if native support is absent', async ({ page }) => {
  // Inject the native mock BEFORE loading the page so that typeof Temporal !== 'undefined'
  await page.addInitScript(() => {
    const mockZdt = {
      withTimeZone: () => ({
        toString: () => '2025-07-01T14:00:00-04:00[UTC]',
        offset: '+00:00',
        toPlainTime: () => ({ hour: 14, minute: 0, equals: () => true })
      }),
      offset: '+00:00',
      toPlainTime: () => ({ hour: 14, minute: 0, equals: () => true })
    };
    (window as any).__nativeTemporalMock = {
      ZonedDateTime: {
        from: () => mockZdt,
        compare: () => 0,
        prototype: {
          withTimeZone: mockZdt.withTimeZone,
          toPlainTime: mockZdt.toPlainTime
        }
      }
    };
  });

  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  // Assert that polyfill was NOT requested when native Temporal was present
  expect(polyfillRequested).toBe(false);
});

test('should use Temporal.ZonedDateTime as the primary type for scheduling and managing events', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  const spies = await page.evaluate(() => (window as any).__temporalSpies);
  expect(spies.zonedDateTimeFromCalled).toBeGreaterThan(0);
});

test('should NOT use Temporal.PlainDateTime for scheduling global events', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  const spies = await page.evaluate(() => (window as any).__temporalSpies);
  const usedZonedDateTime = spies.zonedDateTimeFromCalled > 0 && spies.withTimeZoneCalled > 0;
  expect(spies.plainDateTimeAddCalled === 0 && (spies.plainDateTimeFromCalled === 0 || usedZonedDateTime)).toBe(true);
});

test('should use disambiguation: reject option in Temporal.ZonedDateTime.from() for conflict detection', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  const spies = await page.evaluate(() => (window as any).__temporalSpies);
  expect(spies.disambiguationOptions).toContain('reject');
});

test('should use the .withTimeZone() method to convert a ZonedDateTime instance to another time zone', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  const spies = await page.evaluate(() => (window as any).__temporalSpies);
  expect(spies.withTimeZoneCalled).toBeGreaterThan(0);
});

test('should NOT attempt to modify Temporal instances directly as they are immutable', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  const spies = await page.evaluate(() => (window as any).__temporalSpies);
  expect(spies.mutationsAttempted).toBe(0);
});

test('should display correct DST-aware converted time for Tokyo', async ({ page }) => {
  await page.goto(targetUrl);
  await page.waitForTimeout(1000);

  // Input meeting details on active DST date (July 1, 2025) at 14:00, host America/New_York
  await page.fill('#dateInput', '2025-07-01');
  await page.fill('#timeInput', '14:00');
  await page.selectOption('#hostTzSelect', 'America/New_York');
  await page.waitForTimeout(500);

  const tokyoCard = page.locator('#grid > *', { hasText: 'Tokyo' }).first();
  const cardText = await tokyoCard.innerText();
  const match = cardText.match(/(\d+:\d+\s*(?:AM|PM))/i);
  const timeStr = match ? match[1].toUpperCase().replace(/\s+/g, '') : '';

  expect(timeStr).toBe('3:00AM');
});
