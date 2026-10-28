import { SyntaxKind, type Node, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
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

const CSS_VENDOR_FILE_RE =
  /(?:^|\/)(?:jquery|bootstrap|semantic|foundation|bulma|materialize|bitrix|ext\/)|_files\//i;

const CSS_ACCORDION_PANEL_SELECTOR_RE =
  /\.(?:[a-z0-9]+[-_])*(?:accordion|faq)[-_a-z0-9]*(?:content|panel|body|answer|details|collapse)\b/i;

const CSS_HEADER_OR_ICON_EXCLUSION_RE =
  /\b(?:header|heading|title|button|trigger|icon|arrow|toggle|summary|ui-accordion|w3-accordion)\b/i;

export const searchHiddenContentCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['accordion', 'faq'] as const,
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (CSS_VENDOR_FILE_RE.test(ctx.filePath)) {
      return null;
    }

    if (isAlreadyModern(ctx.stylesheetText)) {
      return null;
    }

    const selector = styleRule.selectorText;
    if (!CSS_ACCORDION_PANEL_SELECTOR_RE.test(selector)) {
      return null;
    }

    if (CSS_HEADER_OR_ICON_EXCLUSION_RE.test(selector)) {
      return null;
    }

    const displayVal = styleRule.getPropertyValue('display');
    if (!displayVal || displayVal.trim().toLowerCase() !== 'none') {
      return null;
    }

    return {
      message: `Accordion/FAQ content rule '${selector}' uses display: none, which blocks browser find-in-page; use <details> or hidden="until-found" with a beforematch listener.`,
    };
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

export const searchHiddenContentCssRule: AnalyzerRule = {
  id: 'search-hidden-content/css',
  guideId: 'search-hidden-content',
  guideHash: SEARCH_HIDDEN_CONTENT_GUIDE_HASH,
  summary:
    'Detects CSS rules on accordion or FAQ content panels that set display: none when collapsed, preventing browser find-in-page from matching collapsed text.',
  matcher: searchHiddenContentCssMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS rule targeting a collapsed accordion or FAQ content/answer panel and setting display: none',
    ],
    dropWhen: [
      'CSS rule hiding a decorative icon, arrow indicator, or toggle button rather than the searchable content panel',
      'Navigation bar or dropdown menu collapse rule',
    ],
  },
};

export default [
  searchHiddenContentRule,
  searchHiddenContentCssRule,
] satisfies readonly AnalyzerRule[];
