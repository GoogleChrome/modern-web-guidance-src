---
base_app: daily-grind
---
- add an operations queue simulator to the bottom of the container. it should let us schedule tasks by priority: add a 'user-blocking' button for checkout tasks, a 'user-visible' button for menu updates, a 'background' button for logging telemetry, and a 'batch' button that enqueues at least 6 mixed tasks at once. show an on-screen console to print when tasks start and finish, and make sure they run in priority order.
- can you build a task priority dashboard for the coffee shop? we want a visual widget where we can simulate ordering, brewing, and restocking tasks with high, medium, and low urgency, and run them in batches to see how the system handles priority scheduling.
- implement a real-time coffee prep dashboard on the main page. we need buttons to trigger 'user-blocking' urgent delivery orders, 'user-visible' standard table service, 'background' coffee bean roasting telemetry, and a 'batch' button that fires off several of these requests together. output the logs into a terminal-like window on the page so we can verify high-priority orders run first.
