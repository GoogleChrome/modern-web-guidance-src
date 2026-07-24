* The agent has defined CSS variables (custom properties) for the scrollbar colors.
* The agent has provided a `@media (prefers-contrast: more)` block that updates the CSS variables to highly distinct colors (e.g., solid black or white) to ensure maximum legibility.
* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property.
* If a legacy fallback block is provided, it correctly inherits the high-contrast CSS variables and is safely isolated within an `@supports not (scrollbar-color: auto)` feature query.
