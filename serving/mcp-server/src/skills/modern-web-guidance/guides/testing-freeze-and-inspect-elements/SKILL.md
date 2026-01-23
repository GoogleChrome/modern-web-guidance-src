---
description: Freeze elements in the DOM to inspect disappearing elements with DevTools.
filename: freeze-and-inspect-elements
category: testing
---

# Freeze screen & inspect disappearing elements

## Best Practices

When debugging web UI, certain elements may disappear for various reasons, disrupting your process. This document outlines several methods to freeze elements in the DOM, allowing for thorough inspection using Chrome DevTools.

The following methods are presented, ranging from simple CSS techniques to more advanced JavaScript approaches:

### Using CSS `:hover` state and pseudo classes

This method involves temporarily making an element visible or interactive by simulating a hover state. This is particularly useful for inspecting elements that only appear when a user hovers over a related element.

```css
.element-to-inspect:hover {
  /* Add styles to make the element visible or interactive */
  visibility: visible !important;
  opacity: 1 !important;
  pointer-events: auto !important;
}
```

### Emulating a focused page

Sometimes, elements are hidden or modified when the page loses focus. Emulating a focused state can help preserve these elements for inspection.

```javascript
// Example: Programmatically focus an element
document.getElementById('some-element').focus();
```

### Removing mouse event listeners

Elements that disappear might do so in response to mouse events. Temporarily removing these listeners can prevent the element from being removed or hidden.

```javascript
// Example: Identify and remove a specific event listener
const element = document.getElementById('disappearing-element');
element.removeEventListener('mouseout', someFunction);
```

### Using Breakpoints

Chrome DevTools offers powerful breakpoint capabilities. You can set breakpoints that trigger when specific DOM changes occur, or when certain JavaScript conditions are met, effectively pausing execution and preserving the element's state.

*   **DOM Change Breakpoints:** Right-click on an element in the Elements panel and select "Break on..." to choose from options like subtree modifications, attribute modifications, or node removal.
*   **Conditional Breakpoints:** In the Sources panel, you can add conditional breakpoints to your JavaScript code that will only pause execution when a specific condition is true.

### Setting timeouts with snippets

For dynamic elements that disappear after a certain time, JavaScript snippets can be used to extend their visibility or to trigger inspection logic before they vanish.

```javascript
// Example snippet to extend visibility
setTimeout(() => {
  // Code to keep the element visible or inspect it
  console.log('Element should still be visible');
}, 5000); // Keep visible for 5 seconds
```

By employing these techniques, developers can gain better control over dynamic UI elements and efficiently debug issues related to their appearance and behavior in Chrome DevTools.