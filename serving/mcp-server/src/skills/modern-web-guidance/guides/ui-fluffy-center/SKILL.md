---
description: A technique for centering content on a webpage using equal padding on all sides.
filename: fluffy-center
category: ui
---

# Fluffy Center

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/CSS/padding
- https://developer.mozilla.org/en-US/docs/Web/CSS/box-sizing

## Best Practices

The "Fluffy Center" technique involves applying equal padding to all sides of an element to achieve perfect centering of its content. This is particularly useful for simple layouts where a fixed-size or fluid content block needs to be precisely in the middle of its container.

```css
.container {
  display: flex; /* Or grid, or simply use block layout */
  justify-content: center; /* For flexbox/grid, centers horizontally */
  align-items: center; /* For flexbox/grid, centers vertically */
  min-height: 100vh; /* Example to ensure container takes full viewport height */
}

.fluffy-center-content {
  padding: 20px; /* Example padding */
  box-sizing: border-box; /* Ensures padding is included in the element's total width and height */
  text-align: center; /* Centers inline content within the element */
}
```

```html
<div class="container">
  <div class="fluffy-center-content">
    <h1>Welcome!</h1>
    <p>This content is perfectly centered.</p>
  </div>
</div>
```

## Considerations

When using the Fluffy Center technique:

- **`box-sizing`**: Always use `box-sizing: border-box;` to ensure that the padding is accounted for within the element's defined width and height, preventing unexpected layout shifts.
- **Responsiveness**: Adjust the padding values or use relative units (like `em` or `vw`) to ensure the centering looks good across different screen sizes.
- **Content Flow**: This technique is best suited for blocks of content. For more complex layouts or dynamic content, other centering methods like Flexbox or CSS Grid might be more appropriate.

See the full article for many more details about this technique and when it's efficient.

<a href="/centering-in-css">Full article</a> · <a href="https://www.youtube.com/watch?v=ncYzTvEMCyE">Video on YouTube</a> · <a href="https://github.com/argyleink/gui-challenges/tree/main/centering">Source on Github</a>