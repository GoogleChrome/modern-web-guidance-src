# Expectations: `defer-rendering-heavy-content`

- Any content that does not need to be rendered immediately on page load and is outside the initial viewport should use `content-visibility: auto`.
- If applying `content-visibility: auto` to an element, `contain-intrinsic-size` MUST be applied to the same element.

- Any content that does not need to be rendered immediately on page load and visibility can be toggled should use `content-visibility: hidden`.
- If applying `content-visibility: hidden` to an element and the users Baseline target is older than Baseline 2025, a fallback strategy must be used. The implementation should include a CSS feature detection check for native support (e.g., `@supports (content-visibility: hidden) { ... }`) and execute a fallback UI strategy for unsupported browsers.

- Any content that does not need to be rendered immediately on page load and visibility can be toggled and is searchable should use `hidden="until-found"`.
- If applying `hidden="until-found"` to an element, the element should not have any `display` or `visibility` CSS properties applied to it directly.
- If applying `hidden="until-found"` to an element and the element has related UI state (e.g., updating ARIA attributes, toggling open/close classes, or managing accordion icons), that state should be synchronized using a beforematch event listener.
- If applying `hidden="until-found"` to an element and the users Baseline target is older than Baseline 2025, a fallback strategy must be used. The implementation must include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers.