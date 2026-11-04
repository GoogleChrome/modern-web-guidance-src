import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';
import { classifyPasswordCredentialElement } from './helpers/password-credential.ts';

const VALID_PASSWORD_AUTOCOMPLETE_TOKENS: ReadonlySet<string> = new Set([
  'current-password',
  'new-password',
  'one-time-code',
]);

const CONFIG_SECRET_INPUT_REGEX =
  /(?:proxy|database|\bdb[-_.]?(?:config|pass|pwd)|db[A-Z]|\bdb\b|smtp|webhook|api[-_]?key|apikey|client[-_]?secret)/i;

function isConfigSecretElement(element: DomElementView): boolean {
  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  const placeholder = element.getAttribute('placeholder') ?? '';
  const ariaLabel = element.getAttribute('aria-label') ?? '';
  const modelBinding =
    element.getAttribute('v-model') ??
    element.getAttribute('ng-model') ??
    element.getAttribute('data-ng-model') ??
    element.getAttribute('formControlName') ??
    element.getAttribute('data-bind') ??
    '';
  const combined = `${name} ${id} ${placeholder} ${ariaLabel} ${modelBinding}`.toLowerCase();
  return CONFIG_SECRET_INPUT_REGEX.test(combined);
}

const autofillSignInFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="password"]',
  fastTokens: ['password'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (isConfigSecretElement(element)) {
      return null;
    }

    const classification = classifyPasswordCredentialElement(element, ctx);
    if (!classification || classification.isNewCredential) {
      return null;
    }

    const hasValidToken = classification.autocompleteTokens.some((token) =>
      VALID_PASSWORD_AUTOCOMPLETE_TOKENS.has(token),
    );
    if (hasValidToken) {
      return null;
    }

    return {
      message:
        'Password input inside sign-in or credential form lacks autocomplete="current-password".',
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
      'The password input is part of a user-facing authentication, current-password verification, or sign-in form.',
      'The password input lacks an autocomplete attribute or specifies autocomplete="off" on credentials, preventing browser password manager autofill.',
    ],
    dropWhen: [
      'The password input is disabled, readonly, hidden, or a non-interactive display widget.',
      'The password input already provides a valid credential autocomplete token (such as "current-password", "new-password", or "one-time-code").',
      'The password input is for creating or confirming a new password (owned by autofill-sign-up-form).',
      'The password input is for external service, infrastructure, or device configuration (such as database connections, proxy credentials, SMTP settings, webhooks, or API keys/tokens).',
      'The input is not contained within a form or form-like authentication context.',
      'The component receives its autocomplete attribute dynamically via props, context, or JSX spread.',
    ],
  },
};

export default [
  autofillSignInFormRule,
] satisfies readonly AnalyzerRule[];
