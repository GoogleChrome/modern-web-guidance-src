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

A shrinking header on scroll is a common UI pattern where a fixed header element at the top of the page smoothly transitions to a smaller size as the user scrolls down. This effect is often used to maximize screen real estate for the main content while keeping essential navigation or branding elements accessible. With CSS scroll-driven animations, this effect can be achieved in a declarative and performant way, by linking an animation to the scroll position of the document.

## How to implement

Here’s how to create a shrinking header on scroll:

1.  **Create a fixed header:** Start with a header element that is fixed to the top of the page and has a predefined height.

    ```html
    <header>HEADER</header>
    ```

    ```css
    header {
      position: fixed;
      height: 200px;
      top: 0;
      left: 0;
      right: 0;
    }
    ```

2.  **Define the shrink animation:** Create a CSS animation that changes the height of the header.

    ```css
    @keyframes shrink {
      to {
        height: 50px;
      }
    }
    ```

3.  **Apply the animation and scroll timeline:** Attach the animation to the header and use the `scroll()` function to link it to the document’s scroll position.

    ```css
    header {
      animation: shrink auto linear both;
      animation-timeline: scroll(block root);
    }
    ```

4.  **Set the `animation-range`:** Use the `animation-range` property to specify the scroll distance over which the animation should occur. For example, to shrink the header over the first 150 pixels of scrolling, you would use `animation-range: 0px 150px;`.

    ```css
    header {
      animation-range: 0px 150px;
    }
    ```

**Tip:** To prevent the content following the header from being obscured by it, add a `padding-top` to the `body` (or the main content container) that is equal to the initial height of the header.

**Tip:** To make sure the contents of the page scroll in sync with the shrinking header, set the `animation-range-end` to the difference between the start and end sizes. This ensures the animation completes precisely when the header reaches its final size. In this demo the header shrinks from `200px` to `50px`, so the `animation-range-end` is set to `150px`.

## Example code

```css
@keyframes shrink {
  to {
    height: 50px;
  }
}

header {
  animation: shrink auto linear both;
  animation-timeline: scroll(block root);
  animation-range: 0px 150px;
}
```

## Best Practices

When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:

{{ INCLUDE("features/scroll-driven-animations.md#best-practices-scroll") }}

When using the `scroll()` function to create a scroll-driven animation:

- **OPTIONAL** be explicit about the scroller: When not targeting the nearest ancestor scroller, be explicit about which scroller you want to use with `scroll(root)` or `scroll(self)`.
  - When `root`, `nearest`, or `self` are not sufficient, use a named scroll-timeline.
- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll(block)` or `scroll(inline)`.

As for this use case specifically:

- The element that you animate **MUST** not be `position: static` or `position: relative` when using percentages in the `animation-range`.
  - This is because those elements are considered “in-flow”. Shrinking those elements as you scroll, would shrink the total scroll distance, thereby affecting the computed value of — for example — `10%` into the scroll.

## Browser support and fallback strategies

{{ FEATURE_FALLBACKS("scroll-driven-animations") }}

For this use-case specifically, the following script applies the fallback for browsers that do not support scroll-driven animations. It uses a scroll listener to track the scroll position of the document over a distance of `150px` and updates the header's height accordingly.

```js
// Fallback for browsers that don't support scroll-driven animations
if (!CSS.supports('(animation-timeline: scroll()) and (animation-range: 0% 100%)')) {
  const header = document.querySelector('header');

  const initialHeight = 200;
  const finalHeight = 50;
  const scrollDistance = 150;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const scrollPercent = Math.min(1, scrollY / scrollDistance);
    const newHeight = initialHeight - (initialHeight - finalHeight) * scrollPercent;

    header.style.height = `${newHeight}px`;
  });
}
```
