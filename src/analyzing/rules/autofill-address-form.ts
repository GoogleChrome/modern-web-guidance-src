import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const AUTOFILL_ADDRESS_FORM_GUIDE_HASH = '31a1d6e904ab';

const FORM_TAG_REGEX = /<\/?form\b([^>]*)>/gi;

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
  for (const match of textBefore.matchAll(FORM_TAG_REGEX)) {
    if (match[0].startsWith('</')) {
      depth = Math.max(0, depth - 1);
    } else if (!match[1]?.trim().endsWith('/')) {
      depth++;
    }
  }

  if (depth > 0) {
    return true;
  }

  // Same-line form check: line contains <form or <Form before element
  const currentLine = lines[targetLine - 1] ?? '';
  const formIndex = currentLine.search(/<form\b/i);
  const inputIndex = currentLine.search(/<(?:input|textarea)\b/i);
  return formIndex !== -1 && (inputIndex === -1 || formIndex < inputIndex);
}

const ADDRESS_FIELD_REGEX =
  /(?:^|[_-])(street[-_]?address|address[-_]?line[-_]?1|address1|postal[-_]?code|zip[-_]?code|zipcode)(?:$|[_-])/i;

const NON_POSTAL_QUALIFIER_REGEX =
  /(?:^|[_-])(?:email|ip|mac|wallet|url|server)(?:$|[_-])/i;

function isPostalAddressIdentifier(identifier: string): boolean {
  const lower = identifier.toLowerCase().trim();
  if (!lower || NON_POSTAL_QUALIFIER_REGEX.test(lower)) {
    return false;
  }
  return lower === 'address_1' || lower === 'address-1' || ADDRESS_FIELD_REGEX.test(lower);
}

const DYNAMIC_AUTOCOMPLETE_ATTRS: readonly string[] = [
  ':autocomplete',
  'v-bind:autocomplete',
  '[autocomplete]',
  '[attr.autocomplete]',
  'bind:autocomplete',
];

const SUPPORTED_EXTENSIONS = ['.html', '.htm', '.jsx', '.tsx'];
const TEST_PATH_SUBSTRINGS = ['/test/', '/tests/', '/fixtures/', '/fixture/', '__tests__'];

const NON_ADDRESS_INPUT_TYPES = new Set([
  'search',
  'hidden',
  'checkbox',
  'radio',
  'submit',
  'button',
  'reset',
  'email',
  'url',
  'tel',
  'password',
]);

const autofillAddressFormMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input, textarea',
  fastTokens: ['address', 'postal', 'zip'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['autocomplete', 'autoComplete'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    // 1. High-precision file type constraint: skip XML/XFA specs, test fixtures, or non-web templates
    const lowerPath = ctx.filePath.toLowerCase();
    if (
      !SUPPORTED_EXTENSIONS.some((ext) => lowerPath.endsWith(ext)) ||
      TEST_PATH_SUBSTRINGS.some((sub) => lowerPath.includes(sub))
    ) {
      return null;
    }

    // 2. Skip non-address, non-interactive, or dynamic-autocomplete inputs
    const type = element.getAttribute('type')?.toLowerCase().trim() ?? 'text';
    if (
      NON_ADDRESS_INPUT_TYPES.has(type) ||
      element.hasAttribute('disabled') ||
      element.hasAttribute('readonly') ||
      element.hasAttribute('hidden') ||
      DYNAMIC_AUTOCOMPLETE_ATTRS.some((attr) => element.hasAttribute(attr))
    ) {
      return null;
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
