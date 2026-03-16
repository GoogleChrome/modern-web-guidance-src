# Expectations for `reduce-style-repetition`

To verify that the guide has been implemented correctly, the following assertions MUST be true:

-   [ ] A custom function is defined using the `@function` at-rule.
-   [ ] The custom function name starts with a double dash (e.g., `@function --custom-name`).
-   [ ] The custom function body contains a `result:` descriptor that assigns the computed value.
-   [ ] The custom function accepts parameters defined as custom properties (e.g., `--min`, `--max`).
-   [ ] The custom function is called in at least one CSS property declaration using the `<dashed-function>` syntax with arguments (e.g., `font-size: --custom-name(...)`).
-   [ ] A fallback style/declaration exists immediately before or alongside the custom function call to support browsers without `@function` capability.
