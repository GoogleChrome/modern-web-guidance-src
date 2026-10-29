import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  matchEventListenerCall,
  resolveCallableNode,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const CARD_GUIDE_HASH = 'f304675882cb';

const CARD_SELECTOR_RE = /\bcards?\b|card[-_]/i;

const CARD_NAVIGATION_RE =
  /\b(?:window\.)?location(?:\.href|\.assign|\.replace)?\b|\.querySelector\s*\(\s*['"]a[^'"]*['"]\s*\)\s*(?:\?\.)?\s*\.click\s*\(/;

const CARD_HEIGHT_READ_RE =
  /\b(?:offsetHeight|clientHeight|scrollHeight|getBoundingClientRect\s*\(\s*\)\s*\.height)\b/;

const CARD_CLOSEST_RE = /\.closest\s*\(\s*['"][^'"]*card/i;

function matchCardClickNavigation(callExpr: CallExpression): string | null {
  const listener = matchEventListenerCall(callExpr, ['click']);
  if (!listener) {
    return null;
  }
  const targetText = listener.targetNode?.getText() ?? '';
  const handlerText = listener.handlerNode.getText();
  if (handlerText.length > 3500) {
    return null;
  }
  if (!CARD_SELECTOR_RE.test(targetText) && !CARD_CLOSEST_RE.test(handlerText)) {
    return null;
  }
  if (!CARD_NAVIGATION_RE.test(handlerText)) {
    return null;
  }
  return 'JavaScript click listener on a card container forwards navigation via window.location or .click(); use a native <a class="card-link"> inside the card heading with a stretched ::after overlay (position: absolute; inset: 0) to preserve native link semantics.';
}

function matchEqualHeightCardSync(fnNode: Node): Node | null {
  const text = fnNode.getText();
  if (text.length > 3500 || !CARD_SELECTOR_RE.test(text)) {
    return null;
  }
  if (!CARD_HEIGHT_READ_RE.test(text) || !text.includes('Math.max')) {
    return null;
  }

  let heightAssignNode: Node | null = null;
  fnNode.forEachDescendant((child) => {
    if (
      heightAssignNode ||
      !Node.isBinaryExpression(child) ||
      child.getOperatorToken().getKind() !== SyntaxKind.EqualsToken
    ) {
      return;
    }
    const left = unwrapExpression(child.getLeft());
    if (Node.isPropertyAccessExpression(left)) {
      const leftObj = left.getExpression();
      if (
        (left.getName() === 'height' || left.getName() === 'minHeight') &&
        Node.isPropertyAccessExpression(leftObj) &&
        leftObj.getName() === 'style'
      ) {
        heightAssignNode = child;
      }
    }
  });

  return heightAssignNode;
}

export const cardJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    ['matchHeight', '.card'],
    ['matchHeight', 'Math.max', 'click'],
  ],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (
      !ctx.fileContent.includes('matchHeight') &&
      !ctx.fileContent.includes('Math.max') &&
      !ctx.fileContent.includes('click')
    ) {
      return [];
    }
    const matches: AnalyzerMatch[] = [];
    const reportedLines = new Set<number>();
    let matchHeightReported = false;

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const expr = unwrapExpression(node.getExpression());
        const calleeName = Node.isPropertyAccessExpression(expr)
          ? expr.getName()
          : '';

        if (
          calleeName === 'matchHeight' &&
          Node.isPropertyAccessExpression(expr) &&
          CARD_SELECTOR_RE.test(expr.getExpression().getText())
        ) {
          const line = node.getStartLineNumber();
          if (!matchHeightReported && !reportedLines.has(line)) {
            matchHeightReported = true;
            reportedLines.add(line);
            matches.push({
              line,
              message:
                'JavaScript matchHeight() equal-height card synchronization detected; use CSS Grid with grid-template-rows: subgrid so card regions align across rows natively without layout thrashing.',
            });
          }
          return;
        }

        const clickMsg = matchCardClickNavigation(node);
        if (clickMsg) {
          const line = node.getStartLineNumber();
          if (!reportedLines.has(line)) {
            reportedLines.add(line);
            matches.push({
              line,
              message: clickMsg,
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
        const heightAssign = matchEqualHeightCardSync(resolveCallableNode(node));
        if (heightAssign) {
          const line = heightAssign.getStartLineNumber();
          if (!reportedLines.has(line)) {
            reportedLines.add(line);
            matches.push({
              line,
              message:
                'Manual JavaScript card height measurement (Math.max + style.height/minHeight) detected; use CSS Grid grid-template-rows: subgrid so cards in a row share track heights declaratively.',
            });
          }
        }
      }
    });

    return matches;
  },
};

export const cardRule: AnalyzerRule = {
  id: 'card',
  guideId: 'card',
  guideHash: CARD_GUIDE_HASH,
  summary:
    'JavaScript equal-height card synchronization loops and whole-card click listeners should be replaced with CSS subgrid and a stretched .card-link::after overlay.',
  matcher: cardJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript synchronizes equal heights across card elements (matchHeight() on card selectors or measuring offsetHeight/clientHeight with Math.max and assigning inline style.height/minHeight), which can be replaced by CSS subgrid.',
      'A JavaScript click listener on a .card container makes the whole card clickable by setting window.location or calling .querySelector("a").click(), which should be replaced by a native <a class="card-link"> stretched via ::after { position: absolute; inset: 0 }.',
    ],
    dropWhen: [
      'Clicking a button inside a card to open a modal, expand an accordion, or trigger an in-page mutation rather than navigating to a primary link destination.',
      'Dynamic height calculations for virtualized scroll lists, masonry positioning, or collapsible accordion animations.',
      'Generic matchHeight() calls on non-card page sections or grid columns.',
    ],
  },
};

export default [
  cardRule,
] satisfies readonly AnalyzerRule[];
