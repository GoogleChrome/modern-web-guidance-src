import { getRunStats, initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, parseResultKey, $ } from './utils.js';

let allTestData = {}; // Cache all test data by testId
let isCompareMode = false;
let selectedPoints = []; // array of { testId, source, combKey }
let currentRunFilter = 'nightly';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const guideName = params.get('guide');
    if (!guideName) {
        window.location.href = './';
        return;
    }

    const runFilterParam = params.get('runFilter') ?? params.get('runName');
    if (runFilterParam !== null) {
        currentRunFilter = runFilterParam;
    }

    $('#guide-name-header').textContent = guideName;
    setupTimelineFilterControls(guideName);
    setupCompareMode(guideName);

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
    if (source === 'remote' && (allTestData[`${testId}|||local`] || allTestData[`${testId}|||static`])) {
        return;
    }
    if ((source === 'local' || source === 'static') && allTestData[`${testId}|||remote`]) {
        delete allTestData[`${testId}|||remote`];
    }

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
            const parsedKey = parseResultKey(key);
            if (parsedKey) {
                const { guide, runType } = parsedKey;
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

function updateUrlParams(guideName) {
    const url = new URL(window.location.href);
    url.searchParams.set('guide', guideName);
    if (currentRunFilter === 'nightly') {
        url.searchParams.delete('runFilter');
    } else {
        url.searchParams.set('runFilter', currentRunFilter);
    }
    window.history.replaceState({}, '', url);
}

function setupTimelineFilterControls(guideName) {
    const limitInput = /** @type {HTMLInputElement | null} */ ($('#timeline-limit-input'));
    const showAllCheck = /** @type {HTMLInputElement | null} */ ($('#timeline-show-all-check'));
    const runFilterInput = /** @type {HTMLInputElement | null} */ ($('#guide-run-filter-input'));

    if (runFilterInput) {
        runFilterInput.value = currentRunFilter;
        runFilterInput.addEventListener('input', () => {
            currentRunFilter = runFilterInput.value;
            updateUrlParams(guideName);
            setupNavigationControls(guideName);
            renderGraphs(guideName);
        });
    }

    if (limitInput) {
        limitInput.addEventListener('change', () => {
            let val = parseInt(limitInput.value);
            if (isNaN(val) || val < 1) {
                limitInput.value = '30';
            }
            renderGraphs(guideName);
        });
    }

    if (showAllCheck) {
        showAllCheck.addEventListener('change', () => {
            if (limitInput) {
                limitInput.disabled = showAllCheck.checked;
            }
            renderGraphs(guideName);
        });
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

    const backLink = document.querySelector('a[href^="./"]');
    if (backLink) {
        backLink.setAttribute('href', `./${currentRunFilter ? `?runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`);
    }

    if (allGuides.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    } else {
        const currentIndex = allGuides.indexOf(currentGuide);
        
        prevBtn.disabled = false;
        prevBtn.onclick = () => {
            const prevIndex = (currentIndex - 1 + allGuides.length) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[prevIndex])}${currentRunFilter ? `&runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`;
        };

        nextBtn.disabled = false;
        nextBtn.onclick = () => {
            const nextIndex = (currentIndex + 1) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[nextIndex])}${currentRunFilter ? `&runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`;
        };
    }

    goBtn.onclick = () => {
        const val = searchInput.value.trim();
        if (val) {
            window.location.href = `guide.html?guide=${encodeURIComponent(val)}${currentRunFilter ? `&runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`;
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
                window.location.href = `guide.html?guide=${encodeURIComponent(match)}${currentRunFilter ? `&runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`;
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

    const params = new URLSearchParams(window.location.search);
    const highlightTestId = params.get('testId');

    const testKeys = Object.keys(allTestData);
    
    // Filter out suites that don't have this guide, or have 0 trials for it, or don't match run filter
    const filteredKeys = testKeys.filter(key => {
        const run = allTestData[key];
        if (!run.guides || !run.guides[guideName]) return false;
        const g = run.guides[guideName];
        if (g.guidedTotal === 0 && g.unguidedTotal === 0) return false;

        if (currentRunFilter && currentRunFilter.trim()) {
            const query = currentRunFilter.trim().toLowerCase();
            const testId = (run.testId || '').toLowerCase();
            if (!testId.includes(query)) return false;
        }
        return true;
    });

    if (filteredKeys.length === 0) {
        $('#empty-state').style.display = 'block';
        return;
    }
    $('#empty-state').style.display = 'none';

    const deduplicatedRunsMap = new Map();
    filteredKeys.forEach(compoundKey => {
        const run = allTestData[compoundKey];
        if (!deduplicatedRunsMap.has(run.testId) || run.source === 'local' || run.source === 'static') {
            deduplicatedRunsMap.set(run.testId, run);
        }
    });

    const combinations = {};
    deduplicatedRunsMap.forEach(run => {
        const combKey = `${run.agent}|||${run.model}`;
        if (!combinations[combKey]) {
            combinations[combKey] = [];
        }
        combinations[combKey].push(run);
    });

    const getDateKey = (timestamp) => {
        const d = new Date(timestamp);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Group runs by date for each agent/model combination
    Object.keys(combinations).forEach(combKey => {
        const runs = combinations[combKey];
        runs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const runsByDateMap = new Map();
        runs.forEach(run => {
            const dateKey = getDateKey(run.timestamp);
            if (!runsByDateMap.has(dateKey)) {
                runsByDateMap.set(dateKey, []);
            }
            runsByDateMap.get(dateKey).push(run);
        });

        const dateEntries = [];
        runsByDateMap.forEach((runsOnDate, dateKey) => {
            runsOnDate.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            const latestRun = runsOnDate[runsOnDate.length - 1];
            dateEntries.push({ dateKey, latestRun, runsOnDate });
        });

        dateEntries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        let uniqueEntries = dateEntries;
        if (uniqueEntries.length > 50) {
            uniqueEntries = uniqueEntries.slice(-50);
        }
        combinations[combKey] = uniqueEntries;
    });

    // Build the global timeline of unique dates from the sliced entries across all combinations
    const globalDatesMap = new Map();
    Object.values(combinations).forEach(entries => {
        entries.forEach(entry => {
            if (!globalDatesMap.has(entry.dateKey)) {
                globalDatesMap.set(entry.dateKey, {
                    dateKey: entry.dateKey,
                    shortDate: new Date(entry.latestRun.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                });
            }
        });
    });

    let globalTimeline = Array.from(globalDatesMap.values())
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    const limitInput = /** @type {HTMLInputElement} */ ($('#timeline-limit-input'));
    const showAllCheck = /** @type {HTMLInputElement} */ ($('#timeline-show-all-check'));
    const showAll = showAllCheck ? showAllCheck.checked : false;
    const limit = limitInput ? (parseInt(limitInput.value) || 30) : 30;

    if (!showAll && globalTimeline.length > limit) {
        globalTimeline = globalTimeline.slice(-limit);
    }

    const globalWidth = Math.max(450, globalTimeline.length * 30);

    const sortedCombKeys = Object.keys(combinations).sort((keyA, keyB) => {
        const entriesA = combinations[keyA];
        const entriesB = combinations[keyB];
        const newestA = new Date(entriesA[entriesA.length - 1].latestRun.timestamp).getTime();
        const newestB = new Date(entriesB[entriesB.length - 1].latestRun.timestamp).getTime();
        return newestB - newestA;
    });

    // Filter out combinations that have no data points in the filtered timeline
    const activeCombKeys = sortedCombKeys.filter(combKey => {
        const entries = combinations[combKey];
        return entries.some(entry => {
            return globalTimeline.some(t => t.dateKey === entry.dateKey);
        });
    });

    if (activeCombKeys.length === 0) {
        $('#empty-state').style.display = 'block';
        return;
    }
    $('#empty-state').style.display = 'none';

    activeCombKeys.forEach(combKey => {
        const [agent, model] = combKey.split('|||');
        const entries = combinations[combKey];

        const card = document.createElement('div');
        card.className = 'stat-card';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '15px';
        card.style.padding = '20px';
        
        const totalRunsCount = entries.reduce((sum, e) => sum + e.runsOnDate.length, 0);
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.flexWrap = 'wrap';
        header.style.gap = '10px';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <div style="font-weight: 600; font-size: 1rem; color: var(--text-primary);">
                ${escapeHtml(agent)} <span style="font-weight: normal; color: var(--text-secondary);">on</span> ${escapeHtml(model)}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">
                ${totalRunsCount} chronological trials (${entries.length} active dates)
            </div>
        `;
        header.appendChild(titleDiv);

        const runSelectorSlot = document.createElement('div');
        runSelectorSlot.className = 'run-selector-slot';
        runSelectorSlot.style.minHeight = '32px';
        runSelectorSlot.style.display = 'flex';
        runSelectorSlot.style.alignItems = 'center';
        header.appendChild(runSelectorSlot);

        card.appendChild(header);

        const chartWrapper = document.createElement('div');
        chartWrapper.style.overflowX = 'auto';
        chartWrapper.style.width = '100%';
        chartWrapper.style.position = 'relative';

        const height = 230;
        const paddingX = 40;
        const paddingY = 25;
        const plotHeight = height - 2 * paddingY - 35;
        const plotWidth = globalWidth - 2 * paddingX;
        const stepX = globalTimeline.length > 1 ? plotWidth / (globalTimeline.length - 1) : 0;

        const rateToY = (rate) => paddingY + plotHeight - (rate / 100 * plotHeight);

        let svgContent = '';
        
        [0, 50, 100].forEach(percent => {
            const y = rateToY(percent);
            svgContent += `
                <line x1="${paddingX}" y1="${y}" x2="${globalWidth - paddingX}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" stroke-width="1" />
                <text x="${paddingX - 10}" y="${y + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">${percent}%</text>
            `;
        });

        globalTimeline.forEach((suite, i) => {
            const x = globalTimeline.length > 1 ? paddingX + i * stepX : globalWidth / 2;
            
            const entry = entries.find(e => e.dateKey === suite.dateKey);
            const run = entry ? entry.latestRun : null;
            const runsOnDate = entry ? entry.runsOnDate : [];
            
            const isHighlighted = run && runsOnDate.some(r => r.testId === highlightTestId);
            if (isHighlighted) {
                svgContent += `
                    <rect x="${x - 12}" y="${paddingY - 5}" width="24" height="${plotHeight + 10}" fill="var(--color-primary)" style="opacity: 0.12; rx: 4px;" />
                `;
            }

            if (run) {
                const stats = run.guides[guideName];
                const yU = rateToY(stats.unguidedRate);
                const yG = rateToY(stats.guidedRate);
                const isPositive = stats.guidedRate >= stats.unguidedRate;
                
                let elementHtml = '';
                if (yU === yG) {
                    elementHtml = `<circle cx="${x}" cy="${yG}" r="5" fill="var(--color-primary)" />`;
                } else {
                    const dist = Math.abs(yU - yG);
                    const arrowHeight = 10;
                    const lineColor = isPositive ? 'var(--color-primary)' : 'var(--color-accent-failure)';
                    let lineY2 = yG;
                    let lineHtml = '';
                    if (dist > arrowHeight) {
                        lineY2 = yG < yU ? yG + arrowHeight : yG - arrowHeight;
                        lineHtml = `<line x1="${x}" y1="${yU}" x2="${x}" y2="${lineY2}" stroke="${lineColor}" stroke-width="4" />`;
                    }

                    const arrowPoints = yG < yU
                        ? `${x},${yG} ${x - 6},${yG + 10} ${x + 6},${yG + 10}`
                        : `${x},${yG} ${x - 6},${yG - 10} ${x + 6},${yG - 10}`;

                    elementHtml = `
                        ${lineHtml}
                        <circle cx="${x}" cy="${yU}" r="4" stroke="#8b949e" stroke-width="1.5" fill="var(--color-surface-container-lowest)" />
                        <polygon points="${arrowPoints}" fill="${lineColor}" />
                    `;
                }

                // Visual badge indicator for multiple runs on the same day (+50% size increase, centered above arrow)
                let multiRunIndicator = '';
                if (runsOnDate.length > 1) {
                    const topY = Math.min(yG, yU);
                    multiRunIndicator = `
                        <g transform="translate(${x - 13}, ${topY - 22})">
                            <rect width="26" height="18" rx="4" fill="#2563eb" />
                            <text x="13" y="13" font-size="0.85rem" font-weight="bold" fill="#ffffff" text-anchor="middle">${runsOnDate.length}x</text>
                        </g>
                    `;
                }

                svgContent += `
                    <g class="timeline-point" data-testid="${run.testId}" data-comb="${combKey}" data-datekey="${suite.dateKey}" data-x="${x}" data-yg="${yG}" style="cursor: pointer;">
                        ${elementHtml}
                        ${multiRunIndicator}
                        <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.7rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle">${suite.shortDate}</text>
                        <rect x="${x - 15}" y="${paddingY}" width="30" height="${plotHeight}" fill="transparent" />
                    </g>
                `;
            } else {
                // Draw faded date label for missing runs to preserve axis alignment
                svgContent += `
                    <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.7rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle" style="opacity: 0.3;">${suite.shortDate}</text>
                `;
            }
        });

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', globalWidth.toString());
        svg.setAttribute('height', height.toString());
        svg.style.display = 'block';
        svg.innerHTML = svgContent;

        chartWrapper.appendChild(svg);
        card.appendChild(chartWrapper);
        grid.appendChild(card);

        // Auto-scroll to highlighted point if it exists in this chart
        if (highlightTestId) {
            const highlightedEl = svg.querySelector(`[data-testid="${highlightTestId}"]`);
            if (highlightedEl) {
                setTimeout(() => {
                    const wrapperRect = chartWrapper.getBoundingClientRect();
                    const elRect = highlightedEl.getBoundingClientRect();
                    const targetScroll = chartWrapper.scrollLeft + (elRect.left - wrapperRect.left) - (wrapperRect.width / 2) + (elRect.width / 2);
                    chartWrapper.scrollTo({ left: targetScroll, behavior: 'smooth' });
                }, 200);
            }
        }

        svg.querySelectorAll('.timeline-point').forEach(group => {
            group.addEventListener('mouseenter', () => {
                const combKey = group.getAttribute('data-comb');
                const dateKey = group.getAttribute('data-datekey');
                const entry = combinations[combKey]?.find(e => e.dateKey === dateKey);
                if (!entry) return;

                const runData = entry.latestRun;
                const runsOnDate = entry.runsOnDate;
                const stats = runData.guides[guideName];
                const formattedDate = new Date(runData.timestamp).toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                const tooltip = $('#tooltip-container');
                const header = $('#tooltip-header');
                const content = $('#tooltip-content');

                let multiRunHtml = '';
                if (runsOnDate.length > 1) {
                    multiRunHtml = `
                        <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                            <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-primary); margin-bottom: 6px;">
                                ${runsOnDate.length} runs on this date:
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 4px;">
                                ${runsOnDate.map((r, idx) => {
                                    const rStats = r.guides[guideName];
                                    const timeStr = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                    const isLatest = idx === runsOnDate.length - 1;
                                    return `
                                        <div style="font-size: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                                            <a href="dashboard.html?testId=${r.testId}&source=${r.source}#guide-${guideName}" style="color: var(--color-primary); font-weight: 600; text-decoration: none;">
                                                Run ${idx + 1} (${timeStr})${isLatest ? ' <span style="color:#64748b; font-weight:normal;">(Latest)</span>' : ''}
                                            </a>
                                            <span style="font-size:0.7rem; color: var(--text-secondary);">${rStats ? rStats.guidedRate : 0}% guided</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `;
                }

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
                    ${multiRunHtml}
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
                const combKey = group.getAttribute('data-comb');
                const dateKey = group.getAttribute('data-datekey');
                const entry = combinations[combKey]?.find(e => e.dateKey === dateKey);
                if (!entry) return;

                const runsOnDate = entry.runsOnDate;
                const defaultRun = entry.latestRun;
                const defaultRunIndex = runsOnDate.length; // 1-indexed

                if (isCompareMode) {
                    // Render run selection dropdown ABOVE arrows inside the card header
                    document.querySelectorAll('.run-selector-slot').forEach(slot => slot.innerHTML = '');

                    if (runsOnDate.length > 1) {
                        const selectorContainer = document.createElement('div');
                        selectorContainer.style.display = 'flex';
                        selectorContainer.style.alignItems = 'center';
                        selectorContainer.style.gap = '8px';
                        selectorContainer.style.background = 'var(--bg-secondary)';
                        selectorContainer.style.padding = '4px 10px';
                        selectorContainer.style.borderRadius = '6px';
                        selectorContainer.style.border = '1px solid var(--border-color)';
                        selectorContainer.style.fontSize = '0.85rem';

                        const title = document.createElement('span');
                        title.style.fontWeight = '600';
                        title.style.color = 'var(--text-primary)';
                        title.innerText = `Select run for ${dateKey}:`;
                        selectorContainer.appendChild(title);

                        const select = document.createElement('select');
                        select.style.padding = '3px 8px';
                        select.style.borderRadius = '4px';
                        select.style.border = '1px solid var(--border-color)';
                        select.style.background = '#ffffff';
                        select.style.color = '#334155';
                        select.style.fontSize = '0.8rem';
                        select.style.fontWeight = '500';
                        select.style.cursor = 'pointer';

                        runsOnDate.forEach((r, idx) => {
                            const timeStr = new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const rStats = r.guides[guideName];
                            const opt = document.createElement('option');
                            opt.value = r.testId;
                            opt.setAttribute('data-runindex', (idx + 1).toString());
                            const isLatest = idx === runsOnDate.length - 1;
                            opt.innerText = `Run ${idx + 1} (${isLatest ? 'Latest - ' : ''}${timeStr}) [${rStats ? rStats.guidedRate : 0}% guided]`;
                            if (r.testId === defaultRun.testId) {
                                opt.selected = true;
                            }
                            select.appendChild(opt);
                        });

                        select.addEventListener('change', () => {
                            const chosenTestId = select.value;
                            const selectedOpt = select.options[select.selectedIndex];
                            const chosenRunIndex = parseInt(selectedOpt.getAttribute('data-runindex') || '1');
                            const chosenRun = runsOnDate.find(r => r.testId === chosenTestId) || defaultRun;
                            handlePointSelection(chosenRun, group, combKey, guideName, chosenRunIndex);
                        });

                        selectorContainer.appendChild(select);
                        runSelectorSlot.appendChild(selectorContainer);

                        handlePointSelection(defaultRun, group, combKey, guideName, defaultRunIndex);
                    } else {
                        handlePointSelection(defaultRun, group, combKey, guideName, 1);
                    }
                } else {
                    window.location.href = `dashboard.html?testId=${defaultRun.testId}&source=${defaultRun.source}#guide-${guideName}`;
                }
            });
        });
    });
}

function setupCompareMode(guideName) {
    const compareBtn = $('#compare-mode-btn');
    const banner = $('#compare-banner');
    const launchBtn = $('#launch-compare-btn');
    const cancelBtn = $('#cancel-compare-btn');

    if (!compareBtn || !banner || !launchBtn || !cancelBtn) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isStatic = urlParams.get('source') === 'static' || window.location.hostname.includes('github.io') || window.location.hostname.includes('storage.googleapis.com');
    if (isStatic) {
        compareBtn.style.display = 'none';
        return;
    }

    compareBtn.addEventListener('click', () => {
        toggleCompareMode(!isCompareMode);
    });

    cancelBtn.addEventListener('click', () => {
        toggleCompareMode(false);
    });

    launchBtn.addEventListener('click', () => {
        if (selectedPoints.length === 2) {
            const [pA, pB] = selectedPoints;
            const urlParams = new URLSearchParams(window.location.search);
            const isStatic = urlParams.get('source') === 'static' || window.location.hostname.includes('github.io');
            
            window.location.href = `compare.html?trialA=${pA.testId}&trialB=${pB.testId}&runIndexA=${pA.runIndex || 1}&runIndexB=${pB.runIndex || 1}&agentA=${encodeURIComponent(pA.agent || '')}&modelA=${encodeURIComponent(pA.model || '')}&scoreA=${pA.score || 0}&agentB=${encodeURIComponent(pB.agent || '')}&modelB=${encodeURIComponent(pB.model || '')}&scoreB=${pB.score || 0}&guide=${guideName}&source=${isStatic ? 'static' : 'local'}`;
        }
    });
}

function toggleCompareMode(on) {
    isCompareMode = on;
    const compareBtn = $('#compare-mode-btn');
    const banner = $('#compare-banner');
    
    if (isCompareMode) {
        compareBtn.textContent = 'Exit Compare';
        compareBtn.style.backgroundColor = '#cbd5e1';
        banner.style.display = 'flex';
        clearSelections();
    } else {
        compareBtn.textContent = 'Compare Trials';
        compareBtn.style.backgroundColor = '#f1f5f9';
        banner.style.display = 'none';
        clearSelections();
    }
}

function clearSelections() {
    document.querySelectorAll('.compare-highlight').forEach(el => el.remove());
    document.querySelectorAll('.run-selector-slot').forEach(slot => slot.innerHTML = '');
    selectedPoints = [];
    updateCompareBanner();
}

function handlePointSelection(runData, group, combKey, guideName, runIndex = 1) {
    const testId = runData.testId;
    const dateKey = group.getAttribute('data-datekey');
    const existingIdx = selectedPoints.findIndex(p => p.dateKey === dateKey && p.combKey === combKey);

    if (existingIdx !== -1) {
        const prev = selectedPoints[existingIdx];
        if (prev.testId === testId) {
            selectedPoints.splice(existingIdx, 1);
            group.querySelector('.compare-highlight')?.remove();
        } else {
            selectedPoints[existingIdx] = { 
                testId, 
                dateKey,
                combKey,
                runIndex,
                source: runData.source, 
                agent: runData.agent, 
                model: runData.model,
                score: runData.guides[guideName] ? runData.guides[guideName].guidedRate : 0
            };
        }
    } else {
        if (selectedPoints.length >= 2) {
            const removed = selectedPoints.shift();
            const oldGroup = document.querySelector(`[data-datekey="${removed.dateKey}"][data-comb="${removed.combKey}"]`);
            if (oldGroup) oldGroup.querySelector('.compare-highlight')?.remove();
        }

        const stats = runData.guides[guideName];
        selectedPoints.push({ 
            testId, 
            dateKey,
            combKey,
            runIndex,
            source: runData.source, 
            agent: runData.agent, 
            model: runData.model,
            score: stats ? stats.guidedRate : 0
        });

        const x = parseFloat(group.getAttribute('data-x'));
        const y = parseFloat(group.getAttribute('data-yg'));
        
        if (!group.querySelector('.compare-highlight')) {
            const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            highlight.setAttribute('class', 'compare-highlight');
            highlight.setAttribute('cx', x.toString());
            highlight.setAttribute('cy', y.toString());
            highlight.setAttribute('r', '12');
            highlight.setAttribute('stroke', '#2563eb');
            highlight.setAttribute('stroke-width', '3');
            highlight.setAttribute('fill', 'none');
            highlight.setAttribute('style', 'stroke-dasharray: 2; transform-origin: center;');
            
            group.appendChild(highlight);
        }
    }

    updateCompareBanner();
}

function updateCompareBanner() {
    const text = $('#compare-banner-text');
    const launchBtn = /** @type {HTMLButtonElement | null} */ ($('#launch-compare-btn'));
    if (!text || !launchBtn) return;

    if (selectedPoints.length === 0) {
        text.innerText = 'Select two trials on the chart to compare.';
        launchBtn.disabled = true;
    } else if (selectedPoints.length === 1) {
        const label0 = selectedPoints[0].runIndex ? ` (Run ${selectedPoints[0].runIndex})` : '';
        text.innerHTML = `Selected 1 trial: <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[0].testId.slice(0, 15)}${label0}...</span>. Select one more.`;
        launchBtn.disabled = true;
    } else if (selectedPoints.length === 2) {
        const label0 = selectedPoints[0].runIndex ? ` (Run ${selectedPoints[0].runIndex})` : '';
        const label1 = selectedPoints[1].runIndex ? ` (Run ${selectedPoints[1].runIndex})` : '';
        text.innerHTML = `Ready to compare: <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[0].testId.slice(0, 10)}${label0}...</span> vs <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[1].testId.slice(0, 10)}${label1}...</span>`;
        launchBtn.disabled = false;
    }
}


