---
description: Implement dynamic and responsive timelines and visualizations using HTML canvas for complex data rendering in web applications.
filename: canvas-timeline-rendering
category: ui
---

# Using HTML Canvas for Dynamic Timelines

This guide covers best practices for rendering complex, dynamic timelines and visualizations using the HTML `<canvas>` element, particularly when dealing with multiple data tracks and interactive elements.

## Key Concepts

The primary challenge is efficiently rendering and managing complex visual data on a single canvas, including handling user interactions and ensuring smooth updates.

### Multiple Tracks on a Single Canvas

When displaying multiple distinct data tracks (e.g., Layout Shifts, Network, Renderer) within a single timeline visualization, rendering them onto one `<canvas>` element is more performant than using multiple canvases.

- **Use `clip()`**: To ensure each track renders within its designated area and doesn't overflow into adjacent tracks, use the `clip()` method on the canvas context before rendering each track's content. Define a clipping region (e.g., a rectangle) that represents the visible bounds of the track.

```javascript
// Assuming trackVisibleWindow is an object with x, y, width, height properties
canvasContext.beginPath();
canvasContext.rect(
    trackVisibleWindow.x, trackVisibleWindow.y, trackVisibleWindow.width, trackVisibleWindow.height);
canvasContext.clip();
```

- **Use `translate()`**: To manage the vertical positioning of different tracks without each track needing to know its absolute position, use `translate()`. The `TrackManager` (or a similar coordinating component) can translate the canvas context before rendering each track, allowing each track to render as if it were at the origin (0,0).

```javascript
// In the TrackManager, before rendering a track:
canvasContext.translate(0, trackVerticalPosition);

// Then, the track renders its content at (0,0) relative to its own coordinate system.
```

### Off-screen Canvases for Performance

To improve responsiveness, especially when dealing with frequent updates like highlighting, consider using multiple canvases: one for the main track rendering and another for interactive overlays (like highlights).

- **Separate Rendering**: Render the static track data onto a primary off-screen canvas. Render dynamic elements like highlights onto a secondary off-screen canvas.
- **Composite onto Visible Canvas**: Before presenting to the user, use `drawImage()` to composite the off-screen canvases onto the visible canvas. This allows for efficient updates, as only the highlight canvas might need redrawing when highlights change, while the main track canvas remains untouched.

```javascript
// Example of drawing one canvas onto another
mainCanvasContext.drawImage(highlightsCanvas, 0, 0);
```

## Testing Canvas-Based UI

Testing canvas rendering presents unique challenges as the drawn content is not part of the DOM.

### Screenshot Testing

- **Utilize Screenshot Tests**: For canvas components, implement screenshot testing. Each test renders the canvas component, captures a screenshot, and compares it against a stored baseline image.
- **Selective Use**: Employ screenshot tests primarily for canvas-based components. Over-reliance on screenshot tests for DOM elements can significantly slow down test suites and lead to brittle tests that fail due to minor visual changes.
- **Update Mechanism**: Provide a mechanism to update baseline screenshots when rendering has been intentionally changed.

### Comprehensively Tested Trace Parsing

When dealing with complex data parsing (e.g., trace files), separate parsing logic from rendering logic.

- **Handler-Based Parsing**: Implement a system where different "Handlers" are responsible for parsing specific types of data from the input (e.g., `LayoutShiftHandler`, `NetworkRequestsHandler`). This modular approach simplifies testing and maintenance.
- **Real-World Data Testing**: Use actual recordings saved from the application as part of your test suite. This ensures your parsing logic is robust and handles real-world data complexities effectively.