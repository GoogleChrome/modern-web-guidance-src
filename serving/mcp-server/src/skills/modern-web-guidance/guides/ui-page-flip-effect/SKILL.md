---
description: Create a realistic page-flipping effect for digital books using HTML5 canvas and JavaScript for an engaging reading experience.
filename: page-flip-effect
category: ui
---

# Page Flip Effect

Reference docs:
- [Canvas API specification](http://developers.whatwg.org/the-canvas-element.html#the-canvas-element)

## Best Practices

To create an immersive digital book experience, simulate the tactile feel of turning pages using the HTML5 Canvas API and JavaScript. This approach allows for rich graphical interactions and animations that are not achievable with standard DOM manipulation alone.

### Markup Structure

Maintain semantic HTML for accessibility and SEO by placing content within DOM elements, which can then be rendered onto the canvas. This ensures content remains accessible even if JavaScript is disabled.

```html
<div id='book'>
  <canvas id='pageflip-canvas'></canvas>
  <div id='pages'>
    <section>
      <div>Your page content here</div>
    </section>
    <!-- More <section> elements for other pages -->
  </div>
</div>
```

- The main `div` with `id='book'` acts as the container.
- The `canvas` element `id='pageflip-canvas'` is where the page flip animation will be drawn.
- A `div` with `id='pages'` contains individual page `section` elements.
- Each `section` contains a `div` wrapper for its content, enabling independent styling and masking.

### JavaScript Logic

The core of the page flip effect lies in managing the state of each page and rendering the visual transitions.

1.  **Constants and Initialization:** Define constants for book and page dimensions, canvas padding, and initialize flip objects for each page.

    ```javascript
    var BOOK_WIDTH = 830;
    var BOOK_HEIGHT = 260;
    var PAGE_WIDTH = 400;
    var PAGE_HEIGHT = 250;
    var PAGE_Y = (BOOK_HEIGHT - PAGE_HEIGHT) / 2;
    var CANVAS_PADDING = 60;

    // Initialize flip objects
    var flips = [];
    var pages = document.getElementById('book').getElementsByTagName('section');
    for (var i = 0, len = pages.length; i < len; i++) {
      pages[i].style.zIndex = len - i; // Layer pages correctly
      flips.push({
        progress: 1, // Current fold progress (-1 to 1)
        target: 1,   // Target fold progress
        page: pages[i],
        dragging: false
      });
    }
    ```

2.  **Input Handling:** Capture mouse events to determine user interaction and update the `target` progress for flipping pages.

    ```javascript
    function mouseMoveHandler(event) {
      // Update mouse position relative to the book spine
      mouse.x = event.clientX - book.offsetLeft - (BOOK_WIDTH / 2);
      mouse.y = event.clientY - book.offsetTop;
    }

    function mouseDownHandler(event) {
      // Determine which page is being dragged based on mouse position
      if (Math.abs(mouse.x) < PAGE_WIDTH) {
        if (mouse.x < 0 && page - 1 >= 0) {
          flips[page - 1].dragging = true;
        } else if (mouse.x > 0 && page + 1 < flips.length) {
          flips[page].dragging = true;
        }
      }
      event.preventDefault(); // Prevent text selection
    }

    function mouseUpHandler(event) {
      for (var i = 0; i < flips.length; i++) {
        if (flips[i].dragging) {
          // Set target based on mouse position and update page number
          if (mouse.x < 0) {
            flips[i].target = -1;
            page = Math.min(page + 1, flips.length);
          } else {
            flips[i].target = 1;
            page = Math.max(page - 1, 0);
          }
        }
        flips[i].dragging = false;
      }
    }
    ```

3.  **Rendering Loop:** Continuously clear the canvas and redraw each page's flip state.

    ```javascript
    function render() {
      context.clearRect(0, 0, canvas.width, canvas.height); // Clear canvas

      for (var i = 0, len = flips.length; i < len; i++) {
        var flip = flips[i];

        if (flip.dragging) {
          flip.target = Math.max(Math.min(mouse.x / PAGE_WIDTH, 1), -1);
        }

        // Smoothly animate progress towards the target
        flip.progress += (flip.target - flip.progress) * 0.2;

        // Render the flip if it's dragging or not fully closed
        if (flip.dragging || Math.abs(flip.progress) < 0.997) {
          drawFlip(flip);
        }
      }
    }
    ```

### Drawing the Flip (`drawFlip` function)

This function handles the complex drawing of the page fold, including shadows and gradients, using the canvas context.

1.  **Calculate Visual Properties:** Determine the strength of the fold, the width and position of the folded paper, and shadow dimensions.

    ```javascript
    var strength = 1 - Math.abs(flip.progress);
    var foldWidth = (PAGE_WIDTH * 0.5) * (1 - flip.progress);
    var foldX = PAGE_WIDTH * flip.progress + foldWidth;
    var verticalOutdent = 20 * strength;

    // Calculate shadow widths
    var paperShadowWidth = (PAGE_WIDTH*0.5) * Math.max(Math.min(1 - flip.progress, 0.5), 0);
    var rightShadowWidth = (PAGE_WIDTH*0.5) * Math.max(Math.min(strength, 0.5), 0);
    var leftShadowWidth = (PAGE_WIDTH*0.5) * Math.max(Math.min(strength, 0.5), 0);

    // Mask the page content by setting its width
    flip.page.style.width = Math.max(foldX, 0) + 'px';
    ```

2.  **Canvas Transformations and Drawing:** Use `context.save()`, `context.translate()`, and `context.restore()` to manage the drawing coordinate system. Draw shadows, gradients, and the bent paper shape.

    ```javascript
    context.save();
    context.translate(CANVAS_PADDING + (BOOK_WIDTH / 2), PAGE_Y + CANVAS_PADDING);

    // Draw left side sharp shadow
    context.strokeStyle = `rgba(0,0,0,${0.05 * strength})`;
    context.lineWidth = 30 * strength;
    context.beginPath();
    context.moveTo(foldX - foldWidth, -verticalOutdent * 0.5);
    context.lineTo(foldX - foldWidth, PAGE_HEIGHT + (verticalOutdent * 0.5));
    context.stroke();

    // Draw right side drop shadow (gradient)
    var rightShadowGradient = context.createLinearGradient(foldX, 0, foldX + rightShadowWidth, 0);
    rightShadowGradient.addColorStop(0, `rgba(0,0,0,${strength * 0.2})`);
    rightShadowGradient.addColorStop(0.8, `rgba(0,0,0,0.0)`);
    context.fillStyle = rightShadowGradient;
    context.beginPath();
    context.moveTo(foldX, 0);
    context.lineTo(foldX + rightShadowWidth, 0);
    context.lineTo(foldX + rightShadowWidth, PAGE_HEIGHT);
    context.lineTo(foldX, PAGE_HEIGHT);
    context.fill();

    // Draw left side drop shadow (gradient)
    var leftShadowGradient = context.createLinearGradient(foldX - foldWidth - leftShadowWidth, 0, foldX - foldWidth, 0);
    leftShadowGradient.addColorStop(0, `rgba(0,0,0,0.0)`);
    leftShadowGradient.addColorStop(1, `rgba(0,0,0,${strength * 0.15})`);
    context.fillStyle = leftShadowGradient;
    context.beginPath();
    context.moveTo(foldX - foldWidth - leftShadowWidth, 0);
    context.lineTo(foldX - foldWidth, 0);
    context.lineTo(foldX - foldWidth, PAGE_HEIGHT);
    context.lineTo(foldX - foldWidth - leftShadowWidth, PAGE_HEIGHT);
    context.fill();

    // Draw gradient for the folded paper (highlights & shadows)
    var foldGradient = context.createLinearGradient(foldX - paperShadowWidth, 0, foldX, 0);
    foldGradient.addColorStop(0.35, `#fafafa`);
    foldGradient.addColorStop(0.73, `#eeeeee`);
    foldGradient.addColorStop(0.9, `#fafafa`);
    foldGradient.addColorStop(1.0, `#e2e2e2`);
    context.fillStyle = foldGradient;
    context.strokeStyle = `rgba(0,0,0,0.06)`;
    context.lineWidth = 0.5;

    // Draw the folded paper shape with curves
    context.beginPath();
    context.moveTo(foldX, 0);
    context.lineTo(foldX, PAGE_HEIGHT);
    context.quadraticCurveTo(foldX, PAGE_HEIGHT + (verticalOutdent * 2), foldX - foldWidth, PAGE_HEIGHT + verticalOutdent);
    context.lineTo(foldX - foldWidth, -verticalOutdent);
    context.quadraticCurveTo(foldX, -verticalOutdent * 2, foldX, 0);
    context.fill();
    context.stroke();

    context.restore();
    ```

### Performance Considerations

-   **Selective Clearing:** Instead of clearing the entire canvas with `context.clearRect(0, 0, canvas.width, canvas.height)`, optimize by clearing only the specific regions where drawing occurs.
-   **Animation Optimization:** Ensure that only active flips (being dragged or not fully open/closed) are redrawn in each frame of the `render` loop.

## Fallback Strategies

While the canvas provides powerful visual capabilities, consider graceful degradation for browsers that may not fully support or perform well with canvas operations. For essential content, ensure it's still accessible through standard HTML DOM elements.

## Next Steps

-   Enhance the page flip effect by integrating other book-like features such as interactive hard covers or page-turning sounds.
-   Explore the full potential of HTML5 features by examining more refined examples, like the one at [www.20thingsilearned.com](http://www.20thingsilearned.com), to see how page flips can be combined with other advanced web technologies.