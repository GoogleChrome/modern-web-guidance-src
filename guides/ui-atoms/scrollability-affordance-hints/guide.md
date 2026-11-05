---
name: scrollability-affordance-hints
description: Build scroll shadows or fading edges that appear only when there's actually more content to scroll to in that direction.
web-feature-ids:
  - container-scroll-state-queries
  - scroll-driven-animations
---

# Scrollability Affordance Hints

## Overview

Scrollability hints show users that a region has more content in a given direction, and disappear at that end of the content. There are two kinds:

- **Shadows** are drawn over the edge of the scrollport, as if the content were tucked under it. Show them with scroll-state container queries on pseudo-elements of the scroller.
- **Fades** make the content itself fade out at the edge. Draw them with a `mask-image` on the scroller, driven by a scroll-driven animation.

Both need no scroll listeners and no extra elements in the markup.

## Choosing between a shadow and a fade

Use a **fade** when:
- The scroller scrolls horizontally through a row of items (tabs, chips, carousels). Items cut off by a fade read as "more of the same".
- The background is not a solid color (gradients, images, translucent surfaces). A mask makes content transparent instead of painting over it, so it works on any background.
- The scroller has no visible boundary. A fade needs no edge to tuck content under.

Use a **shadow** when:
- The content must stay legible right up to the edge (long text, tables, forms). A fade makes content near the edge hard to read.
- The scroller is bounded by fixed chrome, such as a dialog's header and footer or a table's sticky header. The shadow makes the chrome look raised above the content.

If neither applies, default to a shadow for vertical scrollers and a fade for horizontal ones.

## Shadows

### 1. Make the scroller a scroll-state container

```css
.scroller {
  overflow-y: auto;
  container-type: scroll-state;
}
```

### 2. Draw the shadows with `::before` and `::after`

DO NOT add indicator elements to the markup. The scroller's own `::before` and `::after` are its first and last children, so `position: sticky` keeps them at the edges of the scrollport. Their negative margins cancel out their height, so they take no space.

```css
.scroller::before,
.scroller::after {
  content: "";
  display: block;
  position: sticky;
  /* Example value: how far the shadow reaches into the content */
  block-size: .75rem;
  /* Paint above positioned content */
  z-index: 1;
  /* Let clicks through to the content underneath */
  pointer-events: none;
  opacity: 0;
  transition: opacity .2s;
}

/* Radial, so the shadow curves and tapers off at the sides. Keep it subtle: it should not compete with the content. */
.scroller::before {
  inset-block-start: 0;
  margin-block-end: -.75rem;
  background: radial-gradient(farthest-side at 50% 0, rgb(0 0 0 / .15), transparent);
}

.scroller::after {
  inset-block-end: 0;
  margin-block-start: -.75rem;
  background: radial-gradient(farthest-side at 50% 100%, rgb(0 0 0 / .15), transparent);
}
```

The pseudo-elements take part in the scroller's layout even while hidden. This works best when the scroller uses block layout, or a single-column grid or flex column layout.

### 3. Show each shadow when there is content beyond its edge

Pseudo-elements can query their own originating element, so the scroller's `::before` and `::after` respond to its scroll state.

```css
@container scroll-state(scrollable: block-start) {
  .scroller::before {
    opacity: 1;
  }
}

@container scroll-state(scrollable: block-end) {
  .scroller::after {
    opacity: 1;
  }
}
```

## Fades

Fade the content with a `mask-image` gradient on the scroller itself. Animate the gradient's stops with a scroll-driven animation on the scroller's own scroll position: each fade grows from 0 as the user scrolls away from that end, and shrinks back to 0 as they reach the other end. When the content fits, the scroll timeline is inactive and there is no fade.

```css
@property --fade-start {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

@property --fade-end {
  syntax: "<length>";
  inherits: false;
  initial-value: 0px;
}

.scroller {
  overflow-x: auto;
  /* Example value: how far each fade reaches */
  --fade-size: 3rem;
  mask-image: linear-gradient(to right, transparent, black var(--fade-start),
    black calc(100% - var(--fade-end)), transparent);
  animation: reveal-fade-start linear both, hide-fade-end linear both;
  animation-timeline: scroll(self inline);
  /* Each fade animates over the first or last --fade-size of scrolling */
  animation-range: 0 var(--fade-size), calc(100% - var(--fade-size)) 100%;
}

@keyframes reveal-fade-start {
  to {
    --fade-start: var(--fade-size);
  }
}

@keyframes hide-fade-end {
  from {
    --fade-end: var(--fade-size);
  }
}
```

- MANDATORY: Register `--fade-start` and `--fade-end` with `@property`. Unregistered custom properties do not interpolate, so the fades would jump.
- Set `scroll-padding-inline` (or `scroll-padding-block`) to the fade size if the scroller uses scroll snapping or contains focusable items, so snapped and focused items never stop inside a fade.
- For vertical scrollers, use `to bottom`, `scroll(self block)`, and `overflow-y`.
- For right-to-left content, use `to left` in the gradient: `mask-image` gradients do not follow the writing direction.

## Accessibility considerations

Scrollability affordance hints are intended to supplement existing browser behaviour and help people be aware of larger scrollable regions. As a result of these hints being supplemental, and secondary to the primary hint (which would be the default scrollbar, or a sufficiently contrasting custom scrollbar), these scrollability affordance hints do not have to meet a specific contrast threshold. If the author wants to remove the scrollbar (which is not recommended for many usability reasons), then the scrollability affordance hint must have a contrast ratio of 3:1 against any immediately adjacent colours (to meet WCAG success criterion 1.4.11 Non-text Contrast), so that people are able to easily determine that scrolling is possible.

## Fallback strategies

Hints are an enhancement: without them, the scroller still works. If your Baseline target does not support the features below, omitting the hints is acceptable when the scrollbar is visible. If the scrollbar is hidden, the hints are the only cue that the region scrolls, so you MUST a fallback.

### Fallbacks & browser support for scroll-state container queries

{{ BASELINE_STATUS("container-scroll-state-queries") }}

Without scroll-state queries, the shadows stay hidden.

If the scroller has a solid background color, draw the shadows with backgrounds instead. This works in every browser and needs no JavaScript.
Each shadow is a `scroll` background, which stays at the edge of the scrollport.
Each shadow has a cover: a `local` background in the scroller's own color, which scrolls with the content.
At either end of the content its cover sits on top of its shadow and hides it; once the user scrolls away from that end, the cover moves away and the shadow shows.

```css
@supports not (container-type: scroll-state) {
  .scroller {
    background:
      /* Covers: scroll with the content. Must use the scroller's own background color. */
      linear-gradient(var(--surface) 30%, transparent) top / 100% 2.5rem no-repeat local,
      linear-gradient(transparent, var(--surface) 70%) bottom / 100% 2.5rem no-repeat local,
      /* Shadows: stay at the edges of the scrollport */
      radial-gradient(farthest-side at 50% 0, rgb(0 0 0 / .15), transparent) top / 100% .75rem no-repeat,
      radial-gradient(farthest-side at 50% 100%, rgb(0 0 0 / .15), transparent) bottom / 100% .75rem no-repeat,
      var(--surface);
  }
}
```

The shadows paint behind the content, so content with its own opaque background hides them. Otherwise, use the `IntersectionObserver` fallback below and show the shadows when the scroller has `data-more-start` or `data-more-end`.

### Fallbacks & browser support for scroll-driven animations

{{ BASELINE_STATUS("scroll-driven-animations") }}

Without scroll-driven animations, the fades are never shown.

Use an `IntersectionObserver` to mark which edges have more content, and set the fades from those attributes. Observe empty sentinel elements created by the script at each end of the scroller: the scroller is the observer's root, so a sentinel that is out of view means there is more content beyond it.

```js
if (!CSS.supports('animation-timeline', 'scroll()')) {
  for (const scroller of document.querySelectorAll('.scroller')) {
    // Must be valid children of the scroller (e.g. <li> in a list)
    const start = document.createElement('div');
    const end = document.createElement('div');
    for (const sentinel of [start, end]) {
      // A zero-size sentinel at the very edge never counts as intersecting
      sentinel.style.cssText = 'min-inline-size: 1px; min-block-size: 1px';
    }
    scroller.prepend(start);
    scroller.append(end);

    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting } of entries) {
        scroller.toggleAttribute(target === start ? 'data-more-start' : 'data-more-end', !isIntersecting);
      }
    }, { root: scroller });

    observer.observe(start);
    observer.observe(end);
  }
}
```

```css
.scroller {
  transition: --fade-start .2s, --fade-end .2s;

  &[data-more-start] {
    --fade-start: var(--fade-size);
  }

  &[data-more-end] {
    --fade-end: var(--fade-size);
  }
}
```

- Give the sentinels `aria-hidden="true"` if they are elements that assistive technologies announce, such as `<li>`.
- If no child can be larger than the scroller (e.g. a row of tabs), observe the first and last children with `threshold: 1` instead of adding sentinels: a child that is not fully visible means there is more content beyond it.
