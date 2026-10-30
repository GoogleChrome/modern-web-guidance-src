import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSPropertyRule,
  CSSContainerRule,
  CSSSupportsRule,
  CSSKeyframesRule,
  CSSLayerBlockRule,
  CSSStyleRule,
  type CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';
import type { Document } from 'linkedom';

// @ts-ignore - package.json does not specify "type": "module", which triggers TS1470 under --module nodenext
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...getAllRules(Array.from(rule.cssRules as Iterable<CSSRule>)));
    }
  }
  return result;
}

function getAllStyleRules(sheet: CSSStyleSheet): CSSStyleRule[] {
  return getAllRules(Array.from(sheet.cssRules)).filter(
    (r): r is CSSStyleRule => r instanceof CSSStyleRule,
  );
}

function getAllContainerRules(sheet: CSSStyleSheet): CSSContainerRule[] {
  return getAllRules(Array.from(sheet.cssRules)).filter(
    (r): r is CSSContainerRule => r instanceof CSSContainerRule,
  );
}

function getAllSupportsRules(sheet: CSSStyleSheet): CSSSupportsRule[] {
  return getAllRules(Array.from(sheet.cssRules)).filter(
    (r): r is CSSSupportsRule => r instanceof CSSSupportsRule,
  );
}

function getAllKeyframesRules(sheet: CSSStyleSheet): CSSKeyframesRule[] {
  return getAllRules(Array.from(sheet.cssRules)).filter(
    (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule,
  );
}

function getStyleDeclarationValues(rule: CSSStyleRule): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (let i = 0; i < rule.style.length; i++) {
    const prop = rule.style.item(i);
    if (prop) {
      entries.push([prop, rule.style.getPropertyValue(prop)]);
    }
  }
  return entries;
}

test.describe('icons Target Grader', () => {
  test('Registers --icon-start and --icon-end using @property with syntax "*" and inherits: false', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const topRules = Array.from(sheet.cssRules);
    const propRules = topRules.filter(
      (r): r is CSSPropertyRule => r instanceof CSSPropertyRule,
    );
    const hasStart = propRules.some(
      (r) =>
        r.name === '--icon-start' &&
        r.syntax.replace(/['"\s]/g, '') === '*' &&
        r.inherits === false,
    );
    const hasEnd = propRules.some(
      (r) =>
        r.name === '--icon-end' &&
        r.syntax.replace(/['"\s]/g, '') === '*' &&
        r.inherits === false,
    );
    expect(hasStart && hasEnd).toBe(true);
  });

  test('Defines icon design tokens using root-relative URLs or embedded data URIs on :root', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(sheet);
    const rootRules = styleRules.filter((r) => r.selectorText.includes(':root'));
    const iconTokens = rootRules.flatMap((r) =>
      getStyleDeclarationValues(r).filter(
        ([prop]) => prop.startsWith('--icon-') && !prop.startsWith('--icon-style-'),
      ),
    );
    const allValidUrls =
      iconTokens.length > 0 &&
      iconTokens.every(
        ([, val]) => val.includes('data:image/svg+xml') || /url\(\s*['"]?\//.test(val),
      );
    expect(allValidUrls).toBe(true);
  });

  test('Uses CSS Container Style Queries (@container style(...)) for --icon-start and --icon-end', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(sheet);
    const hasStartQuery = containerRules.some(
      (r) => r.conditionText.includes('style') && r.conditionText.includes('--icon-start'),
    );
    const hasEndQuery = containerRules.some(
      (r) => r.conditionText.includes('style') && r.conditionText.includes('--icon-end'),
    );
    expect(hasStartQuery && hasEndQuery).toBe(true);
  });

  test('Renders icons using CSS mask inside container style query blocks on ::before and ::after pseudo-elements', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(sheet);
    const startContainers = containerRules.filter((r) =>
      r.conditionText.includes('--icon-start'),
    );
    const endContainers = containerRules.filter((r) =>
      r.conditionText.includes('--icon-end'),
    );

    const hasBeforeMask = startContainers.some((c) =>
      getAllRules(Array.from(c.cssRules)).some(
        (r) =>
          r instanceof CSSStyleRule &&
          r.selectorText.includes('::before') &&
          getStyleDeclarationValues(r).some(
            ([prop, val]) => prop.includes('mask') && val.includes('--icon-start'),
          ),
      ),
    );

    const hasAfterMask = endContainers.some((c) =>
      getAllRules(Array.from(c.cssRules)).some(
        (r) =>
          r instanceof CSSStyleRule &&
          r.selectorText.includes('::after') &&
          getStyleDeclarationValues(r).some(
            ([prop, val]) => prop.includes('mask') && val.includes('--icon-end'),
          ),
      ),
    );

    expect(hasBeforeMask && hasAfterMask).toBe(true);
  });

  test('Colors icon pseudo-elements using currentColor via background-color', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(sheet);
    const hasCurrentColor = containerRules.some((c) =>
      getAllRules(Array.from(c.cssRules)).some(
        (r) =>
          r instanceof CSSStyleRule &&
          (r.selectorText.includes('::before') || r.selectorText.includes('::after')) &&
          /currentColor/i.test(r.style.getPropertyValue('background-color')),
      ),
    );
    expect(hasCurrentColor).toBe(true);
  });

  test('Automatically applies margin-inline-start and margin-inline-end spacing only to non-empty elements (:not(.icon, :empty))', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(sheet);
    const hasStartSpacing = styleRules.some(
      (r) =>
        r.selectorText.includes(':not(') &&
        r.selectorText.includes(':empty') &&
        r.selectorText.includes('::before') &&
        Boolean(r.style.getPropertyValue('margin-inline-end')),
    );
    const hasEndSpacing = styleRules.some(
      (r) =>
        r.selectorText.includes(':not(') &&
        r.selectorText.includes(':empty') &&
        r.selectorText.includes('::after') &&
        Boolean(r.style.getPropertyValue('margin-inline-start')),
    );
    expect(hasStartSpacing && hasEndSpacing).toBe(true);
  });

  test('Applies Safari rendering workaround (@keyframes webkit-301609 and 0s animation on ::before/::after inside Safari @supports)', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const keyframes = getAllKeyframesRules(sheet);
    const hasKeyframes = keyframes.some((k) => k.name.includes('301609'));

    const supportsRules = getAllSupportsRules(sheet);
    const safariSupports = supportsRules.filter(
      (s) =>
        s.conditionText.includes('-webkit-nbsp-mode') &&
        s.conditionText.includes('content-visibility'),
    );

    const hasSafariAnimation = safariSupports.some((s) =>
      getAllRules(Array.from(s.cssRules)).some(
        (r) =>
          r instanceof CSSStyleRule &&
          r.selectorText.includes('::before') &&
          r.selectorText.includes('::after') &&
          getStyleDeclarationValues(r).some(
            ([prop, val]) => prop.startsWith('animation') && val.includes('301609'),
          ),
      ),
    );

    expect(hasKeyframes && hasSafariAnimation).toBe(true);
  });

  test('Applies Safari inheritance workaround (re-registering --icon-start with inherits: true in Safari @supports and resetting in a layered @container rule)', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const supportsRules = getAllSupportsRules(sheet);
    const safariSupports = supportsRules.filter(
      (s) =>
        s.conditionText.includes('-webkit-nbsp-mode') &&
        s.conditionText.includes('content-visibility'),
    );

    const hasInheritsTrue = safariSupports.some((s) =>
      getAllRules(Array.from(s.cssRules)).some(
        (r) =>
          r instanceof CSSPropertyRule &&
          r.name === '--icon-start' &&
          r.inherits === true,
      ),
    );

    const allLayerRules = getAllRules(Array.from(sheet.cssRules)).filter(
      (r): r is CSSLayerBlockRule => r instanceof CSSLayerBlockRule,
    );
    const hasLayeredReset = allLayerRules.some((layer) =>
      getAllRules(Array.from(layer.cssRules)).some(
        (r) =>
          r instanceof CSSContainerRule &&
          r.conditionText.includes('--icon-start') &&
          getAllRules(Array.from(r.cssRules)).some(
            (inner) =>
              inner instanceof CSSStyleRule &&
              inner.selectorText.trim() === '*' &&
              inner.style.getPropertyValue('--icon-start').trim() === 'initial',
          ),
      ),
    );

    expect(hasInheritsTrue && hasLayeredReset).toBe(true);
  });

  test('Sizes icon pseudo-elements using relative CSS units (em, rem, or lh) rather than hardcoded pixels', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const containerRules = getAllContainerRules(sheet);
    const pseudoRules = containerRules.flatMap((c) =>
      getAllRules(Array.from(c.cssRules)).filter(
        (r): r is CSSStyleRule =>
          r instanceof CSSStyleRule &&
          (r.selectorText.includes('::before') || r.selectorText.includes('::after')),
      ),
    );

    const usesRelativeUnits =
      pseudoRules.length > 0 &&
      pseudoRules.every((r) => {
        const width = r.style.getPropertyValue('width');
        const height = r.style.getPropertyValue('height');
        if (!width && !height) return true;
        return (
          /\b\d+(\.\d+)?(em|rem|lh|cap|ch)\b/.test(width) &&
          /\b\d+(\.\d+)?(em|rem|lh|cap|ch)\b/.test(height) &&
          !/\b\d+px\b/.test(width) &&
          !/\b\d+px\b/.test(height)
        );
      });

    expect(usesRelativeUnits).toBe(true);
  });

  test('Renders single-color decorative icons via CSS custom properties (--icon-start, --icon-end, or --icon) rather than inline <svg> or <img> elements', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(sheet);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const assignedRules = styleRules.filter(
      (r) =>
        !r.selectorText.includes('::before') &&
        !r.selectorText.includes('::after') &&
        r.selectorText.trim() !== '*' &&
        r.selectorText.trim() !== '.icon:empty' &&
        getStyleDeclarationValues(r).some(
          ([prop, val]) =>
            (prop === '--icon-start' || prop === '--icon-end' || prop === '--icon') &&
            val.includes('--icon-'),
        ),
    );

    const hasInlineSvgOrImgIcons = docs.some((d) =>
      Boolean(d.document.querySelector('nav svg, nav img, .btn svg, .btn img, .card h3 svg, .card h3 img')),
    );

    expect(assignedRules.length >= 5 && !hasInlineSvgOrImgIcons).toBe(true);
  });

  test('Ensures any standalone or interactive .icon elements follow accessibility requirements', () => {
    const sheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(sheet);
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);

    const hasAssignedIcons = styleRules.some((r) =>
      getStyleDeclarationValues(r).some(
        ([prop, val]) =>
          (prop === '--icon-start' || prop === '--icon-end') && val.includes('--icon-'),
      ),
    );

    const iconElements = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('.icon')),
    );

    const allAccessible = iconElements.every((el) => {
      const tag = el.tagName.toLowerCase();
      const isInteractive = tag === 'button' || tag === 'a' || el.hasAttribute('onclick');
      if (isInteractive) {
        return Boolean(el.getAttribute('aria-label')?.trim() || el.textContent?.trim());
      }
      const isDecorative = el.getAttribute('aria-hidden') === 'true';
      const isInformative =
        el.getAttribute('role') === 'img' && Boolean(el.getAttribute('aria-label')?.trim());
      return isDecorative || isInformative;
    });

    expect(hasAssignedIcons && allAccessible).toBe(true);
  });
});
