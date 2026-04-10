---
base_app: daily-grind
---

- Add a reactive 'pickup time' widget just below the hero section. It should display the current time and have a button to push the pickup back by 15 minutes. Use the temporal api for the date state (with a polyfill script just in case) to ensure it updates immutably and re-renders the ui reliably.
- Can you build an order readiness tracker inside the 'seasonal favorites' section? Make sure the underlying time state is handled immutably so we don't run into those weird bugs where the date mutates but the ui doesn't update.
- Implement a scheduling component for the dark roast espresso. Please don't use legacy date objects for the state, we need something that returns a new reference when modified so the reactivity doesn't break.
