---
name: atrule-support-conditionals
description: Conditionally apply certain CSS rules or declarations only if a certain at-rule is supported by the browser.
web-feature-ids:
  - supports-at-rule
draft: true
---

Use  `@supports at-rule(<at-rule name>) {…}` to conditionally apply certain CSS rules or declarations only if a certain at-rule is supported by the browser.
This can contain entire rules, or be used in conjunction with CSS nesting to conditionally apply certain declarations.

```css
.foo {
  background: var(--accent-color);

  @supports at-rule(@property) {
    background-image: var(--rainbow-gradient);
    animation: sliding-rainbow 1s linear infinite;
  }
}
```

Do NOT use `@supports at-rule()` to conditionally apply the at-rule being detected and nothing else.
I.e. don't do this:

```css
@supports at-rule(@starting-style) {
  @starting-style {
    /* ... */
  }
}
```

Regular CSS graceful parsing will already ignore rules the browser doesn't understand, so this is unnecessary.


## Detecting support for at-rules when `at-rule()` is not an option.

To conditionally apply CSS based on support for at-rules when `at-rule()` is not an option, you can use the guidance below.

### Try properties, values, or selectors first

`@supports` can already detect properties, values, and selectors (via `@supports selector(...)`).
In many cases, you can use these to detect support for a feature without needing to check for the at-rule itself.

For example, instead of `@supports at-rule(@function)` to detect supports for custom functions, you can use `@supports (color: --foo())`.

In other cases there may be pseudo-classes or pseudo-elements that are only available when a certain at-rule is supported, which can be used to detect support.

### Detecting container query types

`at-rule()` ONLY allows detection of at-rules by **name**.
It does NOT allow detection of other syntax or descriptors.
E.g. this will not work:

```css
@supports at-rule(@container style(--a: 1)) {
  /* ... */
}
```

For many types of container queries, you can use `container-type` with a suitable value.
E.g. `@supports (container-type: scroll-state)` for scroll-state queries or `@supports (container-type: size)`container-type: anchored` for `anchored()` queries.

However, there is no `container-type` for style queries.
IMPORTANT: Do NOT try `@supports (container-type: style)` to detect support for style queries, as this will not work.

Instead, you can try a style query that is always true:

```css
@container style(--a: 1) or (not (style(--a: 1))) {
  /* Rules here will only be applied if style queries are supported */
}
```

This will match in any browser that supports style queries, regardless of what property name or value you use, provided they are the same across both.

### Registered custom properties (`@property`)

TBD

### Using JavaScript as a last resort

TBD

## Fallback strategies

{{ BASELINE_STATUS("supports-at-rule") }}

Unless this is within your support target, **ONLY** use `@supports (at-rule(@property))` to detect at-rules for which support is narrower than the `@supports (at-rule())` feature itself.

To conditionally apply CSS based on support for at-rules that shipped before this feature, use the guidance in the section above.

To detect support for the `@supports at-rule()` feature itself, you can use an at-rule that is guaranteed to exist in all browsers that support `@supports at-rule()`, such as `@supports at-rule(@media) { ... }`.


### `@property` { #supports-atproperty }

TBD

### Style queries
