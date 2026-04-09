---
name: animate-to-intrinsic-sizes
description: Smoothly animate interactive components (like accordions, menus, and expanding cards) to and from their natural dimensions.
web-feature-ids:
  - calc-size
  - interpolate-size
sources:
  - https://developer.chrome.com/docs/css-ui/animate-to-height-auto
  - https://developer.chrome.com/blog/styling-details
  - https://12daysofweb.dev/2024/calc-size-and-interpolate-size/
  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/interpolate-size
  - https://www.bram.us/2024/12/24/animatable-accordions-2024-11-27-devs-gent/
  - https://css-tricks.com/almanac/properties/i/interpolate-size/
  - https://nerdy.dev/interpolate-size
  - https://www.joshwcomeau.com/snippets/html/interpolate-size/
---

# Animate to Intrinsic Sizes

Animating elements to dynamic sizes like `block-size: auto` or `inline-size: max-content` has historically required JavaScript or fragile "max-height" hacks. The `interpolate-size` property and `calc-size()` function allow the browser to natively interpolate between fixed lengths and intrinsic sizing keywords.

## Implementation steps

1.  **Opt-in to keyword interpolation**: Apply `interpolate-size: allow-keywords` to a parent element (typically `:root`) to enable transitions for properties using intrinsic keywords.
2.  **Define the transition**: Set a `transition` for the sizing property (e.g., `block-size`, `inline-size`) on the target element.
3.  **Use intrinsic keywords**: Change the sizing property to a keyword like `auto`, `min-content`, or `fit-content` during an interaction (e.g., `:hover` or a state class).
4.  **Perform calculations (Optional)**: Use `calc-size()` if you need to perform math on an intrinsic size (e.g., `auto + 2rem`).

## Example: Smooth Accordion Block-Size

```css
/* Opt-in globally for all children */
:root {
  /* MANDATORY: Transitions to intrinsic keywords are disabled by default for compatibility */
  interpolate-size: allow-keywords;
}

.accordion-content {
  block-size: 0;
  overflow: hidden;
  transition: block-size 0.3s ease-out;
}

.accordion-item.is-open .accordion-content {
  /* Now animates smoothly from 0 to the content's natural block-size */
  block-size: auto;
}
```

## Example: Calculated Intrinsic Inline-Size

```css
.badge {
  inline-size: 40px;
  overflow: hidden;
  white-space: nowrap;
  transition: inline-size 0.3s ease;
}

.badge:hover {
  /* calc-size(basis, calculation) */
  /* 'size' refers to the evaluated basis (max-content in this case) */
  inline-size: calc-size(max-content, size + 20px);
}
```

## Key constraints

*   **Keyword-to-Keyword Restriction**: You cannot animate between two different keywords directly (e.g., from `min-content` to `max-content`). One end of the transition must be a fixed length or percentage.
*   **Calc-size Syntax**: Inside `calc-size()`, you cannot mix different intrinsic keywords. The first argument (the basis) defines what `size` represents.
*   **Opt-in Requirement**: `interpolate-size: allow-keywords` is inherited. If you don't set it on a parent, transitions to keywords like `auto` will remain instant unless you use `calc-size()`, which opts in automatically.

## Fallback strategies

{{ BASELINE_STATUS("interpolate-size") }}

`interpolate-size` and `calc-size()` are progressive enhancements. Browsers that do not support them will perform an instant jump to the target size.

*   **Graceful Degradation**: For simple `block-size: auto` transitions, standard browsers will simply toggle the size instantly, which is functional but less polished.
*   **Manual keyword fallbacks**: When using `calc-size()`, always provide a standard keyword fallback for older browsers, as they will discard the entire `calc-size()` declaration.

```css
.card {
  block-size: auto; /* Fallback for older browsers */
  block-size: calc-size(auto, size); /* Modern browsers use this */
  transition: block-size 0.3s ease;
}
```

*   **Legacy Max-Size Hack**: If a smooth animation is critical for the experience in older browsers, you can use the traditional `max-block-size` approach inside an `@supports` block.

```css
@supports not (interpolate-size: allow-keywords) {
  .accordion-content {
    transition: max-block-size 0.3s ease;
    max-block-size: 0;
  }
  .is-open .accordion-content {
    max-block-size: 1000px; /* Arbitrary large value */
  }
}
```
