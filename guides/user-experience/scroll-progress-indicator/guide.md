---
name: scroll-progress-indicator
description: Create a scroll progress bar, stepped progress tracker, or any visual affordance that communicates how far through a page or section the user has scrolled.
web-feature-ids:
  - scroll-driven-animations
sources:
  - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
  - https://scroll-driven-animations.style/demos/progress-bar/css/scroll-defaults
  - https://scroll-driven-animations.style/demos/progress-bar/css/
---

# Build a Scroll Progress Indicator

TODO: Description of what a Scroll Progress Indicator is

## How to implement

TODO: Write out the following steps:

- Have a progress bar element that is absolutely or fixed positioned.
- Attach an animation to it that scales it from 0 to 1 on the x-axis
- Add an `animation-timeline: scroll()` to it, so that the animation is now driven by scroll

## Example code

This code grows the `#progress` element on scroll.

```css
@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

#progress {
  position: fixed;
  left: 0; top: 0;
  width: 100%; height: 1em;
  background: red;

  transform-origin: 0 50%;
  animation: grow-progress auto linear;
  animation-timeline: scroll();
}
```

Because of its location in the DOM, the `scroll()` function will track its neareast ancestor scroller in the `block` direction, which here is the root scroller.

```html
<body>
  <div id="progress"></div>
</body>
```

## Best Practices

TODO: List Best Practices here about the use of the `scroll()` function.

## Browser support and fallback strategies

{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.

TODO: Write a JavaScript-based scroll-listener that tracks the scroll of the element’s scroller. In its callback function, it updates the `scaleX` of the progress bar based on the scroll distance.