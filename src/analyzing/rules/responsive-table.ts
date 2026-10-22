import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
  DependencyMatcherContext,
  DependencyRuleMatcher,
} from '../schema.ts';

export const RESPONSIVE_TABLE_GUIDE_HASH = '7e6e38515653';

const RESPONSIVE_TABLE_PACKAGES = [
  'tablesaw',
  'footable',
  'basictable',
  'jquery-basictable',
] as const;

export const responsiveTablePackageMatcher: DependencyRuleMatcher = {
  kind: 'dependency',
  packages: RESPONSIVE_TABLE_PACKAGES,
  matchPackage: (
    pkgName: string,
    versionRange: string,
    _ctx: DependencyMatcherContext,
  ) => {
    return {
      message:
        `Legacy responsive table package "${pkgName}" (${versionRange}) can be modernized with native CSS Container Queries and stacked/scroll-snap mobile table layouts.`,
    };
  },
};

const TD_BEFORE_REGEX = /(?:^|[,\s>+~])td::?before\b/i;
const ATTR_DATA_REGEX = /attr\s*\(\s*(?:data-label|data-th|data-title)\s*\)/i;

export const responsiveTableCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['data-label', 'data-th', 'data-title'],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    // 1. Skip if stylesheet already uses modern @container queries
    if (ctx.stylesheetText.includes('@container')) {
      return null;
    }

    if (styleRule.parentAtRule?.toLowerCase().includes('container')) {
      return null;
    }

    // Skip print stylesheets / media queries
    if (styleRule.parentAtRule?.toLowerCase().includes('print')) {
      return null;
    }

    // Skip hover or focus tooltips (e.g. td:hover::before)
    if (styleRule.selectorText.includes(':hover') || styleRule.selectorText.includes(':focus')) {
      return null;
    }

    // Skip calendar date labels
    if (styleRule.selectorText.includes('.calendar')) {
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
  phase2Rubric: {
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
  phase2Rubric: {
    keepWhen: [
      'A CSS rule uses td::before or td:before with content: attr(data-label), attr(data-th), or attr(data-title) to generate mobile stacked table card headers without container queries.',
      'A responsive table stylesheet uses viewport media queries to flatten table cells and display data-* attributes as pseudo-element labels.',
    ],
    dropWhen: [
      'The stylesheet already uses @container queries to adapt the table layout based on container width.',
      'The content: attr(...) is used on anchor tags for print styles (e.g. a::after { content: " (" attr(href) ")" }).',
      'The table uses horizontal scrolling wrapper containers (overflow-x: auto) without pseudo-element cell transformation.',
      'The table is a virtualized data grid (AG Grid, TanStack Table) managing dynamic cell recycling.',
      'Hover tooltips or calendar date headers utilizing attr(data-*).',
    ],
  },
};

/**
 * Opt-in only until layout context is verifiable: retired from default production scan per Slice 6 audit.
 */
export const responsiveTableRules: readonly AnalyzerRule[] = [
  responsiveTablePackageRule,
  responsiveTableCssRule,
];
