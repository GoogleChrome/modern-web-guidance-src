import {
  Node,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  isGlobalReference,
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

export const SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH = 'a081f11823da';

const CALENDAR_PACKAGES = [
  'moment-hijri',
  'moment-jalaali',
  'jalaali-js',
  'hijri-moment',
  'persian-date',
] as const;

const CALENDAR_GUARD_TOKENS = [
  'Temporal',
  'withCalendar',
  'supportedValuesOf',
] as const;

function matchJalaaliCall(callExpr: CallExpression): string | null {
  const callee = unwrapExpression(callExpr.getExpression());
  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    if (methodName !== 'toJalaali' && methodName !== 'toGregorian') {
      return null;
    }
    const receiver = unwrapExpression(callee.getExpression());
    if (Node.isIdentifier(receiver) && receiver.getText() === 'jalaali') {
      return `jalaali.${methodName}() calendar conversion can be modernized with native Temporal calendar systems (Temporal.PlainDate.prototype.withCalendar() and Intl.DateTimeFormat).`;
    }
  }
  return null;
}

function matchPersianDateNew(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (isGlobalReference(callee, 'PersianDate')) {
    return 'new PersianDate() non-Gregorian date instantiation can be modernized with native Temporal calendar systems (Temporal.PlainDate.prototype.withCalendar()).';
  }
  return null;
}

export const supportGlobalCalendarSystemsPackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: CALENDAR_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message: `Legacy non-Gregorian calendar package "${pkgName}" (${versionRange}) can be modernized with native Temporal calendar systems (withCalendar()) and Intl.DateTimeFormat.`,
    };
  },
};

export const supportGlobalCalendarSystemsJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['jalaali', 'toJalaali', 'toGregorian', 'PersianDate'],
  matchFile: (sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] => {
    const matches: AnalyzerMatch[] = [];

    sourceFile.forEachDescendant((node) => {
      if (isProtectedByFeatureGuard(node, CALENDAR_GUARD_TOKENS)) {
        return;
      }

      if (Node.isCallExpression(node)) {
        const msg = matchJalaaliCall(node);
        if (msg) {
          matches.push({
            line: node.getStartLineNumber(),
            message: msg,
          });
        }
        return;
      }

      if (Node.isNewExpression(node)) {
        const msg = matchPersianDateNew(node);
        if (msg) {
          matches.push({
            line: node.getStartLineNumber(),
            message: msg,
          });
        }
      }
    });

    return matches;
  },
};

export const supportGlobalCalendarSystemsPackageRule: AnalyzerRule = {
  id: 'support-global-calendar-systems/package-calendar',
  guideId: 'support-global-calendar-systems',
  guideHash: SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  summary:
    'Legacy non-Gregorian calendar packages (moment-hijri, moment-jalaali, jalaali-js, hijri-moment, persian-date) can be modernized with native Temporal calendar support.',
  matcher: supportGlobalCalendarSystemsPackageMatcher,
  phase2Rubric: {
    keepWhen: [
      'A project declares moment-hijri, moment-jalaali, jalaali-js, hijri-moment, or persian-date in package.json dependencies to convert or format non-Gregorian calendar dates.',
    ],
    dropWhen: [
      'The code already uses Temporal.PlainDate.prototype.withCalendar() or Intl.DateTimeFormat with calendar options and only keeps the library as a fallback.',
      'The application requires astronomical observation-based religious calendar tables not supported by ICU/Intl standard calendar approximations.',
    ],
  },
};

export const supportGlobalCalendarSystemsJsRule: AnalyzerRule = {
  id: 'support-global-calendar-systems/js-calendar',
  guideId: 'support-global-calendar-systems',
  guideHash: SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  summary:
    'JavaScript calls to jalaali.toJalaali(), jalaali.toGregorian(), or new PersianDate() can be modernized with native Temporal calendar systems (withCalendar()).',
  matcher: supportGlobalCalendarSystemsJsMatcher,
  phase2Rubric: {
    keepWhen: [
      'JavaScript calls jalaali.toJalaali(), jalaali.toGregorian(), or instantiates new PersianDate() to convert or manipulate non-Gregorian calendar dates.',
    ],
    dropWhen: [
      'The call is guarded by Temporal or Intl.supportedValuesOf("calendar") feature detection.',
      'The code formats standard Gregorian ISO 8601 dates without non-Gregorian calendar conversion.',
    ],
  },
};

export const supportGlobalCalendarSystemsRules: readonly AnalyzerRule[] = [
  supportGlobalCalendarSystemsPackageRule,
  supportGlobalCalendarSystemsJsRule,
];
