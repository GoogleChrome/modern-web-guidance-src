---
base_app: devtools-times
---
- add the correct HTML autocomplete attributes to the sign-in form in `src/components/SignInForm.tsx` so that browsers can autofill it properly. Make sure the username field is treated as an email field but configured to autofill a "username", and the password field is identified as the "current-password" in both its autofill and ID attributes.
- update `src/components/SignInForm.tsx` to use the correct HTML input attributes for browser autofill.
- make sure the form in `src/components/SignInForm.tsx` collects email and password and supports browser auto-filling.
