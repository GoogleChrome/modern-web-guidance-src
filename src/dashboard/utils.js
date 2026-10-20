/// <reference path="./evals.d.ts" />
import { classifyScenarioCheck } from './a11y-classifier.js';

/**
 * Utility functions shared between Dashboard and Landing pages.
 */

/**
 * Returns true if the dashboard is running on a local dev host or cloudtop proxy.
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isLocalDashboardHost(hostname = (typeof window !== 'undefined' ? window.location.hostname : '')) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.googlers.com');
}

/**
 * Computes the median of a numeric array.
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Formats a duration in milliseconds into a concise human-readable string (e.g., "1m 39s", "59s").
 * @param {number | undefined | null} ms
 * @returns {string}
 */
export function formatDuration(ms) {
    if (!ms || ms <= 0) return '0s';
    const totalSec = Math.round(ms / 1000);
    if (totalSec < 60) return `${totalSec}s`;
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins < 60) {
        return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    }
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
}

/**
 * Calculates normalized (uncached) tokens (`total - cached`) from a tokenUsage object.
 * @param {{ total?: number, cached?: number } | undefined | null} tokenUsage
 * @returns {{ total: number, cached: number, uncached: number, cachedPct: number }}
 */
export function getTokenBreakdown(tokenUsage) {
    const total = Math.max(0, tokenUsage?.total || 0);
    const cached = Math.max(0, Math.min(total, tokenUsage?.cached || 0));
    const uncached = Math.max(0, total - cached);
    const cachedPct = total > 0 ? Math.round((cached / total) * 100) : 0;
    return { total, cached, uncached, cachedPct };
}

/**
 * Extracts total run duration in milliseconds from either `run.runtimeMs` or `run.runtime.{agentRuntime,graderRuntime}`.
 * @param {(Partial<import('../harness/lib/metrics.ts').RunResult> & { runtimeMs?: number, runtime?: { agentRuntime?: number, graderRuntime?: number } | null }) | undefined | null} run
 * @returns {number}
 */
export function getRunDurationMs(run) {
    if (!run) return 0;
    if (typeof run.runtimeMs === 'number' && run.runtimeMs > 0) {
        return run.runtimeMs;
    }
    if (run.runtime && typeof run.runtime === 'object') {
        return (run.runtime.agentRuntime || 0) + (run.runtime.graderRuntime || 0);
    }
    return 0;
}

/**
 * Extracts the time the coding agent itself spent on the task, in milliseconds.
 *
 * Grader time is fixed harness overhead that MWG cannot influence, so efficiency
 * comparisons (unguided vs. guided) use this value rather than {@link getRunDurationMs}.
 * Legacy runs that only recorded a combined `runtimeMs` fall back to that number.
 *
 * @param {(Partial<import('../harness/lib/metrics.ts').RunResult> & { runtimeMs?: number, runtime?: { agentRuntime?: number, graderRuntime?: number } | null }) | undefined | null} run
 * @returns {number}
 */
export function getAgentRuntimeMs(run) {
    if (!run) return 0;
    if (run.runtime && typeof run.runtime === 'object' && typeof run.runtime.agentRuntime === 'number' && run.runtime.agentRuntime > 0) {
        return run.runtime.agentRuntime;
    }
    if (typeof run.runtimeMs === 'number' && run.runtimeMs > 0) {
        return run.runtimeMs;
    }
    return 0;
}

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
 * Computes pass rate and check list filtered strictly to cross-cutting accessibility checks.
 * @param {import('../harness/lib/metrics.ts').ScenarioCheck[] | undefined | null} checks
 * @param {string} guideName
 * @returns {{ rate: number, passed: number, total: number, checks: Array<import('../harness/lib/metrics.ts').ScenarioCheck & { a11y: ReturnType<typeof classifyScenarioCheck> }> }}
 */
export function getA11yRunStats(checks, guideName) {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0, checks: [] };
    const classified = checks
        .map(c => ({ ...c, a11y: classifyScenarioCheck(c, guideName) }))
        .filter(c => c.a11y.isAccessibility);
    const passed = classified.filter(c => c.passed).length;
    const total = classified.length;
    const rate = total > 0 ? Math.round((passed / total) * 100) : 0;
    return { rate, passed, total, checks: classified };
}

/**
 * @param {number} percentage
 * @returns {string}
 */
export function getColor(percentage) {
    const p = Math.max(0, Math.min(100, percentage));
    
    const RED = 'oklch(45% 0.18 26)';
    const YELLOW = 'oklch(45% 0.13 74)';
    const GREEN = 'oklch(44% 0.13 145)';

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
 * @property {number[]} guided_uncached_tokens
 * @property {number[]} unguided_uncached_tokens
 * @property {number[]} guided_cached_pct
 * @property {number[]} unguided_cached_pct
 * @property {number[]} guided_runtime_ms
 * @property {number[]} unguided_runtime_ms
 * @property {boolean} guided_failed
 * @property {boolean} unguided_failed
 * @property {number} a11y_total
 */

/**
 * @param {Record<string, import('../harness/lib/metrics.ts').RunResult[]>} results
 * @param {{ onlyA11y?: boolean }} [options={}]
 * @returns {{
 *   labels: string[],
 *   guided: number[],
 *   unguided: number[],
 *   guided_tokens: number[],
 *   unguided_tokens: number[],
 *   guided_uncached_tokens: number[],
 *   unguided_uncached_tokens: number[],
 *   guided_cached_pct: number[],
 *   unguided_cached_pct: number[],
 *   guided_runtime_ms: number[],
 *   unguided_runtime_ms: number[],
 *   guided_failed: boolean[],
 *   unguided_failed: boolean[]
 * }}
 */
export function calculateChartData(results, options = {}) {
    const onlyA11y = Boolean(options?.onlyA11y);
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
        const uncachedKey = rType === 'guided' ? 'guided_uncached_tokens' : 'unguided_uncached_tokens';
        const cachedPctKey = rType === 'guided' ? 'guided_cached_pct' : 'unguided_cached_pct';
        const runtimeKey = rType === 'guided' ? 'guided_runtime_ms' : 'unguided_runtime_ms';

        const scenario = `${taskName} (${guide})`;
        if (!apps[scenario]) {
            apps[scenario] = { 
                guided: [], 
                unguided: [], 
                guided_tokens: [], 
                unguided_tokens: [], 
                guided_uncached_tokens: [],
                unguided_uncached_tokens: [],
                guided_cached_pct: [],
                unguided_cached_pct: [],
                guided_runtime_ms: [],
                unguided_runtime_ms: [],
                guided_failed: false, 
                unguided_failed: false,
                a11y_total: 0
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
        
        let passed = 0;
        let total = 0;
        if (onlyA11y) {
            runs.forEach(r => {
                const a11yStats = getA11yRunStats(r.results, guide);
                passed += a11yStats.passed;
                total += a11yStats.total;
            });
            apps[scenario].a11y_total += total;
        } else {
            passed = runs.reduce((acc, r) => acc + getRunStats(r.results).passed, 0);
            total = runs.reduce((acc, r) => acc + (r.results?.length || 0), 0);
        }
        apps[scenario][rType].push(total > 0 ? (passed / total) * 100 : 0);

        const totalTokens = runs.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).total, 0);
        const uncachedTokens = runs.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).uncached, 0);
        const cachedTokens = runs.reduce((acc, r) => acc + getTokenBreakdown(r.tokenUsage).cached, 0);
        const avgTokens = runs.length > 0 ? Math.round(totalTokens / runs.length) : 0;
        const avgUncached = runs.length > 0 ? Math.round(uncachedTokens / runs.length) : 0;
        const cachedPct = totalTokens > 0 ? Math.round((cachedTokens / totalTokens) * 100) : 0;
        // Agent-only time, consistent with efficiencyStats (grader time is harness overhead).
        const totalRuntime = runs.reduce((acc, r) => acc + getAgentRuntimeMs(r), 0);
        const avgRuntime = runs.length > 0 ? Math.round(totalRuntime / runs.length) : 0;

        apps[scenario][tokensKey].push(avgTokens);
        apps[scenario][uncachedKey].push(avgUncached);
        apps[scenario][cachedPctKey].push(cachedPct);
        apps[scenario][runtimeKey].push(avgRuntime);
    });
    
    const labels = Object.keys(apps)
        .filter(scenario => !onlyA11y || apps[scenario].a11y_total > 0)
        .sort((a, b) => {
            const taskA = taskNames[a] || a;
            const taskB = taskNames[b] || b;
            return taskA.localeCompare(taskB);
        });

    /**
     * @param {string} l
     * @param {'guided' | 'unguided' | 'guided_tokens' | 'unguided_tokens' | 'guided_uncached_tokens' | 'unguided_uncached_tokens' | 'guided_cached_pct' | 'unguided_cached_pct' | 'guided_runtime_ms' | 'unguided_runtime_ms'} key
     * @returns {number}
     */
    const getAvgField = (l, key) => {
        const s = apps[l][key];
        return s && s.length > 0 ? Math.round(s.reduce((/** @type {number} */ acc, /** @type {number} */ b) => acc + b, 0) / s.length) : 0;
    };

    return { 
        labels, 
        guided: labels.map(l => getAvgField(l, 'guided')), 
        unguided: labels.map(l => getAvgField(l, 'unguided')),
        guided_tokens: labels.map(l => getAvgField(l, 'guided_tokens')),
        unguided_tokens: labels.map(l => getAvgField(l, 'unguided_tokens')),
        guided_uncached_tokens: labels.map(l => getAvgField(l, 'guided_uncached_tokens')),
        unguided_uncached_tokens: labels.map(l => getAvgField(l, 'unguided_uncached_tokens')),
        guided_cached_pct: labels.map(l => getAvgField(l, 'guided_cached_pct')),
        unguided_cached_pct: labels.map(l => getAvgField(l, 'unguided_cached_pct')),
        guided_runtime_ms: labels.map(l => getAvgField(l, 'guided_runtime_ms')),
        unguided_runtime_ms: labels.map(l => getAvgField(l, 'unguided_runtime_ms')),
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
    if (typeof document !== 'undefined' && !window.google?.accounts && !document.querySelector('script[src="https://accounts.google.com/gsi/client"]')) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }
    const init = () => {
        if (!window.google || !window.google.accounts) {
            // Wait for script to load
            setTimeout(init, 50);
            return;
        }

        const authBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('auth-btn'));
        if (authBtn) {
            authBtn.hidden = Boolean(accessToken);
            authBtn.style.display = accessToken ? 'none' : 'block';
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
                    authBtn.hidden = true;
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
            authBtn.hidden = false;
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

/**
 * Returns the colored decorative glyph badge for an agent family or agent string.
 * @param {string} agentName
 * @returns {string}
 */
export function getAgentBadge(agentName) {
    const name = (agentName || '').toLowerCase();
    if (name.includes('gemini') || name.includes('jetski') || name.includes('antigravity')) {
        return '<span class="agent-badge gemini" aria-hidden="true">✦</span>';
    }
    if (name.includes('codex') || name.includes('openai')) {
        return '<span class="agent-badge openai" aria-hidden="true">❂</span>';
    }
    if (name.includes('claude')) {
        return '<span class="agent-badge claude" aria-hidden="true">✱</span>';
    }
    return '';
}

