---
description: Use scroll-linked animations to create dynamic and engaging scrolling experiences in web applications.
filename: scroll-linked-animations
category: ui
---

# Scroll-Linked Animations

Reference docs:
- https://drafts.csswg.org/scroll-animations-1/
- https://github.com/flackr/scroll-timeline

## Best Practices

Leverage the CSS scroll-linked animations API to synchronize animations with user scroll position or an element's position within its scrolling container. This enables creation of sophisticated, interactive, and visually rich user interfaces that respond dynamically to user scrolling.

### Key Concepts:

*   **ViewTimeline**: An animation timeline linked to the position of an element within its scrolling container.
    *   `view-timeline-name`: Assigns a name to a ViewTimeline.
    *   `view-timeline-axis`: Defines the scroll axis (`block` or `inline`).
*   **Animation Timeline**: Links an animation to a specific timeline.
    *   `animation-timeline`: References a `view-timeline-name`.
*   **Phases**: Define the points at which an animation is linked to the scroll progress.
    *   `animation-delay`: Specifies when the animation starts relative to the element's position (e.g., `enter 0%`).
    *   `animation-end-delay`: Specifies when the animation finishes relative to the element's position (e.g., `cover 50%`).

### Example: Rotating an element on scroll

```css
.element-moving-in-viewport {
  view-timeline-name: foo;
  view-timeline-axis: block;
}

.element-scroll-linked {
  animation: rotate both linear;
  animation-timeline: foo;
  animation-delay: enter 0%;
  animation-end-delay: cover 50%;
}

@keyframes rotate {
 to {
   rotate: 360deg;
 }
}
```

### Using `scroll-snap` with Scroll-Linked Animations

Combining `scroll-snap` with `ViewTimeline` can create smooth and intuitive page-turning effects, similar to a physical book. This is particularly effective for narrative-driven content or portfolios.

### JavaScript Integration with Web Animations API

For more complex scenarios or dynamic generation of timelines, the Web Animations API can be used in conjunction with `ViewTimeline` to control animations programmatically. This allows for imperative control over animation linking and properties.

```js
const triggers = document.querySelectorAll("[data-scroll-trigger]")

const commonProps = {
  delay: { phase: "enter", percent: CSS.percent(0) },
  endDelay: { phase: "enter", percent: CSS.percent(100) },
  fill: "both"
}

const setupPage = (trigger, index) => {
  const target = document.querySelector(
    `[data-scroll-target="${trigger.getAttribute("data-scroll-trigger")}"]`
  );

  const viewTimeline = new ViewTimeline({
    subject: trigger,
    axis: 'inline',
  });

  target.animate(
    [
      {
        transform: `translateZ(${(triggers.length - index) * 2}px)`
      },
      {
        transform: `translateZ(${(triggers.length - index) * 2}px)`,
        offset: 0.75
      },
      {
        transform: `translateZ(${(triggers.length - index) * -1}px)`
      }
    ],
    {
      timeline: viewTimeline,
      ...commonProps,
    }
  );
  target.querySelector(".page__paper").animate(
    [
      {
        transform: "rotateY(0deg)"
      },
      {
        transform: "rotateY(-180deg)"
      }
    ],
    {
      timeline: viewTimeline,
      ...commonProps,
    }
  );
};

const triggers = document.querySelectorAll('[data-scroll-trigger]')
triggers.forEach(setupPage);
```

## Fallback Strategies

The scroll-linked animations API and its polyfills are still under active development. For broader compatibility:

*   **Feature Detection**: Use JavaScript to detect support for `ViewTimeline` and `animation-timeline` properties.
*   **Polyfills**: Conditionally load polyfills like the one provided by the `flackr/scroll-timeline` repository when native support is not available.
*   **Reduced Motion**: Respect user preferences for reduced motion by disabling or simplifying animations when `prefers-reduced-motion` is enabled.

```js
// Example of reduced motion check
const setUpOwl = () => {
   // ... animation setup code ...
 }

 if (window.matchMedia('(prefers-reduced-motion: no-preference)').matches)
   setUpOwl()
```