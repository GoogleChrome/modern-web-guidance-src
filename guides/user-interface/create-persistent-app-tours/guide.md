---
name: create-persistent-app-tours

description: Create persistent onboarding walkthroughs using the popover="manual" state to ensure tour steps stay open during user interaction.

web-feature-ids:
* popover
* anchor-positioning
sources:
* https://developer.mozilla.org/docs/Web/API/Popover_API/Using
* https://developer.chrome.com/blog/introducing-popover-api
---

# Creating Persistent App Tours

Onboarding tours require overlays that persist while users interact with the highlighted features. Unlike auto popovers, manual popovers do not close when the user clicks elsewhere on the page.

### Implementation Guidelines

* **MANDATORY:** Use popover="manual" to prevent the tour step from closing accidentally during user interaction.
* **DO** use CSS Anchor Positioning to tether the tour step to the specific feature being explained.
* **DO** provide an explicit "Close" or "Next" button within the popover that uses popovertargetaction="hide".
* **DO** use @starting-style to animate the entry of the tour step for a polished user experience.

### Fallback Strategies

#### popover

* **Guidance:** Use position: fixed and manually calculate coordinates via JavaScript getBoundingClientRect() for legacy support.

#### anchor-positioning

* **Guidance:** Use the [CSS Anchor Positioning Polyfill](https://github.com/oddbird/css-anchor-positioning). For a non-polyfill fallback, default the tooltip to a fixed position at the bottom of the viewport using `@supports not (anchor-name: --foo)`.