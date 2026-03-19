### Email Validation
- On page load, the email input MUST have a neutral border (not red), even though it is required and empty.
- Typing "incomplete@" and clicking away (blur) MUST trigger the error state (red border, visible error message).
- Typing "valid@email.com" MUST remove the error state immediately (on input) or after blur.
- Submitting the form with an empty email field MUST trigger the error state.

### Password Complexity
- On page load, the password field MUST appear neutral (no red border).
- The password requirements list MUST be visible and neutral (or informational).
- Clicking into the empty password field and clicking away (blur) without typing MUST NOT trigger the `:user-invalid` state.
- Typing a partial password (e.g., "Pass") and clicking away (blur) MUST trigger the `:user-invalid` state (red border).
- The requirements list text MUST change color (e.g., to red) to indicate the error context.
- Typing a valid password (e.g., "Password123!") MUST remove the error state immediately (on input) or after blur, depending on the browser's exact implementation of `:user-valid`.

### Fallback
- If "Force Fallback Mode" is active, the behavior across both elements MUST be identical using the `.user-invalid-fallback` class.
