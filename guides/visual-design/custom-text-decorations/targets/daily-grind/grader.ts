import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
  getRules,
} from '../../../../../src/grading/test-fixture.ts';
import {
  getCascadedStyle,
  closestRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSKeyframesRule,
  type CSSRule,
  type CSSStyleDeclaration,
} from 'cssomnom';
import type { Document, Element } from 'linkedom';

// @ts-ignore - package.json omits "type": "module", causing tsc nodenext to infer CJS
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getBaseStyleRules(files: string[]): CSSStyleRule[] {
  return getRules(files, CSSStyleRule).filter(
    (rule) => !closestRule(rule, CSSMediaRule) && !closestRule(rule, CSSStyleRule),
  );
}

function getRulesWithoutInsetSupport(files: string[]): CSSStyleRule[] {
  return getRules(files, CSSStyleRule).filter((rule) => {
    if (closestRule(rule, CSSMediaRule) || closestRule(rule, CSSStyleRule)) return false;
    for (
      let curr = closestRule(rule, CSSSupportsRule);
      curr;
      curr = closestRule(curr, CSSSupportsRule)
    ) {
      if (curr.conditionText.toLowerCase().includes('text-decoration-inset')) return false;
    }
    return true;
  });
}

function getReducedMotionStyleRules(files: string[]): CSSStyleRule[] {
  return getRules(files, CSSStyleRule).filter((rule) => {
    for (
      let curr = closestRule(rule, CSSMediaRule);
      curr;
      curr = closestRule(curr, CSSMediaRule)
    ) {
      const cond = curr.conditionText.toLowerCase();
      if (cond.includes('prefers-reduced-motion') && cond.includes('no-preference')) {
        return false;
      }
    }
    return true;
  });
}

function splitSelectorList(selectorText: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of selectorText) {
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
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

function tryMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    return false;
  }
}

function stripWhereClauses(selector: string): string {
  let out = '';
  let i = 0;
  while (i < selector.length) {
    if (selector.slice(i).toLowerCase().startsWith(':where(')) {
      i += ':where('.length;
      let depth = 1;
      while (i < selector.length && depth > 0) {
        if (selector[i] === '(') depth++;
        else if (selector[i] === ')') depth--;
        i++;
      }
    } else {
      out += selector[i];
      i++;
    }
  }
  return out;
}

function isZeroSpecificityWhereBranch(branch: string): boolean {
  const trimmed = branch.trim();
  if (!trimmed.toLowerCase().includes(':where(')) return false;
  const remainder = stripWhereClauses(trimmed).replace(/[\s>+~]+/g, '');
  return remainder.length === 0;
}

function stripVarExpressions(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    if (value.slice(i).toLowerCase().startsWith('var(')) {
      i += 'var('.length;
      let depth = 1;
      while (i < value.length && depth > 0) {
        if (value[i] === '(') depth++;
        else if (value[i] === ')') depth--;
        i++;
      }
    } else {
      out += value[i];
      i++;
    }
  }
  return out;
}

function getEffectiveDecorationLine(style: CSSStyleDeclaration): string {
  const line = style.getPropertyValue('text-decoration-line').trim();
  if (line && line !== 'none') return line;
  const shorthand = style.getPropertyValue('text-decoration').trim();
  const matches = shorthand.match(/\b(underline|overline|line-through|none)\b/g);
  return matches ? matches.join(' ') : line;
}

function getEffectiveDecorationStyle(style: CSSStyleDeclaration): string {
  const decoStyle = style.getPropertyValue('text-decoration-style').trim();
  if (decoStyle) return decoStyle;
  const shorthand = style.getPropertyValue('text-decoration').trim();
  const match = shorthand.match(/\b(solid|double|dotted|dashed|wavy)\b/);
  return match ? match[1] : '';
}

function getEffectiveDecorationThickness(style: CSSStyleDeclaration): string {
  const thickness = style.getPropertyValue('text-decoration-thickness').trim();
  if (thickness) return thickness;
  const shorthand = style.getPropertyValue('text-decoration').trim();
  const maxMinClamp = shorthand.match(/\b(?:max|min|clamp|calc)\([^)]+\)/);
  if (maxMinClamp) return maxMinClamp[0];
  const lengthMatch = shorthand.match(/(?:\b\d*\.?\d+(?:(?:em|ex|cap|ch|ic|lh|rem|px)\b|%)|\b(?:from-font|auto)\b)/i);
  return lengthMatch ? lengthMatch[0] : '';
}

function getEffectiveDecorationColor(style: CSSStyleDeclaration): string {
  const color = style.getPropertyValue('text-decoration-color').trim();
  if (color) return color;
  const shorthand = style.getPropertyValue('text-decoration').trim();
  if (!shorthand) return '';
  if (/\b(?:color-mix|light-dark|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(shorthand)) {
    return shorthand;
  }
  if (shorthand.includes('var(')) return 'var(...)';
  const hexMatch = shorthand.match(/#[0-9a-f]{3,8}\b/i);
  if (hexMatch) return hexMatch[0];
  if (/\bcurrentcolor\b/i.test(shorthand)) return 'currentColor';
  const stripped = shorthand
    .replace(/\b(?:max|min|clamp|calc)\([^)]*\)/gi, ' ')
    .replace(/\b\d*\.?\d+(?:em|ex|cap|ch|ic|lh|rem|px|%)/gi, ' ')
    .replace(/\b(?:underline|overline|line-through|none|blink|solid|double|dotted|dashed|wavy|auto|from-font)\b/gi, ' ')
    .trim();
  return stripped;
}

function hasCustomizableDecorationProps(el: Element, rules: CSSStyleRule[]): {
  style: boolean;
  color: boolean;
  thickness: boolean;
  offset: boolean;
} {
  let hasStyle = false;
  let hasColor = false;
  let hasThickness = false;
  let hasOffset = false;

  for (const r of rules) {
    const branches = splitSelectorList(r.selectorText).filter(
      (b) => !/:(?:hover|focus-visible|focus|active)\b/i.test(b) && tryMatches(el, b)
    );
    if (branches.length === 0) continue;

    const isWhere = branches.some((b) => isZeroSpecificityWhereBranch(b));
    const shorthand = r.style.getPropertyValue('text-decoration').trim();
    const decoStyle = r.style.getPropertyValue('text-decoration-style').trim();
    const decoColor = r.style.getPropertyValue('text-decoration-color').trim();
    const decoThickness = r.style.getPropertyValue('text-decoration-thickness').trim();
    const offset = r.style.getPropertyValue('text-underline-offset').trim();

    if (isWhere) {
      if (getEffectiveDecorationStyle(r.style).length > 0) hasStyle = true;
      if (getEffectiveDecorationColor(r.style).length > 0) hasColor = true;
      if (getEffectiveDecorationThickness(r.style).length > 0) hasThickness = true;
      if (offset.length > 0) hasOffset = true;
    } else {
      if (decoStyle.includes('var(--')) hasStyle = true;
      if (decoColor.includes('var(--')) hasColor = true;
      if (decoThickness.includes('var(--') || /\b(?:max|min|clamp|calc)\([^)]*var\(--/i.test(shorthand)) {
        hasThickness = true;
      }
      if (offset.includes('var(--')) hasOffset = true;

      const varCount = (shorthand.match(/\bvar\(--/gi) || []).length;
      if (varCount > 0) {
        if (/^var\(--[^)]+\)$/i.test(shorthand)) {
          hasStyle = true;
          hasColor = true;
          hasThickness = true;
        } else {
          const shorthandNoVars = stripVarExpressions(shorthand);
          const literalStyle = /\b(solid|double|dotted|dashed|wavy)\b/i.test(shorthandNoVars);
          const literalThickness =
            /\b(?:max|min|clamp|calc)\([^)]+\)|(?:\b\d*\.?\d+(?:(?:em|ex|cap|ch|ic|lh|rem|px)\b|%)|\b(?:from-font|auto)\b)/i.test(
              shorthandNoVars
            );
          const literalColor =
            /\bcurrentcolor\b|#[0-9a-f]{3,8}\b|\b(?:color-mix|light-dark|rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\(/i.test(
              shorthandNoVars
            );
          const nonLiteralSlots: Array<'style' | 'color' | 'thickness'> = [];
          if (!literalStyle) nonLiteralSlots.push('style');
          if (!literalColor) nonLiteralSlots.push('color');
          if (!literalThickness) nonLiteralSlots.push('thickness');
          if (nonLiteralSlots.length > 0 && varCount >= nonLiteralSlots.length) {
            if (nonLiteralSlots.includes('style')) hasStyle = true;
            if (nonLiteralSlots.includes('color')) hasColor = true;
            if (nonLiteralSlots.includes('thickness')) hasThickness = true;
          }
        }
      }
    }
  }

  return { style: hasStyle, color: hasColor, thickness: hasThickness, offset: hasOffset };
}

function resolveDecoratedElement(el: Element, rules: CSSRule[]): Element {
  const directLine = getEffectiveDecorationLine(getCascadedStyle(el, rules));
  if (/\b(underline|overline|line-through)\b/.test(directLine)) {
    return el;
  }
  const targetText = el.textContent?.trim() || '';
  if (!targetText) return el;
  const descendants = Array.from(el.querySelectorAll('*')) as Element[];
  for (const desc of descendants) {
    if ((desc.textContent?.trim() || '') !== targetText) continue;
    if (desc.getAttribute('aria-hidden') === 'true') continue;
    const descLine = getEffectiveDecorationLine(getCascadedStyle(desc, rules));
    if (/\b(underline|overline|line-through)\b/.test(descLine)) {
      return desc;
    }
  }
  return el;
}

function getTargetElements(docs: Array<{ file: string; document: Document }>, rules: CSSRule[]) {
  for (const { document } of docs) {
    const navLinks = Array.from(document.querySelectorAll('nav a:not(.logout-link)')) as Element[];
    const footerLinks = Array.from(document.querySelectorAll('.footer-links a, footer a')) as Element[];
    const rawHeadings = Array.from(document.querySelectorAll('main h2, section h2')) as Element[];
    const rawCardTitles = Array.from(document.querySelectorAll('.card h3')) as Element[];
    if (navLinks.length > 0 && footerLinks.length > 0) {
      const headings = rawHeadings.map((el) => resolveDecoratedElement(el, rules));
      const cardTitles = rawCardTitles.map((el) => resolveDecoratedElement(el, rules));
      return {
        document,
        navLinks,
        footerLinks,
        links: [...navLinks, ...footerLinks],
        headings,
        cardTitles,
        allTargets: [...navLinks, ...footerLinks, ...headings, ...cardTitles],
      };
    }
  }
  return null;
}

test.describe('custom-text-decorations Target Grader', () => {
  test('Underlines, overlines, and strikethroughs are drawn with the native text-decoration properties, not with border-bottom, a background gradient, or a pseudo-element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const allRules = getRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { navLinks, footerLinks, headings, cardTitles, allTargets } = targets!;
    expect(allTargets.length).toBeGreaterThan(0);

    // Every target element group must use native text-decoration (underline, overline, or line-through)
    for (const group of [navLinks, footerLinks, headings, cardTitles]) {
      expect(group.length).toBeGreaterThan(0);
      const el = group[0];
      const cascaded = getCascadedStyle(el, baseStyleRules);
      const line = getEffectiveDecorationLine(cascaded);
      expect(line).toMatch(/\b(underline|overline|line-through)\b/);

      // Must not fake lines with border-bottom / border-block-end or background gradients
      expect(cascaded.getPropertyValue('border-bottom-style')).not.toMatch(/\b(solid|double|dotted|dashed|wavy)\b/);
      expect(cascaded.getPropertyValue('border-block-end-style')).not.toMatch(/\b(solid|double|dotted|dashed|wavy)\b/);
      expect(cascaded.getPropertyValue('background-image')).not.toContain('gradient');
      expect(cascaded.getPropertyValue('background')).not.toContain('gradient');
    }

    // Structurally check that no ::after or ::before rule targets any decorated element or its descendants
    const targetAndDescendants = allTargets.flatMap((el) => [
      el,
      ...(Array.from(el.querySelectorAll('*')) as Element[]),
    ]);
    const pseudoLineRules = allRules.filter((r): r is CSSStyleRule => {
      if (!(r instanceof CSSStyleRule) || !/::?(?:after|before)\b/i.test(r.selectorText)) {
        return false;
      }
      return splitSelectorList(r.selectorText).some((branch) => {
        if (!/::?(?:after|before)\b/i.test(branch)) return false;
        const baseSelector = branch
          .replace(/::?(?:before|after)\b/gi, '')
          .replace(/:(?:hover|focus-visible|focus|active)\b/gi, '')
          .trim();
        return (
          baseSelector.length > 0 &&
          targetAndDescendants.some((el) => tryMatches(el, baseSelector))
        );
      });
    });
    expect(pseudoLineRules.length).toBe(0);
  });

  test("The decoration's style, color, and thickness, and the text-underline-offset, are read from CSS custom properties or zero-specificity :where() defaults, so later overrides win", () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { allTargets } = targets!;
    expect(allTargets.length).toBeGreaterThan(0);

    // Every target must have line, style, color, and thickness (plus text-underline-offset for underlines)
    for (const el of allTargets) {
      const cascaded = getCascadedStyle(el, baseStyleRules);
      const line = getEffectiveDecorationLine(cascaded);
      expect(line).toMatch(/\b(underline|overline|line-through)\b/);
      expect(getEffectiveDecorationStyle(cascaded)).toMatch(/\b(solid|double|dotted|dashed|wavy)\b/);
      expect(getEffectiveDecorationColor(cascaded).length).toBeGreaterThan(0);
      expect(getEffectiveDecorationThickness(cascaded).length).toBeGreaterThan(0);
      if (line.includes('underline')) {
        expect(cascaded.getPropertyValue('text-underline-offset').trim().length).toBeGreaterThan(0);
      }
    }

    // For every decorated target, all four components (style, color, thickness, and offset when underlined)
    // must come from CSS custom properties (var(--...)) or zero-specificity :where() defaults.
    for (const el of allTargets) {
      const cascaded = getCascadedStyle(el, baseStyleRules);
      const line = getEffectiveDecorationLine(cascaded);
      const customizable = hasCustomizableDecorationProps(el, baseStyleRules);
      expect(customizable.style).toBe(true);
      expect(customizable.color).toBe(true);
      expect(customizable.thickness).toBe(true);
      if (line.includes('underline')) {
        expect(customizable.offset).toBe(true);
      }
    }
  });

  test('Decoration thickness and underline offset use relative units such as em, so they scale with the font size', () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { links, headings, cardTitles, allTargets } = targets!;
    expect(allTargets.length).toBeGreaterThan(0);

    // Accept units that scale with the decorated element's font size (em, ex, cap, ch, ic, lh, %, and from-font for thickness).
    // Exclude rem (scales with root font size rather than element font size) and px.
    const fontRelativeThicknessPattern = /(?:\d*\.?\d+(?:(?:em|ex|cap|ch|ic|lh)\b|%)|\bfrom-font\b)/i;
    const fontRelativeOffsetPattern = /\d*\.?\d+(?:(?:em|ex|cap|ch|ic|lh)\b|%)/i;

    for (const el of [links[0], ...headings, ...cardTitles]) {
      const cascaded = getCascadedStyle(el, baseStyleRules);
      const thickness = getEffectiveDecorationThickness(cascaded);
      expect(thickness).toMatch(fontRelativeThicknessPattern);
    }

    for (const el of links) {
      const cascaded = getCascadedStyle(el, baseStyleRules);
      const offset = cascaded.getPropertyValue('text-underline-offset').trim();
      expect(offset).toMatch(fontRelativeOffsetPattern);
    }
  });

  test('A decorated link is a real <a> with an href destination, not a javascript: URL with a script handler', () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { links } = targets!;
    expect(links.length).toBeGreaterThan(0);

    for (const link of links) {
      expect(link.tagName.toLowerCase()).toBe('a');
      const href = link.getAttribute('href')?.trim() || '';
      expect(href.length).toBeGreaterThan(0);
      expect(href.toLowerCase().startsWith('javascript:')).toBe(false);
      expect(link.getAttribute('onclick')).toBeNull();

      // Ensure the link actually has a decoration applied
      const cascaded = getCascadedStyle(link, baseStyleRules);
      expect(getEffectiveDecorationLine(cascaded)).toMatch(/\b(underline|overline|line-through)\b/);
    }
  });

  test('A link with a hover reveal underline trims its line with text-decoration-inset at rest, and returns the inset to 0 on both :hover and :focus-visible', () => {
    const styleRules = getRules(targetFiles, CSSStyleRule);

    // Find rule(s) setting text-decoration-inset with 100% trim at rest for links / reveal
    const restInsetRules = styleRules.filter((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset').trim();
      return inset.includes('100%');
    });
    expect(restInsetRules.length).toBeGreaterThan(0);

    // Find rule(s) returning the end inset to 0 (or matching start inset, not 100%) on :hover and :focus-visible
    const activeInsetRules = styleRules.filter((r) => {
      const inset = r.style.getPropertyValue('text-decoration-inset').trim();
      return inset.length > 0 && !inset.includes('100%');
    });
    expect(activeInsetRules.some((r) => r.selectorText.includes(':hover'))).toBe(true);
    expect(activeInsetRules.some((r) => r.selectorText.includes(':focus-visible'))).toBe(true);
  });

  test('The hover reveal declares its underline separately from text-decoration-inset and never only inside an @supports test for it, so the underline is visible where text-decoration-inset is unsupported', () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { links } = targets!;
    expect(links.length).toBeGreaterThan(0);

    // Rules outside @media and outside @supports (text-decoration-inset: ...) must declare the underline on links
    const noInsetSupportRules = getRulesWithoutInsetSupport(targetFiles);
    for (const link of links) {
      const baseCascaded = getCascadedStyle(link, noInsetSupportRules);
      expect(getEffectiveDecorationLine(baseCascaded)).toContain('underline');
    }

    // Verify text-decoration-inset is declared as its own property somewhere in the stylesheet
    const insetRules = getRules(targetFiles, CSSStyleRule).filter(
      (r) => r.style.getPropertyValue('text-decoration-inset').trim().length > 0,
    );
    expect(insetRules.length).toBeGreaterThan(0);
  });

  test('text-decoration-skip-ink: auto and text-decoration-skip-spaces are not declared when they would only restate the default or have no effect', () => {
    const docs = getHtmlDocuments(targetFiles);
    const baseStyleRules = getBaseStyleRules(targetFiles);
    const allRules = getRules(targetFiles);
    const targets = getTargetElements(docs, baseStyleRules);

    expect(targets).not.toBeNull();
    const { links } = targets!;
    expect(links.length).toBeGreaterThan(0);

    // Precondition: ensure decorations are actually present
    const sampleCascaded = getCascadedStyle(links[0], baseStyleRules);
    expect(getEffectiveDecorationLine(sampleCascaded)).toMatch(/\b(underline|overline|line-through)\b/);

    for (const rule of allRules) {
      if (rule instanceof CSSStyleRule) {
        const skipInk = rule.style.getPropertyValue('text-decoration-skip-ink').trim();
        expect(skipInk).not.toBe('auto');

        const skipSpaces = rule.style.getPropertyValue('text-decoration-skip-spaces').trim();
        expect(skipSpaces).not.toMatch(/^(?:start|end|start\s+end|end\s+start)$/);
      }
    }
  });

  test('Hover reveal and draw-on animations are not applied when prefers-reduced-motion: reduce matches, and the line is fully visible otherwise', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allRules = getRules(targetFiles);
    const reducedMotionStyleRules = getReducedMotionStyleRules(targetFiles);
    const targets = getTargetElements(docs, reducedMotionStyleRules);

    expect(targets).not.toBeNull();
    const { allTargets } = targets!;
    expect(allTargets.length).toBeGreaterThan(0);

    // Must have an @media (prefers-reduced-motion: ...) rule (either no-preference or reduce, top-level or nested)
    const mediaRules = allRules.filter(
      (r): r is CSSMediaRule =>
        r instanceof CSSMediaRule &&
        r.conditionText.toLowerCase().includes('prefers-reduced-motion'),
    );
    expect(mediaRules.length).toBeGreaterThan(0);

    // There must be reveal transitions or animations on text-decoration-inset when motion is allowed
    const hasAnimatedInset = allRules.some((r) => {
      if (r instanceof CSSStyleRule) {
        const inset = r.style.getPropertyValue('text-decoration-inset').trim();
        const transition = r.style.getPropertyValue('transition').trim();
        const animation = r.style.getPropertyValue('animation').trim();
        return (
          inset.includes('100%') ||
          transition.includes('text-decoration-inset') ||
          (animation.length > 0 && !/^none\b/i.test(animation))
        );
      }
      if (r instanceof CSSKeyframesRule) {
        return true;
      }
      return false;
    });
    expect(hasAnimatedInset).toBe(true);

    // When prefers-reduced-motion: reduce matches (outside no-preference, and including reduce rules),
    // lines must be fully visible (not trimmed to 100%) and have no active inset transition or animation.
    for (const el of allTargets) {
      const reducedMotionCascaded = getCascadedStyle(el, reducedMotionStyleRules);
      const line = getEffectiveDecorationLine(reducedMotionCascaded);
      expect(line).toMatch(/\b(underline|overline|line-through)\b/);

      const inset = reducedMotionCascaded.getPropertyValue('text-decoration-inset').trim();
      expect(inset).not.toContain('100%');

      const transition = reducedMotionCascaded.getPropertyValue('transition').trim();
      const transitionDuration = reducedMotionCascaded.getPropertyValue('transition-duration').trim();
      const hasInsetTransition =
        (transition.includes('text-decoration-inset') ||
          (transition.includes('all') && !/^none\b/i.test(transition))) &&
        !/^0(?:s|ms)\b/.test(transitionDuration);
      expect(hasInsetTransition).toBe(false);

      const animation = reducedMotionCascaded.getPropertyValue('animation').trim();
      const animationName = reducedMotionCascaded.getPropertyValue('animation-name').trim();
      expect(animation === '' || /^none\b/i.test(animation) || animationName === 'none').toBe(true);
    }
  });
});
