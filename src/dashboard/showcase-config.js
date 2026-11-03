/**
 * Use cases featured in the A/B Task Spotlight, in display order. Only the list is curated;
 * the results always come from each agent's latest nightly run, unfiltered.
 * @type {ReadonlyArray<{ id: string, label: string }>}
 */
export const SHOWCASE_TASKS = [
    { id: 'highlight-text-ranges', label: 'Search highlights' },
    { id: 'animate-to-from-top-layer', label: 'Top-layer motion' },
    { id: 'flicker-free-client-side-ab-testing', label: 'Flicker-free A/B' },
    { id: 'faster-spa-view-transitions', label: 'SPA view cache' },
    { id: 'scrollspy', label: 'CSS scrollspy' },
    { id: 'interest-triggered-tooltips', label: 'Interest tooltips' }
];

export const SHOWCASE_GUIDE_IDS = new Set(SHOWCASE_TASKS.map(t => t.id));
