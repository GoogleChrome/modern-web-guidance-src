import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';
import {
  findEnclosingFormAttrs,
  isTestOrFixtureFilePath,
  tokenizeIdentifierWords,
} from './helpers/password-credential.ts';

export const SMS_OTP_FORM_GUIDE_HASH = 'd49c2ddc155d';

const NON_TEXT_INPUT_TYPES: ReadonlySet<string> = new Set([
  'hidden',
  'checkbox',
  'radio',
  'button',
  'submit',
  'reset',
  'file',
  'image',
  'email',
  'url',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'color',
  'range',
]);

const NON_OTP_AUTOCOMPLETE_TOKENS: ReadonlySet<string> = new Set([
  'tel',
  'tel-country-code',
  'tel-national',
  'tel-area-code',
  'tel-local',
  'tel-local-prefix',
  'tel-local-suffix',
  'tel-extension',
  'username',
  'email',
  'current-password',
  'new-password',
  'cc-number',
  'cc-csc',
  'cc-exp',
  'postal-code',
]);

const NON_OTP_EXCLUSION_WORDS: ReadonlySet<string> = new Set([
  'cvv',
  'cvc',
  'csc',
  'card',
  'credit',
  'expire',
  'expiry',
  'search',
  'promo',
  'coupon',
  'discount',
  'gift',
  'zip',
  'zipcode',
  'postal',
  'postalcode',
  'captcha',
]);

const TOTP_SECRET_EXCLUSION_WORDS: ReadonlySet<string> = new Set([
  'secret',
  'secrets',
  'secretkey',
  'seed',
  'sharedkey',
  'setupkey',
  'privatekey',
  'apikey',
  'authkey',
  'otpauth',
  'qrcode',
  'recovery',
  'backup',
]);

const PHONE_EXCLUSION_WORDS: ReadonlySet<string> = new Set([
  'phone',
  'phonenumber',
  'mobile',
  'mobilenumber',
  'telephone',
  'cellphone',
  'msisdn',
  'telnumber',
  'fax',
]);

const EXPLICIT_OTP_SINGLE_WORDS: ReadonlySet<string> = new Set([
  'otp',
  'totp',
  'hotp',
  'passcode',
  '2fa',
  'otpbox',
  'otpcode',
  'otpinput',
  'otpfield',
  'otpdigit',
  'otpcell',
  'smscode',
  'smsotp',
  'verificationcode',
  'verifycode',
  'mfacode',
  '2facode',
  'onetimecode',
]);

const OTP_FORM_CONTEXT_WORDS: ReadonlySet<string> = new Set([
  'otp',
  'totp',
  '2fa',
  'mfa',
  'twofactor',
  'sms',
  'passcode',
]);

const SEGMENTED_SINGLE_CLASS_WORDS: ReadonlySet<string> = new Set([
  'otpbox',
  'otpdigit',
  'otpcell',
  'otpfield',
  'pinbox',
  'pindigit',
  'pincell',
  'pininput',
  'digitbox',
]);

function hasExplicitOtpTokenSequence(words: readonly string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    const next = words[i + 1];
    const next2 = words[i + 2];

    if (EXPLICIT_OTP_SINGLE_WORDS.has(w)) {
      return true;
    }
    if (w === 'verification' && next === 'code') {
      return true;
    }
    if (
      w === 'sms' &&
      (next === 'code' || next === 'otp' || next === 'verification' || next === 'passcode')
    ) {
      return true;
    }
    if (
      w === 'mfa' &&
      (next === 'code' || next === 'otp' || next === 'passcode' || next === 'token' || next === 'input')
    ) {
      return true;
    }
    if (w === 'two' && next === 'factor' && next2 === 'code') {
      return true;
    }
    if (
      w === 'one' &&
      next === 'time' &&
      (next2 === 'code' || next2 === 'password' || next2 === 'passcode')
    ) {
      return true;
    }
  }
  return false;
}

function hasSegmentedClassTokens(classWords: readonly string[]): boolean {
  for (let i = 0; i < classWords.length; i++) {
    const w = classWords[i]!;
    const next = classWords[i + 1];
    if (SEGMENTED_SINGLE_CLASS_WORDS.has(w)) {
      return true;
    }
    if (
      w === 'otp' &&
      (next === 'box' || next === 'digit' || next === 'cell' || next === 'field')
    ) {
      return true;
    }
    if (
      w === 'pin' &&
      (next === 'box' || next === 'digit' || next === 'cell' || next === 'input')
    ) {
      return true;
    }
    if (w === 'digit' && next === 'box') {
      return true;
    }
  }
  return false;
}

function hasOtpFormContext(formWords: readonly string[]): boolean {
  for (let i = 0; i < formWords.length; i++) {
    const w = formWords[i]!;
    if (OTP_FORM_CONTEXT_WORDS.has(w)) {
      return true;
    }
    if (w === 'two' && formWords[i + 1] === 'factor') {
      return true;
    }
  }
  return false;
}

export const smsOtpFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: ['otp', 'passcode', 'verification', 'sms', '2fa', 'mfa', 'pin'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (isTestOrFixtureFilePath(ctx.filePath)) {
      return null;
    }

    const type = (element.getAttribute('type') ?? 'text').toLowerCase();
    if (NON_TEXT_INPUT_TYPES.has(type)) {
      return null;
    }

    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    const autocomplete = (
      element.getAttribute('autocomplete') ??
      element.getAttribute('autoComplete') ??
      ''
    )
      .toLowerCase()
      .trim();
    const autocompleteTokens = autocomplete ? autocomplete.split(/\s+/) : [];
    if (autocompleteTokens.some((t) => NON_OTP_AUTOCOMPLETE_TOKENS.has(t))) {
      return null;
    }

    const name = element.getAttribute('name') ?? '';
    const id = element.getAttribute('id') ?? '';
    const placeholder = element.getAttribute('placeholder') ?? '';
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    const className =
      element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    const maxLength =
      element.getAttribute('maxlength') ?? element.getAttribute('maxLength') ?? '';

    const primaryWords = tokenizeIdentifierWords(`${name} ${id}`);
    const labelWords = tokenizeIdentifierWords(`${placeholder} ${ariaLabel}`);
    const classWords = tokenizeIdentifierWords(className);
    const allWords = [...primaryWords, ...labelWords, ...classWords];

    // Exclude CVV, postal/zip, promo, captcha, and TOTP setup secret-key fields
    if (
      allWords.some(
        (w) => NON_OTP_EXCLUSION_WORDS.has(w) || TOTP_SECRET_EXCLUSION_WORDS.has(w),
      )
    ) {
      return null;
    }
    if (
      allWords.includes('key') &&
      allWords.some((w) => w === 'shared' || w === 'setup' || w === 'private')
    ) {
      return null;
    }
    if (type === 'password' && maxLength !== '' && Number(maxLength) >= 12) {
      return null;
    }

    // Exclude phone and mobile number inputs
    if (
      primaryWords.some((w) => PHONE_EXCLUSION_WORDS.has(w) || w === 'tel') ||
      classWords.some((w) => PHONE_EXCLUSION_WORDS.has(w))
    ) {
      return null;
    }
    const fieldMentionsOtpCode =
      hasExplicitOtpTokenSequence(primaryWords) ||
      hasExplicitOtpTokenSequence(labelWords) ||
      primaryWords.includes('code') ||
      labelWords.includes('code');
    if (labelWords.some((w) => PHONE_EXCLUSION_WORDS.has(w)) && !fieldMentionsOtpCode) {
      return null;
    }

    const hasExplicitOtpIdentifier = hasExplicitOtpTokenSequence(allWords);
    const explicitFormId = element.hasAttribute('form')
      ? (element.getAttribute('form') ?? '')
      : undefined;
    const enclosingFormAttrs =
      findEnclosingFormAttrs(
        ctx.documentText,
        element.line,
        explicitFormId,
        element.column,
      ) ?? '';
    const formWords = tokenizeIdentifierWords(enclosingFormAttrs);
    const isInsideOtpForm =
      hasOtpFormContext(formWords) &&
      (primaryWords.includes('code') || labelWords.includes('code'));

    if (!hasExplicitOtpIdentifier && !isInsideOtpForm) {
      return null;
    }

    const isSegmentedBox =
      maxLength === '1' ||
      hasSegmentedClassTokens(classWords) ||
      (element.getAttribute('size') === '1' && hasExplicitOtpIdentifier);

    if (isSegmentedBox) {
      return {
        message:
          'Segmented multi-box OTP input breaks autofill and copy-paste; use a single <input autocomplete="one-time-code" inputmode="numeric"> instead.',
        subPattern: 'segmented 6-box OTP input with keyup focus jumping',
      };
    }

    if (type === 'number' || type === 'tel') {
      return {
        message: `Never use type="${type}" for OTP codes; use type="text" with inputmode="numeric" and autocomplete="one-time-code".`,
        subPattern:
          'OTP input using type="number" or type="tel" instead of type="text" with inputmode="numeric"',
      };
    }

    if (autocompleteTokens.includes('one-time-code')) {
      return null;
    }

    return {
      message:
        'OTP verification input lacks autocomplete="one-time-code" to enable browser and OS autofill.',
      subPattern: 'OTP input missing autocomplete="one-time-code"',
    };
  },
};

export const smsOtpFormRule: AnalyzerRule = {
  id: 'sms-otp-form',
  guideId: 'sms-otp-form',
  guideHash: SMS_OTP_FORM_GUIDE_HASH,
  summary:
    'SMS one-time passcode verification inputs should provide autocomplete="one-time-code" with type="text" and inputmode="numeric", and avoid segmented multi-box inputs.',
  matcher: smsOtpFormMatcher,
  verifierRubric: {
    keepWhen: [
      'The input is an OTP, SMS, or two-factor authentication (2FA/MFA/TOTP) verification code entry field (such as a 6-digit code input) that lacks autocomplete="one-time-code".',
      'The OTP input uses type="number" or type="tel" instead of type="text" with inputmode="numeric".',
      'The form uses segmented multi-box inputs (maxlength="1" single-digit boxes) for OTP entry rather than a single input.',
    ],
    dropWhen: [
      'The input already specifies autocomplete="one-time-code".',
      'The input is a phone/mobile number field, a shared secret/seed string for configuring a TOTP app (e.g. name="otp_secret" or maxlength="64"), or a standard password field.',
      'The input is a credit card CVV/CVC code or postal/zip code.',
      'The input is disabled, readonly, hidden, or a non-interactive display widget.',
    ],
  },
};

export default [smsOtpFormRule] satisfies readonly AnalyzerRule[];
