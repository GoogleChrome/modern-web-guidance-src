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

const VALID_USERNAME_AUTOCOMPLETE_TOKENS: ReadonlySet<string> = new Set([
  'username',
  'email',
]);

const NON_CREDENTIAL_INPUT_TYPES: ReadonlySet<string> = new Set([
  'hidden',
  'submit',
  'button',
  'checkbox',
  'radio',
  'file',
  'reset',
  'image',
]);

const USERNAME_NAME_ID_REGEX = /(user|login|email|account)/i;
const EXCLUDED_FIELD_NAMES = /(search|first_name|last_name|fname|lname|phone|tel|zip|postal|address|city|country|state|otp|captcha|pin|code)/i;

const FORM_TAG_REGEX = /<\/?(form|Form)\b([^>]*)>/gi;

interface FormSpan {
  startLine: number;
  endLine: number;
  formId: string | null;
  hasPasswordInput: boolean;
}

/**
 * Parses form boundaries and detects whether each form contains a password input.
 */
function parseFormSpans(documentText: string): FormSpan[] {
  const spans: FormSpan[] = [];
  const lines = documentText.split('\n');
  const stack: Array<{ startLine: number; formId: string | null; formText: string[] }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNum = i + 1;

    FORM_TAG_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FORM_TAG_REGEX.exec(line)) !== null) {
      const isClosing = match[0].startsWith('</');
      const attrs = match[2] ?? '';
      const isSelfClosing = attrs.trim().endsWith('/');

      if (isClosing) {
        const popped = stack.pop();
        if (popped) {
          popped.formText.push(line);
          const fullText = popped.formText.join('\n');
          const hasPasswordInput =
            /type\s*=\s*["']?password\b/i.test(fullText) ||
            /type\s*=\s*\{\s*["']password["']\s*\}/i.test(fullText);
          spans.push({
            startLine: popped.startLine,
            endLine: lineNum,
            formId: popped.formId,
            hasPasswordInput,
          });
        }
      } else if (!isSelfClosing) {
        const idMatch = /\bid\s*=\s*["']([^"']+)["']/i.exec(attrs);
        const formId = idMatch ? (idMatch[1] ?? null) : null;
        stack.push({
          startLine: lineNum,
          formId,
          formText: [line],
        });
      }
    }

    for (const openForm of stack) {
      if (openForm.startLine !== lineNum) {
        openForm.formText.push(line);
      }
    }
  }

  while (stack.length > 0) {
    const popped = stack.pop()!;
    const fullText = popped.formText.join('\n');
    const hasPasswordInput =
      /type\s*=\s*["']?password\b/i.test(fullText) ||
      /type\s*=\s*\{\s*["']password["']\s*\}/i.test(fullText);
    spans.push({
      startLine: popped.startLine,
      endLine: lines.length,
      formId: popped.formId,
      hasPasswordInput,
    });
  }

  return spans;
}

function findEnclosingForm(
  spans: readonly FormSpan[],
  targetLine: number,
  formAttr: string | null,
): FormSpan | null {
  if (formAttr) {
    const matching = spans.find((s) => s.formId === formAttr);
    if (matching) {
      return matching;
    }
  }

  for (let i = spans.length - 1; i >= 0; i--) {
    const s = spans[i]!;
    if (targetLine >= s.startLine && targetLine <= s.endLine) {
      return s;
    }
  }

  return null;
}

const autofillSignInFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: ['password'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 1. Skip non-interactive or non-credential inputs
    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    const type = (element.getAttribute('type') ?? 'text').toLowerCase();
    if (NON_CREDENTIAL_INPUT_TYPES.has(type)) {
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

    const isPassword = type === 'password';
    const name = element.getAttribute('name') ?? '';
    const id = element.getAttribute('id') ?? '';
    const nameOrId = `${name} ${id}`;

    const isUsernameCandidate =
      !isPassword &&
      (type === 'email' ||
        USERNAME_NAME_ID_REGEX.test(nameOrId) ||
        (type === 'text' && !EXCLUDED_FIELD_NAMES.test(nameOrId)));

    if (!isPassword && !isUsernameCandidate) {
      return null;
    }

    // 4. Must be enclosed within a form or explicitly bound via the `form` attribute
    const formAttr = element.getAttribute('form');
    const spans = parseFormSpans(ctx.documentText);
    const form = findEnclosingForm(spans, element.line, formAttr);

    if (!form) {
      return null;
    }

    // Companion username/email inputs only apply if the form also contains a password input
    if (!isPassword && !form.hasPasswordInput) {
      return null;
    }

    // 5. Check existing autocomplete attribute value
    const autocompleteAttr = element.getAttribute('autocomplete');
    if (isPassword) {
      if (autocompleteAttr) {
        const tokens = autocompleteAttr.trim().toLowerCase().split(/\s+/);
        const hasValidToken = tokens.some((token) =>
          VALID_PASSWORD_AUTOCOMPLETE_TOKENS.has(token),
        );
        if (hasValidToken) {
          return null;
        }
      }

      return {
        message:
          'Password input inside form lacks autocomplete="current-password" or autocomplete="new-password".',
      };
    }

    if (isUsernameCandidate) {
      if (autocompleteAttr) {
        const tokens = autocompleteAttr.trim().toLowerCase().split(/\s+/);
        const hasValidToken = tokens.some((token) =>
          VALID_USERNAME_AUTOCOMPLETE_TOKENS.has(token),
        );
        if (hasValidToken) {
          return null;
        }
      }

      return {
        message:
          'Username or email input inside form lacks autocomplete="username" or autocomplete="email".',
      };
    }

    return null;
  },
};

export const autofillSignInFormRule: AnalyzerRule = {
  id: 'autofill-sign-in-form',
  guideId: 'autofill-sign-in-form',
  guideHash: '93a1df14cafc',
  summary:
    'Sign-in and credential form inputs should specify autocomplete="current-password" / "new-password" for password and autocomplete="username" / "email" for the companion username/email field.',
  matcher: autofillSignInFormMatcher,
  phase2Rubric: {
    keepWhen: [
      'The password input is part of a user-facing authentication, registration, password change, or sign-in form.',
      'The companion username or email input is part of a credential or sign-in form containing a password field.',
      'The input lacks an autocomplete attribute or specifies autocomplete="off" on credentials, preventing browser autofill.',
    ],
    dropWhen: [
      'The input is disabled, readonly, hidden, or a non-interactive display widget.',
      'The password input already provides a valid credential autocomplete token (such as "current-password", "new-password", or "one-time-code").',
      'The companion username/email input already provides a valid autocomplete token ("username" or "email").',
      'The input is not contained within a form or form-like authentication context.',
      'The component receives its autocomplete attribute dynamically via props, context, or JSX spread.',
      'The input is an unrelated form field (e.g. search, address, profile bio) that is not the primary username/email credential identifier.',
    ],
  },
};

export const autofillSignInFormRules: readonly AnalyzerRule[] = [
  autofillSignInFormRule,
];
