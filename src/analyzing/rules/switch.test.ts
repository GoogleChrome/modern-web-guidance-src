import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SWITCH_GUIDE_HASH,
  switchMatcher,
  switchRule,
  switchRules,
} from './switch.ts';

void test('switch: rule metadata', () => {
  assert.equal(switchRule.id, 'switch');
  assert.equal(switchRule.guideId, 'switch');
  assert.equal(switchRule.guideHash, SWITCH_GUIDE_HASH);
  assert.equal(SWITCH_GUIDE_HASH.length, 12);
  assert.equal(switchRules.length, 1);
  assert.ok(switchRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(switchRule.phase2Rubric.dropWhen.length >= 2);
});

void test('switch DOM matcher', async (t) => {
  await t.test('flags <input type="checkbox" role="switch"> without switch attribute in HTML and JSX', () => {
    const html = `
      <label>
        Dark Mode
        <input type="checkbox" role="switch" id="dark-mode">
      </label>
    `;
    const htmlMatches = scanHtml('switch.html', html, [switchMatcher]);
    assert.equal(htmlMatches.length, 1);
    assert.equal(htmlMatches[0]?.line, 4);

    const project = createInMemoryProject();
    const jsxCode = `
      export function Toggle() {
        return <input type="checkbox" role="switch" />;
      }
    `;
    const sourceFile = project.createSourceFile('Toggle.tsx', jsxCode);
    const jsxMatches = scanJsx('Toggle.tsx', sourceFile, [switchMatcher]);
    assert.equal(jsxMatches.length, 1);
  });

  await t.test('exempts <input type="checkbox" switch> and standard checkboxes', () => {
    const html = `
      <input type="checkbox" role="switch" switch>
      <input type="checkbox" switch>
      <input type="checkbox" id="agree">
    `;
    const matches = scanHtml('modern.html', html, [switchMatcher]);
    assert.equal(matches.length, 0);
  });
});
