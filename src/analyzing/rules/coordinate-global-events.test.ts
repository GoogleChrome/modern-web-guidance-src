import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import { createInMemoryProject, scanJsSource } from '../scanners/index.ts';
import {
  COORDINATE_GLOBAL_EVENTS_GUIDE_HASH,
  coordinateGlobalEventsMatcher,
  coordinateGlobalEventsRule,
  coordinateGlobalEventsRules,
} from './coordinate-global-events.ts';

describe('coordinate-global-events rule', () => {
  const project = createInMemoryProject();

  test('has correct metadata and 12-char guideHash', () => {
    assert.equal(coordinateGlobalEventsRule.id, 'coordinate-global-events');
    assert.equal(coordinateGlobalEventsRule.guideId, 'coordinate-global-events');
    assert.equal(coordinateGlobalEventsRule.guideHash, COORDINATE_GLOBAL_EVENTS_GUIDE_HASH);
    assert.equal(coordinateGlobalEventsRule.guideHash.length, 12);
    assert.ok(coordinateGlobalEventsRule.phase2Rubric.keepWhen.length >= 2);
    assert.ok(coordinateGlobalEventsRule.phase2Rubric.dropWhen.length >= 2);
    assert.equal(coordinateGlobalEventsRules.length, 1);
  });

  test('flags legacy getTimezoneOffset() calls', () => {
    const code = `
      function getLocalTimezoneOffset() {
        const offsetMinutes = new Date().getTimezoneOffset();
        const offsetMs = offsetMinutes * 60 * 1000;
        return offsetMs;
      }
    `;
    const { matches } = scanJsSource(
      'time/offset.js',
      code,
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /getTimezoneOffset/);
  });

  test('flags moment.tz() and moment().tz() conversions', () => {
    const code = `
      function formatInTimezone(timestamp, timeZone) {
        const t1 = moment.tz(timestamp, "YYYY-MM-DD HH:mm:ss", "America/New_York");
        const t2 = moment(timestamp).tz(timeZone).format();
        return { t1, t2 };
      }
    `;
    const { matches } = scanJsSource(
      'time/moment-tz.js',
      code,
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 2);
    assert.match(matches[0].message, /moment\.tz|\.tz\(\)/);
  });

  test('flags chained moment.utc().local() conversions', () => {
    const code = `
      function convertUtcToLocal(utcDateString) {
        return moment.utc(utcDateString).local().format("YYYY-MM-DD");
      }
    `;
    const { matches } = scanJsSource(
      'time/converter.js',
      code,
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /UTC\/local/);
  });

  test('ignores getTimezoneOffset when protected by Temporal feature guard', () => {
    const code = `
      function getOffset() {
        if (typeof Temporal === 'undefined') {
          return new Date().getTimezoneOffset();
        }
        return 0;
      }
    `;
    const { matches } = scanJsSource(
      'time/guarded.js',
      code,
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });

  test('flags real-world pdfjs annotation_layer.js TIMEZONE_OFFSET fixture', () => {
    const code = `
      const TIMEZONE_OFFSET = new Date().getTimezoneOffset() * 60 * 1000;
    `;
    const { matches } = scanJsSource(
      'display/annotation_layer.js',
      code,
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 1);
    assert.match(matches[0].message, /getTimezoneOffset/);
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
      [coordinateGlobalEventsMatcher],
      project,
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
      [coordinateGlobalEventsMatcher],
      project,
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
      [coordinateGlobalEventsMatcher],
      project,
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
      [coordinateGlobalEventsMatcher],
      project,
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
      [coordinateGlobalEventsMatcher],
      project,
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
      [coordinateGlobalEventsMatcher],
      project,
    );
    assert.equal(matches.length, 0);
  });
});
