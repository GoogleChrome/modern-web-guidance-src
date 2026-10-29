/**
 * Deterministic classifier for cross-cutting accessibility evaluation checks.
 *
 * @typedef {'focus_inert' | 'motion_contrast_visual' | 'aria_roles_live' | 'labels_forms' | 'keyboard'} A11ySubCategory
 * @typedef {{ id: A11ySubCategory, label: string, shortLabel: string, description: string }} A11ySubCategoryMeta
 */

/** @type {A11ySubCategoryMeta[]} */
export const A11Y_SUBCATEGORIES = [
    {
        id: 'focus_inert',
        label: 'Focus & inert Management',
        shortLabel: 'Focus & inert',
        description: 'Focus shifting/restoration, :focus-visible rings, inert background views, and tab order'
    },
    {
        id: 'motion_contrast_visual',
        label: 'Motion, Contrast & Visual A11y',
        shortLabel: 'Motion & Contrast',
        description: 'prefers-reduced-motion, prefers-contrast: more, OS text-scale & reflow, WCAG 1.4.1 non-color cues, and minimum target size'
    },
    {
        id: 'aria_roles_live',
        label: 'ARIA, Roles & Live Regions',
        shortLabel: 'ARIA & Roles',
        description: 'aria-expanded, aria-current, aria-invalid, aria-describedby, aria-hidden, role, <dialog> name, landmarks, heading hierarchy, CSS alt text, and <html lang>'
    },
    {
        id: 'labels_forms',
        label: 'Form Labels & Grouping',
        shortLabel: 'Form Labels',
        description: '<label for>, <fieldset>/<legend> grouping, visible labels, and accessible visually-hidden utility'
    },
    {
        id: 'keyboard',
        label: 'Keyboard & Non-Gesture Operability',
        shortLabel: 'Keyboard',
        description: 'Escape dismissal, arrow-key operability, semantic <button> / <button type="submit">, and explicit non-swipe back buttons'
    }
];

export const A11Y_SUBCATEGORY_MAP = /** @type {Record<A11ySubCategory, A11ySubCategoryMeta>} */ (
    Object.fromEntries(A11Y_SUBCATEGORIES.map(item => [item.id, item]))
);

const FALSE_POSITIVE_SUBSTRINGS = [
    'globally accessible',
    'make the named timelines accessible',
    'when prefers-reduced-motion: no-preference is enabled, the underline animates',
    'at least one ui element (heading, button, or short label) should have text-box-trim applied',
    'vertical margin between label and input must be less than margin between groups',
    'labels must be visually placed above form controls',
    'safari scroll-latching workaround defers item removal and sets inert',
    'no fallback mechanism is provided for dismissing with the esc key',
    'autocomplete="username webauthn" and autofocus',
    'css transform of descendant html element must be updated or descendant is inert',
    'input elements have associated labels or toolparamdescription attributes',
    'must not rely on heavy custom javascript to replicate keyboard focus',
    'should use transitionable visibility to handle entry/exit animations and avoid tab order when hidden',
    'tooltips must be hoverable and persistent per wcag 1.4.13 guidelines',
    'aria-current state is synchronized using a scrollend event listener',
    'aria-current state synchronizes with visible section when scrolling stops',
    'calls to focus inside the stack pass preventscroll: true',
    'standalone component examples must document or assume a complete heading hierarchy outline',
    'continuous keyframe animations must be wrapped inside a reduced-motion media query'
];

/** @param {string | undefined | null} msg */
export function normalizeCheckMessage(msg) {
    return (msg || '').replace(/\s+/g, ' ').trim();
}

/**
 * Classifies a single evaluation check into one of the 5 accessibility subcategories.
 * @param {string | undefined | null} discipline
 * @param {string | undefined | null} guideName
 * @param {string | undefined | null} message
 * @returns {{ isAccessibility: boolean, subCategory: A11ySubCategory | null }}
 */
export function classifyAccessibilityCheck(discipline, guideName, message) {
    const gName = (guideName || '').toLowerCase();
    const disc = (discipline || '').toLowerCase();
    const msg = normalizeCheckMessage(message);
    if (!msg) return { isAccessibility: false, subCategory: null };
    const ml = msg.toLowerCase();

    for (const fp of FALSE_POSITIVE_SUBSTRINGS) {
        if (ml.includes(fp)) return { isAccessibility: false, subCategory: null };
    }

    // Motion, contrast, non-color state indicators (WCAG 1.4.1), OS text scaling & reflow, & target size
    if (
        gName === 'respect-os-text-scale' ||
        gName.endsWith('/respect-os-text-scale') ||
        ml.includes('meta text-scale') ||
        ml.includes('opting into text scaling') ||
        ml.includes('prefers-reduced-motion') ||
        ml.includes('reduced-motion') ||
        ml.includes('reduced motion') ||
        ml.includes('prefers-contrast') ||
        ml.includes('high-contrast') ||
        ml.includes('high contrast') ||
        ml.includes('non-color indicator') ||
        ml.includes('multiple visual indicators') ||
        ml.includes('multiple visual state indicators') ||
        ml.includes('multiple visual cues') ||
        ml.includes('contrast ratio') ||
        /\b\d+(?:\.\d+)?:1\s+contrast\b/.test(ml) ||
        ml.includes('tap targets must be at least 48px') ||
        ml.includes('interactive targets meet a minimum size of 24px') ||
        ((gName === 'fluid-scaling' || gName.endsWith('/fluid-scaling')) &&
            ml.includes('maximum size in clamp() for font size is at most 2.5 times the minimum size'))
    ) {
        return { isAccessibility: true, subCategory: 'motion_contrast_visual' };
    }

    // Keyboard dismissal, arrow-key operability, semantic button operability, and non-gesture controls
    if (
        ml.includes('escape key') ||
        ml.includes('esc key') ||
        /\bpressing esc(?:ape)?\b/.test(ml) ||
        (ml.includes('arrowleft') && ml.includes('arrowright') && ml.includes('keyboard')) ||
        ml.includes('repositionable with keyboard arrow keys') ||
        ml.includes('keyboard arrow key navigation prevents default') ||
        ml.includes('use semantic html elements rather than non-semantic elements with click handlers or tabindex') ||
        ml.includes('use <button> instead of <a>') ||
        ml.includes('semantic tags like <button type="submit">') ||
        ml.includes('semantic, visible submit button') ||
        ml.includes('explicit <button type="submit"> with actionable text') ||
        ml.includes('the form must have a submit button') ||
        ((gName === 'stack-drill-down' || gName.endsWith('/stack-drill-down')) &&
            ml.includes('drill-down views have an explicit back button, but root view does not'))
    ) {
        return { isAccessibility: true, subCategory: 'keyboard' };
    }

    // Priority disambiguations before aria_roles_live
    if (ml.includes('keyboard-focusable without assigning role="application"')) {
        return { isAccessibility: true, subCategory: 'focus_inert' };
    }
    if (ml.includes('programmatically associated with a visible <label>') || ml.includes('programmatically associated label')) {
        return { isAccessibility: true, subCategory: 'labels_forms' };
    }

    // ARIA attributes, roles, live regions, accessible names, landmarks, heading hierarchy, CSS alt text, and page lang
    if (
        /\baria-[a-z]+\b/.test(ml) ||
        ml.includes('aria attributes') ||
        ml.includes('aria attribute') ||
        /\brole=/.test(ml) ||
        ml.includes('live region') ||
        ml.includes('assistive technolog') ||
        ml.includes('accessibility tree') ||
        ml.includes('accessibility attributes') ||
        ml.includes('heading hierarchy') ||
        ml.includes('landmark') ||
        ml.includes('<search> element') ||
        ml.includes('content alternative text') ||
        ml.includes('using alternative text') ||
        (ml.includes('<dialog>') && ml.includes('accessible name')) ||
        ml.includes('the "lang" attribute must be defined on the <html> element') ||
        (gName.includes('scroll-snap-state-sync') && ml.includes('only one toc link is highlighted as the active one')) ||
        (gName.includes('scroll-snap-realtime-feedback') &&
            (ml.includes('the thumbnail corresponding to the final snap target receives active') ||
                ml.includes('when scrollsnapchanging is unsupported, the fallback promotes the thumbnail to active'))) ||
        (gName.includes('slider') &&
            ml.includes('must not use generated content on slider pseudo-elements, exposing values in ordinary dom elements instead'))
    ) {
        return { isAccessibility: true, subCategory: 'aria_roles_live' };
    }

    // Focus management, focus indicators, tab order, and inertness
    if (
        /\bfocus(?:ed|able|ing|es)?\b|:focus-visible/.test(ml) ||
        ml.includes('avoid tab order when hidden') ||
        (ml.includes('inert') &&
            (gName === 'navigation-drawer' ||
                gName.endsWith('/navigation-drawer') ||
                gName === 'stack-drill-down' ||
                gName.endsWith('/stack-drill-down')))
    ) {
        return { isAccessibility: true, subCategory: 'focus_inert' };
    }

    // Form labels, fieldset/legend grouping, and accessible visually hidden input patterns
    if (
        ml.includes('visually hidden inputs in the fallback must use the canonical accessible utility pattern') ||
        ml.includes('associated <label>') ||
        ml.includes('associated label') ||
        ml.includes('associated labels') ||
        ml.includes('associated with a label') ||
        /\bassociated with a (?:\w+\s+)?<?label>?\b/.test(ml) ||
        ml.includes('labeled using a <label>') ||
        ml.includes('semantic <label>') ||
        ml.includes('labels must be visible') ||
        ml.includes('<fieldset> and <legend> to group related controls') ||
        (ml.includes('"for" attribute matching') && ml.includes('label')) ||
        ml.includes('explicitly set the for attribute matching the inputs id')
    ) {
        return { isAccessibility: true, subCategory: 'labels_forms' };
    }

    // Fallback for dedicated guides under guides/accessibility/
    if (
        disc === 'accessibility' ||
        gName === 'accessible-error-announcement' ||
        gName.endsWith('/accessible-error-announcement') ||
        gName === 'accessible-generated-content' ||
        gName.endsWith('/accessible-generated-content') ||
        gName === 'accessibility' ||
        gName.endsWith('/accessibility')
    ) {
        return { isAccessibility: true, subCategory: 'aria_roles_live' };
    }

    return { isAccessibility: false, subCategory: null };
}

/**
 * Convenience helper for ScenarioCheck objects from evals.json, excluding synthetic early-failure placeholders.
 * @param {{ message?: string, testId?: string, id?: string, isEarlyFailure?: boolean, failureReason?: string } | null | undefined} check
 * @param {string | undefined | null} guideName
 * @param {string | undefined | null} [discipline]
 */
export function classifyScenarioCheck(check, guideName, discipline = '') {
    if (
        !check ||
        check.isEarlyFailure ||
        ('testId' in check && !check.testId) ||
        (!check.testId && !check.id) ||
        Boolean(check.failureReason && check.message === check.failureReason)
    ) {
        return { isAccessibility: false, subCategory: null };
    }
    return classifyAccessibilityCheck(discipline, guideName, check.message || '');
}
