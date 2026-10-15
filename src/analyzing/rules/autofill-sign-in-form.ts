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
  const lines = documentText.split('\n');
  const textBefore = lines.slice(0, targetLine).join('\n');

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

  return depth > 0;
}

const autofillSignInFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="password"]',
  fastTokens: ['password'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 1. Skip non-interactive or non-credential password inputs
    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    // 2. Skip inputs with dynamic autocomplete attributes in JSX
    if (element.hasDynamicAttribute?.('autocomplete')) {
      return null;
    }

    // 3. Skip if spread attributes could supply autocomplete
    if (element.hasSpreadAttribute) {
      return null;
    }

    // 4. Check existing autocomplete attribute value
    const autocompleteAttr = element.getAttribute('autocomplete');
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

    return {
      message:
        'Password input inside form lacks autocomplete="current-password" or autocomplete="new-password".',
    };
  },
};

export const autofillSignInFormRule: AnalyzerRule = {
  id: 'autofill-sign-in-form',
  guideId: 'autofill-sign-in-form',
  guideHash: '93a1df14cafc',
  summary:
    'Password input in sign-in or credential form should specify autocomplete="current-password" or autocomplete="new-password".',
  matcher: autofillSignInFormMatcher,
  phase2Rubric: {
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
