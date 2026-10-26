import { getAccessToken } from './utils.js';
import { ApiClient } from './api.js';

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

/**
 * Fetches the precomputed suites manifest for `source` and hands each entry to
 * `register`. If the private bucket rejected the token (which
 * `authenticatedFetch` then cleared), falls back to the public copy rather
 * than leaving the page empty. Returns the source that was actually loaded.
 *
 * @param {'remote' | 'public'} source
 * @param {(summary: import('./summary-extractor.js').SuiteSummary, source: DataSource) => void} register
 * @returns {Promise<'remote' | 'public' | null>}
 */
export async function loadManifest(source, register) {
    try {
        const manifest = await new ApiClient(source).getSuitesManifest();
        for (const item of manifest) {
            if (item && item.testId) {
                register(item, source);
            }
        }
        return source;
    } catch (error) {
        console.error(`Error loading ${source} suites:`, error);
        if (source === 'remote' && !getAccessToken() && !isLocalServer()) {
            return loadManifest('public', register);
        }
        return null;
    }
}

/**
 * The manifest source for a page load: the private bucket when a token exists
 * (unless the URL insists on public), otherwise the public copy.
 * @param {URLSearchParams} [params]
 * @returns {'remote' | 'public'}
 */
export function manifestSourceFor(params = new URLSearchParams(window.location.search)) {
    return getAccessToken() && resolveDataSource(params) !== 'public' ? 'remote' : 'public';
}

/**
 * Removes every entry whose compound key (`<testId>|||<source>`) came from `source`,
 * e.g. the public copy once a Googler signs in, so a suite is not listed twice.
 * @param {Record<string, unknown>} registry
 * @param {DataSource} source
 * @returns {string[]} the keys that were removed
 */
export function forgetSuitesFrom(registry, source) {
    const removed = Object.keys(registry).filter(key => key.endsWith(`|||${source}`));
    for (const key of removed) {
        delete registry[key];
    }
    return removed;
}
