import type { SourceFile } from 'ts-morph';

/**
 * Gate 0 triage bucket classifying whether a published feature guide has a statically detectable brownfield target (`D-005`):
 * - `'detectable'`: The guide replaces a concrete, statically identifiable legacy browser API, CSS property/selector workaround, DOM markup pattern, or third-party package in brownfield code.
 * - `'ui-recipe-multi-part'`: The guide teaches a multi-element UI component or architectural recipe (e.g. carousel, tabs, navigation drawer) where legacy implementations vary wildly and lack a single high-precision static code hook.
 * - `'skip-no-old-way'`: The guide introduces a net-new web platform capability (e.g. WebGPU, WebNN, Passkeys, Prompt API) with no direct legacy browser workaround to migrate from.
 */
export type Gate0Classification =
  | 'detectable'
  | 'ui-recipe-multi-part'
  | 'skip-no-old-way';

export interface Gate0Entry {
  readonly guideId: string;
  readonly guideHash: string;
  readonly classification: Gate0Classification;
  readonly brownfieldTarget: string;
  readonly evidenceFromGuide?: string;
  readonly reason: string;
  readonly gate0PromptVersion?: string;
}

export interface Phase2Rubric {
  readonly keepWhen: readonly string[];
  readonly dropWhen: readonly string[];
}

export interface AnalyzerMatch {
  readonly line: number;
  readonly column?: number;
  readonly message: string;
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

export interface JsRuleMatcher {
  readonly kind: 'js';
  readonly fastTokens?: readonly string[];
  matchFile(sourceFile: SourceFile, ctx: JsMatcherContext): AnalyzerMatch[];
}

export interface DomRuleMatcher {
  readonly kind: 'dom';
  readonly selector: string;
  readonly fastTokens?: readonly string[];
  readonly skipIfHasSpread?: boolean;
  readonly skipIfDynamicAttributes?: readonly string[];
  matchElement(element: DomElementView, ctx: DomMatcherContext): { message: string } | null;
}

export interface CssRuleMatcher {
  readonly kind: 'css';
  readonly fastTokens?: readonly string[];
  matchRule(styleRule: CssRuleView, ctx: CssMatcherContext): { message: string } | null;
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

export interface AnalyzerRule {
  readonly id: string;
  readonly guideId: string;
  readonly guideHash: string;
  readonly summary: string;
  readonly matcher: RuleMatcher;
  readonly phase2Rubric: Phase2Rubric;
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
  readonly astSlice: string;
}
