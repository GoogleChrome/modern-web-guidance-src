import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind } from 'ts-morph';
import { CSSStyleRule } from 'cssomnom';

// @ts-ignore - TS1470 in CJS package scope
const targetFiles: string[] = getTargetFiles(import.meta.url);

test.describe('daily-grind Target Grader', () => {
  // Requirement 1: Clicking a navigation control scrolls the corresponding target element into view using a programmatic scroll method with smooth behavior.

  test('Navigation controls associate with corresponding section target elements in the document', () => {
    const docs = getHtmlDocuments(targetFiles);
    const hasNavigationTargets = docs.some(({ document: doc }) => {
      const navLinks = Array.from(doc.querySelectorAll('nav a, [data-scroll-target], [data-target]'));
      if (navLinks.length === 0) return false;

      return navLinks.some((link: any) => {
        const rawTarget =
          link.getAttribute('data-scroll-target') ||
          link.getAttribute('data-target') ||
          link.getAttribute('href') ||
          '';
        const cleanId = rawTarget.replace(/^[#/]+/, '');
        if (!cleanId) return false;
        const targetElement = doc.getElementById(cleanId);
        return (
          targetElement !== null &&
          (targetElement.tagName.toLowerCase() === 'section' || targetElement.closest('section') !== null)
        );
      });
    });

    expect(hasNavigationTargets).toBe(true);
  });

  test('Navigation controls attach a click event listener to initiate navigation', () => {
    const project = getJsProject(targetFiles);
    const hasClickNavigationHandler = project.getSourceFiles().some((sf) => {
      const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      const hasAddEventListenerClick = callExprs.some((call) => {
        const exprText = call.getExpression().getText();
        if (!exprText.endsWith('addEventListener')) return false;
        const firstArg = call.getArguments()[0]?.getText();
        return firstArg === "'click'" || firstArg === '"click"';
      });

      const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
      const hasOnClick = binaryExprs.some((bin) => bin.getLeft().getText().endsWith('onclick'));

      return hasAddEventListenerClick || hasOnClick;
    });

    expect(hasClickNavigationHandler).toBe(true);
  });

  test('Programmatic scroll method is called with smooth behavior', () => {
    const project = getJsProject(targetFiles);
    const hasSmoothScrollCall = project.getSourceFiles().some((sf) => {
      const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
      return calls.some((call) => {
        const exprText = call.getExpression().getText();
        const isScrollMethod = /(^|\.)(scrollIntoView|scrollTo|scrollBy|scroll)$/.test(exprText);
        if (!isScrollMethod) return false;

        const argsText = call.getArguments().map((a) => a.getText()).join(' ');
        if (/behavior\s*:\s*['"]smooth['"]/.test(argsText)) return true;

        const objectLiterals = sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression);
        return objectLiterals.some((obj) => /behavior\s*:\s*['"]smooth['"]/.test(obj.getText()));
      });
    });

    expect(hasSmoothScrollCall).toBe(true);
  });

  // Requirement 2: The implementation waits for the scroll operation to finish using the Promise returned directly by the scroll method, rather than relying on a hardcoded setTimeout() delay.

  test('Programmatic scroll operation is directly awaited using its returned Promise', () => {
    const project = getJsProject(targetFiles);
    const awaitsScrollPromise = project.getSourceFiles().some((sf) => {
      const awaitExprs = sf.getDescendantsOfKind(SyntaxKind.AwaitExpression);
      const directAwait = awaitExprs.some((awaitExpr) => {
        const text = awaitExpr.getText();
        return /(scrollIntoView|scrollTo|scrollBy|scroll)/i.test(text);
      });
      if (directAwait) return true;

      const scrollCalls = sf.getDescendantsOfKind(SyntaxKind.CallExpression).filter((call) => {
        const exprText = call.getExpression().getText();
        return /(^|\.)(scrollIntoView|scrollTo|scrollBy|scroll)$/.test(exprText);
      });
      return scrollCalls.some((call) => {
        const varDecl = call.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
        if (!varDecl) return false;
        const varName = varDecl.getName();
        return awaitExprs.some((awaitExpr) => awaitExpr.getExpression().getText() === varName);
      });
    });

    expect(awaitsScrollPromise).toBe(true);
  });

  test('Implementation waits for scroll completion via Promise rather than a setTimeout delay', () => {
    const project = getJsProject(targetFiles);
    const waitsViaPromiseWithoutTimeout = project.getSourceFiles().some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      return functions.some((fn) => {
        const hasAwait = fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).some((a) => {
          return /(scrollIntoView|scrollTo|scrollBy|scroll)/i.test(a.getText());
        });
        const hasSetTimeout = fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
          return c.getExpression().getText() === 'setTimeout';
        });

        return hasAwait && !hasSetTimeout;
      });
    });

    expect(waitsViaPromiseWithoutTimeout).toBe(true);
  });

  // Requirement 3: Any active highlight or post-scroll state on previously targeted elements is cleared when a new scroll navigation is triggered.

  test('CSS defines an active highlight style rule for target elements', () => {
    const stylesheet = getCssStyleSheet(targetFiles);
    const rules = Array.from(stylesheet.cssRules);
    const hasHighlightRule = rules.some((rule) => {
      if (!(rule instanceof CSSStyleRule)) return false;
      return /(highlight|target|active|selected)/i.test(rule.selectorText) || /:target\b/i.test(rule.selectorText);
    });

    expect(hasHighlightRule).toBe(true);
  });

  test('Previously active highlight state is cleared before smooth scroll completes', () => {
    const project = getJsProject(targetFiles);
    const clearsHighlightBeforeScroll = project.getSourceFiles().some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      return functions.some((fn) => {
        const awaitScroll = fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).find((a) => {
          return /(scrollIntoView|scrollTo|scrollBy|scroll)/i.test(a.getText());
        });
        if (!awaitScroll) return false;

        const removeCalls = fn.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
          const expr = c.getExpression().getText();
          const isRemove = /(classList\.(remove|toggle)|removeAttribute|setAttribute)$/.test(expr);
          if (!isRemove) return false;
          const argsText = c.getArguments().map((a) => a.getText()).join(' ');
          return /(highlight|target|active|selected)/i.test(argsText);
        });

        const binaryAssignments = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((b) => {
          const leftText = b.getLeft().getText();
          return /(className|classList)\b/.test(leftText);
        });

        const earliestClearStart = Math.min(
          ...removeCalls.map((c) => c.getStart()),
          ...binaryAssignments.map((b) => b.getStart()),
          Infinity
        );

        return earliestClearStart < awaitScroll.getStart();
      });
    });

    expect(clearsHighlightBeforeScroll).toBe(true);
  });

  // Requirement 4: The post-scroll effect is applied only after the scroll method's returned Promise resolves when scrolling settles.

  test('Target element post-scroll highlight effect is applied after the scroll Promise settles', () => {
    const project = getJsProject(targetFiles);
    const appliesHighlightAfterAwait = project.getSourceFiles().some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      return functions.some((fn) => {
        const awaitScroll = fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).find((a) => {
          return /(scrollIntoView|scrollTo|scrollBy|scroll)/i.test(a.getText());
        });
        if (!awaitScroll) return false;

        const addCalls = fn.getDescendantsOfKind(SyntaxKind.CallExpression).filter((c) => {
          const expr = c.getExpression().getText();
          const isAdd = /(classList\.(add|toggle)|setAttribute)$/.test(expr);
          if (!isAdd) return false;
          const argsText = c.getArguments().map((a) => a.getText()).join(' ');
          return /(highlight|target|active|selected)/i.test(argsText);
        });

        const binaryAssignments = fn.getDescendantsOfKind(SyntaxKind.BinaryExpression).filter((b) => {
          const leftText = b.getLeft().getText();
          return /(className|classList)\b/.test(leftText);
        });

        const latestEffectStart = Math.max(
          ...addCalls.map((c) => c.getStart()),
          ...binaryAssignments.map((b) => b.getStart()),
          -1
        );

        return latestEffectStart > awaitScroll.getStart();
      });
    });

    expect(appliesHighlightAfterAwait).toBe(true);
  });

  // Requirement 5: Triggering a scroll to a target element that is already in view still resolves the awaited scroll call and applies the post-scroll effect without hanging.

  test('Scroll completion resolves and applies post-scroll effect without blocking on un-timed scrollend events', () => {
    const project = getJsProject(targetFiles);
    const resolvesWithoutHangingOnScrollend = project.getSourceFiles().some((sf) => {
      const functions = [
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
        ...sf.getDescendantsOfKind(SyntaxKind.FunctionExpression),
        ...sf.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ];

      return functions.some((fn) => {
        const awaitScroll = fn.getDescendantsOfKind(SyntaxKind.AwaitExpression).find((a) => {
          return /(scrollIntoView|scrollTo|scrollBy|scroll)/i.test(a.getText());
        });
        if (!awaitScroll) return false;

        const hasScrollendListener = fn.getDescendantsOfKind(SyntaxKind.CallExpression).some((c) => {
          const expr = c.getExpression().getText();
          if (!expr.endsWith('addEventListener')) return false;
          const firstArg = c.getArguments()[0]?.getText();
          return firstArg === "'scrollend'" || firstArg === '"scrollend"';
        });

        return !hasScrollendListener;
      });
    });

    expect(resolvesWithoutHangingOnScrollend).toBe(true);
  });
});
