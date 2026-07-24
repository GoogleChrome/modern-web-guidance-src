1. The tour step popover must not close when the user clicks on the element it is highlighting.
2. The popover must remain in the Top Layer, ensuring it is never obscured by other elements.
3. The tour step must correctly follow the anchor element if the window is resized.
4. The popover must only close when the user clicks the explicit "Next" or "Close" button.
5. The tour step popover MUST set `role="dialog"` and define `aria-labelledby` matching its main heading ID for accessible naming.
6. The implementation MUST programmatically route keyboard focus inside the tour step popover immediately upon opening.
