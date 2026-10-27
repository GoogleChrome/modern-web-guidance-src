import assert from 'node:assert/strict';
import test from 'node:test';
import { checkModernFeaturePresent } from '../eval/update-eval.ts';
import { scanHtml, scanJsx } from '../scanners/dom-scanner.ts';
import { withVirtualSourceFile } from '../scanners/js-scanner.ts';
import type { DomRuleMatcher } from '../schema.ts';
import { smsOtpFormRule } from './sms-otp-form.ts';

const matcher = smsOtpFormRule.matcher as DomRuleMatcher;

void test('sms-otp-form: Check 2c quotes', () => {
  assert.equal(
    checkModernFeaturePresent(
      'sms-otp-form',
      "<input type='text' autocomplete='one-time-code' inputmode='numeric'>",
    ),
    true,
  );
  assert.equal(
    checkModernFeaturePresent(
      'sms-otp-form',
      "<input type='text' autoComplete='one-time-code' />",
    ),
    true,
  );
});

void test('sms-otp-form: positive brownfield matches', async (suiteContext) => {
  await suiteContext.test('flags OTP input lacking autocomplete inside verification form', () => {
    const html = `
      <form action="/verify-otp" method="post">
        <label for="otp">Enter Verification Code</label>
        <input type="text" id="otp" name="otp" required>
        <button type="submit">Verify</button>
      </form>
    `;
    const matches = scanHtml('verify.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /one-time-code/);
    assert.equal(matches[0]?.subPattern, 'OTP input missing autocomplete="one-time-code"');
  });

  await suiteContext.test('flags 2FA passcode input with type="number" anti-pattern', () => {
    const html = `
      <form action="/auth/2fa" method="post">
        <label for="passcode">SMS Passcode</label>
        <input type="number" id="passcode" name="passcode">
      </form>
    `;
    const matches = scanHtml('2fa.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Never use type="number"/);
    assert.equal(
      matches[0]?.subPattern,
      'OTP input using type="number" or type="tel" instead of type="text" with inputmode="numeric"',
    );
  });

  await suiteContext.test('flags OTP input with type="tel" anti-pattern', () => {
    const html = `
      <form action="/sms-verify" method="post">
        <input type="tel" name="sms_code" placeholder="Enter code">
      </form>
    `;
    const matches = scanHtml('sms.html', html, [matcher]);
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /Never use type="tel"/);
  });

  await suiteContext.test('flags segmented multi-box inputs with maxlength="1"', () => {
    const html = `
      <form action="/verify" method="post">
        <div class="otp-inputs">
          <input type="text" class="otp-box" name="otp_1" maxlength="1">
          <input type="text" class="otp-box" name="otp_2" maxlength="1">
        </div>
      </form>
    `;
    const matches = scanHtml('segmented.html', html, [matcher]);
    assert.equal(matches.length, 2);
    assert.match(matches[0]?.message ?? '', /Segmented multi-box/);
    assert.equal(
      matches[0]?.subPattern,
      'segmented 6-box OTP input with keyup focus jumping',
    );
  });

  await suiteContext.test('flags JSX React OTP input component lacking autocomplete', () => {
    const jsx = `
      function OtpForm() {
        return (
          <form onSubmit={handleVerify}>
            <label htmlFor="auth-code">Two-Factor Code</label>
            <input id="auth-code" name="verification_code" type="text" />
          </form>
        );
      }
    `;
    const matches = withVirtualSourceFile('OtpForm.tsx', jsx, (sourceFile) =>
            scanJsx('OtpForm.tsx', sourceFile, [matcher]),
          );
    assert.equal(matches.length, 1);
    assert.match(matches[0]?.message ?? '', /one-time-code/);
  });
});

void test('sms-otp-form: negative and safe cases', async (suiteContext) => {
  await suiteContext.test('exempts inputs already specifying autocomplete="one-time-code"', () => {
    const html = `
      <form action="/verify" method="post">
        <input type="text" name="otp" autocomplete="one-time-code" inputmode="numeric" required>
      </form>
    `;
    const matches = scanHtml('compliant.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts hex IDs and embedded substrings containing 2fa or otp', () => {
    const html = `
      <form action="/feedback" method="post">
        <input type="text" name="what_doing" id="input-a92fafe4">
        <input type="text" name="spotprice" id="field-f0otp9">
        <input type="text" name="footpath" id="id-dead2fab">
      </form>
    `;
    const matches = scanHtml('feedback.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts phone/mobile number inputs and TOTP setup secret-key fields', () => {
    const html = `
      <form action="/2fa/setup" method="post">
        <input type="tel" name="phone" placeholder="Phone number">
        <input type="text" id="otp-mobile" name="mobile_number" placeholder="Mobile number">
        <input type="text" name="contact" autocomplete="tel">
        <input type="password" id="item_form_otp_secret" maxlength="64" autocomplete="off">
        <input type="text" name="totp_secret" placeholder="Authenticator secret key">
        <input type="text" name="otp_shared_key" placeholder="Shared key">
      </form>
    `;
    const matches = scanHtml('2fa-setup.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts standard password and login fields', () => {
    const html = `
      <form action="/login" method="post">
        <input type="text" name="username">
        <input type="password" name="password">
      </form>
    `;
    const matches = scanHtml('login.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts credit card CVV and postal code fields', () => {
    const html = `
      <form action="/pay" method="post">
        <input type="text" name="cvv" placeholder="CVV">
        <input type="text" name="zip_code" placeholder="Postal Code">
      </form>
    `;
    const matches = scanHtml('checkout.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });

  await suiteContext.test('exempts disabled, hidden, or readonly inputs', () => {
    const html = `
      <input type="text" name="otp" disabled>
      <input type="hidden" name="otp_token" value="abc">
      <input type="text" name="verification_code" readonly>
    `;
    const matches = scanHtml('noninteractive.html', html, [matcher]);
    assert.equal(matches.length, 0);
  });
});
