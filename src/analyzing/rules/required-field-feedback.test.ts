import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from '../scanners/css-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import {
  REQUIRED_FIELD_FEEDBACK_GUIDE_HASH,
  requiredFieldFeedbackCssMatcher,
  requiredFieldFeedbackCssRule,
  requiredFieldFeedbackJsMatcher,
  requiredFieldFeedbackJsRule,
  requiredFieldFeedbackRules,
} from './required-field-feedback.ts';

void test('required-field-feedback: rule metadata', () => {
  assert.equal(
    requiredFieldFeedbackCssRule.id,
    'required-field-feedback/css-required-invalid',
  );
  assert.equal(
    requiredFieldFeedbackCssRule.guideId,
    'required-field-feedback',
  );
  assert.equal(
    requiredFieldFeedbackCssRule.guideHash,
    REQUIRED_FIELD_FEEDBACK_GUIDE_HASH,
  );
  assert.equal(REQUIRED_FIELD_FEEDBACK_GUIDE_HASH.length, 12);

  assert.equal(
    requiredFieldFeedbackJsRule.id,
    'required-field-feedback/js-blur-dirty-class',
  );
  assert.equal(
    requiredFieldFeedbackJsRule.guideId,
    'required-field-feedback',
  );
  assert.equal(
    requiredFieldFeedbackJsRule.guideHash,
    REQUIRED_FIELD_FEEDBACK_GUIDE_HASH,
  );

  assert.equal(requiredFieldFeedbackRules.length, 2);
  assert.ok(requiredFieldFeedbackCssRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(requiredFieldFeedbackCssRule.verifierRubric.dropWhen.length >= 2);
  assert.ok(requiredFieldFeedbackJsRule.verifierRubric.keepWhen.length >= 1);
  assert.ok(requiredFieldFeedbackJsRule.verifierRubric.dropWhen.length >= 2);
});

void test('required-field-feedback CSS matcher', async (t) => {
  await t.test('flags :required:invalid and [required]:invalid selectors', () => {
    const css = `
      input:required:invalid {
        border-color: #d93025;
      }
      input[required]:invalid + .error-msg {
        display: block;
      }
    `;
    const matches = scanCss('form.css', css, [requiredFieldFeedbackCssMatcher]);
    assert.equal(matches.length, 2);
  });

  await t.test('strips :not(...) before matching :invalid and exempts :user-invalid', () => {
    const css = `
      input:required:not(:invalid) {
        border-color: green;
      }
      :not(input[required]:invalid) {
        color: inherit;
      }
    `;
    const matches = scanCss('valid.css', css, [requiredFieldFeedbackCssMatcher]);
    assert.equal(matches.length, 0);

    const modernCss = `
      input:user-invalid {
        border-color: #d93025;
      }
    `;
    const modernMatches = scanCss('modern.css', modernCss, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(modernMatches.length, 0);
  });

  await t.test('flags touched / dirty paired :invalid selectors (e.g. Bootstrap .was-validated)', () => {
    const css = `
      .was-validated .form-control:invalid {
        border-color: #dc3545;
      }
      input.is-touched:invalid {
        border-color: #d93025;
      }
      .dirty input:invalid {
        box-shadow: 0 0 0 1px red;
      }
    `;
    const matches = scanCss('bootstrap-feedback.css', css, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(matches.length, 3);
  });

  await t.test('exempts bare :invalid without required or touched/dirty class', () => {
    const css = `
      input:invalid {
        color: red;
      }
      textarea:invalid {
        border-color: orange;
      }
      .container :invalid {
        outline: none;
      }
    `;
    const matches = scanCss('bare-invalid.css', css, [
      requiredFieldFeedbackCssMatcher,
    ]);
    assert.equal(matches.length, 0);
  });
});

void test('required-field-feedback JS matcher', async (t) => {
  await t.test('flags blur / invalid listeners on inputs toggling .touched / .dirty / .interacted / .was-validated', () => {
    const project = createInMemoryProject();
    const code = `
      const emailInput = document.querySelector('input[required]');
      emailInput.addEventListener('blur', () => {
        emailInput.classList.add('touched');
      });
      emailInput.addEventListener('invalid', () => {
        emailInput.classList.add('was-validated');
      });
    `;
    const sourceFile = project.createSourceFile('validation.js', code);
    const matches = requiredFieldFeedbackJsMatcher.matchFile(sourceFile, {
      filePath: 'validation.js',
      fileContent: code,
    });
    assert.equal(matches.length, 2);
  });

  await t.test('exempts aria-invalid accessibility sync and CSS.supports(":user-invalid") guards', () => {
    const project = createInMemoryProject();
    const code = `
      const input = document.querySelector('input[required]');
      input.addEventListener('blur', () => {
        if (!input.checkValidity()) {
          input.setAttribute('aria-invalid', 'true');
        }
      });

      if (!CSS.supports('selector(:user-invalid)')) {
        input.addEventListener('blur', () => {
          input.classList.add('dirty');
        });
      }
    `;
    const sourceFile = project.createSourceFile('a11y.js', code);
    const matches = requiredFieldFeedbackJsMatcher.matchFile(sourceFile, {
      filePath: 'a11y.js',
      fileContent: code,
    });
    assert.equal(matches.length, 0);
  });
});
