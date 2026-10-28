import {
  Node,
  type SourceFile,
} from 'ts-morph';
import {
  matchEventListenerCall,
  resolveCallableNode,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SPATIAL_NAVIGATION_GUIDE_HASH = 'ac68db75d1ca';

const FOUR_ARROW_KEYS = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
] as const;

const FIXED_GRID_INDEX_RE =
  /[+-]\s*(?:cols|columns|colCount|columnCount|numCols|numColumns|itemsPerRow|cardsPerRow|gridCols|rowLength|rowSize)\b/i;

const ONE_DIMENSIONAL_WIDGET_RE =
  /role\s*(?:=|===|!==)\s*["']?(?:menu|menuitem|menubar|tablist|listbox|radiogroup|tree|treeitem|slider|spinbutton)/i;

function hasAllFourArrowKeys(text: string): boolean {
  for (const key of FOUR_ARROW_KEYS) {
    if (!text.includes(key)) {
      return false;
    }
  }
  return true;
}

function hasNestedCallableWithFourArrowKeys(fnNode: Node): boolean {
  let found = false;
  fnNode.forEachDescendant((desc) => {
    if (
      Node.isFunctionDeclaration(desc) ||
      Node.isFunctionExpression(desc) ||
      Node.isArrowFunction(desc) ||
      Node.isMethodDeclaration(desc)
    ) {
      if (hasAllFourArrowKeys(desc.getText())) {
        found = true;
      }
    }
  });
  return found;
}

function expandWithClassHelperMethods(fnNode: Node, maxHops: number = 2): string {
  const baseText = fnNode.getText();
  if (baseText.length > 3500) {
    return '';
  }

  const enclosingClass = fnNode.getFirstAncestor(
    (n) => Node.isClassDeclaration(n) || Node.isClassExpression(n),
  );
  if (
    !enclosingClass ||
    (!Node.isClassDeclaration(enclosingClass) && !Node.isClassExpression(enclosingClass))
  ) {
    return baseText;
  }

  const visited = new Set<string>();
  const chunks: string[] = [baseText];
  let frontier: Node[] = [fnNode];

  for (let hop = 0; hop < maxHops && frontier.length > 0; hop++) {
    const nextFrontier: Node[] = [];
    for (const current of frontier) {
      current.forEachDescendant((desc) => {
        if (!Node.isCallExpression(desc)) {
          return;
        }
        const callee = desc.getExpression();
        if (!Node.isPropertyAccessExpression(callee)) {
          return;
        }
        if (callee.getExpression().getText() !== 'this') {
          return;
        }
        const methodName = callee.getName();
        if (visited.has(methodName)) {
          return;
        }
        const targetMethod = enclosingClass
          .getMethods()
          .find((m) => m.getName() === methodName);
        if (!targetMethod) {
          return;
        }
        const methodText = targetMethod.getText();
        if (methodText.length > 3500) {
          return;
        }
        visited.add(methodName);
        chunks.push(methodText);
        nextFrontier.push(targetMethod);
      });
    }
    frontier = nextFrontier;
  }

  return chunks.join('\n');
}

function functionImplementsSpatialArrowFocus(fnNode: Node): boolean {
  const directText = fnNode.getText();
  if (directText.length > 3500) {
    return false;
  }
  if (!hasAllFourArrowKeys(directText)) {
    return false;
  }
  if (hasNestedCallableWithFourArrowKeys(fnNode)) {
    return false;
  }
  const text = expandWithClassHelperMethods(fnNode, 2);
  if (!/\.focus\s*\(/.test(text)) {
    return false;
  }
  if (text.includes('checkVisibility(')) {
    return false;
  }

  const usesBoundingRect = text.includes('getBoundingClientRect(');
  const usesFixedGridMath = FIXED_GRID_INDEX_RE.test(directText);

  return usesBoundingRect || usesFixedGridMath;
}

export const spatialNavigationMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['ArrowRight'],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const content = ctx.fileContent;
    if (
      !content.includes('ArrowUp') ||
      !content.includes('ArrowDown') ||
      !content.includes('ArrowLeft') ||
      !content.includes('ArrowRight') ||
      !content.includes('.focus(')
    ) {
      return [];
    }
    if (content.includes('checkVisibility(')) {
      return [];
    }
    // Carve out files handled by menu.ts or 1D ARIA widgets
    if (
      content.includes('menuitem') ||
      content.includes('role="menu"') ||
      ONE_DIMENSIONAL_WIDGET_RE.test(content)
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const listener = matchEventListenerCall(node, ['keydown']);
        if (listener && functionImplementsSpatialArrowFocus(listener.handlerNode)) {
          const line = node.getStartLineNumber();
          if (!reportedLines.has(line)) {
            reportedLines.add(line);
            reportedLines.add(listener.handlerNode.getStartLineNumber());
            matches.push({
              line,
              message:
                'Custom 2D arrow-key focus navigation uses fixed column-index math or omits checkVisibility() geometry filtering; compute spatial focus candidates from live getBoundingClientRect() geometry filtered by el.checkVisibility(), and only call preventDefault() when a candidate exists.',
            });
          }
          return;
        }
      }

      if (
        Node.isFunctionDeclaration(node) ||
        Node.isFunctionExpression(node) ||
        Node.isArrowFunction(node) ||
        Node.isMethodDeclaration(node)
      ) {
        const resolved = resolveCallableNode(node);
        if (functionImplementsSpatialArrowFocus(resolved)) {
          const line = node.getStartLineNumber();
          if (!reportedLines.has(line)) {
            reportedLines.add(line);
            matches.push({
              line,
              message:
                'Custom 2D arrow-key focus navigation uses fixed column-index math or omits checkVisibility() geometry filtering; compute spatial focus candidates from live getBoundingClientRect() geometry filtered by el.checkVisibility(), and only call preventDefault() when a candidate exists.',
            });
          }
        }
      }
    });

    return matches;
  },
};

export const spatialNavigationRule: AnalyzerRule = {
  id: 'spatial-navigation',
  guideId: 'spatial-navigation',
  guideHash: SPATIAL_NAVIGATION_GUIDE_HASH,
  summary:
    '2D arrow-key spatial focus navigation using fixed column-count index math or unfiltered getBoundingClientRect() geometry should use live getBoundingClientRect() filtered by el.checkVisibility().',
  matcher: spatialNavigationMatcher,
  verifierRubric: {
    keepWhen: [
      'A 2D arrow-key (ArrowUp, ArrowDown, ArrowLeft, ArrowRight) focus handler moves DOM focus (.focus()) across a grid or spatial layout using hardcoded column-count index math (index +/- cols) instead of live getBoundingClientRect() geometry, or reads getBoundingClientRect() without filtering hidden candidates via el.checkVisibility().',
    ],
    dropWhen: [
      '1D arrow-key roving tabindex widgets such as role="tablist", role="menu", role="menubar", role="listbox", role="radiogroup", or role="slider".',
      'Canvas/WebGL 2D game movement controls or spreadsheet cell selection models that do not move DOM element .focus() across responsive layout items.',
    ],
  },
};

export default [
  spatialNavigationRule,
] satisfies readonly AnalyzerRule[];
