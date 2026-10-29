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

const DELEGATED_ROOT_REGEX = /^(?:(?:window\.)?document(?:\.body)?|window)$/;
const DELEGATED_SELECTOR_REGEX =
  /(?:closest|matches)\s*\(\s*['"][^'"]*(?:button|data-action|data-command)/i;

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
        parent.getNameNode() === child
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
function triggersCustomAction(node: Node, listenerTargetText: string): boolean {
  let hasCustomEventDispatch = false;
  let hasExternalClassList = false;

  node.forEachDescendant((child) => {
    if (Node.isCallExpression(child)) {
      const expr = unwrapExpression(child.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        // Custom event dispatch on target
        if (methodName === 'dispatchEvent') {
          const firstArg = child.getArguments()[0];
          const unwrappedArg = firstArg ? unwrapExpression(firstArg) : undefined;
          if (unwrappedArg && Node.isNewExpression(unwrappedArg)) {
            const ctor = unwrapExpression(unwrappedArg.getExpression()).getText();
            if (ctor === 'CustomEvent' || ctor === 'CommandEvent') {
              hasCustomEventDispatch = true;
            }
          }
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
              classListTarget !== 'e.currentTarget' &&
              classListTarget !== 'event.currentTarget' &&
              classListTarget !== 'btn' &&
              classListTarget !== 'button' &&
              classListTarget !== listenerTargetText
            ) {
              hasExternalClassList = true;
            }
          }
        }
      }
    }
  });

  if (hasCustomEventDispatch) return true;
  return hasExternalClassList && !node.getText().includes('createElement');
}

export const customButtonActionsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['addEventListener'],
    ['click'],
    ['classList', 'dispatchEvent'],
    ['btn', 'Btn', 'button', 'Button', 'data-action', 'data-command'],
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

    // If file already uses commandfor attribute or lacks click listener, skip
    if (
      ctx.fileContent.includes('commandfor=') ||
      ctx.fileContent.includes('commandFor') ||
      !ctx.fileContent.includes('addEventListener') ||
      !ctx.fileContent.includes('click')
    ) {
      return matches;
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const matchedListener = matchEventListenerCall(call, ['click']);
      if (!matchedListener) {
        continue;
      }

      const { targetNode, handlerNode } = matchedListener;

      const targetText = targetNode?.getText() ?? '';
      let isButtonTarget = false;
      if (
        targetNode &&
        (BUTTON_IDENTIFIER_REGEX.test(targetText) ||
          targetText.includes('button') ||
          targetText.includes('btn'))
      ) {
        isButtonTarget = true;
      }

      // Or delegated click on document matching button or data-action / data-command
      const handlerText = handlerNode.getText();
      const isDelegatedButton =
        DELEGATED_ROOT_REGEX.test(targetText) &&
        DELEGATED_SELECTOR_REGEX.test(handlerText);

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

      if (
        referencesTargetElement(handlerNode) &&
        triggersCustomAction(handlerNode, targetText)
      ) {
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

export default [
  customButtonActionsRule,
] satisfies readonly AnalyzerRule[];
