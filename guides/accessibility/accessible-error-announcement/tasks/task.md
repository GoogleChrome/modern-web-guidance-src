---
base_app: daily-grind
---
- Add a newsletter signup form with a required email input and an inline error message to the Daily Grind footer, and synchronize the screen reader error announcement with the visual post-interaction error state so assistive technologies only announce an error when the visual error message appears and clear it as soon as the email becomes valid.
- add a quick email signup form to the hero section with a visual error label. please make sure the form's error states are synchronized visually and programmatically. standard html validation reads as invalid too early for screen readers, so ensure the error is only announced after the user actually interacts with the field and the error text is visible.
- please add a "contact us" form (name, email) under the hero section. implement synchronized visual and programmatic error states. make sure to use aria-invalid and aria-describedby for assistive tech, and bridge them with js so they stay in perfect sync with the visual error styles.
