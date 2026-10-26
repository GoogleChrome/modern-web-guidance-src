import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';
import { classifyPasswordCredentialElement } from './helpers/password-credential.ts';

export const AUTOFILL_SIGN_UP_FORM_GUIDE_HASH = '4e9ee5c2a3a0';

const SIGN_UP_SUB_PATTERN =
  '<input type="password"> in sign-up forms missing autocomplete="new-password"';

export const autofillSignUpFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="password"]',
  fastTokens: ['password'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    const classification = classifyPasswordCredentialElement(element, ctx);
    if (!classification || !classification.isNewCredential) {
      return null;
    }

    const { autocompleteTokens } = classification;
    if (
      autocompleteTokens.includes('new-password') ||
      autocompleteTokens.includes('one-time-code')
    ) {
      return null;
    }

    if (autocompleteTokens.includes('current-password')) {
      return {
        message:
          'Password input in sign-up or registration form specifies autocomplete="current-password" instead of autocomplete="new-password".',
        subPattern: SIGN_UP_SUB_PATTERN,
      };
    }

    if (autocompleteTokens.includes('off') || autocompleteTokens.includes('false')) {
      return {
        message:
          'Password input in sign-up or registration form specifies autocomplete="off" instead of autocomplete="new-password".',
        subPattern: SIGN_UP_SUB_PATTERN,
      };
    }

    return {
      message:
        'Password input in sign-up or registration form lacks autocomplete="new-password".',
      subPattern: SIGN_UP_SUB_PATTERN,
    };
  },
};

export const autofillSignUpFormRule: AnalyzerRule = {
  id: 'autofill-sign-up-form',
  guideId: 'autofill-sign-up-form',
  guideHash: AUTOFILL_SIGN_UP_FORM_GUIDE_HASH,
  summary:
    'Password inputs in sign-up, registration, or password creation forms should specify autocomplete="new-password".',
  matcher: autofillSignUpFormMatcher,
  verifierRubric: {
    keepWhen: [
      'The password input creates or confirms a new password in a registration, sign-up, account creation, password reset, or password change form.',
      'The password input lacks an autocomplete attribute or specifies autocomplete="off" / autocomplete="current-password" on new credentials, preventing browser password manager autofill or causing credential collision.',
    ],
    dropWhen: [
      'The password input is disabled, readonly, hidden, or a non-interactive display widget.',
      'The password input already provides autocomplete="new-password".',
      'The password input asks for an existing/old/current password in a login or change-password form (owned by autofill-sign-in-form).',
      'The component receives its autocomplete attribute dynamically via props, context, or JSX spread.',
    ],
  },
};

export const autofillSignUpFormRules: readonly AnalyzerRule[] = [
  autofillSignUpFormRule,
];
