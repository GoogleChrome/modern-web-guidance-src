import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';
import {
  matchEventListenerCall,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';

export const DRAG_GUIDE_HASH = '9b55b34dd53b';

const TARGET_DRAG_PACKAGES = [
  'interactjs',
  'draggabilly',
  'react-draggable',
  'dragula',
] as const;

const POINTER_GUARD_TOKENS = [
  'setPointerCapture',
  'pointerId',
  'pointerdown',
  'PointerEvent',
  'onpointerdown',
] as const;

const DRAG_START_EVENTS = ['mousedown', 'touchstart'] as const;
const DRAG_MOVE_EVENTS = ['mousemove', 'touchmove', 'mouseup', 'touchend'] as const;
const COORDINATE_PROPERTIES = new Set([
  'clientX',
  'clientY',
  'pageX',
  'pageY',
  'screenX',
  'screenY',
  'offsetX',
  'offsetY',
  'touches',
  'changedTouches',
  'movementX',
  'movementY',
  'deltaX',
  'deltaY',
]);
const POSITION_STYLE_PROPERTIES = new Set(['left', 'top', 'transform']);

function hasCoordinateAccess(scopeNode: Node): boolean {
  let found = false;
  scopeNode.forEachDescendant((descendant) => {
    if (found) return;
    if (Node.isPropertyAccessExpression(descendant)) {
      if (COORDINATE_PROPERTIES.has(descendant.getName())) {
        found = true;
      }
    }
  });
  return found;
}

function hasPositionStyleMutation(scopeNode: Node): boolean {
  let found = false;
  scopeNode.forEachDescendant((descendant) => {
    if (found) return;

    // 1. Assignment to el.style.left / top / transform
    if (Node.isBinaryExpression(descendant)) {
      if (descendant.getOperatorToken().getKind() === SyntaxKind.EqualsToken) {
        const left = unwrapExpression(descendant.getLeft());
        if (Node.isPropertyAccessExpression(left)) {
          const propName = left.getName();
          if (POSITION_STYLE_PROPERTIES.has(propName)) {
            const inner = unwrapExpression(left.getExpression());
            if (Node.isPropertyAccessExpression(inner) && inner.getName() === 'style') {
              found = true;
              return;
            }
          }
        }
      }
    }

    // 2. Call to el.style.setProperty('left' | 'top' | 'transform', ...)
    if (Node.isCallExpression(descendant)) {
      const expr = unwrapExpression(descendant.getExpression());
      if (Node.isPropertyAccessExpression(expr)) {
        const methodName = expr.getName();
        if (methodName === 'setProperty') {
          const inner = unwrapExpression(expr.getExpression());
          if (Node.isPropertyAccessExpression(inner) && inner.getName() === 'style') {
            const callArgs = descendant.getArguments();
            const firstArg = callArgs[0];
            if (firstArg) {
              const first = unwrapExpression(firstArg);
              if (Node.isStringLiteral(first) && POSITION_STYLE_PROPERTIES.has(first.getLiteralText())) {
                found = true;
                return;
              }
            }
          }
        }

        // jQuery .css('left', ...) or .css({ left: ... })
        if (methodName === 'css') {
          const args = descendant.getArguments();
          const firstArg = args[0];
          if (args.length >= 2 && firstArg) {
            const first = unwrapExpression(firstArg);
            if (Node.isStringLiteral(first) && POSITION_STYLE_PROPERTIES.has(first.getLiteralText())) {
              found = true;
              return;
            }
          } else if (args.length === 1 && firstArg) {
            const first = unwrapExpression(firstArg);
            if (Node.isObjectLiteralExpression(first)) {
              for (const prop of first.getProperties()) {
                if (Node.isPropertyAssignment(prop)) {
                  const propName = prop.getName();
                  if (POSITION_STYLE_PROPERTIES.has(propName)) {
                    found = true;
                    return;
                  }
                }
              }
            }
          }
        }
      }
    }
  });

  return found;
}

function hasMoveOrEndListener(scopeNode: Node): boolean {
  let found = false;
  scopeNode.forEachDescendant((descendant) => {
    if (found) return;
    if (Node.isCallExpression(descendant)) {
      const matched = matchEventListenerCall(descendant, DRAG_MOVE_EVENTS);
      if (matched) {
        found = true;
      }
    }
  });
  return found;
}

function isNoOpOrPreventDefaultOnlyHandler(handlerNode: Node): boolean {
  if (hasCoordinateAccess(handlerNode)) {
    return false;
  }
  if (hasPositionStyleMutation(handlerNode)) {
    return false;
  }
  if (hasMoveOrEndListener(handlerNode)) {
    return false;
  }

  let bodyNode: Node | undefined;
  if (
    Node.isArrowFunction(handlerNode) ||
    Node.isFunctionExpression(handlerNode) ||
    Node.isFunctionDeclaration(handlerNode)
  ) {
    bodyNode = handlerNode.getBody();
  }

  if (!bodyNode) {
    return true;
  }

  const bodyText = bodyNode.getText();
  const stripped = bodyText
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '')
    .replace(/(?:e|event|evt)\s*\.\s*(?:preventDefault|stopPropagation|stopImmediatePropagation)\s*\(\s*\)/g, '')
    .replace(/\breturn\s*(?:false|true)?\s*;?/g, '')
    .replace(/[{};,\s]/g, '');

  return stripped.length === 0;
}

export const dragDependencyMatcher: DependencyRuleMatcher = createDependencyMatcher(
  TARGET_DRAG_PACKAGES,
  (pkgName, versionRange) =>
    `Legacy drag-and-drop library "${pkgName}" (${versionRange}) can be modernized using Pointer Events (pointerdown, pointermove) and setPointerCapture().`,
);

function matchDragStartListener(
  node: CallExpression,
  sourceFile: SourceFile,
): string | null {
  const dragStartMatch = matchEventListenerCall(node, DRAG_START_EVENTS);
  if (!dragStartMatch) {
    return null;
  }

  if (isNoOpOrPreventDefaultOnlyHandler(dragStartMatch.handlerNode)) {
    return null;
  }

  // Find enclosing functional scope or class
  let scope: Node = node;
  let parent: Node | undefined = node.getParent();
  while (parent && !Node.isSourceFile(parent)) {
    if (
      Node.isFunctionDeclaration(parent) ||
      Node.isFunctionExpression(parent) ||
      Node.isArrowFunction(parent) ||
      Node.isMethodDeclaration(parent) ||
      Node.isClassDeclaration(parent)
    ) {
      scope = parent;
      break;
    }
    parent = parent.getParent();
  }

  if (scope === node) {
    scope = sourceFile;
  }

  // Check if this drag start handler or its enclosing scope contains move listeners, coordinate access, and style positioning
  const moveInHandler = hasMoveOrEndListener(dragStartMatch.handlerNode);
  const moveInScope = hasMoveOrEndListener(scope);
  if (!moveInHandler && !moveInScope) {
    return null;
  }

  const coordsInHandler = hasCoordinateAccess(dragStartMatch.handlerNode);
  const coordsInScope = hasCoordinateAccess(scope);
  if (!coordsInHandler && !coordsInScope) {
    return null;
  }

  const styleInHandler = hasPositionStyleMutation(dragStartMatch.handlerNode);
  const styleInScope = hasPositionStyleMutation(scope);
  if (!styleInHandler && !styleInScope) {
    return null;
  }

  return `Imperative mouse/touch event listeners ('${dragStartMatch.eventName}' with coordinate tracking) used for draggable positioning; modernize using Pointer Events (pointerdown, pointermove) and setPointerCapture().`;
}

export const dragJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    'mousedown',
    'touchstart',
    'mousemove',
    'touchmove',
    'clientX',
    'clientY',
    'pageX',
    'pageY',
  ],
  shouldSkipFile: (sourceFile) => sourceFile.getText().includes('setPointerCapture'),
  dedupeLines: true,
  featureGuardTokens: POINTER_GUARD_TOKENS,
  matchCall: matchDragStartListener,
});

export const dragPackageRule: AnalyzerRule = {
  id: 'drag/package-drag-drop',
  guideId: 'drag',
  guideHash: DRAG_GUIDE_HASH,
  summary:
    'Flag dependencies on legacy drag packages (interactjs, draggabilly, react-draggable, dragula) that should be replaced with Pointer Events and setPointerCapture.',
  matcher: dragDependencyMatcher,
  verifierRubric: {
    keepWhen: [
      'Projects depending on legacy drag packages like interactjs, draggabilly, react-draggable, or dragula for element dragging.',
    ],
    dropWhen: [
      'Pointer Events implementations utilizing setPointerCapture() and pointermove/lostpointercapture.',
      'Native HTML Drag and Drop API usage (dragstart, dragover, drop) for transferring data or files between targets rather than moving floating elements.',
      'Canvas, game loops, or charting libraries tracking cursor position for internal rendering rather than repositioning DOM elements.',
    ],
  },
};

export const dragJsRule: AnalyzerRule = {
  id: 'drag/js-mouse-touch-drag',
  guideId: 'drag',
  guideHash: DRAG_GUIDE_HASH,
  summary:
    'Flag legacy mousedown/mousemove or touchstart/touchmove drag loops updating style.left/top/transform instead of using modern Pointer Events and setPointerCapture.',
  matcher: dragJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Draggable floating panels, palettes, toolbars, inspectors, or dialogs using imperative mousedown/mousemove/mouseup or touchstart/touchmove listeners to update style.left/top/transform.',
    ],
    dropWhen: [
      'Pointer Events implementations utilizing setPointerCapture() and pointermove/lostpointercapture.',
      'Native HTML Drag and Drop API usage (dragstart, dragover, drop) for transferring data or files between targets rather than moving floating elements.',
      'Canvas, game loops, or charting libraries tracking cursor position for internal rendering rather than repositioning DOM elements.',
    ],
  },
};

export default [dragPackageRule, dragJsRule] satisfies readonly AnalyzerRule[];
