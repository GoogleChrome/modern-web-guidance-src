---
name: group-element-transitions
description: Transition a group of similar elements simultaneously using the same transition logic, such as removing a product from a shopping cart and having all the other products animate into their new positions.
web-feature-ids:
  - view-transitions
  - view-transition-class
sources:
  - https://developer.chrome.com/blog/view-transitions-update-io24
  - https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-class
  - https://developer.chrome.com/docs/web-platform/view-transitions/same-document#view-transition-class
---
 
As items are added or removed from a list, or rearranged, transitions can help users maintain context. View transitions provide a way to transition between two states of an element by giving the element a unique `view-transition-name`. When multiple elements on a page share the same transition behavior, `view-transition-class` allows you to define that logic once in CSS rather than repeating it for every unique `view-transition-name`. This keeps your stylesheets maintainable while ensuring consistent animations across a group of elements.

### Implementation steps

1. **Assign unique names and a shared class**

Each element that needs to be tracked individually during a transition must have a unique `view-transition-name`.

```html
<!-- Mandatory: Each element must have a unique view-transition-name -->
<li style="view-transition-name: item-1" class="item">Item 1</li>
<li style="view-transition-name: item-2" class="item">Item 2</li>
```

To apply shared styles, also assign a `view-transition-class`.

```css
.item{
  view-transition-class: list-item;
}
```

2. **Define the shared transition logic**
   
Use the `::view-transition-group()` pseudo-element with the class selector to apply styles to all members of that group.

```css
/* Targets any view transition group that has the 'list-item' class */
::view-transition-group(.list-item) {
  animation-duration: 0.5s;
  animation-timing-function: ease-in-out;
}

/* Handle accessibility by respecting motion preferences */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(.list-item) {
    animation: none !important;
  }
}
```

3. **Optional: Define entry and exit animations**

Use the `:only-child` selector to add specific transitions to the elements that are added or removed. `::view-transition-new()` and `::view-transition-old()` pseudo-elements are children of a `::view-transition-image-pair()` psuedo-element, so we can determine it is an added or removed element if it is the only child.

```css
/* A `::view-transition-new()` element is the only child if it wasn't present before the view transition, so it is an added element. */
::view-transition-new(.list-item):only-child {
  animation-name: slide-in;
}
/* A `::view-transition-old()` element is the only child if it isn't present after the view transition, so it is a removed element. */
::view-transition-old(.list-item):only-child {
  animation-name: slide-out;
}
```

The existing `prefers-reduced-motion` media query already disables these animations. However, the snapshot of the old view is not removed immediately, so we must add `display: none` to the media query to prevent it from staying on screen.

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(.list-item){
    display: none;
  }
}
```


4. **Trigger the transition**

Wrap the DOM update in `document.startViewTransition()`. The browser will capture the old state, perform the update, and then animate to the new state.

```javascript
function updateList(newData) {
  // Check for browser support before calling
  if (!document.startViewTransition) {
    render(newData);
    return;
  }

  document.startViewTransition(() => {
    // All DOM changes inside this callback will be transitioned
    render(newData);
  });
}
```

### Fallback strategies

{{ BASELINE_STATUS("view-transition-class") }}

View Transitions are a progressive enhancement. If the browser does not support `document.startViewTransition`, the DOM update should still occur immediately, providing a functional but non-animated experience.

```javascript
if (document.startViewTransition) {
  document.startViewTransition(() => updateDOM());
} else {
  // Fallback: Perform the update without animation
  updateDOM();
}
```

For CSS, browsers that do not recognize `view-transition-class` or the `::view-transition-group()` class selector will simply ignore those rules, and no animation will be applied.
