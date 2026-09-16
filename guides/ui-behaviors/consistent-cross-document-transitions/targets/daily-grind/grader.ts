import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSViewTransitionRule, CSSMediaRule } from 'cssomnom';

// @ts-ignore
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

test.describe('consistent-cross-document-transitions Target Grader', () => {
  // 1. Source and destination pages include @view-transition { navigation: auto; }
  test('includes @view-transition at-rule with navigation: auto for cross-document transitions', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const vtRules = findViewTransitionRules(rules);
    const hasAutoNav = vtRules.some((r) => r.navigation === 'auto');
    expect(hasAutoNav).toBe(true);
  });

  // 2. Cross-document view transitions disabled when prefers-reduced-motion: reduce is active
  test('disables cross-document view transitions when prefers-reduced-motion: reduce is active', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const mediaRules: CSSMediaRule[] = [];
    function collectMediaRules(rList: readonly any[]) {
      for (const r of rList) {
        if (r instanceof CSSMediaRule) {
          mediaRules.push(r);
          if (r.cssRules) collectMediaRules(Array.from(r.cssRules));
        } else if (r && typeof r === 'object' && 'cssRules' in r && r.cssRules) {
          collectMediaRules(Array.from(r.cssRules));
        }
      }
    }
    collectMediaRules(rules);

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
  test('configures link rel="expect" with blocking="render" in head to block rendering until above-the-fold content is parsed', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasExpectBlockingRender = docs.some(({ document }) => {
      const expectLinks = Array.from(document.querySelectorAll('head link[rel="expect"], link[rel="expect"]'));
      return expectLinks.some((l: any) => l.getAttribute('blocking') === 'render');
    });
    expect(hasExpectBlockingRender).toBe(true);
  });

  // 4. Fragment identifier targeting element ID in href on link rel="expect"
  test('uses fragment identifier in link rel="expect" href targeting element ID', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('link[rel="expect"]')));
    const hasFragmentHref = expectLinks.length > 0 && expectLinks.every((l: any) => {
      const href = l.getAttribute('href') || '';
      return href.startsWith('#') && href.length > 1;
    });
    expect(hasFragmentHref).toBe(true);
  });

  // 5. Responsive render blocking using media attribute on link rel="expect"
  test('uses media attribute on link rel="expect" for responsive viewport render blocking', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('link[rel="expect"]')));
    const hasMediaAttr = expectLinks.some((l: any) => {
      const media = l.getAttribute('media');
      return Boolean(media && media.trim().length > 0);
    });
    expect(hasMediaAttr).toBe(true);
  });

  // 6. Scripts that must run before transition are marked with blocking="render" in <head>
  test('marks critical layout or theme scripts in the head with blocking="render"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasBlockingRenderScript = docs.some(({ document }) => {
      const scripts = Array.from(document.querySelectorAll('head script[blocking="render"]'));
      return scripts.length > 0;
    });
    expect(hasBlockingRenderScript).toBe(true);
  });

  // 7. Render blocking is limited to visible content; non-critical or below-the-fold content is NOT render-blocked
  test('does not render-block below-the-fold elements such as footer in link rel="expect"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('link[rel="expect"]')));
    const blocksBelowTheFold = expectLinks.some((l: any) => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.includes('footer') || href.includes('comment') || href.includes('below-the-fold');
    });
    expect(blocksBelowTheFold).toBe(false);
  });

  // 8. If view-transition-name assigned dynamically via pagereveal, registered in blocking="render" script in head
  test('registers pagereveal listener in a blocking="render" script in the head when dynamic transitions are used', () => {
    const docs = getHtmlDocuments(targetFiles);
    const project = getJsProject(targetFiles);
    const hasPagereveal = project.getSourceFiles().some((sf) => sf.getFullText().includes('pagereveal'));

    let improperlyRegisteredPagereveal = false;
    if (hasPagereveal) {
      const bodyScriptsWithPagereveal = docs.some(({ document }) => {
        const bodyScripts = Array.from(document.querySelectorAll('body script'));
        return bodyScripts.some((s: any) => (s.textContent || '').includes('pagereveal'));
      });
      const headScripts = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('head script')));
      const nonBlockingHeadScriptsWithPagereveal = headScripts.some((s: any) => {
        const isBlocking = s.getAttribute('blocking') === 'render';
        const hasInlinePagereveal = (s.textContent || '').includes('pagereveal');
        return !isBlocking && hasInlinePagereveal;
      });
      const hasBlockingHeadScript = docs.some(({ document }) => {
        return Boolean(document.querySelector('head script[blocking="render"]'));
      });

      if (bodyScriptsWithPagereveal || nonBlockingHeadScriptsWithPagereveal || !hasBlockingHeadScript) {
        improperlyRegisteredPagereveal = true;
      }
    }
    expect(improperlyRegisteredPagereveal).toBe(false);
  });

  // 9. Dynamically assigned view-transition-name values are removed after transition finishes
  test('cleans up dynamic view-transition-name after transition finishes if pagereveal is used', () => {
    const project = getJsProject(targetFiles);
    const sourceFiles = project.getSourceFiles();
    const invalidPagereveal = sourceFiles.some((sf) => {
      const text = sf.getFullText();
      return text.includes('pagereveal') && !text.includes('finished');
    });
    expect(invalidPagereveal).toBe(false);
  });

  // 10. No two elements on the same page share the same view-transition-name value
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
});
