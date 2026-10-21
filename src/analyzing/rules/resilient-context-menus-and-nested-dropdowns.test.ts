import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject, scanJsSource } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher, JsRuleMatcher } from '../schema.ts';
import {
  resilientContextMenusAndNestedDropdownsRule,
  resilientContextMenusAndNestedDropdownsPositioningRule,
  resilientContextMenusAndNestedDropdownsRules,
} from './resilient-context-menus-and-nested-dropdowns.ts';

const domMatcher =
  resilientContextMenusAndNestedDropdownsRule.matcher as DomRuleMatcher;
const jsMatcher =
  resilientContextMenusAndNestedDropdownsPositioningRule.matcher as JsRuleMatcher;

void test('resilient-context-menus-and-nested-dropdowns: rule metadata', () => {
  assert.equal(
    resilientContextMenusAndNestedDropdownsRule.id,
    'resilient-context-menus-and-nested-dropdowns',
  );
  assert.equal(
    resilientContextMenusAndNestedDropdownsPositioningRule.id,
    'resilient-context-menus-and-nested-dropdowns/positioning',
  );
  assert.equal(resilientContextMenusAndNestedDropdownsRules.length, 0);
});

void test('resilient-context-menus-and-nested-dropdowns: DOM matcher positive cases', async (t) => {
  await t.test('flags legacy Bootstrap 3/4 data-toggle="dropdown" on button', () => {
    const html = `
      <div class="dropdown">
        <button class="btn dropdown-toggle" type="button" data-toggle="dropdown">
          Dropdown Button
        </button>
        <div class="dropdown-menu">
          <a class="dropdown-item" href="#">Action</a>
        </div>
      </div>
    `;
    const matches = scanHtml('index.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /data-toggle="dropdown"/);
  });

  await t.test('flags legacy Bootstrap 5 data-bs-toggle="dropdown" on link', () => {
    const html = `
      <div class="nav-item dropdown">
        <a class="nav-link dropdown-toggle" href="#" data-bs-toggle="dropdown">
          Profile
        </a>
      </div>
    `;
    const matches = scanHtml('nav.html', html, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /data-bs-toggle="dropdown"/);
  });

  await t.test('flags JSX button with data-toggle="dropdown"', () => {
    const project = createInMemoryProject();
    const jsx = `
      export function Dropdown() {
        return (
          <button type="button" className="btn" data-toggle="dropdown">
            Options
          </button>
        );
      }
    `;
    const sourceFile = project.createSourceFile('dropdown.tsx', jsx);
    const matches = scanJsx('dropdown.tsx', sourceFile, [domMatcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
  });
});

void test('resilient-context-menus-and-nested-dropdowns: DOM matcher negative cases', async (t) => {
  await t.test('skips elements modernized with popovertarget', () => {
    const html = `
      <button popovertarget="action-panel" data-toggle="dropdown">
        Actions
      </button>
    `;
    const matches = scanHtml('panel.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips elements modernized with commandfor', () => {
    const html = `
      <button commandfor="action-panel" command="toggle-popover" data-toggle="dropdown">
        Actions
      </button>
    `;
    const matches = scanHtml('panel.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('skips modal or collapse data-toggles', () => {
    const html = `
      <button data-toggle="modal" data-target="#myModal">Open Modal</button>
      <button data-toggle="collapse" data-target="#navbar">Toggle Nav</button>
    `;
    const matches = scanHtml('page.html', html, [domMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('resilient-context-menus-and-nested-dropdowns: JS matcher positive cases', async (t) => {
  const project = createInMemoryProject();

  await t.test('flags jQuery .dropdown("toggle")', () => {
    const code = `
      function toggleMenu() {
        $('.dropdown-toggle').dropdown('toggle');
      }
    `;
    const { matches } = scanJsSource('menu.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /jQuery \.dropdown\(\)/);
  });

  await t.test('flags jQuery .dropdown() initialization', () => {
    const code = `
      $(document).ready(function() {
        $('[data-hover="dropdown"]').dropdown();
      });
    `;
    const { matches } = scanJsSource('init.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags createPopper call', () => {
    const code = `
      import { createPopper } from '@popperjs/core';

      function initDropdown(button, menu) {
        const instance = createPopper(button, menu, {
          placement: 'bottom-start',
        });
      }
    `;
    const { matches } = scanJsSource('popper.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /Popper\.js/);
  });

  await t.test('flags new Popper() instantiation', () => {
    const code = `
      class ActionMenu {
        mount(anchorEl, menuEl) {
          this.popper = new Popper(anchorEl, menuEl, { placement: 'bottom' });
        }
      }
    `;
    const { matches } = scanJsSource('action-menu.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
    assert.match(matches[0]?.message ?? '', /Popper/);
  });

  await t.test('flags Floating UI computePosition call', () => {
    const code = `
      import { computePosition, shift, flip } from '@floating-ui/dom';

      function updateMenuPosition(anchor, menu) {
        computePosition(anchor, menu, {
          middleware: [flip(), shift()],
        }).then(({ x, y }) => {
          Object.assign(menu.style, { left: \`\${x}px\`, top: \`\${y}px\` });
        });
      }
    `;
    const { matches } = scanJsSource('floating.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 5);
    assert.match(matches[0]?.message ?? '', /Floating UI/);
  });

  await t.test('flags manual getBoundingClientRect coordinate clamping in contextmenu', () => {
    const code = `
      function positionContextMenu(e, menu) {
        const rect = menu.getBoundingClientRect();
        let top = e.clientY;
        let left = e.clientX;
        if (left + rect.width > window.innerWidth) {
          left = window.innerWidth - rect.width;
        }
        if (top + rect.height > window.innerHeight) {
          top = window.innerHeight - rect.height;
        }
        menu.style.top = top + 'px';
        menu.style.left = left + 'px';
      }
    `;
    const { matches } = scanJsSource('ctxmenu.js', code, [jsMatcher], project);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
    assert.match(matches[0]?.message ?? '', /getBoundingClientRect/);
  });
});

void test('resilient-context-menus-and-nested-dropdowns: JS matcher negative cases', async (t) => {
  const project = createInMemoryProject();

  await t.test('skips Popper when guarded by CSS.supports or feature check', () => {
    const code = `
      import { createPopper } from '@popperjs/core';

      function mountDropdown(btn, menu) {
        if (!('anchorName' in document.documentElement.style)) {
          createPopper(btn, menu, { placement: 'bottom' });
        }
      }
    `;
    const { matches } = scanJsSource('guarded.js', code, [jsMatcher], project);
    assert.equal(matches.length, 0);
  });

  await t.test('skips unrelated getBoundingClientRect for canvas or drag-and-drop', () => {
    const code = `
      function handleCanvasClick(e, canvas) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        drawPixel(x, y);
      }
    `;
    const { matches } = scanJsSource('canvas.js', code, [jsMatcher], project);
    assert.equal(matches.length, 0);
  });
});
