import type {
  AnalyzerRule,
  CssMatcherContext,
  CssRuleMatcher,
  CssRuleView,
} from '../schema.ts';

export const GROUP_ELEMENT_TRANSITIONS_GUIDE_HASH = '7732f9e90d92';

const VT_PSEUDO_GLOBAL_RE =
  /::view-transition-(group|old|new|image-pair)\(\s*([a-zA-Z0-9_-]+)\s*\)/g;

const NUMBERED_NAME_RE = /^([a-zA-Z_-]+?)[-_]?\d+$/;

const PAGE_LANDMARK_NAMES = new Set([
  'root',
  'main',
  'header',
  'footer',
  'nav',
  'sidebar',
  'top-bar',
  'footer-content',
  'page',
]);

function extractVtPseudos(text: string): { kind: string; name: string }[] {
  const results: { kind: string; name: string }[] = [];
  for (const m of text.matchAll(VT_PSEUDO_GLOBAL_RE)) {
    const kind = m[1];
    const name = m[2];
    if (kind && name && !PAGE_LANDMARK_NAMES.has(name.toLowerCase())) {
      results.push({ kind, name });
    }
  }
  return results;
}

export const groupElementTransitionsMatcher: CssRuleMatcher = {
  kind: 'css',
  fastTokens: ['::view-transition-'] as const,
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null {
    if (ctx.stylesheetText.includes('view-transition-class')) {
      return null;
    }

    const selector = styleRule.selectorText;
    // Carve out directional navigation selectors (html[data-transition=...], html.back, etc.)
    if (/\b(?:html|body|:root)\s*(?:\[|\.)/i.test(selector)) {
      return null;
    }

    const pseudosInSelector = extractVtPseudos(selector);
    if (pseudosInSelector.length === 0) {
      return null;
    }

    // Case 1: A comma-grouped selector list targeting >= 2 numbered items (e.g., card-1, card-2)
    // or >= 3 distinct item view-transition names of the same pseudo-element type
    const byKind = new Map<string, Set<string>>();
    const numberedPrefixesInSelector = new Map<string, Set<string>>();

    for (const { kind, name } of pseudosInSelector) {
      let names = byKind.get(kind);
      if (!names) {
        names = new Set<string>();
        byKind.set(kind, names);
      }
      names.add(name);

      const numMatch = NUMBERED_NAME_RE.exec(name);
      if (numMatch && numMatch[1]) {
        const key = `${kind}:${numMatch[1]}`;
        let set = numberedPrefixesInSelector.get(key);
        if (!set) {
          set = new Set<string>();
          numberedPrefixesInSelector.set(key, set);
        }
        set.add(name);
      }
    }

    for (const [, set] of numberedPrefixesInSelector) {
      if (set.size >= 2) {
        return {
          message:
            'Repeated numbered ::view-transition-* selectors for a group of elements; assign a shared view-transition-class and target ::view-transition-group(*.class) with a single rule.',
        };
      }
    }

    for (const [, names] of byKind) {
      if (names.size >= 3) {
        return {
          message:
            'Comma-grouped ::view-transition-* selectors styling multiple elements identically; assign a shared view-transition-class and target ::view-transition-group(*.class) with a single rule.',
        };
      }
    }

    // Case 2: Separate CSS rules across the stylesheet targeting >= 3 numbered items with the same prefix.
    // Fire only on the first matching rule for that prefix in the stylesheet.
    const firstPseudo = pseudosInSelector[0];
    if (!firstPseudo) {
      return null;
    }
    const numMatch = NUMBERED_NAME_RE.exec(firstPseudo.name);
    if (numMatch && numMatch[1]) {
      const prefix = numMatch[1];
      const allPseudos = extractVtPseudos(ctx.stylesheetText);
      const matchingNames: string[] = [];
      for (const p of allPseudos) {
        if (p.kind !== firstPseudo.kind) continue;
        const m = NUMBERED_NAME_RE.exec(p.name);
        if (m && m[1] === prefix) {
          matchingNames.push(p.name);
        }
      }
      const uniqueNames = new Set(matchingNames);
      if (uniqueNames.size >= 3 && matchingNames[0] === firstPseudo.name) {
        return {
          message:
            'Separate ::view-transition-* rules repeated for numbered item names; assign a shared view-transition-class and style all items with a single ::view-transition-group(*.class) rule.',
        };
      }
    }

    return null;
  },
};

export const groupElementTransitionsRule: AnalyzerRule = {
  id: 'group-element-transitions',
  guideId: 'group-element-transitions',
  guideHash: GROUP_ELEMENT_TRANSITIONS_GUIDE_HASH,
  summary:
    'Detects repeated or comma-grouped ::view-transition-group/old/new selectors for lists of elements instead of sharing a view-transition-class.',
  matcher: groupElementTransitionsMatcher,
  verifierRubric: {
    keepWhen: [
      'CSS rules repeating or comma-grouping multiple ::view-transition-group, ::view-transition-old, or ::view-transition-new selectors for list/grid items without view-transition-class',
    ],
    dropWhen: [
      'Stylesheet already using view-transition-class',
      'Single-element or page-level root/header/footer view transition rules',
    ],
  },
};

export default [groupElementTransitionsRule] satisfies readonly AnalyzerRule[];
