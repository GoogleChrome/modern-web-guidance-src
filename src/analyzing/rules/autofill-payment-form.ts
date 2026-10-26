import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const AUTOFILL_PAYMENT_FORM_GUIDE_HASH = '2548c8a287fc';

const FORM_TAG_REGEX = /<\/?(form|Form)\b([^>]*)>/gi;

/**
 * Checks whether an element line position is enclosed within an open `<form>` or `<Form>` tag.
 */
function isEnclosedInForm(documentText: string, targetLine: number): boolean {
  // Preserve line numbers when masking comments and script blocks
  const maskedText = documentText
    .replace(/<!--[\s\S]*?-->/g, (match) => ' '.repeat(match.length))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (match) => ' '.repeat(match.length));
  const lines = maskedText.split('\n');
  const textBefore = lines.slice(0, targetLine).join('\n');

  let depth = 0;
  let match: RegExpExecArray | null = null;
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
    const inputIndex = currentLine.search(/<(input|select)\b/i);
    if (formIndex !== -1 && (inputIndex === -1 || formIndex < inputIndex)) {
      return true;
    }
  }

  return false;
}

const VALID_PAYMENT_AUTOCOMPLETE_TOKENS: ReadonlySet<string> = new Set([
  'cc-number',
  'cc-name',
  'cc-given-name',
  'cc-additional-name',
  'cc-family-name',
  'cc-exp',
  'cc-exp-month',
  'cc-exp-year',
  'cc-csc',
  'cc-type',
  'transaction-amount',
  'transaction-currency',
]);

const CARD_NUMBER_REGEX =
  /(?:card[-_]?num(?:ber)?|cc[-_]?num(?:ber)?|credit[-_]?card|card[-_]?no|\bpan\b|(?:card|cc)[-_]?account[-_]?number)/i;

const NON_CARD_IDENTIFIERS_REGEX =
  /\b(?:bank|routing|iban|swift|gift[-_]?card|loyalty|phone|ssn|id[-_]?card|task[-_]?card|kanban|flashcard|trello|greeting[-_]?card|postcard|invitation)\b/i;

const NON_PAYMENT_SEARCH_FILTER_REGEX =
  /\b(?:search|filter|find|query|keyword|lookup|sort)\b/i;

const NON_PAYMENT_EXPIRATION_REGEX =
  /\b(?:session|token|cookie|password|coupon|promo|discount|voucher|auth|jwt|license|key|domain|ssl|cert|api[-_]?key)\b/i;

const PAYMENT_CONTEXT_REGEX =
  /\b(?:pay|payment|checkout|billing|credit[-_]?card|card[-_]?number|cvv|cvc|csc)\b/i;

const CARD_EXPIRATION_REGEX =
  /(?:cc[-_]?exp(?:ir(?:y|ation))?|card[-_]?exp|exp[-_]?date|exp[-_]?month|exp[-_]?year|\bexpiry\b|\bexpiration\b)/i;

const CARD_CSC_REGEX =
  /(?:\bcc[-_]?csc\b|\bcc[-_]?cvv\b|\bcc[-_]?cvc\b|\bcvv2?\b|\bcvc2?\b|\bcsc\b|\bcard[-_]?code\b|\bsecurity[-_]?code\b)/i;

const CARDHOLDER_NAME_REGEX =
  /(?:cc[-_]?name|cardholder[-_]?name|name[-_]?on[-_]?card|\bcardholder\b)/i;

const DYNAMIC_AUTOCOMPLETE_ATTRS: readonly string[] = [
  ':autocomplete',
  'v-bind:autocomplete',
  '[autocomplete]',
  '[attr.autocomplete]',
  'bind:autocomplete',
  ':autoComplete',
  '[autoComplete]',
];

export const autofillPaymentFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: ['card', 'cvv', 'cvc', 'csc', 'exp', 'credit', 'cc-'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 1. High-precision file type constraint
    const lowerPath = ctx.filePath.toLowerCase();
    const isSupportedFile =
      lowerPath.endsWith('.html') ||
      lowerPath.endsWith('.htm') ||
      lowerPath.endsWith('.jsx') ||
      lowerPath.endsWith('.tsx') ||
      lowerPath.endsWith('.vue') ||
      lowerPath.endsWith('.svelte') ||
      lowerPath.endsWith('.astro') ||
      lowerPath.endsWith('.php');

    if (!isSupportedFile) {
      return null;
    }

    if (
      lowerPath.includes('/test/') ||
      lowerPath.includes('/tests/') ||
      lowerPath.includes('/test/data/') ||
      lowerPath.includes('/fixtures/') ||
      lowerPath.includes('/fixture/') ||
      lowerPath.includes('__tests__')
    ) {
      return null;
    }

    // 2. Skip non-interactive, disabled, or display inputs
    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    // 3. Skip non-payment input types
    const rawType = element.getAttribute('type')?.toLowerCase().trim() ?? 'text';
    if (
      rawType === 'search' ||
      rawType === 'submit' ||
      rawType === 'button' ||
      rawType === 'reset' ||
      rawType === 'checkbox' ||
      rawType === 'radio' ||
      rawType === 'email' ||
      rawType === 'url' ||
      rawType === 'tel' ||
      rawType === 'range' ||
      rawType === 'file'
    ) {
      return null;
    }

    // 4. Skip dynamic framework attributes and JSX spread
    if (
      element.hasDynamicAttribute?.('autocomplete') ||
      element.hasDynamicAttribute?.('autoComplete') ||
      element.hasSpreadAttribute
    ) {
      return null;
    }

    for (const attr of DYNAMIC_AUTOCOMPLETE_ATTRS) {
      if (element.hasAttribute(attr)) {
        return null;
      }
    }

    for (const [attrName, attrVal] of Object.entries(element.attributes)) {
      if (
        attrName.startsWith(':') ||
        attrName.startsWith('v-bind') ||
        attrName.startsWith('[') ||
        attrName.includes('$attrs') ||
        attrName.includes('restProps') ||
        attrName.includes('attributes')
      ) {
        if (
          attrName.includes('autocomplete') ||
          attrName.includes('bind') ||
          attrName.includes('attrs') ||
          attrName.includes('props')
        ) {
          return null;
        }
      }
      if (
        (attrName === 'autocomplete' || attrName === 'autoComplete') &&
        (attrVal.includes('{') ||
          attrVal.includes('{{') ||
          attrVal.includes('<?') ||
          attrVal.includes('<%'))
      ) {
        return null;
      }
    }

    // 5. Must be enclosed within a form or explicitly bound via the `form` attribute
    const hasFormBinding =
      element.hasAttribute('form') || isEnclosedInForm(ctx.documentText, element.line);
    if (!hasFormBinding) {
      return null;
    }

    // 6. Inspect identifiers to classify payment field
    const name = element.getAttribute('name') ?? '';
    const id = element.getAttribute('id') ?? '';
    const placeholder = element.getAttribute('placeholder') ?? '';
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    const combinedIdentifiers = `${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();

    // Skip search / filter inputs
    if (NON_PAYMENT_SEARCH_FILTER_REGEX.test(combinedIdentifiers)) {
      return null;
    }

    // Skip non-card numbers such as bank accounts, routing, IBAN, gift cards, flashcards, kanban
    if (NON_CARD_IDENTIFIERS_REGEX.test(combinedIdentifiers)) {
      return null;
    }

    // 7. Check existing autocomplete attribute value
    const autocompleteAttr =
      element.getAttribute('autocomplete') ?? element.getAttribute('autoComplete');
    if (autocompleteAttr) {
      const tokens = autocompleteAttr.trim().toLowerCase().split(/\s+/);
      const hasValidToken = tokens.some((token) =>
        VALID_PAYMENT_AUTOCOMPLETE_TOKENS.has(token),
      );
      if (hasValidToken) {
        return null;
      }
    }

    // 8. Security code with type="password" anti-pattern check
    if (rawType === 'password') {
      if (CARD_CSC_REGEX.test(combinedIdentifiers)) {
        return {
          message:
            'Payment card security code uses type="password"; modernize to type="text" with inputmode="numeric" and autocomplete="cc-csc".',
        };
      }
      // If password field is not a CVV/CSC, let autofill-sign-in-form handle it
      return null;
    }

    // 9. Card number with type="number" anti-pattern check
    if (rawType === 'number' && CARD_NUMBER_REGEX.test(combinedIdentifiers)) {
      return {
        message:
          'Payment card number input uses type="number"; modernize to type="text" with inputmode="numeric" and autocomplete="cc-number".',
      };
    }

    // 10. Check specific payment card fields missing autocomplete
    if (CARD_NUMBER_REGEX.test(combinedIdentifiers)) {
      return {
        message:
          'Payment card number input inside form lacks autocomplete="cc-number".',
      };
    }

    if (CARD_EXPIRATION_REGEX.test(combinedIdentifiers)) {
      if (NON_PAYMENT_EXPIRATION_REGEX.test(combinedIdentifiers)) {
        return null;
      }
      // If it's a generic "expiry" or "expiration" without explicit exp date/month/year/card/cc pattern,
      // require payment context in the document text
      const isExplicitExpFormat =
        /(?:cc[-_]?exp|card[-_]?exp|exp[-_]?date|exp[-_]?month|exp[-_]?year)\b/i.test(
          combinedIdentifiers,
        );
      if (!isExplicitExpFormat && !PAYMENT_CONTEXT_REGEX.test(ctx.documentText)) {
        return null;
      }
      const isMonth = /month/i.test(combinedIdentifiers);
      const isYear = /year/i.test(combinedIdentifiers);
      const targetToken = isMonth ? 'cc-exp-month' : isYear ? 'cc-exp-year' : 'cc-exp';
      return {
        message: `Payment card expiration input inside form lacks autocomplete="${targetToken}".`,
      };
    }

    if (CARD_CSC_REGEX.test(combinedIdentifiers)) {
      return {
        message:
          'Payment card security code input inside form lacks autocomplete="cc-csc".',
      };
    }

    const isExplicitCardholder = CARDHOLDER_NAME_REGEX.test(combinedIdentifiers);
    const isGenericCardName = /(?:card[-_]?name)\b/i.test(combinedIdentifiers);
    if (isExplicitCardholder || (isGenericCardName && PAYMENT_CONTEXT_REGEX.test(ctx.documentText))) {
      return {
        message:
          'Payment cardholder name input inside form lacks autocomplete="cc-name".',
      };
    }

    return null;
  },
};

export const autofillPaymentFormRule: AnalyzerRule = {
  id: 'autofill-payment-form',
  guideId: 'autofill-payment-form',
  guideHash: AUTOFILL_PAYMENT_FORM_GUIDE_HASH,
  summary:
    'Payment card input in checkout form should specify standard autocomplete="cc-*" attributes and avoid type="password" or type="number".',
  matcher: autofillPaymentFormMatcher,
  verifierRubric: {
    keepWhen: [
      'The input is part of a payment, checkout, or billing form collecting payment card details (card number, expiration, security code, or cardholder name).',
      'The payment card input lacks an autocomplete attribute (e.g. autocomplete="cc-number", "cc-exp", "cc-csc", "cc-name") or specifies autocomplete="off", preventing browser payment autofill.',
      'The card number uses type="number" or card security code uses type="password", contrary to payment form best practices.',
    ],
    dropWhen: [
      'The input already provides a valid payment autocomplete token (such as "cc-number", "cc-exp", "cc-csc", "cc-name").',
      'The input collects non-card numbers such as bank routing numbers, IBAN, gift cards, loyalty cards, or phone numbers.',
      'The input is disabled, readonly, hidden, or display-only.',
      'The autocomplete attribute is bound dynamically via framework attributes or JSX spread.',
    ],
  },
};

export const autofillPaymentFormRules: readonly AnalyzerRule[] = [
  autofillPaymentFormRule,
];
