/**
 * Guides featured in the A/B Task Spotlight, in display order. Only the list is curated;
 * the results always come from each agent's latest nightly job, unfiltered.
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
export const SHOWCASE_TASKS = [
    { id: 'menu', label: 'Action menu' },
    { id: 'passkey-authentication', label: 'Passkey sign-in' },
    { id: 'progress-ring', label: 'Progress ring' },
    { id: 'swipe-to-remove', label: 'Swipe to remove' },
    { id: 'scrollability-affordance-hints', label: 'Scroll shadows' },
    { id: 'form-fields-automatically-fit-contents', label: 'Auto-sizing inputs' }
];

export const SHOWCASE_GUIDE_IDS = new Set(SHOWCASE_TASKS.map(t => t.id));
