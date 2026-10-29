import {
  Node,
  SyntaxKind,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isLibraryReference,
  unwrapExpression,
} from '../scanners/ast-helpers.ts';
import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import { createJsCallMatcher } from '../scanners/js-scanner.ts';
import type {
  AnalyzerRule,
  DependencyRuleMatcher,
  JsRuleMatcher,
} from '../schema.ts';

export const CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH = '321007015288';
export const MANAGE_RECURRING_INTERVALS_GUIDE_HASH = '321007015288';

const ISO_LOOKUP_PACKAGES = [
  'i18n-iso-countries',
  'country-list',
  'iso-639-1',
] as const;

const ISO_LOOKUP_OBJECTS = new Set([
  'countries',
  'isoCountries',
  'countryList',
  'ISO6391',
  'iso6391',
]);

const DISPLAY_NAME_METHODS = new Set(['getName']);

const EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS = new Set([
  'getAlpha2Code',
  'getAlpha3Code',
  'getSimpleAlpha2Code',
  'getSimpleAlpha3Code',
  'alpha2ToAlpha3',
  'alpha3ToAlpha2',
  'alpha2ToNumeric',
  'numericToAlpha2',
  'numericToAlpha3',
  'getAlpha2Codes',
  'getAlpha3Codes',
  'getNumericCodes',
  'getNumericCode',
  'toAlpha2',
  'toAlpha3',
  'getAllCodes',
  'isValid',
  'validate',
  'getCode',
  'getCodes',
]);

const GUARD_TOKENS = [
  'DisplayNames',
  'Intl.DisplayNames',
  'Temporal',
  'PlainDate',
] as const;

function isVerifiedIsoReceiver(receiver: Node): boolean {
  const unwrapped = unwrapExpression(receiver);
  if (!Node.isIdentifier(unwrapped)) {
    return false;
  }
  const objName = unwrapped.getText();
  if (!ISO_LOOKUP_OBJECTS.has(objName)) {
    return false;
  }
  if (objName === 'ISO6391') {
    return isLibraryReference(unwrapped, 'ISO6391', ISO_LOOKUP_PACKAGES, {
      allowCurriedRequire: true,
    });
  }
  return isLibraryReference(unwrapped, objName, ISO_LOOKUP_PACKAGES, {
    allowGlobal: false,
    allowCurriedRequire: true,
  });
}

function fileUsesCodeConversionOrValidation(sourceFile: SourceFile): boolean {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const callee = unwrapExpression(call.getExpression());
    if (!Node.isPropertyAccessExpression(callee)) {
      continue;
    }
    const methodName = callee.getName();
    if (!EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS.has(methodName)) {
      continue;
    }
    const receiver = unwrapExpression(callee.getExpression());
    if (Node.isIdentifier(receiver) && ISO_LOOKUP_OBJECTS.has(receiver.getText())) {
      return true;
    }
  }
  return false;
}

function matchIsoDisplayNameCall(callExpr: CallExpression): string | null {
  if (callExpr.getArguments().length === 0) {
    return null;
  }

  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return null;
  }

  const methodName = callee.getName();
  if (EXCLUDED_CODE_CONVERSION_OR_VALIDATION_METHODS.has(methodName)) {
    return null;
  }
  if (!DISPLAY_NAME_METHODS.has(methodName)) {
    return null;
  }

  const receiver = unwrapExpression(callee.getExpression());
  if (!Node.isIdentifier(receiver) || !isVerifiedIsoReceiver(receiver)) {
    return null;
  }
  const objName = receiver.getText();

  return `${objName}.${methodName}() ISO display-name lookup can be modernized with native Intl.DisplayNames and location-agnostic Temporal/Intl primitives.`;
}

export const captureLocationAgnosticDataJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    'countries.getName',
    'isoCountries.getName',
    'countryList.getName',
    'ISO6391.getName',
    'iso6391.getName',
  ],
  shouldSkipFile: (sourceFile) => fileUsesCodeConversionOrValidation(sourceFile),
  featureGuardTokens: GUARD_TOKENS,
  matchCall: (node) => matchIsoDisplayNameCall(node),
});

export const captureLocationAgnosticDataPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    ISO_LOOKUP_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy ISO dictionary package "${pkgName}" (${versionRange}) can be modernized with native Intl.DisplayNames and location-agnostic Temporal/Intl primitives.`,
  );

export const captureLocationAgnosticDataPackageRule: AnalyzerRule = {
  id: 'capture-location-agnostic-data/package-iso-lookup',
  guideId: 'capture-location-agnostic-data',
  guideHash: CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  summary:
    'Legacy ISO region/language dictionary packages (i18n-iso-countries, country-list, iso-639-1) used for display-name translation can be modernized with Intl.DisplayNames and location-agnostic Temporal types.',
  matcher: captureLocationAgnosticDataPackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares i18n-iso-countries, country-list, or iso-639-1 in package.json dependencies solely to translate ISO country or language codes into localized display names.',
    ],
    dropWhen: [
      'The library is used for reverse code lookups, alpha-2/alpha-3/numeric code conversion, or code validation (such as getAlpha2Code, getAlpha3Code, alpha2ToAlpha3, alpha3ToAlpha2, alpha2ToNumeric, isValid, validate, or getCode) not supported by Intl.DisplayNames.',
      'The package.json snippet alone does not show whether the library is used solely for display-name translation versus alpha-2/alpha-3/numeric code conversion or validation.',
      'The lookup maps international telephone dialing codes (+1, +44) or currency exchange rates rather than localized region/language display names or location-agnostic calendar data.',
    ],
  },
};

export const captureLocationAgnosticDataJsRule: AnalyzerRule = {
  id: 'capture-location-agnostic-data/js-iso-lookup',
  guideId: 'capture-location-agnostic-data',
  guideHash: CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  summary:
    'JavaScript calls to countries.getName(), countryList.getName(), or ISO6391.getName() used solely for single-code display-name translation can be modernized with native Intl.DisplayNames.',
  matcher: captureLocationAgnosticDataJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript calls countries.getName(...), countryList.getName(...), or ISO6391.getName(...) exclusively for translating a single ISO country or language code into a localized display name.',
    ],
    dropWhen: [
      'The code calls getNames() to enumerate all country codes/names or calls getAlpha2Code(), getAlpha3Code(), alpha2ToAlpha3(), alpha3ToAlpha2(), isValid(), validate(), or getCode() for reverse lookup, code format conversion, or validation.',
      'The call is guarded by Intl.DisplayNames or Temporal feature detection.',
      'The lookup is on a local application object rather than i18n-iso-countries, country-list, or iso-639-1.',
    ],
  },
};

// --- manage-recurring-intervals consolidated rules and helpers ---

const TEMPORAL_INTERVAL_GUARD_TOKENS = ['Temporal', '@js-temporal/polyfill'] as const;

const DATE_CALENDAR_SETTERS = new Set([
  'setMonth',
  'setUTCMonth',
  'setFullYear',
  'setUTCFullYear',
]);

const MOMENT_INTERVAL_METHODS = new Set(['add', 'subtract']);

// Case-sensitive calendar units: years, months, y, M. Excludes 'm' (minutes).
const CALENDAR_INTERVAL_UNITS = /^['"](years?|months?|y|M)['"]$/;

function isMatchingGetter(node: Node, expectedReceiverText: string): boolean {
  if (Node.isCallExpression(node)) {
    const expr = unwrapExpression(node.getExpression());
    if (Node.isPropertyAccessExpression(expr)) {
      const name = expr.getName();
      if (
        name === 'getMonth' ||
        name === 'getUTCMonth' ||
        name === 'getFullYear' ||
        name === 'getUTCFullYear'
      ) {
        const caller = unwrapExpression(expr.getExpression()).getText();
        return caller === expectedReceiverText;
      }
    }
  }
  return false;
}

function checkBinaryNode(binNode: Node, expectedReceiverText: string): boolean {
  if (!Node.isBinaryExpression(binNode)) {
    return false;
  }
  const op = binNode.getOperatorToken().getKind();
  if (op !== SyntaxKind.PlusToken && op !== SyntaxKind.MinusToken) {
    return false;
  }

  // One of the operands must be a getMonth/getFullYear call on the same receiver
  const left = unwrapExpression(binNode.getLeft());
  const right = unwrapExpression(binNode.getRight());

  return isMatchingGetter(left, expectedReceiverText) || isMatchingGetter(right, expectedReceiverText);
}

/**
 * Checks whether an argument expression contains binary addition (+) or subtraction (-),
 * e.g., d.getMonth() + 1, d.getFullYear() + 1 on the SAME receiver.
 */
function hasArithmeticOperationOnSameReceiver(argNode: Node, expectedReceiverText: string): boolean {
  const unwrapped = unwrapExpression(argNode);

  if (checkBinaryNode(unwrapped, expectedReceiverText)) {
    return true;
  }

  const binaryDescs = unwrapped.getDescendantsOfKind(SyntaxKind.BinaryExpression);
  return binaryDescs.some((binaryExpr) => checkBinaryNode(binaryExpr, expectedReceiverText));
}

/**
 * Matches legacy mutable Date calendar setter mutations for monthly/annual recurring intervals:
 * d.setMonth(d.getMonth() + 1), d.setFullYear(d.getFullYear() + 1), etc.
 */
function matchDateCalendarSetter(callExpr: CallExpression): string | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!DATE_CALENDAR_SETTERS.has(methodName)) {
    return null;
  }

  const args = callExpr.getArguments();
  if (args.length === 0) {
    return null;
  }

  // Skip setters that pass an explicit day parameter (e.g. setMonth(m + 1, 0) or (m + 1, 1))
  if (args.length > 1) {
    return null;
  }

  const receiverText = unwrapExpression(expr.getExpression()).getText();

  // The first argument must involve addition or subtraction (+ or -) with getter on the SAME receiver
  if (!hasArithmeticOperationOnSameReceiver(args[0], receiverText)) {
    return null;
  }

  return `Legacy mutable Date calendar arithmetic (d.${methodName}(... + ...)) used instead of Temporal.PlainDate.prototype.add({ months: 1 }).`;
}

/**
 * Matches moment(...).add(..., 'months' | 'years') / moment(...).subtract(...) / dayjs(...).add(...)
 */
function matchMomentDayjsAdd(callExpr: CallExpression): string | null {
  const expr = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(expr)) {
    return null;
  }

  const methodName = expr.getName();
  if (!MOMENT_INTERVAL_METHODS.has(methodName)) {
    return null;
  }

  const callerExpr = unwrapExpression(expr.getExpression());
  const callerText = callerExpr.getText();

  // Must explicitly be moment or dayjs, NEVER a Temporal or plain object
  const isMomentOrDayjsCaller =
    callerText.includes('moment') ||
    callerText.includes('dayjs');

  if (!isMomentOrDayjsCaller) {
    return null;
  }

  const args = callExpr.getArguments();
  let hasCalendarUnit = false;

  if (args.length >= 2) {
    const unitArg = unwrapExpression(args[1]).getText();
    if (CALENDAR_INTERVAL_UNITS.test(unitArg)) {
      hasCalendarUnit = true;
    }
  } else if (args.length === 1) {
    // moment.add({ months: 1 })
    const arg = unwrapExpression(args[0]);
    if (Node.isObjectLiteralExpression(arg)) {
      const propNames = arg.getProperties().map((prop) => {
        if (Node.isPropertyAssignment(prop)) {
          return prop.getName();
        }
        return '';
      });
      hasCalendarUnit = propNames.some((propName) => /^(years?|months?|y|M)$/.test(propName));
    }
  }

  if (!hasCalendarUnit) {
    return null;
  }

  return `Legacy date library month/year interval arithmetic (.${methodName}(..., calendarUnit)) used instead of Temporal.PlainDate.prototype.add().`;
}

export const manageRecurringIntervalsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: [
    [
      'setMonth',
      'setUTCMonth',
      'setFullYear',
      'setUTCFullYear',
      '.add(',
      '.subtract(',
      'addMonths',
      'addYears',
      'subMonths',
      'subYears',
    ],
    [
      'getMonth',
      'getUTCMonth',
      'getFullYear',
      'getUTCFullYear',
      'month',
      'months',
      'year',
      'years',
      'addMonths',
      'addYears',
      'subMonths',
      'subYears',
    ],
  ],
  featureGuardTokens: TEMPORAL_INTERVAL_GUARD_TOKENS,
  matchCall: (node) => matchDateCalendarSetter(node) ?? matchMomentDayjsAdd(node),
});

export const manageRecurringIntervalsRule: AnalyzerRule = {
  id: 'manage-recurring-intervals',
  guideId: 'capture-location-agnostic-data',
  guideHash: MANAGE_RECURRING_INTERVALS_GUIDE_HASH,
  summary:
    'Flag legacy mutable Date monthly/annual calendar-period mutation (d.setMonth(d.getMonth() + 1), d.setFullYear(d.getFullYear() + 1)) or moment/dayjs month/year .add()/.subtract() calls instead of Temporal.PlainDate.prototype.add().',
  matcher: manageRecurringIntervalsMatcher,
  verifierRubric: {
    keepWhen: [
      'Legacy mutable Date calendar-period mutation (such as d.setMonth(d.getMonth() + 1) or d.setFullYear(d.getFullYear() + 1)) used to compute recurring monthly or annual billing/payroll cycles instead of Temporal.PlainDate.prototype.add({ months: 1 }, { overflow: "constrain" }).',
      'Third-party date library recurring month/year interval arithmetic (such as moment(...).add(..., "months") or dayjs(...).add(..., "years")) used for recurring schedule calculation.',
      'Date prototype extensions or date-wrapper utility methods (e.g., Date#add, addMonths, addYears) that compute recurring month or year arithmetic via setMonth(getMonth() + n) or setFullYear(getFullYear() + n), even when wrapped in a helper returning this',
    ],
    dropWhen: [
      'Simple day or week offsets (such as d.setDate(d.getDate() + 7) or dayjs().add(7, "days")) that do not involve month-end calendar clamping.',
      'Code already protected by feature detection for native Temporal or polyfill loading (@js-temporal/polyfill).',
      'Direct timestamp setters with fixed scalar values (such as d.setHours(0, 0, 0, 0) or d.setMonth(0)) without plus/minus duration arithmetic.',
      'Setters passing an explicit day argument (e.g. setMonth(m + 1, 0) or setMonth(m + 1, 1)) or 1-based index conversion (setMonth(m - 1)).',
      'Native Temporal arithmetic (e.g. plainDate.add({ months: 1 })).',
    ],
  },
};

export default [
  captureLocationAgnosticDataPackageRule,
  captureLocationAgnosticDataJsRule,
  manageRecurringIntervalsRule,
] satisfies readonly AnalyzerRule[];
