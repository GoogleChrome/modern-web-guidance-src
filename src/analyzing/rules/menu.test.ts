import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  MENU_GUIDE_HASH,
  menuDomMatcher,
  menuDomRule,
  menuJsMatcher,
  menuJsRule,
  menuRule,
  menuRules,
} from './menu.ts';

void test('menu: rule metadata', () => {
  assert.equal(menuRule.id, 'menu/js');
  assert.equal(menuRule.guideId, 'menu');
  assert.equal(menuRule.guideHash, MENU_GUIDE_HASH);
  assert.equal(MENU_GUIDE_HASH.length, 12);
  assert.equal(menuRules.length, 2);
  assert.ok(menuJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(menuJsRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(menuDomRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(menuDomRule.verifierRubric.dropWhen.length >= 2);
});

void test('menu: positive brownfield matches', async (t) => {
  await t.test('flags manual menu keydown arrow roving tabindex', () => {
    const project = createInMemoryProject();
    const code = `
      // Menu with role="menuitem"
      menuElement.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          const items = menuElement.querySelectorAll('[role="menuitem"]');
          items[1].focus();
        }
      });
    `;
    const sourceFile = project.createSourceFile('menu-nav.js', code);
    const matches = menuJsMatcher.matchFile(sourceFile, {
      filePath: 'menu-nav.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /focusgroup/);
  });

  await t.test('flags DOM <div role="menu"> without focusgroup', () => {
    const html = `
      <div role="menu" aria-label="Actions">
        <button role="menuitem">Edit</button>
        <button role="menuitem">Delete</button>
      </div>
    `;
    const matches = scanHtml('menu.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('menu: negative / exempt cases', async (t) => {
  await t.test('exempts DOM menu element with focusgroup attribute', () => {
    const html = `
      <div role="menu" focusgroup="menu nomemory" aria-label="Actions">
        <button>Edit</button>
        <button>Delete</button>
      </div>
    `;
    const matches = scanHtml('modern-menu.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts test and fixture files in DOM matcher', () => {
    const html = `<div role="menu"><ul><li>Item</li></ul></div>`;
    const matches = scanHtml('tests/fixtures/menu.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts non-menu arrow navigation (e.g. game controls)', () => {
    const project = createInMemoryProject();
    const code = `
      window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          player.y += 10;
        }
      });
    `;
    const sourceFile = project.createSourceFile('game.js', code);
    const matches = menuJsMatcher.matchFile(sourceFile, {
      filePath: 'game.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
