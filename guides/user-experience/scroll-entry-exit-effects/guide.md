---
name: scroll-entry-exit-effects
description: Create fade-in, scale-up, or other complex reveal-type effects on elements as they enter and exit the scrollport (or viewport) while the user is scrolling.
web-feature-ids:
  - scroll-driven-animations
sources:
  - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
  - https://scroll-driven-animations.style/demos/image-reveal/css/
  - https://scroll-driven-animations.style/demos/contact-list/css/multiple-animations.html
---

# Add entry and exit effects to elements as they enter or exit the scrollport

TODO: Description for this

## How to implement

TODO: Add more detail to the following steps:

- Create separate `@keyframes` for the entry and exit animations
- Attach the entry and exit keyframes to the element by definining multiple animations in the `animation` property.
  - Be sure to give the entry animation a `animation-fill-mode` of `forwards` and the exit animation a `animation-fill-mode` of `backwards`, to prevent them from overwriting each other when not active.
- Create a View Timeline using `view()` on the element, and use that as the `animation-timeline` for both the animations.
  - When needed, specify the axis to track in the `view()` function, e.g. `view(inline)` to track the inline axis
- Limit the entry animation to the `entry` `animation-range` and the exit animation to the `exit` range.

## Example code

This code animates the direct children of the scroller on scroll using an **anonymous view-timeline**:

```css
@media (prefers-reduced-motion: no-preference) {
  @supports ((animation-timeline: view()) and (animation-range: entry)) {
    @keyframes grow {
      from {
        scale: 0.5;
      }
    }
    @keyframes shrink {
      to {
        scale: 0.5;
      }
    }

    .scroller > * {
      animation:
        grow auto linear backwards,
        shrink auto linear forwards;
      animation-timeline: view(inline);
      animation-range: entry, exit;
    }
  }
}
```

As the elements enter the scrollport the `grow` animation is played, and as they leave the scrollport the `shrink` animation is played.

The following code has the same visual outcome, but animates the direct children of the scroller on scroll using an **named view-timeline**:

```css
@media (prefers-reduced-motion: no-preference) {
  @supports ((animation-timeline: view()) and (animation-range: entry)) {
    @keyframes grow {
      from {
        scale: 0.5;
      }
    }
    @keyframes shrink {
      to {
        scale: 0.5;
      }
    }

    .scroller > * {
      view-timeline: --tl inline;
      animation:
        grow auto linear backwards,
        shrink auto linear forwards;
      animation-timeline: --tl;
      animation-range: entry, exit;
    }
  }
}
```

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.

When using the `view()` function to create a scroll-driven animation:

- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
- When the animation is not applied to the tracked subject itself, use a named view timeline.

When using the `view-timeline` property to create a scroll-driven animation:

- **DO** use a CSS `<dashed-ident>` for the name.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.

When reusing the ViewTimeline on children

## Browser support and fallback strategies

{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.

TODO: Write a JavaScript-based IntersectionObserver that tracks each element as it crosses its scrollport. When entering, the `grow` keyframes are applied and while exiting the `shrink` keyframes. Note that when scrolling backwards through the scroller, the animations should also play but in reverse. Use `linear` timings for the animations, or it won’t work.
