import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import { unwrapExpression } from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const INTERACTIVE_CONTENT_REVEAL_GUIDE_HASH = 'ed9fe669da39';

const REVEAL_FAST_TOKENS = [
  'maskImage',
  'webkitMaskImage',
  'mask-image',
  '-webkit-mask-image',
] as const;

const REVEAL_GUARD_TOKENS = [
  '@property',
  'registerProperty',
] as const;

const POINTER_EVENT_REGEX = /\b(?:pointermove|mousemove|touchmove|onpointermove|onmousemove)\b/;

const MASK_STYLE_PROPS: ReadonlySet<string> = new Set([
  'maskImage',
  'webkitMaskImage',
  'mask',
  'webkitMask',
]);

const MASK_CSS_PROPS: ReadonlySet<string> = new Set([
  'mask-image',
  '-webkit-mask-image',
  'mask',
  '-webkit-mask',
]);

function matchMaskAssignment(binExpr: BinaryExpression): string | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return null;
  }

  const left = unwrapExpression(binExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return null;
  }

  const propName = left.getName();
  if (!MASK_STYLE_PROPS.has(propName)) {
    return null;
  }

  const receiver = unwrapExpression(left.getExpression());
  if (!Node.isPropertyAccessExpression(receiver) || receiver.getName() !== 'style') {
    return null;
  }

  const rightText = binExpr.getRight().getText();
  if (!/radial-gradient\s*\(/i.test(rightText)) {
    return null;
  }

  return `Imperative style.${propName} radial-gradient() assignment on pointer movement can be replaced with CSS mask-image referencing --mouse-x/--mouse-y custom properties and @property-registered gradient stops.`;
}

function matchMaskSetPropertyCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'setProperty') {
    return null;
  }

  const receiver = unwrapExpression(callee.getExpression());
  if (!Node.isPropertyAccessExpression(receiver) || receiver.getName() !== 'style') {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2 || !args[0] || !args[1]) {
    return null;
  }

  const firstArg = unwrapExpression(args[0]);
  if (!Node.isStringLiteral(firstArg) && !Node.isNoSubstitutionTemplateLiteral(firstArg)) {
    return null;
  }

  const cssProp = firstArg.getLiteralText().trim().toLowerCase();
  if (!MASK_CSS_PROPS.has(cssProp)) {
    return null;
  }

  const valText = args[1].getText();
  if (!/radial-gradient\s*\(/i.test(valText)) {
    return null;
  }

  return `Imperative style.setProperty("${cssProp}", "radial-gradient(...)") call on pointer movement can be replaced with CSS mask-image referencing --mouse-x/--mouse-y custom properties and @property-registered gradient stops.`;
}

export const interactiveContentRevealJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: REVEAL_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of REVEAL_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    if (
      !ctx.fileContent.includes('radial-gradient') ||
      !POINTER_EVENT_REGEX.test(ctx.fileContent)
    ) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      const message = matchMaskAssignment(binExpr);
      if (message !== null) {
        const line = binExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      const message = matchMaskSetPropertyCall(callExpr);
      if (message !== null) {
        const line = callExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    return matches;
  },
};

export const interactiveContentRevealRule: AnalyzerRule = {
  id: 'interactive-content-reveal',
  guideId: 'interactive-content-reveal',
  guideHash: INTERACTIVE_CONTENT_REVEAL_GUIDE_HASH,
  summary:
    'Imperative radial-gradient() mask-image string reconstruction on pointermove/mousemove can be replaced with CSS mask-image custom properties (--mouse-x, --mouse-y) and @property-registered stop sizes.',
  matcher: interactiveContentRevealJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript listens to pointermove/mousemove and rebuilds a radial-gradient() maskImage or -webkit-mask-image string on every pointer update to create a spotlight or content-reveal effect.',
    ],
    dropWhen: [
      'The code only updates custom properties (--mouse-x, --mouse-y) via style.setProperty while keeping radial-gradient() in CSS.',
      'The maskImage assignment is a static one-time initialization unrelated to pointer coordinates.',
    ],
  },
};

export default [
  interactiveContentRevealRule,
] satisfies readonly AnalyzerRule[];
