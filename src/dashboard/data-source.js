import { getAccessToken } from './utils.js';

/**
 * Where the dashboard reads eval data from.
 *
 *  - `local`:  the dev server (`gd dashboard`) reading `results/` on disk
 *  - `static`: a static export of local results (used by tests and previews)
 *  - `remote`: the private `gs://guidance-evals` bucket, which needs a Google sign-in
 *  - `public`: the sanitized `public-evals/` directory served next to the dashboard
 *
 * The public view's safety does not depend on this module: `public-evals/`
 * only ever contains what the builder's allowlists emitted. This module just
 * decides which of the two the UI asks for.
 *
 * @typedef {'local' | 'remote' | 'static' | 'public'} DataSource
 */

/** Path, relative to the dashboard, where the builder publishes sanitized suites. */
export const PUBLIC_EVALS_BASE = 'public-evals';

const VALID_SOURCES = new Set(['local', 'remote', 'static', 'public']);

/**
 * Picks the data source for this page load. An explicit `?source=` wins; on
 * the dev server everything is local; otherwise a signed-in Googler reads the
 * private bucket and everyone else reads the public copy.
 *
 * @param {URLSearchParams} [params]
 * @returns {DataSource}
 */
export function resolveDataSource(params = new URLSearchParams(window.location.search)) {
    const requested = params.get('source');
    if (requested && VALID_SOURCES.has(requested)) {
        return /** @type {DataSource} */ (requested);
    }
    if (isLocalServer()) {
        return 'local';
    }
    return getAccessToken() ? 'remote' : 'public';
}

/**
 * True when the page is showing the public, unauthenticated view. Use this to
 * hide controls that only make sense for engineers; never rely on it to keep
 * data private.
 *
 * @param {DataSource} source
 * @returns {boolean}
 */
export function isPublicView(source) {
    return source === 'public';
}

/** @returns {boolean} */
export function isLocalServer() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}
