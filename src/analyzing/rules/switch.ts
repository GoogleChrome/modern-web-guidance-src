import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SWITCH_GUIDE_HASH = '0b0a9d49545e';

const TREE_OR_ACCORDION_ID_REGEX =
  /(?:^|[-_])(?:toctree|tree|accordion|collapse|collapsible|drawer|dropdown|submenu)(?:$|[-_0-9])/i;

function isTreeDisclosureHack(
  element: DomElementView,
  ctx: DomMatcherContext,
): boolean {
  const classAttr =
    element.getAttribute('class') ?? element.getAttribute('className') ?? '';
  const idAttr = element.getAttribute('id') ?? '';
  const nameAttr = element.getAttribute('name') ?? '';
  if (
    TREE_OR_ACCORDION_ID_REGEX.test(classAttr) ||
    TREE_OR_ACCORDION_ID_REGEX.test(idAttr) ||
    TREE_OR_ACCORDION_ID_REGEX.test(nameAttr)
  ) {
    return true;
  }

  const lines = ctx.documentText.split(/\r?\n/);
  const startIdx = Math.max(0, element.line - 1);
  const windowText = lines.slice(startIdx, Math.min(lines.length, startIdx + 20)).join('\n');

  // CSS checkbox-hack toggling a sibling <ul>/<ol>/<nav> tree or menu after </label>
  return /<\/label>\s*<(?:ul|ol|nav)\b/i.test(windowText);
}

export const switchMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input[type="checkbox"][role="switch"]',
  fastTokens: [
    ['<input', '<Input'],
    ['checkbox'],
    ['role="switch"', "role='switch'"],
  ],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['switch'],
  matchElement: (element: DomElementView, ctx: DomMatcherContext) => {
    if (element.tagName !== 'input') {
      return null;
    }

    const typeAttr = (element.getAttribute('type') ?? '').trim().toLowerCase();
    const roleAttr = (element.getAttribute('role') ?? '').trim().toLowerCase();
    if (typeAttr !== 'checkbox' || roleAttr !== 'switch') {
      return null;
    }

    if (
      element.hasAttribute('switch') ||
      element.hasDynamicAttribute?.('switch')
    ) {
      return null;
    }

    if (isTreeDisclosureHack(element, ctx)) {
      return null;
    }

    return {
      message:
        '<input type="checkbox" role="switch"> lacks the native HTML switch attribute (<input type="checkbox" switch>).',
    };
  },
};

export const switchRule: AnalyzerRule = {
  id: 'switch',
  guideId: 'switch',
  guideHash: SWITCH_GUIDE_HASH,
  summary:
    '<input type="checkbox" role="switch"> elements should use the native HTML switch attribute (<input type="checkbox" switch>).',
  matcher: switchMatcher,
  verifierRubric: {
    keepWhen: [
      'An HTML or JSX <input type="checkbox" role="switch"> element implements a binary toggle switch without the native switch attribute.',
    ],
    dropWhen: [
      'The <input type="checkbox"> already has the native switch attribute.',
      'Standard checkbox controls without role="switch" or three-state toggle buttons.',
      'CSS checkbox-hack disclosure toggles that expand or collapse navigation trees, accordions, or sibling <ul> menus rather than rendering a switch control.',
      'Bespoke multi-layer SVG art demos driving sibling <svg> filters, gradients, or stroke-dasharray animations via :checked ~ sibling selectors.',
    ],
  },
};

export default [switchRule] satisfies readonly AnalyzerRule[];
