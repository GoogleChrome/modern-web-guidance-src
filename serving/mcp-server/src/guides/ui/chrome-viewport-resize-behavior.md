---
description: Prepare for changes in Chrome's viewport resize behavior on Android when the on-screen keyboard appears by understanding the new default and how to opt into previous behaviors.
filename: chrome-viewport-resize-behavior
category: ui
---

# Prepare for Chrome's Viewport Resize Behavior Changes on Android

In November 2022, Chrome 108 introduced significant changes to how the Layout Viewport behaves on Android when the on-screen keyboard (OSK) is displayed. Previously, Chrome on Android resized both the Layout Viewport and the Visual Viewport. With Chrome 108, it now only resizes the Visual Viewport, aligning its behavior with Chrome on iOS and Safari on iOS. This aims to create a more consistent and predictable experience for web developers.

## Understanding Viewports

*   **Layout Viewport:** The area where the web page is laid out. Elements with `position: fixed` are positioned relative to this viewport and remain in place as you scroll.
*   **Visual Viewport:** The portion of the viewport that is currently visible to the user. This can change when pinch-zooming or when the OSK is shown.

## Previous Behavior (Chrome < 108 on Android)

In older versions of Chrome on Android, showing the OSK would resize *both* the Layout Viewport and the Visual Viewport. This could lead to unexpected layout shifts, especially for elements using `position: fixed` or viewport-relative units.

## New Default Behavior (Chrome 108+ on Android)

With Chrome 108 and later, the default behavior is to *only* resize the Visual Viewport when the OSK appears. The Layout Viewport remains unchanged. This means:

*   Viewport-relative units (like `vh` and `vw`) will maintain their computed values.
*   Elements designed to take up the full visual space will continue to do so.
*   Elements using `position: fixed` will remain in their original positions, potentially being obscured by the OSK.

This change aligns Chrome on Android with other major browsers like Safari on iOS and Chrome on iOS.

## Opting Into Previous Behavior (for backwards compatibility)

If your website relies on the older behavior where the Layout Viewport was resized, you can opt back into it using the `interactive-widget` key in the viewport meta tag.

To use the previous behavior (`resizes-content`), add the following to your `<head>` section:

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, interactive-widget=resizes-content">
```

## Other `interactive-widget` Values

*   `resizes-visual` (Default in Chrome 108+): Resizes only the Visual Viewport.
*   `overlays-content`: Does not resize any viewport; the OSK overlays the content.

## Best Practices and Testing

1.  **Test your site:** Thoroughly test your website on Chrome 108+ on Android, paying close attention to elements that use `position: fixed` and viewport-relative units.
2.  **Consider `interactive-widget`:** If you encounter layout issues due to the new default, consider using `interactive-widget=resizes-content` to maintain the old behavior, or adapt your site to the new default.
3.  **Check for obscurity:** Ensure that essential content or controls are not obscured by the OSK, especially if you opt for `resizes-visual` or `overlays-content`.
4.  **Report bugs:** If you find issues, report them to [crbug.com](https://crbug.com/), including "on-screen keyboard" in the title.

**Note:** These changes do not affect WebView. The `interactive-widget` meta tag is only supported by Chrome 108 and up, and does not apply to Chrome on iOS/iPadOS due to their use of WebKit.