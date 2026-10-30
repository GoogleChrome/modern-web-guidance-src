/* oxlint-disable max-lines-per-function, max-depth */
import { Node, SyntaxKind, type CallExpression, type JsxAttribute, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const IME_SAFE_ENTER_SUBMIT_GUIDE_HASH = '0616906d0788';

// keyCode/which === 13 checks are deliberately absent: the keydown that confirms an IME
// composition reports keyCode 229, so those handlers never fire mid-composition.
const ENTER_CHECK_REGEX =
  /(?:key\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*key|code\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*code|case\s+['"]Enter['"])/;

const SPACE_OR_BUTTON_KEY_REGEX =
  /\b(?:Space|Spacebar)\b|['"] ['"]|(?:keyCode|which)\s*===?\s*32\b|\b32\s*===?\s*(?:keyCode|which)/;

const WIDGET_NAVIGATION_KEYS_REGEX =
  /\b(?:ArrowUp|ArrowDown|ArrowLeft|ArrowRight|PageUp|PageDown)\b|(?:keyCode|which)\s*===?\s*(?:32|33|34|37|38|39|40)\b|\b(?:32|33|34|37|38|39|40)\s*===?\s*(?:keyCode|which)|\bcase\s+(?:32|33|34|37|38|39|40)\s*:/;

const SYNTHETIC_KEY_EVENT_REGEX =
  /Event\s*\(\s*['"]key(?:press|down|up)['"]\s*\)/i;

const ARIA_BUTTON_ROLES = new Set([
  'button',
  'menuitem',
  'tab',
  'link',
  'switch',
  'checkbox',
  'option',
]);

const TEST_FILE_PATH_REGEX =
  /(?:^|\/)(?:__tests__|tests?|specs?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/i;

/**
 * Checks if a branch contains only event suppression calls (preventDefault, stopPropagation)
 * and control returns, with no submission or action invocations.
 */
function isSuppressOnlyBranch(branchText: string): boolean {
  const stripped = branchText
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .replace(/(?:e|event|evt)\s*\.\s*(?:preventDefault|stopPropagation|stopImmediatePropagation)\s*\(\s*\)/g, '')
    .replace(/\breturn\s*(?:false|true)?\s*;?/g, '')
    .replace(/\bbreak\s*;?/g, '')
    .replace(/case\s+['"]Enter['"]\s*:/g, '')
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
  const hasPositiveAlt = /(?:^|[^!.\w])(?:e|event|evt)?\.?altKey\b(?!\s*===?\s*false)/.test(condText);
  return hasPositiveCtrl || hasPositiveMeta || hasPositiveAlt;
}

/**
 * Checks a handler function for an Enter key check lacking isComposing / keyCode 229 guards.
 */
function checkHandlerForUnsafeEnter(handler: Node): AnalyzerMatch | null {
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

  // Skip listbox, dropdown, or grid navigation handlers that also handle arrow/space/page keys
  if (WIDGET_NAVIGATION_KEYS_REGEX.test(handlerText)) {
    return null;
  }

  // Check if handler contains an Enter check
  if (!ENTER_CHECK_REGEX.test(handlerText)) {
    return null;
  }

  // Look for IfStatements checking Enter
  const ifStatements = handler.getDescendantsOfKind(SyntaxKind.IfStatement);
  for (const ifStmt of ifStatements) {
    const condText = ifStmt.getExpression().getText();
    if (ENTER_CHECK_REGEX.test(condText)) {
      if (requiresCtrlOrMetaModifier(condText) || SPACE_OR_BUTTON_KEY_REGEX.test(condText)) {
        continue;
      }

      const branchText = ifStmt.getThenStatement().getText();
      if (
        !isSuppressOnlyBranch(branchText) &&
        !SYNTHETIC_KEY_EVENT_REGEX.test(branchText)
      ) {
        return {
          line: ifStmt.getStartLineNumber(),
          message:
            'Keydown Enter listener triggers submission/action without checking event.isComposing or event.keyCode === 229 for IME composition safety',
        };
      }
    }
  }

  // Look for SwitchStatements on event.key with an 'Enter' case
  const switchStatements = handler.getDescendantsOfKind(SyntaxKind.SwitchStatement);
  for (const switchStmt of switchStatements) {
    const exprText = switchStmt.getExpression().getText();
    if (exprText.includes('key')) {
      const caseBlock = switchStmt.getCaseBlock();
      for (const clause of caseBlock.getClauses()) {
        if (Node.isCaseClause(clause)) {
          const caseExprText = clause.getExpression().getText();
          if (caseExprText === "'Enter'" || caseExprText === '"Enter"') {
            const clauseText = clause.getText();
            if (
              !isSuppressOnlyBranch(clauseText) &&
              !SYNTHETIC_KEY_EVENT_REGEX.test(clauseText)
            ) {
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

  return null;
}

/**
 * Resolves a function node if the expression is an identifier referring to a local function.
 */
function resolveHandlerFunction(fnExpr: Node): Node | null {
  const unwrapped = unwrapExpression(fnExpr);
  if (Node.isArrowFunction(unwrapped) || Node.isFunctionExpression(unwrapped)) {
    return unwrapped;
  }
  if (!Node.isIdentifier(unwrapped)) {
    return null;
  }
  const name = unwrapped.getText();
  for (let current: Node | undefined = unwrapped.getParent(); current; current = current.getParent()) {
    if (!Node.isSourceFile(current) && !Node.isBlock(current)) continue;
    for (const stmt of current.getStatements()) {
      if (Node.isFunctionDeclaration(stmt) && stmt.getName() === name) {
        return stmt;
      }
      if (Node.isVariableStatement(stmt)) {
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const init = decl.getName() === name ? decl.getInitializer() : undefined;
          if (init) return unwrapExpression(init);
        }
      }
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
    const receiverText = unwrapExpression(expr.getExpression()).getText();
    const isGlobalTarget =
      receiverText === 'document' ||
      receiverText === 'window' ||
      receiverText === 'globalThis' ||
      receiverText === 'document.body';
    const args = callExpr.getArguments();
    if (args.length >= 2) {
      const eventArg = unwrapExpression(args[0]);
      if (Node.isStringLiteral(eventArg) && eventArg.getLiteralValue() === 'keydown') {
        const handler = resolveHandlerFunction(args[1]);
        if (handler) {
          if (
            isGlobalTarget &&
            !/\b(?:target|srcElement|activeElement|input|textarea|form)\b/i.test(handler.getText())
          ) {
            return null;
          }
          return checkHandlerForUnsafeEnter(handler);
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
            return checkHandlerForUnsafeEnter(handler);
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
        return checkHandlerForUnsafeEnter(handler);
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
    return checkHandlerForUnsafeEnter(handler);
  }

  return null;
}

export const imeSafeEnterSubmitMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['keydown', 'onkeydown', 'onKeyDown'],
    ['Enter'],
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (ctx.filePath && TEST_FILE_PATH_REGEX.test(ctx.filePath)) {
      return [];
    }
    if (ctx.fileContent && !/['"]Enter['"]/.test(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();
    const recordMatch = (match: AnalyzerMatch | null): void => {
      if (match && !reportedLines.has(match.line)) {
        reportedLines.add(match.line);
        matches.push(match);
      }
    };

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      recordMatch(matchKeydownCall(callExpr));
    }

    for (const jsxAttr of sourceFile.getDescendantsOfKind(SyntaxKind.JsxAttribute)) {
      recordMatch(matchJsxKeydown(jsxAttr));
    }

    for (const assign of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (assign.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
        continue;
      }
      const left = unwrapExpression(assign.getLeft());
      if (Node.isPropertyAccessExpression(left) && left.getName() === 'onkeydown') {
        const receiver = unwrapExpression(left.getExpression());
        if (
          Node.isIdentifier(receiver) &&
          hasAriaButtonRoleAssignment(receiver, receiver.getText())
        ) {
          continue;
        }
        const handler = resolveHandlerFunction(assign.getRight());
        if (handler) {
          recordMatch(checkHandlerForUnsafeEnter(handler));
        }
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
    'Flag keydown event listeners on inputs or textareas intercepting Enter (event.key or event.code "Enter") to submit forms, send messages, or trigger actions without checking event.isComposing or event.keyCode === 229, breaking IME input in CJK languages.',
  matcher: imeSafeEnterSubmitMatcher,
  verifierRubric: {
    keepWhen: [
      'Keydown event listeners on inputs or textareas checking event.key === "Enter" or event.code === "Enter" to trigger submission, search, or message sending without checking event.isComposing or event.keyCode === 229.',
      'Custom enter-to-submit implementations intercepting Enter to call form.submit(), form.requestSubmit(), or trigger a click on a submit button without IME composition gating.',
    ],
    dropWhen: [
      'Keyup or keypress event listeners (composition has already ended by keyup).',
      'Handlers that check event.isComposing or event.keyCode === 229.',
      'Handlers that detect Enter only through event.keyCode === 13 or event.which === 13 (the keydown that confirms an IME composition reports keyCode 229, so these never fire mid-composition).',
      'Handlers strictly requiring modifier keys (Ctrl+Enter or Cmd+Enter) where IME character selection is not triggered.',
      'Native form submit events or standard inputs inside a form with no custom Enter keydown listener (native Enter submission handles IME automatically).',
      'Global document-level hotkeys, non-text UI widgets (buttons, menus, tabs, treeviews, dropdowns, modals, media players), or rich-text/code editor newline/indentation handlers rather than text-input submission.',
    ],
  },
};

export default [
  imeSafeEnterSubmitRule,
] satisfies readonly AnalyzerRule[];
