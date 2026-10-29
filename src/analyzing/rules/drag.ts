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
  'draggabilly',
  'react-draggable',
] as const;

const RIGHT_CLICK_BUTTON_REGEX = /(?:\bbutton\s*===?\s*2|\bwhich\s*===?\s*3)\b/;

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

function hasExternalMoveCallback(handlerNode: Node): boolean {
  const start = handlerNode.getStart();
  const end = handlerNode.getEnd();
  let hasExternal = false;
  handlerNode.forEachDescendant((descendant) => {
    if (hasExternal) return;
    if (Node.isCallExpression(descendant)) {
      const matched = matchEventListenerCall(descendant, DRAG_MOVE_EVENTS);
      if (matched) {
        const cb = unwrapExpression(matched.handlerNode);
        if (cb.getStart() >= start && cb.getEnd() <= end) {
          return;
        }
        hasExternal = true;
      }
    }
  });
  return hasExternal;
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
  (pkgName, versionRange, ctx) => {
    const pkgJson = ctx.packageJson;
    if (pkgJson && Object.keys(pkgJson).length > 0) {
      const deps =
        typeof pkgJson.dependencies === 'object' && pkgJson.dependencies !== null
          ? (pkgJson.dependencies as Record<string, unknown>)
          : {};
      if (!Object.prototype.hasOwnProperty.call(deps, pkgName)) {
        return null;
      }
    }

    return `Legacy drag-and-drop library "${pkgName}" (${versionRange}) can be modernized using Pointer Events (pointerdown, pointermove) and setPointerCapture().`;
  },
);

function matchDragStartListener(
  node: CallExpression,
  sourceFile: SourceFile,
): string | null {
  const dragStartMatch = matchEventListenerCall(node, DRAG_START_EVENTS);
  if (!dragStartMatch) {
    return null;
  }

  const firstArgText = node.getArguments()[0]?.getText() ?? '';
  if (/\bclick\b/i.test(firstArgText)) {
    return null;
  }

  if (isNoOpOrPreventDefaultOnlyHandler(dragStartMatch.handlerNode)) {
    return null;
  }

  const handlerText = dragStartMatch.handlerNode.getText();
  if (RIGHT_CLICK_BUTTON_REGEX.test(handlerText)) {
    return null;
  }

  // A genuine drag start handler either reads initial coordinates or registers move/end listeners
  const moveInHandler = hasMoveOrEndListener(dragStartMatch.handlerNode);
  const coordsInHandler = hasCoordinateAccess(dragStartMatch.handlerNode);
  if (!moveInHandler && !coordsInHandler) {
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

  if (!moveInHandler) {
    const scopeLineSpan =
      scope === sourceFile
        ? sourceFile.getEndLineNumber()
        : scope.getEndLineNumber() - scope.getStartLineNumber();
    const maxSpan = scope === sourceFile ? 80 : 120;
    if (scopeLineSpan > maxSpan) {
      return null;
    }
    const scopeText = scope.getText();
    if (RIGHT_CLICK_BUTTON_REGEX.test(scopeText)) {
      return null;
    }
  }

  // Check if this drag start handler or its enclosing scope contains move listeners, coordinate access, and style positioning
  const moveInScope = moveInHandler || hasMoveOrEndListener(scope);
  if (!moveInScope) {
    return null;
  }

  const coordsInScope = coordsInHandler || hasCoordinateAccess(scope);
  if (!coordsInScope) {
    return null;
  }

  const styleInHandler = hasPositionStyleMutation(dragStartMatch.handlerNode);
  if (!moveInHandler && styleInHandler) {
    // One-shot click/mousedown position jump without registering a move listener
    return null;
  }
  if (moveInHandler && !styleInHandler && !hasExternalMoveCallback(dragStartMatch.handlerNode)) {
    return null;
  }
  if (moveInHandler && !styleInHandler && /\.scrollTop\s*=/.test(dragStartMatch.handlerNode.getText())) {
    return null;
  }
  const styleInScope = styleInHandler || hasPositionStyleMutation(scope);
  if (!styleInScope) {
    return null;
  }

  return `Imperative mouse/touch event listeners ('${dragStartMatch.eventName}' with coordinate tracking) used for draggable positioning; modernize using Pointer Events (pointerdown, pointermove) and setPointerCapture().`;
}

export const dragJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    'mousedown',
    'touchstart',
  ],
  shouldSkipFile: (sourceFile) => {
    const text = sourceFile.getText();
    if (text.includes('setPointerCapture')) {
      return true;
    }
    if (!text.includes('mousemove') && !text.includes('touchmove')) {
      return true;
    }
    return false;
  },
  dedupeLines: true,
  featureGuardTokens: POINTER_GUARD_TOKENS,
  matchCall: matchDragStartListener,
});

export const dragPackageRule: AnalyzerRule = {
  id: 'drag/package-drag-drop',
  guideId: 'drag',
  guideHash: DRAG_GUIDE_HASH,
  summary:
    'Flag dependencies on legacy drag packages (draggabilly, react-draggable) that should be replaced with Pointer Events and setPointerCapture.',
  matcher: dragDependencyMatcher,
  verifierRubric: {
    keepWhen: [
      'Projects depending on legacy drag packages like draggabilly or react-draggable for element dragging.',
    ],
    dropWhen: [
      'Pointer Events implementations utilizing setPointerCapture() and pointermove/lostpointercapture.',
      'Native HTML Drag and Drop API usage (dragstart, dragover, drop) for transferring data or files between targets rather than moving floating elements.',
      'Canvas, game loops, or charting libraries tracking cursor position for internal rendering rather than repositioning DOM elements.',
      'Package.json manifests where react-draggable is paired with enterprise data grids (ag-grid), complex tree/resizable component suites, or WebGL/animation editors where a bare package.json dependency cannot be replaced in isolation without refactoring React component lifecycles.',
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
      'Imperative mousedown/mousemove/mouseup or touchstart/touchmove listeners used to drag, pan, zoom, or reposition DOM elements or views by updating style.left, style.top, or style.transform (including standalone element drag handlers, pan/zoom containers, floating panels, dialogs, and custom drag utilities).',
      'Touch or mouse drag handlers tracking coordinates (clientX, clientY, pageX, pageY, touches) and updating element position via inline styles or CSS transforms without setPointerCapture().',
    ],
    dropWhen: [
      'Pointer Events implementations utilizing setPointerCapture() and pointermove/lostpointercapture.',
      'Native HTML Drag and Drop API usage (dragstart, dragover, drop) for transferring data or files between targets rather than moving floating elements.',
      'WebGL 3D scene cameras, game engines, virtual joysticks, or 2D <canvas> pixel-drawing tools calling canvas.getContext("2d" | "webgl") for internal rendering rather than panning or repositioning DOM elements.',
      '1D range sliders, audio/video timeline scrubbers, volume knobs, split-pane resize handles, or swipe-gesture detectors that adjust a single value, dimension, or scroll offset rather than 2D element dragging.',
    ],
  },
};

export default [dragPackageRule, dragJsRule] satisfies readonly AnalyzerRule[];
