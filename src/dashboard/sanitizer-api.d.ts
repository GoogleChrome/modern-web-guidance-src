// Sanitizer API types. TypeScript 5.9's lib.dom doesn't have them yet; delete this file when it does.
// Both are declared as possibly absent so callers have to feature-detect (Safari hasn't shipped them).
// https://html.spec.whatwg.org/multipage/dynamic-markup-insertion.html#dom-element-sethtml

interface SanitizerConfig {
  elements?: string[];
  removeElements?: string[];
  replaceWithChildrenElements?: string[];
  attributes?: string[];
  removeAttributes?: string[];
  comments?: boolean;
  dataAttributes?: boolean;
  javascriptURLs?: boolean;
}

interface Sanitizer {
  get(): SanitizerConfig;
}

declare var Sanitizer: { new (config?: SanitizerConfig | 'default'): Sanitizer; prototype: Sanitizer } | undefined;

interface SetHTMLOptions {
  sanitizer?: Sanitizer | SanitizerConfig | 'default';
}

interface Element {
  setHTML?(html: string, options?: SetHTMLOptions): void;
}
