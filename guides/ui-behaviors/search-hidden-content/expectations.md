# Expectations: `search-hidden-content`

- The `wholesale-tab` mutually exclusive regions MUST use the `<details>` element.
- The `wholesale-tab` mutually exclusive regions MUST share a `name` attribute to link their state.
- The `coupon-panel` MUST use the `hidden="until-found"` attribute, as its UI control is structurally separated from the hidden content and requires full styling control.
- The `coupon-panel` MUST NOT have `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties applied to it directly, as this breaks the searchability.
- The `coupon-panel` MUST NOT be used to hide sensitive information, internal data tokens, or "screen reader only" text.
- The state of the `coupon-panel` MUST be synchronized using a `beforematch` event listener so the related UI elements (like the trigger button) can be updated when the browser natively reveals the content.
- A fallback strategy MUST be used for unsupported browsers. The implementation MUST include an explicit JavaScript feature detection check for native support (e.g., `if (!('onbeforematch' in HTMLElement.prototype))`) and execute a fallback UI strategy for unsupported browsers.