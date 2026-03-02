# Expectations for Successful content-visibility Implementation

### 1. Strategic Placement
*   **Target Off-Screen Content:** Apply `content-visibility: auto` primarily to elements that are "below the fold" or outside the initial viewport.
*   **Avoid LCP Elements:** Do not apply it to elements in the initial viewport, especially the Largest Contentful Paint (LCP) element, as this can delay initial rendering and hurt performance metrics.
*   **Identify "DOM Islands":** Target major, self-contained blocks of content (e.g., blog posts in a list, complex cards, or long articles) rather than small, individual elements with minimal rendering costs.

### 2. Dimensional Stability (Avoiding Layout Shift)
*   **Mandatory Intrinsic Sizing:** Always pair `content-visibility: auto` with `contain-intrinsic-size` to provide a placeholder height/width.
*   **Use the `auto` Keyword:** Prefer the syntax `contain-intrinsic-size: auto <length>` (e.g., `auto 600px`). This allows the browser to remember the actual rendered size of the element once it has been seen, preventing "jumpy" scrollbars when the user scrolls back up.
*   **Accurate Estimates:** Ensure the placeholder size is a reasonable estimate of the actual content to minimize Cumulative Layout Shift (CLS) when the real content renders.

### 3. Accessibility & DOM Integrity
*   **Explicit Hiding:** Remember that `content-visibility: auto` keeps off-screen content in the Accessibility Tree. If a subtree contains elements that should be hidden from screen readers (like a closed menu that uses `display: none` inside the block), you must explicitly use `aria-hidden="true"`.
*   **Find-in-Page Support:** Expect that content hidden via `auto` remains searchable via "Find in Page" and accessible via Tab navigation, whereas content hidden via `hidden` does not.

### 4. API Discipline & Interaction
*   **Avoid Forced Synchronous Layout:** Do not call JavaScript APIs that force layout (e.g., `offsetTop`, `getBoundingClientRect()`, `getComputedStyle()`) on elements inside a skipped subtree. Doing so will force the browser to perform the very rendering work you are trying to avoid.
*   **Monitor Console Warnings:** Enable "Verbose" logging in Chromium-based browsers to check for warnings about APIs that triggered rendering on a `content-visibility` subtree.
*   **Utilize Events:** Use the `contentvisibilityautostatechange` event if your application needs to start or stop side-heavy processes (like `<canvas>` animations or data polling) when the element enters or leaves the "skipped" state.

### 5. Efficient State Management
*   **Use `hidden` for Inactive Views:** For Single Page Applications (SPAs) or tabbed interfaces, use `content-visibility: hidden` for inactive views. This preserves the rendering state (unlike `display: none`), allowing for near-instant "unhiding" without the cost of a full re-render.
*   **Transition with Care:** When animating visibility, use `transition-behavior: allow-discrete` to ensure entry/exit animations (like fades) work correctly with the property's discrete nature.

### 6. Performance Verification
*   **Metric Improvement:** Expect to see a significant reduction in **CPU Paint/Layout time** and **Main Thread work**, which should lead to improved **Interaction to Next Paint (INP)** scores.
*   **Browser Testing:** Verify behavior across modern engines (Chromium, Firefox, Safari) to ensure no quirks in layout containment or scrollbar behavior occur on your specific implementation.
