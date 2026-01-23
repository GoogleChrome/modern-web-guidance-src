---
description: Provide a predictable and robust user experience by handling browser interventions like freezing and discarding background tabs.
filename: robust-page-lifecycle-handling
category: webperf
---

# Robust Page Lifecycle Handling

Reference docs:
- https://developer.chrome.com/docs/web-platform/page-lifecycle-api
- https://developer.mozilla.org/en-US/docs/Web/API/Page_Lifecycle_API

## Best Practices

The Page Lifecycle API provides developers with lifecycle hooks to safely handle browser interventions such as freezing and discarding background pages. This enables browsers to conserve resources proactively, leading to a better user experience.

### Understanding States and Events

It's crucial to understand the different states a page can be in and the events that signal transitions between them.

| State       | Description                                                                                                                                                                                                                                                                              | Possible Previous States