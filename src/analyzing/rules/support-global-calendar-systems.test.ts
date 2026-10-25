import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  supportGlobalCalendarSystemsJsMatcher,
  supportGlobalCalendarSystemsJsRule,
  supportGlobalCalendarSystemsPackageMatcher,
  supportGlobalCalendarSystemsPackageRule,
  supportGlobalCalendarSystemsRules,
} from './support-global-calendar-systems.ts';

void test('support-global-calendar-systems: rule metadata', () => {
  assert.equal(
    supportGlobalCalendarSystemsPackageRule.id,
    'support-global-calendar-systems/package-calendar',
  );
  assert.equal(
    supportGlobalCalendarSystemsPackageRule.guideId,
    'support-global-calendar-systems',
  );
  assert.equal(
    supportGlobalCalendarSystemsPackageRule.guideHash,
    SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  );
  assert.equal(SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH.length, 12);

  assert.equal(
    supportGlobalCalendarSystemsJsRule.id,
    'support-global-calendar-systems/js-calendar',
  );
  assert.equal(
    supportGlobalCalendarSystemsJsRule.guideId,
    'support-global-calendar-systems',
  );
  assert.equal(
    supportGlobalCalendarSystemsJsRule.guideHash,
    SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  );

  assert.equal(supportGlobalCalendarSystemsRules.length, 2);
  assert.ok(
    supportGlobalCalendarSystemsPackageRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    supportGlobalCalendarSystemsPackageRule.verifierRubric.dropWhen.length >= 2,
  );
  assert.ok(
    supportGlobalCalendarSystemsJsRule.verifierRubric.keepWhen.length >= 1,
  );
  assert.ok(
    supportGlobalCalendarSystemsJsRule.verifierRubric.dropWhen.length >= 2,
  );
});

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
    const project = createInMemoryProject();
    const code = `
      const jDate = jalaali.toJalaali(2025, 3, 21);
      const gDate = jalaali.toGregorian(1404, 1, 1);
      const pDate = new PersianDate([1404, 1, 1]);
    `;
    const sourceFile = project.createSourceFile('calendar.js', code);
    const matches = supportGlobalCalendarSystemsJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'calendar.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 3);
    assert.match(matches[0]?.message ?? '', /Temporal/);
  });

  await t.test('flags imported jalaali-js and persian-date', () => {
    const project = createInMemoryProject();
    const code = `
      import jalaali from 'jalaali-js';
      import PersianDate from 'persian-date';
      jalaali.toJalaali(2025, 3, 21);
      new PersianDate();
    `;
    const sourceFile = project.createSourceFile('imported-calendar.js', code);
    const matches = supportGlobalCalendarSystemsJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'imported-calendar.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by Temporal check', () => {
    const project = createInMemoryProject();
    const code = `
      if (typeof Temporal === 'undefined') {
        const jDate = jalaali.toJalaali(2025, 3, 21);
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = supportGlobalCalendarSystemsJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'guarded.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard Date usage', () => {
    const project = createInMemoryProject();
    const code = `
      const now = new Date();
      console.log(now.toISOString());
    `;
    const sourceFile = project.createSourceFile('date.js', code);
    const matches = supportGlobalCalendarSystemsJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'date.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });

  await t.test('exempts existing Intl.DateTimeFormat calendar usage and shadowed or unimported helpers (Area 2.3)', () => {
    const project = createInMemoryProject();
    const code = `
      const fmt = new Intl.DateTimeFormat('en-u-ca-islamic');
      const localConverter = { toHijri(d) { return d; }, toGregorian(d) { return d; } };
      localConverter.toGregorian('1446-01-01');
      function convert(jalaali) {
        return jalaali.toGregorian(1404, 1, 1);
      }
    `;
    const sourceFile = project.createSourceFile('intl-calendar.js', code);
    const matches = supportGlobalCalendarSystemsJsMatcher.matchFile(
      sourceFile,
      {
        filePath: 'intl-calendar.js',
        fileContent: code,
      },
    );
    assert.equal(matches.length, 0);
  });
});
