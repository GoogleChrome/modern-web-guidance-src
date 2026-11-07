# ARIA attribute and element reflection

The reflected ARIA properties allow setting ARIA states and relationships directly in JavaScript. While **attribute reflection** (e.g., `ariaLabel`) maps to string values, **element reflection** (e.g., `ariaLabelledByElements`) allows using direct element references.

## Fallbacks

When using ARIA element reflection properties, provide a fallback to traditional ID-based attributes for browsers that do not yet support the properties.
```javascript
// Within your tab loop (e.g. for each tab and panel)
if ('ariaControlsElements' in HTMLElement.prototype) {
  tab.ariaControlsElements = [panel];
} else {
  // Fallback: Ensure a unique ID is set on the panel
  panel.id ||= `mwg-tabs-${tabsInstanceId}-panel-${index}`;
  tab.setAttribute('aria-controls', panel.id);
}
```
### Benefit of element reflection

Using element references is especially useful in complex interfaces or Web Components where generating and managing globally unique IDs for every relationship can be error-prone and lead to ID collisions.

### Precedence and synchronization

Setting an element reflection property (like `ariaLabelledByElements`) will typically override and clear the corresponding string attribute (`aria-labelledby`). Avoid mixing both methods on the same element to prevent conflicting accessibility states.

## Issues

### False positives in accessibility checkers

Many automated testing tools still rely on scanning the DOM for string-based attributes and may report false positives (e.g., "missing label") for reflected relationships.

**Tooling Support (as of late 2026):**
- **Supported**: **axe-core (v4.13+)**, **Lighthouse (v13.5+)**, and **Pa11y with the axe runner (v10.0+)**.
- **Not Supported**: Most other common tools, including WAVE, ARC Toolkit, IBM Equal Access, Siteimprove Alfa, Playwright role locators, Testing Library, and virtual DOMs like jsdom/happy-dom.

If your project requires 100% automated test passes in tools that do not yet support reflection, you may prefer to continue using string-based attributes with unique IDs. Always verify the final experience using real assistive technology.

