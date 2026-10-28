import { SyntaxKind, type Node, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const SEARCH_HIDDEN_CONTENT_GUIDE_HASH = '31ed5e42cd83';

const ACCORDION_OR_FAQ_RE = /\b(accordion|faq)\b|[a-z]Accordion|Accordion[A-Z]|faq[A-Z]/i;

const NON_ACCORDION_EXCLUSION_RE =
  /\b(navbar|nav-link|dropdown|modal|dialog|tooltip|tablist|menuitem|signatureProperties)\b/i;

const JS_PANEL_HIDE_RE =
  /\.\s*hidden\s*=\s*(?!['"]until-found['"])|\b(?:setAttribute|toggleAttribute)\s*\(\s*['"]hidden['"](?!\s*,\s*['"]until-found['"])|\bstyle\s*\.\s*display\s*=\s*['"]none['"]|\bhidden\s*=\s*\{/;

function isAlreadyModern(text: string): boolean {
  return text.includes('until-found') || text.includes('beforematch');
}

function getCandidateScopes(sourceFile: SourceFile): Node[] {
  const nodes: Node[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ];
  // Visit innermost (smallest span) functions first so outer IIFEs/wrappers never swallow inner functions
  return nodes.sort((a, b) => a.getEnd() - a.getPos() - (b.getEnd() - b.getPos()));
}

export const searchHiddenContentMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['accordion', 'Accordion', 'faq', 'FAQ', 'aria-expanded'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isAlreadyModern(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedNodes: Node[] = [];

    for (const fn of getCandidateScopes(sourceFile)) {
      const charSpan = fn.getEnd() - fn.getPos();
      if (charSpan > 1800 || charSpan < 30) {
        continue;
      }
      const fnText = fn.getText();
      if (!JS_PANEL_HIDE_RE.test(fnText)) continue;
      const lineSpan = fn.getEndLineNumber() - fn.getStartLineNumber();
      if (lineSpan > 55) continue;
      if (NON_ACCORDION_EXCLUSION_RE.test(fnText)) continue;

      const enclosingClass = fn.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
      const enclosingVar = fn.getFirstAncestorByKind(SyntaxKind.VariableDeclaration);
      const contextHeader = `${enclosingClass?.getName() ?? ''} ${enclosingVar?.getName() ?? ''}`;
      const contextText = `${contextHeader}\n${fnText}`;

      if (!ACCORDION_OR_FAQ_RE.test(contextText)) {
        continue;
      }

      // Require either aria-expanded or explicit panel/content/section/answer naming inside the function
      if (
        !/aria-expanded|\b(?:panel|content|answer|section|body|collapse)\b/i.test(
          fnText,
        )
      ) {
        continue;
      }

      // Skip if an inner function inside fn or an outer function containing fn was already matched
      if (
        matchedNodes.some(
          (prev) =>
            (prev.getPos() <= fn.getPos() && prev.getEnd() >= fn.getEnd()) ||
            (fn.getPos() <= prev.getPos() && fn.getEnd() >= prev.getEnd()),
        )
      ) {
        continue;
      }

      matchedNodes.push(fn);
      matches.push({
        line: fn.getStartLineNumber(),
        column: fn.getStartLinePos(),
        message:
          'Accordion or FAQ component hiding collapsed content with boolean hidden or display: none, which excludes it from find-in-page; use <details> or hidden="until-found" with a beforematch listener.',
      });
    }

    return matches;
  },
};

export const searchHiddenContentRule: AnalyzerRule = {
  id: 'search-hidden-content',
  guideId: 'search-hidden-content',
  guideHash: SEARCH_HIDDEN_CONTENT_GUIDE_HASH,
  summary:
    'Detects accordion and FAQ disclosure components that hide collapsed panels with boolean hidden or display: none instead of <details> or hidden="until-found" with beforematch.',
  matcher: searchHiddenContentMatcher,
  verifierRubric: {
    keepWhen: [
      'Accordion or FAQ disclosure component hiding collapsed text panels with boolean hidden or inline display: none instead of <details> or hidden="until-found"',
    ],
    dropWhen: [
      'Navigation menu, dropdown, modal dialog, tooltip, or tab widget where hidden items are not searchable page prose',
      'Component already using <details> or hidden="until-found" with beforematch',
    ],
  },
};

export default [searchHiddenContentRule] satisfies readonly AnalyzerRule[];
