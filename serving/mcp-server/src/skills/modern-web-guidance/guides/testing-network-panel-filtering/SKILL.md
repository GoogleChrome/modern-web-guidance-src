---
description: Efficiently debug web applications by filtering network requests in the DevTools Network panel using custom search queries.
filename: network-panel-filtering
category: testing
---

# Advanced Network Panel Filtering

This guide explains how to leverage advanced filtering capabilities within the Chrome DevTools Network panel to pinpoint specific network requests during web development and debugging.

## Key Filtering Features

The Network panel's filter bar supports custom search queries to narrow down resources. Here are some powerful examples:

*   **Size-based filtering:**
    *   `larger-than:100` - Finds resources larger than 100 bytes.
    *   `smaller-than:50k` - Finds resources smaller than 50 kilobytes.
*   **Response Code Filtering:**
    *   `status-code:200` - Filters for resources with a successful HTTP status code of 200.
    *   `status-code:404` - Filters for resources that returned a 404 Not Found error.
*   **Negating Queries:**
    *   Prepend a hyphen (`-`) to any query to exclude matching resources. For example, `-larger-than:50k` finds resources that are *not* larger than 50k.

## Other Useful Query Types

Experiment with these additional filters to refine your searches:

*   `domain`
*   `mime-type`
*   `scheme` (e.g., `scheme:https`)
*   `set-cookie-domain`
*   `set-cookie-value`
*   `has-response-header`

## Discoverability with Autocomplete

The DevTools provide autocomplete suggestions for filter types and their corresponding values. As you type, it will suggest available options based on your current network recording, making it easier to discover and use these powerful filtering capabilities. The autocompleted values are typically present in your current network log.

## Best Practices

*   **Understand your goal:** Before applying filters, have a clear idea of what you are trying to find. Are you looking for large assets, specific API calls, or resources that failed to load?
*   **Start broad, then narrow:** If you're unsure, begin with a more general filter and gradually add more specific criteria to narrow down the results.
*   **Utilize negation:** When you know what you *don't* want to see, use the negation operator (`-`) to exclude irrelevant requests.
*   **Combine filters:** Most filters can be combined to create very precise search queries.
*   **Leverage autocomplete:** Pay attention to the autocomplete suggestions to discover new filter types and valid values.
*   **Clear filters when done:** Once you've finished debugging a specific issue, remember to clear the filters to see all network activity again.