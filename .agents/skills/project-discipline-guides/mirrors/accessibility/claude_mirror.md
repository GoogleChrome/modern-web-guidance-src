# Accessibility Development: Common Knowledge Guide

A comprehensive reference of standard accessibility best practices, syntax, and APIs that I apply by default when writing or reviewing accessible web content.

---

## 1. Semantic HTML Foundations

### Document Structure
- Always declare `<!DOCTYPE html>` and set `<html lang="en">` (or appropriate BCP 47 language tag).
- Use `<html lang>` on the root and `lang` attributes on inline elements with different languages (e.g., `<span lang="fr">bonjour</span>`).
- Set `dir="rtl"` for right-to-left languages; prefer `dir="auto"` for user-generated content.
- Provide a meaningful `<title>` per page; update it for SPA route changes.
- Use `<meta name="viewport" content="width=device-width, initial-scale=1">` — never set `user-scalable=no` or `maximum-scale` below 5 (blocks zoom).

### Landmarks
Use semantic landmark elements rather than `<div role="...">`:
- `<header>` (page banner when top-level)
- `<nav>` (navigation regions; label multiple with `aria-label`)
- `<main>` (one per page; primary content)
- `<aside>` (complementary content)
- `<footer>` (contentinfo when top-level)
- `<section>` (only when it has an accessible name via `aria-labelledby` or `aria-label`)
- `<article>` (self-contained content)
- `<search>` (new HTML element for search regions; replaces `role="search"`)

### Headings
- Use one `<h1>` per page (typically), with logical hierarchy (`h1` → `h2` → `h3`).
- Don't skip levels for visual styling — use CSS to style.
- Headings define document outline used by screen reader rotor navigation.

### Lists
- `<ul>`, `<ol>`, `<dl>` for grouped items. Don't fake lists with `<br>`.
- Don't apply `list-style: none` without considering Safari's removal of list semantics — restore with `role="list"` when needed for accessibility.

### Text Content
- `<strong>` for importance, `<em>` for emphasis (not `<b>`/`<i>` for semantics).
- `<abbr title="...">` for abbreviations.
- `<time datetime="2026-05-13">` for machine-readable dates.
- `<address>` for contact info.
- `<blockquote cite="...">` and `<cite>` for citations.
- `<code>`, `<pre>`, `<kbd>`, `<samp>`, `<var>` for technical content.

---

## 2. Forms

### Labels (mandatory for every input)
Three valid patterns:
```html
<!-- Explicit (preferred) -->
<label for="email">Email</label>
<input id="email" type="email">

<!-- Implicit wrapping -->
<label>Email <input type="email"></label>

<!-- aria-label / aria-labelledby when visual label not possible -->
<input type="search" aria-label="Search products">
```

- Never use `placeholder` as the only label — disappears on input, low contrast, not announced reliably.
- Group related fields with `<fieldset>` and `<legend>` (e.g., radio groups, address blocks).

### Input Types & Attributes
Use specific input types for keyboard & assistive tech support:
- `type="email"`, `type="tel"`, `type="url"`, `type="number"`, `type="search"`, `type="date"`, `type="time"`, `type="color"`
- `inputmode="numeric"` / `"decimal"` / `"tel"` / `"email"` for virtual keyboard hints (without changing validation semantics)
- `autocomplete="email"`, `"name"`, `"current-password"`, `"new-password"`, `"one-time-code"`, `"street-address"`, etc. — critical for cognitive accessibility and password managers
- `required`, `min`, `max`, `pattern`, `minlength`, `maxlength` for native validation
- `enterkeyhint="search"` / `"send"` / `"go"` / `"done"` for virtual keyboard return key

### Errors & Validation
- Associate error messages with inputs via `aria-describedby`.
- Use `aria-invalid="true"` on invalid fields.
- Render errors in text, not just color.
- Prefer inline error messages near the field; provide a summary list at the top for long forms with focus management.
- Use `aria-live="polite"` regions for dynamic validation feedback.

```html
<label for="pwd">Password</label>
<input id="pwd" type="password" aria-describedby="pwd-help pwd-err"
       aria-invalid="true" autocomplete="new-password" required>
<p id="pwd-help">At least 8 characters.</p>
<p id="pwd-err" role="alert">Password is too short.</p>
```

### Buttons
- Use `<button type="button">` for actions, `<button type="submit">` (or rely on default) for submission.
- Always set explicit `type` to avoid accidental form submits.
- Never use `<div onclick>` — not focusable, not keyboard operable, no role.
- Disabled buttons (`disabled`) are removed from tab order and not announced as actionable; consider `aria-disabled="true"` if you need keyboard focus to remain (e.g., to surface why it's disabled).

---

## 3. ARIA — Rules and Common Patterns

### The Five Rules of ARIA
1. **Don't use ARIA if a native HTML element/attribute provides the semantics.** `<button>` > `<div role="button">`.
2. **Don't change native semantics** unless necessary (avoid `<h1 role="button">`).
3. **All interactive ARIA roles must be keyboard accessible.**
4. **Don't use `role="presentation"` or `aria-hidden="true"` on focusable elements.**
5. **All interactive elements must have an accessible name.**

### Naming & Description
- `aria-label="..."` — overrides visible text; use when no visible label exists.
- `aria-labelledby="id1 id2"` — references visible text (multiple IDs concatenated).
- `aria-describedby="id"` — supplemental description, announced after the name.
- Accessible name calculation precedence: `aria-labelledby` > `aria-label` > native (e.g., `<label>`, alt, title) > content.

### State & Properties
- `aria-expanded="true|false"` on disclosure triggers (accordions, dropdowns, menus).
- `aria-pressed="true|false"` for toggle buttons.
- `aria-checked="true|false|mixed"` for custom checkboxes/radios.
- `aria-selected="true|false"` for tabs, options, grid cells.
- `aria-current="page|step|location|date|time|true"` for current item in a set.
- `aria-disabled="true"` for visually disabled but focusable controls.
- `aria-hidden="true"` to hide from AT (don't use on focusable elements).
- `aria-controls="id"` to associate a control with the element it controls.
- `aria-haspopup="menu|listbox|tree|grid|dialog"` for elements that open popups.

### Live Regions
- `aria-live="polite"` — announces when idle (status updates).
- `aria-live="assertive"` — interrupts (errors, urgent alerts).
- `role="status"` ≈ `aria-live="polite"`.
- `role="alert"` ≈ `aria-live="assertive"`.
- `role="log"`, `role="timer"`, `role="marquee"` for specialized live regions.
- `aria-atomic="true"` — re-read entire region on change.
- `aria-relevant="additions|removals|text|all"` — what changes to announce.
- Live region must exist in DOM **before** content is added; don't dynamically inject the region itself.
- `aria-busy="true"` while updates are in flight.

### Common Roles
- `role="button"`, `"link"`, `"checkbox"`, `"radio"`, `"switch"`
- `role="dialog"`, `"alertdialog"`
- `role="tablist"`, `"tab"`, `"tabpanel"`
- `role="menu"`, `"menubar"`, `"menuitem"`, `"menuitemcheckbox"`, `"menuitemradio"`
- `role="listbox"`, `"option"`, `"combobox"`
- `role="tree"`, `"treeitem"`, `"treegrid"`
- `role="grid"`, `"row"`, `"gridcell"`, `"columnheader"`, `"rowheader"`
- `role="tooltip"`
- `role="progressbar"` (with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`, `aria-valuetext`)
- `role="region"` (named landmark)

---

## 4. Keyboard Accessibility

### Focus Order & Tabbing
- Tab order must follow visual/reading order. Use DOM order; avoid positive `tabindex`.
- `tabindex="0"` — adds to natural tab order (use for custom interactive elements).
- `tabindex="-1"` — programmatically focusable but not in tab order (for focus management).
- Never use `tabindex` ≥ 1 (creates unpredictable order).

### Focus Management
- After route changes in SPAs, move focus to the new page's heading or main container.
- After opening a modal, move focus inside (typically first focusable element or the dialog itself with `tabindex="-1"`); trap focus inside; return focus to the trigger on close.
- After deleting an item from a list, move focus to the next/previous item or a sensible neighbor.
- Use `element.focus({ preventScroll: true })` when scrolling would be jarring.
- Use `element.focus({ focusVisible: true })` to force focus ring (newer).

### Focus Indicators
- Never `outline: none` without a replacement.
- Use `:focus-visible` to show indicators only for keyboard focus:
```css
:focus { outline: none; }
:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
```
- Indicators must meet 3:1 contrast against adjacent colors (WCAG 2.4.11/2.4.13).

### Keyboard Patterns (per WAI-ARIA Authoring Practices)
- **Buttons**: Enter and Space activate.
- **Links**: Enter activates.
- **Checkboxes/Switches**: Space toggles.
- **Radio groups**: Arrow keys move and select.
- **Tabs**: Arrow keys move between tabs (manual or automatic activation); Home/End jump to ends.
- **Listbox/Menu**: Arrows navigate, Enter/Space select, Escape closes, Type-ahead search by first letter.
- **Combobox**: Arrows open/navigate, Enter selects, Escape closes/clears.
- **Dialog**: Escape closes; focus trapped within.
- **Tree**: Arrow Right expands, Arrow Left collapses, Up/Down moves.
- **Slider**: Arrows adjust by step; Page Up/Down by larger step; Home/End to extremes.

### Skip Links
```html
<a href="#main" class="skip-link">Skip to main content</a>
```
Position off-screen; reveal on focus.

---

## 5. Images & Media

### Images
- `<img alt="Descriptive text">` — describe purpose/content concisely.
- `<img alt="">` — for decorative images (still required attribute).
- Don't start alt with "Image of" / "Picture of".
- For complex images (charts, diagrams), provide `alt` summary plus longer description nearby or via `aria-describedby`.
- SVG: use `<title>` (and optionally `<desc>`) inside, plus `role="img"` and `aria-labelledby`. Add `aria-hidden="true"` and `focusable="false"` for decorative inline SVG.
- `<figure>` + `<figcaption>` for captioned images.
- Icon-only buttons need `aria-label`.

### Video & Audio
- Provide captions via `<track kind="captions" srclang="en" src="..." default>` for video.
- Provide transcripts for audio-only content.
- Provide audio descriptions (`kind="descriptions"`) when visual content conveys info not in the audio.
- Don't autoplay media with sound. If autoplay is unavoidable, start muted and provide controls.
- Always include `controls` attribute or accessible custom controls.
- Avoid content that flashes more than 3 times per second (seizure risk; WCAG 2.3.1).

---

## 6. Color, Contrast & Visual Design

### Contrast (WCAG 2.2 AA)
- Body text: 4.5:1 minimum against background.
- Large text (≥18pt or ≥14pt bold): 3:1.
- Non-text UI elements & graphical objects: 3:1 (icons, form borders, focus rings).
- AAA: 7:1 body / 4.5:1 large.
- WCAG 3 introduces APCA — perceptually-tuned contrast algorithm; not yet normative.

### Color Use
- Don't rely on color alone to convey meaning (errors, required fields, chart series). Pair with text, icons, patterns, or shapes.
- Test in grayscale.

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Color Scheme
- Support `prefers-color-scheme: dark | light`.
- Set `color-scheme: light dark;` in CSS so form controls and scrollbars adapt.

### Other Media Queries
- `prefers-contrast: more | less | custom`
- `prefers-reduced-transparency`
- `prefers-reduced-data`
- `forced-colors: active` — for Windows High Contrast Mode; use `system-color` keywords (`Canvas`, `CanvasText`, `LinkText`, `ButtonFace`, `ButtonText`, `Highlight`, etc.) and avoid removing borders.
- `inverted-colors`

### Forced Colors Mode
- Don't override system colors blindly.
- Use `forced-color-adjust: none` sparingly when essential (e.g., color-coded charts).
- Test focus indicators remain visible (use `outline` rather than `box-shadow` since outlines respect forced colors).

### Zoom & Reflow
- Content must reflow at 320 CSS pixels wide without horizontal scrolling (400% zoom on 1280px viewport).
- Text must scale to 200% without loss of content/functionality.
- Use relative units (`rem`, `em`, `%`, `ch`) over `px` for typography.
- Don't lock viewport zoom.

### Spacing & Targets
- WCAG 2.5.8 (AA, 2.2): Interactive targets at least 24×24 CSS pixels.
- WCAG 2.5.5 (AAA): 44×44 CSS pixels.
- Sufficient spacing prevents accidental activation.
- Text spacing override (1.5.12): users must be able to override line-height to 1.5×, paragraph spacing to 2×, letter spacing to 0.12×, word spacing to 0.16× without loss.

---

## 7. Tables

```html
<table>
  <caption>Quarterly revenue</caption>
  <thead>
    <tr><th scope="col">Quarter</th><th scope="col">Revenue</th></tr>
  </thead>
  <tbody>
    <tr><th scope="row">Q1</th><td>$100k</td></tr>
  </tbody>
</table>
```
- Use `<th scope="col|row">` (and `scope="colgroup|rowgroup"` for spans).
- `<caption>` for the table's accessible name.
- Don't use tables for layout.
- Complex tables: `headers="id1 id2"` on cells referencing `<th id>`.

---

## 8. Modern Native HTML APIs

### `<dialog>` Element
```html
<dialog id="d">
  <form method="dialog">
    <button>Close</button>
  </form>
</dialog>
<script>
  d.showModal(); // modal with backdrop, focus trap, Escape to close
  d.show();     // non-modal
</script>
```
- `showModal()` provides automatic focus trap, inert background, Escape to close.
- Style backdrop with `dialog::backdrop`.
- `closedby="any|closerequest|none"` (newer) for declarative close behavior.

### Popover API
```html
<button popovertarget="menu">Open</button>
<div id="menu" popover>...</div>
```
- `popover` (auto), `popover="manual"`, `popover="hint"`.
- Light-dismiss, top layer, accessible by default.
- Pair with `popovertargetaction="show|hide|toggle"`.

### `<details>` / `<summary>`
Native disclosure widget — keyboard accessible, exposes expanded state. Use `name` attribute (newer) for exclusive accordion groups.

### `inert` Attribute
- `inert` on a subtree removes it from tab order, hides from AT, and disables pointer events.
- Use to handle background content when a modal is open (instead of manual `aria-hidden` + tabindex juggling).

### `hidden` Attribute
- `hidden` (boolean) hides from rendering and AT.
- `hidden="until-found"` — hidden but findable via in-page find/scroll-to-text-fragment; auto-reveals.

### Anchor Positioning (newer; progressive enhancement)
For tooltips/popovers using `anchor()` and `position-anchor`.

---

## 9. JavaScript / DOM APIs

### Focus
- `element.focus(options)`
- `document.activeElement`
- `element.matches(':focus-visible')`
- Roving tabindex pattern for composite widgets.

### Observers for Dynamic UI
- `MutationObserver` — react to DOM changes (e.g., to update live region).
- `IntersectionObserver` — visibility changes.
- `ResizeObserver` — layout changes.

### Page Visibility & Focus
- `document.visibilityState`, `visibilitychange` event.
- Pause animations / non-critical work when hidden.

### Speech & Other APIs
- `SpeechSynthesis` API — supplemental TTS (not a replacement for proper semantics).
- `navigator.languages` — respect user language preferences.

### Event Handling
- Don't rely solely on `mouseover`/`mouseout` — pair with `focus`/`blur` for keyboard.
- Use `pointerdown`/`pointerup` to support all input types.
- Don't `preventDefault()` on key events without preserving expected keyboard behavior.

---

## 10. CSS Techniques

### Visually Hidden (screen reader-only)
```css
.sr-only {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```
Don't use `display: none` or `visibility: hidden` — they hide from screen readers too.

### Logical Properties
Use logical properties for internationalization:
- `margin-inline-start` (not `margin-left`)
- `padding-block-end` (not `padding-bottom`)
- `inset-inline`, `border-inline-end`, `text-align: start`

### Pseudo-classes
- `:focus-visible` — keyboard focus only.
- `:focus-within` — element or any descendant has focus.
- `:placeholder-shown`, `:user-invalid`, `:user-valid` (better than `:invalid` because they wait for user interaction).
- `:has()` — parent selector enabling many semantic patterns.

### Don't Break Selection
- Avoid `user-select: none` on text content.

### CSS-driven Order
- Don't use `flex-direction: row-reverse`, `order`, or `grid` placement to change visual order without considering keyboard/reading order divergence.

---

## 11. Common Patterns

### Modal Dialog Checklist
- `role="dialog"` (or `<dialog>`) with `aria-modal="true"`.
- Accessible name via `aria-labelledby` (heading) or `aria-label`.
- Focus moves to dialog on open.
- Focus trapped within while open.
- Escape closes.
- Focus returns to trigger on close.
- Background made `inert`.

### Accordion / Disclosure
```html
<button aria-expanded="false" aria-controls="panel-1">Section</button>
<div id="panel-1" hidden>...</div>
```
Or use `<details>`/`<summary>`.

### Tabs
```html
<div role="tablist" aria-label="Settings">
  <button role="tab" aria-selected="true" aria-controls="p1" id="t1">One</button>
  <button role="tab" aria-selected="false" aria-controls="p2" id="t2" tabindex="-1">Two</button>
</div>
<div role="tabpanel" id="p1" aria-labelledby="t1" tabindex="0">...</div>
<div role="tabpanel" id="p2" aria-labelledby="t2" tabindex="0" hidden>...</div>
```
- Roving tabindex on tabs.
- Arrow keys navigate.

### Combobox / Autocomplete
- `role="combobox"` on the input, `aria-expanded`, `aria-controls` to listbox, `aria-activedescendant` for highlighted option.
- Listbox with `role="listbox"`, options with `role="option"` and `aria-selected`.

### Toast / Notification
- `role="status"` for non-critical, `role="alert"` for critical.
- Don't auto-dismiss critical messages without user action.

### Loading States
- `aria-busy="true"` on the region being loaded.
- Announce completion with a live region.
- Provide visible spinner with accessible name (`role="progressbar"` with `aria-label`).

### Tooltip
- Triggered on hover AND focus.
- Dismissible via Escape.
- Pointer can hover the tooltip without it disappearing (WCAG 1.4.13).
- Associate via `aria-describedby` (descriptive) or `aria-labelledby` (if it's the name).
- Don't put interactive content in tooltips.

### Icon Buttons
```html
<button aria-label="Close">
  <svg aria-hidden="true" focusable="false">...</svg>
</button>
```

---

## 12. SPAs & Routing

- On client-side route change: update `<title>`, move focus to the new view's heading/main, announce via live region if focus move isn't appropriate.
- Use real `<a href>` links for navigation, not `<div onclick>`.
- Preserve browser history; support back/forward.

---

## 13. Internationalization Touchpoints

- Don't construct sentences from concatenated translated fragments.
- Use ICU MessageFormat or i18n libraries for plurals/genders.
- Format numbers, dates, currencies with `Intl.NumberFormat`, `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.PluralRules`, `Intl.ListFormat`.
- Don't bake text into images.

---

## 14. WCAG 2.2 Quick Reference

### Perceivable
- 1.1.1 Non-text content (alt text)
- 1.2.x Time-based media (captions, transcripts, audio description)
- 1.3.1 Info and relationships (semantic markup)
- 1.3.5 Identify input purpose (autocomplete)
- 1.4.3 Contrast (minimum)
- 1.4.4 Resize text
- 1.4.10 Reflow
- 1.4.11 Non-text contrast
- 1.4.12 Text spacing
- 1.4.13 Content on hover or focus

### Operable
- 2.1.1 Keyboard (all functionality)
- 2.1.2 No keyboard trap
- 2.1.4 Character key shortcuts (must be remappable)
- 2.2.1 Timing adjustable
- 2.2.2 Pause, stop, hide
- 2.3.1 Three flashes
- 2.4.1 Bypass blocks (skip links)
- 2.4.3 Focus order
- 2.4.4 Link purpose
- 2.4.6 Headings and labels
- 2.4.7 Focus visible
- 2.4.11 Focus not obscured (minimum) — new in 2.2
- 2.5.3 Label in name (visible label text must appear in accessible name)
- 2.5.7 Dragging movements — new in 2.2 (must have single-pointer alternative)
- 2.5.8 Target size (minimum) — new in 2.2

### Understandable
- 3.1.1 Language of page
- 3.1.2 Language of parts
- 3.2.1 On focus (no context change)
- 3.2.2 On input (no surprise context change)
- 3.2.6 Consistent help — new in 2.2
- 3.3.1 Error identification
- 3.3.2 Labels or instructions
- 3.3.3 Error suggestion
- 3.3.7 Redundant entry — new in 2.2
- 3.3.8 Accessible authentication — new in 2.2 (no cognitive function tests for auth)

### Robust
- 4.1.2 Name, role, value
- 4.1.3 Status messages

---

## 15. Testing & Tooling

### Automated Tools (catch ~30-40% of issues)
- axe-core / @axe-core/react / jest-axe
- Lighthouse accessibility audit
- WAVE
- Pa11y
- ESLint plugins: `eslint-plugin-jsx-a11y`, `eslint-plugin-vuejs-accessibility`

### Manual Testing
- Tab through entire interface; verify focus visibility and logical order.
- Operate all controls with keyboard only.
- Zoom to 200% and 400%.
- Test with screen readers:
  - **macOS/iOS**: VoiceOver (built-in)
  - **Windows**: NVDA (free), JAWS
  - **Android**: TalkBack
  - **ChromeOS**: ChromeVox
- Test in forced colors / high contrast mode.
- Test with `prefers-reduced-motion`.
- Test with browser text-only zoom.
- Use accessibility tree inspector in DevTools.

### Screen Reader Conventions
- VoiceOver: Ctrl+Option+arrow keys; rotor with VO+U.
- NVDA: Insert+Space toggles browse/focus mode; H for headings, F for form fields, K for links, R for landmarks, D for landmarks (NVDA).
- Different SR + browser combos behave differently — test the major pairs (NVDA+Firefox, NVDA+Chrome, JAWS+Chrome, VoiceOver+Safari).

---

## 16. Common Anti-Patterns to Avoid

- `<div>` / `<span>` with `onclick` for interactive controls.
- `aria-label` on non-interactive, non-landmark elements (often ignored).
- `role="button"` on `<a href>` (use the right element instead).
- Redundant ARIA: `<button role="button">`, `<nav role="navigation">`.
- `aria-hidden="true"` on focusable elements (creates "ghost" focus).
- Positive `tabindex` values.
- Removing focus outlines without replacement.
- Placeholder as label.
- Color-only error indication.
- Auto-playing media with sound.
- Carousels that auto-advance without controls.
- CAPTCHAs without accessible alternatives.
- Modals without focus management.
- Toast notifications that disappear before they can be read.
- "Click here" / "Read more" link text without context.
- Tooltips on touch-only interactions (no hover on touch).
- Trapping users in a widget without an escape (Escape key).
- Assuming pointer input (build for keyboard, mouse, touch, stylus, voice).
- Using `title` attribute as the only accessible name (inconsistent AT support, no touch access).
- Generic button labels like "Submit" without context.

---

## 17. Cognitive Accessibility

- Plain language; short sentences; common words.
- Consistent navigation and component placement across pages.
- Clear error recovery paths; never lose user input.
- Confirm destructive actions; allow undo where possible.
- Don't impose time limits without user control to extend/disable.
- Provide instructions and examples for complex inputs.
- Break long forms into steps with progress indicator.
- Use `autocomplete` to reduce memory burden.

---

## 18. Mobile / Touch Accessibility

- Support both portrait and landscape orientations (don't lock).
- Touch targets ≥24×24 (AA) or ≥44×44 (AAA).
- Spacing between targets to prevent mis-taps.
- Don't require complex gestures without simple alternatives (swipe → button).
- Support assistive touch and switch control.
- Ensure pinch-zoom works.
- Respect system text size settings (use `rem`/`em`).
