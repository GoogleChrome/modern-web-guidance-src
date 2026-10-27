import { createDependencyMatcher } from '../scanners/dependency-scanner.ts';
import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DependencyRuleMatcher,
} from '../schema.ts';

export const RESPONSIVE_TABLE_GUIDE_HASH = '7e6e38515653';

const RESPONSIVE_TABLE_PACKAGES = [
  'tablesaw',
  'footable',
  'basictable',
  'jquery-basictable',
] as const;

export const responsiveTablePackageMatcher: DependencyRuleMatcher =
  createDependencyMatcher(
    RESPONSIVE_TABLE_PACKAGES,
    (pkgName, versionRange) =>
      `Legacy responsive table package "${pkgName}" (${versionRange}) can be modernized with native CSS Container Queries and stacked/scroll-snap mobile table layouts.`,
  );

const TD_BEFORE_REGEX = /(?:^|[,\s>+~])td::?before\b/i;
const ATTR_DATA_REGEX = /attr\s*\(\s*(?:data-label|data-th|data-title)\s*\)/i;
const VIEWPORT_MEDIA_REGEX = /\b(?:max-width|min-width|width)\b/i;
const DATA_GRID_SELECTOR_REGEX =
  /\b(?:dataTable|dataTables|ag-theme|ag-root|ag-cell|tanstack|handsontable|tabulator|jqgrid|ui-jqgrid|slickgrid|k-grid|rt-table|rt-td)\b/i;
const TABLE_ELEMENT_SELECTOR_REGEX = /(?:^|[\s>+~,.:#[\]])(?:table|thead|tbody|tfoot|tr|th|td)\b/i;
const STACKED_DISPLAY_REGEX = /^(?:block|flex|grid|inline-block|inline-flex|none)\b/i;

function normalizeCssPropValue(raw: string | null | undefined): string {
  return raw?.replace(/\s*!important\s*$/i, '').trim().toLowerCase() ?? '';
}

function hasStackedTableContext(styleRule: CssRuleView, ctx: CssMatcherContext): boolean {
  const selfDisplay = normalizeCssPropValue(styleRule.getPropertyValue('display'));
  const selfPosition = normalizeCssPropValue(styleRule.getPropertyValue('position'));
  const selfFloat = normalizeCssPropValue(styleRule.getPropertyValue('float'));
  if (
    STACKED_DISPLAY_REGEX.test(selfDisplay) ||
    selfPosition === 'absolute' ||
    selfFloat === 'left' ||
    selfFloat === 'right'
  ) {
    return true;
  }

  return (ctx.styleRules ?? []).some((other) => {
    if (!TABLE_ELEMENT_SELECTOR_REGEX.test(other.selectorText)) {
      return false;
    }
    const display = normalizeCssPropValue(other.getPropertyValue('display'));
    const position = normalizeCssPropValue(other.getPropertyValue('position'));
    const floatVal = normalizeCssPropValue(other.getPropertyValue('float'));
    return (
      STACKED_DISPLAY_REGEX.test(display) ||
      position === 'absolute' ||
      position === 'relative' ||
      floatVal === 'left' ||
      floatVal === 'right'
    );
  });
}

export const responsiveTableCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['data-label', 'data-th', 'data-title'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. Skip if stylesheet already uses modern @container queries
    if (ctx.stylesheetText.includes('@container')) {
      return null;
    }

    const parentAtRule = styleRule.parentAtRule?.toLowerCase() ?? '';
    if (parentAtRule.includes('container') || /\bprint\b/i.test(parentAtRule)) {
      return null;
    }

    // Must be inside a viewport @media query (mobile breakpoint table stacking)
    if (!parentAtRule.includes('@media') || !VIEWPORT_MEDIA_REGEX.test(parentAtRule)) {
      return null;
    }

    // Skip hover or focus tooltips (e.g. td:hover::before)
    if (styleRule.selectorText.includes(':hover') || styleRule.selectorText.includes(':focus')) {
      return null;
    }

    // Skip calendar date labels or third-party JS data grid stylesheets
    if (
      styleRule.selectorText.includes('.calendar') ||
      DATA_GRID_SELECTOR_REGEX.test(styleRule.selectorText)
    ) {
      return null;
    }

    // 2. Check if selector targets td::before or td:before
    if (!TD_BEFORE_REGEX.test(styleRule.selectorText)) {
      return null;
    }

    // 3. Check for content: attr(data-label | data-th | data-title)
    const contentDecl = styleRule.declarations.find(
      (d) => d.property.toLowerCase() === 'content',
    );
    if (!contentDecl || !ATTR_DATA_REGEX.test(contentDecl.value)) {
      return null;
    }

    // 4. Require table-stacking / label-positioning layout context
    if (!hasStackedTableContext(styleRule, ctx)) {
      return null;
    }

    return {
      message:
        'CSS rule injects table cell headers via td::before content: attr(data-*); modernize with CSS Container Queries and accessible pseudo-element headers.',
    };
  },
};

export const responsiveTablePackageRule: AnalyzerRule = {
  id: 'responsive-table/package-responsive-table',
  guideId: 'responsive-table',
  guideHash: RESPONSIVE_TABLE_GUIDE_HASH,
  summary:
    'Legacy responsive table packages (tablesaw, footable, basictable, jquery-basictable) should be modernized with native CSS Container Queries and stacked/scroll-snap mobile table layouts.',
  matcher: responsiveTablePackageMatcher,
  verifierRubric: {
    keepWhen: [
      'A project declares tablesaw, footable, basictable, or jquery-basictable in package.json dependencies to implement responsive stacked or scrollable mobile tables.',
    ],
    dropWhen: [
      'The package is unreferenced or unused in the build output.',
      'The application uses standard modern container queries for responsive layout.',
    ],
  },
};

export const responsiveTableCssRule: AnalyzerRule = {
  id: 'responsive-table/css-data-label-table',
  guideId: 'responsive-table',
  guideHash: RESPONSIVE_TABLE_GUIDE_HASH,
  summary:
    'Table cell stacking using td::before content: attr(data-*) without @container queries should be modernized with CSS Container Queries.',
  matcher: responsiveTableCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A CSS rule uses td::before or td:before with content: attr(data-label), attr(data-th), or attr(data-title) to generate mobile stacked table card headers without container queries.',
      'A responsive table stylesheet uses viewport media queries to flatten table cells and display data-* attributes as pseudo-element labels.',
    ],
    dropWhen: [
      'The stylesheet already uses @container queries to adapt the table layout based on container width.',
      'The td::before rule is not inside a viewport @media query (e.g. unconditional card-list modifiers) or lacks table-stacking layout context.',
      'The content: attr(...) is used on anchor tags for print styles (e.g. a::after { content: " (" attr(href) ")" }).',
      'The table uses horizontal scrolling wrapper containers (overflow-x: auto) without pseudo-element cell transformation.',
      'The table is a third-party or virtualized data grid (jQuery DataTables, AG Grid, TanStack Table) managing dynamic cell rendering.',
      'Hover tooltips or calendar date headers utilizing attr(data-*).',
    ],
  },
};

/**
 * Opt-in only until layout context is verifiable: retired from default production scan per Slice 6 audit.
 */
export default [
  responsiveTablePackageRule,
  responsiveTableCssRule,
] satisfies readonly AnalyzerRule[];
