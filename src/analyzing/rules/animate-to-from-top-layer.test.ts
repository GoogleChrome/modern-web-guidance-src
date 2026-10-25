import assert from 'node:assert/strict';
import test from 'node:test';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  ANIMATE_TO_FROM_TOP_LAYER_GUIDE_HASH,
  animateToFromTopLayerMatcher,
  animateToFromTopLayerRule,
  animateToFromTopLayerRules,
} from './animate-to-from-top-layer.ts';

void test('animate-to-from-top-layer: rule metadata', () => {
  assert.equal(animateToFromTopLayerRule.id, 'animate-to-from-top-layer');
  assert.equal(animateToFromTopLayerRule.guideId, 'animate-to-from-top-layer');
  assert.equal(
    animateToFromTopLayerRule.guideHash,
    ANIMATE_TO_FROM_TOP_LAYER_GUIDE_HASH,
  );
  assert.equal(ANIMATE_TO_FROM_TOP_LAYER_GUIDE_HASH.length, 12);
  assert.equal(animateToFromTopLayerRules.length, 1);
  assert.ok(animateToFromTopLayerRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(animateToFromTopLayerRule.verifierRubric.dropWhen.length >= 2);
});

void test('animate-to-from-top-layer JS matcher', async (t) => {
  await t.test('flags animationend and transitionend listeners calling dialog.close() or popover.hidePopover()', () => {
    const project = createInMemoryProject();
    const code = `
      const dialog = document.querySelector('dialog');
      dialog.addEventListener('animationend', () => {
        dialog.classList.remove('is-closing');
        dialog.close();
      }, { once: true });

      const popover = document.querySelector('[popover]');
      popover.addEventListener('transitionend', () => {
        popover.hidePopover();
      });
    `;
    const sourceFile = project.createSourceFile('top-layer.js', code);
    const matches = animateToFromTopLayerMatcher.matchFile(sourceFile, {
      filePath: 'top-layer.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts when guarded by allow-discrete / @starting-style or non-top-layer elements', () => {
    const project = createInMemoryProject();
    const code = `
      const dialog = document.querySelector('dialog');
      if (!CSS.supports('transition-behavior', 'allow-discrete')) {
        dialog.addEventListener('transitionend', () => {
          dialog.close();
        });
      }

      const toast = document.querySelector('.toast');
      toast.addEventListener('transitionend', () => {
        toast.remove();
      });
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = animateToFromTopLayerMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
