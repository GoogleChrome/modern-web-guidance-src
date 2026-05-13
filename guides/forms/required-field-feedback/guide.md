---
name: required-field-feedback
description: Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow.
web-feature-ids:
  - user-pseudos
---

# Required Field Feedback

## The Problem
Marking required fields with an error state immediately upon page load can be confusing. Ideally, a required field should only look "invalid" if the user has attempted to fill it out and failed.

## The Solution
The `:user-invalid` pseudo-class solves this perfectly. For a required field, it will not match on page load. It will only match if:
1.  The user interacts with the field (e.g., types a character and deletes it) and then leaves it (blur), leaving it empty.
2.  The user attempts to submit the form while the field is empty.

### Implementation Strategy

1.  **HTML Constraint**: Add the `required` attribute to your inputs.
2.  **Visual Feedback**: Use `:user-invalid` to style the border red and show a "Required" helper text.
3.  **Timing**: Rely on the browser's native timing for visual feedback. You don't need `onBlur` handlers to add a `touched` class anymore, though some JavaScript is still needed to sync ARIA attributes (see below).

## Implementation Guide

### 1. HTML Structure
```html
<form id="feedback-form">
  <div class="field">
    <label for="full-name">Full Name</label>
    <input
      type="text"
      id="full-name"
      name="full-name"
      required
      aria-errormessage="name-error"
    >
    <!-- MANDATORY: Include an icon or distinct non-color indicator alongside error text -->
    <div id="name-error" class="error-msg">
      <span aria-hidden="true">❌</span> This field is required.
    </div>
  </div>
</form>
```

### 2. CSS
```css
.error-msg {
  display: none;
  color: #d93025;
  font-size: 0.875rem;
  margin-top: 0.25rem;
}

/*
  Only highlight empty required fields AFTER the user visits them.
  MANDATORY: Provide multiple indicators (border shift + helper text/icon) to avoid color-only state communication.
*/
input:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

input:user-invalid + .error-msg {
  display: block;
}

/* Optional: Subtle indicator for required fields that are valid */
input:required:user-valid {
  border-color: #188038;
  border-width: 2px;
}
```

### 3. JavaScript State Synchronization

MANDATORY: Because `:user-invalid` is a visual state, you MUST provide a JavaScript bridge to sync `aria-invalid="true"` dynamically for assistive technologies when a user blurs an invalid field or attempts submission.

```javascript
const form = document.getElementById('feedback-form');

const syncAriaInvalid = (input) => {
  if (!input.checkValidity()) {
    input.setAttribute('aria-invalid', 'true');
  } else {
    input.removeAttribute('aria-invalid');
  }
};

// Sync on blur when a user finishes interacting
form.addEventListener('blur', (e) => {
  if (e.target.matches('input[required]')) {
    syncAriaInvalid(e.target);
  }
}, true);

// Sync all required fields when submission is attempted
form.addEventListener('submit', () => {
  form.querySelectorAll('input[required]').forEach(syncAriaInvalid);
});

// Remove error state immediately upon correction
form.addEventListener('input', (e) => {
  if (e.target.matches('input[required]') && e.target.checkValidity()) {
    e.target.removeAttribute('aria-invalid');
  }
});
```

## Fallbacking & Browser Support

{{ FEATURE_FALLBACKS("user-pseudos") }}

## Other Considerations

1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
3.  **Accessibility**: {{ FEATURE("user-pseudos", "aria-invalid") }}
