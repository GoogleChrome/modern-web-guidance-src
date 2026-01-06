document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Get testID from query string
        const params = new URLSearchParams(window.location.search);
        const testID = params.get('testID');

        if (!testID) {
            throw new Error('No testID provided in query string');
        }

        const evalsPath = `results/${testID}/evals.json`;
        const response = await fetch(evalsPath);
        if (!response.ok) throw new Error(`Failed to load data from ${evalsPath}`);
        const data = await response.json();

        renderTestHeader(testID);
        renderSummary(data, testID);
        renderGrid(data, testID);
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
        viewLogBtn.onclick = async () => {
            const modal = document.getElementById('modal');
            const title = document.getElementById('modal-title');
            const body = document.getElementById('modal-body');

            title.textContent = 'Full Run Log (run.log)';
            body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading log...</div>';
            modal.classList.add('show');

            try {
                const res = await fetch('run.log');
                if (!res.ok) throw new Error('Failed to fetch log');
                const text = await res.text();
                body.innerHTML = `<div class="log-content">${escapeHtml(text)}</div>`;
            } catch (e) {
                body.innerHTML = `<div style="color: var(--accent-failure); padding: 20px;">Error loading log: ${e.message}</div>`;
            }
        };
    }
});

function renderTestHeader(testID) {
    const container = document.getElementById('test-header');
    if (container) {
        const timestamp = testID.replace('test_', '').replace(/-/g, ':').slice(0, -2);
        container.innerHTML = `Test ID: <strong>${testID}</strong> — Run at ${timestamp}`;
    }
}

function renderSummary(data, testID) {
    const container = document.getElementById('summary-stats');
    const summary = data.summary;
    const results = data.results;

    const unguidedStats = calculateGroupTotalStats(results, 'unguided');
    const guidedStats = calculateGroupTotalStats(results, 'guided');

    container.innerHTML = `
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(summary.unguidedMedian)}">
                ${summary.unguidedMedian}%
            </span>
            <span class="stat-label">Unguided Median Pass Rate</span>
            <div style="margin-top: 8px; font-size: 0.9em; color: var(--text-secondary);">
                ${unguidedStats.passed}/${unguidedStats.total} checks passed
            </div>
        </div>
        <div class="stat-card">
            <span class="stat-value" style="color: ${getColor(summary.guidedMedian)}">
                ${summary.guidedMedian}%
            </span>
            <span class="stat-label">Guided Median Pass Rate</span>
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
                    // Find a run that matches the median to show representative counts
                    const medianRun = runData.find(run => {
                        const s = getRunStats(run.results);
                        return s.rate === testStats.median;
                    }) || runData[0];

                    const s = getRunStats(medianRun.results);

                    card.onclick = () => showDetails(testName, runData, testStats, testID);
                    card.innerHTML = `
                        <h3>${formatTestName(testName)}</h3>
                        <div class="pass-rate-bar">
                            <div class="pass-rate-fill" style="width: ${testStats.median}%; background-color: ${getColor(testStats.median)}"></div>
                        </div>
                        <div style="display: flex; justify-content: space-between; font-size: 0.9em; color: var(--text-secondary);">
                            <span>Median: ${testStats.median}% <span style="opacity: 0.8">(${s.passed}/${s.total})</span></span>
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
                    <h4 style="margin-top: 0; margin-bottom: 10px;">Prompt (${prompt})</h4>
                    <pre style="white-space: pre-wrap; font-family: inherit; margin: 0; color: var(--text-primary);">${escapeHtml(text)}</pre>
                </div>
            `;
        }
    } catch (e) {
        console.error('Failed to fetch prompt', e);
    }

    const runsHtml = runs.map(run => {
        const s = getRunStats(run.results);
        const linkPath = `results/${testID}/${run.runNumber}/${scenario}/${prompt}/${agent}/index.html`;

        return `
            <div class="run-detail">
                <div class="run-header">
                    <strong>Run ${run.runNumber}</strong>
                    <span style="color: ${getColor(s.rate)}">${s.rate}% Pass (${s.passed}/${s.total})</span>
                    <a href="${linkPath}" target="_blank">View Source ↗</a>
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
    }).join('');

    body.innerHTML = promptHtml + runsHtml;
    modal.classList.add('show');
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
