# PR Reviews Archive

## PR #511: create guide and evals for improve body text layout and legibility guide

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> I think once these changes are applied, I can give a quick approval on this. Good work on this, @dvdherron!

#### **rviscomi** (APPROVED)
> LGTM modulo @malchata's comments

### Comments

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> This instance of `MANDATORY:` is followed by a description of the behavior, rather than an imperative thing.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
+2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.
+
+## Example: Optimizing Body Copy
+
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
>   /* MANDATORY: Enable pretty line-breaking logic */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
+2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.
+
+## Example: Optimizing Body Copy
+
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
>    /* MANDATORY: Enable pretty line-breaking logic */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
+2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.
+
+## Example: Optimizing Body Copy
+
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
+  text-wrap: pretty; /* Prioritizes typographic beauty for body copy */
+}
+
+/* Also effective for other multi-line text elements */
+blockquote, li, .pretty-text {
+   /* MANDATORY: Enables pretty line-breaking logic */
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> I wonder if it would be more helpful for agents to break this into a list of elements.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
> 1.  **Identify long-form text elements**: Select elements potentially containing long runs of text where orphaned words (runts) or poor line breaks are most noticeable. This includes the following elements:
>   - `<p>`
>   - `<blockquote>`
>   - `<li>`
>   - Any other element potentially containing long runs of text.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> Being a big of a performance nerd, I hadn't considered this, but wonder if it's really that much more noticeably expensive. Either way, I think we can rephrase the bit after `MANDATORY:` though, because it's not clear what is actually mandatory until we get to the next sentence which reads "Avoid applying it globally..."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
+2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.
+
+## Example: Optimizing Body Copy
+
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
+  text-wrap: pretty; /* Prioritizes typographic beauty for body copy */
+}
+
+/* Also effective for other multi-line text elements */
+blockquote, li, .pretty-text {
+   /* MANDATORY: Enables pretty line-breaking logic */
+  text-wrap: pretty;
+}
+```
+
+## Key constraints
+
+*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because it evaluates multiple lines (typically the last four) to optimize the break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
```

</details>

#### **malchata** on `guides/user-experience/improve-body-text-layout-and-legibility/guide.md`
> ```suggestion
> *   **Performance vs. Quality**: MANDATORY: DO NOT apply `text-wrap: pretty` globally to every element on the page, because it evaluates multiple lines (typically the last four) to optimize the break points, which can affect page rendering performance.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,55 @@ description: Improve the layout and legibility of long text content by enabling
 web-feature-ids:
   - text-wrap
   - text-wrap-pretty
----
\ No newline at end of file
+sources:
+  - https://developer.chrome.com/blog/css-text-wrap-pretty/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-wrap
+  - https://12daysofweb.dev/2024/css-text-wrap/
+  - https://web.dev/learn/css/typography
+  - https://webkit.org/blog/16547/better-typography-with-text-wrap-pretty/
+  - https://johnkavanagh.co.uk/articles/the-power-of-text-wrap-pretty/
+---
+
+# Improve Body Text Layout and Legibility
+
+The `text-wrap: pretty` CSS property allows you to improve the typographic quality of body text by enabling a more sophisticated wrapping algorithm. It is specifically designed to prevent "orphans" (single words on the last line of a paragraph) and create a more pleasing visual "rag" for long blocks of text.
+
+## Implementation steps
+
+1.  **Identify long-form text elements**: Select paragraphs (`p`), blockquotes, list items, or other long text blocks where orphaned words (runts) or poor line breaks are most noticeable.
+2.  **Apply pretty wrapping**: Use `text-wrap: pretty` to enable an optimized algorithm that evaluates the last few lines of a paragraph to find the best break points.
+
+## Example: Optimizing Body Copy
+
+```css
+/* Apply to paragraphs to prevent orphaned words */
+p {
+  /* MANDATORY: Enables pretty line-breaking logic */
+  text-wrap: pretty; /* Prioritizes typographic beauty for body copy */
+}
+
+/* Also effective for other multi-line text elements */
+blockquote, li, .pretty-text {
+   /* MANDATORY: Enables pretty line-breaking logic */
+  text-wrap: pretty;
+}
+```
+
+## Key constraints
+
+*   **Performance vs. Quality**: MANDATORY: `text-wrap: pretty` is more computationally expensive than the default `wrap` (greedy) algorithm because it evaluates multiple lines (typically the last four) to optimize the break points. Avoid applying it globally to every element if your page has an extreme amount of text content.
```

</details>

---

## PR #501: docs: add guide and evals for `animate-element-entry-exit`

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> Some comments to consider, but I do think some of these need to be changed. Gemini did suggest a number of these, and they seem sensible from my perspective.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM after some fine tuning
> 
> - I updated the prompt to specify the same IDs and class names the grader expected from the demo.
> - Rewrote a chunk of the grader to use a more reliable animation spy rather than timeouts to remove flakiness

#### **malchata** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> More a question for @rviscomi and @philipwalton—I see a lot of the generated demos use non-semantic HTML elements for containers. For example, I've seen `<div>` used as a main page container where `<main>` would be better. Is this something that the accessibility agent skill would be looking for?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,168 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Dynamic Content Injection</title>
+  <style>
+    :root {
+      --primary: #1a73e8;
+      --primary-hover: #1557b0;
+      --bg: #f8f9fa;
+      --surface: #ffffff;
+      --text: #202124;
+      --text-secondary: #5f6368;
+      --border: #dadce0;
+    }
+
+    body {
+      font-family: system-ui, -apple-system, sans-serif;
+      padding: 2rem;
+      max-width: 800px;
+      margin: 0 auto;
+      background: var(--bg);
+      color: var(--text);
+      line-height: 1.5;
+    }
+
+    h1 {
+      margin-bottom: 0.5rem;
+    }
+
+    .description {
+      color: var(--text-secondary);
+      margin-bottom: 2rem;
+      font-size: 1.1rem;
+    }
+
+    .demo-section {
+      background: var(--surface);
+      padding: 2rem;
+      border-radius: 12px;
+      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
+      margin-bottom: 2rem;
+    }
+
+    h2 {
+      margin-top: 0;
+      color: var(--text);
+    }
+
+    p {
+      color: var(--text-secondary);
+      margin-bottom: 1.5rem;
+    }
+
+    .controls {
+      display: flex;
+      gap: 1rem;
+      margin-bottom: 1.5rem;
+    }
+
+    button {
+      padding: 0.5rem 1rem;
+      font-size: 1rem;
+      background: var(--primary);
+      color: white;
+      border: none;
+      border-radius: 6px;
+      cursor: pointer;
+      font-weight: 500;
+    }
+
+    button:hover {
+      background: var(--primary-hover);
+    }
+
+    .container {
+      display: flex;
+      flex-wrap: wrap;
+      gap: 1rem;
+      min-height: 120px;
+      padding: 1.5rem;
+      background: var(--bg);
+      border: 1px solid var(--border);
+      border-radius: 8px;
+    }
+
+    .card {
+      width: 100px;
+      height: 100px;
+      background: var(--primary);
+      color: white;
+      display: flex;
+      align-items: center;
+      justify-content: center;
+      border-radius: 8px;
+      font-weight: 600;
+      opacity: 1;
+      transform: translateY(0) scale(1);
+    }
+
+    .card:where([hidden], .hidden) {
+      display: none;
+    }
+  </style>
+</head>
+<body>
+
+  <h1>Transitioning Elements</h1>
+  <p class="description">
+    Smoothly hide and show elements as they are added or removed from the DOM, or as their <code>display</code> values are toggled.
+  </p>
+
+  <div class="demo-section">
+    <h2>Example 1: Display Toggling</h2>
+    <p>Toggling the <code>hidden</code> attribute which sets <code>display: none</code>.</p>
+    <div class="controls">
+      <button id="toggleBtn">Toggle Display</button>
+    </div>
+    <div class="container">
+      <div id="toggleCard" class="card">Item 1</div>
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> Also noting that I posted this comment on the negative demo, where it probably wouldn't really matter (or even be used as future eval criteria for a "bad" demo), but the question still stands :)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,168 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Dynamic Content Injection</title>
+  <style>
+    :root {
+      --primary: #1a73e8;
+      --primary-hover: #1557b0;
+      --bg: #f8f9fa;
+      --surface: #ffffff;
+      --text: #202124;
+      --text-secondary: #5f6368;
+      --border: #dadce0;
+    }
+
+    body {
+      font-family: system-ui, -apple-system, sans-serif;
+      padding: 2rem;
+      max-width: 800px;
+      margin: 0 auto;
+      background: var(--bg);
+      color: var(--text);
+      line-height: 1.5;
+    }
+
+    h1 {
+      margin-bottom: 0.5rem;
+    }
+
+    .description {
+      color: var(--text-secondary);
+      margin-bottom: 2rem;
+      font-size: 1.1rem;
+    }
+
+    .demo-section {
+      background: var(--surface);
+      padding: 2rem;
+      border-radius: 12px;
+      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
+      margin-bottom: 2rem;
+    }
+
+    h2 {
+      margin-top: 0;
+      color: var(--text);
+    }
+
+    p {
+      color: var(--text-secondary);
+      margin-bottom: 1.5rem;
+    }
+
+    .controls {
+      display: flex;
+      gap: 1rem;
+      margin-bottom: 1.5rem;
+    }
+
+    button {
+      padding: 0.5rem 1rem;
+      font-size: 1rem;
+      background: var(--primary);
+      color: white;
+      border: none;
+      border-radius: 6px;
+      cursor: pointer;
+      font-weight: 500;
+    }
+
+    button:hover {
+      background: var(--primary-hover);
+    }
+
+    .container {
+      display: flex;
+      flex-wrap: wrap;
+      gap: 1rem;
+      min-height: 120px;
+      padding: 1.5rem;
+      background: var(--bg);
+      border: 1px solid var(--border);
+      border-radius: 8px;
+    }
+
+    .card {
+      width: 100px;
+      height: 100px;
+      background: var(--primary);
+      color: white;
+      display: flex;
+      align-items: center;
+      justify-content: center;
+      border-radius: 8px;
+      font-weight: 600;
+      opacity: 1;
+      transform: translateY(0) scale(1);
+    }
+
+    .card:where([hidden], .hidden) {
+      display: none;
+    }
+  </style>
+</head>
+<body>
+
+  <h1>Transitioning Elements</h1>
+  <p class="description">
+    Smoothly hide and show elements as they are added or removed from the DOM, or as their <code>display</code> values are toggled.
+  </p>
+
+  <div class="demo-section">
+    <h2>Example 1: Display Toggling</h2>
+    <p>Toggling the <code>hidden</code> attribute which sets <code>display: none</code>.</p>
+    <div class="controls">
+      <button id="toggleBtn">Toggle Display</button>
+    </div>
+    <div class="container">
+      <div id="toggleCard" class="card">Item 1</div>
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> @rviscomi ,the agent skill insists on this being a level 3 heading, but I don't think that would make sense here, because why would we want to nest it under `## Constraints & Accessibility` if fallback strategies were an entirely separate concern?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,104 @@ description: Smoothly hide/show elements as they are added/removed from the DOM
 web-feature-ids:
   - starting-style
   - transition-behavior
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
+  - https://web.dev/blog/baseline-entry-animations
+  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
 ---
+
+In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.
+
+## Implementation
+
+### 1. Animating `display: none` Toggles
+
+To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):
+
+1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
+2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
+3. **Enable discrete transitions**: Include `display` in the `transition` property and use the `allow-discrete` keyword.
+4. **Define the exit state**: Set the target values in the `hidden` attribute.
+
+```css
+.card {
+  display: block;
+  opacity: 1;
+  transform: translateY(0);
+  /* MANDATORY: Use allow-discrete for display transition */
+  transition:
+    display 0.4s allow-discrete,
+    opacity 0.4s ease-out,
+    transform 0.4s ease-out;
+}
+
+/* Entry animation: transition FROM these values when first rendered or display changes from none */
+@starting-style {
+  .card {
+    opacity: 0;
+    transform: translateY(-20px);
+  }
+}
+
+/* Exit animation: transition TO these values when the hidden class or attribute is present */
+.card:where(.hidden, [hidden]) {
+  display: none; /* display none is only needed for the class-based implementation as the hidden attribute applies it by default */
+  opacity: 0;
+  transform: translateY(-20px);
+}
+```
+
+### 2. Animating DOM Insertion and Removal
+
+For elements added via `appendChild()` or removed via `remove()`:
+
+- **Entry**: Use `@starting-style` as shown above. The browser will automatically detect the style change from "nothing" to the element's initial styles and trigger the transition from the `@starting-style` values.
+- **Removal**: Since `element.remove()` is instantaneous and doesn't trigger a CSS transition on its own, you must trigger the exit transition first (e.g., by adding a class) and wait for it to finish before removing the node from the DOM.
+
+```javascript
+// Trigger exit transition
+element.setAttribute('hidden', true);
+
+// 2. Wait for all active transitions/animations to finish
+const animations = element.getAnimations();
+if (animations.length > 0) {
+  // Promise.allSettled ensures we wait even if some animations fail
+  await Promise.allSettled(animations.map(a => a.finished));
+}
+
+// 3. Finally remove the node from the DOM
+element.remove();
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
+- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
+- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
+- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.
+
+## Fallback strategies
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> Using `prefers-reduced-motion` is mentioned here, but not shown in action in the code snippets in this guide.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,104 @@ description: Smoothly hide/show elements as they are added/removed from the DOM
 web-feature-ids:
   - starting-style
   - transition-behavior
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
+  - https://web.dev/blog/baseline-entry-animations
+  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
 ---
+
+In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.
+
+## Implementation
+
+### 1. Animating `display: none` Toggles
+
+To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):
+
+1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
+2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
+3. **Enable discrete transitions**: Include `display` in the `transition` property and use the `allow-discrete` keyword.
+4. **Define the exit state**: Set the target values in the `hidden` attribute.
+
+```css
+.card {
+  display: block;
+  opacity: 1;
+  transform: translateY(0);
+  /* MANDATORY: Use allow-discrete for display transition */
+  transition:
+    display 0.4s allow-discrete,
+    opacity 0.4s ease-out,
+    transform 0.4s ease-out;
+}
+
+/* Entry animation: transition FROM these values when first rendered or display changes from none */
+@starting-style {
+  .card {
+    opacity: 0;
+    transform: translateY(-20px);
+  }
+}
+
+/* Exit animation: transition TO these values when the hidden class or attribute is present */
+.card:where(.hidden, [hidden]) {
+  display: none; /* display none is only needed for the class-based implementation as the hidden attribute applies it by default */
+  opacity: 0;
+  transform: translateY(-20px);
+}
+```
+
+### 2. Animating DOM Insertion and Removal
+
+For elements added via `appendChild()` or removed via `remove()`:
+
+- **Entry**: Use `@starting-style` as shown above. The browser will automatically detect the style change from "nothing" to the element's initial styles and trigger the transition from the `@starting-style` values.
+- **Removal**: Since `element.remove()` is instantaneous and doesn't trigger a CSS transition on its own, you must trigger the exit transition first (e.g., by adding a class) and wait for it to finish before removing the node from the DOM.
+
+```javascript
+// Trigger exit transition
+element.setAttribute('hidden', true);
+
+// 2. Wait for all active transitions/animations to finish
+const animations = element.getAnimations();
+if (animations.length > 0) {
+  // Promise.allSettled ensures we wait even if some animations fail
+  await Promise.allSettled(animations.map(a => a.finished));
+}
+
+// 3. Finally remove the node from the DOM
+element.remove();
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
+- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
+- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
```

</details>

#### **malchata** on `guides/user-experience/animate-element-entry-exit/demo.html`
> `prefers-reduced-motion` is also not used in the demo—if this was generated, maybe modify your generation criteria to explicitly mention this, particularly if it's an accessibility constraint.

#### **malchata** on `guides/user-experience/animate-element-entry-exit/guide.md`
> I think using `CSS.supports()` is worth considering.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,104 @@ description: Smoothly hide/show elements as they are added/removed from the DOM
 web-feature-ids:
   - starting-style
   - transition-behavior
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
+  - https://web.dev/blog/baseline-entry-animations
+  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
 ---
+
+In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.
+
+## Implementation
+
+### 1. Animating `display: none` Toggles
+
+To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):
+
+1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
+2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
+3. **Enable discrete transitions**: Include `display` in the `transition` property and use the `allow-discrete` keyword.
+4. **Define the exit state**: Set the target values in the `hidden` attribute.
+
+```css
+.card {
+  display: block;
+  opacity: 1;
+  transform: translateY(0);
+  /* MANDATORY: Use allow-discrete for display transition */
+  transition:
+    display 0.4s allow-discrete,
+    opacity 0.4s ease-out,
+    transform 0.4s ease-out;
+}
+
+/* Entry animation: transition FROM these values when first rendered or display changes from none */
+@starting-style {
+  .card {
+    opacity: 0;
+    transform: translateY(-20px);
+  }
+}
+
+/* Exit animation: transition TO these values when the hidden class or attribute is present */
+.card:where(.hidden, [hidden]) {
+  display: none; /* display none is only needed for the class-based implementation as the hidden attribute applies it by default */
+  opacity: 0;
+  transform: translateY(-20px);
+}
+```
+
+### 2. Animating DOM Insertion and Removal
+
+For elements added via `appendChild()` or removed via `remove()`:
+
+- **Entry**: Use `@starting-style` as shown above. The browser will automatically detect the style change from "nothing" to the element's initial styles and trigger the transition from the `@starting-style` values.
+- **Removal**: Since `element.remove()` is instantaneous and doesn't trigger a CSS transition on its own, you must trigger the exit transition first (e.g., by adding a class) and wait for it to finish before removing the node from the DOM.
+
+```javascript
+// Trigger exit transition
+element.setAttribute('hidden', true);
+
+// 2. Wait for all active transitions/animations to finish
+const animations = element.getAnimations();
+if (animations.length > 0) {
+  // Promise.allSettled ensures we wait even if some animations fail
+  await Promise.allSettled(animations.map(a => a.finished));
+}
+
+// 3. Finally remove the node from the DOM
+element.remove();
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
+- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
+- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
+- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("starting-style") }}
+
+For browsers that do not support these features, elements will toggle `display: none` instantly. For smooth animations in older browsers, use JavaScript-based animation libraries or manually coordinate `display` toggles using `requestAnimationFrame` and `transitionend` events.
+
+### Manual Entry Animation (JS Fallback)
+
+```javascript
```

</details>

#### **rviscomi** on `guides/user-experience/animate-element-entry-exit/negative-demo.html`
> No it doesn't matter. The demo files are only used for calibrating the grader. See https://github.com/GoogleChrome/guidance/blob/main/.agents/skills/project-guides/SKILL.md for more info

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,168 @@
+<!DOCTYPE html>
+<html lang="en">
+<head>
+  <meta charset="UTF-8">
+  <meta name="viewport" content="width=device-width, initial-scale=1.0">
+  <title>Dynamic Content Injection</title>
+  <style>
+    :root {
+      --primary: #1a73e8;
+      --primary-hover: #1557b0;
+      --bg: #f8f9fa;
+      --surface: #ffffff;
+      --text: #202124;
+      --text-secondary: #5f6368;
+      --border: #dadce0;
+    }
+
+    body {
+      font-family: system-ui, -apple-system, sans-serif;
+      padding: 2rem;
+      max-width: 800px;
+      margin: 0 auto;
+      background: var(--bg);
+      color: var(--text);
+      line-height: 1.5;
+    }
+
+    h1 {
+      margin-bottom: 0.5rem;
+    }
+
+    .description {
+      color: var(--text-secondary);
+      margin-bottom: 2rem;
+      font-size: 1.1rem;
+    }
+
+    .demo-section {
+      background: var(--surface);
+      padding: 2rem;
+      border-radius: 12px;
+      box-shadow: 0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15);
+      margin-bottom: 2rem;
+    }
+
+    h2 {
+      margin-top: 0;
+      color: var(--text);
+    }
+
+    p {
+      color: var(--text-secondary);
+      margin-bottom: 1.5rem;
+    }
+
+    .controls {
+      display: flex;
+      gap: 1rem;
+      margin-bottom: 1.5rem;
+    }
+
+    button {
+      padding: 0.5rem 1rem;
+      font-size: 1rem;
+      background: var(--primary);
+      color: white;
+      border: none;
+      border-radius: 6px;
+      cursor: pointer;
+      font-weight: 500;
+    }
+
+    button:hover {
+      background: var(--primary-hover);
+    }
+
+    .container {
+      display: flex;
+      flex-wrap: wrap;
+      gap: 1rem;
+      min-height: 120px;
+      padding: 1.5rem;
+      background: var(--bg);
+      border: 1px solid var(--border);
+      border-radius: 8px;
+    }
+
+    .card {
+      width: 100px;
+      height: 100px;
+      background: var(--primary);
+      color: white;
+      display: flex;
+      align-items: center;
+      justify-content: center;
+      border-radius: 8px;
+      font-weight: 600;
+      opacity: 1;
+      transform: translateY(0) scale(1);
+    }
+
+    .card:where([hidden], .hidden) {
+      display: none;
+    }
+  </style>
+</head>
+<body>
+
+  <h1>Transitioning Elements</h1>
+  <p class="description">
+    Smoothly hide and show elements as they are added or removed from the DOM, or as their <code>display</code> values are toggled.
+  </p>
+
+  <div class="demo-section">
+    <h2>Example 1: Display Toggling</h2>
+    <p>Toggling the <code>hidden</code> attribute which sets <code>display: none</code>.</p>
+    <div class="controls">
+      <button id="toggleBtn">Toggle Display</button>
+    </div>
+    <div class="container">
+      <div id="toggleCard" class="card">Item 1</div>
+    </div>
+  </div>
+
+  <div class="demo-section">
```

</details>

#### **rviscomi** on `guides/user-experience/animate-element-entry-exit/guide.md`
> Yeah, the skill hardcodes the H3 level, so it should be relaxed
> 
> > You **MUST** include a `### Fallback strategies` section regardless of Baseline status, as developers may have older baseline targets.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,4 +4,104 @@ description: Smoothly hide/show elements as they are added/removed from the DOM
 web-feature-ids:
   - starting-style
   - transition-behavior
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/transition-behavior
+  - https://web.dev/blog/baseline-entry-animations
+  - https://www.smashingmagazine.com/2025/01/transitioning-top-layer-entries-display-property-css/
 ---
+
+In the past, CSS transitions could not animate elements when they were first added to the DOM or when their `display` property changed from `none`. The `@starting-style` at-rule and `transition-behavior: allow-discrete` provide a declarative way to create smooth entry and exit animations.
+
+## Implementation
+
+### 1. Animating `display: none` Toggles
+
+To animate an element when toggling its visibility via an attribute (e.g., `hidden` with `display: none`):
+
+1. **Define the visible state**: Set the final property values (e.g., `opacity: 1`) on the base class.
+2. **Define the entry starting state**: Use `@starting-style` to specify the values to transition *from* when the element becomes visible.
+3. **Enable discrete transitions**: Include `display` in the `transition` property and use the `allow-discrete` keyword.
+4. **Define the exit state**: Set the target values in the `hidden` attribute.
+
+```css
+.card {
+  display: block;
+  opacity: 1;
+  transform: translateY(0);
+  /* MANDATORY: Use allow-discrete for display transition */
+  transition:
+    display 0.4s allow-discrete,
+    opacity 0.4s ease-out,
+    transform 0.4s ease-out;
+}
+
+/* Entry animation: transition FROM these values when first rendered or display changes from none */
+@starting-style {
+  .card {
+    opacity: 0;
+    transform: translateY(-20px);
+  }
+}
+
+/* Exit animation: transition TO these values when the hidden class or attribute is present */
+.card:where(.hidden, [hidden]) {
+  display: none; /* display none is only needed for the class-based implementation as the hidden attribute applies it by default */
+  opacity: 0;
+  transform: translateY(-20px);
+}
+```
+
+### 2. Animating DOM Insertion and Removal
+
+For elements added via `appendChild()` or removed via `remove()`:
+
+- **Entry**: Use `@starting-style` as shown above. The browser will automatically detect the style change from "nothing" to the element's initial styles and trigger the transition from the `@starting-style` values.
+- **Removal**: Since `element.remove()` is instantaneous and doesn't trigger a CSS transition on its own, you must trigger the exit transition first (e.g., by adding a class) and wait for it to finish before removing the node from the DOM.
+
+```javascript
+// Trigger exit transition
+element.setAttribute('hidden', true);
+
+// 2. Wait for all active transitions/animations to finish
+const animations = element.getAnimations();
+if (animations.length > 0) {
+  // Promise.allSettled ensures we wait even if some animations fail
+  await Promise.allSettled(animations.map(a => a.finished));
+}
+
+// 3. Finally remove the node from the DOM
+element.remove();
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `allow-discrete` (either via `transition-behavior: allow-discrete` or the `allow-discrete` keyword in the `transition` shorthand) when transitioning `display`. Without it, the element will instantly disappear during exit.
+- **MANDATORY**: Use `@starting-style` for entry animations. Browsers skip transitions on an element's first style update (initial render or `display: none` change) unless this is provided.
+- **DO**: Include `overlay` in the `transition` list if animating top-layer elements like `<dialog>` or `popover` to ensure they stay in the top layer during the exit animation.
+- **DO**: Respect user preferences for reduced motion using the `prefers-reduced-motion` media query.
+- **DO NOT**: Rely on `@starting-style` for exit animations; it only defines the *starting* point for an entry transition. Exit animations are defined by the transition to the hidden state.
+
+## Fallback strategies
```

</details>

---

## PR #307: Add guide content and expectations for reduce-style-repetition

### Reviews

#### **malchata** (CHANGES_REQUESTED)
> Added some suggestions using the guide skills.

### Comments

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
> ### Fallback Strategies
> 
> {{ BASELINE_STATUS("function") }}
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,59 @@ sources:
   - https://developer.chrome.com/en/docs/devtools/css/reference
   - https://web.dev/en/learn/css/custom-properties
 ---
+
+## Overview
+
+The CSS `@function` at-rule allows developers to define custom, reusable functions directly within stylesheets. This reduces repetition for calculated styles (like fluid typography or grid calculations) by encapsulating logic into a single, maintainable place.
+
+## Guidelines
+
+### 1. Naming and Definition
+
+-   **MANDATORY:** Custom functions MUST use the `<dashed-function>` naming convention (e.g., `@function --my-func`).
+-   **DO** define arguments as custom properties inside the function definition.
+-   **MANDATORY:** Use the `result:` descriptor within the function body to return the computed value.
+
+### 2. Usage
+
+-   **DO** invoke the function using the definition's name-dashed form (e.g., `font-size: --my-func(arg1, arg2)`).
+-   **DO NOT** omit parameters or provide invalid types, as this will result in an invalid computed value.
+
+### 3. Code Snippets
+
+```css
+/* Definition */
+@function --fluid-size(--min, --max, --vw-min, --vw-max) {
+  /* DO: Calculate fluid size with clamp/calc */
+  result: clamp(
+    var(--min),
+    calc(var(--min) + (var(--max) - var(--min)) * ((100vw - var(--vw-min)) / (var(--vw-max) - var(--vw-min)))),
+    var(--max)
+  );
+}
+
+/* Usage */
+.element {
+  /* DO: Call custom fluid function */
+  font-size: --fluid-size(16px, 24px, 320px, 1200px);
+}
+```
+
+### 4. Fallback Strategies
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
> 
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,59 @@ sources:
   - https://developer.chrome.com/en/docs/devtools/css/reference
   - https://web.dev/en/learn/css/custom-properties
 ---
+
+## Overview
+
+The CSS `@function` at-rule allows developers to define custom, reusable functions directly within stylesheets. This reduces repetition for calculated styles (like fluid typography or grid calculations) by encapsulating logic into a single, maintainable place.
+
+## Guidelines
+
+### 1. Naming and Definition
+
+-   **MANDATORY:** Custom functions MUST use the `<dashed-function>` naming convention (e.g., `@function --my-func`).
+-   **DO** define arguments as custom properties inside the function definition.
+-   **MANDATORY:** Use the `result:` descriptor within the function body to return the computed value.
+
+### 2. Usage
+
+-   **DO** invoke the function using the definition's name-dashed form (e.g., `font-size: --my-func(arg1, arg2)`).
+-   **DO NOT** omit parameters or provide invalid types, as this will result in an invalid computed value.
+
+### 3. Code Snippets
+
+```css
+/* Definition */
+@function --fluid-size(--min, --max, --vw-min, --vw-max) {
+  /* DO: Calculate fluid size with clamp/calc */
+  result: clamp(
+    var(--min),
+    calc(var(--min) + (var(--max) - var(--min)) * ((100vw - var(--vw-min)) / (var(--vw-max) - var(--vw-min)))),
+    var(--max)
+  );
+}
+
+/* Usage */
+.element {
+  /* DO: Call custom fluid function */
+  font-size: --fluid-size(16px, 24px, 320px, 1200px);
+}
+```
+
+### 4. Fallback Strategies
+
+> [!IMPORTANT]
+> CSS Custom Functions (`@function`) are an experimental feature and are **NOT Baseline Widely Available**.
+
+To maintain compatibility with browsers that do not support custom functions, always provide a standard value or calculation *before* invoking the custom function. The browser will ignore the subsequent declaration if it fails to parse the function call.
+
+```css
+.fallback-example {
+  /* 1. Standard Static/Dynamic Fallback approach */
+  font-size: 18px; 
+
+  /* 2. Custom Function (overrides fallback if supported) */
+  font-size: --fluid-size(16px, 24px, 320px, 1200px);
+}
+```
+
+{{ BASELINE_STATUS("function") }}
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
>   /* DO: Call the custom fluid function. This reduces boilerplate by centralizing the complex calculation logic. */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,59 @@ sources:
   - https://developer.chrome.com/en/docs/devtools/css/reference
   - https://web.dev/en/learn/css/custom-properties
 ---
+
+## Overview
+
+The CSS `@function` at-rule allows developers to define custom, reusable functions directly within stylesheets. This reduces repetition for calculated styles (like fluid typography or grid calculations) by encapsulating logic into a single, maintainable place.
+
+## Guidelines
+
+### 1. Naming and Definition
+
+-   **MANDATORY:** Custom functions MUST use the `<dashed-function>` naming convention (e.g., `@function --my-func`).
+-   **DO** define arguments as custom properties inside the function definition.
+-   **MANDATORY:** Use the `result:` descriptor within the function body to return the computed value.
+
+### 2. Usage
+
+-   **DO** invoke the function using the definition's name-dashed form (e.g., `font-size: --my-func(arg1, arg2)`).
+-   **DO NOT** omit parameters or provide invalid types, as this will result in an invalid computed value.
+
+### 3. Code Snippets
+
+```css
+/* Definition */
+@function --fluid-size(--min, --max, --vw-min, --vw-max) {
+  /* DO: Calculate fluid size with clamp/calc */
+  result: clamp(
+    var(--min),
+    calc(var(--min) + (var(--max) - var(--min)) * ((100vw - var(--vw-min)) / (var(--vw-max) - var(--vw-min)))),
+    var(--max)
+  );
+}
+
+/* Usage */
+.element {
+  /* DO: Call custom fluid function */
```

</details>

#### **malchata** on `guides/user-experience/reduce-style-repetition/guide.md`
> ```suggestion
>   /* DO: Use clamp() and calc() to create a fluid value that scales proportionally between the min and max viewport widths. This ensures the output scales smoothly across device sizes without complex media queries. */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,59 @@ sources:
   - https://developer.chrome.com/en/docs/devtools/css/reference
   - https://web.dev/en/learn/css/custom-properties
 ---
+
+## Overview
+
+The CSS `@function` at-rule allows developers to define custom, reusable functions directly within stylesheets. This reduces repetition for calculated styles (like fluid typography or grid calculations) by encapsulating logic into a single, maintainable place.
+
+## Guidelines
+
+### 1. Naming and Definition
+
+-   **MANDATORY:** Custom functions MUST use the `<dashed-function>` naming convention (e.g., `@function --my-func`).
+-   **DO** define arguments as custom properties inside the function definition.
+-   **MANDATORY:** Use the `result:` descriptor within the function body to return the computed value.
+
+### 2. Usage
+
+-   **DO** invoke the function using the definition's name-dashed form (e.g., `font-size: --my-func(arg1, arg2)`).
+-   **DO NOT** omit parameters or provide invalid types, as this will result in an invalid computed value.
+
+### 3. Code Snippets
+
+```css
+/* Definition */
+@function --fluid-size(--min, --max, --vw-min, --vw-max) {
+  /* DO: Calculate fluid size with clamp/calc */
```

</details>

---

## PR #495: Guides and evals for `coordinate-global-events` use case for temporal

### Reviews

#### **malchata** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> ```suggestion
> ## Fallback strategies
> ```
> 
> Total nit, but Gemini yells about it.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,92 @@ name: coordinate-global-events
 description: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Coordinating Global Events with Temporal
+
+Scheduling events across different time zones is notoriously difficult with the legacy `Date` object, especially around Daylight Saving Time (DST) transitions when hours can be skipped or repeated.
+
+The `Temporal` API provides `Temporal.ZonedDateTime` to represent a date and time in a specific time zone, handling DST transitions automatically and predictably.
+
+## How to Implement
+
+To coordinate global events and handle potential DST conflicts:
+
+1.  **Create a ZonedDateTime**: Use `Temporal.ZonedDateTime.from()` to create a time-zone-aware date-time object.
+2.  **Handle Ambiguity**: Use the `disambiguation` option to control behavior when a time is ambiguous or does not exist (e.g., during clock changes).
+3.  **Convert Time Zones**: Use `.withTimeZone()` to see the equivalent time in another location.
+
+### Example: Scheduling and Conflict Detection
+
+```javascript
+// 1. Define the event time and target time zone
+const date = "2025-03-09";
+const time = "02:30"; // This time is skipped in New York during Spring Forward
+const timeZone = "America/New_York";
+const inputStr = `${date}T${time}[${timeZone}]`;
+
+// 2. Detect conflicts using 'reject'
+let hasConflict = false;
+try {
+  // 'reject' throws RangeError if the time is ambiguous or does not exist
+  Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'reject' });
+} catch (e) {
+  if (e instanceof RangeError) {
+    hasConflict = true;
+    console.log("This time falls in a DST transition gap or overlap.");
+  }
+}
+
+// 3. Resolve the time safely using 'compatible' (default)
+// 'compatible' will resolve to a valid time even if skipped or repeated
+const hostTime = Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'compatible' });
+console.log(`Resolved time: ${hostTime.toString()}`);
+
+// 4. Convert to another time zone (e.g., Tokyo)
+const tokyoTime = hostTime.withTimeZone("Asia/Tokyo");
+console.log(`Tokyo time: ${tokyoTime.toString()}`);
+```
+
+## Strategic Implementation & Best Practices
+
+-   **DO** use `Temporal.ZonedDateTime` for events that are bound to a specific geographical location (like a meeting in a specific city).
+-   **DO** use `disambiguation: 'reject'` if you need to detect and warn users about scheduling conflicts during DST transitions.
+-   **DO** use `disambiguation: 'compatible'` (the default) when you want the system to automatically pick a sensible time when conflicts occur.
+-   **DO NOT** use `Temporal.PlainDateTime` for global events, as it does not carry time zone information and cannot account for DST changes.
+-   **DO** use `.withTimeZone()` to calculate the equivalent time in other locations without mutating the original object (Temporal objects are immutable).
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> (It mandates it to be an level three heading as well, but it doesn't make a lot of sense to do so in this context, IMO.)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,92 @@ name: coordinate-global-events
 description: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Coordinating Global Events with Temporal
+
+Scheduling events across different time zones is notoriously difficult with the legacy `Date` object, especially around Daylight Saving Time (DST) transitions when hours can be skipped or repeated.
+
+The `Temporal` API provides `Temporal.ZonedDateTime` to represent a date and time in a specific time zone, handling DST transitions automatically and predictably.
+
+## How to Implement
+
+To coordinate global events and handle potential DST conflicts:
+
+1.  **Create a ZonedDateTime**: Use `Temporal.ZonedDateTime.from()` to create a time-zone-aware date-time object.
+2.  **Handle Ambiguity**: Use the `disambiguation` option to control behavior when a time is ambiguous or does not exist (e.g., during clock changes).
+3.  **Convert Time Zones**: Use `.withTimeZone()` to see the equivalent time in another location.
+
+### Example: Scheduling and Conflict Detection
+
+```javascript
+// 1. Define the event time and target time zone
+const date = "2025-03-09";
+const time = "02:30"; // This time is skipped in New York during Spring Forward
+const timeZone = "America/New_York";
+const inputStr = `${date}T${time}[${timeZone}]`;
+
+// 2. Detect conflicts using 'reject'
+let hasConflict = false;
+try {
+  // 'reject' throws RangeError if the time is ambiguous or does not exist
+  Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'reject' });
+} catch (e) {
+  if (e instanceof RangeError) {
+    hasConflict = true;
+    console.log("This time falls in a DST transition gap or overlap.");
+  }
+}
+
+// 3. Resolve the time safely using 'compatible' (default)
+// 'compatible' will resolve to a valid time even if skipped or repeated
+const hostTime = Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'compatible' });
+console.log(`Resolved time: ${hostTime.toString()}`);
+
+// 4. Convert to another time zone (e.g., Tokyo)
+const tokyoTime = hostTime.withTimeZone("Asia/Tokyo");
+console.log(`Tokyo time: ${tokyoTime.toString()}`);
+```
+
+## Strategic Implementation & Best Practices
+
+-   **DO** use `Temporal.ZonedDateTime` for events that are bound to a specific geographical location (like a meeting in a specific city).
+-   **DO** use `disambiguation: 'reject'` if you need to detect and warn users about scheduling conflicts during DST transitions.
+-   **DO** use `disambiguation: 'compatible'` (the default) when you want the system to automatically pick a sensible time when conflicts occur.
+-   **DO NOT** use `Temporal.PlainDateTime` for global events, as it does not carry time zone information and cannot account for DST changes.
+-   **DO** use `.withTimeZone()` to calculate the equivalent time in other locations without mutating the original object (Temporal objects are immutable).
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> It's not clear which of these steps are optional, and which aren't. Prefixing these with the usual directives would make that a bit more clear to agents.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,92 @@ name: coordinate-global-events
 description: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Coordinating Global Events with Temporal
+
+Scheduling events across different time zones is notoriously difficult with the legacy `Date` object, especially around Daylight Saving Time (DST) transitions when hours can be skipped or repeated.
+
+The `Temporal` API provides `Temporal.ZonedDateTime` to represent a date and time in a specific time zone, handling DST transitions automatically and predictably.
+
+## How to Implement
+
+To coordinate global events and handle potential DST conflicts:
+
+1.  **Create a ZonedDateTime**: Use `Temporal.ZonedDateTime.from()` to create a time-zone-aware date-time object.
+2.  **Handle Ambiguity**: Use the `disambiguation` option to control behavior when a time is ambiguous or does not exist (e.g., during clock changes).
+3.  **Convert Time Zones**: Use `.withTimeZone()` to see the equivalent time in another location.
```

</details>

#### **malchata** on `guides/user-experience/coordinate-global-events/guide.md`
> Gemini suggests removing this an integrating the best practices directly into code comments, but I'm not so sure myself. Wouldn't mind guidance from @rviscomi or @philipwalton here.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,92 @@ name: coordinate-global-events
 description: Schedule future meetings or events by explicitly binding them to a geographical IANA time zone so that event times remain accurate regardless of Daylight Saving Time (DST) transitions, "skipped" or "repeated" hours during clock changes.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Coordinating Global Events with Temporal
+
+Scheduling events across different time zones is notoriously difficult with the legacy `Date` object, especially around Daylight Saving Time (DST) transitions when hours can be skipped or repeated.
+
+The `Temporal` API provides `Temporal.ZonedDateTime` to represent a date and time in a specific time zone, handling DST transitions automatically and predictably.
+
+## How to Implement
+
+To coordinate global events and handle potential DST conflicts:
+
+1.  **Create a ZonedDateTime**: Use `Temporal.ZonedDateTime.from()` to create a time-zone-aware date-time object.
+2.  **Handle Ambiguity**: Use the `disambiguation` option to control behavior when a time is ambiguous or does not exist (e.g., during clock changes).
+3.  **Convert Time Zones**: Use `.withTimeZone()` to see the equivalent time in another location.
+
+### Example: Scheduling and Conflict Detection
+
+```javascript
+// 1. Define the event time and target time zone
+const date = "2025-03-09";
+const time = "02:30"; // This time is skipped in New York during Spring Forward
+const timeZone = "America/New_York";
+const inputStr = `${date}T${time}[${timeZone}]`;
+
+// 2. Detect conflicts using 'reject'
+let hasConflict = false;
+try {
+  // 'reject' throws RangeError if the time is ambiguous or does not exist
+  Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'reject' });
+} catch (e) {
+  if (e instanceof RangeError) {
+    hasConflict = true;
+    console.log("This time falls in a DST transition gap or overlap.");
+  }
+}
+
+// 3. Resolve the time safely using 'compatible' (default)
+// 'compatible' will resolve to a valid time even if skipped or repeated
+const hostTime = Temporal.ZonedDateTime.from(inputStr, { disambiguation: 'compatible' });
+console.log(`Resolved time: ${hostTime.toString()}`);
+
+// 4. Convert to another time zone (e.g., Tokyo)
+const tokyoTime = hostTime.withTimeZone("Asia/Tokyo");
+console.log(`Tokyo time: ${tokyoTime.toString()}`);
+```
+
+## Strategic Implementation & Best Practices
```

</details>

---

## PR #498: Guide and evals for `format-human-readable-durations` use case for temporal

### Reviews

#### **malchata** (COMMENTED)
*(No review body)*

#### **malchata** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> ```suggestion
> ## Fallback strategies
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Formatting Human-Readable Durations with Temporal
+
+Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.
+
+## How to Implement
+
+To format a duration:
+
+1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
+2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
+3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.
+
+### Example: Duration Balancing
+
+```javascript
+// 1. Create a duration (e.g., from user input or calculation)
+const duration = Temporal.Duration.from({ minutes: 90 });
+
+// 2. Balance to hours
+// This converts 90 minutes to 1 hour and 30 minutes
+const balancedToHours = duration.round({ largestUnit: 'hours' });
+console.log(`${balancedToHours.hours} hours and ${balancedToHours.minutes} minutes`);
+// Output: "1 hours and 30 minutes" (Note: Pluralization needs handling)
+
+// 3. Balance to minutes (keep as total minutes)
+const balancedToMinutes = duration.round({ largestUnit: 'minutes' });
+console.log(`${balancedToMinutes.minutes} minutes`);
+// Output: "90 minutes"
+```
+
+## Strategic Implementation & Best Practices
+
+*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
+*   **DO** handle pluralization and joining of units manually or with external helpers, as `Temporal.Duration` does not provide localized string formatting.
+*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
+*   **DO** use feature detection and a polyfill for environments lacking native support.
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Total nit, but Gemini complains if you don't do it like this.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Formatting Human-Readable Durations with Temporal
+
+Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.
+
+## How to Implement
+
+To format a duration:
+
+1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
+2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
+3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.
+
+### Example: Duration Balancing
+
+```javascript
+// 1. Create a duration (e.g., from user input or calculation)
+const duration = Temporal.Duration.from({ minutes: 90 });
+
+// 2. Balance to hours
+// This converts 90 minutes to 1 hour and 30 minutes
+const balancedToHours = duration.round({ largestUnit: 'hours' });
+console.log(`${balancedToHours.hours} hours and ${balancedToHours.minutes} minutes`);
+// Output: "1 hours and 30 minutes" (Note: Pluralization needs handling)
+
+// 3. Balance to minutes (keep as total minutes)
+const balancedToMinutes = duration.round({ largestUnit: 'minutes' });
+console.log(`${balancedToMinutes.minutes} minutes`);
+// Output: "90 minutes"
+```
+
+## Strategic Implementation & Best Practices
+
+*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
+*   **DO** handle pluralization and joining of units manually or with external helpers, as `Temporal.Duration` does not provide localized string formatting.
+*   **DO NOT** rely on `Temporal.Duration.prototype.toString()` for user-facing text; it returns ISO 8601 strings (e.g., `PT1H30M`).
+*   **DO** use feature detection and a polyfill for environments lacking native support.
+
+## Fallback Strategy
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> I know this use case was already settled, but it mentions a "localized" format, but should this be dropped? Otherwise you might want to consider adding `Intl.DurationFormat` to this guide. If you do, you'll need to:
> 
> - Add `intl-duration-format` to `web-feature-ids`.
> - Add a link to the MDN docs for `Intl.DurationFormat` in `sources`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Should these have imperative language? e.g., `**DO**`, `**DO NOT**`, `**MANDATORY**`?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Formatting Human-Readable Durations with Temporal
+
+Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.
+
+## How to Implement
+
+To format a duration:
+
+1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
+2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
+3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.
```

</details>

#### **malchata** on `guides/user-experience/format-human-readable-durations/guide.md`
> Manually handling pluralization and joining units manually seems kinda brittle, and I think is well-served by `Intl.DurationFormat`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,71 @@ name: format-human-readable-durations
 description: Present elapsed time or durations to users in a readable, localized format, with the flexibility to display either detailed unit breakdowns (e.g., "1 hour and 30 minutes") or total unit counts (e.g., "90 minutes") depending on context.
 web-feature-ids:
   - temporal
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Temporal
+  - https://www.npmjs.com/package/@js-temporal/polyfill
+---
+
+# Formatting Human-Readable Durations with Temporal
+
+Presenting elapsed time or durations to users in a readable format (e.g., "1 hour and 30 minutes") has historically required manual math or external libraries. The `Temporal` API's `Temporal.Duration` class simplifies this by providing structured duration objects and powerful "balancing" capabilities via the `round()` method.
+
+## How to Implement
+
+To format a duration:
+
+1.  **Create a Duration**: Use `Temporal.Duration.from()` to create a duration object from a set of units.
+2.  **Apply Balancing**: Use the `round()` method with the `largestUnit` option to control how units are balanced. For example, to convert 90 minutes into hours and minutes, or to keep it as total minutes.
+3.  **Build the Display String**: Access the specific unit properties (like `.hours`, `.minutes`) to construct the human-readable string.
+
+### Example: Duration Balancing
+
+```javascript
+// 1. Create a duration (e.g., from user input or calculation)
+const duration = Temporal.Duration.from({ minutes: 90 });
+
+// 2. Balance to hours
+// This converts 90 minutes to 1 hour and 30 minutes
+const balancedToHours = duration.round({ largestUnit: 'hours' });
+console.log(`${balancedToHours.hours} hours and ${balancedToHours.minutes} minutes`);
+// Output: "1 hours and 30 minutes" (Note: Pluralization needs handling)
+
+// 3. Balance to minutes (keep as total minutes)
+const balancedToMinutes = duration.round({ largestUnit: 'minutes' });
+console.log(`${balancedToMinutes.minutes} minutes`);
+// Output: "90 minutes"
+```
+
+## Strategic Implementation & Best Practices
+
+*   **DO** use `Temporal.Duration.round()` with `largestUnit` to control the display strategy (detailed breakdown vs total count).
+*   **DO** handle pluralization and joining of units manually or with external helpers, as `Temporal.Duration` does not provide localized string formatting.
```

</details>

---

## PR #304: Adds the guide for top-level await for fetching async dependencies.

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> ```suggestion
> # Conditionally load or initialize async dependencies
> ```
> 
> I think it's good to be consistent with the description.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Nit: I'd update this entire code block to be a JS rather than an HTML, since that's how most people author JS. (Also, an inline module script can't really export anything, because there no way to import it.)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I'd avoid using this an example. `IntersectionObserver` has been Baseline widely available for many, many years, and this could confuse AI agents into thinking `IntersectionObserver` code needs to use a polyfill.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I think this is only true when importing from a third-party domain. If you're using a bundler that will create a chunk hosted along with all your other chunks, then I don't think it's necessary to use a try/catch. (And since most people use bundlers, I expect that will be the majority case.)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Yes, but most people are going to be using a bundler, which should take care of that for you.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Again, only if the request is to a 3P domain.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I think it would be more helpful to move this step higher and frame it as: "Ensure your conditional and top-level await run before the features being loaded or initialized is used.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> ```suggestion
>       await import('path/to/polyfill.js');
> ```
> 
> I'd just use a generic reference, and definitely don't use a reference to polyfill.io, since that service has been compromised.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
+    try {
+      // 3 & 4: Dynamically await the polyfill import
+      await import('https://cdn.polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> I would expect the code here to use `IntersectionObserver` (or whatever you switch this to) freely at this point, rather than creating another wrapper.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
+    try {
+      // 3 & 4: Dynamically await the polyfill import
+      await import('https://cdn.polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
+    } catch (error) {
+      // 5: Handle network or loading failures gracefully
+      console.error('Failed to load IntersectionObserver polyfill:', error);
+    }
+  }
+
+  // 6: Export bindings synchronously; downstream consumers are guaranteed the polyfill is evaluated (or handled)
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> Again, only if importing from a 3P site (but that's true of all imports).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
+    try {
+      // 3 & 4: Dynamically await the polyfill import
+      await import('https://cdn.polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
+    } catch (error) {
+      // 5: Handle network or loading failures gracefully
+      console.error('Failed to load IntersectionObserver polyfill:', error);
+    }
+  }
+
+  // 6: Export bindings synchronously; downstream consumers are guaranteed the polyfill is evaluated (or handled)
+  export const createObserver = (element, callback) => {
+    if (!globalThis.IntersectionObserver) return null;
+    const observer = new IntersectionObserver(callback);
+    observer.observe(element);
+    return observer;
+  };
+</script>
+```
+
+## Best practices
+
+* **DO** ensure an ESM execution context. In the browser, top-level await is syntactically invalid in `<script>` blocks that don't use the `type="module"` attribute.
+* **DO** implement strict error boundaries. Unhandled Promise rejections using top-level await will abort module evaluation, resulting in missing dependencies or non-execution of application logic.
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> This section should include some recommendations to avoid this bug (which is what is preventing this feature from being Baseline): https://bugs.webkit.org/show_bug.cgi?id=242740

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,51 @@ description: Conditionally load or initialize async dependencies (such as import
 web-feature-ids:
     - top-level-await
 ---
+
+# Conditional polyfill dependency fetching and initialization with top-level await
+
+Top-level await enables ECMAScript Modules (ESM) to act as asynchronous functions, pausing their own evaluation and blocking downstream imports until specific Promises resolve. This makes it an ideal mechanism for conditional dependency loading, such as fetching environment-specific polyfills before application code executes.
+
+## How to implement
+
+1. Verify that your module is being parsed as an ECMAScript module.
+2. Programmatically detect the absence of the required API or feature in the current runtime environment.
+3. Wrap the dynamic import logic within a `try/catch` block to prevent unhandled rejections from failing the entire module graph.
+4. Execute a dynamic `import()` to fetch and evaluate the required polyfill.
+5. Provide fallback logic in the `catch` block to ensure graceful degradation if the network request fails.
+6. Export the module's public API only after the environment has been successfully patched and verified.
+
+## Example code
+
+```html
+<!-- 1. Ensure the execution environment allows ESM. -->
+<script type="module">
+  // 2. Check for browser capabilities to avoid running code
+  //    in contexts where a feature doesn't require a polyfill
+  if (typeof globalThis.IntersectionObserver === 'undefined') {
+    try {
+      // 3 & 4: Dynamically await the polyfill import
+      await import('https://cdn.polyfill.io/v3/polyfill.min.js?features=IntersectionObserver');
+    } catch (error) {
+      // 5: Handle network or loading failures gracefully
+      console.error('Failed to load IntersectionObserver polyfill:', error);
+    }
+  }
+
+  // 6: Export bindings synchronously; downstream consumers are guaranteed the polyfill is evaluated (or handled)
+  export const createObserver = (element, callback) => {
+    if (!globalThis.IntersectionObserver) return null;
+    const observer = new IntersectionObserver(callback);
+    observer.observe(element);
+    return observer;
+  };
+</script>
+```
+
+## Best practices
```

</details>

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> The use case in this file is generic and mentions both loading or initializing async dependencies, but this guide only mentions loading polyfills. I think you should add an example that includes a non-polyfill async dependency.

#### **philipwalton** on `guides/performance/conditional-async-dependencies/guide.md`
> This file is also missing a fallback section, which in this case I think should discuss how to use the feature in a way that doesn't trigger the Safari bug.

---

## PR #508: Guide: subgrid

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/subgrid/guide.md`
> @paulirish I'm curious, did the agent choose this name, or was it part of some generation task you specified? I ask because we've previously been avoiding mentioning the feature name in the use case (name or description), and I wonder if this needs to be clearer in the skills.
> 
> For this one, I think a better name would be something like `align-nested-grids` or `align-nested-grid-items`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,82 @@
+---
+name: subgrid
```

</details>

#### **philipwalton** on `guides/user-experience/subgrid/guide.md`
> Ahhh, OK, it looks like this is defined here: https://github.com/GoogleChrome/guidance/blob/a745576207060f212d02cdb569953ab36fd45c70/guides/guide-gen.ts#L365
> 
> I think we want the slug to be generated as well from the use case name.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,82 @@
+---
+name: subgrid
```

</details>

---

## PR #492: Support evals for discipline SKILLs

### Reviews

#### **rviscomi** (COMMENTED)
> I have some doubts about the feasibility of creating a single demo and expectations file per high-level skill that faithfully captures most of the best practices. These skill files tend to cover A LOT of ground.

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/forms/expectations.md`
> From a quick look, it seems like this is missing a ton of nuance in the skill file. Are we ok not eval'ing most of the guidance?

#### **rviscomi** on `guides/forms/expectations.md`
> Ok SG. If this PR will be more infra-focused I'll remove myself as a reviewer.

---

## PR #474: publish all guides. add in form skill

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `serving/skills-cli/build-dist.ts`
> Why the special case for Forms? There's also a Performance skill as of earlier today.
> 
> Could this be written more generically to take any `guides/*/SKILL.md` file?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -98,6 +98,21 @@ async function main() {
     process.exit(1);
   }
 
+  console.log("Copying forms SKILL.md...");
```

</details>

---

## PR #490: Create guide and evals for declarative-button-actions 

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM
> 
> I just removed the expectation for a status indicator, since that's not something we actually expect coding agents to do in the wild. Just using the polyfill is good enough.
> 
> Evals are passing at 100%
> 
> (BTW unguided evals also 100%, which suggests that maybe agents already have a good enough handle on invoker commands to not need our guidance. We can decide what to do about that later.)

### Comments

#### **rviscomi** on `guides/user-experience/declarative-button-actions/demo.html`
> Since the feature is not yet widely available, the demo should also show the fallback strategy for unsupported browsers

#### **rviscomi** on `guides/user-experience/declarative-button-actions/expectations.md`
> Add any expectations to make sure that the fallbacks are implemented correctly

#### **rviscomi** on `guides/user-experience/declarative-button-actions/grader.ts`
> Update to align with expectations

---

## PR #460: Add guide for declaritive-dialog-popover-control 

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I committed a change to the prompt to ensure that the agent creates BOTH the dialog and popover elements, as expected by the grader. I've also tidied up the grader so that it doesn't rely on any brittle regexes.
> 
> ```
> Agent test results:
>   Base app (pre):    1/18 checks passed (6%)
>   Unguided:          2/18 checks passed (11%)
>   Guided:            18/18 checks passed (100%)
>   Guide impact:      +89% (vs unguided)
> ```

---

## PR #451: Guides and evals for `customizable-select` use cases

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> - Trimmed the source lists to only the immediately relevant blog post
> - Added `MANDATORY` prefixes to prompts to emphasize the modern parts of the request
> - Added HTML example to the `animated-select-picker` guide
> 
> | Use Case | Guided Pass Rate | Unguided Pass Rate |
> | :--- | :--- | :--- |
> | `animated-select-picker` | 100% (11/11) | 9% (1/11) |
> | `custom-select-picker-layouts` | 89% (8/9) | 11% (1/9) |
> | `rich-media-picker` | 90% (9/10) | 20% (2/10) |
> | `branded-select-styling` | 100% (12/12) | 0% (0/12) |
> 

---

## PR #218: Add guide for Language Detection

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM!
> 
> As a next step, after you've written the guidance, rerun `gd dev` to generate the task.md file and make sure everything is calibrated and passing.

### Comments

#### **rviscomi** on `README.md`
> @tomayac could you move non-guidance changes like this to a separate PR?

#### **rviscomi** on `guides/built-in-ai/language-detection/guide.md`
> ```suggestion
>   - languagedetector
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: language-detection
+description: Detect the language of user-generated content or already present site content.
+web-feature-ids:
+    - LanguageDetector
```

</details>

---

## PR #497: docs: add guides and evals for `light-dismiss-a-dialog`

### Reviews

#### **malchata** (DISMISSED)
*(No review body)*

#### **rviscomi** (APPROVED)
> LGTM with a few changes, also addressing @malchata's feedback
> 
> > Pass Rate - Unguided: 63%, Guided: 100% 🎉 
> 
> I asked Gemini to summarize what I changed:
> 
> ---
> 
> #### 1. **Explicit Class Name Requirement (`tasks/task.md`, `demo.html`, `negative-demo.html`)**
> - **Change**: Replaced the fragile text-based trigger locators with a standardized class requirement (`.test-dialog-trigger`). 
> - **Why**: Avoids brittle regex-based button matching (like checking for `"Open (Wrongly)"` or `"Logout"`). This ensures the grader reliably identifies the trigger across positive demos, negative demos, and live base-app evaluation runs without relying on context-dependent text labels.
> 
> #### 2. **Robust Grader Targeting (`grader.ts`)**
> - **Change**: Updated all Playwright `page.locator` queries for the open button to strictly target `.test-dialog-trigger`.
> - **Why**: Keeps the test suite clean and unified, allowing tests to run deterministically regardless of which app or demo environment is being evaluated.
> 
> #### 3. **Conditional JavaScript Fallback Alignment (`guide.md`, `expectations.md`)**
> - **Change**: Wrapped the fallback click-listener snippet in the guide with a feature-detection check (`if (!('closedBy' in HTMLDialogElement.prototype))`).
> - **Why**: Aligns the documented guide exactly with the positive `demo.html` implementation. This guarantees that modern browsers always rely on the native declarative `closedby` implementation without attaching redundant custom JavaScript listeners.
> 
> #### 4. **Strict Negative Demo Failure Enforcement (`negative-demo.html`)**
> - **Change**: Refactored the negative demo to disable dialog opening via `e.preventDefault()` and completely removed the `.close()` script string signature.
> - **Why**: Ensures that the negative demo accurately fails all 8 evaluation checks (achieving a perfect 0% pass rate), proving that the test harness is robustly calibrated and will never produce false positives.

### Comments

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> ### Styling the Backdrop
> 
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `closedby="any"` to enable light-dismiss declaratively.
+- **MANDATORY**: Always open modal dialogs with `showModal()`. This ensures the dialog is in the top layer, focus is trapped, and the `Esc` key is handled.
+- **DO**: Use `aria-labelledby` or `aria-label` to provide an accessible name for the dialog.
+- **DO NOT**: Use `closedby` for non-modal dialogs (opened with `show()`), as they do not have a backdrop and won't trigger light-dismiss.
+- **DO NOT**: Use the `click` event for critical logic that should happen *before* closing; instead, listen for the `close` or `cancel` events.
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("dialog-closedby") }}
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> More of a nit here than anything, but I think this heading could be removed and be part of the fallback strategies main content, but I don't think it's a dealbreaker.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `closedby="any"` to enable light-dismiss declaratively.
+- **MANDATORY**: Always open modal dialogs with `showModal()`. This ensures the dialog is in the top layer, focus is trapped, and the `Esc` key is handled.
+- **DO**: Use `aria-labelledby` or `aria-label` to provide an accessible name for the dialog.
+- **DO NOT**: Use `closedby` for non-modal dialogs (opened with `show()`), as they do not have a backdrop and won't trigger light-dismiss.
+- **DO NOT**: Use the `click` event for critical logic that should happen *before* closing; instead, listen for the `close` or `cancel` events.
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("dialog-closedby") }}
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> <!-- MANDATORY: Always use showModal(), not show(), to ensure the dialog behaves as a modal with a backdrop -->
> <button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> I think having a comment here would add a bit more clarity :)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> Does this need to be enclosed in any kind of feature checking code? If so, I'd wrap the relevant parts of this in such a check.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `closedby="any"` to enable light-dismiss declaratively.
+- **MANDATORY**: Always open modal dialogs with `showModal()`. This ensures the dialog is in the top layer, focus is trapped, and the `Esc` key is handled.
+- **DO**: Use `aria-labelledby` or `aria-label` to provide an accessible name for the dialog.
+- **DO NOT**: Use `closedby` for non-modal dialogs (opened with `show()`), as they do not have a backdrop and won't trigger light-dismiss.
+- **DO NOT**: Use the `click` event for critical logic that should happen *before* closing; instead, listen for the `close` or `cancel` events.
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("dialog-closedby") }}
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
+
+If you only need light-dismiss for browsers without `closedby` support (like Safari as of early 2026), use the following script:
+
+```javascript
+const dialog = document.querySelector('dialog');
+
+// Fallback for browsers without closedby support
```

</details>

#### **malchata** on `guides/user-experience/light-dismiss-dialog/guide.md`
> In general, I think this snippet would be helped by comments where needed that explains not just what the code does, but why it does it.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,91 @@ name: light-dismiss-a-dialog
 description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
 web-feature-ids:
   - dialog-closedby
----
\ No newline at end of file
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy
+  - https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/
+  - https://html.spec.whatwg.org/multipage/interactive-elements.html#dom-dialog-closedby
+  - https://chromestatus.com/feature/5196420352540672
+  - https://github.com/GoogleChrome/dialog-polyfill
+---
+
+Modern modal dialogs often support "light-dismiss," allowing users to close a dialog by clicking or tapping the backdrop (the area outside the dialog). The `closedby` attribute provides a declarative way to enable this behavior without custom JavaScript.
+
+## Implementation
+
+To enable light-dismiss:
+
+1. Add `closedby="any"` to the `<dialog>` element.
+2. Open the dialog using `dialog.showModal()`.
+
+### Attribute Values
+
+- `any`: Enables light-dismiss (clicking the backdrop), "close requests" (the `Esc` key), and developer mechanisms (e.g., `dialog.close()`).
+- `closerequest`: Enables "close requests" and developer mechanisms only. This is the default for modal dialogs.
+- `none`: Only developer mechanisms can close the dialog.
+
+### Styling the Backdrop
+When a dialog is opened as a modal using `showModal()`, the browser generates a `::backdrop` pseudo-element. This backdrop covers the entire viewport and sits directly behind the dialog.
+
+```css
+/* Style the backdrop to indicate the dialog is modal */
+dialog::backdrop {
+  background-color: rgba(0, 0, 0, 0.5);
+  backdrop-filter: blur(2px); /* Optional: add blur for modern browsers */
+}
+```
+
+## Example
+
+```html
+<!-- MANDATORY: Use closedby="any" to enable light-dismiss behavior -->
+<dialog id="myDialog" closedby="any" aria-labelledby="dialogTitle">
+  <form method="dialog">
+    <h2 id="dialogTitle">Feedback</h2>
+    <p>Click outside this box or press Esc to dismiss.</p>
+    <button type="submit">Close</button>
+  </form>
+</dialog>
+
+<button onclick="document.getElementById('myDialog').showModal()">Open Dialog</button>
+```
+
+## Constraints & Accessibility
+
+- **MANDATORY**: Use `closedby="any"` to enable light-dismiss declaratively.
+- **MANDATORY**: Always open modal dialogs with `showModal()`. This ensures the dialog is in the top layer, focus is trapped, and the `Esc` key is handled.
+- **DO**: Use `aria-labelledby` or `aria-label` to provide an accessible name for the dialog.
+- **DO NOT**: Use `closedby` for non-modal dialogs (opened with `show()`), as they do not have a backdrop and won't trigger light-dismiss.
+- **DO NOT**: Use the `click` event for critical logic that should happen *before* closing; instead, listen for the `close` or `cancel` events.
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("dialog-closedby") }}
+
+For browsers that do not yet support `closedby`, implement light-dismiss by checking if a click occurred outside the dialog content's boundaries.
+
+### Manual Light-Dismiss
+
+If you only need light-dismiss for browsers without `closedby` support (like Safari as of early 2026), use the following script:
+
+```javascript
```

</details>

---

## PR #151: Add guide: `<dialog closedby>`

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/light-dismiss-a-dialog/guide.md`
> ```suggestion
> description: Create a modal dialog that can be closed via light dismiss (i.e. clicking or tapping outside of the dialog)
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dismiss-a-dialog
+description: Allow closing a `<dialog>` element by clicking outside of it with the `closedby="any"` attribute.
```

</details>

#### **philipwalton** on `guides/user-experience/control-dialog-closure/guide.md`
> ```suggestion
> description: Create a modal dialog that can be closed via standard platform-specific user actions, such as pressing the `Esc` key on desktop platforms, or a "back" or "dismiss" gesture on mobile platforms
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: control-dialog-closure
+description: Restrict closure of a `<dialog>` element to be a platform-specific user action or a developer-specified mechanism excluding a light-dismissal by using the `closedby="closerequest"` attribute.
```

</details>

#### **philipwalton** on `guides/user-experience/light-dismiss-dialog/guide.md`
> ```suggestion
> name: light-dismiss-dialog
> ```
> 
> Nit: I'd change this to `light-dismiss-dialog` (remove the "a"), which also means changing the directory name.
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: light-dismiss-a-dialog
```

</details>

#### **philipwalton** on `guides/user-experience/control-dialog-closure/guide.md`
> ```suggestion
> name: platform-controls-dismiss-dialog
> ```
> 
> Change the directory structure as well to match.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: control-dialog-closure
```

</details>

---

## PR #426: Create guides and evals for :has use cases

### Reviews

#### **rviscomi** (APPROVED)
> The guidance looks good, but the evals are the same for both unguided and guided runs. It doesn't seem like the agent used the CLI at all.
> 
> This won't be as much of an issue when we add support for the high-level CSS skills, which include `:has()` so merging this now LGTM and we can fine-tune later as needed.

---

## PR #470: Guide and evals for `calculate-event-differentials` for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a couple of changes
> 
> 1. Adjusted the prompt to remove mention of Temporal. I did have to balance that out by hinting the agent "not assume it knows the most modern approach" which is less than ideal. I think it will become obsolete after we have a skill file to teach agents that Temporal exists.
> 
> 2. I made some changes to the use case description so that it didn't specify two narrow applications, and I also removed all of the redundant non-MDN sources. I also removed the fallback strategies for node and global script, since coding agents should be able to adapt the ESM fallback as needed.
> 
> 
> ```
> Agent test results:
>   Base app (pre):    1/12 checks passed (8%)
>   Unguided:          1/12 checks passed (8%)
>   Guided:            10/12 checks passed (83%)
>   Guide impact:      +75% (vs unguided)
> ```

---

## PR #494: Guide and evals `capture-location-agnostic-data` use case for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a few changes:
> 
> *   **`task.md`**: Merged date and time requests into a **single-line prompt** targeting **`index.html`** (preventing the agent from creating untracked files).
> *   **`grader.ts`**: **Relaxed rigid regex checks** to focus on intent and **removed the broken behavioral test** that looked for non-existent UI elements.
> *   **`expectations.md`**: Removed the legacy `Date` expectation to align with the grader cleanup.
> 
> Unguided: 29%, Guided: 100%

---

## PR #407: Add guide content and expectations for interest-triggered-tooltips

### Reviews

#### **malchata** (COMMENTED)
> Some initial thoughts here.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (CHANGES_REQUESTED)
> Some more comments—since this is my first comprehensive review of a guide, I'd like to get buy-in from @rviscomi or @philipwalton before approving this one to know if I'm on the right track with suggestions. This is shaping up nicely, @jamesnw!

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (APPROVED)
*(No review body)*

#### **malchata** (APPROVED)
> Unless there are strong objections, I think this is fine!

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> The tooltip element must have an `id` attribute with a unique value:
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute, which is a unique idref.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Feel free to push back on this (and really anything), but the latter feels more direct and something developers might say. Anecdote: I have only heard "idref" used in relation to specifications.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute, which is a unique idref.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Same concern here about usage of "idref", which if we wanted to adopt my earlier suggestion, this would need to be reconciled.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute, which is a unique idref.
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute with the value of the idref of the tooltip.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/demo.html`
> `import` without an `await` clause won't pause the execution of the rest of the page.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,9 +3,24 @@
   <head>
     <meta charset="utf-8" />
     <title>Interest-Triggered Tooltips</title>
+    <script type="module">
+      import("https://unpkg.com/interestfor");
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/demo.html`
> Similar concern here re: lack of `await` with `import()`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,9 +3,24 @@
   <head>
     <meta charset="utf-8" />
     <title>Interest-Triggered Tooltips</title>
+    <script type="module">
+      import("https://unpkg.com/interestfor");
+    </script>
+    <script
+      src="https://unpkg.com/@oddbird/popover-polyfill@latest"
+      crossorigin="anonymous"
+      defer
+    ></script>
+    <script type="module">
+      if (!("anchorName" in document.documentElement.style)) {
+        import("https://unpkg.com/@oddbird/css-anchor-positioning");
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> For each feature/fallback, let's clarify the canonical way to feature detect so the polyfill can be loaded conditionally.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
+
+The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 
+
+### Positioning the tooltip
+
+The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.
+
+```css
+[popover]{
+  position-area: block-start;
+  position-try: flip-block;
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> These two anchor positioning fallback options might benefit from code examples

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
+
+The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 
+
+### Positioning the tooltip
+
+The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.
+
+```css
+[popover]{
+  position-area: block-start;
+  position-try: flip-block;
+}
+```
+
+## Fallbacks & Browser Support
+
+{{ BASELINE_STATUS("interest-invokers") }}
+
+Interest invokers must be polyfilled with the `interestfor` polyfill, available at https://github.com/mfreed7/interestfor or on NPM.
+
+{{ BASELINE_STATUS("popover") }}
+{{ BASELINE_STATUS("popover-hint") }}
+
+Popover and popover hint must be polyfilled with the `@oddbird/popover-polyfill` polyfill. The hint behavior will not be polyfilled in browsers that support `popover` but not `popover="hint"`. For those browsers, a tooltip opened via focus may stay open when a second tooltip opened via hover.
+
+{{ BASELINE_STATUS("anchor-positioning") }}
+
+To support browsers without anchor positioning, provide a fallback by putting the popover in the center of the user's screen. Add a `@supports (anchor-name: auto){}` supports block around the anchor positioning rules on the tooltip so browsers with anchor positioning show the tooltip in the desired location.
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/expectations.md`
> ```suggestion
> * Polyfills for interestfor and popover must be conditionally installed.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,10 @@
+* The trigger is a `<button>` or `<a>` element.
+* The trigger has an `interestfor` attribute with the idref of the tooltip.
+* The tooltip has a `popover="hint"` attribute.
+* The tooltip has a unique `id` attribute.
+* The tooltip is a `<div>`.
+* The tooltip is positioned with anchor positioning, with `position-area` and `position-try`.
+* Anchor positioning rules are inside a `@supports` block.
+* Polyfills for interestfor and popover must be installed.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I believe this intersects with my work on #304.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
+
+The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 
+
+### Positioning the tooltip
+
+The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.
+
+```css
+[popover]{
+  position-area: block-start;
+  position-try: flip-block;
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> **MANDATORY:** The tooltip element must have an `id` attribute with a unique value:
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> This feedback is from Gemini CLI using appropriate agent skills, but it does feel a bit out of place for me. Wouldn't mind a gut check here from @rviscomi or @philipwalton.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> <!-- MANDATORY: The tooltip container `<div>` must have a `popover` attribute.
>      the value of `"hint"` ensures it can be "light dismissed". -->
> <div popover="hint" id="tooltip">Tooltip content</div>
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. **MANDATORY:** The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> ```html
> <!-- The `interestfor` attribute can be applied to a `<button>` element: -->
> <button interestfor="tooltip">Tooltip trigger</button>
> 
> <!-- The `interestfor` attribute can also be applied to an `<a>` element: -->
> <a interestfor="tooltip" href="">Tooltip trigger</a>
> ```
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> ```suggestion
> ### Fallback strategies
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
+
+The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 
+
+### Positioning the tooltip
+
+The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.
+
+```css
+[popover]{
+  position-area: block-start;
+  position-try: flip-block;
+}
+```
+
+## Fallbacks & Browser Support
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I have a pending change to the "MANDATORY" thing in the skill file: 
> 
> https://github.com/GoogleChrome/guidance/blob/ff4fff0b31323a2b0fa0912eee9720b55b9d1528/.agents/skills/project-guides/SKILL.md?plain=1#L49-L50
> 
> So it should really only be used where extra emphasis is needed, especially if we see that the coding agent is failing to adhere to a specific bit of guidance.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> A requirement like this should probably be in both places, but I would omit the "MANDATORY:" part

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **malchata** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> I wrestled with this a bit, but the agent skill in Gemini CLI gave this output when I applied it to your guide:
> 
> ```
> 2. Code Snippets (Rule 3)
>    * Missing Comments: The code snippets currently contain zero comments. The guidelines state snippets must be heavily commented.
>    * Directives in Code: You must include directives directly in the code comments (e.g., <!-- MANDATORY: The id must match the interestfor
>      attribute of the trigger -->).
>    * Explain "WHY": The comments must explain why a value or approach is chosen, not just what it does. For example, explain why position-area:
>      block-start is used in the CSS snippet.
> ```
> 
> My sense on this is that guidance _in_ code snippets doesn't feel exactly right, but it doesn't feel exactly wrong. I would defer to @rviscomi or @philipwalton on what they think about this, but I'm not opposed to placing them in code snippets.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
```

</details>

#### **rviscomi** on `guides/user-experience/interest-triggered-tooltips/guide.md`
> Yeah let's just recommend the polyfill approach for a more consistent UI

<details>
<summary>Diff Hunk</summary>

```diff
@@ -11,3 +11,61 @@ sources:
   - https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using_interest_invokers
   - https://css-tricks.com/a-first-look-at-the-interest-invoker-api-for-hover-triggered-popovers/
 ---
+
+# Show a tooltip when hovering
+
+Users expect to see additional related information without completely changing their context. Showing a tooltip when a user is interested in more information can be useful to provide definitions for a term, clarifying the action an icon-only button will take, or provide additional form field guidance.
+
+## Creating the tooltip
+
+You can create a popover with the required behavior by adding the `popover="hint"` attribute to a `<div>` or other semantically appropriate element. When the user opens the tooltip, this hides other `popover="hint"` tooltips, but doesn't hide `auto` or `manual` tooltips. It also handles dismissing nested tooltips.
+
+It also provides light dismiss behavior, so when a user clicks or otherwise focuses outside of the popover, the popover is dismissed.
+
+The tooltip element must have an `id` attribute with a unique value:
+
+```html
+<div popover="hint" id="tooltip">Tooltip content</div>
+```
+
+### Triggering the tooltip
+
+A user expresses interest in the additional information by hovering or focusing on an `<a>` or `<button>` element. The element must have an `interestfor` attribute that matches the `id` attribute of the tooltip.
+
+```html
+<button interestfor="tooltip">Tooltip trigger</button>
+```
+
+```html
+<a interestfor="tooltip" href="">Tooltip trigger</a>
+```
+
+The trigger must have a visual indicator to indicate that there is additional information available by interacting with the trigger. 
+
+### Positioning the tooltip
+
+The tooltip can be positioned using anchor positioning. When the tooltip is opened using `interestfor`, the trigger becomes an implicit anchor for the tooltip, meaning you don't have to add `anchor-name` or `position-anchor` CSS properties. DO use `position-area: block-start` with `position-try: flip-block`, or `position-area: inline-end` with `position-try: flip-inline`.
+
+```css
+[popover]{
+  position-area: block-start;
+  position-try: flip-block;
+}
+```
+
+## Fallbacks & Browser Support
+
+{{ BASELINE_STATUS("interest-invokers") }}
+
+Interest invokers must be polyfilled with the `interestfor` polyfill, available at https://github.com/mfreed7/interestfor or on NPM.
+
+{{ BASELINE_STATUS("popover") }}
+{{ BASELINE_STATUS("popover-hint") }}
+
+Popover and popover hint must be polyfilled with the `@oddbird/popover-polyfill` polyfill. The hint behavior will not be polyfilled in browsers that support `popover` but not `popover="hint"`. For those browsers, a tooltip opened via focus may stay open when a second tooltip opened via hover.
+
+{{ BASELINE_STATUS("anchor-positioning") }}
+
+To support browsers without anchor positioning, provide a fallback by putting the popover in the center of the user's screen. Add a `@supports (anchor-name: auto){}` supports block around the anchor positioning rules on the tooltip so browsers with anchor positioning show the tooltip in the desired location.
```

</details>

---

## PR #456: adjust primary skill.md framing with triggers and examples

### Reviews

#### **rviscomi** (COMMENTED)
> If it works, it works. But do you think it might be a little too finely tuned to today's set of use cases (scrolling, forms, etc) and may not trigger for whatever else we come up with in the future? Or is that a known limitation and the plan is to periodically update it with more keywords?

---

## PR #428: Add guide and evals for field-sizing use case

### Reviews

#### **rviscomi** (APPROVED)
> LGTM with a couple of changes

---

## PR #203: guides: automated grader calibration

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #476: Create guide and and evals for prevent-text-wrapping use case

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I tried this locally but the negative-demo failed one test, so `gd dev` ended up regenerating the grader file. After that though, the calibration passed and the guided run outperformed the unguided run, so this is good to go.

---

## PR #462: Guide and eval for `sequence-distributed-events` use case for temporal

### Reviews

#### **rviscomi** (APPROVED)
> LGTM
> 
> I made a change to the prompt to avoid being overly prescriptive about using Temporal and fallbacks. To get the agent to look for the guide, I added "MANDATORY: The timestamps MUST have nanosecond resolution." which seems to have worked.
> 
> ```
> Agent test results:
>   Base app (pre):    0/7 checks passed (0%)
>   Unguided:          0/7 checks passed (0%)
>   Guided:            6/7 checks passed (86%)
>   Guide impact:      +86% (vs unguided)
> ```

---

## PR #97: User validation guides

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/password-complexity-validation/guide.md`
> I wonder if it makes sense to broaden this, and not limit it to just password fields? I agree that passwords is likely the most common occurance of this, but I think we'd want this guidance to also match other form-field use cases like email, phone number, etc.
> 
> @rviscomi WDYT?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

#### **philipwalton** on `guides/user-experience/prevent-validation-styling-on-draft-save/guide.md`
> TIL about `formnovalidate`! But I still don't understand how this would work...
> 
> Something like `:has([formnovalidate]) :user-invalid {...}` would match if the form contained a draft submit button, not just if the user pressed that.
> 
> Or were you imagining something else?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prevent-validation-styling-on-draft-save
+description: Use :user-invalid with :has() to conditionally style invalid fields, ensuring validation errors don't appear when a user opts to save a draft using formnovalidate.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> ```suggestion
> description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
> ```
> 
> Nit: I think "required" might be more likely to match a semantic search since there's a `required` attribute in HTML.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: required-field-feedback
+description: Highlighting mandatory fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> Great use case. Also a good use case for `:has()`, so we should confirm that @pattishin (who is signed up for `:has()`) is not also writing this guide.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
```

</details>

#### **philipwalton** on `guides/user-experience/validate-email-after-interaction/guide.md`
> Same comment as above. I think it might make sense to combine this with the password one? WDYT?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: validate-email-after-interaction
+description: Validation feedback for email inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load.
```

</details>

#### **rviscomi** on `guides/user-experience/password-complexity-validation/guide.md`
> Yeah, generalizing this to other form fields makes sense. It's hard to imagine substantive differences between the guides, but I'm interested to hear if there are any.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

#### **philipwalton** on `guides/user-experience/prevent-validation-styling-on-draft-save/guide.md`
> Have you tried that? I'm asking because I don't think it works. I think what will happen is you'll get the error message as soon as the user blurs the field, but then that error message will go away when you click the "Save draft" button — and I'm not sure that's actually a better experience.
> 
> Or are you thinking you'd always suppress errors if there's a "Save draft" button and then only show them once the "Submit" button matches `:active`?
> 
> Anyway, I guess TL;DR is it'd be good to see a demo of how you're expecting this to work.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: prevent-validation-styling-on-draft-save
+description: Use :user-invalid with :has() to conditionally style invalid fields, ensuring validation errors don't appear when a user opts to save a draft using formnovalidate.
```

</details>

#### **philipwalton** on `guides/user-experience/password-complexity-validation/guide.md`
> I think we should consolidate for now, but make sure all of the sub-use-cases are enumerated in the description. We can always add more use case guides later if we determine that the tool isn't properly matching in real world usage.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: password-complexity-validation
+description: Providing feedback on password pattern requirements only after the user has interacted with the field, preventing intimidating error states during initial entry.
```

</details>

---

## PR #467: 364 Create guide and evals for the dynamic sibling styling use case

### Reviews

#### **rviscomi** (COMMENTED)
> I agree this probably fits better as a single use case.

#### **rviscomi** (APPROVED)
> Applied all of my suggested changes and fine-tuned the evals:
> 
> ```
> Agent test results:
>   Base app (pre):    0/6 checks passed (0%)
>   Unguided:          2/6 checks passed (33%)
>   Guided:            6/6 checks passed (100%)
>   Guide impact:      +67% (vs unguided)
> ```

### Comments

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> Suggest rephrasing to focus more on the use case
> ```suggestion
> description: Create dynamic visual spectrums or layout arrangements that automatically adapt to the number of elements in a group.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,6 @@
 ---
 name: dynamic-sibling-styling
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> `sin()` and `cos()` are mentioned and recently widely available, so would be good to include
> ```suggestion
>   - sibling-count
>   - trig-functions
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,6 @@
 ---
 name: dynamic-sibling-styling
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
 web-feature-ids:
   - sibling-count
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/prompts.md`
> These prompts are phrased in a way that assumes that certain elements in the base app exist, but the `daily-grind` app doesn't have swatches or circular buttons, so the agent would probably struggle and fail the evals.
> 
> If you remove this file and rerun `gd dev` it should automatically generate the file with prompts that fit the base app. Alternatively, you could set the base app to `empty-app` and change the prompt so that the agent is starting from nothing, eg "In index.html, create a minimal CSS demo having 3 swatches with..."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,3 @@
+- Can you style these swatches so each one has a unique hue based on its position in the list? Use the modern CSS sibling-index() and sibling-count() functions and provide a JS fallback for older browsers.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> Nesting isn't widely available yet, so let's flatten this part

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,98 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Styling siblings based on count and index
+
+Historically, applying unique styles to each sibling in a list required complex `:nth-child` loops or JavaScript to inject inline styles. Modern CSS provides `sibling-index()` and `sibling-count()` to perform these calculations directly in your stylesheet, enabling dynamic layouts and color systems that automatically adapt as elements are added or removed.
+
+## Dynamic color systems
+
+You can create a color spectrum across a group of siblings by calculating a unique hue or lightness value for each child. This ensures a consistent gradient effect regardless of the number of items.
+
+```css
+.swatch {
+  /* Calculate hue by dividing the full 360deg circle by total siblings */
+  /* and multiplying by the current element's 1-based index */
+  background-color: hsl(
+    calc(360deg / sibling-count() * sibling-index()),
+    70%,
+    50%
+  );
+}
+```
+
+## Symmetrical layout and fan effects
+
+To create symmetrical effects (like a "fan" or centering items), use the total count to find the midpoint of the list.
+
+```css
+.card {
+  /* Find the center index (e.g., 3 if there are 5 siblings) */
+  --center: calc((sibling-count() + 1) / 2);
+
+  /* Rotate items away from the center: negative for left, positive for right */
+  /* center element gets 0deg rotation */
+  transform: rotate(calc(10deg * (sibling-index() - var(--center))));
+}
+```
+
+## Circular and complex positioning
+
+By combining these functions with CSS trigonometry (`sin()`, `cos()`), you can place elements in a perfect circle without any manual coordinates.
+
+```css
+.orb {
+  /* Calculate the angle for this item's position on a 360deg circle */
+  --angle: calc(360deg / sibling-count() * sibling-index());
+  --radius: 150px;
+
+  /* Set the pre-transformed position for all items to be centered */
+  position: absolute;
+  place-self: center;
+
+
+  /* Position each element around the parent center */
+  transform: translate(
+    calc(cos(var(--angle)) * var(--radius)),
+    calc(sin(var(--angle)) * var(--radius))
+  );
+}
+```
+
+### Fallback strategies
+
+{{ BASELINE_STATUS("sibling-count") }}
+
+If `sibling-index()` and `sibling-count()` are not supported, provide a fallback by injecting CSS custom properties via JavaScript. **MANDATORY:** Use feature detection with `CSS.supports()` to ensure the script only runs when necessary.
+
+```js
+/* MANDATORY: Check for native support before applying fallback */
+if (!CSS.supports('top: calc(sibling-index() * 1px)')) {
+  const items = document.querySelectorAll('.item');
+  items.forEach((item, index) => {
+    /* MANDATORY: Injected index must be 1-based to match native function */
+    item.style.setProperty('--sibling-index', index + 1);
+    item.style.setProperty('--sibling-count', items.length);
+  });
+}
+```
+
+In your CSS, use these variables as a base and override them with native functions inside an `@supports` block. **MANDATORY:** You MUST wrap the native function overrides in `@supports` to ensure the variables remain valid in older browsers.
+
+```css
+.item {
+  /* 1. Set base values using variables (from JS fallback) */
+  --index: var(--sibling-index);
+  --count: var(--sibling-count);
+
+  /* 2. Override with native functions ONLY if supported */
+  @supports (top: calc(sibling-index() * 1px)) {
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> To clarify that `background-color` itself isn't necessarily part of the fallback strategy
> ```suggestion
>   /* 3. Use the computed variables - replace this with your implementation-specific styles */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,98 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Styling siblings based on count and index
+
+Historically, applying unique styles to each sibling in a list required complex `:nth-child` loops or JavaScript to inject inline styles. Modern CSS provides `sibling-index()` and `sibling-count()` to perform these calculations directly in your stylesheet, enabling dynamic layouts and color systems that automatically adapt as elements are added or removed.
+
+## Dynamic color systems
+
+You can create a color spectrum across a group of siblings by calculating a unique hue or lightness value for each child. This ensures a consistent gradient effect regardless of the number of items.
+
+```css
+.swatch {
+  /* Calculate hue by dividing the full 360deg circle by total siblings */
+  /* and multiplying by the current element's 1-based index */
+  background-color: hsl(
+    calc(360deg / sibling-count() * sibling-index()),
+    70%,
+    50%
+  );
+}
+```
+
+## Symmetrical layout and fan effects
+
+To create symmetrical effects (like a "fan" or centering items), use the total count to find the midpoint of the list.
+
+```css
+.card {
+  /* Find the center index (e.g., 3 if there are 5 siblings) */
+  --center: calc((sibling-count() + 1) / 2);
+
+  /* Rotate items away from the center: negative for left, positive for right */
+  /* center element gets 0deg rotation */
+  transform: rotate(calc(10deg * (sibling-index() - var(--center))));
+}
+```
+
+## Circular and complex positioning
+
+By combining these functions with CSS trigonometry (`sin()`, `cos()`), you can place elements in a perfect circle without any manual coordinates.
+
+```css
+.orb {
+  /* Calculate the angle for this item's position on a 360deg circle */
+  --angle: calc(360deg / sibling-count() * sibling-index());
+  --radius: 150px;
+
+  /* Set the pre-transformed position for all items to be centered */
+  position: absolute;
+  place-self: center;
+
+
+  /* Position each element around the parent center */
+  transform: translate(
+    calc(cos(var(--angle)) * var(--radius)),
+    calc(sin(var(--angle)) * var(--radius))
+  );
+}
+```
+
+### Fallback strategies
+
+{{ BASELINE_STATUS("sibling-count") }}
+
+If `sibling-index()` and `sibling-count()` are not supported, provide a fallback by injecting CSS custom properties via JavaScript. **MANDATORY:** Use feature detection with `CSS.supports()` to ensure the script only runs when necessary.
+
+```js
+/* MANDATORY: Check for native support before applying fallback */
+if (!CSS.supports('top: calc(sibling-index() * 1px)')) {
+  const items = document.querySelectorAll('.item');
+  items.forEach((item, index) => {
+    /* MANDATORY: Injected index must be 1-based to match native function */
+    item.style.setProperty('--sibling-index', index + 1);
+    item.style.setProperty('--sibling-count', items.length);
+  });
+}
+```
+
+In your CSS, use these variables as a base and override them with native functions inside an `@supports` block. **MANDATORY:** You MUST wrap the native function overrides in `@supports` to ensure the variables remain valid in older browsers.
+
+```css
+.item {
+  /* 1. Set base values using variables (from JS fallback) */
+  --index: var(--sibling-index);
+  --count: var(--sibling-count);
+
+  /* 2. Override with native functions ONLY if supported */
+  @supports (top: calc(sibling-index() * 1px)) {
+    --index: sibling-index();
+    --count: sibling-count();
+  }
+
+  /* 3. Use the computed variables */
```

</details>

---

## PR #202: Fetch priority guides, expectations, prompts

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **malchata** (COMMENTED)
> Some nits and observations.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/deprioritize-background-fetches/guide.md`
> Good catch, yeah I meant to say "not Baseline Widely available"
> 
> Once https://github.com/GoogleChrome/guidance/pull/185 is merged this will be replaced with the macro which will keep the Baseline status in sync with web-features

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,3 +7,46 @@ web-feature-ids:
 sources:
   - https://web.dev/articles/fetch-priority
 ---
+
+# Deprioritize background fetches
+
+When a page performs multiple simultaneous network requests, they often compete for the same bandwidth. Non-critical data such as analytics, logging, or background synchronization should be deprioritized so that user-initiated or critical data fetches can complete more quickly.
+
+## How to implement
+
+1. **Identify background requests**: Determine which `fetch()` calls are for non-essential data that doesn't impact the immediate user experience.
+2. **Apply fetch priority**: Add the `priority: 'low'` option to the `fetch()` initialization object.
+
+## Example code
+
+```javascript
+// Use high priority (default) for critical UI updates
+const criticalData = await fetch('/api/data');
+
+// Explicitly deprioritize background analytics
+fetch('/api/analytics', {
+  method: 'POST',
+  body: JSON.stringify(eventData),
+  // Lower the priority to prevent network contention
+  priority: 'low'
+});
+```
+
+## Best practices
+
+- **DO** use `priority: 'low'` for analytics, beacons, or telemetry data that isn't required for the current view.
+- **DO** use `priority: 'low'` for "pre-fetching" data that the user *might* need later, ensuring it doesn't slow down what they need *now*.
+- **DO NOT** use `priority: 'low'` for fetches that are critical to the user experience.
+- **DO NOT** use the deprecated `importance` key in the fetch options object. The correct key is `priority`.
+
+## Fallback strategy
+
+### Fetch API
+
+The Fetch API is Baseline Widely Available. No fallback is required.
+
+### Fetch Priority
+
+The Fetch Priority API is not Baseline.
+
```

</details>

#### **rviscomi** on `guides/performance/optimize-image-priority/guide.md`
> I don't think we need to do that much more convincing. If the agent is reading this, it's already committed to following the guide. 
> 
> Was there anything problematic in the original text?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,66 @@ sources:
   - https://web.dev/articles/top-cwv
   - https://web.dev/learn/images/performance-issues
 ---
+
+# Optimize image priority
+
+Browsers use heuristics to assign loading priorities to images, but these defaults may not always align with your page's Largest Contentful Paint (LCP). Using `fetchpriority` on an `<img>` element allows you to explicitly signal an image's importance to the browser, ensuring critical images load faster while non-essential ones don't compete for bandwidth.
```

</details>

---

## PR #110: Add speculation rules guide

### Reviews

#### **rviscomi** (COMMENTED)
> Could you also add a [prompt setup file](https://chat.google.com/room/AAQAPIjpZaI/ckbpdJ_5tVM/ckbpdJ_5tVM?cls=10)? That would give the agent a specific problem to solve, and then the expectations file could be more specific about the expected outcomes, eg prefetch a document rule at moderate eagerness, but in a way that doesn't also prefetch the logout page.

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/expectations.md`
> The expectations and evals should be as objective and deterministic as possible. Could you try to quantify how many is "too many" links to fail the eval?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,25 @@
+# Expectations: `speculation-rules`
+
+- The rule is included in a `<script type="speculationrules"></script>` unless referenced from an `Speculation-Rules` HTTP header.
+- The rule is valid JSON.
+- The rule contains one or more of the following top-level keys:
+  - `"prefetch"`
+  - `"prerender"`
+  - `"prerender_until_script"`
+  - `"tag"`
+- The rule contains either `urls` or `where` property,
+- The `urls` property is an array of URL strings.
+- The `where` property is a JSON object that contains one or more of the following keys:
+  - `"href_matches"`
+  - `"selector_matches"`
+  - `"not"`
+  - `"and"`
+  - `"or"`
+- The optional `eagerness` property is one of the following:
+  - `"immediate"`
+  - `"eager"`
+  - `"moderate"`
+  - `"conservative"`
+- If using `immediate` for `urls` property then the `urls` property should contain a maximum of 10 urls, and ideally fewer.
+- If using `immediate` for `where` property then the rule should be very specific and not match too many links.
```

</details>

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> The guidance says that a fallback strategy isn't needed, but one is provided anyway. Could you clarify when an agent would be expected to use the library?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,127 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later if appropriate.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+### Example of a simple URL list rule of specific for prefetching
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule of specific for prerendering all links
+
+```html
+<script type="speculationrules">
+  {
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule of specific for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when the user hovers over them for a short period of time.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [
+      {
+        "where": { "href_matches": "/*" },
+        "eagerness": "eager"
+      }
+    ],
+    "prerender": [
+      {
+        "where": { "href_matches": "/*" },
+        "eagerness": "moderate"
+      }
+    ]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
+- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
+- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
+
+Speculative loading can be seen as a progressive enhancement, where the browser will use the speculation rules if supported, and will ignore them if not supported. This means that you do not need to provide a fallback strategy, as the browser will handle it for you.
+
+### Speculation rules polyfill
+
+A polyfill for speculation does not exist but libraries like [Quicklink](https://github.com/GoogleChrome/quicklink) provide similar functionality for prefetching with cross-browser support.
```

</details>

#### **rviscomi** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> It might not be clear to agents when prerendering becomes appropriate. Is there any more guidance we can give to help it make that decision?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,127 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later if appropriate.
```

</details>

#### **rviscomi** on `guides/performance/improve-next-page-load-performance/expectations.md`
> TIL! Should this be in the guidance? How and why to set a tag.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,25 @@
+# Expectations: `speculation-rules`
+
+- The rule is included in a `<script type="speculationrules"></script>` unless referenced from an `Speculation-Rules` HTTP header.
+- The rule is valid JSON.
+- The rule contains one or more of the following top-level keys:
+  - `"prefetch"`
+  - `"prerender"`
+  - `"prerender_until_script"`
+  - `"tag"`
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerendered.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> A `tag` can also be used, either at a global level or on a per-rule basis. When set, this tag will be included in the `Sec-Speculation-Tags` header, and allows you to identify server-side which speculations were made.
> ```
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> Of specific URLs? The phrase "of specific..." is used here and in the next few examples, and it seems like a word may be missing from the heading?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> This API has been around a while, so I think LLMs may be aware of the tradeoffs, but is it worth listing them here just in case?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "product-page-speculations",
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule of specific for prerendering all links
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "all-links-speculations",
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule of specific for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "speculations-with-exclusions",
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when the user hovers over them for a short period of time.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [{
+      "tag": "prefetch-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "eager"
+    }],
+    "prerender": [{
+      "tag": "prerender-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "moderate"
+    }]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> In other guides we've tried to avoid listing the specific browsers that do/don't support a feature, and instead just say something like "...not currently supported in all modern browsers (Baseline limited availability)", as that is easier to keep up-to-date.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "product-page-speculations",
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule of specific for prerendering all links
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "all-links-speculations",
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule of specific for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "speculations-with-exclusions",
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when the user hovers over them for a short period of time.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [{
+      "tag": "prefetch-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "eager"
+    }],
+    "prerender": [{
+      "tag": "prerender-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "moderate"
+    }]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
+- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
+- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> I would make a stronger recommendation here, and clearly state that lack of browser support is not a good reason not to use this feature. Maybe something like:
> 
> "However, even though Speculation Rules is not supported in some browsers, it is perfectly safe to use an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore the instructions."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "product-page-speculations",
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule of specific for prerendering all links
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "all-links-speculations",
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule of specific for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "speculations-with-exclusions",
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when the user hovers over them for a short period of time.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [{
+      "tag": "prefetch-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "eager"
+    }],
+    "prerender": [{
+      "tag": "prerender-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "moderate"
+    }]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
+- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
+- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
+
+Speculative loading can be seen as a progressive enhancement, where the browser will use the speculation rules if supported, and will ignore them if not supported. This means that you do not need to provide a fallback strategy, as the browser will handle it for you.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> TBH, I think I would omit this, given that it doesn't support the Speculation Rules format and there is no performance degradation in browsers that don't support the API. 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerender.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. This allows identification of which speuclations (and which rules) server-side and is a best practice.
+
+### Example of a simple URL list rule of specific for prefetching
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "product-page-speculations",
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule of specific for prerendering all links
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "all-links-speculations",
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule of specific for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "speculations-with-exclusions",
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when the user hovers over them for a short period of time.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [{
+      "tag": "prefetch-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "eager"
+    }],
+    "prerender": [{
+      "tag": "prerender-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "moderate"
+    }]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. Ask the developer for their preference if unsure.
+- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
+- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
+- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, browser support is limited, primarily to Chromium-based browsers, though an implementation exists in Safari for prefetch and is expected to be available soon.
+
+Speculative loading can be seen as a progressive enhancement, where the browser will use the speculation rules if supported, and will ignore them if not supported. This means that you do not need to provide a fallback strategy, as the browser will handle it for you.
+
+If you wish to also support other browsers, libraries like [Quicklink](https://github.com/GoogleChrome/quicklink) provide similar functionality for prefetching with cross-browser support, though do not support the speculation rules syntax, nor prerendering.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> description: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next.
> ```
> We've been trying to avoid mentioning the solution in the use case description

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> name: improve-next-page-load-performance
> ```
> ...or something like this that does't include the feature name. And then update the directory name to match.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> # Improve next page load performance
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
```

</details>

#### **philipwalton** on `guides/performance/improve-loading-speed-of-links-with-speculation-rules/guide.md`
> ```suggestion
> One of the most effective ways to improve page load performance for users navigating a site is to initiate loading the next page they're about to visit *before* they visit it. This can be done through a technique called speculative loading using the Speculation Rules API.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,128 @@
+---
+name: improve-loading-speed-of-links-with-speculation-rules
+description: Use speculation rules to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve loading speed of links with speculation rules
+
+Speculative loading is a technique that allows you to prefetch and prerender pages that the user is likely to visit next, improving page load performance.
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/prompts.md`
> I'll be curious to see if this prompt matches the guide above...

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+# Prompts: `improve-loading-speed-of-links-with-speculation-rules`
+
+- Improve the speed of my website
```

</details>

#### **philipwalton** on `guides/performance/improve-next-page-load-performance/guide.md`
> ```suggestion
> However, speculative loading is a progressive enhancement. It is perfectly safe to use as an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore them.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,126 @@
+---
+name: improve-next-page-load-performance
+description: Improve page load performance by prefetching or prerendering pages that the user is likely to visit next.
+web-feature-ids:
+  - speculation-rules
+---
+
+# Improve next page load performance
+
+One of the most effective ways to improve page load performance for users navigating a site is to initiate loading the next page they're about to visit *before* they visit it. This can be done through a technique called speculative loading using the Speculation Rules API.
+
+## How it works
+
+Speculative loading works by using JSON-based speculation rules to tell the browser about links that can be prefetched or prerendered improving page load performance when user clicks on them.
+
+The rules can either be a hardcoded list of URLs a `urls` key (known as a list rule), or with a `where` key containing a set of href and CSS selectors used to find links on the page (known as a `document` rule).
+
+Rules can also include an optional `eagerness` property that specifies when the page should be prefetched or prerendered. The `eagerness` property can be set to `immediate`, `eager`, `moderate`, or `conservative`. `immediate` speculates as soon as possible, while the others wait for user signals such as hovering for a short period, for a longer period, or starting to click on the page respectively.
+
+Rules can be combined with different eagerness settings to prefetch eagerly and then prerender when the user interacts more.
+
+## When to use it
+
+Speculative loading is especially useful for static pages, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge. It can also be used for dynamic pages, but it is important to be careful about the potential for stale content.
+
+Speculative loading is typically used for same-origin links, though more advanced options allow for some cross-origin speculation. This guide concentrates on the more-common same-origin use case.
+
+More eager speculative loading is a good choice for pages that are likely to be visited next, such as a headline article or the next page in a stepped process like a learning a course.
+
+Less eager speculative loading is a good choice when it is less obvious what the user will do next, when there are many links on the page, each equally likely to be visited. By waiting for more signals, such as hovering, or starting to click on the page, you can get a head-start on the next page and improve the user experience, even if it is not fully prefetched or prerendered.
+
+Similarly, prefetch is a more conservative choice than prerender, using less resources (on both the client and the server side) but providing less benefit to the user. It is a good choice for initial implementation, expanding to prerender later when the developer explicitly requests it.
+
+## How to use it
+
+Speculation rules have a JSON-based format and can be included in a `<script type="speculationrules">` tag. The rules can be included in the `<head>` or `<body>` of the document, or can be dynamically added using JavaScript.
+
+A `tag` can also be used, either at a global level or on a per-rule basis. When set, this tag will be included in the `Sec-Speculation-Tags` header, and allows you to identify server-side which speculations were made.
+
+### Example of a simple URL list rule for prefetching predefined URLs
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "product-page-speculations",
+    "prefetch": [
+      {
+        "urls": ["/product/1", "/product/2", "/product/3"]
+      }
+    ]
+  }
+</script>
+```
+
+### Example of a simple document rule for prerendering all same-origin links on a page
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "all-links-speculations",
+    "prerender": [{
+      "where": { "href_matches": "/*" }
+    }]
+  }
+</script>
+```
+
+### Example of a complex document rule for prerendering links with exclusions for interactive sites
+
+```html
+<script type="speculationrules">
+  {
+    "tag": "speculations-with-exclusions",
+    "prerender": [{
+      "where": {
+        "and": [
+          { "href_matches": "/*" },
+          { "not": {"href_matches": "/wp-admin"}},
+          { "not": {"href_matches": "/*\\?*(^|&)add-to-cart=*"}},
+          { "not": {"selector_matches": ".do-not-prerender"}},
+          { "not": {"selector_matches": "[rel~=nofollow]"}}
+        ]
+      }
+    }]
+  }
+</script>
+```
+
+### Example of a mixed rule set
+
+This example shows a rule set that prefetches all links eagerly, and then goes further than this to prerender those same links when it gets more signals with `moderate` eagerness.
+
+```html
+<script type="speculationrules">
+  {
+    "prefetch": [{
+      "tag": "prefetch-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "eager"
+    }],
+    "prerender": [{
+      "tag": "prerender-speculations",
+      "where": { "href_matches": "/*" },
+      "eagerness": "moderate"
+    }]
+  }
+</script>
+```
+
+## Best Practices
+
+- **DO** use speculation rules to prefetch and prerender pages that the user is likely to visit next.
+- **DO** use speculation rules for static sites, where the content is not likely to change often, and where pages are cheaper to produce—especially if cached at the edge.
+- **DO** take more care when using speculation rules for dynamic pages, where the content is more likely to change often, may become out of date, and where pages are more expensive to produce.
+- **DO** prefer document rules over list rules, as they are more flexible, allow the same rule to be shared across multiple pages, and can be used to prefetch and prerender pages that are not known in advance.
+- **DO** consider the trade-offs between prefetch and prerender, and choose the appropriate one for your use case. Prerender is more expensive than prefetch and can cause more unintended side effects in complex applications that display dynamic state, but provides a better user experience. Ask the developer for their preference if unsure.
+- **DO** consider the trade-offs between the different `eagerness` levels, and choose the appropriate one for your use case. More eager speculation provides a better user experience but uses more resources and can cause more unintended side effects in complex applications that display dynamic state. Ask the developer for their preference if unsure.
+- **DO NOT** overuse speculation rules, for example, to speculate every link on the page. Browsers have limits (2 speculations for non-eager speculations). `immediate` should only be used for a very small number of links.
+- **DO NOT** speculate URLs that likely trigger state changes, like `/logout` or `/add-to-cart`, and explicitly exclude them from your speculation rules if they are likely to be included in document rules.
+- **DO NOT** use speculation rules on Single Page Applications (SPAs). Speculation rules are designed for multi-page applications (MPAs) where the browser navigates to a new document on each navigation. In SPAs, the browser does not navigate to a new document on each navigation, so speculation rules will not work as expected.
+
+## Browser support and fallback strategies
+
+Speculative loading is a new feature, and as such, is not supported in all modern browsers (Baseline limited availability).
+
+However, speculative loading is a progressive enhancement. It is perfectly safe to use an enhancement, and is highly recommended given the potential performance benefits. If a browser does not support speculation rules, it will simply ignore them.
```

</details>

---

## PR #415: Add guide content and expectations for transition-between-target-element-positions

### Reviews

#### **rviscomi** (CHANGES_REQUESTED)
> Could you also run `gd dev` to generate the prompts and grader?

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
>     border-bottom: .25lh red solid;
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,85 @@ name: transition-between-target-element-positions
 description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
 web-feature-ids:
   - anchor-positioning
+sources:
+  - https://una.im/follow-the-anchor
+  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
 ---
+
+In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.
+
+You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.
+
+DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.
+
+```css
+ul::before {
+  content: '';
+}
+```
+
+Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.
+
+```css
+li.active{
+  /* Make a unique anchor-name for the active element. */
+  anchor-name: --active;
+}
+```
+
+Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.
+
+```css
+ul::before{
+  /* Tether the underline to the active element. */
+  position: absolute;
+  position-anchor: --active;
+}
+```
+
+Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.
+
+```css
+ul::before{
+  /* Use calc() to offset the top slightly */
+  inset-block-start: calc(anchor(end) + .1lh);
+  inset-inline-start: anchor(start);
+  inset-inline-end: anchor(end);
+}
+```
+
+Add a height and other visual styles.
+
+```css
+ul::before{
+  block-size: .25lh;
+  background: red;
+}
+```
+
+Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.
+
+```css
+/*  */
+ul::before{
+  @media (prefers-reduced-motion: no-preference){
+    transition: inset .2s;
+  }
+}
+```
+
+This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.
+
+## Fallbacks
+
+{{ BASELINE_STATUS("anchor-positioning")}}
+
+If anchor positioning is not supported in the browser, use a `border-bottom` to add an underline. It will not be animated.
+
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
+    border-bottom: .25h red solid;
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
> ## Fallback strategies
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,85 @@ name: transition-between-target-element-positions
 description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
 web-feature-ids:
   - anchor-positioning
+sources:
+  - https://una.im/follow-the-anchor
+  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
 ---
+
+In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.
+
+You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.
+
+DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.
+
+```css
+ul::before {
+  content: '';
+}
+```
+
+Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.
+
+```css
+li.active{
+  /* Make a unique anchor-name for the active element. */
+  anchor-name: --active;
+}
+```
+
+Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.
+
+```css
+ul::before{
+  /* Tether the underline to the active element. */
+  position: absolute;
+  position-anchor: --active;
+}
+```
+
+Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.
+
+```css
+ul::before{
+  /* Use calc() to offset the top slightly */
+  inset-block-start: calc(anchor(end) + .1lh);
+  inset-inline-start: anchor(start);
+  inset-inline-end: anchor(end);
+}
+```
+
+Add a height and other visual styles.
+
+```css
+ul::before{
+  block-size: .25lh;
+  background: red;
+}
+```
+
+Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.
+
+```css
+/*  */
+ul::before{
+  @media (prefers-reduced-motion: no-preference){
+    transition: inset .2s;
+  }
+}
+```
+
+This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.
+
+## Fallbacks
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> ```suggestion
> ul::before{
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,85 @@ name: transition-between-target-element-positions
 description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
 web-feature-ids:
   - anchor-positioning
+sources:
+  - https://una.im/follow-the-anchor
+  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
 ---
+
+In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.
+
+You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.
+
+DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.
+
+```css
+ul::before {
+  content: '';
+}
+```
+
+Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.
+
+```css
+li.active{
+  /* Make a unique anchor-name for the active element. */
+  anchor-name: --active;
+}
+```
+
+Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.
+
+```css
+ul::before{
+  /* Tether the underline to the active element. */
+  position: absolute;
+  position-anchor: --active;
+}
+```
+
+Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.
+
+```css
+ul::before{
+  /* Use calc() to offset the top slightly */
+  inset-block-start: calc(anchor(end) + .1lh);
+  inset-inline-start: anchor(start);
+  inset-inline-end: anchor(end);
+}
+```
+
+Add a height and other visual styles.
+
+```css
+ul::before{
+  block-size: .25lh;
+  background: red;
+}
+```
+
+Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.
+
+```css
+/*  */
+ul::before{
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/expectations.md`
> ```suggestion
> * When `prefers-reduced-motion: reduce` is enabled, there is no animation.
> * When `prefers-reduced-motion: no-preference` is enabled, the underline animates.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+* There is an underline element visible under the active tab item.
+* The underline element is the width of the active tab item.
+* The underline element's inline start edge is aligned to the active tab item's inline start edge.
+* The underline element's inline end edge is aligned to the active tab item's inline end edge.
+* The underline element's block start edge is positioned below the block end edge of the active tab item.
+* Changing the active page moves the underline element to be positioned underneath the new active tab item.
+* When `prefers-reduced-motion: reduced-motion` is enabled, there is no animation.
+* When `prefers-reduced-motion: reduced-motion` is enabled, the underline animates.
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> So the coding agent doesn't think `red` is mandatory
> 
> ```suggestion
>   @supports not (position-anchor: auto){
>     /* Choose a color appropriate to the app theme. */
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,85 @@ name: transition-between-target-element-positions
 description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
 web-feature-ids:
   - anchor-positioning
+sources:
+  - https://una.im/follow-the-anchor
+  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
 ---
+
+In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.
+
+You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.
+
+DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.
+
+```css
+ul::before {
+  content: '';
+}
+```
+
+Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.
+
+```css
+li.active{
+  /* Make a unique anchor-name for the active element. */
+  anchor-name: --active;
+}
+```
+
+Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.
+
+```css
+ul::before{
+  /* Tether the underline to the active element. */
+  position: absolute;
+  position-anchor: --active;
+}
+```
+
+Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.
+
+```css
+ul::before{
+  /* Use calc() to offset the top slightly */
+  inset-block-start: calc(anchor(end) + .1lh);
+  inset-inline-start: anchor(start);
+  inset-inline-end: anchor(end);
+}
+```
+
+Add a height and other visual styles.
+
+```css
+ul::before{
+  block-size: .25lh;
+  background: red;
+}
+```
+
+Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.
+
+```css
+/*  */
+ul::before{
+  @media (prefers-reduced-motion: no-preference){
+    transition: inset .2s;
+  }
+}
+```
+
+This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.
+
+## Fallbacks
+
+{{ BASELINE_STATUS("anchor-positioning")}}
+
+If anchor positioning is not supported in the browser, use a `border-bottom` to add an underline. It will not be animated.
+
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
```

</details>

#### **rviscomi** on `guides/user-experience/transition-between-target-element-positions/guide.md`
> Yeah, that'd help

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,85 @@ name: transition-between-target-element-positions
 description: Transition an element seamlessly between two target element positions. For example, moving a selected tab underline between the previously selected tab and the currently selected tab.
 web-feature-ids:
   - anchor-positioning
+sources:
+  - https://una.im/follow-the-anchor
+  - https://css-tricks.com/fancy-menu-navigation-using-anchor-positioning/
 ---
+
+In a tab menu, you should provide visual hints to users to about what page they are on. One option is by underlining the tab. With anchor positioning, you can create a smooth animation between the positions of the underline. This does not work when changing the active tab loads a new web page.
+
+You can also use this effect to add an animated dot to indicate the active tab in a vertical tab bar.
+
+DO create the underline using a `::before` pseudo-element on the `<ul>` that contains the `<li>` elements.
+
+```css
+ul::before {
+  content: '';
+}
+```
+
+Make the active list item an anchor by adding the `anchor-name` property, which has a value that starts with `--`.
+
+```css
+li.active{
+  /* Make a unique anchor-name for the active element. */
+  anchor-name: --active;
+}
+```
+
+Tether the underline to the active item anchor with a `position-anchor` that matches the `anchor-name` on the anchor, and making it `position: absolute`.
+
+```css
+ul::before{
+  /* Tether the underline to the active element. */
+  position: absolute;
+  position-anchor: --active;
+}
+```
+
+Position the underline relative to the anchor using the inset properties and `anchor()` functions. Do not use `position-area`, which can not be transitioned.
+
+```css
+ul::before{
+  /* Use calc() to offset the top slightly */
+  inset-block-start: calc(anchor(end) + .1lh);
+  inset-inline-start: anchor(start);
+  inset-inline-end: anchor(end);
+}
+```
+
+Add a height and other visual styles.
+
+```css
+ul::before{
+  block-size: .25lh;
+  background: red;
+}
+```
+
+Finally, add a transition on the `inset` properties. MANDATORY: This must be wrapped in a `prefers-reduced-motion: no preference` media query.
+
+```css
+/*  */
+ul::before{
+  @media (prefers-reduced-motion: no-preference){
+    transition: inset .2s;
+  }
+}
+```
+
+This is only a visual indicator, and must not be a replacement for setting the appropriate `aria-current="page"` or `aria-selected` aria values.
+
+## Fallbacks
+
+{{ BASELINE_STATUS("anchor-positioning")}}
+
+If anchor positioning is not supported in the browser, use a `border-bottom` to add an underline. It will not be animated.
+
+```css
+ul li.active{
+  @supports not (position-anchor: auto){
```

</details>

---

## PR #269: Add Guides for Scroll-Driven Animations Use-Cases

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This reads like defining a "center" value is required. I'd clarify that you can define keyframes for any part of the animations, and then give "center" as one such example.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This might be obvious for the agent, but I'd include the CSS code needed to make the container a scroller.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> If you want to include this example, then I'd add some comments to explain this code a bit more. I have no idea how to properly define a named view timeline based on just this example, and I'm not sure if I AI could figure it out either.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
+
+    ```css
+    @keyframes animate {
+      0% {
+        scale: 0.5;
+      }
+      50% {
+        scale: 1;
+      }
+      100% {
+        scale: 0.5;
+      }
+    }
+    ```
+
+3.  **Apply the animation and `view-timeline`:** Attach the animation to the carousel slides and link it to a `view-timeline` that tracks the element as it scrolls through the container.
+
+    ```css
+    .scroller > * {
+      animation: animate auto linear both;
+      animation-timeline: view(inline);
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+## Example code
+
+This code animates the carousel items of a horizontal scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  animation: animate auto linear both;
+  animation-timeline: view(inline);
+}
+```
+
+This code animates the carousel items of a horizontal scroller on scroll using a **named view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  view-timeline: --item inline;
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> In this case, multiple elements are animating aren't they (e.g. multiple carousel items)? But I suspect you didn't mean "multiple" in that sense, so if I'm right then I'd clarify this a bit more.
> 
> I'd also clarify exactly what "tracked subject" means.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
+
+    ```css
+    @keyframes animate {
+      0% {
+        scale: 0.5;
+      }
+      50% {
+        scale: 1;
+      }
+      100% {
+        scale: 0.5;
+      }
+    }
+    ```
+
+3.  **Apply the animation and `view-timeline`:** Attach the animation to the carousel slides and link it to a `view-timeline` that tracks the element as it scrolls through the container.
+
+    ```css
+    .scroller > * {
+      animation: animate auto linear both;
+      animation-timeline: view(inline);
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+## Example code
+
+This code animates the carousel items of a horizontal scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  animation: animate auto linear both;
+  animation-timeline: view(inline);
+}
+```
+
+This code animates the carousel items of a horizontal scroller on scroll using a **named view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  view-timeline: --item inline;
+  animation: animate auto linear both;
+  animation-timeline: --item;
+}
+```
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> I *think* I understand what this means, but it's a bit fuzzy so I'd just be a bit more explicit.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
+
+    ```css
+    @keyframes animate {
+      0% {
+        scale: 0.5;
+      }
+      50% {
+        scale: 1;
+      }
+      100% {
+        scale: 0.5;
+      }
+    }
+    ```
+
+3.  **Apply the animation and `view-timeline`:** Attach the animation to the carousel slides and link it to a `view-timeline` that tracks the element as it scrolls through the container.
+
+    ```css
+    .scroller > * {
+      animation: animate auto linear both;
+      animation-timeline: view(inline);
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+## Example code
+
+This code animates the carousel items of a horizontal scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  animation: animate auto linear both;
+  animation-timeline: view(inline);
+}
+```
+
+This code animates the carousel items of a horizontal scroller on scroll using a **named view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  view-timeline: --item inline;
+  animation: animate auto linear both;
+  animation-timeline: --item;
+}
+```
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> - **DO** use a CSS `<dashed-ident>` for the name (e.g. `view-timeline: --my-custom-name`)
> ```
> 
> Just to be explicit about what a dashed-ident is.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
+
+    ```css
+    @keyframes animate {
+      0% {
+        scale: 0.5;
+      }
+      50% {
+        scale: 1;
+      }
+      100% {
+        scale: 0.5;
+      }
+    }
+    ```
+
+3.  **Apply the animation and `view-timeline`:** Attach the animation to the carousel slides and link it to a `view-timeline` that tracks the element as it scrolls through the container.
+
+    ```css
+    .scroller > * {
+      animation: animate auto linear both;
+      animation-timeline: view(inline);
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+## Example code
+
+This code animates the carousel items of a horizontal scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  animation: animate auto linear both;
+  animation-timeline: view(inline);
+}
+```
+
+This code animates the carousel items of a horizontal scroller on scroll using a **named view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  view-timeline: --item inline;
+  animation: animate auto linear both;
+  animation-timeline: --item;
+}
+```
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> This is also a bit fuzzy, and at this point I'm wondering if the use of named view timelines just doesn't belong in this use case (and it would be clearer in a use case where using it is the recommendation). I'll revisit this comment after reviewing the rest of the guides.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,173 @@ web-feature-ids:
 sources:
   - https://scroll-driven-animations.style/
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build Carousel Slide Effects
+
+Carousel slide effects are a great way to add visual interest to a carousel. As the user scrolls through the slides, each slide can animate as it enters, centers, and exits the scrollport. For example, the slides can fade in and out, rotate, or scale in size. This creates a dynamic and engaging user experience. Unlike simple entry/exit animations, this effect uses a single, continuous animation to control the slide's appearance across the entire scrollport.
+
+## How to implement
+
+Here’s how to create carousel slide effects:
+
+1.  **Create a scroller:** This element will act as the container for your carousel slides.
+
+    ```html
+    <ul class="scroller">
+      <li class="entry">1</li>
+      <li class="entry">2</li>
+      <li class="entry">3</li>
+      …
+    </ul>
+    ```
+
+2.  **Define the animation:** Create a CSS animation that defines the different states of your slides as they enter, center, and exit the scrollport. For example, you can use the `scale` property to make the slides grow as they approach the center and shrink as they move away.
+
+    ```css
+    @keyframes animate {
+      0% {
+        scale: 0.5;
+      }
+      50% {
+        scale: 1;
+      }
+      100% {
+        scale: 0.5;
+      }
+    }
+    ```
+
+3.  **Apply the animation and `view-timeline`:** Attach the animation to the carousel slides and link it to a `view-timeline` that tracks the element as it scrolls through the container.
+
+    ```css
+    .scroller > * {
+      animation: animate auto linear both;
+      animation-timeline: view(inline);
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+## Example code
+
+This code animates the carousel items of a horizontal scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  animation: animate auto linear both;
+  animation-timeline: view(inline);
+}
+```
+
+This code animates the carousel items of a horizontal scroller on scroll using a **named view-timeline**:
+
+```css
+@keyframes animate {
+  0% {
+    scale: 0.5;
+  }
+
+  50% {
+    scale: 1;
+  }
+
+  100% {
+    scale: 0.5;
+  }
+}
+
+.scroller > * {
+  view-timeline: --item inline;
+  animation: animate auto linear both;
+  animation-timeline: --item;
+}
+```
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` and `animation-range` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> ```suggestion
> A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect is best achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
> ```
> 
> Should we make this recommendation stronger?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,7 +3,182 @@ name: parallax-scroll-effects
 description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
 web-feature-ids:
   - scroll-driven-animations
+  - sibling-count
 sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build a Parallax Effect on Scroll
+
+A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect can be achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> Can the wrapper be the `<html>` or `<body>` elements? If so then maybe say "define the wrapper"?
> 
> Also same comment as on the other guide about showing how to make this a scrollable container.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,7 +3,182 @@ name: parallax-scroll-effects
 description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
 web-feature-ids:
   - scroll-driven-animations
+  - sibling-count
 sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build a Parallax Effect on Scroll
+
+A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect can be achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
+
+## How to implement
+
+Here’s how to create a basic parallax effect:
+
+1.  **Create a wrapper element:** This element will contain all the layers of your parallax animation.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> I think using `sibling-index()` makes sense in your demos since it has lots of layers, but would this really make sense in a typical parallax example, which would likely just have one foreground (text) and one background (image) layer—and only the background layer is moving at a different speed?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,7 +3,182 @@ name: parallax-scroll-effects
 description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
 web-feature-ids:
   - scroll-driven-animations
+  - sibling-count
 sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/parallax-carousel/css/
----
\ No newline at end of file
+---
+
+# Build a Parallax Effect on Scroll
+
+A parallax effect on scroll is a visual technique where different layers of content move at varying speeds as the user scrolls down a page. This creates an illusion of depth, with foreground elements appearing to move faster than the background elements, resulting in an engaging and immersive browsing experience. This effect can be achieved using CSS Scroll-Driven Animations, which allow you to link animations to the scroll position of a container.
+
+## How to implement
+
+Here’s how to create a basic parallax effect:
+
+1.  **Create a wrapper element:** This element will contain all the layers of your parallax animation.
+
+    ```html
+    <div class="wrapper">
+      …
+    </div>
+    ```
+
+2.  **Declare the layers:** Inside the wrapper, add the individual layers that will move at different speeds.
+
+    ```html
+    <div class="wrapper">
+      <div class="layer">LAYER 0</div>
+      <div class="layer">LAYER 1</div>
+      <div class="layer">LAYER 2</div>
+      …
+    </div>
+    ```
+
+3.  **Add a translate animation:** Define a CSS animation that changes the `transform` property of the layers. For a parallax effect, you'll typically use `translateY` to move the layers vertically.
+
+    ```css
+    @keyframes parallax {
+      from {
+        transform: translateY(700px);
+      }
+    }
+    ```
+
+4.  **Set up the `view-timeline`:** To link the animation to the scroll position, create a `view-timeline` on the wrapper element and then apply it to the layers.
+
+    ```css
+    .wrapper {
+      view-timeline: --wrapper;
+    }
+
+    .layer {
+      animation: parallax linear both;
+      animation-timeline: --wrapper;
+    }
+    ```
+
+5.  **Stagger the animations:** To make the layers move at different speeds, you can use one of two approaches:
+
+    *   **Using `sibling-index()` in the keyframes:** This is the simplest approach. The `sibling-index()` function returns the index of a child element amongst its siblings, which you can then use in your keyframes to create a staggered effect.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> Might want to add a comment here to the effect of: "Customize this to match the logic defined in your CSS."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,176 @@ sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/image-reveal/css/
   - https://scroll-driven-animations.style/demos/contact-list/css/multiple-animations.html
----
\ No newline at end of file
+---
+
+# Add entry and exit effects to elements as they enter or exit the scrollport
+
+Entry and exit effects are animations that are triggered when an element enters or leaves the viewport. This can be used to create engaging and dynamic user experiences. For example, you can use an entry effect to fade in an element as it scrolls into view, or an exit effect to scale it down as it scrolls out of view.
+
+## How to implement
+
+To add entry and exit effects to an element, you need to combine a few CSS properties. Here’s a step-by-step guide:
+
+1.  **Create separate `@keyframes` for the entry and exit animations.** The entry animation will be applied as the element enters the viewport, and the exit animation will be applied as it leaves.
+
+    ```css
+    @keyframes slide-in {
+      from { transform: translateX(-100%); }
+    }
+    @keyframes slide-out {
+      to { transform: translateX(100%); }
+    }
+    ```
+
+2.  **Attach the entry and exit keyframes to the element.** You can do this by defining multiple animations in the `animation` property.
+
+    -   Give the entry animation a `animation-fill-mode` of `forwards` so that it maintains its final state after the animation is complete.
+    -   Give the exit animation a `animation-fill-mode` of `backwards` so that it doesn't affect the element before it starts.
+
+    ```css
+    .animated-element {
+      animation:
+        slide-in 1s linear forwards,
+        slide-out 1s linear backwards;
+    }
+    ```
+
+3.  **Create a View Timeline and link it to the animations.** A View Timeline is a type of timeline that is linked to the visibility of an element in the viewport. You can create one using the `view()` function and then apply it to your animations using the `animation-timeline` property.
+
+    ```css
+    .animated-element {
+      animation-timeline: view();
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+4.  **Limit the animations to the `entry` and `exit` ranges.** The `animation-range` property allows you to specify which part of the timeline an animation should run on.
+
+    -   The `entry` range covers the time from when the element first enters the viewport until it is fully visible.
+    -   The `exit` range covers the time from when the element starts to leave the viewport until it is completely hidden.
+
+    ```css
+    .animated-element {
+      animation-range: entry, exit;
+    }
+    ```
+
+## Example code
+
+This code animates the direct children of the scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: view(inline);
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+As the elements enter the scrollport the `grow` animation is played, and as they leave the scrollport the `shrink` animation is played.
+
+The following code has the same visual outcome, but animates the direct children of the scroller on scroll using an **named view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      view-timeline: --tl inline;
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: --tl;
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is constantly improving, it's still a good idea to provide a fallback for browsers that don't yet support them. Here's a JavaScript-based fallback that uses an `IntersectionObserver` to create a similar effect.
+
+```html
+<script>
+  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
+    const observer = new IntersectionObserver(
+      (entries) => {
+        for (const entry of entries) {
+          entry.target.style.scale = 0.5 + entry.intersectionRatio * 0.5;
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> Gross, but I like it :)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,176 @@ sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/image-reveal/css/
   - https://scroll-driven-animations.style/demos/contact-list/css/multiple-animations.html
----
\ No newline at end of file
+---
+
+# Add entry and exit effects to elements as they enter or exit the scrollport
+
+Entry and exit effects are animations that are triggered when an element enters or leaves the viewport. This can be used to create engaging and dynamic user experiences. For example, you can use an entry effect to fade in an element as it scrolls into view, or an exit effect to scale it down as it scrolls out of view.
+
+## How to implement
+
+To add entry and exit effects to an element, you need to combine a few CSS properties. Here’s a step-by-step guide:
+
+1.  **Create separate `@keyframes` for the entry and exit animations.** The entry animation will be applied as the element enters the viewport, and the exit animation will be applied as it leaves.
+
+    ```css
+    @keyframes slide-in {
+      from { transform: translateX(-100%); }
+    }
+    @keyframes slide-out {
+      to { transform: translateX(100%); }
+    }
+    ```
+
+2.  **Attach the entry and exit keyframes to the element.** You can do this by defining multiple animations in the `animation` property.
+
+    -   Give the entry animation a `animation-fill-mode` of `forwards` so that it maintains its final state after the animation is complete.
+    -   Give the exit animation a `animation-fill-mode` of `backwards` so that it doesn't affect the element before it starts.
+
+    ```css
+    .animated-element {
+      animation:
+        slide-in 1s linear forwards,
+        slide-out 1s linear backwards;
+    }
+    ```
+
+3.  **Create a View Timeline and link it to the animations.** A View Timeline is a type of timeline that is linked to the visibility of an element in the viewport. You can create one using the `view()` function and then apply it to your animations using the `animation-timeline` property.
+
+    ```css
+    .animated-element {
+      animation-timeline: view();
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+4.  **Limit the animations to the `entry` and `exit` ranges.** The `animation-range` property allows you to specify which part of the timeline an animation should run on.
+
+    -   The `entry` range covers the time from when the element first enters the viewport until it is fully visible.
+    -   The `exit` range covers the time from when the element starts to leave the viewport until it is completely hidden.
+
+    ```css
+    .animated-element {
+      animation-range: entry, exit;
+    }
+    ```
+
+## Example code
+
+This code animates the direct children of the scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: view(inline);
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+As the elements enter the scrollport the `grow` animation is played, and as they leave the scrollport the `shrink` animation is played.
+
+The following code has the same visual outcome, but animates the direct children of the scroller on scroll using an **named view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      view-timeline: --tl inline;
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: --tl;
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is constantly improving, it's still a good idea to provide a fallback for browsers that don't yet support them. Here's a JavaScript-based fallback that uses an `IntersectionObserver` to create a similar effect.
+
+```html
+<script>
+  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
+    const observer = new IntersectionObserver(
+      (entries) => {
+        for (const entry of entries) {
+          entry.target.style.scale = 0.5 + entry.intersectionRatio * 0.5;
+        }
+      },
+      {
+        threshold: Array.from({ length: 101 }, (_, i) => i / 100),
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-entry-exit-effects/guide.md`
> I think including this is fine, but at the same time I suspect the AI will be able to figure out what's going on in your fallback example, so maybe it's not needed? (The evals would be able to answer this question.)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -7,4 +7,176 @@ sources:
   - https://developer.chrome.com/docs/css-ui/scroll-driven-animations
   - https://scroll-driven-animations.style/demos/image-reveal/css/
   - https://scroll-driven-animations.style/demos/contact-list/css/multiple-animations.html
----
\ No newline at end of file
+---
+
+# Add entry and exit effects to elements as they enter or exit the scrollport
+
+Entry and exit effects are animations that are triggered when an element enters or leaves the viewport. This can be used to create engaging and dynamic user experiences. For example, you can use an entry effect to fade in an element as it scrolls into view, or an exit effect to scale it down as it scrolls out of view.
+
+## How to implement
+
+To add entry and exit effects to an element, you need to combine a few CSS properties. Here’s a step-by-step guide:
+
+1.  **Create separate `@keyframes` for the entry and exit animations.** The entry animation will be applied as the element enters the viewport, and the exit animation will be applied as it leaves.
+
+    ```css
+    @keyframes slide-in {
+      from { transform: translateX(-100%); }
+    }
+    @keyframes slide-out {
+      to { transform: translateX(100%); }
+    }
+    ```
+
+2.  **Attach the entry and exit keyframes to the element.** You can do this by defining multiple animations in the `animation` property.
+
+    -   Give the entry animation a `animation-fill-mode` of `forwards` so that it maintains its final state after the animation is complete.
+    -   Give the exit animation a `animation-fill-mode` of `backwards` so that it doesn't affect the element before it starts.
+
+    ```css
+    .animated-element {
+      animation:
+        slide-in 1s linear forwards,
+        slide-out 1s linear backwards;
+    }
+    ```
+
+3.  **Create a View Timeline and link it to the animations.** A View Timeline is a type of timeline that is linked to the visibility of an element in the viewport. You can create one using the `view()` function and then apply it to your animations using the `animation-timeline` property.
+
+    ```css
+    .animated-element {
+      animation-timeline: view();
+    }
+    ```
+
+    By default, `view()` tracks the element on the `block` axis. If you need to track it on the `inline` axis, you can use `view(inline)`.
+
+4.  **Limit the animations to the `entry` and `exit` ranges.** The `animation-range` property allows you to specify which part of the timeline an animation should run on.
+
+    -   The `entry` range covers the time from when the element first enters the viewport until it is fully visible.
+    -   The `exit` range covers the time from when the element starts to leave the viewport until it is completely hidden.
+
+    ```css
+    .animated-element {
+      animation-range: entry, exit;
+    }
+    ```
+
+## Example code
+
+This code animates the direct children of the scroller on scroll using an **anonymous view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: view(inline);
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+As the elements enter the scrollport the `grow` animation is played, and as they leave the scrollport the `shrink` animation is played.
+
+The following code has the same visual outcome, but animates the direct children of the scroller on scroll using an **named view-timeline**:
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: view()) and (animation-range: entry)) {
+    @keyframes grow {
+      from {
+        scale: 0.5;
+      }
+    }
+    @keyframes shrink {
+      to {
+        scale: 0.5;
+      }
+    }
+
+    .scroller > * {
+      view-timeline: --tl inline;
+      animation:
+        grow auto linear backwards,
+        shrink auto linear forwards;
+      animation-timeline: --tl;
+      animation-range: entry, exit;
+    }
+  }
+}
+```
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports ((animation-timeline: view()) and (animation-range: entry))` to check for support and provide a fallback for browsers that don't support it.
+  - The `(animation-range: entry)` check **MUST** be included here, to filter out browsers with only partial support.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `view()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view(block)` or `view(inline)`.
+- When the animation is not applied to the tracked subject itself, use a named view timeline.
+
+When using the `view-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `view-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `view-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `view-timeline`’s name by using `timeline-scope` on a shared ancestor.
+
+Prefer a named `view-timeline` when multiple elements or children of the tracked subject need to animate.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is constantly improving, it's still a good idea to provide a fallback for browsers that don't yet support them. Here's a JavaScript-based fallback that uses an `IntersectionObserver` to create a similar effect.
+
+```html
+<script>
+  if (!CSS.supports('(animation-timeline: view()) and (animation-range: entry)')) {
+    const observer = new IntersectionObserver(
+      (entries) => {
+        for (const entry of entries) {
+          entry.target.style.scale = 0.5 + entry.intersectionRatio * 0.5;
+        }
+      },
+      {
+        threshold: Array.from({ length: 101 }, (_, i) => i / 100),
+      }
+    );
+
+    document.querySelectorAll('.scroller > *').forEach((el) => {
+      observer.observe(el);
+    });
+  }
+</script>
+```
+
+This script first checks if the browser supports `animation-timeline: view()` and `animation-range: entry`. If not, it creates an `IntersectionObserver` that will fire a callback whenever one of the observed elements intersects with the viewport.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> Similar to above, I think the AI can figure this out and this paragraph is likely not needed.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,131 @@ sources:
   - https://scroll-driven-animations.style/demos/progress-bar/css/scroll-defaults
   - https://scroll-driven-animations.style/demos/progress-bar/css/
 ---
+
+# Build a Scroll Progress Indicator
+
+A scroll progress indicator is a common user interface pattern that visually communicates the user's progress through a scrollable document or container. As the user scrolls, a visual element updates to reflect their position, providing a clear and intuitive sense of how much content has been viewed and how much remains.
+
+## How to implement
+
+To create a scroll progress indicator, you need two things:
+
+1.  An element to act as the progress bar. This element is typically `position: fixed` or `position: absolute` so that it stays in view while the user scrolls.
+2.  An animation that is linked to the scroll position.
+
+Here’s how you can achieve this:
+
+-   First, create an HTML element that will serve as your progress bar. This element can be styled to your liking.
+-   Next, in your CSS, define a `@keyframes` animation that scales the progress bar. A common approach is to scale the element from `scaleX(0)` to `scaleX(1)`.
+-   Finally, apply this animation to your progress bar element and set its `animation-timeline` to a scroll-timeline. This tells the browser to drive the animation's progress based on the scroll position of the nearest ancestor scroller.
+
+## Example code
+
+This code grows the `#progress` element on scroll using an anonymous scroll-timeline, created by the `scroll()` function.
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: scroll())) {
+    @keyframes grow-progress {
+      from { transform: scaleX(0); }
+      to { transform: scaleX(1); }
+    }
+
+    #progress {
+      position: fixed;
+      left: 0; top: 0;
+      width: 100%; height: 1em;
+      background: red;
+
+      transform-origin: 0 50%;
+      animation: grow-progress auto linear;
+      animation-timeline: scroll();
+    }
+  }
+}
+```
+
+Because of its location in the DOM, the `scroll()` function will track its neareast ancestor scroller in the `block` direction, which here is the root scroller.
+
+```html
+<body>
+  <div id="progress"></div>
+</body>
+```
+
+This code grows the `#progress` element on scroll using a named scroll-timeline, created by the `scroll-timeline` property.
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: scroll())) {
+    @keyframes grow-progress {
+      from { transform: scaleX(0); }
+      to { transform: scaleX(1); }
+    }
+
+    :root {
+      scroll-timeline: --tl block;
+    }
+
+    #progress {
+      position: fixed;
+      left: 0; top: 0;
+      width: 100%; height: 1em;
+      background: red;
+
+      transform-origin: 0 50%;
+      animation: grow-progress auto linear;
+      animation-timeline: --tl;
+    }
+  }
+}
+```
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports (animation-timeline: scroll())` to check for support and provide a fallback for browsers that don't support it.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `scroll()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the scroller: When not targeting the nearest ancestor scroller, be explicit about which scroller you want to use with `scroll(root)` or `scroll(self)`.
+  - When `root`, `nearest`, or `self` are not sufficient, use a named scroll-timeline.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll(block)` or `scroll(inline)`.
+
+When using the `scroll-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `scroll-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `scroll-timeline`’s name by using `timeline-scope` on a shared ancestor.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is improving, a fallback is still necessary. You can use JavaScript to create a similar effect.
+
+Here’s a JavaScript-based fallback that listens for the `scroll` event and updates the progress bar's `scaleX` transform accordingly. This code is wrapped in a check to see if the browser supports `animation-timeline`, so it only runs if the CSS-based animation isn't supported.
+
+```html
+<script>
+  if (!CSS.supports('animation-timeline', 'scroll()')) {
+    const progress = document.querySelector('#progress');
+
+    window.addEventListener('scroll', () => {
+      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
+      const scrolled = window.scrollY;
+      const progressPercentage = (scrolled / scrollable);
+
+      progress.style.transform = `scaleX(${progressPercentage})`;
+    });
+  }
+</script>
+```
+
+This script first checks if `animation-timeline: scroll()` is supported. If not, it adds a scroll event listener to the `window`. In the event listener, it calculates the scroll progress as a percentage and updates the `scaleX` of the `#progress` element. This provides a similar visual effect for browsers that don't yet support the CSS feature.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> I wonder if a stronger recommendation should be made here (and in the fallback section of the other use case guides as well).
> 
> Something like: "...even though Scroll Driven Animations are not yet Baseline Widely available, given their performance benefits, they should still be preferred on browsers that support them..."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -8,3 +8,131 @@ sources:
   - https://scroll-driven-animations.style/demos/progress-bar/css/scroll-defaults
   - https://scroll-driven-animations.style/demos/progress-bar/css/
 ---
+
+# Build a Scroll Progress Indicator
+
+A scroll progress indicator is a common user interface pattern that visually communicates the user's progress through a scrollable document or container. As the user scrolls, a visual element updates to reflect their position, providing a clear and intuitive sense of how much content has been viewed and how much remains.
+
+## How to implement
+
+To create a scroll progress indicator, you need two things:
+
+1.  An element to act as the progress bar. This element is typically `position: fixed` or `position: absolute` so that it stays in view while the user scrolls.
+2.  An animation that is linked to the scroll position.
+
+Here’s how you can achieve this:
+
+-   First, create an HTML element that will serve as your progress bar. This element can be styled to your liking.
+-   Next, in your CSS, define a `@keyframes` animation that scales the progress bar. A common approach is to scale the element from `scaleX(0)` to `scaleX(1)`.
+-   Finally, apply this animation to your progress bar element and set its `animation-timeline` to a scroll-timeline. This tells the browser to drive the animation's progress based on the scroll position of the nearest ancestor scroller.
+
+## Example code
+
+This code grows the `#progress` element on scroll using an anonymous scroll-timeline, created by the `scroll()` function.
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: scroll())) {
+    @keyframes grow-progress {
+      from { transform: scaleX(0); }
+      to { transform: scaleX(1); }
+    }
+
+    #progress {
+      position: fixed;
+      left: 0; top: 0;
+      width: 100%; height: 1em;
+      background: red;
+
+      transform-origin: 0 50%;
+      animation: grow-progress auto linear;
+      animation-timeline: scroll();
+    }
+  }
+}
+```
+
+Because of its location in the DOM, the `scroll()` function will track its neareast ancestor scroller in the `block` direction, which here is the root scroller.
+
+```html
+<body>
+  <div id="progress"></div>
+</body>
+```
+
+This code grows the `#progress` element on scroll using a named scroll-timeline, created by the `scroll-timeline` property.
+
+```css
+@media (prefers-reduced-motion: no-preference) {
+  @supports ((animation-timeline: scroll())) {
+    @keyframes grow-progress {
+      from { transform: scaleX(0); }
+      to { transform: scaleX(1); }
+    }
+
+    :root {
+      scroll-timeline: --tl block;
+    }
+
+    #progress {
+      position: fixed;
+      left: 0; top: 0;
+      width: 100%; height: 1em;
+      background: red;
+
+      transform-origin: 0 50%;
+      animation: grow-progress auto linear;
+      animation-timeline: --tl;
+    }
+  }
+}
+```
+
+## Best Practices
+
+When using scroll-driven animations, it's important to follow a few best practices to ensure a smooth and accessible experience:
+
+- **DO** include feature detection: Not all browsers support scroll-driven animations. Use `@supports (animation-timeline: scroll())` to check for support and provide a fallback for browsers that don't support it.
+  - **DO NOT** use the `scroll-timeline-polyfill` package for the fallback strategy as it is not feature complete and has a lot of known issues.
+  - If the animation is only considered to be decorative, opt for Progressive Enhancement and **DO NOT** provide a fallback.
+- **DO** respect user preferences: Some users prefer to have less motion on the web. Use the `prefers-reduced-motion` media query to disable or reduce your animations for these users.
+- **DO** try to animate only performant CSS properties: For the smoothest animations, stick to animating properties that can be handled by the browser's compositor thread, such as `transform` and `opacity`. Animating other properties like `width` or `height` can lead to performance issues.
+- **DO** use the correct declaration order: When using the `animation` shorthand property, declare `animation-timeline` *after* it to prevent the shorthand from resetting the timeline.
+
+When using the `scroll()` function to create a scroll-driven animation:
+
+- **OPTIONAL** be explicit about the scroller: When not targeting the nearest ancestor scroller, be explicit about which scroller you want to use with `scroll(root)` or `scroll(self)`.
+  - When `root`, `nearest`, or `self` are not sufficient, use a named scroll-timeline.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll(block)` or `scroll(inline)`.
+
+When using the `scroll-timeline` property to create a scroll-driven animation:
+
+- **DO** use a CSS `<dashed-ident>` for the name.
+- **OPTIONAL** be explicit about the axis to track: When not targeting the default `block` axis (such as in a horizontal scroller), be explicit about which axis to track with `scroll-timeline-axis`.
+- **DO** make sure the scope of the lookup works: When the element that is declaring the `scroll-timeline` is not a flat tree ancestor of the animated element, hoist up the visibility of the `scroll-timeline`’s name by using `timeline-scope` on a shared ancestor.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("scroll-driven-animations") }}. Therefore, a fallback strategy is typically required.
+
+While browser support for scroll-driven animations is improving, a fallback is still necessary. You can use JavaScript to create a similar effect.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-scroll-effects/guide.md`
> I'd remove this unless we're saying the use case should not be implemented without it (see other comments for more context).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,7 +3,182 @@ name: parallax-scroll-effects
 description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
 web-feature-ids:
   - scroll-driven-animations
+  - sibling-count
```

</details>

#### **philipwalton** on `guides/user-experience/shrinking-header-on-scroll/guide.md`
> I'm confused by this example because it comes right after a tip but then it doesn't show what's mentioned in the tip. Should this example be moved up above the tip?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,130 @@
+---
+name: shrinking-header-on-scroll
+description: Smoothly animate a fixed header or full-page cover on scroll to dynamically shrink, gain shadows, and transform its layout over a predefined scroll distance.
+web-feature-ids:
+  - scroll-driven-animations
+sources:
+  - https://scroll-driven-animations.style/
+  - https://scroll-driven-animations.style/demos/shadow-on-header-after-scroll/css/
+  - https://scroll-driven-animations.style/demos/cover-card-to-fixed-header/css/
+---
+
+# Shrinking headder on scroll
+
+A shrinking header on scroll is a common UI pattern where a fixed header element at the top of the page smoothly transitions to a smaller size as the user scrolls down. This effect is often used to maximize screen real estate for the main content while keeping essential navigation or branding elements accessible. With CSS scroll-driven animations, this effect can be achieved in a declarative and performant way, by linking an animation to the scroll position of the document.
+
+## How to implement
+
+Here’s how to create a shrinking header on scroll:
+
+1.  **Create a fixed header:** Start with a header element that is fixed to the top of the page and has a predefined height.
+
+    ```html
+    <header>HEADER</header>
+    ```
+
+    ```css
+    header {
+      position: fixed;
+      height: 200px;
+      top: 0;
+      left: 0;
+      right: 0;
+    }
+    ```
+
+2.  **Define the shrink animation:** Create a CSS animation that changes the height of the header.
+
+    ```css
+    @keyframes shrink {
+      to {
+        height: 50px;
+      }
+    }
+    ```
+
+3.  **Apply the animation and scroll timeline:** Attach the animation to the header and use the `scroll()` function to link it to the document’s scroll position.
+
+    ```css
+    header {
+      animation: shrink auto linear both;
+      animation-timeline: scroll(block root);
+    }
+    ```
+
+4.  **Set the `animation-range`:** Use the `animation-range` property to specify the scroll distance over which the animation should occur. For example, to shrink the header over the first 200 pixels of scrolling, you would use `animation-range: 0px 200px;`.
+
+    ```css
+    header {
+      animation-range: 0px 200px;
+    }
+    ```
+
+**Tip:** To prevent the content following the header from being obscured by it, add a `padding-top` to the `body` (or the main content container) that is equal to the initial height of the header.
+
+**Tip:** When your header shrinks from a large height (e.g., `100vh`) to a smaller one (e.g., `10vh`), the `animation-range-end` should be the difference between the start and end sizes (e.g., `90vh`). This ensures the animation completes precisely when the header reaches its final size.
+
+
+## Example code
```

</details>

---

## PR #132: Add guide: `autofill-highlight-inputs`

### Reviews

#### **philipwalton** (COMMENTED)
> Overall this LGTM, but I did have a few questions before merging.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> FYI, I'm getting an error when running the demo page because this script is run in the `<head>`, which means it doesn't find the `<form>` element.
> 
> Is this JS code required for the demo?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,606 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>:autofill highlight inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
+  <!-- <script src="js/main.js" defer></script> -->
+
+  <style>
+    /* Copyright 2026 Google LLC.
+    SPDX-License-Identifier: Apache-2.0 */
+
+    :root {
+      --small-mobile-font-size: 20px;
+      --large-mobile-font-size: 22px;
+      --desktop-font-size: 22px;
+    }
+
+    :-webkit-autofill {
+      border: 2px solid blue;
+    }
+
+    :autofill {
+      border-style: dotted;
+    }
+
+    :autofill:hover,
+    :autofill:focus {
+      color: red;
+    }
+
+    body {
+      font-family: sans-serif;
+      font-weight: 500;
+      margin: 10px 15px 0 15px;
+    }
+
+    button,
+    input#submit {
+      background-color: black;
+      border: 1px solid #cccccc;
+      border-radius: 2px;
+      color: #eeeeee;
+      cursor: pointer;
+      display: block;
+      font-size: 20px; /* fallback */
+      font-size: var(--large-mobile-font-size);
+      font-weight: 400;
+      margin: 3px 0 0 0;
+      padding: 14px;
+      width: 180px;
+    }
+
+    button:disabled {
+      color: #888888;
+      cursor: default;
+    }
+
+    button:not(:disabled):hover {
+      background-color: #333333;
+      color: white;
+    }
+
+    div.explanation {
+      font-size: 14px;
+      margin: 10px 0 0 0;
+    }
+
+    section#cc-exp-csc div:not(:last-child) {
+      margin: 0 10px 0 0;
+    }
+
+    div#exp-month-year {
+      width: 50%;
+    }
+
+    form {
+      /*   border-bottom: 1px solid #cccccc;
+      margin: 0 0 20px 0;
+      padding: 0 0 50px 0; */
+    }
+
+    h1 {
+      border-bottom: 1px solid #cccccc;
+      font-size: 28px;
+      font-weight: 300;
+      margin: 0 0 30px 0;
+      padding: 0;
+    }
+
+    input {
+      border: 1px solid #cccccc;
+      font-size: 22px; /* fallback */
+      font-size: var(--small-mobile-font-size);
+      padding: 12px;
+      width: 90%; /* fallback */
+      width: calc(100% - 30px); /* full width minus padding */
+    }
+
+    input:not(:focus):invalid {
+      color: red;
+      outline-color: red;
+    }
+
+    label {
+      display: block;
+      font-size: 20px;
+      font-size: var(--small-mobile-font-size);
+      font-weight: 400;
+      margin: 0 0 1px 0;
+    }
+
+    main {
+      margin: 0 auto;
+      max-width: 500px;
+    }
+
+    p {
+      font-size: 19px;
+      font-weight: 400;
+    }
+
+    form section {
+      margin: 0 0 17px 0;
+      padding: 0 0 10px 0;
+      position: relative;
+    }
+
+    form section:last-of-type {
+      margin: 0 0 25px 0;
+    }
+
+    section#cc-exp-csc {
+      display: flex;
+      justify-content: space-between;
+    }
+
+    select {
+      background-color: white;
+      border: 1px solid #cccccc;
+      display: inline-block;
+      font-size: var(--small-mobile-font-size);
+      padding: 12px 12px 12px 11px;
+      width: 100%;
+    }
+
+    textarea {
+      border: 1px solid #cccccc;
+      font-family: sans-serif;
+      font-size: 22px; /* fallback */
+      font-size: var(--small-mobile-font-size);
+      height: 3.5em;
+      line-height: 1.4em;
+      padding: 12px;
+      width: 90%; /* fallback */
+      width: calc(100% - 30px); /* full width minus padding */
+    }
+
+    @media (min-width: 400px) {
+      button {
+        font-size: 20px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      div.explanation {
+        font-size: 16px;
+      }
+
+      h1 {
+        font-size: 36px;
+        font-weight: 500;
+      }
+
+      input {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      label {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      p {
+        font-weight: 400;
+        line-height: 1.5em;
+      }
+
+      form section {
+        margin: 0 0 10px 0;
+      }
+
+      form section:last-of-type {
+        margin: 0 0 30px 0;
+      }
+
+      select {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      textarea {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+    }
+
+    @media (min-width: 500px) {
+      body {
+        margin: 70px 70px 0 70px;
+      }
+
+      button {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+      }
+
+      section#cc-exp-csc div:not(:last-child) {
+        margin: 0 20px 0 0;
+      }
+
+      form {
+        margin: 0 0 20px 0;
+        padding: 0 0 100px 0;
+      }
+
+      h1 {
+        font-size: 36px;
+        font-weight: 100;
+        margin: 0 0 60px 0;
+      }
+
+      input {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+      }
+
+      label {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+        margin: 0 0 6px 0;
+      }
+
+      form section {
+        margin: 0 0 35px 0;
+      }
+
+      form section:last-of-type {
+        margin: 0 0 60px 0;
+      }
+    }
+
+  </style>
+  <script>
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Should these comments be removed? (This and the next line.)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,606 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>:autofill highlight inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Should this be removed? If not then I'd recommend a comment explanation (similar to "<!-- Alternative address format -->" above).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,606 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>:autofill highlight inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
+  <!-- <script src="js/main.js" defer></script> -->
+
+  <style>
+    /* Copyright 2026 Google LLC.
+    SPDX-License-Identifier: Apache-2.0 */
+
+    :root {
+      --small-mobile-font-size: 20px;
+      --large-mobile-font-size: 22px;
+      --desktop-font-size: 22px;
+    }
+
+    :-webkit-autofill {
+      border: 2px solid blue;
+    }
+
+    :autofill {
+      border-style: dotted;
+    }
+
+    :autofill:hover,
+    :autofill:focus {
+      color: red;
+    }
+
+    body {
+      font-family: sans-serif;
+      font-weight: 500;
+      margin: 10px 15px 0 15px;
+    }
+
+    button,
+    input#submit {
+      background-color: black;
+      border: 1px solid #cccccc;
+      border-radius: 2px;
+      color: #eeeeee;
+      cursor: pointer;
+      display: block;
+      font-size: 20px; /* fallback */
+      font-size: var(--large-mobile-font-size);
+      font-weight: 400;
+      margin: 3px 0 0 0;
+      padding: 14px;
+      width: 180px;
+    }
+
+    button:disabled {
+      color: #888888;
+      cursor: default;
+    }
+
+    button:not(:disabled):hover {
+      background-color: #333333;
+      color: white;
+    }
+
+    div.explanation {
+      font-size: 14px;
+      margin: 10px 0 0 0;
+    }
+
+    section#cc-exp-csc div:not(:last-child) {
+      margin: 0 10px 0 0;
+    }
+
+    div#exp-month-year {
+      width: 50%;
+    }
+
+    form {
+      /*   border-bottom: 1px solid #cccccc;
+      margin: 0 0 20px 0;
+      padding: 0 0 50px 0; */
+    }
+
+    h1 {
+      border-bottom: 1px solid #cccccc;
+      font-size: 28px;
+      font-weight: 300;
+      margin: 0 0 30px 0;
+      padding: 0;
+    }
+
+    input {
+      border: 1px solid #cccccc;
+      font-size: 22px; /* fallback */
+      font-size: var(--small-mobile-font-size);
+      padding: 12px;
+      width: 90%; /* fallback */
+      width: calc(100% - 30px); /* full width minus padding */
+    }
+
+    input:not(:focus):invalid {
+      color: red;
+      outline-color: red;
+    }
+
+    label {
+      display: block;
+      font-size: 20px;
+      font-size: var(--small-mobile-font-size);
+      font-weight: 400;
+      margin: 0 0 1px 0;
+    }
+
+    main {
+      margin: 0 auto;
+      max-width: 500px;
+    }
+
+    p {
+      font-size: 19px;
+      font-weight: 400;
+    }
+
+    form section {
+      margin: 0 0 17px 0;
+      padding: 0 0 10px 0;
+      position: relative;
+    }
+
+    form section:last-of-type {
+      margin: 0 0 25px 0;
+    }
+
+    section#cc-exp-csc {
+      display: flex;
+      justify-content: space-between;
+    }
+
+    select {
+      background-color: white;
+      border: 1px solid #cccccc;
+      display: inline-block;
+      font-size: var(--small-mobile-font-size);
+      padding: 12px 12px 12px 11px;
+      width: 100%;
+    }
+
+    textarea {
+      border: 1px solid #cccccc;
+      font-family: sans-serif;
+      font-size: 22px; /* fallback */
+      font-size: var(--small-mobile-font-size);
+      height: 3.5em;
+      line-height: 1.4em;
+      padding: 12px;
+      width: 90%; /* fallback */
+      width: calc(100% - 30px); /* full width minus padding */
+    }
+
+    @media (min-width: 400px) {
+      button {
+        font-size: 20px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      div.explanation {
+        font-size: 16px;
+      }
+
+      h1 {
+        font-size: 36px;
+        font-weight: 500;
+      }
+
+      input {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      label {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      p {
+        font-weight: 400;
+        line-height: 1.5em;
+      }
+
+      form section {
+        margin: 0 0 10px 0;
+      }
+
+      form section:last-of-type {
+        margin: 0 0 30px 0;
+      }
+
+      select {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+
+      textarea {
+        font-size: 22px; /* fallback */
+        font-size: var(--large-mobile-font-size);
+      }
+    }
+
+    @media (min-width: 500px) {
+      body {
+        margin: 70px 70px 0 70px;
+      }
+
+      button {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+      }
+
+      section#cc-exp-csc div:not(:last-child) {
+        margin: 0 20px 0 0;
+      }
+
+      form {
+        margin: 0 0 20px 0;
+        padding: 0 0 100px 0;
+      }
+
+      h1 {
+        font-size: 36px;
+        font-weight: 100;
+        margin: 0 0 60px 0;
+      }
+
+      input {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+      }
+
+      label {
+        font-size: 18px; /* fallback */
+        font-size: var(--desktop-font-size);
+        margin: 0 0 6px 0;
+      }
+
+      form section {
+        margin: 0 0 35px 0;
+      }
+
+      form section:last-of-type {
+        margin: 0 0 60px 0;
+      }
+    }
+
+  </style>
+  <script>
+    /* Copyright 2026 Google LLC.
+    SPDX-License-Identifier: Apache-2.0 */
+
+    const form = document.querySelector("form");
+    const saveAddressButton = document.querySelector("button#save-address");
+    const submitInput = document.querySelector("input#submit");
+
+    form.addEventListener("submit", handleFormSubmission);
+
+    function handleFormSubmission(event) {
+      event.preventDefault();
+      // validate();
+      form.reportValidity();
+      if (form.checkValidity() === false) {
+        // Handle invalid form data.
+      } else {
+        // On a production site do form submission.
+        saveAddressButton.textContent = "Saving...";
+        saveAddressButton.disabled = "true";
+        submitInput.value = "Saving...";
+        submitInput.disabled = "true";
+        form.submit();
+      }
+    }
+
+    // Do form validation.
+    function validate() {
+      let message = "";
+      // if (!/someregex/.test(someInput.value)) {
+      //   console.log(`Invalid value ${someInput.value} for someInput`);
+      // message = 'Explain how to enter a valid value';
+      // }
+      // someInput.setCustomValidity(message);
+    }
+
+  </script>
+
+</head>
+
+<body>
+
+  <main>
+
+    <form id="form" name="form">
+
+      <h1>Address form</h1>
+
+      <section>
+        <label for="name">Name</label>
+        <input id="name" name="name" autocomplete="name" maxlength="100" pattern="[\p{L} \-\.]+" required>
+      </section>
+
+      <section>
+        <label for="address">Address</label>
+        <textarea id="address" name="address" autocomplete="address" maxlength="300" required></textarea>
+      </section>
+
+      <!-- Alternative address format -->
+      <!--
+      <section>
+        <label for="address-line1">Address line 1</label>
+        <input required="" autocomplete="address-line1" id="address-line1" name="address-line1">
+      </section>
+
+      <section>
+        <label for="address-line2">Address line 2</label>
+        <input autocomplete="address-line2" id="address-line2" name="address-line2">
+      </section>
+      -->
+
+      <section>
+        <label for="postal-code">ZIP or postal code (optional)</label>
+        <input id="postal-code" name="postal-code" autocomplete="postal-code" maxlength="20">
+      </section>
+
+      <section id="country-region">
+        <label for="country">Country or region</label>
+        <select id="country" name="country" autocomplete="country" enterkeyhint="done" required>
+          <option selected value="SPACER"> </option>
+          <option value="AF">Afghanistan</option>
+          <option value="AX">Åland Islands</option>
+          <option value="AL">Albania</option>
+          <option value="DZ">Algeria</option>
+          <option value="AS">American Samoa</option>
+          <option value="AD">Andorra</option>
+          <option value="AO">Angola</option>
+          <option value="AI">Anguilla</option>
+          <option value="AQ">Antarctica</option>
+          <option value="AG">Antigua &amp; Barbuda</option>
+          <option value="AR">Argentina</option>
+          <option value="AM">Armenia</option>
+          <option value="AW">Aruba</option>
+          <option value="AC">Ascension Island</option>
+          <option value="AU">Australia</option>
+          <option value="AT">Austria</option>
+          <option value="AZ">Azerbaijan</option>
+          <option value="BS">Bahamas</option>
+          <option value="BH">Bahrain</option>
+          <option value="BD">Bangladesh</option>
+          <option value="BB">Barbados</option>
+          <option value="BY">Belarus</option>
+          <option value="BE">Belgium</option>
+          <option value="BZ">Belize</option>
+          <option value="BJ">Benin</option>
+          <option value="BM">Bermuda</option>
+          <option value="BT">Bhutan</option>
+          <option value="BO">Bolivia</option>
+          <option value="BA">Bosnia &amp; Herzegovina</option>
+          <option value="BW">Botswana</option>
+          <option value="BV">Bouvet Island</option>
+          <option value="BR">Brazil</option>
+          <option value="IO">British Indian Ocean Territory</option>
+          <option value="VG">British Virgin Islands</option>
+          <option value="BN">Brunei</option>
+          <option value="BG">Bulgaria</option>
+          <option value="BF">Burkina Faso</option>
+          <option value="BI">Burundi</option>
+          <option value="KH">Cambodia</option>
+          <option value="CM">Cameroon</option>
+          <option value="CA">Canada</option>
+          <option value="CV">Cape Verde</option>
+          <option value="BQ">Caribbean Netherlands</option>
+          <option value="KY">Cayman Islands</option>
+          <option value="CF">Central African Republic</option>
+          <option value="TD">Chad</option>
+          <option value="CL">Chile</option>
+          <option value="CN">China</option>
+          <option value="CX">Christmas Island</option>
+          <option value="CC">Cocos (Keeling) Islands</option>
+          <option value="CO">Colombia</option>
+          <option value="KM">Comoros</option>
+          <option value="CG">Congo - Brazzaville</option>
+          <option value="CD">Congo - Kinshasa</option>
+          <option value="CK">Cook Islands</option>
+          <option value="CR">Costa Rica</option>
+          <option value="CI">Côte d’Ivoire</option>
+          <option value="HR">Croatia</option>
+          <option value="CW">Curaçao</option>
+          <option value="CY">Cyprus</option>
+          <option value="CZ">Czechia</option>
+          <option value="DK">Denmark</option>
+          <option value="DJ">Djibouti</option>
+          <option value="DM">Dominica</option>
+          <option value="DO">Dominican Republic</option>
+          <option value="EC">Ecuador</option>
+          <option value="EG">Egypt</option>
+          <option value="SV">El Salvador</option>
+          <option value="GQ">Equatorial Guinea</option>
+          <option value="ER">Eritrea</option>
+          <option value="EE">Estonia</option>
+          <option value="SZ">Eswatini</option>
+          <option value="ET">Ethiopia</option>
+          <option value="FK">Falkland Islands (Islas Malvinas)</option>
+          <option value="FO">Faroe Islands</option>
+          <option value="FJ">Fiji</option>
+          <option value="FI">Finland</option>
+          <option value="FR">France</option>
+          <option value="GF">French Guiana</option>
+          <option value="PF">French Polynesia</option>
+          <option value="TF">French Southern Territories</option>
+          <option value="GA">Gabon</option>
+          <option value="GM">Gambia</option>
+          <option value="GE">Georgia</option>
+          <option value="DE">Germany</option>
+          <option value="GH">Ghana</option>
+          <option value="GI">Gibraltar</option>
+          <option value="GR">Greece</option>
+          <option value="GL">Greenland</option>
+          <option value="GD">Grenada</option>
+          <option value="GP">Guadeloupe</option>
+          <option value="GU">Guam</option>
+          <option value="GT">Guatemala</option>
+          <option value="GG">Guernsey</option>
+          <option value="GN">Guinea</option>
+          <option value="GW">Guinea-Bissau</option>
+          <option value="GY">Guyana</option>
+          <option value="HT">Haiti</option>
+          <option value="HM">Heard &amp; McDonald Islands</option>
+          <option value="HN">Honduras</option>
+          <option value="HK">Hong Kong</option>
+          <option value="HU">Hungary</option>
+          <option value="IS">Iceland</option>
+          <option value="IN">India</option>
+          <option value="ID">Indonesia</option>
+          <option value="IR">Iran</option>
+          <option value="IQ">Iraq</option>
+          <option value="IE">Ireland</option>
+          <option value="IM">Isle of Man</option>
+          <option value="IL">Israel</option>
+          <option value="IT">Italy</option>
+          <option value="JM">Jamaica</option>
+          <option value="JP">Japan</option>
+          <option value="JE">Jersey</option>
+          <option value="JO">Jordan</option>
+          <option value="KZ">Kazakhstan</option>
+          <option value="KE">Kenya</option>
+          <option value="KI">Kiribati</option>
+          <option value="XK">Kosovo</option>
+          <option value="KW">Kuwait</option>
+          <option value="KG">Kyrgyzstan</option>
+          <option value="LA">Laos</option>
+          <option value="LV">Latvia</option>
+          <option value="LB">Lebanon</option>
+          <option value="LS">Lesotho</option>
+          <option value="LR">Liberia</option>
+          <option value="LY">Libya</option>
+          <option value="LI">Liechtenstein</option>
+          <option value="LT">Lithuania</option>
+          <option value="LU">Luxembourg</option>
+          <option value="MO">Macao</option>
+          <option value="MG">Madagascar</option>
+          <option value="MW">Malawi</option>
+          <option value="MY">Malaysia</option>
+          <option value="MV">Maldives</option>
+          <option value="ML">Mali</option>
+          <option value="MT">Malta</option>
+          <option value="MH">Marshall Islands</option>
+          <option value="MQ">Martinique</option>
+          <option value="MR">Mauritania</option>
+          <option value="MU">Mauritius</option>
+          <option value="YT">Mayotte</option>
+          <option value="MX">Mexico</option>
+          <option value="FM">Micronesia</option>
+          <option value="MD">Moldova</option>
+          <option value="MC">Monaco</option>
+          <option value="MN">Mongolia</option>
+          <option value="ME">Montenegro</option>
+          <option value="MS">Montserrat</option>
+          <option value="MA">Morocco</option>
+          <option value="MZ">Mozambique</option>
+          <option value="MM">Myanmar (Burma)</option>
+          <option value="NA">Namibia</option>
+          <option value="NR">Nauru</option>
+          <option value="NP">Nepal</option>
+          <option value="NL">Netherlands</option>
+          <option value="NC">New Caledonia</option>
+          <option value="NZ">New Zealand</option>
+          <option value="NI">Nicaragua</option>
+          <option value="NE">Niger</option>
+          <option value="NG">Nigeria</option>
+          <option value="NU">Niue</option>
+          <option value="NF">Norfolk Island</option>
+          <option value="KP">North Korea</option>
+          <option value="MK">North Macedonia</option>
+          <option value="MP">Northern Mariana Islands</option>
+          <option value="NO">Norway</option>
+          <option value="OM">Oman</option>
+          <option value="PK">Pakistan</option>
+          <option value="PW">Palau</option>
+          <option value="PS">Palestine</option>
+          <option value="PA">Panama</option>
+          <option value="PG">Papua New Guinea</option>
+          <option value="PY">Paraguay</option>
+          <option value="PE">Peru</option>
+          <option value="PH">Philippines</option>
+          <option value="PN">Pitcairn Islands</option>
+          <option value="PL">Poland</option>
+          <option value="PT">Portugal</option>
+          <option value="PR">Puerto Rico</option>
+          <option value="QA">Qatar</option>
+          <option value="RE">Réunion</option>
+          <option value="RO">Romania</option>
+          <option value="RU">Russia</option>
+          <option value="RW">Rwanda</option>
+          <option value="WS">Samoa</option>
+          <option value="SM">San Marino</option>
+          <option value="ST">São Tomé &amp; Príncipe</option>
+          <option value="SA">Saudi Arabia</option>
+          <option value="SN">Senegal</option>
+          <option value="RS">Serbia</option>
+          <option value="SC">Seychelles</option>
+          <option value="SL">Sierra Leone</option>
+          <option value="SG">Singapore</option>
+          <option value="SX">Sint Maarten</option>
+          <option value="SK">Slovakia</option>
+          <option value="SI">Slovenia</option>
+          <option value="SB">Solomon Islands</option>
+          <option value="SO">Somalia</option>
+          <option value="ZA">South Africa</option>
+          <option value="GS">South Georgia &amp; South Sandwich Islands</option>
+          <option value="KR">South Korea</option>
+          <option value="SS">South Sudan</option>
+          <option value="ES">Spain</option>
+          <option value="LK">Sri Lanka</option>
+          <option value="BL">St Barthélemy</option>
+          <option value="SH">St Helena</option>
+          <option value="KN">St Kitts &amp; Nevis</option>
+          <option value="LC">St Lucia</option>
+          <option value="MF">St Martin</option>
+          <option value="PM">St Pierre &amp; Miquelon</option>
+          <option value="VC">St Vincent &amp; Grenadines</option>
+          <option value="SR">Suriname</option>
+          <option value="SJ">Svalbard &amp; Jan Mayen</option>
+          <option value="SE">Sweden</option>
+          <option value="CH">Switzerland</option>
+          <option value="TW">Taiwan</option>
+          <option value="TJ">Tajikistan</option>
+          <option value="TZ">Tanzania</option>
+          <option value="TH">Thailand</option>
+          <option value="TL">Timor-Leste</option>
+          <option value="TG">Togo</option>
+          <option value="TK">Tokelau</option>
+          <option value="TO">Tonga</option>
+          <option value="TT">Trinidad &amp; Tobago</option>
+          <option value="TA">Tristan da Cunha</option>
+          <option value="TN">Tunisia</option>
+          <option value="TR">Turkey</option>
+          <option value="TM">Turkmenistan</option>
+          <option value="TC">Turks &amp; Caicos Islands</option>
+          <option value="TV">Tuvalu</option>
+          <option value="UG">Uganda</option>
+          <option value="UA">Ukraine</option>
+          <option value="AE">United Arab Emirates</option>
+          <option value="GB">United Kingdom</option>
+          <option value="US">United States</option>
+          <option value="UY">Uruguay</option>
+          <option value="UM">US Outlying Islands</option>
+          <option value="VI">US Virgin Islands</option>
+          <option value="UZ">Uzbekistan</option>
+          <option value="VU">Vanuatu</option>
+          <option value="VA">Vatican City</option>
+          <option value="VE">Venezuela</option>
+          <option value="VN">Vietnam</option>
+          <option value="WF">Wallis &amp; Futuna</option>
+          <option value="EH">Western Sahara</option>
+          <option value="YE">Yemen</option>
+          <option value="ZM">Zambia</option>
+          <option value="ZW">Zimbabwe</option>
+        </select>
+      </section>
+
+      <section>
+        <label for="tel">Telephone</label>
+        <input id="tel" name="tel" autocomplete="tel" type="tel" maxlength="30" pattern="[\d \-\+]+" required>
+      </section>
+      <input type="submit" value="Submit" id="submit">
+      <!--       <button id="save-address" type="submit">Save address</button> -->
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/guide.md`
> ```suggestion
> description: Use CSS to clearly highlight form fields that have been autofilled by the browsers and not edited by the user.
> ```
> 
> Nit: should we say "form fields" instead of "input" since autofill works with `<select>` elements as well?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,6 @@
+---
+name: autofill-highlight-inputs
+description: Use CSS to clearly highlight inputs that have been autofilled by the browsers and not edited by the user.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/expectations.md`
> Both <input> and `<select>` right?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+# Expectations: `autofill-highlight-inputs`
+
+- In browsers that support the `:autofill` CSS pseudo-class, the `:autofill` CSS pseudo-class can be used to style autofilled `<input>` elements as required. JavaScript or other mechanisms SHOULD NOT be used to style autofilled `<input>` elements in browsers where the `:autofill` CSS pseudo-class is supported.
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Maybe add a comment explaining why this is here?
> 
> Also, is it reliable to assume that `:-webkit-autofill` will always match the same elements as `:autofill`? I think it'd be better to define all styles on both rather than define all `border` styles on the legacy selector and then only override the `border-style` property on `:autofill`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,606 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>:autofill highlight inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <!-- <link rel="stylesheet" href="css/main.css"> -->
+  <!-- <script src="js/main.js" defer></script> -->
+
+  <style>
+    /* Copyright 2026 Google LLC.
+    SPDX-License-Identifier: Apache-2.0 */
+
+    :root {
+      --small-mobile-font-size: 20px;
+      --large-mobile-font-size: 22px;
+      --desktop-font-size: 22px;
+    }
+
+    :-webkit-autofill {
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> ```suggestion
>     /*box-shadow: 0 0 0 100vmax #efe inset;*/
> ```
> Use `100vmax` instead just to be safe? Also switched just `box-shadow`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>Highlight :autofill inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <style>
+  * {
+    font-family: sans-serif;
+  }
+  input {
+    border: 2px solid;
+    border-color: #cccccc;
+    border-radius: 2px;
+    margin: 0 0 2rem 0;
+    padding: 0.5rem;
+  }
+  input#submit {
+    cursor: pointer;
+    font-size: 16px;
+    font-weight: 800;
+  }
+  label {
+    display: block;
+    font-weight: 500;
+    margin: 0 0 0.5rem 0;
+  }
+  input:autofill,
+  input:-webkit-autofill,
+  input:-webkit-autofill,
+  input:-webkit-autofill:hover,
+  input:-webkit-autofill:focus {
+    /*-webkit-box-shadow: 0 0 0px 40rem #efe inset;*/
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/demo.html`
> Also, per may comment in https://github.com/GoogleChrome/guidance/pull/134#issuecomment-3987730598, I'd keep this here (commented out) and add a comment above it explaining that `box-shadow` can be used customize the background, given that `background` can't be overridden directly.
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+<!-- Copyright 2026 Google LLC.
+SPDX-License-Identifier: Apache-2.0 -->
+
+<!DOCTYPE html>
+<html lang="en">
+
+<head>
+  <title>Highlight :autofill inputs</title>
+  <meta charset="utf-8">
+  <meta http-equiv="X-UA-Compatible" content="IE=edge">
+  <meta name="viewport" content="width=device-width, initial-scale=1">
+
+  <style>
+  * {
+    font-family: sans-serif;
+  }
+  input {
+    border: 2px solid;
+    border-color: #cccccc;
+    border-radius: 2px;
+    margin: 0 0 2rem 0;
+    padding: 0.5rem;
+  }
+  input#submit {
+    cursor: pointer;
+    font-size: 16px;
+    font-weight: 800;
+  }
+  label {
+    display: block;
+    font-weight: 500;
+    margin: 0 0 0.5rem 0;
+  }
+  input:autofill,
+  input:-webkit-autofill,
+  input:-webkit-autofill,
+  input:-webkit-autofill:hover,
+  input:-webkit-autofill:focus {
+    /*-webkit-box-shadow: 0 0 0px 40rem #efe inset;*/
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/guide.md`
> Looks like this merge conflict got left in.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: autofill-highlight-inputs
+<<<<<<< HEAD
```

</details>

#### **philipwalton** on `guides/user-experience/autofill-highlight-inputs/prompts.md`
> Optional: you might even add another, more specific prompt asking to style both the border and background color of an autofilled-input, because if we want to recommend that then we should have an eval that tests that the AI tool can use `box-shadow` as an alternative to `background`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,5 @@
+Add code to highlight autofilled form inputs.
+
+Use the `:autofill` CSS pseudo-class.
+
+Use CSS to highlight form fields that have been autofilled by the browser and not edited by the user.
```

</details>

---

## PR #296: Add a guide for deferring heavy content rendering

### Reviews

#### **philipwalton** (COMMENTED)
> Thanks! This mostly LGTM. Were you planning to add prompts and expectations in this PR?

#### **philipwalton** (APPROVED)
> LGTM, once a few minor comments are addressed.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Should this be included in the numbered instructions above? Also, should you explain when it makes sense to set a number value vs. use "auto"?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,124 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles—can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` and provide an estimated height or width using `contain-intrinsic-size`.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> @rviscomi is this how these widgets are expected to be used (separated from the content), or should they be used inline in the text?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,124 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles—can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` and provide an estimated height or width using `contain-intrinsic-size`.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
+  contain-intrinsic-size: 0px 500px; 
+}
+```
+
+## How to implement `content-visibility: hidden`
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply CSS:** Add `content-visibility: hidden` to the element.
+3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.
+
+### Example code
+
+```css
+.cached-view {
+  /* Hides content but caches rendering state */
+  content-visibility: hidden;
+}
+
+.cached-view.is-active {
+  content-visibility: visible;
+}
+```
+
+Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. For searchable hidden content, use `hidden="until-found"`.
+
+## How to implement `hidden="until-found"`
+  
+The `hidden="until-found"` attribute forces the browser to apply an internal `content-visibility: hidden` rule. This hides content until a user utilizes "Find in page" or navigates via document fragments directly into the container.
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply the attribute:** Add `hidden="until-found"` directly onto the collapsible container element.
+3. **Handle state synchronization:** If reveal states require DOM updates (such as toggling an aria-expanded attribute or rotating a chevron icon), use the `beforematch` event listener.
+
+### Example code
+
+```html
+<div class="heavy-section" hidden="until-found">
+  <p>Heavy content.</p>
+</div>
+```
+
+```javascript
+// Optional: Handle state synchronization
+const heavySection = document.querySelector('.heavy-section');
+
+heavySection.addEventListener('beforematch', (event) => {
+  // Logic to execute immediately before the browser reveals the match
+});
+```
+
+## Best Practices
+
+- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
+- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
+- **DO NOT** apply standard `display: none` or `visibility: hidden` to elements designed to use `hidden="until-found"`, as this permanently excludes them from search discovery.
+- **DO** verify that `hidden="until-found"` handles interactive states gracefully on trigger.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> ```suggestion
> When `hidden="until-found` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,124 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles—can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` and provide an estimated height or width using `contain-intrinsic-size`.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
+  contain-intrinsic-size: 0px 500px; 
+}
+```
+
+## How to implement `content-visibility: hidden`
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply CSS:** Add `content-visibility: hidden` to the element.
+3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.
+
+### Example code
+
+```css
+.cached-view {
+  /* Hides content but caches rendering state */
+  content-visibility: hidden;
+}
+
+.cached-view.is-active {
+  content-visibility: visible;
+}
+```
+
+Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. For searchable hidden content, use `hidden="until-found"`.
+
+## How to implement `hidden="until-found"`
+  
+The `hidden="until-found"` attribute forces the browser to apply an internal `content-visibility: hidden` rule. This hides content until a user utilizes "Find in page" or navigates via document fragments directly into the container.
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply the attribute:** Add `hidden="until-found"` directly onto the collapsible container element.
+3. **Handle state synchronization:** If reveal states require DOM updates (such as toggling an aria-expanded attribute or rotating a chevron icon), use the `beforematch` event listener.
+
+### Example code
+
+```html
+<div class="heavy-section" hidden="until-found">
+  <p>Heavy content.</p>
+</div>
+```
+
+```javascript
+// Optional: Handle state synchronization
+const heavySection = document.querySelector('.heavy-section');
+
+heavySection.addEventListener('beforematch', (event) => {
+  // Logic to execute immediately before the browser reveals the match
+});
+```
+
+## Best Practices
+
+- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
+- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
+- **DO NOT** apply standard `display: none` or `visibility: hidden` to elements designed to use `hidden="until-found"`, as this permanently excludes them from search discovery.
+- **DO** verify that `hidden="until-found"` handles interactive states gracefully on trigger.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
+
+{{ BASELINE_STATUS("hidden-until-found") }}
+
+### `content-visibility` fallback
+
+When `content-visibility` is not supported it will be ignored by the browser. In most cases `content-visibility: auto` will not need a fallback, though without it performance gains will be lost. An unsupported browser will leave `content-visibility: hidden` elements completely visible. Use feature detection to implement a fallback.
+
+```css
+/* Default for everyone */
+.inactive {
+  display: none;
+}
+
+/* Modern Browsers only */
+@supports (content-visibility: hidden) {
+ .inactive {
+    display: block; /* Turn the layout box back on */
+    content-visibility: hidden;
+  }
+}
+```
+
+### `hidden="until-found"` fallback
+When `hidden="until-found` is not supported elements will remain hidden.Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Can you update this comment and explain why these specific values were chosen? I wouldn't want AI tools to just blindly copy/paste these values, thinking they're a best practice.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,129 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` to each off-screen element.
+3. **Provide an estimated height or width:** Add `contain-intrinsic-size` to each off-screen element.
+
+### How to use `contain-intrinsic-size`
+
+The `contain-intrinsic-size` CSS shorthand property allows you to provide an estimated height and/or width for an element. This can be used to prevent layout shifts and visual glitches when the user scrolls to the element. The `auto` keyword can be paired with a length value for the browser to remember the size of the element when it is rendered and use the "remembered" size on the next render.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> ```suggestion
> When `hidden="until-found"` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,129 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` to each off-screen element.
+3. **Provide an estimated height or width:** Add `contain-intrinsic-size` to each off-screen element.
+
+### How to use `contain-intrinsic-size`
+
+The `contain-intrinsic-size` CSS shorthand property allows you to provide an estimated height and/or width for an element. This can be used to prevent layout shifts and visual glitches when the user scrolls to the element. The `auto` keyword can be paired with a length value for the browser to remember the size of the element when it is rendered and use the "remembered" size on the next render.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
+  contain-intrinsic-size: auto none auto 500px; 
+}
+```
+
+## How to implement `content-visibility: hidden`
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply CSS:** Add `content-visibility: hidden` to the element.
+3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.
+
+### Example code
+
+```css
+.cached-view {
+  /* Hides content but caches rendering state */
+  content-visibility: hidden;
+}
+
+.cached-view.is-active {
+  content-visibility: visible;
+}
+```
+
+Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. For searchable hidden content, use `hidden="until-found"`.
+
+## How to implement `hidden="until-found"`
+  
+The `hidden="until-found"` attribute forces the browser to apply an internal `content-visibility: hidden` rule. This hides content until a user utilizes "Find in page" or navigates via document fragments directly into the container.
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply the attribute:** Add `hidden="until-found"` directly onto the collapsible container element.
+3. **Handle state synchronization:** If reveal states require DOM updates (such as toggling an aria-expanded attribute or rotating a chevron icon), use the `beforematch` event listener.
+
+### Example code
+
+```html
+<div class="heavy-section" hidden="until-found">
+  <p>Heavy content.</p>
+</div>
+```
+
+```javascript
+// Optional: Handle state synchronization
+const heavySection = document.querySelector('.heavy-section');
+
+heavySection.addEventListener('beforematch', (event) => {
+  // Logic to execute immediately before the browser reveals the match
+});
+```
+
+## Best Practices
+
+- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
+- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
+- **DO NOT** apply standard `display: none` or `visibility: hidden` to elements designed to use `hidden="until-found"`, as this permanently excludes them from search discovery.
+- **DO** verify that `hidden="until-found"` handles interactive states gracefully on trigger.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
+
+{{ BASELINE_STATUS("hidden-until-found") }}
+
+### `content-visibility` fallback
+
+When `content-visibility` is not supported it will be ignored by the browser. In most cases `content-visibility: auto` will not need a fallback, though without it performance gains will be lost. An unsupported browser will leave `content-visibility: hidden` elements completely visible. Use feature detection to implement a fallback.
+
+```css
+/* Default for everyone */
+.inactive {
+  display: none;
+}
+
+/* Modern Browsers only */
+@supports (content-visibility: hidden) {
+ .inactive {
+    display: block; /* Turn the layout box back on */
+    content-visibility: hidden;
+  }
+}
+```
+
+### `hidden="until-found"` fallback
+When `hidden="until-found` is not supported elements will remain hidden. Use feature detection targeting `onbeforematch` and extract or reveal content accordingly.
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/demo.html`
> @taraojo FYI I added this to match the guide, but wanted to confirm this is correct.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -152,7 +152,7 @@
 
     .below-fold-cv {
       content-visibility: auto;
-      contain-intrinsic-size: 1000px;
+      contain-intrinsic-size: auto none auto 1000px;
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/demo.html`
> AI review caught this, and I think changing it to false is correct, right?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -221,7 +221,7 @@ <h2>Example 3: Searchable & Deferred (hidden="until-found")</h2>
         <p><strong>Try it out!</strong> Hit Cmd/Ctrl+F and search for the magic word: <code
             style="font-size:1.2rem; color: #d97706; background: #fffbeb; padding: 2px 6px; border-radius: 4px;">Supercalifragilisticexpialidocious</code>.
           If it is hidden, the browser will automatically reveal this entire section!</p>
-        <button class="btn" id="toggle-btn-3" aria-expanded="true">Show Dashboard</button>
+        <button class="btn" id="toggle-btn-3" aria-expanded="false">Show Dashboard</button>
```

</details>

#### **rviscomi** on `guides/performance/defer-rendering-heavy-content/guide.md`
> It's ok to have them on their own lines, but yeah the expectation is to have them under their respective subsections. So this one should be moved within the ```### `content-visibility` fallback``` section.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,124 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles—can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` and provide an estimated height or width using `contain-intrinsic-size`.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
+  contain-intrinsic-size: 0px 500px; 
+}
+```
+
+## How to implement `content-visibility: hidden`
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply CSS:** Add `content-visibility: hidden` to the element.
+3. **Reveal the element:** When the element should be revealed, change the `content-visibility` property to `visible` or `auto`.
+
+### Example code
+
+```css
+.cached-view {
+  /* Hides content but caches rendering state */
+  content-visibility: hidden;
+}
+
+.cached-view.is-active {
+  content-visibility: visible;
+}
+```
+
+Because `content-visibility: hidden` excludes the element and its children from the accessibility tree and find-in-page search, **DO NOT** use it if the content must remain discoverable while hidden. For searchable hidden content, use `hidden="until-found"`.
+
+## How to implement `hidden="until-found"`
+  
+The `hidden="until-found"` attribute forces the browser to apply an internal `content-visibility: hidden` rule. This hides content until a user utilizes "Find in page" or navigates via document fragments directly into the container.
+
+1. **Identify heavy sections:** Locate layout blocks that are initially hidden (e.g., extra rows in a large data table).
+2. **Apply the attribute:** Add `hidden="until-found"` directly onto the collapsible container element.
+3. **Handle state synchronization:** If reveal states require DOM updates (such as toggling an aria-expanded attribute or rotating a chevron icon), use the `beforematch` event listener.
+
+### Example code
+
+```html
+<div class="heavy-section" hidden="until-found">
+  <p>Heavy content.</p>
+</div>
+```
+
+```javascript
+// Optional: Handle state synchronization
+const heavySection = document.querySelector('.heavy-section');
+
+heavySection.addEventListener('beforematch', (event) => {
+  // Logic to execute immediately before the browser reveals the match
+});
+```
+
+## Best Practices
+
+- **DO** use `contain-intrinsic-size` with `content-visibility: auto`. Failure to do so forces height recalculations on scroll, causing viewport layout jumping or visual glitches.
+- **DO NOT** apply `content-visibility: auto` to elements inside the initial fold viewport, as this delays critical page rendering.
+- **DO NOT** apply standard `display: none` or `visibility: hidden` to elements designed to use `hidden="until-found"`, as this permanently excludes them from search discovery.
+- **DO** verify that `hidden="until-found"` handles interactive states gracefully on trigger.
+
+## Browser support and fallback strategies
+
+{{ BASELINE_STATUS("content-visibility") }}
```

</details>

#### **philipwalton** on `guides/performance/defer-rendering-heavy-content/guide.md`
> Yep, this is very clear, thanks! Feel free to merge when ready.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -5,3 +5,129 @@ web-feature-ids:
   - hidden-until-found
   - content-visibility
 ---
+
+# Defer rendering heavy content
+
+Web pages with extensive content—such as infinite scrolls, complex dashboards, or dense articles can suffer from slow initial rendering and sluggish interactions. Modern web technologies allow you to defer the rendering workload for content that is not immediately visible, significantly boosting performance without breaking accessibility or user expectations.
+
+To optimize rendering, you can utilize the CSS `content-visibility` property and the HTML `hidden="until-found"` attribute. While both aid performance, they serve distinct use cases.
+
+## When to use which
+
+| Scenario / Example | Feature Applied | Performance Benefit |
+| :--- | :--- | :--- |
+| **1. Below the fold** (Delay initial load) | **`content-visibility: auto`** | Browser automatically offloads layout/paint workload until the container scrolls close to view, keeping standard page load speed frictionless. |
+| **2. Toggle State** (Fast view switching) | **`content-visibility: hidden`** | Skips layout calculations for hidden divs but preserves style containment state, allowing for instantaneous toggling without structural shifts (superior to `display: none`). |
+| **3. Searchable & Deferred** (Collapsible specs/FAQ) | **`hidden="until-found"`** | Same benefits as previous, defers load-time rendering fully, but remains searchable via native Find-in-page. The browser automatically unhides and scrolls to the target on match. |
+
+## How to implement `content-visibility: auto`
+
+1. **Identify heavy sections:** Locate large, self-contained layout blocks that are initially off-screen (e.g., card items in an infinite feed).
+2. **Apply CSS:** Add `content-visibility: auto` to each off-screen element.
+3. **Provide an estimated height or width:** Add `contain-intrinsic-size` to each off-screen element.
+
+### How to use `contain-intrinsic-size`
+
+The `contain-intrinsic-size` CSS shorthand property allows you to provide an estimated height and/or width for an element. This can be used to prevent layout shifts and visual glitches when the user scrolls to the element. The `auto` keyword can be paired with a length value for the browser to remember the size of the element when it is rendered and use the "remembered" size on the next render.
+
+### Example code
+
+```css
+.heavy-section {
+  /* Skips rendering calculations when off-screen */
+  content-visibility: auto;
+  
+  /* Mandatory: Provide an estimated height to prevent layouts shifts */
```

</details>

---

## PR #134: Add guide: `autofill-background-color`

### Reviews

#### **philipwalton** (COMMENTED)
> This seems like it's basically the same use case as #132, just with background instead of border, correct? If so I'd recommend combining them (unless there's a good reason not to?).

---

## PR #503: #253 precise-text-alignment

### Reviews

#### **malchata** (APPROVED)
> Small changes. I'll approve to unblock in case these are not major issues, though, but the guide LGTM overall.

#### **rviscomi** (APPROVED)
*(No review body)*

### Comments

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> ```suggestion
> ### Fallback strategies
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,108 @@ name: precise-text-alignment
 description: Achieve precise vertical alignment with text of any font. For example, exactly equal visual padding above and below text, or aligning text perfectly flush with adjacent icons or images.
 web-feature-ids:
   - text-box
+sources:
+  - https://developer.chrome.com/blog/css-text-box-trim
+  - https://webkit.org/blog/16301/webkit-features-in-safari-18-2/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim
 ---
+
+# Precise Text Alignment
+
+## The Problem
+
+Browsers automatically add extra whitespace above and below text characters to accommodate line-height and font-specific metrics like ascenders and descenders. This "ghost space" makes it impossible to achieve pixel-perfect vertical alignment using standard CSS.
+
+Common issues include:
+- **Misaligned Icons**: Text appears visually lower or higher than an adjacent icon even when using `align-items: center`.
+- **Inaccurate Padding**: A button with `padding: 12px` visually appears to have more space on top or bottom because of the font's internal leading.
+- **Flush Alignment**: You cannot align the top of a capital letter exactly with the top of a container or an adjacent image without using "magic number" negative margins.
+
+## The Solution
+
+The `text-box-trim` and `text-box-edge` properties (shorthand `text-box`) allow you to trim this internal leading based on specific font metrics. By trimming the text box to the **cap-height** (top of capital letters) and the **alphabetic baseline** (bottom of most letters), you can ensure that the element's bounding box matches its visual content.
+
+### Implementation Strategy
+
+1. **MANDATORY**: Apply `text-box-trim: trim-both` (or the `text-box` shorthand) to the element containing the text.
+2. **MANDATORY**: Specify which metrics to use for trimming with `text-box-edge`. For most UI alignment, use `cap alphabetic`.
+3. **DO** use this to achieve visual vertical centering in flex or grid containers.
+4. **DO** use it to ensure that your CSS `padding` values match the visual gap between the text and the container edge.
+5. **DO NOT** use it on long-form body text where traditional line-spacing is necessary for readability. It is best suited for headings, buttons, and UI labels.
+
+## Implementation Guide
+
+### Use case 1: Trim internal leading for badges
+
+Different fonts have different amounts of built-in spacing above and below the text. This can provide challenges in matching a design, or in visually centering text in a badge. When you want a container's padding to exactly hug the text, use `text-box: trim-both cap alphabetic`. This is especially useful for dense UI components like badges or tags. This allows the padding to start right at the text edge on all sides.
+
+```css
+.badge {
+  padding: 10px;
+  background: hotpink;
+  border-radius: 10px;
+  /* 
+    Trims the top to the cap-height and 
+    the bottom to the alphabetic baseline.
+  */
+  text-box: trim-both cap alphabetic;
+}
+```
+
+### Use case 2: Center text with icons
+
+When using Flexbox to align text and icons, the "ghost space" often makes the text look slightly off-center. Trimming the box ensures the layout engine uses the actual visible letter height for alignment.
+
+```css
+.button {
+  display: inline-flex;
+  align-items: center;
+  gap: 8px; 
+}
+/* 
+  text-box does NOT inherit, and must be applied directly to the text element.
+*/
+.button-text{
+  /* 
+    The flex container now centers against the 
+    visible letters, not the invisible font box.
+  */
+  text-box: trim-both cap alphabetic;
+}
+```
+
+### Use case 3: Align text flush with top edges
+
+To align a heading perfectly with the top of an adjacent image or decorative element, use `trim-start cap alphabetic`. Even though the end will not be trimmed, the end edge must be defined.
+
+```css
+.hero {
+  display: flex;
+  align-items: flex-start;
+}
+
+h1 {
+  /* Only trim the top to the cap-height */
+  text-box-trim: trim-start;
+  /* The bottom edge must also be defined, even though `text-box-trim` is set to `trim-start` */
+  text-box-edge: cap alphabetic;
+}
+```
+
+## Best Practices
+
+- **DO** use the `text-box` shorthand for conciseness: `text-box: <trim-direction> <edges>`.
+- **DO** always specify both edges, even if only one edge is being trimmed (unless using the default `text` edge).
+- **DO** combine with `line-height` for controlled spacing. Trimming removes the leading before the first and last line of text, but `line-height` still affects the distance between lines in multi-line text.
+- **DO NOT** apply to every element. Use it only where precision alignment is a requirement.
+
+## Fallback Strategies
```

</details>

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> Gemini suggests adding `**DO**`, `**DO NOT**`, or `**MANDATORY**` to code comments, but I do recall @rviscomi saying that may not be necessary. IMO, I don't think it's needed here, but Gemini keeps calling these kinds of things out.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,108 @@ name: precise-text-alignment
 description: Achieve precise vertical alignment with text of any font. For example, exactly equal visual padding above and below text, or aligning text perfectly flush with adjacent icons or images.
 web-feature-ids:
   - text-box
+sources:
+  - https://developer.chrome.com/blog/css-text-box-trim
+  - https://webkit.org/blog/16301/webkit-features-in-safari-18-2/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim
 ---
+
+# Precise Text Alignment
+
+## The Problem
+
+Browsers automatically add extra whitespace above and below text characters to accommodate line-height and font-specific metrics like ascenders and descenders. This "ghost space" makes it impossible to achieve pixel-perfect vertical alignment using standard CSS.
+
+Common issues include:
+- **Misaligned Icons**: Text appears visually lower or higher than an adjacent icon even when using `align-items: center`.
+- **Inaccurate Padding**: A button with `padding: 12px` visually appears to have more space on top or bottom because of the font's internal leading.
+- **Flush Alignment**: You cannot align the top of a capital letter exactly with the top of a container or an adjacent image without using "magic number" negative margins.
+
+## The Solution
+
+The `text-box-trim` and `text-box-edge` properties (shorthand `text-box`) allow you to trim this internal leading based on specific font metrics. By trimming the text box to the **cap-height** (top of capital letters) and the **alphabetic baseline** (bottom of most letters), you can ensure that the element's bounding box matches its visual content.
+
+### Implementation Strategy
+
+1. **MANDATORY**: Apply `text-box-trim: trim-both` (or the `text-box` shorthand) to the element containing the text.
+2. **MANDATORY**: Specify which metrics to use for trimming with `text-box-edge`. For most UI alignment, use `cap alphabetic`.
+3. **DO** use this to achieve visual vertical centering in flex or grid containers.
+4. **DO** use it to ensure that your CSS `padding` values match the visual gap between the text and the container edge.
+5. **DO NOT** use it on long-form body text where traditional line-spacing is necessary for readability. It is best suited for headings, buttons, and UI labels.
+
+## Implementation Guide
+
+### Use case 1: Trim internal leading for badges
+
+Different fonts have different amounts of built-in spacing above and below the text. This can provide challenges in matching a design, or in visually centering text in a badge. When you want a container's padding to exactly hug the text, use `text-box: trim-both cap alphabetic`. This is especially useful for dense UI components like badges or tags. This allows the padding to start right at the text edge on all sides.
+
+```css
+.badge {
+  padding: 10px;
+  background: hotpink;
+  border-radius: 10px;
+  /* 
+    Trims the top to the cap-height and 
+    the bottom to the alphabetic baseline.
+  */
```

</details>

#### **malchata** on `guides/user-experience/precise-text-alignment/guide.md`
> This seems a bit at odds with the CSS in some of the examples, which use `text-box-trim` and `text-box-edge` explicitly.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,108 @@ name: precise-text-alignment
 description: Achieve precise vertical alignment with text of any font. For example, exactly equal visual padding above and below text, or aligning text perfectly flush with adjacent icons or images.
 web-feature-ids:
   - text-box
+sources:
+  - https://developer.chrome.com/blog/css-text-box-trim
+  - https://webkit.org/blog/16301/webkit-features-in-safari-18-2/
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/text-box-trim
 ---
+
+# Precise Text Alignment
+
+## The Problem
+
+Browsers automatically add extra whitespace above and below text characters to accommodate line-height and font-specific metrics like ascenders and descenders. This "ghost space" makes it impossible to achieve pixel-perfect vertical alignment using standard CSS.
+
+Common issues include:
+- **Misaligned Icons**: Text appears visually lower or higher than an adjacent icon even when using `align-items: center`.
+- **Inaccurate Padding**: A button with `padding: 12px` visually appears to have more space on top or bottom because of the font's internal leading.
+- **Flush Alignment**: You cannot align the top of a capital letter exactly with the top of a container or an adjacent image without using "magic number" negative margins.
+
+## The Solution
+
+The `text-box-trim` and `text-box-edge` properties (shorthand `text-box`) allow you to trim this internal leading based on specific font metrics. By trimming the text box to the **cap-height** (top of capital letters) and the **alphabetic baseline** (bottom of most letters), you can ensure that the element's bounding box matches its visual content.
+
+### Implementation Strategy
+
+1. **MANDATORY**: Apply `text-box-trim: trim-both` (or the `text-box` shorthand) to the element containing the text.
+2. **MANDATORY**: Specify which metrics to use for trimming with `text-box-edge`. For most UI alignment, use `cap alphabetic`.
+3. **DO** use this to achieve visual vertical centering in flex or grid containers.
+4. **DO** use it to ensure that your CSS `padding` values match the visual gap between the text and the container edge.
+5. **DO NOT** use it on long-form body text where traditional line-spacing is necessary for readability. It is best suited for headings, buttons, and UI labels.
+
+## Implementation Guide
+
+### Use case 1: Trim internal leading for badges
+
+Different fonts have different amounts of built-in spacing above and below the text. This can provide challenges in matching a design, or in visually centering text in a badge. When you want a container's padding to exactly hug the text, use `text-box: trim-both cap alphabetic`. This is especially useful for dense UI components like badges or tags. This allows the padding to start right at the text edge on all sides.
+
+```css
+.badge {
+  padding: 10px;
+  background: hotpink;
+  border-radius: 10px;
+  /* 
+    Trims the top to the cap-height and 
+    the bottom to the alphabetic baseline.
+  */
+  text-box: trim-both cap alphabetic;
+}
+```
+
+### Use case 2: Center text with icons
+
+When using Flexbox to align text and icons, the "ghost space" often makes the text look slightly off-center. Trimming the box ensures the layout engine uses the actual visible letter height for alignment.
+
+```css
+.button {
+  display: inline-flex;
+  align-items: center;
+  gap: 8px; 
+}
+/* 
+  text-box does NOT inherit, and must be applied directly to the text element.
+*/
+.button-text{
+  /* 
+    The flex container now centers against the 
+    visible letters, not the invisible font box.
+  */
+  text-box: trim-both cap alphabetic;
+}
+```
+
+### Use case 3: Align text flush with top edges
+
+To align a heading perfectly with the top of an adjacent image or decorative element, use `trim-start cap alphabetic`. Even though the end will not be trimmed, the end edge must be defined.
+
+```css
+.hero {
+  display: flex;
+  align-items: flex-start;
+}
+
+h1 {
+  /* Only trim the top to the cap-height */
+  text-box-trim: trim-start;
+  /* The bottom edge must also be defined, even though `text-box-trim` is set to `trim-start` */
+  text-box-edge: cap alphabetic;
+}
+```
+
+## Best Practices
+
+- **DO** use the `text-box` shorthand for conciseness: `text-box: <trim-direction> <edges>`.
```

</details>

---

## PR #199: Add guides for `scroll-initial-target` use cases

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> I was curious to see how well AI could address all of the comments I made on this PR, and it actually did a really good job! So I decided to just push all of those changes.
> 
> This was the prompt I used (note, I have GitHub CLI installed locally, which it used without being asked to):
> 
> > Read the feedback for this PR (199) and address all of the comments

### Comments

#### **philipwalton** on `guides/user-experience/focus-chat-message/expectations.md`
> I don't believe that scroll snap needs to be used. And TBH for a messages app, I think it makes more sense not to.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,7 @@
+- The `scroll-initial-target` property must be applied directly to the **child element** (the target) that needs to be scrolled into view, not to its scroll container. The parent scroll container must be a scroll snap container (e.g., using `overflow-y: auto` and `scroll-snap-type: y mandatory`) and the child must have a scroll snap alignment (e.g., `scroll-snap-align: start`).
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/expectations.md`
> Most of the bullet point here are true statements about the API, but they're not really "expectations"—meaning they're not something we could write a test for to evaluate whether the AI tool correctly followed the guide.

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> I know I already approved these use cases, but now that this guide and the `focus-item-in-carousel` are 99% the same, I think it makes sense to combine and generalize.
> 
> How about combining these two into the following use case: "Build a scrollable list view component (such as an image carousel or a chat conversation view) that can render with a specific item initially scrolled into view."

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,82 @@
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Setting scroll snap properties on the container should be presented as optional, not manditory. It works well for use cases like a photo carousel, but I don't think I'd recommend it for a chat conversation view because there I'd expect the scrolling to be smooth.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,82 @@
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Focus Chat Message
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#message-id`) to scroll a chat container to a specific message on initial load.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Here I'd give two examples to show various ways to implement this use case:
> 1. A horizontal scrolling image carousel (with scroll snaping), initially scrolled to the middle item
> 2. A vertical scrolling chat conversation view (without snapping), scrolled all the say to the bottom message (or to a specific message, e.g. matching a search query).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,82 @@
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Focus Chat Message
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#message-id`) to scroll a chat container to a specific message on initial load.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
+2. Apply `scroll-snap-align` (e.g., `start`) to the child elements.
+3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.
+
+## Example code
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> Add these as `sources` in the YAML front matter.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,82 @@
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Focus Chat Message
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#message-id`) to scroll a chat container to a specific message on initial load.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
+2. Apply `scroll-snap-align` (e.g., `start`) to the child elements.
+3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.
+
+## Example code
+
+```css
+/**  
+ * PARENT: The main scroll container.
+ * Includes mandatory scroll snap on parent.
+ */
+.chat-container {
+  height: 400px;
+  overflow-y: auto;
+  scroll-snap-type: y mandatory;
+}
+
+/** 
+ * Holds scroll snap alignment.
+ */
+.message {
+  scroll-snap-align: start;
+}
+
+/** 
+ * TARGET: The focused item.
+ */
+.message.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic implementation
+
+- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load (e.g., highlighting a search result within a chat log).
+- **DO NOT** use this as a replacement for standard accessibility focus. This property only affects the visual scroll position; it does not move keyboard focus.
+- **DO NOT** use it if you need to animate the scroll position on load; this property sets the *initial* position instantly.
+- **DO** understand that the property is only effective on the *initial* render or when the scroll container's content changes significantly.
+- **DO** note that it will not override fragment navigation (if a URL has a `#hash` identifier it takes precedence).
+
+## Fallback strategies
+
+For browsers that have yet to support `scroll-initial-target`, leverage `scrollIntoView()` as a fallback for cross-browser compatibility.
+
+```javascript
+document.addEventListener("DOMContentLoaded", () => {
+  const targetMessage = document.querySelector('.message.target');
+
+  if (targetMessage && !CSS.supports('scroll-initial-target', 'nearest')) {
+    // Fallback for browsers that don't support the CSS property
+    targetMessage.scrollIntoView({ behavior: 'instant', block: 'nearest' });
+  }
+});
+```
+
+You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view.
+
+## References
```

</details>

#### **philipwalton** on `guides/user-experience/focus-chat-message/guide.md`
> ```suggestion
>   - scroll-initial-target
>   - scroll-into-view
>   - scroll-snap
> ```
> 
> Add all features that are mentioned in the guide.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,82 @@
 ---
-name: chat-message-search
+name: focus-chat-message
 description: Build a chat message feature that can display a conversation automatically scrolled to a specific message (e.g. matching a search query) on initial render.
 web-feature-ids:
   - scroll-initial-target
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Similar to the other use case. This isn't actually required to make this work.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,90 @@ description: Build a pull-to-reveal feature that would enable the user to pull d
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> This contradicts (2) above?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,90 @@ description: Build a pull-to-reveal feature that would enable the user to pull d
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
+2. Apply `scroll-snap-align` (e.g., `start`) to the child elements.
+3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.
+
+## Example code
+
+```css
+/**  
+ * PARENT: The main scroll container.
+ * Includes mandatory scroll snap on parent.
+ */
+.scroll-container {
+  height: 100vh;
+  overflow-y: auto;
+  scroll-snap-type: y mandatory;
+}
+
+ /** 
+ * Holds scroll snap alignment.
+ * Make sure that once the target is revealed, the user can search freely.
+ */
+.main-content {
+  scroll-snap-align: none;
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Moves these to `sources` in the YAML front matter.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -4,3 +4,90 @@ description: Build a pull-to-reveal feature that would enable the user to pull d
 web-feature-ids:
   - scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative CSS-only way to bring a specific child element into the visible area of its scroll container as soon as the container is rendered. Previously, developers heavily relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this:
+1. Ensure the parent element is a scroll container with scroll snapping (e.g., `overflow-y: auto` and `scroll-snap-type: y mandatory`).
+2. Apply `scroll-snap-align` (e.g., `start`) to the child elements.
+3. Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+When multiple elements specify an initial target within the same container, the user agent selects the one which comes first in the tree order. Once the user manually scrolls or an explicit programmatic scroll is triggered, the initial target isn't active anymore and the scroll container can be freely scrolled.
+
+## Example code
+
+```css
+/**  
+ * PARENT: The main scroll container.
+ * Includes mandatory scroll snap on parent.
+ */
+.scroll-container {
+  height: 100vh;
+  overflow-y: auto;
+  scroll-snap-type: y mandatory;
+}
+
+ /** 
+ * Holds scroll snap alignment.
+ * Make sure that once the target is revealed, the user can search freely.
+ */
+.main-content {
+  scroll-snap-align: none;
+}
+
+/** 
+ * TARGET: Focused item
+ * The specific item to focus on initial render.
+ */
+.main-content.target {
+  scroll-initial-target: nearest;
+}
+
+/**
+ * HIDDEN ELEMENT:
+ * The element we want to hide on load (e.g., search bar)
+ */
+.search-bar {
+  height: 60px;
+  scroll-snap-align: start;
+}
+```
+
+## Strategic implementation
+
+- **DO** use `scroll-initial-target: nearest` when you want to draw the user's attention to a specific part of a scrollable area upon load and intentionally hide peripheral UI units like a search bar at the very top.
+- **DO NOT** use this as a replacement for standard accessibility focus. This property only affects the visual scroll position; it does not move keyboard focus.
+- **DO NOT** use it if you need to animate the scroll position on load; this property sets the *initial* position instantly.
+- **DO** understand that the property is only effective on the *initial* render or when the scroll container's content changes significantly.
+- **DO** note that it will not override fragment navigation (if a URL has a `#hash` identifier it takes precedence).
+
+## Fallback strategies
+
+For browsers that have yet to support `scroll-initial-target`, leverage `scrollIntoView()` as a fallback for cross-browser compatibility. Note that for pulling content to reveal, you want the main content to bound to the `start` (top) of the container.
+
+```javascript
+document.addEventListener("DOMContentLoaded", () => {
+  const targetContent = document.querySelector('.main-content.target');
+
+  if (targetContent && !CSS.supports('scroll-initial-target', 'nearest')) {
+    // Fallback for browsers that don't support the CSS property
+    targetContent.scrollIntoView({ behavior: 'instant', block: 'start' });
+  }
+});
+```
+
+You can leave the default scroll position as a safe fallback for progressive enhancement if the specific target content isn't critical for the initial view (users will just see the search bar immediately instead of having to pull to reveal it).
+
+## References
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> name: scroll-target-on-load
> ```
> 
> WDYT?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> description: Build a scrollable list of elements (e.g. a carousel of images or a chat conversation thread) that can be displayed with a particular element scrolled into view on the initial render).
> ```
> 
> I think this new working might be a bit too broad now. I know we've gone back and forth on this, so I left a description that I think works well and is a mix of general and specific.
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> ```
> 
> I don't think scroll-snap is required for this use case.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> # Set a scroll target for the initial render
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> 
> 
> I think the main issue with `Element.scrollIntoView()` is that it's very tricky to get the timing right. If you call it before the element is rendered, nothing happens. But if you call it after the element is rendered, then you see a flash of the initial state before then seeing the updated state.
> 
> And the issue with fragment identifiers is they don't for any scroll container other than the root scroller.
> 
> 
> ```suggestion
> The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) both of which have limitations and are tricky to implement.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> ```
> 
> I think you can drop this, as it's largely a repeat of what you have above. It's fine to go straight into the instructions list.
> 
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> I'm not sure if we need this step? The use case implies that there already is a scrollable container, so I think it's fine to omit this.
> 
> Also I don't think we need to mention that scroll snap is not required.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> Nit: technically the target doesn't need to be an immediate child of the scroll. For the sake of clarity, I'd use the term "descendant" instead.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> ```suggestion
> In this example, a feed starts scrolled to a specific "featured" item rather than the very top of the list.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> Ooohh, I like the calendar starting on the current day example :)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
+
+```css
+/** 
+ * TARGET: The item that should be visible on initial load.
+ */
+.item.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> What is `scroll-start`?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
+
+```css
+/** 
+ * TARGET: The item that should be visible on initial load.
+ */
+.item.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
+- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
+- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
+- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
```

</details>

#### **philipwalton** on `guides/user-experience/mixed-media-scroll-view/guide.md`
> I wouldn't recommend waiting until load, or the initial scroll position will be visible for a bit. Also, if you follow the best practices outlined above, you don't need to wait until load to layout images.
> 
> I think DOMContentLoaded is a better general recommendation than load, but in my experience it's best to put the script immediately after the DOM node (though I know that's not always possible).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
+
+```css
+/** 
+ * TARGET: The item that should be visible on initial load.
+ */
+.item.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
+- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
+- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
+- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
+- **DO** provide dimensions for media. Since the scroll position is calculated during initial layout, ensure images or videos have `aspect-ratio` or fixed `height`/`width` to prevent the target from shifting after the media loads.
+
+## Fallback Strategy
+
+For browsers that do not yet support the API, use a JavaScript fallback. For feeds containing images or mixed media, use the `window.load` event to ensure the browser has calculated the full height of all elements before triggering the scroll.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> I'd remove this timeout, as it shouldn't be needed if following best practices.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
+
+```css
+/** 
+ * TARGET: The item that should be visible on initial load.
+ */
+.item.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
+- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
+- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
+- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
+- **DO** provide dimensions for media. Since the scroll position is calculated during initial layout, ensure images or videos have `aspect-ratio` or fixed `height`/`width` to prevent the target from shifting after the media loads.
+
+## Fallback Strategy
+
+For browsers that do not yet support the API, use a JavaScript fallback. For feeds containing images or mixed media, use the `window.load` event to ensure the browser has calculated the full height of all elements before triggering the scroll.
+
+```javascript
+/**
+ * Progressive Enhancement Fallback
+ */
+document.addEventListener("DOMContentLoaded", () => {
+  // Check for native CSS support
+  if (!CSS.supports("scroll-initial-target", "nearest")) {
+    setTimeout(() => {
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-target-on-load/guide.md`
> Yes, but I don't think this matches the behavior of `scroll-initial-target`? (Unless you're using scroll snapping)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,75 @@
+---
+name: mixed-media-scroll-view
+description: Build a single scrollable feed with mixed media and text that automatically renders with a specific media item scrolled into view.
+web-feature-ids:
+  - scroll-initial-target
+  - scroll-into-view
+  - scroll-snap
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
+---
+
+# Mixed Media Scroll View
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#item-id`) to position a feed—both of which can cause layout shifts or conflict with user navigation.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to set which child element should be the starting point of a scroll container. This is particularly effective for mixed-media feeds where content height is unpredictable.
+
+To implement this successfully:
+
+1.  **Define the Container:** Ensure the parent element is a scroll container. You do not need to enforce `scroll-snap-type` if you want users to scroll freely after the initial load.
+2.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to bring into view. You do not need to apply `scroll-snap-align` to the feed items, allowing the scrolling experience to remain smooth and native without forced snapping.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Vertical Media Feed
+
+In this example, the feed starts focused on a specific "featured" item rather than the very top of the list.
+
+```css
+/** 
+ * TARGET: The item that should be visible on initial load.
+ */
+.item.target {
+  scroll-initial-target: nearest;
+}
+```
+
+## Strategic Implementation & Best Practices
+
+- **DO** use `scroll-initial-target` for "middle-start" experiences, such as a calendar starting on the current day or a gallery starting on a specific image.
+- **DO NOT** confuse this with accessibility focus. This property only moves the **visual** viewport; it does not move the keyboard focus. You must manually manage `element.focus()` if the target is intended to be the starting point for keyboard users.
+- **DO NOT** use this if you need a smooth "scrolling" animation on load; this property is discrete and sets the position instantly during the layout phase.
+- **DO** account for the **Precedence Hierarchy**: A URL fragment (e.g., `example.com/#top`) and the container-level `scroll-start` property both take precedence over `scroll-initial-target`.
+- **DO** provide dimensions for media. Since the scroll position is calculated during initial layout, ensure images or videos have `aspect-ratio` or fixed `height`/`width` to prevent the target from shifting after the media loads.
+
+## Fallback Strategy
+
+For browsers that do not yet support the API, use a JavaScript fallback. For feeds containing images or mixed media, use the `window.load` event to ensure the browser has calculated the full height of all elements before triggering the scroll.
+
+```javascript
+/**
+ * Progressive Enhancement Fallback
+ */
+document.addEventListener("DOMContentLoaded", () => {
+  // Check for native CSS support
+  if (!CSS.supports("scroll-initial-target", "nearest")) {
+    setTimeout(() => {
+      const feedTarget = document.querySelector(".item.target");
+
+      if (feedTarget) {
+        // 'block: center' ensures the featured media is centered in view
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Couldn't this be done with the root scroller? Do you really need to define your own scroll container?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> In your demo, if I remove all the scroll snap stuff, it works fine (AFAICT).
> 
> If that's true, then this shouldn't be marked as mandatory. But I do think it should be stated as a recommendation to ensure that the search bar is always either fully visible or fully hidden.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> ```suggestion
> 3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific descendant element you want to snap into view.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
+3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> ```suggestion
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> This conflicts what you said above, right?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
+3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Pull to Reveal Search
+
+```css
+/**  
+ * PARENT: The scroll container.
+ */
+.scroll-container {
+  height: 100vh;
+  overflow-y: auto;
+  /* Optional: Enables snapping for subsequent user scrolls */
```

</details>

#### **philipwalton** on `guides/user-experience/pull-to-reveal/guide.md`
> Change parent/child to ancestor/descendant here (and throughout).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -3,4 +3,96 @@ name: pull-to-reveal
 description: Build a pull-to-reveal feature that would enable the user to pull down on the screen to reveal more content, like a search bar.
 web-feature-ids:
   - scroll-initial-target
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/scroll-initial-target
+  - https://github.com/DavMila/explainer-scroll-initial-target
+  - https://chromestatus.com/feature/6276178888097792
+  - https://drafts.csswg.org/css-scroll-snap-2/#propdef-scroll-initial-target
+  - https://webstatus.dev/features/scroll-initial-target
 ---
+
+# Pull to Reveal
+
+The CSS property `scroll-initial-target` offers a declarative, CSS-only way to bring a specific child element into the visible area of its scroll container as soon as that container is rendered. Previously, developers relied on JavaScript (`Element.scrollIntoView()`) or URL fragment identifiers (`#content-id`) to hide a top search bar or refresh control on initial load, forcing the user to scroll up (pull down) to reveal it.
+
+## How to Implement
+
+The `scroll-initial-target` property allows you to declaratively set which child element should be scrolled into view when a scroll container is first displayed.
+
+To implement this successfully:
+
+1.  **Define the Container:** The parent element must be a scroll container and can optionally add `scroll-snap-type`.
+2.  **Set Alignment (Required):** Apply `scroll-snap-align` (e.g., `start`) to the child elements. **Note:** If the child's alignment is `none` (the default), `scroll-initial-target` will not function because the browser has no reference point for positioning.
+3.  **Target the Item:** Apply `scroll-initial-target: nearest` to the specific child element you want to snap into view.
+
+> **The "First-Wins" Rule:** If multiple elements within the same container specify `nearest`, the browser selects the one that appears first in the DOM tree order.
+
+## Example Code: Pull to Reveal Search
```

</details>

---

## PR #178: Fix guides with incorrect feature ID data

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #158: :user-valid and :user-invalid use-cases and guides

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM with some suggestions. 

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check that this selector matches during standard interaction events.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> 3.  **Bridge Visual & Accessibility Layer**: Create a lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> ```suggestion
> Since there is no "UserInvalidChanged" event, hook into standard form events to check the state.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
+
+## Implementation Guide
+
+### 1. HTML Structure
+Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email</label>
+    <input 
+      type="email" 
+      id="email" 
+      required 
+      aria-errormessage="email-error"
+    >
+    <span id="email-error" class="error-msg">
+      Please enter a valid email address.
+    </span>
+  </div>
+</form>
+```
+
+### 2. CSS
+Control the visibility of the error message using the native pseudo-class `:user-invalid`.
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+}
+
+/* Show error message when input is user-invalid */
+input:user-invalid ~ .error-msg {
+  display: block;
+}
+
+/* Optional: Visual cues on the input itself */
+input:user-invalid {
+  border-color: #d93025;
+}
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> This won't apply to fields that are programmatically added to the DOM.
> 
> I think the recommendation should be to add capturing `focus` and `blur` event listeners to the window/document and then check if the target matches `input, textarea, select`

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
+
+## Implementation Guide
+
+### 1. HTML Structure
+Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email</label>
+    <input 
+      type="email" 
+      id="email" 
+      required 
+      aria-errormessage="email-error"
+    >
+    <span id="email-error" class="error-msg">
+      Please enter a valid email address.
+    </span>
+  </div>
+</form>
+```
+
+### 2. CSS
+Control the visibility of the error message using the native pseudo-class `:user-invalid`.
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+}
+
+/* Show error message when input is user-invalid */
+input:user-invalid ~ .error-msg {
+  display: block;
+}
+
+/* Optional: Visual cues on the input itself */
+input:user-invalid {
+  border-color: #d93025;
+}
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
+
+```javascript
+const inputs = document.querySelectorAll('input, textarea, select');
```

</details>

#### **philipwalton** on `guides/accessibility/accessible-error-announcement/guide.md`
> I guess adding fallback logic is fine, but I do wonder how necessary it is and whether or not this should just be a pure progressive enhancement.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
+
+## Implementation Guide
+
+### 1. HTML Structure
+Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email</label>
+    <input 
+      type="email" 
+      id="email" 
+      required 
+      aria-errormessage="email-error"
+    >
+    <span id="email-error" class="error-msg">
+      Please enter a valid email address.
+    </span>
+  </div>
+</form>
+```
+
+### 2. CSS
+Control the visibility of the error message using the native pseudo-class `:user-invalid`.
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+}
+
+/* Show error message when input is user-invalid */
+input:user-invalid ~ .error-msg {
+  display: block;
+}
+
+/* Optional: Visual cues on the input itself */
+input:user-invalid {
+  border-color: #d93025;
+}
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
+
+```javascript
+const inputs = document.querySelectorAll('input, textarea, select');
+
+const updateAriaState = (event) => {
+  const input = event.target;
+  // Check if the browser currently considers this input "user-invalid"
+  const isUserInvalid = input.matches(':user-invalid');
+  
+  if (isUserInvalid) {
+    input.setAttribute('aria-invalid', 'true');
+  } else {
+    input.removeAttribute('aria-invalid');
+  }
+};
+
+// 'blur' is usually when :user-invalid first triggers
+inputs.forEach(input => {
+  input.addEventListener('blur', updateAriaState);
+
+  // Also update on input if we've already shown the error, 
+  // so the error clears immediately when fixed.
+  input.addEventListener('input', () => {
+    const hasAriaInvalid = input.hasAttribute('aria-invalid');
+    const ariaInvalid = input.getAttribute('aria-invalid');
+    if (hasAriaInvalid && ariaInvalid === 'true') {
+      updateAriaState(input);
+    }
+  });
+});
+```
+
+## Fallbacking & Browser Support
+
+The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but older browsers need a fallback.
+
+### Feature Detection
+You can check for support in CSS and JavaScript.
+
+**JavaScript Check:**
+```javascript
+if (!CSS.supports('selector(:user-invalid)')) {
+  // Fallback logic here
+}
+```
+
+### CSS for Fallback
+To ensure your fallback logic is visually indistinguishable from the native behavior, you must apply your error styles to both the pseudo-class and your fallback class.
+
+```css
+/* Apply error styles to both native selector and fallback class */
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* Show error message for both cases */
+input:user-invalid ~ .error-msg,
+input.user-invalid-fallback ~ .error-msg {
+  display: block;
+}
+```
+
+### Fallback Logic
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> Similar to above, this would need to get re-called any time a form is added to the DOM. Why not just use capturing event listeners for all blur/input/change/reset events, so there's less manually wiring up required.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
+
+## Implementation Guide
+
+### 1. HTML Structure
+Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email</label>
+    <input 
+      type="email" 
+      id="email" 
+      required 
+      aria-errormessage="email-error"
+    >
+    <span id="email-error" class="error-msg">
+      Please enter a valid email address.
+    </span>
+  </div>
+</form>
+```
+
+### 2. CSS
+Control the visibility of the error message using the native pseudo-class `:user-invalid`.
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+}
+
+/* Show error message when input is user-invalid */
+input:user-invalid ~ .error-msg {
+  display: block;
+}
+
+/* Optional: Visual cues on the input itself */
+input:user-invalid {
+  border-color: #d93025;
+}
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
+
+```javascript
+const inputs = document.querySelectorAll('input, textarea, select');
+
+const updateAriaState = (event) => {
+  const input = event.target;
+  // Check if the browser currently considers this input "user-invalid"
+  const isUserInvalid = input.matches(':user-invalid');
+  
+  if (isUserInvalid) {
+    input.setAttribute('aria-invalid', 'true');
+  } else {
+    input.removeAttribute('aria-invalid');
+  }
+};
+
+// 'blur' is usually when :user-invalid first triggers
+inputs.forEach(input => {
+  input.addEventListener('blur', updateAriaState);
+
+  // Also update on input if we've already shown the error, 
+  // so the error clears immediately when fixed.
+  input.addEventListener('input', () => {
+    const hasAriaInvalid = input.hasAttribute('aria-invalid');
+    const ariaInvalid = input.getAttribute('aria-invalid');
+    if (hasAriaInvalid && ariaInvalid === 'true') {
+      updateAriaState(input);
+    }
+  });
+});
+```
+
+## Fallbacking & Browser Support
+
+The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but older browsers need a fallback.
+
+### Feature Detection
+You can check for support in CSS and JavaScript.
+
+**JavaScript Check:**
+```javascript
+if (!CSS.supports('selector(:user-invalid)')) {
+  // Fallback logic here
+}
+```
+
+### CSS for Fallback
+To ensure your fallback logic is visually indistinguishable from the native behavior, you must apply your error styles to both the pseudo-class and your fallback class.
+
+```css
+/* Apply error styles to both native selector and fallback class */
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* Show error message for both cases */
+input:user-invalid ~ .error-msg,
+input.user-invalid-fallback ~ .error-msg {
+  display: block;
+}
+```
+
+### Fallback Logic
+If `:user-invalid` is missing manually track the interaction state using a `WeakMap`.
+
+```javascript
+const UserInvalidFallback = (() => {
+  const dirtyState = new WeakMap();
+
+  const updateState = (input) => {
+    const isValid = input.checkValidity();
+
+    // Update both visual and ARIA state
+    input.classList.toggle('user-invalid-fallback', !isValid);
+    input.classList.toggle('user-valid-fallback', isValid);
+
+    if (!isValid) {
+      input.setAttribute('aria-invalid', 'true');
+    } else {
+      input.removeAttribute('aria-invalid');
+    }
+  };
+
+  const handleEvent = (event) => {
+    const input = event.target;
+
+    if (event.type === 'reset') {
+      const controls = input.elements || [];
+      for (const control of controls) {
+        dirtyState.delete(control);
+        control.classList.remove('user-invalid-fallback');
+        control.classList.remove('user-valid-fallback');
+        control.removeAttribute('aria-invalid');
+      }
+      return;
+    }
+
+    if (!input.checkValidity) return;
+
+    if (event.type === 'input' || event.type === 'change') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasInteracted = true;
+      dirtyState.set(input, state);
+      if (state.hasBlurred) {
+        updateState(input);
+      }
+    } else if (event.type === 'blur') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasBlurred = true;
+      dirtyState.set(input, state);
+      if (state.hasInteracted) {
+        updateState(input);
+      }
+    }
+  };
+
+  const init = (root = document) => {
+    if (CSS.supports('selector(:user-invalid)')) return;
+
+    root.addEventListener('blur', handleEvent, true); // Capture phase
+    root.addEventListener('input', handleEvent);
+    root.addEventListener('change', handleEvent);
+    root.addEventListener('reset', handleEvent, true); // Capture resets
+  };
+
+  return { init };
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
```

</details>

#### **philipwalton** on `guides/user-experience/accessible-error-announcement/guide.md`
> I see you kinda answer my above comments here, but TBH I still think event delegation is a better solution since focus/blur fire relatively infrequently and input/change/reset would only be added in older browsers, so it won't impact most users.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,215 @@
+---
+name: accessible-error-announcement
+description: Synchronize programmatic accessibility states (like aria-invalid) with the visual :user-invalid state to ensure screen reader users receive error feedback only after interaction, mirroring the visual experience.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Accessible Error Announcement
+
+## The Problem
+Standard HTML5 validation provides visual feedback (via `:invalid` or `:user-invalid`), but it doesn't automatically synchronize with accessibility attributes like `aria-invalid`. 
+
+If you use standard `:invalid` styling, screen readers might announce "Invalid entry" the moment a user tabs into a required field that is currently empty. This creates a disruptive experience for users using assistive technologies, as the error is announced before interaction has occurred.
+
+## The Solution
+We want the *programmatic* state (`aria-invalid="true"`) to be applied **at the exact same moment** the *visual* state (`:user-invalid`) applies. Since `:user-invalid` relies on the browser's internal "user-interacted" flag, we can use JavaScript to check for this selector matches during standard interaction events.
+
+See [MDN aria-invalid](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-invalid) for more details.
+
+### Implementation Strategy
+
+1.  **Visual Layer**: Use CSS `:user-invalid` to show borders/icons.
+2.  **Accessibility Layer**: Use `aria-invalid` and `aria-errormessage` to communicate state to Assistive Technology (AT).
+3.  **Bridge Visual & Accessibility Layer**: A lightweight JavaScript utility that listens for `blur` and `input` events, checks if the element matches `:user-invalid`, and updates the ARIA attributes accordingly.
+
+## Implementation Guide
+
+### 1. HTML Structure
+Link your input to its error message using `aria-errormessage` (or `aria-describedby` for broader support).
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email</label>
+    <input 
+      type="email" 
+      id="email" 
+      required 
+      aria-errormessage="email-error"
+    >
+    <span id="email-error" class="error-msg">
+      Please enter a valid email address.
+    </span>
+  </div>
+</form>
+```
+
+### 2. CSS
+Control the visibility of the error message using the native pseudo-class `:user-invalid`.
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+}
+
+/* Show error message when input is user-invalid */
+input:user-invalid ~ .error-msg {
+  display: block;
+}
+
+/* Optional: Visual cues on the input itself */
+input:user-invalid {
+  border-color: #d93025;
+}
+```
+
+### 3. JavaScript
+Since there is no "UserInvalidChanged" event, we hook into standard form events to check the state.
+
+```javascript
+const inputs = document.querySelectorAll('input, textarea, select');
+
+const updateAriaState = (event) => {
+  const input = event.target;
+  // Check if the browser currently considers this input "user-invalid"
+  const isUserInvalid = input.matches(':user-invalid');
+  
+  if (isUserInvalid) {
+    input.setAttribute('aria-invalid', 'true');
+  } else {
+    input.removeAttribute('aria-invalid');
+  }
+};
+
+// 'blur' is usually when :user-invalid first triggers
+inputs.forEach(input => {
+  input.addEventListener('blur', updateAriaState);
+
+  // Also update on input if we've already shown the error, 
+  // so the error clears immediately when fixed.
+  input.addEventListener('input', () => {
+    const hasAriaInvalid = input.hasAttribute('aria-invalid');
+    const ariaInvalid = input.getAttribute('aria-invalid');
+    if (hasAriaInvalid && ariaInvalid === 'true') {
+      updateAriaState(input);
+    }
+  });
+});
+```
+
+## Fallbacking & Browser Support
+
+The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but older browsers need a fallback.
+
+### Feature Detection
+You can check for support in CSS and JavaScript.
+
+**JavaScript Check:**
+```javascript
+if (!CSS.supports('selector(:user-invalid)')) {
+  // Fallback logic here
+}
+```
+
+### CSS for Fallback
+To ensure your fallback logic is visually indistinguishable from the native behavior, you must apply your error styles to both the pseudo-class and your fallback class.
+
+```css
+/* Apply error styles to both native selector and fallback class */
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* Show error message for both cases */
+input:user-invalid ~ .error-msg,
+input.user-invalid-fallback ~ .error-msg {
+  display: block;
+}
+```
+
+### Fallback Logic
+If `:user-invalid` is missing manually track the interaction state using a `WeakMap`.
+
+```javascript
+const UserInvalidFallback = (() => {
+  const dirtyState = new WeakMap();
+
+  const updateState = (input) => {
+    const isValid = input.checkValidity();
+
+    // Update both visual and ARIA state
+    input.classList.toggle('user-invalid-fallback', !isValid);
+    input.classList.toggle('user-valid-fallback', isValid);
+
+    if (!isValid) {
+      input.setAttribute('aria-invalid', 'true');
+    } else {
+      input.removeAttribute('aria-invalid');
+    }
+  };
+
+  const handleEvent = (event) => {
+    const input = event.target;
+
+    if (event.type === 'reset') {
+      const controls = input.elements || [];
+      for (const control of controls) {
+        dirtyState.delete(control);
+        control.classList.remove('user-invalid-fallback');
+        control.classList.remove('user-valid-fallback');
+        control.removeAttribute('aria-invalid');
+      }
+      return;
+    }
+
+    if (!input.checkValidity) return;
+
+    if (event.type === 'input' || event.type === 'change') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasInteracted = true;
+      dirtyState.set(input, state);
+      if (state.hasBlurred) {
+        updateState(input);
+      }
+    } else if (event.type === 'blur') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasBlurred = true;
+      dirtyState.set(input, state);
+      if (state.hasInteracted) {
+        updateState(input);
+      }
+    }
+  };
+
+  const init = (root = document) => {
+    if (CSS.supports('selector(:user-invalid)')) return;
+
+    root.addEventListener('blur', handleEvent, true); // Capture phase
+    root.addEventListener('input', handleEvent);
+    root.addEventListener('change', handleEvent);
+    root.addEventListener('reset', handleEvent, true); // Capture resets
+  };
+
+  return { init };
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
+UserInvalidFallback.init(form);
+```
+
+## Other Considerations
+
+1.  **`aria-live` vs. `aria-errormessage`**: 
+    *   `aria-errormessage` connects the input to the text, but screen readers might not announce it immediately upon appearance (only when focusing the input).
+    *   If you need *immediate* announcement when the error appears (e.g., on blur), consider adding `role="alert"` or `aria-live="polite"` to the error message container, but test thoroughly to avoid "double announcement" when the user focuses the field to fix it.
+
+2.  **Internationalization**:
+    *   Ensure the text content of your error message (`#email-error`) is translated. The logic remains the same.
+
+3.  **Performance**:
+    *   `input.matches(':user-invalid')` is very fast. Attaching these listeners to hundreds of inputs is generally negligible, but event delegation (listening on the `<form>` element) is a good optimization for large forms.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> ```suggestion
> description: Provide error message for required form fields that were skipped or left empty *only* after user interaction, to avoid preemptive errors and ensure feedback is timely and contextually relevant to the user's flow.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> Given that these fallbacks add implementation complexity, I think we should frame them as option. How about something like:
> 
> If the user's Baseline target is older than Baseline 2023, consider adding a fallback strategy for browsers that don't support `:user-invalid`...

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Required Field Feedback
+
+## The Problem
+Marking required fields with an error state immediately upon page load can be confusing. Ideally, a required field should only look "invalid" if the user has attempted to fill it out and failed.
+
+## The Solution
+The `:user-invalid` pseudo-class solves this perfectly. For a required field, it will not match on page load. It will only match if:
+1.  The user interacts with the field (e.g., types a character and deletes it) and then leaves it (blur), leaving it empty.
+2.  The user attempts to submit the form while the field is empty.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: Add the `required` attribute to your inputs.
+2.  **Visual Feedback**: Use `:user-invalid` to style the border red and show a "Required" helper text.
+3.  **Timing**: Rely on the browser's native timing. You don't need `onBlur` handlers to add a `touched` class anymore!
+
+## Implementation Guide
+
+### 1. HTML Structure
+```html
+<form>
+  <div class="field">
+    <label for="full-name">Full Name</label>
+    <input 
+      type="text" 
+      id="full-name" 
+      name="full-name" 
+      required
+      aria-errormessage="name-error"
+    >
+    <div id="name-error" class="error-msg">
+      This field is required.
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  Only highlight empty required fields AFTER the user visits them.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* Optional: Subtle indicator for required fields that are valid */
+input:required:user-valid {
+  border-color: #188038;
+  border-width: 2px;
+}
+```
+
+## Fallbacking & Browser Support
+
+For older browsers, we need to manually track the "visited" or "dirty" state.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> This reference to the other file likely won't work in the context of a MCP response.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Required Field Feedback
+
+## The Problem
+Marking required fields with an error state immediately upon page load can be confusing. Ideally, a required field should only look "invalid" if the user has attempted to fill it out and failed.
+
+## The Solution
+The `:user-invalid` pseudo-class solves this perfectly. For a required field, it will not match on page load. It will only match if:
+1.  The user interacts with the field (e.g., types a character and deletes it) and then leaves it (blur), leaving it empty.
+2.  The user attempts to submit the form while the field is empty.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: Add the `required` attribute to your inputs.
+2.  **Visual Feedback**: Use `:user-invalid` to style the border red and show a "Required" helper text.
+3.  **Timing**: Rely on the browser's native timing. You don't need `onBlur` handlers to add a `touched` class anymore!
+
+## Implementation Guide
+
+### 1. HTML Structure
+```html
+<form>
+  <div class="field">
+    <label for="full-name">Full Name</label>
+    <input 
+      type="text" 
+      id="full-name" 
+      name="full-name" 
+      required
+      aria-errormessage="name-error"
+    >
+    <div id="name-error" class="error-msg">
+      This field is required.
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  Only highlight empty required fields AFTER the user visits them.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* Optional: Subtle indicator for required fields that are valid */
+input:required:user-valid {
+  border-color: #188038;
+  border-width: 2px;
+}
+```
+
+## Fallbacking & Browser Support
+
+For older browsers, we need to manually track the "visited" or "dirty" state.
+
+### CSS for Fallback
+```css
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg,
+input.user-invalid-fallback + .error-msg {
+  display: block;
+}
+```
+
+### JavaScript Fallback
+If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
+
+```javascript
+const UserInvalidFallback = (() => {
+  const dirtyState = new WeakMap();
+
+  const updateState = (input) => {
+    const isValid = input.checkValidity();
+
+    // Update both visual and ARIA state
+    input.classList.toggle('user-invalid-fallback', !isValid);
+    input.classList.toggle('user-valid-fallback', isValid);
+
+    if (!isValid) {
+      input.setAttribute('aria-invalid', 'true');
+    } else {
+      input.removeAttribute('aria-invalid');
+    }
+  };
+
+  const handleEvent = (event) => {
+    const input = event.target;
+
+    if (event.type === 'reset') {
+      const controls = input.elements || [];
+      for (const control of controls) {
+        dirtyState.delete(control);
+        control.classList.remove('user-invalid-fallback');
+        control.classList.remove('user-valid-fallback');
+        control.removeAttribute('aria-invalid');
+      }
+      return;
+    }
+
+    if (!input.checkValidity) return;
+
+    if (event.type === 'input' || event.type === 'change') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasInteracted = true;
+      dirtyState.set(input, state);
+      if (state.hasBlurred) {
+        updateState(input);
+      }
+    } else if (event.type === 'blur') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasBlurred = true;
+      dirtyState.set(input, state);
+      if (state.hasInteracted) {
+        updateState(input);
+      }
+    }
+  };
+
+  const init = (root = document) => {
+    if (CSS.supports('selector(:user-invalid)')) return;
+
+    root.addEventListener('blur', handleEvent, true); // Capture phase
+    root.addEventListener('input', handleEvent);
+    root.addEventListener('change', handleEvent);
+    root.addEventListener('reset', handleEvent, true); // Capture resets
+  };
+
+  return { init };
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
+UserInvalidFallback.init(form);
+```
+
+## Other Considerations
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **philipwalton** on `guides/user-experience/select-menu-interaction/guide.md`
> ```suggestion
> description: Validate that a non-default option has been chosen in a select menu only after the user has interacted with the control.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: select-menu-interaction
+description: Validating that a non-default option has been chosen in a select menu only after the user has interacted with the control.
```

</details>

#### **philipwalton** on `guides/user-experience/select-menu-interaction/guide.md`
> Same comment here as the other use case. I think we should present this an optional fallback strategy, given it will only be needed by a small portion of users, and (presumably) the site already has other validation mechanism in place (e.g. server-side validation).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: select-menu-interaction
+description: Validating that a non-default option has been chosen in a select menu only after the user has interacted with the control.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Select Menu Interaction
+
+## The Problem
+For mandatory dropdowns (e.g., "Choose a Country"), standard validation flags the field as invalid immediately if the default option has an empty value. This can create visual noise. We want to show the error only if the user opens the menu and closes it without choosing an option, or attempts to submit the form.
+
+## The Solution
+The `:user-invalid` pseudo-class works seamlessly with `<select>` elements. It respects the user's interaction flow: simply loading the page or focusing/blurring without making a change doesn't count as an interaction, so the field stays neutral until they actively attempt a selection.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: Use a `<select>` with `required`. The first option should have `value=""` and ideally be disabled/hidden to force a valid choice.
+2.  **Visual Feedback**: Use `:user-invalid` to style the select box border.
+3.  **Timing**: The browser considers the field "interacted" if the user changes the value (even back to the default invalid state) before they blur the control, or upon form submission.
+
+## Implementation Guide
+
+### 1. HTML Structure
+The "placeholder" option is key here.
+
+```html
+<form>
+  <div class="field">
+    <label for="country">Country</label>
+    <select 
+      id="country" 
+      name="country" 
+      required
+      aria-errormessage="country-error"
+    >
+      <option value="" disabled selected>Select a country...</option>
+      <option value="us">United States</option>
+      <option value="ca">Canada</option>
+      <option value="uk">United Kingdom</option>
+    </select>
+    <div id="country-error" class="error-msg">
+      Please select a country.
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  Only show error after the user visits the select menu.
+*/
+select:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+select:user-invalid + .error-msg {
+  display: block;
+}
+
+select:user-valid {
+  border-color: #188038;
+}
+```
+
+## Fallbacking & Browser Support
+
+### CSS for Fallback
+```css
+select:user-invalid,
+select.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+select:user-invalid + .error-msg,
+select.user-invalid-fallback + .error-msg {
+  display: block;
+}
+```
+
+### JavaScript Fallback
+If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> ```suggestion
> 1.  **Selector**: Use `.parent:has(:user-invalid)` to target the container.
> ```
> To include selects as well? I don't think this will have worse performance, but if so you could also do `:is(input,select):user-invalid`.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,182 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Style Parent with :has()
+
+## The Problem
+Often, an error state requires styling elements *outside* the input itself—for example, changing the color of a parent `fieldset` border, highlighting the `<label>`, or showing a global error icon in the card header. Historically, this required JavaScript to toggle classes on parent elements.
+
+## The Solution
+By combining `:has()` with `:user-invalid`, we can declaratively style any ancestor based on the validity state of a specific descendant. This keeps all presentation logic in CSS.
+
+### Implementation Strategy
+
+1.  **Selector**: Use `.parent:has(input:user-invalid)` to target the container.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> Same comment here as for other use cases. IMO this one is a great candidate for pure progressive enhancement because presumably the input itself will have the error styling and the only thing that won't is the parent element.
> 
> I wonder if we should just recommend to make sure the input has some visual styling and then no fallback is ok?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,182 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Style Parent with :has()
+
+## The Problem
+Often, an error state requires styling elements *outside* the input itself—for example, changing the color of a parent `fieldset` border, highlighting the `<label>`, or showing a global error icon in the card header. Historically, this required JavaScript to toggle classes on parent elements.
+
+## The Solution
+By combining `:has()` with `:user-invalid`, we can declaratively style any ancestor based on the validity state of a specific descendant. This keeps all presentation logic in CSS.
+
+### Implementation Strategy
+
+1.  **Selector**: Use `.parent:has(input:user-invalid)` to target the container.
+2.  **Scope**: Be specific to avoid performance issues. Target `.field-group` rather than `body`.
+3.  **Fallback**: Requires JS to toggle classes on the parent if `:has()` is not supported.
+
+## Implementation Guide
+
+### 1. HTML Structure
+```html
+<form>
+  <div class="card-section">
+    <div class="header">
+      <h3>Profile Settings</h3>
+      <span class="status-icon"></span>
+    </div>
+    
+    <div class="field">
+      <label for="username">Username</label>
+      <input type="text" id="username" required>
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+/* Default State */
+.card-section {
+  border: 1px solid #ccc;
+  border-left: 4px solid #ccc;
+}
+
+/* 
+  Parent Styling Logic:
+  If the card contains ANY user-invalid input, turn the whole card's edge red.
+*/
+.card-section:has(input:user-invalid) {
+  border-left-color: #d93025;
+  background-color: #fff8f8;
+}
+
+/* Change the icon too */
+.card-section:has(input:user-invalid) .status-icon::after {
+  content: "⚠️";
+}
+```
+
+## Fallbacking & Browser Support
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> Not sure if this will matter, but this is not a valid HTML comment...

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,254 @@
+---
+name: validate-input-after-interaction
+description: Validation feedback for form inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. This consolidated guide covers sub-use-cases including password complexity validation and validating email after interaction.
+web-features:
+  - user-pseudos
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid
+---
+
+# Validate Input After Interaction
+
+## The Problem
+
+Displaying validation errors the moment a user focuses on a field and starts typing is premature and distracting. For example, as a user types an email address (e.g., "user@gm") or a password with complex requirements, the field is technically invalid until completion. Standard `:invalid` styling results in an error state appearing immediately, frustrating the user.
+
+## The Solution
+
+The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: DO use standard HTML5 attributes like `type="email"`, `pattern`, and `required` to trigger the browser's built-in validation logic.
+2.  **Visual Feedback**: DO use `:user-invalid` to apply error styling only after interaction.
+3.  **Positive Reinforcement**: DO optionally use `:user-valid` to give a green "success" indicator once the requirements are met.
+4.  **Graceful Recovery**: As soon as the user corrects the input to a valid format, `:user-invalid` stops matching, removing the error state immediately.
+
+## Implementation Guide
+
+### Use Case 1: Email Validation
+
+MANDATORY: Rely on standard HTML5 attributes for email fields. The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email Address</label>
+    <!-- DO: Use standard HTML validation attributes like type="email" and required -->
+    <input 
+      type="email" 
+      id="email" 
+      name="email" 
+      required
+      autocomplete="email"
+      placeholder="you@example.com"
+      aria-errormessage="email-error"
+    >
+    <div id="email-error" class="error-msg">
+      Please enter a valid email address (e.g. name@domain.com).
+    </div>
+  </div>
+</form>
+```
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  DO: Only show error styles after user interaction.
+  This prevents the "angry red border" on page load.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* DO: Reveal the error message using the adjacent sibling selector */
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* DO: Optionally provide a green success state on :user-valid */
+input:user-valid {
+  border-color: #188038;
+}
+```
+
+### Use Case 2: Password Complexity
+
+MANDATORY: Define the complexity rule using a Regex Lookahead pattern in the `pattern` attribute. The rules list is shown to guide the user, and highlighted if there's an error.
+
+```html
+<form>
+  <div class="field">
+    <label for="password">New Password</label>
+    <!-- DO: Use pattern and minlength for complex password validation -->
+    <input 
+      type="password" 
+      id="password" 
+      autocomplete="new-password"
+      required
+      /* 
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> Same comment as before, I'm not sure if we should present this as "mandatory".

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,254 @@
+---
+name: validate-input-after-interaction
+description: Validation feedback for form inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. This consolidated guide covers sub-use-cases including password complexity validation and validating email after interaction.
+web-features:
+  - user-pseudos
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid
+---
+
+# Validate Input After Interaction
+
+## The Problem
+
+Displaying validation errors the moment a user focuses on a field and starts typing is premature and distracting. For example, as a user types an email address (e.g., "user@gm") or a password with complex requirements, the field is technically invalid until completion. Standard `:invalid` styling results in an error state appearing immediately, frustrating the user.
+
+## The Solution
+
+The `:user-invalid` pseudo-class allows you to defer the error state until the user has "committed" to a value (by blurring the field) or attempted to submit the form. This ensures validation feedback is provided only after the user has finished interacting with the field.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: DO use standard HTML5 attributes like `type="email"`, `pattern`, and `required` to trigger the browser's built-in validation logic.
+2.  **Visual Feedback**: DO use `:user-invalid` to apply error styling only after interaction.
+3.  **Positive Reinforcement**: DO optionally use `:user-valid` to give a green "success" indicator once the requirements are met.
+4.  **Graceful Recovery**: As soon as the user corrects the input to a valid format, `:user-invalid` stops matching, removing the error state immediately.
+
+## Implementation Guide
+
+### Use Case 1: Email Validation
+
+MANDATORY: Rely on standard HTML5 attributes for email fields. The error message is hidden by default and only revealed when the browser determines the user has left the field in an invalid state.
+
+```html
+<form>
+  <div class="field">
+    <label for="email">Email Address</label>
+    <!-- DO: Use standard HTML validation attributes like type="email" and required -->
+    <input 
+      type="email" 
+      id="email" 
+      name="email" 
+      required
+      autocomplete="email"
+      placeholder="you@example.com"
+      aria-errormessage="email-error"
+    >
+    <div id="email-error" class="error-msg">
+      Please enter a valid email address (e.g. name@domain.com).
+    </div>
+  </div>
+</form>
+```
+
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  DO: Only show error styles after user interaction.
+  This prevents the "angry red border" on page load.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* DO: Reveal the error message using the adjacent sibling selector */
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* DO: Optionally provide a green success state on :user-valid */
+input:user-valid {
+  border-color: #188038;
+}
+```
+
+### Use Case 2: Password Complexity
+
+MANDATORY: Define the complexity rule using a Regex Lookahead pattern in the `pattern` attribute. The rules list is shown to guide the user, and highlighted if there's an error.
+
+```html
+<form>
+  <div class="field">
+    <label for="password">New Password</label>
+    <!-- DO: Use pattern and minlength for complex password validation -->
+    <input 
+      type="password" 
+      id="password" 
+      autocomplete="new-password"
+      required
+      /* 
+         DO: Match all constraints with lookaheads
+         (?=.*\d)       : Must contain at least one digit
+         (?=.*[a-z])    : Must contain at least one lowercase letter
+         (?=.*[A-Z])    : Must contain at least one uppercase letter
+         (?=.*[\W_])    : Must contain at least one special char
+         .{8,}          : Must be at least 8 chars long
+      */
+      pattern="(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[\W_]).{8,}"
+      minlength="8"
+      aria-describedby="password-rules"
+    >
+    <!-- DO NOT: Hide the rules initially. Users need them to know what to type. -->
+    <ul id="password-rules" class="rules-list">
+      <li>At least 8 characters</li>
+      <li>One uppercase letter</li>
+      <li>One number</li>
+      <li>One special character</li>
+    </ul>
+  </div>
+</form>
+```
+
+```css
+/* DO: State the default styling as neutral */
+.rules-list { color: #5f6368; }
+
+/* DO: Show invalid state (After interaction): Error */
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* DO: Highlight rules list when error is shown */
+input:user-invalid + .rules-list {
+  color: #d93025;
+}
+
+/* DO: Add success indications for :user-valid state */
+input:user-valid {
+  border-color: #188038;
+}
+/* DO: Hide rules or turn them green once satisfied */
+input:user-valid + .rules-list {
+  display: none;
+}
+```
+
+## Fallbacking & Browser Support
+
+MANDATORY: The `:user-invalid` pseudo-class is widely supported (Baseline 2023), but you must ensure consistency of the implementation when using it with the `pattern` attribute in older browsers.
+
+### CSS for Fallback
+DO: Ensure your fallback class shares the native styles. Group your selectors to ensure consistent styling.
+
+```css
+/* DO: Ensure native and fallback class share the same styles */
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+/* DO: Ensure the fallback triggers error messages equally */
+input:user-invalid + .error-msg,
+input.user-invalid-fallback + .error-msg {
+  display: block;
+}
+
+/* DO: Ensure the fallback highlights rule lists equally */
+input:user-invalid + .rules-list,
+input.user-invalid-fallback + .rules-list {
+  color: #d93025;
+}
+```
+
+### JavaScript Fallback
+MANDATORY: If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
```

</details>

#### **philipwalton** on `guides/user-experience/required-field-feedback/guide.md`
> @rviscomi suggestions?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Required Field Feedback
+
+## The Problem
+Marking required fields with an error state immediately upon page load can be confusing. Ideally, a required field should only look "invalid" if the user has attempted to fill it out and failed.
+
+## The Solution
+The `:user-invalid` pseudo-class solves this perfectly. For a required field, it will not match on page load. It will only match if:
+1.  The user interacts with the field (e.g., types a character and deletes it) and then leaves it (blur), leaving it empty.
+2.  The user attempts to submit the form while the field is empty.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: Add the `required` attribute to your inputs.
+2.  **Visual Feedback**: Use `:user-invalid` to style the border red and show a "Required" helper text.
+3.  **Timing**: Rely on the browser's native timing. You don't need `onBlur` handlers to add a `touched` class anymore!
+
+## Implementation Guide
+
+### 1. HTML Structure
+```html
+<form>
+  <div class="field">
+    <label for="full-name">Full Name</label>
+    <input 
+      type="text" 
+      id="full-name" 
+      name="full-name" 
+      required
+      aria-errormessage="name-error"
+    >
+    <div id="name-error" class="error-msg">
+      This field is required.
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  Only highlight empty required fields AFTER the user visits them.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* Optional: Subtle indicator for required fields that are valid */
+input:required:user-valid {
+  border-color: #188038;
+  border-width: 2px;
+}
+```
+
+## Fallbacking & Browser Support
+
+For older browsers, we need to manually track the "visited" or "dirty" state.
+
+### CSS for Fallback
+```css
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg,
+input.user-invalid-fallback + .error-msg {
+  display: block;
+}
+```
+
+### JavaScript Fallback
+If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
+
+```javascript
+const UserInvalidFallback = (() => {
+  const dirtyState = new WeakMap();
+
+  const updateState = (input) => {
+    const isValid = input.checkValidity();
+
+    // Update both visual and ARIA state
+    input.classList.toggle('user-invalid-fallback', !isValid);
+    input.classList.toggle('user-valid-fallback', isValid);
+
+    if (!isValid) {
+      input.setAttribute('aria-invalid', 'true');
+    } else {
+      input.removeAttribute('aria-invalid');
+    }
+  };
+
+  const handleEvent = (event) => {
+    const input = event.target;
+
+    if (event.type === 'reset') {
+      const controls = input.elements || [];
+      for (const control of controls) {
+        dirtyState.delete(control);
+        control.classList.remove('user-invalid-fallback');
+        control.classList.remove('user-valid-fallback');
+        control.removeAttribute('aria-invalid');
+      }
+      return;
+    }
+
+    if (!input.checkValidity) return;
+
+    if (event.type === 'input' || event.type === 'change') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasInteracted = true;
+      dirtyState.set(input, state);
+      if (state.hasBlurred) {
+        updateState(input);
+      }
+    } else if (event.type === 'blur') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasBlurred = true;
+      dirtyState.set(input, state);
+      if (state.hasInteracted) {
+        updateState(input);
+      }
+    }
+  };
+
+  const init = (root = document) => {
+    if (CSS.supports('selector(:user-invalid)')) return;
+
+    root.addEventListener('blur', handleEvent, true); // Capture phase
+    root.addEventListener('input', handleEvent);
+    root.addEventListener('change', handleEvent);
+    root.addEventListener('reset', handleEvent, true); // Capture resets
+  };
+
+  return { init };
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
+UserInvalidFallback.init(form);
+```
+
+## Other Considerations
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **philipwalton** on `guides/user-experience/style-parent-with-has/guide.md`
> ```suggestion
> description: Style parent elements of a form field (e.g. labels or fieldsets) when the field is invalid.
> ```
> 
> I think we want avoid mentioning solutions or implementation details in the use case, otherwise I worry that a user prompt like the following won't match this use case: "write me some JavaScript code to automatically style a form label..."
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,187 @@
+---
+name: style-parent-with-has
+description: Declaratively style parent elements like labels or fieldsets when a child input is in the :user-invalid state, eliminating the need for JavaScript state management.
```

</details>

#### **philipwalton** on `guides/user-experience/validate-input-after-interaction/guide.md`
> ```suggestion
> description: Show form field validation feedback (e.g. password complexity or email format requirements) only after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,254 @@
+---
+name: validate-input-after-interaction
+description: Validation feedback for form inputs that only appears after the user has finished their initial interaction, avoiding premature errors on page load or while the user is typing. This consolidated guide covers sub-use-cases including password complexity validation and validating email after interaction.
```

</details>

#### **rviscomi** on `guides/user-experience/required-field-feedback/guide.md`
> If we absolutely had to link two guides together, the way to do it would be something like `MANDATORY: Call get_best_practices("accessible-error-announcement") to ensure a consistent accessibility experience.`
> 
> However, that should be extremely rare if we ever need to do it at all. Ideally, in the interest of speeding up responses and conserving tokens, guides will be as self-contained as possible so that agents have everything they need to implement the use case correctly.
> 
> My suggestion would be to bake the a11y guidance directly into the implementation section of this guide. I think we can get it down to just a few lines of JS:
> 
> ```js
> // Sync aria-invalid with the CSS :user-invalid state
> const syncAria = (el) => {
>   el.toggleAttribute?.('aria-invalid', el.matches(':user-invalid'));
> };
> 
> // Update on blur (to show error) and input (to clear it)
> document.addEventListener('blur', (e) => syncAria(e.target), true);
> document.addEventListener('input', (e) => {
>   if (e.target.hasAttribute('aria-invalid')) syncAria(e.target);
> });
> ```
> 
> We should probably also revisit the part about "You don't need `onBlur` handlers" to make clear that some JS is needed, even in the modern implementation.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,166 @@
+---
+name: required-field-feedback
+description: Highlighting required fields that were skipped or left empty after user focus and blur, ensuring feedback is contextually relevant to the user's flow.
+web-feature-ids:
+  - user-pseudos
+---
+
+# Required Field Feedback
+
+## The Problem
+Marking required fields with an error state immediately upon page load can be confusing. Ideally, a required field should only look "invalid" if the user has attempted to fill it out and failed.
+
+## The Solution
+The `:user-invalid` pseudo-class solves this perfectly. For a required field, it will not match on page load. It will only match if:
+1.  The user interacts with the field (e.g., types a character and deletes it) and then leaves it (blur), leaving it empty.
+2.  The user attempts to submit the form while the field is empty.
+
+### Implementation Strategy
+
+1.  **HTML Constraint**: Add the `required` attribute to your inputs.
+2.  **Visual Feedback**: Use `:user-invalid` to style the border red and show a "Required" helper text.
+3.  **Timing**: Rely on the browser's native timing. You don't need `onBlur` handlers to add a `touched` class anymore!
+
+## Implementation Guide
+
+### 1. HTML Structure
+```html
+<form>
+  <div class="field">
+    <label for="full-name">Full Name</label>
+    <input 
+      type="text" 
+      id="full-name" 
+      name="full-name" 
+      required
+      aria-errormessage="name-error"
+    >
+    <div id="name-error" class="error-msg">
+      This field is required.
+    </div>
+  </div>
+</form>
+```
+
+### 2. CSS
+```css
+.error-msg {
+  display: none;
+  color: #d93025;
+  font-size: 0.875rem;
+  margin-top: 0.25rem;
+}
+
+/* 
+  Only highlight empty required fields AFTER the user visits them.
+*/
+input:user-invalid {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg {
+  display: block;
+}
+
+/* Optional: Subtle indicator for required fields that are valid */
+input:required:user-valid {
+  border-color: #188038;
+  border-width: 2px;
+}
+```
+
+## Fallbacking & Browser Support
+
+For older browsers, we need to manually track the "visited" or "dirty" state.
+
+### CSS for Fallback
+```css
+input:user-invalid,
+input.user-invalid-fallback {
+  border-color: #d93025;
+  background-color: #fce8e6;
+}
+
+input:user-invalid + .error-msg,
+input.user-invalid-fallback + .error-msg {
+  display: block;
+}
+```
+
+### JavaScript Fallback
+If the browser doesn't support the selector, we can use a reusable utility that tracks interaction state using a `WeakMap`. This avoids polluting the DOM with "dirty" classes or data attributes.
+
+```javascript
+const UserInvalidFallback = (() => {
+  const dirtyState = new WeakMap();
+
+  const updateState = (input) => {
+    const isValid = input.checkValidity();
+
+    // Update both visual and ARIA state
+    input.classList.toggle('user-invalid-fallback', !isValid);
+    input.classList.toggle('user-valid-fallback', isValid);
+
+    if (!isValid) {
+      input.setAttribute('aria-invalid', 'true');
+    } else {
+      input.removeAttribute('aria-invalid');
+    }
+  };
+
+  const handleEvent = (event) => {
+    const input = event.target;
+
+    if (event.type === 'reset') {
+      const controls = input.elements || [];
+      for (const control of controls) {
+        dirtyState.delete(control);
+        control.classList.remove('user-invalid-fallback');
+        control.classList.remove('user-valid-fallback');
+        control.removeAttribute('aria-invalid');
+      }
+      return;
+    }
+
+    if (!input.checkValidity) return;
+
+    if (event.type === 'input' || event.type === 'change') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasInteracted = true;
+      dirtyState.set(input, state);
+      if (state.hasBlurred) {
+        updateState(input);
+      }
+    } else if (event.type === 'blur') {
+      const state = dirtyState.get(input) || { hasInteracted: false, hasBlurred: false };
+      state.hasBlurred = true;
+      dirtyState.set(input, state);
+      if (state.hasInteracted) {
+        updateState(input);
+      }
+    }
+  };
+
+  const init = (root = document) => {
+    if (CSS.supports('selector(:user-invalid)')) return;
+
+    root.addEventListener('blur', handleEvent, true); // Capture phase
+    root.addEventListener('input', handleEvent);
+    root.addEventListener('change', handleEvent);
+    root.addEventListener('reset', handleEvent, true); // Capture resets
+  };
+
+  return { init };
+})();
+
+// Initialize for a specific form
+const form = document.querySelector('#demo-form');
+UserInvalidFallback.init(form);
+```
+
+## Other Considerations
+
+1.  **Asterisks**: It is still best practice to indicate required fields visually (e.g., with an asterisk `*`) in the label, so users know what to expect *before* they interact.
+2.  **Submit Buttons**: Unlike `disabled` buttons, keep your submit button enabled. If the user clicks it, the browser will automatically trigger `:user-invalid` on all empty required fields and focus the first one. This is excellent for accessibility and UX.
+3.  **Accessibility**: While the fallback script automatically toggles `aria-invalid`, native `:user-invalid` does not automatically sync with ARIA attributes. To ensure a consistent accessibility experience for all users, see the [Accessible Error Announcement](../accessible-error-announcement/guide.md) guide.
```

</details>

#### **rviscomi** on `guides/accessibility/accessible-error-announcement/guide.md`
> Should this be under `guides/accessibility`?

#### **philipwalton** on `guides/accessibility/accessible-error-announcement/guide.md`
> Yeah, good call. @PaulKinlan can you move this when you add the rest of your changes?

---

## PR #509: Add guidance for `move-dom-element-without-losing-state`

### Reviews

#### **malchata** (APPROVED)
*(No review body)*

---

## PR #88: Add guides for the fetchlater use cases

### Reviews

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/performance/batch-analytics-events/expectations.md`
> @paulirish @micahjo7 can you comment on whether these expectations are comprehensive enough? E.g. do we need an expectation that the API is called with the correct arguments for the use case?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+# Expectations: `batch-analytics-events`
```

</details>

#### **philipwalton** on `guides/performance/full-session-analytics/expectations.md`
> @paulirish @micahjo7 same question here...

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
```

</details>

#### **rviscomi** on `guides/performance/batch-analytics-events/expectations.md`
> I'd be curious to see if this expectation is specific enough to auto-generate the corresponding eval

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+# Expectations: `batch-analytics-events`
+
+- The `fetchLater()` API is invoked with a URL string as the first argument, and a `DeferredRequestInit` object as the second argument.
+- The `fetchLater()` API is the only API that should be used to send beacons. Other APIs like `fetch()`, `sendBeacon()`, `XMLHttpRequest`, or `new Image()` should not used.
+- `fetchLater()` should be invoked with the `activeAfter` option set.
+- Multiple invocations of `fetchLater()` withing the `activateAfter` time window should be batched into a single request (e.g. prior calls should be aborted).
+- Batching should be limited in some way to prevent starvation or quota overflow.
```

</details>

#### **rviscomi** on `guides/performance/full-session-analytics/expectations.md`
> If the second arg is optional and doesn't affect the eval, is it worth mentioning?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
+
+- The `fetchLater()` API is invoked with a URL string as the first argument, and (optionally) a `DeferredRequestInit` object as the second argument.
```

</details>

#### **philipwalton** on `guides/performance/full-session-analytics/expectations.md`
> I'm not sure. This gets back to the discussion about whether or not the tools need access to reference docs.
> 
> It's possible that someone wanting to implement this use case will need to specify custom fetch params (e.g. custom headers or a specific request method), but that's not relevant to the use case.
> 
> So maybe that means we need to add another use case that covers custom fetch param? That use case wouldn't be specific to the `fetchLater()` use cases, though it would be relevant since there is a lot of API overlap.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,7 @@
+# Expectations: `full-session-analytics`
+
+- The `fetchLater()` API is invoked with a URL string as the first argument, and (optionally) a `DeferredRequestInit` object as the second argument.
```

</details>

---

## PR #361: Autofill x 5: add content to guide.me, and add grader.ts, negative-demo.html

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #445: Add skill and build dist on dev

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #206: update console log path for showing report to remove 'guides' since w…

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #108: Add new use cases,  guides and demos for scrollbar customization, animation and preference adaptation.

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **philipwalton** (APPROVED)
> LGTM with a few additional suggestions.

### Comments

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> ```suggestion
>   - scrollbar-color
>   - prefers-contrast
> ```
> 
> If this is a key feature for this use case then it should be included here

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
+web-features:
+  - scrollbar-color
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> I think this is a good as a use case, but perhaps this is also something that should be included in a top-level skill file. @rviscomi WDYT?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Ideally we'd be specifying this in terms of a Baseline target, rather than just "legacy versions of Safari/Chrome", so that AI agent can understand whether or not it needs to include this in a given project.
> 
> Perhaps something like "If your Baseline target is older than Baseline 2025, then..."
> 
> @rviscomi we still need to figure out exactly how we phrase this, and also test that it works.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
+web-features:
+  - scrollbar-color
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-contrast
+  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
+---
+
+# Adapt scrollbar to high-contrast preferences
+
+Users who enable high-contrast modes in their operating system or browser expect UI elements (like scrollbars) to be extremely legible, often relying on stark foreground-background separation rather than subtle grays or theme colors.
+
+This guide provides optional instructions on how to use the `@media (prefers-contrast: more)` CSS media feature to enforce high-contrast scrollbar styling. 
+
+## Enhance Legibility
+
+When customizing scrollbars with `scrollbar-color` or custom variables, you can provide an explicit override for high-contrast modes. This is especially helpful if your primary application theme uses low-contrast scrollbars for aesthetic reasons.
+
+OPTIONAL: Use a `@media (prefers-contrast: more)` block to define dark, distinct colors for the thumb and track.
+
+```css
+/* Define default standard colors as variables */
+.scroller {
+  --scrollbar-thumb: #bbb;
+  --scrollbar-track: #f1f1f1;
+  
+  scrollbar-color: var(--scrollbar-thumb) var(--scrollbar-track);
+  scrollbar-width: thin;
+  scrollbar-gutter: stable;
+}
+
+/* OPTIONAL: Provide clear, high-contrast overrides */
+@media (prefers-contrast: more) {
+  .scroller {
+    /* Use extremely distinct colors like solid black against white */
+    --scrollbar-thumb: #000000;
+    --scrollbar-track: #ffffff;
+  }
+}
+```
+
+## Legacy WebKit Fallbacks
+
+If you are using legacy WebKit pseudo-elements to ensure custom colored scrollbars on older versions of Safari/Chrome, the variable assignments from the media query above will automatically cascade to the fallback.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/guide.md`
> ```suggestion
>   - scrollbar-color
>   - color-scheme
>   - prefers-color-scheme
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,77 @@
+---
+name: adapt-scrollbar-to-light-dark-preferences
+description: Ensure the scrollbar visually matches the user's operating system light/dark mode preference
+web-features:
+  - scrollbar-color
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/guide.md`
> I wonder if it's better to say "non-standard" rather than "legacy", which could maybe side step the Baseline issue I mentioned in a comment above.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,77 @@
+---
+name: adapt-scrollbar-to-light-dark-preferences
+description: Ensure the scrollbar visually matches the user's operating system light/dark mode preference
+web-features:
+  - scrollbar-color
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
+  - https://developer.chrome.com/en/docs/css-ui/scrollbar-styling
+---
+
+# Adapt scrollbar to light/dark preferences
+
+Users expect UI components, including scrollbars, to match the color scheme (light or dark mode) chosen in their operating system settings. The most essential step to achieving this is utilizing the `color-scheme` property. If you choose to apply explicit custom colors, you can use the `@media (prefers-color-scheme: dark)` CSS media feature to modify those colors dynamically.
+
+## 1. System Default Adaptation
+
+The simplest and most robust way to ensure the scrollbar adapts to the user's light/dark mode preference is to let the browser handle it via the `color-scheme` property. When a dark color scheme is enabled, the browser will automatically render its dark-variant scrollbar.
+
+MANDATORY: Define `color-scheme` on the `:root` pseudo-class.
+
+```css
+:root {
+  /* DO: Declare support for both light and dark systems */
+  color-scheme: light dark;
+}
+```
+
+## 2. Custom Color Adaptation
+
+If you are using `scrollbar-color` or the legacy `::-webkit-scrollbar` pseudo-elements to explicitly define custom scrollbar colors, you MUST ensure these colors are legible and appropriate in both light and dark modes.
+
+MANDATORY: Use CSS custom properties (variables) to define your colors and update them within a `prefers-color-scheme` media query to avoid repetition.
+MANDATORY: To prevent conflicts between standard properties and legacy WebKit selectors in browsers that support both natively (like modern Chrome), you MUST wrap legacy WebKit fallbacks in an `@supports not (scrollbar-color: auto)` block.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> Repeating what I said above, it'd be great if we could test that this fallback isn't included if the project's Baseline target doesn't require it.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+* The agent has defined `color-scheme: light dark` on the `:root` element.
+* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
+* The agent has defined CSS variables (custom properties) for the scrollbar colors.
+* The agent has provided a `@media (prefers-color-scheme: dark)` block that updates the CSS variables to darker overrides to prevent color repetition.
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/animate-scrollbar-color-on-scroll/guide.md`
> ```suggestion
>   - https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
>   - https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Properties_and_values_API/Registering_properties
>   
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,78 @@
+---
+name: animate-scrollbar-color-on-scroll
+description: Animate the scrollbar color dynamically as the user scrolls down the page
+web-features:
+  - scrollbar-color
+  - scroll-driven-animations
+  - registered-custom-properties
+sources:
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-color
+  - https://developer.mozilla.org/en-US/docs/Web/CSS/animation-timeline
```

</details>

#### **philipwalton** on `guides/user-experience/customize-scrollbar-color/guide.md`
> I'd combine this and the following use case into a single "Customize the color or thickness of a scrollbar" use case that shows how to do both.
> 
> Otherwise, if a user's prompt asks to do both then the MCP server would likely return both guides (which is probably unnecessary).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,60 @@
+---
+name: customize-scrollbar-color
+description: Change the color scheme of the scrollbar
```

</details>

#### **rviscomi** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Maybe for now let's see how well agents are able to discover this use case with specific and vague prompts, and if it's not as discoverable as we'd like, we can add something to the skill file.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-contrast-preferences/guide.md`
> Yeah, keep it, I was just saying we should have a plan for how to log these things as they come up.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,68 @@
+---
+name: adapt-scrollbar-to-contrast-preferences
+description: Enhance scrollbar visibility for users who prefer high-contrast interfaces
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> I'll update the expectation so we don't forget to enable it

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+* The agent has defined `color-scheme: light dark` on the `:root` element.
+* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
+* The agent has defined CSS variables (custom properties) for the scrollbar colors.
+* The agent has provided a `@media (prefers-color-scheme: dark)` block that updates the CSS variables to darker overrides to prevent color repetition.
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> ```suggestion
> * If the legacy WebKit pseudo elements are needed to support the user's Baseline target, `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+* The agent has defined `color-scheme: light dark` on the `:root` element.
+* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
+* The agent has defined CSS variables (custom properties) for the scrollbar colors.
+* The agent has provided a `@media (prefers-color-scheme: dark)` block that updates the CSS variables to darker overrides to prevent color repetition.
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
```

</details>

#### **philipwalton** on `guides/user-experience/adapt-scrollbar-to-light-dark-preferences/expectations.md`
> ```suggestion
> * If the legacy WebKit pseudo elements are needed to support the user's Baseline target, the fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+* The agent has defined `color-scheme: light dark` on the `:root` element.
+* The agent has created a scrollable element with `overflow: auto` or `overflow: scroll` or `overflow-y` set.
+* The agent has defined CSS variables (custom properties) for the scrollbar colors.
+* The agent has provided a `@media (prefers-color-scheme: dark)` block that updates the CSS variables to darker overrides to prevent color repetition.
+* The explicit scrollbar colors use the standard `scrollbar-color: var(--thumb) var(--track)` property applied directly to the scrollable element.
+* The explicit `scrollbar-width` property is also applied to the scrollable element to ensure the custom colors render on macOS.
+* The explicit `scrollbar-gutter: stable` property is applied to ensure the track background is visible on macOS.
+* The fallback `::-webkit-scrollbar-*` styling is conditionally applied within an `@supports not (scrollbar-color: auto)` or equivalent feature query to prevent overriding modern properties.
+* The fallback includes basic `::-webkit-scrollbar` dimensions (e.g., `width` or `height`) so the scrollbar renders its colors in webkit browsers.
```

</details>

---

## PR #414: Add evals for defer-rendering-heavy-content

### Reviews

#### **rviscomi** (APPROVED)
> LGTM

---

## PR #221: replace manual frontmatter parsing with gray-matter

### Reviews

#### **rviscomi** (APPROVED)
*(No review body)*

---

## PR #312: Refactor sync-use-cases and harden the requirements

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/user-experience/pull-to-reveal/grader.ts`
> @pattishin I generated this with `gd dev`. Could you give it a look and make sure that it's implementing the expectations correctly?
> 
> I needed to do it in this PR because I'm changing the severity of the warnings about missing eval-related files, and not having them would start to cause CI errors.

#### **rviscomi** on `guides/user-experience/scroll-target-on-load/grader.ts`
> @pattishin same comment, could you take a look?

#### **rviscomi** on `guides/user-experience/pull-to-reveal/grader.ts`
> As discussed offline, @pattishin will review the grader changes and make any changes after merging this PR

---

## PR #431: Forms skill and subdir

### Reviews

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (COMMENTED)
*(No review body)*

### Comments

#### **rviscomi** on `guides/forms/SKILL.md`
> Done

<details>
<summary>Diff Hunk</summary>

```diff
@@ -261,18 +263,18 @@ form.addEventListener('submit', (e) => {
 </form>
 ```
 
-> [!TIP]
-> **Password Visibility**: Do not hide passwords unconditionally; provide a visibility toggle to reduce entry errors rather than forcing double-entry verification.
 
 ## 9. Address Collection
 
 ### Guidelines
 
 - **DO** use a single field for names.
 - **DO** use `autocomplete="street-address"`.
+- **DO** use free-form textareas for addresses to accommodate global diversity.
```

</details>

#### **rviscomi** on `guides/forms/SKILL.md`
> Done

<details>
<summary>Diff Hunk</summary>

```diff
@@ -254,47 +256,45 @@ form.addEventListener('submit', (e) => {
 <form action="/checkout" method="POST">
```

</details>

---

## PR #423: #363 dynamic-sibling-animations

### Reviews

#### **rviscomi** (CHANGES_REQUESTED)
> Ready for `gd dev` to generate prompts and grader

#### **rviscomi** (COMMENTED)
> Ran this locally:
> 
> ```
> Agent test results:
>   Base app (pre):    0/6 checks passed (0%)
>   Unguided:          1/6 checks passed (17%)
>   Guided:            1/6 checks passed (17%)
>   Guide impact:      +0% (vs unguided)
> ```
> 
> Worth a closer look into why the guided checks are so low. Seems like maybe the agent never thought to query the CLI, so the prompt might need to be adjusted.

#### **rviscomi** (COMMENTED)
*(No review body)*

#### **rviscomi** (APPROVED)
> Since the guide is in good shape, I'm actually inclined to merge this as-is and follow up on fine-tuning the evals later as needed. Thanks @jamesnw!

### Comments

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
> Stagger animations provide an interesting effect where multiple ordered elements animate sequentially with a slight delay between each, rather than all animating at once. This technique is often used in lists, galleries, or navigation menus to guide the user's eye and add a polished, rhythmic feel to interactions.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,57 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Creating a stagger animation
+
+Stagger animations provide an interesting effect where multiple ordered elements animate
+sequentially with a slight delay between each, rather than all animating
+at once. This technique is often used in lists, galleries, or navigation
+menus to guide the user's eye and add a polished, rhythmic feel to interactions.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
> **MANDATORY:** Respect user preferences by disabling the animation for users who prefer reduced motion. 
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,57 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Creating a stagger animation
+
+Stagger animations provide an interesting effect where multiple ordered elements animate
+sequentially with a slight delay between each, rather than all animating
+at once. This technique is often used in lists, galleries, or navigation
+menus to guide the user's eye and add a polished, rhythmic feel to interactions.
+
+## Stagger animations with `sibling-index()`
+
+Use the `sibling-index()` property on the `animation-delay` property so that the animation on each element is offset by a number proportionate to their position in their parent. The `sibling-index()` function returns an integer, so it must be multiplied by a time unit to convert it to a time.
+
+```css
+#stagger-list > .item {
+  --stagger-time: 0.1s;
+  /* Define the animation first */
+  animation: fade-in 0.4s;
+  /* Set the `animation-delay` to a time multipled by the `sibling-index()` */
+  animation-delay: calc(sibling-index() * var(--stagger-time))
+}
+```
+
+Do respect user preferences by disabling the animation for users who prefer reduced motion. 
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> IIUC omitting the selector implies CSS nesting, as it's done in demo.html. That's fine for the demo, but the guide should probably expand this out so that it doesn't rely on nesting, which isn't quite widely available yet:
> 
> ```suggestion
> @media (prefers-reduced-motion: reduce){
>   /* Disable animation for users who prefer reduced motion. */
>   #stagger-list > .item {
>     animation: none;
>   }
> }
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,57 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Creating a stagger animation
+
+Stagger animations provide an interesting effect where multiple ordered elements animate
+sequentially with a slight delay between each, rather than all animating
+at once. This technique is often used in lists, galleries, or navigation
+menus to guide the user's eye and add a polished, rhythmic feel to interactions.
+
+## Stagger animations with `sibling-index()`
+
+Use the `sibling-index()` property on the `animation-delay` property so that the animation on each element is offset by a number proportionate to their position in their parent. The `sibling-index()` function returns an integer, so it must be multiplied by a time unit to convert it to a time.
+
+```css
+#stagger-list > .item {
+  --stagger-time: 0.1s;
+  /* Define the animation first */
+  animation: fade-in 0.4s;
+  /* Set the `animation-delay` to a time multipled by the `sibling-index()` */
+  animation-delay: calc(sibling-index() * var(--stagger-time))
+}
+```
+
+Do respect user preferences by disabling the animation for users who prefer reduced motion. 
+
+```css
+@media (prefers-reduced-motion: reduce){
+  /* Disable animation for users who prefer reduced motion. */
+  animation: none;
+}
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/guide.md`
> ```suggestion
>   animation-delay: calc(sibling-index() * var(--stagger-time));
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -9,3 +9,57 @@ sources:
   - https://css-tricks.com/how-to-wait-for-the-sibling-count-and-sibling-index-functions/
   - https://utilitybend.com/blog/styling-siblings-with-CSS-has-never-been-easier.-Experimenting-with-sibling-count-and-sibling-index/
 ---
+
+# Creating a stagger animation
+
+Stagger animations provide an interesting effect where multiple ordered elements animate
+sequentially with a slight delay between each, rather than all animating
+at once. This technique is often used in lists, galleries, or navigation
+menus to guide the user's eye and add a polished, rhythmic feel to interactions.
+
+## Stagger animations with `sibling-index()`
+
+Use the `sibling-index()` property on the `animation-delay` property so that the animation on each element is offset by a number proportionate to their position in their parent. The `sibling-index()` function returns an integer, so it must be multiplied by a time unit to convert it to a time.
+
+```css
+#stagger-list > .item {
+  --stagger-time: 0.1s;
+  /* Define the animation first */
+  animation: fade-in 0.4s;
+  /* Set the `animation-delay` to a time multipled by the `sibling-index()` */
+  animation-delay: calc(sibling-index() * var(--stagger-time))
+}
+```
+
+Do respect user preferences by disabling the animation for users who prefer reduced motion. 
+
+```css
+@media (prefers-reduced-motion: reduce){
+  /* Disable animation for users who prefer reduced motion. */
+  animation: none;
+}
+```
+
+## Fallback strategies
+
+{{ BASELINE_STATUS("sibling-count") }}
+
+Test for support for `sibling-index()` using CSS with `@supports (animation-delay: calc(sibling-index() * 0.1s)){}` or JavaScript with `!CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')`.
+
+To support stagger animations in older browsers, use JavaScript to add a `--sibling-index` custom property to each sibling element. MANDATORY: wrap this in a `CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')` test to avoid running unneeded JavaScript.
+
+```js
+if(!CSS.supports('animation-delay: calc(sibling-index() * 0.1s)')){
+  const staggerList = document.getElementById('stagger-list');
+  [...staggerList.children].forEach((el, index)=>el.style.setProperty('--sibling-index', index + 1));
+}
+```
+
+Add an `animation-delay` declaration that uses the `--sibling-index` custom property. It must be before the `animation-delay` declaration that uses the `sibling-index()` function.
+
+```css
+#stagger-list > .item {
+  animation-delay: calc(var(--sibling-index) * var(--stagger-time));
+  animation-delay: calc(var(sibling-index()) * var(--stagger-time));
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/expectations.md`
> Each expectation should correspond to a single, concrete assertion
> ```suggestion
> * The implementation provides a fallback for older browsers using CSS custom properties.
> * The custom property values start at 1 and increment for each sibling.
> * The fallback is applied conditionally only when `sibling-index()` is not supported.
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,4 @@
+* The animation on the first element starts before the animation on the second element.
+* `sibling-index()` is multiplied by a time and used as the `animation-delay`.
+* If a legacy fallback is required, JavaScript checks if `sibling-index()` is supported, and if not, adds a custom property on each sibling element being animated, starting with 1. The `animation-delay` uses this property in its calculation, and a second `animation-delay` uses `sibling-index()`.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/prompts.md`
> The ideal prompt wouldn't be this prescriptive, to better emulate a developer who isn't necessarily aware of the latest features and best practices. 
> 
> Was this generated or handwritten? (Just asking so we can adjust the generation prompt if needed)

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,4 @@
+- add a 0.4s fade-in animation to the cards in the .grid so they stagger in sequentially. use the css sibling-index() function for the animation-delay multiplied by a 0.1s stagger time. also include a js fallback that sets a --sibling-index variable for older browsers, but make sure to wrap it in a CSS.supports check so it doesn't run if it's not needed. disable the animation entirely if the user prefers reduced motion.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-styling/guide.md`
> I think the old description actually does a better job of describing the use case that's solved by this guide, which should make it more discoverable and likely to be used by agents. Was there something about it that you didn't like?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -1,6 +1,6 @@
 ---
 name: dynamic-sibling-styling
-description: Stagger animation or transition timing across sibling elements so each one starts after a computed delay based on its position in the sibling list.
+description: Compute visual properties like position, color, or size dynamically for each child element based on how many siblings are present and its position among them.
```

</details>

#### **rviscomi** on `guides/user-experience/dynamic-sibling-animations/prompts.md`
> Yeah, manually edit for now.
> 
> If useful, I've found this prompt helpful for fine-tuning the task.md:
> 
> >look at task.md. if a coding agent with access to guide.md implements the first prompt, would you expect it follow everything in expectations.md?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,4 @@
+- add a 0.4s fade-in animation to the cards in the .grid so they stagger in sequentially. use the css sibling-index() function for the animation-delay multiplied by a 0.1s stagger time. also include a js fallback that sets a --sibling-index variable for older browsers, but make sure to wrap it in a CSS.supports check so it doesn't run if it's not needed. disable the animation entirely if the user prefers reduced motion.
```

</details>

---

## PR #217: Add Scroll-Driven Animations Use-Cases and Demos

### Reviews

#### **philipwalton** (CHANGES_REQUESTED)
> Thanks for the extensive set of demos and use cases!
> 
> I made several suggestions for how to reword some of the use case description to be more active, and I also suggested combining/dropping a few of the use cases.
> 
> Some other potential use cases that I don't think are covered  by the ones you listed:
> - **Scroll more indicators:** shadows or other effects that indicate to the user that an element can be scrolled beyond where it currently is.
> - **Backdrop fade with UI sheet dismiss:** create an effect with swipeable UI sheets where the backdrop fades in/out as the sheet enters/exits.
> 
> WDYT?

#### **philipwalton** (APPROVED)
> Thanks @bramus, this looks great! I just left a few minor comments.

#### **philipwalton** (COMMENTED)
*(No review body)*

#### **philipwalton** (COMMENTED)
*(No review body)*

### Comments

#### **philipwalton** on `guides/user-experience/3d-model-explorer/guide.md`
> I think this use case may be too niche to include. We're aiming for 2-5 core use cases per feature for the initial launch, so I think it'd be fine to omit this one.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: 3d-model-explorer
+description: Rotate a 3D model on scroll.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> description: Create a carousel of slides with images or other visual elements, where each slide animates as they enter/center/exit their scroller. For example, the slides may fade-in/fade-out, rotate, get bigger or smaller, etc.
> ```
> 
> Reworded to be phrased more actively, and I used the term "slide" which I think is more common for carousels?
> 
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: carousel-item-effects
+description: A carousel where the entries animate as they enter/center/exit their scroller. The items can fade-in/fade-out, rotate, get bigger or smaller, etc.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-step-indicator/guide.md`
> Do you think this use case is sufficiently distinct from the `scroll-progress-indicator` use case below (which is more general and could potentially cover this one)?
> 
> I do think people think of the "dot indicators" patterns in a carousel as being distinct from scroll progress indicators, but then there's also the question of whether you should use SDA or `::scroll-marker` for that. WDYT?

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: carousel-step-indicator
+description: A stepped progress or indicator bar shown above an image carousel that grows to indicate which item the user is currently viewing.
```

</details>

#### **philipwalton** on `guides/user-experience/cover-image-to-fixed-header/guide.md`
> IMO this one could be merged into the `shrinking-header-on-scroll` use case (since that one is more common).
> 
> While I get that the visual effects are different, the guidance will likely be mostly the same, and a user prompt would likely to match both guides (which would duplicate tokens unnecessarily, and isn't ideal).

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: cover-image-to-fixed-header
+description: A full-page cover image that dynamically shrinks and transforms into a fixed header as the user scrolls down the page.
```

</details>

#### **philipwalton** on `guides/user-experience/horizontal-scroll-section/guide.md`
> I wonder if this could be expanded into a more generalized "scrollytelling" use case, and then this specific example could be included in the guide. WDYT?
> 
> My concern with the current framing is I think it'd be unlikely to match many user prompts.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: horizontal-scroll-section
+description: A layout technique where a horizontal strip of content scrolls by horizontally as the user scrolls vertically down the page.
```

</details>

#### **philipwalton** on `guides/user-experience/parallax-animation/guide.md`
> ```suggestion
> description: Create scroll-based effects (such as parallax) where foreground and background layers move at different rates, creating a sense of depth as the user scrolls.
> ```
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: parallax-animation
+description: Images or Layers of content that move at a slower or different speed relative to the scrolling content, yielding a 3D depth or parallax effect.
```

</details>

#### **philipwalton** on `guides/user-experience/reveal-and-unreveal-effects-for-items-in-list/guide.md`
> This is pretty similar to `carousel-item-effects`.
> 
> I think if one is frames as being specific to a "carousel" (and focused on horizontal scroll) and the other is for standard page content (focused on vertical scroll) then they could work as separate use cases ... but I could also seem them being combined into a single use case and guide that covers both.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: reveal-and-unreveal-effects-for-items-in-list
+description: Items that animate in and out as they enter or exit their scrollport.
```

</details>

#### **philipwalton** on `guides/user-experience/reverse-scrolling-columns/guide.md`
> I really like this visual effect, but I also think it's niche and is unlikely to match many user prompts. I'd be OK with dropping this one for the initial launch.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: reverse-scrolling-columns
+description: A multi-column layout where a central column follows the regular scroll direction, while the surrounding columns are animated to scroll in the opposite direction.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-progress-indicator/guide.md`
> ```suggestion
> description: Create a scroll progress bars, step trackers, or any visual affordance that communicates how far through a page or section the user has scrolled.
> ```
> 
> Per my comments above, I think `carousel-step-indicator` above can likely be merged with this one.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: scroll-progress-indicator
+description: A progress bar at the top of the scrollport that grows until it takes up the full width upon reaching the end of the document, indicating how far down you have scrolled.
```

</details>

#### **philipwalton** on `guides/user-experience/scroll-velocity-effects/guide.md`
> Similar to my other comments, I really like this visual effect, but I also think it's niche and is unlikely to match many user prompts. I'd be OK with dropping this one for the initial launch.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: scroll-velocity-effects
+description: Animate elements on scroll based on scroll velocity and direction, applying dynamic visual changes like skewing or motion blur.
```

</details>

#### **philipwalton** on `guides/user-experience/self-revealing-images-on-scroll/guide.md`
> ```suggestion
> description: Create fade-in, scale-up, or other complex reveal-type effects on elements as they enter and exit the viewport while the user is scrolling
> ```
> I think is a good use case, but can probably be generalize to be about more than images. And I think this could satisfy my comment in https://github.com/GoogleChrome/guidance/pull/217/changes#r2898646830 re: vertical based scroll reveals.
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: self-revealing-images-on-scroll
+description: Images that reveal themselves dynamically as they enter the scrollport, often using an animated "open curtain" clip-path effect.
```

</details>

#### **philipwalton** on `guides/user-experience/shrinking-header-on-scroll/guide.md`
> ```suggestion
> description: Create a large header bar that stays fixed to the top but shrinks in size (along with other effects like adding a shadow) as the user scrolls down.
> ```
> 
> As mentioned above, I think the `cover-image-to-fixed-header` use case can be merged into this one.
> 
> 

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: shrinking-header-on-scroll
+description: A sticky top navigation bar that minimizes in size and gains a drop shadow effect as the user scrolls down the web app.
```

</details>

#### **philipwalton** on `guides/user-experience/stacking-cards/guide.md`
> I really like this effect (also [this one](https://chrome.dev/carousel/horizontal/app-switcher/)), but I worry it's too niche to match any user prompts...

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: stacking-cards
+description: A set of elements that animate on scroll from the moment they get stuck until the next item in the list is stuck
```

</details>

#### **philipwalton** on `guides/user-experience/text-reveal-character-by-character/guide.md`
> I think text reveal is a really common use case, but it's not usually done on scroll. I worry this guide could match people wanting to do other text-reveal type effects which could create issues. I'd be fine to drop this as well.

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,8 @@
+---
+name: text-reveal-character-by-character
+description: Text that gradually reveals itself character by character as the overall progress of a scroller advances to the end of the page.
```

</details>

#### **philipwalton** on `guides/user-experience/carousel-item-effects/guide.md`
> ```suggestion
> name: carousel-slide-effects
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,10 @@
+---
+name: carousel-item-effects
```

</details>

#### **philipwalton** on `guides/user-experience/self-revealing-images-on-scroll/guide.md`
> ```suggestion
> name: scroll-entry-exit-effects
> ```

<details>
<summary>Diff Hunk</summary>

```diff
@@ -0,0 +1,9 @@
+---
+name: self-revealing-images-on-scroll
```

</details>

---

