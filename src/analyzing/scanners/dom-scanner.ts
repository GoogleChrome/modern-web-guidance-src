import { parseHTML } from 'linkedom';
import { Node, type JsxOpeningElement, type JsxSelfClosingElement, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, DomElementView, DomMatcherContext, DomRuleMatcher } from '../schema.ts';
import { matchesFastTokens } from './js-scanner.ts';

export interface HtmlTagToken {
  readonly tagName: string;
  readonly line: number;
  readonly column: number;
  readonly attributes: Readonly<Record<string, string>>;
}

/**
 * Advances past an HTML comment, tracking line and column numbers.
 */
function skipComment(
  html: string,
  startIndex: number,
  curLine: number,
  curCol: number,
): { index: number; line: number; col: number } {
  let i = startIndex + 4;
  let line = curLine;
  let col = curCol + 4;
  const len = html.length;

  while (i < len && !html.startsWith('-->', i)) {
    if (html[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  }
  if (i < len) {
    i += 3;
    col += 3;
  }
  return { index: i, line, col };
}

/**
 * Advances past a simple closing tag or doctype until `>`.
 */
function skipUntilGreaterThan(
  html: string,
  startIndex: number,
  curLine: number,
  curCol: number,
): { index: number; line: number; col: number } {
  let i = startIndex;
  let line = curLine;
  let col = curCol;
  const len = html.length;

  while (i < len && html[i] !== '>') {
    if (html[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  }
  if (i < len && html[i] === '>') {
    i++;
    col++;
  }
  return { index: i, line, col };
}

/**
 * Skips whitespace characters and advances line/col positions.
 */
function skipWhitespace(
  html: string,
  startIndex: number,
  curLine: number,
  curCol: number,
): { index: number; line: number; col: number } {
  let i = startIndex;
  let line = curLine;
  let col = curCol;
  const len = html.length;

  while (i < len && /\s/.test(html[i] ?? '')) {
    if (html[i] === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }
    i++;
  }
  return { index: i, line, col };
}

/**
 * Reads an attribute value (quoted or unquoted) starting at `=` character.
 */
function readAttributeValue(
  html: string,
  startIndex: number,
  curLine: number,
  curCol: number,
): { value: string; index: number; line: number; col: number } {
  // Skip past `=` and subsequent whitespace
  const afterEqual = skipWhitespace(html, startIndex + 1, curLine, curCol + 1);
  let i = afterEqual.index;
  let line = afterEqual.line;
  let col = afterEqual.col;
  const len = html.length;

  let value = '';
  const quote = html[i];

  if (quote === '"' || quote === "'") {
    i++;
    col++;
    while (i < len && html[i] !== quote) {
      if (html[i] === '\n') {
        line++;
        col = 1;
      } else {
        col++;
      }
      value += html[i];
      i++;
    }
    if (i < len && html[i] === quote) {
      i++;
      col++;
    }
  } else {
    while (i < len && /[^\s>]/.test(html[i] ?? '')) {
      value += html[i];
      i++;
      col++;
    }
  }

  return { value, index: i, line, col };
}

/**
 * Parses all attributes inside an opening tag until `>` or `/>`.
 */
function parseTagAttributes(
  html: string,
  startIndex: number,
  curLine: number,
  curCol: number,
): { attributes: Record<string, string>; index: number; line: number; col: number } {
  let i = startIndex;
  let line = curLine;
  let col = curCol;
  const len = html.length;
  const attributes: Record<string, string> = {};

  while (i < len) {
    const ws = skipWhitespace(html, i, line, col);
    i = ws.index;
    line = ws.line;
    col = ws.col;

    if (i >= len || html[i] === '>') {
      if (i < len && html[i] === '>') {
        i++;
        col++;
      }
      break;
    }

    if (html[i] === '/' && html[i + 1] === '>') {
      i += 2;
      col += 2;
      break;
    }

    let attrName = '';
    while (i < len && /[^\s=>/]/.test(html[i] ?? '')) {
      attrName += html[i];
      i++;
      col++;
    }

    if (attrName.length === 0) {
      i++;
      col++;
      continue;
    }

    const wsEq = skipWhitespace(html, i, line, col);
    i = wsEq.index;
    line = wsEq.line;
    col = wsEq.col;

    const attrKey = attrName.toLowerCase();
    if (i < len && html[i] === '=') {
      const valResult = readAttributeValue(html, i, line, col);
      if (!Object.hasOwn(attributes, attrKey)) {
        attributes[attrKey] = valResult.value;
      }
      i = valResult.index;
      line = valResult.line;
      col = valResult.col;
    } else {
      // Bare boolean attribute e.g. <input required>
      if (!Object.hasOwn(attributes, attrKey)) {
        attributes[attrKey] = '';
      }
    }
  }

  return { attributes, index: i, line, col };
}

/**
 * Linearly tokenizes an HTML string to record exact line, column, and attributes
 * (including bare boolean attributes) for all opening tags.
 */
export function tokenizeHtmlTags(html: string): HtmlTagToken[] {
  const tokens: HtmlTagToken[] = [];
  let line = 1;
  let col = 1;
  let i = 0;
  const len = html.length;

  while (i < len) {
    if (html[i] === '\n') {
      line++;
      col = 1;
      i++;
      continue;
    }

    if (html[i] !== '<') {
      i++;
      col++;
      continue;
    }

    if (html.startsWith('<!--', i)) {
      const skipped = skipComment(html, i, line, col);
      i = skipped.index;
      line = skipped.line;
      col = skipped.col;
      continue;
    }

    if (html.startsWith('<!doctype', i) || html[i + 1] === '/') {
      const skipped = skipUntilGreaterThan(html, i, line, col);
      i = skipped.index;
      line = skipped.line;
      col = skipped.col;
      continue;
    }

    const tagStartLine = line;
    const tagStartCol = col;
    i++;
    col++;

    let tagName = '';
    while (i < len && /[a-zA-Z0-9_-]/.test(html[i] ?? '')) {
      tagName += html[i];
      i++;
      col++;
    }

    if (tagName.length === 0) {
      continue;
    }

    const parsedAttrs = parseTagAttributes(html, i, line, col);
    i = parsedAttrs.index;
    line = parsedAttrs.line;
    col = parsedAttrs.col;

    tokens.push({
      tagName: tagName.toLowerCase(),
      line: tagStartLine,
      column: tagStartCol,
      attributes: parsedAttrs.attributes,
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

/**
 * Extracts attributes map from a linkedom Element.
 */
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
    .replace(/&#x([0-9a-f]+);/gi, (full, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    })
    .replace(/&#(\d+);/g, (full, dec: string) => {
      const cp = Number.parseInt(dec, 10);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : full;
    });
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

/**
 * Scans an HTML file using linkedom + linear HTML tokenizer.
 */
export function scanHtml(
  filePath: string,
  htmlContent: string,
  rules: readonly DomRuleMatcher[],
): AnalyzerMatch[] {
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(htmlContent, rule.fastTokens),
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

  const matches: AnalyzerMatch[] = [];

  for (const rule of activeRules) {
    let elements: LinkedomElementNode[];
    try {
      elements = querySelectorAllIncludingTemplates(document, rule.selector);
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

      const view: DomElementView = {
        tagName: tagLower,
        attributes: elAttrs,
        line,
        column,
        isJsx: false,
        hasSpreadAttribute: false,
        hasAttribute: (name: string) => Object.hasOwn(elAttrs, name.toLowerCase()),
        getAttribute: (name: string) => {
          const lower = name.toLowerCase();
          return Object.hasOwn(elAttrs, lower) ? (elAttrs[lower] ?? null) : null;
        },
      };

      const result = rule.matchElement(view, ctx);
      if (result) {
        matches.push({
          line,
          column,
          message: result.message,
          ...(result.subPattern ? { subPattern: result.subPattern } : {}),
        });
      }
    }
  }

  return matches;
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
 * Scans a JSX/TSX SourceFile using the static JSX-DOM bridge.
 */
export function scanJsx(
  filePath: string,
  sourceFile: SourceFile,
  rules: readonly DomRuleMatcher[],
): AnalyzerMatch[] {
  const fileContent = sourceFile.getFullText();
  const activeRules = rules.filter((rule) =>
    matchesFastTokens(fileContent, rule.fastTokens),
  );
  if (activeRules.length === 0) {
    return [];
  }

  const { document } = parseHTML('<!DOCTYPE html><html><body></body></html>');
  const ctx: DomMatcherContext = {
    filePath,
    documentText: fileContent,
  };

  const matches: AnalyzerMatch[] = [];
  const jsxNodes: Array<JsxOpeningElement | JsxSelfClosingElement> = [];

  sourceFile.forEachDescendant((node) => {
    if (Node.isJsxOpeningElement(node) || Node.isJsxSelfClosingElement(node)) {
      jsxNodes.push(node);
    }
  });

  for (const jsxNode of jsxNodes) {
    const tagName = jsxNode.getTagNameNode().getText().toLowerCase();
    const { hasSpread, staticAttrs, dynamicAttrs } = extractJsxAttributes(jsxNode);
    const { line, column } = sourceFile.getLineAndColumnAtPos(jsxNode.getStart());

    const view: DomElementView = {
      tagName,
      attributes: staticAttrs,
      line,
      column,
      isJsx: true,
      hasSpreadAttribute: hasSpread,
      hasAttribute: (name: string) => Object.hasOwn(staticAttrs, name.toLowerCase()),
      getAttribute: (name: string) => staticAttrs[name.toLowerCase()] ?? null,
      hasDynamicAttribute: (name: string) => dynamicAttrs.has(name.toLowerCase()),
    };

    for (const rule of activeRules) {
      if (rule.skipIfHasSpread && hasSpread) {
        continue;
      }
      if (
        rule.skipIfDynamicAttributes &&
        rule.skipIfDynamicAttributes.some((a) => dynamicAttrs.has(a.toLowerCase()))
      ) {
        continue;
      }

      let selectorMatches = false;
      try {
        const mockEl = document.createElement(tagName);
        for (const [k, v] of Object.entries(staticAttrs)) {
          mockEl.setAttribute(k, v);
        }
        selectorMatches = mockEl.matches(rule.selector);
      } catch {
        selectorMatches = false;
      }

      if (!selectorMatches) {
        continue;
      }

      const result = rule.matchElement(view, ctx);
      if (result) {
        matches.push({
          line,
          column,
          message: result.message,
          ...(result.subPattern ? { subPattern: result.subPattern } : {}),
        });
      }
    }
  }

  return matches;
}
