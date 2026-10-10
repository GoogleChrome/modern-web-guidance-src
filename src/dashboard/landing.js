import { initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, timeAgo, calculateChartData, formatDuration, formatTokens, median, isLocalDashboardHost, $ } from './utils.js';
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

/** @type {Record<string, LandingSuiteSummary>} */
let allTestData = {}; // Cache all test data by testId
/** @type {Set<string>} */
let selectedTestIds = new Set(); // Set of test IDs to show
/** @type {SourceFilter} */
let currentSourceFilter = 'all';
/** @type {string} */
let currentAgentFilter = 'all';
/** @type {string} */
let currentServingFilter = 'all';
/** @type {string} */
let currentModelFilter = 'all';

// Guides Pivot Table Sort State
/** @type {GuideSortKey} */
let currentGuideSort = 'alphabetic';
/** @type {SortDirection} */
let currentGuideSortDir = 'asc';
/** @type {InsightsMode} */
let currentInsightsMode = 'all';

function isRemoteDashboard() {
    return !isLocalDashboardHost();
}

/** @type {Record<string, string>} */
const servingDisplayNames = {
    'skills': 'Skills',
    'skills_cli': 'Skills (CLI)',
    'mcp': 'MCP'
};
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize UI
        setupTestFilters(); // New filter setup
        setupTableFilters();
        setupInsightsTimelineFilters();

        const params = new URLSearchParams(window.location.search);
        
        // Wait for auth before loading if remote is needed. We load local immediately, remote when auth'd
        initGoogleAuth(async () => {
             await loadRemoteTests();
        });

        await loadLocalTests();
        if (getAccessToken()) {
             await loadRemoteTests();
        }

        // Initialize with default states relative to compoundKeys instead of simple testIDs
        selectedTestIds = new Set(Object.keys(allTestData));

        let initialTests = params.get('tests');
        if (initialTests && initialTests.trim() !== '') {
            const requestedIds = initialTests.split(',').filter(id => id.trim() !== '');
            const matchIds = new Set();
            requestedIds.forEach(req => {
                if (allTestData[req]) { matchIds.add(req); }
            });

            if (matchIds.size > 0) {
                selectedTestIds = matchIds;
            }
        }

        // Update filter UI to match initial state
        renderFilterMenuItems();

        // Initial Render
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

    selectedTestIds = new Set(Object.keys(allTestData)); // Default to all
    const testsParam = params.get('tests');
    if (testsParam && testsParam.trim() !== '') {
        const requestedIds = testsParam.split(',').filter(id => id.trim() !== '');
        const matchIds = new Set();
        requestedIds.forEach(req => {
            if (allTestData[req]) { matchIds.add(req); }
        });
        if (matchIds.size > 0) {
            selectedTestIds = matchIds;
        }
    }
    renderFilterMenuItems();
    renderAll();
});

function setupTestFilters() {
    const filterBtn = $('#filter-btn');
    const filterMenu = $('#filter-menu');
    const selectAllBtn = $('#select-all-btn');
    const deselectAllBtn = $('#deselect-all-btn');
    const list = $('#filter-list');
    const searchInput = $('#filter-search');

    // Make list scrollable
    list.style.maxHeight = '300px';
    list.style.overflowY = 'auto';

    // Toggle Menu
    filterBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        filterMenu.classList.toggle('hidden');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        const target = e.target;
        if (target instanceof Node && filterMenu && filterBtn) {
            if (!filterMenu.contains(target) && !filterBtn.contains(target)) {
                filterMenu.classList.add('hidden');
            }
        }
    });

    // Select All
    selectAllBtn.addEventListener('click', () => {
        selectedTestIds = new Set(Object.keys(allTestData));
        updateUrlParams();
        renderFilterMenuItems();
        renderAll();
    });

    // Deselect All
    deselectAllBtn.addEventListener('click', () => {
        selectedTestIds.clear();
        updateUrlParams();
        renderFilterMenuItems();
        renderAll();
    });

    // Search functionality
    searchInput.addEventListener('input', (e) => {
        const target = e.target;
        if (!(target instanceof HTMLInputElement)) return;
        const term = target.value.toLowerCase();
        const items = list.querySelectorAll('.filter-item');
        items.forEach(item => {
            if (item instanceof HTMLElement) {
                const labelEl = item.querySelector('.filter-item-label');
                const label = labelEl ? labelEl.textContent.toLowerCase() : '';
                item.style.display = label.includes(term) ? 'flex' : 'none';
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

function setupInsightsTimelineFilters() {
    const limitInput = /** @type {HTMLInputElement} */ (document.getElementById('insights-limit-input'));
    const showAllCheck = /** @type {HTMLInputElement} */ (document.getElementById('insights-show-all-check'));
    const modeAllBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('insights-mode-all'));
    const modeA11yBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('insights-mode-a11y'));

    if (limitInput) {
        limitInput.addEventListener('change', () => {
            let val = parseInt(limitInput.value);
            if (isNaN(val) || val < 1) val = 15;
            limitInput.value = val.toString();
            renderPivotInsights();
        });
        limitInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                limitInput.blur();
            }
        });
    }

    if (showAllCheck) {
        showAllCheck.addEventListener('change', () => {
            if (limitInput) {
                limitInput.disabled = showAllCheck.checked;
                limitInput.style.opacity = showAllCheck.checked ? '0.5' : '1';
            }
            renderPivotInsights();
        });
    }

    const setMode = (/** @type {InsightsMode} */ mode) => {
        currentInsightsMode = mode;
        if (modeAllBtn) modeAllBtn.setAttribute('aria-pressed', String(mode === 'all'));
        if (modeA11yBtn) modeA11yBtn.setAttribute('aria-pressed', String(mode === 'a11y'));
        renderPivotInsights();
    };

    if (modeAllBtn) {
        modeAllBtn.addEventListener('click', () => setMode('all'));
    }
    if (modeA11yBtn) {
        modeA11yBtn.addEventListener('click', () => setMode('a11y'));
    }
}

/**
 * @param {any} el
 */
function syncSelectStyles(el) {
    el.classList.toggle('is-filtered', el.value !== 'all');
}


function renderFilterMenuItems() {
    const list = $('#filter-list');
    list.innerHTML = '';

    // Get all tests sorted by date
    const sortedIds = Object.keys(allTestData).sort((a, b) => {
        return new Date(allTestData[b].timestamp).getTime() - new Date(allTestData[a].timestamp).getTime();
    });

    sortedIds.forEach(compoundKey => {
        const item = document.createElement('label');
        item.className = 'filter-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedTestIds.has(compoundKey);
        checkbox.value = compoundKey;

        checkbox.addEventListener('change', (e) => {
            const target = e.target;
            if (target instanceof HTMLInputElement) {
                if (target.checked) {
                    selectedTestIds.add(compoundKey);
                } else {
                    selectedTestIds.delete(compoundKey);
                }
                updateUrlParams();
                renderAll();
            }
        });

        const labelContent = document.createElement('div');
        labelContent.className = 'filter-item-label';

        const testInfo = allTestData[compoundKey];

        const idSpan = document.createElement('span');
        idSpan.textContent = testInfo.testId.replace('test_', '') + ` (${testInfo.source})`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'filter-item-date';

        const _d = new Date(testInfo.timestamp);
        dateSpan.textContent = _d.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(' at ', ', ');

        labelContent.appendChild(idSpan);
        labelContent.appendChild(dateSpan);

        item.appendChild(checkbox);
        item.appendChild(labelContent);
        list.appendChild(item);
    });
}

function updateUrlParams() {
    const url = new URL(window.location.href);
    const allIds = Object.keys(allTestData);

    // If all are selected, remove param
    if (selectedTestIds.size === allIds.length) {
        url.searchParams.delete('tests');
    } else {
        // Only list selected
        url.searchParams.set('tests', Array.from(selectedTestIds).join(','));
    }

    window.history.replaceState({}, '', url);
}

function renderAll() {
    renderSuites();
}



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
            const emptyState = document.getElementById('empty-state');
            if (emptyState) emptyState.style.display = 'none';
        }

        // Load local test data
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

        // Re-render UI now that we have remote data
        const params = new URLSearchParams(window.location.search);
        let initialTests = params.get('tests');
        if (!initialTests || initialTests.trim() === '') {
            selectedTestIds = new Set(Object.keys(allTestData));
        }
        renderFilterMenuItems();
        renderAll();

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
    updateFilterOptions('filter-serving-group', 'serving');
    updateServingFilterOptions();
    updateAgentFilterOptions();
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
 * @param {string} groupId
 * @param {keyof LandingSuiteSummary} key
 */
function updateFilterOptions(groupId, key) {
    const group = document.getElementById(groupId);
    if (!group) return;

    const values = [...new Set(Object.values(allTestData).map(t => t[key]).filter(Boolean))].sort();
    
    const currentOptions = Array.from(group.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(values)) return;

    group.innerHTML = values.map(val => 
        `<option value="${escapeHtml(val)}">${escapeHtml(val)}</option>`
    ).join('');
}

function updateServingFilterOptions() {
    const servingGroup = document.getElementById('filter-serving-group');
    if (!servingGroup) return;

    const servs = new Set();
    Object.values(allTestData).forEach(test => {
        if (test.serving) servs.add(test.serving);
    });

    const sortedServs = Array.from(servs).sort();
    
    const currentOptions = Array.from(servingGroup.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(sortedServs)) return;

    servingGroup.innerHTML = sortedServs.map(s => 
        `<option value="${escapeHtml(s)}">${escapeHtml(servingDisplayNames[s] || s)}</option>`
    ).join('');
}

function updateAgentFilterOptions() {
    const agentGroup = document.getElementById('filter-agent-group');
    if (!agentGroup) return;

    const agents = new Set();
    Object.values(allTestData).forEach(test => {
        if (test.agent) agents.add(test.agent);
    });

    const sortedAgents = Array.from(agents).sort();
    
    const currentOptions = Array.from(agentGroup.querySelectorAll('option')).map(o => o.value);
    if (JSON.stringify(currentOptions) === JSON.stringify(sortedAgents)) return;

    agentGroup.innerHTML = sortedAgents.map(a => 
        `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`
    ).join('');
}

// ==========================================
// RENDERERS
// ==========================================

function renderSuites() {
    const testIds = getSortedTestIds();
    const container = $('#suites-list');
    const headerSource = document.getElementById('header-source');
    if (headerSource) {
        headerSource.style.display = isRemoteDashboard() ? 'none' : '';
    }

    if (testIds.length === 0) return;

    let html = '';

    testIds.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        const testId = testInfo.testId;

        // Apply filters
        if (currentSourceFilter !== 'all' && testInfo.source !== currentSourceFilter) return;
        if (currentAgentFilter !== 'all' && testInfo.agent !== currentAgentFilter) return;
        if (currentServingFilter !== 'all' && testInfo.serving !== currentServingFilter) return;
        if (currentModelFilter !== 'all' && testInfo.model !== currentModelFilter) return;

        let _date = new Date(testInfo.timestamp);
        
        // Match Action Date logic from dashboard.js: 
        // If timestamp is missing or is exactly midnight (often indicates only a date was provided),
        // try to extract a more specific date from the testId.
        const timeStr = _date.toLocaleTimeString('en-US');
        if (timeStr === '12:00:00 AM' || isNaN(_date.getTime())) {
            // Try to match YYYY-MM-DDTHH-mm-ss or YYYY-MM-DD
            const isoLikeMatch = testId.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
            const dateOnlyMatch = testId.match(/(\d{4}-\d{2}-\d{2})/);
            
            if (isoLikeMatch) {
                // Reconstruct to a valid ISO string YYYY-MM-DDTHH:mm:ss
                const isoStr = `${isoLikeMatch[1]}T${isoLikeMatch[2]}:${isoLikeMatch[3]}:${isoLikeMatch[4]}`;
                const parsedDate = new Date(isoStr);
                if (!isNaN(parsedDate.getTime())) {
                    _date = parsedDate;
                }
            } else if (dateOnlyMatch) {
                const parsedDate = new Date(dateOnlyMatch[1]);
                if (!isNaN(parsedDate.getTime())) {
                    _date = parsedDate;
                }
            }
        }

        // Custom format to match "March 5, 2:25PM"
        const prettyTimestampStr = _date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(' at ', ', ');

        // If it's still 12:00 AM after potential testId extraction, show only the date
        const finalTimeStr = _date.toLocaleTimeString('en-US');
        const displayTimestamp = (finalTimeStr === '12:00:00 AM') 
            ? _date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : prettyTimestampStr;

        const gStats = testInfo.guidedStats || { passed: 0, total: 0 };
        const uStats = testInfo.unguidedStats || { passed: 0, total: 0 };

        const gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
        const uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;

        const a11y = testInfo.a11yStats;
        const hasA11y = Boolean(a11y && (a11y.guidedTotal > 0 || a11y.unguidedTotal > 0));
        const a11yGRate = a11y ? a11y.guidedRate : 0;
        const a11yURate = a11y ? a11y.unguidedRate : 0;
        const a11yUplift = a11y ? a11y.uplift : 0;

        const rt = testInfo.efficiencyStats?.runtime;
        const hasRuntime = Boolean(rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0));
        const timeDeltaPct = rt ? rt.medianDeltaPct : 0;
        const timePillClass = timeDeltaPct < 0 ? 'eff-pill positive' : (timeDeltaPct === 0 ? 'eff-pill neutral' : 'eff-pill muted');

        const tok = testInfo.efficiencyStats?.tokens;
        const hasTokens = Boolean(tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0));
        const tokDeltaPct = tok ? tok.uncachedMedianDeltaPct : 0;
        const tokPillClass = tokDeltaPct < 0 ? 'eff-pill positive' : (tokDeltaPct <= 15 ? 'eff-pill neutral' : 'eff-pill muted');

        const localLink = `dashboard.html?testId=${testId}&source=${testInfo.source}`;
        const timeAgoStr = timeAgo(_date);

        const taskCount = testInfo.taskCount || 0;
        const maxRuns = testInfo.maxRuns || 1;
        const earlyFailureRate = testInfo.earlyFailureRate || 0;
        const isFaulty = earlyFailureRate === 100;

        const { label, ldap } = formatSuiteLabel(testInfo);

        const a11yCellHtml = hasA11y
            ? `
                <div class="suite-dumbbell-track" style="max-width: 120px; margin: 0 auto;">
                    <div class="connector" style="left: calc(${Math.min(a11yURate, a11yGRate)}% + 2px); width: calc(${Math.abs(a11yGRate - a11yURate)}% - 4px);"></div>
                    <div class="dot unguided" style="left: calc(${a11yURate}% - 3px);"></div>
                    <div class="dot guided" style="left: calc(${a11yGRate}% - 4px);"></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; text-align: center;">
                    <span>${a11yURate}% → ${a11yGRate}%</span>
                    <span style="font-weight: 700; color: var(--text-primary); margin-left: 4px;">(${a11yUplift >= 0 ? '+' : ''}${a11yUplift}%)</span>
                </div>
            `
            : `<span style="color: var(--text-secondary); font-size: 0.8rem;">—</span>`;

        const timeCellHtml = hasRuntime && rt
            ? `
                <div class="eff-cell-main">
                    <span>${formatDuration(rt.unguidedMedianMs)} → <strong>${formatDuration(rt.guidedMedianMs)}</strong></span>
                    <span class="${timePillClass}">${timeDeltaPct > 0 ? '+' : ''}${timeDeltaPct}%</span>
                </div>
                ${rt.fasterTaskPct > 0 ? `<div class="eff-cell-sub">${rt.fasterTaskPct}% of tasks faster</div>` : ''}
            `
            : `<span style="color: var(--text-secondary); font-size: 0.8rem;">—</span>`;

        const tokenCellHtml = hasTokens && tok
            ? `
                <div class="eff-cell-main" title="Normalized uncached tokens (total - cached)">
                    <span>${formatTokens(tok.unguidedUncachedMedian)} → <strong>${formatTokens(tok.guidedUncachedMedian)}</strong></span>
                    <span class="${tokPillClass}">${tokDeltaPct > 0 ? '+' : ''}${tokDeltaPct}%</span>
                </div>
                <div class="eff-cell-sub" title="Raw total tokens including cached prompt re-reads">
                    Total: ${formatTokens(tok.unguidedTotalMedian)} → ${formatTokens(tok.guidedTotalMedian)} (${tok.guidedCachedSharePct}% cached)
                </div>
            `
            : `<span style="color: var(--text-secondary); font-size: 0.8rem;">—</span>`;

        html += `
            <tr class="suite-table-row ${isFaulty ? 'faulty' : ''}">
                <th scope="row" style="text-align: left; font-weight: 600;">
                    <a href="${localLink}" class="suite-link" style="color: inherit; text-decoration: none;">
                        <div style="color: var(--text-primary); font-size: 0.95rem;" title="${escapeHtml(testId)}">${escapeHtml(label)}</div>
                        <div style="font-size: 0.8rem; font-weight: 400; color: var(--text-secondary); margin-top: 4px;">${timeAgoStr} • <span style="font-size: 0.75rem;">${displayTimestamp}</span>${ldap ? ` • <span>${escapeHtml(ldap)}</span>` : ''}</div>
                    </a>
                </th>
                <td>${getAgentBadge(testInfo.agent)}${escapeHtml(testInfo.agent)}</td>
                <td>${servingDisplayNames[testInfo.serving] || testInfo.serving}</td>
                <td style="font-size: 0.85rem; color: var(--text-secondary); word-break: break-word; width: 120px;">${(escapeHtml(testInfo.model) || '').replaceAll('-', '-<wbr>')}</td>
                <td style="font-weight: 600;">${taskCount} ${maxRuns > 1 ? `<span style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 400;">×${maxRuns}</span>` : ''}</td>
                <td class="uplift-cell" data-compound-key="${compoundKey}" style="width: 170px; padding: 0; vertical-align: middle; position: relative; z-index: 2;">
                    <a href="${localLink}" style="display: block; color: inherit; text-decoration: none; padding: 10px 15px;">
                        <div class="suite-dumbbell-track">
                            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 2px); width: calc(${Math.abs(gRate - uRate)}% - 4px);"></div>
                            <div class="dot unguided" style="left: calc(${uRate}% - 3px);"></div>
                            <div class="dot guided" style="left: calc(${gRate}% - 4px);"></div>
                        </div>
                        <div style="font-size: 0.82rem; color: var(--text-secondary); margin-top: 4px; text-align: center;">
                            <span>${uRate}% → ${gRate}%</span>
                            <span style="font-weight: bold; color: var(--text-primary); margin-left: 4px;">(${gRate - uRate >= 0 ? '+' : ''}${gRate - uRate}%)</span>
                        </div>
                    </a>
                </td>
                <td style="width: 155px; padding: 8px 10px; vertical-align: middle;">${a11yCellHtml}</td>
                <td style="width: 155px; padding: 8px 10px; vertical-align: middle;">${timeCellHtml}</td>
                <td style="width: 185px; padding: 8px 10px; vertical-align: middle;">${tokenCellHtml}</td>
                ${isRemoteDashboard() ? '' : `<td style="text-transform: capitalize;">${testInfo.source}</td>`}
            </tr>
        `;
    });

    container.innerHTML = html;
    setupRateCellHovers();
    renderPivotInsights(); // Refresh insights based on current filters
}

/** @type {DumbbellChart | null} */
let tooltipChartInstance = null;
/** @type {string | null} */
let currentDumbbellKey = null;
/** @type {number | null} */
let hideTimeout = null;
const tooltipContainer = $('#tooltip-container');

function setupRateCellHovers() {
    const rateCells = document.querySelectorAll('.uplift-cell');
    rateCells.forEach(cell => {
        cell.addEventListener('mouseenter', (e) => {
            if (!(cell instanceof HTMLElement)) return;
            const compoundKey = cell.dataset.compoundKey;
            if (!compoundKey) return;
            const testInfo = allTestData[compoundKey];
            if (!testInfo) return;

            if (hideTimeout) {
                clearTimeout(hideTimeout);
                hideTimeout = null;
            }

            if (e instanceof MouseEvent) {
                showTooltipChart(testInfo, e.clientX, e.clientY, compoundKey);
            }
        });

        cell.addEventListener('mousemove', (e) => {
            if (e instanceof MouseEvent) {
                updateTooltipPosition(e.clientX, e.clientY);
            }
        });

        cell.addEventListener('mouseleave', () => hideTooltipChart());
    });
}

/**
 * @param {LandingSuiteSummary} testInfo
 * @param {number} x
 * @param {number} y
 * @param {string} compoundKey
 */
function showTooltipChart(testInfo, x, y, compoundKey) {
    if (currentDumbbellKey === compoundKey && !tooltipContainer.classList.contains('hidden')) {
        updateTooltipPosition(x, y);
        return;
    }

    currentDumbbellKey = compoundKey;

    const headerDiv = $('#tooltip-header');
    if (headerDiv) {
        headerDiv.innerHTML = `
            <div class="tooltip-title">${escapeHtml(testInfo.testId)}</div>
            <div class="tooltip-subtitle">${escapeHtml(testInfo.agent)} • ${escapeHtml(testInfo.serving.replace('mcp', 'MCP'))}</div>
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
    const offset = 20;
    let finalX = x + offset;
    let finalY = y + offset;

    // Boundary check
    // Boundary check using dynamic dimensions to avoid results being cut off
    const tooltipWidth = tooltipContainer.clientWidth || 330; 
    const tooltipHeight = tooltipContainer.clientHeight || 330;
    
    if (finalX + tooltipWidth > window.innerWidth) {
        finalX = x - tooltipWidth - offset;
    }
    if (finalY + tooltipHeight > window.innerHeight) {
        finalY = y - tooltipHeight - offset;
    }

    tooltipContainer.style.left = `${finalX}px`;
    tooltipContainer.style.top = `${finalY}px`;
}

function hideTooltipChart() {
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
 * @param {LandingSuiteSummary} testInfo
 * @returns {{ label: string, ldap: string }}
 */
function formatSuiteLabel(testInfo) {
    const { testId, agent, serving } = testInfo;
    if (!testId) return { label: 'evaluation-run', ldap: '' };

    const timeRegex = /[-_]?\b\d{4}-\d{2}-\d{2}(?:[T_]\d{2}-\d{2}-\d{2})?\b[-_]?/;
    const parts = testId.split(timeRegex);
    
    let prefix = parts[0] || '';
    let suffix = parts[1] || '';
    
    prefix = prefix.replace(/^[-_]+|[-_]+$/g, '');
    suffix = suffix.replace(/^[-_]+|[-_]+$/g, '');
    
    const label = prefix || 'evaluation-run';
    
    if (!suffix) return { label, ldap: '' };
    
    const normalize = (/** @type {string} */ s) => (s || '').toLowerCase().replace(/[-_]+/g, '');
    const normAgent = normalize(agent);
    const normServing = normalize(serving);
    
    const suffixParts = suffix.split('-');
    let ldap = '';
    /** @type {string[]} */
    const otherTags = [];
    
    suffixParts.forEach(part => {
        const normPart = normalize(part);
        if (normPart === normAgent || normPart === normServing) return;
        if (normPart === 'cli' || normPart === 'run' || normPart === 'skills') return;
        otherTags.push(part);
    });
    
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
        return '<span class="agent-badge gemini">✦</span>';
    }
    if (name.includes('codex') || name.includes('openai')) {
        return '<span class="agent-badge openai">❂</span>';
    }
    if (name.includes('claude')) {
        return '<span class="agent-badge claude">✱</span>';
    }
    return '';
}



function getSortedTestIds() {
    // Return only SELECTED tests, sorted by date
    return Array.from(selectedTestIds).sort((a, b) => {
        // Safety check if id not in allTestData (shouldn't happen but good practice)
        if (!allTestData[a] || !allTestData[b]) return 0;
        return new Date(allTestData[b].timestamp).getTime() - new Date(allTestData[a].timestamp).getTime();
    });
}

/**
 * Renders the per-agent Uplift, Accessibility Subscore, and Efficiency scorecard strip.
 * @param {string[]} testIds
 */
function renderAgentScorecardStrip(testIds) {
    const stripEl = document.getElementById('agent-scorecard-strip');
    if (!stripEl) return;

    /**
     * @type {Record<string, {
     *   suites: number,
     *   overallU: number[],
     *   overallG: number[],
     *   a11yU: number[],
     *   a11yG: number[],
     *   timeU: number[],
     *   timeG: number[],
     *   fasterPct: number[],
     *   uncachedU: number[],
     *   uncachedG: number[],
     *   totalU: number[],
     *   totalG: number[],
     *   cachedPctG: number[]
     * }>}
     */
    const byAgent = {};

    testIds.forEach(compoundKey => {
        const t = allTestData[compoundKey];
        if (!t || !t.agent) return;
        const agent = t.agent;
        if (!byAgent[agent]) {
            byAgent[agent] = {
                suites: 0,
                overallU: [],
                overallG: [],
                a11yU: [],
                a11yG: [],
                timeU: [],
                timeG: [],
                fasterPct: [],
                uncachedU: [],
                uncachedG: [],
                totalU: [],
                totalG: [],
                cachedPctG: []
            };
        }
        const b = byAgent[agent];
        b.suites += 1;

        const gStats = t.guidedStats || { passed: 0, total: 0 };
        const uStats = t.unguidedStats || { passed: 0, total: 0 };
        if (gStats.total > 0 || uStats.total > 0) {
            b.overallG.push(gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0);
            b.overallU.push(uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0);
        }

        if (t.a11yStats && (t.a11yStats.guidedTotal > 0 || t.a11yStats.unguidedTotal > 0)) {
            b.a11yG.push(t.a11yStats.guidedRate);
            b.a11yU.push(t.a11yStats.unguidedRate);
        }

        const rt = t.efficiencyStats?.runtime;
        if (rt && (rt.guidedMedianMs > 0 || rt.unguidedMedianMs > 0)) {
            b.timeG.push(rt.guidedMedianMs);
            b.timeU.push(rt.unguidedMedianMs);
            if (rt.fasterTaskPct > 0) b.fasterPct.push(rt.fasterTaskPct);
        }

        const tok = t.efficiencyStats?.tokens;
        if (tok && (tok.guidedTotalMedian > 0 || tok.unguidedTotalMedian > 0)) {
            b.uncachedG.push(tok.guidedUncachedMedian);
            b.uncachedU.push(tok.unguidedUncachedMedian);
            b.totalG.push(tok.guidedTotalMedian);
            b.totalU.push(tok.unguidedTotalMedian);
            if (tok.guidedCachedSharePct > 0) b.cachedPctG.push(tok.guidedCachedSharePct);
        }
    });

    const agents = Object.keys(byAgent).sort((a, b) => a.localeCompare(b));
    if (agents.length === 0) {
        stripEl.innerHTML = '';
        return;
    }

    stripEl.innerHTML = agents.map(agent => {
        const b = byAgent[agent];
        const medOverallU = Math.round(median(b.overallU));
        const medOverallG = Math.round(median(b.overallG));
        const overallUplift = medOverallG - medOverallU;

        const medA11yU = Math.round(median(b.a11yU));
        const medA11yG = Math.round(median(b.a11yG));
        const a11yUplift = medA11yG - medA11yU;

        const medTimeU = Math.round(median(b.timeU));
        const medTimeG = Math.round(median(b.timeG));
        const timeDeltaPct = medTimeU > 0 ? Math.round(((medTimeG - medTimeU) / medTimeU) * 100) : 0;
        const medFasterPct = Math.round(median(b.fasterPct));
        const timePillClass = timeDeltaPct < 0 ? 'eff-pill positive' : (timeDeltaPct === 0 ? 'eff-pill neutral' : 'eff-pill muted');

        const medUncachedU = Math.round(median(b.uncachedU));
        const medUncachedG = Math.round(median(b.uncachedG));
        const uncachedDeltaPct = medUncachedU > 0 ? Math.round(((medUncachedG - medUncachedU) / medUncachedU) * 100) : 0;
        const tokPillClass = uncachedDeltaPct < 0 ? 'eff-pill positive' : (uncachedDeltaPct <= 15 ? 'eff-pill neutral' : 'eff-pill muted');

        const medTotalU = Math.round(median(b.totalU));
        const medTotalG = Math.round(median(b.totalG));
        const medCachedPct = Math.round(median(b.cachedPctG));

        const isActive = currentAgentFilter === agent;

        return `
            <div class="agent-scorecard ${isActive ? 'active-filter' : ''}" onclick="setInsightFilter('agent', '${escapeHtml(agent)}')" title="Click to filter suites by ${escapeHtml(agent)}">
                <div class="agent-scorecard-header">
                    <div>
                        <span class="agent-scorecard-name">${getAgentBadge(agent)}${escapeHtml(agent)}</span>
                    </div>
                    <span class="agent-scorecard-trials">${b.suites} ${b.suites === 1 ? 'suite' : 'suites'}</span>
                </div>
                <div class="agent-scorecard-metrics">
                    <div class="agent-metric-row">
                        <span class="agent-metric-label">Overall Uplift</span>
                        <span class="agent-metric-val">
                            ${medOverallU}% → <strong>${medOverallG}%</strong>
                            <span class="eff-pill positive">${overallUplift >= 0 ? '+' : ''}${overallUplift}%</span>
                        </span>
                    </div>
                    <div class="agent-metric-row">
                        <span class="agent-metric-label">A11y Subscore</span>
                        <span class="agent-metric-val">
                            ${b.a11yG.length > 0
                                ? `${medA11yU}% → <strong>${medA11yG}%</strong> <span class="eff-pill positive">${a11yUplift >= 0 ? '+' : ''}${a11yUplift}%</span>`
                                : '—'}
                        </span>
                    </div>
                    <div class="agent-metric-row">
                        <span class="agent-metric-label">Med. Time</span>
                        <span class="agent-metric-val">
                            ${medTimeU > 0 || medTimeG > 0
                                ? `${formatDuration(medTimeU)} → <strong>${formatDuration(medTimeG)}</strong> <span class="${timePillClass}">${timeDeltaPct > 0 ? '+' : ''}${timeDeltaPct}%</span>`
                                : '—'}
                        </span>
                    </div>
                    <div class="agent-metric-row">
                        <span class="agent-metric-label">Uncached Tok</span>
                        <span class="agent-metric-val">
                            ${medUncachedU > 0 || medUncachedG > 0
                                ? `${formatTokens(medUncachedU)} → <strong>${formatTokens(medUncachedG)}</strong> <span class="${tokPillClass}">${uncachedDeltaPct > 0 ? '+' : ''}${uncachedDeltaPct}%</span>`
                                : '—'}
                        </span>
                    </div>
                    ${medTotalG > 0 ? `<div class="agent-metric-sub">Total: ${formatTokens(medTotalU)} → ${formatTokens(medTotalG)} (${medCachedPct}% cached)${medFasterPct > 0 ? ` • ${medFasterPct}% faster` : ''}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderPivotInsights() {
    let testIds = getSortedTestIds(); // Uses selected filters!

    const limitInput = /** @type {HTMLInputElement} */ (document.getElementById('insights-limit-input'));
    const showAllCheck = /** @type {HTMLInputElement} */ (document.getElementById('insights-show-all-check'));
    const showAll = showAllCheck ? showAllCheck.checked : false;
    const limit = limitInput ? (parseInt(limitInput.value) || 15) : 15;

    if (!showAll && testIds.length > 0) {
        // Get all unique dates for these test runs
        const datesMap = new Map();
        testIds.forEach(id => {
            const testInfo = allTestData[id];
            if (testInfo) {
                const dateKey = testInfo.timestamp.split('T')[0];
                datesMap.set(dateKey, true);
            }
        });
        
        // Sort dates chronologically
        const sortedDates = Array.from(datesMap.keys()).sort((a, b) => a.localeCompare(b));
        
        // Slice the last N dates
        const activeDates = new Set(sortedDates.slice(-limit));
        
        // Filter testIds to only include runs falling on active dates
        testIds = testIds.filter(id => {
            const testInfo = allTestData[id];
            if (!testInfo) return false;
            const dateKey = testInfo.timestamp.split('T')[0];
            return activeDates.has(dateKey);
        });
    }

    renderAgentScorecardStrip(testIds);

    const onlyA11y = currentInsightsMode === 'a11y';

    /** @type {{
     *   agent: Record<string, { uplift: number, uRate: number, gRate: number }[]>,
     *   model: Record<string, { uplift: number, uRate: number, gRate: number }[]>,
     *   guide: Record<string, { uplift: number, uRate: number, gRate: number }[]>
     * }} */
    const grouped = {
        agent: {},
        model: {},
        guide: {}
    };

    testIds.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo) return;
        
        let gRate = 0;
        let uRate = 0;
        let uplift = 0;

        if (onlyA11y) {
            const a11y = testInfo.a11yStats;
            if (!a11y || (a11y.guidedTotal === 0 && a11y.unguidedTotal === 0)) return;
            gRate = a11y.guidedRate;
            uRate = a11y.unguidedRate;
            uplift = a11y.uplift;
        } else {
            const gStats = testInfo.guidedStats || { passed: 0, total: 0 };
            const uStats = testInfo.unguidedStats || { passed: 0, total: 0 };
            gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
            uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;
            uplift = gRate - uRate;
        }

        if (!grouped.agent[testInfo.agent]) grouped.agent[testInfo.agent] = [];
        grouped.agent[testInfo.agent].push({ uplift, uRate, gRate });

        if (!grouped.model[testInfo.model]) grouped.model[testInfo.model] = [];
        grouped.model[testInfo.model].push({ uplift, uRate, gRate });

        const suiteGuides = testInfo.guides || {};
        Object.keys(suiteGuides).forEach(guide => {
            const gEntry = suiteGuides[guide];
            if (onlyA11y) {
                if (!gEntry.a11y) return;
                const { guidedRate = 0, unguidedRate = 0, uplift: gUplift = 0 } = gEntry.a11y;
                if (!grouped.guide[guide]) grouped.guide[guide] = [];
                grouped.guide[guide].push({ uplift: gUplift, uRate: unguidedRate, gRate: guidedRate });
            } else {
                const { guidedRate = 0, unguidedRate = 0, uplift: gUplift = 0 } = gEntry;
                if (!grouped.guide[guide]) grouped.guide[guide] = [];
                grouped.guide[guide].push({ uplift: gUplift, uRate: unguidedRate, gRate: guidedRate });
            }
        });
    });

    /**
     * @param {{ uRate: number, gRate: number, uplift: number }[]} arr
     */
    const getDumbbellMedian = (arr) => {
        if (arr.length === 0) return { uRate: 0, gRate: 0, uplift: 0 };
        const sorted = [...arr].sort((a,b) => a.uplift - b.uplift);
        const mid = Math.floor(sorted.length / 2);
        return sorted[mid];
    };

    /**
     * @param {number[]} vals
     */
    const calculateSD = (vals) => {
        if (vals.length <= 1) return 0;
        const mean = vals.reduce((sum, v) => sum + v, 0) / vals.length;
        const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / vals.length;
        return Math.sqrt(variance);
    };

    /**
     * @param {Record<string, { uplift: number, uRate: number, gRate: number }[]>} groupObj
     * @param {string} filterKey
     */
    const renderPivotTable = (groupObj, filterKey) => {
        let keys = Object.keys(groupObj);

        if (filterKey === 'guide') {
            keys.sort((a, b) => {
                const itemA = getDumbbellMedian(groupObj[a]);
                const itemB = getDumbbellMedian(groupObj[b]);

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
                        const sdUA = calculateSD(groupObj[a].map(item => item.uRate));
                        const sdGA = calculateSD(groupObj[a].map(item => item.gRate));
                        valA = Math.max(sdUA, sdGA);

                        const sdUB = calculateSD(groupObj[b].map(item => item.uRate));
                        const sdGB = calculateSD(groupObj[b].map(item => item.gRate));
                        valB = Math.max(sdUB, sdGB);
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
            // Default alphabetical sort for others
            keys.sort((a, b) => a.localeCompare(b));
        }

        const showVariance = filterKey === 'guide';

        let rowsHtml = '';
        keys.forEach(key => {
            const items = groupObj[key];
            const medianItem = getDumbbellMedian(items);
            const medUplift = medianItem.uplift;
            const uRate = medianItem.uRate;
            const gRate = medianItem.gRate;

            // Calculate Standard Deviation
            const uSD = showVariance ? calculateSD(items.map(item => item.uRate)) : 0;
            const gSD = showVariance ? calculateSD(items.map(item => item.gRate)) : 0;

            const uSD_left = Math.max(0, uRate - uSD);
            const uSD_width = Math.min(100, uRate + uSD) - uSD_left;

            const gSD_left = Math.max(0, gRate - gSD);
            const gSD_width = Math.min(100, gRate + gSD) - gSD_left;

            const clickAttr = filterKey === 'guide'
                ? `onclick="window.location.href='guide.html?guide=${encodeURIComponent(key)}'"`
                : `onclick="setInsightFilter('${filterKey}', '${key}')"`;

            const uBandHtml = uSD > 0 ? `<div class="variance-band unguided" style="left: ${uSD_left}%; width: ${uSD_width}%;"></div>` : '';
            const gBandHtml = gSD > 0 ? `<div class="variance-band guided" style="left: ${gSD_left}%; width: ${gSD_width}%;"></div>` : '';

            rowsHtml += `
                <tr ${clickAttr} style="cursor: pointer;">
                    <td>
                        <div style="font-weight: 600;">${filterKey === 'serving' ? (servingDisplayNames[key] || key) : key}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${items.length} trials</div>
                    </td>
                    <td class="insight-dumbbell-cell">
                        <div class="insight-dumbbell-track">
                            ${uBandHtml}
                            ${gBandHtml}
                            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 1px); width: calc(${Math.abs(gRate - uRate)}% - 2px);"></div>
                            <div class="dot unguided" style="left: calc(${uRate}% - 2px);"></div>
                            <div class="dot guided" style="left: calc(${gRate}% - 3px);"></div>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin-top: 2px;">${uRate}% → ${gRate}% (${medUplift >= 0 ? '+' : ''}${medUplift}%)</div>
                    </td>
                </tr>
            `;
        });
        return `<table class="insights-table"><tbody>${rowsHtml}</tbody></table>`;
    };

    const container = document.getElementById('insights-container');
    if (container) {
        const sortOptions = [
            { value: 'alphabetic', label: 'Alphabetic' },
            { value: 'uplift', label: 'By Uplift' },
            { value: 'unguided', label: 'Unguided Rate' },
            { value: 'guided', label: 'Guided Rate' },
            { value: 'variance', label: 'By Variance' }
        ];

        const sortOptionsHtml = sortOptions.map(opt => 
            `<option value="${opt.value}" ${currentGuideSort === opt.value ? 'selected' : ''}>${opt.label}</option>`
        ).join('');

        const dirArrow = currentGuideSortDir === 'asc' ? '↑' : '↓';
        const modeSuffix = onlyA11y ? ' <span class="mode-badge-inline">Accessibility Checks</span>' : '';
        const guideCountLabel = Object.keys(grouped.guide).length;

        container.innerHTML = `
            <div class="insights-top-row">
                <div class="insights-panel">
                    <div class="insights-panel-title">By Agent${modeSuffix}</div>
                    ${renderPivotTable(grouped.agent, 'agent')}
                </div>
                <div class="insights-panel">
                    <div class="insights-panel-title">By Model${modeSuffix}</div>
                    ${renderPivotTable(grouped.model, 'model')}
                </div>
            </div>
            <div class="insights-panel insights-panel-full">
                <div class="insights-panel-header-row">
                    <div class="insights-panel-title" style="margin-bottom: 0;">By Guide (${guideCountLabel})${modeSuffix}</div>
                    <div class="guide-sort-controls">
                        <label for="guide-sort-select" class="sort-label">Sort:</label>
                        <select id="guide-sort-select" class="sort-select">
                            ${sortOptionsHtml}
                        </select>
                        <button id="guide-sort-dir-btn" class="sort-direction-btn" type="button" aria-label="Toggle sort direction" title="Toggle Direction">
                            <span aria-hidden="true" style="font-size: 1rem; font-weight: bold;">${dirArrow}</span>
                        </button>
                    </div>
                </div>
                ${renderPivotTable(grouped.guide, 'guide')}
            </div>
        `;

        // Attach Event Listeners
        const sortSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('guide-sort-select'));
        const sortDirBtn = /** @type {HTMLButtonElement | null} */ (document.getElementById('guide-sort-dir-btn'));

        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const target = e.target;
                if (target instanceof HTMLSelectElement) {
                    currentGuideSort = /** @type {GuideSortKey} */ (target.value);
                    renderPivotInsights();
                }
            });
        }

        if (sortDirBtn) {
            sortDirBtn.addEventListener('click', () => {
                currentGuideSortDir = currentGuideSortDir === 'asc' ? 'desc' : 'asc';
                renderPivotInsights();
            });
        }
    }
}

/**
 * @param {'agent' | 'serving' | 'model'} filterKey
 * @param {string} value
 */
window.setInsightFilter = (filterKey, value) => {
    /** @type {Record<string, HTMLSelectElement | null>} */
    const selects = {
        agent: /** @type {HTMLSelectElement | null} */ (document.getElementById('filter-agent')),
        serving: /** @type {HTMLSelectElement | null} */ (document.getElementById('filter-serving')),
        model: /** @type {HTMLSelectElement | null} */ (document.getElementById('filter-model'))
    };
    const select = selects[filterKey];
    if (select) {
        select.value = select.value === value ? 'all' : value;
        select.dispatchEvent(new Event('change')); // Trigger table refresh!
    }
};
