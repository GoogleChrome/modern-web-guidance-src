---
base_app: daily-grind
---
- add an open `<dialog>` promoting the 'maple oat latte' inside the hero section. then add a button that reparents this dialog element into the footer. make sure the dialog stays visibly open and doesn't abruptly close when its dom node is moved.
- create a native popover for the 'order now' button. write a script that reparents the open popover to the main container after a few seconds without it resetting its open state or closing.
- fix the bug where our modals close when they get moved to a new parent in the dom. update the logic so they stay open seamlessly, and handle older browsers.
