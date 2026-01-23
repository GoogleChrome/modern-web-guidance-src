---
description: Enhance online learning by allowing users to open arbitrary HTML content in a floating, always-on-top Picture-in-Picture window.
filename: document-picture-in-picture-enhancement
category: ui
---

# Document Picture-in-Picture API for Enhanced User Experience

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Document_Picture-in-Picture_API
- https://developer.mozilla.org/en-US/docs/Glossary/Progressive_Enhancement
- https://developer.mozilla.org/en-US/docs/Glossary/Graceful_degradation

## Best Practices

The Document Picture-in-Picture API allows web applications to display arbitrary HTML content in a floating, always-on-top window, enhancing user experience for applications like interactive learning platforms. This is particularly useful for allowing users to keep a preview window or other important content visible while interacting with the main application.

When implementing this feature, treat it as a progressive enhancement rather than a standard feature.

**DO** check for browser support using `"documentPictureInPicture" in window`.

**DO** wrap all `documentPictureInPicture` calls within this check to prevent errors on unsupported browsers.

**DO** consider the dimensions of the Picture-in-Picture window. You can specify `width` and `height` in the `requestWindow` options to match specific elements, the current document, or provide fixed values.

**DO** populate the `pipWindow.document` with the necessary HTML content, and sync CSS if applicable.

**DO** provide a fallback mechanism (graceful degradation) for browsers that do not support the API. This could involve resizing the content within the main application window or offering alternative layout options.

**DO** manage the tooltip for the button that toggles Picture-in-Picture. When supported, it should indicate entering/exiting PiP; when not supported, it should describe the fallback behavior (e.g., "Maximize"/"Minimize").

```javascript
async function initDocumentPip(htmlCode) {
  const isPipSupported = "documentPictureInPicture" in window;

  if (!isPipSupported) {
    // Implement fallback behavior here
    console.log("Document Picture-in-Picture not supported. Using fallback.");
    return false;
  }

  try {
    const pipWindow = await documentPictureInPicture.requestWindow({
      width: window.innerWidth, // Example: match current window width
      height: window.innerHeight, // Example: match current window height
    });

    // Populate the PiP window with content
    pipWindow.document.documentElement.innerHTML = htmlCode;

    // You might also need to sync CSS or other dynamic content here
    // e.g., pipWindow.document.head.innerHTML += '<link rel="stylesheet" href="style.css">';

    return pipWindow;
  } catch (error) {
    console.error("Error requesting Picture-in-Picture window:", error);
    // Handle potential errors during window request
    return false;
  }
}
```

## Fallback Strategies

Since the Document Picture-in-Picture API has limited availability, it's crucial to implement graceful degradation.

**DO NOT** assume the API will be available.

**DO** provide an alternative user experience for unsupported browsers. For instance, if the feature is used to maximize a preview window, the fallback could be to make that preview window take up all available space within the current application window.

**DO** clearly communicate the fallback behavior to the user, potentially through button text or tooltips, distinguishing it from the Picture-in-Picture functionality.

The following videos from the original article illustrate these concepts:
- Initial state and layout.
- Enhanced experience with Document PiP.
- Fallback behavior for unsupported browsers.

By combining the Document Picture-in-Picture API with progressive enhancement and robust fallback strategies, you can deliver an enhanced user experience across a wider range of browsers and devices.