---
name: stabilize-reactive-state
description: Manage task deadlines or schedules in data-driven views without unexpected side effects from shared mutable state.
web-feature-ids:
  - temporal
sources:
  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
  - https://tc39.es/proposal-temporal/docs/
  - https://www.w3schools.com/js/js_temporal.asp
---

# Stabilize Reactive State with Temporal

In modern web development, reactive systems (such as React, Vue, or Svelte) rely on reference equality to detect state changes. When an object's reference remains the same, the system assumes the state has not changed and skips re-rendering the UI.

The legacy `Date` object is mutable. Methods like `setHours()` or `setDate()` modify the instance in place. If a `Date` object is stored in reactive state and mutated, its reference does not change, leading to missed UI updates and hard-to-debug side effects.

The `Temporal` API solves this by providing immutable objects. Any operation that modifies a value (such as adding time or setting a field) returns a new instance with a new memory reference. This guarantees that state updates are always detected by reactive systems, ensuring UI stability.

## How to Implement

To stabilize reactive state using Temporal:

1. **Use Temporal types for state:** Store `Temporal` objects (like `Temporal.PlainDateTime` or `Temporal.PlainDate`) in your reactive state instead of legacy `Date` objects.
2. **Perform immutable updates:** When updating the state, use Temporal methods like `.add()`, `.subtract()`, or `.with()`. These methods return a new object.
3. **Pass the new reference to the state setter:** Use the newly created Temporal object to update your component state, triggering a reliable re-render.

## Example Code: Temporal vs Legacy Date in State

```javascript
// ❌ BAD: Mutating legacy Date breaks reactivity
let dateState = { deadline: new Date() };

function extendDeadlineBad() {
  // Mutates the object in place. Reference remains the same!
  dateState.deadline.setHours(dateState.deadline.getHours() + 1);
  
  // Frameworks will skip re-rendering because
  // prevState === nextState (same memory reference)
  updateState(dateState); 
}

// ✅ GOOD: Temporal ensures immutability and reliable reactivity
let temporalState = { deadline: Temporal.Now.plainDateTimeISO() };

function extendDeadlineGood() {
  // Returns a new object with a new reference.
  const newDeadline = temporalState.deadline.add({ hours: 1 });
  
  // Create a new state object with the new Temporal reference
  temporalState = { deadline: newDeadline };
  
  // Frameworks will detect the reference change and re-render the UI
  updateState(temporalState);
}
```

## Strategic Implementation & Best Practices

- **DO** use `Temporal` for any date/time values stored in reactive state to benefit from its immutability.
- **DO** use the most specific Temporal type for your use case (e.g., `Temporal.PlainDate` if you only need the calendar date) to avoid unnecessary complexity.
- **DO NOT** mutate `Date` objects in place when they are part of a component's state.
- **DO** ensure you handle environments without native support by conditionally loading a polyfill.

### Fallback strategies
{{ BASELINE_STATUS("temporal") }}

Since the `Temporal` API is a newer feature and may not be supported in all browsers, you should feature-detect it and conditionally load a polyfill if needed.

```html
<!-- Conditionally load the Temporal polyfill only if not natively supported -->
<script>
  if (!globalThis.Temporal) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@js-temporal/polyfill@0.4.4/dist/index.umd.js';
    document.head.appendChild(script);
  }
</script>
```

Alternatively, if you are using a module bundler, you can dynamically import the polyfill:

```javascript
async function ensureTemporal() {
  if (!globalThis.Temporal) {
    // @ts-ignore
    await import('@js-temporal/polyfill');
  }
}
```