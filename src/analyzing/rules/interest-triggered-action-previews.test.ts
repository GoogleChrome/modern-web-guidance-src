import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  interestTriggeredActionPreviewsJsMatcher,
  interestTriggeredActionPreviewsPackageMatcher
} from './interest-triggered-action-previews.ts';
void test('interest-triggered-action-previews dependency matcher', async (t) => {
  await t.test('flags hoverintent and jquery-hoverintent', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          hoverintent: '^2.2.1',
          'jquery-hoverintent': '^1.10.1',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interestTriggeredActionPreviewsPackageMatcher,
    ]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts unrelated packages', () => {
    const pkg = JSON.stringify(
      {
        dependencies: {
          lodash: '^4.17.21',
        },
      },
      null,
      2,
    );
    const matches = scanPackageJson('package.json', pkg, [
      interestTriggeredActionPreviewsPackageMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('interest-triggered-action-previews JS matcher', async (t) => {
  await t.test('flags hoverintent(), $(...).hoverIntent(), and mouseenter + setTimeout preview delay', () => {
    const code = `
      import hoverintent from 'hoverintent';

      const btn = document.querySelector('#action-btn');
      const previewCard = document.querySelector('#preview-card');

      hoverintent(
        btn,
        () => { previewCard.showPopover(); },
        () => { previewCard.hidePopover(); },
      );

      $('.action-trigger').hoverIntent({
        over: function() { $(this).find('.preview').fadeIn(); },
        out: function() { $(this).find('.preview').fadeOut(); },
      });

      btn.addEventListener('mouseenter', () => {
        setTimeout(() => {
          previewCard.dataset.preview = btn.dataset.effect;
        }, 200);
      });
    `;
    const matches = matchJsRule(interestTriggeredActionPreviewsJsMatcher, 'preview.js', code);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by interestForElement or interestfor check', () => {
    const code = `
      import hoverintent from 'hoverintent';

      const btn = document.querySelector('button');
      const card = document.querySelector('#card');

      if (!('interestForElement' in HTMLButtonElement.prototype)) {
        hoverintent(btn, () => card.showPopover(), () => card.hidePopover());
      }
    `;
    const matches = matchJsRule(interestTriggeredActionPreviewsJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts shadowed hoverintent or mouseenter without preview delay', () => {
    const code = `
      import hoverintent from 'hoverintent';

      function customScope() {
        function hoverintent(el, onEnter, onLeave) {
          return [el, onEnter, onLeave];
        }
        hoverintent(document.body, () => {}, () => {});
      }

      document.body.addEventListener('mouseenter', () => {
        console.log('hovered');
      });

      const navMenu = document.querySelector('#main-nav');
      navMenu.addEventListener('mouseenter', () => {
        setTimeout(() => {
          navMenu.classList.add('menu-expanded');
        }, 150);
      });
    `;
    const matches = matchJsRule(interestTriggeredActionPreviewsJsMatcher, 'shadowed.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('flags focusin listener with setTimeout action preview delay', () => {
    const code = `
      const trigger = document.querySelector('.card-trigger');
      const actionCard = document.querySelector('#action-card');
      trigger.addEventListener('focusin', () => {
        setTimeout(() => {
          actionCard.classList.add('visible');
        }, 300);
      });
    `;
    const matches = matchJsRule(interestTriggeredActionPreviewsJsMatcher, 'focus-preview.js', code);
    assert.equal(matches.length, 1);
  });
});
