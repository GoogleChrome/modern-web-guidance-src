import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SMS_OTP_FORM_GUIDE_HASH = 'd49c2ddc155d';

const OTP_IDENTIFIER_REGEX =
  /(?:otp|passcode|verification[-_]?code|verificationcode|sms[-_]?code|smscode|2fa|mfa[-_]?code|mfacode|one[-_]?time[-_]?code)/i;

const NON_OTP_EXCLUSION_REGEX =
  /(?:cvv|cvc|csc|card|credit|expire|search|promo|coupon|discount|gift|zip|postal)/i;

const SEGMENTED_CLASS_REGEX =
  /(?:otp[-_]?(?:box|digit|cell|field)|pin[-_]?(?:box|digit|cell|input)|digit[-_]?box)/i;

const FORM_TAG_REGEX = /<\/?(form|Form)\b([^>]*)>/gi;

/**
 * Checks whether an element line position is enclosed within an open `<form>` or `<Form>` tag.
 */
function isEnclosedInForm(documentText: string, targetLine: number): boolean {
  const strippedText = documentText
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const lines = strippedText.split('\n');
  const textBefore = lines.slice(0, targetLine - 1).join('\n');

  let depth = 0;
  let match: RegExpExecArray | null;
  FORM_TAG_REGEX.lastIndex = 0;

  while ((match = FORM_TAG_REGEX.exec(textBefore)) !== null) {
    const isClosing = match[0].startsWith('</');
    const attrs = match[2] ?? '';
    const isSelfClosing = attrs.trim().endsWith('/');

    if (isClosing) {
      depth = Math.max(0, depth - 1);
    } else if (!isSelfClosing) {
      depth++;
    }
  }

  if (depth > 0) {
    return true;
  }

  // Same-line form check: line contains <form or <Form before element
  const currentLine = lines[targetLine - 1] ?? '';
  if (/<(form|Form)\b/i.test(currentLine)) {
    const formIndex = currentLine.search(/<(form|Form)\b/i);
    const inputIndex = currentLine.search(/<input\b/i);
    if (formIndex !== -1 && (inputIndex === -1 || formIndex < inputIndex)) {
      return true;
    }
  }

  return false;
}

function getFormContext(documentText: string, targetLine: number): string {
  const lines = documentText.split('\n');
  const textBefore = lines.slice(Math.max(0, targetLine - 30), targetLine).join('\n');
  const formMatch = textBefore.match(/<(?:form|Form)\b([^>]*)>/i);
  return formMatch ? formMatch[1] ?? '' : '';
}

export const smsOtpFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: ['otp', 'passcode', 'verification', 'sms', '2fa', 'mfa', 'pin'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 0. Skip test fixtures, visual regression tests, and mock directories
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return null;
    }

    // 1. Skip non-interactive or non-text-entry inputs
    const type = (element.getAttribute('type') ?? 'text').toLowerCase();
    if (
      type === 'hidden' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'button' ||
      type === 'submit' ||
      type === 'reset' ||
      type === 'file' ||
      type === 'image'
    ) {
      return null;
    }

    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    // 2. Identify candidate OTP inputs
    const name = element.getAttribute('name') ?? '';
    const id = element.getAttribute('id') ?? '';
    const placeholder = element.getAttribute('placeholder') ?? '';
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    const className = element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    const combinedIdentifiers = `${name} ${id} ${placeholder} ${ariaLabel} ${className}`.toLowerCase();

    if (NON_OTP_EXCLUSION_REGEX.test(combinedIdentifiers)) {
      return null;
    }

    const hasExplicitOtpIdentifier = OTP_IDENTIFIER_REGEX.test(combinedIdentifiers);
    const formContext = getFormContext(ctx.documentText, element.line);
    const isInsideOtpForm =
      /(?:otp|verification|verify|two[-_]?factor|2fa|mfa)/i.test(formContext) &&
      (name.toLowerCase().includes('code') || id.toLowerCase().includes('code') || placeholder.toLowerCase().includes('code'));

    if (!hasExplicitOtpIdentifier && !isInsideOtpForm) {
      return null;
    }

    // 3. Check for segmented multi-box inputs (single-character boxes)
    const maxLength = element.getAttribute('maxlength') ?? element.getAttribute('maxLength') ?? '';
    const isSegmentedBox =
      maxLength === '1' ||
      SEGMENTED_CLASS_REGEX.test(className) ||
      (element.getAttribute('size') === '1' && hasExplicitOtpIdentifier);

    if (isSegmentedBox) {
      return {
        message:
          'Segmented multi-box OTP input breaks autofill and copy-paste; use a single <input autocomplete="one-time-code" inputmode="numeric"> instead.',
        subPattern: 'segmented 6-box OTP input with keyup focus jumping',
      };
    }

    // 4. Check for type="number" or type="tel" anti-patterns
    if (type === 'number' || type === 'tel') {
      return {
        message:
          `Never use type="${type}" for OTP codes; use type="text" with inputmode="numeric" and autocomplete="one-time-code".`,
        subPattern:
          'OTP input using type="number" or type="tel" instead of type="text" with inputmode="numeric"',
      };
    }

    // 5. Check autocomplete attribute
    const autocomplete = (
      element.getAttribute('autocomplete') ?? element.getAttribute('autoComplete') ?? ''
    ).toLowerCase().trim();

    if (autocomplete.includes('one-time-code')) {
      return null;
    }

    // Input lacks autocomplete="one-time-code"
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
      'The input is an OTP or two-factor authentication verification code field that lacks autocomplete="one-time-code".',
      'The OTP input uses type="number" or type="tel" instead of type="text" with inputmode="numeric".',
      'The form uses segmented multi-box inputs (maxlength="1" single-digit boxes) for OTP entry rather than a single input.',
    ],
    dropWhen: [
      'The input already specifies autocomplete="one-time-code".',
      'The input is a standard password or credential field without OTP verification context.',
      'The input is a credit card CVV/CVC code or postal/zip code.',
      'The input is disabled, readonly, hidden, or a non-interactive display widget.',
    ],
  },
};

export const smsOtpFormRules: readonly AnalyzerRule[] = [
  smsOtpFormRule,
];
