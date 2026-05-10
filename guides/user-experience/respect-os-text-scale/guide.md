---
name: respect-os-text-scale
description: Respect the operating system's text scale preference for a page so font sizes, layout, and rem-based measurements follow the user's accessibility settings.
web-feature-ids:
  - meta-text-scale
sources:
  - https://drafts.csswg.org/css-fonts-5/#text-scale-meta
  - https://github.com/w3c/csswg-drafts/blob/main/css-env-1/explainers/meta-text-scale.md
  - https://drafts.csswg.org/css-env-1/#preferred-text-scale
  - https://chromestatus.com/feature/5112244702674944
---

The `<meta name="text-scale" content="scale">` HTML element opts the document into the user's OS-level text scale preference. With it, the user agent's initial font size (the computed value of `font-size: medium`) becomes `16px x OS-level scale x UA-level scale`, so any text already sized with font-relative units (`rem`, `em`) follows the user's accessibility settings without further work. Without it, the document keeps the legacy 16px baseline; OS-level text preferences are surfaced only via heuristic mobile text autosizing and (on Windows) full-application zoom, neither of which scales font-relative units directly.

Use this when the page is already built with `rem` or `em` for body text and you want a one-line opt-in to system font scaling. Pages that hard-code text in `px` will not visibly change just by adding the meta tag.

## Implementation

### 1. Add the meta tag inside `<head>`

MANDATORY: Place exactly one `<meta name="text-scale" content="scale">` element inside the document `<head>`. The `content` value must be the literal token `scale` (case-insensitive). The spec recognizes only `scale` and `legacy`; any other value, or a missing `content` attribute, causes the tag to be ignored. An ignored tag and `content="legacy"` both resolve to the same legacy behaviour, but only `legacy` is an explicit, spec-recognized opt-in.

```html
<!doctype html>
<html lang="en">
  <head>
    <!-- Opt the document into OS-level text scaling. Must live in <head>. -->
    <meta name="text-scale" content="scale" />
  </head>
  <body>
    <!-- ... -->
  </body>
</html>
```

### 2. Size text in `rem` (or `em`) so it actually scales

MANDATORY: Use font-relative units for any text that should follow the user's preference. The meta tag changes the root `font-size` (`medium`); text declared in physical units like `px`, `pt`, or `cm` is unaffected. Mixing the two is not an error but defeats the opt-in for the `px` text.

```css
/* DO: rem and em scale with the user's preference. */
body {
  /* 1rem resolves to 16px x OS scale x UA scale when the meta tag is present. */
  font-size: 1rem;
  line-height: 1.5;
}

h1 {
  font-size: 2rem;
}

.callout {
  /* em is relative to the parent's computed font-size, so it scales transitively. */
  font-size: 1.125em;
}

/* DO NOT: px ignores the meta tag and stays at the authored size. */
.legal-fine-print {
  font-size: 12px;
}
```

### 3. Drop manual scaling workarounds when you adopt the meta tag

Remove any ad-hoc scaling such as `:root { font-size: calc(1rem * env(preferred-text-scale)); }` once `content="scale"` is in place. The meta tag already folds `env(preferred-text-scale)` into the root font size, so re-applying it via CSS scales the page twice. Likewise, do not pair `content="scale"` with `text-size-adjust: auto` (or any non-`none` value): with `scale` set, the user agent has already disabled mobile text autosizing and Windows full-page zoom, and re-enabling the autosizer makes it compete with the OS-level scale.

```css
/* Anti-pattern: with content="scale" set, this calc is applied on top of an already-scaled root. */
:root {
  font-size: calc(1rem * env(preferred-text-scale));
}
```

### 4. Use the `legacy` value only to pin the old behaviour

`<meta name="text-scale" content="legacy">` is meaningful only when you specifically need to document that the page must not follow OS-level text scale. `legacy` is also the result when the tag is absent or the `content` value is unrecognized, so the explicit form adds no behaviour, just intent. `scale` is the only opt-in keyword; no other values are defined today.

### 5. Keep at most one `text-scale` meta element per document

The spec forbids more than one `<meta name="text-scale">` element in a document and does not define behaviour when multiple are present, so do not rely on first-wins or last-wins. If a layout system or framework already injects one, replace it rather than adding a sibling.

### 6. Plan the layout for larger text before shipping

Test the page at elevated scale factors before deploying `content="scale"`. The canonical path is to change the OS-level text-size setting (Windows: Settings > Accessibility > Text size; macOS: System Settings > Displays; Android: Settings > Display > Font size; iOS: Settings > Display & Brightness > Text Size) and reload the page. Mobile users change their OS-level font scale far more often than desktop users do, and the most common regression on opt-in is content overflowing narrow viewports or columns becoming too tight. Container queries and intrinsic layouts (`min()`, `clamp()`, `auto-fit` grids) absorb the change far better than fixed `px` widths.

```css
/* DO: let containers reflow when text grows. */
.card-grid {
  display: grid;
  /* min(100%, 18rem) shrinks the column when the available inline size is small. */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1rem;
}
```

## Fallback strategies

{{ FEATURE_FALLBACKS("meta-text-scale") }}

The meta tag is purely additive. Browsers that do not recognize `name="text-scale"` ignore it entirely and continue with their existing behaviour: text autosizing on mobile, full-application zoom on Windows, and OS-level preferences otherwise unobserved. There is no feature-detection probe for this meta tag, the element has no IDL surface, and no polyfill can recreate the effect because changing the computed value of `font-size: medium` requires UA-level cooperation. The graceful degradation is the legacy behaviour itself, so the meta tag is safe to ship unconditionally.

### Alternative: per-element opt-in for pages that omit the meta tag

`env(preferred-text-scale)` is the per-element opt-in alternative for pages that cannot adopt `content="scale"` (for example, where the layout cannot yet absorb a doubled font size). It returns the OS-level scale on mobile in legacy mode and resolves to `1` on desktop in legacy mode, so the `calc()` collapses to a no-op rather than failing. Do NOT combine this rule with `<meta name="text-scale" content="scale">` on the same page: with `scale` set, `env()` already reflects the active factor, and re-applying it via `calc()` would scale the element twice.

```css
.article-body {
  font-size: calc(1rem * env(preferred-text-scale, 1));
  /* Required so the mobile autosizer does not compete with env(). */
  text-size-adjust: none;
}
```
