# Expectations: `search-hidden-content`

- Any content intended to be visually hidden but remain searchable via the browser's native "Find in page" feature MUST use `<details>` or the `hidden="until-found"` attribute.
- Elements utilizing the `hidden="until-found"` attribute MUST NOT have `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties applied to them directly.
- The `hidden="until-found"` attribute MUST NOT be used to hide sensitive information, internal data tokens, or "screen reader only" text.
- If the hidden content has related UI state (e.g., updating ARIA attributes, toggling open/close classes, or managing accordion icons), that state MUST be synchronized using a beforematch event listener.
- If the users Baseline target is older than Baseline 2025, a fallback strategy MUST be used. The implementation MUST include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers.
