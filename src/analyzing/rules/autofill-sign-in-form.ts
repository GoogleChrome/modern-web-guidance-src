import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

const VALID_PASSWORD_AUTOCOMPLETE_TOKENS: ReadonlySet<string> = new Set([
  'current-password',
  'new-password',
  'one-time-code',
]);

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

const NON_CREDENTIAL_SECRET_REGEX =
  /(?:smtp|ssh|ftp|database|\bdb\b|api[-_]?key|secret|token|wifi|psk|cvv|cvc|csc|pin\b)/i;

const DYNAMIC_AUTOCOMPLETE_ATTRS: readonly string[] = [
  ':autocomplete',
  'v-bind:autocomplete',
  '[autocomplete]',
  '[attr.autocomplete]',
  'bind:autocomplete',
  ':autoComplete',
  '[autoComplete]',
];

const autofillSignInFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="password"]',
  fastTokens: ['password'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 0. Skip test fixtures, visual regression tests, and mock directories
    const lowerPath = ctx.filePath.toLowerCase();
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

    // 1. Skip non-interactive or non-credential password inputs
    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    // 2. Skip non-credential secrets (SMTP, SSH, DB, Wi-Fi, CVV)
    const name = element.getAttribute('name') ?? '';
    const id = element.getAttribute('id') ?? '';
    const placeholder = element.getAttribute('placeholder') ?? '';
    const ariaLabel = element.getAttribute('aria-label') ?? '';
    const combinedIdentifiers = `${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();
    if (NON_CREDENTIAL_SECRET_REGEX.test(combinedIdentifiers)) {
      return null;
    }

    // 3. Skip inputs with dynamic autocomplete or spread attributes in JSX and templates
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

    // 4. Check existing autocomplete attribute value
    const autocompleteAttr = (
      element.getAttribute('autocomplete') ??
      element.getAttribute('autoComplete')
    );
    if (autocompleteAttr) {
      const tokens = autocompleteAttr.trim().toLowerCase().split(/\s+/);
      const hasValidToken = tokens.some((token) =>
        VALID_PASSWORD_AUTOCOMPLETE_TOKENS.has(token),
      );
      if (hasValidToken) {
        return null;
      }
    }

    // 5. Must be enclosed within a form or explicitly bound via the `form` attribute
    const hasFormBinding =
      element.hasAttribute('form') || isEnclosedInForm(ctx.documentText, element.line);
    if (!hasFormBinding) {
      return null;
    }

    const isNewCredential =
      /(?:new|confirm|repeat|signup|register|change|create)/i.test(combinedIdentifiers);
    const targetToken = isNewCredential ? 'new-password' : 'current-password';
    const alternativeToken = isNewCredential ? 'current-password' : 'new-password';

    return {
      message:
        `Password input inside form lacks autocomplete="${targetToken}" (or autocomplete="${alternativeToken}").`,
    };
  },
};

export const autofillSignInFormRule: AnalyzerRule = {
  id: 'autofill-sign-in-form',
  guideId: 'autofill-sign-in-form',
  guideHash: '6b56be1d16b8',
  summary:
    'Password input in sign-in or credential form should specify autocomplete="current-password" or autocomplete="new-password".',
  matcher: autofillSignInFormMatcher,
  verifierRubric: {
    keepWhen: [
      'The password input is part of a user-facing authentication, registration, password change, or sign-in form.',
      'The password input lacks an autocomplete attribute or specifies autocomplete="off" on credentials, preventing browser password manager autofill.',
    ],
    dropWhen: [
      'The password input is disabled, readonly, hidden, or a non-interactive display widget.',
      'The password input already provides a valid credential autocomplete token (such as "current-password", "new-password", or "one-time-code").',
      'The input is not contained within a form or form-like authentication context.',
      'The component receives its autocomplete attribute dynamically via props, context, or JSX spread.',
    ],
  },
};

export const autofillSignInFormRules: readonly AnalyzerRule[] = [
  autofillSignInFormRule,
];
