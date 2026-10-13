---
base_app: daily-grind
---
- Add an analytics script to the homepage that reliably determines whether the page was initially loaded in a background tab—even if the script loads asynchronously after the user foregrounds the page—and records the exact timestamp (in milliseconds) of when it was first backgrounded. Log an object to the console containing the initial background status (boolean under `initiallyBackgrounded`) and background timestamp (number under `timeBackgrounded`), and render a summary on the page.

