---
description: Create accessible, responsive, and color-adaptive Floating Action Buttons (FABs) using semantic HTML and CSS custom properties.
filename: accessible-fab-components
category: ui
---

# Building Accessible Floating Action Buttons (FABs)

This guide covers best practices for creating Floating Action Buttons (FABs) that are color-adaptive, responsive, and accessible. We'll leverage semantic HTML and CSS custom properties to achieve these goals.

## Best Practices

### Semantic HTML for Accessibility

*   **DO** use a `div` with `role="group"` and `aria-label` for the FAB container to semantically group the buttons and provide context to screen readers.
*   **DO** use the `<button>` element for individual FABs as it provides built-in accessibility for mouse, touch, and keyboard interactions.
*   **DO** hide SVG icons from screen readers using `aria-hidden="true"`.
*   **DO** provide a clear text label for each button using `aria-label` for screen reader users and consider adding a `title` attribute for mouse users.
*   **DO** ensure the primary FAB is the first focusable element within the group to provide a logical keyboard navigation flow.

```html
<div class="fabs" role="group" aria-label="Floating action buttons">
  <button data-icon="plus" class="fab" title="Add new action" aria-label="Add new action">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">...</svg>
  </button>
  <button data-icon="heart" class="fab mini" title="Like action" aria-label="Like action">
    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">...</svg>
  </button>
</div>
```

### CSS Custom Properties for Adaptability and Reusability

*   **DO** use CSS custom properties (variables) to manage spacing, colors, and sizes. This promotes reusability and makes it easier to adapt styles for different themes or states.
*   **DO** implement a color adaptation strategy using custom properties that define light and dark mode variations. These adaptive properties can be set by default to light mode and then updated using a `@media (prefers-color-scheme: dark)` query.
*   **DO** use `position: fixed` with `inset-block` and `inset-inline` for FABs to keep them consistently in view and respect document directionality.
*   **DO** use `display: flex` and `flex-direction: column-reverse` on the FAB container to stack buttons and ensure the first focusable element (the primary action) appears at the bottom visually, aligning keyboard and visual focus order.
*   **DO** use `gap` on the FAB container to manage spacing between buttons.

```css
.fabs {
  --_viewport-margin: 2.5vmin;

  position: fixed;
  z-index: var(--layer-1);

  inset-block: auto var(--_viewport-margin);
  inset-inline: auto var(--_viewport-margin);

  display: flex;
  flex-direction: column-reverse;
  place-items: center;
  gap: var(--_viewport-margin);
}

.fab {
  --_size: 2rem;
  --_light-bg: var(--pink-6);
  --_light-bg-hover: var(--pink-7);
  --_dark-bg: var(--pink-4);
  --_dark-bg-hover: var(--pink-3);
  --_bg: var(--_light-bg);
  --_light-fg: white;
  --_dark-fg: black;
  --_fg: var(--_light-fg);

  padding: calc(var(--_size) / 2);
  border-radius: var(--radius-round);
  aspect-ratio: 1;
  box-shadow: var(--shadow-4);
  background: var(--_bg);
  color: var(--_fg);
  -webkit-tap-highlight-color: transparent;

  & > svg {
    inline-size: var(--_size);
    block-size: var(--_size);
    stroke-width: 3px;
  }

  &:is(:active, :hover, :focus-visible) {
    --_bg: var(--_light-bg-hover);

    @media (prefers-color-scheme: dark) {
      --_bg: var(--_dark-bg-hover);
    }
  }

  @media (prefers-color-scheme: dark) {
    --_bg: var(--_dark-bg);
    --_fg: var(--_dark-fg);
  }
}

.fab.mini {
  --_size: 1.25rem;
}
```

### Animation for User Feedback

*   **DO** implement a reduced motion strategy using custom properties and the `prefers-reduced-motion` media query. Transition properties like `box-shadow`, `background-color`, `transform`, and `outline-offset` to provide feedback without being jarring.
*   **DO** use subtle `transform` animations (e.g., `translateY`) for active states to give a pressed effect.
*   **DO** consider animating SVG icons on hover or other interactions to enhance engagement, ensuring these animations are also respects reduced motion preferences.

```css
.fab {
  --_motion-reduced:
    box-shadow .2s var(--ease-3),
    background-color .3s var(--ease-3);
  --_motion-ok:
    var(--_motion-reduced),
    transform .2s var(--ease-3),
    outline-offset 145ms var(--ease-2);
  --_transition: var(--_motion-reduced);

  transition: var(--_transition);

  @media (prefers-reduced-motion: no-preference) {
    --_transition: var(--_motion-ok);
  }

  &:active {
    @media (prefers-reduced-motion: no-preference) {
      transform: translateY(2%);
    }
  }

  &[data-icon="plus"]:hover > svg {
    transform: rotateZ(.25turn);
  }

  & > svg {
    @media (prefers-reduced-motion: no-preference) {
      will-change: transform;
      transition: transform .5s var(--ease-squish-3);
    }
  }
}
```

## Fallback Strategies

While modern browsers widely support the CSS features used, consider polyfills or alternative implementations for older browser support if necessary.

*   **DO** test your FAB component across a range of browsers and devices to ensure consistent appearance and behavior.
*   **DO** provide clear fallback content or alternative interaction methods if advanced CSS features are not supported. For example, ensure basic button functionality is preserved.