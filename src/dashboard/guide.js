import { initGoogleAuth, authenticatedFetch, getAccessToken, escapeHtml, hasNightlyRuns, $, getScrollBehavior, isElementFullyVisible, scrollSvgLinkIntoViewOnFocus, whenElementSettlesInView, parseSuiteDateInfo, formatSuiteDate, getSuiteDayKey, setPopoverOpen, isPopoverOpen, SUPPORTS_ANCHOR_POSITIONING, placePopoverFallback } from './utils.js';
import { extractSuiteSummary } from './summary-extractor.js';

/**
 * @import { TrialSelection } from './evals.d.ts'
 */

/** @type {Record<string, GuideSuiteSummary>} */
let allTestData = {}; // Cache all test data by testId
let isCompareMode = false;
/** @type {TrialSelection[]} */
let selectedPoints = []; // array of selected trial points
let currentRunFilter = 'nightly';

document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const guideName = params.get('guide');
    const taskName = params.get('task');
    const isA11yMode = params.get('mode') === 'a11y';
    if (!guideName) {
        window.location.href = './';
        return;
    }

    const runFilterParam = params.get('runFilter') ?? params.get('runName');
    if (runFilterParam !== null) {
        currentRunFilter = runFilterParam;
    }

    $('#guide-name-header').textContent = taskName ? `${guideName} — ${taskName}` : guideName;
    const subtitleEl = document.querySelector('.guide-subtitle');
    if (subtitleEl) {
        if (isA11yMode) {
            subtitleEl.innerHTML = 'Guided vs. unguided <strong>accessibility subscore</strong> over time, by agent and model combination <span class="mode-badge-inline">Accessibility checks</span>';
        } else { subtitleEl.textContent = 'Guided vs. unguided pass rate over time, by agent and model combination'; }
    }
    setupTimelineFilterControls(guideName);
    setupCompareMode(guideName);

    try {
        initGoogleAuth(async () => {
            await loadRemoteTests();
            if (runFilterParam === null && hasNightlyRuns(allTestData)) {
                currentRunFilter = 'nightly';
                const runFilterInput = /** @type {HTMLInputElement | null} */ ($('#guide-run-filter-input'));
                if (runFilterInput) runFilterInput.value = currentRunFilter;
            }
            setupNavigationControls(guideName);
            renderGraphs(guideName);
        });

        await loadLocalTests();
        if (getAccessToken()) {
            await loadRemoteTests();
        }
        if (runFilterParam === null) {
            currentRunFilter = hasNightlyRuns(allTestData) ? 'nightly' : '';
            const runFilterInput = /** @type {HTMLInputElement | null} */ ($('#guide-run-filter-input'));
            if (runFilterInput) runFilterInput.value = currentRunFilter;
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
    if (source === 'remote' && (allTestData[`${summary.testId}|||local`] || allTestData[`${summary.testId}|||static`])) {
        return;
    }
    if ((source === 'local' || source === 'static') && allTestData[`${summary.testId}|||remote`]) {
        delete allTestData[`${summary.testId}|||remote`];
    }
    const compoundKey = `${summary.testId}|||${source}`;

    allTestData[compoundKey] = {
        testId: summary.testId,
        timestamp: (() => {
            const info = parseSuiteDateInfo(summary.timestamp, summary.testId);
            if (!info) return summary.timestamp;
            return info.dateOnly ? info.date.toISOString().slice(0, 10) : info.date.toISOString();
        })(),
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

/**
 * @param {string} guideName
 */
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

    const getNavUrl = (/** @type {string} */ targetGuide) => `guide.html?guide=${encodeURIComponent(targetGuide)}${modeSuffix}${currentRunFilter ? `&runFilter=${encodeURIComponent(currentRunFilter)}` : ''}`;

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
        prevBtn.addEventListener('click', () => {
            const prevIndex = (currentIndex - 1 + allGuides.length) % allGuides.length;
            window.location.href = getNavUrl(allGuides[prevIndex]);
        }, { signal });

        nextBtn.disabled = false;
        nextBtn.addEventListener('click', () => {
            const nextIndex = (currentIndex + 1) % allGuides.length;
            window.location.href = getNavUrl(allGuides[nextIndex]);
        }, { signal });
    }

    goBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            window.location.href = getNavUrl(val);
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

    // Filter out suites that don't have this guide, or have 0 trials for it, or don't match run filter
    const filteredKeys = testKeys.filter(key => {
        const run = allTestData[key];
        const g = getStats(run);
        if (!g) return false;
        const gTotal = g.guidedTotal !== undefined ? g.guidedTotal : (g.guided?.total || 0);
        const uTotal = g.unguidedTotal !== undefined ? g.unguidedTotal : (g.unguided?.total || 0);
        if (gTotal === 0 && uTotal === 0) return false;

        if (currentRunFilter && currentRunFilter.trim()) {
            const query = currentRunFilter.trim().toLowerCase();
            const testId = (run.testId || '').toLowerCase();
            if (!testId.includes(query)) return false;
        }
        return true;
    });

    if (filteredKeys.length === 0) {
        $('#empty-state').hidden = false;
        return;
    }
    $('#empty-state').hidden = true;

    /** @type {Record<string, any[]>} */
    const combinations = {};
    filteredKeys.forEach(compoundKey => {
        const run = allTestData[compoundKey];
        const combKey = `${run.agent}|||${run.model}`;
        (combinations[combKey] ??= []).push(run);
    });

    /**
     * Viewer-zone calendar day (UTC for date-only values), shared with the landing page.
     * @param {string} timestamp
     * @returns {string}
     */
    const getDateKey = (timestamp) => getSuiteDayKey(timestamp);

    // Group runs by date for each agent/model combination
    Object.keys(combinations).forEach(combKey => {
        const runs = combinations[combKey];
        runs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        const runsByDateMap = Map.groupBy(runs, run => getDateKey(run.timestamp));

        /** @type {Array<{ dateKey: string, latestRun: any, runsOnDate: any[] }>} */
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
                const shortDate = formatSuiteDate(entry.latestRun.timestamp, { month: 'short', day: 'numeric' });
                globalDatesMap.set(entry.dateKey, {
                    dateKey: entry.dateKey,
                    shortDate: shortDate === '-' ? entry.dateKey : shortDate
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
        $('#empty-state').hidden = false;
        return;
    }
    $('#empty-state').hidden = true;

    activeCombKeys.forEach(combKey => {
        const [agent, model] = combKey.split('|||');
        const entries = combinations[combKey];

        const card = document.createElement('div');
        card.className = 'stat-card guide-stat-card';
        
        const totalRunsCount = entries.reduce((sum, e) => sum + e.runsOnDate.length, 0);
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.flexWrap = 'wrap';
        header.style.gap = '10px';

        const titleDiv = document.createElement('div');
        titleDiv.innerHTML = `
            <h2 class="guide-card-title">
                ${escapeHtml(agent)} <span class="guide-card-title-on">on</span> ${escapeHtml(model)}
            </h2>
            <div class="guide-card-subtitle">
                ${totalRunsCount} chronological trials (${entries.length} active dates)${isA11yMode ? ' · Accessibility checks' : ''}
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
            
            const entry = entries.find(e => e.dateKey === suite.dateKey);
            const run = entry ? entry.latestRun : null;
            const runsOnDate = entry ? entry.runsOnDate : [];
            const stats = run ? getStats(run) : null;

            const isHighlighted = run && runsOnDate.some((/** @type {any} */ r) => r.testId === highlightTestId);
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

                const pointLabel = `${suite.shortDate}: open run`;
                const taskParam = activeTask ? `&task=${encodeURIComponent(activeTask)}` : '';
                const modeParam = isA11yMode ? '&mode=a11y' : '';
                const runHref = `dashboard.html?testId=${encodeURIComponent(run.testId)}&source=${encodeURIComponent(run.source)}${taskParam}${modeParam}#guide-${encodeURIComponent(guideName)}`;
                svgContent += `
                    <a class="timeline-point" href="${escapeHtml(runHref)}" interestfor="tooltip-container" aria-label="${escapeHtml(pointLabel)}" data-testid="${escapeHtml(run.testId)}" data-comb="${escapeHtml(combKey)}" data-datekey="${escapeHtml(suite.dateKey)}" data-x="${x}" data-yg="${yG}">
                        <g class="timeline-marker">${elementHtml}</g>
                        ${multiRunIndicator}
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
        for (const point of svg.querySelectorAll('a.timeline-point')) {
            const hit = point.querySelector(':scope > rect');
            if (hit) scrollSvgLinkIntoViewOnFocus(point, hit, getTimelineMarker(point));

            point.addEventListener('click', (e) => {
                const dateKey = point.getAttribute('data-datekey');
                if (!combKey || !dateKey) return;
                const entry = combinations[combKey]?.find((/** @type {any} */ en) => en.dateKey === dateKey);
                if (!entry) return;

                const runsOnDate = entry.runsOnDate;
                const defaultRun = entry.latestRun;
                const defaultRunIndex = runsOnDate.length; // 1-indexed

                if (isCompareMode) {
                    e.preventDefault();
                    // Render run selection dropdown ABOVE arrows inside the card header
                    document.querySelectorAll('.run-selector-slot').forEach(slot => slot.innerHTML = '');

                    if (runsOnDate.length > 1) {
                        const selectorContainer = document.createElement('div');
                        selectorContainer.style.cssText = 'display:flex; align-items:center; gap:8px; background:var(--bg-secondary); padding:4px 10px; border-radius:6px; border:1px solid var(--border-color); font-size:0.85rem;';

                        const title = document.createElement('span');
                        title.style.cssText = 'font-weight:600; color:var(--text-primary);';
                        title.innerText = `Select run for ${dateKey}:`;
                        selectorContainer.appendChild(title);

                        const select = document.createElement('select');
                        select.style.cssText = 'padding:3px 8px; border-radius:4px; border:1px solid var(--border-color); background:#ffffff; color:#334155; font-size:0.8rem; font-weight:500; cursor:pointer;';

                        runsOnDate.forEach((/** @type {any} */ r, /** @type {number} */ idx) => {
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
                            const chosenRun = runsOnDate.find((/** @type {any} */ r) => r.testId === chosenTestId) || defaultRun;
                            handlePointSelection(chosenRun, point, combKey, guideName, chosenRunIndex);
                        });

                        selectorContainer.appendChild(select);
                        runSelectorSlot.appendChild(selectorContainer);

                        handlePointSelection(defaultRun, point, combKey, guideName, defaultRunIndex);
                    } else {
                        handlePointSelection(defaultRun, point, combKey, guideName, 1);
                    }
                }
            });
        }

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
        const dateKey = point.getAttribute('data-datekey');
        if (!combKey || !dateKey) return false;
        const entry = combinations[combKey]?.find((/** @type {any} */ e) => e.dateKey === dateKey);
        if (!entry) return false;
        const runData = entry.latestRun;
        const runsOnDate = entry.runsOnDate;
        if (!runData) return false;
        const stats = getStats(runData);
        if (!stats) return false;
        const formatted = formatSuiteDate(runData.timestamp, { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const formattedDate = formatted === '-' ? String(runData.timestamp || '') : formatted;
        $('#tooltip-header').innerHTML = `<div class="guide-tooltip-title"> ${escapeHtml(runData.testId)} </div>`;

        let multiRunHtml = '';
        if (runsOnDate.length > 1) {
            multiRunHtml = `
                <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                    <div style="font-weight: 600; font-size: 0.75rem; color: var(--text-primary); margin-bottom: 6px;">
                        ${runsOnDate.length} runs on this date:
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${runsOnDate.map((/** @type {any} */ r, /** @type {number} */ idx) => {
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

        const gPassed = stats.guidedPassed || 0;
        const gTotal = stats.guidedTotal || 0;
        const uPassed = stats.unguidedPassed || 0;
        const uTotal = stats.unguidedTotal || 0;
        $('#tooltip-content').innerHTML = `<div class="guide-tooltip-date">${escapeHtml(formattedDate)}</div> <div class="guide-tooltip-rows"> <div class="guide-tooltip-row"> <span>${isA11yMode ? 'Guided A11y Rate:' : 'Guided Pass Rate:'}</span> <span class="guide-tooltip-guided">${stats.guidedRate}% (${gPassed}/${gTotal})</span> </div> <div class="guide-tooltip-row"> <span>${isA11yMode ? 'Unguided A11y Rate:' : 'Unguided Pass Rate:'}</span> <span class="guide-tooltip-unguided">${stats.unguidedRate}% (${uPassed}/${uTotal})</span> </div> <div class="guide-tooltip-uplift-row"> <span>Uplift:</span> <span class="guide-tooltip-uplift ${stats.uplift == null ? '' : (stats.uplift >= 0 ? 'positive' : 'negative')}"> ${stats.uplift == null ? '—' : `${stats.uplift >= 0 ? '+' : ''}${stats.uplift} pp`} </span> </div> </div>${multiRunHtml}`;
        return true;
    };
}

/**
 * @param {string} guideName
 */
function setupCompareMode(guideName) {
    const compareBtn = $('#compare-mode-btn');
    const banner = $('#compare-banner');
    const launchBtn = /** @type {HTMLButtonElement | null} */ ($('#launch-compare-btn'));
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
            const params = new URLSearchParams(window.location.search);
            const isStaticMode = params.get('source') === 'static' || window.location.hostname.includes('github.io');
            
            window.location.href = `compare.html?trialA=${pA.testId}&trialB=${pB.testId}&runIndexA=${pA.runNumber || 1}&runIndexB=${pB.runNumber || 1}&agentA=${encodeURIComponent(pA.agent || '')}&modelA=${encodeURIComponent(pA.model || '')}&scoreA=${pA.score || 0}&agentB=${encodeURIComponent(pB.agent || '')}&modelB=${encodeURIComponent(pB.model || '')}&scoreB=${pB.score || 0}&guide=${guideName}&source=${isStaticMode ? 'static' : 'local'}`;
        }
    });
}

/**
 * @param {boolean} on
 */
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

/**
 * @param {GuideSuiteSummary} runData
 * @param {Element} group
 * @param {string} combKey
 * @param {string} guideName
 * @param {number} [runNumber=1]
 */
function handlePointSelection(runData, group, combKey, guideName, runNumber = 1) {
    const testId = runData.testId;
    const dateKey = group.getAttribute('data-datekey') || '';
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
                runNumber,
                source: /** @type {'local' | 'static' | undefined} */ (runData.source), 
                agent: runData.agent, 
                model: runData.model,
                score: runData.guides[guideName] ? runData.guides[guideName].guidedRate : 0
            };
        }
    } else {
        if (selectedPoints.length >= 2) {
            const removed = selectedPoints.shift();
            if (removed) {
                const oldGroup = document.querySelector(`[data-datekey="${removed.dateKey}"][data-comb="${removed.combKey}"]`);
                if (oldGroup) oldGroup.querySelector('.compare-highlight')?.remove();
            }
        }

        const stats = runData.guides[guideName];
        selectedPoints.push({ 
            testId, 
            dateKey,
            combKey,
            runNumber,
            source: /** @type {'local' | 'static' | undefined} */ (runData.source), 
            agent: runData.agent, 
            model: runData.model,
            score: stats ? stats.guidedRate : 0
        });

        const x = parseFloat(group.getAttribute('data-x') || '0');
        const y = parseFloat(group.getAttribute('data-yg') || '0');
        
        if (!group.querySelector('.compare-highlight')) {
            const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            Object.entries({
                class: 'compare-highlight',
                cx: x.toString(),
                cy: y.toString(),
                r: '12',
                stroke: '#2563eb',
                'stroke-width': '3',
                fill: 'none',
                style: 'stroke-dasharray: 2; transform-origin: center;'
            }).forEach(([k, v]) => highlight.setAttribute(k, v));
            
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
        const label0 = selectedPoints[0].runNumber ? ` (Run ${selectedPoints[0].runNumber})` : '';
        text.innerHTML = `Selected 1 trial: <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[0].testId.slice(0, 15)}${label0}...</span>. Select one more.`;
        launchBtn.disabled = true;
    } else if (selectedPoints.length === 2) {
        const label0 = selectedPoints[0].runNumber ? ` (Run ${selectedPoints[0].runNumber})` : '';
        const label1 = selectedPoints[1].runNumber ? ` (Run ${selectedPoints[1].runNumber})` : '';
        text.innerHTML = `Ready to compare: <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[0].testId.slice(0, 10)}${label0}...</span> vs <span style="font-family:monospace; color:#bfdbfe;">${selectedPoints[1].testId.slice(0, 10)}${label1}...</span>`;
        launchBtn.disabled = false;
    }
}

/** @type {((point: Element) => boolean) | null} */
let renderTimelineTooltip = null;

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
    const marker = getTimelineMarker(point);
    if (!isElementFullyVisible(marker)) { hideGuideTooltip(); return; }
    placePopoverFallback(tooltip, marker, { placement: 'inline', gap: 10, fallbackWidth: 300, fallbackHeight: 150 });
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
