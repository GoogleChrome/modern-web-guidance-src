import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SCROLLABILITY_AFFORDANCE_HINTS_GUIDE_HASH,
  scrollabilityAffordanceHintsMatcher,
  scrollabilityAffordanceHintsRule,
  scrollabilityAffordanceHintsRules,
} from './scrollability-affordance-hints.ts';

void test('scrollability-affordance-hints: rule metadata', () => {
  assert.equal(
    scrollabilityAffordanceHintsRule.id,
    'scrollability-affordance-hints',
  );
  assert.equal(
    scrollabilityAffordanceHintsRule.guideId,
    'scrollability-affordance-hints',
  );
  assert.equal(
    scrollabilityAffordanceHintsRule.guideHash,
    SCROLLABILITY_AFFORDANCE_HINTS_GUIDE_HASH,
  );
  assert.equal(SCROLLABILITY_AFFORDANCE_HINTS_GUIDE_HASH.length, 12);
  assert.equal(scrollabilityAffordanceHintsRules.length, 1);
  assert.ok(scrollabilityAffordanceHintsRule.phase2Rubric.keepWhen.length >= 2);
  assert.ok(scrollabilityAffordanceHintsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('scrollability-affordance-hints JS matcher', async (t) => {
  await t.test('flags horizontal scroll listener comparing scrollLeft, scrollWidth, and clientWidth to toggle has-scroll-left / has-scroll-right', () => {
    const project = createInMemoryProject();
    const code = `
      const scroller = document.querySelector('.table-scroller');
      scroller.addEventListener('scroll', () => {
        scroller.classList.toggle('has-scroll-left', scroller.scrollLeft > 0);
        scroller.classList.toggle(
          'has-scroll-right',
          scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth
        );
      });
    `;
    const sourceFile = project.createSourceFile('affordance.js', code);
    const matches = scrollabilityAffordanceHintsMatcher.matchFile(sourceFile, {
      filePath: 'affordance.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('flags vertical scroll listener comparing scrollTop, scrollHeight, and clientHeight to toggle can-scroll / is-scrollable', () => {
    const project = createInMemoryProject();
    const code = `
      const pane = document.querySelector('.pane');
      pane.addEventListener('scroll', () => {
        const canScrollMore = pane.scrollTop + pane.clientHeight < pane.scrollHeight;
        pane.classList.toggle('can-scroll', canScrollMore);
      });
    `;
    const sourceFile = project.createSourceFile('vertical-affordance.js', code);
    const matches = scrollabilityAffordanceHintsMatcher.matchFile(sourceFile, {
      filePath: 'vertical-affordance.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports("container-type", "scroll-state") or infinite scroll fetch', () => {
    const project = createInMemoryProject();
    const code = `
      const scroller = document.querySelector('.scroller');
      if (!CSS.supports('container-type', 'scroll-state')) {
        scroller.addEventListener('scroll', () => {
          scroller.classList.toggle('is-scrollable', scroller.scrollWidth > scroller.clientWidth);
        });
      }

      scroller.addEventListener('scroll', () => {
        if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight) {
          fetchMoreItems();
        }
      });
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = scrollabilityAffordanceHintsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags ResizeObserver comparing scrollWidth and clientWidth to toggle scroll-shadow', () => {
    const project = createInMemoryProject();
    const code = `
      const table = document.querySelector('.responsive-table');
      const resizeObserver = new ResizeObserver(() => {
        table.classList.toggle('scroll-shadow', table.scrollWidth > table.clientWidth);
      });
      resizeObserver.observe(table);
    `;
    const sourceFile = project.createSourceFile('ro-affordance.js', code);
    const matches = scrollabilityAffordanceHintsMatcher.matchFile(sourceFile, {
      filePath: 'ro-affordance.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
