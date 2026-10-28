import assert from 'node:assert/strict';
import test from 'node:test';
import { matchJsRule } from '../scanners/js-scanner.ts';
import { scopedComponentTransitionsMatcher } from './scoped-component-transitions.ts';

void test('scoped-component-transitions JS matcher', async (t) => {
  await t.test('flags document.startViewTransition() mutating a local container or shadowRoot subtree', () => {
    const code = `
      function moveCardToColumn(card, targetColumn) {
        const board = card.closest('.kanban-board');
        document.startViewTransition(() => {
          targetColumn.appendChild(card);
          board.setAttribute('data-updated', 'true');
        });
      }
    `;
    const matches = matchJsRule(scopedComponentTransitionsMatcher, 'kanban.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts files already using element.startViewTransition() and full-page or theme transitions', () => {
    const modernCode = `
      function moveCard(card, column) {
        const board = card.closest('.kanban-board');
        if (board.startViewTransition) {
          board.startViewTransition(() => column.appendChild(card));
        } else {
          document.startViewTransition(() => column.appendChild(card));
        }
      }
    `;
    assert.equal(matchJsRule(scopedComponentTransitionsMatcher, 'modern.js', modernCode).length, 0);

    const pageRouteCode = `
      function navigateTo(url, html) {
        document.startViewTransition(() => {
          document.body.innerHTML = html;
          history.pushState({}, '', url);
        });
      }
    `;
    assert.equal(matchJsRule(scopedComponentTransitionsMatcher, 'router.js', pageRouteCode).length, 0);
  });
});
