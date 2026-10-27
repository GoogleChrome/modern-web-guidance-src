import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { matchJsRule } from '../scanners/js-scanner.ts';
import {
  selectMenuInteractionCssMatcher,
  selectMenuInteractionJsMatcher
} from './select-menu-interaction.ts';
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

  await t.test('exempts input:invalid not targeting <select> and :not(:invalid)', () => {
    const css = `
      input:invalid {
        border-color: red;
      }
      select:not(:invalid) {
        border-color: green;
      }
      select.form-control:not(:invalid) {
        border-color: green;
      }
      :not(select:invalid) {
        color: inherit;
      }
    `;
    const matches = scanCss('input.css', css, [selectMenuInteractionCssMatcher]);
    assert.equal(matches.length, 0);
  });
});

void test('select-menu-interaction JS matcher', async (t) => {
  await t.test('flags blur/change listener checking select.value === "" and toggling invalid class', () => {
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
    const matches = matchJsRule(selectMenuInteractionJsMatcher, 'select-validation.js', code);
    assert.equal(matches.length, 1);
  });

  await t.test('exempts when guarded by CSS.supports("selector(:user-invalid)") or targeting input via querySelector', () => {
    const code = `
      if (!CSS.supports('selector(:user-invalid)')) {
        const countrySelect = document.querySelector('select#country');
        countrySelect.addEventListener('blur', () => {
          if (countrySelect.value === '') {
            countrySelect.classList.add('is-invalid');
          }
        });
      }
      const emailInput = document.querySelector('input#email');
      emailInput.addEventListener('blur', () => {
        if (emailInput.value === '') {
          emailInput.classList.add('is-invalid');
        }
      });
    `;
    const matches = matchJsRule(selectMenuInteractionJsMatcher, 'guarded.js', code);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Choices, Select2, and TomSelect custom select initializations', () => {
    const code = `
      import Choices from 'choices.js';
      import TomSelect from 'tom-select';
      new Choices('#country-select');
      new TomSelect('#role-select');
      $('#city-select').select2();
    `;
    const matches = matchJsRule(selectMenuInteractionJsMatcher, 'custom-select.js', code);
    assert.equal(matches.length, 0);
  });
});
