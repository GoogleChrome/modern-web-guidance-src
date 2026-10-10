import { authenticatedFetch, parseResultKey, isLocalDashboardHost } from './utils.js';
import { MANIFEST_FILES } from './summary-extractor.js';
import { computeHeadlineInsights, hydrateMissingStats } from './insights.js';

/**
 * @typedef {'local' | 'remote' | 'static'} DataSource
 */

/**
 * Manifest promises memoized per page load (keyed by `${source}:${kind}`), shared by every
 * ApiClient instance so the hero and the suites table download each artifact once.
 * @type {Map<string, Promise<any>>}
 */
const manifestCache = new Map();

export class ApiClient {
    constructor() {
        const params = new URLSearchParams(window.location.search);
        const sourceParam = params.get('source');
        /** @type {DataSource} */
        let source;
        if (sourceParam === 'remote' || sourceParam === 'local' || sourceParam === 'static') {
            source = sourceParam;
        } else if (!isLocalDashboardHost()) {
            source = 'remote';
        } else {
            source = 'local';
        }
        this.source = source;
        this.gcsPrefix = 'https://storage.googleapis.com/storage/v1/b/guidance-evals/o/';
    }

    /**
     * @private
     * @param {string} path
     * @param {boolean} [isMetadataOnly=false]
     * @returns {string}
     */
    _formatUrl(path, isMetadataOnly = false) {
        if (this.source === 'remote') {
            if (path.startsWith('http')) return path;

            // Clean local prefixes from logical GCS path
            let fixedPath = path.split('?')[0];

            // Build the GCS JSON API endpoint
            let url = `${this.gcsPrefix}${encodeURIComponent(fixedPath)}`;
            if (!isMetadataOnly) {
                url += '?alt=media';
            }
            return url;
        } else {
            let fullPath = path;
            // Prepend results/ for local results in static mode
            if (this.source === 'static' && !path.startsWith('results/') && !path.startsWith('base_apps/') && !path.startsWith('tasks/')) {
                fullPath = `results/${path}`;
            }
            const separator = fullPath.includes('?') ? '&' : '?';
            return `${fullPath}${separator}source=${this.source}`;
        }
    }

    /**
     * @private
     * @param {string} path
     * @param {boolean} [isMetadataOnly=false]
     * @param {string} [method='GET']
     * @returns {Promise<Response>}
     */
    async _fetch(path, isMetadataOnly = false, method = 'GET') {
        const url = this._formatUrl(path, isMetadataOnly);
        const options = { method };
        if (this.source === 'remote') {
            return await authenticatedFetch(url, options);
        }
        return await fetch(url, options);
    }

    /** 
     * Silently checks if a file exists on GCS using a prefix search.
     * This avoids native browser fetch() 404 console logs.
     * @private
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    async _checkRemoteFileExists(path) {
        const listUrl = `${this.gcsPrefix}?prefix=${encodeURIComponent(path)}`;
        const res = await authenticatedFetch(listUrl);
        if (res.ok) {
            const data = await res.json();
            const items = /** @type {any[]} */ (data.items || []);
            if (items.some(item => item.name === path)) {
                return true;
            }
        }
        return false;
    }

    /** 
     * Silently checks if a file exists on the local server using /api/exists.
     * This avoids native browser fetch() 404 console logs.
     * @private
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    async _checkLocalFileExists(path) {
        const url = `/api/exists?path=${encodeURIComponent(path)}&source=local`;
        const res = await fetch(url);
        if (res.ok) {
            const data = await res.json();
            return data.exists === true;
        }
        return false;
    }

    // --- High-level API Methods ---

    /** 
     * Fetches the overall array of test suites/runs listed for the dashboard.
     * @returns {Promise<{ suites: { id: string, source: string }[] }>}
     */
    async getSuites() {
        if (this.source === 'remote') {
            // Check Google Cloud Storage via JSON API
            const gcsUrl = `${this.gcsPrefix}?delimiter=/`;
            const res = await authenticatedFetch(gcsUrl);
            if (!res.ok) throw new Error('Failed to load remote suites');

            const data = await res.json();
            const prefixes = /** @type {string[]} */ (data.prefixes || []);
            const suites = prefixes
                .map(prefix => prefix.replace(/\/$/, ''))
                .filter(name => name !== 'single_task')
                .map(id => ({ id, source: 'remote' }));
            return { suites };
        } else {
            // Fetch directly from server.js /api/suites endpoint
            const res = await fetch('/api/suites');
            if (!res.ok) throw new Error('Failed to load local suites');
            return await res.json();
        }
    }

    // --- Suite manifests (suites.gen.json / suites.slim.gen.json / headline-insights.gen.json) ---

    /**
     * @typedef {'full' | 'slim' | 'insights'} ManifestKind
     */

    /**
     * @typedef {Object} ManifestResult
     * @property {ManifestKind} kind What was asked for.
     * @property {ManifestKind} servedFrom Which artifact actually answered (`full` when a small file was missing).
     * @property {boolean} fallback True when `servedFrom !== kind` (derived client-side from the full manifest).
     * @property {import('./insights.js').ManifestSuite[]} [suites] For `full` / `slim`.
     * @property {import('./insights.js').HeadlineInsights & { generatedAt?: string }} [insights] For `insights`.
     */

    /**
     * Raw fetch of one manifest artifact for the current source. Resolves to `null` on 404 so callers can fall back.
     * @private
     * @param {ManifestKind} kind
     * @returns {Promise<any | null>}
     */
    async _fetchManifestFile(kind) {
        const name = MANIFEST_FILES[kind];
        const bust = `t=${Date.now()}`;
        if (this.source === 'local') {
            // The dev server computes full summaries on request; slim/insights are derived client-side.
            if (kind !== 'full') return null;
            const res = await fetch(`/api/suites?${bust}`);
            if (!res.ok) throw new Error('Failed to load local suites');
            const data = await res.json();
            return Array.isArray(data) ? data : (data.suites || []);
        }
        const url = this.source === 'remote'
            ? `${this.gcsPrefix}${encodeURIComponent(name)}?alt=media&${bust}`
            : `/${name}?${bust}`;
        const res = this.source === 'remote' ? await authenticatedFetch(url) : await fetch(url);
        if (res.status === 404) return null;
        if (!res.ok) throw new Error(`Failed to load ${name} (${res.status})`);
        return await res.json();
    }

    /**
     * Loads a suites manifest. Small artifacts (`slim`, `insights`) are preferred for first paint;
     * when they are missing (older bucket / dev server) the full manifest is fetched once and the
     * requested shape is derived client-side, so callers never have to special-case the fallback.
     * Results are memoized per page load and per source, and `full`/`slim` share one array per kind,
     * so `hydrateMissingStats()` mutations are visible to every consumer.
     *
     * @param {ManifestKind} [kind='slim']
     * @returns {Promise<ManifestResult>}
     */
    async getManifest(kind = 'slim') {
        const cacheKey = `${this.source}:${kind}`;
        const cached = manifestCache.get(cacheKey);
        if (cached) return cached;

        const promise = (async () => {
            /** @type {any} */
            const direct = await this._fetchManifestFile(kind).catch(err => {
                if (kind === 'full') throw err;
                console.warn(`Manifest ${MANIFEST_FILES[kind]} unavailable, falling back to the full manifest:`, err instanceof Error ? err.message : err);
                return null;
            });
            if (direct !== null) {
                if (kind === 'insights') return { kind, servedFrom: kind, fallback: false, insights: direct };
                return { kind, servedFrom: kind, fallback: false, suites: direct };
            }
            const full = await this.getManifest('full');
            const suites = /** @type {import('./insights.js').ManifestSuite[]} */ (full.suites || []);
            if (kind === 'insights') {
                return { kind, servedFrom: /** @type {ManifestKind} */ ('full'), fallback: true, insights: computeHeadlineInsights(suites) };
            }
            // Slim derived from full: keep the SAME entry objects (not copies) so hydration stays shared.
            return { kind, servedFrom: /** @type {ManifestKind} */ ('full'), fallback: true, suites };
        })();
        manifestCache.set(cacheKey, promise);
        promise.catch(() => manifestCache.delete(cacheKey));
        return promise;
    }

    /**
     * Convenience: the landing-page headline numbers, with the client-side evals.json fallback for
     * manifests that predate `a11yStats`/`efficiencyStats`. Resolves as soon as a first result exists;
     * `onUpdate` fires once more if hydration changed anything.
     *
     * @param {{ perAgentRecentN?: number, onUpdate?: (insights: import('./insights.js').HeadlineInsights) => void }} [options]
     * @returns {Promise<import('./insights.js').HeadlineInsights>}
     */
    async getHeadlineInsights(options = {}) {
        const { perAgentRecentN = 3, onUpdate } = options;
        const insightOptions = { perAgentRecentN };
        const served = await this.getManifest('insights');
        let insights = /** @type {import('./insights.js').HeadlineInsights} */ (served.insights);
        if (served.fallback || perAgentRecentN !== insights.options.perAgentRecentN) {
            const { suites = [] } = await this.getManifest('full');
            insights = computeHeadlineInsights(suites, insightOptions);
            if (insights.missingStats.length > 0) {
                const hydrate = hydrateMissingStats(suites, id => this.getEvals(id), insightOptions)
                    .then(() => {
                        const updated = computeHeadlineInsights(suites, insightOptions);
                        if (onUpdate) onUpdate(updated);
                        return updated;
                    });
                if (!onUpdate) return hydrate;
            }
        }
        return insights;
    }

    /** 
     * Fetches the evals.json payload for a specific root test ID.
     * @param {string} testId
     * @returns {Promise<import('../harness/lib/metrics.ts').EvalsReport>}
     */
    async getEvals(testId) {
        // Appending timestamp to defeat strict local browser cache on eval data
        const path = `${testId}/evals.json?t=${Date.now()}`;
        const res = await this._fetch(path);
        if (!res.ok) throw new Error(`Failed to load data from ${this._formatUrl(path)}`);
        return await res.json();
    }

    /** 
     * Fetches the optional jetski automation metadata payload.
     * @param {string} testId
     * @returns {Promise<any>}
     */
    async getJetskiInfo(testId) {
        const path = `${testId}/jetski_info.json`;
        let exists = false;
        
        if (this.source === 'remote') {
            exists = await this._checkRemoteFileExists(path);
        } else {
            exists = await this._checkLocalFileExists(path);
        }

        if (!exists) return null;

        try {
            const res = await this._fetch(path);
            if (res.ok) {
                return await res.json();
            }
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            console.log('No jetski info found:', message);
        }
        return null; // Not fatal if missing
    }

    /** 
     * Checks if a test_suite.log file exists via a fast HEAD or silent remote prefix search.
     * @param {string} testId
     * @returns {Promise<boolean>}
     */
    async checkLogExists(testId) {
        try {
            const path = `${testId}/test_suite.log`;
            
            if (this.source === 'remote') {
                return await this._checkRemoteFileExists(path);
            } else {
                return await this._checkLocalFileExists(path);
            }
        } catch {
            return false;
        }
    }

    /** 
     * Resolves the correct base path for specific run details, parsing legacy logic.
     * @param {string} testId
     * @param {import('../harness/lib/metrics.ts').RunResult} run
     * @param {string} testName
     * @returns {Promise<{ setupPath: string, resultPath: string, usedBasePath: string } | null>}
     */
    async getResultInfo(testId, run, testName) {
        const parsed = parseResultKey(testName);
        if (!parsed) return null;
        const { task: taskName, guide: guideName, runType } = parsed;
        const actualBaseApp = run.baseApp;
        let logicalBasePath = `${testId}/${run.runNumber}/${guideName}/${taskName}/${runType}`;
        let entryPointPath = run.targetFile ? `${logicalBasePath}/${run.targetFile}` : await this._findBestEntryPoint(logicalBasePath);

        // Fallback for older results stored in a depth-2 folder structure (runDir/taskName/runType)
        if (!entryPointPath) {
            const legacyPath = `${testId}/${run.runNumber}/${taskName}/${runType}`;
            const legacyEntryPoint = await this._findBestEntryPoint(legacyPath);
            if (legacyEntryPoint) {
                logicalBasePath = legacyPath;
                entryPointPath = legacyEntryPoint;
            } else {
                entryPointPath = `${logicalBasePath}/index.html`; // default fallback
            }
        }

        // Calculate relative sub-path to build the setup apps correlation
        const relativePath = entryPointPath.replace(logicalBasePath + '/', '');

        // Try run-local base_app first (at the appName level, not inside guided/unguided), fallback to centralized base_apps for older runs
        const localBaseAppPath = `${testId}/${run.runNumber}/${guideName}/${taskName}/base_app/${relativePath}`;
        let exists = false;

        if (this.source === 'remote') {
            exists = await this._checkRemoteFileExists(localBaseAppPath);
        } else {
            exists = await this._checkLocalFileExists(localBaseAppPath);
        }

        const setupPath = exists ? localBaseAppPath : `base_apps/${actualBaseApp}/${relativePath}`;

        return {
            setupPath,
            resultPath: entryPointPath,
            usedBasePath: logicalBasePath
        };
    }

    /**
     * @private
     * @param {string} basePath
     * @returns {Promise<string | null>}
     */
    async _findBestEntryPoint(basePath) {
        const candidates = [
            'dist/index.html',
            'src/App.jsx',
            'src/App.js',
            'src/main.jsx',
            'src/main.js',
            'src/index.jsx',
            'src/index.js',
            'index.html'
        ];

        let bestCandidate = null;
        if (this.source === 'remote') {
            // Fetch the directory listing once to avoid multiple 404 network logs
            const gcsPrefix = `${basePath}/`;
            const listUrl = `${this.gcsPrefix}?prefix=${encodeURIComponent(gcsPrefix)}`;
            const res = await authenticatedFetch(listUrl);
            
            if (res.ok) {
                const data = await res.json();
                if (data.items) {
                    const items = /** @type {any[]} */ (data.items);
                    const availableFiles = new Set(items.map(item => item.name));
                    for (const candidate of candidates) {
                        const candidatePath = `${basePath}/${candidate}`;
                        if (availableFiles.has(candidatePath)) {
                            bestCandidate = candidatePath;
                            break;
                        }
                    }
                }
            }
        } else {
            const checks = candidates.map(candidate =>
                this._checkLocalFileExists(`${basePath}/${candidate}`)
                    .then(exists => exists ? `${basePath}/${candidate}` : null)
                    .catch(() => null)
            );
            const results = await Promise.all(checks);
            bestCandidate = results.find(result => result !== null) || null;
        }

        return bestCandidate;
    }

    /** 
     * Lists relevant metadata files (like raw results or trajectories) for a specific test execution dir.
     * @param {string} basePath
     * @returns {Promise<string[] | undefined>}
     */
    async getRunFiles(basePath) {
        let files = [];
        try {
            if (this.source === 'local') {
                const res = await fetch(`/api/run-files?dir=${encodeURIComponent(basePath)}&source=local`);
                if (res.ok) {
                    const data = await res.json();
                    files = data.files || [];
                }
            } else {
                const gcsPrefix = basePath.endsWith('/') ? basePath : basePath + '/';
                const listUrl = `${this.gcsPrefix}?prefix=${encodeURIComponent(gcsPrefix)}`;
                const res = await authenticatedFetch(listUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.items) {
                        const items = /** @type {any[]} */ (data.items);
                        files = items.map(item => item.name.startsWith(gcsPrefix) ? item.name.substring(gcsPrefix.length) : item.name.split('/').pop());
                    }
                }
            }
        } catch (e) {
            console.log('Error checking run files:', e);
        }
        return files;
    }

    /** 
     * Downloads raw text content for a specific URL Path (e.g. from viewContent modal).
     * @param {string} path
     * @returns {Promise<string>}
     */
    async getFileText(path) {
        // Base apps are never uploaded to GCS. Force them to be fetched locally.
        const isBaseApp = path.startsWith('base_apps/');
        const isTasks = path.startsWith('tasks/');

        if (this.source === 'remote' && !isBaseApp && !isTasks) {
            const exists = await this._checkRemoteFileExists(path);
            if (!exists) throw new Error('File not found (404).');
        }
        
        // Force local fetching for base_apps or tasks natively, otherwise it tries to read from GCS
        const res = (isBaseApp || isTasks)
            ? await fetch(`${path}?source=local`) 
            : await this._fetch(path);
            
        if (!res.ok) {
            if (res.status === 404) throw new Error('File not found (404).');
            throw new Error(`Failed to load from ${path} (${res.status})`);
        }
        return await res.text();
    }

    /** 
     * Downloads raw binary content for a specific URL Path as a Blob.
     * @param {string} path
     * @returns {Promise<Blob>}
     */
    async getFileBlob(path) {
        const isBaseApp = path.startsWith('base_apps/');
        const isTasks = path.startsWith('tasks/');

        if (this.source === 'remote' && !isBaseApp && !isTasks) {
            const exists = await this._checkRemoteFileExists(path);
            if (!exists) throw new Error('File not found (404).');
        }
        
        const res = (isBaseApp || isTasks)
            ? await fetch(`${path}?source=local`) 
            : await this._fetch(path);
            
        if (!res.ok) {
            if (res.status === 404) throw new Error('File not found (404).');
            throw new Error(`Failed to load from ${path} (${res.status})`);
        }
        return await res.blob();
    }

    /** 
     * Returns absolute URL wrapper for opening links directly in new tabs (like trajectories).
     * @param {string} path
     * @returns {string}
     */
    getAbsoluteUrl(path) {
        if (this.source === 'remote') {
            let fixedPath = path.split('?')[0];
            if (isLocalDashboardHost()) {
                return `/gcs-proxy/${fixedPath}`;
            }
            return `${this.gcsPrefix}${encodeURIComponent(fixedPath)}?alt=media`;
        }
        return this._formatUrl(path);
    }
}
