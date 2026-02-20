import { getRunStats, getColor, escapeHtml, formatTestName } from './utils.js';

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

        // Check for deep link to modal
        const testName = params.get('testName');
        const checkId = params.get('checkId');

        if (testName) {
            const results = data.results;
            const stats = data.stats;
            const runData = results[testName];
            const testStats = stats[testName];

            if (runData && testStats) {
                // Auto-open modal
                await showDetails(testName, runData, testStats, testID);

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

    // Modal close handlers
    const modal = document.getElementById('modal');
    const closeBtn = document.querySelector('.close-modal');
    closeBtn.onclick = () => modal.classList.remove('show');
    window.onclick = (event) => {
        if (event.target == modal) modal.classList.remove('show');
    }

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
                    modal.classList.add('show');

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

    sortedAppNames.forEach(appName => {
        sortedGuides.forEach(guide => {
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

// Keep track of current details state for "Back" navigation
let currentDetails = null;

async function showDetails(testName, runs, stats, testID) {
    // Store current details for back navigation
    currentDetails = { testName, runs, stats, testID };

    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const contentDiv = document.querySelector('.modal-content');
    const body = document.getElementById('modal-body');
    const [appName, guide, runType] = testName.split(' - ');

    // Reset modifier classes
    contentDiv.classList.remove('diff-modal');

    title.textContent = formatTestName(testName);

    // Fetch prompt text
    let promptHtml = '';
    try {
        const promptPath = `base_apps/${appName}/PROMPT.txt`;
        const res = await fetch(promptPath);
        if (res.ok) {
            const text = await res.text();
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
    const runDetailsPromises = runs.map(async (run, index) => {
        const s = getRunStats(run.results);

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
        const setupPath = `base_apps/${appName}/${runType}/${relativePath}`;

        let guideSection = '';
        if (run.guideResults && run.guideResults.checks) {
            const guideStats = getRunStats(run.guideResults.checks);
            // Toggle ID
            const toggleId = `guide-toggle-${run.runNumber}`;
            const contentId = `guide-content-${run.runNumber}`;

            // Professional Look: Clean styling, no raw arrows
            // Using SVG for chevron
            const chevronRight = `<svg width="12" height="12" viewBox="0 0 12 12" fill="none" style="transition: transform 0.2s; margin-right: 8px;"><path d="M4 2L8 6L4 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

            guideSection = `
                <div class="guide-section" style="margin-top: 15px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid var(--border-color); overflow: hidden;">
                    <div id="${toggleId}" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 15px; cursor: pointer; user-select: none; background: rgba(255,255,255,0.02); transition: background 0.1s;">
                        <div style="display: flex; align-items: center;">
                            <span class="toggle-icon-wrapper" style="display: flex; align-items: center;">${chevronRight}</span>
                            <strong style="font-size: 0.9em; font-weight: 600;">Guide Validation</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.85em; color: ${getColor(guideStats.rate)}; font-weight: 600; background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: 10px;">${guideStats.rate}% Match</span>
                        </div>
                    </div>
                    
                    <div id="${contentId}" style="display: none; padding: 0 15px 15px 15px; border-top: 1px solid var(--border-color);">
                        <div style="padding-top: 10px; margin-bottom: 10px; text-align: right;">
                             <a href="#" class="view-resources-link" style="font-size: 0.8em; color: var(--text-secondary); text-decoration: underline; opacity: 0.7;">View resources_used.json</a>
                        </div>
                        <ul class="check-list" style="border: 1px solid var(--border-color); border-radius: 4px; overflow: hidden;">
                            ${run.guideResults.checks.map(check => `
                                <li class="check-item" style="padding: 8px 12px; font-size: 0.9em;">
                                    <span class="check-status" style="font-size: 1rem;">${check.passed ? '✅' : '❌'}</span>
                                    <span class="check-message" style="color: var(--text-primary); font-family: -apple-system, sans-serif;">${escapeHtml(check.message)}</span>
                                </li>
                            `).join('')}
                        </ul>
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

        // Handle Guide Toggle
        const toggleBtn = runDetail.querySelector(`#guide-toggle-${run.runNumber}`);
        const contentArea = runDetail.querySelector(`#guide-content-${run.runNumber}`);
        if (toggleBtn && contentArea) {
            toggleBtn.onclick = () => {
                const isHidden = contentArea.style.display === 'none';
                contentArea.style.display = isHidden ? 'block' : 'none';
                const icon = toggleBtn.querySelector('svg');
                if (icon) {
                    icon.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
                }
                toggleBtn.style.background = isHidden ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)';
            };

            // Hover effect for header
            toggleBtn.onmouseenter = () => { toggleBtn.style.background = 'rgba(255,255,255,0.05)'; };
            toggleBtn.onmouseleave = () => { if (contentArea.style.display === 'none') toggleBtn.style.background = 'rgba(255,255,255,0.02)'; };
        }

        const viewResourcesLink = runDetail.querySelector('.view-resources-link');
        if (viewResourcesLink) {
            viewResourcesLink.onclick = (e) => {
                e.preventDefault();
                // usedBasePath is like "results/testID/runNumber/appName/guide/runType"
                // resources_used.json is usually in that same directory
                const resourcesPath = `${usedBasePath}/resources_used.json`;
                viewContent(resourcesPath, resourcesPath);
            };
        }

        const diffButton = document.createElement('button');
        diffButton.className = 'secondary-btn small-btn';
        diffButton.textContent = 'View Diff';
        diffButton.style.cssText = 'margin-left: 10px; font-size: 0.8em; padding: 2px 8px;';
        diffButton.onclick = () => viewDiff(setupPath, resultPath);

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
    modal.classList.add('show');
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

    title.textContent = fileName;
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading content...</div>';

    try {
        const res = await fetch(filePath);
        if (!res.ok) throw new Error('Failed to fetch file');
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

async function viewDiff(setupPath, resultPath) {
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const contentDiv = document.querySelector('.modal-content');

    title.textContent = 'Diff View';
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Computing diff...</div>';

    // Optional: Make modal wider for diff
    contentDiv.classList.add('diff-modal');

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
