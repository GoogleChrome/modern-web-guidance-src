let allTestData = {}; // Cache all test data by testID
let currentTab = 'overview';
let currentScenarioFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadAllTests();

        // Initialize UI
        setupTabs();
        setupFilters();

        // Initial Render
        renderOverview();
        renderExplorer();
        renderTrends();

    } catch (error) {
        console.error('Error:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab state
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Hide all content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Show selected content
            const targetId = `${tab.dataset.tab}-tab`;
            document.getElementById(targetId).classList.add('active');

            currentTab = tab.dataset.tab;
        });
    });
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

async function loadAllTests() {
    try {
        const response = await fetch('results/tests.json');
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
                const response = await fetch(`results/${testEntry.id}/evals.json`);
                if (response.ok) {
                    allTestData[testEntry.id] = {
                        timestamp: testEntry.timestamp,
                        data: await response.json()
                    };
                }
            } catch (e) {
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

    // Animate numbers (simple)
    const guidedVal = latestData.summary.guidedMedian;
    const unguidedVal = latestData.summary.unguidedMedian;

    guidedMetric.textContent = `${guidedVal}%`;
    guidedMetric.style.color = getColor(guidedVal);

    unguidedMetric.textContent = `${unguidedVal}%`;
    unguidedMetric.style.color = getColor(unguidedVal);

    // 2. Render Recent Tests List
    const container = document.getElementById('overview-recent-tests');
    const recentTests = testIds.slice(0, 5);

    container.innerHTML = recentTests.map(testID => {
        const testInfo = allTestData[testID];
        const data = testInfo.data;
        const summary = data.summary;
        const timestamp = new Date(testInfo.timestamp).toLocaleString();

        return `
            <a class="recent-test-item" href="dashboard.html?testID=${testID}">
                <div>
                    <div class="test-id">Test ${testID.replace('test_', '')}</div>
                    <div class="test-timestamp">${timestamp}</div>
                </div>
                <div class="test-stats">
                    <div>
                        <div class="stat-label">Guided</div>
                        <div class="stat-value" style="color: ${getColor(summary.guidedMedian)}">${summary.guidedMedian}%</div>
                    </div>
                    <div>
                        <div class="stat-label">Unguided</div>
                        <div class="stat-value" style="color: ${getColor(summary.unguidedMedian)}">${summary.unguidedMedian}%</div>
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
        const stats = data.stats;

        const testStats = stats[testName];

        if (testStats) {
            hasData = true;
            cellsHtml.push(`
                <a class="test-grid-cell"
                     href="dashboard.html?testID=${testID}"
                     style="background-color: ${getColor(testStats.median)}" 
                     title="${testName}: ${testStats.median}%">
                    ${testStats.median}%
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

                let status = 'missing';
                let tooltip = `Test ${testID.replace('test_', '')}: Not Run`;

                if (results && results[testName]) {
                    const runs = results[testName];
                    if (runs && runs.length > 0) {
                        const run = runs[0];
                        const check = run.results.find(c => c.id === checkId);
                        if (check) {
                            status = check.passed ? 'pass' : 'fail';
                            tooltip = `Test ${testID.replace('test_', '')}: ${check.passed ? 'PASS' : 'FAIL'}\n${check.message}`;
                        }
                    }
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

            html += `
                <div class="history-item">
                    <div class="check-id-text" title="${checkId}">${description}</div>
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
    const renderBars = (metric) => {
        return testIds.map(testID => {
            const data = allTestData[testID].data;
            const value = data.summary[metric];
            const timestamp = new Date(allTestData[testID].timestamp).toLocaleDateString();

            return `
                <a class="timeline-bar" href="dashboard.html?testID=${testID}" title="${testID} - ${timestamp}: ${value}%">
                    <div class="timeline-bar-fill" style="height: ${Math.max(value * 2, 10)}px; background-color: ${getColor(value)}"></div>
                    <div class="timeline-bar-label">${value}%</div>
                </a>
            `;
        }).join('');
    };

    guidedTimeline.innerHTML = renderBars('guidedMedian');
    unguidedTimeline.innerHTML = renderBars('unguidedMedian');
}

// ==========================================
// HELPERS
// ==========================================

function getSortedTestIds() {
    return Object.keys(allTestData).sort((a, b) => {
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
