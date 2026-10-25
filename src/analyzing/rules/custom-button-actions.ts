import {
  Node,
  SyntaxKind,
  type SourceFile,
} from 'ts-morph';
import {
  matchEventListenerCall,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CUSTOM_BUTTON_ACTIONS_GUIDE_HASH = 'd627dd5e0cfa';

const BUTTON_IDENTIFIER_REGEX =
  /\b(?:btn|button|spinBtn|toggleBtn|actionBtn|resetBtn|commandBtn)\b/i;

const TARGET_IDENTIFIER_REGEX =
  /\b(?:target|actionTarget|targetEl|element|box|panel|card|output)\b/i;

/**
 * Checks whether an expression references getElementById, querySelector, or a target element.
 */
function referencesTargetElement(node: Node): boolean {
  let found = false;

  node.forEachDescendant((child) => {
    if (found) return;

    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        if (
          methodName === 'getElementById' ||
          methodName === 'querySelector' ||
          methodName === 'closest'
        ) {
          found = true;
          return;
        }
      }
    }

    if (Node.isIdentifier(child)) {
      const name = child.getText();
      const parent = child.getParent();
      if (
        Node.isPropertyAccessExpression(parent) &&
        (parent.getExpression().getText() === 'e' || parent.getExpression().getText() === 'event') &&
        name === 'target'
      ) {
        return;
      }
      if (TARGET_IDENTIFIER_REGEX.test(name) && name !== 'btn' && name !== 'button') {
        found = true;
        return;
      }
    }
  });

  return found;
}

/**
 * Checks whether the handler triggers a custom action or mutates target state.
 */
function triggersCustomAction(node: Node): boolean {
  let found = false;

  node.forEachDescendant((child) => {
    if (found) return;

    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        // Custom event dispatch on target
        if (methodName === 'dispatchEvent') {
          found = true;
          return;
        }
        // classList.toggle / add / remove
        if (methodName === 'toggle' || methodName === 'add' || methodName === 'remove') {
          const receiver = unwrapExpression(expr.getExpression());
          if (Node.isPropertyAccessExpression(receiver) && receiver.getName() === 'classList') {
            const classListTarget = unwrapExpression(receiver.getExpression()).getText();
            if (
              classListTarget !== 'this' &&
              classListTarget !== 'e.target' &&
              classListTarget !== 'event.target' &&
              classListTarget !== 'btn' &&
              classListTarget !== 'button'
            ) {
              found = true;
              return;
            }
          }
        }
      }
    }
  });

  return found;
}

export const customButtonActionsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'addEventListener',
    'click',
    'commandfor',
    'command',
    'data-action',
    'data-command',
    'data-target',
  ] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];

    // Skip test files
    if (
      ctx.filePath.includes('.test.') ||
      ctx.filePath.includes('.spec.') ||
      ctx.filePath.includes('/test/') ||
      ctx.filePath.includes('/tests/')
    ) {
      return matches;
    }

    // If file already uses commandfor attribute, skip
    if (ctx.fileContent.includes('commandfor=') || ctx.fileContent.includes('commandFor')) {
      return matches;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const matchedListener = matchEventListenerCall(call, ['click']);
      if (!matchedListener) {
        continue;
      }

      const { targetNode, handlerNode } = matchedListener;

      // Check whether target of listener is a button
      let isButtonTarget = false;
      if (targetNode) {
        const targetText = targetNode.getText();
        if (
          BUTTON_IDENTIFIER_REGEX.test(targetText) ||
          targetText.includes('button') ||
          targetText.includes('btn')
        ) {
          isButtonTarget = true;
        }
      }

      // Or delegated click on document matching button or data-action / data-target
      const handlerText = handlerNode.getText();
      const isDelegatedButton =
        handlerText.includes('button') ||
        handlerText.includes('data-target') ||
        handlerText.includes('data-action') ||
        handlerText.includes('data-command');

      if (!isButtonTarget && !isDelegatedButton) {
        continue;
      }

      // Check for built-in dialog or popover actions (covered by other rules)
      if (
        handlerText.includes('showModal') ||
        handlerText.includes('showPopover') ||
        handlerText.includes('togglePopover')
      ) {
        continue;
      }

      if (referencesTargetElement(handlerNode) && triggersCustomAction(handlerNode)) {
        matches.push({
          line: call.getStartLineNumber(),
          column: call.getStartLinePos(),
          message:
            'Imperative button click listener invokes action on target element; declarative HTML commandfor and command="--action" with the command event decouple buttons from action handlers.',
        });
      }
    }

    return matches;
  },
};

export const customButtonActionsRule: AnalyzerRule = {
  id: 'custom-button-actions',
  guideId: 'custom-button-actions',
  guideHash: CUSTOM_BUTTON_ACTIONS_GUIDE_HASH,
  summary:
    'Declaratively trigger custom element actions using HTML commandfor and custom command="--action" instead of imperative button click listeners.',
  matcher: customButtonActionsJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperative button click listener querying external target element to trigger custom action or toggle state',
      'Event delegation handling button clicks matching data-command or data-action to dispatch command on target element',
    ],
    dropWhen: [
      'Button already declares commandfor and command attributes',
      'Native invoker commands (show-modal, close, toggle-popover, show-popover, hide-popover)',
      'Form submit or reset button click handling',
      'Button handler only managing internal button state with no target element interaction',
    ],
  },
};

export const customButtonActionsRules: readonly AnalyzerRule[] = [
  customButtonActionsRule,
];
