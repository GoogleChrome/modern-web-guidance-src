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

A scroll progress indicator is a common user interface pattern that visually communicates the user's progress through a scrollable document or container. As the user scrolls, a visual element updates to reflect their position, providing a clear and intuitive sense of how much content has been viewed and how much remains.

## How to implement

To create a scroll progress indicator, you need two things:

1.  An element to act as the progress bar. This element is typically `position: fixed` or `position: absolute` so that it stays in view while the user scrolls.
2.  An animation that is linked to the scroll position.

Here’s how you can achieve this:

-   First, create an HTML element that will serve as your progress bar. This element can be styled to your liking.
-   Next, in your CSS, define a `@keyframes` animation that scales the progress bar. A common approach is to scale the element from `scaleX(0)` to `scaleX(1)`.
-   Finally, apply this animation to your progress bar element and set its `animation-timeline` to a scroll-timeline. This tells the browser to drive the animation's progress based on the scroll position of the nearest ancestor scroller.

## Example code

This code grows the `#progress` element on scroll using an anonymous scroll-timeline, created by the `scroll()` function.

```css
@media (prefers-reduced-motion: no-preference) {
  @supports ((animation-timeline: scroll())) {
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
  }
}
```

Because of its location in the DOM, the `scroll()` function will track its neareast ancestor scroller in the `block` direction, which here is the root scroller.

```html
<body>
  <div id="progress"></div>
</body>
```

This code grows the `#progress` element on scroll using a named scroll-timeline, created by the `scroll-timeline` property.

```css
@media (prefers-reduced-motion: no-preference) {
  @supports ((animation-timeline: scroll())) {
    @keyframes grow-progress {
      from { transform: scaleX(0); }
      to { transform: scaleX(1); }
    }

    :root {
      scroll-timeline: --tl block;
    }

    #progress {
      position: fixed;
      left: 0; top: 0;
      width: 100%; height: 1em;
      background: red;

      transform-origin: 0 50%;
      animation: grow-progress auto linear;
      animation-timeline: --tl;
    }
  }
}
```

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

{{ INCLUDE("features/scroll-driven-animations.md#best-practices-scroll") }}

When using the `scroll()` function to create a scroll-driven animation:

- **OPTIONAL** be explicit about the scroller: When not targeting the nearest ancestor scroller, be explicit about which scroller you want to use with `scroll(root)` or `scroll(self)`.
  - When `root`, `nearest`, or `self` are not sufficient, use a named scroll-timeline.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll(block)` or `scroll(inline)`.

When using the `scroll-timeline` property to create a scroll-driven animation:

- **DO** use a CSS `<dashed-ident>` for the name.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll-timeline-axis`.
- **DO** make sure the scope of the lookup works: When the element that is declaring the `scroll-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `scroll-timeline`’s name by using `timeline-scope` on a shared ancestor.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("scroll-driven-animations") }}

For this use-case specifically, the following script applies the fallback for browsers that do not support scroll-driven animations. It uses a scroll listener to track the scroll position of the root element and updates the `transform` property of the progress bar accordingly.

```html
<script>
  if (!CSS.supports('animation-timeline', 'scroll()')) {
    const progress = document.querySelector('#progress');

    window.addEventListener('scroll', () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = window.scrollY;
      const progressPercentage = (scrolled / scrollable);

      progress.style.transform = `scaleX(${progressPercentage})`;
    });
  }
</script>
```
