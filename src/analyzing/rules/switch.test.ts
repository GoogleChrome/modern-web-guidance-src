import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import {
  switchMatcher
} from './switch.ts';
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
    const jsxCode = `
      export function Toggle() {
        return <input type="checkbox" role="switch" />;
      }
    `;
    const jsxMatches = withVirtualSourceFile('Toggle.tsx', jsxCode, (sourceFile) =>
            scanJsx('Toggle.tsx', sourceFile, [switchMatcher]),
          );
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

  await t.test('exempts CSS checkbox-hack tree navigation disclosure toggles', () => {
    const treeHtml = `
      <li class="toctree-l2 has-children">
        <a href="harl.html">Algorithms</a>
        <input class="toctree-checkbox" id="toctree-checkbox-5" name="toctree-checkbox-5" role="switch" type="checkbox"/>
        <label for="toctree-checkbox-5"><div class="visually-hidden">Toggle navigation</div></label>
        <ul><li>Child</li></ul>
      </li>
    `;
    assert.equal(scanHtml('nav.html', treeHtml, [switchMatcher]).length, 0);
  });
});
