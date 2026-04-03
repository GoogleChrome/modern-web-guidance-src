---
base_app: daily-grind
---
- add a newsletter signup popover triggered by a new button in the footer. set up a separate module that conditionally loads a popover polyfill using top-level await if the browser needs it, and import that file exactly once at the top of our app entry point.