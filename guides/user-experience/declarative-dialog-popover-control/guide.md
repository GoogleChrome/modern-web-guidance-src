---
name: declarative-dialog-popover-control
description: Toggle the visibility of a dialog or popover from a button without writing JavaScript.
web-feature-ids:
  - invoker-commands
  - popover
  - dialog
sources: 
  - https://developer.chrome.com/blog/command-and-commandfor
  - https://developer.mozilla.org/en-US/docs/Web/API/Invoker_Commands_API
  - https://open-ui.org/components/invokers.explainer/
  - https://html.spec.whatwg.org/multipage/form-elements.html#attr-button-command
  - https://css-tricks.com/invoker-commands-additional-ways-to-work-with-dialog-popover-and-more/
---

# Overview

Use the Invoker Commands API to toggle the visibility of `<dialog>` and `[popover]` elements directly from HTML buttons, eliminating the need for custom JavaScript event listeners.

By applying the `commandfor` (target ID) and `command` (action) attributes to a `<button>`, the browser automatically handles open/close state changes, focus management, and accessibility bindings (such as `aria-expanded`). This declarative approach is recommended because it removes brittle boilerplate code, ensures interactions are functional immediately upon HTML parsing, and guarantees a robust, natively accessible user experience.

## Implementing Declarative Popovers

Popovers can be toggled open and closed using a single button.

```html
<!-- MANDATORY: The commandfor attribute links the invoker to the ID of the target element so the browser knows what to control. -->
<!-- MANDATORY: The command attribute specifies the action to perform. Use 'toggle-popover' to handle both open and close states automatically. -->
<button commandfor="my-popover" command="toggle-popover">
  Toggle Popover
</button>

<!-- MANDATORY: The target element must have the popover attribute to be controlled as a popover. -->
<div id="my-popover" popover>
  <p>Popover content goes here.</p>
</div>
```

If you need to control opening and closing with separate buttons, you can use the `show-popover` and `hide-popover` commands.

```html
<!-- MANDATORY: Use 'show-popover' to explicitly open the popover. It will not close the popover if clicked again. -->
<button commandfor="my-explicit-popover" command="show-popover">
  Show Popover
</button>

<div id="my-explicit-popover" popover>
  <p>This popover is explicitly opened and closed by separate buttons.</p>
  
  <!-- MANDATORY: Use 'hide-popover' to explicitly close the targeted popover. -->
  <button commandfor="my-explicit-popover" command="hide-popover">
    Hide Popover
  </button>
</div>
```

## Implementing Declarative Modal Dialogs

Unlike popovers, modal dialogs typically use separate buttons for opening and closing. Use the `show-modal` command specifically when you need to open a dialog as a modal.

```html
<!-- MANDATORY: Use command="show-modal" to trigger the dialog as a modal, trapping focus and preventing interaction with the rest of the page. -->
<!-- MANDATORY: The commandfor attribute connects this button to the dialog ID. -->
<button commandfor="confirm-dialog" command="show-modal">
  Open Confirmation
</button>

<dialog id="confirm-dialog">
  <p>Are you sure you want to proceed?</p>
  
  <!-- MANDATORY: Use command="close" to dismiss the dialog safely. -->
  <button commandfor="confirm-dialog" command="close">
    Cancel
  </button>
</dialog>
```

## Fallback strategies

{{ BASELINE_STATUS("invoker-commands") }}
{{ BASELINE_STATUS("popover") }}

Because Invoker Commands and Popovers are not yet universally supported, you MUST use polyfills as fallbacks for older browsers.

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
  // MANDATORY: Feature detect 'commandForElement' on HTMLButtonElement.prototype.
  // Conditionally load the invokers-polyfill from a CDN only in browsers lacking native support.
  if (!('commandForElement' in HTMLButtonElement.prototype)) {
    import('https://unpkg.com/invokers-polyfill@latest/invoker.min.js');
  }
</script>
```

**Invokers Polyfill Limitations**
Unlike the native Invoker Commands API, `invokers-polyfill` does not automatically handle ARIA attributes (such as `aria-expanded`) on the command button. 

MANDATORY: You MUST manually manage these ARIA states to ensure your site remains fully accessible to screen readers in browsers relying on the polyfill.

### Polyfilling the Popover Attribute

To support the `popover` attribute in older browsers, use the `@oddbird/popover-polyfill`.

MANDATORY: Feature detect popover support by checking for the `popover` property on the `HTMLElement` prototype. Conditionally initialize the polyfill only if native support is missing.

**Option 1: Using a package manager**
Install the package (`npm install @oddbird/popover-polyfill`).

```javascript
// MANDATORY: Feature detect 'popover' on HTMLElement.prototype.
if (!('popover' in HTMLElement.prototype)) {
  import('@oddbird/popover-polyfill/fn').then(({ apply }) => {
    apply();
  });
}
```

**Option 2: Manual installation without npm**
If you are not using a package manager, dynamically import the polyfill directly from a CDN (such as unpkg) inside a `<script type="module">`.

```html
<script type="module">
  // MANDATORY: Feature detect 'popover' on HTMLElement.prototype.
  // Conditionally load the popover-polyfill from a CDN only in browsers lacking native support.
  if (!('popover' in HTMLElement.prototype)) {
    import('https://unpkg.com/@oddbird/popover-polyfill@latest/dist/popover-fn.js').then(({ apply }) => {
      apply();
    });
  }
</script>
```

**Popover Polyfill Limitations & Styling Caveats**
MANDATORY: When styling the open state of a popover, you must provide a separate CSS declaration for the polyfill's CSS class (`.\:popover-open`).

```css
/* DO NOT combine these into a single comma-separated list.
   If a browser does not understand the native :popover-open pseudo-class,
   it will throw away the entire rule, breaking the polyfill styling. */

[popover]:popover-open {
  /* Native styling */
  display: block;
}

[popover].\:popover-open {
  /* Polyfill styling */
  display: block;
}
```
