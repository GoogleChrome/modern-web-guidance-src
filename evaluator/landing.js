let allTestData = {}; // Cache all test data by testID
let currentTab = 'overview';
let currentScenarioFilter = 'all';
let selectedTestIds = new Set(); // Set of test IDs to show


document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadAllTests();

        // Initialize UI
        setupTabs();
        setupFilters();
        setupTestFilters(); // New filter setup

        const params = new URLSearchParams(window.location.search);

        // Handle 'tests' param - if present, filter selectedTestIds
        const testsParam = params.get('tests');
        if (testsParam) {
            const requestedIds = new Set(testsParam.split(','));
            // Only keep IDs that actually exist
            selectedTestIds = new Set(
                [...requestedIds].filter(id => allTestData[id])
            );
            // If none of the requested IDs exist, fallback to all? 
            // Better to show none or empty state if user requested specific ones that don't exist?
            // Let's stick to what we found.
        } else {
            // Default: Select All
            selectedTestIds = new Set(Object.keys(allTestData));
        }

        // Update filter UI to match initial state
        renderFilterMenuItems();

        const view = params.get('view');
        if (view && ['overview', 'explorer', 'trends'].includes(view)) {
            activateTab(view, false);
        }

        // Initial Render
        renderOverview();
        renderExplorer();
        renderTrends();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
});

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view') || 'overview';
    if (['overview', 'explorer', 'trends'].includes(view)) {
        activateTab(view, false);
    }

    // Also handle tests param update on popstate if needed
    // Ideally we re-init selectedTestIds but that might be heavy?
    // Let's just reload for now if tests param changes drastically, or re-render.
    // For simplicity, we can reload or just re-read params.
    const testsParam = params.get('tests');
    if (testsParam) {
        const requestedIds = new Set(testsParam.split(','));
        selectedTestIds = new Set([...requestedIds].filter(id => allTestData[id]));
    } else {
        selectedTestIds = new Set(Object.keys(allTestData));
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

function setupFilters() {
    const filters = document.querySelectorAll('.filter-option[data-filter-type="scenario"]');
    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            // Update active filter state
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');

            currentScenarioFilter = filter.dataset.filterValue;

            // Re-render Explorer content
            renderExplorer();
        });
    });
}

function setupTestFilters() {
    const filterBtn = document.getElementById('filter-btn');
    const filterMenu = document.getElementById('filter-menu');
    const selectAllBtn = document.getElementById('select-all-btn');
    const deselectAllBtn = document.getElementById('deselect-all-btn');

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
}

function renderFilterMenuItems() {
    const list = document.getElementById('filter-list');
    list.innerHTML = '';

    // Get all tests sorted by date
    const allIds = Object.keys(allTestData).sort((a, b) => {
        return new Date(allTestData[b].timestamp) - new Date(allTestData[a].timestamp);
    });

    allIds.forEach(testID => {
        const item = document.createElement('label');
        item.className = 'filter-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedTestIds.has(testID);
        checkbox.value = testID;

        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedTestIds.add(testID);
            } else {
                selectedTestIds.delete(testID);
            }
            updateUrlParams();
            renderAll();
        });

        const labelContent = document.createElement('div');
        labelContent.className = 'filter-item-label';

        const idSpan = document.createElement('span');
        idSpan.textContent = `Test ${testID.replace('test_', '')}`;

        const dateSpan = document.createElement('span');
        dateSpan.className = 'filter-item-date';
        dateSpan.textContent = new Date(allTestData[testID].timestamp).toLocaleString();

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
    renderOverview();
    renderExplorer();
    renderTrends();
}

async function loadAllTests() {
    try {
        const response = await fetch(`results/tests.json?t=${Date.now()}`);
        if (!response.ok) throw new Error('Manifest not found');
        const manifest = await response.json();

        if (!manifest.tests || manifest.tests.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        document.getElementById('empty-state').style.display = 'none';

        // Load all test data
        for (const testEntry of manifest.tests) {
            try {
                const response = await fetch(`results/${testEntry.id}/evals.json?t=${Date.now()}`);
                if (response.ok) {
                    allTestData[testEntry.id] = {
                        timestamp: testEntry.timestamp,
                        data: await response.json()
                    };
                }
            } catch {
                console.warn(`Failed to load test ${testEntry.id}:`, e);
            }
        }
    } catch (error) {
        console.warn('No manifest found:', error);
        document.getElementById('empty-state').style.display = 'block';
        throw error;
    }
}

// ==========================================
// RENDERERS
// ==========================================

function renderOverview() {
    const testIds = getSortedTestIds();
    if (testIds.length === 0) return;

    const latestTestId = testIds[0];
    const latestData = allTestData[latestTestId].data;

    // 1. Render Metrics
    const guidedMetric = document.getElementById('latest-guided-metric');
    const unguidedMetric = document.getElementById('latest-unguided-metric');

    const guidedStats = calculateGroupTotalStats(latestData.results, 'guided');
    const unguidedStats = calculateGroupTotalStats(latestData.results, 'unguided');

    const guidedRate = guidedStats.total > 0 ? Math.round((guidedStats.passed / guidedStats.total) * 100) : 0;
    const unguidedRate = unguidedStats.total > 0 ? Math.round((unguidedStats.passed / unguidedStats.total) * 100) : 0;

    guidedMetric.textContent = `${guidedRate}%`;
    guidedMetric.style.color = getColor(guidedRate);

    unguidedMetric.textContent = `${unguidedRate}%`;
    unguidedMetric.style.color = getColor(unguidedRate);

    // 2. Render Recent Tests List
    const container = document.getElementById('overview-recent-tests');
    const recentTests = testIds.slice(0, 5);

    container.innerHTML = recentTests.map(testID => {
        const testInfo = allTestData[testID];
        const data = testInfo.data;
        const timestamp = new Date(testInfo.timestamp).toLocaleString();

        const gStats = calculateGroupTotalStats(data.results, 'guided');
        const uStats = calculateGroupTotalStats(data.results, 'unguided');

        const gRate = gStats.total > 0 ? Math.round((gStats.passed / gStats.total) * 100) : 0;
        const uRate = uStats.total > 0 ? Math.round((uStats.passed / uStats.total) * 100) : 0;

        return `
            <a class="recent-test-item" href="dashboard.html?testID=${testID}">
                <div>
                    <div class="test-id">Test ${testID.replace('test_', '')}</div>
                    <div class="test-timestamp">${timestamp}</div>
                </div>
                <div class="test-stats">
                    <div>
                        <div class="stat-label">Guided</div>
                        <div class="stat-value" style="color: ${getColor(gRate)}">${gRate}%</div>
                    </div>
                    <div>
                        <div class="stat-label">Unguided</div>
                        <div class="stat-value" style="color: ${getColor(uRate)}">${uRate}%</div>
                    </div>
                </div>
            </a>
        `;
    }).join('');
}


function renderExplorer() {
    const containerGrids = document.getElementById('explorer-grids');
    const containerTimelines = document.getElementById('explorer-timelines');

    containerGrids.innerHTML = '';
    containerTimelines.innerHTML = '';

    const scenarios = ['greenfield', 'brownfield', 'redfield'];
    const prompts = ['specific', 'vague'];
    const agents = ['unguided', 'guided'];

    // Filter scenarios
    const activeScenarios = currentScenarioFilter === 'all'
        ? scenarios
        : scenarios.filter(s => s === currentScenarioFilter);

    activeScenarios.forEach(scenario => {
        // Create Section for this Scenario
        const section = document.createElement('div');
        section.className = 'scenario-section';
        section.innerHTML = `<h3 class="scenario-title">${capitalize(scenario)}</h3>`;

        // 1. Render Grids for this scenario
        prompts.forEach(prompt => {
            const gridWrapper = document.createElement('div');
            gridWrapper.className = 'dashboard-grid-row-pair';

            agents.forEach(agent => {
                const title = `${capitalize(prompt)} - ${capitalize(agent)}`;
                const testName = `${scenario} - ${prompt} - ${agent}`; // Key for data lookup

                const rowHtml = renderGridRow(testName);
                if (rowHtml) {
                    const gridContainer = document.createElement('div');
                    gridContainer.className = 'dashboard-grid-item';
                    gridContainer.innerHTML = `
                        <div class="test-grid-label mt-15">${title}</div>
                        <div class="test-grid-row">${rowHtml}</div>
                    `;
                    gridWrapper.appendChild(gridContainer);
                }
            });

            if (gridWrapper.children.length > 0) {
                section.appendChild(gridWrapper);
            }
        });

        // 2. Render Comparison History (Side-by-Side Subgrid)
        prompts.forEach(prompt => {
            const historyHtml = renderComparisonHistory(scenario, prompt);
            if (historyHtml) {
                const historyContainer = document.createElement('div');
                historyContainer.className = 'check-timeline-wrapper';
                historyContainer.innerHTML = historyHtml;
                section.appendChild(historyContainer);
            }
        });

        containerGrids.appendChild(section);
    });
}


function renderGridRow(testName) {
    const testIds = getSortedTestIds();
    const cellsHtml = [];
    let hasData = false;

    testIds.forEach(testID => {
        const data = allTestData[testID].data;
        const results = data.results;

        const runData = results[testName];

        if (runData && runData.length > 0) {
            hasData = true;

            // Calculate average across runs
            let totalPassed = 0;
            let totalChecks = 0;
            runData.forEach(run => {
                const s = getRunStats(run.results);
                totalPassed += s.passed;
                totalChecks += s.total;
            });

            const avgRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

            cellsHtml.push(`
                <a class="test-grid-cell"
                     href="dashboard.html?testID=${testID}"
                     style="background-color: ${getColor(avgRate)}" 
                     title="${testID} - ${new Date(allTestData[testID].timestamp).toLocaleDateString()}: ${avgRate}% (${totalPassed}/${totalChecks})">
                    ${avgRate}%
                </a>
            `);
        } else {
            // Placeholder
            cellsHtml.push(`
                <div class="test-grid-cell empty" title="No Data">-</div>
            `);
        }
    });

    return hasData ? cellsHtml.join('') : null;
}


function renderComparisonHistory(scenario, prompt) {
    const testIds = getSortedTestIds();
    const checkDescriptions = new Map();
    const agents = ['unguided', 'guided'];

    // Gather all checks from BOTH agents for this prompt
    agents.forEach(agent => {
        const testName = `${scenario} - ${prompt} - ${agent}`;
        testIds.forEach(testID => {
            const data = allTestData[testID].data;
            const results = data.results;
            if (results && results[testName]) {
                results[testName].forEach(run => {
                    if (run.results) {
                        run.results.forEach(check => {
                            if (!checkDescriptions.has(check.id)) {
                                checkDescriptions.set(check.id, check.message);
                            }
                        });
                    }
                });
            }
        });
    });

    if (checkDescriptions.size === 0) return null;

    const sortedChecks = Array.from(checkDescriptions.keys()).sort();
    const rowCount = sortedChecks.length + 1; // +1 for Header

    let html = `
        <div class="test-grid-label check-timeline-label">${capitalize(prompt)} - History Comparison</div>
        <div class="comparison-grid" style="grid-template-rows: auto repeat(${sortedChecks.length}, auto);">
    `;

    // Render Columns for each Agent
    agents.forEach(agent => {
        const title = `${capitalize(agent)}`;
        const testName = `${scenario} - ${prompt} - ${agent}`;

        html += `
            <div class="history-column" style="grid-row: 1 / span ${rowCount};">
                <div class="history-header">
                    <div class="history-header-title">${title}</div>
                    <div class="history-header-subtitle">History (Latest → Oldest)</div>
                </div>
        `;

        sortedChecks.forEach(checkId => {
            const description = checkDescriptions.get(checkId) || checkId;

            // Generate sparklines for this check/agent
            let sparklinesHtml = '';
            testIds.forEach(testID => {
                const data = allTestData[testID].data;
                const results = data.results;

                let hasRuns = false;

                if (results && results[testName]) {
                    const runs = results[testName];
                    if (runs && runs.length > 0) {
                        hasRuns = true;
                        // Show runs Latest -> Oldest (assuming runs are strictly ascending by runNumber)
                        // logic in evaluate.js suggests they are pushed in runDirs sort order (ascending)
                        [...runs].reverse().forEach(run => {
                            let status = 'missing';
                            let tooltip = `Test ${testID.replace('test_', '')} (Run ${run.runNumber}): Not Run`;

                            const check = run.results.find(c => c.id === checkId);
                            if (check) {
                                status = check.passed ? 'pass' : 'fail';
                                tooltip = `Test ${testID.replace('test_', '')} (Run ${run.runNumber}): ${check.passed ? 'PASS' : 'FAIL'}\n${check.message}`;
                            }

                            let color = 'var(--bg-tertiary)';
                            if (status === 'pass') color = 'var(--accent-success)';
                            if (status === 'fail') color = 'var(--accent-failure)';
                            const border = status === 'missing' ? '1px solid var(--border-color)' : 'none';

                            const encodedTestName = encodeURIComponent(testName);
                            const encodedCheckId = encodeURIComponent(checkId);

                            sparklinesHtml += `
                                <a href="dashboard.html?testID=${testID}&testName=${encodedTestName}&checkId=${encodedCheckId}" 
                                   class="sparkline-dot" 
                                   style="background-color: ${color}; border: ${border};" 
                                   title="${escapeHtml(tooltip)}"></a>
                            `;
                        });
                    }
                }

                if (!hasRuns) {
                    let status = 'missing';
                    let tooltip = `Test ${testID.replace('test_', '')}: Not Run`;

                    let color = 'var(--bg-tertiary)';
                    const border = '1px solid var(--border-color)';

                    const encodedTestName = encodeURIComponent(testName);
                    const encodedCheckId = encodeURIComponent(checkId);

                    sparklinesHtml += `
                        <a href="dashboard.html?testID=${testID}&testName=${encodedTestName}&checkId=${encodedCheckId}" 
                           class="sparkline-dot" 
                           style="background-color: ${color}; border: ${border};" 
                           title="${escapeHtml(tooltip)}"></a>
                    `;
                }
            });

            html += `
                <div class="history-item">
                    <div class="check-id-text" title="${checkId}">${escapeHtml(description)}</div>
                    <div class="history-sparklines">${sparklinesHtml}</div>
                </div>
            `;
        });

        html += `</div>`; // End column
    });

    html += `</div>`; // End grid
    return html;
}


function renderTrends() {
    const testIds = getSortedTestIds();
    const guidedTimeline = document.getElementById('guided-timeline');
    const unguidedTimeline = document.getElementById('unguided-timeline');

    if (!guidedTimeline || !unguidedTimeline) return;

    // Helper to render bars
    const renderBars = (groupType) => {
        return testIds.map(testID => {
            const data = allTestData[testID].data;
            const stats = calculateGroupTotalStats(data.results, groupType);
            const value = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
            const timestamp = new Date(allTestData[testID].timestamp).toLocaleDateString();

            return `
                <a class="timeline-bar" href="dashboard.html?testID=${testID}" title="${testID} - ${timestamp}: ${value}%">
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

function getRunStats(checks) {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0 };
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const rate = Math.round((passed / total) * 100);
    return { rate, passed, total };
}

function getSortedTestIds() {
    // Return only SELECTED tests, sorted by date
    return Array.from(selectedTestIds).sort((a, b) => {
        // Safety check if id not in allTestData (shouldn't happen but good practice)
        if (!allTestData[a] || !allTestData[b]) return 0;
        return new Date(allTestData[b].timestamp) - new Date(allTestData[a].timestamp);
    });
}

function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function getColor(percentage) {
    if (percentage >= 90) return 'var(--accent-success)';
    if (percentage >= 50) return '#dbab09';
    return 'var(--accent-failure)';
}

function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
