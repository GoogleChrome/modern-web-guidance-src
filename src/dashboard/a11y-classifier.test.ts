import { test } from 'node:test';
import assert from 'node:assert';
import {
    A11Y_SUBCATEGORIES,
    canonicalCheckKey,
    classifyAccessibilityCheck,
    classifyScenarioCheck,
    isCoreAccessibilityCheck
} from './a11y-classifier.js';

test('classifyAccessibilityCheck maps dedicated accessibility guides to substantive subcategories', () => {
    const textScaleMeta = classifyAccessibilityCheck(
        'accessibility',
        'respect-os-text-scale',
        'Document head opts into OS text scaling via meta text-scale element'
    );
    assert.strictEqual(textScaleMeta.isAccessibility, true);
    assert.strictEqual(textScaleMeta.subCategory, 'motion_contrast_visual');
    assert.strictEqual(textScaleMeta.isCoreA11y, true);

    const textScaleReflow = classifyAccessibilityCheck(
        'accessibility',
        'respect-os-text-scale',
        'Component spacing coupled to text size uses relative units rather than fixed pixel dimensions'
    );
    assert.strictEqual(textScaleReflow.isAccessibility, true);
    assert.strictEqual(textScaleReflow.subCategory, 'motion_contrast_visual');
    assert.strictEqual(textScaleReflow.isCoreA11y, true);

    const errAnnouncement = classifyAccessibilityCheck(
        'accessibility',
        'accessible-error-announcement',
        'The visual error message visibility must match the aria-invalid state'
    );
    assert.strictEqual(errAnnouncement.isAccessibility, true);
    assert.strictEqual(errAnnouncement.subCategory, 'aria_roles_live');
    assert.strictEqual(errAnnouncement.isCoreA11y, true);

    const genContent = classifyAccessibilityCheck(
        'accessibility',
        'accessible-generated-content',
        'Stylesheets define ::before or ::after pseudo-element rules using content alternative text syntax to silence decorative text'
    );
    assert.strictEqual(genContent.isAccessibility, true);
    assert.strictEqual(genContent.subCategory, 'aria_roles_live');
    assert.strictEqual(genContent.isCoreA11y, true);

    const fallbackA11yGuide = classifyAccessibilityCheck(
        'accessibility',
        'accessible-error-announcement',
        'Unrecognized future check in accessibility guide'
    );
    assert.strictEqual(fallbackA11yGuide.isAccessibility, true);
    assert.strictEqual(fallbackA11yGuide.subCategory, 'aria_roles_live');
});

test('classifyAccessibilityCheck classifies cross-cutting ARIA, focus, keyboard, form labels, and motion checks', () => {
    const ariaCheck = classifyAccessibilityCheck('ui-components', 'accordion', 'Trigger button sets aria-expanded="true" when open');
    assert.strictEqual(ariaCheck.isAccessibility, true);
    assert.strictEqual(ariaCheck.subCategory, 'aria_roles_live');

    const focusCheck = classifyAccessibilityCheck('ui-components', 'navigation-drawer', 'Background content is marked inert when drawer is open');
    assert.strictEqual(focusCheck.isAccessibility, true);
    assert.strictEqual(focusCheck.subCategory, 'focus_inert');

    const keyboardCheck = classifyAccessibilityCheck('ui-components', 'modal-dialog', 'Pressing the Escape key closes the dialog');
    assert.strictEqual(keyboardCheck.isAccessibility, true);
    assert.strictEqual(keyboardCheck.subCategory, 'keyboard');

    const labelCheck = classifyAccessibilityCheck('forms', 'custom-select', 'Control has an associated <label> element');
    assert.strictEqual(labelCheck.isAccessibility, true);
    assert.strictEqual(labelCheck.subCategory, 'labels_forms');

    const motionCheck = classifyAccessibilityCheck('animations', 'consistent-cross-document-transitions', 'Disables view transitions when prefers-reduced-motion: reduce is active');
    assert.strictEqual(motionCheck.isAccessibility, true);
    assert.strictEqual(motionCheck.subCategory, 'motion_contrast_visual');
    assert.strictEqual(motionCheck.isCoreA11y, false);
});

test('classifyAccessibilityCheck covers newly added FN checks and resolves subcategory priority collisions', () => {
    // FN-1: forms/switch label association
    const switchLabel = classifyAccessibilityCheck('forms', 'switch', 'Each switch input is associated with a label element');
    assert.strictEqual(switchLabel.subCategory, 'labels_forms');

    // FN-2 & FN-3: html/web-components ARIA IDREFs and shadow root semantic controls
    const shadowAria = classifyAccessibilityCheck(
        'html',
        'web-components',
        'Every id referenced by ARIA attributes resolves to a target element within the same document or shadow root'
    );
    assert.strictEqual(shadowAria.subCategory, 'aria_roles_live');

    const shadowSemantic = classifyAccessibilityCheck(
        'html',
        'web-components',
        'Interactive controls inside shadow roots use semantic HTML elements rather than non-semantic elements with click handlers or tabindex'
    );
    assert.strictEqual(shadowSemantic.subCategory, 'keyboard');

    // FN-4: ui-atoms/shrinking-header-on-scroll restored reduced-motion check (BL-1 removed)
    const shrinkingHeader = classifyAccessibilityCheck(
        'ui-atoms',
        'shrinking-header-on-scroll',
        'MANDATORY: The implementation respects user preferences for reduced motion or provides valid fallback.'
    );
    assert.strictEqual(shrinkingHeader.isAccessibility, true);
    assert.strictEqual(shrinkingHeader.subCategory, 'motion_contrast_visual');
    assert.strictEqual(shrinkingHeader.isCoreA11y, false);

    // FN-5: ui-behaviors/scroll-snap-state-sync active TOC link aria-current invariant
    const tocSync = classifyAccessibilityCheck(
        'ui-behaviors',
        'scroll-snap-state-sync',
        'When the user scrolls to a section, only one TOC link is highlighted as the active one'
    );
    assert.strictEqual(tocSync.subCategory, 'aria_roles_live');

    // FN-6..FN-12: html/html headings, landmarks, <search>, and <button> vs <a href="#">
    assert.strictEqual(
        classifyAccessibilityCheck('html', 'html', 'Expectation 3: Sequential heading hierarchy in Footer or Article sections (h2)').subCategory,
        'aria_roles_live'
    );
    assert.strictEqual(
        classifyAccessibilityCheck('html', 'html', 'Expectation 4: Site header landmark contains primary navigation').subCategory,
        'aria_roles_live'
    );
    assert.strictEqual(
        classifyAccessibilityCheck('html', 'html', 'Expectation 5: Native <search> element wraps search controls').subCategory,
        'aria_roles_live'
    );
    assert.strictEqual(
        classifyAccessibilityCheck('html', 'html', 'Expectation 6: Triggered actions use <button> instead of <a> with href="#"').subCategory,
        'keyboard'
    );

    // B1.1, B1.2, B2.1, B3.1, and Group B4 submit buttons
    assert.strictEqual(
        classifyAccessibilityCheck(
            'ui-behaviors',
            'scroll-snap-realtime-feedback',
            'The thumbnail corresponding to the final snap target receives active and does not have pending after scroll completes'
        ).subCategory,
        'aria_roles_live'
    );
    assert.strictEqual(
        classifyAccessibilityCheck(
            'ui-behaviors',
            'drag',
            'Keyboard arrow key navigation prevents default scrolling behavior'
        ).subCategory,
        'keyboard'
    );
    assert.strictEqual(
        classifyAccessibilityCheck(
            'forms',
            'slider',
            'The implementation MUST NOT use generated content on slider pseudo-elements, exposing values in ordinary DOM elements instead'
        ).subCategory,
        'aria_roles_live'
    );
    assert.strictEqual(
        classifyAccessibilityCheck(
            'forms',
            'sms-otp-form',
            'The OTP verification control is wrapped in a semantic <form> element with an explicit <button type="submit"> with actionable text'
        ).subCategory,
        'keyboard'
    );
    const autofillSubmit = classifyAccessibilityCheck('forms', 'autofill-sign-in-form', 'The form must have a submit button');
    assert.strictEqual(autofillSubmit.subCategory, 'keyboard');
    assert.strictEqual(autofillSubmit.isCoreA11y, true);

    // Priority collisions: sms-otp-form label vs aria-describedby, drag focusable vs role="application", drag arrow keys vs focused
    assert.strictEqual(
        classifyAccessibilityCheck(
            'forms',
            'sms-otp-form',
            'The OTP <input> element is programmatically associated with a visible <label> via matching for and id attributes, and any format hint linked via aria-describedby is positioned above the <input>'
        ).subCategory,
        'labels_forms'
    );
    assert.strictEqual(
        classifyAccessibilityCheck('ui-behaviors', 'drag', 'Drag handle is keyboard-focusable without assigning role="application"').subCategory,
        'focus_inert'
    );
    assert.strictEqual(
        classifyAccessibilityCheck('ui-behaviors', 'drag', 'Element is repositionable with keyboard arrow keys when the drag handle is focused').subCategory,
        'keyboard'
    );

    // isCoreAccessibilityCheck handles both bare and discipline-prefixed autofill guide names
    assert.strictEqual(isCoreAccessibilityCheck('labels_forms', 'autofill-address-form', 'Every form control must have an associated <label>'), false);
    assert.strictEqual(isCoreAccessibilityCheck('labels_forms', 'forms/autofill-address-form', 'Every form control must have an associated <label>'), false);
    assert.strictEqual(isCoreAccessibilityCheck('keyboard', 'forms/autofill-sign-in-form', 'The form must have a submit button'), true);
});

test('classifyAccessibilityCheck excludes known false-positive keyword collisions', () => {
    const jsScope = classifyAccessibilityCheck('js', 'model-partial-time-concepts', 'Helper variable is not globally accessible');
    assert.strictEqual(jsScope.isAccessibility, false);
    assert.strictEqual(jsScope.subCategory, null);

    const timelineScope = classifyAccessibilityCheck('ui-behaviors', 'scrollytelling', 'Use timeline-scope to make the named timelines accessible');
    assert.strictEqual(timelineScope.isAccessibility, false);

    // 6 confirmed current FPs + 2 historical FPs
    const fpCases: Array<[string, string, string]> = [
        ['forms', 'rich-media-picker', 'The implementation MUST NOT rely on heavy custom JavaScript to replicate keyboard focus'],
        ['ui-atoms', 'scroll-position-aware-elements', 'should use transitionable visibility to handle entry/exit animations and avoid tab order when hidden'],
        ['ui-behaviors', 'interest-triggered-tooltips', 'Tooltips must be hoverable and persistent per WCAG 1.4.13 guidelines'],
        ['ui-components', 'scrollspy', 'aria-current state is synchronized using a scrollend event listener'],
        ['ui-components', 'scrollspy', 'aria-current state synchronizes with visible section when scrolling stops'],
        ['ui-components', 'stack-drill-down', 'Calls to focus inside the stack pass preventScroll: true'],
        ['css', 'content-based-styling', 'Standalone component examples must document or assume a complete heading hierarchy outline'],
        ['forms', 'animated-select-picker', 'Continuous keyframe animations must be wrapped inside a reduced-motion media query']
    ];
    for (const [disc, guide, msg] of fpCases) {
        const res = classifyAccessibilityCheck(disc, guide, msg);
        assert.strictEqual(res.isAccessibility, false, `Expected FP exclusion for ${guide}: ${msg}`);
        assert.strictEqual(res.subCategory, null);
    }

    // canonicalCheckKey does not collapse excluded scrollend checks into the aria-current canonical key
    assert.notStrictEqual(
        canonicalCheckKey('scrollspy', 'aria-current state is synchronized using a scrollend event listener'),
        canonicalCheckKey('scrollspy', 'script updates aria-current attribute on navigation links')
    );
});

test('classifyScenarioCheck ignores synthetic early-failure placeholder checks', () => {
    const earlyFail = classifyScenarioCheck(
        { message: 'Trigger button sets aria-expanded="true"', isEarlyFailure: true, testId: 'chk-1' },
        'accordion'
    );
    assert.strictEqual(earlyFail.isAccessibility, false);

    const unattributed = classifyScenarioCheck(
        { message: 'Trigger button sets aria-expanded="true"', testId: '' },
        'accordion'
    );
    assert.strictEqual(unattributed.isAccessibility, false);

    const valid = classifyScenarioCheck(
        { message: 'Trigger button sets aria-expanded="true"', testId: 'chk-1' },
        'accordion'
    );
    assert.strictEqual(valid.isAccessibility, true);
    assert.strictEqual(A11Y_SUBCATEGORIES.length, 5);
    assert.strictEqual(A11Y_SUBCATEGORIES.some(s => (s.id as string) === 'implicit_a11y_guide'), false);
});
