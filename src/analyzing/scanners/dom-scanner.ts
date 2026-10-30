import { parseHTML } from 'linkedom';
import { Node, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, DomElementView, DomMatcherContext, DomRuleMatcher } from '../schema.ts';
import { matchesFastTokens } from './js-scanner.ts';

interface HtmlTagToken {
  readonly tagName: string;
  readonly line: number;
  readonly column: number;
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * Linearly tokenizes an HTML string to record exact line, column, and attributes
 * (including bare boolean attributes) for all opening tags.
 */
export function tokenizeHtmlTags(html: string): HtmlTagToken[] {
  const tokens: HtmlTagToken[] = [];
  const len = html.length;
  let i = 0;
  let line = 1;
  let col = 1;

  const advanceTo = (end: number): void => {
    while (i < end) {
      if (html[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      i++;
    }
  };

  const skipWhitespace = (): void => {
    while (i < len && /\s/.test(html[i] ?? '')) {
      advanceTo(i + 1);
    }
  };

  while (i < len) {
    const nextLt = html.indexOf('<', i);
    if (nextLt === -1) {
      break;
    }
    advanceTo(nextLt);

    if (html.startsWith('<!--', i)) {
      const closeIdx = html.indexOf('-->', i + 4);
      advanceTo(closeIdx === -1 ? len : closeIdx + 3);
      continue;
    }

    if (html.startsWith('<!doctype', i) || html[i + 1] === '/') {
      const closeIdx = html.indexOf('>', i);
      advanceTo(closeIdx === -1 ? len : closeIdx + 1);
      continue;
    }

    const tagStartLine = line;
    const tagStartCol = col;
    advanceTo(i + 1);

    const nameStart = i;
    while (i < len && /[a-zA-Z0-9_-]/.test(html[i] ?? '')) {
      i++;
      col++;
    }
    if (i === nameStart) {
      continue;
    }
    const tagName = html.slice(nameStart, i).toLowerCase();

    const attributes: Record<string, string> = {};
    while (i < len) {
      skipWhitespace();
      if (i >= len || html[i] === '>') {
        if (i < len) {
          advanceTo(i + 1);
        }
        break;
      }
      if (html[i] === '/' && html[i + 1] === '>') {
        advanceTo(i + 2);
        break;
      }

      const attrStart = i;
      while (i < len && /[^\s=>/]/.test(html[i] ?? '')) {
        i++;
        col++;
      }
      if (i === attrStart) {
        advanceTo(i + 1);
        continue;
      }

      const attrKey = html.slice(attrStart, i).toLowerCase();
      skipWhitespace();

      let value = '';
      if (i < len && html[i] === '=') {
        advanceTo(i + 1);
        skipWhitespace();
        const quote = html[i];
        if (quote === '"' || quote === "'") {
          advanceTo(i + 1);
          const valStart = i;
          const closeQuote = html.indexOf(quote, i);
          advanceTo(closeQuote === -1 ? len : closeQuote);
          value = html.slice(valStart, i);
          if (i < len) {
            advanceTo(i + 1);
          }
        } else {
          const valStart = i;
          while (i < len && /[^\s>]/.test(html[i] ?? '')) {
            i++;
            col++;
          }
          value = html.slice(valStart, i);
        }
      }

      if (!Object.hasOwn(attributes, attrKey)) {
        attributes[attrKey] = value;
      }
    }

    tokens.push({
      tagName,
      line: tagStartLine,
      column: tagStartCol,
      attributes,
    });
  }

  return tokens;
}

interface LinkedomQueryableNode {
  querySelector(selector: string): unknown;
  querySelectorAll(selector: string): Iterable<unknown>;
  readonly children?: Iterable<unknown>;
}

interface LinkedomElementNode extends LinkedomQueryableNode {
  readonly tagName?: string;
  readonly attributes?: ReadonlyArray<{ readonly name: string; readonly value: unknown }>;
  readonly content?: unknown;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
}

function isLinkedomQueryableNode(val: unknown): val is LinkedomQueryableNode {
  return (
    typeof val === 'object' &&
    val !== null &&
    'querySelectorAll' in val &&
    typeof val.querySelectorAll === 'function' &&
    'querySelector' in val &&
    typeof val.querySelector === 'function'
  );
}

function isLinkedomElementNode(val: unknown): val is LinkedomElementNode {
  return (
    isLinkedomQueryableNode(val) &&
    'hasAttribute' in val &&
    typeof val.hasAttribute === 'function' &&
    'getAttribute' in val &&
    typeof val.getAttribute === 'function'
  );
}

function getLinkedomAttributes(el: LinkedomElementNode): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (Array.isArray(el.attributes)) {
    for (const a of el.attributes) {
      const key = a.name.toLowerCase();
      if (!Object.hasOwn(attrs, key)) {
        attrs[key] = typeof a.value === 'string' ? a.value : '';
      }
    }
  }
  return attrs;
}

function decodeCodePoint(full: string, raw: string, radix: number): string {
  const cp = Number.parseInt(raw, radix);
  return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
}

function decodeBasicEntities(val: string): string {
  if (!val.includes('&')) {
    return val;
  }
  return val
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&#x([0-9a-f]+);/gi, (full, hex: string) => decodeCodePoint(full, hex, 16))
    .replace(/&#(\d+);/g, (full, dec: string) => decodeCodePoint(full, dec, 10));
}

/**
 * Finds the corresponding token for an element from the sequential token list,
 * requiring bidirectional attribute matching so earlier bare/subset tags do not collide.
 */
function findMatchingToken(
  tokens: readonly HtmlTagToken[],
  startIndex: number,
  tagLower: string,
  elAttrs: Readonly<Record<string, string>>,
): { token?: HtmlTagToken; nextIndex: number } {
  const elAttrCount = Object.keys(elAttrs).length;
  for (let t = startIndex; t < tokens.length; t++) {
    const tok = tokens[t];
    if (!tok || tok.tagName !== tagLower) {
      continue;
    }
    const tokEntries = Object.entries(tok.attributes);
    if (tokEntries.length !== elAttrCount) {
      continue;
    }
    const tokenMatches = tokEntries.every(([k, v]) => {
      if (!Object.hasOwn(elAttrs, k)) {
        return false;
      }
      const actual = elAttrs[k];
      const decoded = decodeBasicEntities(v);
      return (
        actual === v ||
        actual === decoded ||
        (k === 'class' && decoded.trim().replace(/\s+/g, ' ') === actual)
      );
    });
    if (tokenMatches) {
      return { token: tok, nextIndex: t + 1 };
    }
  }
  return { nextIndex: startIndex };
}

/**
 * Queries matching elements in document pre-order, descending into `<template>`
 * `DocumentFragment` content (including nested `<template>` elements).
 */
function querySelectorAllIncludingTemplates(
  root: LinkedomQueryableNode,
  selector: string,
): LinkedomElementNode[] {
  const directMatches: LinkedomElementNode[] = [];
  for (const item of root.querySelectorAll(selector)) {
    if (isLinkedomElementNode(item)) {
      directMatches.push(item);
    }
  }
  if (!root.querySelector('template')) {
    return directMatches;
  }

  const directSet = new Set<unknown>(directMatches);
  const results: LinkedomElementNode[] = [];

  const walk = (parent: LinkedomQueryableNode): void => {
    if (!parent.children) {
      return;
    }
    for (const child of parent.children) {
      if (!isLinkedomElementNode(child)) {
        continue;
      }
      if (directSet.has(child)) {
        results.push(child);
      }
      if (
        child.tagName?.toLowerCase() === 'template' &&
        isLinkedomQueryableNode(child.content)
      ) {
        results.push(...querySelectorAllIncludingTemplates(child.content, selector));
      } else {
        walk(child);
      }
    }
  };

  walk(root);
  return results;
}

function createDomElementView(
  tagName: string,
  attributes: Readonly<Record<string, string>>,
  line: number,
  column: number,
  jsx?: { readonly hasSpread: boolean; readonly dynamicAttrs: ReadonlySet<string> },
): DomElementView {
  return {
    tagName,
    attributes,
    line,
    column,
    isJsx: Boolean(jsx),
    hasSpreadAttribute: jsx?.hasSpread ?? false,
    hasAttribute: (name: string) => Object.hasOwn(attributes, name.toLowerCase()),
    getAttribute: (name: string) => {
      const lower = name.toLowerCase();
      return Object.hasOwn(attributes, lower) ? (attributes[lower] ?? null) : null;
    },
    ...(jsx
      ? { hasDynamicAttribute: (name: string) => jsx.dynamicAttrs.has(name.toLowerCase()) }
      : {}),
  };
}

/**
 * Scans an HTML file using linkedom + linear HTML tokenizer against rules in a single parse pass.
 */
export function scanHtmlRules<T extends { readonly matcher: DomRuleMatcher }>(
  filePath: string,
  htmlContent: string,
  rules: readonly T[],
): { rule: T; match: AnalyzerMatch }[] {
  const activeRules = rules.filter((r) =>
    matchesFastTokens(htmlContent, r.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const tokens = tokenizeHtmlTags(htmlContent);
  const { document } = parseHTML(htmlContent);
  if (!isLinkedomQueryableNode(document)) {
    return [];
  }
  const ctx: DomMatcherContext = {
    filePath,
    documentText: htmlContent,
  };

  const results: { rule: T; match: AnalyzerMatch }[] = [];

  for (const rule of activeRules) {
    const { matcher } = rule;
    let elements: LinkedomElementNode[];
    try {
      elements = querySelectorAllIncludingTemplates(document, matcher.selector);
    } catch {
      continue;
    }

    let tokenIndex = 0;

    for (const el of elements) {
      if (!el.tagName) {
        continue;
      }
      const tagLower = el.tagName.toLowerCase();
      const elAttrs = getLinkedomAttributes(el);

      const matchRes = findMatchingToken(tokens, tokenIndex, tagLower, elAttrs);
      if (!matchRes.token) {
        continue;
      }
      tokenIndex = matchRes.nextIndex;

      const { line, column } = matchRes.token;
      const view = createDomElementView(tagLower, elAttrs, line, column);
      const result = matcher.matchElement(view, ctx);
      if (result) {
        results.push({
          rule,
          match: {
            line,
            column,
            message: result.message,
            ...(result.subPattern ? { subPattern: result.subPattern } : {}),
          },
        });
      }
    }
  }

  return results;
}

/**
 * Scans an HTML file using linkedom + linear HTML tokenizer.
 */
export function scanHtml(
  filePath: string,
  htmlContent: string,
  rules: readonly DomRuleMatcher[],
): AnalyzerMatch[] {
  return scanHtmlRules(
    filePath,
    htmlContent,
    rules.map((matcher) => ({ matcher })),
  ).map(({ match }) => match);
}

/**
 * Extracts static and dynamic attributes from a JSX opening or self-closing element.
 */
function extractJsxAttributes(
  jsxNode: JsxOpeningElement | JsxSelfClosingElement,
): {
  hasSpread: boolean;
  staticAttrs: Record<string, string>;
  dynamicAttrs: Set<string>;
} {
  let hasSpread = false;
  const staticAttrs: Record<string, string> = {};
  const dynamicAttrs = new Set<string>();

  for (const attr of jsxNode.getAttributes()) {
    if (Node.isJsxSpreadAttribute(attr)) {
      hasSpread = true;
      continue;
    }

    if (Node.isJsxAttribute(attr)) {
      const attrName = attr.getNameNode().getText().toLowerCase();
      const init = attr.getInitializer();
      if (!init) {
        staticAttrs[attrName] = '';
      } else if (Node.isStringLiteral(init)) {
        staticAttrs[attrName] = init.getLiteralText();
      } else if (Node.isJsxExpression(init)) {
        const expr = init.getExpression();
        if (expr && Node.isStringLiteral(expr)) {
          staticAttrs[attrName] = expr.getLiteralText();
        } else {
          dynamicAttrs.add(attrName);
        }
      }
    }
  }

  return { hasSpread, staticAttrs, dynamicAttrs };
}

/**
 * Scans a JSX/TSX SourceFile using the static JSX-DOM bridge against rules in a single pass.
 */
export function scanJsxRules<T extends { readonly matcher: DomRuleMatcher }>(
  filePath: string,
  sourceFile: SourceFile,
  rules: readonly T[],
): { rule: T; match: AnalyzerMatch }[] {
  const fileContent = sourceFile.getFullText();
  const activeRules = rules.filter((r) =>
    matchesFastTokens(fileContent, r.matcher.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const jsxNodes: Array<JsxOpeningElement | JsxSelfClosingElement> = [];
  sourceFile.forEachDescendant((node) => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      jsxNodes.push(node);
    }
  });
  if (jsxNodes.length === 0) {
    return [];
  }

  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const ctx: DomMatcherContext = {
    filePath,
    documentText: fileContent,
  };

  const preparedElements = jsxNodes.map((jsxNode) => {
    const tagName = jsxNode.getTagNameNode().getText().toLowerCase();
    const { hasSpread, staticAttrs, dynamicAttrs } = extractJsxAttributes(jsxNode);
    const { line, column } = sourceFile.getLineAndColumnAtPos(jsxNode.getStart());

    let mockEl: { matches(selector: string): boolean } | null = null;
    try {
      const el = document.createElement(tagName);
      for (const [k, v] of Object.entries(staticAttrs)) {
        el.setAttribute(k, v);
      }
      mockEl = el;
    } catch {
      mockEl = null;
    }

    const view = createDomElementView(tagName, staticAttrs, line, column, {
      hasSpread,
      dynamicAttrs,
    });

    return { view, mockEl, hasSpread, dynamicAttrs };
  });

  const results: { rule: T; match: AnalyzerMatch }[] = [];

  for (const rule of activeRules) {
    const { matcher } = rule;
    for (const { view, mockEl, hasSpread, dynamicAttrs } of preparedElements) {
      if (matcher.skipIfHasSpread && hasSpread) {
        continue;
      }
      if (
        matcher.skipIfDynamicAttributes &&
        matcher.skipIfDynamicAttributes.some((a) => dynamicAttrs.has(a.toLowerCase()))
      ) {
        continue;
      }

      let selectorMatches = false;
      if (mockEl) {
        try {
          selectorMatches = mockEl.matches(matcher.selector);
        } catch {
          selectorMatches = false;
        }
      }
      if (!selectorMatches) {
        continue;
      }

      const result = matcher.matchElement(view, ctx);
      if (result) {
        results.push({
          rule,
          match: {
            line: view.line,
            column: view.column,
            message: result.message,
            ...(result.subPattern ? { subPattern: result.subPattern } : {}),
          },
        });
      }
    }
  }

  return results;
}

/**
 * Scans a JSX/TSX SourceFile using the static JSX-DOM bridge.
 */
export function scanJsx(
  filePath: string,
  sourceFile: SourceFile,
  rules: readonly DomRuleMatcher[],
): AnalyzerMatch[] {
  return scanJsxRules(
    filePath,
    sourceFile,
    rules.map((matcher) => ({ matcher })),
  ).map(({ match }) => match);
}
