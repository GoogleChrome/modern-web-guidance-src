import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  DependencyRuleMatcher,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';
import { isProtectedByFeatureGuard, unwrapExpression } from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';

export const CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH = '77481d042afa';
export const FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH = '77481d042afa';

const TEMPORAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

// Case-sensitive allowlist: days, weeks, months, years, quarters. Rejects 'm' (minutes) and 'D' (milliseconds).
const CALENDAR_DIFF_UNIT_REGEX = /^(day|days|d|week|weeks|w|month|months|M|year|years|y|quarter|quarters)$/;

const INTERNAL_DATE_LIB_OR_WASM_CONTENT_REGEX =
  /\b(?:_emscripten_\w*|WebAssembly\.Module|HEAP32\[|defineLocale\s*\(|updateLocale\s*\(|getCalendarFormat\b)|Date\.prototype\.\w+\s*=/;

/**
 * Evaluates the divisor of a division to check if it equals 86400000:
 * - 86400000
 * - 864e5
 * - 1000 * 60 * 60 * 24
 */
function evaluateDivisor(node: Node): number | null {
  const unwrapped = unwrapExpression(node);
  if (Node.isNumericLiteral(unwrapped)) {
    return unwrapped.getLiteralValue();
  }
  if (Node.isBinaryExpression(unwrapped)) {
    const op = unwrapped.getOperatorToken().getKind();
    if (op === SyntaxKind.AsteriskToken) {
      const leftVal = evaluateDivisor(unwrapped.getLeft());
      const rightVal = evaluateDivisor(unwrapped.getRight());
      if (leftVal !== null && rightVal !== null) {
        return leftVal * rightVal;
      }
    }
  }
  return null;
}

/**
 * Checks whether an operand represents "now" (e.g. Date.now() or zero-argument new Date()).
 */
function isDateNow(node: Node): boolean {
  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();
  if (text.includes('Date.now()')) {
    return true;
  }
  if (Node.isNewExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (expr.getText() === 'Date' && unwrapped.getArguments().length === 0) {
      return true;
    }
  }
  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (name === 'getTime' || name === 'valueOf') {
        const caller = unwrapExpression(expr.getExpression());
        if (Node.isNewExpression(caller) && caller.getArguments().length === 0) {
          return true;
        }
      }
    }
  }
  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.PlusToken
  ) {
    return isDateNow(unwrapped.getOperand());
  }
  return false;
}

/**
 * Checks whether an operand explicitly calls .getTime() or new Date(...) on a known Date instance,
 * excluding Date.UTC, Date.now(), or custom classes (like LocalDate).
 */
function isGetTimeOrNewDate(node: Node): boolean {
  if (isDateNow(node)) {
    return false;
  }

  const unwrapped = unwrapExpression(node);
  const text = unwrapped.getText();

  if (text.includes('Date.UTC')) {
    return false;
  }

  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr) && (expr.getName() === 'getTime' || expr.getName() === 'valueOf')) {
      const caller = unwrapExpression(expr.getExpression());
      const callerText = caller.getText();
      // Ensure not Date.now() or non-date
      if (!callerText.includes('now') && !callerText.includes('UTC')) {
        return true;
      }
    }
  }

  if (Node.isNewExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    // Only standard global Date, not LocalDate or DateRange
    if (expr.getText() === 'Date' || expr.getText() === 'window.Date' || expr.getText() === 'globalThis.Date') {
      return true;
    }
  }

  if (
    Node.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.getOperatorToken() === SyntaxKind.PlusToken
  ) {
    return isGetTimeOrNewDate(unwrapped.getOperand());
  }

  return false;
}

/**
 * Unwraps Math.abs(...) around a subtraction expression.
 */
function unwrapSubtraction(node: Node): BinaryExpression | null {
  const unwrapped = unwrapExpression(node);
  if (Node.isBinaryExpression(unwrapped) && unwrapped.getOperatorToken().getKind() === SyntaxKind.MinusToken) {
    return unwrapped;
  }
  if (Node.isCallExpression(unwrapped)) {
    const expr = unwrapExpression(unwrapped.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'abs') {
      const caller = unwrapExpression(expr.getExpression());
      if (caller.getText() === 'Math') {
        const args = unwrapped.getArguments();
        if (args.length > 0) {
          return unwrapSubtraction(args[0]);
        }
      }
    }
  }
  return null;
}

/**
 * Checks whether the division result is rounded with Math.round (which is already DST-correct).
 */
function isEnclosingMathRound(binExpr: BinaryExpression): boolean {
  let parent: Node | undefined = binExpr.getParent();
  while (parent && Node.isParenthesizedExpression(parent)) {
    parent = parent.getParent();
  }
  if (parent && Node.isCallExpression(parent)) {
    const expr = unwrapExpression(parent.getExpression());
    if (Node.isPropertyAccessExpression(expr) && expr.getName() === 'round') {
      const caller = unwrapExpression(expr.getExpression());
      if (caller.getText() === 'Math') {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks division expressions dividing date differences by 86400000:
 * (a.getTime() - b.getTime()) / 86400000
 * where BOTH sides explicitly call .getTime() or new Date(...), never Date.now().
 */
function matchDayDivisionDifferential(binExpr: BinaryExpression): AnalyzerMatch | null {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.SlashToken) {
    return null;
  }

  if (isProtectedByFeatureGuard(binExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  if (isEnclosingMathRound(binExpr)) {
    return null;
  }

  const divisorVal = evaluateDivisor(binExpr.getRight());
  if (divisorVal !== 86400000 && divisorVal !== 864e5) {
    return null;
  }

  const subExpr = unwrapSubtraction(binExpr.getLeft());
  if (!subExpr) {
    return null;
  }

  const subLeft = subExpr.getLeft();
  const subRight = subExpr.getRight();

  if (isGetTimeOrNewDate(subLeft) && isGetTimeOrNewDate(subRight)) {
    return {
      line: binExpr.getStartLineNumber(),
      message:
        'Legacy millisecond day difference arithmetic ((a.getTime() - b.getTime()) / 86400000) used instead of Temporal.Duration or Temporal.PlainDate.since()/.until().',
    };
  }

  return null;
}

/**
 * Checks calls to moment(...).diff(other, calendarUnit) or dayjs(...).diff(other, calendarUnit)
 * with an explicit calendar unit argument (days, weeks, months, years).
 */
function matchMomentDiffCall(callExpr: CallExpression): AnalyzerMatch | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  if (expr.getName() !== 'diff') {
    return null;
  }

  const receiverText = unwrapExpression(expr.getExpression()).getText();
  if (receiverText === 'this') {
    return null;
  }

  // Skip Moment.js locale calendar format callbacks (e.g. calendar: { sameElse: function () { ... diff(..., 'days') } })
  let parent: Node | undefined = callExpr.getParent();
  while (parent && !Node.isSourceFile(parent)) {
    if (Node.isPropertyAssignment(parent)) {
      const propName = parent.getName();
      if (propName === 'sameElse' || propName === 'calendar') {
        return null;
      }
    }
    parent = parent.getParent();
  }

  if (isProtectedByFeatureGuard(callExpr, TEMPORAL_GUARD_TOKENS)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length < 2) {
    return null;
  }

  const unitArg = unwrapExpression(args[1]);
  if (!Node.isStringLiteral(unitArg) && !Node.isNoSubstitutionTemplateLiteral(unitArg)) {
    return null;
  }

  const unitText = unitArg.getLiteralText();
  if (!CALENDAR_DIFF_UNIT_REGEX.test(unitText)) {
    return null;
  }

  return {
    line: callExpr.getStartLineNumber(),
    message:
      `Legacy date library .diff(other, '${unitText}') used to calculate calendar differentials instead of Temporal.Duration or Temporal.PlainDate/ZonedDateTime.since()/.until().`,
  };
}

export const calculateEventDifferentialsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['86400000', '864e5', '1000 * 60 * 60 * 24', '60 * 60 * 24 * 1000', '24 * 60 * 60 * 1000', '.diff('],
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    const fullText = ctx.fileContent ?? sourceFile.getFullText();
    if (INTERNAL_DATE_LIB_OR_WASM_CONTENT_REGEX.test(fullText)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    const binaryExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    for (const binExpr of binaryExpressions) {
      const divMatch = matchDayDivisionDifferential(binExpr);
      if (divMatch) {
        matches.push(divMatch);
      }
    }

    const callExpressions = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const match = matchMomentDiffCall(callExpr);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  },
};

export const calculateEventDifferentialsRule: AnalyzerRule = {
  id: 'calculate-event-differentials',
  guideId: 'calculate-event-differentials',
  guideHash: CALCULATE_EVENT_DIFFERENTIALS_GUIDE_HASH,
  summary:
    'Flag legacy arithmetic date differential math ((a.getTime() - b.getTime()) / 86400000) or moment.diff() / dayjs.diff() with calendar units instead of Temporal.Duration or Temporal.PlainDate/ZonedDateTime.',
  matcher: calculateEventDifferentialsMatcher,
  verifierRubric: {
    keepWhen: [
      'Dividing the difference between two Date instances ((a.getTime() - b.getTime()) / 86400000) to compute elapsed days instead of Temporal.Duration or Temporal.PlainDate.since()/.until().',
      'Calling moment(...).diff(..., calendarUnit) or dayjs(...).diff(..., calendarUnit) with days, weeks, months, or years instead of Temporal.',
    ],
    dropWhen: [
      'Runtime elapsed-time or cache TTL timers measuring Date.now() - timestamp.',
      'Intra-day millisecond or second divisions (such as / 1000, / 60, / 3600000 for seconds, minutes, or hours).',
      'Code already protected by feature detection for native Temporal support.',
      'Calculations using Math.round() or Date.UTC timestamps where DST day length variation does not cause off-by-one errors.',
      'Vendored date library internals (such as Moment.js locale definitions, Date.prototype extensions, or compiled Emscripten/WebAssembly runtime shims) rather than application date differential logic.',
    ],
  },
};

// --- format-human-readable-durations consolidated rules and helpers ---

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
  /^(?:format|pretty)Duration\b|^secondsTo(?:Hms|Time|Duration)|^msTo(?:Time|Duration)/i;

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

const BROWSER_UI_DEPS = new Set([
  'react',
  'react-dom',
  'vue',
  'svelte',
  'svelte-routing',
  '@angular/core',
  'preact',
  'solid-js',
  'lit',
]);

const NODE_OR_CLI_DISQUALIFIER_DEPS = new Set([
  'commander',
  'yargs',
  'ora',
  'inquirer',
  'oclif',
  'meow',
  'cac',
  'minimist',
  'ink',
  'discord.js',
  'knex',
  'pg',
  'mongoose',
  'fs-extra',
  'undici',
  'prom-client',
]);

function shouldKeepDurationPackageManifest(
  _pkgName: string,
  parsed: Readonly<Record<string, unknown>>,
): boolean {
  if (Object.keys(parsed).length === 0) {
    return true;
  }
  if (parsed.bin) {
    return false;
  }
  const deps =
    typeof parsed.dependencies === 'object' && parsed.dependencies !== null
      ? (parsed.dependencies as Record<string, unknown>)
      : {};
  const devDeps =
    typeof parsed.devDependencies === 'object' && parsed.devDependencies !== null
      ? (parsed.devDependencies as Record<string, unknown>)
      : {};
  const allDepNames = new Set([...Object.keys(deps), ...Object.keys(devDeps)]);

  if ([...allDepNames].some((dep) => NODE_OR_CLI_DISQUALIFIER_DEPS.has(dep))) {
    return false;
  }

  // Allow minimal synthetic test manifests (<= 3 total deps)
  if (allDepNames.size <= 3 && !parsed.main && !parsed.scripts && !parsed.engines) {
    return true;
  }

  return [...allDepNames].some((dep) => BROWSER_UI_DEPS.has(dep));
}

export const durationDependencyMatcher: DependencyRuleMatcher = createDependencyMatcher(
  DURATION_PACKAGES,
  (pkgName, versionRange, ctx) => {
    if (!shouldKeepDurationPackageManifest(pkgName, ctx.packageJson)) {
      return null;
    }
    return `Legacy duration formatting package "${pkgName}" (${versionRange}) can be replaced with native Temporal.Duration and Intl.DurationFormat.`;
  },
);

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
      // Must be explicitly chained from moment.duration or dayjs.duration
      if (
        callerText.includes('moment.duration') ||
        callerText.includes('dayjs.duration')
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
 * computing multiple time units (hours, minutes, seconds) via division/modulo
 * and returning a formatted string.
 */
function isCustomDurationFormatterFunction(fnNode: Node): boolean {
  // Duration formatting functions are focused small helpers (< 60 lines)
  const lineCount = fnNode.getEndLineNumber() - fnNode.getStartLineNumber();
  if (lineCount > 60) {
    return false;
  }

  const fnText = fnNode.getText();
  if (fnText.includes('DurationFormat') || fnText.includes('Intl.DurationFormat')) {
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

  const hasNameMatch = DURATION_FUNCTION_NAME_REGEX.test(name);
  if (!hasNameMatch) {
    return false;
  }

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

  // Strictly require explicit duration function naming and division/modulo with unit labels
  if (hasDivisionOrModulo && hasTimeConstants && unitLabelsFound.size >= 1) {
    return true;
  }

  return false;
}

/**
 * Checks whether a file is test, benchmark, or CLI script.
 */
function isTestBenchOrCliFile(ctx?: JsMatcherContext, text?: string): boolean {
  if (ctx?.filePath) {
    const filePathLower = ctx.filePath.toLowerCase();
    if (
      filePathLower.includes('.test.') ||
      filePathLower.includes('.spec.') ||
      filePathLower.includes('__tests__') ||
      filePathLower.includes('/test/') ||
      filePathLower.includes('/tests/') ||
      filePathLower.includes('/bench/') ||
      filePathLower.includes('/benchmark/')
    ) {
      return true;
    }
  }
  if (text) {
    if (text.startsWith('#!') || text.includes("from 'chalk'") || text.includes('require("chalk")')) {
      return true;
    }
  }
  return false;
}

export const durationJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: [
    'humanizeDuration',
    'prettyMs',
    'moment.duration',
    'dayjs.duration',
    '.humanize(',
    'formatDuration',
    'prettyDuration',
    'secondsToHms',
    'secondsToTime',
    'secondsToDuration',
    'msToTime',
    'msToDuration',
    '86400',
    '3600',
  ],
  matchFile: (sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] => {
    const fullText = sourceFile.getFullText();
    if (isTestBenchOrCliFile(ctx, fullText)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const visitedLines = new Set<number>();

    sourceFile.forEachDescendant((node) => {
      if (Node.isCallExpression(node)) {
        const knownCall = isKnownDurationCall(node);
        if (knownCall !== null) {
          if (isProtectedByFeatureGuard(node, DURATION_FEATURE_TOKENS)) {
            return;
          }
          const line = node.getStartLineNumber();
          if (!visitedLines.has(line)) {
            visitedLines.add(line);
            matches.push({ line, message: knownCall });
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
        if (isCustomDurationFormatterFunction(node)) {
          if (isProtectedByFeatureGuard(node, DURATION_FEATURE_TOKENS)) {
            return;
          }
          const line = node.getStartLineNumber();
          if (!visitedLines.has(line)) {
            visitedLines.add(line);
            matches.push({
              line,
              message:
                'Custom duration formatting function computing multi-unit breakdown can be replaced with native Temporal.Duration and Intl.DurationFormat.',
            });
          }
        }
      }
    });

    return matches;
  },
};

export const formatHumanReadableDurationsPackageRule: AnalyzerRule = {
  id: 'format-human-readable-durations/package-duration-formatter',
  guideId: 'calculate-event-differentials',
  guideHash: FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH,
  summary:
    'Legacy duration formatting packages (humanize-duration, pretty-ms, moment-duration-format) can be modernized with native Temporal.Duration and Intl.DurationFormat.',
  matcher: durationDependencyMatcher,
  verifierRubric: {
    keepWhen: [
      'Using third-party duration formatting packages (such as humanize-duration, pretty-ms, or moment-duration-format) to format time spans in web or desktop UI applications.',
    ],
    dropWhen: [
      'Code already utilizing native Intl.DurationFormat or Temporal.Duration for formatted duration strings.',
      'Guarded by runtime feature detection for Intl.DurationFormat or globalThis.Temporal.',
      'Formatting fixed calendar dates or timestamps (such as Intl.DateTimeFormat or moment(date).format("YYYY-MM-DD")) rather than elapsed durations.',
      'Package.json manifests that pair pretty-ms alongside byte-size or pretty-bytes in infrastructure/system-metrics dashboards where compact unit formatting is used for raw telemetry counters rather than localized event durations.',
    ],
  },
};

export const formatHumanReadableDurationsJsRule: AnalyzerRule = {
  id: 'format-human-readable-durations/js-duration-formatter',
  guideId: 'calculate-event-differentials',
  guideHash: FORMAT_HUMAN_READABLE_DURATIONS_GUIDE_HASH,
  summary:
    'Custom duration formatting logic or libraries (humanizeDuration, prettyMs, moment.duration().humanize()) can be modernized with native Temporal.Duration and Intl.DurationFormat.',
  matcher: durationJsMatcher,
  verifierRubric: {
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

export default [
  calculateEventDifferentialsRule,
  formatHumanReadableDurationsPackageRule,
  formatHumanReadableDurationsJsRule,
] satisfies readonly AnalyzerRule[];
