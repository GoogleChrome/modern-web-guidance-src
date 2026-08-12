---
name: trusted-types
description: Help prevent DOM-based XSS attacks by ensuring all untrusted content is sanitized before being inserted into the page.
web-feature-ids:
  - trusted-types
---

Trusted Types is a security feature that helps prevent DOM-based Cross-Site Scripting (DOM XSS) by requiring that data being passed into "dangerous" browser APIs (known as sinks) is first converted into a specific type, such as `TrustedHTML`.

By default, many DOM APIs (like `innerHTML` or `document.write`) accept raw strings. If a string contains malicious script from an untrusted source, it can be executed. Trusted Types changes this behavior: once enabled via CSP, these sinks will only accept `TrustedHTML` objects created by authorized policies.

## Key Implementation Details

To use Trusted Types, follow four main steps:

1. Define a security policy that specifies how to sanitize or transform strings.
2. Use that policy to create Trusted Type objects from raw strings.
3. Use the Trusted Type objects when writing to DOM sinks.
4. Enforce Trusted Types using a Content Security Policy (CSP).

### 1. Creating a Policy

A policy is a set of rules for sanitizing content. You create it using `trustedTypes.createPolicy()`.

```javascript
const myPolicy = trustedTypes.createPolicy('my-no-pretzel-policy', {
  createHTML: (input) => {
    // A simple replacement rule.
    // In a real app, you might use the Sanitizer API, or a library like DOMPurify.
    return input
      .replace(/pretzel/g, "popcorn");
  }
});
```

### 2. Using the Policy

Instead of passing a string directly to a sink, you call the policy's creation method.

```javascript
const untrustedInput = 'I love eating a soft pretzel.';

// In an enforced environment, this would throw a TypeError:
// element.innerHTML = untrustedInput;

// This returns a TrustedHTML object:
const cleanHTML = myPolicy.createHTML(untrustedInput);
// Result: "I love eating a soft popcorn."
```

### 3. Transitioning sinks to use Trusted Types

Update each instance where you write to a sink to first convert it to a Trusted Type object. To help locate where code needs to be updated, you can define a temporary `default` policy that logs when a sink is written to with a string rather than a TrustedType.

```javascript
trustedTypes.createPolicy("default", {
  createHTML(value) {
    console.warn("String passed instead of Trusted Type.");
    return sanitize(value);
  },
});
```

Common sinks that support Trusted Types include:
- **HTML:** `element.innerHTML`, `element.outerHTML`, `document.write()`, `element.setHTMLUnsafe()`, `document.parseHTMLUnsafe()`
- **Script:** `<script src>`, `eval()`
- **ScriptURL:** `Worker()`, `SharedWorker()`

```javascript
// Assign the TrustedHTML object.
element.innerHTML = cleanHTML;
```

Note that the "safe" HTML sanitization methods (`element.setHTML()` and `document.parseHTML()`, for instance), do not support Trusted Types, as they always sanitize potential XSS attacks.

### 4. Enforcing Trusted Types with CSP

Trusted Types should be rolled out incrementally to avoid breaking your application. While full enforcement provides the strongest protection, it carries a risk of site breakage if every sink write hasn't been migrated.

#### Prerequisites

- **Framework cooperation**: If your application's framework (or any third-party library that writes to DOM sinks) does not produce `TrustedHTML` or `TrustedScript` values, you cannot enforce Trusted Types without breaking that code. Audit framework support before starting the rollout.
- **Sink refactoring**: Ensure you have identified and refactored dangerous sinks to use your Trusted Types policies.

#### Rollout Strategy

1.  **Report-Only**: First, roll out using the `Content-Security-Policy-Report-Only` header. This will log violations to your reporting endpoint without actually blocking the writes.
    ```http
    Content-Security-Policy-Report-Only: require-trusted-types-for 'script';
    ```
2.  **Enforcement**: Once you have integrated your policies and violation reports drop to zero, move to full enforcement.

    ```http
    Content-Security-Policy: require-trusted-types-for 'script';
    ```

You can also restrict which policies are allowed to be created:

```http
Content-Security-Policy: trusted-types my-no-pretzel-policy;
```

With this CSP in place, any writes to a sink that don't use Trusted Types will throw an error. In addition, attempting to create a Trusted Type with a name that isn't `my-no-pretzel-policy` will throw an error.

You can also set this CSP as a `<meta>` tag in your document's `<head>`, although this is potentially less secure.

```html
<!-- First child of `<head>`, as earlier tags will not enforce this CSP. -->
<meta
  http-equiv="Content-Security-Policy"
  content="require-trusted-types-for 'script'; trusted-types my-no-pretzel-policy;"
/>
```

## Fallback strategies

{{ BASELINE_STATUS("trusted-types") }}

For browsers that do not yet support Trusted Types, you can use a minimal "tinyfill" to ensure your code doesn't break while still providing sanitization.

```javascript
if (!window.trustedTypes) {
  window.trustedTypes = {
    createPolicy: (name, rules) => rules,
  };
}
```

This allows you to write your code using the Trusted Types pattern today. Supporting browsers will enforce the types, while older browsers will still execute your sanitization logic via the mock policy.

If a browser doesn't support Trusted Types, it will simply treat the `TrustedHTML` objects as strings (if using the tinyfill) or won't have the enforcement check at the sink level.
