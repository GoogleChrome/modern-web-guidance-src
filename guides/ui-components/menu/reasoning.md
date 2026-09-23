# Architectural Decisions & Workarounds: Accessible Command Menu Guide

This document records the technical reasoning, design decisions, and pragmatic workarounds behind the instructions, recommendations, and code snippets prescribed in the **Accessible Application Command Menu Guide** (`guide.md`). 

Since LLMs and RAG engines read `guide.md` as their single source of truth for constructing accessible application menus, this document explains *why* those specific instructions and workarounds are written into the guide. It acts as an architectural memory bank for future guide authors and content creators, preventing the accidental removal of critical pragmatic recommendations during future refactoring of the guidance.

---

## 1. Why the Guide Prescribes Nesting `focusgroup` Inside `[popover]`

### Context in `guide.md`
The guide instructs developers to always nest the `focusgroup="menu"` container element inside the `[popover]` wrapper div, rather than putting both attributes on the same element.

### Architectural Rationale
When declaring `focusgroup` directly on a container that also acts as a popover (e.g., `<div popover="auto" focusgroup="menu">`), browser engines (specifically Chromium-based browsers) clobber the keyboard focusgroup semantics. This prevents arrow keys from managing focus natively.

- **Chromium Bug:** [Chromium Issue #564673920](https://issues.chromium.org/issues/564673920) reports that popover elements interfere with focusgroup keyboard navigation.
- **Top Layer Interaction Bug:** [WHATWG HTML Issue #11641](https://github.com/whatwg/html/issues/11641) discusses how top-layer elements (like popovers) should be isolated from parent focusgroups, as focus can bleed or get clobbered unexpectedly.

By instructing the reader/LLM to nest the elements, the guide guarantees that the Popover API's top-layer behavior is cleanly separated from the Focusgroup keyboard semantics.

---

## 2. Why the Guide Recommends `popover="manual"` for Submenus

### Context in `guide.md`
The guide recommends declaring nested submenus with `popover="manual"` rather than `popover="auto"`.

### Architectural Rationale
Using `popover="auto"` on both the parent menu and the submenu causes a "light-dismiss conflict." When focus moves into the submenu, the browser interprets this as a focus shift away from the parent `popover="auto"` container, causing the parent menu to immediately light-dismiss (disappear).

By prescribing `popover="manual"`, the guide ensures the submenu is isolated from automatic dismissals, keeping the menu tree persistent while active. The guide then describes the simple JavaScript coordination needed to handle state synchronization:
- Opening the submenu: calling `subMenu.showPopover()` and setting `aria-expanded="true"`.
- Closing the submenu: calling `subMenu.hidePopover()` and restoring focus to its trigger.
- Dismissing the stack: handling outside pointer clicks to programmatically hide all open menu levels.

---

## 3. Stopping Keyboard Event Propagation (Bubbling Prevention)

### Context in `guide.md`
The guide emphasizes intercepting and calling `event.stopPropagation()` on arrow and escape keys within the menu keydown listeners.

### Architectural Rationale
Because submenus are nested inside the parent menu wrapper in the DOM, keyboard events bubble up through the DOM tree. 
- If a user presses `Escape` inside the submenu to go back to the parent menu, the event bubbles from the submenu to the parent menu.
- Without stopping propagation, the parent menu's keydown listener catches the bubbling `Escape` event, interprets it as a command to close the root, and collapses both menus instantly.

- **Open UI Discussion:** [Open UI Issue #1147](https://github.com/openui/open-ui/issues/1147) details how unintercepted `Escape` event propagation out of nested interactive components/popovers breaks parent/widget keyboard workflows.

By prescribing explicit capture and stopping of key events inside each layer, the guide ensures that sequential closing behaviors work correctly.

---

## 4. Why the Guide Mandates a 250ms Delay Before Programmatic Focus

### Context in `guide.md`
The guide specifies a short (~250ms) delay when programmatically focusing the first item of a newly opened menu.

### Architectural Rationale
When opening an ARIA menu, screen readers are expected to announce both the transition of the trigger (e.g., *"File, button, expanded"*) and the newly focused menuitem (e.g., *"New file, menuitem, 1 of 3"*). 
In VoiceOver (especially macOS Safari/Chrome), moving focus immediately upon opening triggers a race condition where VoiceOver's visual focus announcer cuts itself off to announce the new focus, or completely ignores the first menu item's name.

The 250ms delay instruction ensures that VoiceOver has sufficient time to complete its expanded-state announcement before programmatically receiving the new focus event, ensuring complete screen-reader accessibility.

---

## 5. Why the Guide Retains `focusgroup="menu"` but Implements a Local Fallback

### Context in `guide.md`
The guide advocates retaining the native `focusgroup="menu"` attribute in the HTML markup as the progressive enhancement hook, but utilizing a local capture-phase keyboard listener as a fallback.

### Architectural Rationale
While native browser support for `focusgroup` is emerging, the existing [Microsoft Focusgroup Polyfill](https://github.com/microsoft/polyfills/tree/main/packages/focusgroup) is highly verbose and introduces:
1. **Memory Leaks:** It leaks element and event-listener ownership references when DOM elements are dynamically detached.
2. **Viewport Scrolling:** It fails to cleanly call `preventDefault()` in older Safari engines, causing arrow presses to simultaneously scroll the parent viewport.

By advising a clean HTML markup declaration (`focusgroup="menu"`) coupled with a small, capture-phase progressive enhancement script, the guide allows the component to:
- Act as an immediate fallback for engines without native support (cleanly calling `preventDefault` and preventing Safari viewport scrolling).
- Upgrade automatically to native browser-level focusgroup handling once support matures, without requiring any alterations to the markup.
- Avoid the overhead and memory overhead associated with standard external polyfill scripts.

- **Spec Explainer:** Refer to the [Open UI Focusgroup Explainer](https://open-ui.org/components/scoped-focusgroup.explainer/) for the standard progressive-enhancement target attributes.
