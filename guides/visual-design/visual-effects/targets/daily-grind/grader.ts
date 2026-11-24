/*
 * Expectation Coverage:
 * - Expectation 1: TESTED - Smooth color gradients and color-mix() specify perceptual interpolation color space (in oklch or in oklab) directly or via custom property, and none specify in srgb.
 * - Expectation 2: TESTED - At least one element's box-shadow has two or more comma-separated shadow layers to create depth.
 * - Expectation 3: TESTED - A lighting or texture overlay uses background-blend-mode, or uses mix-blend-mode on an element inside an isolation: isolate stacking context.
 * - Expectation 4: TESTED - Decorative patterns (stripes, dots, checkerboards) are drawn with CSS gradients that use hard color stops, not with image or SVG files.
 * - Expectation 5: TESTED - A chart drawn with a CSS gradient (such as a conic-gradient() pie) is accompanied by accessible text or markup (such as visible percentage labels, an accessible name or description, or a semantic <table>) that exposes the same data to assistive technologies.
 * - Expectation 6: TESTED - Text and icons over a gradient or pattern background, and text filled with a gradient, have a contrast ratio against each color stop of at least 4.5:1 for text, 3:1 for large text (at least 24px, or at least 18.66px bold), and 3:1 for icons.
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
  inSupportsNot: boolean;
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
  inSupports = false,
  inSupportsNot = false
): StyledRuleEntry[] {
  const result: StyledRuleEntry[] = [];
  for (const rule of rules) {
    const cssText = rule.cssText.trim();
    const nextSupportsNot = inSupportsNot || /^@supports\s+not\b/i.test(cssText);
    const nextSupports = !nextSupportsNot && (inSupports || /^@supports\b/i.test(cssText));
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
      result.push({ rule, selector: nextSelector, inSupports: nextSupports, inSupportsNot: nextSupportsNot });
    }
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...getAllStyleRules(Array.from(rule.cssRules), nextSelector, nextSupports, nextSupportsNot));
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

// cssomnom returns "" for multi-layer `background` shorthands that contain `var()` layers,
// so recover the raw declaration from `rule.style.cssText` when `getPropertyValue` is empty.
function extractRawDeclFromStyleText(styleCssText: string, targetProp: string): string {
  const lowerTarget = targetProp.toLowerCase();
  let found = '';
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  const pushChunk = (chunk: string) => {
    const colonIdx = chunk.indexOf(':');
    if (colonIdx === -1) return;
    const name = chunk.slice(0, colonIdx).trim().toLowerCase();
    if (name === lowerTarget) {
      found = chunk.slice(colonIdx + 1).replace(/!important\s*$/i, '').trim();
    }
  };
  for (let i = 0; i < styleCssText.length; i++) {
    const ch = styleCssText[i];
    if (quote) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    else if (ch === ';' && depth === 0) {
      pushChunk(styleCssText.slice(start, i));
      start = i + 1;
    }
  }
  if (start < styleCssText.length) pushChunk(styleCssText.slice(start));
  return found;
}

function getRulePropValue(rule: CSSStyleRule, prop: string): string {
  const direct = rule.style.getPropertyValue(prop);
  if (direct) return direct;
  return extractRawDeclFromStyleText(rule.style.cssText, prop);
}

function collectRuleLocalProps(rule: CSSStyleRule): Map<string, string> {
  const localProps = new Map<string, string>();
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style[i];
    if (prop.startsWith('--')) {
      const val = getRulePropValue(rule, prop).trim();
      if (val) localProps.set(prop, val);
    }
  }
  return localProps;
}

function collectCustomProps(entries: StyledRuleEntry[]): Map<string, string> {
  const customProps = new Map<string, string>();
  for (const { rule, selector, inSupportsNot } of entries) {
    if (inSupportsNot) continue;
    const isGlobalScope = /^(?::root|html|body|\*)$/i.test(selector.trim());
    for (let i = 0; i < rule.style.length; i++) {
      const prop = rule.style[i];
      if (prop.startsWith('--')) {
        const val = getRulePropValue(rule, prop).trim();
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
    const u0 = pos0.match(/^((?:\d+(?:\.\d+)?|\.\d+))(px|em|rem|%)$/i);
    const u1 = pos1.match(/^((?:\d+(?:\.\d+)?|\.\d+))(px|em|rem|%)$/i);
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

function isNonNormalBlendMode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return splitTopLevelCommas(trimmed).some(
    (mode) => Boolean(mode && !/^(?:normal|initial|unset|revert|revert-layer)$/i.test(mode))
  );
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
    for (const { rule, selector, inSupports, inSupportsNot } of entries) {
      if (inSupportsNot) continue;
      const localProps = collectRuleLocalProps(rule);
      for (let i = 0; i < rule.style.length; i++) {
        const prop = rule.style[i];
        const rawVal = getRulePropValue(rule, prop);
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
      const boxShadow = resolveVars(getRulePropValue(rule, 'box-shadow'), customProps, localProps).trim();
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
      const val = resolveVars(getRulePropValue(rule, 'background-blend-mode'), customProps, localProps);
      return isNonNormalBlendMode(val);
    });

    const isolatedElements = new Set<any>();
    for (const { rule, selector } of entries) {
      const localProps = collectRuleLocalProps(rule);
      if (/^isolate$/i.test(resolveVars(getRulePropValue(rule, 'isolation'), customProps, localProps).trim())) {
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
        const val = resolveVars(getRulePropValue(rule, 'mix-blend-mode'), customProps, localProps);
        if (!isNonNormalBlendMode(val)) return false;

        return splitCommaSelectors(selector).some((part) => {
          const isPseudoElement = /::(?:before|after)\s*$/i.test(part.trim());
          return docs.some((d) => safeQueryAll(d.document, part).some((el) => hasAncestorIsolated(el, isPseudoElement)));
        });
      }) ||
      docs.some((d) =>
        Array.from(d.document.querySelectorAll('[style]')).some((el: any) => {
          const m = (el.getAttribute('style') ?? '').match(/\bmix-blend-mode\s*:\s*([a-z-]+)/i);
          return Boolean(m && isNonNormalBlendMode(m[1]) && hasAncestorIsolated(el, false));
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
    const blendOverlayElements = new Set<any>();
    for (const { rule, selector } of entries) {
      const localProps = collectRuleLocalProps(rule);
      const bgBlend = resolveVars(getRulePropValue(rule, 'background-blend-mode'), customProps, localProps);
      const mixBlend = resolveVars(getRulePropValue(rule, 'mix-blend-mode'), customProps, localProps);
      if (isNonNormalBlendMode(bgBlend) || isNonNormalBlendMode(mixBlend)) {
        for (const d of docs) {
          for (const el of safeQueryAll(d.document, selector)) {
            blendOverlayElements.add(el);
          }
        }
      }
    }

    let hasHardStopGradientPattern = false;
    let hasPatternImageUrl = false;

    for (const { rule, selector } of entries) {
      const localProps = collectRuleLocalProps(rule);
      const bgSize = resolveVars(getRulePropValue(rule, 'background-size'), customProps, localProps).trim();
      const hasExplicitBgSize = Boolean(
        bgSize && !/^(?:auto(?:\s+auto)?|cover|contain|initial|inherit|unset)$/i.test(bgSize)
      );

      for (const prop of ['background', 'background-image']) {
        const val = resolveVars(getRulePropValue(rule, prop), customProps, localProps);
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

      const ruleHasBlendOverlay =
        isNonNormalBlendMode(resolveVars(getRulePropValue(rule, 'background-blend-mode'), customProps, localProps)) ||
        isNonNormalBlendMode(resolveVars(getRulePropValue(rule, 'mix-blend-mode'), customProps, localProps)) ||
        (() => {
          const matched = docs.flatMap((d) => safeQueryAll(d.document, selector));
          return matched.length > 0 && matched.every((el) => blendOverlayElements.has(el));
        })();

      const checkedProps = new Set<string>(['background', 'background-image']);
      for (let i = 0; i < rule.style.length; i++) {
        checkedProps.add(rule.style[i]);
      }
      for (const prop of checkedProps) {
        if (prop.startsWith('--')) continue;
        const val = resolveVars(getRulePropValue(rule, prop), customProps, localProps);
        if (!val) continue;
        for (const u of extractCssFunctions(val, /^url$/i)) {
          const urlTarget = u.args.trim().replace(/^['"]|['"]$/g, '');
          const isAllowedHeroPhoto = urlTarget.includes('photo-1495474472287-4d71bcdd2085');
          const isLightingTextureOverlay =
            ruleHasBlendOverlay && (prop === 'background' || prop === 'background-image');
          if (urlTarget && !isAllowedHeroPhoto && !isLightingTextureOverlay) {
            hasPatternImageUrl = true;
          }
        }
      }
    }

    const hasSvgElements = docs.some((d) => {
      if (d.document.querySelectorAll('img[src$=".svg"]').length > 0) return true;
      return Array.from(d.document.querySelectorAll('svg')).some((svg: any) => {
        const isPureFilterContainer =
          svg.querySelectorAll('filter, defs').length > 0 &&
          svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line, use, image').length === 0;
        return !isPureFilterContainer;
      });
    });

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
        `${getRulePropValue(rule, 'background')} ${getRulePropValue(rule, 'background-image')}`,
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
      const display = resolveVars(getRulePropValue(rule, 'display'), customProps, localProps).trim().toLowerCase();
      const visibility = resolveVars(getRulePropValue(rule, 'visibility'), customProps, localProps)
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

    const collectAccessibleText = (node: any, visited = new Set<any>(), ignoreHidden = false): string => {
      if (!node || visited.has(node)) return '';
      if (node.nodeType === 3) {
        return node.textContent ?? '';
      }
      if (node.nodeType !== 1 || (!ignoreHidden && isHiddenFromAt(node))) {
        return '';
      }
      visited.add(node);
      const ariaLabel = node.getAttribute?.('aria-label') ?? '';
      const doc = node.ownerDocument;
      const refTexts: string[] = [];
      for (const attr of ['aria-labelledby', 'aria-describedby']) {
        const ids = (node.getAttribute?.(attr) ?? '').trim().split(/\s+/).filter(Boolean);
        for (const id of ids) {
          const refEl = doc?.getElementById?.(id);
          if (refEl) refTexts.push(collectAccessibleText(refEl, visited, true));
        }
      }
      const childText = Array.from(node.childNodes ?? [])
        .map((child) => collectAccessibleText(child, visited, ignoreHidden))
        .join(' ');
      return `${ariaLabel} ${refTexts.join(' ')} ${childText}`.trim();
    };

    // 2. Verify each drink card exposes accessible chart data (via a semantic <table>/<dl> or accessible percentage text/labels)
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

      const dls = Array.from(card.querySelectorAll('dl'));
      const hasAccessibleDl = dls.some((dl: any) => {
        if (isHiddenFromAt(dl)) return false;
        const terms = Array.from(dl.querySelectorAll('dt')).filter(
          (dt: any) => !isHiddenFromAt(dt) && (dt.textContent ?? '').trim().length > 0
        );
        const defs = Array.from(dl.querySelectorAll('dd')).filter(
          (dd: any) => !isHiddenFromAt(dd) && /\d/.test(dd.textContent ?? '')
        );
        return terms.length >= 2 && defs.length >= 2;
      });

      const accessibleText = collectAccessibleText(card);
      const hasAccessiblePercentageText = /\d+(?:\.\d+)?\s*%/.test(accessibleText);

      const hasAccessibleMeterOrProgress = Array.from(card.querySelectorAll('meter, progress')).some(
        (el: any) => !isHiddenFromAt(el) && /\d/.test(el.getAttribute?.('value') ?? '')
      );

      expect(
        hasAccessibleTable || hasAccessibleDl || hasAccessiblePercentageText || hasAccessibleMeterOrProgress
      ).toBe(true);
    }
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Text and icons over a gradient or pattern background, and text filled with a gradient, have WCAG contrast against each color stop', async ({
      page,
    }) => {
      const report = await page.evaluate(() => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d')!;

        const resolveColor = (cssColor: string): [number, number, number, number] | null => {
          const trimmed = cssColor.trim();
          if (!trimmed || trimmed === 'none') return null;
          ctx.clearRect(0, 0, 1, 1);
          ctx.fillStyle = 'rgba(0, 0, 0, 0)';
          ctx.fillStyle = trimmed;
          // Detect invalid color by checking if fillStyle stayed transparent when input wasn't transparent
          ctx.fillRect(0, 0, 1, 1);
          const data = ctx.getImageData(0, 0, 1, 1).data;
          return [data[0]!, data[1]!, data[2]!, data[3]! / 255];
        };

        const composite = (
          fg: [number, number, number, number],
          bg: [number, number, number, number],
        ): [number, number, number, number] => {
          const a = fg[3] + bg[3] * (1 - fg[3]);
          if (a === 0) return [255, 255, 255, 1];
          return [
            (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
            (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
            (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
            a,
          ];
        };

        const luminance = ([r, g, b]: [number, number, number, number]): number => {
          const chan = [r, g, b].map((v) => {
            const s = v / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * chan[0]! + 0.7152 * chan[1]! + 0.0722 * chan[2]!;
        };

        const contrast = (c1: [number, number, number, number], c2: [number, number, number, number]): number => {
          const l1 = luminance(c1);
          const l2 = luminance(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };

        const getEffectiveSolidBg = (startEl: Element | null): [number, number, number, number] => {
          const layers: Array<[number, number, number, number]> = [];
          let curr: Element | null = startEl;
          while (curr) {
            const bg = resolveColor(window.getComputedStyle(curr).backgroundColor);
            if (bg && bg[3] > 0) layers.push(bg);
            curr = curr.parentElement;
          }
          let acc: [number, number, number, number] = [255, 255, 255, 1];
          for (let i = layers.length - 1; i >= 0; i--) {
            acc = composite(layers[i]!, acc);
          }
          return acc;
        };

        const splitTopLevelComma = (input: string): string[] => {
          const parts: string[] = [];
          let depth = 0;
          let cur = '';
          for (let i = 0; i < input.length; i++) {
            const ch = input[i]!;
            if (ch === '(') depth++;
            else if (ch === ')' && depth > 0) depth--;
            if (ch === ',' && depth === 0) {
              if (cur.trim()) parts.push(cur.trim());
              cur = '';
            } else {
              cur += ch;
            }
          }
          if (cur.trim()) parts.push(cur.trim());
          return parts;
        };

        const extractGradientStops = (bgImage: string): string[] => {
          const stops: string[] = [];
          const gradRe = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/gi;
          let m: RegExpExecArray | null;
          while ((m = gradRe.exec(bgImage)) !== null) {
            let depth = 1;
            let i = m.index + m[0].length;
            let cur = '';
            const segs: string[] = [];
            while (i < bgImage.length && depth > 0) {
              const ch = bgImage[i]!;
              if (ch === '(') depth++;
              else if (ch === ')') {
                depth--;
                if (depth === 0) break;
              }
              if (ch === ',' && depth === 1) {
                segs.push(cur.trim());
                cur = '';
              } else {
                cur += ch;
              }
              i++;
            }
            if (cur.trim()) segs.push(cur.trim());

            for (let sIdx = 0; sIdx < segs.length; sIdx++) {
              const seg = segs[sIdx]!;
              if (
                sIdx === 0 &&
                /^(?:to\b|from\b|at\b|in\b|circle\b|ellipse\b|closest-|farthest-|-?\d)/i.test(seg)
              ) {
                continue;
              }
              // Extract color function or hex/named color at start of stop
              const fnMatch = seg.match(/^((?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^)]+\)|#[0-9a-f]{3,8}|[a-z]+)/i);
              if (fnMatch) {
                stops.push(fnMatch[1]!);
              }
            }
          }
          return stops;
        };

        // Composite any upper normal-blend gradient layers over a lower stop using the worst-case (lowest-contrast) upper stop.
        const getLayerAwareStops = (
          bgImage: string,
          blendModeStr: string,
          baseBg: [number, number, number, number],
          fgRaw: [number, number, number, number],
        ): Array<{ label: string; color: [number, number, number, number] }> => {
          const layers = splitTopLevelComma(bgImage);
          const blendModes = blendModeStr
            .split(',')
            .map((b) => b.trim().toLowerCase())
            .filter(Boolean);
          const parsedLayers = layers.map((layer, idx) => ({
            stops: extractGradientStops(layer)
              .map((s) => ({ label: s, rgba: resolveColor(s) }))
              .filter((x): x is { label: string; rgba: [number, number, number, number] } => Boolean(x.rgba)),
            blend: blendModes[idx % Math.max(1, blendModes.length)] ?? 'normal',
          }));

          const results: Array<{ label: string; color: [number, number, number, number] }> = [];
          for (let i = 0; i < parsedLayers.length; i++) {
            const layer = parsedLayers[i]!;
            for (const stop of layer.stops) {
              if (stop.rgba[3] === 0) continue;
              let eff = composite(stop.rgba, baseBg);
              for (let j = i - 1; j >= 0; j--) {
                const upper = parsedLayers[j]!;
                if (upper.blend !== 'normal' || upper.stops.length === 0) continue;
                let worstColor = eff;
                let worstRatio = Infinity;
                for (const uStop of upper.stops) {
                  const candidate = composite(uStop.rgba, eff);
                  const r = contrast(composite(fgRaw, candidate), candidate);
                  if (r < worstRatio) {
                    worstRatio = r;
                    worstColor = candidate;
                  }
                }
                eff = worstColor;
              }
              results.push({ label: stop.label, color: eff });
            }
          }
          return results;
        };

        const failures: string[] = [];
        let checked = 0;

        for (const el of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
          const cs = window.getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;

          const hasOwnText = Array.from(el.childNodes).some(
            (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim().length > 0,
          );
          const isIcon = el.tagName.toLowerCase() === 'svg';
          if (!hasOwnText && !isIcon) continue;

          // Find effective gradient background on self or nearest non-occluded ancestor
          let gradientHost: Element | null = null;
          let bgClipText =
            cs.backgroundClip === 'text' ||
            (cs as CSSStyleDeclaration & { webkitBackgroundClip?: string }).webkitBackgroundClip === 'text';

          let curr: Element | null = el;
          while (curr) {
            const ccs = window.getComputedStyle(curr);
            if (ccs.backgroundImage && ccs.backgroundImage.includes('gradient(')) {
              gradientHost = curr;
              break;
            }
            const cBg = resolveColor(ccs.backgroundColor);
            if (cBg && cBg[3] >= 0.99) {
              break;
            }
            curr = curr.parentElement;
          }

          if (!gradientHost) continue;

          const hostCs = window.getComputedStyle(gradientHost);
          const baseBg = getEffectiveSolidBg(gradientHost);
          const fgRaw = isIcon ? resolveColor(cs.fill && cs.fill !== 'none' ? cs.fill : cs.color) : resolveColor(cs.color);
          if (!fgRaw) continue;

          const fontSize = parseFloat(cs.fontSize) || 16;
          const fontWeight = parseFloat(cs.fontWeight) || 400;
          const isLargeText = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
          const minContrast = isIcon || isLargeText ? 3.0 : 4.5;

          if (bgClipText && gradientHost === el) {
            const stops = extractGradientStops(hostCs.backgroundImage);
            if (stops.length === 0) continue;
            const pageBg = getEffectiveSolidBg(el.parentElement);
            checked++;
            for (const stopStr of stops) {
              const stopCol = resolveColor(stopStr);
              if (!stopCol || stopCol[3] === 0) continue;
              const effStop = composite(stopCol, pageBg);
              const ratio = contrast(effStop, pageBg);
              if (ratio < minContrast) {
                failures.push(
                  `<${el.tagName.toLowerCase()}> gradient-filled text "${(el.textContent ?? '').trim().slice(0, 25)}" stop ${stopStr} contrast ${ratio.toFixed(2)} < ${minContrast}`,
                );
              }
            }
          } else {
            const layerStops = getLayerAwareStops(
              hostCs.backgroundImage,
              hostCs.backgroundBlendMode || 'normal',
              baseBg,
              fgRaw,
            );
            if (layerStops.length === 0) continue;
            checked++;
            for (const { label: stopStr, color: effStop } of layerStops) {
              const effFg = composite(fgRaw, effStop);
              const ratio = contrast(effFg, effStop);
              if (ratio < minContrast) {
                failures.push(
                  `<${el.tagName.toLowerCase()}> "${(el.textContent ?? '').trim().slice(0, 25)}" vs stop ${stopStr} contrast ${ratio.toFixed(2)} < ${minContrast}`,
                );
              }
            }
          }
        }

        return { checked, failures };
      });

      expect(report.checked).toBeGreaterThan(0);
      expect(report.failures).toEqual([]);
    });
  });
});
