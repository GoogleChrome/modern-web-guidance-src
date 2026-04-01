import { getRunStats, getColor, escapeHtml, formatTestName, initGoogleAuth, calculateChartData } from './utils.js';
import { ApiClient } from './api.js';
import { DumbbellChart } from './dumbbell-chart.js';

// Keep track of current details state for navigation
let currentDetails = null;
let allTestData = null;
let sortedScenarios = [];
let currentRunTypes = [];
let currentTestID = null;
let api;

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

    if (initialTestID) {
        await loadDashboardData(initialTestID);
    } else {
        document.body.innerHTML = `<div style="text-align:center; padding: 50px; color: red;">Error: No testId provided in query string.</div>`;
    }
});

async function loadDashboardData(testId) {
    // Prevent double loading
    if (window.dashboardLoaded) return;
    window.dashboardLoaded = true;

    try {
        const data = await api.getEvals(testId);
        if (!data) {
            document.body.innerHTML = `<div style="text-align:center; padding: 50px; color: red;">Error: Failed to load evaluation data for ${testId}.</div>`;
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
        renderDashboardDumbbellChart(data, testId);

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
                                item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                item.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Highlight
                                item.style.transition = 'background-color 0.5s';
                                break;
                            }
                        }
                    }, 100);
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        window.dashboardLoaded = false;

        let errorHtml = `<div style="text-align:center; padding: 50px; color: red;">
            <h3>Error loading dashboard data</h3>
            <p>${error.message}</p>
        </div>`;
        
        if (api && api.source === 'remote') {
            errorHtml += `<div style="text-align:center; color: var(--text-secondary); margin-top: -20px;">
                <p>If your session has expired, please use the <strong>Sign in with Google</strong> button above to re-authenticate.</p>
            </div>`;
        }
        
        const grid = document.getElementById('dashboard-grid');
        if (grid) {
            grid.innerHTML = errorHtml;
        } else {
            document.body.innerHTML = errorHtml;
        }
    }
}

// Modal control
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('modal');
    if (!modal) return;

    const closeBtn = document.querySelector('.close-modal');

    // Close function that also cleans up URL
    const closeModal = () => {
        if (modal.open) modal.close();
    };

    if (closeBtn) closeBtn.onclick = closeModal;

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
                            const modal = document.getElementById('modal');
                            const title = document.getElementById('modal-title');
                            const body = document.getElementById('modal-body');

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
        const modal = document.getElementById('modal');
        if (!modal || !modal.open || modal.dataset.view !== 'details') return;

        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (!currentDetails || !sortedScenarios.length || !currentRunTypes.length) return;

            const parts = currentDetails.testName.split(' - ');
            if (parts.length !== 3) return;
            const [appName, guide, runType] = parts;
            const currentScenario = `${appName} - ${guide}`;

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

            if (nextTestName !== currentDetails.testName && allTestData.results[nextTestName]) {
                e.preventDefault();
                showDetails(
                    nextTestName,
                    allTestData.results[nextTestName],
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

function renderTestHeader(testId, jetskiVersion, timestamp, data) {
    const container = document.getElementById('test-header');
    if (container) {
        let html = `Test ID: <strong>${escapeHtml(testId)}</strong>`;

        if (timestamp) {
            let timeStr = timestamp;
            try {
                const _date = new Date(timestamp);
                timeStr = _date.toLocaleString('en-US', {
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                }).replace(' at ', ', ');
            } catch { }
            html += ` — ${timeStr}`;
        }

        if (jetskiVersion) {
            html += ` — Jetski Version: <strong>${escapeHtml(jetskiVersion)}</strong>`;
        }

        if (data) {
            let agent = data.agent || 'unknown';
            let serving = 'unknown';
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
            let model = data.model || 'unknown';

            html += `<div style="margin-top: 6px; display: flex; flex-direction: column; gap: 2px;">
                <span>Agent: <strong>${escapeHtml(agent)}</strong></span>
                <span>Model: <strong style="color: var(--text-secondary);">${escapeHtml(model)}</strong></span>
                <span>Serving: <strong>${escapeHtml(serving)}</strong></span>
            </div>`;
        }

        container.innerHTML = html;
    }
}

function renderSummary(data) {
    const container = document.getElementById('summary-stats');
    const summary = data.summary;

    const unguidedRate = summary.unguidedPassRate;
    const guidedRate = summary.guidedPassRate;

    container.innerHTML = `
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(unguidedRate)}">
                ${unguidedRate}%
            </span>
            <span class="stat-label">Unguided Pass Rate</span>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                ${summary.unguidedPassed}/${summary.unguidedTotal} checks passed
            </div>
        </div>
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(guidedRate)}">
                ${guidedRate}%
            </span>
            <span class="stat-label">Guided Pass Rate</span>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                ${summary.guidedPassed}/${summary.guidedTotal} checks passed
            </div>
            ${summary.toolActivationRate !== undefined ? `
            <div style="margin-top: 6px; font-size: 0.85em; color: var(--text-secondary);">
                Tool Activation: <span style="font-weight: bold; color: ${getColor(summary.toolActivationRate)}">${summary.toolActivationRate}%</span>
                <span style="opacity: 0.8; color: ${getColor(summary.toolActivationRate)}">(${summary.toolActivationCount}/${summary.totalGuidedRuns} runs)</span>
            </div>
            ` : ''}
            ${summary.guideUsageRate !== undefined ? `
            <div style="margin-top: 6px; font-size: 0.85em; color: var(--text-secondary);">
                Guide Usage: <span style="font-weight: bold; color: ${getColor(summary.guideUsageRate)}">${summary.guideUsageRate}%</span>
                <span style="opacity: 0.8; color: ${getColor(summary.guideUsageRate)}">(${summary.guideUsageCount}/${summary.totalGuidedRuns} runs)</span>
            </div>
            ` : ''}
        </div>
    `;
}

function renderGrid(data, testId) {
    const grid = document.getElementById('dashboard-grid');
    const results = data.results;
    const stats = data.stats;

    sortedScenarios = [];
    currentRunTypes = [];

    // Extract dimensions dynamically from data keys
    const keys = Object.keys(results);
    const partsMap = keys.map(k => k.split(' - '));

    // Assume 3 parts: [appName, guide, runType]
    const validParts = partsMap.filter(p => p.length === 3);

    const sortedAppNames = [...new Set(validParts.map(p => p[0]))].sort();
    const sortedGuides = [...new Set(validParts.map(p => p[1]))].sort();

    // Sort runTypes: unguided first, then guided, then alphabetical
    const sortedRunTypes = [...new Set(validParts.map(p => p[2]))].sort((a, b) => {
        if (a === 'unguided' && b === 'guided') return -1;
        if (a === 'guided' && b === 'unguided') return 1;
        return a.localeCompare(b);
    });
    currentRunTypes = sortedRunTypes;

    sortedAppNames.forEach(appName => {
        sortedGuides.forEach(guide => {
            sortedScenarios.push(`${appName} - ${guide}`);
            sortedRunTypes.forEach(runType => {
                const testName = `${appName} - ${guide} - ${runType}`;
                const runData = results[testName];
                const testStats = stats[testName];

                if (!runData) return; // Skip combinations that don't exist

                const card = document.createElement('div');
                card.className = 'test-card';

                // Calculate Total/Average Pass Rate for this specific test configuration
                const totalPassed = runData.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
                const totalChecks = runData.reduce((acc, run) => acc + run.results.length, 0);
                const avgRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

                let toolActivationHtml = '';
                if (runType === 'guided' && testStats && testStats.runsWithToolActivation !== undefined) {
                    const count = testStats.runsWithToolActivation;
                    const total = testStats.runCount;
                    const toolActivationRate = total > 0 ? Math.round((count / total) * 100) : 0;
                    const color = getColor(toolActivationRate);
                    toolActivationHtml = `
                        <div style="font-size: 0.85em; margin-top: 4px; color: ${color}; font-weight: 500;">
                            Tool Activated (${count}/${total} runs)
                        </div>
                    `;
                }

                let guideUsageHtml = '';
                if (runType === 'guided' && testStats && testStats.runsUsingGuide !== undefined) {
                    const count = testStats.runsUsingGuide;
                    const total = testStats.runCount;
                    const usageRate = total > 0 ? Math.round((count / total) * 100) : 0;
                    const color = getColor(usageRate);
                    guideUsageHtml = `
                        <div style="font-size: 0.85em; margin-top: 6px; color: ${color}; font-weight: 500;">
                            Guide Used (${count}/${total} runs)
                        </div>
                    `;
                }

                card.onclick = () => showDetails(testName, runData, testStats, testId);
                card.innerHTML = `
                    <h3>${formatTestName(testName)}</h3>
                    <div class="pass-rate-bar">
                        <div class="pass-rate-fill" style="width: ${avgRate}%; background-color: ${getColor(avgRate)}"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: var(--text-secondary);">
                        <span>Average: ${avgRate}% <span style="opacity: 0.8">(${totalPassed}/${totalChecks})</span></span>
                        <span>Runs: ${runData.length}</span>
                    </div>
                    ${toolActivationHtml}
                    ${guideUsageHtml}
                `;

                grid.appendChild(card);
            });
        });
    });
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

async function showDetails(testName, runs, stats, testId) {
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('testName', testName);
    url.searchParams.delete('view');
    url.searchParams.delete('run');
    window.history.replaceState({ testName }, '', url);

    // Store current details for back navigation
    currentDetails = { testName, runs, stats, testId };

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const contentDiv = document.querySelector('.modal-content');
    const body = document.getElementById('modal-body');
    const [, guide, runType] = testName.split(' - ');

    // Reset modifier classes
    modal.classList.remove('diff-modal');
    contentDiv.classList.remove('diff-modal');
    modal.dataset.view = 'details';

    title.textContent = formatTestName(testName);

    let promptHtml = ''; // Initialize promptHtml outside the map

    const runDetailsPromises = runs.map(async (run) => {
        const s = getRunStats(run.results);
        // Determine file paths for this run
        const { setupPath, resultPath, usedBasePath } = await getResultPaths(testId, run, testName);

        let sessionFile = null;
        let files = [];
        try {
            files = await api.getRunFiles(usedBasePath);
            if (files && files.length > 0) {
                sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.html'));
            }
        } catch (e) {
            console.log('Error checking run files:', e);
        }

        // Fetch prompt text from the task definition
        if (run === runs[0]) {
            try {
                const isNegative = run.taskName && run.taskName.endsWith('-negative');
                const taskPath = `tasks/${isNegative ? 'negative/' : ''}${run.taskName}.md`;
                const text = await api.getFileText(taskPath);

                // Extract base_app from YAML frontmatter
                const frontmatterMatch = text.match(/^---([\s\S]+?)---/);
                let baseApp = 'n/a';
                if (frontmatterMatch) {
                    const yaml = frontmatterMatch[1];
                    const baseAppMatch = yaml.match(/base_app:\s*([^\n\r]+)/);
                    if (baseAppMatch) {
                        baseApp = baseAppMatch[1].trim();
                    }
                }

                // Strip YAML frontmatter from the markdown task file
                const cleanedText = text.replace(/^---[\s\S]+?---\n+/, '');

                promptHtml = `
                    <div class="prompt-section" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid var(--text-secondary);">
                        <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 10px;">Base App: <strong style="color: var(--text-primary);">${escapeHtml(baseApp)}</strong></div>
                        <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 5px;">Prompt: <strong style="color: var(--text-primary); white-space: pre-wrap; font-family: inherit;">${escapeHtml(cleanedText)}</strong></div>
                    </div>
                `;
            } catch (e) {
                console.log('Task prompt file not found:', e.message);
            }
        }

        let usageSection = '';
        const toolsUsed = run.guidanceToolsUsed || [];
        const expectedTool = run.expectedGuidanceTool;
        const hasToolData = run.guidanceToolsUsed !== undefined;

        const guidesUsed = run.guidesUsed || 
               (run.guideUsed !== undefined ? 
               (typeof run.guideUsed === 'object' && run.guideUsed !== null ? run.guideUsed.guidesUsed : []) 
               : []);
        const expectedGuide = run.expectedGuide || guide;
        const hasGuideData = run.guidesUsed !== undefined || run.guideUsed !== undefined;

        const logFile = files.includes('mcp-server.log') ? 'mcp-server.log' : 'modern-web.log';
        const shouldUseTrajectory = (allTestData.serving ? (allTestData.serving === 'skills' || allTestData.serving === 'skills_cli') : allTestData.enableSkills) && sessionFile;

        if (runType !== 'unguided' && (hasToolData || hasGuideData)) {
            usageSection = `
                <div class="usage-section" style="margin-top: 15px; padding: 12px 15px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color);">
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        ${hasToolData ? `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 0.9em; font-weight: 600; color: var(--text-secondary); min-width: 90px;">Tools Used:</strong>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${toolsUsed.length > 0 ? toolsUsed.map(t => {
                                    const isExpected = t === expectedTool;
                                    return `<code style="background: ${isExpected ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255,255,255,0.05)'}; padding: 3px 6px; border-radius: 4px; font-size: 0.85em; border: 1px solid ${isExpected ? 'var(--accent-success)' : 'var(--border-color)'}; color: ${isExpected ? 'var(--accent-success)' : 'var(--text-primary)'}">${escapeHtml(t)}</code>`;
                                }).join('') : '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.85em;">None</span>'}
                            </div>
                        </div>` : ''}

                        ${hasGuideData ? `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <strong style="font-size: 0.9em; font-weight: 600; color: var(--text-secondary); min-width: 90px;">Guides Used:</strong>
                            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                                ${guidesUsed.length > 0 ? guidesUsed.map(g => {
                                    const isExpected = g === expectedGuide;
                                    return `<code style="background: ${isExpected ? 'rgba(0, 200, 0, 0.1)' : 'rgba(255,255,255,0.05)'}; padding: 3px 6px; border-radius: 4px; font-size: 0.85em; border: 1px solid ${isExpected ? 'var(--accent-success)' : 'var(--border-color)'}; color: ${isExpected ? 'var(--accent-success)' : 'var(--text-primary)'}">${escapeHtml(g)}</code>`;
                                }).join('') : '<span style="color: var(--text-secondary); font-style: italic; font-size: 0.85em;">None</span>'}
                            </div>
                        </div>` : ''}

                        <div style="margin-top: 5px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end;">
                            <a href="#" class="view-resources-link" style="font-size: 0.8em; color: var(--text-secondary); text-decoration: underline; opacity: 0.7;">${shouldUseTrajectory ? 'Agent Trajectory' : logFile}</a>
                        </div>
                    </div>
                </div>
            `;
        }

        const runDetail = document.createElement('div');
        runDetail.className = 'run-detail';
        runDetail.innerHTML = `
            <div class="run-header">
                <strong>Run ${run.runNumber}</strong>
                <span style="color: ${getColor(s.rate)}; margin-left: auto; margin-right: 15px;">${s.rate}% Pass (${s.passed}/${s.total})</span>
                <div class="run-actions">
                </div>
            </div>
            <ul class="check-list">
                ${run.results.map(check => `
                    <li class="check-item">
                        <span class="check-status">${check.passed ? '✅' : '❌'}</span>
                        <span class="check-message">${escapeHtml(check.message)}</span>
                    </li>
                `).join('')}
            </ul>
            ${usageSection}
        `;

        const viewResourcesLink = runDetail.querySelector('.view-resources-link');
        if (viewResourcesLink) {
            viewResourcesLink.onclick = (e) => {
                e.preventDefault();
                if (shouldUseTrajectory) {
                    openTrajectory(usedBasePath, sessionFile);
                } else {
                    const resourcesPath = `${usedBasePath}/${logFile}`;
                    viewContent(resourcesPath, resourcesPath);
                }
            };
        }

        const dropdown = document.createElement('select');
        dropdown.className = 'run-actions-dropdown';
        dropdown.style.cssText = 'padding: 4px; font-size: 0.9em; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-secondary); color: var(--text-primary); cursor: pointer;';
        dropdown.innerHTML = '<option value="" disabled selected>Artifacts</option>';

        const sourceOpt = document.createElement('option');
        sourceOpt.value = 'source';
        sourceOpt.textContent = 'App';
        dropdown.appendChild(sourceOpt);

        const diffOpt = document.createElement('option');
        diffOpt.value = 'diff';
        diffOpt.textContent = 'Diff';
        dropdown.appendChild(diffOpt);

        try {
            if (files && files.length > 0) {
                const rawJson = files.find(f => f === `${guide}_results.json`);
                if (rawJson) {
                    const rawOpt = document.createElement('option');
                    rawOpt.value = 'raw';
                    rawOpt.textContent = 'Raw Test Results';
                    dropdown.appendChild(rawOpt);
                }

                if (sessionFile) {
                    const trajOpt = document.createElement('option');
                    trajOpt.value = 'trajectory';
                    trajOpt.textContent = 'Trajectory';
                    dropdown.appendChild(trajOpt);
                }
            }
        } catch (e) {
            console.log('Error displaying options:', e);
        }

        dropdown.onchange = (e) => {
            const val = e.target.value;
            e.target.value = ''; // reset selection
            if (val === 'source') {
                if (api.source === 'remote') {
                    // Open directly via the mTLS domain which handles auth and serves raw HTML
                    window.open(`https://storage.mtls.cloud.google.com/guidance-evals/${resultPath.split('?')[0]}`, '_blank');
                } else {
                    window.open(api.getAbsoluteUrl(resultPath), '_blank');
                }
            } else if (val === 'diff') {
                viewDiff(setupPath, resultPath, testName, run.runNumber);
            } else if (val === 'trajectory' && sessionFile) {
                openTrajectory(usedBasePath, sessionFile);
            } else if (val === 'raw') {
                const rawPath = `${usedBasePath}/${guide}_results.json`;
                viewContent(rawPath, rawPath);
            }
        };

        runDetail.querySelector('.run-actions').appendChild(dropdown);
        return runDetail;
    });

    const runDetails = await Promise.all(runDetailsPromises);
    body.innerHTML = promptHtml; // Insert promptHtml first
    runDetails.forEach(detail => body.appendChild(detail));
    modal.showModal();
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
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const modal = document.getElementById('modal');

    title.textContent = fileName;
    modal.dataset.view = 'content';
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading content...</div>';

    body.innerHTML = '';
    body.appendChild(renderBackButton());

    const pre = document.createElement('pre');
    pre.className = 'log-content';
    body.appendChild(pre);

    try {
        const text = await api.getFileText(filePath);
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

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const contentDiv = document.querySelector('.modal-content');

    modal.dataset.runNumber = runNumber;

    title.textContent = `Diff: ${formatTestName(testName)} (Run ${runNumber})`;
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Computing diff...</div>';

    // Optional: Make modal wider for diff
    modal.classList.add('diff-modal');
    contentDiv.classList.add('diff-modal');
    modal.dataset.view = 'diff';

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

function renderDashboardDumbbellChart(data, testId) {
    const { labels, guided, unguided } = calculateChartData(data.results);
    
    if (labels.length < 1) {
        document.getElementById('chart-section').classList.add('hidden');
        return;
    }
    document.getElementById('chart-section').classList.remove('hidden');

    const handlePointClick = (index, type) => {
        const scenarioName = labels[index]; // e.g. "redfield (vague)"
        const runType = type.toLowerCase(); // "guided" or "unguided"

        // Find the original key in the results
        const originalKey = Object.keys(data.results).find(key => {
            const parts = key.split(' - ');
            return `${parts[0]} (${parts[1]})` === scenarioName && parts[2] === runType;
        });

        if (originalKey) {
            const testName = originalKey;
            const runData = data.results[testName];
            const testStats = data.stats[testName];
            showDetails(testName, runData, testStats, testId);
        }
    };

    const datasets = [
        {
            label: 'Unguided',
            data: unguided,
            onClick: handlePointClick
        },
        {
            label: 'Guided',
            data: guided,
            onClick: handlePointClick
        }
    ];

    // Render the Dumbbell Chart
    if (window.dumbbellChart) window.dumbbellChart.container.innerHTML = '';
    window.dumbbellChart = new DumbbellChart('dumbbell-chart', {
        size: 700,
        rowHeight: 30,
        margin: { top: 20, right: 200, bottom: 20, left: 30 }
    });
    window.dumbbellChart.render({ labels, datasets });
}

async function getResultPaths(testId, run, testName) {
    return await api.getResultInfo(testId, run, testName);
}
