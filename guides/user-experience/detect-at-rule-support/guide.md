---
name: detect-at-rule-support
description: Apply CSS only when the browser supports a specific at-rule, enabling progressive enhancement for new CSS at-rules without JavaScript.
web-feature-ids:
  - supports-at-rule
sources:
  - https://drafts.csswg.org/css-conditional-5/#typedef-supports-at-rule-fn
  - https://developer.mozilla.org/en-US/docs/Web/CSS/@supports
  - https://www.bram.us/2026/03/15/at-rule/
---

The `at-rule()` function inside `@supports` checks whether the browser recognizes a specific CSS at-rule. It lets you wrap CSS that depends on a new at-rule (such as `@starting-style`, `@view-transition`, `@scope`, `@property`, or `@container`) in a feature query so the rules apply only where they will work, and your baseline styles cover everywhere else. Property-value detection like `@supports (transition-behavior: allow-discrete)` cannot reliably stand in for at-rule detection, because a property may exist independently of the at-rule it pairs with.

## Implementation

### 1. Wrap enhanced CSS in `@supports at-rule(@<keyword>)`

MANDATORY: Place the styles that depend on a new at-rule inside an `@supports at-rule(@<at-keyword>) { ... }` block. The argument is a single at-keyword token starting with `@`.

```css
/* Baseline styles apply everywhere, including browsers without at-rule() support. */
.entry-card {
  opacity: 1;
  /* Example value only: tune to your design. */
  transition: opacity 0.3s ease-out;
}

/* Enhanced styles apply only when the browser recognizes @starting-style. */
@supports at-rule(@starting-style) {
  @starting-style {
    .entry-card {
      opacity: 0;
    }
  }
}
```

### 2. Keep baseline styles outside the supports block

MANDATORY: Define the universal styling at the top level. `at-rule()` is a one-way enhancement switch, not a two-way branch. Browsers that do not understand `at-rule()` treat the whole condition as "unknown", and the body is dropped — so anything you put inside the block is invisible to those browsers.

```css
/* This rule always applies, even where at-rule() is unsupported. */
.callout {
  background: #f0f0f0;
}

/* Only applied where the at-rule is recognized. */
@supports at-rule(@view-transition) {
  .callout {
    background: lightblue;
  }
}
```

### 3. Use `not at-rule(...)` only when the negation is actually meaningful

DO use `@supports not at-rule(@<at-keyword>) { ... }` to scope styles to browsers that DO support the function but explicitly DO NOT recognize the named at-rule.

DO NOT assume `not at-rule(...)` reaches every old browser. In a browser that does not implement the `at-rule()` function at all, the condition resolves to "unknown", and `not unknown` is still treated as not-true — so the body is dropped there, the same as the positive form. If you want styling for older browsers, write it OUTSIDE any `@supports` block.

```css
/* Reliable fallback: always-on baseline. */
.timeline {
  scroll-behavior: smooth;
}

/* Only fires in modern browsers that implement at-rule() AND do not recognize this keyword. */
@supports not at-rule(@scope) {
  .timeline-section {
    /* Workaround styling here. */
    isolation: isolate;
  }
}
```

### 4. Pass only an at-keyword — never descriptors, preludes, or blocks

DO NOT pass anything other than a bare at-keyword to `at-rule(...)`. The function is grammar-checked against `<at-keyword-token>` — it accepts `@container`, but rejects `@container (width > 400px)`, `@counter-style { system: fixed }`, and similar.

DO NOT use `at-rule()` to detect a specific at-rule prelude (for example, style queries inside `@container`). The function returns true as soon as the UA recognizes the at-keyword, regardless of which prelude grammars or descriptors it accepts. Use property/value or `selector()` checks for those.

DO NOT pass `@charset` to `at-rule()`. The spec explicitly excludes it because `@charset` is not classified as an at-rule.

```css
/* DO */
@supports at-rule(@container) { /* ... */ }

/* DO NOT — preludes are not part of the function's grammar. */
@supports at-rule(@container (width > 400px)) { /* invalid */ }

/* DO NOT — descriptors are not part of the function's grammar. */
@supports at-rule(@counter-style; system: fixed) { /* invalid */ }
```

### 5. Combine with property and selector checks via `and` / `or`

DO compose `at-rule()` with the rest of the supports-condition grammar when an enhancement depends on multiple things being supported.

```css
/* Apply only when BOTH the at-rule and the discrete-transition behavior are supported. */
@supports at-rule(@starting-style) and (transition-behavior: allow-discrete) {
  /* ... */
}
```

### 6. Optionally gate a whole stylesheet with `@import ... supports(at-rule(...))`

DO use the same syntax inside an `@import` clause when an entire stylesheet depends on the at-rule. Browsers that do not support the function will not load the stylesheet — which is desirable because its rules would do nothing for them.

```css
/* Only loaded by browsers that recognize @view-transition. */
@import "view-transitions.css" supports(at-rule(@view-transition));
```

### 7. Detecting from JavaScript

DO use `CSS.supports("at-rule(@<keyword>)")` for JavaScript-driven feature detection. The entire supports-condition goes inside the string. Browsers that do not implement the `at-rule()` function return `false` (not throw), so this is safe to call unconditionally.

DO NOT use the returned boolean to differentiate "at-rule unsupported" from "detection function unsupported". A `false` return means EITHER the named at-rule is unrecognized OR the `at-rule()` function itself is not implemented. If you need to disambiguate, probe with a known-recognized at-keyword: `CSS.supports("at-rule(@media)")` returns true on every browser that implements the function (because `@media` has been recognized for decades). If that probe is true and your target keyword's probe is false, the at-rule itself is the unsupported piece. Probes for other features such as `:has()` shipped years before `at-rule()` did, so they confirm modernity but cannot tell you whether the function is present.

```js
// Example: branch dynamic logic on at-rule support.
if (CSS.supports("at-rule(@starting-style)")) {
  // The browser recognizes @starting-style.
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("supports-at-rule") }}

In browsers that do not support the `at-rule()` function, every `@supports at-rule(...)` and `@supports not at-rule(...)` condition resolves to "unknown" and is treated as not-true. The body of the block is silently skipped. This means:

- Place the universal experience at the top level of your stylesheet, outside any `@supports at-rule(...)` block. It will then apply in every browser, including those without `at-rule()` support.
- Treat `@supports at-rule(...)` strictly as a way to LAYER enhancements on top of the baseline. Do not use it to deliver fallback styles to older browsers.
- For runtime branches, check `CSS.supports("at-rule(@<keyword>)")` from JavaScript. The boolean it returns will be `false` both when the browser lacks the function and when the function exists but the at-rule is unrecognized — which is the behavior you want for "should I show the enhanced experience?".
- When the same at-rule has a feature-flag-style fallback (for example, a JS-driven entry animation in place of `@starting-style`), feature-detect with `'at-rule(@<keyword>)' in CSS` is NOT a valid pattern; use `CSS.supports("at-rule(@<keyword>)")` instead.
