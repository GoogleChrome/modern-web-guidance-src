---
base_app: daily-grind
---
- hey, can u add a newsletter form to the footer? just an email input. style the errors using the new :user-invalid pseudo class. also we need to sync the aria-invalid attribute with the :user-invalid state using js (like checking on blur/input) so that a screen reader doesnt announce an error the second they tab into the empty required field.
- add a quick email signup form to the hero section with a visual error label. please make sure the form's error states are synchronized visually and programmatically. standard html validation reads as invalid too early for screen readers, so ensure the error is only announced after the user actually interacts with the field and the error text is visible.
- please add a "contact us" form (name, email) under the hero section. implement synchronized visual and programmatic error states. make sure to use aria-invalid and aria-errormessage for assistive tech, and bridge them with js so they stay in perfect sync with the visual error styles.
