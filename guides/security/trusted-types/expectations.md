# Expectations for Trusted Types

* The application includes a `<meta>` tag for Content Security Policy that enforces `require-trusted-types-for 'script'` and `trusted-types my-no-pretzel-policy`.
* The application defines a Trusted Types policy named `my-no-pretzel-policy` using `window.trustedTypes.createPolicy`.
* The application provides a "tinyfill" that mocks `window.trustedTypes.createPolicy` if the API is not natively supported by the browser.
* Clicking the `#btn-unsafe` button with HTML content in `#input-field` results in a `TypeError` message displayed within the `#error-log` element (due to Trusted Types enforcement).
* Clicking the `#btn-safe` button with HTML content in `#input-field` successfully renders the content into the `#output` element.
* The `#error-log` element is hidden (`display: none`) after a successful update using the `#btn-safe` button.
* The content rendered in `#output` after clicking `#btn-safe` has all instances of "pretzel" replaced with "popcorn".
