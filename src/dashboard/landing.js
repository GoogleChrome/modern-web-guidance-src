import {
    initGoogleAuth,
    getAccessToken,
    escapeHtml,
    timeAgo,
    formatDuration,
    formatTokens,
    getAgentBadge,
    getScrollBehavior,
    AGENT_DISPLAY_NAMES,
    parseSuiteDateInfo,
    formatSuiteDate,
    getSuiteDayKey,
    isPopoverOpen,
    setPopoverOpen,
    SUPPORTS_ANCHOR_POSITIONING,
    placePopoverFallback,
    median,
    renderEffortChip,
    setupEffortTooltip,
    getEffortLevel,
    getEffortTooltip,
    compareEffortLevels,
    pickHigherPrecedenceEffort,
} from './utils.js';
import { A11Y_SUBCATEGORIES } from './a11y-classifier.js';
import { extractSuiteSummary } from './summary-extractor.js';
import { updateHeroFromSuites } from './hero.js';
import { updateShowcaseFromSuites } from './showcase.js';
import { ApiClient, isAuthRejection } from './api.js';
import { isLocalServer, reloadAsRemote, resolveDataSource } from './data-source.js';

/**
 * @typedef {import('./insights.js').ManifestSuite & {
 *   source: import('./api.js').DataSource;
 *   timestamp: string;
 *   agent: string;
 *   model: string;
 * }} LandingSuiteSummary
 */

/** @typedef {'all' | import('./api.js').DataSource} SourceFilter */
/** @typedef {'alphabetic' | 'uplift' | 'unguided' | 'guided' | 'variance'} GuideSortKey */
/** @typedef {'asc' | 'desc'} SortDirection */
/** @typedef {'all' | 'a11y'} InsightsMode */
/** @typedef {'date' | 'uplift' | 'a11y' | 'time' | 'tokens'} SuiteSortKey */

/** @type {Record<string, LandingSuiteSummary>} */
let allTestData = {};
/** @type {Set<string>} */
let selectedTestIds = new Set();
/** @type {SourceFilter} */
let currentSourceFilter = 'all';
/** @type {string} */
let currentAgentFilter = 'all';
/** @type {string} */
let currentModelFilter = 'all';
/** @type {string} */
let currentEffortFilter = 'all';
/** @type {boolean} */
let splitModelByEffort = false;
/** @type {string} */
let currentSearchFilter = '';
/** @type {boolean} */
let scheduledOnly = true;
/** @type {'remote' | 'public' | null} */
let loadedManifestSource = null;
/** @type {SuiteSortKey} */
let currentSuiteSort = 'date';
/** @type {SortDirection} */
let currentSuiteSortDir = 'desc';

/** @type {Record<SuiteSortKey, SortDirection>} */
const DEFAULT_SORT_DIR = {
    date: 'desc',
    uplift: 'desc',
    a11y: 'desc',
    time: 'asc',
    tokens: 'asc'
};
/** @type {GuideSortKey} */
let currentGuideSort = 'alphabetic';
/** @type {SortDirection} */
let currentGuideSortDir = 'asc';
/** @type {InsightsMode} */
let currentInsightsMode = 'all';
const agentDisplayNames = AGENT_DISPLAY_NAMES;

/** @param {string} testId */
function isScheduledSuite(testId) { return /^(nightly|weekly)-/i.test(testId || ''); }
document.addEventListener('DOMContentLoaded', async () => {
    try {
        setupTestFilters();
        setupTableFilters();
        setupScheduledToggle();
        setupScrollRegion();
        setupSortButtons();
        setupInsightsControls();

        const params = new URLSearchParams(window.location.search);

        // A page that read the public copy reloads so every row comes from the bucket;
        // the dev server merges the bucket into its local results in place.
        initGoogleAuth(async () => {
            const source = resolveDataSource();
            if (source === 'remote' || source === 'public') {
                reloadAsRemote();
                return;
            }
            await loadManifestTests('remote');
        });

        if (resolveDataSource(params) === 'public') {
            await loadManifestTests('public');
        } else {
            await loadLocalTests();
            if (getAccessToken()) {
                await loadManifestTests('remote');
            }
        }

        selectedTestIds = new Set(Object.keys(allTestData));
        applyTestsParam(params.get('tests'));
        applySearchParam(params.get('q'));

        renderSuites();
        syncHero();
        applyGuidesHash(window.location.hash, true);
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
    applySearchParam(params.get('q'));
    renderSuites();
    applyGuidesHash(window.location.hash, false);
});

window.addEventListener('hashchange', () => { applyGuidesHash(window.location.hash, true); });
/** @param {string | null} testsParam */
function applyTestsParam(testsParam) {
    if (!testsParam || testsParam.trim() === '') return;
    const requestedIds = testsParam.split(',').filter(id => id.trim() !== '');
    const matchIds = new Set();
    requestedIds.forEach(req => {
        if (allTestData[req]) matchIds.add(req);
    });
    if (matchIds.size > 0) { selectedTestIds = matchIds; }
}

/** @param {string | null} qParam */
function applySearchParam(qParam) {
    currentSearchFilter = (qParam || '').trim().toLowerCase();
    const searchInput = document.getElementById('filter-search');
    if (searchInput instanceof HTMLInputElement) {
        searchInput.value = qParam ? qParam.trim() : '';
    }
}

function setupTestFilters() {
    const searchInput = document.getElementById('filter-search');
    if (!(searchInput instanceof HTMLInputElement)) return;
    searchInput.addEventListener('input', () => {
        currentSearchFilter = searchInput.value.trim().toLowerCase();
        showAllStacked = false;
        updateUrlParams();
        renderSuites();
    });
}

function setupTableFilters() {
    /** @type {Record<string, (val: string) => void>} */
    const filters = {
        'filter-source': (val) => currentSourceFilter = /** @type {SourceFilter} */ (val),
        'filter-agent': (val) => {
            currentAgentFilter = val;
            const mobileAgent = document.getElementById('mobile-filter-agent');
            if (mobileAgent instanceof HTMLSelectElement) { mobileAgent.value = val; syncSelectStyles(mobileAgent); }
        },
        'filter-model': (val) => {
            currentModelFilter = val;
            currentEffortFilter = 'all';
        }
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
    const mobileAgent = document.getElementById('mobile-filter-agent');
    if (mobileAgent instanceof HTMLSelectElement) {
        mobileAgent.addEventListener('change', () => {
            currentAgentFilter = mobileAgent.value;
            syncSelectStyles(mobileAgent);
            const desktopAgent = document.getElementById('filter-agent');
            if (desktopAgent instanceof HTMLSelectElement) { desktopAgent.value = mobileAgent.value; syncSelectStyles(desktopAgent); }
            renderSuites();
        });
    }
    const mobileSort = document.getElementById('mobile-sort-select');
    if (mobileSort instanceof HTMLSelectElement) {
        mobileSort.addEventListener('change', () => {
            const [sortKey, sortDir] = mobileSort.value.split(':');
            if (sortKey && (sortDir === 'asc' || sortDir === 'desc')) {
                currentSuiteSort = /** @type {SuiteSortKey} */ (sortKey);
                currentSuiteSortDir = sortDir;
                renderSuites();
            }
        });
    }
}

function setupScheduledToggle() {
    const check = document.getElementById('scheduled-only-check');
    if (!(check instanceof HTMLInputElement)) return;
    scheduledOnly = check.checked;
    check.addEventListener('change', () => { scheduledOnly = check.checked; renderSuites(); });
}
const STACKED_MAX_WIDTH = 640;
const STACKED_PAGE_SIZE = 10;
const DESKTOP_PAGE_SIZE = 9;
let isStacked = false;
let showAllStacked = false;

function setupScrollRegion() {
    const wrap = document.querySelector('.suites-table-container');
    if (!(wrap instanceof HTMLElement)) return;
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', 'All runs table (scrolls horizontally)');
    setupBarbellTooltip();
    if ('ResizeObserver' in window) {
        const ro = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width ?? wrap.clientWidth;
            const stacked = width < STACKED_MAX_WIDTH;
            if (stacked !== isStacked) { isStacked = stacked; renderSuites(); }
        });
        ro.observe(wrap);
        isStacked = wrap.clientWidth < STACKED_MAX_WIDTH;
    }
}
function setupSortButtons() {
    document.querySelectorAll('.suites-table thead .sort-btn').forEach(btn => {
        if (!(btn instanceof HTMLButtonElement)) return;
        const key = /** @type {SuiteSortKey | undefined} */ (btn.dataset.sort);
        if (!key) return;
        btn.addEventListener('click', () => {
            if (currentSuiteSort === key) { currentSuiteSortDir = currentSuiteSortDir === 'asc' ? 'desc' : 'asc'; } else { currentSuiteSort = key; currentSuiteSortDir = DEFAULT_SORT_DIR[key]; }
            renderSuites();
        });
    });
    syncSortHeaders();
}
function syncSortHeaders() {
    document.querySelectorAll('.suites-table thead th').forEach(th => {
        const btn = th.querySelector('.sort-btn');
        if (!(btn instanceof HTMLButtonElement)) return;
        if (btn.dataset.sort === currentSuiteSort) { th.setAttribute('aria-sort', currentSuiteSortDir === 'asc' ? 'ascending' : 'descending'); } else { th.removeAttribute('aria-sort'); }
    });
    const mobileSort = document.getElementById('mobile-sort-select');
    if (mobileSort instanceof HTMLSelectElement) {
        const targetVal = `${currentSuiteSort}:${currentSuiteSortDir}`;
        if (Array.from(mobileSort.options).some(o => o.value === targetVal)) { mobileSort.value = targetVal; }
    }
}
/** @param {InsightsMode} mode */
function syncInsightsModeButtons(mode) {
    const modeAllInput = document.querySelector('#insights-mode-all input[type="radio"]');
    const modeA11yInput = document.querySelector('#insights-mode-a11y input[type="radio"]');
    const isAll = mode === 'all';
    if (modeAllInput instanceof HTMLInputElement) modeAllInput.checked = isAll;
    if (modeA11yInput instanceof HTMLInputElement) modeA11yInput.checked = !isAll;
}
/** @param {InsightsMode} mode
 * @param {boolean} [scrollAndFocus=true] */
function openGuidesBreakdown(mode, scrollAndFocus = true) {
    const drawer = document.getElementById('breakdowns');
    currentInsightsMode = mode;
    syncInsightsModeButtons(mode);
    currentGuideSort = 'uplift';
    currentGuideSortDir = 'desc';
    if (drawer instanceof HTMLDetailsElement && !drawer.open) { drawer.open = true; }
    renderPivotInsights();
    if (scrollAndFocus && drawer instanceof HTMLElement) {
        const guideDrawer = drawer.querySelector('.insights-guide-drawer') || drawer;
        guideDrawer.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
        const heading = guideDrawer.querySelector('.insights-panel-title') || drawer.querySelector('.insights-summary');
        if (heading instanceof HTMLElement) {
            heading.focus({ preventScroll: true });
        }
    }
}
/** @param {string} hash
 * @param {boolean} scrollAndFocus */
function applyGuidesHash(hash, scrollAndFocus) {
    if (hash === '#a11y-guides') { openGuidesBreakdown('a11y', scrollAndFocus); } else if (hash === '#all-guides') { openGuidesBreakdown('all', scrollAndFocus); }
}
function setupInsightsControls() {
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const modeAllBtn = document.getElementById('insights-mode-all');
    if (limitInput instanceof HTMLInputElement) {
        limitInput.addEventListener('change', () => {
            let val = parseInt(limitInput.value);
            if (isNaN(val) || val < 1) val = 5;
            limitInput.value = val.toString();
            renderPivotInsights();
        });
        limitInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.isComposing || e.keyCode === 229) return;
                limitInput.blur();
            }
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
    const modeToggleGroup = modeAllBtn?.closest('.metric-mode-toggle');
    modeToggleGroup?.addEventListener('change', (e) => {
        const target = e.target;
        if (target instanceof HTMLInputElement && (target.value === 'all' || target.value === 'a11y')) { currentInsightsMode = target.value; renderPivotInsights(); }
    });
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const link = target.closest('a[data-open-guides]');
        if (!(link instanceof HTMLAnchorElement)) return;
        const mode = link.dataset.openGuides;
        if (mode === 'a11y' || mode === 'all') {
            e.preventDefault();
            const hash = mode === 'a11y' ? '#a11y-guides' : '#all-guides';
            window.history.replaceState({}, '', `${window.location.pathname}${window.location.search}${hash}`);
            openGuidesBreakdown(mode, true);
        }
    });
    const drawer = document.getElementById('breakdowns');
    if (drawer instanceof HTMLDetailsElement) {
        drawer.addEventListener('toggle', () => {
            if (drawer.open) { renderPivotInsights(); } else { hideBarbellTooltip(); }
        });
    }
    const container = document.getElementById('insights-container');
    container?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('button[data-filter-key]');
        if (btn instanceof HTMLButtonElement) {
            const key = btn.dataset.filterKey;
            const value = btn.dataset.filterValue;
            const effort = btn.dataset.filterEffort;
            if ((key === 'agent' || key === 'model') && value !== undefined) { setInsightFilter(key, value, effort); }
            return;
        }
        if (!target.closest('a, button')) {
            const row = target.closest('tr.pivot-row');
            const rowAction = row?.querySelector('a.pivot-link, button[data-filter-key]');
            if (rowAction instanceof HTMLElement) rowAction.click();
        }
    });
    setupBarbellTooltip();
    setupEffortTooltip();
    setupAnchorPositioningFallback();
}

/**
 * @param {any} el
 */
function syncSelectStyles(el) {
    el.classList.toggle('is-filtered', el.value !== 'all');
}

function updateUrlParams() {
    const url = new URL(window.location.href);
    const allIds = Object.keys(allTestData);
    if (selectedTestIds.size === allIds.length) {
        url.searchParams.delete('tests');
    } else {
        url.searchParams.set('tests', Array.from(selectedTestIds).join(','));
    }
    if (currentSearchFilter) {
        url.searchParams.set('q', currentSearchFilter);
    } else {
        url.searchParams.delete('q');
    }
    window.history.replaceState({}, '', url);
}


/** @param {string | null} message null hides the empty state. */
function setEmptyState(message) {
    const emptyState = document.getElementById('empty-state');
    if (!emptyState) return;
    emptyState.style.display = message ? 'block' : 'none';
    const p = emptyState.querySelector('p');
    if (p && message) p.textContent = message;
}

/**
 * Memoized by testId so overlapping syncHero() calls (e.g. local load, then remote load with a
 * cached token) share one request per suite instead of refetching every missing evals.json.
 * @type {Map<string, Promise<import('../harness/lib/metrics.ts').EvalsReport>>}
 */
const heroEvalsCache = new Map();

/** @param {string} testId */
function fetchEvalsForHero(testId) {
    let pending = heroEvalsCache.get(testId);
    if (!pending) {
        pending = fetchEvalsUncached(testId);
        // Drop failures so a later sync (e.g. after sign-in) can retry.
        pending.catch(() => heroEvalsCache.delete(testId));
        heroEvalsCache.set(testId, pending);
    }
    return pending;
}

/** @param {string} testId
 * @returns {Promise<import('../harness/lib/metrics.ts').EvalsReport>} */
async function fetchEvalsUncached(testId) {
    const match = Object.values(allTestData).find(s => s.testId === testId);
    if (match?.source === 'remote' || match?.source === 'public') {
        return new ApiClient(match.source).getEvals(testId);
    }
    const fetchPath = match?.source === 'static' ? `results/${testId}/evals.json` : `${testId}/evals.json?source=local`;
    const res = await fetch(`${fetchPath}${fetchPath.includes('?') ? '&' : '?'}t=${Date.now()}`);
    if (!res.ok) throw new Error(`Failed to fetch local evals for ${testId}`);
    return res.json();
}

/**
 * The data source this page actually loaded from, for the hero and for links to
 * other pages. Usually `resolveDataSource()`, except after a 403 sent a signed-in
 * visitor to the public copy: links must then say `source=public` or the suite
 * page would try the bucket again and bounce back here.
 * @returns {import('./api.js').DataSource}
 */
function activeDataSource() {
    const resolved = resolveDataSource();
    return resolved === 'remote' && loadedManifestSource ? loadedManifestSource : resolved;
}

function syncHero() {
    const suites = Object.values(allTestData);
    const source = activeDataSource();
    updateShowcaseFromSuites(suites, { source });
    updateHeroFromSuites(suites, {
        source,
        fetchEvals: fetchEvalsForHero,
        onHydrated: () => {
            updateShowcaseFromSuites(suites, { hydrated: true, source });
            refreshFilterOptions();
            renderSuites();
            const drawer = document.getElementById('breakdowns');
            if (drawer instanceof HTMLDetailsElement && drawer.open) { renderPivotInsights(); }
        }
    });
}

async function loadLocalTests() {
    if (!isLocalServer()) return;

    try {
        let response = await fetch(`/api/suites?t=${Date.now()}`);
        let manifest;
        let useResultsPrefix = false;

        if (!response.ok) {
            // Try fetching suites.gen.json as fallback for static mode
            const staticRes = await fetch(`/suites.gen.json?t=${Date.now()}`);
            if (!staticRes.ok) return; // Silent fail if both fail
            const suitesData = await staticRes.json();
            if (Array.isArray(suitesData)) {
                manifest = { suites: suitesData };
            } else {
                manifest = suitesData;
            }
            useResultsPrefix = true;
        } else {
            manifest = await response.json();
        }

        if (manifest.suites && manifest.suites.length > 0) {
            setEmptyState(null);
        }

        // Load local test data
        const sourceName = useResultsPrefix ? 'static' : 'local';
        for (const suite of manifest.suites) {
            if (typeof suite === 'object' && suite.testId && suite.guidedStats) {
                registerSuiteSummary(suite, sourceName, { refreshFilters: false });
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
        refreshFilterOptions();
    } catch {
        console.warn('Local proxy not available');
    }
}

/** @param {'remote' | 'public'} source */
async function loadManifestTests(source) {
    loadedManifestSource = source;
    try {
        const manifest = await new ApiClient(source).getSuitesManifest();
        if (manifest.length > 0) {
            setEmptyState(null);
            for (const item of manifest) {
                if (item && item.testId) {
                    registerSuiteSummary(item, source, { refreshFilters: false });
                }
            }
            refreshFilterOptions();
        }

        // Re-render UI now that we have manifest data
        const params = new URLSearchParams(window.location.search);
        let initialTests = params.get('tests');
        if (!initialTests || initialTests.trim() === '') {
            selectedTestIds = new Set(Object.keys(allTestData));
        } else {
            applyTestsParam(initialTests);
        }
        applySearchParam(params.get('q'));
        renderSuites();
        syncHero();

    } catch (error) {
        console.error(`Error loading ${source} suites:`, error);
        // The bucket rejected the token; show the public copy rather than nothing. Not on the
        // dev server's local view, where the bucket is merely merged in: a stale token there
        // must not mix out/public-evals/ into local results. (Checked by mode rather than
        // `=== 'remote'` because a 401 has already cleared the token by this point.)
        if (source === 'remote' && resolveDataSource() !== 'local' && isAuthRejection(error)) {
            await loadManifestTests('public');
        }
    }
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
        registerSuiteSummary(summary, source);
    }
}

/**
 * @param {import('./insights.js').ManifestSuite} summary
 * @param {import('./api.js').DataSource} source
 * @param {{ refreshFilters?: boolean }} [options] Pass `refreshFilters: false` when registering
 *     in a batch, then call `refreshFilterOptions()` once afterward.
 */
function registerSuiteSummary(summary, source, { refreshFilters = true } = {}) {
    const compoundKey = `${summary.testId}|||${source}`;
    allTestData[compoundKey] = {
        ...summary,
        source,
        timestamp: summary.timestamp || '',
        agent: summary.agent || 'unknown',
        model: summary.model || 'unknown'
    };
    if (refreshFilters) refreshFilterOptions();
}
function refreshFilterOptions() {
    updateFilterOptions('filter-model-group', 'model');
    updateFilterOptions('filter-agent-group', 'agent', agentDisplayNames);
    updateFilterOptions('mobile-filter-agent-group', 'agent', agentDisplayNames);
    updateSourceFilterOptions();
    updateRunsFilterDatalist();
}

function updateRunsFilterDatalist() {
    const datalist = document.getElementById('runs-filter-datalist');
    if (!datalist) return;
    /** @type {Map<string, { count: number, label: string }>} */
    const suggestions = new Map();
    /** @type {Map<string, number>} */
    const effortCounts = new Map();
    for (const t of Object.values(allTestData)) {
        if (t.model && t.model !== 'unknown') {
            const prev = suggestions.get(t.model);
            suggestions.set(t.model, { count: (prev?.count || 0) + 1, label: '' });
        }
        if (t.agent && t.agent !== 'unknown') {
            const prev = suggestions.get(t.agent);
            const display = agentDisplayNames[t.agent] || t.agent;
            suggestions.set(t.agent, { count: (prev?.count || 0) + 1, label: display !== t.agent ? display : '' });
        }
        const effortLevel = getEffortLevel(t.reasoningEffort);
        effortCounts.set(effortLevel, (effortCounts.get(effortLevel) || 0) + 1);
    }
    for (const [level, count] of effortCounts.entries()) {
        const desc = level === 'default'
            ? 'Reasoning effort: default (CLI built-in default)'
            : `Reasoning effort: ${level}`;
        suggestions.set(`effort:${level}`, { count, label: desc });
    }
    datalist.innerHTML = Array.from(suggestions.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([val, { count, label }]) => {
            const countText = `${count} ${count === 1 ? 'run' : 'runs'}`;
            const optionLabel = label ? `${label} · ${countText}` : countText;
            return `<option value="${escapeHtml(val)}" label="${escapeHtml(optionLabel)}"></option>`;
        })
        .join('');
}

function updateSourceFilterOptions() {
    const group = document.querySelector('#filter-source optgroup');
    if (!group) return;
    const sourceLabels = { local: 'Local', remote: 'Remote', static: 'Static', public: 'Public' };
    const values = /** @type {Array<import('./data-source.js').DataSource>} */ (
        [...new Set(Object.values(allTestData).map(t => t.source).filter(Boolean))].sort()
    );
    if (values.length === 0) return;
    const currentOptions = Array.from(group.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(values)) return;
    group.innerHTML = values.map(val =>
        `<option value="${escapeHtml(val)}">${escapeHtml(sourceLabels[val] || val)}</option>`
    ).join('');
}

/**
 * Rebuilds a header <select>'s option group from the distinct values seen so far.
 * @param {string} groupId
 * @param {'agent' | 'model'} key
 * @param {Record<string, string>} [displayNames]
 */
function updateFilterOptions(groupId, key, displayNames = {}) {
    const group = document.getElementById(groupId);
    if (!group) return;

    const values = /** @type {string[]} */ ([...new Set(Object.values(allTestData).map(t => t[key]).filter(Boolean))]).sort();
    const currentOptions = Array.from(group.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(values)) return;

    group.innerHTML = values.map(val =>
        `<option value="${escapeHtml(val)}">${escapeHtml(displayNames[val] || val)}</option>`
    ).join('');
}


/** @param {LandingSuiteSummary} testInfo
 * @returns {import('./utils.js').SuiteDateInfo} */
function getSuiteDateInfo(testInfo) { return parseSuiteDateInfo(testInfo.timestamp, testInfo.testId) || { date: new Date(0), dateOnly: false }; }
/** @param {LandingSuiteSummary} testInfo
 * @returns {Date} */
function getSuiteDate(testInfo) { return getSuiteDateInfo(testInfo).date; }

/** @param {{ passed: number, total: number } | undefined} stats */
function toRateExact(stats) { return stats && stats.total > 0 ? (stats.passed / stats.total) * 100 : 0; }

/** @param {{ passed: number, total: number } | undefined} stats */
function toRate(stats) {
    return Math.round(toRateExact(stats));
}

/** @param {{ passed: number, total: number } | undefined} uStats
 * @param {{ passed: number, total: number } | undefined} gStats */
function upliftPp(uStats, gStats) { return hasBothSides(uStats, gStats) ? Math.round(toRateExact(gStats) - toRateExact(uStats)) : null; }
/** A side with no checks has no rate, so uplift against it would be fabricated.
 * @param {{ passed: number, total: number } | undefined} uStats
 * @param {{ passed: number, total: number } | undefined} gStats */
function hasBothSides(uStats, gStats) { return (uStats?.total || 0) > 0 && (gStats?.total || 0) > 0; }
/** @param {{ passed: number, total: number } | undefined} stats */
function rateOrNull(stats) { return (stats?.total || 0) > 0 ? toRate(stats) : null; }
/** @param {import('./summary-extractor.js').SuiteA11yStats | undefined} a11y
 * @returns {{ u: { passed: number, total: number }, g: { passed: number, total: number } } | null} */
function a11yPair(a11y) {
    if (!a11y || !(a11y.guidedTotal > 0 || a11y.unguidedTotal > 0)) return null;
    return {
        u: { passed: a11y.unguidedPassed, total: a11y.unguidedTotal },
        g: { passed: a11y.guidedPassed, total: a11y.guidedTotal }
    };
}

/**
 * Extracts `effort:<level>` filter tokens (case-insensitive) and remaining free-text query.
 * @param {string} query
 * @returns {{ effortLevels: string[], textQuery: string }}
 */
function parseSearchQuery(query) {
    if (!query) return { effortLevels: [], textQuery: '' };
    /** @type {string[]} */
    const effortLevels = [];
    /** @type {string[]} */
    const textParts = [];
    for (const token of query.trim().split(/\s+/)) {
        if (!token) continue;
        const m = token.match(/^effort:(.*)$/i);
        if (m) {
            const lvl = m[1].trim().toLowerCase();
            if (lvl) effortLevels.push(lvl);
        } else {
            textParts.push(token.toLowerCase());
        }
    }
    return { effortLevels, textQuery: textParts.join(' ') };
}

/**
 * @param {{ ignoreModelFilter?: boolean }} [options]
 * @returns {string[]}
 */
function getFilteredKeys({ ignoreModelFilter = false } = {}) {
    const { effortLevels, textQuery } = parseSearchQuery(currentSearchFilter);
    return Array.from(selectedTestIds).filter(compoundKey => {
        const t = allTestData[compoundKey];
        if (!t) return false;
        if (currentSourceFilter !== 'all' && t.source !== currentSourceFilter) return false;
        if (currentAgentFilter !== 'all' && t.agent !== currentAgentFilter) return false;
        if (!ignoreModelFilter) {
            if (currentModelFilter !== 'all' && t.model !== currentModelFilter) return false;
            if (currentEffortFilter !== 'all' && getEffortLevel(t.reasoningEffort) !== currentEffortFilter) return false;
        }
        if (effortLevels.length > 0) {
            const suiteEffort = getEffortLevel(t.reasoningEffort);
            if (!effortLevels.includes(suiteEffort)) return false;
        }
        if (textQuery) {
            const { label, ldap } = formatSuiteLabel(t);
            const agentDisplay = agentDisplayNames[t.agent] || t.agent || '';
            const haystack = `${t.testId || ''} ${t.model || ''} ${t.agent || ''} ${agentDisplay} ${label} ${ldap}`.toLowerCase();
            if (!haystack.includes(textQuery)) return false;
        }
        return true;
    });
}

/** @returns {string[]} */
function getVisibleKeys() {
    const filtered = getFilteredKeys();
    const anyScheduled = filtered.some(k => isScheduledSuite(allTestData[k].testId));
    const keys = (scheduledOnly && !currentSearchFilter && anyScheduled)
        ? filtered.filter(k => isScheduledSuite(allTestData[k].testId))
        : filtered;
    return sortSuiteKeys(keys);
}

/** @param {LandingSuiteSummary} t
 * @param {SuiteSortKey} key
 * @returns {number | null} */
function getSortValue(t, key) {
    switch (key) {
        case 'date':
            return getSuiteDate(t).getTime();
        case 'uplift':
            return hasBothSides(t.unguidedStats, t.guidedStats) ? toRateExact(t.guidedStats) - toRateExact(t.unguidedStats) : null;
        case 'a11y': { const pair = a11yPair(t.a11yStats); return pair && hasBothSides(pair.u, pair.g) ? toRateExact(pair.g) - toRateExact(pair.u) : null; }
        case 'time': { const rt = t.efficiencyStats?.runtime; return rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0) ? rt.medianDeltaPct : null; }
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
/** @param {string[]} keys */
function sortSuiteKeys(keys) {
    const dir = currentSuiteSortDir === 'asc' ? 1 : -1;
    return keys
        .map((k, i) => ({ k, i, v: getSortValue(allTestData[k], currentSuiteSort), d: getSuiteDate(allTestData[k]).getTime() }))
        .sort((a, b) => {
            if (a.v === null && b.v === null) return b.d - a.d || a.i - b.i;
            if (a.v === null) return 1;
            if (b.v === null) return -1;
            if (a.v !== b.v) return (a.v - b.v) * dir;
            return b.d - a.d || a.i - b.i;
        })
        .map(x => x.k);
}

// ==========================================
// RENDERERS
// ==========================================

/** @param {number | null} uRate rounded unguided rate, or null when no unguided checks ran
 * @param {number | null} gRate rounded guided rate, or null when no guided checks ran
 * @param {number | null} delta percentage-point change, computed from unrounded rates; null unless both sides ran
 * @param {string} label used for the screen-reader sentence
 * @param {number} [uErr=0]
 * @param {number} [gErr=0] */
function renderRateComparison(uRate, gRate, delta, label, uErr = 0, gErr = 0) {
    const fmtRate = (/** @type {number | null} */ r) => r === null ? '—' : `${r}%`;
    const deltaHtml = delta === null
        ? '<span class="delta flat">(—)<span class="visually-hidden"> change not available</span></span>'
        : `<span class="${delta > 0 ? 'delta up' : (delta < 0 ? 'delta down' : 'delta flat')}">(${delta > 0 ? '+' : ''}${delta} pp)</span>`;
    const regressedCls = uRate !== null && gRate !== null && gRate < uRate ? ' regressed' : '';
    const uErrBand = uRate !== null && uErr > 0 ? `<div class="variance-band unguided" style="left: ${(uRate * (1 - uErr / 100)).toFixed(1)}%; width: ${uErr}%;"></div>` : '';
    const gErrBand = gRate !== null && gErr > 0 ? `<div class="variance-band guided has-err" style="left: ${(gRate * (1 - gErr / 100)).toFixed(1)}%; width: ${gErr}%;"></div>` : '';
    const connector = uRate !== null && gRate !== null ? `<div class="connector${regressedCls}" style="left: ${Math.min(uRate, gRate)}%; width: ${Math.abs(gRate - uRate)}%;"></div>` : '';
    const uDot = uRate !== null ? `<div class="dot unguided" style="left: ${uRate}%;"></div>` : '';
    const gDot = gRate !== null ? `<div class="dot guided" style="left: ${gRate}%;"></div>` : '';
    return `<div class="suite-dumbbell-track" aria-hidden="true"> ${uErrBand} ${gErrBand} ${connector} ${uDot} ${gDot} </div> <div class="rate-text"> <span class="visually-hidden">${escapeHtml(label)}: unguided </span><span class="rate-u">${fmtRate(uRate)}</span> <span class="rate-arrow" aria-hidden="true">→</span><span class="visually-hidden">, guided </span> <span class="rate-g">${fmtRate(gRate)}</span> ${deltaHtml} </div>`;
}
/** @param {number} deltaPct
 * @param {{ less: string, more: string, noun: string }} words */
function renderDeltaPill(deltaPct, words) {
    if (deltaPct < 0) {
        return `<span class="eff-pill metric-delta positive" title="${Math.abs(deltaPct)}% ${escapeHtml(words.less)}"><span aria-hidden="true">▼ </span>${Math.abs(deltaPct)}%<span class="visually-hidden"> ${escapeHtml(words.less)} (${escapeHtml(words.noun)})</span></span>`;
    }
    if (deltaPct === 0) {
        return `<span class="eff-pill metric-delta neutral" title="No change (${escapeHtml(words.noun)})">±0%<span class="visually-hidden"> ${escapeHtml(words.noun)}, no change</span></span>`;
    }
    return `<span class="eff-pill metric-delta muted" title="${deltaPct}% ${escapeHtml(words.more)}"><span aria-hidden="true">▲ </span>${deltaPct}%<span class="visually-hidden"> ${escapeHtml(words.more)} (${escapeHtml(words.noun)})</span></span>`;
}
/** @param {string} what */
function renderNotAvailable(what) {
    return `<span class="not-available" aria-hidden="true">—</span><span class="visually-hidden">${escapeHtml(what)} not available</span>`;
}
function renderSuites() {
    const container = document.getElementById('suites-list');
    if (!container) return;
    syncSortHeaders();
    const filteredKeys = getFilteredKeys();
    const visibleKeys = getVisibleKeys();
    const anyScheduled = filteredKeys.some(k => isScheduledSuite(allTestData[k].testId));
    const scheduledCheck = document.getElementById('scheduled-only-check');
    if (scheduledCheck instanceof HTMLInputElement) {
        scheduledCheck.checked = scheduledOnly && !currentSearchFilter && anyScheduled;
        scheduledCheck.disabled = Boolean(currentSearchFilter) || !anyScheduled;
    }
    const hiddenAdHoc = filteredKeys.length - visibleKeys.length;
    const colCount = 8;
    const table = document.querySelector('.suites-table');
    const pageSize = isStacked ? STACKED_PAGE_SIZE : DESKTOP_PAGE_SIZE;
    const paged = !showAllStacked && visibleKeys.length > pageSize;
    table?.classList.toggle('paged', paged && isStacked);
    table?.classList.toggle('paged-desktop', paged && !isStacked);
    renderSuitesCount(visibleKeys.length, filteredKeys.length, hiddenAdHoc, paged, pageSize);
    syncOptionalColumns();
    if (activeBarbellAnchor && container.contains(activeBarbellAnchor)) {
        hideBarbellTooltip();
    }

    if (visibleKeys.length === 0) {
        const anyData = Object.keys(allTestData).length > 0;
        container.innerHTML = `<tr class="suites-empty-row"> <td colspan="${colCount}">${anyData ? 'No runs match the current filters.' : 'Loading runs…'}</td> </tr>`;
        return;
    }

    let html = '';
    visibleKeys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        const testId = testInfo.testId;
        const dateInfo = getSuiteDateInfo(testInfo);
        const date = dateInfo.date;

        const gRate = rateOrNull(testInfo.guidedStats);
        const uRate = rateOrNull(testInfo.unguidedStats);
        const overallPp = upliftPp(testInfo.unguidedStats, testInfo.guidedStats);

        const a11y = a11yPair(testInfo.a11yStats);

        const rt = testInfo.efficiencyStats?.runtime;
        const hasRuntime = Boolean(rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0));

        const tok = testInfo.efficiencyStats?.tokens;
        const hasTokens = Boolean(tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0));

        const localLink = `dashboard.html?testId=${encodeURIComponent(testId)}&source=${encodeURIComponent(testInfo.source)}`;
        const a11yLink = `dashboard.html?testId=${encodeURIComponent(testId)}&source=${encodeURIComponent(testInfo.source)}&mode=a11y&sort=a11y-desc`;
        const taskCount = testInfo.taskCount || 0;
        const maxRuns = testInfo.maxRuns || 1;
        const earlyFailureRate = testInfo.earlyFailureRate || 0;
        const unguidedLeakRate = testInfo.unguidedLeakRate || 0;
        const uErr = testInfo.unguidedErrorRate ?? earlyFailureRate;
        const gErr = testInfo.guidedErrorRate ?? earlyFailureRate;
        const isFaulty = earlyFailureRate === 100;
        const scheduled = isScheduledSuite(testId);
        const { label, ldap } = formatSuiteLabel(testInfo);
        const agentDisplay = agentDisplayNames[testInfo.agent] || testInfo.agent;
        const dateDisplay = formatSuiteDate(dateInfo, { month: 'short', day: 'numeric', year: 'numeric' });
        const suiteBarbellTitle = scheduled
            ? `${dateDisplay} · ${agentDisplay}`
            : `${label || testId}${testInfo.agent && testInfo.agent !== 'unknown' ? ` · ${agentDisplay}` : ''}`;
        const modelPart = testInfo.model && testInfo.model !== 'unknown' ? testInfo.model : '';
        const overallScope = taskCount > 0 ? `${taskCount} ${taskCount === 1 ? 'task' : 'tasks'}${maxRuns > 1 ? ` ×${maxRuns}` : ''}` : 'single run';
        const overallSub = ['Pass rate', modelPart, overallScope].filter(Boolean).join(' · ');
        const uTotal = testInfo.unguidedStats?.total || 0;
        const gTotal = testInfo.guidedStats?.total || 0;
        const uDetail = uTotal > 0 ? `${(testInfo.unguidedStats?.passed || 0).toLocaleString('en-US')}/${uTotal.toLocaleString('en-US')} checks` : '';
        const gDetail = gTotal > 0 ? `${(testInfo.guidedStats?.passed || 0).toLocaleString('en-US')}/${gTotal.toLocaleString('en-US')} checks` : '';
        const overallErrAttr = uErr > 0 || gErr > 0 ? '1' : '';
        let a11yCellAttrs = '';
        let a11yCellHtml = '';
        if (a11y) {
            const a11yURate = rateOrNull(a11y.u);
            const a11yGRate = rateOrNull(a11y.g);
            const a11yPp = upliftPp(a11y.u, a11y.g);
            const a11yGuideCount = testInfo.a11yStats?.guideCount || 0;
            const a11yScope = a11yGuideCount > 0
                ? `${a11yGuideCount} ${a11yGuideCount === 1 ? 'guide' : 'guides'}`
                : overallScope;
            const a11ySub = ['Accessibility subscore', modelPart, a11yScope].filter(Boolean).join(' · ');
            const a11yUDetail = a11y.u.total > 0 ? `${a11y.u.passed.toLocaleString('en-US')}/${a11y.u.total.toLocaleString('en-US')} checks` : '';
            const a11yGDetail = a11y.g.total > 0 ? `${a11y.g.passed.toLocaleString('en-US')}/${a11y.g.total.toLocaleString('en-US')} checks` : '';
            a11yCellAttrs = ` data-barbell-title="${escapeHtml(suiteBarbellTitle)}" data-barbell-sub="${escapeHtml(a11ySub)}" data-barbell-kind="suite-a11y" data-barbell-u="${a11yURate ?? ''}" data-barbell-g="${a11yGRate ?? ''}" data-barbell-uplift="${a11yPp ?? ''}" data-barbell-u-detail="${escapeHtml(a11yUDetail)}" data-barbell-g-detail="${escapeHtml(a11yGDetail)}"`;
            a11yCellHtml = ` <a href="${a11yLink}" class="a11y-link" interestfor="barbell-tooltip"> ${renderRateComparison(a11yURate, a11yGRate, a11yPp, 'Accessibility subscore')} <span class="visually-hidden"> (open accessibility check results)</span> </a> `;
        } else { a11yCellHtml = renderNotAvailable('Accessibility subscore'); }

        const timeCellHtml = hasRuntime && rt
            ? `<div class="eff-cell-main"><div class="task-metric-stack"><span class="metric-before"><span class="visually-hidden">Median duration: unguided </span>${formatDuration(rt.unguidedMedianMs)}</span><span class="metric-after"><span class="visually-hidden">, guided </span>${formatDuration(rt.guidedMedianMs)}</span></div>${renderDeltaPill(rt.medianDeltaPct, { less: 'faster', more: 'slower', noun: 'median duration' })}</div>`
            : renderNotAvailable('Median duration');
        const tokenCellHtml = hasTokens && tok
            ? `<div class="eff-cell-main"><div class="task-metric-stack"><span class="metric-before"><span class="visually-hidden">Median uncached tokens: unguided </span>${formatTokens(tok.unguidedUncachedMedian)}</span><span class="metric-after"><span class="visually-hidden">, guided </span>${formatTokens(tok.guidedUncachedMedian)}</span></div>${renderDeltaPill(tok.uncachedMedianDeltaPct, { less: 'fewer', more: 'more', noun: 'uncached tokens' })}</div>`
            : renderNotAvailable('Median uncached tokens');

        const badges = [!scheduled ? '<span class="run-kind-badge">ad hoc</span>' : '', isFaulty ? '<span class="run-kind-badge faulty">all runs failed</span>' : ''].join('');
        const adhocLabelHtml = !scheduled && label ? `<span class="suite-adhoc-name">${escapeHtml(label)}</span>` : '';

        const metaParts = [
            taskCount > 0 ? `<span class="nowrap">${taskCount} tasks${maxRuns > 1 ? ` ×${maxRuns}` : ''}${earlyFailureRate > 0 ? ` (${earlyFailureRate}% err)` : ''}${unguidedLeakRate > 0 ? ` (${unguidedLeakRate}% leak)` : ''}</span>` : '',
            `<span class="nowrap">${escapeHtml(timeAgo(date))}</span>`,
            ldap ? `<span class="nowrap">${escapeHtml(ldap)}</span>` : ''
        ].filter(Boolean).join(' · ');

        html += `
            <tr class="suite-table-row${isFaulty ? ' faulty' : ''}${scheduled ? '' : ' adhoc'}" data-test-id="${escapeHtml(testId)}">
                <th scope="row" class="suite-cell">
                    <a href="${localLink}" class="suite-link">
                        <span class="suite-title-row"><time class="suite-label" datetime="${date.toISOString()}">${escapeHtml(dateDisplay)}</time>${badges}</span>
                        ${adhocLabelHtml}
                        <span class="suite-meta">${metaParts}</span>
                    </a>
                </th>
                <td class="agent-cell" data-agent="${escapeHtml(testInfo.agent)}"><span>${getAgentBadge(testInfo.agent)}${escapeHtml(agentDisplay)}</span></td>
                <td class="model-cell"><span class="model-cell-inner">${escapeHtml(testInfo.model || '')}${testInfo.model ? renderEffortChip(testInfo.reasoningEffort, { sharedTooltipId: 'effort-tooltip' }) : ''}</span></td>
                <td class="uplift-cell metric-cell" data-compound-key="${escapeHtml(compoundKey)}" data-barbell-title="${escapeHtml(suiteBarbellTitle)}" data-barbell-sub="${escapeHtml(overallSub)}" data-barbell-kind="suite-overall" data-barbell-u="${uRate ?? ''}" data-barbell-g="${gRate ?? ''}" data-barbell-uplift="${overallPp ?? ''}" data-barbell-u-detail="${escapeHtml(uDetail)}" data-barbell-g-detail="${escapeHtml(gDetail)}" data-barbell-err="${overallErrAttr}">
                    <a href="${localLink}" class="uplift-link" interestfor="barbell-tooltip">
                        ${renderRateComparison(uRate, gRate, overallPp, 'Pass rate', uErr, gErr)}
                        <span class="visually-hidden"> (open per-guide results)</span>
                    </a>
                </td>
                <td class="a11y-cell metric-cell"${a11yCellAttrs}>${a11yCellHtml}</td>
                <td class="metric-cell">${timeCellHtml}</td>
                <td class="metric-cell tokens-cell">${tokenCellHtml}</td>
                <td class="source-cell">${escapeHtml(testInfo.source)}</td>
            </tr>
        `;
    });

    container.innerHTML = html;

    const drawer = document.getElementById('breakdowns');
    if (!(drawer instanceof HTMLDetailsElement) || drawer.open) { renderPivotInsights(); }
}

/**
 * Columns whose value is identical for every loaded run carry no information, so
 * hide them (Source) to keep the table within the page width. Cells stay
 * in the DOM so the stacked-layout labels (nth-child) keep lining up.
 */
function syncOptionalColumns() {
    const table = document.querySelector('.suites-table');
    if (!table) return;
    const all = Object.values(allTestData);
    const sources = new Set(all.map(t => t.source));
    table.classList.toggle('hide-source', !isLocalServer() || (sources.size <= 1 && currentSourceFilter === 'all'));
}

/**
 * @param {number} shown
 * @param {number} matching
 * @param {number} hiddenAdHoc
 * @param {boolean} paged
 * @param {number} pageSize
 */
function renderSuitesCount(shown, matching, hiddenAdHoc, paged, pageSize = DESKTOP_PAGE_SIZE) {
    const el = document.getElementById('suites-count');
    if (!el) return;
    const total = Object.keys(allTestData).length;
    el.innerHTML = '';
    if (total === 0) return;
    const visibleNow = paged ? Math.min(pageSize, shown) : shown;
    const parts = [`Showing ${visibleNow} of ${total} run${total === 1 ? '' : 's'}`];
    if (hiddenAdHoc > 0) {
        parts.push(`${hiddenAdHoc} ad-hoc run${hiddenAdHoc === 1 ? '' : 's'} hidden by "Scheduled runs only"`);
    } else if (matching < total) {
        parts.push(`${total - matching} filtered out`);
    }
    el.append(document.createTextNode(parts.join(' · ')));
    if (paged) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'text-btn show-all-rows-btn';
        btn.textContent = `Show all ${shown} runs`;
        btn.addEventListener('click', () => {
            showAllStacked = true;
            renderSuites();
            const rows = document.querySelectorAll('#suites-list .suite-table-row');
            const next = rows[pageSize]?.querySelector('a');
            if (next instanceof HTMLElement) next.focus();
        });
        el.append(document.createTextNode(' · '), btn);
    }
}

// ==========================================
// HELPERS
// ==========================================

/**
 * Splits "nightly-2026-10-09_07-00-02-antigravity_cli" into a short label plus
 * any trailing owner tag, dropping the agent tokens that other columns show.
 * @param {LandingSuiteSummary} testInfo
 * @returns {{ label: string, ldap: string }}
 */
function formatSuiteLabel(testInfo) {
    const { testId, agent } = testInfo;
    if (!testId) return { label: 'evaluation-run', ldap: '' };

    const timeRegex = /[-_]?\b\d{4}-\d{2}-\d{2}(?:[T_]\d{2}-\d{2}-\d{2})?\b[-_]?/;
    const parts = testId.split(timeRegex);
    let prefix = (parts[0] || '').replace(/^[-_]+|[-_]+$/g, '');
    let suffix = (parts[1] || '').replace(/^[-_]+|[-_]+$/g, '');
    const label = prefix || 'evaluation-run';
    if (!suffix) return { label, ldap: '' };
    const normalize = (/** @type {string} */ s) => (s || '').toLowerCase().replace(/[-_]+/g, '');
    const normAgent = normalize(agent);
    /** @type {string[]} */
    const otherTags = [];
    suffix.split('-').forEach(part => {
        const normPart = normalize(part);
        if (normPart === normAgent) return;
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
 * Explicit anchor shared by the active barbell trigger and `#barbell-tooltip` (landing.css).
 * Explicit rather than the implicit interestfor anchor because the vendored interestfor
 * polyfill and the anchor-positioning polyfill can't rely on implicit anchors.
 */
const BARBELL_ANCHOR = '--barbell-anchor';
/** @type {HTMLElement | null} */
let activeBarbellAnchor = null;
let barbellTooltipBound = false;
function setupBarbellTooltip() {
    const tooltip = document.getElementById('barbell-tooltip');
    if (!tooltip || barbellTooltipBound) return;
    barbellTooltipBound = true;
    tooltip.addEventListener('interest', (e) => {
        const source = /** @type {Event & { source?: Element | null }} */ (e).source;
        if (!(source instanceof HTMLElement)) return;
        const cell = getBarbellDataCell(source);
        if (!cell) return;
        tooltip.innerHTML = renderBarbellTooltipContent(cell);
        setBarbellAnchor(source);
        if (!SUPPORTS_ANCHOR_POSITIONING && isPopoverOpen(tooltip) && activeBarbellAnchor) placePopoverFallback(tooltip, activeBarbellAnchor, { align: 'center', fallbackHeight: 175 });
    });
    tooltip.addEventListener('toggle', (e) => {
        if (/** @type {ToggleEvent} */ (e).newState === 'open') { if (!SUPPORTS_ANCHOR_POSITIONING && activeBarbellAnchor) placePopoverFallback(tooltip, activeBarbellAnchor, { align: 'center', fallbackHeight: 175 }); } else { setBarbellAnchor(null); }
    });
}
function setupAnchorPositioningFallback() {
    if (SUPPORTS_ANCHOR_POSITIONING) return;
    document.addEventListener('toggle', (e) => {
        const hint = e.target;
        if (!(hint instanceof HTMLElement) || !hint.classList.contains('hint-popover') || hint.id === 'effort-tooltip') return;
        if (/** @type {ToggleEvent} */ (e).newState !== 'open') return;
        const trigger = document.querySelector(`[interestfor="${CSS.escape(hint.id)}"]`);
        if (trigger) placePopoverFallback(hint, trigger, { align: (hint.id.startsWith('hint-sort-uplift-') || hint.id === 'hint-split-effort-model') ? 'end' : 'start', fallbackHeight: 175 });
    }, true);
    document.addEventListener('scroll', () => {
        document.querySelectorAll('#barbell-tooltip, .hint-popover').forEach(el => { if (el instanceof HTMLElement) setPopoverOpen(el, false); });
    }, { capture: true, passive: true });
}
/** @param {HTMLElement} trigger
 * @returns {HTMLElement | null} */
function getBarbellDataCell(trigger) {
    const cell = trigger.closest('[data-barbell-title]') || trigger.closest('tr')?.querySelector('[data-barbell-title]');
    return cell instanceof HTMLElement ? cell : null;
}
/** @param {HTMLElement} trigger
 * @returns {HTMLElement} */
function getBarbellAnchorElement(trigger) {
    const cell = getBarbellDataCell(trigger);
    const track = cell?.querySelector('.suite-dumbbell-track, .insight-dumbbell-track');
    if (track instanceof HTMLElement && track.getClientRects().length > 0) return track;
    return cell || trigger;
}
/** @param {HTMLElement | null} trigger */
function setBarbellAnchor(trigger) {
    const anchor = trigger ? getBarbellAnchorElement(trigger) : null;
    if (activeBarbellAnchor && activeBarbellAnchor !== anchor) {
        activeBarbellAnchor.style.removeProperty('anchor-name');
    }
    activeBarbellAnchor = anchor;
    anchor?.style.setProperty('anchor-name', BARBELL_ANCHOR);
}

/** @param {HTMLElement} cell
 * @returns {string} */
function renderBarbellTooltipContent(cell) {
    const title = cell.dataset.barbellTitle || '';
    const kind = cell.dataset.barbellKind || 'guide';
    const metric = cell.dataset.barbellMetric || 'Pass rate';
    const runs = parseInt(cell.dataset.barbellRuns || '0') || 0;
    // Empty attributes mean that side (or the comparison) has no data.
    const parseOrNull = (/** @type {string | undefined} */ v) => (v === undefined || v === '') ? null : (parseInt(v) || 0);
    const uRate = parseOrNull(cell.dataset.barbellU);
    const gRate = parseOrNull(cell.dataset.barbellG);
    const uplift = parseOrNull(cell.dataset.barbellUplift);
    const uSd = cell.dataset.barbellUSd || '';
    const gSd = cell.dataset.barbellGSd || '';
    const uDetail = cell.dataset.barbellUDetail || '';
    const gDetail = cell.dataset.barbellGDetail || '';
    const hasErr = cell.dataset.barbellErr === '1';
    const liftCls = uplift !== null && uplift > 0 ? 'up' : (uplift !== null && uplift < 0 ? 'down' : 'flat');
    const liftText = uplift === null ? '—' : `${uplift > 0 ? '+' : ''}${uplift} pp`;
    const runsText = `${runs} ${runs === 1 ? 'run' : 'runs'}`;
    const subText = cell.dataset.barbellSub || `${metric} · median across ${runsText}`;
    const effortNote = cell.dataset.barbellEffort || '';
    const effortHtml = effortNote ? ` <div class="barbell-tooltip-effort">${escapeHtml(effortNote)}</div>` : '';
    const uExtraHtml = uDetail !== ''
        ? ` <span class="barbell-tooltip-sd">(${escapeHtml(uDetail)})</span>`
        : (uSd !== '' ? ` <span class="barbell-tooltip-sd">(±${escapeHtml(uSd)} pp SD)</span>` : '');
    const gExtraHtml = gDetail !== ''
        ? ` <span class="barbell-tooltip-sd">(${escapeHtml(gDetail)})</span>`
        : (gSd !== '' ? ` <span class="barbell-tooltip-sd">(±${escapeHtml(gSd)} pp SD)</span>` : '');
    let liftLabel = 'Median lift';
    let note = '';
    if (kind === 'suite-overall') {
        liftLabel = 'Pass-rate lift';
        note = `Vertical ticks mark checks passed without MWG and with MWG in this suite run; the horizontal bar spans the pass-rate lift.${hasErr ? ' Shaded bands indicate uncertainty from runs that failed before grading.' : ''}`;
    } else if (kind === 'suite-a11y') {
        liftLabel = 'Accessibility lift';
        note = 'Vertical ticks mark accessibility checks passed without MWG and with MWG in this suite run; the horizontal bar spans the accessibility lift.';
    } else if (kind === 'agent-overall') {
        liftLabel = 'Pass-rate lift';
        note = 'Checks passed without MWG and with MWG across the selected nightly suite(s); lift is the percentage-point difference.';
    } else if (kind === 'agent-a11y') {
        liftLabel = 'Accessibility lift';
        note = 'Accessibility checks passed without MWG and with MWG across the selected nightly suite(s); lift is the percentage-point difference.';
    } else if (kind === 'guide') {
        note = `Vertical ticks mark the median ${metric.toLowerCase()} without MWG and with MWG across ${runsText} in this date window; the horizontal bar spans the median lift.${runs > 1 ? ' Shaded bands show ±1 standard deviation across runs.' : ''}`;
    } else if (kind === 'dimension') {
        note = `Vertical ticks mark the median accessibility pass rate without MWG and with MWG across ${runsText} for this dimension; the horizontal bar spans the median lift.`;
    } else {
        note = `Vertical ticks mark this model’s median suite ${metric.toLowerCase()} without MWG and with MWG across ${runsText}; the horizontal bar spans the median lift.${hasErr ? ' Shaded bands indicate uncertainty from runs that failed before grading.' : ''}`;
    }

    return `<div class="barbell-tooltip-title">${escapeHtml(title)}</div> <div class="barbell-tooltip-sub">${escapeHtml(subText)}</div>${effortHtml} <div class="barbell-tooltip-rows"> <div class="barbell-tooltip-row"> <span class="barbell-tooltip-label"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span> <strong>${uRate === null ? '—' : `${uRate}%`}${uExtraHtml}</strong> </div> <div class="barbell-tooltip-row"> <span class="barbell-tooltip-label"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span> <strong class="rate-g">${gRate === null ? '—' : `${gRate}%`}${gExtraHtml}</strong> </div> <div class="barbell-tooltip-row barbell-tooltip-lift"> <span>${escapeHtml(liftLabel)}</span> <strong class="delta ${liftCls}">${liftText}</strong> </div> </div> <p class="barbell-tooltip-note">${escapeHtml(note)}</p>`;
}

function hideBarbellTooltip() {
    const tooltip = document.getElementById('barbell-tooltip');
    if (tooltip) setPopoverOpen(tooltip, false);
}

/** @returns {{ showAll: boolean, limit: number }} */
function getInsightWindowOptions() {
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const showAll = showAllCheck instanceof HTMLInputElement ? showAllCheck.checked : false;
    const limit = limitInput instanceof HTMLInputElement ? (parseInt(limitInput.value) || 5) : 5;
    return { showAll, limit };
}

/** @param {string[]} keys
 * @param {number} limit
 * @returns {string[]} */
function filterRecentDays(keys, limit) {
    const dayOf = (/** @type {string} */ k) => getSuiteDayKey(getSuiteDateInfo(allTestData[k]));
    const sortedDates = [...new Set(keys.map(dayOf))].sort((a, b) => a.localeCompare(b));
    const activeDates = new Set(sortedDates.slice(-limit));
    return keys.filter(k => activeDates.has(dayOf(k)));
}

/** @returns {string[]} */
function getInsightKeys() {
    const keys = getVisibleKeys();
    const { showAll, limit } = getInsightWindowOptions();
    return (!showAll && keys.length > 0) ? filterRecentDays(keys, limit) : keys;
}

/**
 * Returns compound keys for the "By Model" breakdown. Unlike `getInsightKeys()`,
 * this includes models that only have non-scheduled runs (such as `pi` evaluations
 * on Mistral or Qwen) and applies the `limit` day window per model so models
 * evaluated on earlier dates remain visible.
 * @returns {string[]}
 */
function getModelInsightKeys() {
    const candidates = getFilteredKeys({ ignoreModelFilter: true })
        .filter(k => Boolean(allTestData[k]?.model && allTestData[k].model !== 'unknown'));
    const { showAll, limit } = getInsightWindowOptions();
    const byModel = Map.groupBy(candidates, k => allTestData[k].model);
    /** @type {string[]} */
    const result = [];
    for (const modelKeys of byModel.values()) {
        const anyScheduled = modelKeys.some(k => isScheduledSuite(allTestData[k].testId));
        let scoped = (scheduledOnly && !currentSearchFilter && anyScheduled)
            ? modelKeys.filter(k => isScheduledSuite(allTestData[k].testId))
            : modelKeys;
        if (!showAll && scoped.length > 0) {
            scoped = filterRecentDays(scoped, limit);
        }
        result.push(...scoped);
    }
    return result;
}
/** @typedef {{ uplift: number, uRate: number, gRate: number, uErr?: number, gErr?: number, rtDeltaPct?: number | null, tokDeltaPct?: number | null, description?: string }} PivotItem */
/** @typedef {'alpha' | 'uplift-desc' | 'uplift-asc'} PanelSortMode */
/** @type {Record<'model' | 'dimension', PanelSortMode>} */
const currentPanelSorts = { model: 'alpha', dimension: 'uplift-desc' };
/** @type {Record<'model' | 'dimension' | 'guide', boolean>} */
const expandedPanels = { model: false, dimension: false, guide: false };

/**
 * @param {LandingSuiteSummary} testInfo
 * @param {boolean} onlyA11y
 * @returns {PivotItem | null}
 */
function buildModelPivotItem(testInfo, onlyA11y) {
    const rt = testInfo.efficiencyStats?.runtime;
    const rtDeltaPct = (rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0)) ? rt.medianDeltaPct : null;
    const tok = testInfo.efficiencyStats?.tokens;
    const tokDeltaPct = (tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0)) ? tok.uncachedMedianDeltaPct : null;
    const earlyFailureRate = testInfo.earlyFailureRate || 0;
    const uErr = testInfo.unguidedErrorRate ?? earlyFailureRate;
    const gErr = testInfo.guidedErrorRate ?? earlyFailureRate;
    if (onlyA11y) {
        const pair = a11yPair(testInfo.a11yStats);
        const pairUplift = pair ? upliftPp(pair.u, pair.g) : null;
        if (pair && pairUplift !== null) {
            return { uplift: pairUplift, uRate: toRate(pair.u), gRate: toRate(pair.g), uErr, gErr, rtDeltaPct, tokDeltaPct };
        }
        return null;
    }
    if (hasBothSides(testInfo.unguidedStats, testInfo.guidedStats)) {
        return {
            uplift: Math.round(toRateExact(testInfo.guidedStats) - toRateExact(testInfo.unguidedStats)),
            uRate: toRate(testInfo.unguidedStats),
            gRate: toRate(testInfo.guidedStats),
            uErr,
            gErr,
            rtDeltaPct,
            tokDeltaPct
        };
    }
    return null;
}

function renderPivotInsights() {
    const container = document.getElementById('insights-container');
    if (!container) return;
    if (activeBarbellAnchor && container.contains(activeBarbellAnchor)) { hideBarbellTooltip(); }
    /** @type {Record<string, number>} */
    const savedScrollPositions = {};
    container.querySelectorAll('.insights-table-scroll[data-scroll-section]').forEach(el => {
        if (el instanceof HTMLElement && el.dataset.scrollSection) { savedScrollPositions[el.dataset.scrollSection] = el.scrollTop; }
    });
    const keys = getInsightKeys();
    const modelKeys = getModelInsightKeys();
    const onlyA11y = currentInsightsMode === 'a11y';
    /** @type {{ model: Record<string, PivotItem[]>, guide: Record<string, PivotItem[]>, dimension: Record<string, PivotItem[]> }} */
    const grouped = { model: {}, guide: {}, dimension: {} };
    /** @type {Record<string, { model: string, effortLevel: string, effort?: import('./evals.d.ts').ReasoningEffort }>} */
    const modelSplitMeta = {};
    modelKeys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo || !testInfo.model) return;
        const item = buildModelPivotItem(testInfo, onlyA11y);
        if (item) {
            if (splitModelByEffort) {
                const effortLevel = getEffortLevel(testInfo.reasoningEffort);
                const bucketKey = `${testInfo.model}|||${effortLevel}`;
                const prevMeta = modelSplitMeta[bucketKey];
                modelSplitMeta[bucketKey] = {
                    model: testInfo.model,
                    effortLevel,
                    effort: pickHigherPrecedenceEffort(prevMeta?.effort, testInfo.reasoningEffort),
                };
                (grouped.model[bucketKey] ||= []).push(item);
            } else {
                (grouped.model[testInfo.model] ||= []).push(item);
            }
        }
    });
    keys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo) return;
        if (onlyA11y) {
            const bySub = testInfo.a11yStats?.bySubCategory;
            if (bySub) {
                A11Y_SUBCATEGORIES.forEach(sub => {
                    const sc = bySub[sub.id];
                    if (!sc) return;
                    const u = { passed: sc.unguidedPassed || 0, total: sc.unguidedTotal || 0 };
                    const g = { passed: sc.guidedPassed || 0, total: sc.guidedTotal || 0 };
                    const scUplift = upliftPp(u, g);
                    if (scUplift === null) return;
                    (grouped.dimension[sub.id] ||= []).push({
                        uplift: scUplift,
                        uRate: toRate(u),
                        gRate: toRate(g),
                        description: sub.description
                    });
                });
            }
        }

        const suiteGuides = testInfo.guides || {};
        Object.keys(suiteGuides).forEach(guide => {
            const gEntry = suiteGuides[guide];
            const src = onlyA11y ? gEntry.a11y : gEntry;
            if (!src) return;
            const u = { passed: src.unguidedPassed || 0, total: src.unguidedTotal || 0 };
            const g = { passed: src.guidedPassed || 0, total: src.guidedTotal || 0 };
            const guideUplift = upliftPp(u, g);
            if (guideUplift === null) return;
            (grouped.guide[guide] ||= []).push({ uplift: guideUplift, uRate: toRate(u), gRate: toRate(g) });
        });
    });

    /** @param {PivotItem[]} arr */
    const getMedianItem = (arr) => {
        if (arr.length === 0) return { uRate: 0, gRate: 0, uplift: 0 };
        const sorted = [...arr].sort((a, b) => a.uplift - b.uplift);
        return sorted[Math.floor(sorted.length / 2)];
    };

    /** @param {number[]} vals */
    const getMedianNumber = (vals) => { if (vals.length === 0) return null; return Math.round(median(vals)); };
    /** @param {number[]} vals */
    const calculateSD = (vals) => {
        if (vals.length <= 1) return 0;
        const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
        return Math.sqrt(variance);
    };

    /**
     * @param {Record<string, PivotItem[]>} groupObj
     * @param {'model' | 'guide' | 'dimension'} filterKey
     */
    const renderPivotTable = (groupObj, filterKey) => {
        const keys = Object.keys(groupObj);
        if (keys.length === 0) { return '<p class="pivot-empty">No data for the current selection.</p>'; }
        const showVariance = filterKey === 'guide';
        /** @type {Record<string, { medianItem: { uRate: number, gRate: number, uplift: number }, uSD: number, gSD: number }>} */
        const statsByKey = {};
        keys.forEach(k => {
            const arr = groupObj[k];
            const medianItem = getMedianItem(arr);
            const uSD = showVariance ? calculateSD(arr.map(i => i.uRate)) : 0;
            const gSD = showVariance ? calculateSD(arr.map(i => i.gRate)) : 0;
            statsByKey[k] = { medianItem, uSD, gSD };
        });

        if (filterKey === 'guide') {
            keys.sort((a, b) => {
                const statA = statsByKey[a];
                const statB = statsByKey[b];
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
                        valA = statA.medianItem.uplift;
                        valB = statB.medianItem.uplift;
                        break;
                    case 'unguided':
                        valA = statA.medianItem.uRate;
                        valB = statB.medianItem.uRate;
                        break;
                    case 'guided':
                        valA = statA.medianItem.gRate;
                        valB = statB.medianItem.gRate;
                        break;
                    case 'variance': {
                        valA = Math.max(statA.uSD, statA.gSD);
                        valB = Math.max(statB.uSD, statB.gSD);
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
                return a.toLowerCase().localeCompare(b.toLowerCase());
            });
        } else {
            const sortMode = currentPanelSorts[filterKey] || 'alpha';
            keys.sort((a, b) => {
                if (sortMode === 'uplift-desc' || sortMode === 'uplift-asc') {
                    const upliftA = statsByKey[a].medianItem.uplift;
                    const upliftB = statsByKey[b].medianItem.uplift;
                    if (upliftA !== upliftB) { return sortMode === 'uplift-desc' ? upliftB - upliftA : upliftA - upliftB; }
                }
                if (filterKey === 'model' && splitModelByEffort) {
                    const metaA = modelSplitMeta[a];
                    const metaB = modelSplitMeta[b];
                    if (metaA && metaB) {
                        const cmpModel = metaA.model.toLowerCase().localeCompare(metaB.model.toLowerCase());
                        if (cmpModel !== 0) return cmpModel;
                        return compareEffortLevels(metaA.effortLevel, metaB.effortLevel);
                    }
                }
                return a.toLowerCase().localeCompare(b.toLowerCase());
            });
        }

        const metricName = onlyA11y ? 'Accessibility subscore' : 'Pass rate';
        const captionNoun = filterKey === 'guide' ? 'guide' : (filterKey === 'dimension' ? 'accessibility dimension' : 'model');

        let rowsHtml = '';
        keys.forEach(key => {
            const items = groupObj[key];
            const { medianItem, uSD, gSD } = statsByKey[key];
            const { uRate, gRate, uplift: medUplift } = medianItem;

            let uBandHtml = '';
            let gBandHtml = '';
            let avgUErr = 0;
            let avgGErr = 0;
            if (showVariance) {
                if (uSD > 0) {
                    const left = Math.max(0, uRate - uSD);
                    uBandHtml = `<span class="variance-band unguided" style="left: ${left}%; width: ${Math.min(100, uRate + uSD) - left}%;"></span>`;
                }
                if (gSD > 0) {
                    const left = Math.max(0, gRate - gSD);
                    gBandHtml = `<span class="variance-band guided" style="left: ${left}%; width: ${Math.min(100, gRate + gSD) - left}%;"></span>`;
                }
            } else if (filterKey === 'model' && items.length > 0) {
                avgUErr = Math.round(items.reduce((s, it) => s + (it.uErr || 0), 0) / items.length);
                avgGErr = Math.round(items.reduce((s, it) => s + (it.gErr || 0), 0) / items.length);
                if (avgUErr > 0) uBandHtml = `<span class="variance-band unguided" style="left: ${(uRate * (1 - avgUErr / 100)).toFixed(1)}%; width: ${avgUErr}%;"></span>`;
                if (avgGErr > 0) gBandHtml = `<span class="variance-band guided has-err" style="left: ${(gRate * (1 - avgGErr / 100)).toFixed(1)}%; width: ${avgGErr}%;"></span>`;
            }

            const splitMeta = (filterKey === 'model' && splitModelByEffort) ? modelSplitMeta[key] : undefined;
            const modelValue = splitMeta ? splitMeta.model : key;
            const isActive = filterKey === 'model' && currentModelFilter === modelValue && (
                splitMeta ? currentEffortFilter === splitMeta.effortLevel : currentEffortFilter === 'all'
            );
            let nameHtml = '';
            let effSummary = '';
            let displayTitle = key;
            let barbellEffortAttr = '';
            if (filterKey === 'guide') {
                const modeQuery = onlyA11y ? '&mode=a11y' : '';
                const sourceQuery = `&source=${encodeURIComponent(activeDataSource())}`;
                nameHtml = `<a class="pivot-link" href="guide.html?guide=${encodeURIComponent(key)}${modeQuery}${sourceQuery}" interestfor="barbell-tooltip">${escapeHtml(key)}</a>`;
                effSummary = `<span class="pivot-trials">${items.length} ${items.length === 1 ? 'run' : 'runs'}</span>`;
            } else if (filterKey === 'dimension') {
                const subMeta = A11Y_SUBCATEGORIES.find(s => s.id === key);
                const label = subMeta ? subMeta.label : key;
                const desc = subMeta ? subMeta.description : '';
                displayTitle = label;
                nameHtml = `<span class="pivot-static-name">${escapeHtml(label)}</span>`;
                effSummary = desc ? `<span class="pivot-trials">${escapeHtml(desc)}</span>` : '';
            } else {
                if (splitMeta) {
                    displayTitle = `${splitMeta.model} (${splitMeta.effortLevel})`;
                    barbellEffortAttr = ` data-barbell-effort="${escapeHtml(getEffortTooltip(splitMeta.effort))}"`;
                    const chipHtml = renderEffortChip(splitMeta.effort, { interactive: false });
                    nameHtml = `<button type="button" class="pivot-filter-btn" data-filter-key="${filterKey}" data-filter-value="${escapeHtml(splitMeta.model)}" data-filter-effort="${escapeHtml(splitMeta.effortLevel)}" aria-pressed="${isActive}" interestfor="barbell-tooltip"><span class="pivot-model-label">${escapeHtml(splitMeta.model)}${chipHtml}</span></button>`;
                } else {
                    nameHtml = `<button type="button" class="pivot-filter-btn" data-filter-key="${filterKey}" data-filter-value="${escapeHtml(key)}" aria-pressed="${isActive}" interestfor="barbell-tooltip">${escapeHtml(key)}</button>`;
                }
                const rtMed = getMedianNumber(/** @type {number[]} */ (items.map(i => i.rtDeltaPct).filter(v => typeof v === 'number')));
                const tokMed = getMedianNumber(/** @type {number[]} */ (items.map(i => i.tokDeltaPct).filter(v => typeof v === 'number')));
                const fmtSignedPct = (/** @type {number} */ v) => v > 0 ? `+${v}%` : (v < 0 ? `−${Math.abs(v)}%` : '0%');
                const parts = [
                    `${items.length} ${items.length === 1 ? 'run' : 'runs'}`,
                    rtMed !== null ? `duration ${fmtSignedPct(rtMed)}` : '',
                    tokMed !== null ? `tokens ${fmtSignedPct(tokMed)}` : ''
                ].filter(Boolean);
                effSummary = `<span class="pivot-trials">${escapeHtml(parts.join(' · '))}</span>`;
            }

            const sign = medUplift > 0 ? '+' : '';
            const regressedCls = gRate < uRate ? ' regressed' : '';
            const uSdAttr = showVariance && items.length > 1 ? String(Math.round(uSD)) : '';
            const gSdAttr = showVariance && items.length > 1 ? String(Math.round(gSD)) : '';
            const errAttr = filterKey === 'model' && (avgUErr > 0 || avgGErr > 0) ? '1' : '';
            const staticRowCls = filterKey === 'dimension' ? ' is-static' : '';
            const barbellTrackHtml = `<span class="insight-dumbbell-track" aria-hidden="true"> ${uBandHtml} ${gBandHtml} <span class="connector${regressedCls}" style="left: ${Math.min(uRate, gRate)}%; width: ${Math.abs(gRate - uRate)}%;"></span> <span class="dot unguided" style="left: ${uRate}%;"></span> <span class="dot guided" style="left: ${gRate}%;"></span> </span>`;
            const rateTextHtml = `<span class="rate-text"> <span class="visually-hidden">Median unguided </span>${uRate}% <span class="rate-arrow" aria-hidden="true">→</span><span class="visually-hidden">, guided </span><span class="rate-g">${gRate}%</span> <span class="delta ${medUplift > 0 ? 'up' : (medUplift < 0 ? 'down' : 'flat')}">(${sign}${medUplift} pp)</span> </span>`;
            const barbellCellHtml = filterKey === 'dimension'
                ? `<button type="button" class="pivot-barbell-btn" interestfor="barbell-tooltip" aria-label="${escapeHtml(`${displayTitle}: median unguided ${uRate}%, guided ${gRate}% (${sign}${medUplift} pp)`)}">${barbellTrackHtml}${rateTextHtml} </button>`
                : `${barbellTrackHtml}${rateTextHtml}`;
            rowsHtml += `
                <tr class="pivot-row${isActive ? ' active-filter' : ''}${staticRowCls}">
                    <th scope="row" class="pivot-name">
                        ${nameHtml}
                        ${effSummary}
                    </th>
                    <td class="insight-dumbbell-cell"
                        data-barbell-title="${escapeHtml(displayTitle)}"
                        data-barbell-kind="${filterKey}"
                        data-barbell-metric="${escapeHtml(metricName)}"
                        data-barbell-runs="${items.length}"
                        data-barbell-u="${uRate}"
                        data-barbell-g="${gRate}"
                        data-barbell-uplift="${medUplift}"
                        data-barbell-u-sd="${uSdAttr}"
                        data-barbell-g-sd="${gSdAttr}"
                        data-barbell-err="${errAttr}"${barbellEffortAttr}>
                        ${barbellCellHtml}
                    </td>
                </tr>
            `;
        });

        const colHeader = filterKey === 'guide' ? 'Guide' : (filterKey === 'dimension' ? 'Dimension' : 'Model');
        let firstColAriaSort = '';
        let secondColAriaSort = '';
        if (filterKey === 'guide') {
            const ariaDir = currentGuideSortDir === 'asc' ? 'ascending' : 'descending';
            if (currentGuideSort === 'alphabetic') firstColAriaSort = ` aria-sort="${ariaDir}"`;
            else secondColAriaSort = ` aria-sort="${ariaDir}"`;
        } else {
            const pSort = currentPanelSorts[filterKey] || 'alpha';
            if (pSort === 'alpha') firstColAriaSort = ' aria-sort="ascending"';
            else secondColAriaSort = ` aria-sort="${pSort === 'uplift-asc' ? 'ascending' : 'descending'}"`;
        }
        const table = `<table class="insights-table"> <caption class="visually-hidden">Median ${metricName.toLowerCase()} by ${captionNoun}, unguided vs. guided${showVariance ? ' (bands show one standard deviation across runs)' : ''}</caption> <thead class="visually-hidden"><tr><th scope="col"${firstColAriaSort}>${escapeHtml(colHeader)}</th><th scope="col"${secondColAriaSort}>${escapeHtml(metricName)} <span class="pivot-head-note">unguided → guided (median)</span></th></tr></thead> <tbody>${rowsHtml}</tbody> </table>`;
        const isExpanded = Boolean(expandedPanels[filterKey]);
        const scrollCls = `insights-table-scroll${filterKey === 'guide' ? ' pivot-scroll' : ''}${isExpanded ? ' is-expanded' : ''}`;
        const label = filterKey === 'guide' ? 'By guide table (scrolls vertically)' : `By ${captionNoun} table (scrolls vertically)`;
        return `<div class="${scrollCls}" data-scroll-section="${filterKey}" tabindex="0" role="region" aria-label="${label}">${table}</div>`;
    };

    /** @param {'model' | 'dimension'} panelKey
 * @param {string} titleHtml */
    const renderPanelHeader = (panelKey, titleHtml) => {
        const sortMode = currentPanelSorts[panelKey] || 'alpha';
        const isSorted = sortMode === 'uplift-desc' || sortMode === 'uplift-asc';
        const arrow = sortMode === 'uplift-desc' ? '↓' : (sortMode === 'uplift-asc' ? '↑' : '↕');
        const sortStateLabel = sortMode === 'uplift-desc'
            ? ' (sorted high to low)'
            : (sortMode === 'uplift-asc' ? ' (sorted low to high)' : '');
        const panelNoun = panelKey === 'dimension' ? 'accessibility dimensions' : 'models';
        const upliftHintText = sortMode === 'alpha'
            ? `Sort ${panelNoun} by uplift (high to low)`
            : (sortMode === 'uplift-desc'
                ? `Sorted by uplift (high to low) — click to sort low to high`
                : `Sorted by uplift (low to high) — click to reset to alphabetical sort`);
        const alphaHintId = `hint-sort-alpha-${panelKey}`;
        const upliftHintId = `hint-sort-uplift-${panelKey}`;
        const effortSplitBtnHtml = panelKey === 'model'
            ? `<button type="button" class="insights-effort-split-btn anchor-hint-split-effort-model${splitModelByEffort ? ' is-active' : ''}" data-model-effort-split aria-pressed="${splitModelByEffort}" interestfor="hint-split-effort-model">By effort</button>`
            : '';
        const effortSplitHintHtml = panelKey === 'model'
            ? `<div id="hint-split-effort-model" popover="hint" class="hint-popover">${splitModelByEffort ? 'Showing models split by reasoning effort — click to combine' : 'Split model rows by reasoning effort level'}</div>`
            : '';
        return `<div class="insights-panel-header"> <h3 class="insights-panel-title"> <button type="button" class="insights-panel-title-btn anchor-${alphaHintId}" data-panel-title-sort="${panelKey}" aria-pressed="${sortMode === 'alpha'}" interestfor="${alphaHintId}">${titleHtml}</button> </h3> <div class="insights-panel-actions"> ${effortSplitBtnHtml} <button type="button" class="insights-uplift-sort-btn anchor-${upliftHintId}${isSorted ? ' is-sorted' : ''}" data-panel-uplift-sort="${panelKey}" aria-pressed="${isSorted}" interestfor="${upliftHintId}"> <span>Uplift<span class="visually-hidden">${sortStateLabel}</span></span> <span class="insights-uplift-sort-arrow" aria-hidden="true">${arrow}</span> </button> </div> <div id="${alphaHintId}" popover="hint" class="hint-popover">Sort ${panelNoun} alphabetically</div> ${effortSplitHintHtml} <div id="${upliftHintId}" popover="hint" class="hint-popover">${upliftHintText}</div> </div>`;
    };

    const COLLAPSED_ROW_THRESHOLD = 6;
    /** @param {'model' | 'dimension' | 'guide'} panelKey
     * @param {number} rowCount */
    const renderExpandRow = (panelKey, rowCount) => {
        const isExpanded = Boolean(expandedPanels[panelKey]);
        if (rowCount <= COLLAPSED_ROW_THRESHOLD && !isExpanded) return '';
        return ` <div class="insights-expand-row"> <button type="button" class="insights-expand-btn${isExpanded ? ' is-expanded' : ''}" data-expand-panel="${panelKey}" aria-expanded="${isExpanded}"> <span>${isExpanded ? 'Collapse' : `Show all ${rowCount}`}</span> <svg class="insights-expand-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true"> <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/> </svg> </button>
            </div>
        `;
    };
    const sortOptions = [
        { value: 'alphabetic', label: 'Alphabetic' },
        { value: 'uplift', label: 'Uplift' },
        { value: 'unguided', label: 'Unguided rate' },
        { value: 'guided', label: 'Guided rate' },
        { value: 'variance', label: 'Variance' }
    ];
    const sortOptionsHtml = sortOptions.map(opt => `<option value="${opt.value}" ${currentGuideSort === opt.value ? 'selected' : ''}>${opt.label}</option>`).join('');
    const dirLabel = currentGuideSortDir === 'asc' ? 'ascending' : 'descending';
    const dirArrow = currentGuideSortDir === 'asc' ? '↑' : '↓';
    const dimensionCount = Object.keys(grouped.dimension).length;
    const modelCount = Object.keys(grouped.model).length;
    const guideCount = Object.keys(grouped.guide).length;
    const runCount = keys.length;
    const dimensionPanelHtml = onlyA11y && dimensionCount > 0 ? `
        <div class="insights-panel insights-dimension-panel" data-panel="dimension">
            ${renderPanelHeader('dimension', `By accessibility dimension (${dimensionCount})`)}
            ${renderPivotTable(grouped.dimension, 'dimension')}
            ${renderExpandRow('dimension', dimensionCount)}
        </div>`
        : '';
    container.innerHTML = `
        <div class="insights-scope-bar">
            <p class="insights-scope">${runCount} ${runCount === 1 ? 'run' : 'runs'} · medians across runs</p>
            <div class="guide-legend">
                <span class="guide-legend-item">
                    <span class="guide-legend-swatch unguided"><span class="guide-legend-tick"></span></span>
                    <span class="guide-legend-label-u">Unguided</span>
                </span>
                <span class="guide-legend-vs" aria-hidden="true">→</span>
                <span class="guide-legend-item">
                    <span class="guide-legend-swatch guided"><span class="guide-legend-tick"></span></span>
                    <strong>Guided</strong>
                </span>
                <button type="button" class="info-hint-btn anchor-hint-guide-legend" interestfor="hint-guide-legend" aria-label="About the bands and ticks">?</button>
                <div id="hint-guide-legend" popover="hint" class="hint-popover">Shaded band shows ±1 standard deviation across runs; the vertical tick mark shows the median rate.</div>
            </div>
        </div>
        ${dimensionPanelHtml}
        <div class="insights-panel" data-panel="model">
            ${renderPanelHeader('model', `By model (${modelCount})`)}
            ${renderPivotTable(grouped.model, 'model')}
            ${renderExpandRow('model', modelCount)}
        </div>
        <div class="insights-panel insights-panel-full insights-guide-drawer" data-panel="guide">
            <div class="insights-guide-body">
                <div class="insights-panel-header">
                    <h3 class="insights-panel-title" tabindex="-1">By guide (${guideCount})</h3>
                    <div class="guide-sort-controls">
                        <label for="guide-sort-select" class="sort-label">Sort</label>
                        <div class="sort-combined-control">
                            <div class="sort-select-pill">
                                <select id="guide-sort-select" class="sort-select">${sortOptionsHtml}</select>
                                <svg class="sort-select-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                                </svg>
                            </div>
                            <span class="sort-combined-divider" aria-hidden="true"></span>
                            <button id="guide-sort-dir-btn" class="sort-direction-btn" type="button" aria-label="Sort direction: ${dirLabel}. Toggle." aria-pressed="${currentGuideSortDir === 'desc'}">
                                <span class="sort-dir-arrow" aria-hidden="true">${dirArrow}</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${renderPivotTable(grouped.guide, 'guide')}
                ${renderExpandRow('guide', guideCount)}
            </div>
        </div>
    `;

    container.querySelectorAll('.insights-table-scroll[data-scroll-section]').forEach(el => {
        if (el instanceof HTMLElement && el.dataset.scrollSection && savedScrollPositions[el.dataset.scrollSection] !== undefined) {
            el.scrollTop = savedScrollPositions[el.dataset.scrollSection];
        }
    });

    container.querySelectorAll('.insights-panel-title-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!(btn instanceof HTMLElement)) return;
            const key = /** @type {'model' | 'dimension' | undefined} */ (btn.dataset.panelTitleSort);
            if (key && currentPanelSorts[key] !== 'alpha') {
                currentPanelSorts[key] = 'alpha';
                renderPivotInsights();
                /** @type {HTMLElement | null} */
(container.querySelector(`.insights-panel-title-btn[data-panel-title-sort="${key}"]`))?.focus();
            }
        });
    });
    container.querySelectorAll('.insights-uplift-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!(btn instanceof HTMLElement)) return;
            const key = /** @type {'model' | 'dimension' | undefined} */ (btn.dataset.panelUpliftSort);
            if (!key) return;
            const cur = currentPanelSorts[key] || 'alpha';
            currentPanelSorts[key] = cur === 'alpha' ? 'uplift-desc' : (cur === 'uplift-desc' ? 'uplift-asc' : 'alpha');
            renderPivotInsights();
            /** @type {HTMLElement | null} */
(container.querySelector(`.insights-uplift-sort-btn[data-panel-uplift-sort="${key}"]`))?.focus();
        });
    });
    container.querySelectorAll('.insights-expand-btn[data-expand-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!(btn instanceof HTMLElement)) return;
            const key = /** @type {'model' | 'dimension' | 'guide' | undefined} */ (btn.dataset.expandPanel);
            if (!key) return;
            expandedPanels[key] = !expandedPanels[key];
            renderPivotInsights();
            /** @type {HTMLElement | null} */
(container.querySelector(`.insights-expand-btn[data-expand-panel="${key}"]`))?.focus();
        });
    });
    const sortSelect = document.getElementById('guide-sort-select');
    sortSelect?.addEventListener('change', (e) => {
        const target = e.target;
        if (target instanceof HTMLSelectElement) {
            currentGuideSort = /** @type {GuideSortKey} */ (target.value);
            renderPivotInsights();
            document.getElementById('guide-sort-select')?.focus();
        }
    });
    const sortDirBtn = document.getElementById('guide-sort-dir-btn');
    sortDirBtn?.addEventListener('click', () => {
        currentGuideSortDir = currentGuideSortDir === 'asc' ? 'desc' : 'asc';
        renderPivotInsights();
        document.getElementById('guide-sort-dir-btn')?.focus();
    });
    const effortSplitBtn = container.querySelector('button[data-model-effort-split]');
    effortSplitBtn?.addEventListener('click', () => {
        splitModelByEffort = !splitModelByEffort;
        if (!splitModelByEffort && currentEffortFilter !== 'all') {
            currentEffortFilter = 'all';
            renderSuites();
        } else {
            renderPivotInsights();
        }
        /** @type {HTMLElement | null} */
        (container.querySelector('button[data-model-effort-split]'))?.focus();
    });
}

/**
 * Toggles one of the header filters from a pivot row (click again to clear).
 * @param {'agent' | 'model'} filterKey
 * @param {string} value
 * @param {string} [effort]
 */
function setInsightFilter(filterKey, value, effort) {
    const select = document.getElementById(`filter-${filterKey}`);
    if (!(select instanceof HTMLSelectElement)) return;
    if (filterKey === 'model' && effort !== undefined) {
        const isSame = currentModelFilter === value && currentEffortFilter === effort;
        const nextModel = isSame ? 'all' : value;
        const nextEffort = isSame ? 'all' : effort;
        select.value = nextModel;
        currentModelFilter = nextModel;
        currentEffortFilter = nextEffort;
        syncSelectStyles(select);
        renderSuites();
        return;
    }
    select.value = select.value === value ? 'all' : value;
    select.dispatchEvent(new Event('change'));
}
