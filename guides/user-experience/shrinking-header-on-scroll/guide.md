---
name: shrinking-header-on-scroll
description: Smoothly animate a fixed header or full-page cover on scroll to dynamically shrink, gain shadows, and transform its layout over a predefined scroll distance.
web-feature-ids:
  - scroll-driven-animations
sources:
  - https://scroll-driven-animations.style/
  - https://scroll-driven-animations.style/demos/shadow-on-header-after-scroll/css/
  - https://scroll-driven-animations.style/demos/cover-card-to-fixed-header/css/
---

# Shrinking headder on scroll

TODO: Description of the Shrinking header on scroll feature, in which a fixed element shrinks as you scroll over a fixed scroll distance.

## How to implement

TODO: Write out the following steps, by looking at the `demo.html` for the code that goes along with it:

- Have a fixed element, with a predefined height.
- Add a `shrink` animation to that element
- Let the animation be driven by scroll, using a ScrollTimeline (using the `scroll()` function)
- Use the `animation-range` to determine the scroll distance over which this should happen, e.g. `animation-range: 0px 200px;`

- TIP: To prevent the contents that follow the fixed element from ending up underneath that fixed element, add a `padding-top` to those contents.
- TIP: When having a fixed element that shrinks from `100vh` to `10vh`, the `animation-range` is `0 90vh`. The `animation-range-end` there is the difference between the start and end size.


## Example code

@TODO: Include relevant CSS from `demo.html` in a code block

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: scroll()) and (animation-range: 0% 100%))` to check for support and provide a fallback for browsers that don't support it.
  - The `(animation-range: 0% 100%)` check **MUST** be included here, to filter out browsers with only partial support.
  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.

## Browser support and fallback strategies

{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.

TODO: Write a JavaScript-based version of the CSS approach. Use a `scroll` listener for this that runs the `shrink` animation over a fixed scroll distance.
