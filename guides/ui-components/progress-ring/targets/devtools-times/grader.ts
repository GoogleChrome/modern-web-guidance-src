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
  type CSSGroupingRule,
  type CSSRule,
} from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...getAllStyleRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

function getAllSupportsRules(rules: Iterable<CSSRule>): CSSSupportsRule[] {
  const result: CSSSupportsRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSSupportsRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...getAllSupportsRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

function getAllMediaRules(rules: Iterable<CSSRule>): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSMediaRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...getAllMediaRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

function getAllPropertyRules(rules: Iterable<CSSRule>): CSSPropertyRule[] {
  const result: CSSPropertyRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSPropertyRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) {
      result.push(...getAllPropertyRules((rule as CSSGroupingRule).cssRules));
    }
  }
  return result;
}

test.describe('progress-ring Target Grader', () => {

  test('Component contains a native HTML <progress> element', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasProgress = docs.some(d => Boolean(d.document.querySelector('progress')));
    expect(hasProgress).toBe(true);
  });

  test('Component is rendered and visible on an application page', () => {
    const docs = getHtmlDocuments(targetFiles);
    const isMountedOnPage = docs.some(d =>
      (d.file.includes('/pages/') || d.file.includes('/layouts/')) &&
      Boolean(d.document.querySelector('progress, progressring, progress-ring, [class*="progress-ring"], [class*="ring-wrapper"]'))
    );
    expect(isMountedOnPage).toBe(true);
  });

  test('Visual progress ring is implemented using a CSS conic-gradient', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const hasConicGradient = allRules.some(r => {
      const bg = r.style.getPropertyValue('background') || '';
      const bgImage = r.style.getPropertyValue('background-image') || '';
      return bg.includes('conic-gradient') || bgImage.includes('conic-gradient') || r.style.cssText.includes('conic-gradient');
    });
    expect(hasConicGradient).toBe(true);
  });

  test('Center of progress ring is hollowed out using background-clip: border-area', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const hasBorderAreaClip = allRules.some(r =>
      r.style.getPropertyValue('background-clip').includes('border-area')
    );
    expect(hasBorderAreaClip).toBe(true);
  });

  test('Radial gradient mask is configured as a fallback when background-clip: border-area is not supported', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const supportsRules = getAllSupportsRules(stylesheet.cssRules);
    const hasRadialMaskFallback = supportsRules.some(r => {
      const matchesCondition = r.conditionText.includes('border-area') || r.conditionText.includes('background-clip');
      const innerRules = getAllStyleRules(r.cssRules);
      const hasMaskDecl = innerRules.some(ir => {
        const mask = ir.style.getPropertyValue('mask-image') || ir.style.getPropertyValue('-webkit-mask-image') || ir.style.getPropertyValue('mask');
        return mask.includes('radial-gradient');
      });
      return matchesCondition && (hasMaskDecl || (r.cssText.includes('mask') && r.cssText.includes('radial-gradient')));
    });
    expect(hasRadialMaskFallback).toBe(true);
  });

  test('Visual progress of the ring is driven by the value attribute using attr()', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const hasAttrValue = allRules.some(r => {
      const val = r.style.getPropertyValue('--value');
      return val.includes('attr(') && val.includes('value');
    });
    expect(hasAttrValue).toBe(true);
  });

  test('MutationObserver fallback monitors value attribute and updates --value property when attr() is not supported', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const hasMutationObserverFallback = sourceFiles.some(sf => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const createsObserver = newExprs.some(e => e.getExpression().getText() === 'MutationObserver');
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const observesValue = callExprs.some(c => {
        const text = c.getText();
        return text.includes('.observe(') && text.includes('value');
      });
      const updatesCustomProp = callExprs.some(c => {
        const text = c.getText();
        return text.includes('setProperty') && text.includes('--value');
      });
      return createsObserver && observesValue && updatesCustomProp;
    });
    expect(hasMutationObserverFallback).toBe(true);
  });

  test('Component supports displaying text content in the center of the ring', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasCenterContent = docs.some(d => {
      const contentEl = d.document.querySelector('.progress-ring-content, .ring-content, [class*="ring-content"]');
      return Boolean(contentEl);
    });
    expect(hasCenterContent).toBe(true);
  });

  test('Ring transitions smoothly between values using registered @property --value', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const propertyRules = getAllPropertyRules(stylesheet.cssRules);
    const hasRegisteredValue = propertyRules.some(r => r.name === '--value') ||
      Array.from(stylesheet.cssRules).some(r => r.cssText.includes('@property --value'));
    const hasValueTransition = allRules.some(r => {
      const t = r.style.getPropertyValue('transition') || r.style.getPropertyValue('transition-property');
      return t.includes('--value');
    });
    const hasSmoothTransition = hasRegisteredValue && hasValueTransition;
    expect(hasSmoothTransition).toBe(true);
  });

  test('<progress> element includes an aria-label for accessibility', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasAriaLabel = docs.some(d => {
      const progresses = Array.from(d.document.querySelectorAll('progress') as Iterable<any>);
      return progresses.some(p => p.hasAttribute('aria-label') || p.getAttribute('aria-label') !== null);
    });
    expect(hasAriaLabel).toBe(true);
  });

  test('Fill color changes to a success color when progress reaches 100%', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const hasSuccessState = allRules.some(r => {
      const matchesSelector = /\[value=["']?100["']?\]/.test(r.selectorText);
      const setsFill = Boolean(
        r.style.getPropertyValue('--fill-color') ||
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('color')
      );
      return matchesSelector && setsFill;
    });
    expect(hasSuccessState).toBe(true);
  });

  test('Component has a distinct visual track behind the progress fill', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const hasTrack = allRules.some(r => {
      const hasTrackColorVar = Boolean(r.style.getPropertyValue('--track-color'));
      const bg = r.style.getPropertyValue('background') || r.style.getPropertyValue('background-image');
      return hasTrackColorVar || bg.includes('track');
    });
    expect(hasTrack).toBe(true);
  });

  test('Spinner respects prefers-reduced-motion by disabling smooth transition', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const mediaRules = getAllMediaRules(stylesheet.cssRules);
    const respectsReducedMotion = mediaRules.some(m => {
      const isReducedMotionQuery = m.conditionText.includes('prefers-reduced-motion');
      const innerRules = getAllStyleRules(m.cssRules);
      const modifiesTransition = innerRules.some(ir =>
        Boolean(ir.style.getPropertyValue('transition') || ir.style.getPropertyValue('transition-duration'))
      ) || m.cssText.includes('transition');
      return isReducedMotionQuery && modifiesTransition;
    });
    expect(respectsReducedMotion).toBe(true);
  });
});
