import { SyntaxKind, type SourceFile } from 'ts-morph';
import { resolveCallableNode } from '../scanners/ast-helpers.ts';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SCOPED_COMPONENT_TRANSITIONS_GUIDE_HASH = 'b1222934fc15';

const PAGE_OR_THEME_EXCLUSION_RE =
  /\b(document\.documentElement|document\.body|applyTheme|newTheme|currentTheme|themeToggle|colorScheme|history\.pushState|history\.replaceState|location\.href|router|navigate|innerDoSwap|htmx)\b/i;

const LOCAL_SUBTREE_MUTATION_RE =
  /\b(?:this\.shadowRoot|this\.renderRoot|this\.\$\w*|container|grid|list|board|panel|card|widget|tabs|tabPanel|column|lane|gallery|carousel|wrapper|host|el|element|target)\s*\.\s*(?:appendChild|append|prepend|replaceChildren|insertBefore|removeChild|innerHTML|textContent|classList|setAttribute|removeAttribute|querySelector)|\bclosest\s*\(/;

function hasElementScopedStartViewTransition(sourceFile: SourceFile): boolean {
  for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
    const expr = call.getExpression();
    if (
      expr.getKind() === SyntaxKind.PropertyAccessExpression &&
      expr.getText().endsWith('.startViewTransition') &&
      expr.getText() !== 'document.startViewTransition'
    ) {
      return true;
    }
  }
  return false;
}

export const scopedComponentTransitionsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['startViewTransition'] as const,
  matchFile(sourceFile: SourceFile, _ctx: JsMatcherContext): AnalyzerMatch[] {
    if (hasElementScopedStartViewTransition(sourceFile)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const seenLines = new Set<number>();

    for (const call of sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression)) {
      if (call.getExpression().getText() !== 'document.startViewTransition') {
        continue;
      }

      const firstArg = call.getArguments()[0];
      if (!firstArg) continue;

      const callback = resolveCallableNode(firstArg);
      const callbackText = callback.getText();

      const enclosingFn =
        call.getFirstAncestorByKind(SyntaxKind.MethodDeclaration) ??
        call.getFirstAncestorByKind(SyntaxKind.FunctionDeclaration) ??
        call.getFirstAncestorByKind(SyntaxKind.FunctionExpression) ??
        call.getFirstAncestorByKind(SyntaxKind.ArrowFunction);

      const scopeText = enclosingFn
        ? `${enclosingFn.getText()}\n${callbackText}`
        : callbackText;

      if (PAGE_OR_THEME_EXCLUSION_RE.test(scopeText)) {
        continue;
      }

      if (!LOCAL_SUBTREE_MUTATION_RE.test(scopeText)) {
        continue;
      }

      const line = call.getStartLineNumber();
      if (!seenLines.has(line)) {
        seenLines.add(line);
        matches.push({
          line,
          column: call.getStartLinePos(),
          message:
            'document.startViewTransition() used for a local component DOM update; call container.startViewTransition() on the component root so concurrent transitions do not block page interaction or collide.',
        });
      }
    }

    return matches;
  },
};

export const scopedComponentTransitionsRule: AnalyzerRule = {
  id: 'scoped-component-transitions',
  guideId: 'scoped-component-transitions',
  guideHash: SCOPED_COMPONENT_TRANSITIONS_GUIDE_HASH,
  summary:
    'Detects document.startViewTransition() calls that only mutate a self-contained component subtree instead of calling element.startViewTransition() on the component container.',
  matcher: scopedComponentTransitionsMatcher,
  verifierRubric: {
    keepWhen: [
      'Calling document.startViewTransition() inside a component or widget handler where the update callback only mutates a local container subtree (e.g., reordering cards in a grid, switching tab panels, or updating a shadowRoot)',
    ],
    dropWhen: [
      'Full-page or route navigation view transition updating <main> or document.body',
      'Root theme toggle transition animating ::view-transition-new(root)',
      'Feature detection wrapper checking document.startViewTransition after element.startViewTransition',
    ],
  },
};

export default [scopedComponentTransitionsRule] satisfies readonly AnalyzerRule[];
