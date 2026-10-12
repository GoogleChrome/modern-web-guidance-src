- The table uses semantic `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>` elements.
- When the table container is wider than 600px, column headers remain fixed at the top of the scrollable area during vertical scroll.
- When the table container is wider than 600px, the first column (row headers) remains fixed at the left of the scrollable area during horizontal scroll.
- When the table container width is reduced below 600px, the table layout transforms into a stacked view where rows are separated blocks.
- In the stacked view, the `thead` element is hidden and is not accessible to screen readers.
- In the stacked view, each data cell (`td`) displays a label corresponding to its column header using a pseudo-element.
- The labels injected via pseudo-elements provide an explicit accessible name using the `/` syntax in the `content` property to avoid trailing colons being announced.
- In the stacked view, row headers (`tbody th`) are sticky at the top of their respective row block during scroll.

