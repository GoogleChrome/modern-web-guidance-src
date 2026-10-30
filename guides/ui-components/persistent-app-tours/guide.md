---
name: persistent-app-tours
description: Create persistent onboarding walkthroughs using tethered native overlays that stay open during user interaction.
web-feature-ids:
  - popover
  - anchor-positioning
---

# Creating Persistent App Tours

Onboarding tours require overlays that persist while users interact with the highlighted features. Unlike auto popovers, manual popovers do not close when the user clicks elsewhere on the page. Combining `popover="manual"` with CSS Anchor Positioning allows you to create non-modal, tethered tour steps.

## Use cases

* **Initial onboarding tour**: When introducing people who are viewing the functionality for the first time, there should only be one popover visible at any time. The first will be displayed on page load to make people aware of the presence of the app tour functionality. The emphasis in this use case is on introducing the app's functionality. Activating the popover's button (often labelled: "Got It", "Close", or "Next") to acknowledge and dismiss it should not only dismiss the current popover, but also display the next popover (if there is one). This continues until all of the onboarding popovers have been dismissed. At this stage, the onboarding popovers can only be re-displayed by activating a specific control (such as "View tutorial again"), and are otherwise not displayed on subsequent visits to the page.
* **Highlighting new updates/features on subsequent visits**: This pattern may also be used to introduce new/updated content. Here, the emphasis is less on the onboarding/tutorial aspect, but more on highlighting the presence of the new/updated features/content. In this use case, multiple tour popovers can be displayed at any one time. Additionally, and unlike onboarding tour popovers, there is no explicit relationship between the popovers themselves, so dismissing the first popover doesn't assume that the user needs to immediately move to the second popover to learn about the related feature - they can find out about it when they navigate to that section of the page.

## Recommended Implementation

### HTML
```html
<div id="feature-target">Highlight this feature</div>

<!-- MANDATORY: Enforce overlay dialog semantics and accessible name bindings -->
<div id="tour-step" popover="manual" role="dialog" aria-labelledby="tour-title" aria-modal="true">
  <!-- Assume an <h1> precedes this element in the full document outline -->
  <h2 id="tour-title">Step 1: Start a review</h2>
  <p>Begin the process by starting a review of the submitted document.</p>
  <button popovertarget="tour-step" popovertargetaction="hide">Got it</button>
</div>
```

### CSS
```css
#feature-target {
  anchor-name: --feature-target;
}

#tour-step {
  popover: manual;
  position-anchor: --feature-target;
  position-area: right center;
  inset: auto;
  margin: 1rem;
  padding: 1rem;
  border: 1px solid blue;
  border-radius: 0.5rem;
  background: aliceblue;
}
```

### JavaScript
```javascript
const tourStep = document.getElementById('tour-step');
tourStep.showPopover();

// At this point, as this is an initial onboarding tour popover, set the rest of the document to be inert. Ensure that the onboarding modal popover is not a child of this element, otherwise it too will be rendered inert and therefore inaccessible.
// Ensure that inert is removed once the initial onboarding tour has finished
const main = document.querySelector("main");
main.inert = true;

// MANDATORY: Programmatically route focus into the non-modal popover so keyboard/assistive technology users immediately perceive the new context
tourStep.querySelector('button').focus();
```

## Implementation Guidelines

* **MANDATORY:** Use `popover="manual"` to prevent the tour step from closing accidentally during user interaction.
* **MANDATORY:** Mark the container with `role="dialog"` and link its heading via `aria-labelledby`.
* **MANDATORY:** Shift programmatic focus inside the popover immediately after opening to prevent focus abandonment.
* **DO** use CSS Anchor Positioning to tether the tour step to the specific feature being explained.
* **DO** provide an explicit "Close" or "Next" button within the popover that uses `popovertargetaction="hide"`.

## Accessibility considerations

The following requirements apply regardless of the use case:

* Popovers should provide sufficient context around the features they're introducing, to be understood independently. **DON'T** make the content in a popover heavily reliant on content outside of it to be understood. For example: "New feature. Click here", relies heavily on visual information that people may not have, or may not be able to access (particularly if the content outside the popover is `inert`). Instead, something like: "New chat functionality. Start a chat to review items with fellow members", is much easier to understand when read in isolation.
* Tour popovers should begin with a heading, so that as to provide context to the content in the popover, as well as to provide an easy way for people using screen readers to navigate to them, when used in a non-modal way.
* Content in popovers must scale in size, and that all toast content remains visible when resizing text up to 200% to adhere to WCAG 1.4.4 Resize Text (Level AA).
* Content in popovers must remain visible when adjusting text styling and spacing with CSS to adhere to 1.4.12 Text Spacing (Level AA).
* Content in popovers must remain visible, or can be accessed still, when using a viewport sized to 320 by 256 CSS pixels to adhere to 1.4.10 Reflow (Level AA).

### Initial onboarding tour

Focus should be programmatically moved to the first popover when the page is initially opened. This can be achieved by adding an `autofocus` attribute on the popover's acknowledge/close button. Activating the button to acknowledge the popover should both: dismiss the current popover, and then move focus to the next popover that appears as part of the initial onboarding tour. This process should repeat until the user dismisses the last popover related to the initial onboarding tour, at which point focus should move to the start of the page to let people start performing tasks.

These popovers should use modal dialogs (a `<dialog>` element with `aria-modal="true` set) with the rest of the content in document set to `inert`. This will constrain focus, and prevent people from getting lost or confused around the content that is being explained, particularly as this will be their first time interacting with it and they're likely to want to follow the tutorial.

### Subsequent new features

When using persistent app tours to highlight subsequent new features that are revealed after someone has already been through the initial onboarding tour, focus must not be moved to these popovers. This is to both prevent confusion by hijacking focus, as well to prevent issues around where focus should move after this popover is dismissed. It's likely that when navigating to the page, the person using the functionality may have a goal for they want to complete, therefore, subsequent new features should be treated as supplemental information and not distract the user.

In keeping this information supplemental, the popover should be positioned in the DOM immediately before the functionality/control it relates to. This will help people using screen readers to easily identify the relationship between the popover and related content when reading through the page. When the popover is dismissed, focus should move to the related control/functionality.

Furthermore, use of non-modal popovers may result in controls being obscured when they receive focus, which would result in a fail against WCAG 2.4.11 Focus Not Obscured (Minimum) (Level AA), as focused items cannot be completely obscured. While there may not be generic guidance to completely mitigate against this issue, consider strategies that adjust the position of the tooltip or its presence. This includes ensuring that tooltips do not obscure interactive elements as they receive focus via keyboard. If the tooltip is likely to obscure an interactive element when it receives focus, either change the position of the tooltip to prevent focus being obscured, or dismiss the tooltip if it is no longer relevant to the user.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

### anchor-positioning

{{ BASELINE_STATUS("anchor-positioning") }}

To support browsers without anchor positioning, you can choose between using a polyfill or a pure CSS fallback.

#### Option 1: Polyfill Fallback
The `@oddbird/css-anchor-positioning` polyfill can be used to emulate anchor positioning. It does not support implicit anchors, so you MUST add explicit anchor names to the trigger. Additionally, `position-area` is not supported on popovers by the polyfill, so you MUST use `anchor()` on the desired insets instead of `position-area`.

```html
<script type="module">
  if (!CSS.supports('anchor-name: --foo')) {
    await import("https://unpkg.com/@oddbird/css-anchor-positioning");
  }
</script>
```

```css
#tour-step {
  /* If using the anchor positioning polyfill with a popover, DO use `anchor()` functions instead of `position-area`. */
  left: anchor(right);
  top: anchor(top);
}
```

#### Option 2: Non-Polyfill CSS Fallback
If you prefer not to use a polyfill, you can default the tooltip to a fixed position at the bottom of the viewport using `@supports not`.

```css
@supports not (anchor-name: --foo) {
  #tour-step {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    margin: 0;
    border-radius: 0;
  }
}
```