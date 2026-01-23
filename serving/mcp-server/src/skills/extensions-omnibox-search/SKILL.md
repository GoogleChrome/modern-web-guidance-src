---
description: Provide a custom search experience directly within the browser's address bar.
filename: omnibox-search
category: extensions
---

# Chrome Omnibox Search

The `chrome.omnibox` API allows you to create custom search experiences directly within the browser's address bar. When a user enters your extension's keyword, your extension takes over the omnibox, allowing you to provide real-time suggestions as the user types and take action when a suggestion is accepted.

## Best Practices

### Keyword Registration

- **DO** include an `omnibox` object with a `keyword` field in your extension's `manifest.json` to enable the omnibox API.
- **DO** specify a 16x16-pixel icon in the `icons` field of your `manifest.json`. This icon will be displayed in the address bar when the user enters keyword mode.
- **DO** provide a full-color version of your 16x16 icon, as Chrome will automatically generate a grayscale version and a color version may be used in other contexts (e.g., context menus).

```json
{
  "name": "My Omnibox Extension",
  "version": "1.0",
  "omnibox": { "keyword" : "mysearch" },
  "icons": {
    "16": "icons/16.png"
  },
  "background": {
    "persistent": false,
    "scripts": ["background.js"]
  }
}
```

### Suggestion Handling

- **DO** implement the `chrome.omnibox.onInputChanged` event listener to provide suggestions in real-time as the user types.
- **DO** use `chrome.omnibox.setDefaultSuggestion` to set a default suggestion that appears when the user enters keyword mode.
- **DO** utilize the `suggestions` parameter in the `onInputChanged` callback to offer structured and rich suggestions.
- **DO** handle the `chrome.omnibox.onInputEntered` event to perform an action (e.g., navigate to a URL, trigger an internal function) when the user accepts a suggestion.

```javascript
chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  // Fetch or generate suggestions based on 'text'
  const suggestions = [
    { content: `search_for_${text}`, description: `Search for ${text}` },
    { content: `info_about_${text}`, description: `Get info on ${text}` }
  ];
  suggest(suggestions);
});

chrome.omnibox.onInputEntered.addListener((text) => {
  if (text.startsWith('search_for_')) {
    const query = text.substring('search_for_'.length);
    // Navigate to search results page
    chrome.tabs.update({ url: `https://example.com/search?q=${query}` });
  } else if (text.startsWith('info_about_')) {
    const topic = text.substring('info_about_'.length);
    // Navigate to information page
    chrome.tabs.update({ url: `https://example.com/info/${topic}` });
  }
});

chrome.omnibox.setDefaultSuggestion({
  description: 'Enter a search term for Example.com'
});
```

### User Experience

- **DO** keep suggestions concise and relevant to the user's input.
- **DO** provide clear and descriptive text for each suggestion.
- **DO** ensure the actions triggered by accepting suggestions are intuitive and aligned with user expectations.
- **DO** test your omnibox suggestions across different input lengths and scenarios to ensure a smooth user experience.

## Example

You can find a practical example of the omnibox API in the [chrome-extensions-samples repository](https://github.com/GoogleChrome/chrome-extensions-samples/tree/main/api-samples/omnibox).