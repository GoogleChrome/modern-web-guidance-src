/* oxlint-disable max-lines-per-function, max-depth */
import { Node, SyntaxKind, type CallExpression, type IfStatement, type JsxAttribute, type SourceFile } from 'ts-morph';
import type { AnalyzerMatch, AnalyzerRule, JsMatcherContext, JsRuleMatcher } from '../schema.ts';
import { unwrapExpression } from '../scanners/ast-helpers.ts';

export const IME_SAFE_ENTER_SUBMIT_GUIDE_HASH = '99e3b42fb16a';

// keyCode/which === 13 checks are deliberately absent: the keydown that confirms an IME
// composition reports keyCode 229, so those handlers never fire mid-composition.
const ENTER_CHECK_REGEX =
  /(?:key\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*key|code\s*===?\s*['"]Enter['"]|['"]Enter['"]\s*===?\s*code|case\s+['"]Enter['"])/;

// Same comparisons with a negated operator: `e.key !== 'Enter'`, `'Enter' != e.key`.
const NEGATED_ENTER_CHECK_REGEX =
  /(?:key\s*!==?\s*['"]Enter['"]|['"]Enter['"]\s*!==?\s*key|code\s*!==?\s*['"]Enter['"]|['"]Enter['"]\s*!==?\s*code)/;

const UNSAFE_ENTER_MESSAGE =
  'Keydown Enter listener triggers submission/action without checking event.isComposing or event.keyCode === 229 for IME composition safety';

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
  if (/!\s*\([^)]*\b(?:ctrlKey|metaKey|altKey)\b/.test(condText)) {
    return false;
  }
  const hasPositiveCtrl = /(?:^|[^!.\w])(?:\b[a-zA-Z_$][\w$]*\.)?\bctrlKey\b(?!\s*===?\s*false)/.test(condText);
  const hasPositiveMeta = /(?:^|[^!.\w])(?:\b[a-zA-Z_$][\w$]*\.)?\bmetaKey\b(?!\s*===?\s*false)/.test(condText);
  const hasPositiveAlt = /(?:^|[^!.\w])(?:\b[a-zA-Z_$][\w$]*\.)?\baltKey\b(?!\s*===?\s*false)/.test(condText);
  return hasPositiveCtrl || hasPositiveMeta || hasPositiveAlt;
}

/**
 * Checks if an expression performs an action (invokes something) rather than only
 * suppressing the event (preventDefault / stopPropagation) or returning.
 */
function isActionExpression(exprText: string): boolean {
  if (!exprText.includes('(')) {
    return false;
  }
  return !isSuppressOnlyBranch(exprText);
}

/**
 * Checks if a `&&` expression sits where its right side runs as the handler's action:
 * the body of an arrow/function expression, an expression statement, or a returned
 * value — not inside a condition, where it is a guard rather than the action.
 */
function isInActionPosition(node: Node): boolean {
  let current: Node = node;
  for (;;) {
    const parent = current.getParent();
    if (!parent) {
      return false;
    }
    if (Node.isParenthesizedExpression(parent)) {
      current = parent;
      continue;
    }
    if (
      Node.isBinaryExpression(parent) &&
      parent.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken
    ) {
      current = parent;
      continue;
    }
    if (Node.isArrowFunction(parent) || Node.isFunctionExpression(parent)) {
      return parent.getBody() === current;
    }
    return Node.isExpressionStatement(parent) || Node.isReturnStatement(parent);
  }
}

/**
 * Flattens a `||` chain into its operands; any other expression is a single operand.
 */
function flattenOrOperands(expr: Node): Node[] {
  const unwrapped = unwrapExpression(expr);
  if (
    Node.isBinaryExpression(unwrapped) &&
    unwrapped.getOperatorToken().getKind() === SyntaxKind.BarBarToken
  ) {
    return [...flattenOrOperands(unwrapped.getLeft()), ...flattenOrOperands(unwrapped.getRight())];
  }
  return [unwrapped];
}

/**
 * Flattens a `&&` chain into its operands; any other expression is a single operand.
 */
function flattenAndOperands(expr: Node): Node[] {
  const unwrapped = unwrapExpression(expr);
  if (
    Node.isBinaryExpression(unwrapped) &&
    unwrapped.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken
  ) {
    return [...flattenAndOperands(unwrapped.getLeft()), ...flattenAndOperands(unwrapped.getRight())];
  }
  return [unwrapped];
}

/**
 * Checks if an operand is a negated Enter comparison: `e.key !== 'Enter'`,
 * `e.key != 'Enter'`, or `!(e.key === 'Enter')`.
 */
function isNegatedEnterCheck(operand: Node): boolean {
  const node = unwrapExpression(operand);
  if (Node.isBinaryExpression(node)) {
    const kind = node.getOperatorToken().getKind();
    if (
      kind === SyntaxKind.ExclamationEqualsToken ||
      kind === SyntaxKind.ExclamationEqualsEqualsToken
    ) {
      return NEGATED_ENTER_CHECK_REGEX.test(node.getText());
    }
    return false;
  }
  if (
    Node.isPrefixUnaryExpression(node) &&
    node.getOperatorToken() === SyntaxKind.ExclamationToken
  ) {
    return ENTER_CHECK_REGEX.test(unwrapExpression(node.getOperand()).getText());
  }
  return false;
}

/**
 * Checks if an early-return guard operand forces a modifier key for the action to run:
 * `!e.ctrlKey` (or `e.ctrlKey === false`) means the action only runs with Ctrl held.
 */
function isModifierRequiredOperand(operand: Node): boolean {
  const text = operand.getText();
  if (/!\s*(?:[a-zA-Z_$][\w$]*\.)?\b(?:ctrlKey|metaKey|altKey)\b/.test(text)) {
    return true;
  }
  return /\b(?:ctrlKey|metaKey|altKey)\b\s*===?\s*false\b/.test(text);
}

/**
 * Finds the statement after an early-return `if` in the same block, when it performs
 * an action (calls something that is not just event suppression). Returns null when
 * there is no such statement, or the next statement is control flow the other checks
 * already cover.
 */
function nextActionStatement(ifStmt: IfStatement): Node | null {
  const parent = ifStmt.getParent();
  if (!parent || (!Node.isBlock(parent) && !Node.isSourceFile(parent))) {
    return null;
  }
  const statements = parent.getStatements();
  const index = statements.indexOf(ifStmt);
  if (index < 0 || index + 1 >= statements.length) {
    return null;
  }
  const next = statements[index + 1];
  if (
    Node.isIfStatement(next) ||
    Node.isSwitchStatement(next) ||
    Node.isReturnStatement(next) ||
    Node.isForStatement(next) ||
    Node.isWhileStatement(next) ||
    Node.isDoStatement(next) ||
    Node.isTryStatement(next) ||
    Node.isThrowStatement(next)
  ) {
    return null;
  }
  if (next.getDescendantsOfKind(SyntaxKind.CallExpression).length === 0) {
    return null;
  }
  if (isSuppressOnlyBranch(next.getText())) {
    return null;
  }
  return next;
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

  // Check if handler contains an Enter check, positive (`=== 'Enter'`) or negated
  // (`!== 'Enter'` in an early-return guard)
  if (
    !ENTER_CHECK_REGEX.test(handlerText) &&
    !NEGATED_ENTER_CHECK_REGEX.test(handlerText)
  ) {
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

  // Look for logical-AND shorthand: `e.key === 'Enter' && onSearch()` runs the action
  // on the Enter that commits an IME candidate, exactly like the `if` form above.
  for (const binary of handler.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
    if (binary.getOperatorToken().getKind() !== SyntaxKind.AmpersandAmpersandToken) {
      continue;
    }
    // Only the outermost `&&` of a chain: a node that is the left operand of a
    // parent `&&` is covered when that parent is examined.
    const parent = binary.getParent();
    if (
      parent &&
      Node.isBinaryExpression(parent) &&
      parent.getOperatorToken().getKind() === SyntaxKind.AmpersandAmpersandToken &&
      parent.getLeft() === binary
    ) {
      continue;
    }
    if (!isInActionPosition(binary)) {
      continue;
    }
    // The action is the last operand of the `&&` chain; it runs only when every
    // earlier operand holds, so any Enter comparison among them gates the action.
    const operands = flattenAndOperands(binary);
    const action = operands[operands.length - 1];
    if (!action || operands.length < 2) {
      continue;
    }
    if (
      !operands
        .slice(0, -1)
        .some((operand) => ENTER_CHECK_REGEX.test(operand.getText()))
    ) {
      continue;
    }
    const shorthandText = binary.getText();
    if (
      requiresCtrlOrMetaModifier(shorthandText) ||
      SPACE_OR_BUTTON_KEY_REGEX.test(shorthandText)
    ) {
      continue;
    }
    if (!isActionExpression(action.getText())) {
      continue;
    }
    return {
      line: binary.getStartLineNumber(),
      message: UNSAFE_ENTER_MESSAGE,
    };
  }

  // Look for negated early returns: `if (e.key !== 'Enter' || busy) return; onSubmit();`
  // runs the action on Enter just as the `if` form does, with the check inverted.
  for (const ifStmt of ifStatements) {
    if (ifStmt.getElseStatement()) {
      continue;
    }
    const operands = flattenOrOperands(ifStmt.getExpression());
    if (!operands.some((operand) => isNegatedEnterCheck(operand))) {
      continue;
    }
    if (operands.some((operand) => isModifierRequiredOperand(operand))) {
      continue;
    }
    if (SPACE_OR_BUTTON_KEY_REGEX.test(ifStmt.getExpression().getText())) {
      continue;
    }
    const thenText = ifStmt.getThenStatement().getText();
    if (!/\breturn\b/.test(thenText) || !isSuppressOnlyBranch(thenText)) {
      continue;
    }
    if (!nextActionStatement(ifStmt)) {
      continue;
    }
    return {
      line: ifStmt.getStartLineNumber(),
      message: UNSAFE_ENTER_MESSAGE,
    };
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
    ["'Enter'", '"Enter"'],
    ['key', 'code', 'case '],
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (ctx.filePath && TEST_FILE_PATH_REGEX.test(ctx.filePath)) {
      return [];
    }
    if (
      ctx.fileContent &&
      !ENTER_CHECK_REGEX.test(ctx.fileContent) &&
      !NEGATED_ENTER_CHECK_REGEX.test(ctx.fileContent)
    ) {
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
