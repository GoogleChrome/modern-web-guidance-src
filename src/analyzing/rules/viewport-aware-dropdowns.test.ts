import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { viewportAwareDropdownsMatcher } from './viewport-aware-dropdowns.ts';

void test('viewport-aware-dropdowns JS matcher', async (t) => {
  await t.test('flags dropdown/menu positioning functions measuring getBoundingClientRect() against viewport bounds and setting style.top/left', () => {
    const code = `
      function positionDropdownMenu(trigger, dropdownMenu) {
        const rect = trigger.getBoundingClientRect();
        const menuRect = dropdownMenu.getBoundingClientRect();
        let top = rect.bottom;
        let left = rect.left;
        if (top + menuRect.height > window.innerHeight) {
          top = rect.top - menuRect.height;
        }
        if (left + menuRect.width > window.innerWidth) {
          left = window.innerWidth - menuRect.width;
        }
        dropdownMenu.style.top = top + 'px';
        dropdownMenu.style.left = left + 'px';
      }
    `;
    const matches = matchJsRule(viewportAwareDropdownsMatcher, 'dropdown.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts tooltip positioning, right-click contextmenu / pointer-coordinate menus, and drag/canvas handlers', () => {
    const code = `
      function positionTooltip(trigger, tooltipEl) {
        const rect = trigger.getBoundingClientRect();
        const top = rect.bottom + 8 > window.innerHeight ? rect.top - 32 : rect.bottom + 8;
        tooltipEl.style.top = top + 'px';
      }

      function showContextMenu(e, menuEl) {
        const rect = menuEl.getBoundingClientRect();
        const left = e.clientX + rect.width > window.innerWidth ? window.innerWidth - rect.width : e.clientX;
        const top = e.clientY + rect.height > window.innerHeight ? window.innerHeight - rect.height : e.clientY;
        menuEl.style.left = left + 'px';
        menuEl.style.top = top + 'px';
      }

      function onDragMove(e, panel) {
        const rect = panel.getBoundingClientRect();
        const left = Math.min(window.innerWidth - rect.width, e.clientX);
        panel.style.left = left + 'px';
      }
    `;
    const matches = matchJsRule(viewportAwareDropdownsMatcher, 'other.js', code);
    assert.equal(matches.length, 0);
  });
});
