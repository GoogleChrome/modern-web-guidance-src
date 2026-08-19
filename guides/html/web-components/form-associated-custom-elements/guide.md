---
name: form-associated-custom-elements
description: Make a custom control participate natively in forms with formAssociated and ElementInternals, submitting its own value, integrating with constraint validation, and reacting to reset, disable, and state-restore.
web-feature-ids:
  - form-associated-custom-elements
---

# Form-Associated Custom Elements

Do not fall back to a hidden `<input>` to surface a custom control's value to a form. Use **Form-Associated Custom Elements** (FACE): with `formAssociated` and `ElementInternals`, the element submits its own value, participates in validation, and reflects form state natively.

```javascript
class RatingInput extends HTMLElement {
  // MANDATORY: opt in. Without this, attachInternals() form APIs are unavailable.
  static formAssociated = true;

  #internals;
  #value = '';

  constructor() {
    super();
    this.#internals = this.attachInternals();
    this.attachShadow({ mode: 'open' });
  }

  get value() { return this.#value; }
  set value(v) {
    this.#value = v;
    // Push the value into the owning <form> for submission.
    this.#internals.setFormValue(v);
    this.#validate();
  }

  #validate() {
    if (this.hasAttribute('required') && !this.#value) {
      // Mark invalid and supply the native validation message + anchor.
      this.#internals.setValidity(
        { valueMissing: true },
        'Please choose a rating.',
        this.shadowRoot.querySelector('[tabindex]'),
      );
    } else {
      this.#internals.setValidity({}); // clear
    }
  }

  // Optional FACE lifecycle hooks:
  formResetCallback() { this.value = ''; }
  formDisabledCallback(disabled) { this.toggleAttribute('disabled', disabled); }
  formStateRestoreCallback(state) { this.value = state; }
}
customElements.define('rating-input', RatingInput);
```

Key points:

- `static formAssociated = true` is **MANDATORY**; it unlocks the form-related `ElementInternals` methods and the `formXxxCallback` lifecycle.
- `setFormValue(value)` is what submits, with no hidden input required. Pass a `FormData` for multi-value controls.
- `setValidity(flags, message, anchor)` integrates with native constraint validation: the form won't submit while invalid, `:invalid`/`:valid` apply, and the anchor element receives focus on report. Call `setValidity({})` to clear. The interaction-aware `:user-valid`/`:user-invalid` pseudo-classes are *not* consistently wired up for form-associated elements across browsers — verify support before relying on them rather than assuming they track user interaction the way they do for native controls.
- Implement `formResetCallback`, `formDisabledCallback`, and `formStateRestoreCallback` so the element behaves like a native control on reset, `fieldset[disabled]`, and back/forward autofill restore.
- Follow platform conventions for dispatched events and prefer the built-in `input` and `change` events over custom ones. `input` fires when the value changes as a direct result of user action (typing, dragging a slider); `change` fires once per stream of changes, when the user commits (releasing the slider, blurring the field). Construct them with `InputEvent` and `Event` respectively.

## Fallback strategies

{{ BASELINE_STATUS("form-associated-custom-elements") }}

Feature-detect with `static formAssociated` support before relying on it: `'attachInternals' in HTMLElement.prototype && 'setFormValue' in ElementInternals.prototype`. Where it is unavailable, fall back to a visually-hidden native `<input>` synced to the control's value so the form still submits — the one case where the hidden-input pattern is justified.
