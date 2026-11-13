import { parseHTML } from 'linkedom';
import { tokenizeHtmlTags } from '../scanners/dom-scanner.ts';
import type {
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
} from '../schema.ts';

export const SWITCH_GUIDE_HASH = '0b0a9d49545e';

interface DomAttrLike {
  readonly name: string;
  readonly value: unknown;
}

interface DomElementLike {
  readonly tagName: string;
  readonly parentElement: DomElementLike | null;
  readonly children: Iterable<DomElementLike>;
  readonly attributes?: ReadonlyArray<DomAttrLike>;
  readonly content?: unknown;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
}

interface DomRootLike {
  readonly children?: Iterable<DomElementLike>;
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): Iterable<unknown>;
}

type HtmlTagToken = ReturnType<typeof tokenizeHtmlTags>[number];

interface SwitchDomCache {
  readonly domInputs: readonly DomElementLike[];
  readonly switchTokens: readonly HtmlTagToken[];
}

const JSX_OR_JS_EXTENSION_RE = /\.(?:[cm]?js|jsx|[cm]?ts|tsx)$/i;

const switchDomCache = new WeakMap<DomMatcherContext, SwitchDomCache>();

function isDomElementLike(value: unknown): value is DomElementLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tagName' in value &&
    typeof value.tagName === 'string' &&
    'hasAttribute' in value &&
    typeof value.hasAttribute === 'function' &&
    'getAttribute' in value &&
    typeof value.getAttribute === 'function' &&
    'children' in value
  );
}

function isDomRootLike(value: unknown): value is DomRootLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'querySelector' in value &&
    typeof value.querySelector === 'function' &&
    'querySelectorAll' in value &&
    typeof value.querySelectorAll === 'function'
  );
}

function isSwitchDomElement(el: DomElementLike): boolean {
  if (el.tagName.toLowerCase() !== 'input') {
    return false;
  }
  const typeAttr = (getOptionalAttr(el, 'type') ?? '').trim().toLowerCase();
  const roleAttr = (getOptionalAttr(el, 'role') ?? '').trim().toLowerCase();
  return typeAttr === 'checkbox' && roleAttr === 'switch';
}

function isSwitchHtmlToken(token: HtmlTagToken): boolean {
  if (token.tagName !== 'input') {
    return false;
  }
  const typeAttr = (token.attributes['type'] ?? '').trim().toLowerCase();
  const roleAttr = (token.attributes['role'] ?? '').trim().toLowerCase();
  return typeAttr === 'checkbox' && roleAttr === 'switch';
}

function collectSwitchInputsIncludingTemplates(
  root: DomRootLike,
): DomElementLike[] {
  const direct: DomElementLike[] = [];
  for (const node of root.querySelectorAll('input')) {
    if (isDomElementLike(node) && isSwitchDomElement(node)) {
      direct.push(node);
    }
  }
  if (!root.querySelector('template')) {
    return direct;
  }

  const directSet = new Set<DomElementLike>(direct);
  const ordered: DomElementLike[] = [];
  const walk = (container: DomRootLike | DomElementLike): void => {
    if (!container.children) {
      return;
    }
    for (const child of container.children) {
      if (!isDomElementLike(child)) {
        continue;
      }
      if (directSet.has(child)) {
        ordered.push(child);
      }
      if (
        child.tagName.toLowerCase() === 'template' &&
        isDomRootLike(child.content)
      ) {
        ordered.push(...collectSwitchInputsIncludingTemplates(child.content));
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return ordered;
}

function getOptionalAttr(
  el:
    | DomElementLike
    | Pick<DomElementView, 'hasAttribute' | 'getAttribute'>,
  attr: string,
): string | null {
  if (el.hasAttribute(attr)) {
    return el.getAttribute(attr) ?? null;
  }
  if ('attributes' in el && Array.isArray(el.attributes)) {
    const lowerAttr = attr.toLowerCase();
    for (const entry of el.attributes) {
      if (entry.name.toLowerCase() === lowerAttr) {
        return typeof entry.value === 'string' ? entry.value : '';
      }
    }
  }
  return null;
}

function normalizeOptionalClass(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return value.trim().replace(/\s+/g, ' ');
}

function sameOptionalAttr(
  domEl: DomElementLike,
  view: DomElementView,
  attr: string,
): boolean {
  const domVal = getOptionalAttr(domEl, attr);
  const viewVal = getOptionalAttr(view, attr);
  if (attr === 'class') {
    return normalizeOptionalClass(domVal) === normalizeOptionalClass(viewVal);
  }
  return domVal === viewVal;
}

function sameTokenGroupingKey(a: HtmlTagToken, b: HtmlTagToken): boolean {
  return (
    (a.attributes['id'] ?? null) === (b.attributes['id'] ?? null) &&
    (a.attributes['name'] ?? null) === (b.attributes['name'] ?? null) &&
    normalizeOptionalClass(a.attributes['class']) ===
      normalizeOptionalClass(b.attributes['class'])
  );
}

function resolveMatchingDomInput(
  element: DomElementView,
  ctx: DomMatcherContext,
): DomElementLike | null {
  if (JSX_OR_JS_EXTENSION_RE.test(ctx.filePath) || !ctx.documentText.trim()) {
    return null;
  }

  let cached = switchDomCache.get(ctx);
  if (!cached) {
    const { document } = parseHTML(ctx.documentText);
    const domInputs = isDomRootLike(document)
      ? collectSwitchInputsIncludingTemplates(document)
      : [];
    const switchTokens = tokenizeHtmlTags(ctx.documentText).filter(
      isSwitchHtmlToken,
    );
    cached = { domInputs, switchTokens };
    switchDomCache.set(ctx, cached);
  }

  const candidates = cached.domInputs.filter(
    (cand) =>
      sameOptionalAttr(cand, element, 'id') &&
      sameOptionalAttr(cand, element, 'name') &&
      sameOptionalAttr(cand, element, 'class'),
  );
  if (candidates.length === 0) {
    return null;
  }
  if (candidates.length === 1) {
    return candidates[0] ?? null;
  }

  const targetToken = cached.switchTokens.find(
    (tok) => tok.line === element.line && tok.column === element.column,
  );
  if (!targetToken) {
    return null;
  }

  let precedingCount = 0;
  for (const tok of cached.switchTokens) {
    if (tok === targetToken) {
      return candidates[precedingCount] ?? null;
    }
    if (sameTokenGroupingKey(tok, targetToken)) {
      precedingCount += 1;
    }
  }
  return null;
}

function isTreeDisclosureCheckboxHack(domInput: DomElementLike): boolean {
  const parent = domInput.parentElement;
  const container =
    parent?.tagName.toLowerCase() === 'label' ? parent.parentElement : parent;
  if (!container) {
    return false;
  }
  const tag = container.tagName.toLowerCase();
  const role = (container.getAttribute('role') ?? '').trim().toLowerCase();
  if (tag !== 'li' && role !== 'treeitem') {
    return false;
  }
  for (const child of container.children) {
    const childTag = child.tagName.toLowerCase();
    if (childTag === 'ul' || childTag === 'ol') {
      return true;
    }
  }
  return false;
}

export const switchMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'input',
  fastTokens: [
    ['checkbox'],
    ['switch'],
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
      element.hasDynamicAttribute?.('switch') ||
      element.hasAttribute('v-bind')
    ) {
      return null;
    }

    const domInput = resolveMatchingDomInput(element, ctx);
    if (domInput && isTreeDisclosureCheckboxHack(domInput)) {
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
