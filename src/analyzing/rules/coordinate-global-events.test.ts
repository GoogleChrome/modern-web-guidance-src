import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { scanJsSource } from '../scanners/index.ts';
import {
  coordinateGlobalEventsMatcher
} from './coordinate-global-events.ts';

describe('coordinate-global-events rule', () => {
  test('flags legacy getTimezoneOffset() calls in multi-timezone conversions', () => {
    const code = `
      function convertToTargetZone(timestamp, targetTzOffset) {
        const localOffsetMinutes = new Date().getTimezoneOffset();
        const deltaMs = (targetTzOffset - localOffsetMinutes) * 60 * 1000;
        return timestamp + deltaMs;
      }
    `;
    const { matches } = scanJsSource(
      'time/offset.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /getTimezoneOffset/);
  });

  test('flags moment.tz() and moment().tz() conversions', () => {
    const code = `
      function formatInTimezone(timestamp, timeZone) {
        const t1 = moment.tz(timestamp, "America/New_York");
        const t2 = moment(timestamp).tz(timeZone).format();
        return { t1, t2 };
      }
    `;
    const { matches } = scanJsSource(
      'time/moment-tz.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 2);
    assert.match(matches[0].message, /moment\.tz|\.tz\(\)/);
  });

  test('flags chained moment.utc().local() conversions in multi-timezone context', () => {
    const code = `
      function convertUtcToLocal(utcDateString, timeZone) {
        return moment.utc(utcDateString).local().format("YYYY-MM-DD");
      }
    `;
    const { matches } = scanJsSource(
      'time/converter.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /UTC\/local/);
  });

  test('ignores getTimezoneOffset when protected by Temporal feature guard', () => {
    const code = `
      function getOffset(targetTz) {
        if (typeof Temporal === 'undefined') {
          return new Date().getTimezoneOffset() * 60000;
        }
        return 0;
      }
    `;
    const { matches } = scanJsSource(
      'time/guarded.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores single-timezone local offset variables, comments mentioning timezone, and multi-statement local Date/ISO shifts', () => {
    const code = `
      const TIMEZONE_OFFSET = new Date().getTimezoneOffset() * 60 * 1000;
      function getLocalOffset(date) {
        // interested in the date in the same timezone
        const tzOffset = date.getTimezoneOffset() * 60000;
        return new Date(date.getTime() - tzOffset);
      }
      function toLocalIso(d) {
        const offset = d.getTimezoneOffset() * 60000;
        return new Date(Date.now() - offset).toISOString().slice(0, -1);
      }
    `;
    const { matches } = scanJsSource(
      'display/local_offset.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores local ISO string formatting using toISOString()', () => {
    const code = `
      function formatLocalIso(date) {
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString();
      }
    `;
    const { matches } = scanJsSource(
      'time/iso.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores local minute shifting using setMinutes()', () => {
    const code = `
      function adjustLocal(date) {
        date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
        return date;
      }
    `;
    const { matches } = scanJsSource(
      'time/shift.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores relative time / timeAgo calculations', () => {
    const code = `
      function timeAgo(date) {
        const diff = Date.now() - date.getTime() + date.getTimezoneOffset() * 60000;
        return Math.floor(diff / 60000) + ' minutes ago';
      }
    `;
    const { matches } = scanJsSource(
      'time/timeAgo.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores cookie expiration with toUTCString()', () => {
    const code = `
      function setAuthCookie(date) {
        document.cookie = 'token=123; expires=' + new Date(date - date.getTimezoneOffset() * 60000).toUTCString();
      }
    `;
    const { matches } = scanJsSource(
      'auth/cookie.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores generic Date calls not involving timezone offset or moment.tz', () => {
    const code = `
      function getNow() {
        const now = new Date();
        const iso = now.toISOString();
        const time = now.getTime();
        return { iso, time };
      }
    `;
    const { matches } = scanJsSource(
      'time/standard.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores unverified receiver for .tz() and getter without args', () => {
    const code = `
      function checkUser() {
        const zone = user.profile.tz();
        const curZone = moment().tz();
      }
    `;
    const { matches } = scanJsSource(
      'user/profile.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });

  test('ignores bare telemetry assignment or direct return of getTimezoneOffset', () => {
    const code = `
      function collectTelemetry(params) {
        params.tz_offset = new Date().getTimezoneOffset();
        const payload = {
          timezone_offset: new Date().getTimezoneOffset(),
        };
        return new Date().getTimezoneOffset();
      }
    `;
    const { matches } = scanJsSource(
      'analytics/telemetry.js',
      code,
      [coordinateGlobalEventsMatcher]
    );
    assert.equal(matches.length, 0);
  });
});
