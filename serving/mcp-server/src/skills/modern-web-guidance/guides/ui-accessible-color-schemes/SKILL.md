---
description: Create accessible and themeable color schemes using HSL in CSS for modern browsers.
filename: accessible-color-schemes
category: ui
---

# Accessible Color Schemes

This guide explains how to build dark, light, and dim color schemes with HSL. The CSS works across modern browsers, establishes foundational architecture for more themes, and is accessible.

## Best Practices

When creating color schemes, leverage HSL (Hue, Saturation, Lightness) to build flexible and accessible themes. This approach allows for easy manipulation of color properties and ensures consistency across different states.

### Foundational Architecture

Establish a clear architecture for your custom properties to manage different themes effectively. This will make it easier to introduce new themes in the future.

```css
/* Define base HSL values */
:root {
  --base-hue: 200;
  --base-saturation: 50%;
  --base-lightness-light: 90%;
  --base-lightness-dark: 10%;
  --base-lightness-dim: 40%;
}

/* Light theme */
.theme-light {
  --background: hsl(var(--base-hue), var(--base-saturation), var(--base-lightness-light));
  --text-color: hsl(var(--base-hue), var(--base-saturation), calc(var(--base-lightness-dark) + 20%));
  /* Add other theme-specific properties */
}

/* Dark theme */
.theme-dark {
  --background: hsl(var(--base-hue), var(--base-saturation), var(--base-lightness-dark));
  --text-color: hsl(var(--base-hue), var(--base-saturation), var(--base-lightness-light));
  /* Add other theme-specific properties */
}

/* Dim theme */
.theme-dim {
  --background: hsl(var(--base-hue), var(--base-saturation), var(--base-lightness-dim));
  --text-color: hsl(var(--base-hue), var(--base-saturation), var(--base-lightness-light));
  /* Add other theme-specific properties */
}
```

### Accessibility Considerations

Ensure sufficient contrast ratios between text and background colors for readability. HSL's lightness component makes it easy to adjust these values programmatically.

### Browser Compatibility

The described CSS techniques using HSL and custom properties are widely supported in modern browsers. For older browsers, consider providing fallbacks or progressive enhancement.

### Debugging Tools

Utilize browser developer tools to inspect and debug your color schemes. You can easily see the computed values of your custom properties and how they are applied.

## Resources

- **Read along:** [https://goo.gle/350bmMi](https://goo.gle/350bmMi)
- **Try a demo:** [https://goo.gle/3ps7Rry](https://goo.gle/3ps7Rry)
- **Get the source:** [https://goo.gle/3n4Sfcg](https://goo.gle/3n4Sfcg)

Watch more GUI Challenges → [https://goo.gle/GUIchallenges](https://goo.gle/GUIchallenges)

Subscribe to Google Chrome Developers → [http://goo.gl/LLLNvf](http://goo.gl/LLLNvf)