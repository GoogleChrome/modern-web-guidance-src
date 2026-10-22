import { authenticatedFetch, parseResultKey } from './utils.js';
import { PUBLIC_EVALS_BASE, isLocalServer, resolveDataSource } from './data-source.js';

/** @typedef {import('./data-source.js').DataSource} DataSource */

export class ApiClient {
    /**
     * @param {DataSource} [source] Defaults to `resolveDataSource()` for this page.
     */
    constructor(source = resolveDataSource()) {
        /** @type {DataSource} */
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
        if (!path) {
            throw new Error('Empty path');
        }
        if (this.source === 'remote') {
            if (path.startsWith('http')) return path;

            // Clean local prefixes from logical GCS path, keeping only the cache-buster
            const [fixedPath, query = ''] = path.split('?');
            const cacheBuster = new URLSearchParams(query).get('t');

            // Build the GCS JSON API endpoint
            let url = `${this.gcsPrefix}${encodeURIComponent(fixedPath)}`;
            if (!isMetadataOnly) {
                url += '?alt=media';
                if (cacheBuster) url += `&t=${encodeURIComponent(cacheBuster)}`;
            }
            return url;
        } else if (this.source === 'public') {
            // Same-origin static files published by the builder; no server to pass ?source= to.
            return `${PUBLIC_EVALS_BASE}/${path.replace(/^\/+/, '')}`;
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

    /**
     * Whether an optional file exists for the current source. The public copy
     * has no listing API and every optional file it carries is named in
     * `run.files`, so nothing is probed there.
     * @private
     * @param {string} path
     * @returns {Promise<boolean>}
     */
    async _fileExists(path) {
        if (this.source === 'remote') return this._checkRemoteFileExists(path);
        if (this.source === 'public') return false;
        return this._checkLocalFileExists(path);
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
        } else if (this.source === 'public') {
            const manifest = await this.getSuitesManifest();
            return { suites: manifest.map(entry => ({ id: entry.testId, source: 'public' })) };
        } else {
            // Fetch directly from server.js /api/suites endpoint
            const res = await fetch('/api/suites');
            if (!res.ok) throw new Error('Failed to load local suites');
            return await res.json();
        }
    }

    /**
     * Fetches the precomputed `suites.gen.json` manifest (one summary per suite).
     * Only the bucket and the public copy have one; the dev server builds it on the fly.
     * @returns {Promise<import('./summary-extractor.js').SuiteSummary[]>}
     */
    async getSuitesManifest() {
        if (this.source !== 'remote' && this.source !== 'public') {
            throw new Error(`No suites manifest for source "${this.source}"`);
        }
        const res = await this._fetch(`suites.gen.json?t=${Date.now()}`);
        if (res.status === 404 && this.source === 'public') return []; // nothing published yet
        if (!res.ok) throw new Error(`Failed to fetch ${this.source} suites manifest (${res.status})`);
        const manifest = await res.json();
        return Array.isArray(manifest) ? manifest : [];
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
        if (!(await this._fileExists(path))) return null;

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
            return await this._fileExists(`${testId}/test_suite.log`);
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

        // The public copy carries a pre-built agent.patch and nothing to diff against, so there is nothing to probe.
        if (this.source === 'public') {
            return { setupPath: '', resultPath: `${logicalBasePath}/agent.patch`, usedBasePath: logicalBasePath };
        }

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
        const exists = await this._fileExists(localBaseAppPath);

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
            if (this.source === 'public' || this.source === 'static') {
                return []; // Callers fall back to run.files (the builder fills it in for public).
            }
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
            if (isLocalServer()) {
                return `/gcs-proxy/${fixedPath}`;
            }
            return `${this.gcsPrefix}${encodeURIComponent(fixedPath)}?alt=media`;
        }
        return this._formatUrl(path);
    }
}
