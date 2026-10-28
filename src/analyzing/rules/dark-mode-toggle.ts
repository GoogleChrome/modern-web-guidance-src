import {
  Node,
  SyntaxKind,
  type BinaryExpression,
  type CallExpression,
  type SourceFile,
} from 'ts-morph';
import { unwrapExpression } from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const DARK_MODE_TOGGLE_GUIDE_HASH = 'e499ab00959e';

const DARK_MODE_TOGGLE_FAST_TOKENS = [
  'localStorage',
] as const;

const DARK_MODE_TOGGLE_GUARD_TOKENS = [
  'meta[name="color-scheme"]',
  "meta[name='color-scheme']",
  'name="color-scheme"',
  "name='color-scheme'",
] as const;

const STORAGE_THEME_KEY_REGEX =
  /\blocalStorage\.(?:getItem|setItem|removeItem)\s*\(\s*['"][^'"]*(?:theme|dark|color-scheme|colorScheme|mode)[^'"]*['"]|\blocalStorage\.(?:theme|darkMode|colorScheme)\b/i;

const ROOT_RECEIVER_REGEX =
  /(?:document\.documentElement|document\.body|document\.querySelector\(\s*['"](?:html|body|:root)['"]\s*\)|\b(?:html|root|body|doc| docEl|rootEl)\b)/i;

const GENERATED_DOC_SKIP_REGEX =
  /\b(?:tsd-theme|typedoc|ace\/theme|monaco\.editor\.setTheme|prism-|dokka-dark-mode|sourceset_dependencies\.js|data-content_root|pydata-sphinx-theme|DOCUMENTATION_OPTIONS|docfx:)\b|dataset\.mode\s*=\s*localStorage\.getItem|--color-code-foreground|_static\/pygments\.css/i;

function isDarkClassListCall(callExpr: CallExpression): boolean {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee)) {
    return false;
  }

  const method = callee.getName();
  if (method !== 'toggle' && method !== 'add' && method !== 'remove') {
    return false;
  }

  const classListExpr = unwrapExpression(callee.getExpression());
  if (!Node.isPropertyAccessExpression(classListExpr) || classListExpr.getName() !== 'classList') {
    return false;
  }

  const targetText = classListExpr.getExpression().getText();
  if (!ROOT_RECEIVER_REGEX.test(targetText)) {
    return false;
  }

  const firstArg = callExpr.getArguments()[0];
  if (!firstArg) {
    return false;
  }
  const argUnwrapped = unwrapExpression(firstArg);
  if (!Node.isStringLiteral(argUnwrapped) && !Node.isNoSubstitutionTemplateLiteral(argUnwrapped)) {
    return false;
  }

  const className = argUnwrapped.getLiteralText().trim();
  return /^(?:dark|dark-mode|dark-theme|theme-dark|light-mode|light-theme)$/i.test(
    className,
  );
}

function isDataThemeSetAttributeCall(callExpr: CallExpression): boolean {
  const callee = unwrapExpression(callExpr.getExpression());
  if (!Node.isPropertyAccessExpression(callee) || callee.getName() !== 'setAttribute') {
    return false;
  }

  const targetText = callee.getExpression().getText();
  if (!ROOT_RECEIVER_REGEX.test(targetText)) {
    return false;
  }

  const firstArg = callExpr.getArguments()[0];
  if (!firstArg) {
    return false;
  }
  const argUnwrapped = unwrapExpression(firstArg);
  if (!Node.isStringLiteral(argUnwrapped) && !Node.isNoSubstitutionTemplateLiteral(argUnwrapped)) {
    return false;
  }

  const attrName = argUnwrapped.getLiteralText().trim().toLowerCase();
  return (
    attrName === 'data-theme' ||
    attrName === 'data-color-mode' ||
    attrName === 'data-bs-theme' ||
    attrName === 'data-color-scheme'
  );
}

function isDatasetThemeAssignment(binExpr: BinaryExpression): boolean {
  if (binExpr.getOperatorToken().getKind() !== SyntaxKind.EqualsToken) {
    return false;
  }

  const left = unwrapExpression(binExpr.getLeft());
  if (!Node.isPropertyAccessExpression(left)) {
    return false;
  }

  const propName = left.getName();
  if (propName !== 'theme' && propName !== 'colorMode' && propName !== 'bsTheme') {
    return false;
  }

  const datasetExpr = unwrapExpression(left.getExpression());
  if (!Node.isPropertyAccessExpression(datasetExpr) || datasetExpr.getName() !== 'dataset') {
    return false;
  }

  return ROOT_RECEIVER_REGEX.test(datasetExpr.getExpression().getText());
}

export const darkModeToggleJsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: DARK_MODE_TOGGLE_FAST_TOKENS,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    for (const guard of DARK_MODE_TOGGLE_GUARD_TOKENS) {
      if (ctx.fileContent.includes(guard)) {
        return [];
      }
    }

    if (GENERATED_DOC_SKIP_REGEX.test(ctx.fileContent)) {
      return [];
    }

    // Require localStorage persistence of a theme/dark-mode key in the file
    // (This also guarantees 0 overlap with dark-mode/js-match-media, which skips any file with localStorage)
    if (!STORAGE_THEME_KEY_REGEX.test(ctx.fileContent)) {
      return [];
    }

    for (const callExpr of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (isDarkClassListCall(callExpr) || isDataThemeSetAttributeCall(callExpr)) {
        return [
          {
            line: callExpr.getStartLineNumber(),
            message:
              'Dark mode toggle persists theme state in localStorage and toggles a root .dark class or data-theme attribute without updating <meta name="color-scheme">; synchronize <meta name="color-scheme"> with CSS color-scheme and light-dark().',
          },
        ];
      }
    }

    for (const binExpr of sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression)) {
      if (isDatasetThemeAssignment(binExpr)) {
        return [
          {
            line: binExpr.getStartLineNumber(),
            message:
              'Dark mode toggle persists theme state in localStorage and sets dataset.theme on the root element without updating <meta name="color-scheme">; synchronize <meta name="color-scheme"> with CSS color-scheme and light-dark().',
          },
        ];
      }
    }

    return [];
  },
};

export const darkModeToggleRule: AnalyzerRule = {
  id: 'dark-mode-toggle',
  guideId: 'dark-mode-toggle',
  guideHash: DARK_MODE_TOGGLE_GUIDE_HASH,
  summary:
    'Dark mode toggles that persist theme overrides in localStorage and toggle root .dark classes or data-theme attributes should update <meta name="color-scheme"> ("light dark", "light", "dark") paired with CSS color-scheme and light-dark().',
  matcher: darkModeToggleJsMatcher,
  verifierRubric: {
    keepWhen: [
      'JavaScript implements a user-facing dark/light theme override stored in localStorage and applies it by toggling a .dark/.dark-theme class or data-theme attribute on documentElement/body without updating <meta name="color-scheme">.',
    ],
    dropWhen: [
      'The code already updates <meta name="color-scheme"> content ("light dark", "light", "dark").',
      'The code only reads matchMedia("(prefers-color-scheme: dark)") without a user toggle or localStorage override (covered by dark-mode).',
      'The code switches multi-brand or syntax-editor color palettes (e.g. Monaco/Ace editor themes) rather than light/dark page color scheme.',
    ],
  },
};

export default [
  darkModeToggleRule,
] satisfies readonly AnalyzerRule[];
