---
description: Create a responsive, adaptive, and accessible switch component using HTML, CSS, and JavaScript.
filename: switch-component
category: ui
---

# Switch Component

This document outlines best practices for building a switch component that is responsive, adaptive, and accessible.

## Best Practices

A well-built switch component should clearly indicate its current state (on/off) and provide a simple mechanism for toggling between states. It should also be usable with various input methods, including keyboard navigation and assistive technologies.

```html
<label class="switch">
  <input type="checkbox">
  <span class="slider"></span>
</label>
```

```css
/* Basic styles for the switch container */
.switch {
  position: relative;
  display: inline-block;
  width: 60px;
  height: 34px;
}

/* Hide default checkbox */
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

/* The slider */
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #ccc;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 26px;
  width: 26px;
  left: 4px;
  bottom: 4px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #2196F3;
}

input:focus + .slider {
  box-shadow: 0 0 1px #2196F3;
}

input:checked + .slider:before {
  transform: translateX(26px);
}
```

## Accessibility Considerations

*   **Keyboard Navigation:** Ensure the switch can be focused using the Tab key and toggled using the Spacebar or Enter key. The native `<input type="checkbox">` handles this by default when styled appropriately.
*   **Screen Reader Support:** Use semantic HTML. The `<label>` element associated with the checkbox provides context for screen readers. Ensure the label text clearly describes the action the switch performs.
*   **Focus Indicators:** Provide clear visual focus indicators for keyboard users. The CSS example includes a `box-shadow` for focus states.
*   **Color Contrast:** Ensure sufficient color contrast between the switch's background, the slider, and the text (if any) to meet accessibility standards.

## Responsiveness and Adaptability

*   **Fluid Sizing:** Use relative units (like percentages or `em`) for widths and heights where appropriate to allow the switch to scale with its container.
*   **Breakpoints:** Consider using CSS media queries to adjust the size, spacing, or even the visual design of the switch at different screen sizes if necessary.
*   **Touch Targets:** Ensure the touch target area for the switch is large enough for easy interaction on touch devices.

## Fallback Strategies

For this component, the primary elements (`<input type="checkbox">`, `<label>`) are widely supported. If advanced styling or behavior is implemented using JavaScript, feature detection should be employed before applying those enhancements.

*   **JavaScript Enhancements:** If you are adding complex JavaScript behavior beyond the basic checkbox functionality, use feature detection to ensure the browser supports the necessary APIs before executing the script. For example, check for the existence of specific DOM elements or browser features.