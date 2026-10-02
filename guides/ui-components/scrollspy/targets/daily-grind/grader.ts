import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSStyleRule, type CSSRule, getCascadedStyle } from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(rules: Iterable<CSSRule>): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  for (const rule of rules) {
    if (rule instanceof CSSStyleRule) {
      result.push(rule);
    }
    if ('cssRules' in rule && rule.cssRules) {
      result.push(...getAllStyleRules(rule.cssRules as Iterable<CSSRule>));
    }
  }
  return result;
}

test.describe('Daily Grind Scrollspy Grader', () => {

  // Requirement 1: Navigation links use fragment identifiers that match unique IDs of target content sections
  test('navigation links use fragment identifiers matching unique IDs of target content sections', () => {
    const docs = getHtmlDocuments(targetFiles);
    const matched = docs.some(({ document }) => {
      const navLinks = Array.from(document.querySelectorAll('nav a[href^="#"], [role="navigation"] a[href^="#"], .nav-links a[href^="#"]'));
      if (navLinks.length === 0) return false;
      return navLinks.every(link => {
        const targetId = (link as any).getAttribute('href')?.replace(/^#/, '');
        return Boolean(targetId && document.getElementById(targetId));
      });
    });
    expect(matched).toBe(true);
  });

  // Requirement 2: The navigation container has scroll-target-group: auto applied
  test('navigation container has scroll-target-group: auto applied', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const docs = getHtmlDocuments(targetFiles);
    const rules = getAllStyleRules(stylesheet.cssRules);

    const hasRule = rules.some(r => {
      const val = r.style.getPropertyValue('scroll-target-group')?.trim();
      if (val !== 'auto') return false;
      if (/\b(nav|nav-links|site-nav)\b/i.test(r.selectorText)) return true;
      return docs.some(({ document }) => {
        try {
          const matchedEls = Array.from(document.querySelectorAll(r.selectorText));
          return matchedEls.some(el => (el as any).tagName === 'NAV' || (el as any).querySelector?.('a[href^="#"]'));
        } catch {
          return false;
        }
      });
    });

    const hasCascaded = docs.some(({ document }) => {
      const nav = document.querySelector('nav, [role="navigation"], .nav-links');
      if (!nav) return false;
      return getCascadedStyle(nav, rules).getPropertyValue('scroll-target-group')?.trim() === 'auto';
    });

    expect(hasRule || hasCascaded).toBe(true);
  });

  // Requirement 3: Navigation links use the :target-current pseudo-class for active state styling
  test('navigation links use :target-current pseudo-class for active state styling', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet.cssRules);

    const hasTargetCurrent = rules.some(r => {
      return r.selectorText.includes(':target-current') && /\b(nav|a|links)\b/i.test(r.selectorText);
    });

    expect(hasTargetCurrent).toBe(true);
  });

  // Requirement 4: Visual highlight with color change
  test('active navigation link style specifies a color change', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet.cssRules);

    const activeRules = rules.filter(r => r.selectorText.includes('target-current'));
    const hasColorChange = activeRules.some(r => Boolean(r.style.getPropertyValue('color')?.trim()));

    expect(hasColorChange).toBe(true);
  });

  // Requirement 4: Visual highlight with at least one non-color indicator
  test('active navigation link style specifies at least one non-color indicator', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet.cssRules);

    const activeRules = rules.filter(r => r.selectorText.includes('target-current'));
    const hasNonColorIndicator = activeRules.some(r => {
      const s = r.style;
      const fw = s.getPropertyValue('font-weight')?.trim();
      const td = s.getPropertyValue('text-decoration')?.trim() || s.getPropertyValue('text-decoration-line')?.trim();
      const bb = s.getPropertyValue('border-bottom')?.trim() || s.getPropertyValue('border-bottom-color')?.trim() || s.getPropertyValue('border-color')?.trim() || s.getPropertyValue('border-bottom-width')?.trim();
      const outline = s.getPropertyValue('outline')?.trim();
      return Boolean(fw || (td && td.includes('underline')) || bb || outline);
    });

    expect(hasNonColorIndicator).toBe(true);
  });

  // Requirement 5: aria-current is updated on navigation links
  test('script updates aria-current attribute on navigation links', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExprs = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasAriaCurrentCall = callExprs.some(call => {
      const text = call.getExpression().getText();
      if (!text.endsWith('setAttribute')) return false;
      const args = call.getArguments();
      const arg0 = args[0]?.getText().replace(/['"`]/g, '');
      return arg0 === 'aria-current';
    });

    const propAccess = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression));
    const hasAriaCurrentProp = propAccess.some(p => p.getName() === 'ariaCurrent');

    expect(hasAriaCurrentCall || hasAriaCurrentProp).toBe(true);
  });

  // Requirement 6: aria-current is synchronized when scrolling stops (scrollend event)
  test('aria-current state is synchronized using a scrollend event listener', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExprs = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasScrollendListener = callExprs.some(call => {
      const text = call.getExpression().getText();
      if (!text.includes('addEventListener')) return false;
      const args = call.getArguments();
      const eventName = args[0]?.getText().replace(/['"`]/g, '');
      return eventName === 'scrollend';
    });

    const propAssignments = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.BinaryExpression));
    const hasOnScrollend = propAssignments.some(b => b.getLeft().getText().endsWith('onscrollend'));

    expect(hasScrollendListener || hasOnScrollend).toBe(true);
  });

  // Requirement 7: Feature detection for scroll-target-group
  test('script checks feature support for native scroll-target-group', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const callExprs = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));
    const hasFeatureDetection = callExprs.some(call => {
      const text = call.getExpression().getText();
      if (!text.includes('CSS.supports')) return false;
      const args = call.getArguments();
      return args.some(arg => arg.getText().includes('scroll-target-group'));
    });

    expect(hasFeatureDetection).toBe(true);
  });

  // Requirement 7: IntersectionObserver fallback detects visible sections
  test('fallback uses IntersectionObserver to detect visible sections', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const hasIntersectionObserver = sourceFiles.some(sf => {
      const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
      const idExprs = sf.getDescendantsOfKind(SyntaxKind.Identifier);
      return newExprs.some(ne => ne.getExpression().getText() === 'IntersectionObserver')
        || idExprs.some(id => id.getText() === 'IntersectionObserver');
    });

    expect(hasIntersectionObserver).toBe(true);
  });

  // Requirement 7: IntersectionObserver fallback applies :target-current class
  test('fallback applies :target-current class to the active navigation link', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();

    const stringLiterals = sourceFiles.flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.StringLiteral));
    const hasTargetCurrentClass = stringLiterals.some(sl => {
      const val = sl.getLiteralValue();
      return val === ':target-current' || val === '\\:target-current' || val.includes(':target-current');
    });

    expect(hasTargetCurrentClass).toBe(true);
  });

  // Requirement 3 & 7: Fallback class selector in CSS for unsupported browsers
  test('navigation active styles include fallback class selector for unsupported browsers', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet.cssRules);

    const hasFallbackClass = rules.some(r => {
      return (r.selectorText.includes('target-current') && r.selectorText.includes('.'))
        || r.selectorText.includes('\\:target-current')
        || r.selectorText.includes('.:target-current');
    });

    expect(hasFallbackClass).toBe(true);
  });
});
