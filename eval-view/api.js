import { authenticatedFetch, MiniIndexedDB } from './utils.js';

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
        this.cache = new MiniIndexedDB();
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
            let fullPath = path;
            // Prepend results/ for local results in static mode
            if (this.source === 'static' && !path.startsWith('results/') && !path.startsWith('base_apps/') && !path.startsWith('tasks/')) {
                fullPath = `results/${path}`;
            }
            const separator = fullPath.includes('?') ? '&' : '?';
            return `${fullPath}${separator}source=${this.source}`;
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
        if (this.source === 'remote') {
            try {
                const cached = await this.cache.get(`evals:${testId}`);
                if (cached) return cached;
            } catch (e) {
                console.warn('Cache read failed:', e);
            }
        }
        // Appending timestamp to defeat strict local browser cache on eval data
        const path = `${testId}/evals.json?t=${Date.now()}`;
        const res = await this._fetch(path);
        if (!res.ok) throw new Error(`Failed to load data from ${this._formatUrl(path)}`);
        const data = await res.json();
        if (this.source === 'remote') {
            try {
                await this.cache.set(`evals:${testId}`, data);
            } catch (e) {
                console.warn('Cache write failed:', e);
            }
        }
        return data;
    }

    /** Fetches the optional jetski automation metadata payload. */
    async getJetskiInfo(testId) {
        if (this.source === 'remote') {
            try {
                const cached = await this.cache.get(`jetski:${testId}`);
                if (cached !== undefined) return cached; // Note: can be null
            } catch (e) {
                console.warn('Cache read failed:', e);
            }
        }
        const path = `${testId}/jetski_info.json`;
        let exists = false;
        
        if (this.source === 'remote') {
            exists = await this._checkRemoteFileExists(path);
        } else {
            exists = await this._checkLocalFileExists(path);
        }

        if (!exists) {
            if (this.source === 'remote') {
                try { await this.cache.set(`jetski:${testId}`, null); } catch {}
            }
            return null;
        }

        try {
            const res = await this._fetch(path);
            if (res.ok) {
                const data = await res.json();
                if (this.source === 'remote') {
                    try { await this.cache.set(`jetski:${testId}`, data); } catch {}
                }
                return data;
            }
        } catch (e) {
            console.log('No jetski info found:', e.message);
        }
        return null; // Not fatal if missing
    }

    /** Gets the entire directory listing of all files in the entire suite's directory. */
    async getSuiteDirectoryListing(testId) {
        if (this.source === 'remote') {
            try {
                const cached = await this.cache.get(`suiteDirList:${testId}`);
                if (cached !== undefined) return cached;
            } catch {}
        }

        let filePaths = [];
        if (this.source === 'remote') {
            let pageToken = '';
            do {
                const listUrl = `${this.gcsPrefix}?prefix=${encodeURIComponent(testId + '/')}${pageToken ? `&pageToken=${pageToken}` : ''}`;
                const res = await authenticatedFetch(listUrl);
                if (res.ok) {
                    const data = await res.json();
                    if (data.items) {
                        filePaths.push(...data.items.map(item => item.name));
                    }
                    pageToken = data.nextPageToken || '';
                } else {
                    break;
                }
            } while (pageToken);
            try { await this.cache.set(`suiteDirList:${testId}`, filePaths); } catch {}
        } else {
            try {
                const res = await fetch(`/api/run-files-recursive?dir=${encodeURIComponent(testId + '/')}&source=local`);
                if (res.ok) {
                    const data = await res.json();
                    filePaths = data.files || [];
                }
            } catch (e) {
                console.log('Error checking local suite files:', e);
            }
        }
        return filePaths;
    }

    /** Checks if a test_suite.log file exists via a fast HEAD or silent remote prefix search. */
    async checkLogExists(testId) {
        try {
            const suiteFiles = await this.getSuiteDirectoryListing(testId);
            const logPath = `${testId}/test_suite.log`;
            return suiteFiles.includes(logPath);
        } catch {
            return false;
        }
    }

    /** Gets the entire directory listing of all files in a single run's directory. */
    async getRunDirectoryListing(testId, runNumber) {
        const suiteFiles = await this.getSuiteDirectoryListing(testId);
        const runPrefix = `${testId}/${runNumber}/`;
        return suiteFiles.filter(path => path.startsWith(runPrefix));
    }


    /** Resolves the correct base path for specific run details synchronously using pre-fetched directory list. */
    resolveResultInfoFromList(testId, run, testName, filePaths) {
        const [taskName, guideName, runType] = testName.split(' - ');
        const actualBaseApp = run.baseApp;
        
        const logicalBasePath = `${testId}/${run.runNumber}/${guideName}/${taskName}/${runType}`;
        const legacyBasePath = `${testId}/${run.runNumber}/${taskName}/${runType}`;
        
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

        // 1. Find best entry point in logicalBasePath
        let entryPointPath = null;
        let usedBasePath = logicalBasePath;
        
        for (const candidate of candidates) {
            const target = `${logicalBasePath}/${candidate}`;
            if (filePaths.includes(target)) {
                entryPointPath = target;
                break;
            }
        }

        // 2. Fallback to legacyBasePath
        if (!entryPointPath) {
            for (const candidate of candidates) {
                const target = `${legacyBasePath}/${candidate}`;
                if (filePaths.includes(target)) {
                    entryPointPath = target;
                    usedBasePath = legacyBasePath;
                    break;
                }
            }
        }

        // 3. Default fallback
        if (!entryPointPath) {
            entryPointPath = `${logicalBasePath}/index.html`;
        }

        // 4. Calculate relative path
        const relativePath = entryPointPath.replace(usedBasePath + '/', '');

        // 5. Check if local base_app path exists
        const localBaseAppPath = `${testId}/${run.runNumber}/${guideName}/${taskName}/base_app/${relativePath}`;
        const exists = filePaths.includes(localBaseAppPath);
        const setupPath = exists ? localBaseAppPath : `base_apps/${actualBaseApp}/${relativePath}`;

        return {
            setupPath,
            resultPath: entryPointPath,
            usedBasePath
        };
    }

    /** Filters and formats run files synchronously from pre-fetched directory list. */
    filterRunFilesFromList(usedBasePath, filePaths) {
        const prefix = usedBasePath.endsWith('/') ? usedBasePath : usedBasePath + '/';
        return filePaths
            .filter(path => path.startsWith(prefix))
            .map(path => path.replace(prefix, ''))
            .filter(fileName => !fileName.includes('/')); // only return direct files
    }

    /** Resolves the correct base path for specific run details, parsing legacy logic. */
    async getResultInfo(testId, run, testName) {
        const [taskName, guideName, runType] = testName.split(' - ');
        const actualBaseApp = run.baseApp;
        let logicalBasePath = `${testId}/${run.runNumber}/${guideName}/${taskName}/${runType}`;
        let entryPointPath = await this._findBestEntryPoint(logicalBasePath);

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

    async _findBestEntryPoint(basePath) {
        if (this.source === 'remote') {
            try {
                const cached = await this.cache.get(`entryPoint:${basePath}`);
                if (cached !== undefined) return cached;
            } catch {}
        }
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
            try { await this.cache.set(`entryPoint:${basePath}`, bestCandidate); } catch {}
        } else {
            const checks = candidates.map(candidate =>
                this._checkLocalFileExists(`${basePath}/${candidate}`)
                    .then(exists => exists ? `${basePath}/${candidate}` : null)
                    .catch(() => null)
            );
            const results = await Promise.all(checks);
            bestCandidate = results.find(result => result !== null);
        }

        return bestCandidate;
    }

    /** Lists relevant metadata files (like raw results or trajectories) for a specific test execution dir. */
    async getRunFiles(basePath) {
        if (this.source === 'remote') {
            try {
                const cached = await this.cache.get(`runFiles:${basePath}`);
                if (cached !== undefined) return cached;
            } catch {}
        }
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
                  try { await this.cache.set(`runFiles:${basePath}`, files); } catch {}
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
            try {
                const cached = await this.cache.get(`fileText:${path}`);
                if (cached !== undefined) {
                    if (cached === null) throw new Error('File not found (404).');
                    return cached;
                }
            } catch (err) {
                if (err.message === 'File not found (404).') throw err;
            }

            const firstSegment = path.split('/')[0];
            if (firstSegment) {
                try {
                    const suiteFiles = await this.getSuiteDirectoryListing(firstSegment);
                    if (!suiteFiles.includes(path)) {
                        try { await this.cache.set(`fileText:${path}`, null); } catch {}
                        throw new Error('File not found (404).');
                    }
                } catch (e) {
                    if (e.message === 'File not found (404).') throw e;
                    const exists = await this._checkRemoteFileExists(path);
                    if (!exists) {
                        try { await this.cache.set(`fileText:${path}`, null); } catch {}
                        throw new Error('File not found (404).');
                    }
                }
            } else {
                const exists = await this._checkRemoteFileExists(path);
                if (!exists) {
                    try { await this.cache.set(`fileText:${path}`, null); } catch {}
                    throw new Error('File not found (404).');
                }
            }
        }
        
        // Force local fetching for base_apps or tasks natively, otherwise it tries to read from GCS
        const res = (isBaseApp || isTasks)
            ? await fetch(`${path}?source=local`) 
            : await this._fetch(path);
            
        if (!res.ok) {
            if (res.status === 404) {
                if (this.source === 'remote' && !isBaseApp && !isTasks) {
                    try { await this.cache.set(`fileText:${path}`, null); } catch {}
                }
                throw new Error('File not found (404).');
            }
            throw new Error(`Failed to load from ${path} (${res.status})`);
        }
        const text = await res.text();
        if (this.source === 'remote' && !isBaseApp && !isTasks) {
            try { await this.cache.set(`fileText:${path}`, text); } catch {}
        }
        return text;
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
