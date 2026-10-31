---
name: accessible-error-announcement
description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
web-feature-ids:
  - user-pseudos
# NOTE: Unlike most guides (which replace legacy JS with a modern declarative feature),
# this guide exists solely to teach a JS bridge syncing CSS `:user-invalid` to `aria-invalid`
# due to cross-browser HTML-AAM gaps (Firefox/Safari exposing `required` as invalid on initial load;
# Chromium crbug.com/564679025 keeping empty `required` text fields valid in AXTree even after interaction).
# Under active a11y SME review in #1890 (see also #1638, #1780, #1836).
---

# Accessible Error Announcement

## The Problem
Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 

If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.

## The Solution
We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check that this selector matches during standard interaction events.

Set `aria-invalid="false"` until `:user-invalid` matches, rather than leaving the attribute unset. Firefox and Safari expose an empty `required` field as invalid from page load, so an unset attribute still causes the premature "invalid entry" announcement there.

### Implementation Strategy

1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
2.  **Accessibility Layer**: Use `aria-invalid`, and list the error message in `aria-describedby` while the field is invalid, to communicate state to Assistive Technology (AT). Announce an error that appears when the user leaves a field through one polite live region for the page.
3.  **Bridge Visual & Accessibility Layer**: Create a lightweight JavaScript utility that listens for `blur`, `change`, `input` and `invalid` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
4.  **Focus on Submit**: Screen readers announce a field's error when focus reaches the field, so after a failed submit, move focus to the first invalid field, or to an error summary (a heading followed by a link to each invalid field) on a long form. Native validation moves focus to the first invalid field for you; if the form uses `novalidate`, move it in your submit handler.

## Implementation Guide

### 1. HTML Structure
Link your input to its error message by setting the input's `data-error` attribute to the error message's `id`. The script in section 3 lists that `id` in `aria-describedby` only while the field is invalid. Don't reference the error from `aria-describedby` in the markup: the error element is always in the page, and text that `aria-describedby` references is announced even when it's hidden, so the error would be read out before the user has interacted.

```html
<form>
  <div class="field">
    <label for="email">Email</label>
    <input 
      type="email" 
      id="email" 
      required 
      data-error="email-error"
    >
    <span id="email-error" class="error-msg">
      Please enter a valid email address.
    </span>
  </div>
</form>
```

### 2. CSS
Control the visibility of the error message using the native pseudo-class `:user-invalid`.

```css
.error-msg {
  display: none;
  color: #d93025;
}

/* Show error message when input is user-invalid */
input:user-invalid ~ .error-msg {
  display: block;
}

/* Optional: Visual cues on the input itself */
input:user-invalid {
  border-color: #d93025;
}
```

### 3. JavaScript
Since there is no "UserInvalidChanged" event, hook into standard form events to check the state.

{{ FEATURE("user-pseudos", "aria-invalid") }}

## Fallbacking & Browser Support

{{ BASELINE_STATUS("user-pseudos") }}

### Feature Detection
You can check for support in CSS and JavaScript.

**JavaScript Check:**
```javascript
if (!CSS.supports('selector(:user-invalid)')) {
  // Fallback logic here
}
```

### CSS for Fallback
To ensure your fallback logic is visually indistinguishable from the native behavior, you must apply your error styles to both the pseudo-class and your fallback class.

```css
/* Apply error styles to both native selector and fallback class, on every field that
   can be invalid. :is() keeps the rule working where :user-invalid isn't supported: in
   a plain selector list, one unsupported selector drops the whole rule. */
:is(:user-invalid, .user-invalid-fallback) {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* Show error message for both cases */
:is(:user-invalid, .user-invalid-fallback) ~ .error-msg {
  display: block;
}
```

### Fallback Logic
If `:user-invalid` is missing manually track the interaction state using a `WeakMap`.

```javascript
const UserInvalidFallback = (() => {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    // validity.valid gives the current state without firing an 'invalid' event, as checkValidity() does.
    const isValid = input.validity.valid;

    // Update both visual and ARIA state
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);

    input.setAttribute('aria-invalid', isValid ? 'false' : 'true');
    linkError(input, !isValid);
  };

  // List the error message (the id in data-error) in aria-describedby only while it's
  // shown: text that aria-describedby references is announced even when it's hidden.
  const linkError = (input, shown) => {
    const errorId = input.dataset.error;
    if (!errorId) return;
    const ids = (input.getAttribute('aria-describedby') || '').split(/\s+/).filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
    else input.removeAttribute('aria-describedby');
  };

  const handleEvent = (event) => {
    const input = event.target;

    if (event.type === 'reset' && input.matches?.('form')) {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback');
        control.classList.remove('user-valid-fallback');
        if (control.matches('input, select, textarea')) control.setAttribute('aria-invalid', 'false');
        if (control.dataset?.error) linkError(control, false);
      }
      return;
    }

    if (!input.matches?.('input, textarea, select')) return;

    // A submit attempt counts as interaction: the browser fires 'invalid' on each failing
    // field, including required fields the user never touched, so flag them all.
    if (event.type === 'invalid') {
      dirtyState.set(input, { hasInteracted: true, hasBlurred: true });
      updateState(input);
      return;
    }

    if (event.type === 'input' || event.type === 'change') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(input, state);
      if (state.hasBlurred) {
        updateState(input);
      }
    } else if (event.type === 'blur') {
      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
      state.hasBlurred = true;
      dirtyState.set(input, state);
      if (state.hasInteracted) {
        updateState(input);
      }
    }
  };

  const init = () => {
    if (CSS.supports('selector(:user-invalid)')) return;

    // Firefox and Safari expose an empty required field as invalid from page load.
    document.querySelectorAll('input, select, textarea').forEach((el) => {
      if (!el.hasAttribute('aria-invalid')) el.setAttribute('aria-invalid', 'false');
    });

    document.addEventListener('blur', handleEvent, true); // Capture phase required
    document.addEventListener('input', handleEvent, true);
    document.addEventListener('change', handleEvent, true);
    document.addEventListener('invalid', handleEvent, true); // invalid doesn't bubble
    document.addEventListener('reset', handleEvent, true); // Capture resets
  };

  return { init };
})();

// Initialize globally
UserInvalidFallback.init();
```

## Other Considerations

1.  **Announcing errors**: 
    *   The error message is in the field's `aria-describedby` while the field is invalid, so screen readers read it when focus reaches the field.
    *   To announce the error as soon as it appears (e.g., on blur), the script in section 3 writes the field's label and error into one polite live region for the page, a moment later so it doesn't talk over the next field. Don't make each error message a live region: a live region that is shown, rather than changed, isn't announced reliably, and a failed submit would fire all of them at once. Test thoroughly to avoid "double announcement" when the user focuses the field to fix it.

2.  **Internationalization**:
    *   Ensure the text content of your error message (`#email-error`) is translated. The logic remains the same.
