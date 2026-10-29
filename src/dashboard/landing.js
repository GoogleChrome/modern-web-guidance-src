import {
    initGoogleAuth,
    getAccessToken,
    escapeHtml,
    timeAgo,
    formatDuration,
    formatTokens,
    isLocalDashboardHost,
    getAgentBadge,
    getScrollBehavior,
    SERVING_DISPLAY_NAMES,
    AGENT_DISPLAY_NAMES,
    parseSuiteDate,
    formatSuiteDate,
    getSuiteDayKey,
    isPopoverOpen,
    setPopoverOpen,
    median,
} from './utils.js';
import { A11Y_SUBCATEGORIES } from './a11y-classifier.js';
import { ApiClient } from './api.js';

/**
 * @typedef {import('./insights.js').ManifestSuite & {
 *   source: import('./api.js').DataSource;
 *   timestamp: string;
 *   agent: string;
 *   serving: string;
 *   model: string;
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

const api = new ApiClient();

const servingDisplayNames = SERVING_DISPLAY_NAMES;
const agentDisplayNames = AGENT_DISPLAY_NAMES;

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
        setupScrollRegion();
        setupSortButtons();
        setupInsightsControls();

        const params = new URLSearchParams(window.location.search);
        const reloadSuitesAfterAuth = async () => {
            await loadSuites();
            selectedTestIds = new Set(Object.keys(allTestData));
            applyTestsParam(params.get('tests'));
            renderFilterMenuItems();
            renderSuites();
            applyGuidesHash(window.location.hash, false);
        };

        window.addEventListener('mwg:auth-changed', (e) => {
            const authenticated = Boolean(/** @type {CustomEvent<{ authenticated?: boolean }>} */ (e).detail?.authenticated);
            if (!authenticated && api.source === 'remote') {
                setEmptyState('Sign in with Google to load evaluation runs.');
            }
        });

        // Remote (GCS) needs a Google sign-in token; local/static load immediately.
        if (api.source === 'remote' && !getAccessToken()) {
            setEmptyState('Sign in with Google to load evaluation runs.');
            renderSuites();
            initGoogleAuth(reloadSuitesAfterAuth);
            return;
        }
        if (api.source === 'remote') {
            initGoogleAuth(reloadSuitesAfterAuth);
        }

        await loadSuites();
        if (api.source === 'local' && !params.get('source') && Object.keys(allTestData).length === 0) {
            api.source = 'remote';
            if (!getAccessToken()) {
                setEmptyState('No local evaluation runs found. Sign in with Google to load remote runs.');
                renderSuites();
                initGoogleAuth(reloadSuitesAfterAuth);
                return;
            }
            initGoogleAuth(reloadSuitesAfterAuth);
            await loadSuites();
        }
        selectedTestIds = new Set(Object.keys(allTestData));
        applyTestsParam(params.get('tests'));

        renderFilterMenuItems();
        renderSuites();
        applyGuidesHash(window.location.hash, true);
    } catch (error) {
        console.error('Error:', error);
        const emptyState = document.getElementById('empty-state');
        if (emptyState) emptyState.style.display = 'block';
    }
});

// When v1 remote/static manifests finish hydrating a11yStats + efficiencyStats from evals.json,
// refresh the table entries so the A11y subscore, Median time, and Tokens columns populate.
window.addEventListener('mwg:manifest-hydrated', (e) => {
    const detail = /** @type {CustomEvent<{ source: import('./api.js').DataSource, suites: import('./insights.js').ManifestSuite[] }>} */ (e).detail;
    if (!detail || !Array.isArray(detail.suites)) return;
    for (const suite of detail.suites) {
        if (suite && suite.testId && suite.guidedStats) {
            registerSuiteSummary(suite, detail.source, { refreshFilters: false });
        }
    }
    refreshFilterOptions();
    renderSuites();
    const drawer = document.getElementById('breakdowns');
    if (drawer instanceof HTMLDetailsElement && drawer.open) {
        renderPivotInsights();
    }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    selectedTestIds = new Set(Object.keys(allTestData));
    applyTestsParam(params.get('tests'));
    renderFilterMenuItems();
    renderSuites();
    applyGuidesHash(window.location.hash, false);
});

window.addEventListener('hashchange', () => {
    applyGuidesHash(window.location.hash, true);
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

    // Open/close, Escape, light dismiss, and focus return are all handled by the
    // native popover (or the conditionally loaded popover polyfill in index.html).
    // We only mirror the state into aria-expanded (drives the chevron CSS) and move
    // focus into the search field so keyboard users can start typing immediately.
    filterMenu.addEventListener('toggle', (e) => {
        const isOpen = /** @type {ToggleEvent} */ (e).newState === 'open';
        filterBtn.setAttribute('aria-expanded', String(isOpen));
        if (isOpen && searchInput instanceof HTMLInputElement) {
            searchInput.focus();
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
        'filter-agent': (val) => {
            currentAgentFilter = val;
            const mobileAgent = document.getElementById('mobile-filter-agent');
            if (mobileAgent instanceof HTMLSelectElement) {
                mobileAgent.value = val;
                syncSelectStyles(mobileAgent);
            }
        },
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

    const mobileAgent = document.getElementById('mobile-filter-agent');
    if (mobileAgent instanceof HTMLSelectElement) {
        mobileAgent.addEventListener('change', () => {
            currentAgentFilter = mobileAgent.value;
            syncSelectStyles(mobileAgent);
            const desktopAgent = document.getElementById('filter-agent');
            if (desktopAgent instanceof HTMLSelectElement) {
                desktopAgent.value = mobileAgent.value;
                syncSelectStyles(desktopAgent);
            }
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
    check.addEventListener('change', () => {
        scheduledOnly = check.checked;
        renderSuites();
    });
}

/** Below this container width the table renders as stacked cards (mirrors the @container rule in landing.css). */
const STACKED_MAX_WIDTH = 640;
/** How many stacked cards to show before the "Show all" button on phones. */
const STACKED_PAGE_SIZE = 10;
/** Default rows shown on desktop (9 = 3 recent nightly runs × 3 agent families, matching the hero window). */
const DESKTOP_PAGE_SIZE = 9;
let isStacked = false;
let showAllStacked = false;

/**
 * The table wrapper scrolls horizontally on narrow viewports; making it a focusable,
 * labeled region lets keyboard users scroll it (MWG `accessibility`: scroll containers).
 * It also tells us when the stacked-card layout is active (ResizeObserver == container query).
 */
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
            if (stacked !== isStacked) {
                isStacked = stacked;
                renderSuites();
            }
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

/** Reflects the active sort in `aria-sort` and the mobile sort select so AT and phone users stay in sync. */
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
    const mobileSort = document.getElementById('mobile-sort-select');
    if (mobileSort instanceof HTMLSelectElement) {
        const targetVal = `${currentSuiteSort}:${currentSuiteSortDir}`;
        if (Array.from(mobileSort.options).some(o => o.value === targetVal)) {
            mobileSort.value = targetVal;
        }
    }
}

/**
 * Opens the Breakdowns drawer, switches to the requested check scope (`'a11y'` or `'all'`),
 * sorts the By Guide panel by uplift, and optionally scrolls/focuses it.
 * @param {InsightsMode} mode
 * @param {boolean} [scrollAndFocus=true]
 */
function openGuidesBreakdown(mode, scrollAndFocus = true) {
    const drawer = document.getElementById('breakdowns');
    const modeAllBtn = document.getElementById('insights-mode-all');
    const modeA11yBtn = document.getElementById('insights-mode-a11y');

    currentInsightsMode = mode;
    modeAllBtn?.setAttribute('aria-pressed', String(mode === 'all'));
    modeA11yBtn?.setAttribute('aria-pressed', String(mode === 'a11y'));
    currentGuideSort = 'uplift';
    currentGuideSortDir = 'desc';

    if (drawer instanceof HTMLDetailsElement && !drawer.open) {
        drawer.open = true;
    }
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

/**
 * Applies `#a11y-guides` or `#all-guides` URL hash deep links.
 * @param {string} hash
 * @param {boolean} scrollAndFocus
 */
function applyGuidesHash(hash, scrollAndFocus) {
    if (hash === '#a11y-guides') {
        openGuidesBreakdown('a11y', scrollAndFocus);
    } else if (hash === '#all-guides') {
        openGuidesBreakdown('all', scrollAndFocus);
    }
}

function setupInsightsControls() {
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const modeAllBtn = document.getElementById('insights-mode-all');
    const modeA11yBtn = document.getElementById('insights-mode-a11y');

    if (limitInput instanceof HTMLInputElement) {
        limitInput.addEventListener('change', () => {
            let val = parseInt(limitInput.value);
            if (isNaN(val) || val < 1) val = 5;
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

    // Delegate clicks on hero takeaway links (`data-open-guides="a11y" | "all"`).
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

    // The pivot only renders once the drawer is opened (it is collapsed by default).
    const drawer = document.getElementById('breakdowns');
    if (drawer instanceof HTMLDetailsElement) {
        drawer.addEventListener('toggle', () => {
            if (drawer.open) {
                renderPivotInsights();
            } else {
                hideBarbellTooltip();
            }
        });
    }

    // Event delegation for pivot rows: model rows toggle the table filter; barbell clicks forward to the row action.
    const container = document.getElementById('insights-container');
    container?.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('button[data-filter-key]');
        if (btn instanceof HTMLButtonElement) {
            const key = btn.dataset.filterKey;
            const value = btn.dataset.filterValue;
            if ((key === 'agent' || key === 'serving' || key === 'model') && value !== undefined) {
                setInsightFilter(key, value);
            }
            return;
        }
        // The row-header trigger's stretched ::after normally receives row clicks; this covers any
        // click that still lands on plain cell content.
        if (!target.closest('a, button')) {
            const row = target.closest('tr.pivot-row');
            const rowAction = row?.querySelector('a.pivot-link, button[data-filter-key]');
            if (rowAction instanceof HTMLElement) rowAction.click();
        }
    });

    setupBarbellTooltip();
    setupAnchorPositioningFallback();
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
            updateFilterButtonLabel();
            updateUrlParams();
            renderSuites();
        });

        const labelContent = document.createElement('div');
        labelContent.className = 'filter-item-label';

        const idSpan = document.createElement('span');
        idSpan.textContent = testInfo.testId.replace('test_', '') + ` (${testInfo.source})`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'filter-item-date';
        dateSpan.textContent = formatSuiteDateTime(getSuiteDate(testInfo));

        labelContent.append(idSpan, dateSpan);
        item.append(checkbox, labelContent);
        list.appendChild(item);
    });

    updateFilterButtonLabel();
}

function updateFilterButtonLabel() {
    const btnText = document.getElementById('filter-btn-text');
    const btn = document.getElementById('filter-btn');
    if (!btnText || !btn) return;

    const allIds = Object.keys(allTestData);
    const total = allIds.length;
    const selected = Array.from(selectedTestIds).filter(id => allTestData[id]);
    const count = selected.length;

    if (total === 0 || count === total) {
        btnText.textContent = total > 0 ? `All selected (${total})` : 'All selected';
        btn.classList.remove('is-filtered');
    } else if (count === 0) {
        btnText.textContent = 'None selected';
        btn.classList.add('is-filtered');
    } else {
        const selectedNames = selected.map(id => {
            const t = allTestData[id];
            return t ? t.testId.replace('test_', '') : id;
        });
        if (count === 1) {
            btnText.textContent = selectedNames[0];
        } else if (count === 2) {
            btnText.textContent = `${selectedNames[0]}, ${selectedNames[1]}`;
        } else {
            btnText.textContent = `${count} selected (${selectedNames[0]}, +${count - 1} more)`;
        }
        btn.classList.add('is-filtered');
    }
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

/**
 * @param {string | null} message null hides the empty state.
 */
function setEmptyState(message) {
    const emptyState = document.getElementById('empty-state');
    if (!emptyState) return;
    emptyState.style.display = message ? 'block' : 'none';
    const p = emptyState.querySelector('p');
    if (p && message) p.textContent = message;
}

async function loadSuites() {
    try {
        const { suites } = await api.getManifest();
        const list = Array.isArray(suites) ? suites : [];
        // Register everything first, then rebuild the filter <select>s once: refreshing per
        // suite rescanned and re-sorted every suite each time (O(n²) during load).
        for (const suite of list) {
            if (suite && suite.testId && suite.guidedStats) {
                registerSuiteSummary(suite, api.source, { refreshFilters: false });
            }
        }
        refreshFilterOptions();
        setEmptyState(list.length > 0 ? null : 'No test runs found yet. Run the test suite to get started.');
    } catch (error) {
        console.error('Error loading suites manifest:', error);
        setEmptyState('Could not load evaluation runs.');
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
        serving: summary.serving || 'unknown',
        model: summary.model || 'unknown'
    };
    if (refreshFilters) refreshFilterOptions();
}

/** Rebuilds every header filter's options from the registered suites. */
function refreshFilterOptions() {
    updateFilterOptions('filter-model-group', 'model');
    updateFilterOptions('filter-agent-group', 'agent', agentDisplayNames);
    updateFilterOptions('mobile-filter-agent-group', 'agent', agentDisplayNames);
    updateFilterOptions('filter-serving-group', 'serving', servingDisplayNames);
    updateSourceFilterOptions();
}

function updateSourceFilterOptions() {
    const group = document.querySelector('#filter-source optgroup');
    if (!group) return;
    const sourceLabels = { local: 'Local', remote: 'Remote', static: 'Static' };
    const values = /** @type {Array<'local' | 'remote' | 'static'>} */ (
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
 * @param {'agent' | 'serving' | 'model'} key
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

// ==========================================
// SELECTION, SORTING & DATES
// ==========================================

/**
 * Resolves the suite's run date via shared timezone-safe `parseSuiteDate`.
 * @param {LandingSuiteSummary} testInfo
 * @returns {Date}
 */
function getSuiteDate(testInfo) {
    return parseSuiteDate(testInfo.timestamp, testInfo.testId) || new Date(0);
}

/**
 * "Oct 9, 2026, 7:00 AM", or just the date when no time-of-day is known
 * (shared `formatSuiteDate` drops the time for date-only values).
 * @param {Date} date
 */
function formatSuiteDateTime(date) {
    return formatSuiteDate(date, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true
    }).replace(' at ', ', ');
}

/**
 * Unrounded pass rate (0–100).
 * @param {{ passed: number, total: number } | undefined} stats
 */
function toRateExact(stats) {
    return stats && stats.total > 0 ? (stats.passed / stats.total) * 100 : 0;
}

/**
 * @param {{ passed: number, total: number } | undefined} stats
 */
function toRate(stats) {
    return Math.round(toRateExact(stats));
}

/**
 * Percentage-point change computed from unrounded rates and rounded once, so
 * "64% → 92%" can honestly read "+27 pp" when the exact values are 64.4 → 91.5.
 * @param {{ passed: number, total: number } | undefined} uStats
 * @param {{ passed: number, total: number } | undefined} gStats
 */
function upliftPp(uStats, gStats) {
    return Math.round(toRateExact(gStats) - toRateExact(uStats));
}

/**
 * @param {import('./summary-extractor.js').SuiteA11yStats | undefined} a11y
 * @returns {{ u: { passed: number, total: number }, g: { passed: number, total: number } } | null}
 */
function a11yPair(a11y) {
    if (!a11y || !(a11y.guidedTotal > 0 || a11y.unguidedTotal > 0)) return null;
    return {
        u: { passed: a11y.unguidedPassed, total: a11y.unguidedTotal },
        g: { passed: a11y.guidedPassed, total: a11y.guidedTotal }
    };
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
            return toRateExact(t.guidedStats) - toRateExact(t.unguidedStats);
        case 'a11y': {
            const pair = a11yPair(t.a11yStats);
            return pair ? toRateExact(pair.g) - toRateExact(pair.u) : null;
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
 * @param {number} uRate rounded unguided rate
 * @param {number} gRate rounded guided rate
 * @param {number} delta percentage-point change, computed from unrounded rates
 * @param {string} label used for the screen-reader sentence
 * @param {number} [uErr=0]
 * @param {number} [gErr=0]
 */
function renderRateComparison(uRate, gRate, delta, label, uErr = 0, gErr = 0) {
    const sign = delta > 0 ? '+' : '';
    const deltaClass = delta > 0 ? 'delta up' : (delta < 0 ? 'delta down' : 'delta flat');
    const regressedCls = gRate < uRate ? ' regressed' : '';
    const uErrBand = uErr > 0 ? `<div class="variance-band unguided" style="left: ${(uRate * (1 - uErr / 100)).toFixed(1)}%; width: ${uErr}%;"></div>` : '';
    const gErrBand = gErr > 0 ? `<div class="variance-band guided has-err" style="left: ${(gRate * (1 - gErr / 100)).toFixed(1)}%; width: ${gErr}%;"></div>` : '';
    return `
        <div class="suite-dumbbell-track" aria-hidden="true">
            ${uErrBand}
            ${gErrBand}
            <div class="connector${regressedCls}" style="left: ${Math.min(uRate, gRate)}%; width: ${Math.abs(gRate - uRate)}%;"></div>
            <div class="dot unguided" style="left: ${uRate}%;"></div>
            <div class="dot guided" style="left: ${gRate}%;"></div>
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
 * Glyph (▼/▲) + a visible word ("faster"/"slower", "fewer"/"more") carry the
 * meaning so it survives forced-colors and grayscale; color is reinforcement only.
 * @param {number} deltaPct
 * @param {{ less: string, more: string, noun: string }} words
 */
function renderDeltaPill(deltaPct, words) {
    if (deltaPct < 0) {
        return `<span class="eff-pill metric-delta positive"><span aria-hidden="true">▼ </span>${Math.abs(deltaPct)}% ${escapeHtml(words.less)}<span class="visually-hidden"> (${escapeHtml(words.noun)})</span></span>`;
    }
    if (deltaPct === 0) {
        return `<span class="eff-pill metric-delta neutral">±0%<span class="visually-hidden"> ${escapeHtml(words.noun)}, no change</span></span>`;
    }
    return `<span class="eff-pill metric-delta muted"><span aria-hidden="true">▲ </span>${deltaPct}% ${escapeHtml(words.more)}<span class="visually-hidden"> (${escapeHtml(words.noun)})</span></span>`;
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
    const hiddenAdHoc = filteredKeys.length - visibleKeys.length;
    const colCount = 9;

    // Page both desktop (9 rows = 3 per agent family) and stacked phone cards (10 rows) by default.
    const table = document.querySelector('.suites-table');
    const pageSize = isStacked ? STACKED_PAGE_SIZE : DESKTOP_PAGE_SIZE;
    const paged = !showAllStacked && visibleKeys.length > pageSize;
    table?.classList.toggle('paged', paged && isStacked);
    table?.classList.toggle('paged-desktop', paged && !isStacked);

    renderSuitesCount(visibleKeys.length, filteredKeys.length, hiddenAdHoc, paged, pageSize);
    syncOptionalColumns();

    // Re-rendering detaches the current trigger, so close its preview rather than leave it orphaned.
    if (activeBarbellAnchor && container.contains(activeBarbellAnchor)) {
        hideBarbellTooltip();
    }

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
        const dateDisplay = formatSuiteDate(date, { month: 'short', day: 'numeric', year: 'numeric' });

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
            const a11yURate = toRate(a11y.u);
            const a11yGRate = toRate(a11y.g);
            const a11yPp = upliftPp(a11y.u, a11y.g);
            const a11yGuideCount = testInfo.a11yStats?.guideCount || 0;
            const a11yScope = a11yGuideCount > 0
                ? `${a11yGuideCount} ${a11yGuideCount === 1 ? 'guide' : 'guides'}`
                : overallScope;
            const a11ySub = ['Accessibility subscore', modelPart, a11yScope].filter(Boolean).join(' · ');
            const a11yUDetail = a11y.u.total > 0 ? `${a11y.u.passed.toLocaleString('en-US')}/${a11y.u.total.toLocaleString('en-US')} checks` : '';
            const a11yGDetail = a11y.g.total > 0 ? `${a11y.g.passed.toLocaleString('en-US')}/${a11y.g.total.toLocaleString('en-US')} checks` : '';
            a11yCellAttrs = ` data-barbell-title="${escapeHtml(suiteBarbellTitle)}" data-barbell-sub="${escapeHtml(a11ySub)}" data-barbell-kind="suite-a11y" data-barbell-u="${a11yURate}" data-barbell-g="${a11yGRate}" data-barbell-uplift="${a11yPp}" data-barbell-u-detail="${escapeHtml(a11yUDetail)}" data-barbell-g-detail="${escapeHtml(a11yGDetail)}"`;
            a11yCellHtml = `
                <a href="${a11yLink}" class="a11y-link" interestfor="barbell-tooltip">
                    ${renderRateComparison(a11yURate, a11yGRate, a11yPp, 'Accessibility subscore')}
                    <span class="visually-hidden"> (open accessibility check results)</span>
                </a>
            `;
        } else {
            a11yCellHtml = renderNotAvailable('Accessibility subscore');
        }

        const timeCellHtml = hasRuntime && rt
            ? `
                <div class="eff-cell-main">
                    <span class="metric-primary"><span class="visually-hidden">Median time: unguided </span>${formatDuration(rt.unguidedMedianMs)} <span aria-hidden="true">→</span><span class="visually-hidden">, guided</span> <strong>${formatDuration(rt.guidedMedianMs)}</strong></span>
                    ${renderDeltaPill(rt.medianDeltaPct, { less: 'faster', more: 'slower', noun: 'median time' })}
                </div>
            `
            : renderNotAvailable('Median time');

        const tokenCellHtml = hasTokens && tok
            ? `
                <div class="eff-cell-main">
                    <span class="metric-primary"><span class="visually-hidden">Median uncached tokens: unguided </span>${formatTokens(tok.unguidedUncachedMedian)} <span aria-hidden="true">→</span><span class="visually-hidden">, guided</span> <strong>${formatTokens(tok.guidedUncachedMedian)}</strong></span>
                    ${renderDeltaPill(tok.uncachedMedianDeltaPct, { less: 'fewer', more: 'more', noun: 'uncached tokens' })}
                </div>
            `
            : renderNotAvailable('Median uncached tokens');

        const badges = [
            !scheduled ? '<span class="run-kind-badge">ad hoc</span>' : '',
            isFaulty ? '<span class="run-kind-badge faulty">all runs failed</span>' : ''
        ].join('');

        const metaParts = [
            !scheduled && label ? escapeHtml(label) : '',
            taskCount > 0 ? `${taskCount} tasks${maxRuns > 1 ? ` ×${maxRuns}` : ''}${earlyFailureRate > 0 ? ` (${earlyFailureRate}% err)` : ''}${unguidedLeakRate > 0 ? ` (${unguidedLeakRate}% leak)` : ''}` : '',
            escapeHtml(timeAgo(date)),
            ldap ? escapeHtml(ldap) : ''
        ].filter(Boolean).join(' · ');

        html += `
            <tr class="suite-table-row${isFaulty ? ' faulty' : ''}${scheduled ? '' : ' adhoc'}" data-test-id="${escapeHtml(testId)}">
                <th scope="row" class="suite-cell">
                    <a href="${localLink}" class="suite-link">
                        <time class="suite-label" datetime="${date.toISOString()}">${escapeHtml(dateDisplay)}</time>${badges}
                        <span class="suite-meta">${metaParts}</span>
                    </a>
                </th>
                <td class="agent-cell" data-agent="${escapeHtml(testInfo.agent)}"><span>${getAgentBadge(testInfo.agent)}${escapeHtml(agentDisplay)}</span></td>
                <td>${escapeHtml(servingDisplayNames[testInfo.serving] || testInfo.serving)}</td>
                <td class="model-cell">${escapeHtml(testInfo.model || '')}</td>
                <td class="uplift-cell metric-cell" data-compound-key="${escapeHtml(compoundKey)}" data-barbell-title="${escapeHtml(suiteBarbellTitle)}" data-barbell-sub="${escapeHtml(overallSub)}" data-barbell-kind="suite-overall" data-barbell-u="${uRate}" data-barbell-g="${gRate}" data-barbell-uplift="${overallPp}" data-barbell-u-detail="${escapeHtml(uDetail)}" data-barbell-g-detail="${escapeHtml(gDetail)}" data-barbell-err="${overallErrAttr}">
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
    if (!(drawer instanceof HTMLDetailsElement) || drawer.open) {
        renderPivotInsights();
    }
}

/**
 * Columns whose value is identical for every loaded run carry no information, so
 * hide them (Serving, Source) to keep the table within the page width. Cells stay
 * in the DOM so the stacked-layout labels (nth-child) keep lining up.
 */
function syncOptionalColumns() {
    const table = document.querySelector('.suites-table');
    if (!table) return;
    const all = Object.values(allTestData);
    const servings = new Set(all.map(t => t.serving));
    const sources = new Set(all.map(t => t.source));
    table.classList.toggle('hide-serving', servings.size <= 1 && currentServingFilter === 'all');
    table.classList.toggle('hide-source', isRemoteDashboard() || (sources.size <= 1 && currentSourceFilter === 'all'));
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
            // Keep keyboard users oriented: move focus to the first newly revealed row.
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

// ==========================================
// BREAKDOWNS (by model, by guide)
// ==========================================

/**
 * Explicit anchor shared by the active barbell trigger and `#barbell-tooltip` (landing.css).
 * Explicit rather than the implicit interestfor anchor because the vendored interestfor
 * polyfill and the anchor-positioning polyfill can't rely on implicit anchors.
 */
const BARBELL_ANCHOR = '--barbell-anchor';
/** Without native anchor positioning the tooltip falls back to measured viewport coordinates. */
const SUPPORTS_ANCHOR_POSITIONING = typeof CSS !== 'undefined' && CSS.supports('anchor-name', '--a');
/** The element carrying the shared anchor name: the active trigger's barbell track. */
/** @type {HTMLElement | null} */
let activeBarbellAnchor = null;
let barbellTooltipBound = false;

/**
 * `#barbell-tooltip` is one shared popover="hint" (index.html). Every barbell trigger is a
 * real `<a>`/`<button interestfor="barbell-tooltip">`, so the browser (or the vendored
 * interestfor polyfill) owns hover/focus/long-press, hover persistence, Escape and light
 * dismiss (WCAG 1.4.13) and the trigger's accessible description. All this does is fill in
 * the content for whichever trigger showed interest and move the explicit anchor to it.
 */
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
        // Moving between triggers while open fires no new toggle, so re-place it here too.
        if (!SUPPORTS_ANCHOR_POSITIONING && isPopoverOpen(tooltip) && activeBarbellAnchor) placePopoverFallback(tooltip, activeBarbellAnchor, 'center');
    });
    tooltip.addEventListener('toggle', (e) => {
        if (/** @type {ToggleEvent} */ (e).newState === 'open') {
            if (!SUPPORTS_ANCHOR_POSITIONING && activeBarbellAnchor) placePopoverFallback(tooltip, activeBarbellAnchor, 'center');
        } else {
            setBarbellAnchor(null);
        }
    });
}

/**
 * Without native CSS anchor positioning (e.g. Firefox 146), the anchor polyfill only wires up
 * elements that exist when it runs, so popovers rendered later (the barbell preview's dynamic
 * anchor, the Breakdowns sort/legend hints) would open far from their triggers. In that case
 * only, place each landing popover next to the trigger that showed interest, and close it on
 * scroll since measured coordinates don't follow the trigger.
 */
function setupAnchorPositioningFallback() {
    if (SUPPORTS_ANCHOR_POSITIONING) return;
    // The "Filter runs" menu: its anchor CSS is gated in landing.css (the polyfill offset it by
    // scrollY), so place it under the trigger's inline end here. Placed before the first paint
    // (rAF after beforetoggle) and again on toggle, and kept attached on scroll/resize instead of
    // closing, since it holds a search field and checkboxes.
    const filterMenu = document.getElementById('filter-menu');
    const filterBtn = document.getElementById('filter-btn');
    const placeFilterMenu = () => {
        if (filterMenu && filterBtn && isPopoverOpen(filterMenu)) placePopoverFallback(filterMenu, filterBtn, 'end', 8);
    };
    filterMenu?.addEventListener('beforetoggle', (e) => {
        if (/** @type {ToggleEvent} */ (e).newState === 'open') requestAnimationFrame(placeFilterMenu);
    });
    filterMenu?.addEventListener('toggle', placeFilterMenu);
    window.addEventListener('resize', placeFilterMenu, { passive: true });
    // `toggle` doesn't bubble, so listen in the capture phase to cover hints rendered later.
    document.addEventListener('toggle', (e) => {
        const hint = e.target;
        if (!(hint instanceof HTMLElement) || !hint.classList.contains('hint-popover')) return;
        if (/** @type {ToggleEvent} */ (e).newState !== 'open') return;
        const trigger = document.querySelector(`[interestfor="${CSS.escape(hint.id)}"]`);
        // The uplift sort buttons sit at the panel's inline end (mirrors landing.css).
        if (trigger) placePopoverFallback(hint, trigger, hint.id.startsWith('hint-sort-uplift-') ? 'end' : 'start');
    }, true);
    document.addEventListener('scroll', (e) => {
        // Scrolling inside the menu's own list doesn't move the trigger.
        if (!(e.target instanceof Node && filterMenu?.contains(e.target))) placeFilterMenu();
        document.querySelectorAll('#barbell-tooltip, .hint-popover').forEach(el => {
            if (el instanceof HTMLElement) setPopoverOpen(el, false);
        });
    }, { capture: true, passive: true });
}

/**
 * The element carrying the `data-barbell-*` attributes for a trigger: its own cell, or (for
 * pivot rows whose trigger is the guide link/model button in the row header) the row's barbell cell.
 * @param {HTMLElement} trigger
 * @returns {HTMLElement | null}
 */
function getBarbellDataCell(trigger) {
    const cell = trigger.closest('[data-barbell-title]') || trigger.closest('tr')?.querySelector('[data-barbell-title]');
    return cell instanceof HTMLElement ? cell : null;
}

/**
 * The box the barbell preview sits next to: the trigger's barbell track (suites table cells,
 * pivot rows), not the trigger itself, which for pivot guide/model rows is the link or button in
 * the row header. Falls back to the data cell, then the trigger, if the track isn't rendered.
 * @param {HTMLElement} trigger
 * @returns {HTMLElement}
 */
function getBarbellAnchorElement(trigger) {
    const cell = getBarbellDataCell(trigger);
    const track = cell?.querySelector('.suite-dumbbell-track, .insight-dumbbell-track');
    if (track instanceof HTMLElement && track.getClientRects().length > 0) return track;
    return cell || trigger;
}

/**
 * Gives only the active trigger's barbell track the shared anchor name (MWG
 * interest-triggered-tooltips: one unique anchor-name/position-anchor pair).
 * @param {HTMLElement | null} trigger
 */
function setBarbellAnchor(trigger) {
    const anchor = trigger ? getBarbellAnchorElement(trigger) : null;
    if (activeBarbellAnchor && activeBarbellAnchor !== anchor) {
        activeBarbellAnchor.style.removeProperty('anchor-name');
    }
    activeBarbellAnchor = anchor;
    anchor?.style.setProperty('anchor-name', BARBELL_ANCHOR);
}

/**
 * Fallback for browsers without CSS anchor positioning only: place an open popover below (or,
 * when there's no room, above) `trigger`, clamped to the viewport.
 * @param {HTMLElement} popover
 * @param {Element} trigger
 * @param {'center' | 'start' | 'end'} align
 * @param {number} [gap] Space between the trigger and the popover, in px.
 */
function placePopoverFallback(popover, trigger, align, gap = 6) {
    const rect = trigger.getBoundingClientRect();
    const w = popover.offsetWidth || 290;
    const h = popover.offsetHeight || 175;
    const left = align === 'center' ? rect.left + (rect.width / 2) - (w / 2) : (align === 'end' ? rect.right - w : rect.left);
    let top = rect.bottom + gap;
    if (top + h > window.innerHeight - 8 && rect.top - h - gap >= 8) {
        top = rect.top - h - gap;
    }
    popover.style.right = 'auto';
    popover.style.bottom = 'auto';
    popover.style.left = `${Math.max(8, Math.min(left, window.innerWidth - w - 8))}px`;
    popover.style.top = `${Math.max(8, Math.min(top, window.innerHeight - h - 8))}px`;
}

/**
 * Builds the barbell preview from a cell's `data-barbell-*` attributes.
 * @param {HTMLElement} cell
 * @returns {string}
 */
function renderBarbellTooltipContent(cell) {
    const title = cell.dataset.barbellTitle || '';
    const kind = cell.dataset.barbellKind || 'guide';
    const metric = cell.dataset.barbellMetric || 'Pass rate';
    const runs = parseInt(cell.dataset.barbellRuns || '0') || 0;
    const uRate = parseInt(cell.dataset.barbellU || '0') || 0;
    const gRate = parseInt(cell.dataset.barbellG || '0') || 0;
    const uplift = parseInt(cell.dataset.barbellUplift || '0') || 0;
    const uSd = cell.dataset.barbellUSd || '';
    const gSd = cell.dataset.barbellGSd || '';
    const uDetail = cell.dataset.barbellUDetail || '';
    const gDetail = cell.dataset.barbellGDetail || '';
    const hasErr = cell.dataset.barbellErr === '1';

    const sign = uplift > 0 ? '+' : '';
    const liftCls = uplift > 0 ? 'up' : (uplift < 0 ? 'down' : 'flat');
    const runsText = `${runs} ${runs === 1 ? 'run' : 'runs'}`;
    const subText = cell.dataset.barbellSub || `${metric} · median across ${runsText}`;

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
    } else if (kind === 'guide') {
        note = `Vertical ticks mark the median ${metric.toLowerCase()} without MWG and with MWG across ${runsText} in this date window; the horizontal bar spans the median lift.${runs > 1 ? ' Shaded bands show ±1 standard deviation across runs.' : ''}`;
    } else if (kind === 'dimension') {
        note = `Vertical ticks mark the median accessibility pass rate without MWG and with MWG across ${runsText} for this dimension; the horizontal bar spans the median lift.`;
    } else {
        note = `Vertical ticks mark this model’s median suite ${metric.toLowerCase()} without MWG and with MWG across ${runsText}; the horizontal bar spans the median lift.${hasErr ? ' Shaded bands indicate uncertainty from runs that failed before grading.' : ''}`;
    }

    return `
        <div class="barbell-tooltip-title">${escapeHtml(title)}</div>
        <div class="barbell-tooltip-sub">${escapeHtml(subText)}</div>
        <div class="barbell-tooltip-rows">
            <div class="barbell-tooltip-row">
                <span class="barbell-tooltip-label"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span>
                <strong>${uRate}%${uExtraHtml}</strong>
            </div>
            <div class="barbell-tooltip-row">
                <span class="barbell-tooltip-label"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span>
                <strong class="rate-g">${gRate}%${gExtraHtml}</strong>
            </div>
            <div class="barbell-tooltip-row barbell-tooltip-lift">
                <span>${escapeHtml(liftLabel)}</span>
                <strong class="delta ${liftCls}">${sign}${uplift} pp</strong>
            </div>
        </div>
        <p class="barbell-tooltip-note">${escapeHtml(note)}</p>
    `;
}

function hideBarbellTooltip() {
    const tooltip = document.getElementById('barbell-tooltip');
    if (tooltip) setPopoverOpen(tooltip, false);
}

/**
 * Restricts the visible runs to the most recent N distinct run-dates (or all).
 * @returns {string[]}
 */
function getInsightKeys() {
    let keys = getVisibleKeys();
    const limitInput = document.getElementById('insights-limit-input');
    const showAllCheck = document.getElementById('insights-show-all-check');
    const showAll = showAllCheck instanceof HTMLInputElement ? showAllCheck.checked : false;
    const limit = limitInput instanceof HTMLInputElement ? (parseInt(limitInput.value) || 5) : 5;

    if (!showAll && keys.length > 0) {
        // Same viewer-zone calendar day as the runs table and the guide.html timeline.
        const dayOf = (/** @type {string} */ k) => getSuiteDayKey(getSuiteDate(allTestData[k]));
        const sortedDates = [...new Set(keys.map(dayOf))].sort((a, b) => a.localeCompare(b));
        const activeDates = new Set(sortedDates.slice(-limit));
        keys = keys.filter(k => activeDates.has(dayOf(k)));
    }
    return keys;
}

/** @typedef {{ uplift: number, uRate: number, gRate: number, uErr?: number, gErr?: number, rtDeltaPct?: number | null, tokDeltaPct?: number | null, description?: string }} PivotItem */
/** @typedef {'alpha' | 'uplift-desc' | 'uplift-asc'} PanelSortMode */
/** @type {Record<'model' | 'dimension', PanelSortMode>} */
const currentPanelSorts = { model: 'alpha', dimension: 'uplift-desc' };
/** @type {Record<'model' | 'dimension' | 'guide', boolean>} */
const expandedPanels = { model: false, dimension: false, guide: false };

function renderPivotInsights() {
    const container = document.getElementById('insights-container');
    if (!container) return;

    // Re-rendering detaches the current trigger, so close its preview rather than leave it orphaned.
    if (activeBarbellAnchor && container.contains(activeBarbellAnchor)) {
        hideBarbellTooltip();
    }

    /** @type {Record<string, number>} */
    const savedScrollPositions = {};
    container.querySelectorAll('.insights-table-scroll[data-scroll-section]').forEach(el => {
        if (el instanceof HTMLElement && el.dataset.scrollSection) {
            savedScrollPositions[el.dataset.scrollSection] = el.scrollTop;
        }
    });

    const keys = getInsightKeys();
    const onlyA11y = currentInsightsMode === 'a11y';

    /** @type {{ model: Record<string, PivotItem[]>, guide: Record<string, PivotItem[]>, dimension: Record<string, PivotItem[]> }} */
    const grouped = { model: {}, guide: {}, dimension: {} };

    keys.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo) return;

        const rt = testInfo.efficiencyStats?.runtime;
        const rtDeltaPct = (rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0)) ? rt.medianDeltaPct : null;
        const tok = testInfo.efficiencyStats?.tokens;
        const tokDeltaPct = (tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0)) ? tok.uncachedMedianDeltaPct : null;
        const earlyFailureRate = testInfo.earlyFailureRate || 0;
        const uErr = testInfo.unguidedErrorRate ?? earlyFailureRate;
        const gErr = testInfo.guidedErrorRate ?? earlyFailureRate;

        /** @type {PivotItem | null} */
        let item = null;
        if (onlyA11y) {
            const pair = a11yPair(testInfo.a11yStats);
            if (pair) {
                item = { uplift: upliftPp(pair.u, pair.g), uRate: toRate(pair.u), gRate: toRate(pair.g), uErr, gErr, rtDeltaPct, tokDeltaPct };
            }
            const bySub = testInfo.a11yStats?.bySubCategory;
            if (bySub) {
                A11Y_SUBCATEGORIES.forEach(sub => {
                    const sc = bySub[sub.id];
                    if (!sc || (sc.unguidedTotal === 0 && sc.guidedTotal === 0)) return;
                    const u = { passed: sc.unguidedPassed || 0, total: sc.unguidedTotal || 0 };
                    const g = { passed: sc.guidedPassed || 0, total: sc.guidedTotal || 0 };
                    (grouped.dimension[sub.id] ||= []).push({
                        uplift: upliftPp(u, g),
                        uRate: toRate(u),
                        gRate: toRate(g),
                        description: sub.description
                    });
                });
            }
        } else if ((testInfo.guidedStats?.total || 0) > 0 && (testInfo.unguidedStats?.total || 0) > 0) {
            item = {
                uplift: upliftPp(testInfo.unguidedStats, testInfo.guidedStats),
                uRate: toRate(testInfo.unguidedStats),
                gRate: toRate(testInfo.guidedStats),
                uErr,
                gErr,
                rtDeltaPct,
                tokDeltaPct
            };
        }
        if (item && testInfo.model) {
            (grouped.model[testInfo.model] ||= []).push(item);
        }

        const suiteGuides = testInfo.guides || {};
        Object.keys(suiteGuides).forEach(guide => {
            const gEntry = suiteGuides[guide];
            const src = onlyA11y ? gEntry.a11y : gEntry;
            if (!src) return;
            const u = { passed: src.unguidedPassed || 0, total: src.unguidedTotal || 0 };
            const g = { passed: src.guidedPassed || 0, total: src.guidedTotal || 0 };
            if (onlyA11y ? (u.total === 0 && g.total === 0) : (u.total === 0 || g.total === 0)) return;
            (grouped.guide[guide] ||= []).push({ uplift: upliftPp(u, g), uRate: toRate(u), gRate: toRate(g) });
        });
    });

    /** @param {PivotItem[]} arr */
    const getMedianItem = (arr) => {
        if (arr.length === 0) return { uRate: 0, gRate: 0, uplift: 0 };
        const sorted = [...arr].sort((a, b) => a.uplift - b.uplift);
        return sorted[Math.floor(sorted.length / 2)];
    };

    /** @param {number[]} vals */
    const getMedianNumber = (vals) => {
        if (vals.length === 0) return null;
        return Math.round(median(vals));
    };

    /** @param {number[]} vals */
    const calculateSD = (vals) => {
        if (vals.length <= 1) return 0;
        const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
        return Math.sqrt(variance);
    };

    const params = new URLSearchParams(window.location.search);
    const effectiveSource = params.get('source') || api.source;
    const sourceQuery = effectiveSource ? `&source=${encodeURIComponent(effectiveSource)}` : '';

    /**
     * @param {Record<string, PivotItem[]>} groupObj
     * @param {'model' | 'guide' | 'dimension'} filterKey
     */
    const renderPivotTable = (groupObj, filterKey) => {
        const keys = Object.keys(groupObj);
        if (keys.length === 0) {
            return '<p class="pivot-empty">No data for the current selection.</p>';
        }

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
                    if (upliftA !== upliftB) {
                        return sortMode === 'uplift-desc' ? upliftB - upliftA : upliftA - upliftB;
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

            const isActive = filterKey === 'model' && currentModelFilter === key;
            let nameHtml = '';
            let effSummary = '';
            let displayTitle = key;

            if (filterKey === 'guide') {
                const modeQuery = onlyA11y ? '&mode=a11y' : '';
                nameHtml = `<a class="pivot-link" href="guide.html?guide=${encodeURIComponent(key)}${sourceQuery}${modeQuery}" interestfor="barbell-tooltip">${escapeHtml(key)}</a>`;
                effSummary = `<span class="pivot-trials">${items.length} ${items.length === 1 ? 'run' : 'runs'}</span>`;
            } else if (filterKey === 'dimension') {
                const subMeta = A11Y_SUBCATEGORIES.find(s => s.id === key);
                const label = subMeta ? subMeta.label : key;
                const desc = subMeta ? subMeta.description : '';
                displayTitle = label;
                nameHtml = `<span class="pivot-static-name">${escapeHtml(label)}</span>`;
                effSummary = desc ? `<span class="pivot-trials">${escapeHtml(desc)}</span>` : '';
            } else {
                nameHtml = `<button type="button" class="pivot-filter-btn" data-filter-key="${filterKey}" data-filter-value="${escapeHtml(key)}" aria-pressed="${isActive}" interestfor="barbell-tooltip">${escapeHtml(key)}</button>`;
                const rtMed = getMedianNumber(/** @type {number[]} */ (items.map(i => i.rtDeltaPct).filter(v => typeof v === 'number')));
                const tokMed = getMedianNumber(/** @type {number[]} */ (items.map(i => i.tokDeltaPct).filter(v => typeof v === 'number')));
                const fmtSignedPct = (/** @type {number} */ v) => v > 0 ? `+${v}%` : (v < 0 ? `−${Math.abs(v)}%` : '0%');
                const parts = [
                    `${items.length} ${items.length === 1 ? 'run' : 'runs'}`,
                    rtMed !== null ? `time ${fmtSignedPct(rtMed)}` : '',
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
            const barbellTrackHtml = `
                            <span class="insight-dumbbell-track" aria-hidden="true">
                                ${uBandHtml}
                                ${gBandHtml}
                                <span class="connector${regressedCls}" style="left: ${Math.min(uRate, gRate)}%; width: ${Math.abs(gRate - uRate)}%;"></span>
                                <span class="dot unguided" style="left: ${uRate}%;"></span>
                                <span class="dot guided" style="left: ${gRate}%;"></span>
                            </span>`;
            const rateTextHtml = `
                            <span class="rate-text">
                                <span class="visually-hidden">Median unguided </span>${uRate}%
                                <span class="rate-arrow" aria-hidden="true">→</span><span class="visually-hidden">, guided </span>${gRate}%
                                <span class="delta ${medUplift > 0 ? 'up' : (medUplift < 0 ? 'down' : 'flat')}">(${sign}${medUplift} pp)</span>
                            </span>`;
            // Dimension rows have no other control, so the barbell itself is the interest invoker for
            // #barbell-tooltip: a real, named, focusable button. Guide and model rows already have a
            // keyboard/pointer trigger in the row header (the link/filter button, with interestfor),
            // whose stretched ::after hit area covers the whole row (landing.css), so hovering or
            // clicking the barbell reaches that trigger. Their rate text stays plain cell content so
            // screen readers read the medians in table navigation.
            const barbellCellHtml = filterKey === 'dimension'
                ? `<button type="button" class="pivot-barbell-btn" interestfor="barbell-tooltip" aria-label="${escapeHtml(`${displayTitle}: median unguided ${uRate}%, guided ${gRate}% (${sign}${medUplift} pp)`)}">${barbellTrackHtml}${rateTextHtml}
                        </button>`
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
                        data-barbell-err="${errAttr}">
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
        const table = `
            <table class="insights-table">
                <caption class="visually-hidden">Median ${metricName.toLowerCase()} by ${captionNoun}, unguided vs. guided${showVariance ? ' (bands show one standard deviation across runs)' : ''}</caption>
                <thead class="${filterKey === 'guide' ? 'pivot-head' : 'visually-hidden'}"><tr><th scope="col"${firstColAriaSort}>${escapeHtml(colHeader)}</th><th scope="col"${secondColAriaSort}>${escapeHtml(metricName)} <span class="pivot-head-note">unguided → guided (median)</span></th></tr></thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        `;
        const isExpanded = Boolean(expandedPanels[filterKey]);
        const scrollCls = `insights-table-scroll${filterKey === 'guide' ? ' pivot-scroll' : ''}${isExpanded ? ' is-expanded' : ''}`;
        const label = filterKey === 'guide' ? 'By guide table (scrolls vertically)' : `By ${captionNoun} table (scrolls vertically)`;
        return `<div class="${scrollCls}" data-scroll-section="${filterKey}" tabindex="0" role="region" aria-label="${label}">${table}</div>`;
    };

    /**
     * @param {'model' | 'dimension'} panelKey
     * @param {string} titleHtml
     */
    const renderPanelHeader = (panelKey, titleHtml) => {
        const sortMode = currentPanelSorts[panelKey] || 'alpha';
        const isSorted = sortMode === 'uplift-desc' || sortMode === 'uplift-asc';
        const arrow = sortMode === 'uplift-desc' ? '↓' : (sortMode === 'uplift-asc' ? '↑' : '↕');
        const panelNoun = panelKey === 'dimension' ? 'accessibility dimensions' : 'models';
        const nextTitle = sortMode === 'alpha' ? `Sort ${panelNoun} by uplift (high to low)` : (sortMode === 'uplift-desc' ? `Sort ${panelNoun} by uplift (low to high)` : `Reset ${panelNoun} to alphabetical sort`);
        // Interest-triggered hints (button[interestfor] + popover="hint") instead of title
        // attributes, so keyboard (focus) and touch (long-press) users can read them too.
        // No aria-label on the uplift button: the hint already becomes its description, so a
        // label with the same text would be announced twice (name + description).
        const alphaHintId = `hint-sort-alpha-${panelKey}`;
        const upliftHintId = `hint-sort-uplift-${panelKey}`;
        return `
            <div class="insights-panel-header">
                <h3 class="insights-panel-title">
                    <button type="button" class="insights-panel-title-btn anchor-${alphaHintId}" data-panel-title-sort="${panelKey}" aria-pressed="${sortMode === 'alpha'}" interestfor="${alphaHintId}">${titleHtml}</button>
                </h3>
                <button type="button" class="insights-uplift-sort-btn anchor-${upliftHintId}${isSorted ? ' is-sorted' : ''}" data-panel-uplift-sort="${panelKey}" aria-pressed="${isSorted}" interestfor="${upliftHintId}">
                    <span>Uplift</span>
                    <span class="insights-uplift-sort-arrow" aria-hidden="true">${arrow}</span>
                </button>
                <div id="${alphaHintId}" popover="hint" class="hint-popover">Sort ${panelNoun} alphabetically</div>
                <div id="${upliftHintId}" popover="hint" class="hint-popover">${nextTitle}</div>
            </div>
        `;
    };

    /** @param {'model' | 'dimension' | 'guide'} panelKey */
    const renderExpandRow = (panelKey) => {
        const isExpanded = Boolean(expandedPanels[panelKey]);
        return `
            <div class="insights-expand-row">
                <button type="button" class="insights-expand-btn${isExpanded ? ' is-expanded' : ''}" data-expand-panel="${panelKey}" aria-expanded="${isExpanded}">
                    <span>${isExpanded ? 'Collapse' : 'Expand'}</span>
                    <svg class="insights-expand-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                        <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                    </svg>
                </button>
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
    const currentSortOption = sortOptions.find(opt => opt.value === currentGuideSort) || sortOptions[0];
    const sortOptionsHtml = sortOptions.map(opt =>
        `<option value="${opt.value}" ${currentGuideSort === opt.value ? 'selected' : ''}>${opt.label}</option>`
    ).join('');
    const dirLabel = currentGuideSortDir === 'asc' ? 'ascending' : 'descending';
    const dirArrow = currentGuideSortDir === 'asc' ? '↑' : '↓';
    const modeSuffix = onlyA11y ? ' <span class="mode-badge-inline">Accessibility checks</span>' : '';
    const guideCount = Object.keys(grouped.guide).length;
    const runCount = keys.length;
    const dimensionPanelHtml = onlyA11y && Object.keys(grouped.dimension).length > 0
        ? `
        <div class="insights-panel insights-dimension-panel" data-panel="dimension">
            ${renderPanelHeader('dimension', `By Accessibility Dimension (${Object.keys(grouped.dimension).length})${modeSuffix}`)}
            ${renderPivotTable(grouped.dimension, 'dimension')}
            ${renderExpandRow('dimension')}
        </div>`
        : '';

    container.innerHTML = `
        <p class="insights-scope">Based on ${runCount} run${runCount === 1 ? '' : 's'} matching current filters (medians across runs).</p>
        ${dimensionPanelHtml}
        <div class="insights-panel" data-panel="model">
            ${renderPanelHeader('model', `By Model${modeSuffix}`)}
            ${renderPivotTable(grouped.model, 'model')}
            ${renderExpandRow('model')}
        </div>
        <div class="insights-panel insights-panel-full insights-guide-drawer" data-panel="guide">
            <div class="insights-guide-body">
                <div class="insights-panel-header-row">
                    <h3 class="insights-panel-title" tabindex="-1">By Guide (${guideCount})${modeSuffix}</h3>
                    <div class="guide-legend">
                        <span class="guide-legend-item">
                            <span class="guide-legend-swatch unguided"><span class="guide-legend-tick"></span></span>
                            <span>Unguided</span>
                        </span>
                        <span class="guide-legend-vs">vs.</span>
                        <span class="guide-legend-item">
                            <span class="guide-legend-swatch guided"><span class="guide-legend-tick"></span></span>
                            <span>Guided</span>
                        </span>
                        <button type="button" class="info-hint-btn anchor-hint-guide-legend" interestfor="hint-guide-legend" aria-label="About the bands and ticks">?</button>
                        <div id="hint-guide-legend" popover="hint" class="hint-popover">Shaded band shows ±1 standard deviation across runs; the vertical tick mark shows the median rate.</div>
                    </div>
                    <div class="guide-sort-controls">
                        <label for="guide-sort-select" class="sort-label">Sort by:</label>
                        <div class="sort-combined-control">
                            <div class="sort-select-pill">
                                <span class="sort-select-value">${currentSortOption.label}</span>
                                <svg class="sort-select-chevron" xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16" aria-hidden="true">
                                    <path fill-rule="evenodd" d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/>
                                </svg>
                                <select id="guide-sort-select" class="sort-select">${sortOptionsHtml}</select>
                            </div>
                            <span class="sort-combined-divider" aria-hidden="true"></span>
                            <button id="guide-sort-dir-btn" class="sort-direction-btn" type="button" aria-label="Sort direction: ${dirLabel}. Toggle." aria-pressed="${currentGuideSortDir === 'desc'}">
                                <span class="sort-dir-arrow" aria-hidden="true">${dirArrow}</span>
                            </button>
                        </div>
                    </div>
                </div>
                ${renderPivotTable(grouped.guide, 'guide')}
                ${renderExpandRow('guide')}
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
                /** @type {HTMLElement | null} */ (container.querySelector(`.insights-panel-title-btn[data-panel-title-sort="${key}"]`))?.focus();
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
            /** @type {HTMLElement | null} */ (container.querySelector(`.insights-uplift-sort-btn[data-panel-uplift-sort="${key}"]`))?.focus();
        });
    });

    container.querySelectorAll('.insights-expand-btn[data-expand-panel]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!(btn instanceof HTMLElement)) return;
            const key = /** @type {'model' | 'dimension' | 'guide' | undefined} */ (btn.dataset.expandPanel);
            if (!key) return;
            expandedPanels[key] = !expandedPanels[key];
            renderPivotInsights();
            /** @type {HTMLElement | null} */ (container.querySelector(`.insights-expand-btn[data-expand-panel="${key}"]`))?.focus();
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
