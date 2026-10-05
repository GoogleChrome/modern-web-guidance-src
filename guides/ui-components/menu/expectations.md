# Menu expectations

Each item is an observable expectation for the menu demos. Keep these focused on agreed menu behaviour; implementation rationale, visual suggestions, and general guide-quality checks belong elsewhere.

- When native `focusgroup` is supported, the demo uses it for menu keyboard navigation.
- When native `focusgroup` is unsupported, feature detection enables the keyboard-navigation fallback.
- Without native `focusgroup`, the menu and its commands expose menu and menu-item semantics to assistive technology.
- Focusing a top-level trigger may preview its menu without moving focus from the trigger.
- A previewed menu exposes `aria-expanded="true"` on its trigger and does not present a menu item as focused.
- Pressing the relevant arrow key from a preview moves focus into the menu.
- Pressing Enter or Space while the menu is only previewed dismisses the preview without activating a command.
- Opening a menu by keyboard moves focus immediately to its first enabled item; there is no 250 ms delay.
- During the immediate focus transition, the trigger is temporarily hidden from assistive technology for one frame, and `aria-hidden` is then removed.
- In an open top-level menu, Left and Right Arrow follow the APG menubar pattern by moving to and opening the adjacent menu.
- Each menu trigger's `aria-expanded` value reflects whether its menu is open or previewed.
