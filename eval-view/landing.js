import { getRunStats, initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, timeAgo, calculateChartData, $ } from './utils.js';
import { DumbbellChart } from './dumbbell-chart.js';

let allTestData = {}; // Cache all test data by testId
let selectedTestIds = new Set(); // Set of test IDs to show
let currentSourceFilter = 'all';
let currentAgentFilter = 'all';
let currentServingFilter = 'all';
let currentModelFilter = 'all';

function isRemoteDashboard() {
    return window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
}

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
        document.getElementById('empty-state').style.display = 'block';
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
    const filters = {
        'filter-source': (val) => currentSourceFilter = val,
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
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return; // Avoid 404s by skipping local network fetches when hosted on Github Pages
    }
    
    try {
        let response = await fetch(`/api/suites?t=${Date.now()}`);
        let manifest;
        let useResultsPrefix = false;

        if (!response.ok) {
            // Try fetching suites.gen.json as fallback for static mode
            const staticRes = await fetch(`/suites.gen.json?t=${Date.now()}`);
            if (!staticRes.ok) return; // Silent fail if both fail
            const suites = await staticRes.json();
            // convert array of strings to expected format [{id: string, source: 'local'}]
            manifest = { suites: suites.map(id => ({ id, source: 'local', timestamp: new Date().toISOString() })) };
            useResultsPrefix = true;
        } else {
            manifest = await response.json();
        }

        if (manifest.suites && manifest.suites.length > 0) {
            document.getElementById('empty-state').style.display = 'none';
        }

        // Load local test data
        for (const suite of manifest.suites) {
            if (suite.source !== 'local') continue;
            
            const testId = suite.id;
            const suiteTimestamp = suite.timestamp;
            try {
                const fetchPath = useResultsPrefix ? `results/${testId}/evals.json` : `${testId}/evals.json`;
                const response = await fetch(`${fetchPath}?source=local&t=${Date.now()}`);
                if (response.ok) {
                    const parsed = await response.json();
                    registerTestData(testId, useResultsPrefix ? 'static' : 'local', parsed, suiteTimestamp);
                }
            } catch (e) {
                console.warn(`Failed to load local test ${testId}:`, e);
            }
        }
    } catch {
        console.warn('Local proxy not available');
    }
}

async function loadRemoteTests() {
    try {
        const prefixes = [];
        let pageToken = '';
        
        // Paginate GCS to retrieve all prefixes without truncation limits
        do {
            const url = `https://storage.googleapis.com/storage/v1/b/guidance-evals/o?delimiter=/&t=${Date.now()}${pageToken ? `&pageToken=${pageToken}` : ''}`;
            const response = await authenticatedFetch(url);
            if (!response.ok) throw new Error('Failed to fetch remote suites');
            
            const data = await response.json();
            if (data.prefixes) {
                prefixes.push(...data.prefixes);
            }
            pageToken = data.nextPageToken || '';
        } while (pageToken);
        
        if (prefixes.length > 0) {
             document.getElementById('empty-state').style.display = 'none';
        }

        // Load remote test data in parallel
        await Promise.all(prefixes.map(async (prefix) => {
            const testId = prefix.slice(0, -1); // Remove trailing slash
            try {
                const fileUrl = `https://storage.googleapis.com/storage/v1/b/guidance-evals/o/${encodeURIComponent(prefix + 'evals.json')}?alt=media`;
                const response = await authenticatedFetch(fileUrl);
                if (response.ok) {
                    const parsed = await response.json();
                    registerTestData(testId, 'remote', parsed);
                }
            } catch (e) {
                console.warn(`Failed to load remote test ${testId}:`, e);
            }
        }));
        
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

function registerTestData(testId, source, parsed, forcedTimestamp) {
    let serving = 'unknown';
    if (parsed.serving !== undefined) {
        serving = parsed.serving;
    } else if (parsed.enableSkills !== undefined) {
        serving = parsed.enableSkills ? 'skills' : 'mcp';
    }

    const compoundKey = `${testId}|||${source}`;

    allTestData[compoundKey] = {
        testId: testId,
        timestamp: parsed.timestamp || forcedTimestamp || new Date().toISOString(),
        data: parsed,
        source: source,
        agent: parsed.agent || 'unknown',
        serving: serving,
        model: parsed.model || 'unknown',
        toolActivationRate: parsed.summary?.toolActivationRate || 0,
        guideUsageRate: parsed.summary?.guideUsageRate || 0
    };
    
    updateFilterOptions('filter-model-group', 'model');
    updateFilterOptions('filter-serving-group', 'serving');
    updateServingFilterOptions();
    updateAgentFilterOptions();
}

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

        const data = testInfo.data;
        const results = data.results;
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

        const gStats = calculateGroupTotalStats(results, 'guided');
        const uStats = calculateGroupTotalStats(results, 'unguided');

        const gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
        const uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;

        const localLink = `dashboard.html?testId=${testId}&source=${testInfo.source}`;
        const timeAgoStr = timeAgo(_date);

        const scenarioKeys = Object.keys(data.results || {});
        const distinctScenarios = new Set(scenarioKeys.map(k => k.replace(' - guided', '').replace(' - unguided', '')));
        const taskCount = data.summary && data.summary.taskCount ? data.summary.taskCount : distinctScenarios.size;
        let maxRuns = 1;
        scenarioKeys.forEach(k => { if (data.results[k].length > maxRuns) maxRuns = data.results[k].length; });

        const earlyFailureRate = data.summary?.unguidedEarlyFailureRate || 0;
        const isFaulty = earlyFailureRate === 100;

        const { label, ldap } = formatSuiteLabel(testInfo);

        html += `
            <tr class="suite-table-row ${isFaulty ? 'faulty' : ''}">
                <td style="text-align: left; font-weight: 600;">
                    <a href="${localLink}" class="suite-link" style="color: inherit; text-decoration: none;">
                        <div style="color: var(--text-primary); font-size: 0.95rem;" title="${escapeHtml(testId)}">${escapeHtml(label)}</div>
                        <div style="font-size: 0.8rem; font-weight: 400; color: var(--text-secondary); margin-top: 4px;">${timeAgoStr} • <span style="font-size: 0.75rem;">${displayTimestamp}</span>${ldap ? ` • <span>${escapeHtml(ldap)}</span>` : ''}</div>
                    </a>
                </td>
                <td>${getAgentBadge(testInfo.agent)}${escapeHtml(testInfo.agent)}</td>
                <td>${servingDisplayNames[testInfo.serving] || testInfo.serving}</td>
                <td style="font-size: 0.85rem; color: var(--text-secondary); word-break: break-word; width: 120px;">${escapeHtml(testInfo.model).replaceAll('-', '-&shy;')}</td>
                <td style="font-weight: 600;">${taskCount} ${maxRuns > 1 ? `<span style="color: var(--text-secondary); font-size: 0.8rem; font-weight: 400;">×${maxRuns}</span>` : ''}</td>
                <td class="uplift-cell" data-compound-key="${compoundKey}" style="width: 200px; padding: 0; vertical-align: middle; position: relative; z-index: 2;">
                    <a href="${localLink}" style="display: block; color: inherit; text-decoration: none; padding: 10px 15px;">
                        <div class="suite-dumbbell-track">
                            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 2px); width: calc(${Math.abs(gRate - uRate)}% - 4px);"></div>
                            <div class="dot unguided" style="left: calc(${uRate}% - 3px);"></div>
                            <div class="dot guided" style="left: calc(${gRate}% - 4px);"></div>
                        </div>
                        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; text-align: center;">
                            <span style="font-weight: bold; color: var(--text-primary);">${gRate - uRate >= 0 ? '+' : ''}${gRate - uRate}%</span>
                        </div>
                    </a>
                </td>
                ${isRemoteDashboard() ? '' : `<td style="text-transform: capitalize;">${testInfo.source}</td>`}
            </tr>
        `;
    });

    container.innerHTML = html;
    setupRateCellHovers();
    renderPivotInsights(); // Refresh insights based on current filters
}

let tooltipChartInstance = null;
let currentDumbbellKey = null;
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

    const results = testInfo.data.results;
    const { labels, guided, unguided } = calculateChartData(results);
    if (labels.length < 1) return;

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
            { label: 'Unguided', data: unguided, backgroundColor: 'rgba(218, 54, 51, 0.2)', borderColor: '#da3633' },
            { label: 'Guided', data: guided, backgroundColor: 'rgba(35, 134, 54, 0.2)', borderColor: '#238636' }
        ]
    });
}

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
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
        currentDumbbellKey = null;
        tooltipContainer.classList.add('hidden');
        hideTimeout = null;
    }, 50);
}


// ==========================================
// HELPERS
// ==========================================

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
    
    const normalize = s => (s || '').toLowerCase().replace(/[-_]+/g, '');
    const normAgent = normalize(agent);
    const normServing = normalize(serving);
    
    const suffixParts = suffix.split('-');
    let ldap = '';
    const otherTags = [];
    
    suffixParts.forEach(part => {
        const normPart = normalize(part);
        if (normPart === normAgent || normPart === normServing) return;
        if (normPart === 'cli' || normPart === 'run' || normPart === 'skills') return;
        otherTags.push(part);
    });
    
    if (otherTags.length > 0) {
        ldap = otherTags.pop();
    }
    
    let finalLabel = label;
    if (otherTags.length > 0) {
        finalLabel += '-' + otherTags.join('-');
    }
    
    return { label: finalLabel, ldap };
}

function getAgentBadge(agentName) {
    const name = (agentName || '').toLowerCase();
    if (name.includes('gemini') || name.includes('jetski')) {
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

function calculateGroupTotalStats(results, groupType) {
    let passed = 0;
    let total = 0;

    if (!results) return { passed, total }; // Guard against missing results

    Object.keys(results).forEach(key => {
        // key format: "scenario - prompt - agent"
        if (key.endsWith(` - ${groupType}`)) {
            results[key].forEach(run => {
                const s = getRunStats(run.results);
                passed += s.passed;
                total += s.total;
            });
        }
    });

    return { passed, total };
}

function getSortedTestIds() {
    // Return only SELECTED tests, sorted by date
    return Array.from(selectedTestIds).sort((a, b) => {
        // Safety check if id not in allTestData (shouldn't happen but good practice)
        if (!allTestData[a] || !allTestData[b]) return 0;
        return new Date(allTestData[b].timestamp).getTime() - new Date(allTestData[a].timestamp).getTime();
    });
}

function renderPivotInsights() {
    const testIds = getSortedTestIds(); // Uses selected filters!
    const grouped = {
        agent: {},
        serving: {},
        model: {}
    };

    testIds.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        if (!testInfo) return;
        
        const data = testInfo.data;
        const gStats = calculateGroupTotalStats(data.results, 'guided');
        const uStats = calculateGroupTotalStats(data.results, 'unguided');
        const gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
        const uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;
        const uplift = gRate - uRate;

        if (!grouped.agent[testInfo.agent]) grouped.agent[testInfo.agent] = [];
        grouped.agent[testInfo.agent].push({ uplift, uRate, gRate });

        if (!grouped.serving[testInfo.serving]) grouped.serving[testInfo.serving] = [];
        grouped.serving[testInfo.serving].push({ uplift, uRate, gRate });

        if (!grouped.model[testInfo.model]) grouped.model[testInfo.model] = [];
        grouped.model[testInfo.model].push({ uplift, uRate, gRate });
    });

    const getDumbbellMedian = (arr) => {
        if (arr.length === 0) return { uRate: 0, gRate: 0, uplift: 0 };
        const sorted = [...arr].sort((a,b) => a.uplift - b.uplift);
        const mid = Math.floor(sorted.length / 2);
        return sorted[mid];
    };

    const renderPivotTable = (groupObj, filterKey) => {
        let rowsHtml = '';
        Object.keys(groupObj).forEach(key => {
            const items = groupObj[key];
            const medianItem = getDumbbellMedian(items);
            const medUplift = medianItem.uplift;
            const uRate = medianItem.uRate;
            const gRate = medianItem.gRate;

            rowsHtml += `
                <tr onclick="setInsightFilter('${filterKey}', '${key}')" style="cursor: pointer;">
                    <td>
                        <div style="font-weight: 600;">${filterKey === 'serving' ? (servingDisplayNames[key] || key) : key}</div>
                        <div style="font-size: 0.75rem; color: var(--text-secondary);">${items.length} trials</div>
                    </td>
                    <td class="insight-dumbbell-cell">
                        <div class="insight-dumbbell-track">
                            <div class="connector" style="left: calc(${Math.min(uRate, gRate)}% + 1px); width: calc(${Math.abs(gRate - uRate)}% - 2px);"></div>
                            <div class="dot unguided" style="left: calc(${uRate}% - 2px);"></div>
                            <div class="dot guided" style="left: calc(${gRate}% - 3px);"></div>
                        </div>
                        <div style="font-size: 0.8rem; color: var(--text-secondary); text-align: center; margin-top: 2px;">${medUplift >= 0 ? '+' : ''}${medUplift}%</div>
                    </td>
                </tr>
            `;
        });
        return `<table class="insights-table"><tbody>${rowsHtml}</tbody></table>`;
    };

    const container = document.getElementById('insights-container');
    if (container) {
        container.innerHTML = `
            <div class="insights-panel">
                <div class="insights-panel-title">By Agent</div>
                ${renderPivotTable(grouped.agent, 'agent')}
            </div>
            <div class="insights-panel">
                <div class="insights-panel-title">By Serving</div>
                ${renderPivotTable(grouped.serving, 'serving')}
            </div>
            <div class="insights-panel">
                <div class="insights-panel-title">By Model</div>
                ${renderPivotTable(grouped.model, 'model')}
            </div>
        `;
    }
}

// @ts-expect-error global export
window.setInsightFilter = (filterKey, value) => {
    const selects = {
        agent: document.getElementById('filter-agent'),
        serving: document.getElementById('filter-serving'),
        model: document.getElementById('filter-model')
    };
    if (selects[filterKey]) {
        selects[filterKey].value = value;
        selects[filterKey].dispatchEvent(new Event('change')); // Trigger table refresh!
    }
};
