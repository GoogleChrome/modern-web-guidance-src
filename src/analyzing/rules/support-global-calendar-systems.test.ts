import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  supportGlobalCalendarSystemsJsMatcher,
  supportGlobalCalendarSystemsPackageMatcher
} from './support-global-calendar-systems.ts';
void test('support-global-calendar-systems dependency matcher', async (t) => {
  await t.test('flags moment-hijri, moment-jalaali, jalaali-js, hijri-moment, and persian-date', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'moment-hijri': '^2.1.2',
          'moment-jalaali': '^0.9.4',
          'jalaali-js': '^1.2.6',
          'hijri-moment': '^1.0.5',
          'persian-date': '^1.1.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      supportGlobalCalendarSystemsPackageMatcher,
    ]);
    assert.equal(matches.length, 5);
  });

  await t.test('exempts unrelated date packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'date-fns': '^3.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      supportGlobalCalendarSystemsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('support-global-calendar-systems JS matcher', async (t) => {
  await t.test('flags jalaali.toJalaali, jalaali.toGregorian, and new PersianDate', () => {
    const code = `
      const jDate = jalaali.toJalaali(2025, 3, 21);
      const gDate = jalaali.toGregorian(1404, 1, 1);
      const pDate = new PersianDate([1404, 1, 1]);
    `;
    const matches = matchJsRule(supportGlobalCalendarSystemsJsMatcher, 'calendar.js', code);
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /Temporal/);
  });

  await t.test('flags imported jalaali-js and persian-date', () => {
    const code = `
      import jalaali from 'jalaali-js';
      import PersianDate from 'persian-date';
      jalaali.toJalaali(2025, 3, 21);
      new PersianDate();
    `;
    const matches = matchJsRule(supportGlobalCalendarSystemsJsMatcher, 'imported-calendar.js', code);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by Temporal check', () => {
    const code = `
      if (typeof Temporal === 'undefined') {
        const jDate = jalaali.toJalaali(2025, 3, 21);
      }
    `;
    const matches = matchJsRule(supportGlobalCalendarSystemsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard Date usage', () => {
    const code = `
      const now = new Date();
      console.log(now.toISOString());
    `;
    const matches = matchJsRule(supportGlobalCalendarSystemsJsMatcher, 'date.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts existing Intl.DateTimeFormat calendar usage and shadowed or unimported helpers (Area 2.3)', () => {
    const code = `
      const fmt = new Intl.DateTimeFormat('en-u-ca-islamic');
      const localConverter = { toHijri(d) { return d; }, toGregorian(d) { return d; } };
      localConverter.toGregorian('1446-01-01');
      function convert(jalaali) {
        return jalaali.toGregorian(1404, 1, 1);
      }
    `;
    const matches = matchJsRule(supportGlobalCalendarSystemsJsMatcher, 'intl-calendar.js', code);
    assert.equal(matches.length, 0);
  });
});
