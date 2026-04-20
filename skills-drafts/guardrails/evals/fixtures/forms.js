// Fixture: JS for forms with known accessibility issues for eval testing.
// Covers use case: accessible-error-announcement

// ============================================================
// USE CASE: accessible-error-announcement
// VIOLATION: Only syncs aria-invalid on 'input' event.
// Best practice says to sync on BOTH 'blur' (capture phase) and 'input',
// using el.matches(':user-invalid') to check the visual state.
// Missing: blur/focus event listeners to properly bridge
// the visual :user-invalid state with the programmatic aria-invalid attribute.
// ============================================================

document.addEventListener('input', (event) => {
  const input = event.target;
  if (!input.matches?.('input, textarea, select')) return;

  // VIOLATION: Only updates on input — does not handle blur/focus events.
  // The modern-web best practice requires listening on blur (capture phase)
  // and focus (capture phase) as well, so that aria-invalid is set at the
  // exact same moment the :user-invalid visual state appears.
  if (input.matches(':user-invalid')) {
    input.setAttribute('aria-invalid', 'true');
  }
  // VIOLATION: Never removes aria-invalid when the input becomes valid again.
  // Should call input.removeAttribute('aria-invalid') when !isUserInvalid.
});
