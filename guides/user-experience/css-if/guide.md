---
name: css-if
description: Apply responsive and reactive styling inline using the CSS if() function without separate media or container blocks.
web-feature-ids:
  - if
sources:
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/if
  - https://drafts.csswg.org/css-values-5/#if-notation
---

# Inline responsive styling with CSS if()

The `if()` CSS function allows developers to apply different values to a CSS property based on conditions like media queries or style queries directly inline. This simplifies styling by reducing the need for separate `@media` or `@container` rule blocks for localized changes.

## Security Considerations

DO NOT programmatically generate CSS strings using `if()` with unsanitized user input (e.g., string concatenation). Because `if()` uses semicolons as internal delimiters, attackers can inject payloads to break out of the function and inject arbitrary CSS. Use the CSS Object Model (`setProperty`) instead.

DO NOT use the `if()` function for security-critical logic, such as hiding sensitive UI. If a browser does not support `if()`, or if no condition matches and no `else:` clause is provided, the UI will fail open and fall back to the base declaration, which could expose restricted content.

## Provide inline reactive values

MANDATORY: Define a base fallback property value first for browsers that do not support the `if()` function. Then provide the `if()` declaration immediately after.

MANDATORY: Always include an `else:` clause in your `if()` functions. If conditions fail to match and no `else` is provided, the function evaluates to an invalid value and wipes out the static fallback in browsers that support `if()`.

DO: Structure the `if()` function by providing one or more condition-value pairs separated by colons, and clauses separated by semicolons, followed by the mandatory `else:` fallback. Note that conditions within `media()` and `style()` wrappers require extra parentheses (e.g., `media((min-width: 600px))`).

WARNING: The `if()` function does NOT use the inline ternary (`? :`) syntax or comma separation. You MUST use colons (`:`) to separate conditions from values, and semicolons (`;`) to separate clauses.

WARNING: Conditions within `media()` and `style()` MUST be enclosed in their own set of parentheses. For example, `style(--theme: dark)` is invalid; you MUST write `style((--theme: dark))`. Similarly, use `media((min-width: 600px))`.
```css
.card {
  /* Set fallback padding for unsupported browsers */
  padding: 1rem;
  /* Use if() to change padding based on viewport size inline */
  padding: if(
    media((min-width: 600px)): 2rem;
    else: 1rem
  );
  
  /* Set fallback background for unsupported browsers */
  background-color: white;
  /* Use if() to respond to custom properties (style queries) */
  background-color: if(
    style((--theme: dark)): black;
    else: white
  );
}
```

## Fallbacks & browser support

{{ BASELINE_STATUS("if") }}

The `if()` function is not yet universally supported.

To ensure graceful degradation, always provide a standard property declaration with a static value immediately before the `if()` declaration. Browsers that do not recognize the `if()` function will discard the second declaration and fall back to the first.
