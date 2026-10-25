import assert from 'node:assert/strict';
import test from 'node:test';
import { scanPackageJson } from '../scanners/dependency-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  interestTriggeredActionPreviewsJsMatcher,
  interestTriggeredActionPreviewsJsRule,
  interestTriggeredActionPreviewsPackageMatcher,
  interestTriggeredActionPreviewsPackageRule,
  interestTriggeredActionPreviewsRules,
} from './interest-triggered-action-previews.ts';

void test('interest-triggered-action-previews: rule metadata', () => {
  assert.equal(
    interestTriggeredActionPreviewsPackageRule.id,
    'interest-triggered-action-previews/package-hoverintent',
  );
  assert.equal(
    interestTriggeredActionPreviewsPackageRule.guideId,
    'interest-triggered-action-previews',
  );
  assert.equal(
    interestTriggeredActionPreviewsPackageRule.guideHash,
    INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  );
  assert.equal(INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH.length, 12);

  assert.equal(
    interestTriggeredActionPreviewsJsRule.id,
    'interest-triggered-action-previews/js-hover-preview',
  );
  assert.equal(
    interestTriggeredActionPreviewsJsRule.guideId,
    'interest-triggered-action-previews',
  );
  assert.equal(
    interestTriggeredActionPreviewsJsRule.guideHash,
    INTEREST_TRIGGERED_ACTION_PREVIEWS_GUIDE_HASH,
  );

  assert.equal(interestTriggeredActionPreviewsRules.length, 2);
  assert.ok(interestTriggeredActionPreviewsPackageRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(interestTriggeredActionPreviewsPackageRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(interestTriggeredActionPreviewsJsRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(interestTriggeredActionPreviewsJsRule.verifierRubric.dropWhen.length >= 2);
});

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
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('preview.js', code);
    const matches = interestTriggeredActionPreviewsJsMatcher.matchFile(sourceFile, {
      filePath: 'preview.js',
      fileContent: code,
    });
    assert.equal(matches.length, 3);
  });

  await t.test('exempts when guarded by interestForElement or interestfor check', () => {
    const project = createInMemoryProject();
    const code = `
      import hoverintent from 'hoverintent';

      const btn = document.querySelector('button');
      const card = document.querySelector('#card');

      if (!('interestForElement' in HTMLButtonElement.prototype)) {
        hoverintent(btn, () => card.showPopover(), () => card.hidePopover());
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = interestTriggeredActionPreviewsJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('exempts shadowed hoverintent or mouseenter without preview delay', () => {
    const project = createInMemoryProject();
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
    const sourceFile = project.createSourceFile('shadowed.js', code);
    const matches = interestTriggeredActionPreviewsJsMatcher.matchFile(sourceFile, {
      filePath: 'shadowed.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });

  await t.test('flags focusin listener with setTimeout action preview delay', () => {
    const project = createInMemoryProject();
    const code = `
      const trigger = document.querySelector('.card-trigger');
      const actionCard = document.querySelector('#action-card');
      trigger.addEventListener('focusin', () => {
        setTimeout(() => {
          actionCard.classList.add('visible');
        }, 300);
      });
    `;
    const sourceFile = project.createSourceFile('focus-preview.js', code);
    const matches = interestTriggeredActionPreviewsJsMatcher.matchFile(sourceFile, {
      filePath: 'focus-preview.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });
});
