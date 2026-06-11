import { getRunStats, initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, $ } from './utils.js';

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
            await loadRemoteTests();
            setupNavigationControls(guideName);
            renderGraphs(guideName);
        });

        await loadLocalTests();
        if (getAccessToken()) {
            await loadRemoteTests();
        }
        setupNavigationControls(guideName);
        renderGraphs(guideName);

    } catch (error) {
        console.error('Error:', error);
        $('#empty-state').style.display = 'block';
    }
});

function registerTestData(testId, source, parsed, forcedTimestamp) {
    let serving = 'unknown';
    if (parsed.serving !== undefined) {
        serving = parsed.serving;
    } else if (parsed.enableSkills !== undefined) {
        serving = parsed.enableSkills ? 'skills' : 'mcp';
    }

    const compoundKey = `${testId}|||${source}`;

    const guides = {};
    if (parsed.results) {
        Object.keys(parsed.results).forEach(key => {
            const parts = key.split(' - ');
            if (parts.length === 3) {
                const [, guide, runType] = parts;
                if (!guides[guide]) {
                    guides[guide] = {
                        guidedPassed: 0, guidedTotal: 0,
                        unguidedPassed: 0, unguidedTotal: 0
                    };
                }
                parsed.results[key].forEach(run => {
                    const s = getRunStats(run.results);
                    if (runType === 'guided') {
                        guides[guide].guidedPassed += s.passed;
                        guides[guide].guidedTotal += s.total;
                    } else if (runType === 'unguided') {
                        guides[guide].unguidedPassed += s.passed;
                        guides[guide].unguidedTotal += s.total;
                    }
                });
            }
        });
    }

    // Convert guide raw totals into rates
    const guidesWithRates = {};
    Object.keys(guides).forEach(guide => {
        const g = guides[guide];
        const guidedRate = g.guidedTotal > 0 ? Math.round((g.guidedPassed / g.guidedTotal) * 100) : 0;
        const unguidedRate = g.unguidedTotal > 0 ? Math.round((g.unguidedPassed / g.unguidedTotal) * 100) : 0;
        guidesWithRates[guide] = {
            guidedPassed: g.guidedPassed,
            guidedTotal: g.guidedTotal,
            guidedRate,
            unguidedPassed: g.unguidedPassed,
            unguidedTotal: g.unguidedTotal,
            unguidedRate,
            uplift: guidedRate - unguidedRate
        };
    });

    allTestData[compoundKey] = {
        testId: testId,
        timestamp: parsed.timestamp || forcedTimestamp || new Date().toISOString(),
        data: parsed,
        source: source,
        agent: parsed.agent || 'unknown',
        serving: serving,
        model: parsed.model || 'unknown',
        guides: guidesWithRates
    };
}

async function loadLocalTests() {
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
                    registerTestData(testId, useResultsPrefix ? 'static' : 'local', parsed, suiteTimestamp);
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
                    registerTestData(testId, 'remote', parsed, null);
                }
            } catch (e) {
                console.warn(`Failed to load remote test ${testId}:`, e);
            }
        }));
    } catch (error) {
        console.error('Error loading remote suites:', error);
    }
}

function setupNavigationControls(currentGuide) {
    const guideSet = new Set();
    Object.values(allTestData).forEach(run => {
        if (run.guides) {
            Object.keys(run.guides).forEach(g => guideSet.add(g));
        }
    });
    const allGuides = [...guideSet].sort();

    const prevBtn = /** @type {HTMLButtonElement} */ ($('#prev-guide-btn'));
    const nextBtn = /** @type {HTMLButtonElement} */ ($('#next-guide-btn'));
    const searchInput = /** @type {HTMLInputElement} */ ($('#guide-search'));
    const list = $('#autocomplete-list');
    const goBtn = /** @type {HTMLButtonElement} */ ($('#go-guide-btn'));

    if (allGuides.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    } else {
        const currentIndex = allGuides.indexOf(currentGuide);
        
        prevBtn.disabled = false;
        prevBtn.onclick = () => {
            const prevIndex = (currentIndex - 1 + allGuides.length) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[prevIndex])}`;
        };

        nextBtn.disabled = false;
        nextBtn.onclick = () => {
            const nextIndex = (currentIndex + 1) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[nextIndex])}`;
        };
    }

    goBtn.onclick = () => {
        const val = searchInput.value.trim();
        if (val) {
            window.location.href = `guide.html?guide=${encodeURIComponent(val)}`;
        }
    };

    let currentFocus = -1;

    searchInput.oninput = () => {
        const val = searchInput.value.trim().toLowerCase();
        list.innerHTML = '';
        currentFocus = -1;

        if (!val) {
            list.classList.add('hidden');
            return;
        }

        const matches = allGuides.filter(g => g.toLowerCase().includes(val)).slice(0, 10);
        if (matches.length === 0) {
            list.classList.add('hidden');
            return;
        }

        list.classList.remove('hidden');
        matches.forEach(match => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.textContent = match;
            div.onclick = () => {
                searchInput.value = match;
                list.classList.add('hidden');
                goBtn.click();
            };
            list.appendChild(div);
        });
    };

    searchInput.onkeydown = (e) => {
        const items = list.querySelectorAll('.autocomplete-item');
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            currentFocus++;
            setActive(items);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            setActive(items);
            e.preventDefault();
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1) {
                if (items[currentFocus]) {
                    /** @type {HTMLElement} */ (items[currentFocus]).click();
                }
            } else {
                goBtn.click();
            }
        } else if (e.key === 'Escape') {
            list.classList.add('hidden');
        }
    };

    function setActive(items) {
        if (!items) return;
        items.forEach(item => item.classList.remove('active'));
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('active');
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }

    document.addEventListener('click', (e) => {
        const target = /** @type {Node} */ (e.target);
        if (!searchInput.contains(target) && !list.contains(target)) {
            list.classList.add('hidden');
        }
    });
}

function renderGraphs(guideName) {
    const grid = $('#graphs-grid');
    grid.innerHTML = '';

    const testKeys = Object.keys(allTestData);
    const filteredKeys = testKeys.filter(key => allTestData[key].guides && allTestData[key].guides[guideName]);

    if (filteredKeys.length === 0) {
        $('#empty-state').style.display = 'block';
        return;
    }
    $('#empty-state').style.display = 'none';

    const combinations = {};
    filteredKeys.forEach(compoundKey => {
        const run = allTestData[compoundKey];
        const combKey = `${run.agent}|||${run.model}`;
        if (!combinations[combKey]) {
            combinations[combKey] = [];
        }
        combinations[combKey].push(run);
    });

    Object.keys(combinations).forEach(combKey => {
        combinations[combKey].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });

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
        
        [0, 50, 100].forEach(percent => {
            const y = rateToY(percent);
            svgContent += `
                <line x1="${paddingX}" y1="${y}" x2="${width - paddingX}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" stroke-width="1" />
                <text x="${paddingX - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">${percent}%</text>
            `;
        });

        runs.forEach((run, i) => {
            const x = runs.length > 1 ? paddingX + i * stepX : width / 2;
            const stats = run.guides[guideName];
            const yU = rateToY(stats.unguidedRate);
            const yG = rateToY(stats.guidedRate);
            const shortDate = new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            svgContent += `
                <g class="timeline-point" data-index="${i}" data-comb="${combKey}" style="cursor: pointer;">
                    <line x1="${x}" y1="${yU}" x2="${x}" y2="${yG}" stroke="var(--color-primary)" stroke-width="2" />
                    <circle cx="${x}" cy="${yU}" r="4" stroke="#8b949e" stroke-width="1.5" fill="var(--color-surface-container-lowest)" />
                    <circle cx="${x}" cy="${yG}" r="5" fill="var(--color-primary)" />
                    <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.7rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle">${shortDate}</text>
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

        svg.querySelectorAll('.timeline-point').forEach(group => {
            group.addEventListener('mouseenter', () => {
                const idx = parseInt(group.getAttribute('data-index'));
                const runData = combinations[group.getAttribute('data-comb')][idx];
                const stats = runData.guides[guideName];
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
