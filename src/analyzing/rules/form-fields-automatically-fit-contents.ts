import {
  Node,
  SyntaxKind,
  type BinaryExpression,
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
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const FORM_FIELDS_AUTOMATICALLY_FIT_GUIDE_HASH = '54a6341c988f';

const FEATURE_GUARD_TOKENS = [
  'field-sizing',
  'fieldSizing',
] as const;

const INPUT_EVENTS = new Set([
  'input',
  'keyup',
  'keydown',
  'change',
  'text',
]);

const FORM_FIELD_KEYWORDS = [
  'textarea',
  'tarea',
  'input',
  'autogrow',
  'autosize',
  'autoexpand',
  'adjust_height',
  'adjustheight',
  'resizetextarea',
  'field',
  'editor',
] as const;

const NON_FORM_CONTAINER_KEYWORDS = [
  'dialog',
  'modal',
  'canvas',
  'virtual',
  'window',
  'table',
  'chart',
  'thumb',
  'scrollbar',
] as const;

function isAutosizeCall(call: CallExpression): boolean {
  const expr = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(expr)) {
    return expr.getText() === 'autosize';
  }
  if (Node.isPropertyAccessExpression(expr)) {
    return expr.getName() === 'autosize';
  }
  return false;
}

function isStyleDimensionAssignment(node: BinaryExpression): boolean {
  if (node.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return false;
  }
  const left = unwrapExpression(node.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return false;
  }
  const prop = left.getName();
  if (prop !== 'height' && prop !== 'width') {
    return false;
  }
  const targetObj = unwrapExpression(left.getExpression());
  if (!Node.isPropertyAccessExpression(targetObj)) {
    return false;
  }
  return targetObj.getName() === 'style';
}

function refersToScrollDimension(node: Node): boolean {
  const text = node.getText();
  return text.includes('scrollHeight') || text.includes('scrollWidth');
}

function isResetValue(node: Node): boolean {
  const text = unwrapExpression(node).getText().replace(/['"]/g, '').trim().toLowerCase();
  return text === 'auto' || text === '0px' || text === '1px' || text === '0' || text === '';
}

function expressionDerivesFromScrollDimension(node: Node): boolean {
  if (refersToScrollDimension(node)) {
    return true;
  }
  let found = false;
  node.forEachDescendant((desc) => {
    if (found) {
      return;
    }
    if (Node.isIdentifier(desc)) {
      const resolved = resolveLocalExpression(desc);
      if (refersToScrollDimension(resolved)) {
        found = true;
      }
    }
  });
  return found;
}

function isInputEventCall(call: CallExpression): boolean {
  const callExpr = unwrapExpression(call.getExpression());
  if (!Node.isPropertyAccessExpression(callExpr)) {
    return false;
  }
  const method = callExpr.getName();
  if (method !== 'addEventListener' && method !== 'on' && method !== 'bind') {
    return false;
  }
  const args = call.getArguments();
  if (args.length === 0) {
    return false;
  }
  const firstArg = unwrapExpression(args[0] as Node);
  if (!Node.isStringLiteral(firstArg)) {
    return false;
  }
  const eventName = firstArg.getLiteralText().toLowerCase();
  return Array.from(INPUT_EVENTS).some((ev) => eventName.includes(ev));
}

function isEnclosedInInputHandlerOrHelper(node: Node): boolean {
  let current: Node | undefined = node.getParent();
  while (current && !Node.isSourceFile(current)) {
    if (Node.isCallExpression(current) && isInputEventCall(current)) {
      return true;
    }

    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      const name = Node.isFunctionDeclaration(current) || Node.isMethodDeclaration(current)
        ? (current.getName() ?? '').toLowerCase()
        : '';
      if (
        FORM_FIELD_KEYWORDS.some((kw) => name.includes(kw))
      ) {
        return true;
      }
    }

    current = current.getParent();
  }
  return false;
}

function hasPrecedingStyleReset(node: Node): boolean {
  const parent = node.getParent();
  if (!parent) {
    return false;
  }
  let block: Node | undefined = parent;
  while (block && !Node.isBlock(block) && !Node.isSourceFile(block)) {
    block = block.getParent();
  }
  if (!block) {
    return false;
  }

  const blockText = block.getText();
  const assignsAutoOrZero =
    blockText.includes("style.height = 'auto'") ||
    blockText.includes('style.height = "auto"') ||
    blockText.includes("style.height = '0px'") ||
    blockText.includes('style.height = "0px"') ||
    blockText.includes("style.height = '1px'") ||
    blockText.includes('style.height = "1px"') ||
    blockText.includes('style.height = 0') ||
    blockText.includes("style.height = ''");

  return assignsAutoOrZero;
}

function isAutoSizingFormField(node: BinaryExpression): boolean {
  if (!isStyleDimensionAssignment(node)) {
    return false;
  }

  const right = unwrapExpression(node.getRight());
  if (isResetValue(right)) {
    return false;
  }

  if (!expressionDerivesFromScrollDimension(right)) {
    return false;
  }

  const nodeText = node.getText().toLowerCase();
  const isNonForm = NON_FORM_CONTAINER_KEYWORDS.some((kw) =>
    nodeText.includes(kw),
  );
  if (isNonForm) {
    return false;
  }

  const inInputHandler = isEnclosedInInputHandlerOrHelper(node);
  const hasReset = hasPrecedingStyleReset(node);
  const mentionsFormField = FORM_FIELD_KEYWORDS.some((kw) =>
    nodeText.includes(kw),
  );

  return inInputHandler || hasReset || mentionsFormField;
}

const formFieldsAutomaticallyFitContentsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'autosize',
    'scrollHeight',
    'scrollWidth',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) {
          return;
        }

        if (isAutosizeCall(node)) {
          const line = node.getStartLineNumber();
          if (!visitedLines.has(line)) {
            visitedLines.add(line);
            matches.push({
              line,
              message:
                'Library autosize() call auto-expands textarea/input fields; modernize with CSS field-sizing: content.',
            });
          }
        }
      } else if (Node.isBinaryExpression(node)) {
        if (isProtectedByFeatureGuard(node, FEATURE_GUARD_TOKENS)) {
          return;
        }

        if (isAutoSizingFormField(node)) {
          const line = node.getStartLineNumber();
          if (!visitedLines.has(line)) {
            visitedLines.add(line);
            matches.push({
              line,
              message:
                'JavaScript dynamic scrollHeight calculation resizes form field; replace with declarative CSS field-sizing: content.',
            });
          }
        }
      }
    });

    return matches;
  },
};

export const formFieldsAutomaticallyFitContentsRule: AnalyzerRule = {
  id: 'form-fields-automatically-fit-contents',
  guideId: 'form-fields-automatically-fit-contents',
  guideHash: FORM_FIELDS_AUTOMATICALLY_FIT_GUIDE_HASH,
  summary:
    'Imperative JavaScript auto-resizing of textareas and inputs using scrollHeight or autosize() should be replaced with CSS field-sizing: content.',
  matcher: formFieldsAutomaticallyFitContentsMatcher,
  phase2Rubric: {
    keepWhen: [
      'A keyup, input, change, or keydown event listener dynamically recalculates a textarea or text input height/width using scrollHeight or scrollWidth to auto-expand the field as the user types.',
      'A helper function resets .style.height to "auto", "0px", or "1px" and sets it to scrollHeight to fit contents.',
      'The application invokes the autosize() library on a textarea or input collection.',
    ],
    dropWhen: [
      'The code is guarded by a feature query checking CSS.supports("field-sizing", "content") or field-sizing support.',
      'The scrollHeight measurement calculates scrollbar thumb sizes, virtual scroll windowing, or scroll progress in a long document/dialog.',
      'The element being resized is a canvas, iframe, or modal container rather than a form input or textarea.',
    ],
  },
};

export const formFieldsAutomaticallyFitContentsRules: readonly AnalyzerRule[] = [
  formFieldsAutomaticallyFitContentsRule,
];
