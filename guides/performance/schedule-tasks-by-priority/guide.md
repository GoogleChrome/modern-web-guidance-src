---
name: schedule-tasks-by-priority
description: Schedule tasks with different priorities to ensure critical work runs first while background work is deferred.
web-feature-ids:
  - scheduler
sources:
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduler
  - https://developer.mozilla.org/en-US/docs/Web/API/Prioritized_Task_Scheduling_API
  - https://github.com/WICG/scheduling-apis
  - https://developer.mozilla.org/en-US/docs/Web/API/Scheduling
  - https://www.w3.org/TR/task-scheduler/
  - https://github.com/GoogleChromeLabs/scheduler-polyfill
---

When building complex web applications, tasks have different levels of urgency. Completing tasks for the current view is more important than sending analytics or prefetching assets. The Prioritized Task Scheduling API allows you to schedule work with specific priorities, ensuring the browser remains responsive to user input.

### Scheduling tasks by priority

Use `scheduler.postTask()` to schedule tasks with one of three priorities:
- `user-blocking`: Tasks that block user interaction (e.g., input handling, critical rendering).
- `user-visible`: Tasks visible to the user but not blocking (default).
- `background`: Tasks that are not time-critical (e.g., analytics, prefetching).

```javascript
// Schedule a high-priority task that blocks user interaction
scheduler.postTask(() => {
  // DO: Handle critical updates that impact user interaction
  handleCriticalUpdate();
}, { priority: 'user-blocking' });

// Schedule a default priority task
scheduler.postTask(() => {
  // DO: Render non-critical content that is visible to the user
  renderSecondaryContent();
}); // Defaults to 'user-visible'

// Schedule a low-priority background task
scheduler.postTask(() => {
  // DO: Perform heavy background work that is not time-critical
  sendAnalytics();
}, { priority: 'background' });
```

{{ FEATURE_FALLBACKS("scheduler") }}

{{ INCLUDE("features/scheduler.md#fallback-posttask") }}
