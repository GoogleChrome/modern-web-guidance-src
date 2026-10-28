import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { autofillSignUpFormRule } from './autofill-sign-up-form.ts';

const matcher = autofillSignUpFormRule.matcher as DomRuleMatcher;

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
    const jsx = `
      export function SignUpForm() {
        return (
          <form action="/api/register" method="POST">
            <input type="password" id="signup-pwd" name="newPassword" />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('SignUpForm.tsx', jsx, (sourceFile) =>
            scanJsx('SignUpForm.tsx', sourceFile, [matcher]),
          );
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

  await t.test('exempts old/current/existing/previous password fields in change-password forms', () => {
    const html = `
      <form action="/change_password.do" method="post">
        <input type="password" id="ChangePasswordOldPassword" name="oldPassword">
        <input type="password" name="current_password" placeholder="Current password" autocomplete="off">
        <input type="password" name="existingPassword">
        <input type="password" name="previous_password">
      </form>
    `;
    const matches = scanHtml('change-password.html', html, [matcher]);
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

  await t.test('exempts authenticated change-password modals, device settings, and dual-mode login/signup forms while allowing password-reset forms without old password', () => {
    const changePwdHtml = `
      <form action="/account/password" method="post">
        <input type="password" name="old_password" placeholder="Current password">
        <input type="password" name="new_password" placeholder="New password">
        <input type="password" name="confirm_password" placeholder="Confirm new password">
      </form>
    `;
    assert.equal(scanHtml('account-change-password.html', changePwdHtml, [matcher]).length, 0);

    const resetHtml = `
      <form method="post">
        <input type="password" name="new_password1" placeholder="New password">
        <input type="password" name="new_password2" placeholder="Repeat password">
      </form>
    `;
    assert.equal(scanHtml('password_reset_confirm.html', resetHtml, [matcher]).length, 2);

    const deviceHtml = `
      <form>
        <input type="password" id="bridge-settings-new-mqtt-password">
      </form>
    `;
    assert.equal(scanHtml('views/system.html', deviceHtml, [matcher]).length, 0);

    const dualModeHtml = `
      <form on:submit|preventDefault={(e) => (mode === 'login' ? login(e) : signup(e))}>
        <input type="password" name="password" placeholder="Password">
      </form>
    `;
    assert.equal(scanHtml('Login.svelte', dualModeHtml, [matcher]).length, 0);
  });
});
