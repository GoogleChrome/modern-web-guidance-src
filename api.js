import { authenticatedFetch } from './utils.js';

export class ApiClient {
    constructor() {
        const params = new URLSearchParams(window.location.search);
        let sourceParam = params.get('source');
        if (!sourceParam) {
            // Auto-detect static Github Pages deployment
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                sourceParam = 'remote';
            } else {
                sourceParam = 'local';
            }
        }
        this.source = sourceParam;
        this.gcsPrefix = 'https://storage.googleapis.com/storage/v1/b/guidance-evals/o/';
    }

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
            return `${path}?source=${this.source}`;
        }
    }

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
     */
    async _checkRemoteFileExists(path) {
        const listUrl = `${this.gcsPrefix}?prefix=${encodeURIComponent(path)}`;
        const res = await authenticatedFetch(listUrl);
        if (res.ok) {
            const data = await res.json();
            if (data.items && data.items.some(item => item.name === path)) {
                return true;
            }
        }
        return false;
    }

    /** 
     * Silently checks if a file exists on the local server using /api/exists.
     * This avoids native browser fetch() 404 console logs.
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

    /** Fetches the overall array of test suites/runs listed for the dashboard. */
    async getSuites() {
        if (this.source === 'remote') {
            // Check Google Cloud Storage via JSON API
            const gcsUrl = `${this.gcsPrefix}?delimiter=/`;
            const res = await authenticatedFetch(gcsUrl);
            if (!res.ok) throw new Error('Failed to load remote suites');

            const data = await res.json();
            const suites = (data.prefixes || [])
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

    /** Fetches the evals.json payload for a specific root test ID. */
    async getEvals(testId) {
        // Appending timestamp to defeat strict local browser cache on eval data
        const path = `${testId}/evals.json?t=${Date.now()}`;
        const res = await this._fetch(path);
        if (!res.ok) throw new Error(`Failed to load data from ${this._formatUrl(path)}`);
        return await res.json();
    }

    /** Fetches the optional jetski automation metadata payload. */
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
            console.log('No jetski info found:', e.message);
        }
        return null; // Not fatal if missing
    }

    /** Checks if a test_suite.log file exists via a fast HEAD or silent remote prefix search. */
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

    /** Resolves the correct base path for specific run details, parsing legacy logic. */
    async getResultInfo(testId, run, testName) {
        const [appName, _, runType] = testName.split(' - ');
        const actualBaseApp = run.baseApp || appName;

        const logicalBasePath = `${testId}/${run.runNumber}/${appName}/${runType}`;
        const entryPointPath = await this._findBestEntryPoint(logicalBasePath);

        // Calculate relative sub-path to build the setup apps correlation
        const relativePath = entryPointPath.replace(logicalBasePath + '/', '');

        return {
            setupPath: `base_apps/${actualBaseApp}/${relativePath}`,
            resultPath: entryPointPath,
            usedBasePath: logicalBasePath
        };
    }

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
                    const availableFiles = new Set(data.items.map(item => item.name));
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
            bestCandidate = results.find(result => result !== null);
        }

        return bestCandidate || `${basePath}/index.html`; // strict default fallback
    }

    /** Lists relevant metadata files (like raw results or trajectories) for a specific test execution dir. */
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
                        files = data.items.map(item => item.name.split('/').pop());
                    }
                }
            }
        } catch (e) {
            console.log('Error checking run files:', e);
        }
        return files;
    }

    /** Downloads raw text content for a specific URL Path (e.g. from viewContent modal). */
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

    /** Returns absolute URL wrapper for opening links directly in new tabs (like trajectories). */
    getAbsoluteUrl(path) {
        if (this.source === 'remote') {
            let fixedPath = path.split('?')[0];
            return `${this.gcsPrefix}${encodeURIComponent(fixedPath)}?alt=media`;
        }
        return this._formatUrl(path);
    }
}
