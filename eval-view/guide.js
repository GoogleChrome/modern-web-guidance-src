import { getRunStats, initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, timeAgo, $ } from './utils.js';

let allTestData = {}; // Cache all test data by testId

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const guideName = params.get('guide');
    if (!guideName) {
        window.location.href = './';
        return;
    }

    $('#guide-name-header').textContent = guideName;

    try {
        initGoogleAuth(async () => {
            await loadRemoteTests(guideName);
            renderGraphs(guideName);
        });

        await loadLocalTests(guideName);
        if (getAccessToken()) {
            await loadRemoteTests(guideName);
        }
        renderGraphs(guideName);

    } catch (error) {
        console.error('Error:', error);
        $('#empty-state').style.display = 'block';
    }
});

function registerTestData(testId, source, parsed, forcedTimestamp, guideName) {
    let serving = 'unknown';
    if (parsed.serving !== undefined) {
        serving = parsed.serving;
    } else if (parsed.enableSkills !== undefined) {
        serving = parsed.enableSkills ? 'skills' : 'mcp';
    }

    const compoundKey = `${testId}|||${source}`;

    // Calculate guide-specific statistics for this run
    let guideStats = null;
    if (parsed.results) {
        let guidedPassed = 0;
        let guidedTotal = 0;
        let unguidedPassed = 0;
        let unguidedTotal = 0;
        let found = false;

        Object.keys(parsed.results).forEach(key => {
            const parts = key.split(' - ');
            if (parts.length === 3 && parts[1] === guideName) {
                found = true;
                const runType = parts[2];
                parsed.results[key].forEach(run => {
                    const s = getRunStats(run.results);
                    if (runType === 'guided') {
                        guidedPassed += s.passed;
                        guidedTotal += s.total;
                    } else if (runType === 'unguided') {
                        unguidedPassed += s.passed;
                        unguidedTotal += s.total;
                    }
                });
            }
        });

        if (found) {
            const guidedRate = guidedTotal > 0 ? Math.round((guidedPassed / guidedTotal) * 100) : 0;
            const unguidedRate = unguidedTotal > 0 ? Math.round((unguidedPassed / unguidedTotal) * 100) : 0;
            guideStats = {
                guidedPassed,
                guidedTotal,
                guidedRate,
                unguidedPassed,
                unguidedTotal,
                unguidedRate,
                uplift: guidedRate - unguidedRate
            };
        }
    }

    // Only store if the guide was actually tested/found in this suite run
    if (guideStats) {
        allTestData[compoundKey] = {
            testId: testId,
            timestamp: parsed.timestamp || forcedTimestamp || new Date().toISOString(),
            data: parsed,
            source: source,
            agent: parsed.agent || 'unknown',
            serving: serving,
            model: parsed.model || 'unknown',
            guideStats: guideStats
        };
    }
}

async function loadLocalTests(guideName) {
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return; 
    }
    
    try {
        let response = await fetch(`/api/suites?t=${Date.now()}`);
        let manifest;
        let useResultsPrefix = false;

        if (!response.ok) {
            const staticRes = await fetch(`/suites.gen.json?t=${Date.now()}`);
            if (!staticRes.ok) return;
            const suites = await staticRes.json();
            manifest = { suites: suites.map(id => ({ id, source: 'local', timestamp: new Date().toISOString() })) };
            useResultsPrefix = true;
        } else {
            manifest = await response.json();
        }

        for (const suite of manifest.suites) {
            if (suite.source !== 'local') continue;
            
            const testId = suite.id;
            const suiteTimestamp = suite.timestamp;
            try {
                const fetchPath = useResultsPrefix ? `results/${testId}/evals.json` : `${testId}/evals.json`;
                const response = await fetch(`${fetchPath}?source=local&t=${Date.now()}`);
                if (response.ok) {
                    const parsed = await response.json();
                    registerTestData(testId, useResultsPrefix ? 'static' : 'local', parsed, suiteTimestamp, guideName);
                }
            } catch (e) {
                console.warn(`Failed to load local test ${testId}:`, e);
            }
        }
    } catch {
        console.warn('Local proxy not available');
    }
}

async function loadRemoteTests(guideName) {
    try {
        const prefixes = [];
        let pageToken = '';
        
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

        await Promise.all(prefixes.map(async (prefix) => {
            const testId = prefix.slice(0, -1);
            try {
                const fileUrl = `https://storage.googleapis.com/storage/v1/b/guidance-evals/o/${encodeURIComponent(prefix + 'evals.json')}?alt=media`;
                const response = await authenticatedFetch(fileUrl);
                if (response.ok) {
                    const parsed = await response.json();
                    registerTestData(testId, 'remote', parsed, null, guideName);
                }
            } catch (e) {
                console.warn(`Failed to load remote test ${testId}:`, e);
            }
        }));
    } catch (error) {
        console.error('Error loading remote suites:', error);
    }
}

function renderGraphs(guideName) {
    const grid = $('#graphs-grid');
    grid.innerHTML = '';

    const testKeys = Object.keys(allTestData);
    if (testKeys.length === 0) {
        $('#empty-state').style.display = 'block';
        return;
    }
    $('#empty-state').style.display = 'none';

    // Group runs by agent + model combination
    const combinations = {};
    testKeys.forEach(compoundKey => {
        const run = allTestData[compoundKey];
        const combKey = `${run.agent}|||${run.model}`;
        if (!combinations[combKey]) {
            combinations[combKey] = [];
        }
        combinations[combKey].push(run);
    });

    // Sort runs inside each combination chronologically first
    Object.keys(combinations).forEach(combKey => {
        combinations[combKey].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

    // Sort combination keys by freshness (newest run first)
    const sortedCombKeys = Object.keys(combinations).sort((keyA, keyB) => {
        const runsA = combinations[keyA];
        const runsB = combinations[keyB];
        const newestA = new Date(runsA[runsA.length - 1].timestamp).getTime();
        const newestB = new Date(runsB[runsB.length - 1].timestamp).getTime();
        return newestB - newestA;
    });

    sortedCombKeys.forEach(combKey => {
        const [agent, model] = combKey.split('|||');
        const runs = combinations[combKey];

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '15px';
        card.style.padding = '20px';
        
        // Header info
        const header = document.createElement('div');
        header.innerHTML = `
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">
                ${escapeHtml(agent)} <span style="font-weight: normal; color: var(--text-secondary);">on</span> ${escapeHtml(model)}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                ${runs.length} chronological trials
            </div>
        `;
        card.appendChild(header);

        // SVG vertical dumbbell timeline chart
        const chartWrapper = document.createElement('div');
        chartWrapper.style.overflowX = 'auto';
        chartWrapper.style.width = '100%';

        const width = Math.max(450, runs.length * 30);
        const height = 230;
        const paddingX = 40;
        const paddingY = 25;
        const plotHeight = height - 2 * paddingY - 35;
        const plotWidth = width - 2 * paddingX;
        const stepX = runs.length > 1 ? plotWidth / (runs.length - 1) : 0;

        const rateToY = (rate) => paddingY + plotHeight - (rate / 100 * plotHeight);

        let svgContent = '';
        
        // Grid reference lines (0%, 50%, 100%)
        [0, 50, 100].forEach(percent => {
            const y = rateToY(percent);
            svgContent += `
                <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" stroke-width="1" />
                <text x="${paddingX - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">${percent}%</text>
            `;
        });

        // Plot timeline points
        runs.forEach((run, i) => {
            const x = runs.length > 1 ? paddingX + i * stepX : width / 2;
            const yU = rateToY(run.guideStats.unguidedRate);
            const yG = rateToY(run.guideStats.guidedRate);
            const shortDate = new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            svgContent += `
                <g class="timeline-point" data-index="${i}" data-comb="${combKey}" style="cursor: pointer;">
                    <!-- Vertical Connector -->
                    <line x1="${x}" y1="${yU}" x2="${x}" y2="${yG}" stroke="var(--color-primary)" stroke-width="2" />
                    <!-- Unguided Dot -->
                    <circle cx="${x}" cy="${yU}" r="4" stroke="#8b949e" stroke-width="1.5" fill="var(--color-surface-container-lowest)" />
                    <!-- Guided Dot -->
                    <circle cx="${x}" cy="${yG}" r="5" fill="var(--color-primary)" />
                    <!-- X-Axis text tick rotated 90 degrees -->
                    <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.7rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle">${shortDate}</text>
                    
                    <!-- Hover area -->
                    <rect x="${x - 15}" y="${paddingY}" width="30" height="${plotHeight}" fill="transparent" />
                </g>
            `;
        });

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width.toString());
        svg.setAttribute('height', height.toString());
        svg.style.display = 'block';
        svg.innerHTML = svgContent;

        chartWrapper.appendChild(svg);
        card.appendChild(chartWrapper);
        grid.appendChild(card);

        // Tooltip interactions
        svg.querySelectorAll('.timeline-point').forEach(group => {
            group.addEventListener('mouseenter', (e) => {
                const idx = parseInt(group.getAttribute('data-index'));
                const runData = combinations[group.getAttribute('data-comb')][idx];
                const stats = runData.guideStats;
                const formattedDate = new Date(runData.timestamp).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                const tooltip = $('#tooltip-container');
                const header = $('#tooltip-header');
                const content = $('#tooltip-content');

                header.innerHTML = `
                    <div style="font-weight: bold; font-size: 0.9rem; color: var(--text-primary); word-break: break-all;">
                        ${escapeHtml(runData.testId)}
                    </div>
                `;

                content.innerHTML = `
                    <div style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.75rem;">${formattedDate}</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Guided Pass Rate:</span>
                            <span style="font-weight: 600; color: var(--color-primary);">${stats.guidedRate}% (${stats.guidedPassed}/${stats.guidedTotal})</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Unguided Pass Rate:</span>
                            <span style="font-weight: 600; color: var(--text-secondary);">${stats.unguidedRate}% (${stats.unguidedPassed}/${stats.unguidedTotal})</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; border-top: 1px solid var(--border-color); padding-top: 4px; margin-top: 4px;">
                            <span style="font-weight: bold;">Uplift:</span>
                            <span style="font-weight: bold; color: ${stats.uplift >= 0 ? 'var(--color-accent-success)' : 'var(--color-accent-failure)'};">
                                ${stats.uplift >= 0 ? '+' : ''}${stats.uplift}%
                            </span>
                        </div>
                    </div>
                `;

                tooltip.classList.remove('hidden');
            });

            group.addEventListener('mousemove', /** @param {MouseEvent} e */ (e) => {
                const tooltip = $('#tooltip-container');
                const offset = 15;
                let finalX = e.clientX + offset;
                let finalY = e.clientY + offset;

                const tooltipWidth = tooltip.clientWidth || 300;
                const tooltipHeight = tooltip.clientHeight || 150;

                if (finalX + tooltipWidth > window.innerWidth) {
                    finalX = e.clientX - tooltipWidth - offset;
                }
                if (finalY + tooltipHeight > window.innerHeight) {
                    finalY = e.clientY - tooltipHeight - offset;
                }

                tooltip.style.left = `${finalX}px`;
                tooltip.style.top = `${finalY}px`;
            });

            group.addEventListener('mouseleave', () => {
                $('#tooltip-container').classList.add('hidden');
            });

            group.addEventListener('click', () => {
                const idx = parseInt(group.getAttribute('data-index'));
                const runData = combinations[group.getAttribute('data-comb')][idx];
                window.location.href = `dashboard.html?testId=${runData.testId}&source=${runData.source}`;
            });
        });
    });
}
