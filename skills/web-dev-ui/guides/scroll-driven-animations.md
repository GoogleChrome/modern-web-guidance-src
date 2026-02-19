---
description: Create animations linked to scroll position
web-feature-ids:
  - scroll-driven-animations
---

# Scroll-driven animations

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations
- https://developer.chrome.com/docs/css-ui/scroll-driven-animations

## Best Practices

Use `animation-timeline: scroll()` to create a reading progress indicator:

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

#progress {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 1em;
  background: red;

  transform-origin: 0 50%;
  animation: grow-progress auto linear;
  animation-timeline: scroll(root block);
}
```

Use `animation-timeline: view()` to fade an image in as it enters the viewport:

```css
/* 1. Define the keyframes for the animation */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 2. Use @supports for feature detection */
@supports (animation-timeline: view()) {

  .fade-in-image {
    /* Set initial state for browsers that support the feature */
    opacity: 0;

    /* Attach the animation */
    animation: fade-in linear both;
    animation-timeline: view();

    /* 
      Define the range for the animation.
      It starts when the element is 20% into view (entry 20%)
      and finishes when it is 60% into view (entry 60%).
    */
    animation-range: entry 20% entry 60%;
  }

  /* 3. Add a media query for users who prefer reduced motion */
  @media (prefers-reduced-motion: reduce) {
    .fade-in-image {
      /* Disable the animation and set the final state */
      animation: none;
      opacity: 1;
    }
  }
}
```

**DO** use a @media query to disable animations if `prefers-reduced-motion` is set to `reduce`.

**DO NOT** style the image's parent element with `overflow: hidden`, as this will put the image in "scroll jail" and prevent the animation from working.

## JavaScript API

You can also create scroll-driven animations using the Web Animations API with `ScrollTimeline` and `ViewTimeline`.

To create a scroll progress timeline, instantiate the `ScrollTimeline` class and pass it to the `animate()` method:

```javascript
const progress = document.querySelector('#progress');
progress.style.transformOrigin = '0% 50%';

// Create a ScrollTimeline linked to the root scroller
const timeline = new ScrollTimeline({
  source: document.documentElement,
});

// Animate the progress bar using the scroll timeline
progress.animate(
  {
    transform: ['scaleX(0)', 'scaleX(1)'],
  },
  {
    fill: 'forwards',
    timeline: timeline,
  }
);
```

### Scroll-driven animations

Baseline status: **Limited availability**

The `animation-timeline` property and `ScrollTimeline` / `ViewTimeline` interfaces are not yet supported in all browsers.

- **DO** use the [Scroll-driven Animations Polyfill](https://github.com/flackr/scroll-timeline) to provide support for browsers that do not implement the specification.
- **DO** use `@supports (animation-timeline: view())` for feature detection in CSS.
- **DO NOT** set the starting state of an animated element to hidden in unsupported browsers unless you are using a polyfill or JavaScript fallback.
- **DO** consider using a manual JavaScript fallback (e.g., `scroll` event listener) if the polyfill cannot be used.
