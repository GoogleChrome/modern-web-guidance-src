- Untrusted HTML is sanitized and inserted into the target container using `Element.prototype.setHTML()` (or a sanitized fallback when unsupported) rather than raw `innerHTML`.
- The rendered output container does not contain any `<script>` elements when given input containing `<script>` tags.
- The rendered output container does not contain any inline `on*` event handler attributes (such as `onclick` or `onerror`) on any descendant elements.
- A custom `Sanitizer` configuration restricts allowed elements to basic formatting tags (such as `p`, `b`, `i`, `strong`, `em`) and strips disallowed elements such as `<img>`.
- The custom `Sanitizer` configuration uses `replaceWithChildrenElements` (e.g., `['div']`) so wrapper `<div>` tags are removed while preserving their inner text/child nodes in the rendered container.
- Allowed elements and attributes (such as `<p class="...">` and `<b>`) are preserved in the rendered output container.
- When `Element.prototype.setHTML` or `Sanitizer` is unavailable in the browser, the implementation conditionally loads and falls back to `DOMPurify.sanitize()` with matching allowed elements and attributes.

