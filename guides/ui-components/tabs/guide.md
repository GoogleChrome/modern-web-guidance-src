---
name: tabs
description: "Build a responsive tabbed interface with good UX when not all tabs fit on screen."
web-feature-ids:
  - focusgroup
  - anchor-positioning
  - hidden-until-found
  - scroll-snap
  - popover
  - scroll-buttons
guides:
  - anchor-positioning-tab-underline
  - search-hidden-content
  - scrollability-affordance-hints
  - overflow-popup
---

## Choosing the correct semantics

If the content and expected behaviour of the candidate UI is page navigation, the WAI ARIA tabs pattern should not be used even if the intent is to present the content as a tabbed interface.

## Use focusgroup for managing the tablist focus

Instead of manually implementing a roving tabindex or ARIA activedescendant pattern to meet the focus management requirement of the ARIA `tablist` role, we can use `focusgroup` which has a `tablist` behaviour.

```html
<div focusgroup="tablist">
    <button type="button">HTML</button>
    <button type="button">CSS</button>
    <button type="button">JavaScript</button>
</div>
```

In the above example, the element bearing `focusgroup=tablist` will receive a minimum ARIA role of `tablist` and the buttons will receive a minimum role of `tab`.

Though `focusgroup` will apply the `tab` semantics to focusables within its scope, prefer `<button>` to avoid needing to reimplement button-like behaviour.
Make sure to use `type=button` for any `<button>` elements to avoid unexpected submitter behaviour if nested within a form.

## Implementing tab selection and tabpanel association

`focusgroup=tablist` does not sufficiently implement all of what’s necessary for an operational tabbed interface.

- Use `aria-labelledby` or `aria-label` to give the tablist an accessible name.
- Use `aria-selected` to indicate which tab is currently selected.
- Set `role=tabpanel` on the tab panels and use `aria-labelledby` or `aria-label` to give the panel an accessible name (e.g. `aria-labelledby` can reference the associated tab).
- Use `aria-controls` to associate the tab buttons with a tab panel.
- Use `hidden` to hide tab panels whose tab is not actively selected.

### Selection behaviour

A tabbed interface can either use mutually exclusive selection or multi-selection. This guide only covers the former.

When it comes to how tabs become selected, one can either make _selection follow focus_ or all the user to move focus between tabs and perform _selection by activation_.
The latter _selection by activation_ works well in scenarios where a tab panel’s content will be lazy loaded.

## Allowing tab panel content to be searchable

`hidden=until-found` can be used to make a tab panel’s contents searchable by a browser’s find-in-page feature.
Since this feature would be used in the context of a more complex interface, we need to ensure that the interface’s state is kept in sync when content within a previously hidden tab panel has been matched.
Use the `beforematch` event to sync the tab selection state and to restore `hidden=until-found` for tab panels whose tabs are no longer selected.
It is important to restore `hidden=until-found` so that those tabs can continue to be searchable.

In browsers that do not support `hidden=until-found`, prefer to treat this feature as an enhancement rather than trying to polyfill it for unsupporting browsers as that is not completely possible across browsers.
