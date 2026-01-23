---
description: Provide a custom icon for Progressive Web Apps on iOS home screens by adding a link tag to your HTML.
filename: apple-touch-icon
category: pwa
---

# Apple touch icon

Reference docs:
- [Chrome's updated Installability Criteria](https://web.dev/blog/update-install-criteria)
- [PWA documentation](https://web.dev/docs/progressive-web-apps/)

## Best Practices

When users add a Progressive Web App (PWA) to their iOS home screen, the icon displayed is the *Apple touch icon*. To ensure a polished user experience, you should specify this icon using a `<link rel="apple-touch-icon">` tag in your HTML's `<head>`. If this tag is omitted, iOS will generate an icon from a screenshot of your page, which often results in a less ideal visual.

### Adding the Apple touch icon

1.  **Add the link tag to your HTML's `<head>`:**

    ```html/4
    <!DOCTYPE html>
    <html lang="en">
      <head>
        …
        <link rel="apple-touch-icon" href="/path/to/your/icon.png">
        …
      </head>
      …
    </html>
    ```

2.  **Replace `/path/to/your/icon.png` with the actual path to your desired icon.**

### Icon guidelines

To provide a good user experience and ensure your icon displays correctly, adhere to the following:

*   **Dimensions:** The icon should be 180x180 pixels or 192x192 pixels.
*   **Path Validity:** Ensure the specified path to the icon is correct and accessible.
*   **Background:** The background of the icon should not be transparent.

**Note:** While `rel="apple-touch-icon-precomposed"` also passes Lighthouse audits, it has been obsolete since iOS 7. It is recommended to use `rel="apple-touch-icon"` instead. Lighthouse does not verify the existence or correct sizing of the icon, so manual checks are still important.

## Resources

*   [Source code for the Lighthouse Apple touch icon audit](https://github.com/GoogleChrome/lighthouse/blob/master/lighthouse-core/audits/apple-touch-icon.js)
*   [Discover what it takes to be installable](https://web.dev/install-criteria)
*   [Use Apple Touch Icon (webhint)](https://webhint.io/docs/user-guide/hints/hint-apple-touch-icons/)

<aside class="caution"><strong>Caution:</strong> PWA testing in Lighthouse is deprecated. For more information on its deprecation see <a href="/blog/update-install-criteria">Chrome's updated Installability Criteria</a>. For guidance on testing, refer to the <a href="/docs/devtools/progressive-web-apps/">PWA documentation.</a></aside>