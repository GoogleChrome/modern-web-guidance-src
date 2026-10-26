import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import {
  AUTOFILL_SIGN_UP_FORM_GUIDE_HASH,
  autofillSignUpFormMatcher,
  autofillSignUpFormRule,
  autofillSignUpFormRules,
} from './autofill-sign-up-form.ts';

const matcher = autofillSignUpFormRule.matcher as DomRuleMatcher;

void test('autofill-sign-up-form: rule metadata', () => {
  assert.equal(AUTOFILL_SIGN_UP_FORM_GUIDE_HASH.length, 12);
  assert.equal(autofillSignUpFormRule.id, 'autofill-sign-up-form');
  assert.equal(autofillSignUpFormRule.guideId, 'autofill-sign-up-form');
  assert.equal(autofillSignUpFormRule.guideHash, AUTOFILL_SIGN_UP_FORM_GUIDE_HASH);
  assert.equal(autofillSignUpFormRules.length, 1);
  assert.ok(autofillSignUpFormRule.verifierRubric.keepWhen.length >= 2);
  assert.ok(autofillSignUpFormRule.verifierRubric.dropWhen.length >= 2);
});

void test('autofill-sign-up-form: positive brownfield matches', async (t) => {
  await t.test('flags new password input lacking autocomplete in registration form', () => {
    const html = `
      <form action="/signup" method="post">
        <label for="password">Create Password</label>
        <input type="password" id="password" name="new_password" required>
      </form>
    `;
    const matches = scanHtml('signup.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /new-password/);
  });

  await t.test('flags password confirmation input in registration form', () => {
    const html = `
      <form action="/register" method="post">
        <input type="password" name="password" required>
        <input type="password" name="confirm_password" required>
      </form>
    `;
    const matches = scanHtml('register.html', html, [matcher]);
    // Both are inside a registration form!
    assert.equal(matches.length, 2);
  });

  await t.test('flags new password field specifying autocomplete="current-password"', () => {
    const html = `
      <form action="/signup" method="post">
        <input type="password" name="new_password" autocomplete="current-password">
      </form>
    `;
    const matches = scanHtml('wrong-autocomplete.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /current-password/);
  });

  await t.test('flags new password field specifying autocomplete="off"', () => {
    const html = `
      <form action="/register" method="post">
        <input type="password" name="password" autocomplete="off">
      </form>
    `;
    const matches = scanHtml('off-autocomplete.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /autocomplete="off"/);
  });

  await t.test('flags JSX React registration form component', () => {
    const project = createInMemoryProject();
    const jsx = `
      export function SignUpForm() {
        return (
          <form action="/api/register" method="POST">
            <input type="password" id="signup-pwd" name="newPassword" />
          </form>
        );
      }
    `;
    const sourceFile = project.createSourceFile('SignUpForm.tsx', jsx);
    const matches = scanJsx('SignUpForm.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /new-password/);
  });
});

void test('autofill-sign-up-form: negative / exempt cases', async (t) => {
  await t.test('exempts inputs already specifying autocomplete="new-password"', () => {
    const html = `
      <form action="/signup" method="post">
        <input type="password" name="password" autocomplete="new-password">
      </form>
    `;
    const matches = scanHtml('compliant.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts login and sign-in forms (owned by autofill-sign-in-form)', () => {
    const html = `
      <form action="/login" method="post">
        <input type="text" name="username">
        <input type="password" name="password">
      </form>
    `;
    const matches = scanHtml('login.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts disabled, hidden, or readonly inputs', () => {
    const html = `
      <form action="/signup" method="post">
        <input type="password" name="new_password" disabled>
        <input type="password" name="confirm_password" hidden>
      </form>
    `;
    const matches = scanHtml('disabled.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
