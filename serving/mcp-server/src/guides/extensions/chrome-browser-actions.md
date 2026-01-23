---
description: Define and manage browser action icons, tooltips, badges, and popups for Chrome extensions.
filename: chrome-browser-actions
category: extensions
---

# Browser Actions

Reference docs:
- [chrome.browserAction API](https://developer.chrome.com/docs/extensions/mv2/reference/browser-action/)
- [Manifest File Format](https://developer.chrome.com/docs/extensions/mv2/manifest/)

## Best Practices

Browser actions provide a dedicated space for your extension's UI elements that are accessible from the Chrome toolbar. They are suitable for features that make sense on most pages and should be visually distinct.

### Icon

- **DO** use big, colorful icons that make the most of the 16x16-dip space.
- **DO** use alpha transparency for soft edges, ensuring your icon looks good on various themes.
- **DO** provide multiple icon sizes (e.g., 16x16, 24x24, 32x32) for optimal display across different screen densities and resolutions.
- **DON'T** try to mimic Chrome's monochrome menu icon; extensions should stand out.
- **DON'T** constantly animate your icon, as it can be annoying.

### Tooltip

- **DO** set a descriptive `default_title` in the manifest or use `browserAction.setTitle()` for tooltips that inform users about the action.
- **DO** consider internationalizing tooltips for a global audience.

### Badge

- **DO** use badges to display a small amount of critical information (4 characters or less) directly on the icon.
- **DON'T** overload the badge with too much information.

### Popup

- **DO** use popups for interactive UI elements or to display more detailed information when the user clicks the browser action icon.
- **DO** ensure popup content is responsive and fits within the allowed dimensions (25x25 to 800x600 pixels).
- **DON'T** use browser actions for features that are only relevant on specific pages; consider [page actions](https://developer.chrome.com/docs/extensions/mv2/reference/page-action/) instead.

## Manifest Configuration

Register your browser action in the extension manifest:

```json
{
  "name": "My Awesome Extension",
  "version": "1.0",
  "manifest_version": 2,
  "browser_action": {
    "default_icon": {
      "16": "images/icon16.png",
      "24": "images/icon24.png",
      "32": "images/icon32.png"
    },
    "default_title": "Click for options",
    "default_popup": "popup.html"
  }
}
```

## API Usage

You can programmatically control browser action elements using the `chrome.browserAction` API:

- `chrome.browserAction.setIcon(details, callback)`: Set the icon dynamically.
- `chrome.browserAction.setTitle(details, callback)`: Set the tooltip dynamically.
- `chrome.browserAction.setBadgeText(details, callback)`: Set the badge text.
- `chrome.browserAction.setBadgeBackgroundColor(details, callback)`: Set the badge background color.
- `chrome.browserAction.setPopup(details, callback)`: Set the popup HTML file dynamically.

## Fallback Strategies

While browser actions are a standard Chrome extension feature, consider the following for broader compatibility or graceful degradation if needed:

### Icon Display

- **DO** provide multiple icon sizes to ensure the best visual representation on screens with varying pixel densities. Chrome will select the most appropriate size.

### Tooltip and Popup Content

- **DO** ensure that any critical information or functionality conveyed by the tooltip or popup also has an accessible alternative, in case these elements are not displayed or interactable in all contexts.

## Examples

Explore the [chrome-extensions-samples](https://github.com/GoogleChrome/chrome-extensions-samples/tree/master/_archive/mv2/api/browserAction/) repository for practical examples of using browser actions.