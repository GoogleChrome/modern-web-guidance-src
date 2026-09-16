import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSViewTransitionRule, CSSMediaRule } from 'cssomnom';

const targetFiles: string[] = getTargetFiles(import.meta.url);

function findViewTransitionRules(rules: readonly any[]): CSSViewTransitionRule[] {
  const result: CSSViewTransitionRule[] = [];
  for (const r of rules) {
    if (r instanceof CSSViewTransitionRule) {
      result.push(r);
    } else if (r && typeof r === 'object' && 'cssRules' in r && r.cssRules) {
      result.push(...findViewTransitionRules(Array.from(r.cssRules)));
    }
  }
  return result;
}

function collectMediaRules(rules: readonly any[]): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  for (const r of rules) {
    if (r instanceof CSSMediaRule) {
      result.push(r);
      if (r.cssRules) result.push(...collectMediaRules(Array.from(r.cssRules)));
    } else if (r && typeof r === 'object' && 'cssRules' in r && r.cssRules) {
      result.push(...collectMediaRules(Array.from(r.cssRules)));
    }
  }
  return result;
}

test.describe('consistent-cross-document-transitions Target Grader', () => {
  // 1. Both source and destination pages include @view-transition { navigation: auto; }
  test('includes @view-transition at-rule with navigation: auto for cross-document transitions', () => {
    const cssFiles = targetFiles.filter((f) => f.endsWith('.css'));
    const stylesheet = getCssStyleSheet(cssFiles.length > 0 ? cssFiles : targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const vtRules = findViewTransitionRules(rules);
    const hasAutoNav = vtRules.some((r) => r.navigation === 'auto');
    expect(hasAutoNav).toBe(true);
  });

  // 2. Cross-document view transitions disabled when prefers-reduced-motion: reduce is active
  test('disables cross-document view transitions when prefers-reduced-motion: reduce is active', () => {
    const cssFiles = targetFiles.filter((f) => f.endsWith('.css'));
    const stylesheet = getCssStyleSheet(cssFiles.length > 0 ? cssFiles : targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const mediaRules = collectMediaRules(rules);

    const hasReducedMotionHandling = mediaRules.some((mr) => {
      const cond = mr.conditionText || '';
      const isReduce = /prefers-reduced-motion\s*:\s*reduce/.test(cond);
      const isNoPref = /prefers-reduced-motion\s*:\s*no-preference/.test(cond);
      const nestedVts = findViewTransitionRules(Array.from(mr.cssRules));
      if (isReduce && nestedVts.some((vt) => vt.navigation === 'none')) return true;
      if (isNoPref && nestedVts.some((vt) => vt.navigation === 'auto')) return true;
      return false;
    });
    expect(hasReducedMotionHandling).toBe(true);
  });

  // 3. <link rel="expect" href="#element-id" blocking="render"> is used in the <head>
  test('configures link rel="expect" with blocking="render" to block rendering until above-the-fold content is parsed', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasExpectBlockingRender = docs.some(({ document }) => {
      const expectLinks = Array.from(document.querySelectorAll('head link[rel="expect"]'));
      return expectLinks.some((l: any) => l.getAttribute('blocking') === 'render');
    });
    expect(hasExpectBlockingRender).toBe(true);
  });

  // 4. Fragment identifier in href on link rel="expect"
  test('uses fragment identifier in link rel="expect" href targeting element ID', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('head link[rel="expect"]')).filter((l: any) => l.hasAttribute('href'))
    );
    const hasFragmentHref = expectLinks.length > 0 && expectLinks.every((l: any) => {
      const href = l.getAttribute('href') || '';
      return href.includes('#');
    });
    expect(hasFragmentHref).toBe(true);
  });

  // 5. Responsive render blocking using media attribute on link rel="expect"
  test('uses media attribute on link rel="expect" for responsive viewport render blocking', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('head link[rel="expect"]')).filter((l: any) => l.hasAttribute('href'))
    );
    const hasMediaAttr = expectLinks.some((l: any) => {
      const media = l.getAttribute('media');
      return Boolean(media && media.trim().length > 0);
    });
    expect(hasMediaAttr).toBe(true);
  });

  // 6. Below-the-fold content is NOT render-blocked
  test('does not render-block below-the-fold or non-critical elements such as footer', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('head link[rel="expect"]')).filter((l: any) => l.hasAttribute('href'))
    );
    const blocksBelowTheFold = expectLinks.some((l: any) => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.includes('footer') || href.includes('comment') || href.includes('below-the-fold');
    });
    expect(blocksBelowTheFold).toBe(false);
  });

  // 7. Non-critical scripts do NOT have blocking="render"
  test('does not mark non-critical analytics or ad scripts with blocking="render"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const nonCriticalScriptBlocked = docs.some(({ document }) => {
      const scripts = Array.from(document.querySelectorAll('script[blocking="render"]'));
      return scripts.some((s: any) => {
        const src = (s.getAttribute('src') || '').toLowerCase();
        return src.includes('analytics') || src.includes('ad-client');
      });
    });
    expect(nonCriticalScriptBlocked).toBe(false);
  });

  // 8. Astro ClientRouter is removed to enable native cross-document view transitions
  test('removes ClientRouter component to allow native cross-document transitions', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasClientRouter = docs.some(({ document }) => Boolean(document.querySelector('ClientRouter, clientrouter')));
    expect(hasClientRouter).toBe(false);
  });

  // 9. No duplicate static view-transition-name on the same page
  test('ensures no duplicate static view-transition-name values exist on the same page', () => {
    const docs = getHtmlDocuments(targetFiles);
    let hasDuplicates = false;
    for (const { document } of docs) {
      const elementsWithVtn = Array.from(document.querySelectorAll('[style*="view-transition-name"]'));
      const names = elementsWithVtn.map((el: any) => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/view-transition-name\s*:\s*([^;]+)/);
        return match ? match[1].trim() : null;
      }).filter(Boolean);
      const uniqueNames = new Set(names);
      if (names.length !== uniqueNames.size) {
        hasDuplicates = true;
        break;
      }
    }
    expect(hasDuplicates).toBe(false);
  });

  // 10. Dynamic view-transition-name via pagereveal cleans up after transition finishes
  test('cleans up dynamic view-transition-name after transition finishes if pagereveal is used', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const invalidPagereveal = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return text.includes('pagereveal') && !text.includes('finished');
    });
    expect(invalidPagereveal).toBe(false);
  });
});
