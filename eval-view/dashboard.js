import { getRunStats, getColor, escapeHtml, formatTestName, initGoogleAuth, calculateChartData, $, formatTokens, isDisciplineSkillRun } from './utils.js';
import { ApiClient } from './api.js';
import { DumbbellChart } from './dumbbell-chart.js';
import { loadStabilityTrend } from './stability_trend.js';

// Keep track of current details state for navigation
let currentDetails = null;
let allTestData = null;
let sortedScenarios = [];
let currentRunTypes = [];
let currentTestID = null;
let api;

// Module-scoped state
let dashboardLoaded = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Initialize API Client
    api = new ApiClient();

    // Auth Button Handling (only for remote)
    if (api.source === 'remote') {
        initGoogleAuth(async () => {
            // Reload on auth success
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');
            if (testId) {
                await loadDashboardData(testId);
            }
        });
    }

    const initialParams = new URLSearchParams(window.location.search);
    const initialTestID = initialParams.get('testId');

    // Update "Back to Results" buttons to carry source param
    const source = initialParams.get('source');
    if (source) {
        const backBtns = document.querySelectorAll('a[href="./"]');
        backBtns.forEach(btn => {
            if (btn instanceof HTMLAnchorElement) {
                btn.href = `./?source=${source}`;
            }
        });
    }

    if (initialTestID) {
        await loadDashboardData(initialTestID);
    } else {
        document.body.innerHTML = `<div class="error-message">Error: No testId provided in query string.</div>`;
    }
});

async function loadDashboardData(testId) {
    // Prevent double loading
    if (dashboardLoaded) return;
    dashboardLoaded = true;

    try {
        const data = await api.getEvals(testId);
        if (!data) {
            document.body.innerHTML = `<div class="error-message">Error: Failed to load evaluation data for ${testId}.</div>`;
            return;
        }

        // Capture data for navigation
        allTestData = data;
        currentTestID = testId;

        // Fetch jetski info (optional)
        let jetskiVersion = null;
        let manifestTimestamp = null;
        try {
            const jetskiData = await api.getJetskiInfo(testId);
            if (jetskiData) {
                jetskiVersion = jetskiData['Jetski Version'];
                manifestTimestamp = jetskiData.timestamp;
            }
        } catch (e) {
            console.log('Could not load Jetski info:', e);
        }

        // Fetch timestamp from manifest
        let timestamp = null;
        if (manifestTimestamp) {
            timestamp = manifestTimestamp;
        }

        renderTestHeader(testId, jetskiVersion, timestamp, data);
        renderSummary(data);
        renderGrid(data, testId);
        renderDashboardDumbbellChart(data);

        // Check for deep link to modal
        const params = new URLSearchParams(window.location.search);
        const testName = params.get('testName');
        const checkId = params.get('checkId');

        if (testName) {
            const results = data.results;
            const stats = data.stats;
            const runData = results[testName];
            const testStats = stats[testName];

            if (runData && testStats) {
                const view = params.get('view');
                const runNumber = parseInt(params.get('run'));

                if (view === 'diff' && runNumber) {
                    const run = runData.find(r => r.runNumber === runNumber);
                    if (run) {
                        currentDetails = { testName, runs: runData, stats: testStats, testId };
                        await showDetails(testName, runData, testStats, testId);

                        const { setupPath, resultPath } = await getResultPaths(testId, run, testName);
                        await viewDiff(setupPath, resultPath, testName, run.runNumber);
                    } else {
                        await showDetails(testName, runData, testStats, testId);
                    }
                } else {
                    // Auto-open modal
                    await showDetails(testName, runData, testStats, testId);
                }

                // If checkId is provided, try to scroll to it
                if (checkId) {
                    // Give the modal a moment to render
                    setTimeout(() => {
                        const checkItems = document.querySelectorAll('.check-item');
                        for (const item of checkItems) {
                            if (item.textContent.includes(checkId)) {
                                if (item instanceof HTMLElement) {
                                    item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    item.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Highlight
                                    item.style.transition = 'background-color 0.5s';
                                }
                                break;
                            }
                        }
                    }, 100);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        dashboardLoaded = false;

        let errorHtml = `<div style="text-align:center; padding: 50px; color: red;">
            <h3>Error loading dashboard data</h3>
            <p>${error.message}</p>
        </div>`;

        if (api && api.source === 'remote') {
            errorHtml += `<div style="text-align:center; color: var(--text-secondary); margin-top: -20px;">
                <p>If your session has expired, please use the <strong>Sign in with Google</strong> button above to re-authenticate.</p>
            </div>`;
        }

        const grid = document.getElementById('dashboard-grid') || document.getElementById('guide-grid') || document.getElementById('dumbbell-chart');
        if (grid) {
            grid.innerHTML = errorHtml;
        }
    }
}

// Modal control
document.addEventListener('DOMContentLoaded', () => {
    const modal = $('dialog#modal');

    const closeBtn = $('.close-modal');

    // Close function that also cleans up URL
    const closeModal = () => {
        if (modal.open) modal.close();
    };

    closeBtn.onclick = closeModal;

    // Close on backdrop click
    modal.addEventListener('click', (event) => event.target === modal && closeModal());

    // Handle Esc key or dialog close API
    modal.addEventListener('close', () => {
        const url = new URL(window.location.href);
        const paramsList = ['testName', 'checkId', 'view', 'run'];
        let changed = false;
        paramsList.forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                changed = true;
            }
        });
        if (changed) {
            window.history.replaceState({}, '', url);
        }
    });

    // View GCS Artifacts
    const gcsBtn = document.getElementById('view-gcs-artifacts-btn');
    if (gcsBtn) {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source');
        const testId = params.get('testId');
        if (source === 'remote') {
            gcsBtn.style.display = 'inline-block';
            gcsBtn.onclick = () => window.open(`https://console.cloud.google.com/storage/browser/guidance-evals/${testId}?project=chrome-kiwi-air-force-dev`, '_blank');
        }
    }

    // View Log Handler
    (async () => {
        const viewLogBtn = document.getElementById('view-log-btn');
        if (viewLogBtn) {
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');

            if (testId) {
                try {
                    const hasLog = await api.checkLogExists(testId);
                    if (!hasLog) {
                        viewLogBtn.style.display = 'none';
                    } else {
                        viewLogBtn.onclick = async () => {
                            const modal = $('dialog#modal');
                            const title = $('#modal-title');
                            const body = $('#modal-body');

                            title.textContent = 'Test Suite Run Log';
                            body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading log...</div>';
                            modal.dataset.view = 'log';
                            modal.showModal();

                            try {
                                const text = await api.getFileText(`${testId}/test_suite.log`);
                                body.innerHTML = `<div class="log-content">${escapeHtml(text)}</div>`;
                            } catch (e) {
                                body.innerHTML = `<div style="color: var(--accent-failure); padding: 20px;">Error loading log: ${e.message}</div>`;
                            }
                        };
                    }
                } catch (e) {
                    console.log('Error checking log existence:', e);
                    viewLogBtn.style.display = 'none'; // Hide button on error
                }
            } else {
                viewLogBtn.style.display = 'none'; // Hide button if no testId
            }
        }
    })();

    // Arrow key navigation
    document.addEventListener('keydown', (e) => {
        const modal = $('dialog#modal');
        if (!modal.open || modal.dataset.view !== 'details') return;

        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (!currentDetails || !sortedScenarios.length || !currentRunTypes.length) return;

            const [taskName, guide, runType] = currentDetails.testName.split(' - ');
            const currentScenario = `${taskName} - ${guide}`;

            let sIdx = sortedScenarios.indexOf(currentScenario);
            let rIdx = currentRunTypes.indexOf(runType);

            if (sIdx === -1 || rIdx === -1) return;

            const oldSIdx = sIdx;
            const oldRIdx = rIdx;

            if (e.key === 'ArrowLeft') rIdx--;
            if (e.key === 'ArrowRight') rIdx++;
            if (e.key === 'ArrowUp') sIdx--;
            if (e.key === 'ArrowDown') sIdx++;

            // Circular navigation (wrap around)
            sIdx = (sIdx + sortedScenarios.length) % sortedScenarios.length;
            rIdx = (rIdx + currentRunTypes.length) % currentRunTypes.length;

            if (sIdx === oldSIdx && rIdx === oldRIdx) return;

            const nextScenario = sortedScenarios[sIdx];
            const nextRunType = currentRunTypes[rIdx];
            const nextTestName = `${nextScenario} - ${nextRunType}`;

            const results = allTestData.results;
            if (nextTestName !== currentDetails.testName && results[nextTestName]) {
                e.preventDefault();
                showDetails(
                    nextTestName,
                    results[nextTestName],
                    allTestData.stats[nextTestName],
                    currentTestID
                );

                // Scroll to top
                const contentDiv = modal.querySelector('.modal-content');
                if (contentDiv) contentDiv.scrollTop = 0;
            }
        }
    });
});

function formatRuntime(ms) {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

function renderTestHeader(testId, jetskiVersion, timestamp, data) {
    const container = $('#test-header');
    if (container) {
        let timeStr = '-';
        if (!timestamp) {
            const dateMatch = testId.match(/(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) timestamp = dateMatch[1];
        }
        if (!timestamp && data && data.timestamp) {
            timestamp = data.timestamp;
        }
        if (timestamp) {
            try {
                const _date = new Date(timestamp);
                timeStr = _date.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                }).replace(' at ', ', ');
                if (timeStr.includes('12:00 AM') || timeStr === 'Invalid Date' || isNaN(_date.getTime())) {
                    /** @type {Intl.DateTimeFormatOptions} */
                    const options = { month: 'short', day: 'numeric' };
                    timeStr = _date.toLocaleDateString('en-US', options);
                }
            } catch { }
        }

        let agent = 'unknown';
        let model = 'unknown';
        let serving = 'unknown';

        if (data) {
            agent = data.agent || 'unknown';
            if (data.serving !== undefined) {
                serving = data.serving;
            } else if (data.enableSkills !== undefined) {
                serving = data.enableSkills ? 'skills' : 'mcp';
            }
            const servingDisplayNames = {
                'skills': 'Skills',
                'skills_cli': 'Skills (CLI)',
                'mcp': 'MCP'
            };
            serving = servingDisplayNames[serving] || serving;
            model = data.model || 'unknown';
        }

        container.innerHTML = `
            <div class="header-meta-grid">
                <div class="header-meta-item">
                    <span class="meta-value" title="${escapeHtml(testId)}">${escapeHtml(testId)}</span>
                    <span class="meta-label">Test ID</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(timeStr)}</span>
                    <span class="meta-label">Action Date</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(agent)}</span>
                    <span class="meta-label">Agent</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value" title="${escapeHtml(model)}">${escapeHtml(model)}</span>
                    <span class="meta-label">Model</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(serving)}</span>
                    <span class="meta-label">Serving Mode</span>
                </div>
                ${data.totalRuntime ?
                `<div class="header-meta-item">
                    <span class="meta-value">${formatRuntime(data.totalRuntime)}</span>
                    <span class="meta-label">Total Runtime</span>
                </div>` : ''}
                ${jetskiVersion ? `
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(jetskiVersion)}</span>
                    <span class="meta-label">Jetski Version</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}

function renderSummary(data) {
    const container = document.getElementById('summary-side-panel');
    if (!container) return;
    const summary = data.summary || {};

    if (!data || !data.results) {
        console.error('Problematic data object in renderSummary:', data);
        container.innerHTML = '<div style="padding: 15px; color: var(--text-secondary); font-style: italic;">No results available for summary.</div>';
        return;
    }

    const results = data.results;
    let totalUnguidedPassed = 0;
    let totalUnguidedChecks = 0;
    let totalGuidedPassed = 0;
    let totalGuidedChecks = 0;
    let guidedRunsCount = 0;


    const baseKeys = new Set();
    const tasksWithTools = new Set();
    const tasksWithGuides = new Set();

    Object.keys(results).forEach(key => {
        const base = key.replace(' - guided', '').replace(' - unguided', '');
        baseKeys.add(base);

        const runs = results[key];
        const isGuided = key.endsWith(' - guided');
        if (isGuided) guidedRunsCount += runs.length;

        runs.forEach(run => {
            const hasTools = run.guidanceToolsUsed && run.guidanceToolsUsed.length > 0;
            const hasGuides = (run.guidesUsed && run.guidesUsed.length > 0) || (run.guideUsed && typeof run.guideUsed === 'object' && run.guideUsed.guidesUsed && run.guideUsed.guidesUsed.length > 0);

            if (isGuided && hasTools) tasksWithTools.add(base);
            if (isGuided && hasGuides) tasksWithGuides.add(base);

            const stats = getRunStats(run.results);
            if (isGuided) {
                totalGuidedPassed += stats.passed;
                totalGuidedChecks += stats.total;

            } else {
                totalUnguidedPassed += stats.passed;
                totalUnguidedChecks += stats.total;
            }
        });
    });

    const tasksCount = baseKeys.size;
    const unguidedPassRate = totalUnguidedChecks > 0 ? Math.round((totalUnguidedPassed / totalUnguidedChecks) * 100) : 0;
    const guidedPassRate = totalGuidedChecks > 0 ? Math.round((totalGuidedPassed / totalGuidedChecks) * 100) : 0;
    const toolActivationRate = tasksCount > 0 ? Math.round((tasksWithTools.size / tasksCount) * 100) : 0;
    const guideUsageRate = tasksCount > 0 ? Math.round((tasksWithGuides.size / tasksCount) * 100) : 0;

    const upliftDelta = guidedPassRate - unguidedPassRate;

    const unguidedEarlyFailureRate = summary.unguidedEarlyFailureRate || 0;

    container.innerHTML = `
        <div class="header-meta-item dog-ear-card">
            <div class="meta-item-header">
                <span class="meta-label">Average Uplift</span>
                <span class="meta-value-highlight">+${upliftDelta}%</span>
            </div>
            <div class="sparkline-container">
                                <div class="sparkline-bar">
                    <div class="sparkline-dot unguided" style="left: calc(${unguidedPassRate}% - 6px);" title="Unguided: ${unguidedPassRate}%"></div>
                    <div class="sparkline-dot guided" style="left: calc(${guidedPassRate}% - 8px);" title="Guided: ${guidedPassRate}%"></div>
                    <div class="sparkline-range" style="left: calc(${Math.min(unguidedPassRate, guidedPassRate)}% + 4px); width: calc(${Math.abs(guidedPassRate - unguidedPassRate)}% - 8px);"></div>
                </div>
                <span class="sparkline-labels">${unguidedPassRate}% → <span>${guidedPassRate}%</span></span>
            </div>
            ${summary.expectedTotalRuns !== undefined ? `
            <div style="margin-top: 4px; font-size: 0.85em; color: var(--text-secondary);">
                Expected Runs: <span style="font-weight: bold; color: var(--text-primary);">${summary.expectedTotalRuns}${summary.taskCount ? ` (${summary.taskCount} tasks x ${summary.runCountPerTask} runs)` : ''}</span>
            </div>
            ` : ''}
            ${summary.unguidedEarlyFailures !== undefined ? `
            <div style="margin-top: 6px; font-size: 0.85em; color: var(--text-secondary);">
                Generation Errors: <span style="font-weight: bold; color: ${getColor(100 - unguidedEarlyFailureRate)}">${unguidedEarlyFailureRate}%</span>
                <span style="opacity: 0.8; color: ${getColor(100 - unguidedEarlyFailureRate)}">(${summary.unguidedEarlyFailures} runs)</span>
            </div>
            ` : ''}

        </div>

        <div class="summary-subgrid">
        <div class="header-meta-item dog-ear-card">
            <div class="meta-item-header">
                <span class="meta-label">Assertions Passed</span>
            </div>
            <div class="sparkline-container">
                <div class="sparkline-bar small">
                    <div class="sparkline-dot unguided small" style="left: calc(${(totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100}% - 3px);" title="Unguided Count: ${totalUnguidedPassed}"></div>
                    <div class="sparkline-dot guided small" style="left: calc(${(totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100}% - 4px);" title="Guided Count: ${totalGuidedPassed}"></div>
                    <div class="sparkline-range small" style="left: calc(${Math.min((totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100, (totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100)}% + 2px); width: calc(${Math.abs((totalGuidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100 - (totalUnguidedPassed / Math.max(totalUnguidedChecks, totalGuidedChecks)) * 100)}% - 4px);"></div>
                </div>
                <span class="sparkline-labels-small">${totalUnguidedPassed} → <span>${totalGuidedPassed}</span> <span>/ ${Math.max(totalUnguidedChecks, totalGuidedChecks)}</span></span>
            </div>
        </div>

        <div class="header-meta-item dog-ear-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="meta-label">Activation</span>
                <span style="color: var(--text-secondary); font-size: 1rem;">${toolActivationRate}%</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <div class="custom-progress-bar">
                    <div class="custom-progress-fill" style="width: ${toolActivationRate}%;"></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">(${tasksWithTools.size}/${tasksCount}) tasks</div>
            </div>
        </div>

        <div class="header-meta-item dog-ear-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="meta-label">Guidance Consumed</span>
                <span style="color: var(--text-secondary); font-size: 1rem;">${guideUsageRate}%</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                <div class="custom-progress-bar">
                    <div class="custom-progress-fill" style="width: ${guideUsageRate}%;"></div>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">(${tasksWithGuides.size}/${tasksCount}) tasks</div>
            </div>
        </div>

        ${summary.guidedTotalTokens || summary.unguidedTotalTokens ? `
        <div class="header-meta-item dog-ear-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="meta-label">Tokens Consumed</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
                ${summary.unguidedTotalTokens ? `
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span style="color: var(--text-secondary);">Unguided</span>
                    <span style="color: var(--text-primary); font-weight: bold;">${(summary.unguidedTotalTokens.total - (summary.unguidedTotalTokens.cached || 0)).toLocaleString()}</span>
                </div>
                ` : ''}
                ${summary.guidedTotalTokens ? `
                <div style="display: flex; justify-content: space-between; font-size: 0.85em;">
                    <span style="color: var(--text-secondary);">Guided</span>
                    <span style="color: var(--text-primary); font-weight: bold;">${(summary.guidedTotalTokens.total - (summary.guidedTotalTokens.cached || 0)).toLocaleString()}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}
        </div>
    `;
}

function renderGrid(data, testId) {
    const guideGrid = document.getElementById('guide-grid');
    const disciplineGrid = document.getElementById('discipline-grid');
    const grid = document.getElementById('dashboard-grid');

    if (guideGrid) guideGrid.innerHTML = '';
    if (disciplineGrid) disciplineGrid.innerHTML = '';
    if (grid) grid.innerHTML = '';
    const results = data.results;

    sortedScenarios = [];

    // Extract dimensions dynamically from data keys
    const keys = Object.keys(results);
    const partsMap = keys.map(k => k.split(' - '));
    const validParts = partsMap.filter(p => p.length === 3);

    const sortedAppNames = [...new Set(validParts.map(p => p[0]))].sort();
    const sortedGuides = [...new Set(validParts.map(p => p[1]))].sort((a, b) => {
        const featA = window.__featuresMapping?.[a]?.[0] || '';
        const featB = window.__featuresMapping?.[b]?.[0] || '';
        if (featA !== featB) {
            return featA.localeCompare(featB);
        }
        return a.localeCompare(b);
    });

    console.log('sortedAppNames:', sortedAppNames);
    console.log('sortedGuides count:', sortedGuides.length);

    sortedAppNames.forEach(appName => {
        sortedGuides.forEach(guide => {
            const scenarioName = `${appName} - ${guide}`;
            const unguidedKey = `${scenarioName} - unguided`;
            const guidedKey = `${scenarioName} - guided`;

            const unguidedRuns = results[unguidedKey];
            const guidedRuns = results[guidedKey];

            console.log(`Checking ${scenarioName}: unguided=${!!unguidedRuns}, guided=${!!guidedRuns}`);

            if (!unguidedRuns && !guidedRuns) return; // Skip if neither exists

            const sampleRun = (unguidedRuns && unguidedRuns[0]) || (guidedRuns && guidedRuns[0]);
            const isDisciplineSkill = isDisciplineSkillRun(sampleRun);

            sortedScenarios.push(scenarioName);

            // Calculate averages
            const getAvg = (runs) => {
                if (!runs || runs.length === 0) return 0;
                const totalPassed = runs.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
                const totalChecks = runs.reduce((acc, run) => acc + run.results.length, 0);
                return totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;
            };

            const unguidedAvg = getAvg(unguidedRuns);
            const guidedAvg = getAvg(guidedRuns);
            const uplift = guidedAvg - unguidedAvg;

            const accordion = document.createElement('div');
            accordion.className = 'task-accordion';
            accordion.id = `item-${scenarioName.replace(/\s+/g, '-').toLowerCase()}`;

            // Draw mini dumbbell slider track
            const leftDot = Math.min(unguidedAvg, guidedAvg) + 2;
            const rightDot = Math.max(unguidedAvg, guidedAvg);
            const trackWidth = 250; // matches css
            const scale = (val) => (val / 100) * trackWidth;

            accordion.innerHTML = `
                <div class="task-accordion-header">
                    <div class="left-section">
                        <span class="chevron" style="display: inline-block; transition: transform 0.2s; margin-right: 10px;">▶</span>
                        <span class="feature-chip">${escapeHtml(formatTestName(scenarioName, isDisciplineSkill).split(': ')[0])}</span>
                        <span class="task-title">${escapeHtml(formatTestName(scenarioName, isDisciplineSkill).split(': ')[1] || '')}</span>
                    </div>
                    <div class="right-section">
                        <div class="mini-dumbbell-track">
                            <div class="connector" style="left: ${scale(leftDot)}px; width: ${scale(rightDot - leftDot)}px;"></div>
                            <div class="dot unguided" style="left: ${scale(unguidedAvg)}px;"></div>
                            <div class="dot guided" style="left: ${scale(guidedAvg)}px;"></div>
                        </div>
                        <div class="uplift-score ${uplift < 0 ? 'negative' : ''}" style="${uplift === 0 ? 'color: var(--text-secondary);' : ''}">
                            ${uplift >= 0 ? '+' : ''}${uplift}%
                        </div>
                    </div>
                </div>
                <div class="task-accordion-content">
                    <div class="expansion-loading" style="color: var(--text-secondary);">Loading details...</div>
                </div>
            `;

            const header = $('.task-accordion-header', accordion);
            const content = $('.task-accordion-content', accordion);
            const chevron = $('.chevron', accordion);

            header.onclick = async () => {
                const isOpen = accordion.classList.toggle('open');
                chevron.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0deg)';

                if (isOpen && content.querySelector('.expansion-loading')) {
                    await fillAccordionDetails(content, scenarioName, unguidedRuns, guidedRuns, testId);
                }
            };

            const targetGrid = isDisciplineSkill ? disciplineGrid : guideGrid;
            if (targetGrid) {
                targetGrid.appendChild(accordion);
                if (isDisciplineSkill) {
                    const section = document.getElementById('discipline-section');
                    if (section) section.style.display = 'block';
                }
            } else if (grid) {
                grid.appendChild(accordion);
            }
        });
    });


}

async function fillAccordionDetails(container, scenarioName, unguidedRuns, guidedRuns, testId) {
    try {
        let promptHtml = '<div style="color: var(--text-secondary); margin-bottom: 20px;">Prompt fetch deferred or failed.</div>';
        let baseApp = 'n/a';

        // Fetch prompt from the first run (unguided or guided)
        const sampleRun = (unguidedRuns && unguidedRuns[0]) || (guidedRuns && guidedRuns[0]);
        if (sampleRun && sampleRun.taskName) {
            try {
                const typeLabel = (unguidedRuns && unguidedRuns[0]) ? 'unguided' : 'guided';
                const { usedBasePath } = await getResultPaths(testId, sampleRun, `${scenarioName} - ${typeLabel}`);

                let promptText = '';
                try {
                    const runScriptText = await api.getFileText(`${usedBasePath}/run.mjs`);
                    const match = runScriptText.match(/\.\.\.\[([\s\S]+?)\]/);
                    if (match) {
                        const arrayStr = `[${match[1]}]`;
                        const arr = JSON.parse(arrayStr);
                        promptText = arr[1];
                        const baseAppPath = arr[4];
                        if (baseAppPath) baseApp = sampleRun.baseApp || baseAppPath.split('/').pop();
                    }
                } catch (e) {
                    console.log('Falling back to living guide file:', e);
                }

                // Fallback to HEAD guide if run.mjs parsing fails
                if (!promptText) {
                    const isNegative = sampleRun.taskName.endsWith('-negative');
                    const taskPath = `tasks/${isNegative ? 'negative/' : ''}${sampleRun.taskName}.md`;
                    const text = await api.getFileText(taskPath);

                    const frontmatterMatch = text.match(/^---([\s\S]+?)---/);
                    if (frontmatterMatch) {
                        const yaml = frontmatterMatch[1];
                        const baseAppMatch = yaml.match(/base_app:\s*([^\n\r]+)/);
                        if (baseAppMatch) baseApp = baseAppMatch[1].trim();
                    }
                    promptText = text.replace(/^---[\s\S]+?---\n+/, '');
                }

                promptHtml = `
                    <div class="task-prompt-container">
                        <div class="task-prompt-meta">
                            <span class="task-prompt-meta-label">Base App:</span>
                            <span class="task-prompt-meta-value">${escapeHtml(baseApp)}</span>
                        </div>
                        <div class="task-prompt-quote">
                            <div class="quote-icon">“</div>
                            <p class="task-prompt-text">${formatPromptText(promptText)}</p>
                        </div>
                    </div>
                `;
            } catch (e) {
                console.log('Task prompt fetch failed:', e);
            }
        }

        // 1. Truth Matrix (Combine all runs side-by-side if multiple)
        const maxUnguided = unguidedRuns ? unguidedRuns.length : 0;
        const maxGuided = guidedRuns ? guidedRuns.length : 0;
        const maxRuns = Math.max(maxUnguided, maxGuided);

        const assertionMap = new Map(); // message -> { unguided: [], guided: [] }
        const processResultsToMap = (runs, type) => {
            if (!runs) return;
            runs.forEach((run, runIndex) => {
                if (run && run.results) {
                    run.results.forEach(check => {
                        const existing = assertionMap.get(check.message) || { unguided: [], guided: [] };
                        existing[type][runIndex] = check.passed;
                        assertionMap.set(check.message, existing);
                    });
                }
            });
        };
        processResultsToMap(unguidedRuns, 'unguided');
        processResultsToMap(guidedRuns, 'guided');

        let truthMatrixHtml = `<div style="margin-bottom: 16px;"><table class="truth-matrix"><thead>`;

        if (maxRuns > 1) {
            truthMatrixHtml += `
                <tr>
                    <th class="center" colspan="${maxRuns}">Unguided</th>
                    <th class="center" colspan="${maxRuns}">Guided</th>
                    <th rowspan="2">Assertion Requirement</th>
                </tr>
                <tr>
            `;
            for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th class="center">#${i+1}</th>`;
            for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th class="center">#${i+1}</th>`;
            truthMatrixHtml += `</tr>`;
        } else {
            truthMatrixHtml += `
                <tr>
                    <th class="center">Unguided</th>
                    <th class="center">Guided</th>
                    <th>Assertion Requirement</th>
                </tr>
            `;
        }
        truthMatrixHtml += `</thead><tbody>`;

        assertionMap.forEach((status, message) => {
            truthMatrixHtml += `<tr>`;
            if (maxRuns > 1) {
                for (let i = 0; i < maxRuns; i++) {
                    const pass = status.unguided[i];
                    truthMatrixHtml += `<td class="center ${pass !== undefined ? (pass ? 'pass' : 'fail') : ''}">${pass !== undefined ? (pass ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') : '-'}</td>`;
                }
                for (let i = 0; i < maxRuns; i++) {
                    const pass = status.guided[i];
                    truthMatrixHtml += `<td class="center ${pass !== undefined ? (pass ? 'pass' : 'fail') : ''}">${pass !== undefined ? (pass ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') : '-'}</td>`;
                }
            } else {
                const uPass = status.unguided[0];
                const gPass = status.guided[0];
                truthMatrixHtml += `<td class="center ${uPass !== undefined ? (uPass ? 'pass' : 'fail') : ''}">${uPass !== undefined ? (uPass ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') : '-'}</td>`;
                truthMatrixHtml += `<td class="center ${gPass !== undefined ? (gPass ? 'pass' : 'fail') : ''}">${gPass !== undefined ? (gPass ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><polyline points="20 6 9 17 4 12"></polyline></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>') : '-'}</td>`;
            }
            truthMatrixHtml += `<td>${escapeHtml(message)}</td></tr>`;
        });
        truthMatrixHtml += '</tbody></table></div>';

        // Compute run cards for separate horizontal grid
        // Compute column chips for the footer transposed layout (Percent + Traj + Diff Table + Log)
        const renderGuideChip = (g, run) => {
            const isExpectedGuide = g === run.guideName;
            const hasExpectedPrefix = run.expectedToolPrefixes && run.expectedToolPrefixes.some(p => g.startsWith(p));
            const isGreen = isExpectedGuide || hasExpectedPrefix;
            
            const isCorrespondingDiscipline = !isDisciplineSkillRun(run) && g === run.discipline;

            let className = 'default-guide';
            let style = 'padding: 2px 4px; border-radius: 4px; font-family: monospace;';

            if (isGreen) {
                className = 'matching-guide';
            } else if (isCorrespondingDiscipline) {
                className = ''; // Don't use default-guide
                style += ' background-color: rgba(218, 165, 32, 0.15); color: #daa520; border: 1px solid rgba(218, 165, 32, 0.3);';
            }

            return `<span class="${className}" style="${style}">${escapeHtml(g)}</span>`;
        };

                const getTfootChips = async (runs, typeLabel) => {
             const chips = [];
             for (let i = 0; i < maxRuns; i++) {
                 if (!runs || i >= runs.length) {
                     chips.push('-');
                     continue;
                 }
                 const run = runs[i];
                 const s = getRunStats(run.results);
                 const { setupPath, resultPath, usedBasePath } = await getResultPaths(testId, run, `${scenarioName} - ${typeLabel.toLowerCase()}`);
                 let files = run.files || [];
                 if (files.length === 0) {
                     try { files = await api.getRunFiles(usedBasePath); } catch (e) {}
                 }

                 const sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.html'));
                 const logFile = files.includes('mcp-server.log') ? 'mcp-server.log' : (files.includes('modern-web.log') ? 'modern-web.log' : null);
                 const jsonFile = files.find(f => f.endsWith('_results.json'));
                 const runtimeFile = files.includes('runtime.json') ? 'runtime.json' : null;
                 const appUrl = api.source === 'remote'
                     ? `https://storage.mtls.cloud.google.com/guidance-evals/${resultPath.split('?')[0]}`
                      : api.getAbsoluteUrl ? api.getAbsoluteUrl(resultPath) : `${usedBasePath}/index.html`;

                 const playWUrl = api.source === 'remote'
                     ? `https://storage.mtls.cloud.google.com/guidance-evals/${usedBasePath}/grade-report/index.html`
                     : api.getAbsoluteUrl(`${usedBasePath}/grade-report/index.html`);

                 const taskRuntime = run.runtime ? (run.runtime.agentRuntime || 0) + (run.runtime.graderRuntime || 0) : null;

                 chips.push(`
                     <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; padding: 4px;">
                         <span style="font-weight: bold; font-size: 0.85rem; color: ${getColor(s.rate)};">${s.rate}%</span>
                         ${taskRuntime ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">${formatRuntime(taskRuntime)}</span>` : ''}
                         ${run.tokenUsage ? `<span style="font-size: 0.75rem; color: var(--text-secondary);">${formatTokens(run.tokenUsage.total)}</span>` : ''}
                         <div style="display: flex; flex-direction: column; gap: 2px; width: 100%;">
                             ${sessionFile ? `<button class="tfoot-action-btn" onclick="openTrajectory('${escapeHtml(usedBasePath)}', '${escapeHtml(sessionFile)}')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg> Traj</button>` : ''}
                             <button class="tfoot-action-btn" onclick="viewDiff('${escapeHtml(setupPath)}', '${escapeHtml(resultPath)}', '${escapeHtml(scenarioName)}', ${run.runNumber})"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5V13c0 .1.03.18.08.25L7.33 8 2.08 2.75A.5.5 0 0 0 2.5 2zm11 11a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.85-.35L7.83 8l5.32 5.32c.07.07.13.1.18.12l.17.06zM7.5 9.41l-.91-.91L7.5 7.59l.91.91-.91.91z"/></svg> Diff</button>
                             <button class="tfoot-action-btn" onclick="window.open('${escapeHtml(appUrl)}', '_blank')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M14 11v3h-12v-12h3v-1h-4v14h14v-4h-1zm-4-10v1h3.3l-5.6 5.6.7.7 5.6-5.6v3.3h1v-5h-5z"/></svg> App</button>
                             ${jsonFile ? `<button class="tfoot-action-btn" onclick="viewContent('${escapeHtml(`${usedBasePath}/${jsonFile}`)}', '${escapeHtml(`${usedBasePath}/${jsonFile}`)}')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7zm0 1h7a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z"/><path d="M4.5 5.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/></svg> JSON</button>` : ''}
                             ${runtimeFile ? `<button class="tfoot-action-btn" onclick="viewContent('${escapeHtml(`${usedBasePath}/${runtimeFile}`)}', '${escapeHtml(`${usedBasePath}/${runtimeFile}`)}')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/></svg> Runtime</button>` : ''}
                             ${logFile ? `<button class="tfoot-action-btn" onclick="viewContent('${escapeHtml(`${usedBasePath}/${logFile}`)}', '${escapeHtml(`${usedBasePath}/${logFile}`)}')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M2.5 1.5A1.5 1.5 0 0 1 4 0h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V1.5zM4 1a.5.5 0 0 0-.5.5V14a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V1.5a.5.5 0 0 0-.5-.5H4z"/><path fill-rule="evenodd" d="M4 4.5h5v1H4v-1zm0 2h8v1H4v-1zm0 2h8v1H4v-1z"/></svg> Log</button>` : ''}
                             <button class="tfoot-action-btn" onclick="window.open('${escapeHtml(playWUrl)}', '_blank')"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M14 11v3h-12v-12h3v-1h-4v14h14v-4h-1zm-4-10v1h3.3l-5.6 5.6.7.7 5.6-5.6v3.3h1v-5h-5z"/></svg> PlayW</button>
                         </div>
                     </div>
                 `);
             }
             return chips;
        };

        // Compute separate horizontal run boxes for Tools Used & Guides Used Only
                        const getRunCards = async (runs, typeLabel) => {
             let html = '';
             for (let i = 0; i < maxRuns; i++) {
                 if (!runs || i >= runs.length) continue;
                 const run = runs[i];
                 const { usedBasePath } = await getResultPaths(testId, run, `${scenarioName} - ${typeLabel.toLowerCase()}`);
                 let files = run.files || [];
                 if (files.length === 0) {
                     try { files = await api.getRunFiles(usedBasePath); } catch (e) {}
                 }
                 const toolsUsed = run.guidanceToolsUsed || [];
                 const guidesUsed = run.guidesUsed || (run.guideUsed && run.guideUsed.guidesUsed) || [];
                 const retrievedGuides = run.retrievedGuides || [];
                 const fileReadGuides = run.fileReadGuides || [];

                 if (toolsUsed.length === 0 && guidesUsed.length === 0 && retrievedGuides.length === 0 && fileReadGuides.length === 0) continue;

                 html += `
                     <div class="run-card">
                         <span class="run-card-title">${typeLabel} Run ${i + 1}</span>

                         ${toolsUsed.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">Tools Used:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
                                                                   ${toolsUsed.map(t => {
                                      const isCorrectTool = run.expectedToolPrefixes && run.expectedToolPrefixes.some(p => t.startsWith(p));
                                      const isCorrespondingDiscipline = !isDisciplineSkillRun(run) && t === run.discipline;

                                      let className = 'default-guide';
                                      let style = 'padding: 2px 4px; border-radius: 4px; font-family: monospace;';

                                      if (isCorrectTool) {
                                          className = 'matching-guide';
                                      } else if (isCorrespondingDiscipline) {
                                          className = ''; // Don't use default-guide
                                          style += ' background-color: rgba(218, 165, 32, 0.15); color: #daa520; border: 1px solid rgba(218, 165, 32, 0.3);';
                                      }

                                      return `<span class="${className}" style="${style}">${escapeHtml(t)}</span>`;
                                  }).join('')}
                             </div>
                         </div>` : ''}

                         ${retrievedGuides.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">Retrieved Guides:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
                                 ${retrievedGuides.map(g => renderGuideChip(g, run)).join('')}
                             </div>
                         </div>` : ''}

                         ${fileReadGuides.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">File Read Guides:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
                                 ${fileReadGuides.map(g => renderGuideChip(g, run)).join('')}
                             </div>
                         </div>` : ''}
                     </div>
                 `;
             }
             return html;
        };

        const unguidedChips = await getTfootChips(unguidedRuns, 'Unguided');
        const guidedChips = await getTfootChips(guidedRuns, 'Guided');

        let tfootHtml = '<tfoot><tr>';
        if (maxRuns > 1) {
            unguidedChips.forEach(c => tfootHtml += `<td class="center" style="vertical-align: top;">${c}</td>`);
            guidedChips.forEach(c => tfootHtml += `<td class="center" style="vertical-align: top;">${c}</td>`);
        } else {
            tfootHtml += `<td class="center" style="vertical-align: top;">${unguidedChips[0]}</td><td class="center" style="vertical-align: top;">${guidedChips[0]}</td>`;
        }
const guidedCards = await getRunCards(guidedRuns, 'Guided');
        tfootHtml += `<td>
<div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 12px;">${guidedCards}</div>
</td></tr></tfoot>`;

        truthMatrixHtml = truthMatrixHtml.replace('</tbody></table></div>', `</tbody>${tfootHtml}</table></div>`);


        const loadBtnId = `load-btn-${scenarioName.replace(/\s+/g, '-')}`;

        container.innerHTML = `
            <div class="task-details-grid">
                ${promptHtml}
                ${truthMatrixHtml}

            </div>
        `;

            //  i left this out of it for now.
         // <div id="${escapeHtml(svgContainerId)}" class="stability-section blueprint-framed">
         //            <div class="stability-title">Reliability Trend Analysis</div>
         //            <button id="${escapeHtml(loadBtnId)}" class="secondary-btn">Compare task results across trials</button>
         //        </div>

        const loadBtn = container.querySelector(`#${loadBtnId}`);
        if (loadBtn) {
            loadBtn.addEventListener('click', () => {
                loadStabilityTrend(scenarioName, testId);
            });
        }

    } catch (e) {
        container.innerHTML = `<div style="color: var(--accent-failure);">Error loading details: ${e.message}</div>`;
    }
}

function formatPromptText(text) {
    const escaped = escapeHtml(text);
    const target = "\n\nDon't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.";
    const escapedTarget = escapeHtml(target);

    if (escaped.includes(escapedTarget)) {
        return escaped.replace(escapedTarget, `<span style="font-size: 80%; opacity: 0.7;">${escapedTarget}</span>`);
    }
    return escaped;
}

function openTrajectory(usedBasePath, sessionFile) {
    if (api.source === 'remote') {
        const finalPath = api.getAbsoluteUrl(`${usedBasePath}/${sessionFile}`);
        api._fetch(finalPath)
            .then(res => { if (!res.ok) throw new Error(); return res.blob(); })
            .then(blob => {
                const htmlBlob = new Blob([blob], { type: 'text/html' });
                const url = URL.createObjectURL(htmlBlob);
                window.open(url, '_blank');
            })
            .catch(e => {
                console.error('Error loading trajectory:', e);
                alert('Failed to load remote trajectory');
            });
    } else {
        window.open(api.getAbsoluteUrl(`${usedBasePath}/${sessionFile}`), '_blank');
    }
}

// Global helper to open details from task list
// @ts-expect-error global export
window.openDetailsFromTask = (scenarioName, testId) => {
    // Attempt to find runData. We might need to fetch it or pass it.
    // If we assume `allTestData` is available globally (it is), we can find it.
    // Wait, and we need to call showDetails. Let's see if we can find any runType for this scenario to pass to showDetails.
    // showDetails expects testName like "AppName - GuideName - RunType".
    // Let's pass "AppName - GuideName - guided" as a default to showDetails if it exists, or unguided.
    const guidedKey = `${scenarioName} - guided`;
    const unguidedKey = `${scenarioName} - unguided`;
    const finalKey = allTestData.results[guidedKey] ? guidedKey : unguidedKey;
    if (allTestData.results[finalKey]) {
        showDetails(finalKey, allTestData.results[finalKey], allTestData.stats[finalKey], testId);
    } else {
        alert('Could not find run data for this task.');
    }
};

// Expose functions to window for onclick handlers
// @ts-expect-error global export
window.openTrajectory = openTrajectory;
// @ts-expect-error global export
window.viewContent = viewContent;
// @ts-expect-error global export
window.viewDiff = viewDiff;

async function showDetails(testName, runs, stats, testId) {
    const modal = $('dialog#modal');
    if (modal.open) modal.close();

    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('testName', testName);
    window.history.replaceState({ testName }, '', url);

    // Store for back navigation
    currentDetails = { testName, runs, stats, testId };

    const matchName = testName.split(' - ')[0];
    const accordionId = `item-${matchName.replace(/\s+/g, '-').toLowerCase()}`;
    const accordionEl = document.getElementById(accordionId);

    if (accordionEl) {
        accordionEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!accordionEl.classList.contains('open')) {
            const header = $('.task-accordion-header', accordionEl);
            header.click();
        }
    }
}

function renderBackButton() {
    const btn = document.createElement('button');
    btn.innerHTML = '← Back';
    btn.className = 'secondary-btn';
    btn.style.cssText = 'margin-bottom: 20px; padding: 5px 15px; font-size: 0.9em;';
    btn.onclick = () => {
        if (currentDetails) {
            showDetails(currentDetails.testName, currentDetails.runs, currentDetails.stats, currentDetails.testId);
        }
    };
    return btn;
}

async function viewContent(fileName, filePath) {
    const title = $('#modal-title');
    const body = $('#modal-body');
    const modal = $('dialog#modal');

    title.textContent = fileName;
    modal.dataset.view = 'content';
    if (!modal.open) modal.showModal();
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading content...</div>';

    body.innerHTML = '';
    body.appendChild(renderBackButton());

    const pre = document.createElement('pre');
    pre.className = 'log-content';
    body.appendChild(pre);

    try {
        const text = await api.getFileText(filePath);

        if (fileName.endsWith('diff.txt')) {
            body.innerHTML = '';
            body.appendChild(renderBackButton());

            const files = text.split(/^diff --git /m);
            let anyRendered = false;

            for (let i = 0; i < files.length; i++) {
                let fileDiff = files[i].trim();
                if (!fileDiff) continue;

                // Extract a nice file header
                const lines = fileDiff.split('\n');
                let fileHeader = lines[0];
                if (fileHeader.startsWith('a/')) {
                    fileHeader = fileHeader.split(' b/')[0].replace(/^a\//, '');
                }

                const details = document.createElement('details');
                details.className = 'diff-file-details';
                details.style.marginBottom = '12px'; // Keep margin for spacing

                const summary = document.createElement('summary');
                summary.className = 'diff-file-summary';
                summary.textContent = fileHeader;
                details.appendChild(summary);

                const preEl = document.createElement('pre');
                preEl.className = 'diff-container diff-file-pre';
                preEl.style.padding = '0';
                preEl.style.fontSize = '0.75rem';

                preEl.textContent = 'diff --git ' + fileDiff;

                details.appendChild(preEl);
                body.appendChild(details);
                anyRendered = true;
            }

            if (anyRendered) return; // intercepted successfully
        }

        const lines = text.split('\n');
        const truncated = lines.length > 5000;
        const content = truncated ? lines.slice(0, 5000).join('\n') + '\n\n...[truncated for display]...' : text;
        pre.textContent = content; // escapeHtml not needed if using textContent on a pre
        pre.className = '';

    } catch (e) {
        body.innerHTML = '';
        body.appendChild(renderBackButton());
        const error = document.createElement('div');
        error.style.color = 'var(--accent-failure)';
        error.style.padding = '20px';
        error.textContent = `Error loading file: ${e.message}`;
        body.appendChild(error);
    }
}

async function viewDiff(setupPath, resultPath, testName, runNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'diff');
    url.searchParams.set('run', runNumber);
    window.history.replaceState({}, '', url);

    const modal = $('dialog#modal');
    const title = $('#modal-title');
    const body = $('#modal-body');
    const contentDiv = $('.modal-content');

    modal.dataset.runNumber = runNumber;

    title.textContent = `Diff: ${formatTestName(testName)} (Run ${runNumber})`;
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Computing diff...</div>';

    // Optional: Make modal wider for diff
    modal.classList.add('diff-modal');
    contentDiv.classList.add('diff-modal');
    modal.dataset.view = 'diff';
    if (!modal.open) modal.showModal();

    try {
        let setupText = null;
        try {
            setupText = await api.getFileText(setupPath);
        } catch (e) {
            // If setup is missing (404), treat as null to show banner
            // If it's a real error, throw
            if (!e.message.includes('404')) {
                throw new Error(`Failed to load setup file: ${setupPath}`);
            }
        }

        const resultText = await api.getFileText(resultPath);

        let diffHtml = '<div class="diff-container">';

        if (setupText === null) {
            diffHtml += `<div style="background-color: rgba(218, 165, 32, 0.2); border-left: 4px solid #daa520; padding: 15px; margin-bottom: 20px; border-radius: 4px;">
                <span style="font-weight: bold; color: #daa520;">Original file not found.</span> Displaying current file content below.
            </div>`;
            diffHtml += `<pre style="white-space: pre-wrap; margin: 0; color: var(--text-primary); font-family: monospace;">${escapeHtml(resultText)}</pre>`;
        } else {
            // @ts-expect-error global library
            const diff = Diff.diffLines(setupText, resultText);

            diff.forEach((part, index) => {
                const colorClass = part.added ? 'diff-added' :
                    part.removed ? 'diff-removed' : 'diff-unchanged';

                if (part.added || part.removed) {
                    diffHtml += `<span class="${colorClass}">${escapeHtml(part.value)}</span>`;
                    return;
                }

                // Unchanged part
                let lines = part.value.split('\n');
            // If the last element is empty (common with trailing newline), temporarily remove it for counting
            let trailingNewline = false;
            if (lines.length > 0 && lines[lines.length - 1] === '') {
                lines.pop();
                trailingNewline = true;
            }

            const CONTEXT = 3;
            // Only collapse if we save significant space (e.g. > context*2 lines)
            if (lines.length > CONTEXT * 2) {
                const isFirst = index === 0;
                const isLast = index === diff.length - 1;

                let head = '';
                let tail = '';
                let hiddenCount = 0;

                if (isFirst) {
                    const tailLines = lines.slice(-CONTEXT);
                    hiddenCount = lines.length - CONTEXT;
                    tail = tailLines.join('\n') + (trailingNewline ? '\n' : '');
                } else if (isLast) {
                    const headLines = lines.slice(0, CONTEXT);
                    hiddenCount = lines.length - CONTEXT;
                    head = headLines.join('\n') + '\n';
                } else {
                    const headLines = lines.slice(0, CONTEXT);
                    const tailLines = lines.slice(-CONTEXT);
                    hiddenCount = lines.length - (CONTEXT * 2);
                    head = headLines.join('\n') + '\n';
                    tail = tailLines.join('\n') + (trailingNewline ? '\n' : '');
                }

                if (hiddenCount > 0) {
                    if (head) diffHtml += `<span class="${colorClass}">${escapeHtml(head)}</span>`;
                    diffHtml += `<div class="diff-separator">... ${hiddenCount} unchanged lines ...</div>`;
                    if (tail) diffHtml += `<span class="${colorClass}">${escapeHtml(tail)}</span>`;
                    return;
                }
            }

                diffHtml += `<span class="${colorClass}">${escapeHtml(part.value)}</span>`;
            });
        }

        diffHtml += '</div>';

        body.innerHTML = '';
        body.appendChild(renderBackButton());

        const container = document.createElement('div');
        container.innerHTML = diffHtml;
        body.appendChild(container);

    } catch (e) {
        body.innerHTML = '';
        body.appendChild(renderBackButton());
        const error = document.createElement('div');
        error.style.color = 'var(--accent-failure)';
        error.style.padding = '20px';
        error.textContent = `Error loading diff: ${e.message}`;
        body.appendChild(error);
        contentDiv.classList.remove('diff-modal');
    }
}

function renderDashboardDumbbellChart(data) {
    const results = data.results;


    if (Object.keys(results).length < 1) {
        document.getElementById('chart-section').classList.add('hidden');
        return;
    }
    document.getElementById('chart-section').classList.remove('hidden');

    const container = document.getElementById('dumbbell-chart');
    if (!container) return;
    container.innerHTML = ''; // Clear old content

    // Apply CSS columns layout to balance heights
    container.style.display = 'block';
    container.style.columns = '2';
    container.style.gap = '16px';
    container.style.width = '100%';

    // Group results by discipline
    const groupedByDiscipline = {};
    Object.keys(results).forEach(key => {
        const runs = results[key];
        const sampleRun = runs[0];
        const discipline = sampleRun ? sampleRun.discipline : 'Uncategorized';

        if (!groupedByDiscipline[discipline]) {
            groupedByDiscipline[discipline] = {};
        }
        groupedByDiscipline[discipline][key] = runs;
    });

    // Sort disciplines by number of features (descending) to help balance columns
    const disciplines = Object.keys(groupedByDiscipline).sort((a, b) => {
        const countA = Object.keys(groupedByDiscipline[a]).length;
        const countB = Object.keys(groupedByDiscipline[b]).length;
        return countB - countA;
    });

    disciplines.forEach(discipline => {
        const disciplineResults = groupedByDiscipline[discipline];
        const { labels, guided, unguided, guided_tokens, unguided_tokens } = calculateChartData(disciplineResults);

        if (labels.length === 0) return;

        const chartDiv = document.createElement('div');
        chartDiv.className = 'discipline-chart-segment';

        const titleEl = document.createElement('div');
        titleEl.className = 'meta-label';
        titleEl.textContent = discipline;
        titleEl.style.padding = '12px 16px 0'; // Padding top and horizontal
        chartDiv.appendChild(titleEl);

        const svgContainer = document.createElement('div');
        svgContainer.className = 'chart-svg-container';
        chartDiv.appendChild(svgContainer);

        container.appendChild(chartDiv);

        const handlePointClick = (index, type) => {
            const scenarioName = labels[index];
            const runType = type.toLowerCase();
            const originalKey = Object.keys(disciplineResults).find(key => {
                const parts = key.split(' - ');
                return `${parts[0]} (${parts[1]})` === scenarioName && parts[2] === runType;
            });

            if (originalKey) {
                const testName = originalKey;
                const scenarioPart = testName.split(' - ')[1] || '';
                const accordions = document.querySelectorAll('.task-accordion');
                for (const acc of accordions) {
                    const titleEl = acc.querySelector('.task-title');
                    if (titleEl && titleEl.textContent.trim() === scenarioPart.trim()) {
                        const headerEl = $('.task-accordion-header', acc);
                        if (!acc.classList.contains('open')) {
                            headerEl.click();
                        }
                        acc.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        break;
                    }
                }
            }
        };

        const datasets = [
            { label: 'Unguided', data: unguided, tokens: unguided_tokens, onClick: handlePointClick },
            { label: 'Guided', data: guided, tokens: guided_tokens, onClick: handlePointClick }
        ];

        const chart = new DumbbellChart(svgContainer, {
            size: 500,
            rowHeight: 28,
            margin: { top: 5, right: 200, bottom: 40, left: 30 },
            hideLegend: true // Hide legend for individual charts to save space
        });
        chart.render({ labels, datasets });
    });
}

async function getResultPaths(testId, run, testName) {
    return await api.getResultInfo(testId, run, testName);
}
