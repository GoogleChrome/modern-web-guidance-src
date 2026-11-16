import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSGroupingRule,
  CSSPropertyRule,
  CSSContainerRule,
  CSSSupportsRule,
  CSSLayerBlockRule,
  CSSKeyframesRule,
  CSSAtRule,
  getCascadedStyle,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';
import type { Document } from 'linkedom';

// @ts-ignore - package.json omits "type": "module" in base app
const targetFiles: string[] = getTargetFiles(import.meta.url);

function collectAllCssRules(rules: Iterable<CSSRule>): CSSRule[] {
  const result: CSSRule[] = [];
  for (const rule of rules) {
    result.push(rule);
    if (rule instanceof CSSGroupingRule && rule.cssRules) {
      result.push(...collectAllCssRules(rule.cssRules));
    } else if (rule instanceof CSSAtRule && rule.childRules) {
      result.push(...collectAllCssRules(rule.childRules));
    }
  }
  return result;
}

function getMaskOrWebkitMask(style: { getPropertyValue(prop: string): string }): string {
  return (
    style.getPropertyValue('mask') ||
    style.getPropertyValue('-webkit-mask') ||
    style.getPropertyValue('mask-image') ||
    style.getPropertyValue('-webkit-mask-image')
  );
}

test.describe('icons Target Grader', () => {
  test('Custom properties --icon-start and --icon-end are registered using @property with syntax: "*" and inherits: false', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    expect(allRules.length).toBeGreaterThan(0);

    const propRules = allRules.filter(
      (r): r is CSSPropertyRule => r instanceof CSSPropertyRule
    );

    const hasIconStart = propRules.some(
      (r) =>
        r.name === '--icon-start' &&
        r.syntax.replace(/['"\s]/g, '') === '*' &&
        r.inherits === false
    );
    const hasIconEnd = propRules.some(
      (r) =>
        r.name === '--icon-end' &&
        r.syntax.replace(/['"\s]/g, '') === '*' &&
        r.inherits === false
    );

    expect(hasIconStart).toBe(true);
    expect(hasIconEnd).toBe(true);
  });

  test('Icon design tokens declared on :root use embedded SVG data URIs or root-relative URLs (or register via @property starting with <url>) and never register an <image> syntax token with a URL in initial-value', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const rootRules = allRules.filter(
      (r): r is CSSStyleRule =>
        r instanceof CSSStyleRule && /\b:root\b|:root/.test(r.selectorText)
    );
    expect(rootRules.length).toBeGreaterThan(0);

    const propRules = allRules.filter(
      (r): r is CSSPropertyRule => r instanceof CSSPropertyRule
    );

    const jsProject = getJsProject(targetFiles);
    const registeredViaJs = new Set<string>();
    for (const sf of jsProject.getSourceFiles()) {
      for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
        if (call.getExpression().getText().includes('registerProperty')) {
          registeredViaJs.add(call.getText());
        }
      }
    }

    const iconTokens: Array<{ name: string; value: string }> = [];
    for (const rule of rootRules) {
      for (let i = 0; i < rule.style.length; i++) {
        const propName = rule.style[i];
        if (
          propName.startsWith('--icon-') &&
          !propName.startsWith('--icon-style-') &&
          propName !== '--icon-start' &&
          propName !== '--icon-end'
        ) {
          iconTokens.push({
            name: propName,
            value: rule.style.getPropertyValue(propName).trim(),
          });
        }
      }
    }

    expect(iconTokens.length).toBeGreaterThan(0);

    for (const token of iconTokens) {
      const urlMatch = token.value.match(
        /url\(\s*(?:"([^"]+)"|'([^']+)'|([^)'"]+))\s*\)/i
      );
      expect(urlMatch).not.toBeNull();
      const rawUrl = (urlMatch?.[1] ?? urlMatch?.[2] ?? urlMatch?.[3] ?? '').trim();

      const isDataSvg = /^data:image\/svg\+xml/i.test(rawUrl);
      const isRootRelative = rawUrl.startsWith('/');
      const isRegisteredWithUrlSyntax =
        propRules.some(
          (r) =>
            r.name === token.name &&
            r.syntax.replace(/['"\s]/g, '').startsWith('<url>')
        ) ||
        Array.from(registeredViaJs).some((text) => text.includes('<url>'));

      expect(isDataSvg || isRootRelative || isRegisteredWithUrlSyntax).toBe(true);
    }

    // Never register an <image> syntax token with a URL in initial-value
    const hasInvalidImageInitialUrl = propRules.some(
      (r) =>
        r.syntax.includes('<image>') &&
        !r.syntax.replace(/['"\s]/g, '').startsWith('<url>') &&
        r.initialValue !== null &&
        /url\(/i.test(r.initialValue)
    );
    expect(hasInvalidImageInitialUrl).toBe(false);
  });

  test('CSS Container Style Queries (@container style(...)) are used to dynamically detect and render --icon-start and --icon-end custom properties', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const containerRules = allRules.filter(
      (r): r is CSSContainerRule => r instanceof CSSContainerRule
    );
    expect(containerRules.length).toBeGreaterThan(0);

    const hasIconStartQuery = containerRules.some((r) => {
      if (!/style\(\s*--icon-start\s*\)/.test(r.conditionText)) return false;
      const children = collectAllCssRules(r.cssRules);
      return children.some(
        (c): c is CSSStyleRule =>
          c instanceof CSSStyleRule &&
          c.selectorText.includes('::before') &&
          c.style.getPropertyValue('--icon-start').trim() === 'inherit'
      );
    });

    const hasIconEndQuery = containerRules.some((r) => {
      if (!/style\(\s*--icon-end\s*\)/.test(r.conditionText)) return false;
      const children = collectAllCssRules(r.cssRules);
      return children.some(
        (c): c is CSSStyleRule =>
          c instanceof CSSStyleRule &&
          c.selectorText.includes('::after') &&
          c.style.getPropertyValue('--icon-end').trim() === 'inherit'
      );
    });

    expect(hasIconStartQuery).toBe(true);
    expect(hasIconEndQuery).toBe(true);
  });

  test('A compatibility fallback using zero-specificity class hooks (:where(.icon-start), :where(.icon-end), and :where(.icon:empty)) is provided', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    expect(styleRules.length).toBeGreaterThan(0);

    const hasWhereIconStart = styleRules.some(
      (r) =>
        r.selectorText.includes(':where(') &&
        r.selectorText.includes('.icon-start') &&
        r.selectorText.includes('::before')
    );
    const hasWhereIconEmpty = styleRules.some(
      (r) =>
        r.selectorText.includes(':where(') &&
        r.selectorText.includes('.icon:empty') &&
        r.selectorText.includes('::before')
    );
    const hasWhereIconEnd = styleRules.some(
      (r) =>
        r.selectorText.includes(':where(') &&
        r.selectorText.includes('.icon-end') &&
        r.selectorText.includes('::after')
    );

    expect(hasWhereIconStart).toBe(true);
    expect(hasWhereIconEmpty).toBe(true);
    expect(hasWhereIconEnd).toBe(true);

    // Also verify fallback classes are applied in HTML markup
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    const hasClassHooksInDom = docs.some(
      (d) =>
        d.document.querySelectorAll('.icon-start').length > 0 &&
        d.document.querySelectorAll('.icon-end').length > 0
    );
    expect(hasClassHooksInDom).toBe(true);
  });

  test('The Safari rendering workaround for WebKit #301609 and #320220 applies a zero-duration @keyframes animation to ::before and ::after inside the Safari @supports condition', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const keyframesRules = allRules.filter(
      (r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule
    );
    expect(keyframesRules.length).toBeGreaterThan(0);

    const supportsRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        r.conditionText.includes('-webkit-nbsp-mode') &&
        r.conditionText.includes('-webkit-touch-callout') &&
        r.conditionText.includes('-apple-system-body') &&
        r.conditionText.includes('content-visibility')
    );
    expect(supportsRules.length).toBeGreaterThan(0);

    const hasSafariKeyframesFix = supportsRules.some((sr) => {
      const innerRules = collectAllCssRules(sr.cssRules);
      return innerRules.some((r) => {
        if (!(r instanceof CSSStyleRule)) return false;
        const targetsPseudo =
          r.selectorText.includes('::before') && r.selectorText.includes('::after');
        const anim =
          r.style.getPropertyValue('animation') ||
          r.style.getPropertyValue('animation-name');
        const hasZeroDuration =
          /\b0s\b|\b0ms\b/.test(r.style.getPropertyValue('animation')) ||
          /\b0s\b|\b0ms\b/.test(r.style.getPropertyValue('animation-duration'));
        const matchesKeyframe = keyframesRules.some((kf) => anim.includes(kf.name));
        return targetsPseudo && matchesKeyframe && hasZeroDuration;
      });
    });

    expect(hasSafariKeyframesFix).toBe(true);
  });

  test('The Safari workaround for WebKit #325900 re-registers --icon-start with inherits: true inside the Safari @supports condition and resets it on descendants inside a layered @container style(--icon-start) rule', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const supportsRules = allRules.filter(
      (r): r is CSSSupportsRule =>
        r instanceof CSSSupportsRule &&
        r.conditionText.includes('-webkit-nbsp-mode') &&
        r.conditionText.includes('content-visibility')
    );
    expect(supportsRules.length).toBeGreaterThan(0);

    const hasWebkit325900Workaround = supportsRules.some((sr) => {
      const innerRules = collectAllCssRules(sr.cssRules);

      const reRegistersIconStart = innerRules.some(
        (r): r is CSSPropertyRule =>
          r instanceof CSSPropertyRule &&
          r.name === '--icon-start' &&
          r.inherits === true
      );

      const layerRules = allRules.filter(
        (r): r is CSSLayerBlockRule => r instanceof CSSLayerBlockRule
      );

      const resetsInLayeredContainer = layerRules.some((layer) => {
        const layerChildren = collectAllCssRules(layer.cssRules);
        return layerChildren.some((c) => {
          if (!(c instanceof CSSContainerRule)) return false;
          if (!/style\(\s*--icon-start\s*\)/.test(c.conditionText)) return false;
          const containerChildren = collectAllCssRules(c.cssRules);
          return containerChildren.some(
            (s): s is CSSStyleRule =>
              s instanceof CSSStyleRule &&
              s.selectorText.trim() === '*' &&
              s.style.getPropertyValue('--icon-start').trim() === 'initial'
          );
        });
      });

      return reRegistersIconStart && resetsInLayeredContainer;
    });

    expect(hasWebkit325900Workaround).toBe(true);
  });

  test('Icons are rendered using CSS mask inside the container style query blocks on pseudo-elements (::before and ::after)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const containerRules = allRules.filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule && /style\(\s*--icon-/.test(r.conditionText)
    );
    expect(containerRules.length).toBeGreaterThan(0);

    const hasMaskOnBeforeInContainer = containerRules.some((cr) => {
      const children = collectAllCssRules(cr.cssRules);
      return children.some((c) => {
        if (!(c instanceof CSSStyleRule)) return false;
        if (!c.selectorText.includes('::before')) return false;
        const maskVal = getMaskOrWebkitMask(c.style);
        return maskVal.includes('var(--icon-start)');
      });
    });

    const hasMaskOnAfter = allRules.some((r) => {
      if (!(r instanceof CSSStyleRule)) return false;
      if (!r.selectorText.includes('::after')) return false;
      const maskVal = getMaskOrWebkitMask(r.style);
      return maskVal.includes('var(--icon-end)');
    });

    expect(hasMaskOnBeforeInContainer).toBe(true);
    expect(hasMaskOnAfter).toBe(true);
  });

  test('Icons are colored using currentColor (via background-color: currentColor on the pseudo-element) so they automatically inherit and transition with the parent element text color', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const containerRules = allRules.filter(
      (r): r is CSSContainerRule =>
        r instanceof CSSContainerRule && /style\(\s*--icon-start\s*\)/.test(r.conditionText)
    );
    expect(containerRules.length).toBeGreaterThan(0);

    const usesCurrentColor = containerRules.some((cr) => {
      const children = collectAllCssRules(cr.cssRules);
      return children.some((c) => {
        if (!(c instanceof CSSStyleRule)) return false;
        if (!c.selectorText.includes('::before')) return false;
        const bg =
          c.style.getPropertyValue('background-color') ||
          c.style.getPropertyValue('background');
        return /currentColor/i.test(bg);
      });
    });

    expect(usesCurrentColor).toBe(true);
  });

  test('Empty .icon elements, including icon-only buttons, forward a generic --icon property to --icon-start (.icon:empty)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    expect(styleRules.length).toBeGreaterThan(0);

    const forwardsIconToStart = styleRules.some(
      (r) =>
        r.selectorText.includes('.icon:empty') &&
        !r.selectorText.includes('::before') &&
        r.style.getPropertyValue('--icon-start').includes('var(--icon)')
    );

    expect(forwardsIconToStart).toBe(true);
  });

  test('Spacing (margin-inline-start or margin-inline-end) is automatically applied to pseudo-element icons only when the parent element has non-empty content (using :not(.icon, :empty) or equivalent selectors)', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    expect(styleRules.length).toBeGreaterThan(0);

    const hasConditionalStartSpacing = styleRules.some(
      (r) =>
        r.selectorText.includes(':not(') &&
        r.selectorText.includes(':empty') &&
        r.selectorText.includes('::before') &&
        r.style.getPropertyValue('margin-inline-end').trim().length > 0
    );

    const hasEndSpacing = styleRules.some(
      (r) =>
        r.selectorText.includes(':not(') &&
        r.selectorText.includes(':empty') &&
        r.selectorText.includes('::after') &&
        r.style.getPropertyValue('margin-inline-start').trim().length > 0
    );

    expect(hasConditionalStartSpacing).toBe(true);
    expect(hasEndSpacing).toBe(true);
  });

  test('Single-color decorative icons are rendered via CSS custom properties (--icon-start, --icon-end, or --icon) rather than inline <svg> markup inside buttons, <img> tags, or external icon fonts', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    for (const { document } of docs) {
      expect(
        document.querySelectorAll(
          'nav svg, nav img, button svg, button img, .btn svg, .btn img, .icon svg, .icon img'
        ).length
      ).toBe(0);

      const navLinks = Array.from(document.querySelectorAll('nav a')) as any[];
      expect(navLinks.length).toBeGreaterThanOrEqual(5);
      for (const link of navLinks) {
        const cascaded = getCascadedStyle(link, allRules);
        expect(
          (
            cascaded.getPropertyValue('--icon-start') ||
            cascaded.getPropertyValue('--icon-end')
          ).trim().length
        ).toBeGreaterThan(0);
      }

      const heroBtn = document.querySelector('.hero .btn');
      expect(heroBtn).not.toBeNull();
      const heroCascaded = getCascadedStyle(heroBtn, allRules);
      expect(
        (
          heroCascaded.getPropertyValue('--icon-start') ||
          heroCascaded.getPropertyValue('--icon-end')
        ).trim().length
      ).toBeGreaterThan(0);

      const cardBtns = Array.from(document.querySelectorAll('.card a.btn')) as any[];
      expect(cardBtns.length).toBe(3);
      for (const btn of cardBtns) {
        const cascaded = getCascadedStyle(btn, allRules);
        expect(
          (
            cascaded.getPropertyValue('--icon-end') ||
            cascaded.getPropertyValue('--icon-start')
          ).trim().length
        ).toBeGreaterThan(0);
      }

      const cards = Array.from(document.querySelectorAll('.card')) as any[];
      expect(cards.length).toBe(3);
      for (const card of cards) {
        const descendants = Array.from(card.querySelectorAll('*')) as any[];
        const hasCardDecorativeIcon = descendants.some((el) => {
          const tag = el.tagName?.toLowerCase() || '';
          if (tag === 'button' || el.classList?.contains('btn') || el.getAttribute('role') === 'button') {
            return false;
          }
          const cascaded = getCascadedStyle(el, allRules);
          return Boolean(
            cascaded.getPropertyValue('--icon-start') ||
              cascaded.getPropertyValue('--icon') ||
              cascaded.getPropertyValue('--icon-end')
          );
        });
        expect(hasCardDecorativeIcon).toBe(true);
      }
    }
  });

  test('Interactive icon-only controls can apply the .icon class and --icon property directly to the control, and provide a valid accessible name (such as via aria-label)', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const iconButtons = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('.card button.icon, .card [role="button"].icon'))
    ) as any[];
    expect(iconButtons.length).toBeGreaterThanOrEqual(3);

    for (const btn of iconButtons) {
      expect(btn.textContent.trim()).toBe('');
      const cascaded = getCascadedStyle(btn, allRules);
      expect(cascaded.getPropertyValue('--icon').trim().length).toBeGreaterThan(0);

      const ariaLabel = btn.getAttribute('aria-label')?.trim() || '';
      const altProp = cascaded.getPropertyValue('--icon-style-alt').trim();
      expect(ariaLabel.length > 0 || altProp.length > 0).toBe(true);
    }
  });

  test('Standalone non-interactive empty .icon elements use aria-hidden="true" when decorative, or role="img" with a valid accessible name when informative', () => {
    const docs: Array<{ file: string; document: Document }> = getHtmlDocuments(targetFiles);
    expect(docs.length).toBeGreaterThan(0);

    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);

    const allIconEls = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('.icon'))
    ) as any[];
    expect(allIconEls.length).toBeGreaterThan(0);

    const nonInteractiveEmptyIcons = allIconEls.filter((el) => {
      const tag = el.tagName?.toLowerCase() || '';
      const isInteractive =
        tag === 'button' ||
        tag === 'a' ||
        tag === 'input' ||
        el.getAttribute('role') === 'button';
      return !isInteractive && (el.textContent || '').trim() === '';
    });

    for (const el of nonInteractiveEmptyIcons) {
      const isDecorative = el.getAttribute('aria-hidden') === 'true';
      const isInformative =
        el.getAttribute('role') === 'img' &&
        Boolean(
          el.getAttribute('aria-label')?.trim() ||
            el.getAttribute('aria-labelledby')?.trim()
        );
      expect(isDecorative || isInformative).toBe(true);
    }

    // Also verify all cards have a non-interactive icon element (standalone empty .icon or text element with a decorative CSS icon)
    const cards = docs.flatMap((d) =>
      Array.from(d.document.querySelectorAll('.card'))
    ) as any[];
    expect(cards.length).toBe(3);

    for (const card of cards) {
      const iconEls = (Array.from(card.querySelectorAll('*')) as any[]).filter((el) => {
        const tag = el.tagName?.toLowerCase() || '';
        if (
          tag === 'button' ||
          tag === 'a' ||
          tag === 'input' ||
          el.classList?.contains('btn') ||
          el.getAttribute('role') === 'button'
        ) {
          return false;
        }
        const cascaded = getCascadedStyle(el, allRules);
        return Boolean(
          cascaded.getPropertyValue('--icon') ||
            cascaded.getPropertyValue('--icon-start') ||
            cascaded.getPropertyValue('--icon-end')
        );
      });
      expect(iconEls.length).toBeGreaterThan(0);
    }
  });

  test('Sizing of icon pseudo-elements uses relative CSS units (such as em, rem, or lh) rather than hardcoded pixel dimensions', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = collectAllCssRules(stylesheet.cssRules);
    const styleRules = allRules.filter(
      (r): r is CSSStyleRule => r instanceof CSSStyleRule
    );
    expect(styleRules.length).toBeGreaterThan(0);

    const pseudoIconRules = styleRules.filter(
      (r) =>
        (r.selectorText.includes('::before') || r.selectorText.includes('::after')) &&
        (r.style.getPropertyValue('width') !== '' ||
          r.style.getPropertyValue('height') !== '')
    );
    expect(pseudoIconRules.length).toBeGreaterThan(0);

    for (const rule of pseudoIconRules) {
      const width = rule.style.getPropertyValue('width');
      const height = rule.style.getPropertyValue('height');
      expect(/\d+(?:\.\d+)?(em|rem|lh|cap|ex|ch)\b/i.test(width)).toBe(true);
      expect(/\d+(?:\.\d+)?(em|rem|lh|cap|ex|ch)\b/i.test(height)).toBe(true);
      expect(/\d+px\b/i.test(width)).toBe(false);
      expect(/\d+px\b/i.test(height)).toBe(false);
    }

    const iconSizeRules = styleRules.filter(
      (r) => r.style.getPropertyValue('--icon-style-size').trim() !== ''
    );
    for (const rule of iconSizeRules) {
      const sizeVal = rule.style.getPropertyValue('--icon-style-size').trim();
      expect(/\d+(?:\.\d+)?(em|rem|lh|cap|ex|ch)\b/i.test(sizeVal)).toBe(true);
      expect(/\d+px\b/i.test(sizeVal)).toBe(false);
    }
  });

  test.describe('Browser tests', () => {
    test.beforeEach(async ({ page, TARGET_URL }) => {
      await page.goto(TARGET_URL);
    });

    test('Icons render on navigation links, action buttons, and Seasonal Favorites cards with currentColor inheritance', async ({
      page,
    }) => {
      const navPseudo = await page.evaluate(() => {
        const link = document.querySelector('nav a') as HTMLElement;
        const linkStyle = window.getComputedStyle(link);
        const beforeStyle = window.getComputedStyle(link, '::before');
        const mask =
          beforeStyle.getPropertyValue('mask-image') ||
          beforeStyle.getPropertyValue('-webkit-mask-image');
        return {
          display: beforeStyle.display,
          width: parseFloat(beforeStyle.width),
          height: parseFloat(beforeStyle.height),
          bgColor: beforeStyle.backgroundColor,
          textColor: linkStyle.color,
          mask,
        };
      });

      expect(
        navPseudo.display === 'inline-block' || navPseudo.display === 'block'
      ).toBe(true);
      expect(navPseudo.width).toBeGreaterThan(0);
      expect(navPseudo.height).toBeGreaterThan(0);
      expect(navPseudo.bgColor).toBe(navPseudo.textColor);
      expect(navPseudo.mask).not.toBe('none');

      const favButtons = page.locator('.card button.icon, .card [role="button"].icon');
      expect(await favButtons.count()).toBeGreaterThanOrEqual(3);

      const firstFav = favButtons.first();
      const favPseudo = await firstFav.evaluate((btn) => {
        const btnStyle = window.getComputedStyle(btn);
        const before = window.getComputedStyle(btn, '::before');
        return {
          width: parseFloat(before.width),
          height: parseFloat(before.height),
          bgColor: before.backgroundColor,
          textColor: btnStyle.color,
          mask:
            before.getPropertyValue('mask-image') ||
            before.getPropertyValue('-webkit-mask-image'),
        };
      });
      expect(favPseudo.width).toBeGreaterThan(0);
      expect(favPseudo.height).toBeGreaterThan(0);
      expect(favPseudo.bgColor).toBe(favPseudo.textColor);
      expect(favPseudo.mask).not.toBe('none');
    });
  });
});
