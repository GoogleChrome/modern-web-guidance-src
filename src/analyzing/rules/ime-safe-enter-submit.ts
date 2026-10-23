/* oxlint-disable max-lines-per-function, max-depth */
import { Node, SyntaxKind, type CallExpression, type JsxAttribute, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const IME_SAFE_ENTER_SUBMIT_GUIDE_HASH = '0616906d0788';

const ENTER_CHECK_REGEX =
  /(?:keyCode\s*===?\s*13|13\s*===?\s*keyCode|which\s*===?\s*13|13\s*===?\s*which|key\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*key|code\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*code|case\s+(?:13|['"]Enter['"]))/;

const ACTION_TOKENS_REGEX =
  /(?:submit|requestSubmit|click|dispatchEvent|trigger|fetch|axios|ajax|send|search|save|handleEnter|onEnter|add|create|post)/i;

const ARIA_BUTTON_ROLES = new Set([
  'button',
  'menuitem',
  'tab',
  'link',
  'switch',
  'checkbox',
  'option',
]);

/**
 * Checks if a branch contains only event suppression calls (preventDefault, stopPropagation)
 * and control returns, with no submission or action invocations.
 */
function isSuppressOnlyBranch(branchText: string): boolean {
  if (ACTION_TOKENS_REGEX.test(branchText)) {
    return false;
  }
  const stripped = branchText
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .replace(/(?:e|event|evt)\s*\.\s*(?:preventDefault|stopPropagation|stopImmediatePropagation)\s*\(\s*\)/g, '')
    .replace(/\breturn\s*(?:false|true)?\s*;?/g, '')
    .replace(/\bbreak\s*;?/g, '')
    .replace(/case\s+(?:13|['"]Enter['"])\s*:/g, '')
    .replace(/[{};,\s]/g, '');
  return stripped.length === 0;
}

/**
 * Checks if an element has been configured with an ARIA button role
 * via setAttribute('role', ...) or .role = ... in the enclosing scope.
 */
function hasAriaButtonRoleAssignment(targetNode: Node, variableName: string): boolean {
  let currentScope: Node | undefined = targetNode.getParent();
  while (
    currentScope &&
    !Node.isSourceFile(currentScope) &&
    !Node.isFunctionDeclaration(currentScope) &&
    !Node.isBlock(currentScope)
  ) {
    currentScope = currentScope.getParent();
  }
  const scopeNode = currentScope ?? targetNode.getSourceFile();
  const fullScopeText = scopeNode.getText();
  if (!fullScopeText.includes('role') && !fullScopeText.includes('Role')) {
    return false;
  }
  const roleRegex = new RegExp(
    `\\b${variableName}\\s*(?:\\.\\s*setAttribute\\s*\\(\\s*['"]role['"]\\s*,\\s*['"](?:button|menuitem|tab|link|switch|checkbox|option)['"]|\\.\\s*role\\s*=\\s*['"](?:button|menuitem|tab|link|switch|checkbox|option)['"])`,
    'i',
  );
  return roleRegex.test(fullScopeText);
}

/**
 * Checks if a condition strictly requires Ctrl or Cmd (Meta) modifier key,
 * properly distinguishing positive requirements from negated guards (e.g. !e.ctrlKey).
 */
function requiresCtrlOrMetaModifier(condText: string): boolean {
  const hasPositiveCtrl = /(?:^|[^!.\w])(?:e|event|evt)?\.?ctrlKey\b(?!\s*===?\s*false)/.test(condText);
  const hasPositiveMeta = /(?:^|[^!.\w])(?:e|event|evt)?\.?metaKey\b(?!\s*===?\s*false)/.test(condText);
  return hasPositiveCtrl || hasPositiveMeta;
}

/**
 * Checks a handler function for an Enter key check lacking isComposing / keyCode 229 guards.
 */
function checkHandlerForUnsafeEnter(
  handler: Node,
  fallbackLine: number,
): AnalyzerMatch | null {
  const handlerText = handler.getText();

  // If the handler already checks isComposing, keyCode 229, or key === 'Process', skip!
  if (
    handlerText.includes('isComposing') ||
    handlerText.includes('229') ||
    handlerText.includes("'Process'") ||
    handlerText.includes('"Process"')
  ) {
    return null;
  }

  // Check if handler contains an Enter check
  if (!ENTER_CHECK_REGEX.test(handlerText)) {
    return null;
  }

  let foundModifierGuardedEnter = false;

  // Look for IfStatements checking Enter
  const ifStatements = handler.getDescendantsOfKind(SyntaxKind.IfStatement);
  for (const ifStmt of ifStatements) {
    const condText = ifStmt.getExpression().getText();
    if (ENTER_CHECK_REGEX.test(condText)) {
      if (requiresCtrlOrMetaModifier(condText)) {
        foundModifierGuardedEnter = true;
        continue;
      }

      const branchText = ifStmt.getThenStatement().getText();
      if (!isSuppressOnlyBranch(branchText) && ACTION_TOKENS_REGEX.test(branchText)) {
        return {
          line: ifStmt.getStartLineNumber(),
          message:
            'Keydown Enter listener triggers submission/action without checking event.isComposing or event.keyCode === 229 for IME composition safety',
        };
      }
    }
  }

  // Look for SwitchStatements checking keyCode/which/key
  const switchStatements = handler.getDescendantsOfKind(SyntaxKind.SwitchStatement);
  for (const switchStmt of switchStatements) {
    const exprText = switchStmt.getExpression().getText();
    if (exprText.includes('keyCode') || exprText.includes('which') || exprText.includes('key')) {
      const caseBlock = switchStmt.getCaseBlock();
      for (const clause of caseBlock.getClauses()) {
        if (Node.isCaseClause(clause)) {
          const caseExprText = clause.getExpression().getText();
          if (caseExprText === '13' || caseExprText === "'Enter'" || caseExprText === '"Enter"') {
            const clauseText = clause.getText();
            if (!isSuppressOnlyBranch(clauseText) && ACTION_TOKENS_REGEX.test(clauseText)) {
              return {
                line: clause.getStartLineNumber(),
                message:
                  'Keydown Enter listener triggers submission/action without checking event.isComposing or event.keyCode === 229 for IME composition safety',
              };
            }
          }
        }
      }
    }
  }

  // If all found Enter checks were guarded by Ctrl/Meta modifiers, do not flag!
  if (foundModifierGuardedEnter) {
    return null;
  }

  return null;
}

/**
 * Resolves a function node if the expression is an identifier referring to a local function.
 */
function resolveHandlerFunction(fnExpr: Node): Node | null {
  const unwrapped = unwrapExpression(fnExpr);
  if (
    Node.isArrowFunction(unwrapped) ||
    Node.isFunctionExpression(unwrapped)
  ) {
    return unwrapped;
  }

  if (Node.isIdentifier(unwrapped)) {
    const name = unwrapped.getText();
    let current: Node | undefined = unwrapped.getParent();
    while (current) {
      if (Node.isSourceFile(current) || Node.isBlock(current)) {
        for (const stmt of current.getStatements()) {
          if (Node.isFunctionDeclaration(stmt) && stmt.getName() === name) {
            return stmt;
          }
          if (Node.isVariableStatement(stmt)) {
            for (const decl of stmt.getDeclarationList().getDeclarations()) {
              if (decl.getName() === name) {
                const init = decl.getInitializer();
                if (init) {
                  return unwrapExpression(init);
                }
              }
            }
          }
        }
      }
      current = current.getParent();
    }
  }

  return null;
}

/**
 * Checks CallExpression for keydown event listener registration.
 */
function matchKeydownCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());

  if (Node.isPropertyAccessExpression(expr)) {
    const receiver = unwrapExpression(expr.getExpression());
    if (Node.isIdentifier(receiver)) {
      if (hasAriaButtonRoleAssignment(receiver, receiver.getText())) {
        return null;
      }
    } else if (Node.isCallExpression(receiver)) {
      const callArgs = receiver.getArguments();
      if (callArgs.length > 0) {
        const firstArg = unwrapExpression(callArgs[0]);
        if (Node.isStringLiteral(firstArg)) {
          const selectorText = firstArg.getLiteralValue().toLowerCase();
          if (/role\s*=\s*['"]?(?:button|menuitem|tab|link|switch|checkbox|option)\b/i.test(selectorText)) {
            return null;
          }
        }
      }
    }
  }

  // 1. addEventListener('keydown', handler)
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'addEventListener') {
    const args = callExpr.getArguments();
    if (args.length >= 2) {
      const eventArg = unwrapExpression(args[0]);
      if (Node.isStringLiteral(eventArg) && eventArg.getLiteralValue() === 'keydown') {
        const handler = resolveHandlerFunction(args[1]);
        if (handler) {
          return checkHandlerForUnsafeEnter(handler, callExpr.getStartLineNumber());
        }
      }
    }
  }

  // 2. $(...).on('keydown', handler) or $(...).on('keydown.namespace', handler)
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'on') {
    const args = callExpr.getArguments();
    if (args.length >= 2) {
      const eventArg = unwrapExpression(args[0]);
      if (Node.isStringLiteral(eventArg)) {
        const val = eventArg.getLiteralValue();
        if (val === 'keydown' || val.startsWith('keydown.')) {
          const handlerArg = args.length >= 3 ? args[2] : args[1];
          const handler = resolveHandlerFunction(handlerArg);
          if (handler) {
            return checkHandlerForUnsafeEnter(handler, callExpr.getStartLineNumber());
          }
        }
      }
    }
  }

  // 3. $(...).keydown(handler)
  if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'keydown') {
    const args = callExpr.getArguments();
    if (args.length >= 1) {
      const handler = resolveHandlerFunction(args[0]);
      if (handler) {
        return checkHandlerForUnsafeEnter(handler, callExpr.getStartLineNumber());
      }
    }
  }

  return null;
}

/**
 * Checks JSX attributes like onKeyDown={...}.
 */
function matchJsxKeydown(jsxAttr: JsxAttribute): AnalyzerMatch | null {
  const name = jsxAttr.getNameNode().getText();
  if (name !== 'onKeyDown' && name !== 'onkeydown') {
    return null;
  }

  const attributesContainer = jsxAttr.getParent();
  if (attributesContainer) {
    for (const siblingAttr of attributesContainer.getChildrenOfKind(SyntaxKind.JsxAttribute)) {
      if (siblingAttr.getNameNode().getText() === 'role') {
        const init = siblingAttr.getInitializer();
        if (init && Node.isStringLiteral(init)) {
          if (ARIA_BUTTON_ROLES.has(init.getLiteralValue().toLowerCase())) {
            return null;
          }
        }
      }
    }
  }

  const init = jsxAttr.getInitializer();
  if (!init || !Node.isJsxExpression(init)) {
    return null;
  }

  const expr = init.getExpression();
  if (!expr) {
    return null;
  }

  const handler = resolveHandlerFunction(expr);
  if (handler) {
    return checkHandlerForUnsafeEnter(handler, jsxAttr.getStartLineNumber());
  }

  return null;
}

/**
 * Checks binary assignment: element.onkeydown = handler
 */
function matchOnKeydownAssignment(sourceFile: SourceFile): AnalyzerMatch[] {
  const matches: AnalyzerMatch[] = [];
  const assignments = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);

  for (const assign of assignments) {
    if (assign.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
      continue;
    }
    const left = unwrapExpression(assign.getLeft());
    if (Node.isPropertyAccessExpression(left) && left.getName() === 'onkeydown') {
      const receiver = unwrapExpression(left.getExpression());
      if (Node.isIdentifier(receiver)) {
        if (hasAriaButtonRoleAssignment(receiver, receiver.getText())) {
          continue;
        }
      }
      const right = unwrapExpression(assign.getRight());
      const handler = resolveHandlerFunction(right);
      if (handler) {
        const match = checkHandlerForUnsafeEnter(handler, assign.getStartLineNumber());
        if (match) {
          matches.push(match);
        }
      }
    }
  }

  return matches;
}

export const imeSafeEnterSubmitMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['keydown', 'onkeydown', 'onKeyDown'],
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchKeydownCall(callExpr);
      if (match && !reportedLines.has(match.line)) {
        reportedLines.add(match.line);
        matches.push(match);
      }
    }

    const jsxAttributes = sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute);
    for (const jsxAttr of jsxAttributes) {
      const match = matchJsxKeydown(jsxAttr);
      if (match && !reportedLines.has(match.line)) {
        reportedLines.add(match.line);
        matches.push(match);
      }
    }

    const assignMatches = matchOnKeydownAssignment(sourceFile);
    for (const match of assignMatches) {
      if (!reportedLines.has(match.line)) {
        reportedLines.add(match.line);
        matches.push(match);
      }
    }

    return matches;
  },
};

export const imeSafeEnterSubmitRule: AnalyzerRule = {
  id: 'ime-safe-enter-submit',
  guideId: 'ime-safe-enter-submit',
  guideHash: IME_SAFE_ENTER_SUBMIT_GUIDE_HASH,
  summary:
    'Flag keydown event listeners on inputs or textareas intercepting Enter (keyCode 13 or key "Enter") to submit forms, send messages, or trigger actions without checking event.isComposing or event.keyCode === 229, breaking IME input in CJK languages.',
  matcher: imeSafeEnterSubmitMatcher,
  phase2Rubric: {
    keepWhen: [
      'Keydown event listeners on inputs or textareas checking event.key === "Enter" or event.keyCode === 13 to trigger submission, search, or message sending without checking event.isComposing or event.keyCode === 229.',
      'Custom enter-to-submit implementations intercepting Enter to call form.submit(), form.requestSubmit(), or trigger a click on a submit button without IME composition gating.',
    ],
    dropWhen: [
      'Keyup or keypress event listeners (composition has already ended by keyup).',
      'Handlers that check event.isComposing or event.keyCode === 229.',
      'Handlers strictly requiring modifier keys (Ctrl+Enter or Cmd+Enter) where IME character selection is not triggered.',
      'Native form submit events or standard inputs inside a form with no custom Enter keydown listener (native Enter submission handles IME automatically).',
      'Global document-level hotkeys for non-text interactions (e.g. game controls, dialog dismissal, modal escape/enter).',
    ],
  },
};

export const imeSafeEnterSubmitRules: readonly AnalyzerRule[] = [
  imeSafeEnterSubmitRule,
];
