---
description: Use Browserslist's new Baseline queries to target browsers supporting specific feature sets, ensuring compatibility and streamlining your development workflow.
filename: baseline-queries-in-browserslist
category: ui
---

# Browserslist Baseline Queries

This document outlines how to leverage the new Baseline queries in Browserslist to target browsers based on their support for specific feature sets, simplifying compatibility management in your web development workflow.

## Understanding Baseline Targets

Browserslist now natively supports three types of Baseline queries, allowing you to specify browser support in your toolchains:

-   **Baseline Widely available**: Targets browsers that have supported a feature for 30 months or more.
    -   Can be further refined with a specific date: `baseline widely available on 2024-06-06`.
-   **Baseline Newly available**: Targets browsers that have supported a feature for 30 months or less.
-   **Baseline years**: Targets features available in a specific year or earlier. For example, `baseline 2021` targets features available in 2021 and any preceding years. You can specify any year from `baseline 2015` up to the current year.

## Implementing Baseline Queries

These queries can be integrated into your existing Browserslist configuration files, such as `.browserslistrc`, `package.json`, or other locations where you configure Browserslist.

**Example `.browserslistrc` configuration:**

```
baseline widely available
last 2 versions
not IE 11
```

This configuration targets browsers that widely support features, includes the last two versions of other browsers, and excludes Internet Explorer 11.

**Example `package.json` configuration:**

```json
{
  "browserslist": [
    "baseline newly available",
    "> 0.5%"
  ]
}
```

This configuration targets browsers that newly support features and includes those with more than 0.5% usage.

## Choosing Your Baseline Target

When deciding which Baseline target to use, consider the following:

-   **`baseline widely available`**: Ideal for features that you want to ensure have broad, long-term support across the web.
-   **`baseline newly available`**: Useful for adopting newer features more quickly, understanding that support might be more limited initially.
-   **`baseline <year>`**: Provides precise control over feature adoption based on historical support timelines.

Refer to the official documentation on [How to choose your Baseline target](/articles/how-to-choose-your-baseline-target) for more in-depth guidance.

## Benefits of Using Baseline Queries

Integrating Baseline queries into your Browserslist configuration offers several advantages:

-   **Simplified Toolchain Configuration**: Eliminates the need for third-party packages like `browserslist-config-baseline`.
-   **Improved Developer Workflow**: Allows developers to more accurately target browser support, reducing compatibility issues.
-   **Future-Proofing**: The dynamic nature of queries like `baseline widely available` ensures your targets evolve as browsers add more feature support.

Experiment with these new queries to optimize your build toolchains and deliver a more consistent experience to your users.