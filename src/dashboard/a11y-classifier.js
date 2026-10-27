/**
 * Deterministic classifier for cross-cutting accessibility evaluation checks.
 *
 * Implements the audited 147-check classification rules (across 60 guides / 66 graders)
 * and false-positive exclusions for the MWG Accessibility Subscore across 5 subcategories.
 */

/**
 * @typedef {'focus_inert' | 'motion_contrast_visual' | 'aria_roles_live' | 'labels_forms' | 'keyboard'} A11ySubCategory
 */

/**
 * @typedef {Object} A11ySubCategoryMeta
 * @property {A11ySubCategory} id
 * @property {string} label
 * @property {string} shortLabel
 * @property {string} description
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
        description: 'prefers-reduced-motion, prefers-contrast: more, OS text-scale & reflow, WCAG 1.4.1 non-color cues, 48px targets, and WCAG 1.4.13'
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
    'globally accessible', // js/model-partial-time-concepts (variable scope)
    'make the named timelines accessible', // ui-behaviors/scrollytelling (CSS timeline-scope)
    'when prefers-reduced-motion: no-preference is enabled, the underline animates', // tests animation, not reduced-motion suppression
    'at least one ui element (heading, button, or short label) should have text-box-trim applied', // visual typography test
    'vertical margin between label and input must be less than margin between groups', // visual spacing test
    'labels must be visually placed above form controls', // visual layout test
    'safari scroll-latching workaround defers item removal and sets inert', // Safari scroll-latching workaround
    'no fallback mechanism is provided for dismissing with the esc key', // negative anti-redundant-code check
    'autocomplete="username webauthn" and autofocus', // WebAuthn conditional mediation requirement
    'css transform of descendant html element must be updated or descendant is inert', // 3D WebGL matrix sync (BL-2)
    'input elements have associated labels or toolparamdescription attributes', // WebMCP AI tool schema (SF-1)
    'must not rely on heavy custom javascript to replicate keyboard focus', // forms/rich-media-picker (#52 negative anti-JS check)
    'should use transitionable visibility to handle entry/exit animations and avoid tab order when hidden', // ui-atoms/scroll-position-aware-elements (#73 CSS transition check)
    'tooltips must be hoverable and persistent per wcag 1.4.13 guidelines', // ui-behaviors/interest-triggered-tooltips (#93 duplicate popover="hint" regex)
    'aria-current state is synchronized using a scrollend event listener', // ui-components/scrollspy daily-grind (#121 scrollend event listener check)
    'aria-current state synchronizes with visible section when scrolling stops', // ui-components/scrollspy devtools-times (#124 scrollend event listener check)
    'calls to focus inside the stack pass preventscroll: true', // ui-components/stack-drill-down (#129 scroll-snap physics check)
    'standalone component examples must document or assume a complete heading hierarchy outline', // historical css/content-based-styling
    'continuous keyframe animations must be wrapped inside a reduced-motion media query' // historical forms/animated-select-picker & rich-media-picker
];

/**
 * Normalizes whitespace in a check message.
 * @param {string | undefined | null} msg
 * @returns {string}
 */
export function normalizeCheckMessage(msg) {
    return (msg || '').replace(/\s+/g, ' ').trim();
}

/**
 * Collapses historical title renames/casing drift into a single canonical check key per guide.
 * @param {string} guideName
 * @param {string} msg
 * @returns {string}
 */
export function canonicalCheckKey(guideName, msg) {
    let ml = normalizeCheckMessage(msg).toLowerCase();
    ml = ml.replace(/^\d+\.\s+/, '');
    if (guideName === 'faster-spa-view-transitions') {
        if (ml.includes('aria-hidden')) {
            return 'inactive view elements use aria-hidden="true" to remove from accessibility tree';
        }
        if (ml.includes('focus')) {
            return 'focus management moves focus to active view container upon navigation';
        }
    }
    if (guideName === 'consistent-cross-document-transitions' && ml.includes('prefers-reduced-motion')) {
        return 'cross-document view transitions must be disabled when prefers-reduced-motion: reduce is active';
    }
    if (guideName === 'directional-navigation-transitions' && ml.includes('prefers-reduced-motion')) {
        return 'all view transition animations are disabled when prefers-reduced-motion is set to reduce';
    }
    if (guideName === 'scrollspy') {
        if (ml.includes('non-color indicator')) {
            return 'active navigation link style specifies at least one non-color indicator';
        }
        if (ml.includes('aria-current') && !ml.includes('scrollend') && !ml.includes('when scrolling stops')) {
            return 'navigation links manage aria-current attribute for visible and non-visible sections';
        }
    }
    return ml;
}

/**
 * Determines whether an accessibility check belongs to Core [accessibility]
 * (excluding prefers-reduced-motion checks and autofill <label> checks).
 *
 * @param {A11ySubCategory | null} subCategory
 * @param {string} guideName
 * @param {string} message
 * @returns {boolean}
 */
export function isCoreAccessibilityCheck(subCategory, guideName, message) {
    if (!subCategory) return false;
    const ml = normalizeCheckMessage(message).toLowerCase();
    if (ml.includes('reduced-motion') || ml.includes('reduced motion')) {
        return false;
    }
    if (/(?:^|\/)autofill-/.test(guideName || '') && subCategory === 'labels_forms') {
        return false;
    }
    return true;
}

/**
 * Classifies a single evaluation check into one of the 5 accessibility sub-categories,
 * or returns `isAccessibility: false` if it is a non-accessibility check or excluded false positive.
 *
 * @param {string | undefined | null} discipline
 * @param {string | undefined | null} guideName
 * @param {string | undefined | null} message
 * @returns {{
 *   isAccessibility: boolean,
 *   subCategory: A11ySubCategory | null,
 *   isCoreA11y: boolean,
 *   rationale: string
 * }}
 */
export function classifyAccessibilityCheck(discipline, guideName, message) {
    const gName = (guideName || '').toLowerCase();
    const disc = (discipline || '').toLowerCase();
    const msg = normalizeCheckMessage(message);
    if (!msg) {
        return { isAccessibility: false, subCategory: null, isCoreA11y: false, rationale: 'Empty message' };
    }
    const ml = msg.toLowerCase();

    // 1. Explicit exclusions for false-positive keyword collisions (evaluated first)
    for (const fp of FALSE_POSITIVE_SUBSTRINGS) {
        if (ml.includes(fp)) {
            return {
                isAccessibility: false,
                subCategory: null,
                isCoreA11y: false,
                rationale: `Excluded false-positive collision: '${fp}'`
            };
        }
    }

    // 2. Motion, contrast, non-color state indicators (WCAG 1.4.1), OS text scaling & reflow (WCAG 1.4.4 / 1.4.10), & target size
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
        ml.includes('wcag 1.4.13') ||
        ml.includes('tap targets must be at least 48px') ||
        ((gName === 'fluid-scaling' || gName.endsWith('/fluid-scaling')) &&
            ml.includes('maximum size in clamp() for font size is at most 2.5 times the minimum size'))
    ) {
        return {
            isAccessibility: true,
            subCategory: 'motion_contrast_visual',
            isCoreA11y: isCoreAccessibilityCheck('motion_contrast_visual', gName, msg),
            rationale: 'Motion, contrast, non-color cue (WCAG 1.4.1), text scaling/reflow (WCAG 1.4.4/1.4.10), tap target, or WCAG 1.4.13'
        };
    }

    // 3. Keyboard dismissal, arrow-key operability, semantic button operability, and non-gesture controls
    //    (Evaluated before aria_roles_live and focus_inert to prevent 'focused' / 'tabindex' collisions)
    if (
        ml.includes('escape key') ||
        ml.includes('esc key') ||
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
        return {
            isAccessibility: true,
            subCategory: 'keyboard',
            isCoreA11y: isCoreAccessibilityCheck('keyboard', gName, msg),
            rationale: 'Keyboard dismissal/navigation, semantic button, or explicit non-swipe control'
        };
    }

    // 4. Priority disambiguations before aria_roles_live
    if (ml.includes('keyboard-focusable without assigning role="application"')) {
        return {
            isAccessibility: true,
            subCategory: 'focus_inert',
            isCoreA11y: isCoreAccessibilityCheck('focus_inert', gName, msg),
            rationale: 'Focus management, focus indicator, tab order, or background inertness'
        };
    }
    if (
        ml.includes('programmatically associated with a visible <label>') ||
        ml.includes('programmatically associated label')
    ) {
        return {
            isAccessibility: true,
            subCategory: 'labels_forms',
            isCoreA11y: isCoreAccessibilityCheck('labels_forms', gName, msg),
            rationale: 'Form label association, fieldset/legend grouping, or accessible visually-hidden input utility'
        };
    }

    // 5. ARIA attributes, roles, live regions, accessible names, landmarks, heading hierarchy, CSS alt text, and page lang
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
        return {
            isAccessibility: true,
            subCategory: 'aria_roles_live',
            isCoreA11y: isCoreAccessibilityCheck('aria_roles_live', gName, msg),
            rationale: 'ARIA state/property, semantic role, live region, accessible name, landmark, heading hierarchy, or <html lang>'
        };
    }

    // 6. Focus management, focus indicators, tab order, and inertness
    if (
        /\bfocus(?:ed|able|ing|es)?\b|:focus-visible/.test(ml) ||
        ml.includes('avoid tab order when hidden') ||
        (ml.includes('inert') &&
            (gName === 'navigation-drawer' ||
                gName.endsWith('/navigation-drawer') ||
                gName === 'stack-drill-down' ||
                gName.endsWith('/stack-drill-down')))
    ) {
        return {
            isAccessibility: true,
            subCategory: 'focus_inert',
            isCoreA11y: isCoreAccessibilityCheck('focus_inert', gName, msg),
            rationale: 'Focus management, focus indicator, tab order, or background inertness'
        };
    }

    // 7. Form labels, fieldset/legend grouping, and accessible visually hidden input patterns
    if (
        ml.includes('visually hidden inputs in the fallback must use the canonical accessible utility pattern') ||
        ml.includes('associated <label>') ||
        ml.includes('associated label') ||
        ml.includes('associated labels') ||
        ml.includes('associated with a label') ||
        ml.includes('labeled using a <label>') ||
        ml.includes('semantic <label>') ||
        ml.includes('labels must be visible') ||
        ml.includes('<fieldset> and <legend> to group related controls') ||
        (ml.includes('"for" attribute matching') && ml.includes('label')) ||
        ml.includes('explicitly set the for attribute matching the inputs id')
    ) {
        return {
            isAccessibility: true,
            subCategory: 'labels_forms',
            isCoreA11y: isCoreAccessibilityCheck('labels_forms', gName, msg),
            rationale: 'Form label association, fieldset/legend grouping, or accessible visually-hidden input utility'
        };
    }

    // 8. Fallback for dedicated guides under guides/accessibility/
    if (
        disc === 'accessibility' ||
        gName === 'accessible-error-announcement' ||
        gName.endsWith('/accessible-error-announcement') ||
        gName === 'accessible-generated-content' ||
        gName.endsWith('/accessible-generated-content') ||
        gName === 'accessibility' ||
        gName.endsWith('/accessibility')
    ) {
        return {
            isAccessibility: true,
            subCategory: 'aria_roles_live',
            isCoreA11y: isCoreAccessibilityCheck('aria_roles_live', gName, msg),
            rationale: 'Guide is in guides/accessibility/'
        };
    }

    return {
        isAccessibility: false,
        subCategory: null,
        isCoreA11y: false,
        rationale: 'Non-accessibility check'
    };
}

/**
 * Convenience helper for ScenarioCheck objects from evals.json.
 * Excludes synthetic early-failure placeholder checks (where isEarlyFailure is true or testId is absent).
 *
 * @param {{ message?: string, testId?: string, id?: string, isEarlyFailure?: boolean } | null | undefined} check
 * @param {string | undefined | null} guideName
 * @param {string | undefined | null} [discipline]
 * @returns {{
 *   isAccessibility: boolean,
 *   subCategory: A11ySubCategory | null,
 *   isCoreA11y: boolean,
 *   rationale: string
 * }}
 */
export function classifyScenarioCheck(check, guideName, discipline = '') {
    if (!check || check.isEarlyFailure) {
        return { isAccessibility: false, subCategory: null, isCoreA11y: false, rationale: 'Early failure placeholder' };
    }
    // In real evals.json files, attributed checks carry `testId` (or `id` in unit test fixtures).
    if ('testId' in check && !check.testId) {
        return { isAccessibility: false, subCategory: null, isCoreA11y: false, rationale: 'Missing testId (unattributed)' };
    }
    return classifyAccessibilityCheck(discipline, guideName, check.message || '');
}
