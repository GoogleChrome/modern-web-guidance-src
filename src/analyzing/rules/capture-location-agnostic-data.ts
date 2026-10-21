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

export const CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH = '0d07f947a04e';

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

const DISPLAY_NAME_METHODS = new Set(['getName', 'getNames']);

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
  if (!Node.isIdentifier(receiver)) {
    return null;
  }
  const objName = receiver.getText();
  if (!ISO_LOOKUP_OBJECTS.has(objName)) {
    return null;
  }

  return `${objName}.${methodName}() ISO display-name lookup can be modernized with native Intl.DisplayNames and location-agnostic Temporal/Intl primitives.`;
}

export const captureLocationAgnosticDataPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: ISO_LOOKUP_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy ISO dictionary package "${pkgName}" (${versionRange}) can be modernized with native Intl.DisplayNames and location-agnostic Temporal/Intl primitives.`,
    };
  },
};

export const captureLocationAgnosticDataJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['countries', 'ISO6391', 'getName', 'getNames'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    if (fileUsesCodeConversionOrValidation(sourceFile)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (!Node.isCallExpression(node)) {
        return;
      }

      if (isProtectedByFeatureGuard(node, GUARD_TOKENS)) {
        return;
      }

      const msg = matchIsoDisplayNameCall(node);
      if (msg) {
        matches.push({
          line: node.getStartLineNumber(),
          message: msg,
        });
      }
    });

    return matches;
  },
};

export const captureLocationAgnosticDataPackageRule: AnalyzerRule = {
  id: 'capture-location-agnostic-data/package-iso-lookup',
  guideId: 'capture-location-agnostic-data',
  guideHash: CAPTURE_LOCATION_AGNOSTIC_DATA_GUIDE_HASH,
  summary:
    'Legacy ISO region/language dictionary packages (i18n-iso-countries, country-list, iso-639-1) used for display-name translation can be modernized with Intl.DisplayNames and location-agnostic Temporal types.',
  matcher: captureLocationAgnosticDataPackageMatcher,
  phase2Rubric: {
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
    'JavaScript calls to countries.getName(), countries.getNames(), or ISO6391.getName() used solely for display-name translation can be modernized with native Intl.DisplayNames.',
  matcher: captureLocationAgnosticDataJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls countries.getName(...), countries.getNames(...), or ISO6391.getName(...) exclusively for translating ISO country or language codes into localized display names.',
    ],
    dropWhen: [
      'The code calls getAlpha2Code(), getAlpha3Code(), alpha2ToAlpha3(), alpha3ToAlpha2(), isValid(), validate(), or getCode() for reverse lookup, code format conversion, or validation.',
      'The call is guarded by Intl.DisplayNames or Temporal feature detection.',
      'The lookup is for telephone dialing prefixes or currency conversion tables.',
    ],
  },
};

export const captureLocationAgnosticDataRules: readonly AnalyzerRule[] = [
  captureLocationAgnosticDataPackageRule,
  captureLocationAgnosticDataJsRule,
];
