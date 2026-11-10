---
name: persistent-app-tours
description: Create persistent onboarding walkthroughs using tethered native overlays that stay open during user interaction.
web-feature-ids:
  - popover
  - anchor-positioning
---

# Creating Persistent App Tours

Onboarding tours require overlays that persist while users interact with the highlighted features. Unlike auto popovers, manual popovers do not close when the user clicks elsewhere on the page. Combining `popover="manual"` with CSS Anchor Positioning allows you to create non-modal, tethered tour steps. This pattern is used to introduce new/updated content. There is no explicit relationship between the popovers themselves, so dismissing the first popover doesn't assume that the user needs to immediately move to the second popover to learn about the related feature - they can find out about it when they navigate to that section of the page.

## Recommended Implementation

### HTML
```html
<div id="feature-target">Highlight this feature</div>

<dialog id="tour-step" popover="manual" aria-labelledby="tour-title">
  <!-- Assume an <h1> precedes this element in the full document outline -->
  <h2 id="tour-title">Start a review</h2>
  <p>Begin the process by starting a review of the submitted document.</p>
  <button popovertarget="tour-step" popovertargetaction="hide">Got it</button>
</dialog>
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

Popovers should provide sufficient context around the features they're introducing, to be understood independently. **DON'T** make the content in a popover heavily reliant on content outside of it to be understood. For example: "New feature. Click here", relies heavily on visual information that people may not have, or may not be able to access (particularly if the content outside the popover is `inert`). Instead, something like: "New chat functionality. Start a chat to review items with fellow members", is much easier to understand when read in isolation. Tour popovers should begin with a heading, so that as to provide context to the content in the popover, as well as to provide an easy way for people using screen readers to navigate to them, when used in a non-modal way.

Focus must not be moved to these popovers on page load. This is to both prevent confusion from hijacking focus. It's likely that when navigating to the page, the person using the functionality may have a goal for they want to complete, therefore, tours for new features should be treated as supplemental information and not distract the user.

In keeping this information supplemental, the popover should be positioned in the DOM immediately before the functionality/control it relates to. This will help people using screen readers to easily identify the relationship between the popover and related content when reading through the page. When the popover is dismissed, focus should move to the related control/functionality.

Content in popovers must scale in size and remain visible when resizing text up to 200% to adhere to WCAG 1.4.4 Resize Text (Level AA). Content in popovers must remain visible when adjusting text styling and spacing with CSS to adhere to 1.4.12 Text Spacing (Level AA). Content in popovers must remain visible, or can be accessed still, when using a viewport sized to 320 by 256 CSS pixels to adhere to 1.4.10 Reflow (Level AA).

Use of non-modal popovers may result in controls being obscured when they receive focus, which would result in a fail against WCAG 2.4.11 Focus Not Obscured (Minimum) (Level AA), as focused items cannot be completely obscured. While there may not be generic guidance to completely mitigate against this issue, consider strategies that adjust the position of the tooltip or its presence. This includes ensuring that tooltips do not obscure interactive elements as they receive focus via keyboard. If the tooltip is likely to obscure an interactive element when it receives focus, either change the position of the tooltip to prevent focus being obscured, or dismiss the tooltip if it is no longer relevant to the user.

## Fallback strategies

{{ FEATURE_FALLBACKS("popover") }}

{{ FEATURE("anchor-positioning", "popover-fallbacks") }}
