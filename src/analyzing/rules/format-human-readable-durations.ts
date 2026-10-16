import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isProtectedByFeatureGuard,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyMatcherContext,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH = 'c743791fe3e1';

const DURATION_PACKAGES = [
  'humanize-duration',
  'pretty-ms',
  'moment-duration-format',
] as const;

const DURATION_FEATURE_TOKENS = [
  'Intl.DurationFormat',
  'DurationFormat',
  'Temporal.Duration',
  'Temporal',
] as const;

const DURATION_FUNCTION_NAME_REGEX =
  /^(?:format|humanize|pretty|get)Duration\b|^secondsTo(?:Hms|Time|Duration)|^msTo(?:Time|Duration)/i;

const DURATION_UNIT_LABELS = new Set([
  'h',
  'hr',
  'hrs',
  'hour',
  'hours',
  'm',
  'min',
  'mins',
  'minute',
  'minutes',
  's',
  'sec',
  'secs',
  'second',
  'seconds',
  'd',
  'day',
  'days',
]);

export const durationDependencyMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: DURATION_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Legacy duration formatting package "${pkgName}" (${versionRange}) can be replaced with native Temporal.Duration and Intl.DurationFormat.`,
    };
  },
};

/**
 * Checks whether a call expression is humanizeDuration(...), prettyMs(...),
 * or moment/dayjs .duration(...).humanize() / .format(...).
 */
function isKnownDurationCall(callExpr: CallExpression): string | null {
  const expr = unwrapExpression(callExpr.getExpression());

  if (Node.isIdentifier(expr)) {
    const name = expr.getText();
    if (name === 'humanizeDuration' || name === 'prettyMs') {
      return `Call to ${name}(...) can be modernized with native Temporal.Duration and Intl.DurationFormat.`;
    }
  }

  if (Node.isPropertyAccessExpression(expr)) {
    const methodName = expr.getName();
    if (methodName === 'humanize' || methodName === 'format') {
      const caller = unwrapExpression(expr.getExpression());
      const callerText = caller.getText();
      if (
        callerText.includes('moment.duration') ||
        callerText.includes('dayjs.duration') ||
        /\bduration\b/i.test(callerText)
      ) {
        return `Method call .${methodName}() on duration object can be modernized with native Temporal.Duration and Intl.DurationFormat.`;
      }
    }
  }

  return null;
}

/**
 * Traverses descendants strictly within the immediate function scope,
 * skipping nested functions or classes to prevent outer wrapper false positives.
 */
function forEachDescendantInScope(node: Node, callback: (child: Node) => void): void {
  for (const child of node.getChildren()) {
    if (
      Node.isFunctionDeclaration(child) ||
      Node.isFunctionExpression(child) ||
      Node.isArrowFunction(child) ||
      Node.isClassDeclaration(child) ||
      Node.isMethodDeclaration(child)
    ) {
      continue;
    }
    callback(child);
    forEachDescendantInScope(child, callback);
  }
}

/**
 * Checks whether a function node is a custom duration formatting function
 * computing multiple time units (hours, minutes, seconds) via division/modulo.
 */
function isCustomDurationFormatterFunction(fnNode: Node): boolean {
  // Duration formatting functions are focused small helpers (< 60 lines)
  const lineCount = fnNode.getEndLineNumber() - fnNode.getStartLineNumber();
  if (lineCount > 60) {
    return false;
  }

  let name = '';
  if (
    Node.isFunctionDeclaration(fnNode) ||
    Node.isMethodDeclaration(fnNode)
  ) {
    name = fnNode.getName() ?? '';
  } else {
    const parent = fnNode.getParent();
    if (parent && Node.isVariableDeclaration(parent)) {
      name = parent.getName();
    }
  }

  const hasNameMatch = DURATION_FUNCTION_NAME_REGEX.test(name) || name === 'humanize';

  // Collect string literals and binary operations in this function body
  const unitLabelsFound = new Set<string>();
  let hasDivisionOrModulo = false;
  let hasTimeConstants = false;

  forEachDescendantInScope(fnNode, (child) => {
    if (Node.isBinaryExpression(child)) {
      const op = child.getOperatorToken().getKind();
      if (op === SyntaxKind.SlashToken || op === SyntaxKind.PercentToken) {
        hasDivisionOrModulo = true;
      }
    }

    if (Node.isNumericLiteral(child)) {
      const val = child.getLiteralValue();
      if (
        val === 60 ||
        val === 1000 ||
        val === 3600 ||
        val === 86400 ||
        val === 60000 ||
        val === 3600000 ||
        val === 86400000
      ) {
        hasTimeConstants = true;
      }
    }

    if (Node.isStringLiteral(child) || Node.isNoSubstitutionTemplateLiteral(child)) {
      const text = child.getLiteralText().trim().toLowerCase();
      if (DURATION_UNIT_LABELS.has(text)) {
        unitLabelsFound.add(text);
      }
    }
  });

  // If function explicitly named formatDuration, secondsToHms, humanize, etc. with division and time constants
  if (hasNameMatch && hasDivisionOrModulo && (hasTimeConstants || unitLabelsFound.size >= 1)) {
    return true;
  }

  // If function does division/modulo with time constants AND combines >= 2 distinct duration units
  if (hasDivisionOrModulo && hasTimeConstants && unitLabelsFound.size >= 2) {
    return true;
  }

  return false;
}

export const durationJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'humanizeDuration',
    'prettyMs',
    'humanize',
    'moment',
    'dayjs',
    'duration',
    'formatDuration',
    'secondsToHms',
    'msToTime',
  ],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    const recordMatch = (node: Node, message: string): void => {
      const line = node.getStartLineNumber();
      if (visitedLines.has(line)) {
        return;
      }
      visitedLines.add(line);
      matches.push({ line, message });
    };

    sourceFile.forEachDescendant((node) => {
      if (isProtectedByFeatureGuard(node, DURATION_FEATURE_TOKENS)) {
        return;
      }

      if (Node.isCallExpression(node)) {
        const knownCall = isKnownDurationCall(node);
        if (knownCall !== null) {
          recordMatch(node, knownCall);
          return;
        }
      }

      if (
        Node.isFunctionDeclaration(node) ||
        Node.isFunctionExpression(node) ||
        Node.isArrowFunction(node) ||
        Node.isMethodDeclaration(node)
      ) {
        if (isCustomDurationFormatterFunction(node)) {
          recordMatch(
            node,
            'Custom duration formatting function computing multi-unit breakdown can be replaced with native Temporal.Duration and Intl.DurationFormat.',
          );
        }
      }
    });

    return matches;
  },
};

export const formatHumanReadableDurationsPackageRule: AnalyzerRule = {
  id: 'format-human-readable-durations/package-duration-formatter',
  guideId: 'format-human-readable-durations',
  guideHash: FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH,
  summary:
    'Legacy duration formatting packages (humanize-duration, pretty-ms, moment-duration-format) can be modernized with native Temporal.Duration and Intl.DurationFormat.',
  matcher: durationDependencyMatcher,
  phase2Rubric: {
    keepWhen: [
      'Using third-party duration formatting packages (such as humanize-duration, pretty-ms, or moment-duration-format) to format time spans.',
      'Calling duration methods like humanizeDuration(...), prettyMs(...), moment.duration(...).humanize(), or moment.duration(...).format(...).',
      'Implementing custom time duration formatters that manually divide milliseconds or seconds into hours, minutes, and seconds with unit labels.',
    ],
    dropWhen: [
      'Code already utilizing native Intl.DurationFormat or Temporal.Duration for formatted duration strings.',
      'Guarded by runtime feature detection for Intl.DurationFormat or globalThis.Temporal.',
      'Formatting fixed calendar dates or timestamps (such as Intl.DateTimeFormat or moment(date).format("YYYY-MM-DD")) rather than elapsed durations.',
    ],
  },
};

export const formatHumanReadableDurationsJsRule: AnalyzerRule = {
  id: 'format-human-readable-durations/js-duration-formatter',
  guideId: 'format-human-readable-durations',
  guideHash: FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH,
  summary:
    'Custom duration formatting logic or libraries (humanizeDuration, prettyMs, moment.duration().humanize()) can be modernized with native Temporal.Duration and Intl.DurationFormat.',
  matcher: durationJsMatcher,
  phase2Rubric: formatHumanReadableDurationsPackageRule.phase2Rubric,
};

export const formatHumanReadableDurationsRules: readonly AnalyzerRule[] = [
  formatHumanReadableDurationsPackageRule,
  formatHumanReadableDurationsJsRule,
];
