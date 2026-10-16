import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  modelPartialTimeConceptsJsMatcher,
} from './model-partial-time-concepts.ts';

const jsMatcher = modelPartialTimeConceptsJsMatcher;

void test('model-partial-time-concepts JS matcher', async (t) => {
  await t.test('flags date.setHours(0, 0, 0, 0)', () => {
    const project = createInMemoryProject();
    const code = `
      const today = new Date();
      today.setHours(0, 0, 0, 0);
    `;
    const sourceFile = project.createSourceFile('calendar.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'calendar.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /setHours/);
  });

  await t.test('flags new Date().setHours(0, 0, 0, 0) (dondido-webrtc pattern)', () => {
    const project = createInMemoryProject();
    const code = `
      this.defaultRoomId = String(new Date() - new Date().setHours(0, 0, 0, 0));
    `;
    const sourceFile = project.createSourceFile('room.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'room.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /setHours/);
  });

  await t.test('flags date.setUTCHours(0, 0, 0, 0)', () => {
    const project = createInMemoryProject();
    const code = `
      const utcDayStart = new Date(timestamp);
      utcDayStart.setUTCHours(0, 0, 0, 0);
    `;
    const sourceFile = project.createSourceFile('utc.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'utc.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /setUTCHours/);
  });

  await t.test('flags date.setHours(0, 0, 0) with 3 zeros', () => {
    const project = createInMemoryProject();
    const code = `
      d.setHours(0, 0, 0);
    `;
    const sourceFile = project.createSourceFile('start.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'start.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts non-zero hours (e.g. scheduling alarm at 9:30)', () => {
    const project = createInMemoryProject();
    const code = `
      const alarm = new Date();
      alarm.setHours(9, 30, 0, 0);
    `;
    const sourceFile = project.createSourceFile('alarm.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'alarm.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts variable arguments', () => {
    const project = createInMemoryProject();
    const code = `
      targetDate.setHours(hour, min, sec);
    `;
    const sourceFile = project.createSourceFile('dynamic.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'dynamic.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts when guarded by Temporal check', () => {
    const project = createInMemoryProject();
    const code = `
      if (typeof Temporal === 'undefined') {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
      }
    `;
    const sourceFile = project.createSourceFile('temporal-fallback.js', code);
    const matches = jsMatcher.matchFile(sourceFile, {
      filePath: 'temporal-fallback.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
