import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  SELECT_MENU_INTERACTION_GUIDE_HASH,
  selectMenuInteractionCssMatcher,
  selectMenuInteractionCssRule,
  selectMenuInteractionJsMatcher,
  selectMenuInteractionJsRule,
  selectMenuInteractionRules,
} from './select-menu-interaction.ts';

void test('select-menu-interaction: rule metadata', () => {
  assert.equal(
    selectMenuInteractionCssRule.id,
    'select-menu-interaction/css-select-invalid',
  );
  assert.equal(
    selectMenuInteractionCssRule.guideId,
    'select-menu-interaction',
  );
  assert.equal(
    selectMenuInteractionCssRule.guideHash,
    SELECT_MENU_INTERACTION_GUIDE_HASH,
  );
  assert.equal(SELECT_MENU_INTERACTION_GUIDE_HASH.length, 12);

  assert.equal(
    selectMenuInteractionJsRule.id,
    'select-menu-interaction/js-select-interaction',
  );
  assert.equal(
    selectMenuInteractionJsRule.guideId,
    'select-menu-interaction',
  );
  assert.equal(
    selectMenuInteractionJsRule.guideHash,
    SELECT_MENU_INTERACTION_GUIDE_HASH,
  );

  assert.equal(selectMenuInteractionRules.length, 2);
  assert.ok(selectMenuInteractionCssRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(selectMenuInteractionCssRule.phase2Rubric.dropWhen.length >= 2);
  assert.ok(selectMenuInteractionJsRule.phase2Rubric.keepWhen.length >= 1);
  assert.ok(selectMenuInteractionJsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('select-menu-interaction CSS matcher', async (t) => {
  await t.test('flags select:invalid without :user-invalid', () => {
    const css = `
      select:invalid {
        border-color: #d93025;
      }
      select.form-control:invalid + .error-msg {
        display: block;
      }
    `;
    const matches = scanCss('select.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('exempts stylesheets already using select:user-invalid', () => {
    const css = `
      select:user-invalid {
        border-color: #d93025;
      }
    `;
    const matches = scanCss('modern.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts input:invalid not targeting <select>', () => {
    const css = `
      input:invalid {
        border-color: red;
      }
    `;
    const matches = scanCss('input.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('select-menu-interaction JS matcher', async (t) => {
  await t.test('flags blur/change listener checking select.value === "" and toggling invalid class', () => {
    const project = createInMemoryProject();
    const code = `
      const countrySelect = document.querySelector('select#country');
      countrySelect.addEventListener('blur', () => {
        if (countrySelect.value === '') {
          countrySelect.classList.add('is-invalid');
        } else {
          countrySelect.classList.remove('is-invalid');
        }
      });
    `;
    const sourceFile = project.createSourceFile('select-validation.js', code);
    const matches = selectMenuInteractionJsMatcher.matchFile(sourceFile, {
      filePath: 'select-validation.js',
      fileContent: code,
    });
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports("selector(:user-invalid)")', () => {
    const project = createInMemoryProject();
    const code = `
      if (!CSS.supports('selector(:user-invalid)')) {
        const countrySelect = document.querySelector('select#country');
        countrySelect.addEventListener('blur', () => {
          if (countrySelect.value === '') {
            countrySelect.classList.add('is-invalid');
          }
        });
      }
    `;
    const sourceFile = project.createSourceFile('guarded.js', code);
    const matches = selectMenuInteractionJsMatcher.matchFile(sourceFile, {
      filePath: 'guarded.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
