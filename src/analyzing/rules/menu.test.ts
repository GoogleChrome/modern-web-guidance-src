import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../scanners/dom-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  menuDomMatcher,
  menuJsMatcher
} from './menu.ts';
void test('menu: positive brownfield matches', async (t) => {
  await t.test('flags manual menu keydown arrow roving tabindex', () => {
    const code = `
      // Menu with role="menuitem"
      menuElement.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          const items = menuElement.querySelectorAll('[role="menuitem"]');
          items[1].focus();
        }
      });
    `;
    const matches = matchJsRule(menuJsMatcher, 'menu-nav.js', code);
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
    const code = `
      window.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          player.y += 10;
        }
      });
    `;
    const matches = matchJsRule(menuJsMatcher, 'game.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts sidebar treeview and static list-unstyled with role="menu"', () => {
    const html = `
      <ul class="nav nav-pills nav-sidebar flex-column" data-widget="treeview" role="menu">
        <li class="nav-item"><a href="#" class="nav-link">Dashboard</a></li>
      </ul>
      <ul class="list-unstyled" role="menu">
        <li><a href="/about">About</a></li>
      </ul>
    `;
    const matches = scanHtml('sidebar.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts dropdown container holding form or input controls', () => {
    const html = `
      <div class="dropdown-menu" role="menu">
        <form class="px-4 py-3">
          <input type="email" class="form-control" placeholder="email@example.com">
        </form>
      </div>
    `;
    const matches = scanHtml('login-dropdown.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts trigger <button role="menu"> and JSX spread wrappers', () => {
    const html = `<button type="button" role="menu">Open</button>`;
    const matches = scanHtml('button.html', html, [menuDomMatcher]);
    assert.equal(matches.length, 0);
  });
});
