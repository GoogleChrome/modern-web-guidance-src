import { initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, $ } from './utils.js';
import { extractSuiteSummary } from './summary-extractor.js';

let allTestData = {}; // Cache all test data by testId

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const guideName = params.get('guide');
    if (!guideName) {
        window.location.href = './';
        return;
    }

    $('#guide-name-header').textContent = guideName;
    setupTimelineFilterControls(guideName);

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

function registerSuiteSummary(summary, source) {
    const compoundKey = `${summary.testId}|||${source}`;

    allTestData[compoundKey] = {
        testId: summary.testId,
        timestamp: summary.timestamp,
        source: source,
        agent: summary.agent || 'unknown',
        serving: summary.serving || 'unknown',
        model: summary.model || 'unknown',
        guides: summary.guides || {}
    };
}

function registerTestData(testId, source, parsed, forcedTimestamp) {
    const summary = extractSuiteSummary(testId, parsed, forcedTimestamp);
    if (summary) {
        registerSuiteSummary(summary, source);
    }
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
            const suitesData = await staticRes.json();
            if (Array.isArray(suitesData)) {
                manifest = { suites: suitesData };
            } else {
                manifest = suitesData;
            }
            useResultsPrefix = true;
        } else {
            const data = await response.json();
            manifest = Array.isArray(data) ? { suites: data } : data;
        }

        for (const suite of manifest.suites) {
            if (typeof suite === 'object' && suite.testId && suite.guides) {
                registerSuiteSummary(suite, useResultsPrefix ? 'static' : 'local');
            } else {
                const testId = typeof suite === 'string' ? suite : suite.id || suite.testId;
                const suiteTimestamp = typeof suite === 'object' ? suite.timestamp : undefined;
                if (!testId) continue;
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
        }
    } catch {
        console.warn('Local proxy not available');
    }
}

async function loadRemoteTests() {
    try {
        const fileUrl = `https://storage.googleapis.com/storage/v1/b/guidance-evals/o/${encodeURIComponent('suites.gen.json')}?alt=media&t=${Date.now()}`;
        const response = await authenticatedFetch(fileUrl);
        if (!response.ok) throw new Error('Failed to fetch remote suites manifest');

        const manifest = await response.json();
        if (Array.isArray(manifest) && manifest.length > 0) {
            for (const item of manifest) {
                if (item && item.testId) {
                    registerSuiteSummary(item, 'remote');
                }
            }
        }
    } catch (error) {
        console.error('Error loading remote suites:', error);
    }
}

function setupTimelineFilterControls(guideName) {
    const limitInput = /** @type {HTMLInputElement} */ ($('#timeline-limit-input'));
    const showAllCheck = /** @type {HTMLInputElement} */ ($('#timeline-show-all-check'));

    if (!limitInput || !showAllCheck) return;

    limitInput.addEventListener('change', () => {
        let val = parseInt(limitInput.value);
        if (isNaN(val) || val < 1) {
            limitInput.value = '30';
        }
        renderGraphs(guideName);
    });

    showAllCheck.addEventListener('change', () => {
        limitInput.disabled = showAllCheck.checked;
        renderGraphs(guideName);
    });
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

    const params = new URLSearchParams(window.location.search);
    const highlightTestId = params.get('testId');

    const testKeys = Object.keys(allTestData);
    
    // Filter out suites that don't have this guide, or have 0 trials for it
    const filteredKeys = testKeys.filter(key => {
        const run = allTestData[key];
        if (!run.guides || !run.guides[guideName]) return false;
        const g = run.guides[guideName];
        const gTotal = g.guidedTotal !== undefined ? g.guidedTotal : (g.guided?.total || 0);
        const uTotal = g.unguidedTotal !== undefined ? g.unguidedTotal : (g.unguided?.total || 0);
        return gTotal > 0 || uTotal > 0;
    });

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

    const getDateKey = (timestamp) => {
        const d = new Date(timestamp);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Group by date (keep latest run per day) and slice to last 50 for each combination
    Object.keys(combinations).forEach(combKey => {
        const runs = combinations[combKey];
        runs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        const runsByDate = new Map();
        runs.forEach(run => {
            const dateKey = getDateKey(run.timestamp);
            runsByDate.set(dateKey, run);
        });
        
        let uniqueRuns = Array.from(runsByDate.values());
        if (uniqueRuns.length > 50) {
            uniqueRuns = uniqueRuns.slice(-50);
        }
        combinations[combKey] = uniqueRuns;
    });

    // Build the global timeline of unique dates from the sliced runs across all combinations
    const globalDatesMap = new Map();
    Object.values(combinations).forEach(runs => {
        runs.forEach(run => {
            const dateKey = getDateKey(run.timestamp);
            if (!globalDatesMap.has(dateKey)) {
                globalDatesMap.set(dateKey, {
                    dateKey: dateKey,
                    shortDate: new Date(run.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
        const runsA = combinations[keyA];
        const runsB = combinations[keyB];
        const newestA = new Date(runsA[runsA.length - 1].timestamp).getTime();
        const newestB = new Date(runsB[runsB.length - 1].timestamp).getTime();
        return newestB - newestA;
    });

    // Filter out combinations that have no data points in the filtered timeline
    const activeCombKeys = sortedCombKeys.filter(combKey => {
        const runs = combinations[combKey];
        return runs.some(run => {
            const runDateKey = getDateKey(run.timestamp);
            return globalTimeline.some(t => t.dateKey === runDateKey);
        });
    });

    if (activeCombKeys.length === 0) {
        $('#empty-state').style.display = 'block';
        return;
    }
    $('#empty-state').style.display = 'none';

    activeCombKeys.forEach(combKey => {
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
            
            const run = runs.find(r => getDateKey(r.timestamp) === suite.dateKey);
            
            const isHighlighted = run && run.testId === highlightTestId;
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

                svgContent += `
                    <g class="timeline-point" data-testid="${run.testId}" data-comb="${combKey}" style="cursor: pointer;">
                        ${elementHtml}
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
                const testId = group.getAttribute('data-testid');
                const runData = combinations[combKey].find(r => r.testId === testId);
                if (!runData) return;

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

                const gPassed = stats.guidedPassed !== undefined ? stats.guidedPassed : (stats.guided?.passed || 0);
                const gTotal = stats.guidedTotal !== undefined ? stats.guidedTotal : (stats.guided?.total || 0);
                const uPassed = stats.unguidedPassed !== undefined ? stats.unguidedPassed : (stats.unguided?.passed || 0);
                const uTotal = stats.unguidedTotal !== undefined ? stats.unguidedTotal : (stats.unguided?.total || 0);

                content.innerHTML = `
                    <div style="color: var(--text-secondary); margin-bottom: 8px; font-size: 0.75rem;">${formattedDate}</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>Guided Pass Rate:</span>
                            <span style="font-weight: 600; color: var(--color-primary);">${stats.guidedRate}% (${gPassed}/${gTotal})</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span>Unguided Pass Rate:</span>
                            <span style="font-weight: 600; color: var(--text-secondary);">${stats.unguidedRate}% (${uPassed}/${uTotal})</span>
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
                const combKey = group.getAttribute('data-comb');
                const testId = group.getAttribute('data-testid');
                const runData = combinations[combKey].find(r => r.testId === testId);
                if (runData) {
                    window.location.href = `dashboard.html?testId=${runData.testId}&source=${runData.source}#guide-${guideName}`;
                }
            });
        });
    });
}
