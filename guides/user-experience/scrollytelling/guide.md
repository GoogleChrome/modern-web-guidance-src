---
name: scrollytelling
description: Animate visual properties on a target element — such as fading a backdrop, shifting a background color, or to create scrollytelling experiences — driven entirely by the scrollport position of a completely different element.
web-feature-ids:
  - scroll-driven-animations
sources:
  - https://scroll-driven-animations.style/
---

# Scrollytelling

TODO: Description of Scrollytelling. Include a note to say that this is using Scroll-driven Animations, so the animations are still controlled by scroll instead of running on a time-based clock.

## How to implement

TODO: Write out the following steps, by looking at the `demo.html` for the code that goes along with it:

- Have a set of elements that you track to drive the animations. Create named View Timelines on each of those.
- Have a set of (possibly) different elements that you want to animate. Set their individual `animation-timeline` to the ViewTimeline you want to use
- To make sure the ViewTimelines are visible, make the names of the ViewTimelines more broadly visible by using the `timeline-scope` property.
  - Set its value to a comma-separate list of all timeline names.
  - Use this property on a shared parent of both the tracked subjects and the animation subjects. The easiest way to do this, is to use it on the `:root` element.
- Optionally Use the `animation-range` to determine when the animation should run.

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

When using the `view-timeline` property to create a scroll-driven animation:

- **DO** use a CSS `<dashed-ident>` for the name.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.

## Browser support and fallback strategies

{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.

TODO: Write a JavaScript-based version of the CSS approach. Use a IntersectionObserver to create a similar effect.