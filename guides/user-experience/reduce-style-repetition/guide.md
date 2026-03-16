---
name: reduce-style-repetition
description: Reduce excessive style repetition by encapsulating complex or dynamic styling logic into reusable functions (such as a function that computes a fluid size value based on a set of input parameters).
web-feature-ids:
  - function
sources:
  - https://developer.chrome.com/en/blog/delaying-shipping-of-css-functions
  - https://developer.chrome.com/en/docs/devtools/css/reference
  - https://web.dev/en/learn/css/custom-properties
---

## Overview

The CSS `@function` at-rule allows developers to define custom, reusable functions directly within stylesheets. This reduces repetition for calculated styles (like fluid typography or grid calculations) by encapsulating logic into a single, maintainable place.

## Guidelines

### 1. Naming and Definition

-   **MANDATORY:** Custom functions MUST use the `<dashed-function>` naming convention (e.g., `@function --my-func`).
-   **DO** define arguments as custom properties inside the function definition.
-   **MANDATORY:** Use the `result:` descriptor within the function body to return the computed value.

### 2. Usage

-   **DO** invoke the function using the definition's name-dashed form (e.g., `font-size: --my-func(arg1, arg2)`).
-   **DO NOT** omit parameters or provide invalid types, as this will result in an invalid computed value.

### 3. Code Snippets

```css
/* Definition */
@function --fluid-size(--min, --max, --vw-min, --vw-max) {
  /* DO: Calculate fluid size with clamp/calc */
  result: clamp(
    var(--min),
    calc(var(--min) + (var(--max) - var(--min)) * ((100vw - var(--vw-min)) / (var(--vw-max) - var(--vw-min)))),
    var(--max)
  );
}

/* Usage */
.element {
  /* DO: Call custom fluid function */
  font-size: --fluid-size(16px, 24px, 320px, 1200px);
}
```

### 4. Fallback Strategies

> [!IMPORTANT]
> CSS Custom Functions (`@function`) are an experimental feature and are **NOT Baseline Widely Available**.

To maintain compatibility with browsers that do not support custom functions, always provide a standard value or calculation *before* invoking the custom function. The browser will ignore the subsequent declaration if it fails to parse the function call.

```css
.fallback-example {
  /* 1. Standard Static/Dynamic Fallback approach */
  font-size: 18px; 

  /* 2. Custom Function (overrides fallback if supported) */
  font-size: --fluid-size(16px, 24px, 320px, 1200px);
}
```

{{ BASELINE_STATUS("function") }}
