---
description: Make HTML5 games automatically adjust to any screen resolution using CSS and JavaScript.
filename: auto-resizing-html5-games
category: ui
---

# Auto-Resizing HTML5 Games

Reference docs:
- [MDN - window.innerWidth](https://developer.mozilla.org/en-US/docs/Web/API/Window/innerWidth)
- [MDN - window.innerHeight](https://developer.mozilla.org/en-US/docs/Web/API/Window/innerHeight)
- [MDN - Element.style](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/style)
- [MDN - addEventListener](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/addEventListener)

## Best Practices

To create HTML5 games that fluidly adjust to any screen resolution, leverage a combination of CSS and JavaScript. CSS can handle basic full-screen display, but JavaScript is essential for maintaining the correct aspect ratio and preventing distortion.

### Preparing the Page

1.  **Structure your game area**: Use a `div` to contain your game elements (e.g., a `canvas` and a stats panel).
    ```html
    <div id="gameArea">
      <canvas id="gameCanvas"></canvas>
      <div id="statsPanel"></div>
    </div>
    ```
2.  **Initial CSS**: Position the `gameArea` to the center of the screen using `position: absolute`, `left: 50%`, and `top: 50%`. Child elements should use percentages for dimensions to scale with the parent.
    ```css
    #gameArea {
      position: absolute;
      left:     50%;
      top:      50%;
    }

    #gameCanvas {
      width: 100%;
      height: 100%;
    }

    #statsPanel {
      position: absolute;
      width: 100%;
      height: 8%; /* Example: 24px out of 300px original height */
      bottom: 0;
      opacity: 0.8;
    }
    ```

### Resizing the Game

1.  **Get references**: Obtain references to the `gameArea` and `gameCanvas` elements.
    ```js
    var gameArea = document.getElementById('gameArea');
    var gameCanvas = document.getElementById('gameCanvas');
    ```
2.  **Define aspect ratio**: Determine the desired width-to-height ratio for your game.
    ```js
    var widthToHeight = 4 / 3; // Example for a 4:3 aspect ratio
    ```
3.  **Get window dimensions**: Capture the current `innerWidth` and `innerHeight` of the browser window.
    ```js
    var newWidth = window.innerWidth;
    var newHeight = window.innerHeight;
    ```
4.  **Calculate new dimensions**: Compare the window's aspect ratio to the game's desired aspect ratio. Adjust either the width or height to fit while maintaining the game's aspect ratio.
    ```js
    var newWidthToHeight = newWidth / newHeight;

    if (newWidthToHeight > widthToHeight) {
        // Window is wider than desired game aspect ratio, fit by height
        newWidth = newHeight * widthToHeight;
        gameArea.style.height = newHeight + 'px';
        gameArea.style.width = newWidth + 'px';
    } else {
        // Window is taller than desired game aspect ratio, fit by width
        newHeight = newWidth / widthToHeight;
        gameArea.style.width = newWidth + 'px';
        gameArea.style.height = newHeight + 'px';
    }
    ```
5.  **Center the game area**: Apply negative margins to center the `gameArea` based on its new dimensions.
    ```js
    gameArea.style.marginTop = (-newHeight / 2) + 'px';
    gameArea.style.marginLeft = (-newWidth / 2) + 'px';
    ```
6.  **Adjust font size (optional)**: If child elements use `em` units, scale the `gameArea`'s `fontSize` accordingly.
    ```js
    gameArea.style.fontSize = (newWidth / 400) + 'em'; // Example scaling
    ```
7.  **Update canvas drawing dimensions**: Ensure the `canvas` element's `width` and `height` attributes match the calculated `newWidth` and `newHeight`. It's crucial to keep game engine dimensions separate from canvas drawing dimensions for dynamic resolution.
    ```js
    gameCanvas.width = newWidth;
    gameCanvas.height = newHeight;
    ```
8.  **Event Listeners**: Attach the resize function to `resize` and `orientationchange` events.
    ```js
    window.addEventListener('resize', resizeGame, false);
    window.addEventListener('orientationchange', resizeGame, false);
    ```

**DO** ensure that the game engine's internal dimensions are decoupled from the canvas element's display dimensions to support dynamic resolution changes.

## Summary

By combining CSS for initial positioning and JavaScript for dynamic resizing based on window dimensions and aspect ratio, you can create HTML5 games that adapt seamlessly to various screen resolutions and devices, providing an immersive experience.