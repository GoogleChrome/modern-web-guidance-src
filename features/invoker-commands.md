# invoker-commands

## Polyfill { #polyfill }

### Polyfilling Invoker Commands

MANDATORY: Feature detect support by checking for the `commandForElement` property on the `HTMLButtonElement` prototype. Do NOT check the window or document object. You MUST dynamically import the polyfill only when the native feature is missing. DO NOT unconditionally load the polyfill.

**Option 1: Using a package manager (e.g., npm)**
Install the polyfill in your project (`npm install invokers-polyfill`).

```javascript
// MANDATORY: Feature detect 'commandForElement' on HTMLButtonElement.prototype.
// Conditionally load the invokers-polyfill only in browsers lacking native support.
if (!('commandForElement' in HTMLButtonElement.prototype)) {
  import('invokers-polyfill');
}
```

**Option 2: Manual installation without npm**
If you are not using a package manager, dynamically import the polyfill directly from a CDN (such as unpkg) inside a `<script type="module">`.

```html
<script type="module">
  // Conditionally load the invokers-polyfill from a CDN only in browsers lacking native support.
  if (!('commandForElement' in HTMLButtonElement.prototype)) {
    import('https://unpkg.com/invokers-polyfill@latest/invoker.min.js');
  }
</script>
```

Unlike the native Invoker Commands API, `invokers-polyfill` does not automatically handle ARIA attributes (such as `aria-expanded`) on the command button. If accessibility is a requirement, you MUST manually manage ARIA states using JavaScript.
