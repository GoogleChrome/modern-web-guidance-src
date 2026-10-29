import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const COMPONENT_SPECIFIC_LIGHT_DARK_THEME_GUIDE_HASH = '477bb587421e';

const COMPOUND_COMPONENT_DARK_REGEX =
  /^([a-z0-9_-]*\.[a-z0-9_-]+|pre|code|figure|dialog|aside|section|article|header|footer|nav|main)(?:\.dark|\.theme-dark|\.dark-theme|\.dark-mode|\[data-theme\s*=\s*['"]?dark['"]?\]|\[data-color-scheme\s*=\s*['"]?dark['"]?\])$/i;

const DESCENDANT_COMPONENT_DARK_REGEX =
  /^(?:\.dark|\.theme-dark|\.dark-theme|\.dark-mode|\[data-theme\s*=\s*['"]?dark['"]?\]|\[data-color-scheme\s*=\s*['"]?dark['"]?\])\s+(\.[a-z0-9_-]+|pre|code)$/i;

const SHALLOW_TAGS = new Set([
  ':root',
  'html',
  'body',
  'a',
  'button',
  'input',
  'select',
  'textarea',
  'label',
  'span',
  'svg',
  'path',
  'img',
  'i',
  'icon',
  'kbd',
  'hr',
  'small',
  'strong',
  'em',
  'td',
  'th',
  'tr',
  'li',
]);

const SHALLOW_CLASS_REGEX =
  /(?:^|[._-])(?:btn|button|badge|tag|pill|chip|link|icon|avatar|text|title|heading|label|input|control|field|searchbox|item|notice|spinner|loader)(?:[._-]|$)/i;

const SURFACE_COMPONENT_CLASS_REGEX =
  /(?:^|[._-])(?:card|panel|preview|code|pre|player|audio|video|media|gallery|editor|embed|widget|dialog|modal|drawer|popover|dropdown-menu|sidebar|toolbar|terminal|console|viewer|canvas|chart|map)(?:[._-]|$)/i;

const matchedCssContexts = new WeakSet<CssMatcherContext>();
const cachedHasRootTheme = new WeakMap<CssMatcherContext, boolean>();

function stylesheetHasRootThemeRule(ctx: CssMatcherContext): boolean {
  const cached = cachedHasRootTheme.get(ctx);
  if (cached !== undefined) {
    return cached;
  }
  const hasRoot =
    /(?:^|[},])\s*(?:html|body|:root)(?:\.dark|\.light|\.theme-dark|\.theme-light|\.dark-theme|\.light-theme|\.dark-mode|\.light-mode|\[data-theme|\[data-color-scheme)/i.test(
      ctx.stylesheetText,
    ) ||
    /(?:^|[},])\s*(?:\.dark|\.light|\.theme-dark|\.theme-light|\.dark-theme|\.light-theme|\.dark-mode|\.light-mode|\[data-theme[^\]]*\]|\[data-color-scheme[^\]]*\])\s*[,{]/i.test(
      ctx.stylesheetText,
    );
  cachedHasRootTheme.set(ctx, hasRoot);
  return hasRoot;
}

function isComponentDarkOverrideSelector(
  selectorText: string,
  ctx: CssMatcherContext,
): boolean {
  // Reject selectors with pseudo-elements or escaped utility classes (e.g. Tailwind .dark\:bg-*)
  if (selectorText.includes('::') || selectorText.includes('\\:')) {
    return false;
  }

  const branches = selectorText.split(',');
  for (const rawBranch of branches) {
    const branch = rawBranch.trim();

    const compoundMatch = COMPOUND_COMPONENT_DARK_REGEX.exec(branch);
    if (compoundMatch) {
      const target = compoundMatch[1].toLowerCase().trim();
      const baseTag = target.split('.')[0];
      if (baseTag && SHALLOW_TAGS.has(baseTag)) {
        continue;
      }
      if (SHALLOW_CLASS_REGEX.test(target)) {
        continue;
      }
      return true;
    }

    const descMatch = DESCENDANT_COMPONENT_DARK_REGEX.exec(branch);
    if (descMatch) {
      const target = descMatch[1].toLowerCase().trim();
      if (
        (target === 'pre' ||
          target === 'code' ||
          (SURFACE_COMPONENT_CLASS_REGEX.test(target) && !SHALLOW_CLASS_REGEX.test(target))) &&
        !stylesheetHasRootThemeRule(ctx)
      ) {
        return true;
      }
    }
  }
  return false;
}

function hasSolidBackgroundAndForegroundOverride(
  rule: CssRuleView,
  ctx: CssMatcherContext,
): boolean {
  let hasBackground = false;
  let hasForeground = false;
  let hasStandardBgAndFg = false;
  let hasStandardBg = false;
  let hasStandardFg = false;
  let customPropCount = 0;

  for (const decl of rule.declarations) {
    const prop = decl.property.toLowerCase().trim();
    const val = decl.value.toLowerCase().trim();

    if (prop === 'color-scheme' || val.includes('light-dark(')) {
      return false;
    }

    if (prop.startsWith('--')) {
      customPropCount++;
      if (!val.includes('url(')) {
        const hasBgWord = /(?:^|-)(?:bg|background)(?:-|$)/i.test(prop);
        const hasTextWord = /(?:^|-)(?:text|fg|foreground)(?:-|$)/i.test(prop);
        const hasColorWord = /(?:^|-)color(?:-|$)/i.test(prop);
        const hasSurfaceWord = /(?:^|-)surface(?:-|$)/i.test(prop);

        if ((hasBgWord || hasSurfaceWord) && !hasTextWord) {
          hasBackground = true;
        }
        if (hasTextWord || (hasColorWord && !hasBgWord)) {
          hasForeground = true;
        }
      }
      continue;
    }

    if (prop === 'background-color' || prop === 'background') {
      if (
        !val.includes('url(') &&
        val !== 'none' &&
        val !== 'transparent' &&
        val !== 'inherit' &&
        val !== 'initial'
      ) {
        hasBackground = true;
        hasStandardBg = true;
      }
    } else if (prop === 'color') {
      if (val !== 'inherit' && val !== 'initial' && val !== 'transparent') {
        hasForeground = true;
        hasStandardFg = true;
      }
    }
  }

  hasStandardBgAndFg = hasStandardBg && hasStandardFg;
  if (!hasStandardBgAndFg && customPropCount > 8) {
    const hasPairedLightRule =
      /(?:\.light|\.theme-light|\.light-theme|\.light-mode|\[data-theme\s*=\s*['"]?light['"]?\]|\[data-color-scheme\s*=\s*['"]?light['"]?\])/i.test(
        ctx.stylesheetText,
      );
    if (!hasPairedLightRule) {
      return false;
    }
  }

  return hasBackground && hasForeground;
}

const componentSpecificLightDarkThemeCssMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: [
    '.dark',
    'theme-dark',
    'dark-theme',
    'dark-mode',
    'data-theme',
    'data-color-scheme',
  ],
  matchRule: (styleRule: CssRuleView, ctx: CssMatcherContext) => {
    if (matchedCssContexts.has(ctx)) {
      return null;
    }

    // Skip if inside @media (prefers-color-scheme: ...) which belongs to dark-mode
    if (
      styleRule.parentAtRule &&
      styleRule.parentAtRule.toLowerCase().includes('prefers-color-scheme')
    ) {
      return null;
    }

    // Skip if stylesheet already uses light-dark()
    if (ctx.stylesheetHasValue('light-dark(')) {
      return null;
    }

    if (!isComponentDarkOverrideSelector(styleRule.selectorText, ctx)) {
      return null;
    }

    if (!hasSolidBackgroundAndForegroundOverride(styleRule, ctx)) {
      return null;
    }

    matchedCssContexts.add(ctx);

    return {
      message:
        'Component-scoped dark theme selector manually overrides surface background and text colors; set color-scheme: dark on the component and use light-dark() design tokens instead.',
    };
  },
};

export const componentSpecificLightDarkThemeRule: AnalyzerRule = {
  id: 'component-specific-light-dark-theme',
  guideId: 'component-specific-light-dark-theme',
  guideHash: COMPONENT_SPECIFIC_LIGHT_DARK_THEME_GUIDE_HASH,
  summary:
    'Override component-level themes by setting color-scheme: dark / light on the component surface with light-dark() design tokens instead of duplicating component color rules under .dark or [data-theme="dark"] selectors.',
  matcher: componentSpecificLightDarkThemeCssMatcher,
  verifierRubric: {
    keepWhen: [
      'A component-scoped selector (such as .dark .card, [data-theme="dark"] .panel, or pre.dark) manually overrides both surface background and foreground/text colors (or component color variables) to force a dark theme on that component.',
      'Setting color-scheme: dark on the component with light-dark() tokens modernizes the component subtree and adapts built-in browser UI (scrollbars, form controls) inside it.',
    ],
    dropWhen: [
      'The rule targets page-root selectors (:root, html, body), standalone root theme blocks ([data-theme="light"] { ... }), or is inside @media (prefers-color-scheme: dark), which is page-wide dark mode rather than a component-specific theme.',
      'The rule overrides third-party embedded widget theme palettes via custom property lists without a paired light-theme component rule in the stylesheet.',
      'The element does not establish its own background surface (e.g. only setting text color or icon filter), where setting color-scheme is forbidden by the guide.',
      'The selector is a single-property utility class (such as Tailwind .dark .dark\\:bg-slate-800) rather than a component surface.',
    ],
  },
};

export default [
  componentSpecificLightDarkThemeRule,
] satisfies readonly AnalyzerRule[];
