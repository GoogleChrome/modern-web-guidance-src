import { getRunStats, getColor, initGoogleAuth, authenticatedFetch, getAccessToken } from './utils.js';

let allTestData = {}; // Cache all test data by testId
let currentTab = 'suites';
let selectedTestIds = new Set(); // Set of test IDs to show
let currentSourceFilter = 'all';
let currentAgentFilter = 'all';
let currentSkillsFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize UI
        setupTabs();
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

        const view = params.get('view');
        if (view && ['overview', 'trends'].includes(view)) {
            activateTab(view, false);
        }

        // Initial Render
        renderSuites();
        renderTrends();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'suites';
    if (['suites', 'trends'].includes(view)) {
        activateTab(view, false);
    }

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

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            activateTab(tab.dataset.tab);
        });
    });
}

function activateTab(tabName, updateUrl = true) {
    if (updateUrl && currentTab === tabName) return;

    const tabs = document.querySelectorAll('.tab-button');

    // Update active tab state
    tabs.forEach(t => {
        if (t.dataset.tab === tabName) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    // Hide all content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

    // Show selected content
    const targetId = `${tabName}-tab`;
    const targetContent = document.getElementById(targetId);
    if (targetContent) {
        targetContent.classList.add('active');
    }

    currentTab = tabName;

    if (updateUrl) {
        const url = new URL(window.location);
        url.searchParams.set('view', tabName);
        window.history.replaceState({}, '', url);
    }
}


function setupTestFilters() {
    const filterBtn = document.getElementById('filter-btn');
    const filterMenu = document.getElementById('filter-menu');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');
    const list = document.getElementById('filter-list');
    const searchInput = document.getElementById('filter-search');

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
        if (!filterMenu.contains(e.target) && !filterBtn.contains(e.target)) {
            filterMenu.classList.add('hidden');
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
        const term = e.target.value.toLowerCase();
        const items = list.querySelectorAll('.filter-item');
        items.forEach(item => {
            const label = item.querySelector('.filter-item-label').textContent.toLowerCase();
            item.style.display = label.includes(term) ? 'flex' : 'none';
        });
    });

    renderFilterMenuItems();
}

function setupTableFilters() {
    const filterSource = document.getElementById('filter-source');
    const filterAgent = document.getElementById('filter-agent');
    const filterSkills = document.getElementById('filter-skills');

    if (filterSource) filterSource.addEventListener('change', (e) => { currentSourceFilter = e.target.value; renderSuites(); });
    if (filterAgent) filterAgent.addEventListener('change', (e) => { currentAgentFilter = e.target.value; renderSuites(); });
    if (filterSkills) filterSkills.addEventListener('change', (e) => { currentSkillsFilter = e.target.value; renderSuites(); });
}


function renderFilterMenuItems() {
    const list = document.getElementById('filter-list');
    list.innerHTML = '';

    // Get all tests sorted by date
    const sortedIds = Object.keys(allTestData).sort((a, b) => {
        return new Date(allTestData[b].timestamp) - new Date(allTestData[a].timestamp);
    });

    sortedIds.forEach(compoundKey => {
        const item = document.createElement('label');
        item.className = 'filter-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedTestIds.has(compoundKey);
        checkbox.value = compoundKey;

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedTestIds.add(compoundKey);
            } else {
                selectedTestIds.delete(compoundKey);
            }
            updateUrlParams();
            renderAll();
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
    const url = new URL(window.location);
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
    renderTrends();
}

async function loadLocalTests() {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return; // Avoid 404s by skipping local network fetches when hosted on Github Pages
    }
    
    try {
        const response = await fetch(`/api/suites?t=${Date.now()}`);
        if (!response.ok) return; // Silent fail for local if we are on gh-pages
        const manifest = await response.json();

        if (manifest.suites && manifest.suites.length > 0) {
            document.getElementById('empty-state').style.display = 'none';
        }

        // Load local test data
        for (const suite of manifest.suites) {
            if (suite.source !== 'local') continue;
            
            const testId = suite.id;
            try {
                const response = await fetch(`${testId}/evals.json?source=local&t=${Date.now()}`);
                if (response.ok) {
                    const parsed = await response.json();
                    registerTestData(testId, 'local', parsed);
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
        // Fetch from GCS JSON API directly instead of our node proxy
        const response = await authenticatedFetch(`https://storage.googleapis.com/storage/v1/b/guidance-evals/o?delimiter=/`);
        if (!response.ok) throw new Error('Failed to fetch remote suites');
        
        const data = await response.json();
        const prefixes = data.prefixes || [];
        
        if (prefixes.length > 0) {
             document.getElementById('empty-state').style.display = 'none';
        }

        // Load remote test data
        for (const prefix of prefixes) {
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

function registerTestData(testId, source, parsed) {
    let servingArch = 'unknown';
    if (parsed.enableSkills !== undefined) {
        servingArch = parsed.enableSkills ? 'skills' : 'mcp';
    }

    const compoundKey = `${testId}|||${source}`;

    allTestData[compoundKey] = {
        testId: testId,
        timestamp: parsed.timestamp || new Date().toISOString(), // Fallback
        data: parsed,
        source: source,
        agent: parsed.agent || 'unknown',
        servingArch: servingArch
    };
}

// ==========================================
// RENDERERS
// ==========================================

function renderSuites() {
    const testIds = getSortedTestIds();
    if (testIds.length === 0) return;

    const container = document.getElementById('suites-list');

    let html = '';

    testIds.forEach(compoundKey => {
        const testInfo = allTestData[compoundKey];
        const testId = testInfo.testId;

        // Apply filters
        if (currentSourceFilter !== 'all' && testInfo.source !== currentSourceFilter) return;
        if (currentAgentFilter !== 'all' && testInfo.agent !== currentAgentFilter) return;
        if (currentSkillsFilter !== 'all' && testInfo.servingArch !== currentSkillsFilter) return;

        const data = testInfo.data;
        const _date = new Date(testInfo.timestamp);

        // Custom format to match "March 5, 2:25PM"
        const prettyTimestampStr = _date.toLocaleString('en-US', {
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).replace(' at ', ', ');

        const gStats = calculateGroupTotalStats(data.results, 'guided');
        const uStats = calculateGroupTotalStats(data.results, 'unguided');

        const gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
        const uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;

        const localLink = `dashboard.html?testId=${testId}&source=${testInfo.source}`;

        html += `
            <tr class="suite-table-row" onclick="window.location.href='${localLink}'" style="cursor: pointer;">
                <td style="padding-left:15px; text-align: left; font-weight: 600;">${testId}</td>
                <td style="text-transform: capitalize;">${testInfo.source}</td>
                <td>${testInfo.agent}</td>
                <td style="text-transform: capitalize;">${testInfo.servingArch.replace('mcp', 'MCP')}</td>
                <td><span style="font-weight: 700; color: ${getColor(gRate)};">${gRate}%</span></td>
                <td><span style="font-weight: 700; color: ${getColor(uRate)};">${uRate}%</span></td>
                <td style="padding-right:15px; text-align: right; color: var(--text-tertiary); font-size: 0.85rem;">${prettyTimestampStr}</td>
            </tr>
        `;
    });

    container.innerHTML = html;
}


function renderTrends() {
    const testIds = getSortedTestIds();
    const guidedTimeline = document.getElementById('guided-timeline');
    const unguidedTimeline = document.getElementById('unguided-timeline');

    if (!guidedTimeline || !unguidedTimeline) return;

    // Helper to render bars
    const renderBars = (groupType) => {
        return testIds.map(compoundTestId => {
            const testInfo = allTestData[compoundTestId];
            const testId = testInfo.testId;
            const source = testInfo.source;
            const data = testInfo.data;
            const stats = calculateGroupTotalStats(data.results, groupType);
            const value = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
            const timestamp = new Date(testInfo.timestamp).toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).replace(' at ', ', ');

            return `
                <a class="timeline-bar" href="dashboard.html?testId=${testId}&source=${source}" title="${testId} - ${timestamp}: ${value}%">
                    <div class="timeline-bar-fill" style="height: ${Math.max(value * 2, 10)}px; background-color: ${getColor(value)}"></div>
                    <div class="timeline-bar-label">${value}%</div>
                </a>
            `;
        }).join('');
    };

    guidedTimeline.innerHTML = renderBars('guided');
    unguidedTimeline.innerHTML = renderBars('unguided');
}

// ==========================================
// HELPERS
// ==========================================

function calculateGroupTotalStats(results, groupType) {
    let passed = 0;
    let total = 0;

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
        return new Date(allTestData[b].timestamp) - new Date(allTestData[a].timestamp);
    });
}
