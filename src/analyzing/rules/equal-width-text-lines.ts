import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  matchesPackageSpec,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  JsRuleMatcher,
} from '../schema.ts';

export const EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH = '1a77340529aa';

const FITTEXT_PACKAGES = [
  'fitty',
  'fittext',
  'jquery-fittext',
  'react-fitty',
] as const;

const NON_TEXT_FIT_TARGETS =
  /\b(?:canvas|ctx|context|chart|video|audio|player|camera|scene|game|threejs)\b/i;

const HEADING_OR_TITLE_CONTEXT_REGEX =
  /(?:^|[\s>+~.#'"`_-])(?:h[1-6]|headline|heading|title)\b/i;

function hasMinMaxFontSizeOption(call: CallExpression): boolean {
  for (const arg of call.getArguments()) {
    const resolved = resolveLocalExpression(arg, 2);
    if (Node.isObjectLiteralExpression(resolved)) {
      if (
        resolved.getProperty('minFontSize') ||
        resolved.getProperty('maxFontSize')
      ) {
        return true;
      }
    }
  }
  return false;
}

function isJQueryLikeTarget(target: Node): boolean {
  return (
    (Node.isIdentifier(target) &&
      (target.getText().startsWith('$') || target.getText() === 'jQuery')) ||
    Node.isCallExpression(target) ||
    (Node.isPropertyAccessExpression(target) &&
      (target.getName().startsWith('$') || target.getName() === 'jQuery'))
  );
}

function countFitTextCallsInFile(sourceFile: SourceFile): number {
  let count = 0;
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = unwrapExpression(call.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (name === 'fitText' || name === 'fittext') {
        const target = unwrapExpression(expr.getExpression());
        if (isJQueryLikeTarget(target) || call.getArguments().length > 0) {
          count++;
        }
      }
    }
  }
  return count;
}

function isSingleLineOption(call: CallExpression): boolean {
  for (const arg of call.getArguments()) {
    const resolved = resolveLocalExpression(arg, 2);
    if (Node.isObjectLiteralExpression(resolved)) {
      const multiLineProp = resolved.getProperty('multiLine');
      if (multiLineProp && Node.isPropertyAssignment(multiLineProp)) {
        const init = multiLineProp.getInitializer();
        if (init && unwrapExpression(init).getKind() === SyntaxKind.FalseKeyword) {
          return true;
        }
      }
      const singleLineProp = resolved.getProperty('singleLine');
      if (singleLineProp && Node.isPropertyAssignment(singleLineProp)) {
        const init = singleLineProp.getInitializer();
        if (init && unwrapExpression(init).getKind() === SyntaxKind.TrueKeyword) {
          return true;
        }
      }
      const maxLinesProp = resolved.getProperty('maxLines');
      if (maxLinesProp && Node.isPropertyAssignment(maxLinesProp)) {
        const init = maxLinesProp.getInitializer();
        if (init && init.getText() === '1') {
          return true;
        }
      }
    }
  }
  return false;
}

function isInSingleLineContext(call: CallExpression): boolean {
  let current: Node | undefined = call.getParent();
  while (current) {
    if (
      Node.isCallExpression(current) &&
      /\.r-fit-text\b/.test(current.getExpression().getText())
    ) {
      return true;
    }
    current = current.getParent();
  }

  return false;
}

function isExcludedTargetNode(
  node: Node,
  hasMinMaxOpts: boolean,
  sourceFile: SourceFile,
): boolean {
  const text = node.getText();
  const resolvedText = resolveLocalExpression(node, 2).getText();
  if (/\.r-fit-text\b/i.test(text) || /\.r-fit-text\b/i.test(resolvedText)) {
    return true;
  }
  return (
    hasMinMaxOpts &&
    (HEADING_OR_TITLE_CONTEXT_REGEX.test(text) ||
      HEADING_OR_TITLE_CONTEXT_REGEX.test(resolvedText)) &&
    countFitTextCallsInFile(sourceFile) === 1
  );
}

function isFitTextCall(
  call: CallExpression,
  sourceFile: SourceFile,
  fileContent: string,
): boolean {
  if (
    isSingleLineOption(call) ||
    isInSingleLineContext(call) ||
    /white-space\s*:\s*nowrap/i.test(fileContent)
  ) {
    return false;
  }
  const hasMinMaxOpts = hasMinMaxFontSizeOption(call);
  const expr = unwrapExpression(call.getExpression());
  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    if (name !== 'fitty' && name !== 'fitText' && name !== 'fittext') {
      return false;
    }
    const firstArg = call.getArguments()[0];
    if (!firstArg || isExcludedTargetNode(firstArg, hasMinMaxOpts, sourceFile)) {
      return false;
    }
    if (!isGlobalReference(expr, name)) {
      const hasPkgImport = sourceFile.getImportDeclarations().some((imp) =>
        matchesPackageSpec(getSafeModuleSpecifier(imp), FITTEXT_PACKAGES),
      );
      if (!hasPkgImport) {
        return false;
      }
    }
    return true;
  }
  if (Node.isPropertyAccessExpression(expr)) {
    const name = expr.getName();
    if (name !== 'fitty' && name !== 'fitText' && name !== 'fittext') {
      return false;
    }
    const target = unwrapExpression(expr.getExpression());

    // Skip canvas, chart, video, audio, or non-text graphical contexts
    if (Node.isIdentifier(target) && NON_TEXT_FIT_TARGETS.test(target.getText())) {
      return false;
    }

    if (isExcludedTargetNode(target, hasMinMaxOpts, sourceFile)) {
      return false;
    }

    // Skip zero-arg calls on non-jQuery objects (e.g. this.fitText(), customScripts.fitText())
    if (!isJQueryLikeTarget(target) && call.getArguments().length === 0) {
      return false;
    }

    return true;
  }
  return false;
}

export const equalWidthTextLinesJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['fitty', 'fitText', 'fittext'],
  featureGuardTokens: ['text-fit', 'text-wrap'],
  matchCall: (node, sourceFile, ctx) =>
    isFitTextCall(node, sourceFile, ctx.fileContent)
      ? `Imperative text-fitting script call "${node.getExpression().getText()}" can be modernized with native CSS text-fit: grow per-line-all.`
      : null,
});

export const equalWidthTextLinesJsRule: AnalyzerRule = {
  id: 'equal-width-text-lines/js-fittext',
  guideId: 'equal-width-text-lines',
  guideHash: EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  summary:
    'Imperative text-fitting script calls (fitty, fitText, $.fitText) should be modernized with native CSS text-fit: grow per-line-all.',
  matcher: equalWidthTextLinesJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperative JavaScript invokes fitty(), fitText(), or jQuery .fitText() to scale text or heading elements to fit their container width (including calls passing compressor numbers or minFontSize/maxFontSize bounds) without a CSS.supports("text-fit", ...) guard.',
      'A script dynamically computes font-size scaling factors across text or heading elements using clientWidth or offsetWidth measurements.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("text-fit", ...) or a progressive enhancement fallback check.',
      'The call explicitly sets single-line mode (multiLine: false, singleLine: true, maxLines: 1, white-space: nowrap) or targets a Reveal.js .r-fit-text slide element.',
      'The script curves text along a circular path (CircleType) or measures canvas, chart, or video dimensions rather than DOM typography.',
      'The sizing uses pure CSS fluid viewport units (clamp, vw, cqi) without imperative JS text-fitting calls.',
    ],
  },
};

export default [
  equalWidthTextLinesJsRule,
] satisfies readonly AnalyzerRule[];
