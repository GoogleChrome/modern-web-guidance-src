import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import type { CssRuleMatcher } from '../schema.ts';
import {
  AUTOFILL_HIGHLIGHT_INPUTS_GUIDE_HASH,
  autofillHighlightInputsRule,
  autofillHighlightInputsRules,
} from './autofill-highlight-inputs.ts';

const matcher = autofillHighlightInputsRule.matcher as CssRuleMatcher;

void test('autofill-highlight-inputs: rule metadata', () => {
  assert.equal(autofillHighlightInputsRule.id, 'autofill-highlight-inputs');
  assert.equal(autofillHighlightInputsRule.guideId, 'autofill-highlight-inputs');
  assert.equal(autofillHighlightInputsRule.guideHash, AUTOFILL_HIGHLIGHT_INPUTS_GUIDE_HASH);
  assert.equal(AUTOFILL_HIGHLIGHT_INPUTS_GUIDE_HASH.length, 12);
  assert.equal(autofillHighlightInputsRules.length, 0);
  assert.ok(autofillHighlightInputsRule.phase2Rubric.keepWhen.length > 0);
  assert.ok(autofillHighlightInputsRule.phase2Rubric.dropWhen.length >= 2);
});

void test('autofill-highlight-inputs: positive brownfield matches', async (t) => {
  await t.test('flags input:-webkit-autofill inset box-shadow hack', () => {
    const css = `
      input:-webkit-autofill {
        box-shadow: 0 0 0 1000px white inset;
        -webkit-text-fill-color: #333;
      }
    `;
    const matches = scanCss('login.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
    assert.match(matches[0]?.message ?? '', /:autofill/);
  });

  await t.test('flags multiple vendor autofill selectors without standard :autofill', () => {
    const css = `
      input:-webkit-autofill,
      textarea:-webkit-autofill,
      select:-webkit-autofill {
        border-color: #0070f3;
      }
    `;
    const matches = scanCss('forms.css', css, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 2);
  });
});

void test('autofill-highlight-inputs: negative / exempt cases', async (t) => {
  await t.test('exempts selectors pairing :autofill and :-webkit-autofill', () => {
    const css = `
      input:autofill,
      input:-webkit-autofill {
        border: 2px solid #2e7d32;
      }
    `;
    const matches = scanCss('accessible-form.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts stylesheets where standard :autofill is defined in another rule', () => {
    const css = `
      input:autofill {
        outline: 2px solid green;
      }
      input:-webkit-autofill {
        box-shadow: 0 0 0 1000px white inset;
      }
    `;
    const matches = scanCss('dual-rules.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts grid repeat(auto-fill, ...)', () => {
    const css = `
      .grid-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      }
    `;
    const matches = scanCss('layout.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts ordinary input styling', () => {
    const css = `
      input {
        color: #333;
        border: 1px solid #ccc;
      }
    `;
    const matches = scanCss('base.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts Safari :-webkit-autofill-strong-password pseudo-element', () => {
    const css = `
      input::-webkit-autofill-strong-password {
        display: none;
      }
    `;
    const matches = scanCss('safari.css', css, [matcher]);
    assert.equal(matches.length, 0);
  });
});
