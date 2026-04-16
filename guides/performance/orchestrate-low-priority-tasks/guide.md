---
name: orchestrate-low-priority-tasks
description: Orchestrate background low priority tasks (such as sending and processing analytics), allowing the browser to yield instantly to critical user input.
web-feature-ids:
  - scheduler
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduler
  - https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
  - https://github.com/WICG/scheduling-apis
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduling
  - https://www.w3.org/TR/task-scheduler/
---

When preloading data, fetching non-critical assets, or running heavy background analytics, you should ensure this work does not block urgent user interactions. The `scheduler.postTask()` API allows you to schedule work with specific priorities, ensuring that high-priority tasks (like responding to a click) execute before low-priority background work.

### Prioritizing background work

To schedule low-priority work, use `scheduler.postTask()` with the `priority: 'background'` option. This tells the browser to run the task only when there is no critical work pending.

```javascript
// A helper function to schedule background work
function scheduleBackgroundPreload(callback) {
  // DO: Check for support of the modern prioritized task scheduling API
  if ('scheduler' in window && 'postTask' in window.scheduler) {
    // MANDATORY: Use 'background' priority to avoid blocking user interactions
    return scheduler.postTask(callback, { priority: 'background' });
  }
  
  // DO: Fallback for browsers that don't support the API
  return fallbackScheduleTask(callback);
}

// Example usage
scheduleBackgroundPreload(() => {
  // Perform heavy preloading or non-critical fetching
  preloadAssets();
});

// Urgent tasks will automatically execute before the background task 
// if they are triggered before the background task starts.
document.getElementById('urgent-button').addEventListener('click', () => {
  if ('scheduler' in window && 'postTask' in window.scheduler) {
    scheduler.postTask(() => {
      updateUI();
    }); // Default priority is 'user-visible', which is higher than 'background'
  }
});
```

### Fallback strategies

{{ BASELINE_STATUS("scheduler") }}

You MUST implement a fallback to simulate background priority. While `requestIdleCallback` is often used for background tasks, it is also not yet a widely available Baseline feature. Therefore, a delayed `setTimeout` is the most reliable cross-browser fallback.

```javascript
// A helper function for scheduling background tasks with a fallback
function fallbackScheduleTask(callback) {
  return new Promise((resolve) => {
    // DO: Fallback for background tasks.
    // Using a short timeout (e.g., 200ms) helps defer execution until 
    // the main thread is less busy, giving priority to immediate user interactions.
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => resolve(callback()));
    } else {
      setTimeout(() => resolve(callback()), 200); 
    }
  });
}
```
