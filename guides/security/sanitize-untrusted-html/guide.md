---
name: sanitize-untrusted-html
description: Safely parse and display untrusted HTML content from user input by removing unsafe elements and attributes.
web-feature-ids:
  - sanitizer
---

# Sanitizing Untrusted HTML

Safely displaying user-generated HTML is a common security challenge. The native **Sanitizer API** provides a built-in, browser-optimized way to strip dangerous content (like `<script>` tags or `on*` attributes) before it reaches the DOM.

MANDATORY: Do not rely solely on client-side sanitization for user-generated content. Always sanitize content on the server. Make sure that the server and client sanitization rules do not conflict.

## 1. Safely Inserting HTML with `setHTML()`

The primary way to use the Sanitizer API is through the `setHTML()` method on any `Element`. This method handles parsing, sanitization and insertion in a single step, ensuring that content is sanitized specifically for the context in which it will be inserted.

```javascript
const untrustedHTML = `
  <p>Hello!</p>
  <script>alert('XSS')</script>
  <img src="x" onerror="alert('XSS')">
  <div onclick="doBadThing()">Click me</div>
`;

const container = document.getElementById('output');

// Sanitize and insert in one call
// Default behavior strips scripts and event handlers
container.setHTML(untrustedHTML);
```

## 2. Using Custom Sanitizer Configurations

You can customize the sanitization rules by creating a `Sanitizer` instance. This allows you to define exactly which elements and attributes are permitted for your specific use case. 

When using `Element.setHTML()` and `Document.parseHTML()`, the default `Sanitizer` settings remove all XSS-unsafe elements and attributes. You can not make a more permissive `Sanitizer` that allows those elements, but you can further restrict what is allowed.


```javascript
// Define a restrictive configuration that only allows the specified elements and attributes.
const config = {
  elements: ["p", "b", "i", "strong", "em"],
  attributes: ["class"],
  replaceWithChildrenElements: ['div']
};

const mySanitizer = new Sanitizer(config);

// Apply custom sanitization
container.setHTML(untrustedHTML, { sanitizer: mySanitizer });
```

If you need a more permissive `Sanitizer` that allows some XSS-unsafe elements or attributes, you can use a custom Sanitizer with `Element.setHTMLUnsafe()` and `Document.parseHTMLUnsafe()`.

## 3. Parsing User Input with `Document.parseHTML()`

If you need to parse untrusted HTML without immediately inserting it into the live DOM, use `Document.parseHTML()`. This method returns a `Document` that has been sanitized according to default or custom rules. 

This can be used for sanitizing user content before sending it to a server.

```javascript
const rawHTML = '<p>Hello <script>console.log("bad")</script></p>';

const doc = Document.parseHTML(rawHTML);
// doc.body now contains the sanitized nodes: <p>Hello </p>
console.log(doc.body.innerHTML);
```

## Fallbacks & browser support for Sanitizer API

{{ FEATURE_FALLBACKS("sanitizer") }}

If the native Sanitizer API is not available in your target browsers, you MUST conditionally load a library like **DOMPurify** only when native support is missing, and apply a matching configuration.

```javascript
let domPurifyPromise;

function loadDOMPurify() {
  if (!domPurifyPromise) {
    // Conditionally import DOMPurify (via bundler code-splitting or ESM CDN) only when needed
    domPurifyPromise = import('https://unpkg.com/dompurify@3/dist/purify.es.mjs')
      .then((mod) => mod.default ?? mod);
  }
  return domPurifyPromise;
}

export async function safeSetHTML(el, html) {
  if (Object.hasOwn(Element.prototype, 'setHTML') && 'Sanitizer' in window) {
    const config = {
      elements: ['p', 'b', 'i', 'strong', 'em'],
      attributes: ['class'],
      replaceWithChildrenElements: ['div']
    };

    const mySanitizer = new Sanitizer(config);
    el.setHTML(html, { sanitizer: mySanitizer });
  } else {
    // Load DOMPurify only in browsers that do not support Element.setHTML() and Sanitizer
    const DOMPurify = await loadDOMPurify();
    el.innerHTML = DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'b', 'i', 'strong', 'em'],
      ALLOWED_ATTR: ['class']
    });
  }
}
```
