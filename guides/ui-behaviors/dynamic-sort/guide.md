---
name: dynamic-sort
description: Reorder a list, card grid or table's rows when the user picks a sort option, with locale-aware sorting, animated reordering, a single screen reader announcement, and large-list performance.
web-feature-ids:
  - view-transitions
  - view-transitions-element-scoped
  - move-before
guides:
  - move-dom-element-without-losing-state
---

# User-Triggered Dynamic Sort

Use this pattern when a user changes the order of a list or card grid through a control (a `<select>`, a button group, or a toggle). Examples: a product list sorted by price, or a card grid sorted A→Z. Focus is on the control, so no item is mid-interaction when the list reorders.

The same mechanics (sorting data, `moveBefore()`, view transitions, one announcement) apply to table rows; see "Reordering table rows" below. Column header semantics (`<button>` in `<th>`, `aria-sort`) belong to a sortable-table guide. This guide does not cover lists that re-sort because their data changed while an item is focused or being edited.

## Sort the data, then reorder the nodes

**MANDATORY:** Keep the source data as the single source of truth. Sort a copy of the data, then reorder the existing DOM nodes. Never read values back out of the DOM to sort it.

* Sort text with `Intl.Collator`, not `<` comparisons. Create the collator once and reuse it. Use `numeric: true` so "Item 2" sorts before "Item 10".
* Sort numbers with subtraction, never the default `sort()`, which compares as strings.
* `Array.prototype.sort()` is stable, so equal items keep their previous relative order. Add a tiebreaker (such as name) when a secondary order is expected.
* Do not mutate the source array. Use `toSorted()` or `[...items].sort()`.

```javascript
// Create once; constructing a collator per comparison is slow.
const collator = new Intl.Collator(document.documentElement.lang || undefined, {
  numeric: true,
  sensitivity: 'base', // "a" and "A" compare equal; omit if case should break ties
});

const comparators = {
  'name-asc': (a, b) => collator.compare(a.name, b.name),
  'name-desc': (a, b) => collator.compare(b.name, a.name),
  'price-asc': (a, b) => a.price - b.price || collator.compare(a.name, b.name),
  'price-desc': (a, b) => b.price - a.price || collator.compare(a.name, b.name),
};
```

Create each item's element once and keep a map from item id to element. To sort, reorder those same nodes. Recreating them with `innerHTML` discards focus, scroll position inside items, and image state, and it breaks view transitions, which match old and new elements by identity.

Use `moveBefore()` rather than `append()` so moved items keep state such as `<iframe>` content, playing animations, and focus inside them.

{{ BASELINE_STATUS("move-before") }}

```javascript
function applySort(list, items, elementsById, key) {
  const sorted = items.toSorted(comparators[key]);

  // Falls back to append() where moveBefore() is unavailable.
  const move = 'moveBefore' in Element.prototype
    ? (node) => list.moveBefore(node, null)
    : (node) => list.append(node);

  // Moving each node to the end in sorted order is enough; no need to compute minimal moves.
  for (const item of sorted) move(elementsById.get(item.id));
}
```

**DO NOT** fake a sort with CSS `order` or `flex-direction: row-reverse`. Visual order and DOM order must match so keyboard and screen reader order follows what the user sees.

### Reordering table rows

For a `<table>`, move the `<tr>` elements within their `<tbody>` using the same function: `tbody.moveBefore(row, null)`. Never reorder `<th>` header rows or recreate the `<tbody>`. Give rows `view-transition-name: match-element`, and keep the single status announcement.

## Animate the reorder with view transitions

Wrap the DOM reorder in a view transition and give every item a unique `view-transition-name` so each one animates from its old position to its new one. Without it the list snaps.

Use `view-transition-name: match-element` so you do not need to generate a name per item.

{{ BASELINE_STATUS("view-transitions") }}

```css
.item {
  /* Derives a unique name from each element's identity. */
  view-transition-name: match-element;
}

::view-transition-group(*) {
  animation-duration: 250ms; /* example value; keep movement brief */
}

@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none;
  }
}
```

```javascript
function sortWithTransition(list, items, elementsById, key) {
  const update = () => applySort(list, items, elementsById, key);

  // Prefer a transition scoped to the list: the rest of the page stays interactive.
  // Fall back to a document-level transition, then to a plain update.
  if (list.startViewTransition) {
    list.startViewTransition(update);
  } else if (document.startViewTransition) {
    document.startViewTransition(update);
  } else {
    update();
  }
}
```

* **Rapid changes:** starting a new view transition skips the one in flight, which is the desired behavior when the user flips through options quickly. Always apply the final state in the update callback so the DOM ends in the correct order even if the animation is skipped.
* **Large lists:** every named element is captured as an image, so naming hundreds of items is expensive. Name only items that are in the viewport (for example with `IntersectionObserver`), or skip the transition when the list is larger than a few hundred items.
* **Interactivity:** a document-level view transition blocks pointer events on the whole page while it runs, whereas `list.startViewTransition()` only affects the list's subtree. Prefer the scoped form, and keep the animation brief either way. Names only need to be unique within the scope. For table rows, scope the `<table>` (or a wrapper around it). See {{ GUIDE_REF("scoped-component-transitions") }} for scoped transition details.

{{ BASELINE_STATUS("view-transitions-element-scoped") }}

## Announce the change once

Sorting moves many nodes, but the user performed one action. **DO NOT** put `aria-live` on the list, which would announce every moved item. Instead:

* Add one visually hidden `role="status"` element and set its text once per sort, after starting the update. It must already be in the DOM before its text changes.
* Name the result, not the mechanism: "Sorted by price, low to high, 24 items".
* Keep focus on the control that triggered the sort. Do not move focus into the list.
* Make the current sort state readable from the control itself, so a screen reader user who lands on it hears what is selected without searching the page.

### Sort controls

Any one of these controls can trigger the sort. Whichever you use, it calls the same sort function and updates the same single status region.

* **`<select>`:** one option per key/direction pair. The selected option is announced natively; no extra ARIA is needed.
* **Button group for the key:** a `role="group"` with `aria-label="Sort by"` and one `<button>` per key. Set `aria-pressed="true"` on the active button and `"false"` on the rest, so the active choice is announced as "pressed". Do not use `aria-selected` or `aria-current` on buttons; `aria-pressed` is the toggle-button state.
* **Direction toggle:** a single `<button>` whose visible label states the current direction ("Ascending"/"Descending") and whose `aria-pressed` reflects it. Do not label it with the action it will perform ("Sort descending"), which is ambiguous when read out of context.
* **Radio group:** radios in a `<fieldset>` with a `<legend>`; the checked radio is announced natively.

Drag-to-reorder is a manual sort and is out of scope here.

```html
<label>Sort by
  <select id="sort">
    <option value="name-asc">Name (A to Z)</option>
    <option value="name-desc">Name (Z to A)</option>
    <option value="price-asc">Price (low to high)</option>
    <option value="price-desc">Price (high to low)</option>
  </select>
</label>

<!-- aria-pressed exposes the active key as "pressed" to screen readers. -->
<div role="group" aria-label="Sort by">
  <button type="button" data-key="name" aria-pressed="true">Name</button>
  <button type="button" data-key="price" aria-pressed="false">Price</button>
</div>

<!-- The label states the current direction, not the action. -->
<button type="button" id="direction" aria-pressed="false">Ascending</button>

<p id="sort-status" role="status" class="visually-hidden"></p>
```

```css
/* Hides the status text visually but keeps it available to screen readers. Do not use display: none. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
```

```javascript
// Button group and direction toggle: update the pressed state, then sort.
function onSortChange(key, descending) {
  for (const button of keyButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.key === key));
  }
  directionButton.setAttribute('aria-pressed', String(descending));
  directionButton.textContent = descending ? 'Descending' : 'Ascending';

  sortWithTransition(list, items, elementsById, `${key}-${descending ? 'desc' : 'asc'}`);
  // Set the message once, not once per item.
  status.textContent = `Sorted by ${key}, ${descending ? 'descending' : 'ascending'}, ${items.length} items`;
}
```

## Performance on large lists

* Sort the data array once per change. Sorting thousands of objects is fast; layout and rendering are the cost.
* Reorder nodes in a single pass with no layout reads (`offsetTop`, `getBoundingClientRect()`) in the loop.
* Add `content-visibility: auto` with `contain-intrinsic-size` to items in long lists so off-screen items skip rendering work.
* Above roughly a thousand items, virtualize the list and sort the data instead of keeping every node in the DOM. Skip the view transition when virtualizing.
* If sorting is driven by typing in a filter box, debounce the input.

## Fallbacks

If your Baseline target does not support `element.startViewTransition()`, use `document.startViewTransition()`. If it does not support that either, reorder without animation. The list still sorts correctly and the announcement is unchanged, so this is graceful degradation: the animation enhances the use case but is not core to it.

If your Baseline target does not support `moveBefore()`, use `append()`. DOM order is identical; items may lose focus, iframe, or animation state inside them, which only matters when items contain such state.
