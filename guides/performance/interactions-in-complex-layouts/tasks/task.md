---
base_app: daily-grind
---
- let's build a barista order-tracking kanban board in our page for managing drink orders. can you add columns with class 'board-column' for 'queued', 'brewing', and 'ready'? each column should hold order cards with class 'card' (like 'Maple Oat Latte', 'Dark Roast Espresso', and 'Cold Brew'). baristas need to drag and drop these cards between columns, and it needs to be highly optimized so dragging cards or updating columns is extremely smooth and doesn't trigger global layout reflows or lag the browser, especially with large amounts of orders.
- add an interactive task management board for our coffee shop staff to coordinate shift chores. create a three-column layout using class 'board-column' for 'todo', 'in-progress', and 'done', filled with 'card' elements. implement drag-and-drop and ensure columns are completely isolated from style or layout recalculations of adjacent columns to maximize rendering performance.
