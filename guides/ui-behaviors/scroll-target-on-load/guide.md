---
name: scroll-target-on-load
description: Build a scrollable list of elements (e.g. a carousel of images or a chat conversation thread) that can be displayed with a particular element scrolled into view on the initial render.
web-feature-ids:
  - scroll-initial-target
  - scroll-into-view
---

# Set a scroll target for the initial render

The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific descendant element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`), both of which have limitations and are tricky to implement.

## How to Implement

To implement this successfully:

1. **Ensure a scroll container:** The target element must be inside a scroll container (an element with overflow that allows scrolling, such as `overflow: auto`). This can be any ancestor element, including the root `<html>` element.
2. **Target the Item:** Apply `scroll-initial-target: nearest` to the specific descendant element you want to bring into view.

## Example Code: Vertical Media Feed

In this example, a feed starts scrolled to a specific "featured" item rather than the very top of the list.

```css
/** 
 * TARGET: The item that should be visible on initial load.
 */
.item.target {
  scroll-initial-target: nearest;
}
```

## Strategic Implementation & Best Practices

- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
- **DO NOT** set `scroll-initial-target` on multiple elements within the same scrollable container. If multiple elements specify `scroll-initial-target: nearest`, the browser selects the one that appears first in the DOM tree order.
- **DO** provide dimensions for media. Since the scroll position is calculated during initial layout, ensure images or videos have `aspect-ratio` or fixed `height`/`width` to prevent the target from shifting after the media loads.
- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.

## Accessibility considerations

Because `scroll-initial-target` only updates the visual scroll offset, give keyboard and screen reader users a direct way to move focus to the visually prioritized content. Do not call `focus()` automatically on initial page load when preceding page content (such as a header or navigation) exists, as doing so bypasses earlier landmarks.

Choose the focus pattern that matches the component's semantics:

* **Composite widgets** (such as a date picker strip starting on today, a thumbnail `toolbar`, or a selectable `listbox` or `tablist`): apply `focusgroup` with the matching behavior token (for example, `focusgroup="listbox"` or `focusgroup="toolbar"`, adding `nomemory` and moving `focusgroupstart` if the active item can change externally) and set `focusgroupstart` on the `scroll-initial-target` control. Tabbing into the widget then lands directly on the prioritized item without needing a skip link, and users can move between items with the arrow keys.
* **Content feeds and message streams** (such as a live chat thread or media feed, whether embedded in a larger page or serving as the primary view): do not apply `focusgroup` or a roving `tabindex` to static prose items that lack a composite widget role. Instead, make the prioritized item programmatically focusable with `tabindex="-1"` (or target its heading or first control) and provide either a skip link before the feed or a jump control alongside surrounding navigation UI to move focus to it while preserving normal sequential `Tab` order.

If the prioritized content is not the expected starting point (for example, an older pinned message rather than the latest message in a chat thread), indicate why it is shown first using visible or accessible text—such as a "Pinned message" label rather than an unlabeled pin icon alone.

## Fallback Strategy

{{ BASELINE_STATUS("scroll-initial-target") }}

For browsers that do not yet support the API, use a JavaScript fallback. Use the `DOMContentLoaded` event to ensure the browser scrolls the element into view as soon as the HTML parsing completes, providing a faster experience than waiting for all images and resources to load. Alternatively, placing the script at the end of the `<body>` element is also acceptable and avoids the need for an event listener.

```javascript
/**
 * Progressive Enhancement Fallback
 */
document.addEventListener("DOMContentLoaded", () => {
  // Check for native CSS support
  if (!CSS.supports("scroll-initial-target", "nearest")) {
    const feedTarget = document.querySelector(".item.target");
    if (feedTarget) {
      // 'block: center' ensures the featured media is centered in view
      feedTarget.scrollIntoView({ behavior: "instant", block: "center" });
    }
  }
});
```
