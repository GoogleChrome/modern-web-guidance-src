import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  durationDependencyMatcher,
  durationJsMatcher,
} from './format-human-readable-durations.ts';

const depMatcher = durationDependencyMatcher;
const jsMatcher = durationJsMatcher;

void test('format-human-readable-durations dependency matcher', async (t) => {
  await t.test('flags humanize-duration in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'humanize-duration': '^3.27.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /humanize-duration/);
  });

  await t.test('flags pretty-ms in devDependencies', () => {
    const pkg = JSON.stringify(
      {
        devDependencies: {
          'pretty-ms': '^7.0.0',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /pretty-ms/);
  });

  await t.test('flags moment-duration-format in dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          'moment-duration-format': '^2.3.2',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /moment-duration-format/);
  });

  await t.test('exempts unrelated dependencies', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [depMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('format-human-readable-durations JS matcher', async (t) => {
  await t.test('flags humanizeDuration call', () => {
    const project = createInMemoryProject();
    const code = `
      const readable = humanizeDuration(120000);
    `;
    const sourceFile = project.createSourceFile('time.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'time.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /humanizeDuration/);
  });

  await t.test('flags prettyMs call', () => {
    const project = createInMemoryProject();
    const code = `
      console.log(prettyMs(1337000000));
    `;
    const sourceFile = project.createSourceFile('time.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'time.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /prettyMs/);
  });

  await t.test('flags moment.duration().humanize()', () => {
    const project = createInMemoryProject();
    const code = `
      const label = moment.duration(choreHours, 'hours').humanize();
    `;
    const sourceFile = project.createSourceFile('chore.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'chore.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /humanize/);
  });

  await t.test('flags custom duration formatting function', () => {
    const project = createInMemoryProject();
    const code = `
      function formatDuration(totalSeconds) {
        var sec = 1000;
        var min = 60 * 1000;
        var hour = 60 * min;
        if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
        if (ms >= min) return (ms / min).toFixed(1) + 'm';
        return (ms / sec).toFixed(1) + 's';
      }
    `;
    const sourceFile = project.createSourceFile('analytics.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'analytics.js',
      fileContent: code,
    });
    assert.ok(matches.length >= 1);
  });

  await t.test('exempts when guarded by Intl.DurationFormat check', () => {
    const project = createInMemoryProject();
    const code = `
      if (typeof Intl.DurationFormat === 'undefined') {
        const readable = humanizeDuration(120000);
      }
    `;
    const sourceFile = project.createSourceFile('time.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'time.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts standard calendar date formatting', () => {
    const project = createInMemoryProject();
    const code = `
      const formatted = new Date().toISOString();
      const calendar = moment(someDate).format('YYYY-MM-DD');
    `;
    const sourceFile = project.createSourceFile('date.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'date.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
