---
description: Use the WebKit-specific CSS canvas API to programmatically animate CSS backgrounds using JavaScript, enabling hardware-accelerated and DOM-independent animations.
filename: webkit-css-canvas-backgrounds
category: webperf
---

# Animating CSS Backgrounds with WebKit Canvas

Reference docs:
- https://webkit.org/blog/176/css-canvas-drawing/

## Best Practices

The WebKit CSS canvas API provides a powerful, albeit non-standard, way to use HTML canvas elements as CSS backgrounds. This approach offers performance benefits by leveraging hardware acceleration and eliminating the need for direct DOM manipulation during animations.

### Using 2D Canvas as a Background

Instead of specifying a traditional image URL for the `background` property, use the `-webkit-canvas()` notation, referencing a string identifier:

```css
.canvas-bg {
    background: -webkit-canvas(animation) no-repeat 50% 50%;
}
```

To create and obtain the 2D drawing context, use `document.getCSSCanvasContext()`:

```js
var ctx = document.getCSSCanvasContext('2d', 'animation', 300, 300);
```

**Key Points:**

*   The second argument to `getCSSCanvasContext()` must match the identifier used in `-webkit-canvas()`.
*   There is a single CSS canvas per global identifier within a document.
*   Specifying a new size for the canvas context will clear the canvas buffer.
*   All elements referencing a CSS canvas with the same name share that canvas, allowing for synchronized animations across multiple elements.

### Animating with `requestAnimationFrame`

Leverage `requestAnimationFrame()` to drive animations. Once set up, the association between the CSS and the canvas is maintained, and animations update directly on the canvas without further DOM interaction.

```js
function animate() {
    // Drawing code here...
    var url = canvas.toDataURL('image/jpeg'); // Example: if needed, though direct canvas drawing is preferred
    // ... draw on ctx ...

    requestAnimationFrame(animate);
}

// Initial setup
var ctx = document.getCSSCanvasContext('2d', 'animation', 300, 300);
animate();
```

### Using WebGL as a Background

The same principle applies to WebGL. Simply specify `'experimental-webgl'` as the context type:

```js
var gl = document.getCSSCanvasContext('experimental-webgl', 'animation', 300, 150);
// WebGL drawing code here...
```

## Performance Benefits

*   **Hardware Acceleration:** Utilizes GPU for rendering, leading to smoother animations.
*   **DOM Independence:** Avoids costly DOM manipulation for background updates, which is crucial for high-performance web applications.

## Limitations and Alternatives

*   **Non-Standard API:** `-webkit-canvas()` is a non-standard feature, primarily supported by WebKit-based browsers (Safari, older Chrome versions).
*   **Mozilla's `-moz-element()`:** For broader cross-browser compatibility, consider Mozilla's `-moz-element()`, which allows using arbitrary HTML content (including canvas) as a CSS background. However, this feature has security implications and is not widely adopted.

## Fallback Strategies

If compatibility with browsers not supporting `-webkit-canvas()` is a concern, consider these approaches:

*   **CSS Sprites with `background-position`:** For static or pre-defined animations, updating `background-position` via JavaScript is a widely supported method.
*   **`toDataURL()` with DOM updates:** While inefficient, using `canvas.toDataURL()` and setting `element.style.background` can serve as a last resort, but be mindful of the ~33% size overhead and performance degradation.

For modern development, it's crucial to check browser support and potentially implement polyfills or alternative solutions if targeting a wider audience.