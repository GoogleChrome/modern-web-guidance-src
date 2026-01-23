---
description: Centralize client-side routing logic for single-page applications using the Navigation API to improve developer experience and browser compatibility.
filename: centralized-spa-routing
category: ui
---

# Centralized Client-Side Routing with the Navigation API

Reference docs:
- https://developer.mozilla.org/en-US/docs/Web/API/Navigation_API
- https://wicg.github.io/navigation-api/

## Best Practices

The Navigation API offers a centralized approach to handling client-side routing in Single-Page Applications (SPAs) by providing a single `navigate` event listener. This listener intercepts all navigation attempts, allowing you to manage page transitions programmatically.

**DO** use the `navigation.addEventListener('navigate', ...)` to handle all routing logic in one place. This unifies handling for user interactions like clicking links, form submissions, and programmatic navigation initiated by your code.

**DO** use `event.intercept({ handler: ... })` within the navigate listener to manage the transition to the new page. The `handler` function should contain the logic to update your application's state and render the new content.

**DO** leverage `event.intercept()`'s ability to accept an `async handler` to manage asynchronous operations like data fetching, and return a `Promise` to signal the duration of the navigation.

**DO** utilize `event.signal` (an `AbortSignal`) within your `handler` to cancel ongoing asynchronous operations if a new navigation preempts the current one or if the user interrupts the navigation.

**DO** use `event.canIntercept` to check if a navigation can be intercepted. Cross-origin navigations and cross-document traversals cannot be intercepted.

**DO** consider the properties `event.hashChange`, `event.downloadRequest`, and `event.formData` to determine if a navigation should be intercepted. Often, these types of navigations can be left to the browser's default handling.

**DO** use `navigation.currentEntry.getState()` to access developer-provided state associated with the current history entry.

**DO** update state using `navigation.navigate(url, { state: newState })` or `navigation.updateCurrentEntry({ state: newState })`.

**DO** understand that `event.formData` indicates a form submission and handle it accordingly, potentially by intercepting the `POST` request and managing it with `fetch()`.

**DO NOT** rely on the `popstate` event for handling all navigation in SPAs; the Navigation API's `navigate` event is more comprehensive.

**DO NOT** forget to handle the initial page load. The `navigate` event does not fire on the initial load, so you may need a separate function to initialize your page's state and content.

## Fallback strategies

The Navigation API is designed to replace the older History API for client-side routing. While it aims for better browser consistency, direct polyfills for the entire API are complex. Instead, focus on graceful degradation:

### Core Navigation Logic

- **DO** implement a fallback mechanism that gracefully handles browsers not supporting the Navigation API. This might involve reverting to the History API for basic routing or providing a simpler, less dynamic experience.
- **DO** check for the existence of the `navigation` object (`if (window.navigation) { ... }`) to conditionally apply Navigation API logic.
- **DO** use feature detection for specific Navigation API features if you are selectively enabling parts of the API.

### State Management

- **DO** ensure that state management for older browsers is consistent with how you intend to use state with the Navigation API, even if it's less sophisticated.
- **DO** consider storing critical state in the URL parameters for broader compatibility if state needs to be shareable or bookmarkable across all browsers.

### User Experience on Navigation Interruption

- **DO** ensure that if a navigation is intercepted but then preempted by another, the user experience is not jarring. Abort signals are crucial here.
- **DO** provide visual feedback during navigation, such as loading indicators, especially in cases where `intercept` handlers might take time. The Navigation API's success and error events (`navigatesuccess`, `navigateerror`) can help manage these indicators.