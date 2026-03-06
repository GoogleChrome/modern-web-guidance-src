---
name: search-hidden-content
description: Hide content from view using patterns such as accordions, tabs, and "Read more" sections, while ensuring the hidden text reveals itself during native "Find in page" searches, allows search engine indexing, supports URL fragment deep links, and maintains ARIA accessibility.
web-feature-ids:
  - details
  - details-name
  - hidden-until-found
---

# Search hidden content

Web interfaces often hide content from view to improve the user experience, save screen space, or increase page performance. Traditional methods like `display: none` or `visibility: hidden` work to hide content visually, but they also make that content completely inaccessible to screen readers and browser features like "Find in page".

To hide content visually but still allow it to be searchable by users and enable it to be deep linked to via URL fragments and "Scroll to Text Fragment" links, you can use either the HTML `<details>` element or the `hidden="until-found"` attribute. The `<details>` element is generally recommended as it's simpler to implement and maintain, but there are some more complex cases where `<details>` is not sufficient and `hidden="until-found"` is required.

For example:

- If you want full control over the styling of the show/hide mechanism.
- If the UI controls to show/hide the content are in another part of the DOM.
- If you don't want to support hiding the content after it's shown.

## How to implement

The `<details>` element has searchable and accessible text by default, and no special implementation is required. Prefer using `<details>` over `hidden="until-found"` if possible.

If you need to use `hidden="until-found"` instead, follow these instructions:

1. **Apply the attribute:** Add the `hidden="until-found"` HTML attribute directly to the elements containing the content that should be hidden from view.
2. **Synchronize UI state:** If the interface has related states that depend on the content's visibility (e.g., updating ARIA attributes, toggling open/close CSS classes, or rotating accordion icons):
   - You **MUST** add an event listener for the `beforematch` event.
   - Register the `beforematch` event listener directly on the element carrying the `hidden="until-found"` attribute. Since the event bubbles, you may alternatively use event delegation by registering a single listener on a parent element (such as a tab container) to manage multiple hidden sections at once.
   - Inside the event listener, execute the logic to synchronize related UI elements (such as closing other open tabs or changing the state of a toggle button).

## Example code

**Goal:** Render a hidden container where the content remains invisible to the user until they search for a word within that section.

### Using `<details>` element

```html
<details>
  <summary>Click to expand</summary>
  <p>This content is visually hidden.</p>
</details>
```

#### Mutually exclusive content (e.g. tabs)

When handling mutually exclusive regions, like tabs, use the native HTML `<details>` element with a shared `name` attribute.

```html
<div class="tab-container">
  <!-- The name attribute creates an exclusive accordion/tab group -->
  <details class="tab" name="my-tabs">
    <summary>Tab 1 (closed)</summary>
    <p>Tab 1 content</p>
  </details>

  <details class="tab" name="my-tabs" open>
    <summary>Tab 2 (open)</summary>
    <p>Tab 2 content</p>
  </details>

  <details class="tab" name="my-tabs">
    <summary>Tab 3 (closed)</summary>
    <p>Tab 3 content</p>
  </details>
</div>
```

### Using `hidden="until-found"` attribute

```html
<!-- The browser automatically removes hidden="until-found" upon a search match -->
<div class="hidden-container" hidden="until-found">
  <p>This content is visually hidden.</p>
</div>
```

#### Mutually exclusive content (e.g. tabs)

When handling mutually exclusive regions, like tabs, ensure only the matched tab becomes visible. Since the `beforematch` event bubbles, you can listen on a parent container to manage state before the browser reveals the matched content.

```html
<div class="tab-container">
  <div class="tab">
    <p>Tab 1 content (visible)</p>
  </div>

  <div class="tab" hidden="until-found">
    <p>Tab 2 content (hidden)</p>
  </div>

  <div class="tab" hidden="until-found">
    <p>Tab 3 content (hidden)</p>
  </div>
</div>
```

```javascript
const tabContainer = document.querySelector('.tab-container');

tabContainer.addEventListener('beforematch', () => {
  // Hide all tabs before the browser reveals the matched tab
  tabContainer.querySelectorAll('.tab').forEach((tab) => {
    tab.hidden = 'until-found';
  });
});
```

## Best practices for `hidden="until-found"`

- **DO** apply borders, padding, and backgrounds to nested child wrappers rather than directly to the element with the `hidden="until-found"` attribute. This prevents unintended layout shifts or visual remnants while the element is hidden.
- **DO NOT** apply `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties directly to elements with the `hidden="until-found"` attribute. This breaks the native functionality and permanently hides the content from the search index.
- **DO NOT** use `hidden="until-found"` for sensitive information, internal data tokens, or irrelevant data that should not be exposed via search.
- **DO NOT** use `hidden="until-found"` as a replacement for "screen reader only" (.sr-only) text.

## Browser support and fallback strategies

The `<details>` element is Baseline Widely available, so a fallback strategy is not required.

The `hidden="until-found"` attribute is not yet Baseline Widely available, but it can be safely used with a fallback in unsupporting browsers. **DO NOT** avoid `hidden="until-found"` because of missing browser support, as its accessiblity benefits far outweigh the cost of implementing a fallback.

#### `hidden="until-found"` fallback

For standard UI elements like accordions or "Read more" sections, use JavaScript to feature-detect and show all content if the feature is unsupported.

```javascript
if (!('onbeforematch' in HTMLElement.prototype)) {
  // Expand all hidden content for unsupported browsers
  document.querySelectorAll('[hidden="until-found"]').forEach((el) => {
    el.removeAttribute('hidden');
    // MANDATORY: also update any aria references to this element.
  });
}
```

For mutually exclusive UI paradigms (like tabs where content shares the same visual region), the fallback should extract and display all content linearly below the main interactive area, using URL anchor fragments to allow users to navigate directly to the respective sections.
