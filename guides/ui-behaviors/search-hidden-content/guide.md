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

#### Mutually exclusive disclosures

When handling mutually exclusive content regions, like an exclusive accordion, use the native HTML `<details>` element with a shared `name` attribute.

```html
<div class="accordion-group">
  <!-- The name attribute creates an exclusive disclosure group -->
  <details class="disclosure" name="my-accordion">
    <summary>Section 1</summary>
    <p>Section 1 content</p>
  </details>

  <details class="disclosure" name="my-accordion" open>
    <summary>Section 2</summary>
    <p>Section 2 content</p>
  </details>

  <details class="disclosure" name="my-accordion">
    <summary>Section 3</summary>
    <p>Section 3 content</p>
  </details>
</div>
```

### Using `hidden="until-found"` attribute

In the `beforematch` event handler, you MUST synchronize related ARIA states such as setting `aria-expanded="true"` on the controlling button. If you don't intend to support hiding the content, use `aria-disabled` on the trigger control, rather than `disabled`, as to prevent a loss of focus.

```html
<button aria-expanded="false">Hidden content</button>
<!-- The browser automatically removes hidden="until-found" upon a search match -->
<div id="hidden-panel" class="hidden-container" hidden="until-found">
  <p>This content is visually hidden.</p>
</div>
```

```javascript
const revealBtn = document.getElementById('reveal-btn');
const hiddenPanel = document.getElementById('hidden-panel');

revealBtn.addEventListener('click', () => {
  hiddenPanel.removeAttribute('hidden');
  revealBtn.setAttribute('aria-expanded', 'true');
  revealBtn.setAttribute('aria-disabled', 'true');
});

hiddenPanel.addEventListener('beforematch', () => {
  revealBtn.setAttribute('aria-expanded', 'true');
  revealBtn.setAttribute('aria-disabled', 'true');
});
```

#### Custom mutually exclusive disclosures

With mutually exclusive disclosures there's no way to semantically convey which control relates to which piece of hidden/expanded content, in a way that's announced by screen readers. As a result, this may cause WCAG 1.3.2 Meaningful Order issues, as the order in which content should be announced, may no longer be correct, and may affect the meaning of the content.

See {{ GUIDE_REF("accordion") }} for accordion patterns, in which multiple disclosures are used in a way that is accessible.

See {{ GUIDE_REF("tabs") }} for tab patterns which hides content until a specific tab is selected, keeping the information displayed minimal, helping to reduce the amount of visual noise.

## Best practices for `hidden="until-found"`

- **DO** apply borders, padding, and backgrounds to nested child wrappers rather than directly to the element with the `hidden="until-found"` attribute. This prevents unintended layout shifts or visual remnants while the element is hidden.
- **DO NOT** apply `display: none`, `visibility: hidden`, or any associated `display` or `visibility` CSS properties directly to elements with the `hidden="until-found"` attribute. This breaks the native functionality and permanently hides the content from the search index.
- **DO NOT** use `hidden="until-found"` for sensitive information, internal data tokens, or irrelevant data that should not be exposed via search.
- **DO NOT** use `hidden="until-found"` as a replacement for "screen reader only" (.sr-only) text.

## Browser support and fallback strategies

{{ BASELINE_STATUS("details") }}

{{ BASELINE_STATUS("hidden-until-found") }}

**DO NOT** avoid `hidden="until-found"` because of missing browser support, as its accessibility benefits far outweigh the cost of implementing a fallback.

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

For mutually exclusive UI paradigms (like custom exclusive panels where content shares the same visual region), the fallback should extract and display all content linearly below the main interactive area, using URL anchor fragments to allow users to navigate directly to the respective sections.
