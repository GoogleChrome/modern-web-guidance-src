---
description: Use Chrome Extension APIs to replace default Chrome pages like bookmarks, history, or the new tab page with custom HTML content.
filename: chrome-page-overrides
category: extensions
---

# Override Chrome Pages

Extensions can use HTML override pages to replace a page Google Chrome normally provides. An extension can contain an override for any of the following pages, but each extension can only override one page:

*   **Bookmark Manager**: Replaces the page accessed via `chrome://bookmarks`.
*   **History**: Replaces the page accessed via `chrome://history`.
*   **New Tab**: Replaces the page accessed when a new tab is opened.

## Incognito Window Behavior

In incognito windows, extensions cannot override New Tab pages. Other pages generally still work if the `incognito` manifest property is set to "split" (the default value).

## Manifest Configuration

To register an override page, use the `chrome_url_overrides` key in your extension's manifest file.

```json
{
  "manifest_version": 3,
  "name": "My Override Extension",
  ...,
  "chrome_url_overrides" : {
    "PAGE_TO_OVERRIDE": "myPage.html"
  },
  ...
}
```

Replace `PAGE_TO_OVERRIDE` with one of the following:
*   `"bookmarks"`
*   `"history"`
*   `"newtab"`

## Best Practices

*   **Optimize for Speed and Size**: Users expect built-in browser pages to load instantly. Ensure your override page is quick and small. Avoid synchronous database access and prefer `fetch()` over `XMLHttpRequest()` for network requests.
*   **Provide a Clear Title**: To prevent user confusion, give your override page a title using the `<title>` tag in your HTML. Without a title, it defaults to the page's URL.
*   **Address Keyboard Focus**: Be aware that new tabs, by default, give keyboard focus to the address bar first. Design your page accordingly and don't assume focus will land on other elements.
*   **Differentiate from Defaults**: When creating a new tab page, make it distinctly your own to avoid confusing users with Chrome's default new tab page.