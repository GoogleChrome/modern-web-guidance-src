/*
 * Expectation Coverage:
 * - Expectation 1: TESTED - Smooth color gradients and color-mix() specify perceptual interpolation color space (in oklch or in oklab) directly or via custom property, and none specify in srgb.
 * - Expectation 2: TESTED - At least one element's box-shadow has two or more comma-separated shadow layers to create depth.
 * - Expectation 3: TESTED - A lighting or texture overlay uses background-blend-mode, or uses mix-blend-mode on an element inside an isolation: isolate stacking context.
 * - Expectation 4: TESTED - Decorative patterns (stripes, dots, checkerboards) are drawn with CSS gradients that use hard color stops, not with image or SVG files.
 * - Expectation 5: TESTED - A chart drawn with a CSS gradient (such as a conic-gradient() pie) is accompanied by accessible text or markup (such as visible percentage labels, an accessible name or description, or a semantic <table>) that exposes the same data to assistive technologies.
 */

import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { CSSStyleRule, CSSGroupingRule, type CSSRule, type CSSStyleSheet } from 'cssomnom';
import type { Document } from 'linkedom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

interface StyledRuleEntry {
  rule: CSSStyleRule;
  selector: string;
  inSupports: boolean;
}

interface CssFunctionCall {
  name: string;
  args: string;
  start: number;
  end: number;
}

function splitCommaSelectors(sel: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function getAllStyleRules(
  rules: Iterable<CSSRule>,
  parentSelector = '',
  inSupports = false
): StyledRuleEntry[] {
  const result: StyledRuleEntry[] = [];
  for (const rule of rules) {
    const cssText = rule.cssText.trim();
    const nextSupports = inSupports || /^@supports\b/i.test(cssText);
    const scopeMatch = cssText.match(/^@scope\s*\(([^)]+)\)/i);
    let nextSelector = scopeMatch ? scopeMatch[1].trim() : parentSelector;

    if (rule instanceof CSSStyleRule) {
      const rawSel = rule.selectorText.trim().replace(/:scope\b/g, nextSelector || ':root');
      nextSelector = !parentSelector
        ? rawSel
        : splitCommaSelectors(parentSelector)
            .flatMap((p) =>
              splitCommaSelectors(rawSel).map((c) => (c.includes('&') ? c.replace(/&/g, p) : `${p} ${c}`))
            )
            .join(', ');
      result.push({ rule, selector: nextSelector, inSupports: nextSupports });
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(Array.from(rule.cssRules), nextSelector, nextSupports));
    }
  }
  return result;
}

function splitTopLevelCommas(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitTopLevelSpaces(value: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of value) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (/\s/.test(ch) && depth === 0) {
      if (current) {
        parts.push(current);
        current = '';
      }
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function extractCssFunctions(value: string, namePattern?: RegExp): CssFunctionCall[] {
  const calls: CssFunctionCall[] = [];
  const fnStart = /([a-zA-Z_-][a-zA-Z0-9_-]*)\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = fnStart.exec(value)) !== null) {
    const name = match[1];
    const argsStart = match.index + match[0].length;
    let depth = 1;
    let i = argsStart;
    while (i < value.length && depth > 0) {
      if (value[i] === '(') depth++;
      else if (value[i] === ')') depth--;
      i++;
    }
    if (depth === 0 && (!namePattern || namePattern.test(name))) {
      calls.push({ name, args: value.slice(argsStart, i - 1), start: match.index, end: i });
    }
  }
  return calls;
}

function collectRuleLocalProps(rule: CSSStyleRule): Map<string, string> {
  const localProps = new Map<string, string>();
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style[i];
    if (prop.startsWith('--')) {
      const val = rule.style.getPropertyValue(prop).trim();
      if (val) localProps.set(prop, val);
    }
  }
  return localProps;
}

function collectCustomProps(entries: StyledRuleEntry[]): Map<string, string> {
  const customProps = new Map<string, string>();
  for (const { rule, selector } of entries) {
    const isGlobalScope = /^(?::root|html|body|\*)$/i.test(selector.trim());
    for (let i = 0; i < rule.style.length; i++) {
      const prop = rule.style[i];
      if (prop.startsWith('--')) {
        const val = rule.style.getPropertyValue(prop).trim();
        if (val && (isGlobalScope || !customProps.has(prop))) {
          customProps.set(prop, val);
        }
      }
    }
  }
  return customProps;
}

function resolveVars(
  value: string,
  customProps: Map<string, string>,
  localProps?: Map<string, string>
): string {
  let current = value;
  for (let pass = 0; pass < 5; pass++) {
    const varCalls = extractCssFunctions(current, /^var$/i);
    if (varCalls.length === 0) break;
    const topLevel = varCalls.filter(
      (c, idx) => !varCalls.some((other, oIdx) => oIdx !== idx && other.start < c.start && c.end <= other.end)
    );
    let changed = false;
    for (let k = topLevel.length - 1; k >= 0; k--) {
      const call = topLevel[k];
      const parts = splitTopLevelCommas(call.args);
      const varName = parts[0]?.trim() ?? '';
      const fallback = parts.slice(1).join(',').trim();
      const resolved = localProps?.get(varName) ?? customProps.get(varName) ?? (fallback || null);
      if (resolved !== null) {
        current = current.slice(0, call.start) + resolved + current.slice(call.end);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return current;
}

function isGradientPreamble(seg: string): boolean {
  const trimmed = seg.trim();
  if (
    /^(?:to\b|from\b|at\b|in\b|circle\b|ellipse\b|closest-|farthest-|-?\d*\.?\d+(?:deg|grad|rad|turn)\b)/i.test(
      trimmed
    ) ||
    /\b(?:in|at)\s+[a-z0-9%-]/i.test(trimmed)
  ) {
    return true;
  }
  const tokens = splitTopLevelSpaces(trimmed);
  return tokens.length > 0 && tokens.every((t) => /^-?\d*\.?\d+(?:px|em|rem|%|vw|vh|vmin|vmax)$/i.test(t));
}

function hasHardColorStops(gradientName: string, args: string): boolean {
  const segments = splitTopLevelCommas(args);
  const stops = segments.length > 1 && isGradientPreamble(segments[0]) ? segments.slice(1) : segments;
  if (stops.length < 2) return false;

  const stopPositions = stops.map((s) => splitTopLevelSpaces(s.trim()).slice(1));
  // Double-position color stop (e.g., `var(--c1) 0 1em`)
  if (stopPositions.some((pos) => pos.length >= 2)) return true;
  // Zero-position fixup hard stop after the first stop (e.g., `var(--c2) 0` or `transparent 0%`)
  if (
    stopPositions
      .slice(1)
      .some((pos) => pos.length === 1 && /^0(?:%|px|em|rem|deg|grad|rad|turn)?$/i.test(pos[0]))
  ) {
    return true;
  }
  // Adjacent stops sharing the exact same position (e.g., `var(--c1) 50%, var(--c2) 50%`)
  for (let i = 0; i < stopPositions.length - 1; i++) {
    const endPrev = stopPositions[i].at(-1)?.toLowerCase();
    const startNext = stopPositions[i + 1][0]?.toLowerCase();
    if (endPrev && startNext && endPrev === startNext) return true;
  }
  // Polka-dot anti-aliased edge (e.g., `var(--r), transparent calc(var(--r) + 1px)` or `2px, transparent 3px`)
  if (/radial-gradient$/i.test(gradientName) && stops.length === 2 && /\btransparent\b/i.test(stops[1])) {
    const pos0 = stopPositions[0][0] ?? '';
    const pos1 = stopPositions[1][0] ?? '';
    if (/^calc\(.+\+\s*1px\)$/i.test(pos1)) return true;
    const u0 = pos0.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/i);
    const u1 = pos1.match(/^(\d+(?:\.\d+)?)(px|em|rem|%)$/i);
    if (u0 && u1 && u0[2].toLowerCase() === u1[2].toLowerCase()) {
      const delta = Math.abs(Number(u1[1]) - Number(u0[1]));
      const unit = u0[2].toLowerCase();
      const maxEdge = unit === 'px' ? 1.5 : unit === '%' ? 3 : 0.15;
      if (delta <= maxEdge) return true;
    }
  }
  return false;
}

function hasShorthandTileSize(layerRemainder: string): boolean {
  let depth = 0;
  for (let i = 0; i < layerRemainder.length; i++) {
    const ch = layerRemainder[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ',' && depth === 0) break;
    else if (ch === '/' && depth === 0) {
      const sizePart = layerRemainder.slice(i + 1).split(',')[0].trim();
      return Boolean(sizePart && !/^(?:auto(?:\s+auto)?|cover|contain)$/i.test(sizePart));
    }
  }
  return false;
}

function safeQueryAll(doc: Document, selector: string): any[] {
  if (selector.trim() === '[style]') return [];
  const matched: any[] = [];
  for (const part of splitCommaSelectors(selector)) {
    const cleaned = part.replace(/(?:::[a-zA-Z-]+|:(?:hover|focus|focus-visible|active|visited))(?:\([^)]*\))?/g, '').trim();
    if (!cleaned) continue;
    try {
      for (const el of Array.from(doc.querySelectorAll(cleaned))) {
        if (!matched.includes(el)) matched.push(el);
      }
    } catch {
      // Ignore selectors unsupported by linkedom
    }
  }
  return matched;
}

test.describe('visual-effects Target Grader', () => {
  test('Smooth color gradients and color-mix() specify in oklch or in oklab and never in srgb', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyleRules(Array.from(stylesheet.cssRules));
    expect(entries.length).toBeGreaterThan(0);

    const customProps = collectCustomProps(entries);
    let hasSrgbSpace = false;

    // Allow @supports progressive-enhancement rules to supersede matching fallback declarations
    const effectiveDecls: Array<{ key: string | null; prop: string; rawVal: string; resolvedVal: string }> = [];
    for (const { rule, selector, inSupports } of entries) {
      const localProps = collectRuleLocalProps(rule);
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        const rawVal = rule.style.getPropertyValue(prop);
        const resolvedVal = resolveVars(rawVal, customProps, localProps);
        if (/\bin\s+srgb(?:-linear)?\b/i.test(rawVal) || /\bin\s+srgb(?:-linear)?\b/i.test(resolvedVal)) {
          hasSrgbSpace = true;
        }
        if (prop.startsWith('--') || /mask/i.test(prop)) continue;
        const key = selector !== '[style]' ? `${selector}:::${prop}` : null;
        if (inSupports && key) {
          const prevIdx = effectiveDecls.findIndex((d) => d.key === key);
          if (prevIdx !== -1) {
            effectiveDecls[prevIdx] = { key, prop, rawVal, resolvedVal };
            continue;
          }
        }
        effectiveDecls.push({ key, prop, rawVal, resolvedVal });
      }
    }

    let perceptualCount = 0;
    let nonPerceptualViolation = false;

    for (const { resolvedVal } of effectiveDecls) {
      for (const mix of extractCssFunctions(resolvedVal, /^color-mix$/i)) {
        const preamble = splitTopLevelCommas(mix.args)[0] ?? '';
        if (/\bin\s+ok(?:lab|lch)\b/i.test(preamble)) perceptualCount++;
        else nonPerceptualViolation = true;
      }

      for (const grad of extractCssFunctions(resolvedVal, /^(?:repeating-)?(?:linear|radial|conic)-gradient$/i)) {
        if (hasHardColorStops(grad.name, grad.args)) continue;
        const segments = splitTopLevelCommas(grad.args);
        const hasPreamble = segments.length > 1 && isGradientPreamble(segments[0]);
        const preamble = hasPreamble ? segments[0] : '';
        const stops = hasPreamble ? segments.slice(1) : segments;
        const distinctStops = new Set(stops.map((s) => s.trim().toLowerCase().replace(/\s+/g, '')));
        if (distinctStops.size <= 1) continue; // Uniform single-color scrim has no color transition

        if (/\bin\s+ok(?:lab|lch)\b/i.test(preamble)) perceptualCount++;
        else nonPerceptualViolation = true;
      }
    }

    expect(perceptualCount).toBeGreaterThan(0);
    expect(nonPerceptualViolation).toBe(false);
    expect(hasSrgbSpace).toBe(false);
  });

  test('At least one element box-shadow has two or more comma-separated shadow layers', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyleRules(Array.from(stylesheet.cssRules));
    expect(entries.length).toBeGreaterThan(0);

    const customProps = collectCustomProps(entries);
    const hasMultiLayerShadow = entries.some(({ rule }) => {
      const localProps = collectRuleLocalProps(rule);
      const boxShadow = resolveVars(rule.style.getPropertyValue('box-shadow'), customProps, localProps).trim();
      if (!boxShadow || boxShadow === 'none') return false;
      return splitTopLevelCommas(boxShadow).length >= 2;
    });

    expect(hasMultiLayerShadow).toBe(true);
  });

  test('A lighting or texture overlay uses background-blend-mode, or mix-blend-mode with isolation: isolate', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyleRules(Array.from(stylesheet.cssRules));
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(entries.length).toBeGreaterThan(0);

    const customProps = collectCustomProps(entries);

    const hasBgBlendMode = entries.some(({ rule }) => {
      const localProps = collectRuleLocalProps(rule);
      const val = resolveVars(rule.style.getPropertyValue('background-blend-mode'), customProps, localProps).trim();
      if (!val) return false;
      return splitTopLevelCommas(val).some(
        (mode) => Boolean(mode && !/^(?:normal|initial|unset|revert|revert-layer)$/i.test(mode))
      );
    });

    const isolatedElements = new Set<any>();
    for (const { rule, selector } of entries) {
      const localProps = collectRuleLocalProps(rule);
      if (resolveVars(rule.style.getPropertyValue('isolation'), customProps, localProps).trim() === 'isolate') {
        for (const d of docs) {
          for (const el of safeQueryAll(d.document, selector)) {
            isolatedElements.add(el);
          }
        }
      }
    }
    for (const d of docs) {
      for (const el of Array.from(d.document.querySelectorAll('[style]'))) {
        if (/\bisolation\s*:\s*isolate\b/i.test(el.getAttribute('style') ?? '')) {
          isolatedElements.add(el);
        }
      }
    }

    const hasAncestorIsolated = (el: any, includeSelf: boolean): boolean => {
      let curr = includeSelf ? el : el.parentElement;
      while (curr) {
        if (isolatedElements.has(curr)) return true;
        curr = curr.parentElement;
      }
      return false;
    };

    const hasIsolatedMixBlendMode =
      entries.some(({ rule, selector }) => {
        const localProps = collectRuleLocalProps(rule);
        const val = resolveVars(rule.style.getPropertyValue('mix-blend-mode'), customProps, localProps).trim();
        if (!val || /^(?:normal|initial|unset|revert|revert-layer)$/i.test(val)) return false;

        return splitCommaSelectors(selector).some((part) => {
          const isPseudoElement = /::(?:before|after)\s*$/i.test(part.trim());
          return docs.some((d) => safeQueryAll(d.document, part).some((el) => hasAncestorIsolated(el, isPseudoElement)));
        });
      }) ||
      docs.some((d) =>
        Array.from(d.document.querySelectorAll('[style]')).some((el: any) => {
          const m = (el.getAttribute('style') ?? '').match(/\bmix-blend-mode\s*:\s*([a-z-]+)/i);
          return Boolean(m && !/^(?:normal|initial|unset|revert|revert-layer)$/i.test(m[1]) && hasAncestorIsolated(el, false));
        })
      );

    expect(hasBgBlendMode || hasIsolatedMixBlendMode).toBe(true);
  });

  test('Decorative patterns are drawn with CSS gradients using hard color stops rather than image or SVG files', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyleRules(Array.from(stylesheet.cssRules));
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(entries.length).toBeGreaterThan(0);

    const customProps = collectCustomProps(entries);
    let hasHardStopGradientPattern = false;
    let hasPatternImageUrl = false;

    for (const { rule } of entries) {
      const localProps = collectRuleLocalProps(rule);
      const bgSize = resolveVars(rule.style.getPropertyValue('background-size'), customProps, localProps).trim();
      const hasExplicitBgSize = Boolean(
        bgSize && !/^(?:auto(?:\s+auto)?|cover|contain|initial|inherit|unset)$/i.test(bgSize)
      );

      for (const prop of ['background', 'background-image']) {
        const val = resolveVars(rule.style.getPropertyValue(prop), customProps, localProps);
        if (!val) continue;
        for (const grad of extractCssFunctions(val, /^(?:repeating-)?(?:linear|radial|conic)-gradient$/i)) {
          if (!hasHardColorStops(grad.name, grad.args)) continue;
          const isRepeating = /^repeating-/i.test(grad.name);
          const isTiled = hasExplicitBgSize || (prop === 'background' && hasShorthandTileSize(val.slice(grad.end)));
          if (isRepeating || isTiled) {
            hasHardStopGradientPattern = true;
          }
        }
      }

      for (let i = 0; i < rule.style.length; i++) {
        const val = resolveVars(rule.style.getPropertyValue(rule.style[i]), customProps, localProps);
        for (const u of extractCssFunctions(val, /^url$/i)) {
          const urlTarget = u.args.trim().replace(/^['"]|['"]$/g, '');
          if (urlTarget && !urlTarget.includes('photo-1495474472287-4d71bcdd2085')) {
            hasPatternImageUrl = true;
          }
        }
      }
    }

    const hasSvgElements = docs.some((d) => d.document.querySelectorAll('svg, img[src$=".svg"]').length > 0);

    expect(hasHardStopGradientPattern).toBe(true);
    expect(hasSvgElements).toBe(false);
    expect(hasPatternImageUrl).toBe(false);
  });

  test('A chart drawn with a CSS gradient is accompanied by accessible text or markup that exposes the same data', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const entries = getAllStyleRules(Array.from(stylesheet.cssRules));
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const customProps = collectCustomProps(entries);

    // 1. Verify a non-repeating conic-gradient is used in CSS to draw the pie chart
    const hasConicGradient = entries.some(({ rule }) => {
      const localProps = collectRuleLocalProps(rule);
      const bg = resolveVars(
        `${rule.style.getPropertyValue('background')} ${rule.style.getPropertyValue('background-image')}`,
        customProps,
        localProps
      );
      return extractCssFunctions(bg, /^conic-gradient$/i).length > 0;
    });
    expect(hasConicGradient).toBe(true);

    // Collect elements hidden from assistive technologies via CSS
    const cssHiddenElements = new Set<any>();
    for (const { rule, selector } of entries) {
      const localProps = collectRuleLocalProps(rule);
      const display = resolveVars(rule.style.getPropertyValue('display'), customProps, localProps).trim().toLowerCase();
      const visibility = resolveVars(rule.style.getPropertyValue('visibility'), customProps, localProps)
        .trim()
        .toLowerCase();
      if (display === 'none' || visibility === 'hidden') {
        for (const d of docs) {
          for (const el of safeQueryAll(d.document, selector)) {
            cssHiddenElements.add(el);
          }
        }
      }
    }

    const isHiddenFromAt = (node: any): boolean => {
      let curr: any = node;
      while (curr && curr.nodeType === 1) {
        const inlineStyle = (curr.getAttribute?.('style') ?? '').toLowerCase();
        if (
          curr.hasAttribute?.('hidden') ||
          curr.getAttribute?.('aria-hidden') === 'true' ||
          cssHiddenElements.has(curr) ||
          /\bdisplay\s*:\s*none\b|\bvisibility\s*:\s*hidden\b/.test(inlineStyle)
        ) {
          return true;
        }
        curr = curr.parentElement;
      }
      return false;
    };

    const collectAccessibleText = (node: any): string => {
      if (!node) return '';
      if (node.nodeType === 3) {
        return node.textContent ?? '';
      }
      if (node.nodeType !== 1 || isHiddenFromAt(node)) {
        return '';
      }
      const ariaLabel = node.getAttribute?.('aria-label') ?? '';
      const childText = Array.from(node.childNodes ?? [])
        .map((child) => collectAccessibleText(child))
        .join(' ');
      return `${ariaLabel} ${childText}`.trim();
    };

    // 2. Verify each drink card exposes accessible chart data (via a semantic <table> or accessible percentage text/labels)
    const cards = docs.flatMap((d) => Array.from(d.document.querySelectorAll('.card')));
    expect(cards.length).toBeGreaterThan(0);

    for (const card of cards) {
      const tables = Array.from(card.querySelectorAll('table'));
      const hasAccessibleTable = tables.some((table: any) => {
        if (isHiddenFromAt(table)) return false;
        const rows = table.querySelectorAll('tr');
        const cells = table.querySelectorAll('td, th');
        const dataCells = Array.from(table.querySelectorAll('td'));
        return (
          rows.length >= 2 &&
          cells.length >= 4 &&
          dataCells.some((td: any) => !isHiddenFromAt(td) && /\d/.test(td.textContent ?? ''))
        );
      });

      const accessibleText = collectAccessibleText(card);
      const hasAccessiblePercentageText = /\d+(?:\.\d+)?\s*%/.test(accessibleText);

      const hasAccessibleMeterOrProgress = Array.from(card.querySelectorAll('meter, progress')).some(
        (el: any) => !isHiddenFromAt(el) && /\d/.test(el.getAttribute?.('value') ?? '')
      );

      expect(hasAccessibleTable || hasAccessiblePercentageText || hasAccessibleMeterOrProgress).toBe(true);
    }
  });
});
