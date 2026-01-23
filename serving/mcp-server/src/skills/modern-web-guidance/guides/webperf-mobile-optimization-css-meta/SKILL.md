---
description: Optimize existing websites for mobile devices by leveraging CSS media queries and meta tags without a complete redesign.
filename: mobile-optimization-css-meta
category: webperf
---

# Mobile Optimization with CSS Media Queries and Meta Tags

This guide outlines how to adapt existing HTML5 websites for optimal viewing on mobile devices using CSS media queries and meta tags, ensuring a better user experience without requiring a complete site overhaul or a separate mobile codebase.

## Best Practices

### CSS Media Queries for Responsive Design

CSS Media Queries are essential for adapting your site's layout and styling to different screen sizes and devices.

-   **Target Specific Screen Sizes:** Use `max-width`, `min-width`, `max-device-width`, and `min-device-width` to apply styles based on the viewport or device's physical screen dimensions.
    ```html
    <link rel='stylesheet' media='only screen and (max-device-width: 320px)' href='phone.css'>
    <link rel='stylesheet' media='only screen and (min-width: 641px) and (max-width: 800px)' href='ipad.css'>
    ```
-   **Consider Orientation:** Adapt styles for portrait and landscape modes.
    ```html
    <style>
      @media only all and (orientation: portrait) { ... }
    </style>
    ```
-   **`media="handheld"` Caveats:** Be aware that modern mobile browsers (Android, iOS) often ignore `media="handheld"`. Focus on screen-based media queries for broader compatibility. If targeting older devices or specific configurations, consider the Windows Mobile trick:
    ```html
    <!-- media="handheld" trick for Windows Mobile -->
    <link rel="stylesheet" href="screen.css" media="Screen">
    <link rel="stylesheet" href="mobile.css" media="handheld">
    ```
-   **Incremental Overrides:** Apply mobile-specific styles (`mobile.css`) to override base styles (`base.css`) for smaller screens, focusing on essential adjustments like reduced whitespace, removal of non-touch-friendly `:hover` states, and single-column layouts.
-   **Layout Reordering:** Utilize CSS flexbox properties like `box-ordinal-group` to reorder content sections for a more logical mobile flow without altering the HTML markup.

### Mobile Meta Tags for Enhanced Experience

Meta tags provide crucial instructions to mobile browsers, improving usability and appearance.

-   **Viewport Settings:** Crucial for controlling how content scales and fits on mobile screens.
    -   Set `width=device-width` for a responsive layout that adapts to the device's screen width.
    -   Use `initial-scale=1.0` to set the initial zoom level.
    -   `user-scalable=yes` (or `no`) controls whether users can zoom.
    ```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes">
    ```
    -   **Android `target-densitydpi`:** For Android, `target-densitydpi=device-dpi` prevents scaling and allows for density-specific styling via CSS (`-webkit-device-pixel-ratio`) and JavaScript (`window.devicePixelRatio`).
-   **Full-Screen Browsing (iOS):**
    -   `apple-mobile-web-app-capable="yes"` allows the page to be viewed in a full-screen, app-like mode when bookmarked to the home screen.
    -   `apple-mobile-web-app-status-bar-style="black-translucent"` makes the status bar translucent for a more immersive experience.
    ```html
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    ```
-   **Home Screen Icons:** Provide icons that appear when users bookmark your site to their home screen.
    ```html
    <link rel="apple-touch-icon" href="/path/to/icon.png" />
    <link rel="apple-touch-icon-precomposed" href="/path/to/icon.png" />
    ```

### Vertical Layout for Small Screens

Prioritize a single-column, vertical layout for easier scrolling on mobile devices. This can be achieved using CSS media queries to rearrange elements.

### Mobile Optimizations

These are general performance best practices that are particularly critical for mobile.

-   **Auto-hide Address Bar:** Use JavaScript to scroll the page by one pixel on load to hide the browser's address bar.
    ```js
    window.addEventListener('load', function(e) {
      setTimeout(function() { window.scrollTo(0, 1); }, 1);
    }, false);
    ```
-   **Reduce Network Requests & Bandwidth:**
    -   **Remove iframes:** They can significantly increase latency.
    -   **Conditional HTML rendering:** Use server-side logic (e.g., Django's `is_mobile` variable) to omit unnecessary HTML elements and their associated requests.
    -   **CSS/JS Compression:** Use tools like YUI compressor or Closure Compiler. Ensure compatibility with inline media queries.
    -   **CSS Image Sprites:** Combine multiple small images into one.
    -   **Data URIs:** Use for very small images to save network requests, but be mindful of the increased size (~30%).
    -   **Optimize Script Loading:** Load Google Custom Search and other libraries efficiently. Load non-essential JS and CSS only on pages where they are actually used.
-   **Application Cache (AppCache):** Enables offline support and faster initial load times.
    -   **Never cache the manifest file:** Use server configuration (`expiration: "0s"`) to prevent caching.
    -   **Handle `updateready` events:** Inform users of updates and prompt for a page reload.
    -   **Keep manifests simple:** Cache only essential assets.
-   **Caching DOM Lookups:** Minimize DOM manipulations, as reflows are costly on mobile.
-   **Offload Client-Side Logic:** Move complex processing to the server where possible.
-   **Fluid Widths:** Replace fixed widths with `width:100%` or `width:auto` for elements.

## Fallback Strategies

While modern browsers offer robust support for these features, consider fallbacks for older or less capable devices if necessary, though the primary goal is to enhance the experience on capable devices. The strategies above, particularly media queries and viewport meta tags, already provide a form of graceful degradation.