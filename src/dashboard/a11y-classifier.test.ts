import { test } from 'node:test';
import assert from 'node:assert';
import { A11Y_SUBCATEGORIES, classifyAccessibilityCheck, classifyScenarioCheck } from './a11y-classifier.js';
test('classifyAccessibilityCheck maps dedicated accessibility guides and cross-cutting subcategories', () => {
    const cases: Array<[string, string, string, string]> = [
        ['accessibility', 'respect-os-text-scale', 'Document head opts into OS text scaling via meta text-scale element', 'motion_contrast_visual'],
        ['accessibility', 'respect-os-text-scale', 'Component spacing coupled to text size uses relative units rather than fixed pixel dimensions', 'motion_contrast_visual'],
        ['accessibility', 'accessible-error-announcement', 'The visual error message visibility must match the aria-invalid state', 'aria_roles_live'],
        ['accessibility', 'accessible-generated-content', 'Stylesheets define ::before or ::after pseudo-element rules using content alternative text syntax to silence decorative text', 'aria_roles_live'],
        ['accessibility', 'accessible-error-announcement', 'Unrecognized future check in accessibility guide', 'aria_roles_live'],
        ['ui-components', 'accordion', 'Trigger button sets aria-expanded="true" when open', 'aria_roles_live'],
        ['ui-components', 'navigation-drawer', 'Background content is marked inert when drawer is open', 'focus_inert'],
        ['ui-components', 'dialog', 'While a modal dialog is open, content outside it is not focusable', 'focus_inert'],
        ['ui-behaviors', 'swipe-to-reveal', 'Revealed action controls or side-menu items are focusable DOM elements inside the swipe-to-reveal container', 'focus_inert'],
        ['ui-components', 'modal-dialog', 'Pressing the Escape key closes the dialog', 'keyboard'],
        ['forms', 'custom-select', 'Control has an associated <label> element', 'labels_forms'],
        ['animations', 'consistent-cross-document-transitions', 'Disables view transitions when prefers-reduced-motion: reduce is active', 'motion_contrast_visual'],
        ['forms', 'switch', 'Each switch input is associated with a label element', 'labels_forms'],
        ['html', 'web-components', 'Every id referenced by ARIA attributes resolves to a target element within the same document or shadow root', 'aria_roles_live'],
        ['html', 'web-components', 'Interactive controls inside shadow roots use semantic HTML elements rather than non-semantic elements with click handlers or tabindex', 'keyboard'],
        ['ui-atoms', 'shrinking-header-on-scroll', 'MANDATORY: The implementation respects user preferences for reduced motion or provides valid fallback.', 'motion_contrast_visual'],
        ['ui-behaviors', 'scroll-snap-state-sync', 'When a TOC link is selected, it should have appropriate accessibility attributes like aria-current="true" or "location"', 'aria_roles_live'],
        ['html', 'html', 'Expectation 3: Sequential heading hierarchy in Footer or Article sections (h2)', 'aria_roles_live'],
        ['html', 'html', 'Expectation 4: Site header landmark contains primary navigation', 'aria_roles_live'],
        ['html', 'html', 'Expectation 5: Native <search> element wraps search controls', 'aria_roles_live'],
        ['html', 'html', 'Expectation 6: Triggered actions use <button> instead of <a> with href="#"', 'keyboard'],
        ['ui-behaviors', 'drag', 'Keyboard arrow key navigation prevents default scrolling behavior', 'keyboard'],
        ['forms', 'slider', 'The implementation MUST NOT use generated content on slider pseudo-elements, exposing values in ordinary DOM elements instead', 'aria_roles_live'],
        ['forms', 'sms-otp-form', 'The OTP verification control is wrapped in a semantic <form> element with an explicit <button type="submit"> with actionable text', 'keyboard'],
        ['forms', 'sms-otp-form', 'The OTP <input> element is programmatically associated with a visible <label> via matching for and id attributes, and any format hint linked via aria-describedby is positioned above the <input>', 'labels_forms'],
        ['ui-behaviors', 'drag', 'Drag handle is keyboard-focusable without assigning role="application"', 'focus_inert'],
        ['ui-behaviors', 'drag', 'Element is repositionable with keyboard arrow keys when the drag handle is focused', 'keyboard'],
        ['css', 'dark-mode', 'Body text achieves a minimum 4.5:1 contrast ratio in both themes', 'motion_contrast_visual'],
        ['ui-components', 'carousel', 'Interactive targets meet a minimum size of 24px by 24px', 'motion_contrast_visual'],
        ['ui-components', 'popover', 'Pressing Esc dismisses the open popover', 'keyboard'],
        ['ui-components', 'tabs', 'ArrowLeft and ArrowRight provide keyboard navigation across tabs', 'keyboard'],
        ['forms', 'checkout', 'Input is associated with a visible <label> element', 'labels_forms'],
        ['html', 'accessible-web-components', 'Places interactive control host in tab order', 'focus_inert'],
        ['html', 'accessible-web-components', 'Interactive custom element has a non-empty accessible name and valid same-tree or outward cross-boundary ARIA label references', 'aria_roles_live'],
        ['ui-components', 'breadcrumbs', 'Visual separators must not add divider characters to link or landmark accessible names', 'aria_roles_live'],
        ['visual-design', 'color', 'WCAG 1.4.1: Status indicators do not rely on color alone, pairing color with visible text or an icon that has an accessible name', 'aria_roles_live'],
        ['ui-atoms', 'position-aware-tooltips', 'sets role="tooltip" on popover and aria-describedby on trigger pointing to popover ID', 'aria_roles_live'],
    ];
    for (const [disc, guide, msg, expected] of cases) {
        const res = classifyAccessibilityCheck(disc, guide, msg);
        assert.strictEqual(res.isAccessibility, true, `Expected a11y match for ${guide}: ${msg}`);
        assert.strictEqual(res.subCategory, expected, `Expected ${expected} for ${guide}: ${msg}`);
    }
});
test('classifyAccessibilityCheck excludes known false-positive keyword collisions', () => {
    const fpCases: Array<[string, string, string]> = [
        ['js', 'model-partial-time-concepts', 'Helper variable is not globally accessible'],
        ['ui-behaviors', 'scrollytelling', 'Use timeline-scope to make the named timelines accessible'],
        ['forms', 'rich-media-picker', 'The implementation MUST NOT rely on heavy custom JavaScript to replicate keyboard focus'],
        ['ui-atoms', 'scroll-position-aware-elements', 'should use transitionable visibility to handle entry/exit animations and avoid tab order when hidden'],
        ['ui-components', 'tooltip', 'Tooltips must be hoverable and persistent per WCAG 1.4.13 guidelines'],
        ['ui-components', 'scrollspy', 'aria-current state is synchronized using a scrollend event listener'],
        ['ui-components', 'scrollspy', 'aria-current state synchronizes with visible section when scrolling stops'],
        ['ui-components', 'stack-drill-down', 'Calls to focus inside the stack pass preventScroll: true'],
        ['css', 'content-based-styling', 'Standalone component examples must document or assume a complete heading hierarchy outline'],
        ['forms', 'animated-select-picker', 'Continuous keyframe animations must be wrapped inside a reduced-motion media query'],
        ['visual-design', 'custom-text-decorations', 'A link with a hover reveal underline trims its line with text-decoration-inset at rest, and returns the inset to 0 or full width on both :hover and :focus-visible'],
        ['visual-design', 'custom-text-decorations', 'A draw-on custom line uses a pseudo-element with border-shape or border-block-end and transitions clip-path on both :hover and :focus-visible, not an inline SVG'],
        ['ui-components', 'hovercard', 'Trigger links use interestfor to open their associated popover on hover and focus'],
        ['user-experience', 'content-first-noise-reduction', 'Expectation 5, 6, 7: Persistent top bar hides on wheel scroll down, reappears on scroll up, and stays visible when focused while scrolled down'],
        ['ui-components', 'menu', 'Fallback sets role="menu" on focusgroup containers when unsupported'],
        ['ui-components', 'menu', 'Static CSS: Open and close animations are gated by prefers-reduced-motion: no-preference media query'],
        ['ui-components', 'menu', 'Focusing a submenu trigger in a vertical menu previews its menu without moving focus into it'],
        ['forms', 'checkbox', 'Animate indicator transitions using scale when prefers-reduced-motion: no-preference is active'],
        ['ui-components', 'anchor-positioning-tab-underline', 'CSS declares underline transition inside a prefers-reduced-motion: no-preference media query'],
        ['ui-components', 'toolbar', 'No tooltip element or its invoker button sets role="tooltip", aria-describedby, or aria-details manually'],
        ['html', 'accessible-web-components', 'Custom element sets role via ElementInternals without a matching aria-* attribute on the host'],
        ['html', 'accessible-web-components', 'Exposes default semantic role via ElementInternals without setting a role attribute on the host element'],
        ['html', 'accessible-web-components', 'No aria-* state attribute is added to the host when the state changes'],
        ['css', 'fluid-scaling', 'The maximum size in clamp() for font size is at most 2.5 times the minimum size'],
        ['forms', 'autofill-sign-in-form', 'The form must have a submit button'],
        ['ui-behaviors', 'scroll-snap-state-sync', 'When the user scrolls to a section, only one TOC link is highlighted as the active one'],
        ['user-experience', 'content-first-noise-reduction', 'Expectation 7: CSS keeps the persistent top bar visible when it contains keyboard focus (:focus-within)'],
        ['ui-behaviors', 'scroll-snap-realtime-feedback', 'The thumbnail corresponding to the final snap target receives active and does not have pending after scroll completes'],
        ['ui-components', 'dialog', 'No <dialog> has role="dialog" or aria-modal'],
        ['ui-atoms', 'viewport-aware-dropdowns', 'The overlay container does not have role="menu"'],
        ['ui-atoms', 'viewport-aware-dropdowns', 'The trigger does not have aria-haspopup'],
        ['ui-components', 'menu', 'Focus returning to a trigger when the window regains focus does not reopen or preview its menu'],
        ['ui-components', 'menu', 'Clicking a closed trigger opens its menu with focus on the trigger (no item focused and no :focus-visible), clicking again closes it, and clicking outside closes all menus']
    ];
    for (const [disc, guide, msg] of fpCases) {
        const res = classifyAccessibilityCheck(disc, guide, msg);
        assert.strictEqual(res.isAccessibility, false, `Expected FP exclusion for ${guide}: ${msg}`);
        assert.strictEqual(res.subCategory, null);
    }
});
test('classifyScenarioCheck ignores synthetic early-failure placeholder checks', () => {
    assert.strictEqual(classifyScenarioCheck({ message: 'Trigger button sets aria-expanded="true"', isEarlyFailure: true, testId: 'chk-1' }, 'accordion').isAccessibility, false);
    assert.strictEqual(classifyScenarioCheck({ message: 'Trigger button sets aria-expanded="true"', testId: '' }, 'accordion').isAccessibility, false);
    assert.strictEqual(classifyScenarioCheck({ message: 'Trigger button sets aria-expanded="true"' }, 'accordion').isAccessibility, false);
    assert.strictEqual(classifyScenarioCheck({ message: 'Infrastructure error in focus ring container', id: 'ef-1', failureReason: 'Infrastructure error in focus ring container' }, 'accordion').isAccessibility, false);
    assert.strictEqual(classifyScenarioCheck({ message: 'Trigger button sets aria-expanded="true"', testId: 'chk-1' }, 'accordion').isAccessibility, true);
    assert.strictEqual(classifyScenarioCheck({ message: 'Trigger button sets aria-expanded="true"', id: 'chk-1' }, 'accordion').isAccessibility, true);
    assert.strictEqual(A11Y_SUBCATEGORIES.length, 5);
});
