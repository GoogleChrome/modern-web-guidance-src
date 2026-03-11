---
name: parallax-scroll-effects
description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
web-feature-ids:
  - scroll-driven-animations
  - sibling-count
sources:
  - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
  - https://scroll-driven-animations.style/demos/parallax-carousel/css/
---

# Build a Parallax Effect on Scroll

TODO: Description of a Parallax Effect on Scroll

## How to implement

TODO: Write out the following steps, by looking at the `demo.html` for the code that goes along with it:

- Create a wrapper element
- Inside the wrapper element, declare the layers of the parallax that you want to animate
- Add a translate animation to each layer of the parallax
- Set up the animation to use a `view-timeline` tha tracks the ancestor wrapper element.
- To add staggering to each layer, either:
  - Use the `sibling-index()` and `sibling-count()` functions in the keyframes.
  - Use the `sibling-index()` and `sibling-count()` functions in the `animation-range` property.

## Example code

@TODO: Include relevant CSS from `demo.html` in a code block

@TODO: Provide an alternative that uses the relevant CSS from `demo-alt.html` in a code block

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

TODO: Write a JavaScript-based parallax that tracks the `.wrapper` using an intersection observer.
