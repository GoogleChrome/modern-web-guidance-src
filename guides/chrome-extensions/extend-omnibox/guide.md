---
name: extend-omnibox
description: Provide custom suggestions in the Chrome address bar when users type a registered keyword shortcut.
web-feature-ids: []
---

# Extend the Chrome Address Bar

The Omnibox API registers a keyword that activates the extension when typed in the address bar, followed by Space or Tab. The extension can then suggest completions and handle the final selection. This is useful for custom search, navigation shortcuts, or command launchers.

## Manifest setup

```json
{
  "omnibox": { "keyword": "wiki" }
}
```

The user types `wiki` then presses Space or Tab to enter "extension mode". The address bar shows the extension's suggestions.

## Provide real-time suggestions

```js
// service-worker.js

// Called each time the user changes the text after the keyword
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  if (text.length < 2) return; // avoid suggestions for very short input

  // Set default suggestion (shown in the address bar itself)
  chrome.omnibox.setDefaultSuggestion({
    description: `Search Wikipedia for "<match>${text}</match>"`
  });

  // Fetch and provide dropdown suggestions
  try {
    const response = await fetch(
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(text)}&limit=5&format=json`
    );
    const [, titles, , urls] = await response.json();

    suggest(titles.map((title, i) => ({
      content: urls[i],          // value passed to onInputEntered
      description: `${title} — <url>${urls[i]}</url>`
    })));
  } catch (err) {
    console.error('Suggestion fetch failed:', err);
  }
});
```

## Handle the final selection

```js
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  // text is either the URL from a suggestion's content field, or the raw user input
  const url = text.startsWith('http')
    ? text
    : `https://en.wikipedia.org/wiki/${encodeURIComponent(text)}`;

  switch (disposition) {
    case 'currentTab':
      chrome.tabs.update({ url });
      break;
    case 'newForegroundTab':
      chrome.tabs.create({ url });
      break;
    case 'newBackgroundTab':
      chrome.tabs.create({ url, active: false });
      break;
  }
});
```

## Description formatting

Suggestion descriptions support XML-like tags for visual styling:

| Tag | Rendering |
|-----|-----------|
| `<url>text</url>` | URL-style formatting |
| `<match>text</match>` | Bold/highlighted match |
| `<dim>text</dim>` | Dimmed secondary text |

Example: `"Wikipedia: <match>${text}</match> — <dim>${resultCount} results</dim>"`

## Required permissions for external API calls

If your suggestion fetch hits an external domain, declare it in `host_permissions`:

```json
{
  "host_permissions": ["https://en.wikipedia.org/*"]
}
```

## Detect when the user cancels

```js
chrome.omnibox.onInputCancelled.addListener(() => {
  // User pressed Escape — clean up any in-progress work
});
```
