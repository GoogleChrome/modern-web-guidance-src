import { initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, timeAgo, calculateChartData, formatDuration, formatTokens, isLocalDashboardHost, $ } from './utils.js';
import { DumbbellChart } from './dumbbell-chart.js';
import { extractSuiteSummary } from './summary-extractor.js';

/**
 * @typedef {import('./summary-extractor.js').SuiteSummary & {
 *   source: import('./api.js').DataSource;
 *   data?: any;
 * }} LandingSuiteSummary
 */

/** @typedef {'all' | import('./api.js').DataSource} SourceFilter */
/** @typedef {'alphabetic' | 'uplift' | 'unguided' | 'guided' | 'variance'} GuideSortKey */
/** @typedef {'asc' | 'desc'} SortDirection */
/** @typedef {'all' | 'a11y'} InsightsMode */
/** @typedef {'date' | 'tasks' | 'uplift' | 'a11y' | 'time' | 'tokens'} SuiteSortKey */

// ==========================================
// STATE
// ==========================================

/** @type {Record<string, LandingSuiteSummary>} */
let allTestData = {}; // Cache all test data by compound key (testId|||source)
/** @type {Set<string>} */
let selectedTestIds = new Set(); // Compound keys picked in the "Filter runs" menu
/** @type {SourceFilter} */
let currentSourceFilter = 'all';
/** @type {string} */
let currentAgentFilter = 'all';
/** @type {string} */
let currentServingFilter = 'all';
/** @type {string} */
let currentModelFilter = 'all';
/** @type {boolean} */
let scheduledOnly = true;

/** @type {SuiteSortKey} */
let currentSuiteSort = 'date';
/** @type {SortDirection} */
let currentSuiteSortDir = 'desc';

/**
 * Direction used the first time a column is sorted. Pass-rate style metrics are
 * "higher is better" (descending first); time and tokens are "lower is better"
 * (ascending first so the biggest savings surface at the top).
 * @type {Record<SuiteSortKey, SortDirection>}
 */
const DEFAULT_SORT_DIR = {
    date: 'desc',
    tasks: 'desc',
    uplift: 'desc',
    a11y: 'desc',
    time: 'asc',
    tokens: 'asc'
};

// Breakdown ("insights") pivot state
/** @type {GuideSortKey} */
let currentGuideSort = 'alphabetic';
/** @type {SortDirection} */
let currentGuideSortDir = 'asc';
/** @type {InsightsMode} */
let currentInsightsMode = 'all';

/** @type {Record<string, string>} */
const servingDisplayNames = {
    'skills': 'Skills',
    'skills_cli': 'Skills (CLI)',
    'mcp': 'MCP'
};

function isRemoteDashboard() {
    return !isLocalDashboardHost();
}

/**
 * Scheduled suites run automatically on a fixed task set and are the only ones
 * that should be compared across days. Everything else is an ad-hoc experiment.
 * @param {string} testId
 */
function isScheduledSuite(testId) {
    return /^(nightly|weekly)-/i.test(testId || '');
}

// ==========================================
// BOOT
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    try {
        setupTestFilters();
        setupTableFilters();
        setupScheduledToggle();
        setupSortButtons();
        setupInsightsControls();

        const params = new URLSearchParams(window.location.search);

        // Load local immediately; remote once the user is signed in.
        initGoogleAuth(async () => {
            await loadRemoteTests();
        });

        await loadLocalTests();
        if (getAccessToken()) {
            await loadRemoteTests();
        }

        selectedTestIds = new Set(Object.keys(allTestData));
        applyTestsParam(params.get('tests'));

        renderFilterMenuItems();
        renderSuites();
    } catch (error) {
        console.error('Error:', error);
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'block';
    }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    selectedTestIds = new Set(Object.keys(allTestData));
    applyTestsParam(params.get('tests'));
    renderFilterMenuItems();
    renderSuites();
});

/**
 * Narrows the selection to the compound keys listed in `?tests=` when any of them exist.
 * @param {string | null} testsParam
 */
function applyTestsParam(testsParam) {
    if (!testsParam || testsParam.trim() === '') return;
    const requestedIds = testsParam.split(',').filter(id => id.trim() !== '');
    const matchIds = new Set();
    requestedIds.forEach(req => {
        if (allTestData[req]) matchIds.add(req);
    });
    if (matchIds.size > 0) {
        selectedTestIds = matchIds;
    }
}

// ==========================================
// CONTROLS
// ==========================================

function setupTestFilters() {
    const filterBtn = document.getElementById('filter-btn');
    const filterMenu = document.getElementById('filter-menu');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const list = document.getElementById('filter-list');
    const searchInput = document.getElementById('filter-search');
    if (!filterBtn || !filterMenu || !list) return;

    /** @param {boolean} open */
    const setOpen = (open) => {
        filterMenu.classList.toggle('hidden', !open);
        filterBtn.setAttribute('aria-expanded', String(open));
        if (open && searchInput instanceof HTMLInputElement) {
            searchInput.focus();
        }
    };

    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(filterMenu.classList.contains('hidden'));
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof Node && !filterMenu.contains(target) && !filterBtn.contains(target)) {
            if (!filterMenu.classList.contains('hidden')) setOpen(false);
        }
    });

    // Escape closes the menu and returns focus to the trigger (disclosure pattern)
    filterMenu.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            setOpen(false);
            filterBtn.focus();
        }
    });

    selectAllBtn?.addEventListener('click', () => {
        selectedTestIds = new Set(Object.keys(allTestData));
        updateUrlParams();
        renderFilterMenuItems();
        renderSuites();
    });

    deselectAllBtn?.addEventListener('click', () => {
        selectedTestIds.clear();
        updateUrlParams();
        renderFilterMenuItems();
        renderSuites();
    });

    searchInput?.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        const term = target.value.toLowerCase();
        list.querySelectorAll('.filter-item').forEach(item => {
            if (item instanceof HTMLElement) {
                const labelEl = item.querySelector('.filter-item-label');
                const label = labelEl ? (labelEl.textContent || '').toLowerCase() : '';
                item.hidden = !label.includes(term);
            }
        });
    });

    renderFilterMenuItems();
}

function setupTableFilters() {
    /** @type {Record<string, (val: string) => void>} */
    const filters = {
        'filter-source': (val) => currentSourceFilter = /** @type {SourceFilter} */ (val),
        'filter-agent': (val) => currentAgentFilter = val,
        'filter-serving': (val) => currentServingFilter = val,
        'filter-model': (val) => currentModelFilter = val
    };

    Object.entries(filters).forEach(([id, updateFn]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', (e) => {
            const target = e.target;
            if (target instanceof HTMLSelectElement || target instanceof HTMLInputElement) {
                updateFn(target.value);
                syncSelectStyles(target);
                renderSuites();
            }
        });
        syncSelectStyles(el);
    });
}

function setupScheduledToggle() {
    const check = document.getElementById('scheduled-only-check');
    if (!(check instanceof HTMLInputElement)) return;
    scheduledOnly = check.checked;
    check.addEventListener('change', () => {
        scheduledOnly = check.checked;
        renderSuites();
    });
}

function setupSortButtons() {
    document.querySelectorAll('.suites-table thead .sort-btn').forEach(btn => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = /** @type {SuiteSortKey | undefined} */ (btn.dataset.sort);
        if (!key) return;
        btn.addEventListener('click', () => {
            if (currentSuiteSort === key) {
                currentSuiteSortDir = currentSuiteSortDir === 'asc' ? 'desc' : 'asc';
            } else {
                currentSuiteSort = key;
                currentSuiteSortDir = DEFAULT_SORT_DIR[key];
            }
            renderSuites();
        });
    });
    syncSortHeaders();
}

/** Reflects the active sort in `aria-sort` so AT users hear the current order. */
function syncSortHeaders() {
    document.querySelectorAll('.suites-table thead th').forEach(th => {
        const btn = th.querySelector('.sort-btn');
        if (!(btn instanceof HTMLButtonElement)) return;
        if (btn.dataset.sort === currentSuiteSort) {
            th.setAttribute('aria-sort', currentSuiteSortDir === 'asc' ? 'ascending' : 'descending');
        } else {
            th.removeAttribute('aria-sort');
        }
    });
}

function setupInsightsControls() {
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const modeAllBtn = document.getElementById('insights-mode-all');
    const modeA11yBtn = document.getElementById('insights-mode-a11y');

    if (limitInput instanceof HTMLInputElement) {
        limitInput.addEventListener('change', () => {
            let val = parseInt(limitInput.value);
            if (isNaN(val) || val < 1) val = 15;
            limitInput.value = val.toString();
            renderPivotInsights();
        });
        limitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') limitInput.blur();
        });
    }

    if (showAllCheck instanceof HTMLInputElement) {
        showAllCheck.addEventListener('change', () => {
            if (limitInput instanceof HTMLInputElement) {
                limitInput.disabled = showAllCheck.checked;
            }
            renderPivotInsights();
        });
    }

    const setMode = (/** @type {InsightsMode} */ mode) => {
        currentInsightsMode = mode;
        modeAllBtn?.setAttribute('aria-pressed', String(mode === 'all'));
        modeA11yBtn?.setAttribute('aria-pressed', String(mode === 'a11y'));
        renderPivotInsights();
    };
    modeAllBtn?.addEventListener('click', () => setMode('all'));
    modeA11yBtn?.addEventListener('click', () => setMode('a11y'));

    // The pivot only renders once the drawer is opened (it is collapsed by default).
    const drawer = document.getElementById('breakdowns');
    if (drawer instanceof HTMLDetailsElement) {
        drawer.addEventListener('toggle', () => {
            if (drawer.open) renderPivotInsights();
        });
    }

    // Event delegation for pivot rows: model rows toggle the table filter.
    const container = document.getElementById('insights-container');
    container?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('button[data-filter-key]');
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = btn.dataset.filterKey;
        const value = btn.dataset.filterValue;
        if ((key === 'agent' || key === 'serving' || key === 'model') && value !== undefined) {
            setInsightFilter(key, value);
        }
    });
}

/**
 * @param {any} el
 */
function syncSelectStyles(el) {
    el.classList.toggle('is-filtered', el.value !== 'all');
}

function renderFilterMenuItems() {
    const list = document.getElementById('filter-list');
    if (!list) return;
    list.innerHTML = '';

    const sortedIds = Object.keys(allTestData).sort((a, b) => {
        return getSuiteDate(allTestData[b]).getTime() - getSuiteDate(allTestData[a]).getTime();
    });

    sortedIds.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        const item = document.createElement('label');
        item.className = 'filter-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedTestIds.has(compoundKey);
        checkbox.value = compoundKey;
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                selectedTestIds.add(compoundKey);
            } else {
                selectedTestIds.delete(compoundKey);
            }
            updateUrlParams();
            renderSuites();
        });

        const labelContent = document.createElement('div');
        labelContent.className = 'filter-item-label';

        const idSpan = document.createElement('span');
        idSpan.textContent = testInfo.testId.replace('test_', '') + ` (${testInfo.source})`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'filter-item-date';
        dateSpan.textContent = formatSuiteDate(getSuiteDate(testInfo));

        labelContent.append(idSpan, dateSpan);
        item.append(checkbox, labelContent);
        list.appendChild(item);
    });
}

function updateUrlParams() {
    const url = new URL(window.location.href);
    const allIds = Object.keys(allTestData);
    if (selectedTestIds.size === allIds.length) {
        url.searchParams.delete('tests');
    } else {
        url.searchParams.set('tests', Array.from(selectedTestIds).join(','));
    }
    window.history.replaceState({}, '', url);
}

// ==========================================
// DATA LOADING
// ==========================================

async function loadLocalTests() {
    if (!isLocalDashboardHost()) {
        return; // Avoid 404s by skipping local network fetches when hosted on GitHub Pages
    }

    try {
        let response = await fetch(`/api/suites?t=${Date.now()}`);
        let manifest;
        let useResultsPrefix = false;

        if (!response.ok) {
            // Try fetching suites.gen.json as fallback for static mode
            const staticRes = await fetch(`/suites.gen.json?t=${Date.now()}`);
            if (!staticRes.ok) return; // Silent fail if both fail
            const suitesData = await staticRes.json();
            manifest = Array.isArray(suitesData) ? { suites: suitesData } : suitesData;
            useResultsPrefix = true;
        } else {
            manifest = await response.json();
        }

        if (manifest.suites && manifest.suites.length > 0) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'none';
        }

        const sourceName = useResultsPrefix ? 'static' : 'local';
        for (const suite of manifest.suites) {
            if (typeof suite === 'object' && suite.testId && suite.guidedStats) {
                registerSuiteSummary(suite, sourceName);
            } else {
                const testId = typeof suite === 'string' ? suite : suite.id || suite.testId;
                const suiteTimestamp = typeof suite === 'object' ? suite.timestamp : undefined;
                if (!testId) continue;
                try {
                    const fetchPath = useResultsPrefix ? `results/${testId}/evals.json` : `${testId}/evals.json`;
                    const response = await fetch(`${fetchPath}?source=${sourceName}&t=${Date.now()}`);
                    if (response.ok) {
                        const parsed = await response.json();
                        registerTestData(testId, sourceName, parsed, suiteTimestamp);
                    }
                } catch (e) {
                    console.warn(`Failed to load local test ${testId}:`, e);
                }
            }
        }
    } catch {
        console.warn('Local proxy not available');
    }
}

async function loadRemoteTests() {
    try {
        const fileUrl = `https://storage.googleapis.com/storage/v1/b/guidance-evals/o/${encodeURIComponent('suites.gen.json')}?alt=media&t=${Date.now()}`;
        const response = await authenticatedFetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch remote suites manifest');

        const manifest = await response.json();
        if (Array.isArray(manifest) && manifest.length > 0) {
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'none';
            for (const item of manifest) {
                if (item && item.testId) {
                    registerSuiteSummary(item, 'remote');
                }
            }
        }

        // Re-render now that we have remote data
        const params = new URLSearchParams(window.location.search);
        const initialTests = params.get('tests');
        if (!initialTests || initialTests.trim() === '') {
            selectedTestIds = new Set(Object.keys(allTestData));
        }
        renderFilterMenuItems();
        renderSuites();
    } catch (error) {
        console.error('Error loading remote suites:', error);
    }
}

/**
 * @param {import('./summary-extractor.js').SuiteSummary & { data?: any }} summary
 * @param {import('./api.js').DataSource} source
 */
function registerSuiteSummary(summary, source) {
    const compoundKey = `${summary.testId}|||${source}`;
    allTestData[compoundKey] = {
        ...summary,
        source: source,
        data: summary.data || null
    };
    updateFilterOptions('filter-model-group', 'model');
    updateFilterOptions('filter-agent-group', 'agent');
    updateFilterOptions('filter-serving-group', 'serving', servingDisplayNames);
}

/**
 * @param {string} testId
 * @param {import('./api.js').DataSource} source
 * @param {import('../harness/lib/metrics.ts').EvalsReport} parsed
 * @param {string} [forcedTimestamp]
 */
function registerTestData(testId, source, parsed, forcedTimestamp) {
    const summary = extractSuiteSummary(testId, parsed, forcedTimestamp);
    if (summary) {
        registerSuiteSummary({ ...summary, data: parsed }, source);
    }
}

/**
 * Rebuilds a header <select>'s option group from the distinct values seen so far.
 * @param {string} groupId
 * @param {'agent' | 'serving' | 'model'} key
 * @param {Record<string, string>} [displayNames]
 */
function updateFilterOptions(groupId, key, displayNames = {}) {
    const group = document.getElementById(groupId);
    if (!group) return;

    const values = [...new Set(Object.values(allTestData).map(t => t[key]).filter(Boolean))].sort();
    const currentOptions = Array.from(group.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(values)) return;

    group.innerHTML = values.map(val =>
        `<option value="${escapeHtml(val)}">${escapeHtml(displayNames[val] || val)}</option>`
    ).join('');
}

// ==========================================
// SELECTION, SORTING & DATES
// ==========================================

/**
 * Resolves the suite's run date. Manifest timestamps that land exactly on midnight
 * usually mean only a date was recorded, so prefer the time embedded in the testId.
 * @param {LandingSuiteSummary} testInfo
 * @returns {Date}
 */
function getSuiteDate(testInfo) {
    let date = new Date(testInfo.timestamp);
    const isMidnight = !isNaN(date.getTime()) && date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
    if (isNaN(date.getTime()) || isMidnight) {
        const isoLikeMatch = testInfo.testId.match(/(\d{4}-\d{2}-\d{2})[T_](\d{2})-(\d{2})-(\d{2})/);
        const dateOnlyMatch = testInfo.testId.match(/(\d{4}-\d{2}-\d{2})/);
        if (isoLikeMatch) {
            const parsed = new Date(`${isoLikeMatch[1]}T${isoLikeMatch[2]}:${isoLikeMatch[3]}:${isoLikeMatch[4]}`);
            if (!isNaN(parsed.getTime())) date = parsed;
        } else if (dateOnlyMatch) {
            const parsed = new Date(dateOnlyMatch[1]);
            if (!isNaN(parsed.getTime())) date = parsed;
        }
    }
    return isNaN(date.getTime()) ? new Date(0) : date;
}

/**
 * "Oct 9, 2026, 7:00 AM", or just the date when no time-of-day is known.
 * @param {Date} date
 */
function formatSuiteDate(date) {
    const hasTime = !(date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0);
    if (!hasTime) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return date.toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }).replace(' at ', ', ');
}

/**
 * @param {{ passed: number, total: number } | undefined} stats
 */
function toRate(stats) {
    return stats && stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
}

/**
 * Compound keys that pass the "Filter runs" selection and the header filters
 * (but not the scheduled toggle), so counts can say how many ad-hoc runs are hidden.
 * @returns {string[]}
 */
function getFilteredKeys() {
    return Array.from(selectedTestIds).filter(compoundKey => {
        const t = allTestData[compoundKey];
        if (!t) return false;
        if (currentSourceFilter !== 'all' && t.source !== currentSourceFilter) return false;
        if (currentAgentFilter !== 'all' && t.agent !== currentAgentFilter) return false;
        if (currentServingFilter !== 'all' && t.serving !== currentServingFilter) return false;
        if (currentModelFilter !== 'all' && t.model !== currentModelFilter) return false;
        return true;
    });
}

/**
 * Keys that are actually shown in the table, sorted by the active column.
 * @returns {string[]}
 */
function getVisibleKeys() {
    const filtered = getFilteredKeys();
    const anyScheduled = filtered.some(k => isScheduledSuite(allTestData[k].testId));
    // If a data set has no scheduled suites at all (e.g. a local workspace with ad-hoc runs),
    // hiding everything would be unhelpful, so the toggle only applies when it has something to keep.
    const keys = (scheduledOnly && anyScheduled)
        ? filtered.filter(k => isScheduledSuite(allTestData[k].testId))
        : filtered;
    return sortSuiteKeys(keys);
}

/**
 * @param {LandingSuiteSummary} t
 * @param {SuiteSortKey} key
 * @returns {number | null}
 */
function getSortValue(t, key) {
    switch (key) {
        case 'date':
            return getSuiteDate(t).getTime();
        case 'tasks':
            return t.taskCount || 0;
        case 'uplift':
            return toRate(t.guidedStats) - toRate(t.unguidedStats);
        case 'a11y': {
            const a = t.a11yStats;
            return a && (a.guidedTotal > 0 || a.unguidedTotal > 0) ? a.uplift : null;
        }
        case 'time': {
            const rt = t.efficiencyStats?.runtime;
            return rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0) ? rt.medianDeltaPct : null;
        }
        case 'tokens': {
            const tok = t.efficiencyStats?.tokens;
            return tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0) ? tok.uncachedMedianDeltaPct : null;
        }
        default: {
            /** @type {never} */
            const _exhaustive = key;
            throw new Error(`Unhandled sort key: ${_exhaustive}`);
        }
    }
}

/**
 * Stable sort; rows without a value for the metric always sink to the bottom.
 * @param {string[]} keys
 */
function sortSuiteKeys(keys) {
    const dir = currentSuiteSortDir === 'asc' ? 1 : -1;
    return keys
        .map((k, i) => ({ k, i, v: getSortValue(allTestData[k], currentSuiteSort), d: getSuiteDate(allTestData[k]).getTime() }))
        .sort((a, b) => {
            if (a.v === null && b.v === null) return b.d - a.d || a.i - b.i;
            if (a.v === null) return 1;
            if (b.v === null) return -1;
            if (a.v !== b.v) return (a.v - b.v) * dir;
            return b.d - a.d || a.i - b.i; // tie-break newest first
        })
        .map(x => x.k);
}

// ==========================================
// RENDERERS
// ==========================================

/**
 * Inline dumbbell (decorative) followed by the textual comparison, which is the
 * accessible encoding: "62% → 85% (+23 pp)".
 * @param {number} uRate
 * @param {number} gRate
 * @param {string} label used for the screen-reader sentence
 */
function renderRateComparison(uRate, gRate, label) {
    const delta = gRate - uRate;
    const sign = delta > 0 ? '+' : '';
    const deltaClass = delta > 0 ? 'delta up' : (delta < 0 ? 'delta down' : 'delta flat');
    return `
        <div class="suite-dumbbell-track" aria-hidden="true">
            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 2px); width: calc(${Math.abs(gRate - uRate)}% - 4px);"></div>
            <div class="dot unguided" style="left: calc(${uRate}% - 4px);"></div>
            <div class="dot guided" style="left: calc(${gRate}% - 4px);"></div>
        </div>
        <div class="rate-text">
            <span class="visually-hidden">${escapeHtml(label)}: unguided </span><span class="rate-u">${uRate}%</span>
            <span class="rate-arrow" aria-hidden="true">→</span><span class="visually-hidden">, guided </span>
            <span class="rate-g">${gRate}%</span>
            <span class="${deltaClass}">(${sign}${delta} pp)</span>
        </div>
    `;
}

/**
 * Relative change pill for "lower is better" metrics (time, tokens).
 * Shape (▼/▲) and sign carry the meaning; color is reinforcement only.
 * @param {number} deltaPct
 * @param {string} noun e.g. "time" or "uncached tokens"
 */
function renderDeltaPill(deltaPct, noun) {
    if (deltaPct < 0) {
        return `<span class="eff-pill positive"><span aria-hidden="true">▼ </span>${Math.abs(deltaPct)}%<span class="visually-hidden"> less ${escapeHtml(noun)}</span></span>`;
    }
    if (deltaPct === 0) {
        return `<span class="eff-pill neutral">±0%<span class="visually-hidden"> ${escapeHtml(noun)}, no change</span></span>`;
    }
    return `<span class="eff-pill muted"><span aria-hidden="true">▲ </span>${deltaPct}%<span class="visually-hidden"> more ${escapeHtml(noun)}</span></span>`;
}

/** @param {string} what */
function renderNotAvailable(what) {
    return `<span class="not-available" aria-hidden="true">—</span><span class="visually-hidden">${escapeHtml(what)} not available</span>`;
}

function renderSuites() {
    const container = document.getElementById('suites-list');
    if (!container) return;

    const headerSource = document.getElementById('header-source');
    if (headerSource) {
        headerSource.style.display = isRemoteDashboard() ? 'none' : '';
    }
    syncSortHeaders();

    const filteredKeys = getFilteredKeys();
    const visibleKeys = getVisibleKeys();
    const hiddenAdHoc = filteredKeys.length - visibleKeys.length;
    const showSource = !isRemoteDashboard();
    const colCount = showSource ? 10 : 9;

    renderSuitesCount(visibleKeys.length, filteredKeys.length, hiddenAdHoc);

    if (visibleKeys.length === 0) {
        const anyData = Object.keys(allTestData).length > 0;
        container.innerHTML = `
            <tr class="suites-empty-row">
                <td colspan="${colCount}">${anyData ? 'No runs match the current filters.' : 'Loading runs…'}</td>
            </tr>
        `;
        return;
    }

    let html = '';
    visibleKeys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        const testId = testInfo.testId;
        const date = getSuiteDate(testInfo);

        const gRate = toRate(testInfo.guidedStats);
        const uRate = toRate(testInfo.unguidedStats);

        const a11y = testInfo.a11yStats;
        const hasA11y = Boolean(a11y && (a11y.guidedTotal > 0 || a11y.unguidedTotal > 0));

        const rt = testInfo.efficiencyStats?.runtime;
        const hasRuntime = Boolean(rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0));

        const tok = testInfo.efficiencyStats?.tokens;
        const hasTokens = Boolean(tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0));

        const localLink = `dashboard.html?testId=${encodeURIComponent(testId)}&source=${testInfo.source}`;
        const taskCount = testInfo.taskCount || 0;
        const maxRuns = testInfo.maxRuns || 1;
        const isFaulty = (testInfo.earlyFailureRate || 0) === 100;
        const scheduled = isScheduledSuite(testId);
        const { label, ldap } = formatSuiteLabel(testInfo);

        const a11yCellHtml = hasA11y && a11y
            ? renderRateComparison(a11y.unguidedRate, a11y.guidedRate, 'Accessibility subscore')
            : renderNotAvailable('Accessibility subscore');

        const timeCellHtml = hasRuntime && rt
            ? `
                <div class="eff-cell-main">
                    <span><span class="visually-hidden">Median time: unguided </span>${formatDuration(rt.unguidedMedianMs)} <span aria-hidden="true">→</span><span class="visually-hidden">, guided</span> <strong>${formatDuration(rt.guidedMedianMs)}</strong></span>
                    ${renderDeltaPill(rt.medianDeltaPct, 'time')}
                </div>
                ${rt.pairedTaskCount > 0 ? `<div class="eff-cell-sub">${rt.fasterTaskPct}% of tasks faster or equal</div>` : ''}
            `
            : renderNotAvailable('Median time');

        const tokenCellHtml = hasTokens && tok
            ? `
                <div class="eff-cell-main">
                    <span><span class="visually-hidden">Median uncached tokens: unguided </span>${formatTokens(tok.unguidedUncachedMedian)} <span aria-hidden="true">→</span><span class="visually-hidden">, guided</span> <strong>${formatTokens(tok.guidedUncachedMedian)}</strong></span>
                    ${renderDeltaPill(tok.uncachedMedianDeltaPct, 'uncached tokens')}
                </div>
                <div class="eff-cell-sub">Incl. cache: ${formatTokens(tok.unguidedTotalMedian)} <span aria-hidden="true">→</span><span class="visually-hidden">to</span> ${formatTokens(tok.guidedTotalMedian)} (${tok.guidedCachedSharePct}% cached)</div>
            `
            : renderNotAvailable('Median uncached tokens');

        const badges = [
            !scheduled ? '<span class="run-kind-badge">ad hoc</span>' : '',
            isFaulty ? '<span class="run-kind-badge faulty">all runs failed</span>' : ''
        ].join('');

        html += `
            <tr class="suite-table-row${isFaulty ? ' faulty' : ''}${scheduled ? '' : ' adhoc'}" data-test-id="${escapeHtml(testId)}">
                <th scope="row" class="suite-cell">
                    <a href="${localLink}" class="suite-link">
                        <time class="suite-label" datetime="${date.toISOString()}">${escapeHtml(formatSuiteDate(date))}</time>
                        <span class="suite-meta">
                            <span class="suite-name">${escapeHtml(label)}</span>${badges} · ${escapeHtml(timeAgo(date))}${ldap ? ` · <span>${escapeHtml(ldap)}</span>` : ''}
                        </span>
                    </a>
                </th>
                <td class="agent-cell"><span>${getAgentBadge(testInfo.agent)}${escapeHtml(testInfo.agent)}</span></td>
                <td>${escapeHtml(servingDisplayNames[testInfo.serving] || testInfo.serving)}</td>
                <td class="model-cell">${(escapeHtml(testInfo.model) || '').replaceAll('-', '-<wbr>')}</td>
                <td class="tasks-cell">${taskCount}${maxRuns > 1 ? ` <span class="tasks-runs">×${maxRuns}</span>` : ''}</td>
                <td class="uplift-cell metric-cell" data-compound-key="${escapeHtml(compoundKey)}">
                    <a href="${localLink}" class="uplift-link" aria-label="Per-guide results for ${escapeHtml(label)}">
                        ${renderRateComparison(uRate, gRate, 'Pass rate')}
                    </a>
                </td>
                <td class="metric-cell">${a11yCellHtml}</td>
                <td class="metric-cell">${timeCellHtml}</td>
                <td class="metric-cell tokens-cell">${tokenCellHtml}</td>
                ${showSource ? `<td class="source-cell">${escapeHtml(testInfo.source)}</td>` : ''}
            </tr>
        `;
    });

    container.innerHTML = html;
    setupRateCellHovers();

    const drawer = document.getElementById('breakdowns');
    if (!(drawer instanceof HTMLDetailsElement) || drawer.open) {
        renderPivotInsights();
    }
}

/**
 * @param {number} shown
 * @param {number} matching
 * @param {number} hiddenAdHoc
 */
function renderSuitesCount(shown, matching, hiddenAdHoc) {
    const el = document.getElementById('suites-count');
    if (!el) return;
    const total = Object.keys(allTestData).length;
    if (total === 0) {
        el.textContent = '';
        return;
    }
    const parts = [`Showing ${shown} of ${total} run${total === 1 ? '' : 's'}`];
    if (hiddenAdHoc > 0) {
        parts.push(`${hiddenAdHoc} ad-hoc run${hiddenAdHoc === 1 ? '' : 's'} hidden by "Scheduled runs only"`);
    } else if (matching < total) {
        parts.push(`${total - matching} filtered out`);
    }
    el.textContent = parts.join(' · ');
}

// ---- Hover/focus mini chart for the pass-rate cell ----

/** @type {DumbbellChart | null} */
let tooltipChartInstance = null;
/** @type {string | null} */
let currentDumbbellKey = null;
/** @type {number | null} */
let hideTimeout = null;
const tooltipContainer = document.getElementById('tooltip-container');

function setupRateCellHovers() {
    if (!tooltipContainer) return;
    document.querySelectorAll('.uplift-cell').forEach(cell => {
        if (!(cell instanceof HTMLElement)) return;
        const compoundKey = cell.dataset.compoundKey;
        if (!compoundKey) return;

        /** @param {number} x @param {number} y */
        const show = (x, y) => {
            const testInfo = allTestData[compoundKey];
            if (!testInfo) return;
            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }
            showTooltipChart(testInfo, x, y, compoundKey);
        };

        cell.addEventListener('mouseenter', (e) => {
            if (e instanceof MouseEvent) show(e.clientX, e.clientY);
        });
        cell.addEventListener('mousemove', (e) => {
            if (e instanceof MouseEvent) updateTooltipPosition(e.clientX, e.clientY);
        });
        cell.addEventListener('mouseleave', () => hideTooltipChart());

        // Keyboard parity: the same preview opens while the cell's link has focus.
        const link = cell.querySelector('a');
        link?.addEventListener('focus', () => {
            const r = cell.getBoundingClientRect();
            show(r.right, r.top);
        });
        link?.addEventListener('blur', () => hideTooltipChart());
    });
}

/**
 * @param {LandingSuiteSummary} testInfo
 * @param {number} x
 * @param {number} y
 * @param {string} compoundKey
 */
function showTooltipChart(testInfo, x, y, compoundKey) {
    if (!tooltipContainer) return;
    if (currentDumbbellKey === compoundKey && !tooltipContainer.classList.contains('hidden')) {
        updateTooltipPosition(x, y);
        return;
    }
    currentDumbbellKey = compoundKey;

    const headerDiv = $('#tooltip-header');
    if (headerDiv) {
        headerDiv.innerHTML = `
            <div class="tooltip-title">${escapeHtml(testInfo.testId)}</div>
            <div class="tooltip-subtitle">${escapeHtml(testInfo.agent)} • ${escapeHtml(servingDisplayNames[testInfo.serving] || testInfo.serving)} • per-guide pass rate, unguided → guided</div>
        `;
    }

    const chartData = testInfo.chartData || (testInfo.data?.results ? calculateChartData(testInfo.data.results) : null);
    if (!chartData || !chartData.labels || chartData.labels.length < 1) return;
    const { labels, guided, unguided } = chartData;

    tooltipContainer.classList.remove('hidden');
    updateTooltipPosition(x, y);

    if (!tooltipChartInstance) {
        tooltipChartInstance = new DumbbellChart('tooltip-chart', {
            size: 270, maxHeight: 250, rowHeight: 20, margin: { top: 15, right: 15, bottom: 15, left: 15 }, hideLegend: true, hideLabels: true, hideSeparators: true, hideZeros: true, hideAxes: true
        });
    }

    tooltipChartInstance.render({
        labels,
        datasets: [
            { label: 'Unguided', data: unguided },
            { label: 'Guided', data: guided }
        ]
    });
}

/**
 * @param {number} x
 * @param {number} y
 */
function updateTooltipPosition(x, y) {
    if (!tooltipContainer) return;
    const offset = 20;
    let finalX = x + offset;
    let finalY = y + offset;
    const tooltipWidth = tooltipContainer.clientWidth || 330;
    const tooltipHeight = tooltipContainer.clientHeight || 330;
    if (finalX + tooltipWidth > window.innerWidth) finalX = x - tooltipWidth - offset;
    if (finalY + tooltipHeight > window.innerHeight) finalY = y - tooltipHeight - offset;
    tooltipContainer.style.left = `${Math.max(8, finalX)}px`;
    tooltipContainer.style.top = `${Math.max(8, finalY)}px`;
}

function hideTooltipChart() {
    if (!tooltipContainer) return;
    if (hideTimeout) window.clearTimeout(hideTimeout);
    hideTimeout = window.setTimeout(() => {
        currentDumbbellKey = null;
        tooltipContainer.classList.add('hidden');
        hideTimeout = null;
    }, 50);
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Splits "nightly-2026-10-09_07-00-02-antigravity_cli" into a short label plus
 * any trailing owner tag, dropping the agent/serving tokens that other columns show.
 * @param {LandingSuiteSummary} testInfo
 * @returns {{ label: string, ldap: string }}
 */
function formatSuiteLabel(testInfo) {
    const { testId, agent, serving } = testInfo;
    if (!testId) return { label: 'evaluation-run', ldap: '' };

    const timeRegex = /[-_]?\b\d{4}-\d{2}-\d{2}(?:[T_]\d{2}-\d{2}-\d{2})?\b[-_]?/;
    const parts = testId.split(timeRegex);

    let prefix = (parts[0] || '').replace(/^[-_]+|[-_]+$/g, '');
    let suffix = (parts[1] || '').replace(/^[-_]+|[-_]+$/g, '');
    const label = prefix || 'evaluation-run';
    if (!suffix) return { label, ldap: '' };

    const normalize = (/** @type {string} */ s) => (s || '').toLowerCase().replace(/[-_]+/g, '');
    const normAgent = normalize(agent);
    const normServing = normalize(serving);

    /** @type {string[]} */
    const otherTags = [];
    suffix.split('-').forEach(part => {
        const normPart = normalize(part);
        if (normPart === normAgent || normPart === normServing) return;
        if (normPart === 'cli' || normPart === 'run' || normPart === 'skills') return;
        otherTags.push(part);
    });

    let ldap = '';
    if (otherTags.length > 0) {
        ldap = otherTags.pop() || '';
    }
    let finalLabel = label;
    if (otherTags.length > 0) {
        finalLabel += '-' + otherTags.join('-');
    }
    return { label: finalLabel, ldap };
}

/**
 * @param {string} agentName
 * @returns {string}
 */
function getAgentBadge(agentName) {
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

// ==========================================
// BREAKDOWNS (by model, by guide)
// ==========================================

/**
 * Restricts the visible runs to the most recent N distinct run-dates (or all).
 * @returns {string[]}
 */
function getInsightKeys() {
    let keys = getVisibleKeys();
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const showAll = showAllCheck instanceof HTMLInputElement ? showAllCheck.checked : false;
    const limit = limitInput instanceof HTMLInputElement ? (parseInt(limitInput.value) || 15) : 15;

    if (!showAll && keys.length > 0) {
        const dayOf = (/** @type {string} */ k) => getSuiteDate(allTestData[k]).toISOString().slice(0, 10);
        const sortedDates = [...new Set(keys.map(dayOf))].sort((a, b) => a.localeCompare(b));
        const activeDates = new Set(sortedDates.slice(-limit));
        keys = keys.filter(k => activeDates.has(dayOf(k)));
    }
    return keys;
}

/** @typedef {{ uplift: number, uRate: number, gRate: number }} PivotItem */

function renderPivotInsights() {
    const container = document.getElementById('insights-container');
    if (!container) return;

    const keys = getInsightKeys();
    const onlyA11y = currentInsightsMode === 'a11y';

    /** @type {{ model: Record<string, PivotItem[]>, guide: Record<string, PivotItem[]> }} */
    const grouped = { model: {}, guide: {} };

    keys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo) return;

        /** @type {PivotItem | null} */
        let item = null;
        if (onlyA11y) {
            const a11y = testInfo.a11yStats;
            if (a11y && (a11y.guidedTotal > 0 || a11y.unguidedTotal > 0)) {
                item = { uplift: a11y.uplift, uRate: a11y.unguidedRate, gRate: a11y.guidedRate };
            }
        } else {
            const gRate = toRate(testInfo.guidedStats);
            const uRate = toRate(testInfo.unguidedStats);
            item = { uplift: gRate - uRate, uRate, gRate };
        }
        if (item) {
            (grouped.model[testInfo.model] ||= []).push(item);
        }

        const suiteGuides = testInfo.guides || {};
        Object.keys(suiteGuides).forEach(guide => {
            const gEntry = suiteGuides[guide];
            const src = onlyA11y ? gEntry.a11y : gEntry;
            if (!src) return;
            const { guidedRate = 0, unguidedRate = 0, uplift = 0 } = src;
            (grouped.guide[guide] ||= []).push({ uplift, uRate: unguidedRate, gRate: guidedRate });
        });
    });

    /** @param {PivotItem[]} arr */
    const getMedianItem = (arr) => {
        if (arr.length === 0) return { uRate: 0, gRate: 0, uplift: 0 };
        const sorted = [...arr].sort((a, b) => a.uplift - b.uplift);
        return sorted[Math.floor(sorted.length / 2)];
    };

    /** @param {number[]} vals */
    const calculateSD = (vals) => {
        if (vals.length <= 1) return 0;
        const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
        return Math.sqrt(variance);
    };

    /**
     * @param {Record<string, PivotItem[]>} groupObj
     * @param {'model' | 'guide'} filterKey
     */
    const renderPivotTable = (groupObj, filterKey) => {
        const keys = Object.keys(groupObj);
        if (keys.length === 0) {
            return '<p class="pivot-empty">No data for the current selection.</p>';
        }

        if (filterKey === 'guide') {
            keys.sort((a, b) => {
                const itemA = getMedianItem(groupObj[a]);
                const itemB = getMedianItem(groupObj[b]);
                /** @type {string | number} */
                let valA = 0;
                /** @type {string | number} */
                let valB = 0;
                switch (currentGuideSort) {
                    case 'alphabetic':
                        valA = a.toLowerCase();
                        valB = b.toLowerCase();
                        break;
                    case 'uplift':
                        valA = itemA.uplift;
                        valB = itemB.uplift;
                        break;
                    case 'unguided':
                        valA = itemA.uRate;
                        valB = itemB.uRate;
                        break;
                    case 'guided':
                        valA = itemA.gRate;
                        valB = itemB.gRate;
                        break;
                    case 'variance': {
                        valA = Math.max(calculateSD(groupObj[a].map(i => i.uRate)), calculateSD(groupObj[a].map(i => i.gRate)));
                        valB = Math.max(calculateSD(groupObj[b].map(i => i.uRate)), calculateSD(groupObj[b].map(i => i.gRate)));
                        break;
                    }
                    default: {
                        /** @type {never} */
                        const _exhaustive = currentGuideSort;
                        throw new Error(`Unhandled sort option: ${_exhaustive}`);
                    }
                }
                if (valA < valB) return currentGuideSortDir === 'asc' ? -1 : 1;
                if (valA > valB) return currentGuideSortDir === 'asc' ? 1 : -1;
                return 0;
            });
        } else {
            keys.sort((a, b) => a.localeCompare(b));
        }

        const showVariance = filterKey === 'guide';
        const metricName = onlyA11y ? 'Accessibility subscore' : 'Pass rate';
        const captionNoun = filterKey === 'guide' ? 'guide' : 'model';

        let rowsHtml = '';
        keys.forEach(key => {
            const items = groupObj[key];
            const medianItem = getMedianItem(items);
            const { uRate, gRate, uplift: medUplift } = medianItem;

            const uSD = showVariance ? calculateSD(items.map(i => i.uRate)) : 0;
            const gSD = showVariance ? calculateSD(items.map(i => i.gRate)) : 0;
            const uSD_left = Math.max(0, uRate - uSD);
            const uSD_width = Math.min(100, uRate + uSD) - uSD_left;
            const gSD_left = Math.max(0, gRate - gSD);
            const gSD_width = Math.min(100, gRate + gSD) - gSD_left;
            const uBandHtml = uSD > 0 ? `<div class="variance-band unguided" style="left: ${uSD_left}%; width: ${uSD_width}%;"></div>` : '';
            const gBandHtml = gSD > 0 ? `<div class="variance-band guided" style="left: ${gSD_left}%; width: ${gSD_width}%;"></div>` : '';

            const isActive = filterKey === 'model' && currentModelFilter === key;
            const nameHtml = filterKey === 'guide'
                ? `<a class="pivot-link" href="guide.html?guide=${encodeURIComponent(key)}">${escapeHtml(key)}</a>`
                : `<button type="button" class="pivot-filter-btn" data-filter-key="${filterKey}" data-filter-value="${escapeHtml(key)}" aria-pressed="${isActive}">${escapeHtml(key)}</button>`;

            const sign = medUplift > 0 ? '+' : '';
            rowsHtml += `
                <tr class="pivot-row${isActive ? ' active-filter' : ''}">
                    <th scope="row" class="pivot-name">
                        ${nameHtml}
                        <span class="pivot-trials">${items.length} ${items.length === 1 ? 'run' : 'runs'}</span>
                    </th>
                    <td class="insight-dumbbell-cell">
                        <div class="insight-dumbbell-track" aria-hidden="true">
                            ${uBandHtml}
                            ${gBandHtml}
                            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 1px); width: calc(${Math.abs(gRate - uRate)}% - 2px);"></div>
                            <div class="dot unguided" style="left: calc(${uRate}% - 4px);"></div>
                            <div class="dot guided" style="left: calc(${gRate}% - 4px);"></div>
                        </div>
                        <div class="rate-text">
                            <span class="visually-hidden">Median unguided </span>${uRate}%
                            <span class="rate-arrow" aria-hidden="true">→</span><span class="visually-hidden">, guided </span>${gRate}%
                            <span class="delta ${medUplift > 0 ? 'up' : (medUplift < 0 ? 'down' : 'flat')}">(${sign}${medUplift} pp)</span>
                        </div>
                    </td>
                </tr>
            `;
        });

        return `
            <table class="insights-table">
                <caption class="visually-hidden">Median ${metricName.toLowerCase()} by ${captionNoun}, unguided vs. guided${showVariance ? ' (bands show one standard deviation across runs)' : ''}</caption>
                <thead class="visually-hidden"><tr><th scope="col">${escapeHtml(captionNoun === 'guide' ? 'Guide' : 'Model')}</th><th scope="col">${escapeHtml(metricName)}</th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;
    };

    const sortOptions = [
        { value: 'alphabetic', label: 'Alphabetic' },
        { value: 'uplift', label: 'By uplift' },
        { value: 'unguided', label: 'Unguided rate' },
        { value: 'guided', label: 'Guided rate' },
        { value: 'variance', label: 'By variance' }
    ];
    const sortOptionsHtml = sortOptions.map(opt =>
        `<option value="${opt.value}" ${currentGuideSort === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
    const dirLabel = currentGuideSortDir === 'asc' ? 'ascending' : 'descending';
    const dirArrow = currentGuideSortDir === 'asc' ? '↑' : '↓';
    const modeSuffix = onlyA11y ? ' <span class="mode-badge-inline">Accessibility checks</span>' : '';
    const guideCount = Object.keys(grouped.guide).length;
    const runCount = keys.length;

    container.innerHTML = `
        <p class="insights-scope">Based on the ${runCount} run${runCount === 1 ? '' : 's'} shown in the table above${runCount > 0 ? ', medians across runs' : ''}.</p>
        <div class="insights-panel">
            <h3 class="insights-panel-title">By Model${modeSuffix}</h3>
            ${renderPivotTable(grouped.model, 'model')}
        </div>
        <div class="insights-panel insights-panel-full">
            <div class="insights-panel-header-row">
                <h3 class="insights-panel-title">By Guide (${guideCount})${modeSuffix}</h3>
                <div class="guide-sort-controls">
                    <label for="guide-sort-select" class="sort-label">Sort:</label>
                    <select id="guide-sort-select" class="sort-select">${sortOptionsHtml}</select>
                    <button id="guide-sort-dir-btn" class="sort-direction-btn" type="button" aria-label="Sort direction: ${dirLabel}. Toggle." aria-pressed="${currentGuideSortDir === 'desc'}">
                        <span aria-hidden="true">${dirArrow}</span>
                    </button>
                </div>
            </div>
            ${renderPivotTable(grouped.guide, 'guide')}
        </div>
    `;

    const sortSelect = document.getElementById('guide-sort-select');
    sortSelect?.addEventListener('change', (e) => {
        const target = e.target;
        if (target instanceof HTMLSelectElement) {
            currentGuideSort = /** @type {GuideSortKey} */ (target.value);
            renderPivotInsights();
        }
    });
    const sortDirBtn = document.getElementById('guide-sort-dir-btn');
    sortDirBtn?.addEventListener('click', () => {
        currentGuideSortDir = currentGuideSortDir === 'asc' ? 'desc' : 'asc';
        renderPivotInsights();
        document.getElementById('guide-sort-dir-btn')?.focus();
    });
}

/**
 * Toggles one of the header filters from a pivot row (click again to clear).
 * @param {'agent' | 'serving' | 'model'} filterKey
 * @param {string} value
 */
function setInsightFilter(filterKey, value) {
    const select = document.getElementById(`filter-${filterKey}`);
    if (select instanceof HTMLSelectElement) {
        select.value = select.value === value ? 'all' : value;
        select.dispatchEvent(new Event('change')); // Triggers table + pivot refresh
    }
}
