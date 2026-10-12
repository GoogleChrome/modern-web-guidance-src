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

/**
 * Negative and conditional expectations ("does not ...", "if ... then ...") pass
 * vacuously on an app that hasn't implemented the feature at all. Gate them on the
 * cross-document opt-in so they only credit an actual implementation, without the
 * baseline having to inject placeholder anti-patterns.
 */
function hasCrossDocumentOptIn(): boolean {
  const rules = Array.from(getCssStyleSheet(targetFiles).cssRules);
  return findViewTransitionRules(rules).some((r) => r.navigation === 'auto');
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

  // 5. The media attribute is used on link rel="expect" WHEN different viewport sizes require
  // blocking on different DOM elements. The expectation is conditional: a single unconditional
  // link targeting content that is above the fold at every width is correct. We can't statically
  // know the app's per-viewport fold, so we check that render blocking is in place and that any
  // media attribute that is used is a real (non-empty) media query.
  test('uses media attribute on link rel="expect" for responsive viewport render blocking', () => {
    const docs = getHtmlDocuments(targetFiles);
    const expectLinks = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('link[rel="expect"]')));
    expect(expectLinks.length).toBeGreaterThan(0);
    const hasEmptyMedia = expectLinks.some((l: any) => l.hasAttribute('media') && !(l.getAttribute('media') || '').trim());
    expect(hasEmptyMedia).toBe(false);
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
    expect(expectLinks.length).toBeGreaterThan(0);
    const blocksBelowTheFold = expectLinks.some((l: any) => {
      const href = (l.getAttribute('href') || '').toLowerCase();
      return href.includes('footer') || href.includes('comment') || href.includes('below-the-fold');
    });
    expect(blocksBelowTheFold).toBe(false);
  });

  // 8. If view-transition-name assigned dynamically via pagereveal, registered in blocking="render" script in head
  test('registers pagereveal listener in a blocking="render" script in the head when dynamic transitions are used', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
    const docs = getHtmlDocuments(targetFiles);
    const hasPagereveal = getPagerevealHandlers().length > 0;

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

  // 9. Dynamically assigned view-transition-name values are removed after transition finishes.
  // Only pagereveal handlers that actually assign a view-transition-name need cleanup.
  test('cleans up dynamic view-transition-name after transition finishes if pagereveal is used', () => {
    expect(hasCrossDocumentOptIn()).toBe(true);
    const missingCleanup = getPagerevealHandlers().some(
      (handler) => VT_NAME_ASSIGNMENT.test(handler) && !/\.finished\b/.test(handler)
    );
    expect(missingCleanup).toBe(false);
  });

  // 10. No two elements on the same page share the same view-transition-name value
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
});
