import { test } from 'node:test';
import assert from 'node:assert';
import {
    A11Y_SUBCATEGORIES,
    classifyAccessibilityCheck,
    classifyScenarioCheck
} from './a11y-classifier.js';

test('classifyAccessibilityCheck classifies dedicated accessibility guides', () => {
    const res = classifyAccessibilityCheck('accessibility', 'accessible-svg-icons', 'SVG icon has aria-hidden="true"');
    assert.strictEqual(res.isAccessibility, true);
    assert.strictEqual(res.subCategory, 'implicit_a11y_guide');
    assert.strictEqual(res.isCoreA11y, true);
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

test('classifyAccessibilityCheck excludes known false-positive keyword collisions and vacuous checks', () => {
    const jsScope = classifyAccessibilityCheck('js', 'model-partial-time-concepts', 'Helper variable is not globally accessible');
    assert.strictEqual(jsScope.isAccessibility, false);
    assert.strictEqual(jsScope.subCategory, null);

    const timelineScope = classifyAccessibilityCheck('ui-behaviors', 'scrollytelling', 'Use timeline-scope to make the named timelines accessible');
    assert.strictEqual(timelineScope.isAccessibility, false);

    const vacuousHeader = classifyAccessibilityCheck('ui-atoms', 'shrinking-header-on-scroll', 'Respects user preferences for reduced motion or provides valid fallback');
    assert.strictEqual(vacuousHeader.isAccessibility, false);
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
    assert.strictEqual(A11Y_SUBCATEGORIES.length, 6);
});
