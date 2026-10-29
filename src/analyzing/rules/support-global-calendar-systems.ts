import {
  Node,
  type CallExpression,
  type NewExpression,
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

export const SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH = 'da915a6c2463';

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
  if (callExpr.getArguments().length === 0) {
    return null;
  }
  const callee = unwrapExpression(callExpr.getExpression());
  if (Node.isPropertyAccessExpression(callee)) {
    const methodName = callee.getName();
    if (methodName !== 'toJalaali' && methodName !== 'toGregorian') {
      return null;
    }
    const enclosingFn = callExpr.getFirstAncestor(Node.isFunctionDeclaration);
    if (enclosingFn?.getName() === methodName) {
      return null;
    }
    const receiver = unwrapExpression(callee.getExpression());
    if (isLibraryReference(receiver, 'jalaali', ['jalaali-js'])) {
      return `jalaali.${methodName}() calendar conversion can be modernized with native Temporal calendar systems (Temporal.PlainDate.prototype.withCalendar()).`;
    }
  }
  return null;
}

function matchPersianDateNew(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (isLibraryReference(callee, 'PersianDate', ['persian-date'])) {
    return 'new PersianDate() non-Gregorian date instantiation can be modernized with native Temporal calendar systems (Temporal.PlainDate.prototype.withCalendar()).';
  }
  return null;
}

export const supportGlobalCalendarSystemsPackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    CALENDAR_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy non-Gregorian calendar package "${pkgName}" (${versionRange}) can be modernized with native Temporal calendar systems (withCalendar()) and Intl.DateTimeFormat.`,
  );

export const supportGlobalCalendarSystemsJsMatcher: JsRuleMatcher = createJsCallMatcher({
  fastTokens: ['jalaali', 'toJalaali', 'toGregorian', 'PersianDate'],
  featureGuardTokens: CALENDAR_GUARD_TOKENS,
  matchCall: matchJalaaliCall,
  matchNew: matchPersianDateNew,
});

export const supportGlobalCalendarSystemsPackageRule: AnalyzerRule = {
  id: 'support-global-calendar-systems/package-calendar',
  guideId: 'support-global-calendar-systems',
  guideHash: SUPPORT_GLOBAL_CALENDAR_SYSTEMS_GUIDE_HASH,
  summary:
    'Legacy non-Gregorian calendar packages (moment-hijri, moment-jalaali, jalaali-js, hijri-moment, persian-date) can be modernized with native Temporal calendar support.',
  matcher: supportGlobalCalendarSystemsPackageMatcher,
  verifierRubric: {
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
  verifierRubric: {
    keepWhen: [
      'JavaScript calls jalaali.toJalaali(), jalaali.toGregorian(), or instantiates new PersianDate() to convert or manipulate non-Gregorian calendar dates.',
    ],
    dropWhen: [
      'The call is guarded by Temporal or Intl.supportedValuesOf("calendar") feature detection.',
      'The code formats standard Gregorian ISO 8601 dates without non-Gregorian calendar conversion.',
    ],
  },
};

export default [
  supportGlobalCalendarSystemsPackageRule,
  supportGlobalCalendarSystemsJsRule,
] satisfies readonly AnalyzerRule[];
