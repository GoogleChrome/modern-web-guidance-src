import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const AUTOFILL_ADDRESS_FORM_GUIDE_HASH = '31a1d6e904ab';

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
    const inputIndex = currentLine.search(/<(input|textarea)\b/i);
    if (formIndex !== -1 && (inputIndex === -1 || formIndex < inputIndex)) {
      return true;
    }
  }

  return false;
}

const ADDRESS_FIELD_TOKENS: ReadonlySet<string> = new Set([
  'street-address',
  'street_address',
  'streetaddress',
  'address_line_1',
  'address-line-1',
  'addressline1',
  'address_1',
  'address-1',
  'address1',
  'postal-code',
  'postal_code',
  'postalcode',
  'zipcode',
  'zip_code',
  'zip-code',
]);

const ADDRESS_FIELD_REGEX =
  /(?:^|[_-])(street[-_]?address|address[-_]?line[-_]?1|address1|postal[-_]?code|zip[-_]?code|zipcode)(?:$|[_-])/i;

const NON_POSTAL_QUALIFIER_REGEX =
  /(?:^|[_-])(?:email|ip|mac|wallet|url|server)(?:$|[_-])/i;

function isPostalAddressIdentifier(identifier: string): boolean {
  if (!identifier) {
    return false;
  }
  const lower = identifier.toLowerCase().trim();
  if (NON_POSTAL_QUALIFIER_REGEX.test(lower)) {
    return false;
  }
  if (ADDRESS_FIELD_TOKENS.has(lower)) {
    return true;
  }
  return ADDRESS_FIELD_REGEX.test(lower);
}

const DYNAMIC_AUTOCOMPLETE_ATTRS: readonly string[] = [
  ':autocomplete',
  'v-bind:autocomplete',
  '[autocomplete]',
  '[attr.autocomplete]',
  'bind:autocomplete',
  ':autoComplete',
  '[autoComplete]',
];

const autofillAddressFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input, textarea',
  fastTokens: ['address', 'postal', 'zip'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 1. High-precision file type constraint: skip XML/XFA specs, test fixtures, or non-web templates
    const lowerPath = ctx.filePath.toLowerCase();
    const isSupportedFile =
      lowerPath.endsWith('.html') ||
      lowerPath.endsWith('.htm') ||
      lowerPath.endsWith('.jsx') ||
      lowerPath.endsWith('.tsx');

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

    // 2. Skip non-address, non-text, or search inputs
    const type = element.getAttribute('type')?.toLowerCase().trim() ?? 'text';
    if (
      type === 'search' ||
      type === 'hidden' ||
      type === 'checkbox' ||
      type === 'radio' ||
      type === 'submit' ||
      type === 'button' ||
      type === 'reset' ||
      type === 'email' ||
      type === 'url' ||
      type === 'tel' ||
      type === 'password'
    ) {
      return null;
    }

    // 3. Skip non-interactive inputs
    if (
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden')
    ) {
      return null;
    }

    // 4. Skip dynamic attributes or spread attributes in JSX and framework templates
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

    // 5. Must explicitly denote a postal address field by name or id
    const name = element.getAttribute('name')?.trim() ?? '';
    const id = element.getAttribute('id')?.trim() ?? '';

    // Search query or filter boxes are exempt
    if (
      name.toLowerCase().includes('search') ||
      id.toLowerCase().includes('search')
    ) {
      return null;
    }

    if (!isPostalAddressIdentifier(name) && !isPostalAddressIdentifier(id)) {
      return null;
    }

    // 6. Check autocomplete attribute (accept valid non-off values)
    const autocomplete = (
      element.getAttribute('autocomplete') ??
      element.getAttribute('autoComplete')
    )?.trim().toLowerCase();
    if (autocomplete && autocomplete !== 'off') {
      return null;
    }

    // 7. Must be enclosed within a form or bound to one via `form` attribute
    const hasFormBinding =
      element.hasAttribute('form') || isEnclosedInForm(ctx.documentText, element.line);
    if (!hasFormBinding) {
      return null;
    }

    const matchedField = name || id;
    const isTextarea = element.tagName.toLowerCase() === 'textarea';
    const isPostal =
      matchedField.toLowerCase().includes('zip') ||
      matchedField.toLowerCase().includes('postal');
    const targetToken = isPostal
      ? 'postal-code'
      : isTextarea
        ? 'street-address'
        : 'address-line1';

    return {
      message:
        `Address form field ("${matchedField}") inside form lacks autocomplete="${targetToken}"; add standard autocomplete (${isTextarea ? 'street-address' : 'address-line1'}${isPostal ? '' : ' / street-address'}) to enable browser autofill.`,
    };
  },
};

export const autofillAddressFormRule: AnalyzerRule = {
  id: 'autofill-address-form',
  guideId: 'autofill-address-form',
  guideHash: AUTOFILL_ADDRESS_FORM_GUIDE_HASH,
  summary:
    'Postal address form fields (<input> or <textarea>) inside a <form> should specify standard autocomplete attributes (e.g. street-address, postal-code).',
  matcher: autofillAddressFormMatcher,
  verifierRubric: {
    keepWhen: [
      'The input or textarea is part of an address, billing, checkout, or shipping form collecting postal street address or postal code data.',
      'The field lacks a standard autocomplete attribute or specifies autocomplete="off", preventing browser and password-manager address autofill.',
    ],
    dropWhen: [
      'The input is a search box, filter query, or location search autocomplete input (type="search" or search field).',
      'The input is disabled, readonly, hidden, or part of a non-form test fixture or XML data schema.',
      'The component receives its autocomplete attribute dynamically via props, context, or JSX spread.',
    ],
  },
};

export default [
  autofillAddressFormRule,
] satisfies readonly AnalyzerRule[];
