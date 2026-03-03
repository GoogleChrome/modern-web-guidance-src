---
name: deprioritize-background-fetches
description: Deprioritize background data fetches made with the Fetch API to prevent network contention with user-initiated requests.
web-feature-ids:
    - fetch-priority
    - fetch
sources:
  - https://web.dev/articles/fetch-priority
---

# Deprioritize background fetches

When a page performs multiple simultaneous network requests, they often compete for the same bandwidth. Non-critical data such as analytics, logging, or background synchronization should be deprioritized so that user-initiated or critical data fetches can complete more quickly.

## How to implement

1. **Identify background requests**: Determine which `fetch()` calls are for non-essential data that doesn't impact the immediate user experience.
2. **Apply fetch priority**: Add the `priority: 'low'` option to the `fetch()` initialization object.
3. **Handle simultaneous requests**: Ensure that background tasks triggered by the same event as critical tasks (e.g., a click that both submits a form and logs an event) do not hinder the critical path.

## Example code

```javascript
// Use high priority (default for data) for critical UI updates
const criticalData = await fetch('/api/user-profile');

// Explicitly deprioritize background analytics
fetch('/api/analytics', {
  method: 'POST',
  body: JSON.stringify(eventData),
  // Lower the priority to prevent network contention
  priority: 'low'
});
```

## Best practices

- **DO** use `priority: 'low'` for analytics, beacons, or telemetry data that isn't required for the current view.
- **DO** use `priority: 'low'` for "pre-fetching" data that the user *might* need later, ensuring it doesn't slow down what they need *now*.
- **DO NOT** use the deprecated `importance` key in the fetch options object. The correct key is `priority`.

## Fallback strategy

### Fetch API

The Fetch API is Baseline Widely Available. No fallback is required.

### Fetch Priority

The Fetch Priority API is not Baseline.

The `priority` option in the Fetch API is a progressive enhancement. Browsers that do not support it will ignore the option and treat the request with default priority. No explicit feature detection or fallback logic is required for basic usage.
