---
name: complex-computations-and-loops
description: Break up heavy synchronous processing or DOM updates, to let the browser handle user input and repaint the screen.
web-feature-ids:
  - scheduler
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduler
  - https://github.com/WICG/scheduling-apis
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduling
  - https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
  - https://www.w3.org/TR/task-scheduler/
  - https://web.dev/articles/optimize-long-tasks
---

Long-running JavaScript tasks block the main thread, preventing the browser from rendering updates or responding to user input (like clicks or scrolling). By intentionally breaking up these heavy synchronous processes and yielding control back to the main thread, you ensure your application remains responsive.

The modern approach is to use `scheduler.yield()`, which returns control to the browser and seamlessly resumes execution. Unlike older workarounds (like `setTimeout`), it maintains the task's priority and avoids being pushed to the back of the queue.

### Breaking up complex computations

To break up a large loop or computation, use `await scheduler.yield()` periodically within an `async` function.

```javascript
async function processLargeArray(items) {
  // DO: Process items in chunks to avoid blocking the main thread
  for (let i = 0; i < items.length; i++) {
    // Process the item
    processItem(items[i]);
    
    // MANDATORY: Yield to the main thread periodically to keep the UI responsive.
    // The chunk size (e.g., 50) should be tuned based on how long each item takes to process.
    // Aim for chunks that complete within 50ms.
    if (i > 0 && i % 50 === 0) {
      await scheduler.yield();
    }
  }
}
```

### Prioritized scheduling

If you have discrete tasks rather than a loop, you can schedule them using `scheduler.postTask()` and assign priorities like `'user-blocking'` (highest), `'user-visible'` (default), or `'background'` (lowest).

```javascript
// Schedule critical work that must happen immediately
scheduler.postTask(() => updateCriticalUI(), { priority: 'user-blocking' });

// Schedule analytics or background sync
scheduler.postTask(() => sendAnalyticsData(), { priority: 'background' });
```

### Fallback strategies

{{ BASELINE_STATUS("scheduler") }}

Older browsers may not support the `scheduler` API. You MUST implement a fallback using `setTimeout` (or `requestIdleCallback`) to ensure code executes without breaking.

#### Fallback for `scheduler.yield()`

```javascript
// A helper function that yields control using the modern API or falls back to setTimeout
async function yieldToMain() {
  if ('scheduler' in window && 'yield' in window.scheduler) {
    // DO: Use the native scheduler if available
    await scheduler.yield();
  } else {
    // DO: Fallback to setTimeout for older browsers
    await new Promise(resolve => setTimeout(resolve, 0));
  }
}

async function processData(items) {
  for (let i = 0; i < items.length; i++) {
    processItem(items[i]);
    
    if (i > 0 && i % 50 === 0) {
      await yieldToMain();
    }
  }
}
```

#### Fallback for `scheduler.postTask()`

```javascript
// A helper function for prioritized scheduling with a fallback
function scheduleTask(callback, options = { priority: 'user-visible' }) {
  if ('scheduler' in window && 'postTask' in window.scheduler) {
    // DO: Use the native prioritized scheduler if available
    return scheduler.postTask(callback, options);
  }
  
  return new Promise((resolve) => {
    // DO: Simulate priority using universal browser APIs
    if (options.priority === 'user-blocking') {
      // MessageChannel is a faster macrotask than setTimeout, yielding to the 
      // event loop but executing before standard timeouts.
      const channel = new MessageChannel();
      channel.port1.onmessage = () => resolve(callback());
      channel.port2.postMessage(null);
    } else if (options.priority === 'background') {
      // Fallback for background tasks (since requestIdleCallback lacks Safari support).
      // Using a short timeout helps defer execution until the main thread is less busy.
      setTimeout(() => resolve(callback()), 200); 
    } else {
      // Default user-visible priority
      setTimeout(() => resolve(callback()), 0);
    }
  });
}
```
