---
name: tabs
description: "Build a responsive tabbed interface with good UX when not all tabs fit on screen."
web-feature-ids:
  - focusgroup
  - hidden-until-found
  - scroll-snap
  - scroll-driven-animations
  - interpolate-size
guides:
  - anchor-positioning-tab-underline
  - search-hidden-content
  - scrollability-affordance-hints
  - overflow-popup
  - menu
  - tooltip
---

# Tabbed interfaces

## Basic markup

Instead of manually implementing a roving tabindex or ARIA activedescendant pattern to meet the focus management requirement of the ARIA `tablist` role, we can use `focusgroup` which has a `tablist` behavior and automatically assigns the right roles (`tablist` on the container and `tab` on its focusable children).

```html
<div class="tabs">
  <div focusgroup="tablist" aria-label="Web platform technologies">
      <button type="button" id="html-tab" aria-selected="true" focusgroupstart>HTML</button>
      <button type="button" id="css-tab">CSS</button>
      <button type="button" id="js-tab">JavaScript</button>
  </div>
  <div role="tabpanel" aria-labelledby="html-tab" tabindex="0"><!-- content for HTML tab --></div>
  <div role="tabpanel" aria-labelledby="css-tab" hidden="until-found"><!-- content for CSS tab --></div>
  <div role="tabpanel" aria-labelledby="js-tab" hidden="until-found"><!-- content for JavaScript tab --></div>
</div>
```

DO NOT use this or the WAI-ARIA tabs pattern for page navigation, even if it is intended to be presented as a tabbed interface.

Tablist:
- Prefer `<button>` for the tabs to avoid needing to reimplement button-like behavior. Add `type=button` to avoid unexpected submitter behavior if nested within a form.
- Use `aria-labelledby` or `aria-label` to give the tablist an accessible name.
- Use `aria-selected` to indicate which tab is currently selected.

Tab panels:
- Set `role=tabpanel` on the tab panels and use `aria-labelledby` or `aria-label` to give the panel an accessible name (e.g. `aria-labelledby` can reference the associated tab).
- Do not add `aria-controls` to the tabs: no screen reader uses it.
- Use `hidden="until-found"` to hide tab panels whose tab is not actively selected while still keeping them searchable by the browser’s find-in-page feature. Use `hidden` with no value to remove the content from the browser's search in-page feature as well.
- When using `hidden="until-found"`, use the `beforematch` event to sync the tab & tab panel selection state when find-in-page makes a different tab active.
- Set `tabindex=0` on the visible tab panel if it contains no focusable elements, and remove it from hidden panels.

- MANDATORY: Render the initial state in the HTML: `hidden` on every panel except the selected one, and `aria-selected="true"` on the selected tab. Otherwise every panel shows until script runs, overlapping when they share a grid cell.

## Keyboard interaction

When it comes to how tabs become selected, one can either make _selection follow focus_ or allow the user to move focus between tabs and perform _selection by activation_.

Default to _selection follows focus_.
It saves a keypress per tab, is more discoverable, and matches native radio groups.
Use selection by activation instead when showing a panel has a cost the user should opt into, since arrowing from the first tab to the fifth would pay it for every tab along the way:
- Showing the panel is not instant: content is fetched on demand, or rendering it is noticeably slow.
- Selecting a tab has side effects: it changes the URL or history, sends analytics, starts media, or saves state.
- The panel shifts the layout significantly (e.g. panels of very different heights push the rest of the page around).

With either pattern, focus entering the group must land on the selected item. By default it returns to the last focused item instead, which is wrong once selection can change without focus (find-in-page, script).
Use `nomemory` and move `focusgroupstart` to the selected tab:

```html
<div focusgroup="tablist nomemory" aria-label="Web platform technologies">
```

```js
for (const tab of tabs) {
  tab.ariaSelected = tab === selected;
  tab.toggleAttribute('focusgroupstart', tab === selected);
}
```

## Styling

### Indicating the selected tab

Style the selected tab from `aria-selected`, so the visual state can never disagree with the accessible one.
Do not apply any styling that changes the dimensions of the tab (e.g., `padding`, `border`, `margin`, `font-size`, `font-weight`, etc).

- MANDATORY: Do not indicate the selected tab with color alone (WCAG 1.4.1). Add a shape, such as an underline.
- Draw the underline with a border on a pseudo-element. DO NOT use `box-shadow` or a background: forced colors mode removes both, leaving no indicator.

```css
[role="tab"] {
  position: relative;
}

[aria-selected="true"] {
  color: var(--accent);

  /* Example: a 3px underline that takes no space */
  &::after {
    content: "";
    position: absolute;
    inset: auto 0 0;
    border-block-end: 3px solid var(--accent);
  }
}
```

To animate the underline between tabs, move the pseudo-element to the tablist and tether it to the selected tab with anchor positioning. See {{ GUIDE_REF("anchor-positioning-tab-underline") }} for details.


- DO NOT put padding, borders, margins, or backgrounds on the panel element itself. `hidden=until-found` does not use `display: none`: it only hides the panel's contents, so a hidden panel still renders its padding, border, margin, and background as an empty strip. Put these styles on a child wrapper inside the panel instead.
- `hidden=until-found` panels still participate in grid and flex layout, so `gap` adds space for every hidden panel. Place all panels in the same grid cell, or avoid `gap` between panels.

See {{ GUIDE_REF("search-hidden-content") }} for more details.

## Handling tabs that don’t fit

Keep tabs on a single row. DO NOT wrap them onto multiple rows: wrapped rows make the tab order and the selected tab hard to follow.
When the tabs are wider than the available space, either scroll the tablist or move the tabs that don’t fit into a popup menu.
Optionally, also shrink the inactive tabs, so more tabs fit before either kicks in.

1. **Scrolling** keeps every tab in the tablist and in the keyboard order, and works with touch swiping. It needs no script beyond selection. Use it by default, and always on touch-first interfaces.
2. **An overflow menu** shows the names of all hidden tabs at once, in a list, without scrolling. Use it when there are a few primary tabs and a tail of less used ones, and users mostly use a pointer. It needs script to detect overflow.
3. **Shrinking inactive tabs** truncates their labels, so it suits tabs the user creates (e.g. open documents in an editor) better than a fixed set of tabs with short labels. Combine it with scrolling or an overflow menu.

### Strategy 1: scrolling

1. Make the tablist a horizontal scroll container: `display: flex`, `overflow-x: auto`, and `flex: none` on the tabs so they never shrink (unless combined with strategy 3).
2. Optional: snap to tab edges with `scroll-snap-type: inline proximity` on the tablist and `scroll-snap-align: start` on the tabs. Use `proximity`, not `mandatory`, so the user can still stop between tabs.
3. Hide the scrollbar and fade out each edge of the tablist that has more tabs beyond it, as described below. A fade suits a row of tabs better than a shadow, and works on any background. See {{ GUIDE_REF("scrollability-affordance-hints") }} for more details on scrollability hints.
4. On every selection change, scroll the selected tab into view with `scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' })`. `container: 'nearest'` scrolls only the tablist, not the page. Clicking a partially visible tab then reveals it along with part of the next one, so mouse users without a horizontal scroll wheel can still reach every tab. It also covers selection without focus, such as find-in-page.

#### Fading the edges

{{ INCLUDE("../../ui-atoms/scrollability-affordance-hints/guide.md#fades") }}

### Strategy 2: overflow menu

Hide the tabs that don’t fit and list them in a menu opened by a “More” button after the tablist.
Build the button and its menu as a menu button; see {{ GUIDE_REF("menu") }} for structure, positioning, and keyboard behavior.
The rest of this section covers only what is specific to tabs.

- **Place the “More” button outside the tablist.** A tablist may only contain tabs. This makes it a separate `Tab` stop that arrow keys do not reach. If arrow-key access matters more, move focus from the last visible tab to the “More” button on `ArrowRight`/`End`, and back on `ArrowLeft`. The tablist itself does nothing at its last tab, so this does not conflict with it, but it is custom key handling that users of the tab pattern may not expect.
- **Make the “More” button look different from a tab.** Use an icon (such as a horizontal ellipsis) with an accessible name, not a text label: a text label looks like one more tab.
- **Detect overflow with `IntersectionObserver`**, rooted at the tablist with `threshold: 1`, so partially visible tabs count as overflowed. It reports each tab as it starts or stops fitting, with no layout math.
- **Hide overflowed tabs with `visibility: hidden`**, not `display: none` or `hidden`. They keep their layout box, so the observer still reports when they fit again, and they leave the focus order and the accessibility tree. Set `overflow: clip` on the tablist so they don’t overflow the page.
- **Mirror each tab as a `menuitem`**. Show only the items whose tab is hidden. Activating an item selects its tab and focuses it. Focus the tab before hiding the popover: otherwise the popover returns focus to the previously focused tab, which selects it again.
- **Hide the “More” button when no tab overflows.** This cannot loop: showing the button only narrows the tablist, so at least one tab still overflows.
- **Keep the selected tab in the tablist.** DO NOT leave it in the menu or mark the “More” button as selected: it is a button, not a tab. When the selected tab overflows (selected from the menu, by find-in-page, or after a resize), set `display: none` on the tabs before it, closest first, until it fits. The observer then reports them as overflowed, so they appear in the menu. DO NOT reorder tabs (in the DOM or with CSS `order`): the removed tabs are gone from both the visual and the focus order, so the two still match. Keep overflowed tabs visible while they are selected or focused: a selected tab can then be focused before the observer catches up, and a focused tab keeps focus when a resize overflows it.

```html
<div class="tabs">
  <div class="tablist" focusgroup="tablist nomemory" aria-label="Product details">
    <button type="button">Overview</button>
    <button type="button">Specifications</button>
    <!-- … -->
  </div>
  <!-- Outside the tablist: a tablist may only contain tabs.
       Icon, not text, so it does not read as another tab. -->
  <button type="button" class="more" hidden aria-label="More tabs" aria-haspopup="menu" aria-expanded="false">⋯</button>
  <!-- Menu: see the menu guide. One menuitem per tab. -->
  <!-- Tab panels -->
</div>
```

```js
const observer = new IntersectionObserver(entries => {
  for (const { target: tab, intersectionRatio } of entries) {
    const overflowed = intersectionRatio < 1;
    // CSS: .clipped:not([aria-selected="true"], :focus) { visibility: hidden; }
    tab.classList.toggle('clipped', overflowed);
    menuItemFor(tab).hidden = !overflowed;
  }
  more.hidden = !tabs.some(tab => tab.classList.contains('clipped'));
  reveal();
}, { root: tablist, threshold: 1 });

tabs.forEach(tab => observer.observe(tab));

// Also call after every selection change.
// CSS: .displaced { display: none; }
function reveal() {
  const tab = tabs.find(tab => tab.ariaSelected === 'true');
  const before = tabs.slice(0, tabs.indexOf(tab));
  tabs.forEach(tab => tab.classList.remove('displaced'));
  while (before.length && !fits(tab)) {
    before.pop().classList.add('displaced');
  }
}

// Checks both edges, so it works in either writing direction
function fits(tab) {
  const list = tablist.getBoundingClientRect();
  const { left, right } = tab.getBoundingClientRect();
  return left >= list.left && right <= list.right;
}
```

{# NOTE: Unhandled edge cases: with selection by activation, a focused inactive tab that reveal() displaces loses focus, and one that overflows entirely keeps focus while clipped out of view. #}

{# PENDING_GUIDE_REF: See {{ GUIDE_REF("overflow-popup") }} for more details on moving overflowing controls into a popup. #}

### Strategy 3: Making inactive tabs smaller

This may be combined with the overflow handling strategies described above to allow more tabs to fit before scrolling or showing a menu.
It is more well suited to user-driven tablists (e.g. a document editor) rather than hardcoded UI tablists.

- Let inactive tabs shrink and keep the selected tab at its full width: `flex: 0 1 auto` on the tabs, and `min-inline-size: max-content` on the selected tab, which also overrides any `max-inline-size`, so its label is never truncated. DO NOT use `flex-shrink: 0` for this: it cannot transition smoothly (see below).
- Set a `min-inline-size` on the tabs. Once every inactive tab is at its minimum, the remaining overflow is handled by scrolling or the overflow menu.
- Truncate shrunk labels with `text-overflow: ellipsis`. Put the label in its own element, since `text-overflow` needs `overflow: hidden` and would otherwise clip the focus ring.
- Keep the full label in the DOM, so the accessible name and find-in-page are unaffected. Show it to sighted users on hover and focus with a tooltip; see {{ GUIDE_REF("tooltip") }}.
- If tabs have icons, keep the icon visible and truncate only the label, so a minimum-width tab is still recognizable.
- Transition `min-inline-size` so tabs resize smoothly when the selection changes, instead of jumping. Set `interpolate-size: allow-keywords` on the tablist so it interpolates to and from `max-content`; no view transition is needed. Only transition it when `prefers-reduced-motion` is `no-preference`. Transitioning `flex-shrink` does not work: any value above 0 shrinks a tab all the way to its minimum when the tabs overflow.

{# NOTE: Unhandled edge case: selecting a tab widens it and shifts the tabs after it, which can move the next tab out from under the pointer. #}



## Fallback strategies

{{ FEATURE_FALLBACKS("focusgroup") }}

### Fallbacks & browser support for `hidden=until-found`

{{ BASELINE_STATUS("hidden-until-found") }}

Treat `hidden=until-found` as an enhancement. Do not polyfill it: find-in-page cannot be reproduced across browsers.
No feature detection is needed when setting it from script: in browsers without support, `panel.hidden = 'until-found'` sets the boolean `hidden`, so the panel is simply hidden and not searchable.

### Fallbacks & browser support for `interpolate-size`

{{ BASELINE_STATUS("interpolate-size") }}

No fallback is needed: without `interpolate-size`, tabs resize instantly instead of transitioning.

### Fallbacks & browser support for scroll-driven animations

{{ INCLUDE("../../ui-atoms/scrollability-affordance-hints/guide.md#fallbacks-browser-support-for-scroll-driven-animations") }}
