# scheduler

## Fallbacks { #fallbacks }

Some browsers may not support the `scheduler` API. You MUST implement a fallback or use a polyfill to ensure code executes without breaking and maintains task prioritization where possible.

## Fallback for `scheduler.yield()` { #fallback-yield }

Feature detect native support and fall back to a `setTimeout` macro-task yield for older browsers to prevent blocking the UI thread:

```javascript
async function processLargeArrayWithFallback(items) {
  // DO: Set a time-based deadline 50 milliseconds into the future.
  let deadline = performance.now() + 50;

  for (const item of items) {
    processItem(item);
    
    // MANDATORY: Yield to the main thread periodically to keep the UI responsive.
    if (performance.now() >= deadline) {
      // DO: Feature detect scheduler.yield
      if ('scheduler' in window && 'yield' in window.scheduler) {
        await scheduler.yield();
      } else {
        // DO: Fallback to setTimeout for older browsers
        await new Promise(resolve => setTimeout(resolve, 0));
      }
      deadline = performance.now() + 50;
    }
  }
}
```

## Fallback for `scheduler.postTask()` { #fallback-posttask }

Feature detect native support and conditionally load the `@googlechromelabs/scheduler-polyfill` library from a CDN for older browsers:

```javascript
// Feature detect the scheduler API
if (!('scheduler' in window && 'postTask' in window.scheduler)) {
  // DO: Conditionally load the polyfill for browsers that need it
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/scheduler-polyfill';
  script.onload = () => {
    // Polyfill is loaded and ready to use
    runScheduledTasks();
  };
  document.head.appendChild(script);
} else {
  runScheduledTasks();
}

function runScheduledTasks() {
  // Now safe to use scheduler.postTask in all browsers
  scheduler.postTask(() => {
    console.log('Task with priority support');
  }, { priority: 'background' });
}
```
