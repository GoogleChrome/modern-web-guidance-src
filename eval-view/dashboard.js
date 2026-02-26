import { getRunStats, getColor, escapeHtml, formatTestName } from './utils.js';
import { RadarChart } from './radar.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get testID from query string
        const params = new URLSearchParams(window.location.search);
        const testID = params.get('testID');

        if (!testID) {
            throw new Error('No testID provided in query string');
        }

        const evalsPath = `results/${testID}/evals.json?t=${Date.now()}`;
        const response = await fetch(evalsPath);
        if (!response.ok) throw new Error(`Failed to load data from ${evalsPath}`);
        const data = await response.json();

        // Capture data for navigation
        allTestData = data;
        currentTestID = testID;

        // Fetch jetski info (optional)
        let jetskiVersion = null;
        try {
            const jetskiRes = await fetch(`results/${testID}/jetski_info.json`);
            if (jetskiRes.ok) {
                const jetskiData = await jetskiRes.json();
                jetskiVersion = jetskiData['Jetski Version'];
            }
        } catch (e) {
            console.log('Could not load Jetski info:', e);
        }

        // Fetch timestamp from manifest
        let timestamp = null;
        try {
            const manifestRes = await fetch(`results/tests.json?t=${Date.now()}`);
            if (manifestRes.ok) {
                const manifest = await manifestRes.json();
                const testEntry = manifest.tests.find(t => t.id === testID);
                if (testEntry && testEntry.timestamp) {
                    timestamp = testEntry.timestamp;
                }
            }
        } catch (e) {
            console.log('Could not load test manifest:', e);
        }

        renderTestHeader(testID, jetskiVersion, timestamp);
        renderSummary(data, testID);
        renderGrid(data, testID);
        renderRadarChart(data, testID);

        // Check for deep link to modal
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
                        currentDetails = { testName, runs: runData, stats: testStats, testID };
                        await showDetails(testName, runData, testStats, testID);

                        const { setupPath, resultPath } = await getResultPaths(testID, run, testName);
                        await viewDiff(setupPath, resultPath, testName, run.runNumber);
                    } else {
                        await showDetails(testName, runData, testStats, testID);
                    }
                } else {
                    // Auto-open modal
                    await showDetails(testName, runData, testStats, testID);
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
        document.body.innerHTML = `<div style="text-align:center; padding: 50px; color: red;">Error loading dashboard data: ${error.message}</div>`;
    }

    // Modal control
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close-modal');

    // Close function that also cleans up URL
    const closeModal = () => {
        if (modal.open) modal.close();
    };

    closeBtn.onclick = closeModal;

    // Close on backdrop click
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Handle Esc key or dialog close API
    modal.addEventListener('close', () => {
        const url = new URL(window.location.href);
        const params = ['testName', 'checkId', 'view', 'run'];
        let changed = false;
        params.forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                changed = true;
            }
        });
        if (changed) {
            window.history.replaceState({}, '', url);
        }
    });

    // We no longer need popstate for modal state because we use replaceState exclusively.
    // Full page deep links are handled via DOMContentLoaded.

    // View Log Handler
    const viewLogBtn = document.getElementById('view-log-btn');
    if (viewLogBtn) {
        const params = new URLSearchParams(window.location.search);
        const testID = params.get('testID');
        const logPath = `results/${testID}/test_suite.log`;

        // Check if log file exists
        try {
            const checkRes = await fetch(logPath, { method: 'HEAD' });
            if (!checkRes.ok) {
                // Hide button if log doesn't exist
                viewLogBtn.style.display = 'none';
            } else {
                // Show button and set up click handler
                viewLogBtn.onclick = async () => {
                    const modal = document.getElementById('modal');
                    const title = document.getElementById('modal-title');
                    const body = document.getElementById('modal-body');

                    title.textContent = 'Test Suite Run Log';
                    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading log...</div>';
                    modal.dataset.view = 'log';
                    modal.showModal();

                    try {
                        const res = await fetch(logPath);
                        if (!res.ok) throw new Error('Failed to fetch log');
                        const text = await res.text();
                        body.innerHTML = `<div class="log-content">${escapeHtml(text)}</div>`;
                    } catch (e) {
                        body.innerHTML = `<div style="color: var(--accent-failure); padding: 20px;">Error loading log: ${e.message}</div>`;
                    }
                };
            }
        } catch {
            // Hide button on error
            viewLogBtn.style.display = 'none';
        }
    }

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

function renderTestHeader(testID, jetskiVersion, timestamp) {
    const container = document.getElementById('test-header');
    if (container) {
        let html = `Test ID: <strong>${testID}</strong>`;

        if (timestamp) {
            let timeStr = timestamp;
            try {
                timeStr = new Date(timestamp).toLocaleString();
            } catch { }
            html += ` — Run at ${timeStr}`;
        }

        if (jetskiVersion) {
            html += ` — Jetski Version: <strong>${jetskiVersion}</strong>`;
        }
        container.innerHTML = html;
    }
}

function renderSummary(data, _testID) {
    const container = document.getElementById('summary-stats');
    const results = data.results;

    const unguidedStats = calculateGroupTotalStats(results, 'unguided');
    const guidedStats = calculateGroupTotalStats(results, 'guided');

    const unguidedRate = unguidedStats.total > 0 ? Math.round((unguidedStats.passed / unguidedStats.total) * 100) : 0;
    const guidedRate = guidedStats.total > 0 ? Math.round((guidedStats.passed / guidedStats.total) * 100) : 0;

    container.innerHTML = `
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(unguidedRate)}">
                ${unguidedRate}%
            </span>
            <span class="stat-label">Unguided Pass Rate</span>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                ${unguidedStats.passed}/${unguidedStats.total} checks passed
            </div>
        </div>
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(guidedRate)}">
                ${guidedRate}%
            </span>
            <span class="stat-label">Guided Pass Rate</span>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                ${guidedStats.passed}/${guidedStats.total} checks passed
            </div>
        </div>
    `;
}

function calculateGroupTotalStats(results, runType) {
    let passed = 0;
    let total = 0;

    Object.keys(results).forEach(key => {
        // key format: "appName - guide - runType"
        if (key.endsWith(` - ${runType}`)) {
            results[key].forEach(run => {
                const s = getRunStats(run.results);
                passed += s.passed;
                total += s.total;
            });
        }
    });

    return { passed, total };
}

function renderGrid(data, testID) {
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

                card.onclick = () => showDetails(testName, runData, testStats, testID);
                card.innerHTML = `
                    <h3>${formatTestName(testName)}</h3>
                    <div class="pass-rate-bar">
                        <div class="pass-rate-fill" style="width: ${avgRate}%; background-color: ${getColor(avgRate)}"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: var(--text-secondary);">
                        <span>Average: ${avgRate}% <span style="opacity: 0.8">(${totalPassed}/${totalChecks})</span></span>
                        <span>Runs: ${testStats.rates.length}</span>
                    </div>
                `;

                grid.appendChild(card);
            });
        });
    });
}

// Keep track of current details state for navigation
let currentDetails = null;
let allTestData = null;
let sortedScenarios = [];
let currentRunTypes = [];
let currentTestID = null;

async function showDetails(testName, runs, stats, testID) {
    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('testName', testName);
    url.searchParams.delete('view');
    url.searchParams.delete('run');
    window.history.replaceState({ testName }, '', url);

    // Store current details for back navigation
    currentDetails = { testName, runs, stats, testID };

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const contentDiv = document.querySelector('.modal-content');
    const body = document.getElementById('modal-body');
    const [, guide] = testName.split(' - ');

    // Reset modifier classes
    modal.classList.remove('diff-modal');
    contentDiv.classList.remove('diff-modal');
    modal.dataset.view = 'details';

    title.textContent = formatTestName(testName);

    // Fetch prompt text from tasks directory
    let promptHtml = '';
    try {
        const taskPath = `tasks/${guide}.md`;
        const res = await fetch(taskPath);
        if (res.ok) {
            let text = await res.text();
            
            // Strip frontmatter if present
            const frontmatterMatch = text.match(/^---\n(?:[\s\S]*?)\n---\n([\s\S]*)$/);
            if (frontmatterMatch) {
                text = frontmatterMatch[1].trim();
            }

            promptHtml = `
                    <div class="prompt-section" style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 6px; margin-bottom: 20px; border-left: 4px solid var(--text-secondary);">
                    <h4 style="margin-top: 0; margin-bottom: 10px;">Prompt</h4>
                        <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; color: var(--text-primary);">${escapeHtml(text)}</pre>
                    </div>
                `;
        }
    } catch (e) {
        console.error('Failed to fetch prompt', e);
    }

    // Check for setup file asynchronously for each run to show View Diff button if applicable
    const runDetailsPromises = runs.map(async (run) => {
        const s = getRunStats(run.results);
        const { setupPath, resultPath, usedBasePath } = await getResultPaths(testID, run, testName);

        let guideSection = '';
        if (run.guideUsed !== undefined) {
            const passed = run.guideUsed;

            guideSection = `
                <div class="guide-section" style="margin-top: 15px; padding: 10px 15px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 1rem;">${passed ? '✅' : '❌'}</span>
                        <strong style="font-size: 0.9em; font-weight: 600;">${guide} used by agent</strong>
                    </div>
                    <div>
                        <a href="#" class="view-resources-link" style="font-size: 0.8em; color: var(--text-secondary); text-decoration: underline; opacity: 0.7;">View mcp_tool_calls.log</a>
                    </div>
                </div>
            `;
        }

        const runDetail = document.createElement('div');
        runDetail.className = 'run-detail';
        runDetail.innerHTML = `
            <div class="run-header">
                <strong>Run ${run.runNumber}</strong>
                <span style="color: ${getColor(s.rate)}">${s.rate}% Pass (${s.passed}/${s.total})</span>
                <div class="run-actions">
                    <a href="${resultPath}" target="_blank">View Source ↗</a>
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
            ${guideSection}
        `;

        const viewResourcesLink = runDetail.querySelector('.view-resources-link');
        if (viewResourcesLink) {
            viewResourcesLink.onclick = (e) => {
                e.preventDefault();
                const resourcesPath = `${usedBasePath}/mcp_tool_calls.log`;
                viewContent(resourcesPath, resourcesPath);
            };
        }

        const diffButton = document.createElement('button');
        diffButton.className = 'secondary-btn small-btn';
        diffButton.textContent = 'View Diff';
        diffButton.style.cssText = 'margin-left: 10px; font-size: 0.8em; padding: 2px 8px;';
        diffButton.onclick = () => viewDiff(setupPath, resultPath, testName, run.runNumber);

        const rawResultsPath = `${usedBasePath}/${guide}_results.json`;
        let showRawResults = false;
        try {
            const rawRes = await fetch(rawResultsPath, { method: 'HEAD' });
            if (rawRes.ok) showRawResults = true;
        } catch (e) {
            console.log('Error checking raw results:', e);
        }

        if (showRawResults) {
            const rawResultsBtn = document.createElement('button');
            rawResultsBtn.className = 'secondary-btn small-btn';
            rawResultsBtn.textContent = 'View Raw Results';
            rawResultsBtn.style.cssText = 'margin-left: 10px; font-size: 0.8em; padding: 2px 8px;';
            rawResultsBtn.onclick = () => viewContent(rawResultsPath, rawResultsPath);
            runDetail.querySelector('.run-actions').appendChild(rawResultsBtn);
        }

        runDetail.querySelector('.run-actions').appendChild(diffButton);
        return runDetail;
    });

    const runDetails = await Promise.all(runDetailsPromises);
    body.innerHTML = promptHtml;
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
            showDetails(currentDetails.testName, currentDetails.runs, currentDetails.stats, currentDetails.testID);
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

    try {
        const res = await fetch(filePath);
        if (!res.ok) {
            if (res.status === 404) {
                throw new Error('Resources file not found.');
            }
            throw new Error(`Failed to fetch file (Status: ${res.status})`);
        }
        const text = await res.text();

        body.innerHTML = '';
        body.appendChild(renderBackButton());

        const content = document.createElement('div');
        content.className = 'log-content';
        content.textContent = text;
        body.appendChild(content);

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
        const [setupRes, resultRes] = await Promise.all([
            fetch(setupPath),
            fetch(resultPath)
        ]);

        // If setup is missing (404), treat as empty string
        let setupText = '';
        if (setupRes.ok) {
            setupText = await setupRes.text();
        } else if (setupRes.status !== 404) {
            // If it's not OK and NOT 404, likely a real error
            throw new Error(`Failed to load setup file: ${setupPath} (${setupRes.status})`);
        }

        if (!resultRes.ok) throw new Error(`Failed to load result file: ${resultPath}`);
        const resultText = await resultRes.text();

        const diff = Diff.diffLines(setupText, resultText);

        let diffHtml = '<div class="diff-container">';

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

function renderRadarChart(data, testID) {
    const results = data.results;
    const apps = {};

    Object.keys(results).forEach(key => {
        const parts = key.split(' - ');
        if (parts.length !== 3) return;

        const [appName, guide, runType] = parts;
        const scenarioName = `${appName} (${guide})`;

        if (!apps[scenarioName]) {
            apps[scenarioName] = { guided: [], unguided: [] };
        }

        const runData = results[key];
        const totalPassed = runData.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
        const totalChecks = runData.reduce((acc, run) => acc + run.results.length, 0);
        const avgRate = totalChecks > 0 ? (totalPassed / totalChecks) * 100 : 0;

        if (runType === 'guided') {
            apps[scenarioName].guided.push(avgRate);
        } else if (runType === 'unguided') {
            apps[scenarioName].unguided.push(avgRate);
        }
    });

    const labels = Object.keys(apps).sort();
    if (labels.length < 3) {
        document.getElementById('chart-section').classList.add('hidden');
        return;
    }

    document.getElementById('chart-section').classList.remove('hidden');

    const guidedData = labels.map(label => {
        const scores = apps[label].guided;
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    });
    const unguidedData = labels.map(label => {
        const scores = apps[label].unguided;
        return scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    });

    const chart = new RadarChart('radar-chart', {
        size: 600,
        levels: 5,
        padding: 80
    });

    const handlePointClick = (index, type) => {
        const scenarioName = labels[index]; // e.g. "redfield (vague)"
        const runType = type.toLowerCase(); // "guided" or "unguided"

        // Find the original key in the results
        const originalKey = Object.keys(results).find(key => {
            const parts = key.split(' - ');
            return `${parts[0]} (${parts[1]})` === scenarioName && parts[2] === runType;
        });

        if (originalKey) {
            const testName = originalKey;
            const runData = results[testName];
            const testStats = data.stats[testName];
            showDetails(testName, runData, testStats, testID);
        }
    };

    chart.render({
        labels: labels,
        datasets: [
            {
                label: 'Unguided',
                data: unguidedData,
                backgroundColor: 'rgba(218, 54, 51, 0.2)',
                borderColor: '#da3633',
                onClick: handlePointClick
            },
            {
                label: 'Guided',
                data: guidedData,
                backgroundColor: 'rgba(35, 134, 54, 0.2)',
                borderColor: '#238636',
                onClick: handlePointClick
            }
        ]
    });
}


async function getResultPaths(testID, run, testName) {
    const [appName, guide, runType] = testName.split(' - ');
    const actualBaseApp = run.baseApp || appName;

    // Cover cases for new use case format and old (greenfield, brownfield, redfield) format
    const basePaths = [
        `results/${testID}/${run.runNumber}/${appName}/${runType}`,
        `results/${testID}/${run.runNumber}/${appName}/${guide}/${runType}`
    ];

    const resultPath = await findBestEntryPoint(basePaths);

    // Determine which base path was used
    const usedBasePath = basePaths.find(bp => resultPath.startsWith(bp)) || basePaths[0];

    // Calculate relative path (e.g., "src/App.jsx" or "index.html")
    const relativePath = resultPath.replace(usedBasePath + '/', '');
    
    // Check old style path and new style path
    const candidateSetupPaths = [
        `base_apps/${actualBaseApp}/${runType}/${relativePath}`,
        `base_apps/${actualBaseApp}/${relativePath}`
    ];
    let setupPath = candidateSetupPaths[candidateSetupPaths.length - 1]; // Assume new style by default
    
    for (const path of candidateSetupPaths) {
        try {
            const res = await fetch(path, { method: 'HEAD' });
            if (res.ok) {
                setupPath = path;
                break;
            }
        } catch {}
    }

    return { setupPath, resultPath, usedBasePath };
}

async function findBestEntryPoint(basePaths) {
    // basePaths can be a string or array of strings
    const pathsToCheck = Array.isArray(basePaths) ? basePaths : [basePaths];

    const candidates = [
        'dist/index.html',
        'src/App.jsx',
        'src/App.js',
        'src/main.jsx',
        'src/main.js',
        'src/index.jsx',
        'src/index.js',
        'index.html'
    ];

    for (const basePath of pathsToCheck) {
        const checks = candidates.map(candidate =>
            fetch(`${basePath}/${candidate}`, { method: 'HEAD' })
                .then(res => res.ok ? `${basePath}/${candidate}` : null)
                .catch(() => null)
        );

        const results = await Promise.all(checks);
        const best = results.find(result => result !== null);

        if (best) return best;
    }

    // Fallback to first base path index.html if nothing found
    return `${pathsToCheck[0]}/index.html`;
}
