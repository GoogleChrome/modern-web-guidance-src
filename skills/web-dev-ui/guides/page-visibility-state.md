---
description: Detect when a page is hidden or visible to optimize performance and user experience
web-feature-ids:
  - page-visibility-state
  - visibility-state
---

# Page Visibility State

Reference docs:

- https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- https://web.dev/articles/page-visibility
- https://w3c.github.io/page-visibility/

## Best Practices

The Page Visibility State API allows you to know when a page is visible to the user. This is crucial for saving resources and improving performance when the user is not actively viewing your page.

**DO** use `visibilitychange` to pause expensive operations:

- **Media**: Pause video or audio when the user switches tabs (unless background audio is the goal).
- **Animations**: Stop `requestAnimationFrame` loops or CSS animations.
- **Data Polling**: Reduce or stop fetching data when the page is hidden.

**Policies & Behavior**:

- **Throttling**: Browsers automatically throttle `requestAnimationFrame` and `setTimeout` in background tabs to save battery. Use this API to explicitly pause work that _isn't_ automatically throttled (e.g., audio, WebSockets, frequent fetch requests).
- **Iframes**: The visibility state of an `<iframe>` matches its parent document. Hiding an iframe with CSS (e.g., `display: none`) does _not_ trigger visibility events for the document inside it.

```javascript
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    // Resume video, animations, or polling
    videoElement.play();
  } else {
    // Pause video, animations, or polling
    videoElement.pause();
  }
});
```

**DO** use it for analytics to track actual engagement time, rather than just "time on page". This provides a more accurate metric of user attention.

## Baseline Status

Baseline: **Limited availability**

- **Status**: Limited availability.
- **Documentation**: [Web Platform Status](https://webstatus.dev/features/page-visibility-status)
- **Availability**: Supported in Chrome, Edge, and Chrome Android.

## Fallback Strategies

For very old browsers that do not support the `visibilitychange` event, you can sometimes use `focus` and `blur` events on the `window` as a crude approximation, though they are not equivalent (a visible window can be blurred).

### Feature Detection

```javascript
if (typeof document.hidden !== "undefined") {
  // Use Page Visibility API
} else {
  // Fallback behavior (e.g., always keep playing or use focus/blur)
  window.addEventListener("blur", pauseGame);
  window.addEventListener("focus", resumeGame);
}
```

### Vendor Prefixes (Legacy)

If supporting ancient browser versions (e.g. Android 4.4, early iOS), you might need to check for prefixed properties:

```javascript
function getHiddenProp() {
  var prefixes = ["webkit", "moz", "ms", "o"];
  if ("hidden" in document) return "hidden";
  for (var i = 0; i < prefixes.length; i++) {
    if (prefixes[i] + "Hidden" in document) return prefixes[i] + "Hidden";
  }
  return null;
}
```
