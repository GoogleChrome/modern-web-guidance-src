---
name: carousel-slide-effects
description: Create a carousel of slides with images or other visual elements, where each slide animates as they enter/center/exit their scroller. For example, the slides may fade-in/fade-out, rotate, get bigger or smaller, etc.
web-feature-ids:
  - scroll-driven-animations
  - scroll-snap
sources:
  - https://scroll-driven-animations.style/
  - https://scroll-driven-animations.style/demos/parallax-carousel/css/
---

# Build Carousel Slide Effects

TODO: Description of the Carousel Slide Effects, in which the slides animate as they enter/center/exit their scroller. (This has overlap with entry/exit animations, but is a tad different as it uses one animation to describe the entire span of the item becoming visible, being visible, and becoming invisible in the carousel’s scrollport)

## How to implement

TODO: Write out the following steps, by looking at the `demo.html` for the code that goes along with it:

- Create a scroller
- On each item in the scroller, apply 1 animation to it
  - The keyframes describe the entry, center, and exit effects to run
- Hook up the animation to a `view-timeline` that tracks the element crossing the scrollport.

## Example code

@TODO: Include relevant CSS from `demo.html` in a code block

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.

## Browser support and fallback strategies

{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.

TODO: Write a JavaScript-based parallax that tracks each `.entry` crossing `.scroller` using an intersection observer. Try applying an animation from the CSS which gets paused. The code in the intersectionobserver then updates the currentTime of the animation to faux-play the effect. NOTE: If an intersection observer does not work here, switch tactics by calculating start and end offsets for each `.entry`. The animation runs in between those offsets, with `scroll` listener updating the `.currentTime` for each entry.
