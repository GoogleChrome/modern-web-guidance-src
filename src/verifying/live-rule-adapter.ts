/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Browser-safe adapter that executes Modern Web Guidance's calibrated
 * `DomRuleMatcher` and `CssRuleMatcher` rules from `src/analyzing/rules/`
 * directly against a live DOM tree and loaded CSSOM stylesheets.
 */

import animateToIntrinsicSizes from '../analyzing/rules/animate-to-intrinsic-sizes.ts';
import autofillAddressForm from '../analyzing/rules/autofill-address-form.ts';
import autofillPaymentForm from '../analyzing/rules/autofill-payment-form.ts';
import autofillSignInForm from '../analyzing/rules/autofill-sign-in-form.ts';
import autofillSignUpForm from '../analyzing/rules/autofill-sign-up-form.ts';
import checkbox from '../analyzing/rules/checkbox.ts';
import complexShapes from '../analyzing/rules/complex-shapes.ts';
import customTextDecorations from '../analyzing/rules/custom-text-decorations.ts';
import customizeScrollbarColorAndThickness from '../analyzing/rules/customize-scrollbar-color-and-thickness.ts';
import darkMode from '../analyzing/rules/dark-mode.ts';
import deliverOptimizedDecorativeImages from '../analyzing/rules/deliver-optimized-decorative-images.ts';
import dynamicSiblingAnimations from '../analyzing/rules/dynamic-sibling-animations.ts';
import dynamicSiblingStyling from '../analyzing/rules/dynamic-sibling-styling.ts';
import flickerFreeClientSideAbTesting from '../analyzing/rules/flicker-free-client-side-ab-testing.ts';
import icons from '../analyzing/rules/icons.ts';
import progress from '../analyzing/rules/progress.ts';
import secureExternalSubresources from '../analyzing/rules/secure-external-subresources.ts';
import selectMenuInteraction from '../analyzing/rules/select-menu-interaction.ts';
import stylingWebComponents from '../analyzing/rules/styling-web-components.ts';
import teaser from '../analyzing/rules/teaser.ts';
import validateInputAfterInteraction from '../analyzing/rules/validate-input-after-interaction.ts';
import type {
  AnalyzerRule,
  CssDeclaration,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  FastTokenSpec,
} from '../analyzing/schema.ts';

type DomAnalyzerRule = AnalyzerRule & { readonly matcher: DomRuleMatcher };
type CssAnalyzerRule = AnalyzerRule & { readonly matcher: CssRuleMatcher };

const BROWSER_ANALYZER_RULES: readonly AnalyzerRule[] = [
  ...animateToIntrinsicSizes,
  ...autofillAddressForm,
  ...autofillPaymentForm,
  ...autofillSignInForm,
  ...autofillSignUpForm,
  ...checkbox,
  ...complexShapes,
  ...customTextDecorations,
  ...customizeScrollbarColorAndThickness,
  ...darkMode,
  ...deliverOptimizedDecorativeImages,
  ...dynamicSiblingAnimations,
  ...dynamicSiblingStyling,
  ...flickerFreeClientSideAbTesting,
  ...icons,
  ...progress,
  ...secureExternalSubresources,
  ...selectMenuInteraction,
  ...stylingWebComponents,
  ...teaser,
  ...validateInputAfterInteraction,
];

export const LIVE_DOM_RULES: readonly DomAnalyzerRule[] = BROWSER_ANALYZER_RULES.filter(
  (r): r is DomAnalyzerRule => r.matcher.kind === 'dom',
);

export const LIVE_CSS_RULES: readonly CssAnalyzerRule[] = BROWSER_ANALYZER_RULES.filter(
  (r): r is CssAnalyzerRule => r.matcher.kind === 'css',
);

export interface LiveRuleMatch {
  readonly element: Element;
  readonly rule: AnalyzerRule;
  readonly message: string;
}

const PSEUDO_ELEMENT_RE = /::[\w-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter)\b/gi;
const DYNAMIC_PSEUDO_CLASS_RE =
  /:(?:hover|focus|focus-visible|focus-within|active|visited|invalid|valid|user-invalid|user-valid|checked|indeterminate|placeholder-shown|disabled|enabled|open|popover-open|modal|fullscreen)\b/gi;

function matchesFastTokens(haystack: string, spec: FastTokenSpec): boolean {
  if (spec.length === 0) return true;
  if (typeof spec[0] === 'string') {
    return (spec as readonly string[]).some((token) => haystack.includes(token));
  }
  return (spec as readonly (readonly string[])[]).every((group) =>
    group.some((token) => haystack.includes(token)),
  );
}

function serializeOpenTag(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const attrs: string[] = [];
  for (const attr of Array.from(el.attributes ?? [])) {
    attrs.push(`${attr.name}="${attr.value.replace(/"/g, '&quot;')}"`);
  }
  return attrs.length > 0 ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
}

function wrapDomElement(el: Element, line: number): DomElementView {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(el.attributes ?? [])) {
    attributes[attr.name.toLowerCase()] = attr.value;
  }
  return {
    tagName: el.tagName.toLowerCase(),
    attributes,
    line,
    hasAttribute(name: string): boolean {
      return el.hasAttribute(name) || Object.hasOwn(attributes, name.toLowerCase());
    },
    getAttribute(name: string): string | null {
      return el.getAttribute(name) ?? attributes[name.toLowerCase()] ?? null;
    },
  };
}

function buildLiveDomContext(el: Element): { element: DomElementView; ctx: DomMatcherContext } {
  const singleLineTarget = el.outerHTML.replace(/\r?\n/g, ' ');
  const form = typeof el.closest === 'function' ? el.closest('form') : null;
  if (form && form !== el) {
    const siblingInputs = Array.from(form.querySelectorAll('input, select, textarea'))
      .filter((node) => node !== el)
      .slice(0, 20)
      .map((node) => serializeOpenTag(node))
      .join(' ');
    const documentText = `${serializeOpenTag(form)} ${siblingInputs}\n${singleLineTarget}\n</form>`;
    return {
      element: wrapDomElement(el, 2),
      ctx: { filePath: 'page.html', documentText },
    };
  }
  return {
    element: wrapDomElement(el, 1),
    ctx: { filePath: 'page.html', documentText: singleLineTarget },
  };
}

function parseDeclarationsFromText(blockText: string): CssDeclaration[] {
  const declarations: CssDeclaration[] = [];
  const cleaned = blockText.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const rawPart of cleaned.split(';')) {
    const colonIdx = rawPart.indexOf(':');
    if (colonIdx === -1) continue;
    const property = rawPart.slice(0, colonIdx).trim().toLowerCase();
    const value = rawPart.slice(colonIdx + 1).trim();
    if (property && value) {
      declarations.push({ property, value });
    }
  }
  return declarations;
}

function makeCssRuleView(
  selectorText: string,
  declarations: readonly CssDeclaration[],
  line: number,
  parentAtRule: string | null,
): CssRuleView {
  const byProp = new Map<string, string>();
  for (const decl of declarations) {
    byProp.set(decl.property.toLowerCase(), decl.value);
  }
  return {
    selectorText,
    declarations,
    line,
    parentAtRule,
    getPropertyValue(property: string): string | null {
      return byProp.get(property.toLowerCase()) ?? null;
    },
    hasProperty(property: string): boolean {
      return byProp.has(property.toLowerCase());
    },
  };
}

function parseStyleTextFallback(cssText: string): CssRuleView[] {
  const rules: CssRuleView[] = [];
  const cleaned = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  let line = 1;

  const walkBlock = (source: string, parentAtRule: string | null): void => {
    let i = 0;
    const len = source.length;
    while (i < len) {
      while (i < len && /\s/.test(source[i])) {
        if (source[i] === '\n') line++;
        i++;
      }
      if (i >= len) break;

      const headerStart = i;
      while (i < len && source[i] !== '{' && source[i] !== ';') {
        if (source[i] === '\n') line++;
        i++;
      }
      if (i >= len) break;
      const header = source.slice(headerStart, i).trim();
      if (source[i] === ';') {
        i++;
        continue;
      }

      // Find matching closing brace.
      i++; // skip '{'
      const bodyStart = i;
      let depth = 1;
      while (i < len && depth > 0) {
        if (source[i] === '{') depth++;
        else if (source[i] === '}') depth--;
        else if (source[i] === '\n') line++;
        i++;
      }
      const body = source.slice(bodyStart, Math.max(bodyStart, i - 1));

      if (!header) continue;
      if (header.startsWith('@')) {
        const lower = header.toLowerCase();
        if (
          lower.startsWith('@media') ||
          lower.startsWith('@supports') ||
          lower.startsWith('@container') ||
          lower.startsWith('@layer')
        ) {
          walkBlock(body, header);
        }
        continue;
      }
      const declarations = parseDeclarationsFromText(body);
      if (declarations.length > 0) {
        rules.push(makeCssRuleView(header, declarations, line, parentAtRule));
      }
    }
  };

  walkBlock(cleaned, null);
  return rules;
}

interface PreparedLiveSheet {
  readonly styleRules: readonly CssRuleView[];
  readonly ctx: CssMatcherContext;
  readonly queryRoot: Document | ShadowRoot;
}

function buildCssMatcherContext(
  filePath: string,
  stylesheetText: string,
  styleRules: readonly CssRuleView[],
  rawFileText?: string,
): CssMatcherContext {
  const lowerText = stylesheetText.toLowerCase();
  const propSet = new Set<string>();
  for (const rule of styleRules) {
    for (const decl of rule.declarations) {
      propSet.add(decl.property.toLowerCase());
    }
  }
  return {
    filePath,
    stylesheetText,
    ...(rawFileText ? { rawFileText } : {}),
    styleRules,
    stylesheetHasProperty(prop: string): boolean {
      const normalized = prop.toLowerCase();
      return propSet.has(normalized) || lowerText.includes(`${normalized}:`);
    },
    stylesheetHasValue(substr: string): boolean {
      return lowerText.includes(substr.toLowerCase());
    },
  };
}

function collectCssomRules(
  ruleList: CSSRuleList,
  parentAtRule: string | null,
  outRules: CssRuleView[],
  outCssText: string[],
): void {
  for (let i = 0; i < ruleList.length; i++) {
    const rule = ruleList[i];
    if (!rule) continue;

    if ('selectorText' in rule && 'style' in rule) {
      const styleRule = rule as CSSStyleRule;
      const cssText = (styleRule.cssText ?? '').replace(/\r?\n/g, ' ');
      if (cssText) outCssText.push(cssText);
      const lineNumber = Math.max(1, outCssText.length);
      const declarations: CssDeclaration[] = [];
      const style = styleRule.style;
      for (let j = 0; j < style.length; j++) {
        const prop = style.item(j);
        const val = style.getPropertyValue(prop);
        const prio = style.getPropertyPriority(prop);
        if (prop && val) {
          declarations.push({
            property: prop.toLowerCase(),
            value: prio ? `${val} !${prio}` : val,
          });
        }
      }
      if (declarations.length === 0 && cssText) {
        const openBrace = cssText.indexOf('{');
        const closeBrace = cssText.lastIndexOf('}');
        if (openBrace !== -1 && closeBrace > openBrace) {
          declarations.push(...parseDeclarationsFromText(cssText.slice(openBrace + 1, closeBrace)));
        }
      }
      if (declarations.length > 0 && styleRule.selectorText) {
        outRules.push(makeCssRuleView(styleRule.selectorText, declarations, lineNumber, parentAtRule));
      }
      continue;
    }

    if ('cssRules' in rule) {
      const grouping = rule as CSSGroupingRule & {
        conditionText?: string;
        media?: MediaList;
        name?: string;
      };
      let atHeader = parentAtRule;
      const cssText = grouping.cssText ?? '';
      const braceIdx = cssText.indexOf('{');
      if (braceIdx > 0) {
        atHeader = cssText.slice(0, braceIdx).trim().replace(/\r?\n/g, ' ');
      } else if (grouping.media?.mediaText) {
        atHeader = `@media ${grouping.media.mediaText}`;
      } else if (grouping.conditionText) {
        atHeader = `@supports ${grouping.conditionText}`;
      }
      if (atHeader) outCssText.push(atHeader);
      collectCssomRules(grouping.cssRules, atHeader, outRules, outCssText);
    }
  }
}

function collectOpenShadowRoots(
  root: Document | Element | ShadowRoot,
  isExcluded?: (el: Element) => boolean,
): ShadowRoot[] {
  const roots: ShadowRoot[] = [];
  const stack: Element[] = [];
  const initialChildren =
    'children' in root && root.children ? Array.from(root.children) : [];
  for (let i = initialChildren.length - 1; i >= 0; i--) {
    stack.push(initialChildren[i]);
  }
  while (stack.length > 0) {
    const el = stack.pop()!;
    if (isExcluded?.(el)) continue;
    const tag = el.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'template') {
      continue;
    }
    const shadow = (el as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (shadow) {
      roots.push(shadow);
      const shadowChildren = Array.from(shadow.children ?? []);
      for (let i = shadowChildren.length - 1; i >= 0; i--) {
        stack.push(shadowChildren[i]);
      }
    }
    if (tag === 'svg') continue;
    const children = Array.from(el.children ?? []);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push(children[i]);
    }
  }
  return roots;
}

function collectSheetsFromRoot(
  root: Document | ShadowRoot,
  rawFileHint: string | undefined,
  prepared: PreparedLiveSheet[],
): void {
  const beforeCount = prepared.length;
  const styleSheets = Array.from(
    (root as Document & { styleSheets?: StyleSheetList }).styleSheets ?? [],
  );
  const adopted = Array.from(
    (root as Document & { adoptedStyleSheets?: readonly CSSStyleSheet[] }).adoptedStyleSheets ?? [],
  );
  for (const sheet of [...styleSheets, ...adopted]) {
    let cssRules: CSSRuleList | null = null;
    try {
      cssRules = sheet.cssRules;
    } catch {
      // Cross-origin stylesheet; skip cleanly without throwing.
      continue;
    }
    if (!cssRules || cssRules.length === 0) continue;
    const styleRules: CssRuleView[] = [];
    const cssTextChunks: string[] = [];
    collectCssomRules(cssRules, null, styleRules, cssTextChunks);
    if (styleRules.length === 0) continue;
    const filePath = sheet.href || 'inline-style.css';
    prepared.push({
      styleRules,
      ctx: buildCssMatcherContext(filePath, cssTextChunks.join('\n'), styleRules, rawFileHint),
      queryRoot: root,
    });
  }

  // Fallback for DOM environments without CSSOM parsing (e.g. linkedom unit tests).
  if (prepared.length === beforeCount) {
    let idx = 0;
    for (const styleEl of Array.from(root.querySelectorAll('style'))) {
      const raw = styleEl.textContent ?? '';
      if (!raw.trim()) continue;
      const styleRules = parseStyleTextFallback(raw);
      if (styleRules.length === 0) continue;
      idx++;
      prepared.push({
        styleRules,
        ctx: buildCssMatcherContext(`inline-style-${idx}.css`, raw, styleRules, rawFileHint),
        queryRoot: root,
      });
    }
  }
}

function collectLiveStylesheets(
  doc: Document,
  shadowRoots: readonly ShadowRoot[],
): PreparedLiveSheet[] {
  const prepared: PreparedLiveSheet[] = [];
  const hasBlockingRenderScript = Boolean(doc.querySelector('script[blocking~="render"]'));
  const rawFileHint = hasBlockingRenderScript ? '<script async blocking="render"></script>' : undefined;

  collectSheetsFromRoot(doc, rawFileHint, prepared);
  for (const shadowRoot of shadowRoots) {
    collectSheetsFromRoot(shadowRoot, rawFileHint, prepared);
  }

  return prepared;
}

function toQueryableSelector(rawSelector: string): { selector: string; isGlobal: boolean } {
  const firstBranch = rawSelector.split(',')[0]?.trim() ?? '';
  let stripped = firstBranch
    .replace(/:host-context\([^)]*\)/gi, '')
    .replace(/:host(?:\([^)]*\))?/gi, '')
    .replace(PSEUDO_ELEMENT_RE, '')
    .replace(DYNAMIC_PSEUDO_CLASS_RE, '')
    .replace(/:(?:not|is|where|has)\(\s*(?:,\s*)*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  stripped = stripped.replace(/^[>+~]\s*|\s*[>+~]$/g, '').trim();
  if (!stripped || stripped === '*' || stripped === ':root' || stripped === 'html' || stripped === 'body') {
    return { selector: stripped || 'html', isGlobal: true };
  }
  return { selector: stripped, isGlobal: false };
}

function resolveCssRuleTarget(
  doc: Document,
  queryRoot: Document | ShadowRoot,
  selectorText: string,
  ruleId: string,
  scopeElement?: Element,
): Element | null {
  const isShadowRoot = queryRoot !== doc && 'host' in queryRoot;
  for (const part of selectorText.split(',')) {
    const { selector, isGlobal } = toQueryableSelector(part);
    if (isGlobal) {
      if (!scopeElement) {
        return isShadowRoot
          ? ((queryRoot as ShadowRoot).host ?? doc.documentElement ?? doc.body ?? null)
          : (doc.documentElement ?? doc.body ?? null);
      }
      if (
        scopeElement === doc.documentElement ||
        scopeElement === doc.body ||
        (isShadowRoot && scopeElement === (queryRoot as ShadowRoot).host)
      ) {
        return scopeElement;
      }
      continue;
    }
    try {
      if (scopeElement) {
        if (typeof scopeElement.matches === 'function' && scopeElement.matches(selector)) {
          return scopeElement;
        }
        const descendant = scopeElement.querySelector(selector);
        if (descendant) return descendant;
        if (isShadowRoot && (queryRoot as ShadowRoot).host === scopeElement) {
          const shadowMatch = queryRoot.querySelector(selector);
          if (shadowMatch) return shadowMatch;
        }
      } else {
        const matched = queryRoot.querySelector(selector);
        if (matched) return matched;
      }
    } catch {
      // Unqueryable or vendor-only selector.
    }
  }
  // Anti-flicker classes (.async-hide / .ab-loading) are typically removed after
  // load even though the blocking stylesheet rule stays in <head>.
  if (!scopeElement && !isShadowRoot && ruleId === 'flicker-free-client-side-ab-testing') {
    return doc.documentElement ?? doc.body ?? null;
  }
  return null;
}

function documentDeclaresDarkColorScheme(doc: Document, sheets: readonly PreparedLiveSheet[]): boolean {
  const meta = doc.querySelector('meta[name="color-scheme"]');
  if (meta && /\bdark\b/i.test(meta.getAttribute('content') ?? '')) {
    return true;
  }
  for (const sheet of sheets) {
    if (
      /(?:^|[^\w-])color-scheme\s*:[^;}]*\bdark\b/i.test(sheet.ctx.stylesheetText) ||
      sheet.ctx.stylesheetHasValue('light-dark(')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Runs all browser-compatible MWG DOM and CSS analyzer rules against `doc` (or
 * scoped to `scopeElement` and its subtree when auditing a single element).
 */
export function runLiveAnalyzerRules(
  doc: Document,
  options: {
    scopeElement?: Element;
    isExcluded?: (el: Element) => boolean;
  } = {},
): LiveRuleMatch[] {
  const matches: LiveRuleMatch[] = [];
  const { scopeElement, isExcluded } = options;
  const shadowRoots = scopeElement
    ? collectOpenShadowRoots(scopeElement, isExcluded)
    : collectOpenShadowRoots(doc, isExcluded);
  if (scopeElement) {
    const ownShadow = (scopeElement as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (ownShadow && !shadowRoots.includes(ownShadow)) {
      shadowRoots.unshift(ownShadow);
    }
    const containingRoot =
      typeof scopeElement.getRootNode === 'function' ? scopeElement.getRootNode() : null;
    if (containingRoot && containingRoot !== doc && 'host' in containingRoot) {
      const sr = containingRoot as ShadowRoot;
      if (!shadowRoots.includes(sr)) shadowRoots.unshift(sr);
    }
  }

  // 1. Calibrated DOM rules from src/analyzing/rules/.
  for (const rule of LIVE_DOM_RULES) {
    const candidates: Element[] = [];
    const seenCandidates = new Set<Element>();
    const addCandidate = (el: Element): void => {
      if (seenCandidates.has(el)) return;
      seenCandidates.add(el);
      candidates.push(el);
    };
    try {
      if (scopeElement) {
        if (typeof scopeElement.matches === 'function' && scopeElement.matches(rule.matcher.selector)) {
          addCandidate(scopeElement);
        }
        for (const el of Array.from(scopeElement.querySelectorAll(rule.matcher.selector)).slice(0, 40)) {
          addCandidate(el);
        }
        for (const sr of shadowRoots) {
          if (sr.host !== scopeElement && !scopeElement.contains(sr.host)) continue;
          for (const el of Array.from(sr.querySelectorAll(rule.matcher.selector)).slice(0, 40)) {
            addCandidate(el);
          }
        }
      } else {
        for (const el of Array.from(doc.querySelectorAll(rule.matcher.selector)).slice(0, 200)) {
          addCandidate(el);
        }
        for (const sr of shadowRoots) {
          for (const el of Array.from(sr.querySelectorAll(rule.matcher.selector)).slice(0, 50)) {
            addCandidate(el);
          }
        }
      }
    } catch {
      continue;
    }
    for (const el of candidates) {
      if (isExcluded?.(el)) continue;
      const { element, ctx } = buildLiveDomContext(el);
      const hit = rule.matcher.matchElement(element, ctx);
      if (hit) {
        matches.push({ element: el, rule, message: hit.message });
      }
    }
  }

  // 2. Calibrated CSS rules from src/analyzing/rules/ against live stylesheets.
  const sheets = collectLiveStylesheets(doc, shadowRoots);
  const docHasDarkColorScheme = documentDeclaresDarkColorScheme(doc, sheets);
  for (const sheet of sheets) {
    for (const rule of LIVE_CSS_RULES) {
      if (rule.id === 'dark-mode' && docHasDarkColorScheme) continue;
      if (!matchesFastTokens(sheet.ctx.stylesheetText, rule.matcher.fastTokens)) {
        continue;
      }
      for (const styleRule of sheet.styleRules) {
        const hit = rule.matcher.matchRule(styleRule, sheet.ctx);
        if (!hit) continue;
        const targetEl = resolveCssRuleTarget(
          doc,
          sheet.queryRoot,
          styleRule.selectorText,
          rule.id,
          scopeElement,
        );
        if (!targetEl || isExcluded?.(targetEl)) continue;
        matches.push({ element: targetEl, rule, message: hit.message });
      }
    }
  }

  return matches;
}
