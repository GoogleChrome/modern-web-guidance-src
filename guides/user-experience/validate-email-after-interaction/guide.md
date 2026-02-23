---
name: validate-email-after-interaction
description: Validation feedback for email inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing.
web-feature-ids:
  - user-pseudos
---

# Validate Email After Interaction

## The Problem
As a user types an email address (e.g., "user@gm"), the field is technically invalid until completion. Using standard `:invalid` styling results in an error state appearing immediately upon focus or keystroke, which can distract the user.

## The Solution
The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.

### Implementation Strategy

1.  **HTML Constraint**: Use `<input type="email">` and `required` to trigger the browser's built-in email validation logic.
2.  **Visual Feedback**: Use `:user-invalid` to style the input only after interaction.
3.  **Graceful Recovery**: As soon as the user corrects the email to a valid format, `:user-invalid` stops matching, removing the error state immediately.

## Implementation Guide

### 1. HTML Structure
Relies on standard HTML5 attributes.

```html
<form>
  <div class="field">
    <label for="email">Email Address</label>
    <input 
      type="email" 
      id="email" 
      name="email" 
      required
      autocomplete="email"
      placeholder="you@example.com"
      aria-errormessage="email-error"
    >
    <div id="email-error" class="error-msg">
      Please enter a valid email address (e.g. name@domain.com).
    </div>
  </div>
</form>
```

### 2. CSS
The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.

```css
.error-msg {
  display: none;
  color: #d93025;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/* 
  Only show error styles after user interaction.
  This prevents the "angry red border" on page load.
*/
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

input:user-invalid + .error-msg {
  display: block;
}

/* Optional: Green success state */
input:user-valid {
  border-color: #188038;
}
```

## Fallbacking & Browser Support

For browsers that do not support `:user-invalid`, you must replicate the "dirty" state tracking using JavaScript.

### CSS for Fallback
Group your selectors to ensure consistent styling.

```css
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
}

input:user-invalid + .error-msg,
input.user-invalid-fallback + .error-msg {
  display: block;
}
```

### JavaScript Fallback
If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.

```javascript
const UserInvalidFallback = (() => {
  const dirtyState = new WeakMap();

  const updateState = (input) => {
    const isValid = input.checkValidity();

    // Update both visual and ARIA state
    input.classList.toggle('user-invalid-fallback', !isValid);
    input.classList.toggle('user-valid-fallback', isValid);

    if (!isValid) {
      input.setAttribute('aria-invalid', 'true');
    } else {
      input.removeAttribute('aria-invalid');
    }
  };

  const handleEvent = (event) => {
    const input = event.target;

    if (event.type === 'reset') {
      const controls = input.elements || [];
      for (const control of controls) {
        dirtyState.delete(control);
        control.classList.remove('user-invalid-fallback');
        control.classList.remove('user-valid-fallback');
        control.removeAttribute('aria-invalid');
      }
      return;
    }

    if (!input.checkValidity) return;

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

  const init = (root = document) => {
    if (CSS.supports('selector(:user-invalid)')) return;

    root.addEventListener('blur', handleEvent, true); // Capture phase
    root.addEventListener('input', handleEvent);
    root.addEventListener('change', handleEvent);
    root.addEventListener('reset', handleEvent, true); // Capture resets
  };

  return { init };
})();

// Initialize for a specific form
const form = document.querySelector('#demo-form');
UserInvalidFallback.init(form);
```

## Other Considerations

1.  **Validation Strictness**: The browser's default `type="email"` validation is quite permissive (e.g., `user@localserver` might pass). If you need stricter validation, you may need to use a more robust validation library or a custom validation function alongside `type="email"` (while remembering to validate on the server).
2.  **Focus Management**: If a user submits the form with an invalid email, the browser will automatically focus the first invalid field. Your `:user-invalid` styles will apply immediately because a submission attempt counts as an interaction.
3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
