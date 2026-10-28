import { SyntaxKind, type Node, type SourceFile } from 'ts-morph';
import type {
  AnalyzerMatch,
  AnalyzerRule,
  JsMatcherContext,
  JsRuleMatcher,
} from '../schema.ts';

export const VIEWPORT_AWARE_DROPDOWNS_GUIDE_HASH = '910cee5aac41';

const DROPDOWN_SIGNAL_RE =
  /\b(dropdown|dropdowns|menu|menus|submenu|popover|popup|listbox|combobox|picker|pk_menu|entry-menu|contextmenu|context-menu)\b|[a-z](?:Dropdown|Submenu|Menu|Popover|Popup|Picker)\b|\b(?:dropdown|submenu|menu|popover|popup|contextMenu)[A-Z_]/;

const VIEWPORT_BOUNDS_RE =
  /\b(?:window\s*\.\s*(?:innerWidth|innerHeight)|document\.documentElement\s*\.\s*(?:clientWidth|clientHeight)|visualViewport\s*\.\s*(?:width|height))\b/;

const DYNAMIC_STYLE_POSITION_RE =
  /\bstyle\s*\.\s*(?:top|left|bottom|right)\s*=\s*(?!['"]0(?:px)?['"])/;

const BOUNDARY_COMPARISON_RE =
  /[<>]=?|\bMath\.(?:min|max)\b/;

// Carve out position-aware-tooltips and non-dropdown positioning
const EXCLUSION_RE =
  /\b(tooltip|tooltips|tippy|canvas|getContext|confetti|drag|dragging|onMouseMove|pointermove|touchmove|marginChild|resizeHandler|resizeHandlerY|isResizing|resizeConfig|updateResize|canResize|minWidth|largeMinWidth|__webpack_modules__|webpackBootstrap)\b/i;

function isAlreadyModern(fileContent: string): boolean {
  return (
    fileContent.includes('position-try-fallbacks') ||
    fileContent.includes('position-area') ||
    fileContent.includes('anchor-name')
  );
}

function getFunctionNodes(sourceFile: SourceFile): Node[] {
  const nodes: Node[] = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction),
  ];
  // Visit innermost (smallest span) functions first so outer IIFEs/UMD wrappers never match
  return nodes.sort((a, b) => a.getEnd() - a.getPos() - (b.getEnd() - b.getPos()));
}

export const viewportAwareDropdownsMatcher: JsRuleMatcher = {
  kind: 'js',
  fastTokens: ['getBoundingClientRect'] as const,
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[] {
    if (isAlreadyModern(ctx.fileContent)) {
      return [];
    }

    const matches: AnalyzerMatch[] = [];
    const matchedNodes: Node[] = [];

    for (const fn of getFunctionNodes(sourceFile)) {
      const charSpan = fn.getEnd() - fn.getPos();
      if (charSpan > 3600 || charSpan < 40) {
        continue;
      }
      const fnText = fn.getText();
      if (!fnText.includes('getBoundingClientRect')) continue;
      const lineSpan = fn.getEndLineNumber() - fn.getStartLineNumber();
      if (lineSpan > 135 || (charSpan > 600 && lineSpan < 3)) {
        continue;
      }
      if (!VIEWPORT_BOUNDS_RE.test(fnText)) continue;
      if (!DYNAMIC_STYLE_POSITION_RE.test(fnText)) continue;
      if (!BOUNDARY_COMPARISON_RE.test(fnText)) continue;
      if (EXCLUSION_RE.test(fnText)) continue;

      const enclosingClass = fn.getFirstAncestorByKind(SyntaxKind.ClassDeclaration);
      const contextNameText = enclosingClass
        ? `${enclosingClass.getName() ?? ''}\n${fnText}`
        : fnText;

      if (!DROPDOWN_SIGNAL_RE.test(contextNameText)) {
        continue;
      }

      // Skip if an inner or outer function was already matched
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
          'Dropdown/menu positioning function manually measuring getBoundingClientRect() against viewport bounds and setting inline style.top/left; use popover="auto" with CSS Anchor Positioning (position-area and position-try-fallbacks).',
      });
    }

    return matches;
  },
};

export const viewportAwareDropdownsRule: AnalyzerRule = {
  id: 'viewport-aware-dropdowns',
  guideId: 'viewport-aware-dropdowns',
  guideHash: VIEWPORT_AWARE_DROPDOWNS_GUIDE_HASH,
  summary:
    'Detects dropdown and menu positioning functions that measure getBoundingClientRect() against window.innerWidth/innerHeight and set inline style.top/left instead of popover="auto" and CSS Anchor Positioning (position-area, position-try-fallbacks).',
  matcher: viewportAwareDropdownsMatcher,
  verifierRubric: {
    keepWhen: [
      'Dropdown, menu, submenu, or popover positioning logic calling getBoundingClientRect(), comparing against viewport width/height, and setting inline style.top or style.left to flip or clamp within the viewport',
    ],
    dropWhen: [
      'Hover/focus tooltip positioning (covered by position-aware-tooltips)',
      'Drag-and-drop, splitter resize, or canvas overlay coordinate math',
    ],
  },
};

export default [viewportAwareDropdownsRule] satisfies readonly AnalyzerRule[];
