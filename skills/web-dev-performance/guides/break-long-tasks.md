---
description: Improve interaction responsiveness (INP) by yielding to the main thread.
web-feature-ids:
  - scheduler
---

# Break Up Long Tasks for Better INP

Long tasks block the main thread, preventing the browser from responding to user interactions (clicks, taps, key presses). This hurts **Interaction to Next Paint (INP)**.

## What is a Long Task?
Any task that runs for more than **50ms** is considered a long task. The browser cannot render or respond to input while a task is running.

## Strategy: Yield to the Main Thread
To fix this, you need to break up long JavaScript work into smaller chunks and yield control back to the browser.

### Modern Approach: `scheduler.yield()`
The `scheduler.yield()` API is the modern way to yield execution.

```javascript
async function doHeavyWork() {
  for (const item of hugeList) {
    process(item);
    
    // Yield to the main thread periodically
    await scheduler.yield();
  }
}
```

### Legacy Fallback: `setTimeout`
For older browsers, use `setTimeout` with a delay of 0.

```javascript
function yieldToMain() {
  return new Promise(resolve => {
    setTimeout(resolve, 0);
  });
}

async function doHeavyWork() {
  for (const item of hugeList) {
    process(item);
    await yieldToMain();
  }
}
```

## When to Yield?
- After processing a chunk of data.
- In critical input handlers if they do expensive logic.
- Between major phases of application initialization.

## Fallback strategies

If the user's Baseline target (or Widely available, if unavailable) does not support any of the required features, the following fallback strategies MUST be used.

### Scheduler API

Baseline status: Limited availability

- **DO** use `'scheduler' in window && 'yield' in scheduler` for feature detection.
- **DO** fall back to `setTimeout(resolve, 0)` if `scheduler.yield` is not available.
- **DO NOT** use `requestAnimationFrame` for yielding to the main thread for general background work, as it runs before paint and can delay rendering if overused for non-visual tasks.
