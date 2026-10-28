import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  resolveLocalExpression,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH = '1795916b979c';

const FITTEXT_PACKAGES = [
  'fitty',
  'fittext',
  'jquery-fittext',
  'react-fitty',
] as const;

const NON_TEXT_FIT_TARGETS =
  /\b(?:canvas|ctx|context|chart|video|audio|player|camera|scene|game|threejs|circleType|circletype)\b/i;

const SINGLE_LINE_ENCLOSING_NAME_REGEX =
  /\b(?:initSingle|fitSingle(?:Line)?|singleLine|circleType|circletype)\b/i;

const SINGLE_LINE_SELECTOR_REGEX =
  /(?:^|[\s>+~])\.r-fit-text\s*$/i;

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

function hasHeadingOrTitleContext(text: string): boolean {
  return HEADING_OR_TITLE_CONTEXT_REGEX.test(text);
}

function countFitTextCallsInFile(sourceFile: SourceFile): number {
  let count = 0;
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = unwrapExpression(call.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (name === 'fitText' || name === 'fittext') {
        const target = unwrapExpression(expr.getExpression());
        const isJQueryCaller =
          (Node.isIdentifier(target) &&
            (target.getText().startsWith('$') || target.getText() === 'jQuery')) ||
          Node.isCallExpression(target) ||
          (Node.isPropertyAccessExpression(target) &&
            (target.getName().startsWith('$') || target.getName() === 'jQuery'));
        if (isJQueryCaller || call.getArguments().length > 0) {
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

function isInSingleLineContext(call: CallExpression, sourceFile: SourceFile): boolean {
  const filePath = sourceFile.getFilePath();
  if (/circletype/i.test(filePath)) {
    return true;
  }

  let current: Node | undefined = call.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isMethodDeclaration(current) ||
      Node.isPropertyAssignment(current) ||
      Node.isVariableDeclaration(current)
    ) {
      const name = current.getName?.() ?? '';
      if (name && SINGLE_LINE_ENCLOSING_NAME_REGEX.test(name)) {
        return true;
      }
    }
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

function extractLastSelectorLiteral(text: string): string | null {
  const strMatches = text.match(/['"`]([^'"`]+)['"`]/g);
  if (!strMatches || strMatches.length === 0) {
    return null;
  }
  const lastRaw = strMatches[strMatches.length - 1];
  if (!lastRaw) {
    return null;
  }
  return lastRaw.slice(1, -1).trim();
}

function isSingleLineSelectorTarget(text: string): boolean {
  if (/\.r-fit-text\b/.test(text)) {
    return true;
  }
  const selector = extractLastSelectorLiteral(text);
  return selector !== null && SINGLE_LINE_SELECTOR_REGEX.test(selector);
}

function isFitTextCall(
  call: CallExpression,
  sourceFile: SourceFile,
  fileContent: string,
): boolean {
  if (
    isSingleLineOption(call) ||
    isInSingleLineContext(call, sourceFile) ||
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
    const args = call.getArguments();
    if (args.length === 0) {
      return false;
    }
    const firstArg = args[0];
    if (firstArg) {
      const firstText = firstArg.getText();
      const resolvedFirstText = resolveLocalExpression(firstArg, 2).getText();
      if (
        isSingleLineSelectorTarget(firstText) ||
        isSingleLineSelectorTarget(resolvedFirstText)
      ) {
        return false;
      }
      if (
        hasMinMaxOpts &&
        (hasHeadingOrTitleContext(firstText) ||
          hasHeadingOrTitleContext(resolvedFirstText)) &&
        countFitTextCallsInFile(sourceFile) === 1
      ) {
        return false;
      }
    }
    if (!isGlobalReference(expr, name)) {
      const hasPkgImport = sourceFile.getImportDeclarations().some((imp) => {
        const spec = getSafeModuleSpecifier(imp);
        return (
          spec !== null &&
          FITTEXT_PACKAGES.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
        );
      });
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

    const targetText = target.getText();
    const resolvedTargetText = resolveLocalExpression(target, 2).getText();
    if (
      isSingleLineSelectorTarget(targetText) ||
      isSingleLineSelectorTarget(resolvedTargetText)
    ) {
      return false;
    }
    if (
      hasMinMaxOpts &&
      (hasHeadingOrTitleContext(targetText) ||
        hasHeadingOrTitleContext(resolvedTargetText)) &&
      countFitTextCallsInFile(sourceFile) === 1
    ) {
      return false;
    }

    // Skip zero-arg calls on non-jQuery objects (e.g. this.fitText(), customScripts.fitText())
    const isJQueryCaller =
      (Node.isIdentifier(target) && (target.getText().startsWith('$') || target.getText() === 'jQuery')) ||
      Node.isCallExpression(target) ||
      (Node.isPropertyAccessExpression(target) && (target.getName().startsWith('$') || target.getName() === 'jQuery'));

    if (!isJQueryCaller && call.getArguments().length === 0) {
      return false;
    }

    // Skip zero-arg wrapper calls like `customScripts.fitText()` when the file defines its own `fitText` method wrapping `$(...).fitText(...)`
    if (
      call.getArguments().length === 0 &&
      Node.isIdentifier(target) &&
      !target.getText().startsWith('$') &&
      target.getText() !== 'jQuery' &&
      /\bfitText\s*[:(]/.test(sourceFile.getFullText())
    ) {
      const propAssignments = sourceFile.getFullText().match(/\bfitText\s*:\s*function\b|\bfunction\s+fitText\b/);
      if (propAssignments) {
        return false;
      }
    }
    return true;
  }
  return false;
}

export const equalWidthTextLinesPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    FITTEXT_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy text-fitting package "${pkgName}" (${versionRange}) can be modernized with native CSS text-fit: grow per-line-all.`,
  );

export const equalWidthTextLinesJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['fitty', 'fitText', 'fittext'],
  featureGuardTokens: ['text-fit', 'text-wrap'],
  matchCall: (node, sourceFile, ctx) =>
    isFitTextCall(node, sourceFile, ctx.fileContent)
      ? `Imperative text-fitting script call "${node.getExpression().getText()}" can be modernized with native CSS text-fit: grow per-line-all.`
      : null,
});

export const equalWidthTextLinesPackageRule: AnalyzerRule = {
  id: 'equal-width-text-lines/package-fittext',
  guideId: 'equal-width-text-lines',
  guideHash: EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  summary:
    'Legacy text-fitting packages (fitty, fittext, jquery-fittext, react-fitty) in dependencies should be modernized with native CSS text-fit: grow per-line-all.',
  matcher: equalWidthTextLinesPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares fitty, fittext, jquery-fittext, or react-fitty in package.json dependencies to resize text lines to equal width.',
    ],
    dropWhen: [
      'The package is a dev-only tool or unrelated utility not used for heading line scaling.',
      'The text resizing is single-line container fitting covered by fit-text-to-container rather than multi-line equal-width headings.',
    ],
  },
};

export const equalWidthTextLinesJsRule: AnalyzerRule = {
  id: 'equal-width-text-lines/js-fittext',
  guideId: 'equal-width-text-lines',
  guideHash: EQUAL_WIDTH_TEXT_LINES_GUIDE_HASH,
  summary:
    'Imperative text-fitting script calls (fitty, fitText, $.fitText) should be modernized with native CSS text-fit: grow per-line-all.',
  matcher: equalWidthTextLinesJsMatcher,
  verifierRubric: {
    keepWhen: [
      'Imperative JavaScript invokes fitty(), fitText(), or jQuery .fitText() to scale headline text lines to uniform container width without a CSS.supports("text-fit", ...) guard.',
      'A script dynamically computes font-size scaling factors across heading lines using clientWidth or offsetWidth measurements.',
    ],
    dropWhen: [
      'The call is guarded by CSS.supports("text-fit", ...) or a progressive enhancement fallback check.',
      'The call passes minFontSize/maxFontSize or minSize/maxSize fluid clamp options on a non-line selector, explicitly sets single-line mode (multiLine: false, singleLine: true, maxLines: 1, white-space: nowrap), or targets a single heading, link, or Reveal.js .r-fit-text slide element.',
      'The script curves text along a circular path (CircleType) or measures container aspect ratios or video dimensions rather than text typography lines.',
      'The sizing uses fluid viewport units (clamp, vw, cqi) without imperative line-scaling loops.',
    ],
  },
};

export default [
  equalWidthTextLinesPackageRule,
  equalWidthTextLinesJsRule,
] satisfies readonly AnalyzerRule[];
