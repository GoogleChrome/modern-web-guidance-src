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
        } catch {
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
        } catch {
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
                    } catch {
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

function renderSummary(data, testID) {
    const container = document.getElementById('summary-stats');
    const summary = data.summary;
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

function renderGrid(data, testID) {
    const grid = document.getElementById('dashboard-grid');
    const results = data.results;
    const stats = data.stats;

    // Define the order explicitly to ensure Unguided (Left) vs Guided (Right) alignment
    const scenarios = ['greenfield', 'brownfield', 'redfield'];
    const prompts = ['vague', 'specific'];
    // We want Unguided first (Left Column), then Guided (Right Column)
    const agents = ['unguided', 'guided'];

    scenarios.forEach(scenario => {
        prompts.forEach(prompt => {
            agents.forEach(agent => {
                const testName = `${scenario} - ${prompt} - ${agent}`;
                const runData = results[testName];
                const testStats = stats[testName];

                const card = document.createElement('div');
                card.className = 'test-card';

                if (runData && testStats) {
                    // Calculate Total/Average Pass Rate for this specific test configuration
                    let totalPassed = 0;
                    let totalChecks = 0;
                    runData.forEach(run => {
                        const s = getRunStats(run.results);
                        totalPassed += s.passed;
                        totalChecks += s.total;
                    });

                    const numRuns = runData.length;
                    const avgRate = totalChecks > 0 ? Math.round((totalPassed / totalChecks) * 100) : 0;

                    // Display totals to ensure the percentage mathematically matches the fraction
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
                } else {
                    // Render placeholder or empty state if data is missing to maintain grid alignment
                    card.style.opacity = '0.5';
                    card.innerHTML = `<h3>${formatTestName(testName)}</h3><p>No Data</p>`;
                }

                grid.appendChild(card);
            });
        });
    });
}

async function showDetails(testName, runs, stats, testID) {
    const modal = document.getElementById('modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    const [scenario, prompt, agent] = testName.split(' - ');

    title.textContent = formatTestName(testName);

    // Fetch prompt text
    let promptHtml = '';
    try {
        const promptPath = `setup/${scenario}/${prompt}/PROMPT.txt`;
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
    } catch {
        console.error('Failed to fetch prompt', e);
    }

    // Check for setup file asynchronously for each run to show View Diff button if applicable
    const runDetailsPromises = runs.map(async run => {
        const s = getRunStats(run.results);
        const basePath = `results/${testID}/${run.runNumber}/${scenario}/${prompt}/${agent}`;
        const resultPath = await findBestEntryPoint(basePath);

        // Calculate relative path (e.g., "src/App.jsx" or "index.html")
        // resultPath is like "results/.../src/App.jsx"
        // basePath is like "results/..."
        const relativePath = resultPath.replace(basePath + '/', '');
        const setupPath = `setup/${scenario}/${prompt}/${agent}/${relativePath}`;

        // Check if setup file exists - logic removed, we always want to attempt a diff
        // If the setup file is missing, viewDiff will treat it as an empty file (all new content)
        const diffButton = `<button class="secondary-btn small-btn" onclick="viewDiff('${setupPath}', '${resultPath}')" style="margin-left: 10px; font-size: 0.8em; padding: 2px 8px;">View Diff</button>`;

        return `
            <div class="run-detail">
                <div class="run-header">
                    <strong>Run ${run.runNumber}</strong>
                    <span style="color: ${getColor(s.rate)}">${s.rate}% Pass (${s.passed}/${s.total})</span>
                    <div>
                        <a href="${resultPath}" target="_blank">View Source ↗</a>
                        ${diffButton}
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
            </div>
        `;
    });

    const runsHtml = (await Promise.all(runDetailsPromises)).join('');

    body.innerHTML = promptHtml + runsHtml;
    modal.classList.add('show');
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

        body.innerHTML = diffHtml;

    } catch {
        body.innerHTML = `<div style="color: var(--accent-failure); padding: 20px;">Error loading diff: ${e.message}</div>`;
        contentDiv.classList.remove('diff-modal');
    }
}

function getRunStats(checks) {
    if (!checks || !checks.length) return { rate: 0, passed: 0, total: 0 };
    const passed = checks.filter(c => c.passed).length;
    const total = checks.length;
    const rate = Math.round((passed / total) * 100);
    return { rate, passed, total };
}

function calculateRunPassRate(checks) {
    return getRunStats(checks).rate;
}

function getColor(percentage) {
    if (percentage >= 90) return 'var(--accent-success)'; // Green
    if (percentage >= 50) return '#dbab09'; // Yellow/Orange
    return 'var(--accent-failure)'; // Red
}

function formatTestName(name) {
    return name.split(' - ').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' / ');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function findBestEntryPoint(basePath) {
    const candidates = [
        'src/App.jsx',
        'src/App.js',
        'src/main.jsx',
        'src/main.js',
        'src/index.jsx',
        'src/index.js',
        'index.html'
    ];

    const checks = candidates.map(candidate =>
        fetch(`${basePath}/${candidate}`, { method: 'HEAD' })
            .then(res => res.ok ? candidate : null)
            .catch(() => null)
    );

    const results = await Promise.all(checks);
    const best = results.find(result => result !== null);

    if (best) return `${basePath}/${best}`;
    // Fallback
    return `${basePath}/index.html`;
}
