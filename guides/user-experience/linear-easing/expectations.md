- The agent has defined an animation or transition that uses the `linear(...)` easing function inline.
- The agent MUST NOT abstract the `linear(...)` function into a CSS variable (e.g. `--easing: linear(...)` is not allowed).
- The `linear(...)` function contains at least three comma-separated progress points.
- The agent has provided a fallback easing function (e.g., `ease`, `ease-in-out`, `cubic-bezier()`) as a completely separate, full property declaration (e.g., `transition: transform 0.3s ease;`) immediately before the declaration containing the `linear(...)` function.

## Grader Implementation Notes
- For the CSS variable rule, only fail if `linear(` is assigned to a custom property. Do not fail if standard unrelated variables like `var(--primary)` are used for other properties.
- For the fallback rule, when checking the raw CSS, remember that `linear(` might not be the first token after the colon, especially in shorthand properties like `transition: transform 0.5s linear(...)`.
