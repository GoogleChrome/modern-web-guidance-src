---
description: Create smooth and animated page transitions in single-page applications using the View Transitions API.
filename: view-transitions-spa
category: ui
---

# SPA View Transitions

Reference docs:
- [View Transitions API Guide](/docs/web-platform/view-transitions)
- [View Transitions CSS Working Group Draft](https://drafts.csswg.org/css-view-transitions-1/)

## Best Practices

The View Transition API allows for DOM updates to be presented in a single step with animated transitions between states, enhancing the user experience in single-page applications.

### Basic Usage

1.  **Initiate Transition:** Use `document.startViewTransition()` to wrap DOM updates. This function takes a callback that performs the DOM changes.
2.  **Define Animations:** Use CSS pseudo-elements like `::view-transition-group`, `::view-transition-image-pair`, and `::view-transition-old`/`::view-transition-new` to style and animate the transition.
3.  **Assign Transition Names:** Use the `view-transition-name` CSS property on elements that should be tracked across DOM updates.

```css
/* Apply a default transition for all elements with a view-transition-name */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.4s;
  animation-timing-function: ease-in-out;
}

/* Define a specific transition for an element with view-transition-name 'hero' */
::view-transition-group(hero) {
  animation-duration: 0.4s;
  animation-timing-function: ease-in-out;
}

/* Example: Fading out the old content and fading in the new content */
::view-transition-old(root) {
  opacity: 1;
  animation: fade-out 0.4s ease-in-out forwards;
}

::view-transition-new(root) {
  opacity: 0;
  animation: fade-in 0.4s ease-in-out forwards;
}

@keyframes fade-out {
  from { opacity: 1; }
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

```javascript
function updateDOM() {
  // Perform your DOM update here
  document.getElementById('content').innerHTML = 'New content loaded!';
}

document.getElementById('update-button').addEventListener('click', () => {
  document.startViewTransition(updateDOM);
});
```

### Progressive Enhancement

The View Transition API is designed for progressive enhancement. Browsers that do not support the API will simply render the DOM changes without any animation, ensuring a functional experience across all platforms. A helper function is available in the guide to manage browser compatibility.

### Cross-Browser Considerations

While the API is currently supported in Chrome, it's important to track the standards positions of other browsers like Mozilla and WebKit for future adoption.

## Fallback Strategies

If the user's browser does not support the View Transitions API, the DOM updates will occur without any animation, providing a graceful fallback.

## Future Considerations

The View Transitions API is an evolving feature with planned extensions, including:
- **Transitions Across Documents:** Enabling transitions between same-origin documents.
- **Compositor-Driven Animations:** Improving performance by running animations on the compositor thread.
- **Scoped Transitions:** Allowing transitions to be scoped to specific elements for independent animations within components.
- **Nested Transition Groups:** Enabling hierarchical transitions for more complex animations.
- **Classes of Transitions:** Grouping elements that should use the same animation type.
- **Ignore Offscreen Elements:** Automatically ignoring elements outside the viewport from participating in transitions.
- **`requestAnimationFrame`-Driven Animations:** Making frame-by-frame animations more accessible and less hacky.

Developers are encouraged to provide feedback on desired features and prioritize future development.