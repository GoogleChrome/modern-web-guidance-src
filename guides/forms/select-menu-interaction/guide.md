---
name: select-menu-interaction
description: Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control.
web-feature-ids:
  - user-pseudos
---

# Select Menu Interaction

## The Problem
For mandatory dropdowns (e.g., "Choose a Country"), standard validation flags the field as invalid immediately if the default option has an empty value. This can create visual noise. We want to show the error only if the user opens the menu and closes it without choosing an option, or attempts to submit the form.

## The Solution
The `:user-invalid` pseudo-class works seamlessly with `<select>` elements. It respects the user's interaction flow: simply loading the page or focusing/blurring without making a change doesn't count as an interaction, so the field stays neutral until they actively attempt a selection.

### Implementation Strategy

1.  **HTML Constraint**: Use a `<select>` with `required`. The first option should have `value=""` and ideally be disabled/hidden to force a valid choice.
2.  **Visual Feedback**: Use `:user-invalid` to style the select box border.
3.  **Timing**: The browser considers the field "interacted" if the user changes the value (even back to the default invalid state) before they blur the control, or upon form submission.

## Implementation Guide

### 1. HTML Structure
The "placeholder" option is key here.

```html
<form>
  <div class="field">
    <label for="country">Country</label>
    <select
      id="country"
      name="country"
      required
      aria-errormessage="country-error"
    >
      <option value="" disabled selected>Select a country...</option>
      <option value="us">United States</option>
      <option value="ca">Canada</option>
      <option value="uk">United Kingdom</option>
    </select>
    <div id="country-error" class="error-msg">
      Please select a country.
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
  Only show error after the user visits the select menu.
*/
select:user-invalid {
  border-color: #d93025;
  background-color: #fce8e6;
}

select:user-invalid + .error-msg {
  display: block;
}

select:user-valid {
  border-color: #188038;
}
```

## Fallbacking & Browser Support

The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but if you need to support older browsers, you must ensure consistency of the implementation.

{{ FEATURE_FALLBACKS("user-pseudos") }}

## Other Considerations

1.  **Mobile behavior**: On mobile devices, "blur" might happen differently depending on the OS picker. Testing on actual devices is recommended.
2.  **Accessibility**: {{ FEATURE("user-pseudos", "aria-invalid") }}
