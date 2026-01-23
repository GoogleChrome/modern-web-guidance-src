---
description: Create a side panel in Chrome extensions to display custom UI that remains visible when navigating between tabs.
filename: create-side-panel
category: extensions
---

# Side Panel API

Reference docs:
- https://developer.chrome.com/docs/extensions/reference/sidePanel

## Best Practices

The Side Panel API allows extensions to display their own UI in a Chrome side panel. This panel can remain open across tab navigations, and its visibility can be restricted to specific websites.

Consider the Dictionary side panel example, which enables users to right-click a word to see its definition directly in the side panel.

<figure>
  <img src="images/side-panel.png" alt="Dictionary side panel extension." class="screenshot" width="379">
  <figcaption>Dictionary side panel extension.</figcaption>
</figure>

### Creating a Side Panel

To create a side panel, you'll need to define its behavior and appearance within your extension's manifest and associated code.

- **Manifest Configuration:** Specify the `side_panel` key in your `manifest.json` file to define the default page for your side panel.
- **API Usage:** Utilize the `chrome.sidePanel` API to programmatically control the side panel's visibility, associate it with specific pages, and handle user interactions.

### User Experience Considerations

- **Persistence:** Leverage the side panel's ability to stay open during navigation to provide continuous functionality or information.
- **Contextual Relevance:** Restrict the side panel's appearance to relevant websites to avoid clutter and ensure it's only available when useful.
- **Discoverability:** Make it clear to users how to open and interact with the side panel, for example, through context menus or dedicated UI elements.

For more advanced samples and use cases, refer to the [Side Panel API reference page](/docs/extensions/reference/sidePanel).