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
 * Picks the data source for this page load. An explicit `?source=` wins, except
 * that `remote` without a token reads the public copy (an anonymous visitor is
 * never sent to the bucket); on the dev server everything is local; otherwise a
 * signed-in Googler reads the private bucket and everyone else the public copy.
 *
 * @param {URLSearchParams} [params]
 * @returns {DataSource}
 */
export function resolveDataSource(params = new URLSearchParams(window.location.search)) {
    const requested = params.get('source');
    if (requested && VALID_SOURCES.has(requested)) {
        if (requested === 'remote' && !getAccessToken()) return 'public';
        return /** @type {DataSource} */ (requested);
    }
    if (isLocalServer()) {
        return 'local';
    }
    return getAccessToken() ? 'remote' : 'public';
}

/** @returns {boolean} */
export function isLocalServer() {
    return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

/**
 * Reloads the current page after a sign-in so `resolveDataSource()` picks the
 * bucket from the stored token. Off the dev server that means dropping the
 * `source` param (links from the public landing page carry `?source=public`)
 * rather than baking `source=remote` into Back links and bookmarks; on the dev
 * server, where no param means local, it has to be set explicitly.
 */
export function reloadAsRemote() {
    const url = new URL(window.location.href);
    if (isLocalServer()) {
        url.searchParams.set('source', 'remote');
    } else {
        url.searchParams.delete('source');
    }
    url.searchParams.delete('show_login');
    window.location.href = url.toString();
}
