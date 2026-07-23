# cssomnom

A high-performance, zero-dependency, spec-compliant CSS Object Model (CSSOM) parser and query engine in pure TypeScript. Purpose-built for static analysis, testing, and non-browser environments.

## Why cssomnom?

Other tools like PostCSS and CSSTree expose custom Abstract Syntax Trees (ASTs) that require learning tool-specific APIs to navigate. 

`cssomnom` implements the standard **W3C CSS Object Model (CSSOM)** API. You get a familiar, standardized interface to query styles directly in Node.js. For example, you can use `stylesheet.cssRules[0].style.getPropertyValue('color')` instead of writing complex AST traversal code.

It is uniquely suited for **static analysis** and **automated grading** where you need to evaluate CSS rules against DOM structures without the overhead of a full browser environment.

## Features

*   **Full Spec Compliance**: Implements CSS Syntax Module Level 3, CSSOM Level 1, CSS Nesting, CSS Logical Properties, and Houdini specifications (Properties and Values API, Typed OM Level 1 & 2).
*   **Cascade Resolution**: Query which styles apply to a mock element without a real DOM using `getCascadedStyle`.
*   **Houdini Powered**: Full support for `CSS.registerProperty()`, `CSSNumericValue.parse()`, and complex math functions (e.g., `calc`, `sin`, `atan2`).
*   **Fast and Buildless-Ready**: Executes directly in Node.js 24.11.0+ without a build step for development, or can be consumed as a pre-bundled ESM package.

## Quick Start

```typescript
import { Parser } from './src/parser.ts';
import { tokenize } from './src/tokenizer.ts';

const css = `
  body { color: red; }
  @media (max-width: 600px) {
    body { color: blue; }
  }
`;

const tokens = tokenize(css);
const parser = new Parser(tokens);
const stylesheet = parser.parseStyleSheet();

// Query styles directly using standard CSSOM
console.log(stylesheet.cssRules[0].style.getPropertyValue('color')); // 'red'
```

## Advanced Usage

### Static Analysis & Cascade Resolution

You can compute the "cascaded" style for a mock element without a real DOM. This is highly useful for testing and static analysis graders.

```typescript
import { Parser } from './src/parser.ts';
import { getCascadedStyle } from './src/cascade.ts';
import { tokenize } from './src/tokenizer.ts';

const css = `
  .box { color: red; }
  .box.highlight { color: blue; }
`;
const stylesheet = new Parser(tokenize(css)).parseStyleSheet();

// Provide a mock element with a matches() method
const element = {
  matches(selector: string) {
    return selector === '.box.highlight' || selector === '.box';
  }
};

const style = getCascadedStyle(element, Array.from(stylesheet.cssRules));
console.log(style.getPropertyValue('color')); // 'blue' (due to higher specificity)
```

### CSS Typed OM and Math Functions

Parse complex math and convert units directly according to the Typed OM spec.

```typescript
import { CSSNumericValue } from './src/typed-om.ts';

// Parse complex math with unit conversion
const length = CSSNumericValue.parse('calc(1in + 96px)');
console.log(length.toString()); // '192px' (eagerly simplified to canonical unit)

const angle = CSSNumericValue.parse('calc(45deg + 0.25turn)');
console.log(angle.toString()); // '135deg'
```

### Registering Custom Properties (Houdini)

Register custom properties with syntax validation, just like in the browser.

```typescript
import { CSS } from './src/parser-api.ts';

CSS.registerProperty({
  name: '--main-color',
  syntax: '<color>',
  inherits: false,
  initialValue: 'red'
});
```

## API Reference

This library implements standard CSSOM interfaces. For documentation on standard interfaces like `CSSStyleSheet`, `CSSStyleRule`, and `CSSStyleDeclaration`, please refer to the [MDN Web Docs on CSSOM](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Object_Model).

Below are the custom entry points and utilities provided by `cssomnom`.

### Tokenization & Parsing

*   **`tokenize(css: string): Token[]`**
    Standard synchronous tokenizer. Returns an array of CSS tokens.
*   **`new StreamingTokenizer()`**
    Class for processing CSS in chunks (e.g., from a stream). Use `.appendChunk(chunk)` and `.getTokens()`.
*   **`new Parser(tokens: Token[], options?: ParserOptions)`**
    The main parser instance. Use `parser.parseStyleSheet()` to get a `CSSStyleSheet`.
*   **`CSS.parseStylesheet(css: string): Promise<CSSParserRule[]>`**
    Houdini-style async parser entry point.

### Parser Utilities (Static Methods)

Convenience methods on the `Parser` class for common tasks without manual tokenization:

*   `Parser.parseRuleText(css: string): Rule` - Parses a single CSS rule string.
*   `Parser.parseStyleSheetText(css: string): Rule[]` - Parses a stylesheet string into an array of rules.
*   `Parser.parseSelector(css: string): string | null` - Parses and validates a selector string.
*   `Parser.parseSelectorAST(css: string): SelectorList | null` - Parses a selector string into an AST.
*   `Parser.calculateSpecificity(selector: string | SelectorList): [number, number, number] | [number, number, number][]` - Calculates specificity for a selector or list of selectors.
*   `Parser.resolveVariables(style: CSSStyleDeclaration, property: string): string` - Resolves `var()` and `env()` functions for a property in a declaration.

### Serialization

*   **`serialize(nodes: ComponentValue[] | Token[]): string`**
    Utility to serialize raw AST nodes or tokens back into a CSS string.
*   **`Rule.cssText` and `CSSStyleDeclaration.cssText`**
    Standard CSSOM way to serialize rules and declarations.

### Query & Analysis

*   **`getCascadedStyle(element: MatchableElement, rules: Rule[]): CSSStyleDeclaration`**
    Computes the cascaded style for a mock element (useful for static analysis).
*   **`Parser.calculateSpecificity(selector: string | SelectorList)`**
    Calculates specificity arrays `[a, b, c]`.

## Development

Run type checking:
```bash
pnpm run typecheck
```

Run tests:
```bash
pnpm test
```

## Project Documents

- `PLAN.md`: High-level project plan and roadmap.
- `AGENTS.md`: Instructions and context for AI agents working on this repo.
- `API_BOUNDARIES.md`: Documentation of spec boundaries and custom bridges.
