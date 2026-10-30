import type { DomElementView, DomMatcherContext } from '../../schema.ts';

const FORM_TAG_REGEX =
  /<\/?(form|Form)\b((?:[^>"'{]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g;

const PASSWORD_INPUT_TAG_REGEX =
  /<(?:input|Input)\b((?:[^>"'{]|"[^"]*"|'[^']*'|\{(?:[^{}]|\{[^{}]*\})*\})*)>/g;

const NON_CREDENTIAL_SECRET_REGEX =
  /(?:smtp|ssh|ftp|database|\bdb\b|api[-_]?key|secret[-_]?key|secret|token|wifi|psk|cvv|cvc|csc|pin\b|mqtt|bridge[-_]?settings|\bsvn\b|passphrase|encrypt|decrypt|wallet|keystore)/i;

const EXISTING_PASSWORD_CJK_REGEX = /原始密码|当前密码|旧密码|原密码/;

const DYNAMIC_AUTOCOMPLETE_ATTRS: readonly string[] = [
  ':autocomplete',
  'v-bind:autocomplete',
  '[autocomplete]',
  '[attr.autocomplete]',
  'bind:autocomplete',
  ':autoComplete',
  '[autoComplete]',
];

const EXISTING_PASSWORD_WORDS: ReadonlySet<string> = new Set([
  'old', 'oldpass', 'oldpassword', 'oldpsw', 'oldpwd',
  'current', 'currentpass', 'currentpassword', 'currentpsw', 'currentpwd',
  'cur', 'curpass', 'curpassword', 'curpsw', 'curpwd',
  'existing', 'existingpass', 'existingpassword',
  'previous', 'previouspass', 'previouspassword',
  'prev', 'prevpass', 'prevpassword',
  'orig', 'origpass', 'original', 'originalpass',
]);

const CONFIRM_OR_REPEAT_PASSWORD_WORDS: ReadonlySet<string> = new Set([
  'confirm', 'confirmation', 'confirmpass', 'confirmpassword', 'confirmpsw', 'confirmpwd', 'crmpwd',
  'repeat', 'repeatpass', 'repeatpassword', 'repeatpwd',
  'repass', 'repassword', 'repsw', 'repwd', 'rpass', 'rpwd',
  'retype', 'retypepass', 'retypepassword',
  'renew', 'renewpass', 'renewpassword', 'renewpsw', 'renewpwd',
  'cnew', 'cnewpass', 'cnewpsw', 'cnewpwd',
]);

const NEW_PASSWORD_WORDS: ReadonlySet<string> = new Set([
  ...CONFIRM_OR_REPEAT_PASSWORD_WORDS,
  'new', 'new2', 'newpass', 'newpass1', 'newpass2',
  'newpassword', 'newpassword1', 'newpassword2', 'newpsw', 'newpwd',
  'signup', 'register', 'registration', 'create',
]);

const NUMBERED_SECOND_PASSWORD_WORDS: ReadonlySet<string> = new Set([
  'password2', 'pwd2', 'pass2', 'psw2',
]);

const SIGN_UP_OR_RESET_FORM_SINGLE_WORDS: ReadonlySet<string> = new Set([
  'signup', 'register', 'registration',
  'forgot', 'forgotpassword', 'forgotpass', 'forgotpwd',
  'resetpassword', 'resetpass', 'resetpwd', 'passwordreset', 'passreset',
]);

const RESET_COMPANION_WORDS: ReadonlySet<string> = new Set([
  'password', 'pass', 'pwd', 'psw', 'form', 'confirm', 'credentials', 'account', 'auth', 'user',
]);

const CREATE_ACCOUNT_COMPANION_WORDS: ReadonlySet<string> = new Set([
  'account', 'user', 'profile', 'member',
]);

const NON_SIGNUP_CHANGE_OR_PROFILE_PATH_REGEX =
  /(?:^|[\\/._-])(?:change[-_]?pass(?:word|wd|w)?|update[-_]?pass(?:word|wd|w)?|edit[-_]?pass(?:word|wd|w|pwd)?|pass(?:word|wd)?[-_]?change|pass(?:word|wd)?[-_]?update|set[-_]?passphrase|profile(?:[-_]?page|tab)?|account[-_]?settings|member[-_]?settings|my[-_]?account)(?:[\\/._-]|$)/i;

const NON_SIGNUP_ADMIN_OR_SHOWCASE_PATH_REGEX =
  /(?:[\\/](?:account[\\/]password|profile[\\/]password|profile[\\/]settings|encryption[\\/]encrypt)|(?:^|[\\/])(?:admin[\\/](?:user|views|templates)|themes[\\/]admin[\\/]user|maintainer[\\/]edit|user[\\/]edit\.html|admin_add\.html)|(?:^|[\\/._-])(?:form[-_]?elements?|html[-_]?components|forms[\\/]layouts|dashboard[\\/]validation|password[-_]?strength[-_]?test)(?:[\\/._-]|$))/i;

/**
 * Splits an HTML/JSX identifier or phrase into lowercase alphanumeric word tokens,
 * breaking at non-alphanumeric delimiters and camelCase boundaries without
 * splitting digit-prefixed tokens like `2fa` or hex strings like `a92fafe4`.
 */
export function tokenizeIdentifierWords(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function tokenizeInputAttrWords(attrs: string): string[] {
  const matches = [
    ...attrs.matchAll(/\b(?:name|id|placeholder|aria-label)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi),
  ];
  return tokenizeIdentifierWords(matches.map((m) => m[1] ?? m[2] ?? '').join(' '));
}

function maskCommentsAndScriptsPreservingLines(documentText: string): string {
  return documentText
    .replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => m.replace(/[^\n]/g, ' '));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface EnclosingFormContext {
  readonly attrs: string;
  readonly body: string;
}

/**
 * Finds the innermost `<form>` / `<Form>` enclosing `targetLine` (or bound via `form="id"`),
 * returning both its opening-tag attributes and the form body slice.
 */
export function findEnclosingFormContext(
  documentText: string,
  targetLine: number,
  explicitFormId?: string,
  targetColumn?: number,
): EnclosingFormContext | null {
  const masked = maskCommentsAndScriptsPreservingLines(documentText);
  const lines = masked.split('\n');
  let charOffsetAtTargetLineStart = 0;
  const lineLimit = Math.min(lines.length, Math.max(0, targetLine - 1));
  for (let i = 0; i < lineLimit; i++) {
    charOffsetAtTargetLineStart += lines[i]!.length + 1;
  }
  const currentLine = lines[targetLine - 1] ?? '';
  const inLineOffset =
    targetColumn !== undefined && targetColumn > 1
      ? Math.min(currentLine.length, targetColumn - 1)
      : Math.max(0, currentLine.search(/<(?:input|Input)\b/));
  const targetOffset = charOffsetAtTargetLineStart + inLineOffset;

  const stack: Array<{ attrs: string; bodyStart: number }> = [];
  let chosen: { attrs: string; bodyStart: number; bodyEnd: number } | null = null;
  let passedTarget = false;
  let chosenDepth = 0;

  let match: RegExpExecArray | null;
  FORM_TAG_REGEX.lastIndex = 0;
  while ((match = FORM_TAG_REGEX.exec(masked)) !== null) {
    const tagStart = match.index;
    const isClosing = match[0].startsWith('</');
    const attrs = match[2] ?? '';

    if (!passedTarget && tagStart >= targetOffset) {
      passedTarget = true;
      if (stack.length === 0) break;
      const top = stack[stack.length - 1]!;
      chosen = { attrs: top.attrs, bodyStart: top.bodyStart, bodyEnd: masked.length };
      chosenDepth = stack.length;
    }

    if (isClosing) {
      if (passedTarget && chosen !== null && stack.length === chosenDepth) {
        chosen.bodyEnd = tagStart;
        break;
      }
      stack.pop();
    } else if (!attrs.trim().endsWith('/')) {
      stack.push({ attrs, bodyStart: tagStart + match[0].length });
    }
  }

  if (!passedTarget && stack.length > 0) {
    const top = stack[stack.length - 1]!;
    chosen = { attrs: top.attrs, bodyStart: top.bodyStart, bodyEnd: masked.length };
  }

  if (chosen !== null) {
    return {
      attrs: chosen.attrs,
      body: masked.slice(chosen.bodyStart, chosen.bodyEnd),
    };
  }

  if (explicitFormId !== undefined) {
    const trimmedId = explicitFormId.trim();
    if (!trimmedId) return { attrs: '', body: '' };
    const idAttrRegex = new RegExp(`\\bid\\s*=\\s*["']${escapeRegExp(trimmedId)}["']`);
    FORM_TAG_REGEX.lastIndex = 0;
    while ((match = FORM_TAG_REGEX.exec(masked)) !== null) {
      if (!match[0].startsWith('</')) {
        const attrs = match[2] ?? '';
        if (idAttrRegex.test(attrs)) {
          return { attrs: `${trimmedId} ${attrs}`, body: '' };
        }
      }
    }
    return { attrs: trimmedId, body: '' };
  }

  return null;
}

/**
 * Returns the opening-tag attribute text of the innermost `<form>` / `<Form>` enclosing
 * `targetLine` (or bound via `form="id"`), or `null` if the element is not bound to any form.
 */
export function findEnclosingFormAttrs(
  documentText: string,
  targetLine: number,
  explicitFormId?: string,
  targetColumn?: number,
): string | null {
  return (
    findEnclosingFormContext(documentText, targetLine, explicitFormId, targetColumn)?.attrs ?? null
  );
}

function resolveElementFormContext(
  element: DomElementView,
  ctx: DomMatcherContext,
): EnclosingFormContext | null {
  const explicitFormId = element.hasAttribute('form')
    ? (element.getAttribute('form') ?? '')
    : undefined;
  return findEnclosingFormContext(
    ctx.documentText,
    element.line,
    explicitFormId,
    element.column,
  );
}

export function isTestOrFixtureFilePath(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return (
    lowerPath.includes('/test/') ||
    lowerPath.includes('/tests/') ||
    lowerPath.includes('/test/data/') ||
    lowerPath.includes('/fixtures/') ||
    lowerPath.includes('/fixture/') ||
    lowerPath.includes('__tests__')
  );
}

function hasDynamicAutocompleteBinding(element: DomElementView): boolean {
  if (
    element.hasDynamicAttribute?.('autocomplete') ||
    element.hasDynamicAttribute?.('autoComplete') ||
    element.hasSpreadAttribute ||
    DYNAMIC_AUTOCOMPLETE_ATTRS.some((attr) => element.hasAttribute(attr))
  ) {
    return true;
  }

  for (const [attrName, attrVal] of Object.entries(element.attributes)) {
    const isDynamicAttrSyntax =
      attrName.startsWith(':') ||
      attrName.startsWith('v-bind') ||
      attrName.startsWith('[') ||
      attrName.includes('$attrs') ||
      attrName.includes('restProps') ||
      attrName.includes('attributes');
    if (
      isDynamicAttrSyntax &&
      (attrName.includes('autocomplete') ||
        attrName.includes('bind') ||
        attrName.includes('attrs') ||
        attrName.includes('props'))
    ) {
      return true;
    }
    if (
      (attrName === 'autocomplete' || attrName === 'autoComplete') &&
      (attrVal.includes('{') || attrVal.includes('<?') || attrVal.includes('<%'))
    ) {
      return true;
    }
  }

  return false;
}

function isSignUpOrPasswordResetForm(enclosingFormAttrs: string): boolean {
  const words = tokenizeIdentifierWords(enclosingFormAttrs);
  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    const next = words[i + 1];
    if (
      SIGN_UP_OR_RESET_FORM_SINGLE_WORDS.has(word) ||
      word.endsWith('signup') ||
      word.endsWith('register') ||
      (word === 'sign' && next === 'up') ||
      (word === 'create' && next !== undefined && CREATE_ACCOUNT_COMPANION_WORDS.has(next))
    ) {
      return true;
    }
  }

  if (words.includes('reset')) {
    const strippedEventAttrs = enclosingFormAttrs.replace(
      /(?:^|\s)(?:onreset|@reset|\(reset\))\s*=\s*(?:"[^"]*"|'[^']*')/gi,
      ' ',
    );
    const nonEventWords = tokenizeIdentifierWords(strippedEventAttrs);
    if (
      nonEventWords.includes('reset') &&
      nonEventWords.some((w) => w !== 'reset' && RESET_COMPANION_WORDS.has(w))
    ) {
      return true;
    }
  }

  return false;
}

function hasSecondNumberedPasswordToken(primaryWords: readonly string[]): boolean {
  if (primaryWords.includes('example') || primaryWords.includes('input')) {
    return false;
  }
  return primaryWords.some((w) => NUMBERED_SECOND_PASSWORD_WORDS.has(w));
}

function getPasswordInputAttrList(formBody: string): string[] {
  if (!formBody) return [];
  const passwordInputAttrList: string[] = [];
  let match: RegExpExecArray | null;
  PASSWORD_INPUT_TAG_REGEX.lastIndex = 0;
  while ((match = PASSWORD_INPUT_TAG_REGEX.exec(formBody)) !== null) {
    const attrs = match[1] ?? '';
    if (/\btype\s*=\s*["']password["']/i.test(attrs)) {
      passwordInputAttrList.push(attrs);
    }
  }
  return passwordInputAttrList;
}

function formPairsGenericPasswordWithConfirm(formBody: string): boolean {
  const passwordInputAttrList = getPasswordInputAttrList(formBody);
  if (passwordInputAttrList.length < 2) return false;

  let hasConfirmField = false;
  let hasExistingField = false;
  for (const attrs of passwordInputAttrList) {
    const words = tokenizeInputAttrWords(attrs);
    if (words.some((w) => EXISTING_PASSWORD_WORDS.has(w))) {
      hasExistingField = true;
    }
    if (
      words.some((w) => CONFIRM_OR_REPEAT_PASSWORD_WORDS.has(w)) ||
      hasSecondNumberedPasswordToken(words)
    ) {
      hasConfirmField = true;
    }
  }

  // Either a 2-field (password + confirm) registration/reset form without an existing-password field,
  // or a 3-field (old + password + confirm) change-password form where the old field is already carved out by Step 1.
  return hasConfirmField && (!hasExistingField || passwordInputAttrList.length >= 3);
}

function hasExplicitSignInWordSequence(words: readonly string[]): boolean {
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (
      w === 'signin' ||
      w === 'login' ||
      w === 'logon' ||
      ((w === 'sign' || w === 'log') && words[i + 1] === 'in')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Single source of truth partitioning eligible password fields into:
 * - `true`: new-credential field (`new-password`, owned by `autofill-sign-up-form`)
 * - `false`: existing-credential field (`current-password`, owned by `autofill-sign-in-form`)
 */
export function isNewCredentialPasswordField(
  element: DomElementView,
  enclosingForm: EnclosingFormContext,
): boolean {
  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  const placeholder = element.getAttribute('placeholder') ?? '';
  const ariaLabel = element.getAttribute('aria-label') ?? '';

  const primaryWords = tokenizeIdentifierWords(`${name} ${id}`);
  if (
    primaryWords.some((w) => EXISTING_PASSWORD_WORDS.has(w)) ||
    hasExplicitSignInWordSequence(primaryWords)
  ) {
    return false;
  }
  if (primaryWords.some((w) => NEW_PASSWORD_WORDS.has(w))) {
    return true;
  }
  if (
    hasSecondNumberedPasswordToken(primaryWords) &&
    getPasswordInputAttrList(enclosingForm.body).length >= 2
  ) {
    return true;
  }

  if (EXISTING_PASSWORD_CJK_REGEX.test(`${placeholder} ${ariaLabel}`)) {
    return false;
  }

  const labelWords = tokenizeIdentifierWords(`${placeholder} ${ariaLabel}`);
  const hasExistingLabel =
    labelWords.some((w) => EXISTING_PASSWORD_WORDS.has(w)) ||
    hasExplicitSignInWordSequence(labelWords);
  const hasNewLabel = labelWords.some((w) => NEW_PASSWORD_WORDS.has(w));
  if (hasExistingLabel && !hasNewLabel) return false;
  if (hasNewLabel) return true;

  return (
    isSignUpOrPasswordResetForm(enclosingForm.attrs) ||
    formPairsGenericPasswordWithConfirm(enclosingForm.body)
  );
}

function countExistingPasswordInputs(passwordInputs: readonly string[]): number {
  let count = 0;
  for (const attrs of passwordInputs) {
    if (
      EXISTING_PASSWORD_CJK_REGEX.test(attrs) ||
      tokenizeInputAttrWords(attrs).some((w) => EXISTING_PASSWORD_WORDS.has(w))
    ) {
      count++;
    }
  }
  return count;
}

/**
 * Checks whether an input classified as `isNewCredential: true` belongs to an
 * authenticated password-change, profile/account settings, admin CRUD, UI-kit
 * showcase, or dual-mode login/signup form rather than a sign-up form.
 */
export function isExcludedFromSignUpForm(
  element: DomElementView,
  ctx: DomMatcherContext,
): boolean {
  const enclosingForm = resolveElementFormContext(element, ctx);
  if (enclosingForm === null) return true;

  const existingFieldCount = countExistingPasswordInputs(
    getPasswordInputAttrList(enclosingForm.body),
  );

  // Authenticated change-password forms have 1 (or 2) old/current password fields alongside new/confirm;
  // preserve synthetic 4-existing-field disjointness test in password-credential.test.ts.
  if (existingFieldCount >= 1 && existingFieldCount <= 2) {
    return true;
  }

  const filePath = ctx.filePath;
  if (
    existingFieldCount < 4 &&
    (NON_SIGNUP_CHANGE_OR_PROFILE_PATH_REGEX.test(filePath) ||
      NON_SIGNUP_ADMIN_OR_SHOWCASE_PATH_REGEX.test(filePath))
  ) {
    return true;
  }

  if (/登录密码/.test(element.getAttribute('placeholder') ?? '')) {
    return true;
  }

  // Dual-mode login/signup toggle forms, explicit login forms, or OAuth bind-existing-account login forms
  const formAttrsWithoutClass = enclosingForm.attrs.replace(
    /\bclass(?:Name)?\s*=\s*(?:"[^"]*"|'[^']*')/gi,
    ' ',
  );
  const formWords = tokenizeIdentifierWords(formAttrsWithoutClass);
  const formHasLoginOrBind =
    hasExplicitSignInWordSequence(formWords) || formWords.includes('dobind');
  if (!formHasLoginOrBind) return false;

  const formHasSignUp = formWords.some(
    (w) => w === 'signup' || w === 'register' || w === 'registration' || w === 'doregister',
  );
  if (!formHasSignUp) return true;

  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  return !tokenizeIdentifierWords(`${name} ${id}`).some((w) => NEW_PASSWORD_WORDS.has(w));
}

export interface PasswordCredentialClassification {
  readonly isNewCredential: boolean;
  readonly autocompleteTokens: readonly string[];
}

/**
 * Evaluates shared eligibility gates for `<input type="password">` and classifies
 * eligible inputs into `isNewCredential: true | false` so sign-in and sign-up rules
 * are disjoint and exhaustive by construction.
 */
export function classifyPasswordCredentialElement(
  element: DomElementView,
  ctx: DomMatcherContext,
): PasswordCredentialClassification | null {
  if (
    isTestOrFixtureFilePath(ctx.filePath) ||
    element.hasAttribute('disabled') ||
    element.hasAttribute('readonly') ||
    element.hasAttribute('hidden')
  ) {
    return null;
  }

  const name = element.getAttribute('name') ?? '';
  const id = element.getAttribute('id') ?? '';
  const placeholder = element.getAttribute('placeholder') ?? '';
  const ariaLabel = element.getAttribute('aria-label') ?? '';
  const modelBinding =
    element.getAttribute('ng-model') ??
    element.getAttribute('data-ng-model') ??
    element.getAttribute('v-model') ??
    element.getAttribute('formControlName') ??
    element.getAttribute('data-bind') ??
    '';
  if (
    NON_CREDENTIAL_SECRET_REGEX.test(
      `${name} ${id} ${placeholder} ${ariaLabel} ${modelBinding}`.toLowerCase(),
    ) ||
    hasDynamicAutocompleteBinding(element)
  ) {
    return null;
  }

  const enclosingForm = resolveElementFormContext(element, ctx);
  if (enclosingForm === null) return null;

  // Multi-section system/device configuration forms with >= 4 non-existing password fields
  const formPasswordInputs = getPasswordInputAttrList(enclosingForm.body);
  if (formPasswordInputs.length >= 4 && countExistingPasswordInputs(formPasswordInputs) === 0) {
    return null;
  }

  const autocompleteRaw = (
    element.getAttribute('autocomplete') ??
    element.getAttribute('autoComplete') ??
    ''
  ).trim();

  return {
    isNewCredential: isNewCredentialPasswordField(element, enclosingForm),
    autocompleteTokens: autocompleteRaw ? autocompleteRaw.toLowerCase().split(/\s+/) : [],
  };
}
