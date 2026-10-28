import {
  test,
  expect,
  getTargetFiles,
  getCssStyleSheet,
  getJsProject,
} from '../../../../../src/grading/test-fixture.ts';
import {
  SyntaxKind,
  type Project,
  type PropertyAccessExpression,
} from 'ts-morph';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSRule,
  type CSSStyleSheet,
} from 'cssomnom';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getAllStyleRules(sheet: CSSStyleSheet): CSSStyleRule[] {
  const result: CSSStyleRule[] = [];
  function collect(rules: Iterable<CSSRule>) {
    for (const rule of rules) {
      if (rule instanceof CSSStyleRule) {
        result.push(rule);
      }
      if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
        collect(Array.from((rule as { cssRules: Iterable<CSSRule> }).cssRules));
      }
    }
  }
  collect(Array.from(sheet.cssRules));
  return result;
}

function getAllMediaRules(sheet: CSSStyleSheet): CSSMediaRule[] {
  const result: CSSMediaRule[] = [];
  function collect(rules: Iterable<CSSRule>) {
    for (const rule of rules) {
      if (rule instanceof CSSMediaRule) {
        result.push(rule);
      }
      if ('cssRules' in rule && (rule as { cssRules?: Iterable<CSSRule> }).cssRules) {
        collect(Array.from((rule as { cssRules: Iterable<CSSRule> }).cssRules));
      }
    }
  }
  collect(Array.from(sheet.cssRules));
  return result;
}

test.describe('scoped-component-transitions Target Grader', () => {

  test('Component state updates call startViewTransition on an element rather than document', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const svtCalls = callExpressions.filter(call => {
      const expr = call.getExpression();
      return expr.getKind() === SyntaxKind.PropertyAccessExpression &&
        (expr as PropertyAccessExpression).getName() === 'startViewTransition';
    });

    const hasElementScopedCall = svtCalls.length > 0 && svtCalls.every(call => {
      const caller = (call.getExpression() as PropertyAccessExpression).getExpression();
      const callerText = caller.getText().trim();
      return callerText !== 'document';
    });

    expect(hasElementScopedCall).toBe(true);
  });

  test('Feature detection checks for startViewTransition on Element.prototype or Element instance', () => {
    const project: Project = getJsProject(targetFiles);
    const binaryExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );

    let hasElementOrInstanceCheck = false;
    let hasDocumentOnlyCheck = false;

    for (const expr of binaryExpressions) {
      const op = expr.getOperatorToken().getKind();
      const leftText = expr.getLeft().getText();
      const rightText = expr.getRight().getText();

      if (op === SyntaxKind.InKeyword) {
        if (/['"`]startViewTransition['"`]/.test(leftText)) {
          if (/Element/.test(rightText)) {
            hasElementOrInstanceCheck = true;
          } else if (rightText.trim() === 'document') {
            hasDocumentOnlyCheck = true;
          }
        }
      }

      if (
        op === SyntaxKind.EqualsEqualsEqualsToken ||
        op === SyntaxKind.ExclamationEqualsEqualsToken ||
        op === SyntaxKind.EqualsEqualsToken ||
        op === SyntaxKind.ExclamationEqualsToken
      ) {
        const isLeftTypeof = leftText.startsWith('typeof ') && leftText.includes('startViewTransition');
        const isRightTypeof = rightText.startsWith('typeof ') && rightText.includes('startViewTransition');
        if ((isLeftTypeof && /['"`]function['"`]/.test(rightText)) || (isRightTypeof && /['"`]function['"`]/.test(leftText))) {
          if (!leftText.includes('document.') && !rightText.includes('document.')) {
            hasElementOrInstanceCheck = true;
          } else {
            hasDocumentOnlyCheck = true;
          }
        }
      }
    }

    expect(hasElementOrInstanceCheck && !hasDocumentOnlyCheck).toBe(true);
  });

  test('Executes DOM update callback immediately as fallback when scoped transitions are unsupported', () => {
    const project: Project = getJsProject(targetFiles);
    const ifStatements = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.IfStatement)
    );

    const hasFallbackExecution = ifStatements.some(ifStmt => {
      const condText = ifStmt.getExpression().getText();
      const isSupportCheck = /(!\s*(supports|isSupported)|startViewTransition)/i.test(condText);
      if (!isSupportCheck) return false;

      const thenBranch = ifStmt.getThenStatement();
      const throwStatements = thenBranch.getDescendantsOfKind(SyntaxKind.ThrowStatement);
      if (throwStatements.length > 0) return false;

      const callExpressions = thenBranch.getDescendantsOfKind(SyntaxKind.CallExpression);
      return callExpressions.some(call => {
        const callee = call.getExpression().getText();
        return /update|dom|callback|cb|fn/i.test(callee);
      });
    });

    expect(hasFallbackExecution).toBe(true);
  });

  test('Child elements animating within the scoped container are assigned a view-transition-name', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet);

    const hasChildTransitionName = rules.some(rule => {
      const isChildSelector = /\b(card|item)\b/.test(rule.selectorText);
      const vtName = rule.style.getPropertyValue('view-transition-name').trim();
      return isChildSelector && vtName.length > 0 && vtName !== 'none';
    });

    expect(hasChildTransitionName).toBe(true);
  });

  test('Reordering or updating existing child elements preserves and moves existing DOM nodes', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasNodeMovementCall = callExpressions.some(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const name = (expr as PropertyAccessExpression).getName();
        return name === 'appendChild' || name === 'insertBefore' || name === 'append';
      }
      return false;
    });

    const binaryExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.BinaryExpression)
    );
    const hasInnerHTMLRecreation = binaryExpressions.some(expr => {
      if (expr.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const leftText = expr.getLeft().getText();
        return /(?:grid|list|container|favorites)\.(innerHTML|outerHTML)$/i.test(leftText);
      }
      return false;
    });

    expect(hasNodeMovementCall && !hasInnerHTMLRecreation).toBe(true);
  });

  test('Scoped container element participates in transition without setting view-transition-name: none', () => {
    const project: Project = getJsProject(targetFiles);
    const callExpressions = project.getSourceFiles().flatMap(sf =>
      sf.getDescendantsOfKind(SyntaxKind.CallExpression)
    );

    const hasScopedElementTransition = callExpressions.some(call => {
      const expr = call.getExpression();
      if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = expr as PropertyAccessExpression;
        return propAccess.getName() === 'startViewTransition' && propAccess.getExpression().getText().trim() !== 'document';
      }
      return false;
    });

    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const rules = getAllStyleRules(stylesheet);

    const containerRules = rules.filter(rule =>
      /(#favorites|-grid|\.grid\b)/.test(rule.selectorText)
    );

    const containerDisablesTransition = containerRules.some(rule =>
      rule.style.getPropertyValue('view-transition-name').trim() === 'none'
    );

    expect(hasScopedElementTransition && !containerDisablesTransition).toBe(true);
  });

  test('Disables view transition animations under prefers-reduced-motion: reduce media query', () => {
    const stylesheet: CSSStyleSheet = getCssStyleSheet(targetFiles);
    const mediaRules = getAllMediaRules(stylesheet).filter(
      r => r.conditionText.includes('prefers-reduced-motion') && r.conditionText.includes('reduce')
    );

    const hasReducedMotionRule = mediaRules.some(mediaRule => {
      const nestedStyleRules = Array.from(mediaRule.cssRules).filter(
        (r): r is CSSStyleRule => r instanceof CSSStyleRule
      );

      const hasGroup = nestedStyleRules.some(r =>
        r.selectorText.includes('::view-transition-group') &&
        /\bnone\b/.test(r.style.getPropertyValue('animation'))
      );
      const hasOld = nestedStyleRules.some(r =>
        r.selectorText.includes('::view-transition-old') &&
        /\bnone\b/.test(r.style.getPropertyValue('animation'))
      );
      const hasNew = nestedStyleRules.some(r =>
        r.selectorText.includes('::view-transition-new') &&
        /\bnone\b/.test(r.style.getPropertyValue('animation'))
      );

      return hasGroup && hasOld && hasNew;
    });

    expect(hasReducedMotionRule).toBe(true);
  });
});
