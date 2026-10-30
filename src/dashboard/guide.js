import { initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, $, getScrollBehavior, isElementFullyVisible, scrollSvgLinkIntoViewOnFocus, whenElementSettlesInView, parseSuiteDate, formatSuiteDate, getSuiteDayKey, toSuiteDateString, setPopoverOpen, isPopoverOpen } from './utils.js';
import { extractSuiteSummary } from './summary-extractor.js';

/** @type {Record<string, GuideSuiteSummary>} */
let allTestData = {}; // Cache all test data by testId

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const guideName = params.get('guide');
    const taskName = params.get('task');
    const isA11yMode = params.get('mode') === 'a11y';
    if (!guideName) {
        window.location.href = './';
        return;
    }

    $('#guide-name-header').textContent = taskName ? `${guideName} — ${taskName}` : guideName;
    const subtitleEl = document.querySelector('.guide-subtitle');
    if (subtitleEl) {
        if (isA11yMode) {
            subtitleEl.innerHTML = 'Guided vs. unguided <strong>accessibility subscore</strong> over time, by agent and model combination <span class="mode-badge-inline">Accessibility checks</span>';
        } else { subtitleEl.textContent = 'Guided vs. unguided pass rate over time, by agent and model combination'; }
    }
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
        $('#empty-state').hidden = false;
    }
});

/**
 * @typedef {Object} GuideSuiteSummary
 * @property {string} testId
 * @property {string} timestamp
 * @property {string} source
 * @property {string} agent
 * @property {string} serving
 * @property {string} model
 * @property {Record<string, any>} guides
 */

/**
 * @param {any} summary
 * @param {string} source
 */
function registerSuiteSummary(summary, source) {
    const compoundKey = `${summary.testId}|||${source}`;

    allTestData[compoundKey] = {
        testId: summary.testId,
        timestamp: (() => { const d = parseSuiteDate(summary.timestamp, summary.testId); return d ? toSuiteDateString(d) : summary.timestamp; })(),
        source: source,
        agent: summary.agent || 'unknown',
        serving: summary.serving || 'unknown',
        model: summary.model || 'unknown',
        guides: summary.guides || {}
    };
}

/**
 * @param {string} testId
 * @param {string} source
 * @param {import('../harness/lib/metrics.ts').EvalsReport} parsed
 * @param {string} [forcedTimestamp]
 */
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

/**
 * @param {string} guideName
 */
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

/** @type {AbortController | null} */
let navListenersAbort = null;
/**
 * @param {string} currentGuide
 */
function setupNavigationControls(currentGuide) {
    navListenersAbort?.abort();
    navListenersAbort = new AbortController();
    const { signal } = navListenersAbort;
    const params = new URLSearchParams(window.location.search);
    const isA11yMode = params.get('mode') === 'a11y';
    const modeSuffix = isA11yMode ? '&mode=a11y' : '';
    const guideSet = new Set();
    Object.values(allTestData).forEach(run => {
        if (run.guides) {
            Object.keys(run.guides).forEach(g => {
                if (!isA11yMode || run.guides[g]?.a11y) { guideSet.add(g); }
            });
        }
    });
    if (currentGuide) guideSet.add(currentGuide);
    const allGuides = [...guideSet].sort();

    const prevBtn = /** @type {HTMLButtonElement} */ ($('#prev-guide-btn'));
    const nextBtn = /** @type {HTMLButtonElement} */ ($('#next-guide-btn'));
    const searchInput = /** @type {HTMLInputElement} */ ($('#guide-search'));
    const list = $('#autocomplete-list');
    const statusEl = document.getElementById('autocomplete-status');
    const goBtn = /** @type {HTMLButtonElement} */ ($('#go-guide-btn'));

    if (allGuides.length <= 1) {
        prevBtn.disabled = true;
        nextBtn.disabled = true;
    } else {
        const currentIndex = allGuides.indexOf(currentGuide);
        
        prevBtn.disabled = false;
        prevBtn.addEventListener('click', () => {
            const prevIndex = (currentIndex - 1 + allGuides.length) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[prevIndex])}${modeSuffix}`;
        }, { signal });

        nextBtn.disabled = false;
        nextBtn.addEventListener('click', () => {
            const nextIndex = (currentIndex + 1) % allGuides.length;
            window.location.href = `guide.html?guide=${encodeURIComponent(allGuides[nextIndex])}${modeSuffix}`;
        }, { signal });
    }

    goBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            window.location.href = `guide.html?guide=${encodeURIComponent(val)}${modeSuffix}`;
        }
    }, { signal });

    let currentFocus = -1;

    const resetComboboxState = () => {
        list.innerHTML = '';
        searchInput.setAttribute('aria-expanded', 'false');
        searchInput.removeAttribute('aria-activedescendant');
        if (statusEl) statusEl.textContent = '';
        currentFocus = -1;
    };
    const closeList = () => { setPopoverOpen(list, false); resetComboboxState(); };
    list.addEventListener('toggle', (e) => {
        if (/** @type {ToggleEvent} */ (e).newState === 'closed') resetComboboxState();
    }, { signal });
    const openList = () => {
        if (isPopoverOpen(list)) return;
        try {
            /** @type {(options?: { source?: HTMLElement }) => void} */
(list.showPopover).call(list, { source: searchInput });
        } catch { setPopoverOpen(list, true); }
    };
    searchInput.addEventListener('input', () => {
        const val = searchInput.value.trim().toLowerCase();
        list.innerHTML = '';
        currentFocus = -1;

        if (!val) {
            closeList();
            return;
        }

        const matches = allGuides.filter(g => g.toLowerCase().includes(val)).slice(0, 10);
        if (matches.length === 0) {
            closeList();
            if (statusEl) statusEl.textContent = 'No matching guides';
            return;
        }

        openList();
        searchInput.setAttribute('aria-expanded', 'true');
        if (statusEl) {
            statusEl.textContent = `${matches.length} option${matches.length === 1 ? '' : 's'} available`;
        }
        matches.forEach((match, i) => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.id = `autocomplete-option-${i}`;
            div.setAttribute('role', 'option');
            div.setAttribute('aria-selected', 'false');
            div.textContent = match;
            div.addEventListener('click', () => {
                searchInput.value = match;
                closeList();
                goBtn.click();
            });
            list.appendChild(div);
        });
    }, { signal });

    searchInput.addEventListener('click', () => { if (searchInput.value.trim() && !isPopoverOpen(list)) searchInput.dispatchEvent(new Event('input')); }, { signal });
    searchInput.addEventListener('keydown', (e) => {
        const isOpen = searchInput.getAttribute('aria-expanded') === 'true';
        const items = list.querySelectorAll('.autocomplete-item');
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && currentFocus > -1 && items[currentFocus]) {
                /** @type {HTMLElement} */
(items[currentFocus]).click();
            } else { closeList(); goBtn.click(); }
            return;
        }
        if (items.length === 0) return;

        if (e.key === 'ArrowDown') {
            currentFocus++;
            setActive(items);
            e.preventDefault();
        } else if (e.key === 'ArrowUp') {
            currentFocus--;
            setActive(items);
            e.preventDefault();
        } else if (e.key === 'Escape') {
            if (isOpen) e.preventDefault();
            closeList();
        }
    }, { signal });

    /**
     * @param {NodeListOf<Element>} items
     */
    function setActive(items) {
        if (!items) return;
        items.forEach(item => { item.classList.remove('active'); item.setAttribute('aria-selected', 'false'); });
        if (currentFocus >= items.length) currentFocus = 0;
        if (currentFocus < 0) currentFocus = items.length - 1;
        items[currentFocus].classList.add('active');
        items[currentFocus].setAttribute('aria-selected', 'true');
        searchInput.setAttribute('aria-activedescendant', items[currentFocus].id);
        items[currentFocus].scrollIntoView({ block: 'nearest' });
    }
}

/** @type {number[]} */
const highlightScrollTimers = [];
/**
 * @param {string} guideName
 */
function renderGraphs(guideName) {
    hideGuideTooltip();
    while (highlightScrollTimers.length > 0) { const id = highlightScrollTimers.pop(); if (id !== undefined) window.clearTimeout(id); }
    const grid = $('#graphs-grid');
    grid.innerHTML = '';

    const params = new URLSearchParams(window.location.search);
    const highlightTestId = params.get('testId');
    const activeTask = params.get('task');
    const isA11yMode = params.get('mode') === 'a11y';

    const testKeys = Object.keys(allTestData);

    /**
     * The requested target's stats, or the guide roll-up when no target is requested.
     * When `?mode=a11y` is active, returns the `.a11y` subscore breakdown.
     * @param {GuideSuiteSummary} run
     * @returns {any}
     */
    const getStats = (run) => {
        const guideStats = run.guides?.[guideName];
        if (!guideStats) return null;
        let targetStats = guideStats;
        if (activeTask) {
            if (guideStats.tasks) { targetStats = guideStats.tasks[activeTask]; } else { targetStats = guideStats.taskName === activeTask ? guideStats : null; }
        }
        if (!targetStats) return null;
        return isA11yMode ? (targetStats.a11y || null) : targetStats;
    };

    // Filter out suites that don't have this guide, or have 0 trials for it
    const filteredKeys = testKeys.filter(key => {
        const g = getStats(allTestData[key]);
        if (!g) return false;
        const gTotal = g.guidedTotal || 0;
        const uTotal = g.unguidedTotal || 0;
        return gTotal > 0 && uTotal > 0;
    });

    if (filteredKeys.length === 0) {
        $('#empty-state').hidden = false;
        return;
    }
    $('#empty-state').hidden = true;

    /** @type {Record<string, GuideSuiteSummary[]>} */
    const combinations = {};
    filteredKeys.forEach(compoundKey => {
        const run = allTestData[compoundKey];
        const combKey = `${run.agent}|||${run.model}`;
        if (!combinations[combKey]) {
            combinations[combKey] = [];
        }
        combinations[combKey].push(run);
    });

    /**
     * Viewer-zone calendar day (UTC for date-only values), shared with the landing page.
     * @param {string} timestamp
     * @returns {string}
     */
    const getDateKey = (timestamp) => {
        const d = parseSuiteDate(timestamp);
        return d ? getSuiteDayKey(d) : '';
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
                const runDate = parseSuiteDate(run.timestamp);
                globalDatesMap.set(dateKey, {
                    dateKey: dateKey,
                    shortDate: runDate ? formatSuiteDate(runDate, { month: 'short', day: 'numeric' }) : dateKey
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

    const cardInnerWidth = Math.max(240, ((grid && grid.clientWidth) || window.innerWidth) - 42);
    const baseMinWidth = Math.min(450, cardInnerWidth);
    const globalWidth = Math.max(baseMinWidth, globalTimeline.length * 24);

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
        $('#empty-state').hidden = false;
        return;
    }
    $('#empty-state').hidden = true;

    activeCombKeys.forEach(combKey => {
        const [agent, model] = combKey.split('|||');
        const runs = combinations[combKey];

        const card = document.createElement('div');
        card.className = 'stat-card guide-stat-card';
        
        const header = document.createElement('div');
        header.innerHTML = `
            <h2 class="guide-card-title">
                ${escapeHtml(agent)} <span class="guide-card-title-on">on</span> ${escapeHtml(model)}
            </h2>
            <div class="guide-card-subtitle">
                ${runs.length} chronological trials${isA11yMode ? ' · Accessibility checks' : ''}
            </div>
        `;
        card.appendChild(header);

        const chartWrapper = document.createElement('div');
        chartWrapper.className = 'guide-chart-wrapper';
        chartWrapper.setAttribute('tabindex', '0');
        chartWrapper.setAttribute('role', 'region');
        chartWrapper.setAttribute('aria-label', `${agent} on ${model} pass rate timeline`);

        const height = 230;
        const paddingX = 46;
        const paddingY = 25;
        const plotHeight = height - 2 * paddingY - 35;
        const plotWidth = globalWidth - 2 * paddingX;
        const stepX = globalTimeline.length > 1 ? plotWidth / (globalTimeline.length - 1) : 0;

        const rateToY = (/** @type {number} */ rate) => paddingY + plotHeight - (rate / 100 * plotHeight);

        let svgContent = '';
        
        [0, 50, 100].forEach(percent => {
            const y = rateToY(percent);
            svgContent += `
                <line x1="${paddingX}" y1="${y}" x2="${globalWidth - paddingX}" y2="${y}" stroke="var(--border-color)" stroke-dasharray="4" stroke-width="1" />
                <text x="${paddingX - 8}" y="${y + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">${percent}%</text>
            `;
        });

        globalTimeline.forEach((suite, i) => {
            const x = globalTimeline.length > 1 ? paddingX + i * stepX : globalWidth / 2;
            
            const run = runs.find(r => getDateKey(r.timestamp) === suite.dateKey);
            const stats = run ? getStats(run) : null;

            const isHighlighted = run && run.testId === highlightTestId;
            if (isHighlighted) {
                svgContent += `
                    <rect x="${x - 12}" y="${paddingY - 5}" width="24" height="${plotHeight + 10}" fill="var(--color-primary)" style="opacity: 0.12; rx: 4px;" />
                `;
            }

            if (run && stats) {
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
                        <circle cx="${x}" cy="${yU}" r="4" stroke="var(--color-outline)" stroke-width="1.5" fill="var(--color-surface-container-lowest)" />
                        <polygon points="${arrowPoints}" fill="${lineColor}" />
                    `;
                }

                const pointLabel = `${suite.shortDate}: open run`;
                const taskParam = activeTask ? `&task=${encodeURIComponent(activeTask)}` : '';
                const modeParam = isA11yMode ? '&mode=a11y' : '';
                const runHref = `dashboard.html?testId=${encodeURIComponent(run.testId)}&source=${encodeURIComponent(run.source)}${taskParam}${modeParam}#guide-${encodeURIComponent(guideName)}`;
                svgContent += `
                    <a class="timeline-point" href="${escapeHtml(runHref)}" interestfor="tooltip-container" aria-label="${escapeHtml(pointLabel)}" data-testid="${escapeHtml(run.testId)}" data-comb="${escapeHtml(combKey)}">
                        <g class="timeline-marker">${elementHtml}</g>
                        <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.75rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle">${escapeHtml(suite.shortDate)}</text>
                        <rect x="${x - 15}" y="${paddingY}" width="30" height="${plotHeight}" fill="transparent" />
                    </a>
                `;
            } else {
                // Draw faded date label for missing runs to preserve axis alignment
                svgContent += `
                    <text x="${x}" y="180" transform="rotate(90, ${x}, 180)" font-size="0.75rem" fill="var(--text-secondary)" text-anchor="start" dominant-baseline="middle" opacity="0.3">${escapeHtml(suite.shortDate)}</text>
                `;
            }
        });

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${globalWidth} ${height}`);
        svg.setAttribute('width', globalWidth.toString());
        svg.setAttribute('height', height.toString());
        svg.style.display = 'block';
        if (globalWidth <= cardInnerWidth || globalTimeline.length <= 16) {
            svg.style.inlineSize = '100%';
            svg.style.maxInlineSize = `${globalWidth}px`;
            svg.style.blockSize = 'auto';
        }
        svg.innerHTML = svgContent;
        for (const point of svg.querySelectorAll('a.timeline-point')) { const hit = point.querySelector(':scope > rect'); if (hit) scrollSvgLinkIntoViewOnFocus(point, hit, getTimelineMarker(point)); }

        chartWrapper.appendChild(svg);
        card.appendChild(chartWrapper);
        grid.appendChild(card);

        if (highlightTestId) {
            const highlightedEl = svg.querySelector(`[data-testid="${CSS.escape(highlightTestId)}"]`);
            if (highlightedEl) {
                const timerId = window.setTimeout(() => {
                    const wrapperRect = chartWrapper.getBoundingClientRect();
                    const elRect = highlightedEl.getBoundingClientRect();
                    const targetScroll = chartWrapper.scrollLeft + (elRect.left - wrapperRect.left) - (wrapperRect.width / 2) + (elRect.width / 2);
                    chartWrapper.scrollTo({ left: targetScroll, behavior: getScrollBehavior() });
                }, 200);
                highlightScrollTimers.push(timerId);
            }
        } else if (chartWrapper.scrollWidth > chartWrapper.clientWidth) {
            chartWrapper.scrollLeft = chartWrapper.scrollWidth;
        }

    });

    /** @param {Element} point
 * @returns {boolean} whether the point resolved to a run */
    renderTimelineTooltip = (point) => {
        const combKey = point.getAttribute('data-comb');
        const testId = point.getAttribute('data-testid');
        if (!combKey || !testId) return false;
        const runData = combinations[combKey]?.find(r => r.testId === testId);
        if (!runData) return false;
        const stats = getStats(runData);
        if (!stats) return false;
        const parsedDate = parseSuiteDate(runData.timestamp);
        const formattedDate = parsedDate
            ? formatSuiteDate(parsedDate, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : String(runData.timestamp || '');
        $('#tooltip-header').innerHTML = `<div class="guide-tooltip-title"> ${escapeHtml(runData.testId)} </div>`;

        const gPassed = stats.guidedPassed || 0;
        const gTotal = stats.guidedTotal || 0;
        const uPassed = stats.unguidedPassed || 0;
        const uTotal = stats.unguidedTotal || 0;
        $('#tooltip-content').innerHTML = `<div class="guide-tooltip-date">${escapeHtml(formattedDate)}</div> <div class="guide-tooltip-rows"> <div class="guide-tooltip-row"> <span>${isA11yMode ? 'Guided A11y Rate:' : 'Guided Pass Rate:'}</span> <span class="guide-tooltip-guided">${stats.guidedRate}% (${gPassed}/${gTotal})</span> </div> <div class="guide-tooltip-row"> <span>${isA11yMode ? 'Unguided A11y Rate:' : 'Unguided Pass Rate:'}</span> <span class="guide-tooltip-unguided">${stats.unguidedRate}% (${uPassed}/${uTotal})</span> </div> <div class="guide-tooltip-uplift-row"> <span>Uplift:</span> <span class="guide-tooltip-uplift ${stats.uplift >= 0 ? 'positive' : 'negative'}"> ${stats.uplift >= 0 ? '+' : ''}${stats.uplift} pp </span> </div> </div>`;
        return true;
    };
}

/** @type {((point: Element) => boolean) | null} */
let renderTimelineTooltip = null;

const SUPPORTS_ANCHOR_POSITIONING = typeof CSS !== 'undefined' && CSS.supports('anchor-name', '--a');

const timelineAnchor = document.createElement('span');
timelineAnchor.className = 'timeline-anchor';
timelineAnchor.setAttribute('aria-hidden', 'true');

/** @param {Element} point
 * @returns {Element} */
function getTimelineMarker(point) { return point.querySelector('.timeline-marker') || point; }

/** @param {Element} point */
function moveTimelineAnchor(point) {
    const wrapper = point.closest('.guide-chart-wrapper');
    if (!(wrapper instanceof HTMLElement)) return;
    const r = getTimelineMarker(point).getBoundingClientRect();
    const w = wrapper.getBoundingClientRect();
    if (timelineAnchor.parentElement !== wrapper) wrapper.appendChild(timelineAnchor);
    timelineAnchor.style.left = `${r.left - w.left + wrapper.scrollLeft - wrapper.clientLeft}px`;
    timelineAnchor.style.top = `${r.top - w.top + wrapper.scrollTop - wrapper.clientTop}px`;
    timelineAnchor.style.width = `${r.width}px`;
    timelineAnchor.style.height = `${r.height}px`;
}

/** @param {HTMLElement} tooltip
 * @param {Element} point */
function placeGuideTooltipFallback(tooltip, point) {
    if (!isElementFullyVisible(getTimelineMarker(point))) { hideGuideTooltip(); return; }
    const r = getTimelineMarker(point).getBoundingClientRect();
    const gap = 10;
    const margin = 8;
    const w = tooltip.offsetWidth || 300;
    const h = tooltip.offsetHeight || 150;
    let left = r.right + gap;
    let top = r.top + (r.height / 2) - (h / 2);
    if (left + w > window.innerWidth - margin) {
        left = r.left - w - gap;
        if (left < margin) { left = r.left + (r.width / 2) - (w / 2); top = r.bottom + gap + h <= window.innerHeight - margin ? r.bottom + gap : r.top - h - gap; }
    }
    tooltip.style.left = `${Math.max(margin, Math.min(left, window.innerWidth - w - margin))}px`;
    tooltip.style.top = `${Math.max(margin, Math.min(top, window.innerHeight - h - margin))}px`;
}
/** @type {Element | null} */
let activeTimelinePoint = null;
let shownWithoutInvoker = false;
let pendingTimelinePoint = /** @type {Element | null} */ (null);
/** @type {number} */
let guideFallbackFrame = 0;
function setupGuideTooltip() {
    const tooltip = document.getElementById('tooltip-container');
    if (!tooltip) return;
    tooltip.addEventListener('interest', (e) => {
        const source = /** @type {Event & { source?: Element | null }} */ (e).source;
        const point = source?.closest('.timeline-point');
        if (!point || !renderTimelineTooltip || !renderTimelineTooltip(point)) return;
        if (!SUPPORTS_ANCHOR_POSITIONING && !isElementFullyVisible(getTimelineMarker(point))) {
            hideGuideTooltip();
            pendingTimelinePoint = point;
            whenElementSettlesInView(getTimelineMarker(point), () => {
                pendingTimelinePoint = null;
                if (!renderTimelineTooltip || !renderTimelineTooltip(point)) return;
                activeTimelinePoint = point;
                setPopoverOpen(tooltip, true);
                shownWithoutInvoker = true;
                placeGuideTooltipFallback(tooltip, point);
            }, () => pendingTimelinePoint === point && point.matches(':focus, :hover'));
            return;
        }
        pendingTimelinePoint = null;
        activeTimelinePoint = point;
        if (SUPPORTS_ANCHOR_POSITIONING) moveTimelineAnchor(point);
        else if (isPopoverOpen(tooltip)) placeGuideTooltipFallback(tooltip, point);
        window.setTimeout(() => {
            if (activeTimelinePoint === point && !isPopoverOpen(tooltip)) { setPopoverOpen(tooltip, true); shownWithoutInvoker = true; }
        });
    });
    tooltip.addEventListener('loseinterest', () => { if (shownWithoutInvoker) hideGuideTooltip(); });
    tooltip.addEventListener('toggle', (e) => {
        const open = /** @type {ToggleEvent} */ (e).newState === 'open';
        if (open && !SUPPORTS_ANCHOR_POSITIONING && activeTimelinePoint) placeGuideTooltipFallback(tooltip, activeTimelinePoint);
        if (!open) { activeTimelinePoint = null; shownWithoutInvoker = false; }
    });
    if (!SUPPORTS_ANCHOR_POSITIONING) {
        const onViewportChange = () => {
            if (guideFallbackFrame) return;
            guideFallbackFrame = window.requestAnimationFrame(() => {
                guideFallbackFrame = 0;
                if (!activeTimelinePoint || !isPopoverOpen(tooltip)) return;
                if (!activeTimelinePoint.isConnected) hideGuideTooltip();
                else placeGuideTooltipFallback(tooltip, activeTimelinePoint);
            });
        };
        document.addEventListener('scroll', onViewportChange, { capture: true, passive: true });
        window.addEventListener('resize', onViewportChange, { passive: true });
    }
}
function hideGuideTooltip() {
    const tooltip = document.getElementById('tooltip-container');
    if (tooltip) setPopoverOpen(tooltip, false);
}
setupGuideTooltip();
