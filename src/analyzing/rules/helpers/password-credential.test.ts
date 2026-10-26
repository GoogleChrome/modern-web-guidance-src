import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml } from '../../scanners/dom-scanner.ts';
import type { DomRuleMatcher } from '../../schema.ts';
import { autofillSignInFormRule } from '../autofill-sign-in-form.ts';
import { autofillSignUpFormRule } from '../autofill-sign-up-form.ts';
import {
  findEnclosingFormAttrs,
  tokenizeIdentifierWords,
} from './password-credential.ts';

const signInMatcher = autofillSignInFormRule.matcher as DomRuleMatcher;
const signUpMatcher = autofillSignUpFormRule.matcher as DomRuleMatcher;

void test('password-credential helper: tokenization and form stack', async (t) => {
  await t.test('splits camelCase and delimiters without splitting hex tokens like a92fafe4', () => {
    assert.deepEqual(tokenizeIdentifierWords('ChangePasswordOldPassword'), [
      'change',
      'password',
      'old',
      'password',
    ]);
    assert.deepEqual(tokenizeIdentifierWords('input-a92fafe4'), ['input', 'a92fafe4']);
    assert.deepEqual(tokenizeIdentifierWords('input-2FA_code'), ['input', '2fa', 'code']);
    assert.deepEqual(tokenizeIdentifierWords('confirmNewPassword'), [
      'confirm',
      'new',
      'password',
    ]);
  });

  await t.test('tracks sequential and nested forms without leaking prior closed forms', () => {
    const html = [
      '<form class="form_register" action="/register">',
      '  <input type="password" name="password">',
      '</form>',
      '<form class="form_login" action="/login">',
      '  <input type="password" name="password">',
      '</form>',
    ].join('\n');

    assert.match(findEnclosingFormAttrs(html, 2) ?? '', /\/register/);
    assert.match(findEnclosingFormAttrs(html, 5) ?? '', /\/login/);
    assert.doesNotMatch(findEnclosingFormAttrs(html, 5) ?? '', /\/register/);
  });

  await t.test('does not match forms that open after targetLine', () => {
    const html = [
      '<div>',
      '  <input type="password" name="orphan_password">',
      '</div>',
      '<form action="/search">',
      '  <input type="search" name="q">',
      '</form>',
    ].join('\n');

    assert.equal(findEnclosingFormAttrs(html, 2), null);
  });
});

void test('autofill-sign-in-form vs autofill-sign-up-form: disjoint partition invariants', async (t) => {
  await t.test('generic password field in registration form is claimed ONLY by sign-up (0 collisions)', () => {
    const html = `
      <form action="/register" method="post">
        <input type="email" name="email" required>
        <input type="password" name="password" required>
        <input type="password" name="confirm_password" required>
      </form>
    `;
    const signInMatches = scanHtml('register.html', html, [signInMatcher]);
    const signUpMatches = scanHtml('register.html', html, [signUpMatcher]);
    assert.equal(signInMatches.length, 0);
    assert.equal(signUpMatches.length, 2);
  });

  await t.test('change-password form keeps old/current/existing/previous fields on sign-in and new/confirm on sign-up', () => {
    const html = `
      <form id="change-password-form" action="/change_password.do" method="post">
        <input type="password" id="ChangePasswordOldPassword" name="oldPassword" placeholder="Old password">
        <input type="password" name="current_password" placeholder="Current password" autocomplete="off">
        <input type="password" name="existing_password" placeholder="Existing password">
        <input type="password" name="previousPassword" placeholder="Previous password">
        <input type="password" id="ChangePasswordNewPassword" name="new_password" placeholder="New password">
        <input type="password" id="ChangePasswordConfirmPassword" name="confirm_password" placeholder="Confirm new password">
      </form>
    `;
    const signInMatches = scanHtml('change-password.html', html, [signInMatcher]);
    const signUpMatches = scanHtml('change-password.html', html, [signUpMatcher]);

    assert.deepEqual(
      signInMatches.map((m) => m.line),
      [3, 4, 5, 6],
    );
    assert.deepEqual(
      signUpMatches.map((m) => m.line),
      [7, 8],
    );
  });

  await t.test('unanchored "change" token on a field never pushes current/generic credentials into sign-up', () => {
    const html = `
      <form action="/settings/security" method="post">
        <input type="password" id="change_password_auth" name="password" placeholder="Enter password to save changes">
      </form>
    `;
    const signInMatches = scanHtml('security.html', html, [signInMatcher]);
    const signUpMatches = scanHtml('security.html', html, [signUpMatcher]);
    assert.equal(signInMatches.length, 1);
    assert.equal(signUpMatches.length, 0);
  });

  await t.test('generic form pairing password with confirmPassword routes both fields to sign-up', () => {
    const html = `
      <form class="auth-form">
        <input type="password" id="password" name="password">
        <input type="password" id="confirmPassword" name="confirmPassword">
      </form>
    `;
    const signInMatches = scanHtml('setup-password.html', html, [signInMatcher]);
    const signUpMatches = scanHtml('setup-password.html', html, [signUpMatcher]);
    assert.equal(signInMatches.length, 0);
    assert.equal(signUpMatches.length, 2);
  });

  await t.test('numbered Bootstrap login demo IDs like exampleInputPassword2 stay on sign-in', () => {
    const html = `
      <form role="form">
        <input type="email" id="exampleInputEmail2">
        <input type="password" id="exampleInputPassword2" placeholder="Password">
      </form>
    `;
    const signInMatches = scanHtml('forms.html', html, [signInMatcher]);
    const signUpMatches = scanHtml('forms.html', html, [signUpMatcher]);
    assert.equal(signInMatches.length, 1);
    assert.equal(signUpMatches.length, 0);
  });
});
