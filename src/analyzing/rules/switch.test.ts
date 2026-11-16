import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import { switchMatcher } from './switch.ts';

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

  await t.test('exempts Vue v-bind attribute spread wrappers', () => {
    const vueSpreadHtml = `
      <div class="mdc-switch">
        <input v-model="model" v-bind="$attrs" class="mdc-switch__native-control" role="switch" type="checkbox">
      </div>
    `;
    assert.equal(scanHtml('Switch.vue', vueSpreadHtml, [switchMatcher]).length, 0);
  });

  await t.test('exempts checkbox-hack navigation tree disclosures and aligns duplicate switch tokens accurately', () => {
    const treeDisclosureHtml = `
      <ul>
        <li class="has-children">
          <a href="api.html">API</a>
          <input class="nav-toggle" id="nav-1" role="switch" type="checkbox" />
          <label for="nav-1"><svg><use href="#arrow"></use></svg></label>
          <ul><li><a href="sub.html">Sub</a></li></ul>
        </li>
      </ul>
    `;
    assert.equal(scanHtml('nav.html', treeDisclosureHtml, [switchMatcher]).length, 0);

    const themeSwitchWithGradientHtml = `
      <label class="switch">
        <input type="checkbox" role="switch" id="theme-switch">
        <svg viewBox="0 0 16 16">
          <defs><linearGradient id="sun"><stop offset="0%"></stop></linearGradient></defs>
          <path d="M2 8l4 4 8-8"></path>
        </svg>
      </label>
    `;
    assert.equal(scanHtml('theme.html', themeSwitchWithGradientHtml, [switchMatcher]).length, 1);

    // Attribute values containing '>' must not misalign duplicate token indexing
    const dataExprAndTreeHtml = `
      <input type="checkbox" data-expr="a > b" role="switch">
      <ul>
        <li>
          <input type="checkbox" role="switch">
          <ul><li>Child</li></ul>
        </li>
      </ul>
    `;
    const exprMatches = scanHtml('expr.html', dataExprAndTreeHtml, [switchMatcher]);
    assert.equal(exprMatches.length, 1);
    assert.equal(exprMatches[0]?.line, 2);

    // Template elements before another switch must not cause index drift (stateless resolution)
    const templateAndDuplicateSwitchHtml = `
      <template>
        <input TYPE="checkbox" role="switch">
      </template>
      <ul>
        <li>
          <input type="checkbox" ROLE="switch">
          <ul><li>Child</li></ul>
        </li>
      </ul>
    `;
    assert.equal(scanHtml('template.html', templateAndDuplicateSwitchHtml, [switchMatcher]).length, 1);
  });
});
