---
description: Improve CSS nesting predictability and maintainability by leveraging the CSSNestedDeclarations interface.
filename: css-nesting-improvements
category: ui
---

# Improve CSS Nesting Predictability

The introduction of the `CSSNestedDeclarations` interface in the CSS Nesting Specification significantly enhances the behavior of CSS nesting by resolving issues with declaration hoisting and improving the accuracy of the CSS Object Model (CSSOM) representation. This update ensures that declarations maintain their intended order and are not inadvertently mixed with nested rules, leading to more predictable and maintainable stylesheets.

## Key Improvements with `CSSNestedDeclarations`

Prior to `CSSNestedDeclarations`, declarations appearing after nested rules (like `@media` or `@starting-style`) would often be "hoisted" to the beginning of the style rule's declaration list. This could lead to unexpected visual results and made it difficult to inspect the true cascade order of styles. The `CSSNestedDeclarations` interface resolves this by:

*   **Preserving Declaration Order:** Declarations are no longer hoisted and are correctly placed within the CSSOM, reflecting their order in the source CSS.
*   **Accurate CSSOM Representation:** The CSSOM now accurately represents the structure of nested rules and declarations, making introspection and debugging more reliable.
*   **Predictable Cascade:** Styles are applied as written, eliminating surprises caused by automatic reordering.

## Best Practices for CSS Nesting

With the introduction of `CSSNestedDeclarations`, it's important to structure your nested CSS to ensure compatibility and predictable behavior across browsers.

### General Nesting

*   **Declare before nesting:** When interleaving declarations with nested rules (e.g., `@media`, `@container`, `@starting-style`), ensure that all regular CSS declarations appear *before* any nested rules. This was a workaround for older browsers but is now the standard and recommended practice for clarity.

    **Incorrect (Pre-`CSSNestedDeclarations` workaround, problematic in new browsers):**

    ```css
    .foo {
      @media screen {
        background-color: red;
      }
      background-color: green; /* This declaration would be hoisted */
    }
    ```

    **Correct (Works in all supported browsers):**

    ```css
    .foo {
      background-color: green; /* Declaration is correctly placed */
      @media screen {
        background-color: red;
      }
    }
    ```

*   **Use `@nest` for explicit nesting of rules:** While direct nesting of declarations is now well-supported, for clarity when nesting entire style rules, consider using the `@nest` rule, especially if you encounter complex scenarios.

### Using `@starting-style`

The introduction of `CSSNestedDeclarations` particularly impacts the interaction between `@starting-style` and other declarations.

*   **Place `@starting-style` after regular declarations:** To ensure entry animations work as expected, the `@starting-style` block should always follow the main declarations of a style rule.

    **Incorrect (Causes entry animation to be skipped):**

    ```css
    #mypopover:popover-open {
      @starting-style {
        opacity: 0;
        scale: 0.5;
      }
      opacity: 1;
      scale: 1;
    }
    ```

    **Correct (Ensures entry animation functions):**

    ```css
    #mypopover:popover-open {
      opacity: 1;
      scale: 1;
      @starting-style {
        opacity: 0;
        scale: 0.5;
      }
    }
    ```

## Feature Detection

You can feature detect the availability of `CSSNestedDeclarations` using JavaScript:

```js
if (!("CSSNestedDeclarations" in self && "style" in CSSNestedDeclarations.prototype)) {
  // CSSNestedDeclarations is not available in this browser
  console.warn("CSSNestedDeclarations API is not supported.");
}
```

By adopting these practices, developers can confidently leverage the improved CSS nesting capabilities, leading to more robust and maintainable web applications.