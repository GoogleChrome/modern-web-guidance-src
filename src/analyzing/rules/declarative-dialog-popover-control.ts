import {
  Node,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

const TARGET_MODAL_METHODS: ReadonlySet<string> = new Set([
  'showModal',
  'togglePopover',
  'showPopover',
  'hidePopover',
]);

function isModalOrPopoverCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const name = expr.getName();
  if (TARGET_MODAL_METHODS.has(name)) {
    return true;
  }
  if (name === 'modal' || name === 'popover') {
    const args = call.getArguments();
    if (args.length > 0) {
      const firstArg = unwrapExpression(args[0] as Node);
      if (Node.isStringLiteral(firstArg)) {
        const val = firstArg.getLiteralText().toLowerCase();
        if (val === 'show' || val === 'hide' || val === 'toggle') {
          return true;
        }
      }
    }
  }
  if (name === 'close') {
    const objText = expr.getExpression().getText().toLowerCase();
    if (
      objText.includes('dialog') ||
      objText.includes('modal') ||
      objText.includes('popover')
    ) {
      return true;
    }
  }
  return false;
}

function isJqueryModalOrPopoverCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return false;
  }
  const name = expr.getName();
  if (name !== 'modal' && name !== 'popover') {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0] as Node);
  if (Node.isStringLiteral(firstArg)) {
    const val = firstArg.getLiteralText().toLowerCase();
    return val === 'show' || val === 'hide' || val === 'toggle';
  }
  return false;
}

function extractModalCallFromCallback(callbackNode: Node): CallExpression | null {
  const resolved = resolveLocalExpression(callbackNode);
  if (!Node.isArrowFunction(resolved) && !Node.isFunctionExpression(resolved)) {
    return null;
  }

  const allCalls: CallExpression[] = [];
  resolved.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      allCalls.push(node);
    }
  });

  for (const call of allCalls) {
    if (isModalOrPopoverCall(call)) {
      return call;
    }
  }
  return null;
}

const declarativeDialogPopoverControlJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'showModal',
    'togglePopover',
    'showPopover',
    'hidePopover',
    '.modal(',
    'modal("',
    "modal('",
    '.popover(',
    'popover("',
    "popover('",
    'dialog.close',
    'modal.close',
    'popover.close',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const handledCalls = new Set<Node>();

    sourceFile.forEachDescendant((node) => {
      // 1. Check addEventListener('click', ...), $(...).on('click', ...), $(...).click(...)
      if (Node.isCallExpression(node)) {
        const expr = node.getExpression();
        if (!Node.isPropertyAccessExpression(expr)) {
          return;
        }
        const propName = expr.getName();
        let isClick = false;
        let callbackArg: Node | null = null;

        if (propName === 'addEventListener' || propName === 'on') {
          const args = node.getArguments();
          if (args.length >= 2) {
            const first = unwrapExpression(args[0] as Node);
            if (
              Node.isStringLiteral(first) &&
              first.getLiteralText().toLowerCase() === 'click'
            ) {
              isClick = true;
              callbackArg = (args[1] as Node) ?? null;
            }
          }
        } else if (propName === 'click') {
          const args = node.getArguments();
          if (args.length === 1) {
            const first = unwrapExpression(args[0] as Node);
            if (
              Node.isArrowFunction(first) ||
              Node.isFunctionExpression(first) ||
              Node.isIdentifier(first)
            ) {
              isClick = true;
              callbackArg = first;
            }
          }
        }

        if (isClick && callbackArg) {
          if (
            isProtectedByFeatureGuard(node, [
              'commandfor',
              'commandForElement',
              'command',
              'popovertarget',
            ])
          ) {
            return;
          }
          const modalCall = extractModalCallFromCallback(callbackArg);
          if (modalCall) {
            handledCalls.add(modalCall);
            const { line, column } = sourceFile.getLineAndColumnAtPos(
              node.getStart(),
            );
            matches.push({
              line,
              column,
              message:
                'Direct click listener toggles dialog or popover; modernize with declarative Invoker Commands (commandfor="<dialog-id>" command="show-modal").',
            });
          }
        }
      }

      // 2. Check element.onclick = ...
      if (
        Node.isBinaryExpression(node) &&
        node.getOperatorToken().getText() === '='
      ) {
        const left = node.getLeft();
        if (
          Node.isPropertyAccessExpression(left) &&
          left.getName().toLowerCase() === 'onclick'
        ) {
          if (
            isProtectedByFeatureGuard(node, [
              'commandfor',
              'commandForElement',
              'command',
              'popovertarget',
            ])
          ) {
            return;
          }
          const modalCall = extractModalCallFromCallback(node.getRight());
          if (modalCall) {
            handledCalls.add(modalCall);
            const { line, column } = sourceFile.getLineAndColumnAtPos(
              node.getStart(),
            );
            matches.push({
              line,
              column,
              message:
                'Direct click listener toggles dialog or popover; modernize with declarative Invoker Commands (commandfor="<dialog-id>" command="show-modal").',
            });
          }
        }
      }

      // 3. Check standalone jQuery $(...).modal('show'|'hide'|'toggle') or $(...).popover('show'|'hide'|'toggle')
      if (Node.isCallExpression(node) && isJqueryModalOrPopoverCall(node)) {
        if (handledCalls.has(node)) {
          return;
        }
        if (
          isProtectedByFeatureGuard(node, [
            'commandfor',
            'commandForElement',
            'command',
            'popovertarget',
          ])
        ) {
          return;
        }
        const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
        matches.push({
          line,
          column,
          message:
            'Standalone jQuery modal/popover call should be replaced with declarative Invoker Commands (commandfor) or popovertarget.',
        });
      }
    });

    return matches;
  },
};

const declarativeDialogPopoverControlDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector:
    '[data-toggle="modal"], [data-bs-toggle="modal"], [data-toggle="popover"], [data-bs-toggle="popover"], [data-dismiss="modal"], [data-bs-dismiss="modal"], [data-dismiss="popover"], [data-bs-dismiss="popover"]',
  fastTokens: ['data-toggle', 'data-bs-toggle', 'data-dismiss', 'data-bs-dismiss'],
  skipIfHasSpread: true,
  skipIfDynamicAttributes: ['commandfor', 'command', 'popovertarget'],
  matchElement: (element: DomElementView, _ctx: DomMatcherContext) => {
    // 1. Skip if element is already modernized with declarative Invokers or popovertarget
    if (
      element.hasAttribute('commandfor') ||
      element.hasAttribute('popovertarget') ||
      element.hasAttribute('command')
    ) {
      return null;
    }

    const toggle = (
      element.getAttribute('data-toggle') ??
      element.getAttribute('data-bs-toggle') ??
      ''
    ).toLowerCase();

    const dismiss = (
      element.getAttribute('data-dismiss') ??
      element.getAttribute('data-bs-dismiss') ??
      ''
    ).toLowerCase();

    if (toggle === 'modal') {
      return {
        message:
          'Legacy modal trigger uses data-toggle="modal" or data-bs-toggle="modal"; modernize with declarative Invoker Commands (commandfor="<dialog-id>" command="show-modal").',
      };
    }

    if (toggle === 'popover') {
      return {
        message:
          'Legacy popover trigger uses data-toggle="popover" or data-bs-toggle="popover"; modernize with popovertarget="<id>" or commandfor="<id>" command="toggle-popover".',
      };
    }

    if (dismiss === 'modal') {
      return {
        message:
          'Legacy modal close trigger uses data-dismiss="modal" or data-bs-dismiss="modal"; modernize with declarative Invoker Commands (commandfor="<dialog-id>" command="close").',
      };
    }

    if (dismiss === 'popover') {
      return {
        message:
          'Legacy popover close trigger uses data-dismiss="popover" or data-bs-dismiss="popover"; modernize with popovertarget="<id>" or commandfor="<id>" command="hide-popover".',
      };
    }

    return null;
  },
};

export const declarativeDialogPopoverControlRule: AnalyzerRule = {
  id: 'declarative-dialog-popover-control',
  guideId: 'declarative-dialog-popover-control',
  guideHash: '87f6a7ad8849',
  summary:
    'Legacy Bootstrap data-toggle/data-bs-toggle and data-dismiss modal and popover triggers should be modernized with declarative Invoker Commands (commandfor) or popovertarget.',
  matcher: declarativeDialogPopoverControlDomMatcher,
  phase2Rubric: {
    keepWhen: [
      'An HTML or JSX element uses Bootstrap or legacy data-toggle, data-bs-toggle, data-dismiss, or data-bs-dismiss attributes (e.g. data-toggle="modal", data-dismiss="modal", data-bs-dismiss="popover") to open, close, or toggle an overlay or dialog.',
      'A direct button click event listener in JavaScript merely opens, closes, or toggles a dialog or popover via .showModal(), .close(), .togglePopover(), .showPopover(), .hidePopover(), or jQuery .modal()/.popover() without additional domain logic.',
      'A standalone jQuery .modal("show" | "hide" | "toggle") or .popover("show" | "hide" | "toggle") call imperatively controls overlay visibility without declarative Invoker Commands.',
    ],
    dropWhen: [
      'The button or element already uses declarative Invoker Commands (commandfor, command) or popovertarget.',
      'The click handler performs significant domain processing, data validation, or asynchronous network requests before conditionally opening the dialog.',
      'The event listener is properly guarded by a feature detection check for commandfor or commandForElement.',
      'The .close() call belongs to an unrelated API such as WebSocket, Server-Sent Events, FileReader, ReadableStream, or Worker.',
    ],
  },
};

export const declarativeDialogPopoverControlClickListenerRule: AnalyzerRule = {
  id: 'declarative-dialog-popover-control/click-listener',
  guideId: 'declarative-dialog-popover-control',
  guideHash: '87f6a7ad8849',
  summary:
    'Direct button click event listeners calling .showModal(), .close(), or .togglePopover() should be replaced with declarative Invoker Commands (commandfor).',
  matcher: declarativeDialogPopoverControlJsMatcher,
  phase2Rubric: declarativeDialogPopoverControlRule.phase2Rubric,
};

export const declarativeDialogPopoverControlBootstrapRule =
  declarativeDialogPopoverControlRule;

export const declarativeDialogPopoverControlRules: readonly AnalyzerRule[] = [
  declarativeDialogPopoverControlRule,
  declarativeDialogPopoverControlClickListenerRule,
];
