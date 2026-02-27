---
name: validate-input-after-interaction
description: Validation feedback for form inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. This consolidated guide covers sub-use-cases including password complexity validation and validating email after interaction.
web-feature-ids:
  - user-pseudos
---

# Validate Input After Interaction

## The Problem

Displaying validation errors the moment a user focuses on a field and starts typing is premature and distracting. For example, as a user types an email address (e.g., "user@gm") or a password with complex requirements, the field is technically invalid until completion. Standard `:invalid` styling results in an error state appearing immediately, frustrating the user.

## The Solution

The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.

### Implementation Strategy

1.  **HTML Constraint**: Use standard HTML5 attributes like `type="email"`, `pattern`, and `required` to trigger the browser's built-in validation logic.
2.  **Visual Feedback**: Use `:user-invalid` to apply error styling only after interaction.
3.  **Positive Reinforcement**: Optionally use `:user-valid` to give a green "success" indicator once the requirements are met.
4.  **Graceful Recovery**: As soon as the user corrects the input to a valid format, `:user-invalid` stops matching, removing the error state immediately.

## Implementation Guide

### Use Case 1: Email Validation

Rely on standard HTML5 attributes for email fields. The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.

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

### Use Case 2: Password Complexity

Define the complexity rule using a Regex Lookahead pattern in the `pattern` attribute. The rules list is shown to guide the user, and highlighted if there's an error.

```html
<form>
  <div class="field">
    <label for="password">New Password</label>
    <input 
      type="password" 
      id="password" 
      autocomplete="new-password"
      required
      /* 
         Regex Explanation:
         (?=.*\d)       : Must contain at least one digit
         (?=.*[a-z])    : Must contain at least one lowercase letter
         (?=.*[A-Z])    : Must contain at least one uppercase letter
         (?=.*[\W_])    : Must contain at least one special char
         .{8,}          : Must be at least 8 chars long
      */
      pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
      minlength="8"
      aria-describedby="password-rules"
    >
    <!-- Rules are always visible but neutrally styled initially -->
    <ul id="password-rules" class="rules-list">
      <li>At least 8 characters</li>
      <li>One uppercase letter</li>
      <li>One number</li>
      <li>One special character</li>
    </ul>
  </div>
</form>
```

```css
/* Default state: Neutral */
.rules-list { color: #5f6368; }

/* Invalid state (After interaction): Error */
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

/* Highlight rules list when error is shown */
input:user-invalid + .rules-list {
  color: #d93025;
}

/* Valid state: Success */
input:user-valid {
  border-color: #188038;
}
input:user-valid + .rules-list {
  display: none; /* Hide rules once satisfied, or style green */
}
```

## Fallbacking & Browser Support

The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but you should ensure consistency of the implementation when using it with the `pattern` attribute in older browsers.

### CSS for Fallback
Ensure your fallback class shares the native styles. Group your selectors to ensure consistent styling.

```css
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
  background-color: #fce8e6;
}

input:user-invalid + .error-msg,
input.user-invalid-fallback + .error-msg {
  display: block;
}

input:user-invalid + .rules-list,
input.user-invalid-fallback + .rules-list {
  color: #d93025;
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

1.  **Accessibility**: 
    *   Use `aria-describedby` to link the rules list to the input.
    *   Avoid hiding rules lists entirely until the input is valid; users need to know what to type!
2.  **Pattern Attribute Limits**: The `pattern` attribute performs a full match (implied `^...$`). Ensure your password regex accounts for the entire string.
3.  **Validation Strictness**: The browser's default `type="email"` validation is quite permissive (e.g., `user@localserver` might pass). If you need stricter validation, you may need to use a more robust validation library or a custom validation function alongside `type="email"`.
4.  **Focus Management**: If a user submits the form with an invalid field, the browser will automatically focus the first invalid field. Your `:user-invalid` styles will apply immediately because a submission attempt counts as an interaction.
5.  **Consistent ARIA Experience**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
