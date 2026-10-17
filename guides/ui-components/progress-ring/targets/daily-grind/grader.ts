import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import {
  CSSStyleRule,
  CSSSupportsRule,
  CSSMediaRule,
  CSSPropertyRule,
  type CSSRule,
  type CSSRuleList,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: CSSRuleList | CSSRule[]): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const r of Array.from(rules)) {
    if (r instanceof CSSStyleRule) {
      result.push(r);
    }
    if ('cssRules' in r && (r as { cssRules?: CSSRuleList }).cssRules) {
      result.push(...getAllStyleRules((r as { cssRules: CSSRuleList }).cssRules));
    }
  }
  return result;
}

function getAllSupportsRules(rules: CSSRuleList | CSSRule[]): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const r of Array.from(rules)) {
    if (r instanceof CSSSupportsRule) {
      result.push(r);
    }
    if ('cssRules' in r && (r as { cssRules?: CSSRuleList }).cssRules) {
      result.push(...getAllSupportsRules((r as { cssRules: CSSRuleList }).cssRules));
    }
  }
  return result;
}

function getAllMediaRules(rules: CSSRuleList | CSSRule[]): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const r of Array.from(rules)) {
    if (r instanceof CSSMediaRule) {
      result.push(r);
    }
    if ('cssRules' in r && (r as { cssRules?: CSSRuleList }).cssRules) {
      result.push(...getAllMediaRules((r as { cssRules: CSSRuleList }).cssRules));
    }
  }
  return result;
}

function getAllPropertyRules(rules: CSSRuleList | CSSRule[]): CSSPropertyRule[] {
  const result: CSSPropertyRule[] = [];
  for (const r of Array.from(rules)) {
    if (r instanceof CSSPropertyRule) {
      result.push(r);
    }
    if ('cssRules' in r && (r as { cssRules?: CSSRuleList }).cssRules) {
      result.push(...getAllPropertyRules((r as { cssRules: CSSRuleList }).cssRules));
    }
  }
  return result;
}

test.describe('progress-ring Target Grader', () => {
  test('Component contains a native HTML <progress> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const progressEl = docs.map((d) => d.document.querySelector('progress')).find(Boolean);
    expect(progressEl).toBeTruthy();
  });

  test('Component is visible on the page', () => {
    const docs = getHtmlDocuments(targetFiles);
    const isVisible = docs.some((d) => {
      const progressEl = d.document.querySelector('progress');
      if (!progressEl) return false;
      const hasHiddenAttr =
        progressEl.hasAttribute('hidden') || progressEl.getAttribute('aria-hidden') === 'true';
      const inlineStyle = progressEl.getAttribute('style') || '';
      const isHiddenStyle = /display\s*:\s*none|visibility\s*:\s*hidden/i.test(inlineStyle);
      const isInsideBody = Boolean(progressEl.closest('body'));
      return isInsideBody && !hasHiddenAttr && !isHiddenStyle;
    });
    expect(isVisible).toBe(true);
  });

  test('Visual progress ring is implemented using a CSS conic-gradient', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasConicGradient = styleRules.some((r) => {
      const bg =
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('background-image') ||
        '';
      return bg.includes('conic-gradient') || r.style.cssText.includes('conic-gradient');
    });
    expect(hasConicGradient).toBe(true);
  });

  test('Center of the progress ring is hollowed out using background-clip: border-area', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasBorderArea = styleRules.some((r) => {
      const clip = r.style.getPropertyValue('background-clip') || '';
      return clip.includes('border-area');
    });
    expect(hasBorderArea).toBe(true);
  });

  test('Falls back to hollowing out the center with a radial gradient mask when background-clip: border-area is unsupported', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);
    const hasRadialMaskFallback = supportsRules.some((supp) => {
      const conditionMatches =
        supp.conditionText.includes('border-area') || supp.conditionText.includes('background-clip');
      const innerRules = getAllStyleRules(supp.cssRules);
      const hasRadialMask = innerRules.some((r) => {
        const mask =
          r.style.getPropertyValue('mask-image') ||
          r.style.getPropertyValue('-webkit-mask-image') ||
          r.style.getPropertyValue('mask') ||
          '';
        return mask.includes('radial-gradient');
      });
      return conditionMatches && hasRadialMask;
    });
    expect(hasRadialMaskFallback).toBe(true);
  });

  test('Value attribute on <progress> drives visual progress of the ring using attr()', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasAttrValue = styleRules.some((r) => {
      const val =
        r.style.getPropertyValue('--value') || r.style.getPropertyValue('background') || '';
      return val.includes('attr(value');
    });
    expect(hasAttrValue).toBe(true);
  });

  test('Falls back to MutationObserver to monitor value attribute and update --value property when attr() is unsupported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasObserverFallback = sourceFiles.some((sf) => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const createsObserver = newExprs.some(
        (ne) => ne.getExpression().getText() === 'MutationObserver'
      );
      const strings = [
        ...sf.getDescendantsOfKind(SyntaxKind.StringLiteral).map((l) => l.getLiteralValue()),
        ...sf
          .getDescendantsOfKind(SyntaxKind.NoSubstitutionTemplateLiteral)
          .map((l) => l.getLiteralValue()),
      ];
      const updatesValueProp = strings.some((s) => s === '--value');
      const monitorsValueAttr = strings.some((s) => s === 'value');
      return createsObserver && updatesValueProp && monitorsValueAttr;
    });
    expect(hasObserverFallback).toBe(true);
  });

  test('Component supports displaying text content in the center of the ring', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCenterText = docs.some((d) => {
      const progressEl = d.document.querySelector('progress');
      if (!progressEl) return false;
      const parent = progressEl.parentElement;
      if (!parent) return false;
      const textEl =
        parent.querySelector('.progress-ring-content, .ring-content, [class*="content"]') ||
        Array.from(parent.children).find((el) => el !== progressEl);
      return Boolean(textEl && textEl.textContent && textEl.textContent.trim().length > 0);
    });
    expect(hasCenterText).toBe(true);
  });

  test('Smoothly transitions between values when --value is updated using @property', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const propertyRules = getAllPropertyRules(stylesheet.cssRules);
    const hasRegisteredValueProperty = propertyRules.some(
      (r) => r.name === '--value' && r.syntax.includes('<number>')
    );
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasTransition = styleRules.some((r) => {
      const transition =
        r.style.getPropertyValue('transition') ||
        r.style.getPropertyValue('transition-property') ||
        '';
      return transition.includes('--value');
    });
    expect(hasRegisteredValueProperty && hasTransition).toBe(true);
  });

  test('<progress> element includes an aria-label for accessibility', () => {
    const docs = getHtmlDocuments(targetFiles);
    const progressEl = docs.map((d) => d.document.querySelector('progress')).find(Boolean);
    const ariaLabel = progressEl?.getAttribute('aria-label');
    expect(Boolean(ariaLabel && ariaLabel.trim().length > 0)).toBe(true);
  });

  test('Fill color changes to a success color when progress reaches 100%', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasSuccessColor = styleRules.some((r) => {
      const matches100 = /\[value\s*=\s*["']?100["']?\]/.test(r.selectorText);
      const setsColor =
        r.style.getPropertyValue('--fill-color') !== '' ||
        r.style.getPropertyValue('background') !== '' ||
        r.style.getPropertyValue('background-image') !== '' ||
        r.style.getPropertyValue('color') !== '';
      return matches100 && setsColor;
    });
    expect(hasSuccessColor).toBe(true);
  });

  test('Component has a distinct visual track behind the progress fill', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const styleRules = getAllStyleRules(stylesheet.cssRules);
    const hasTrack = styleRules.some((r) => {
      const hasTrackProp =
        r.style.getPropertyValue('--track-color') !== '' ||
        r.style.getPropertyValue('--track') !== '';
      const bg =
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('background-image') ||
        '';
      const hasTrackInConic =
        bg.includes('conic-gradient') &&
        (bg.includes('--track') || bg.includes('var(--secondary)') || bg.split(',').length >= 2);
      return hasTrackProp || hasTrackInConic;
    });
    expect(hasTrack).toBe(true);
  });

  test('Respects prefers-reduced-motion by updating immediately instead of smoothly transitioning', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = getAllMediaRules(stylesheet.cssRules);
    const hasReducedMotion = mediaRules.some((mr) =>
      mr.conditionText.includes('prefers-reduced-motion')
    );
    expect(hasReducedMotion).toBe(true);
  });
});
