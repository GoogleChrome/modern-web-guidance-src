---
description: Easily create visually appealing CSS gradients for web designs using Josh W Comeau's Gradient Generator tool.
filename: css-gradient-generator
category: ui
---

# CSS Gradient Generator

Reference docs:
- https://www.joshwcomeau.com/gradient-generator/
- https://developer.mozilla.org/en-US/docs/Web/CSS/gradient/linear-gradient
- https://www.joshwcomeau.com/css/make-beautiful-gradients/

## Best Practices

Josh W Comeau's CSS Gradient Generator is a simple yet powerful web application that simplifies the creation of beautiful CSS gradients. It focuses on linear gradients and allows for configuration using various color modes, even those not directly supported by the `linear-gradient` CSS function, by employing clever color interpolation techniques.

To use the tool, visit [Josh W Comeau's Gradient Generator](https://www.joshwcomeau.com/gradient-generator/). You can adjust parameters to create your desired gradient and then copy the generated CSS.

The following is an example of a CSS `linear-gradient` that could be generated or inspired by the tool:

```css
.element-with-gradient {
  background: linear-gradient(to right, hsl(200, 80%, 60%), hsl(280, 70%, 70%));
}
```

This tool is particularly helpful for developers who struggle with translating gradient syntax into visual results, offering a user-friendly interface to experiment with colors and configurations. Josh's supporting blog post dives deeper into the underlying theory of color interpolation, providing valuable insights for those interested in the technical details.

<img src="image/a-screenshot-the-gradien-e5560084171a2.png" alt="A screenshot of the Gradient Editor with a simple linear gradient." width="800" height="693">

## Browser Compatibility

Ensure your gradients are supported across different browsers. You can check compatibility for `linear-gradient` using the following resource:

{{ macros.BrowserCompat('css.types.image.gradient.linear-gradient') }}

Hero image by [Luke Chesser](https://unsplash.com/@lukechesser?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/s/photos/linear-gradient?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)