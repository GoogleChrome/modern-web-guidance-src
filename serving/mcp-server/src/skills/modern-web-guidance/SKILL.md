---
name: modern-web-guidance
description: Provides guidance on modern web development best practices. You MUST ALWAYS use this skill when working on web development tasks.
---

# Modern Web Guidance

This skill is the primary entrypoint for all web development tasks. It provides guidance on modern web development best practices and is used to discover and retrieve best practices for specific use cases.

Supported web development use cases include:

ID | Description
-- | --
ai-image-to-text | Turn images into text, captions, or structured data using the built-in Prompt API
ui-carousel | Build responsive, accessible carousels with CSS Scroll Snap
ui-color-systems | Create dynamic, accessible color systems using modern color syntax and relative colors
ui-scroll-driven-animations | Create animations linked to scroll position
ui-tooltip | Create tooltips with Popover API and Interest Invokers
webperf-adaptive-loading | Load a fallback image when network conditions are poor using the Adaptive Loading API
webperf-break-long-tasks | Improve interaction responsiveness (INP) by yielding to the main thread.
webperf-lazy-load-images | Defer loading of off-screen images to minimize network contention and improve LCP.
webperf-preload-prerender | Improve navigation speed by preloading key resources or prerendering pages before the user clicks. 

You can access the SKILL.md file for a given use case by opening the skills/<ID>/SKILL.md file adjacent to this file. Each file contains a list of best practices for that use case, which is critically important to follow when building modern web applications.

MANDATORY: Identify which of the supported use cases are relevant to the current task, fetch their SKILL.md files, and follow the instructions in each file to implement the best practices. Do this for ALL relevant use cases.