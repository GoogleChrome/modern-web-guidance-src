/// <reference path="./evals.d.ts" />

/**
 * Utility functions shared between Dashboard and Landing pages.
 */

/**
 * @param {import('../harness/lib/metrics.ts').ScenarioCheck[] | undefined | null} checks
 * @returns {{ rate: number, passed: number, total: number }}
 */
export function getRunStats(checks) {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0 };
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const rate = Math.round((passed / total) * 100);
    return { rate, passed, total };
}

/**
 * @param {number} percentage
 * @returns {string}
 */
export function getColor(percentage) {
    const p = Math.max(0, Math.min(100, percentage));
    
    const RED = 'oklch(53% 0.18 26)';
    const YELLOW = 'oklch(72% 0.15 74)';
    const GREEN = 'oklch(52% 0.13 145)';

    if (p <= 30) return RED;
    if (p >= 90) return GREEN;
    
    if (p < 60) {
        const mix = Math.round((p - 30) / 30 * 100);
        return `color-mix(in oklch, ${RED}, ${YELLOW} ${mix}%)`;
    }
    
    const mix = Math.round((p - 60) / 30 * 100);
    return `color-mix(in oklch, ${YELLOW}, ${GREEN} ${mix}%)`;
}

/**
 * @param {string | undefined | null} text
 * @returns {string | undefined | null}
 */
export function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * @param {string} s
 * @returns {string}
 */
export function capitalize(s) {
    if (typeof s !== 'string' || s.length === 0) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * @param {number | undefined | null} tokens
 * @returns {string}
 */
export function formatTokens(tokens) {
    if (!tokens) return '0 tok';
    // undefined so it uses the user's locale.
    return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
        .format(tokens)
        .toLowerCase() + ' tok';
}

/**
 * @param {string | Date | number} date
 * @returns {string}
 */
export function timeAgo(date) {
    const diff = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    const units = [
        { name: 'year', s: 31536000 }, { name: 'month', s: 2592000 },
        { name: 'day', s: 86400 }, { name: 'hour', s: 3600 },
        { name: 'minute', s: 60 }, { name: 'second', s: 1 }
    ];
    const u = units.find(u => Math.abs(diff) >= u.s) || units[units.length - 1];
    return rtf.format(-Math.floor(diff / u.s), /** @type {Intl.RelativeTimeFormatUnit} */ (u.name));
}

/**
 * @param {string} key
 * @returns {{ task: string, guide: string, runType: string } | null}
 */
export function parseResultKey(key) {
    const parts = key.split(' - ');
    if (parts.length < 2 || parts.length > 3) return null;
    let [task, guide, runType] = parts;

    const featuresMap = typeof window !== 'undefined' ? window.__featuresMapping : undefined;
    let isFlipped = false;

    if (featuresMap) {
        const isGuideValid = featuresMap[guide] !== undefined;
        const isTaskValidGuide = featuresMap[task] !== undefined;
        if (isTaskValidGuide && !isGuideValid) {
            isFlipped = true;
        } else if (!isGuideValid && !isTaskValidGuide) {
            isFlipped = guide === 'task' || !!(guide && guide.endsWith('-task'));
        }
    } else {
        isFlipped = guide === 'task' || !!(guide && guide.endsWith('-task'));
    }

    if (isFlipped) {
        const temp = task;
        task = guide;
        guide = temp;
    }

    return { task, guide, runType };
}

/**
 * @typedef {Object} ChartAppData
 * @property {number[]} guided
 * @property {number[]} unguided
 * @property {number[]} guided_tokens
 * @property {number[]} unguided_tokens
 * @property {boolean} guided_failed
 * @property {boolean} unguided_failed
 */

/**
 * @param {Record<string, import('../harness/lib/metrics.ts').RunResult[]>} results
 * @returns {{
 *   labels: string[],
 *   guided: number[],
 *   unguided: number[],
 *   guided_tokens: number[],
 *   unguided_tokens: number[],
 *   guided_failed: boolean[],
 *   unguided_failed: boolean[]
 * }}
 */
export function calculateChartData(results) {
    /** @type {Record<string, ChartAppData>} */
    const apps = {};
    /** @type {Record<string, string>} */
    const taskNames = {};
    
    Object.keys(results).forEach(key => {
        const parsedKey = parseResultKey(key);
        if (!parsedKey) return;
        const { task: taskName, guide, runType } = parsedKey;

        if (runType !== 'guided' && runType !== 'unguided') return;
        /** @type {'guided' | 'unguided'} */
        const rType = runType;
        const failedKey = rType === 'guided' ? 'guided_failed' : 'unguided_failed';
        const tokensKey = rType === 'guided' ? 'guided_tokens' : 'unguided_tokens';

        const scenario = `${taskName} (${guide})`;
        if (!apps[scenario]) {
            apps[scenario] = { 
                guided: [], 
                unguided: [], 
                guided_tokens: [], 
                unguided_tokens: [], 
                guided_failed: false, 
                unguided_failed: false 
            };
        }
        
        const runs = results[key];
        if (runs.length > 0 && runs[0].taskName) {
            taskNames[scenario] = runs[0].taskName;
        }
        
        const isEarlyFailure = runs.some(r => r.results?.some(c => c.isEarlyFailure));
        if (isEarlyFailure) {
            apps[scenario][failedKey] = true;
        }
        
        const passed = runs.reduce((acc, r) => acc + getRunStats(r.results).passed, 0);
        const total = runs.reduce((acc, r) => acc + (r.results?.length || 0), 0);
        apps[scenario][rType].push(total > 0 ? (passed / total) * 100 : 0);

        const totalTokens = runs.reduce((acc, r) => acc + (r.tokenUsage?.total || 0), 0);
        const avgTokens = runs.length > 0 ? Math.round(totalTokens / runs.length) : 0;
        if (!apps[scenario][tokensKey]) {
            apps[scenario][tokensKey] = [];
        }
        apps[scenario][tokensKey].push(avgTokens);
    });
    
    const labels = Object.keys(apps).sort((a, b) => {
        const taskA = taskNames[a] || a;
        const taskB = taskNames[b] || b;
        return taskA.localeCompare(taskB);
    });

    /**
     * @param {string} l
     * @param {'guided' | 'unguided'} type
     * @returns {number}
     */
    const getAvg = (l, type) => {
        const s = apps[l][type];
        return s && s.length > 0 ? Math.round(s.reduce((/** @type {number} */ acc, /** @type {number} */ b) => acc + b, 0) / s.length) : 0;
    };

    /**
     * @param {string} l
     * @param {'guided' | 'unguided'} type
     * @returns {number}
     */
    const getAvgTokens = (l, type) => {
        const tokensKey = type === 'guided' ? 'guided_tokens' : 'unguided_tokens';
        const s = apps[l][tokensKey];
        return s && s.length > 0 ? Math.round(s.reduce((/** @type {number} */ acc, /** @type {number} */ b) => acc + b, 0) / s.length) : 0;
    };

    return { 
        labels, 
        guided: labels.map(l => getAvg(l, 'guided')), 
        unguided: labels.map(l => getAvg(l, 'unguided')),
        guided_tokens: labels.map(l => getAvgTokens(l, 'guided')),
        unguided_tokens: labels.map(l => getAvgTokens(l, 'unguided')),
        guided_failed: labels.map(l => apps[l].guided_failed),
        unguided_failed: labels.map(l => apps[l].unguided_failed)
    };
}


/**
 * @param {string} name
 * @returns {string}
 */
export function formatTestName(name) {
    if (!name) return name;
    const parsedKey = parseResultKey(name);
    if (parsedKey) {
        const { task: taskName, guide: guideName } = parsedKey;
        
        const featuresMap = window.__featuresMapping || {};
        const featureId = (featuresMap[guideName] && featuresMap[guideName][0]) || 'uncategorized';
        const displayName = `${guideName} (${taskName})`;

        return `${featureId}: ${displayName}`;
    }
    return name.split(' - ').join(' / ');
}

// Google Identity Services (OAuth) Integration
const GOOGLE_CLIENT_ID = '169412140096-fk4rtf6iqk982d43385s1ilucrda91g2.apps.googleusercontent.com';
/** @type {string | null} */
let accessToken = typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function' ? localStorage.getItem('gcs_access_token') : null;

/**
 * @returns {string | null}
 */
export function getAccessToken() {
    return accessToken;
}

/**
 * @param {(() => void) | undefined} [onAuthSuccess]
 */
export function initGoogleAuth(onAuthSuccess) {
    const init = () => {
        if (!window.google || !window.google.accounts) {
            // Wait for script to load
            setTimeout(init, 50);
            return;
        }

        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
        if (authBtn) {
            authBtn.style.display = 'block';
            if (accessToken) {
                authBtn.style.display = 'none';
            }
        }

        const tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'https://www.googleapis.com/auth/devstorage.read_only',
            callback: (/** @type {any} */ response) => {
                if (response.error !== undefined) {
                    console.error('OAuth Error:', response);
                    return;
                }
                accessToken = response.access_token;
                localStorage.setItem('gcs_access_token', accessToken || '');
                console.log('Successfully authenticated with Google.');
                if (authBtn) {
                    authBtn.style.display = 'none';
                }
                if (onAuthSuccess) onAuthSuccess();
            },
        });

        if (authBtn) {
            authBtn.addEventListener('click', () => tokenClient.requestAccessToken());
        }
    };
    init();
}

/**
 * @param {string | URL} url
 * @param {RequestInit} [options={}]
 * @returns {Promise<Response>}
 */
export async function authenticatedFetch(url, options = {}) {
    if (accessToken) {
        /** @type {Record<string, string>} */
        const headers = /** @type {any} */ (options.headers || {});
        headers['Authorization'] = `Bearer ${accessToken}`;
        options.headers = headers;
    }
    const res = await fetch(url, options);
    if (res.status === 401) {
        console.warn('Google Access Token expired or invalid. Clearing token.');
        localStorage.removeItem('gcs_access_token');
        accessToken = null;
        
        // Reset button UI if available
        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
        if (authBtn) {
            authBtn.style.display = 'block';
            authBtn.textContent = 'Sign in with Google';
            authBtn.disabled = false;
            authBtn.style.backgroundColor = '';
            authBtn.style.color = '';
            authBtn.style.borderColor = '';
        }
    }
    return res;
}

/**
 * @template {string} T
 * @typedef {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T]
 *   : T extends `${infer TagName}#${string}` ? (TagName extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName] : HTMLElement)
 *   : T extends `${infer TagName}.${string}` ? (TagName extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[TagName] : HTMLElement)
 *   : HTMLElement} ParseSelector
 */

/**
 * Guaranteed querySelector. Always returns an element or throws if nothing matches.
 * @template {string} [T=string]
 * @template {Element} [E=ParseSelector<T>]
 * @param {T} query
 * @param {ParentNode} [context]
 * @returns {E}
 */
export function $(query, context) {
  const result = (context || document).querySelector(query);
  if (result === null) {
    throw new Error(`querySelector('${query}') not found`);
  }
  return /** @type {E} */ (result);
}

export function categorizeActionClient(name, params, thought) {
  const actionName = (name || '').toLowerCase();
  const actionParamsStr = JSON.stringify(params || {}).toLowerCase();
  const thoughtStr = (thought || '').toLowerCase();

  if (actionName === 'respond_to_user') return 'other';

  if (actionName.includes('retrieve') || (actionName.includes('get_best_practices') && actionParamsStr.includes('retrieve')) || actionParamsStr.includes('retrieve')) {
    return 'guide_retrieval';
  }
  if (actionName.includes('search') || actionName.includes('get_best_practices') || actionName.includes('query_guidance') || actionParamsStr.includes('search')) {
    return 'skill_search';
  }
  if (
    actionName.includes('write') || actionName.includes('replace') || actionName.includes('edit') || actionName.includes('touch') ||
    actionParamsStr.includes('write_to_file') || actionParamsStr.includes('replace_file_content') ||
    actionParamsStr.includes('index.html') || actionParamsStr.includes('app.jsx') || actionParamsStr.includes('style.css')
  ) {
    return 'code_mutation';
  }
  if (thoughtStr.includes('mandatory') || thoughtStr.includes('fallback') || thoughtStr.includes('css') || thoughtStr.includes('baseline') || thoughtStr.includes('guidance')) {
    return 'mandatory_rule_thought';
  }
  return 'incidental_noise';
}

export function normalizeTrajectoryClient(summary) {
  if (!summary) return summary;
  if (Array.isArray(summary.steps)) {
    for (const step of summary.steps) {
      if (step.action && !step.action.canonicalCategory) {
        step.action.canonicalCategory = categorizeActionClient(step.action.name, step.action.params, step.thought);
      }
    }
  }
  return summary;
}

export function hasNightlyRuns(testData) {
  if (!testData || typeof testData !== 'object') return false;
  return Object.values(testData).some(t => (t?.testId || '').toLowerCase().includes('nightly'));
}

