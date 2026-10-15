import assert from 'node:assert/strict';
import test from 'node:test';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { createInMemoryProject } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { autofillSignInFormRule } from './autofill-sign-in-form.ts';

const matcher = autofillSignInFormRule.matcher as DomRuleMatcher;

void test('autofill-sign-in-form: positive brownfield matches', async (t) => {
  await t.test('flags password input lacking autocomplete inside HTML form', () => {
    const html = `
      <form action="/login" method="post">
        <label for="pwd">Password</label>
        <input type="password" id="pwd" name="password" required>
        <button type="submit">Sign In</button>
      </form>
    `;
    const matches = scanHtml('login.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 4);
    assert.match(matches[0]?.message ?? '', /current-password/);
  });

  await t.test('flags password input with autocomplete="off" inside HTML form', () => {
    const html = `
      <form action="/auth" method="post">
        <input type="password" name="pass" autocomplete="off">
      </form>
    `;
    const matches = scanHtml('auth.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags password input with explicit form attribute outside form tag', () => {
    const html = `
      <form id="auth-form" action="/login" method="post"></form>
      <input type="password" form="auth-form" id="pwd" name="pwd">
    `;
    const matches = scanHtml('detached.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 3);
  });

  await t.test('flags real-world grocy login.blade.php template fixture', () => {
    const grocyBlade = `
      <form method="post" action="{{ $U('/login') }}" id="login-form" novalidate>
        <div class="form-group">
          <label for="username">{{ $__t('Username') }}</label>
          <input type="text" class="form-control" required id="username" name="username">
        </div>
        <div class="form-group">
          <label for="password_input">{{ $__t('Password') }}</label>
          <input type="password" class="form-control" required id="password_input">
        </div>
        <button id="login-button" class="btn btn-success">{{ $__t('OK') }}</button>
      </form>
    `;
    const matches = scanHtml('views/login.blade.php', grocyBlade, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 9);
  });

  await t.test('flags password input inside JSX form element', () => {
    const project = createInMemoryProject();
    const code = `
      export function LoginForm() {
        return (
          <form onSubmit={handleSubmit}>
            <input type="text" name="user" />
            <input type="password" name="pass" id="pass" />
            <button type="submit">Log In</button>
          </form>
        );
      }
    `;
    const sourceFile = project.createSourceFile('LoginForm.tsx', code);
    const matches = scanJsx('LoginForm.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 1);
    assert.equal(matches[0]?.line, 6);
  });
});

void test('autofill-sign-in-form: negative / exempt cases', async (t) => {
  await t.test('exempts inputs with autocomplete="current-password"', () => {
    const html = `
      <form action="/login" method="post">
        <input type="password" autocomplete="current-password" required>
      </form>
    `;
    const matches = scanHtml('login.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts inputs with autocomplete="new-password"', () => {
    const html = `
      <form action="/signup" method="post">
        <input type="password" autocomplete="new-password" required>
      </form>
    `;
    const matches = scanHtml('signup.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts inputs with autocomplete="one-time-code"', () => {
    const html = `
      <form action="/mfa" method="post">
        <input type="password" autocomplete="one-time-code" required>
      </form>
    `;
    const matches = scanHtml('mfa.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts disabled, readonly, and hidden inputs', () => {
    const html = `
      <form>
        <input type="password" disabled>
        <input type="password" readonly>
        <input type="password" hidden>
      </form>
    `;
    const matches = scanHtml('exempt.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts password inputs outside any form without form attribute', () => {
    const html = `
      <div class="palette">
        <input type="password" id="inspector-pwd">
      </div>
    `;
    const matches = scanHtml('standalone.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts JSX inputs with spread attributes', () => {
    const project = createInMemoryProject();
    const code = `
      export function CustomInput(props: any) {
        return (
          <form>
            <input type="password" {...props} />
          </form>
        );
      }
    `;
    const sourceFile = project.createSourceFile('CustomInput.tsx', code);
    const matches = scanJsx('CustomInput.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 0);
  });

  await t.test('exempts JSX inputs with dynamic autocomplete attribute', () => {
    const project = createInMemoryProject();
    const code = `
      export function DynamicInput({ autoMode }: { autoMode: string }) {
        return (
          <form>
            <input type="password" autocomplete={autoMode} />
          </form>
        );
      }
    `;
    const sourceFile = project.createSourceFile('DynamicInput.tsx', code);
    const matches = scanJsx('DynamicInput.tsx', sourceFile, [matcher]);
    assert.equal(matches.length, 0);
  });
});
