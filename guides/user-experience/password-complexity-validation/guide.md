---
name: password-complexity-validation
description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
web-feature-ids:
  - user-pseudos
---

# Password Complexity Validation

## The Problem

Password fields often come with complex requirements (e.g., "8+ chars, 1 uppercase, 1 symbol"). Displaying validation errors the moment a user focuses on the field and starts typing is premature and distracting, as the user has not yet completed their input.

## The Solution

Use `:user-invalid` combined with the HTML `pattern` attribute on `<input type="password">` fields. This allows the browser to validate the complex regex logic but hides the error styling until the user has *finished* attempting to enter a password (on blur) or if they try to submit the form.

### Implementation Strategy

1.  **HTML Constraint**: Use the `pattern` attribute with a RegExp that enforces your complexity rules.
2.  **Visual Feedback**: Use `:user-invalid` to style the input red and reveal a helper message only when appropriate.
3.  **Positive Reinforcement**: Optionally use `:user-valid` to give a green "success" indicator once the requirements are met.

## Implementation Guide

### 1. HTML Structure
Define the complexity rule using a Regex Lookahead pattern.

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

### 2. CSS
Style the input and the rules list based on the validation state.

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
Ensure your fallback class shares the native styles.

```css
input:user-invalid,
input.user-invalid-fallback {
  border-color: #d93025;
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
    *   Avoid hiding the rules list entirely until the password is valid; users need to know what to type!
2.  **Pattern Attribute Limits**: The `pattern` attribute performs a full match (implied `^...$`). Ensure your regex accounts for the entire string.
3.  **Consistent ARIA Experience**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
