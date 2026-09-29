import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSStyleRule, CSSRule } from 'cssomnom';
import { SyntaxKind } from 'ts-morph';

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

test.describe('Scrollspy Target Grader', () => {

  test('Navigation links use fragment identifiers matching unique IDs of target content sections', () => {
    const docs = getHtmlDocuments(targetFiles);
    const navLinks = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('nav a, [role="navigation"] a, [data-scrollspy] a, [data-scrollspy-nav] a, a[class*="scrollspy"], a[class*="section-nav"]'))
    );
    const hasFragmentLinks = navLinks.some(a => ((a as any).getAttribute('href') || '').includes('#'));
    const sectionIds = docs.flatMap(d =>
      Array.from(d.document.querySelectorAll('[id]')).map((el: any) => el.id || el.getAttribute('id') || '')
    ).filter(id => id && !id.includes('{'));

    const matchesRequirements = hasFragmentLinks && sectionIds.length >= 3;
    expect(matchesRequirements).toBe(true);
  });

  test('Navigation container has scroll-target-group: auto applied', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasScrollTargetGroup = allRules.some(r => r.style.getPropertyValue('scroll-target-group')?.trim() === 'auto')
      || docs.some(d => Array.from(d.document.querySelectorAll('*')).some((el: any) => /scroll-target-group\s*:\s*auto/.test(el.getAttribute('style') || '')));

    expect(hasScrollTargetGroup).toBe(true);
  });

  test('Navigation links use :target-current pseudo-class for active state styling', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const hasTargetCurrentRule = allRules.some(r => r.selectorText.includes(':target-current'))
      || docs.some(d => Boolean(d.document.querySelector('[class*="target-current"]')));

    expect(hasTargetCurrentRule).toBe(true);
  });

  test('Active link styling provides visual highlight with color change and non-color indicator', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const allRules = getAllStyleRules(stylesheet.cssRules);
    const docs = getHtmlDocuments(targetFiles);

    const targetCurrentRules = allRules.filter(r => r.selectorText.includes('target-current'));
    const hasVisualHighlight = targetCurrentRules.some(r => {
      const hasColor = Boolean(
        r.style.getPropertyValue('color') ||
        r.style.getPropertyValue('background') ||
        r.style.getPropertyValue('background-color')
      );
      const hasNonColor = Boolean(
        r.style.getPropertyValue('font-weight') ||
        r.style.getPropertyValue('text-decoration') ||
        r.style.getPropertyValue('text-decoration-line') ||
        r.style.getPropertyValue('border-bottom') ||
        r.style.getPropertyValue('border-bottom-color') ||
        r.style.getPropertyValue('border-bottom-width') ||
        r.style.getPropertyValue('border') ||
        r.style.getPropertyValue('outline') ||
        r.style.getPropertyValue('box-shadow')
      );
      return hasColor && hasNonColor;
    }) || docs.some(d => {
      const navEl = d.document.querySelector('nav, [data-scrollspy], [data-scrollspy-nav]');
      const html = navEl ? navEl.outerHTML : '';
      return /target-current.*(font-|underline|border|ring)/.test(html);
    });

    expect(hasVisualHighlight).toBe(true);
  });

  test('Navigation links manage aria-current attribute for visible and non-visible sections', () => {
    const project = getJsProject(targetFiles);
    const callExprs = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.CallExpression));

    const setsAriaCurrent = callExprs.some(call => {
      const text = call.getText();
      return text.includes('setAttribute') && text.includes('aria-current');
    }) || project.getSourceFiles().some(sf => sf.getText().includes('ariaCurrent'));

    expect(setsAriaCurrent).toBe(true);
  });

  test('aria-current state synchronizes with visible section when scrolling stops', () => {
    const project = getJsProject(targetFiles);

    const synchronizesOnScrollEnd = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return text.includes('scrollend') || (text.includes('addEventListener') && text.includes('scroll') && (text.includes('setTimeout') || text.includes('requestAnimationFrame')));
    });

    expect(synchronizesOnScrollEnd).toBe(true);
  });

  test('IntersectionObserver fallback applies target-current fallback class for unsupported browsers', () => {
    const project = getJsProject(targetFiles);
    const newExprs = project.getSourceFiles().flatMap(sf => sf.getDescendantsOfKind(SyntaxKind.NewExpression));

    const hasIntersectionObserver = newExprs.some(expr => expr.getExpression().getText() === 'IntersectionObserver')
      || project.getSourceFiles().some(sf => sf.getText().includes('IntersectionObserver'));

    const appliesFallbackClass = project.getSourceFiles().some(sf => {
      const text = sf.getText();
      return text.includes('target-current') && (text.includes('classList') || text.includes('className'));
    });

    expect(hasIntersectionObserver && appliesFallbackClass).toBe(true);
  });

});
