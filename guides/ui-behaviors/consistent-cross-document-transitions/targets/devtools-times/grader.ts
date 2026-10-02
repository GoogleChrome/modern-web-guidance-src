import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../test-fixture.ts';
import { CSSViewTransitionRule, CSSMediaRule } from 'cssomnom';
import { Node, SyntaxKind } from 'ts-morph';

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

function getStylesheetRules(): any[] {
  const cssFiles = targetFiles.filter((f) => f.endsWith('.css'));
  const stylesheet = getCssStyleSheet(cssFiles.length > 0 ? cssFiles : targetFiles);
  return Array.from(stylesheet.cssRules);
}

/**
 * Negative and conditional expectations ("does not ...", "if ... then ...") pass
 * vacuously on an app that hasn't implemented the feature at all. Gate them on the
 * cross-document opt-in so they only credit an actual implementation, without the
 * baseline having to inject placeholder anti-patterns.
 */
function hasCrossDocumentOptIn(): boolean {
  return findViewTransitionRules(getStylesheetRules()).some((r) => r.navigation === 'auto');
}

function getExpectLinks(): any[] {
  return getHtmlDocuments(targetFiles).flatMap(({ document }) =>
    Array.from(document.querySelectorAll('head link[rel="expect"]')).filter((l: any) => l.hasAttribute('href'))
  );
}

const VT_NAME_ASSIGNMENT = /viewTransitionName|view-transition-name/;

/**
 * Returns the source text of every `pagereveal` handler: the callback passed to
 * `addEventListener('pagereveal', ...)` or assigned to `onpagereveal`. When the
 * handler is a reference rather than an inline function, the whole file is used.
 */
function getPagerevealHandlers(): string[] {
  const handlers: string[] = [];
  for (const sf of getJsProject(targetFiles).getSourceFiles()) {
    for (const call of sf.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (!call.getExpression().getText().endsWith('addEventListener')) continue;
      const [eventArg, handlerArg] = call.getArguments();
      if (!eventArg || !Node.isStringLiteral(eventArg) || eventArg.getLiteralValue() !== 'pagereveal') continue;
      const isInline = handlerArg && (Node.isArrowFunction(handlerArg) || Node.isFunctionExpression(handlerArg));
      handlers.push(isInline ? handlerArg.getText() : sf.getFullText());
    }
    for (const bin of sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (bin.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) continue;
      if (!bin.getLeft().getText().endsWith('onpagereveal')) continue;
      const right = bin.getRight();
      const isInline = Node.isArrowFunction(right) || Node.isFunctionExpression(right);
      handlers.push(isInline ? right.getText() : sf.getFullText());
    }
  }
  return handlers;
}

test.describe('consistent-cross-document-transitions Target Grader', () => {
  // 1. Both source and destination pages include @view-transition { navigation: auto; }
  test('includes @view-transition at-rule with navigation: auto for cross-document transitions', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
  });

  // 2. Cross-document view transitions disabled when prefers-reduced-motion: reduce is active
  test('disables cross-document view transitions when prefers-reduced-motion: reduce is active', () => {
    const mediaRules = collectMediaRules(getStylesheetRules());

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
    const expectLinks = getExpectLinks();
    const hasFragmentHref = expectLinks.length > 0 && expectLinks.every((l: any) => {
      const href = l.getAttribute('href') || '';
      return href.includes('#');
    });
    expect(hasFragmentHref).toBe(true);
  });

  // 5. The media attribute is used on link rel="expect" WHEN different viewport sizes require
  // blocking on different DOM elements. The expectation is conditional: a single unconditional
  // link targeting content that is above the fold at every width (e.g. #main-content) is correct.
  // We can't statically know the app's per-viewport fold, so we check that render blocking is in
  // place and that any media attribute that is used is a real (non-empty) media query.
  test('uses media attribute on link rel="expect" for responsive viewport render blocking', () => {
    const expectLinks = getExpectLinks();
    expect(expectLinks.length).toBeGreaterThan(0);
    const hasEmptyMedia = expectLinks.some((l: any) => l.hasAttribute('media') && !(l.getAttribute('media') || '').trim());
    expect(hasEmptyMedia).toBe(false);
  });

  // 6. Below-the-fold content is NOT render-blocked
  test('does not render-block below-the-fold or non-critical elements such as footer', () => {
    const expectLinks = getExpectLinks();
    expect(expectLinks.length).toBeGreaterThan(0);
    const blocksBelowTheFold = expectLinks.some((l: any) => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.includes('footer') || href.includes('comment') || href.includes('below-the-fold');
    });
    expect(blocksBelowTheFold).toBe(false);
  });

  // 7. Non-critical scripts do NOT have blocking="render"
  test('does not mark non-critical analytics or ad scripts with blocking="render"', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
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

  // 8. Client-side routers that intercept navigations (Astro's ClientRouter) are removed so
  // navigations are real cross-document navigations that trigger @view-transition.
  test('removes ClientRouter component to allow native cross-document transitions', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasClientRouter = docs.some(({ document }) => Boolean(document.querySelector('ClientRouter, clientrouter')));
    expect(hasClientRouter).toBe(false);
  });

  // 9. No duplicate static view-transition-name on the same page
  test('ensures no duplicate static view-transition-name values exist on the same page', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
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

  // 10. Dynamically assigned view-transition-name values are removed after the transition finishes.
  // Only pagereveal handlers that actually assign a view-transition-name need cleanup.
  test('cleans up dynamic view-transition-name after transition finishes if pagereveal is used', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
    const missingCleanup = getPagerevealHandlers().some(
      (handler) => VT_NAME_ASSIGNMENT.test(handler) && !/\.finished\b/.test(handler)
    );
    expect(missingCleanup).toBe(false);
  });
});
