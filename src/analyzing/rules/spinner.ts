import {
  Node,
  SyntaxKind,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyRuleMatcher,
  DomElementView,
  DomMatcherContext,
  DomRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SPINNER_GUIDE_HASH = 'cf5337b01353';

const SPINNER_PACKAGES = [
  'spin.js',
  'react-spinners',
] as const;

const SPINNER_FAST_TOKENS = [
  'Spinner',
  'spin.js',
] as const;

const SPINNER_DOM_CLASS_REGEX =
  /\b(?:spinner-border|loading-spinner)\b/i;

const SPIN_JS_OPTION_KEYS_REGEX =
  /\b(?:lines|length|width|radius|corners|rotate|trail|speed|color|className|zIndex|top|left)\s*:/;

export const spinnerPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    SPINNER_PACKAGES,
    (packageName) =>
      `Loading spinner dependency "${packageName}" can be replaced with an indeterminate HTML <progress aria-label="Loading"> element styled with CSS conic-gradient() and prefers-reduced-motion.`,
  );

function matchSpinnerNew(newExpr: NewExpression, fileContent: string): string | null {
  const expr = unwrapExpression(newExpr.getExpression());
  if (!isLibraryReference(expr, 'Spinner', ['spin.js'])) {
    return null;
  }

  const firstArg = newExpr.getArguments()[0];
  if (firstArg) {
    const unwrappedArg = unwrapExpression(firstArg);
    if (
      Node.isStringLiteral(unwrappedArg) ||
      Node.isNumericLiteral(unwrappedArg) ||
      Node.isNoSubstitutionTemplateLiteral(unwrappedArg)
    ) {
      return null;
    }
  }

  const hasSpinCallOrImport =
    fileContent.includes('.spin(') ||
    fileContent.includes('spin.js') ||
    (firstArg !== undefined && SPIN_JS_OPTION_KEYS_REGEX.test(firstArg.getText()));

  if (!hasSpinCallOrImport) {
    return null;
  }

  return 'new Spinner() from spin.js can be replaced with a native indeterminate <progress aria-label="Loading"> element styled with CSS conic-gradient() and transforms.';
}

export const spinnerJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: SPINNER_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const newExpr of sourceFile.getDescendantsOfKind(SyntaxKind.NewExpression)) {
      const message = matchSpinnerNew(newExpr, ctx.fileContent);
      if (message !== null) {
        const line = newExpr.getStartLineNumber();
        if (!seenLines.has(line)) {
          seenLines.add(line);
          matches.push({ line, message });
        }
      }
    }

    return matches;
  },
};

export const spinnerDomMatcher: DomRuleMatcher = {
  kind: 'dom',
  selector: 'div, span, i',
  fastTokens: [
    'spinner-border',
    'loading-spinner',
    'progressbar',
  ] as const,
  matchElement(
    element: DomElementView,
    ctx: DomMatcherContext,
  ): { message: string } | null {
    const tag = element.tagName.toLowerCase();
    if (tag !== 'div' && tag !== 'span' && tag !== 'i') {
      return null;
    }

    // Skip decorative inline icon spinners whose accessibility is provided by parent button/label
    if (element.getAttribute('aria-hidden') === 'true') {
      return null;
    }

    // Skip single-line minified HTML dumps (> 1000 chars on the matched line)
    const lineText = ctx.documentText.split(/\r?\n/)[element.line - 1] ?? '';
    if (lineText.length > 1000) {
      return null;
    }

    const classAttr =
      element.getAttribute('class') ?? element.getAttribute('className') ?? '';
    const roleAttr = (element.getAttribute('role') ?? '').trim().toLowerCase();

    // Case 1: Explicit spinner classes (<div class="spinner-border">, <div class="loading-spinner">, etc.)
    if (SPINNER_DOM_CLASS_REGEX.test(classAttr)) {
      // Carve out determinate progress bars with aria-valuenow (owned by progress)
      if (element.hasAttribute('aria-valuenow')) {
        return null;
      }
      return {
        message:
          'Non-semantic loading spinner element can be replaced with a native indeterminate <progress aria-label="Loading"> element styled with CSS conic-gradient() and prefers-reduced-motion.',
      };
    }

    // Case 2: Indeterminate <div role="progressbar"> without aria-valuenow and with spinner/loader naming
    if (
      roleAttr === 'progressbar' &&
      !element.hasAttribute('aria-valuenow') &&
      /\b(?:spinner|loader|loading)\b/i.test(
        `${classAttr} ${element.getAttribute('id') ?? ''}`,
      )
    ) {
      return {
        message:
          'Indeterminate <div role="progressbar"> loading spinner can be replaced with a native indeterminate <progress aria-label="Loading"> element.',
      };
    }

    return null;
  },
};

export const spinnerPackageRule: AnalyzerRule = {
  id: 'spinner/package-spinner',
  guideId: 'spinner',
  guideHash: SPINNER_GUIDE_HASH,
  summary:
    'Third-party spinner libraries (spin.js, react-spinners) can be replaced with native indeterminate <progress aria-label="Loading"> styled with CSS conic-gradient() and transforms.',
  matcher: spinnerPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A package.json dependency or vendored library includes spin.js or react-spinners for indeterminate loading spinners.',
    ],
    dropWhen: [
      'The package is a CLI terminal spinner (such as ora) in a Node-only script without browser DOM rendering.',
    ],
  },
};

export const spinnerRule: AnalyzerRule = {
  id: 'spinner',
  guideId: 'spinner',
  guideHash: SPINNER_GUIDE_HASH,
  summary:
    'Spin.js new Spinner() calls can be replaced with native indeterminate <progress aria-label="Loading"> styled with CSS conic-gradient() and prefers-reduced-motion.',
  matcher: spinnerJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript instantiates new Spinner() from spin.js to render an indeterminate loading indicator in the DOM.',
    ],
    dropWhen: [
      'Spinner refers to a numeric input spinbutton widget (e.g., jQuery UI numeric spinner) rather than an indeterminate loading indicator.',
    ],
  },
};

export const spinnerDomRule: AnalyzerRule = {
  id: 'spinner/dom',
  guideId: 'spinner',
  guideHash: SPINNER_GUIDE_HASH,
  summary:
    'Non-semantic <div class="spinner-border"> / <div class="loading-spinner"> or indeterminate <div role="progressbar"> elements can be replaced with native indeterminate <progress aria-label="Loading">.',
  matcher: spinnerDomMatcher,
  verifierRubric: {
    keepWhen: [
      'HTML markup uses a <div>, <span>, or <i> with spinner classes (spinner-border, loading-spinner) or an indeterminate role="progressbar" without aria-valuenow to indicate a loading state.',
    ],
    dropWhen: [
      'The element is already a native <progress> element without a value attribute.',
      'The element is a determinate progress bar with aria-valuenow (covered by progress) or a determinate SVG progress ring (covered by progress-ring).',
      'The element is a numeric input spinner button.',
    ],
  },
};

export default [
  spinnerPackageRule,
  spinnerRule,
  spinnerDomRule,
] satisfies readonly AnalyzerRule[];
