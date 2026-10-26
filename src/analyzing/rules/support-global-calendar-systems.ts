import {
  Node,
  SyntaxKind,
  type CallExpression,
  type NewExpression,
  type SourceFile,
} from 'ts-morph';
import {
  getSafeModuleSpecifier,
  isGlobalReference,
  isProtectedByFeatureGuard,
  resolveLocalExpression,
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

function matchesPackageSpec(
  spec: string | null,
  packages: readonly string[],
): boolean {
  return (
    spec !== null &&
    packages.some((pkg) => spec === pkg || spec.startsWith(`${pkg}/`))
  );
}

function isRequireOfPackage(
  node: Node,
  packages: readonly string[],
): boolean {
  const unwrapped = unwrapExpression(node);
  if (!Node.isCallExpression(unwrapped)) {
    return false;
  }
  const callee = unwrapExpression(unwrapped.getExpression());
  const firstArg = unwrapped.getArguments()[0];
  if (
    Node.isIdentifier(callee) &&
    callee.getText() === 'require' &&
    firstArg &&
    Node.isStringLiteral(firstArg)
  ) {
    return matchesPackageSpec(firstArg.getLiteralText(), packages);
  }
  return false;
}

function checkEnclosingBindings(
  identNode: Node,
  localName: string,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean,
): 'matched' | 'shadowed' | 'none' {
  let current: Node | undefined = identNode.getParent();
  while (current) {
    if (
      Node.isFunctionDeclaration(current) ||
      Node.isFunctionExpression(current) ||
      Node.isArrowFunction(current) ||
      Node.isMethodDeclaration(current)
    ) {
      if (
        (Node.isFunctionDeclaration(current) || Node.isFunctionExpression(current)) &&
        current.getName() === localName
      ) {
        return 'shadowed';
      }
      for (const param of current.getParameters()) {
        const paramNameNode = param.getNameNode();
        if (Node.isIdentifier(paramNameNode) && paramNameNode.getText() === localName) {
          return 'shadowed';
        }
        for (const el of paramNameNode.getDescendantsOfKind(SyntaxKind.Identifier)) {
          if (el.getText() === localName) {
            return 'shadowed';
          }
        }
      }
    }

    if (Node.isBlock(current) || Node.isSourceFile(current)) {
      for (const stmt of current.getStatements()) {
        if (
          (Node.isFunctionDeclaration(stmt) || Node.isClassDeclaration(stmt)) &&
          stmt.getName() === localName
        ) {
          return 'shadowed';
        }
        if (!Node.isVariableStatement(stmt)) {
          continue;
        }
        for (const decl of stmt.getDeclarationList().getDeclarations()) {
          const nameNode = decl.getNameNode();
          if (Node.isIdentifier(nameNode) && nameNode.getText() === localName) {
            const init = decl.getInitializer();
            if (init) {
              const resolvedInit = resolveLocalExpression(init, 2);
              if (
                allowDefaultImport &&
                isRequireOfPackage(resolvedInit, packages)
              ) {
                return 'matched';
              }
              if (Node.isPropertyAccessExpression(resolvedInit)) {
                const propName = resolvedInit.getName();
                if (
                  (propName === identName ||
                    (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(
                    resolveLocalExpression(resolvedInit.getExpression(), 2),
                    packages,
                  )
                ) {
                  return 'matched';
                }
              }
            }
            return 'shadowed';
          } else if (Node.isObjectBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (el.getName() === localName) {
                const propName = el.getPropertyNameNode()?.getText() ?? el.getName();
                const init = decl.getInitializer();
                if (
                  init &&
                  (propName === identName || (allowDefaultImport && propName === 'default')) &&
                  isRequireOfPackage(resolveLocalExpression(init, 2), packages)
                ) {
                  return 'matched';
                }
                return 'shadowed';
              }
            }
          } else if (Node.isArrayBindingPattern(nameNode)) {
            for (const el of nameNode.getElements()) {
              if (Node.isBindingElement(el) && el.getName() === localName) {
                return 'shadowed';
              }
            }
          }
        }
      }
    }

    current = current.getParent();
  }
  return 'none';
}

function isCalendarLibraryRef(
  node: Node,
  identName: string,
  packages: readonly string[],
  allowDefaultImport: boolean = true,
  allowGlobal: boolean = true,
): boolean {
  const unwrapped = unwrapExpression(node);

  if (allowDefaultImport && isRequireOfPackage(unwrapped, packages)) {
    return true;
  }

  if (Node.isPropertyAccessExpression(unwrapped)) {
    const propName = unwrapped.getName();
    if (propName === identName || (allowDefaultImport && propName === 'default')) {
      const receiver = unwrapped.getExpression();
      if (isRequireOfPackage(resolveLocalExpression(receiver, 2), packages)) {
        return true;
      }
    }
  }

  if (Node.isIdentifier(unwrapped)) {
    const localName = unwrapped.getText();
    const sourceFile = unwrapped.getSourceFile();

    const bindingStatus = checkEnclosingBindings(
      unwrapped,
      localName,
      identName,
      packages,
      allowDefaultImport,
    );
    if (bindingStatus === 'matched') {
      return true;
    }
    if (bindingStatus === 'shadowed') {
      return false;
    }

    for (const imp of sourceFile.getImportDeclarations()) {
      const matchesPkg = matchesPackageSpec(getSafeModuleSpecifier(imp), packages);
      if (
        imp.getDefaultImport()?.getText() === localName ||
        imp.getNamespaceImport()?.getText() === localName
      ) {
        return allowDefaultImport && matchesPkg;
      }
      for (const named of imp.getNamedImports()) {
        const importedName = named.getName();
        const boundName = named.getAliasNode()?.getText() ?? importedName;
        if (boundName === localName) {
          return (
            matchesPkg &&
            (importedName === identName ||
              (allowDefaultImport && importedName === 'default'))
          );
        }
      }
    }
  }

  if (allowGlobal && isGlobalReference(unwrapped, identName)) {
    return true;
  }

  return false;
}

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
    const receiver = unwrapExpression(callee.getExpression());
    if (isCalendarLibraryRef(receiver, 'jalaali', ['jalaali-js'])) {
      return `jalaali.${methodName}() calendar conversion can be modernized with native Temporal calendar systems (Temporal.PlainDate.prototype.withCalendar()).`;
    }
  }
  return null;
}

function matchPersianDateNew(newExpr: NewExpression): string | null {
  const callee = unwrapExpression(newExpr.getExpression());
  if (isCalendarLibraryRef(callee, 'PersianDate', ['persian-date'])) {
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
      if (Node.isCallExpression(node)) {
        const msg = matchJalaaliCall(node);
        if (msg && !isProtectedByFeatureGuard(node, CALENDAR_GUARD_TOKENS)) {
          matches.push({
            line: node.getStartLineNumber(),
            message: msg,
          });
        }
        return;
      }

      if (Node.isNewExpression(node)) {
        const msg = matchPersianDateNew(node);
        if (msg && !isProtectedByFeatureGuard(node, CALENDAR_GUARD_TOKENS)) {
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

export const supportGlobalCalendarSystemsRules: readonly AnalyzerRule[] = [
  supportGlobalCalendarSystemsPackageRule,
  supportGlobalCalendarSystemsJsRule,
];
