import type { SourceFile } from 'ts-morph';

/**
 * Axis 1 of Guide Triage: How easy it is to spot the guide's cleanest legacy sub-pattern statically without false alarms.
 * - `'direct-token'`: A dedicated vendor prefix (`::-webkit-scrollbar`, `-webkit-mask-image`), deprecated attribute (`importance="high"`), single-purpose package (`autosize`), or dedicated idiom (`.fadeOut()`) identifies the pattern directly (0–3% static misfire).
 * - `'structural-ast'`: Standard HTML, CSS, or JS combined in a 2–3 clause AST shape that proves intent (`<dialog>` backdrop click listener checking `e.target === dialog` and calling `.close()`, or a boolean `.is-stuck` class toggle on a `position: sticky` header; 3–10% static misfire).
 * - `'needs-verifier'`: A real legacy pattern written with an everyday general-purpose API (`setTimeout`, `ResizeObserver`, `document.visibilityState`, continuous `getBoundingClientRect` coordinate math) where static syntax looks identical to normal code (>50% static misfire; requires LLM Verifier or deferral).
 * - `'no-legacy-pattern'`: No client-side legacy code pattern to find — either a greenfield platform capability (`passkey-registration`, `agentic-forms`) or a guide whose applicability depends on human visual/semantic judgment (`adapt-scrollbar-to-contrast-preferences`, `accessible-generated-content`).
 */
export type Detection =
  | 'direct-token'
  | 'structural-ast'
  | 'needs-verifier'
  | 'no-legacy-pattern';

/**
 * Axis 2 of Guide Triage: What kind of code change the guide asks for (`'n/a'` when `Detection` is `'no-legacy-pattern'`).
 * - `'local-swap'`: Replacing or adding a property, selector, attribute, or call at the same site in the same language (including adding `autocomplete` attributes to form inputs or replacing `::-webkit-scrollbar` with `scrollbar-width` / `scrollbar-color`).
 * - `'cross-layer-refactor'`: Deleting imperative JS listeners, observers, or helper libraries and moving behavior into declarative CSS or HTML (`@starting-style`, `animation-timeline`, `:has()`, `field-sizing`, `closedby="any"`).
 * - `'widget-recipe'`: Coordinating HTML structure, CSS layout/styling, and JS behavior across multiple parts of a composite UI widget (`navigation-drawer`, `anchor-positioning-tab-underline`, `menu`).
 * - `'n/a'`: Applicable when `detection === 'no-legacy-pattern'`.
 */
export type UpdateScope =
  | 'local-swap'
  | 'cross-layer-refactor'
  | 'widget-recipe'
  | 'n/a';

/**
 * Upfront classification and scoping of a published feature guide, recording whether a static matcher is feasible, the migration update scope, and exact replaces / doesNotReplace bounds.
 */
export interface GuideTriage {
  readonly guideId: string;
  readonly guideHash: string;
  readonly detection: Detection;
  readonly updateScope: UpdateScope;
  readonly targetSubPattern: string;
  readonly replaces: readonly string[];
  readonly doesNotReplace: readonly string[];
  readonly reason: string;
  readonly modernFeature?: string;
  readonly falsePositiveTraps?: readonly string[];
  readonly category?: string;
  readonly provenance?: {
    readonly methodVersion: string;
    readonly model: string;
    readonly evaluatedAt: string;
    readonly sources: readonly string[];
  };
  readonly rationale?: string;
  readonly deferredSubPatterns?: readonly unknown[];
  readonly prevalence?: unknown;
}

/**
 * Pairing of unambiguous keepWhen and dropWhen rules used by the LLM Verifier to filter static matcher candidates down to true legacy workarounds.
 */
export interface VerifierRubric {
  readonly keepWhen: readonly string[];
  readonly dropWhen: readonly string[];
}

export type CanonicalJudgeVerdict =
  | 'legit-modernize-target'
  | 'not-old-pattern'
  | 'fallback-or-guard'
  | 'loses-behavior'
  | 'no-payoff'
  | 'guide-wrong'
  | 'unsure';

export type JudgeVerdict =
  | CanonicalJudgeVerdict
  | 'right'
  | 'leave-it';

export const CANONICAL_VERDICTS: ReadonlySet<string> = new Set([
  'legit-modernize-target',
  'not-old-pattern',
  'fallback-or-guard',
  'loses-behavior',
  'no-payoff',
  'guide-wrong',
  'unsure',
]);

export interface AnalyzerMatch {
  readonly line: number;
  readonly column?: number;
  readonly message: string;
  readonly isVendoredLibrary?: boolean;
  readonly subPattern?: string;
}

export interface DomElementView {
  readonly tagName: string;
  readonly attributes: Readonly<Record<string, string>>;
  readonly line: number;
  readonly column?: number;
  readonly isJsx?: boolean;
  readonly hasSpreadAttribute?: boolean;
  hasAttribute(name: string): boolean;
  getAttribute(name: string): string | null;
  hasDynamicAttribute?(name: string): boolean;
}

export interface DomMatcherContext {
  readonly filePath: string;
  readonly documentText: string;
}

export interface CssDeclaration {
  readonly property: string;
  readonly value: string;
}

export interface CssRuleView {
  readonly selectorText: string;
  readonly declarations: readonly CssDeclaration[];
  readonly line: number;
  readonly column?: number;
  readonly parentAtRule?: string | null;
  getPropertyValue(property: string): string | null;
  hasProperty(property: string): boolean;
}

export interface CssMatcherContext {
  readonly filePath: string;
  readonly stylesheetText: string;
  readonly styleRules?: readonly CssRuleView[];
  stylesheetHasProperty(prop: string): boolean;
  stylesheetHasValue(substr: string): boolean;
}

export interface JsMatcherContext {
  readonly filePath: string;
  readonly fileContent: string;
}

export interface DependencyMatcherContext {
  readonly filePath: string;
  readonly packageJson: Readonly<Record<string, unknown>>;
}

/**
 * Fast substring pre-filter evaluated before AST/CSS/DOM parsing and compiled
 * directly into corpus SQL predicates:
 * - `readonly string[]`: at least ONE token must appear (`t1 OR t2`)
 * - `readonly (readonly string[])[]`: EVERY inner group must have >=1 match (`(a1 OR a2) AND (b1 OR b2)`)
 */
export type FastTokenSpec = readonly string[] | readonly (readonly string[])[];

export interface JsRuleMatcher {
  readonly kind: 'js';
  readonly fastTokens: FastTokenSpec;
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[];
}

export interface DomRuleMatcher {
  readonly kind: 'dom';
  readonly selector: string;
  readonly fastTokens: FastTokenSpec;
  readonly skipIfHasSpread?: boolean;
  readonly skipIfDynamicAttributes?: readonly string[];
  matchElement(element: DomElementView, ctx: DomMatcherContext): { message: string; subPattern?: string } | null;
}

export interface CssRuleMatcher {
  readonly kind: 'css';
  readonly fastTokens: FastTokenSpec;
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string; subPattern?: string } | null;
}

export interface DependencyRuleMatcher {
  readonly kind: 'dependency';
  readonly packages: readonly string[];
  matchPackage?(
    pkgName: string,
    versionRange: string,
    ctx: DependencyMatcherContext,
  ): { message: string } | null;
}

export type RuleMatcher =
  | JsRuleMatcher
  | DomRuleMatcher
  | CssRuleMatcher
  | DependencyRuleMatcher;

/**
 * Static Matcher rule contract binding a pattern id, guide hash, high-recall matcher (JS, CSS, DOM, or dependency), and VerifierRubric.
 */
export interface AnalyzerRule {
  readonly id: string;
  readonly guideId: string;
  readonly guideHash: string;
  readonly summary: string;
  readonly matcher: RuleMatcher;
  readonly verifierRubric: VerifierRubric;
}

export interface AnalyzerFinding {
  readonly cardId: string;
  readonly ruleId: string;
  readonly guideId: string;
  readonly guideHash: string;
  readonly repo: string;
  readonly commit: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly codeSnippet: string;
  readonly contextSlice: string;
  readonly isVendoredLibrary?: boolean;
  readonly subPattern?: string;
}
