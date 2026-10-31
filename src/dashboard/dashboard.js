import { getRunStats, isEarlyFailureRun, isUnguidedLeakRun, getEligibleScenarioIds, getA11yRunStats, getColor, escapeHtml, initGoogleAuth, calculateChartData, parseResultKey, $, formatTokens, formatDuration, getTokenBreakdown, getAgentRuntimeMs, getScrollBehavior, formatSuiteDate, isPopoverOpen, SUPPORTS_ANCHOR_POSITIONING, placePopoverFallback } from './utils.js';
import { A11Y_SUBCATEGORIES, A11Y_SUBCATEGORY_MAP, classifyAccessibilityCheck } from './a11y-classifier.js';
import { extractSuiteSummary } from './summary-extractor.js';
import { ApiClient } from './api.js';
import { DumbbellChart, hideDumbbellTooltip } from './dumbbell-chart.js';

/**
 * @typedef {Object} CurrentDetails
 * @property {string} testName
 * @property {DashboardRunResult[]} runs
 * @property {import('../harness/lib/metrics.ts').Metrics['testStats'][string]} stats
 * @property {string} testId
 */

/**
 * @typedef {import('../harness/lib/metrics.ts').RunResult & {
 *   discipline?: string;
 *   files?: string[];
 *   runtime?: { agentRuntime?: number; graderRuntime?: number } | null;
 *   guideUsed?: { guidesUsed?: string[] } | null;
 *   retrievedGuides?: string[];
 *   fileReadGuides?: string[];
 * }} DashboardRunResult
 */

/**
 * @typedef {import('../harness/lib/metrics.ts').EvalsReport & {
 *   enableSkills?: boolean;
 *   results: Record<string, DashboardRunResult[]>;
 * }} DashboardEvalsReport
 */

/** @type {CurrentDetails | null} */
let currentDetails = null;
/** @type {DashboardEvalsReport | null} */
let allTestData = null;
/** @type {string[]} */
let sortedScenarios = [];
/** @type {string[]} */
let currentRunTypes = ['unguided', 'guided'];
/** @type {string | null} */
let currentTestID = null;
/** @type {ApiClient} */
let api;
/** @type {'all' | 'a11y'} */
let currentMetricMode = 'all';
/** @type {'default' | 'uplift' | 'a11y' | 'time' | 'tokens'} */
let currentTaskSort = 'default';
/** @type {'asc' | 'desc'} */
let currentTaskSortDir = 'desc';
/** @type {string} */
let currentCategoryFilter = 'all';
/** @type {string} */
let currentTextFilter = '';
/** @type {string} */
let currentFeatureFilter = '';
/** @type {Set<string>} */
const collapsedCategories = new Set();

const DISCIPLINE_GUIDES = new Set([
    'accessibility',
    'css-layout',
    'html',
    'javascript',
    'performance',
    'security',
    'web-platform-core',
]);

/** @type {Record<string, string>} */
const CATEGORY_LABELS = {
    discipline: 'Discipline',
    css: 'CSS',
    html: 'HTML',
    javascript: 'JavaScript',
    accessibility: 'Accessibility',
    performance: 'Performance',
    security: 'Security',
    'built-in-ai': 'Built-in AI',
    'web-apis': 'Web APIs',
    media: 'Media',
    privacy: 'Privacy',
    other: 'Other',
};

/** @param {string} cat */
function formatCategoryLabel(cat) {
    if (CATEGORY_LABELS[cat]) return CATEGORY_LABELS[cat];
    return cat.split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : '').join(' ');
}

/** @type {Promise<Map<string, string>> | null} */
let guideCategoryMapPromise = null;

/** @returns {Promise<Map<string, string>>} */
function loadGuideCategoryMap() {
    if (!guideCategoryMapPromise) {
        guideCategoryMapPromise = (async () => {
            const map = new Map();
            try {
                const res = await fetch('./grouped-tasks.gen.json');
                if (res.ok) {
                    const data = await res.json();
                    const guides = data?.guides || {};
                    for (const [cat, guideObj] of Object.entries(guides)) {
                        if (!guideObj || typeof guideObj !== 'object') continue;
                        for (const guideName of Object.keys(guideObj)) {
                            const resolved = (DISCIPLINE_GUIDES.has(guideName) || guideName === cat) ? 'discipline' : cat;
                            map.set(guideName, resolved);
                        }
                    }
                }
            } catch {
                // Fallback to DISCIPLINE_GUIDES if grouped-tasks.gen.json is unavailable
            }
            for (const g of DISCIPLINE_GUIDES) {
                if (!map.has(g)) map.set(g, 'discipline');
            }
            return map;
        })();
    }
    return guideCategoryMapPromise;
}

// Module-scoped state
let dashboardLoaded = false;
/** @type {import('./summary-extractor.js').SuiteSummary | null} */
let currentSuiteSummary = null;

/** @param {HTMLElement} pop */
function positionHintFallback(pop) {
    const trigger = document.querySelector(`[interestfor="${CSS.escape(pop.id)}"]`);
    if (!trigger) return;
    for (let pass = 0; pass < 2; pass++) {
        placePopoverFallback(pop, trigger);
    }
}
if (!SUPPORTS_ANCHOR_POSITIONING) {
    for (const type of ['beforetoggle', 'toggle']) {
        document.addEventListener(type, (e) => {
            const pop = e.target;
            if (!(pop instanceof HTMLElement) || !pop.classList.contains('hint-popover')) return;
            if (/** @type {ToggleEvent} */ (e).newState !== 'open') return;
            positionHintFallback(pop);
        }, true);
    }
    let hintFrame = 0;
    const repositionOpenHints = () => {
        if (hintFrame) return;
        hintFrame = window.requestAnimationFrame(() => {
            hintFrame = 0;
            for (const pop of document.querySelectorAll('.hint-popover')) {
                if (!(pop instanceof HTMLElement) || !isPopoverOpen(pop)) continue;
                const trigger = document.querySelector(`[interestfor="${CSS.escape(pop.id)}"]`);
                const r = trigger?.getBoundingClientRect();
                if (!r || r.bottom < 0 || r.top > window.innerHeight || r.right < 0 || r.left > window.innerWidth) { pop.hidePopover?.(); } else { positionHintFallback(pop); }
            }
        });
    };
    window.addEventListener('scroll', repositionOpenHints, { capture: true, passive: true });
    window.addEventListener('resize', repositionOpenHints, { passive: true });
}
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize API Client
    api = new ApiClient();

    const initialParams = new URLSearchParams(window.location.search);
    const initialMode = initialParams.get('mode');
    if (initialMode === 'a11y') { currentMetricMode = 'a11y'; }
    const initialSort = initialParams.get('sort');
    const modeAllBtn = document.getElementById('dash-mode-all-btn');
    const modeA11yBtn = document.getElementById('dash-mode-a11y-btn');
    if (modeAllBtn && modeA11yBtn) {
        const modeAllInput = modeAllBtn.querySelector('input[type="radio"]');
        const modeA11yInput = modeA11yBtn.querySelector('input[type="radio"]');
        const syncDashModeButtons = (/** @type {'all' | 'a11y'} */ mode) => {
            const isAll = mode === 'all';
            if (modeAllInput instanceof HTMLInputElement) modeAllInput.checked = isAll;
            if (modeA11yInput instanceof HTMLInputElement) modeA11yInput.checked = !isAll;
        };
        syncDashModeButtons(currentMetricMode);
        const setMode = (/** @type {'all' | 'a11y'} */ mode) => {
            if (currentMetricMode !== mode) {
                currentMetricMode = mode;
                syncDashModeButtons(mode);
                const url = new URL(window.location.href);
                if (mode === 'a11y') { url.searchParams.set('mode', 'a11y'); } else { url.searchParams.delete('mode'); }
                window.history.replaceState({}, '', url);
                if (allTestData && currentTestID) { renderDashboardDumbbellChart(allTestData); rerenderGrid(allTestData, currentTestID); }
            }
        };
        const modeToggleGroup = modeAllBtn.closest('.metric-mode-toggle');
        modeToggleGroup?.addEventListener('change', (e) => {
            const target = e.target;
            if (target instanceof HTMLInputElement && (target.value === 'all' || target.value === 'a11y')) { setMode(target.value); }
        });
    }
    if (initialSort === 'uplift' || initialSort === 'uplift-desc') { currentTaskSort = 'uplift'; currentTaskSortDir = 'desc'; }
    else if (initialSort === 'uplift-asc') { currentTaskSort = 'uplift'; currentTaskSortDir = 'asc'; }
    else if (initialSort === 'a11y' || initialSort === 'a11y-desc') { currentTaskSort = 'a11y'; currentTaskSortDir = 'desc'; }
    else if (initialSort === 'time' || initialSort === 'time-saved') { currentTaskSort = 'time'; currentTaskSortDir = 'asc'; }
    else if (initialSort === 'time-overhead') { currentTaskSort = 'time'; currentTaskSortDir = 'desc'; }
    else if (initialSort === 'tokens' || initialSort === 'tokens-saved') { currentTaskSort = 'tokens'; currentTaskSortDir = 'asc'; }

    const evalFilterInput = document.getElementById('eval-filter');
    if (evalFilterInput instanceof HTMLInputElement) {
        evalFilterInput.addEventListener('input', () => {
            currentTextFilter = evalFilterInput.value.trim().toLowerCase();
            if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
        });
    }
    const evalFeatureInput = document.getElementById('eval-feature-filter');
    if (evalFeatureInput instanceof HTMLInputElement) {
        evalFeatureInput.addEventListener('input', () => {
            currentFeatureFilter = evalFeatureInput.value.trim().toLowerCase();
            if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
        });
    }
    const sortResetBtn = document.getElementById('eval-sort-reset');
    sortResetBtn?.addEventListener('click', () => {
        currentTaskSort = 'default';
        currentTaskSortDir = 'desc';
        const url = new URL(window.location.href);
        url.searchParams.delete('sort');
        window.history.replaceState({}, '', url);
        if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
    });
    // Auth Button Handling (only for remote)
    if (api.source === 'remote') {
        initGoogleAuth(async () => {
            // Reload on auth success
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');
            if (testId) {
                await loadDashboardData(testId);
            }
        });
    }

    const initialTestID = initialParams.get('testId');

    // Update "Back to Results" buttons to carry source param
    const source = initialParams.get('source');
    if (source) {
        const backBtns = document.querySelectorAll('a[href="./"]');
        backBtns.forEach(btn => {
            if (btn instanceof HTMLAnchorElement) {
                btn.href = `./?source=${source}`;
            }
        });
    }

    if (initialTestID) {
        await loadDashboardData(initialTestID);
    } else {
        endLoadingReservations();
        const main = document.getElementById('main-content');
        if (main) { main.innerHTML = `<div class="error-message">Error: No testId provided in query string.</div>`; }
    }
});

function endLoadingReservations() {
    document.getElementById('test-header')?.removeAttribute('aria-busy');
    document.getElementById('guide-grid')?.removeAttribute('aria-busy');
    const chartSection = document.getElementById('chart-section');
    if (chartSection?.getAttribute('aria-busy') === 'true') { chartSection.removeAttribute('aria-busy'); chartSection.classList.add('hidden'); }
}
/**
 * @param {string} testId
 */
async function loadDashboardData(testId) {
    // Prevent double loading
    if (dashboardLoaded) return;
    dashboardLoaded = true;

    try {
        const jetskiPromise = api.getJetskiInfo(testId).catch((/** @type {unknown} */ e) => { console.log('Could not load Jetski info:', e); return null; });
        const data = await api.getEvals(testId);
        if (!data) {
            endLoadingReservations();
            const main = document.getElementById('main-content');
            if (main) {
                main.innerHTML = `<div class="error-message">Error: Failed to load evaluation data for ${escapeHtml(testId)}.</div>`;
            }
            return;
        }

        // Capture data for navigation
        allTestData = data;
        currentTestID = testId;

        let jetskiVersion = null;
        let manifestTimestamp = null;
        const jetskiData = await jetskiPromise;
        if (jetskiData) {
            jetskiVersion = jetskiData['Jetski Version'];
            manifestTimestamp = jetskiData.timestamp;
        }

        // Fetch timestamp from manifest
        let timestamp = null;
        if (manifestTimestamp) {
            timestamp = manifestTimestamp;
        }

        renderTestHeader(testId, jetskiVersion, timestamp, data);
        const extractedSummary = renderSummary(data);
        renderDashboardDumbbellChart(data, extractedSummary);
        void renderGrid(data, testId);
        await renderGridIdle();
        endLoadingReservations();

        // Check for deep link to modal
        const params = new URLSearchParams(window.location.search);
        const testName = params.get('testName');
        const checkId = params.get('checkId');

        if (testName) {
            const results = data.results;
            const stats = data.stats;
            const runData = results[testName];
            const testStats = stats[testName];

            if (runData && testStats) {
                const view = params.get('view');
                const runParam = params.get('run');
                const runNumber = runParam ? parseInt(runParam) : NaN;

                if (view === 'diff' && !isNaN(runNumber)) {
                    const run = runData.find(r => r.runNumber === runNumber);
                    if (run) {
                        currentDetails = { testName, runs: runData, stats: testStats, testId };
                        await showDetails(testName, runData, testStats, testId);

                        const paths = await getResultPaths(testId, run, testName);
                        if (paths) {
                            const { setupPath, resultPath } = paths;
                            await viewDiff(setupPath, resultPath, testName, run.runNumber);
                        }
                    } else {
                        await showDetails(testName, runData, testStats, testId);
                    }
                } else {
                    // Auto-open modal
                    await showDetails(testName, runData, testStats, testId);
                }

                // If checkId is provided, try to scroll to it
                if (checkId) {
                    // Give the modal a moment to render
                    setTimeout(() => {
                        const checkItems = document.querySelectorAll('.check-item');
                        for (const item of checkItems) {
                            if (item.textContent.includes(checkId)) {
                                if (item instanceof HTMLElement) {
                                    item.scrollIntoView({ behavior: getScrollBehavior(), block: 'center' });
                                    item.style.backgroundColor = 'rgba(255, 255, 0, 0.2)'; // Highlight
                                    item.style.transition = 'background-color 0.5s';
                                }
                                break;
                            }
                        }
                    }, 100);
                }
            }
        }
        // Check for deep link to guide in hash
        const hash = window.location.hash;
        if (hash && hash.startsWith('#guide-')) {
            let targetGuide = hash.substring(7); // remove '#guide-'
            try { targetGuide = decodeURIComponent(targetGuide); } catch {
            }
            const targetTask = params.get('task');
            setTimeout(() => {
                const accordionEl = (targetTask && document.querySelector(`.task-accordion[data-guide="${CSS.escape(targetGuide)}"][data-task="${CSS.escape(targetTask)}"]`))
                    || document.querySelector(`.task-accordion[data-guide="${CSS.escape(targetGuide)}"]`);
                if (accordionEl) {
                    accordionEl.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
                    if (!accordionEl.classList.contains('open')) {
                        const header = $('.task-accordion-header', accordionEl);
                        if (header) header.click();
                    }
                }
            }, 200);
        }
    } catch (error) {
        console.error('Error:', error);
        dashboardLoaded = false;
        endLoadingReservations();

        const message = (error instanceof Error) ? error.message : String(error);

        let errorHtml = `<div class="error-banner"> <h2>Error loading dashboard data</h2>
            <p>${escapeHtml(message)}</p>
        </div>`;

        if (api && api.source === 'remote') {
            errorHtml += `<div class="error-subtext">
                <p>If your session has expired, please use the <strong>Sign in with Google</strong> button above to re-authenticate.</p>
            </div>`;
        }

        const grid = document.getElementById('dashboard-grid') || document.getElementById('guide-grid') || document.getElementById('dumbbell-chart');
        if (grid) {
            grid.innerHTML = errorHtml;
        }
    }
}

// Modal control
document.addEventListener('DOMContentLoaded', () => {
    const modal = $('dialog#modal');


    if (!('closedBy' in HTMLDialogElement.prototype)) {
        const outside = (/** @type {PointerEvent} */ e) => { const r = modal.getBoundingClientRect(); return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom; };
        let pressedOutside = false;
        modal.addEventListener('pointerdown', (e) => { pressedOutside = outside(e); });
        modal.addEventListener('pointerup', (e) => { if (pressedOutside && outside(e) && modal.open) modal.close(); });
    }

    document.addEventListener('click', (e) => {
        const target = e.target;
        if (!(target instanceof Element)) return;
        const btn = target.closest('.tfoot-action-btn[data-action]');
        if (!(btn instanceof HTMLButtonElement)) return;
        const action = btn.dataset.action;
        if (action === 'trajectory' && btn.dataset.basePath && btn.dataset.sessionFile) { openTrajectory(btn.dataset.basePath, btn.dataset.sessionFile); } else if (action === 'content' && btn.dataset.fileName && btn.dataset.filePath) { viewContent(btn.dataset.fileName, btn.dataset.filePath); } else if (action === 'diff' && btn.dataset.setupPath !== undefined && btn.dataset.resultPath && btn.dataset.scenarioName && btn.dataset.runNumber) { viewDiff(btn.dataset.setupPath, btn.dataset.resultPath, btn.dataset.scenarioName, Number(btn.dataset.runNumber)); } else if (action === 'app' && btn.dataset.appUrl) { openApp(btn.dataset.appUrl); }
    });

    window.addEventListener('message', (e) => {
        const frame = modal.querySelector('iframe.artifact-frame[data-esc-bridge]');
        if (!(frame instanceof HTMLIFrameElement) || !frame.contentWindow || e.source !== frame.contentWindow) return;
        if (e.origin !== 'null') return;
        const msg = e.data;
        if (typeof msg !== 'object' || msg === null || Array.isArray(msg)) return;
        if (Object.keys(msg).length !== 1 || msg.type !== TRAJECTORY_CLOSE_MESSAGE) return;
        if (modal.open) modal.close();
    });

    // Handle Esc key or dialog close API
    modal.addEventListener('close', () => {
        modal.classList.remove('diff-modal', 'frame-modal');
        modal.querySelector('.modal-content')?.classList.remove('diff-modal', 'frame-modal');
        modal.querySelectorAll('iframe.artifact-frame').forEach(frame => frame.remove());
        const url = new URL(window.location.href);
        const paramsList = ['testName', 'checkId', 'view', 'run'];
        let changed = false;
        paramsList.forEach(p => {
            if (url.searchParams.has(p)) {
                url.searchParams.delete(p);
                changed = true;
            }
        });
        if (changed) {
            window.history.replaceState({}, '', url);
        }
    });

    // View GCS Artifacts
    const gcsBtn = document.getElementById('view-gcs-artifacts-btn');
    if (gcsBtn) {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source');
        const testId = params.get('testId');
        if (source === 'remote' && testId) {
            gcsBtn.hidden = false;
            gcsBtn.onclick = () => window.open(`https://console.cloud.google.com/storage/browser/guidance-evals/${encodeURIComponent(testId)}?project=chrome-kiwi-air-force-dev`, '_blank');
        }
    }

    // View Log Handler
    (async () => {
        const viewLogBtn = document.getElementById('view-log-btn');
        if (viewLogBtn) {
            const params = new URLSearchParams(window.location.search);
            const testId = params.get('testId');

            if (testId) {
                try {
                    const hasLog = await api.checkLogExists(testId);
                    if (!hasLog) {
                        viewLogBtn.hidden = true;
                    } else {
                        viewLogBtn.onclick = async () => {
                            const modal = $('dialog#modal');
                            const title = $('#modal-title');
                            const body = $('#modal-body');

                            title.textContent = 'Test Suite Run Log';
                            body.innerHTML = '<div class="modal-status-msg">Loading log...</div>';
                            modal.dataset.view = 'log';
                            modal.showModal();

                            try {
                                const text = await api.getFileText(`${testId}/test_suite.log`);
                                body.innerHTML = `<div class="log-content" tabindex="0">${escapeHtml(text)}</div>`;
                            } catch (e) {
                                const msg = (e instanceof Error) ? e.message : String(e);
                                body.innerHTML = `<div class="modal-error-msg">Error loading log: ${escapeHtml(msg)}</div>`;
                            }
                        };
                    }
                } catch (e) {
                    console.log('Error checking log existence:', e);
                    viewLogBtn.hidden = true;
                }
            } else {
                viewLogBtn.hidden = true;
            }
        }
    })();

    // Arrow key navigation
    document.addEventListener('keydown', (e) => {
        const modal = $('dialog#modal');
        if (!modal.open || modal.dataset.view !== 'details') return;

        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
            if (!allTestData || !currentTestID || !currentDetails || !sortedScenarios.length || !currentRunTypes.length) return;

            const parsed = parseResultKey(currentDetails.testName);
            if (!parsed) return;
            const { task: taskName, guide, runType } = parsed;
            const currentScenario = `${taskName} - ${guide}`;

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

            const results = allTestData.results;
            if (nextTestName !== currentDetails.testName && results[nextTestName]) {
                e.preventDefault();
                showDetails(
                    nextTestName,
                    results[nextTestName],
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

/**
 * @param {number} ms
 */
function formatRuntime(ms) {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

/**
 * @param {string} testId
 * @param {string | null} jetskiVersion
 * @param {string | null} timestamp
 * @param {DashboardEvalsReport} data
 */
function renderTestHeader(testId, jetskiVersion, timestamp, data) {
    const container = $('#test-header');
    if (container) {
        const timeStr = formatSuiteDate(timestamp || data?.timestamp || '', testId);

        let agent = 'unknown';
        let model = 'unknown';

        if (data) {
            agent = data.agent || 'unknown';
            model = data.model || 'unknown';
        }

        container.removeAttribute('aria-busy');
        container.innerHTML = `
            <div class="header-meta-grid">
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(testId)}</span>
                    <span class="meta-label">Test ID</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(timeStr)}</span>
                    <span class="meta-label">Action Date</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(agent)}</span>
                    <span class="meta-label">Agent</span>
                </div>
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(model)}</span>
                    <span class="meta-label">Model</span>
                </div>
                ${data.totalRuntime ?
                `<div class="header-meta-item">
                    <span class="meta-value">${formatRuntime(data.totalRuntime)}</span>
                    <span class="meta-label">Total Runtime</span>
                </div>` : ''}
                ${data.cliVersion ? `
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(data.cliVersion)}</span>
                    <span class="meta-label">CLI Version</span>
                </div>
                ` : ''}
                ${data.skillVersion ? `
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(data.skillVersion)}</span>
                    <span class="meta-label">Skill Version</span>
                </div>
                ` : ''}
                ${jetskiVersion ? `
                <div class="header-meta-item">
                    <span class="meta-value">${escapeHtml(jetskiVersion)}</span>
                    <span class="meta-label">Jetski Version</span>
                </div>
                ` : ''}
            </div>
        `;
    }
}

/**
 * @param {number} uRate
 * @param {number} gRate
 * @param {boolean} [isSmall]
 */
function renderSparkline(uRate, gRate, isSmall = false) {
    const barClass = isSmall ? 'sparkline-bar small' : 'sparkline-bar';
    const dotClass = isSmall ? 'sparkline-dot small' : 'sparkline-dot';
    const rangeClass = isSmall ? 'sparkline-range small' : 'sparkline-range';
    const min = Math.min(uRate, gRate);
    const abs = Math.abs(gRate - uRate);
    const regressedCls = gRate < uRate ? ' regressed' : '';
    return `
        <div class="${barClass}" aria-hidden="true">
            <div class="${rangeClass}${regressedCls}" style="left: ${min}%; width: ${abs}%;"></div>
            <div class="${dotClass} unguided" style="left: ${uRate}%;"></div>
            <div class="${dotClass} guided" style="left: ${gRate}%;"></div>
        </div>
    `;
}

/**
 * @param {DashboardEvalsReport} data
 * @returns {import('./summary-extractor.js').SuiteSummary | null}
 */
function renderSummary(data) {
    const container = document.getElementById('summary-side-panel');
    if (!container) return null;
    const summary = data.summary || {};

    if (!data || !data.results) {
        console.error('Problematic data object in renderSummary:', data);
        container.innerHTML = '<div style="padding: 15px; color: var(--text-secondary); font-style: italic;">No results available for summary.</div>';
        return null;
    }

    const extracted = extractSuiteSummary(currentTestID || 'suite', data);
    currentSuiteSummary = extracted;
    if (!extracted) return null;
    const { guidedStats, unguidedStats, a11yStats, efficiencyStats } = extracted;
    const rt = efficiencyStats.runtime;
    const tok = efficiencyStats.tokens;
    const results = data.results;
    const eligibleScenarios = getEligibleScenarioIds(results);
    const baseKeys = new Set();
    const tasksWithTools = new Set();
    const tasksWithGuides = new Set();

    let totalAllRunsCount = 0;
    let totalUnguidedRunsCount = 0;
    let computedEarlyFailures = 0;
    let unguidedLeaksCount = 0;
    Object.keys(results).forEach(key => {
        const base = key.replace(' - guided', '').replace(' - unguided', '');
        baseKeys.add(base);
        const parsed = parseResultKey(key);

        const runs = results[key] || [];
        totalAllRunsCount += runs.length;
        const isGuided = key.endsWith(' - guided');
        if (!isGuided) totalUnguidedRunsCount += runs.length;

        runs.forEach((/** @type {DashboardRunResult} */ run) => {
            if (isEarlyFailureRun(run.results)) {
                computedEarlyFailures++;
            }
            if (!isGuided && isUnguidedLeakRun(run, parsed?.guide)) {
                unguidedLeaksCount++;
            }
            const hasTools = run.guidanceToolsUsed && run.guidanceToolsUsed.length > 0;
            const hasGuides = (run.guidesUsed && run.guidesUsed.length > 0) || (run.guideUsed && typeof run.guideUsed === 'object' && run.guideUsed.guidesUsed && run.guideUsed.guidesUsed.length > 0);

            if (isGuided && hasTools) tasksWithTools.add(base);
            if (isGuided && hasGuides) tasksWithGuides.add(base);
        });
    });

    const tasksCount = baseKeys.size;
    const validPairsCount = eligibleScenarios.size;
    const exactRate = (/** @type {{ passed: number, total: number }} */ st) => st.total > 0 ? (st.passed / st.total) * 100 : 0;
    const unguidedPassRate = Math.round(exactRate(unguidedStats));
    const guidedPassRate = Math.round(exactRate(guidedStats));
    const upliftDelta = Math.round(exactRate(guidedStats) - exactRate(unguidedStats));
    const a11yUpliftPp = Math.round(
        exactRate({ passed: a11yStats.guidedPassed, total: a11yStats.guidedTotal }) -
        exactRate({ passed: a11yStats.unguidedPassed, total: a11yStats.unguidedTotal })
    );
    const fraction = (/** @type {number} */ passed, /** @type {number} */ total) => `${passed.toLocaleString()}/${total.toLocaleString()}`;
    const toolActivationRate = tasksCount > 0 ? Math.round((tasksWithTools.size / tasksCount) * 100) : 0;
    const guideUsageRate = tasksCount > 0 ? Math.round((tasksWithGuides.size / tasksCount) * 100) : 0;

    const totalEarlyFailures = (summary.unguidedEarlyFailures !== undefined || summary.guidedEarlyFailures !== undefined)
        ? (summary.unguidedEarlyFailures || 0) + (summary.guidedEarlyFailures || 0)
        : computedEarlyFailures;
    const rawRate = totalAllRunsCount > 0 ? (totalEarlyFailures / totalAllRunsCount) * 100 : 0;
    const totalEarlyFailureRate = rawRate > 0 && rawRate < 1 ? Number(rawRate.toFixed(1)) : Math.round(rawRate);
    const rawLeakRate = totalUnguidedRunsCount > 0 ? (unguidedLeaksCount / totalUnguidedRunsCount) * 100 : 0;
    const unguidedLeakRate = rawLeakRate > 0 && rawLeakRate < 1 ? Number(rawLeakRate.toFixed(1)) : Math.round(rawLeakRate);

    const a11yDimensionsHtml = A11Y_SUBCATEGORIES.map(sub => {
        const sc = a11yStats.bySubCategory?.[sub.id];
        if (!sc || (sc.unguidedTotal === 0 && sc.guidedTotal === 0)) return '';
        const dimPp = Math.round(exactRate({ passed: sc.guidedPassed, total: sc.guidedTotal }) - exactRate({ passed: sc.unguidedPassed, total: sc.unguidedTotal }));
        const deltaSign = dimPp >= 0 ? '+' : '';
        return `<div class="a11y-dim-row"> <div class="a11y-dim-header"> <span class="a11y-dim-label">${escapeHtml(sub.shortLabel)}</span> <span class="a11y-dim-values"><span class="visually-hidden">unguided </span>${sc.unguidedRate}% <span aria-hidden="true">→</span><span class="visually-hidden">guided</span> <strong>${sc.guidedRate}%</strong> <span class="a11y-dim-delta ${dimPp < 0 ? 'negative' : ''}">(${deltaSign}${dimPp} pp)</span></span> </div> ${renderSparkline(sc.unguidedRate, sc.guidedRate, true)} </div>`;
    }).join('');
    /** @param {number} deltaPct
 * @param {{ less: string, more: string, noun: string }} words */
    const deltaPill = (deltaPct, words) => {
        if (deltaPct < 0) return `<span class="efficiency-delta-pill positive"><span aria-hidden="true">▼ </span>${Math.abs(deltaPct)}% ${escapeHtml(words.less)}<span class="visually-hidden"> (${escapeHtml(words.noun)})</span></span>`;
        if (deltaPct === 0) return `<span class="efficiency-delta-pill neutral">±0%<span class="visually-hidden"> ${escapeHtml(words.noun)}, no change</span></span>`;
        return `<span class="efficiency-delta-pill neutral"><span aria-hidden="true">▲ </span>${deltaPct}% ${escapeHtml(words.more)}<span class="visually-hidden"> (${escapeHtml(words.noun)})</span></span>`;
    };
    /** @param {number} deltaPp
 * @param {string} noun */
    const ratePill = (deltaPp, noun) => {
        const cls = deltaPp > 0 ? 'positive' : (deltaPp < 0 ? 'negative' : 'neutral');
        const glyph = deltaPp > 0 ? '▲ ' : (deltaPp < 0 ? '▼ ' : '');
        return `<span class="efficiency-delta-pill ${cls}"><span aria-hidden="true">${glyph}</span>${deltaPp > 0 ? '+' : ''}${deltaPp} pp<span class="visually-hidden"> ${escapeHtml(noun)}</span></span>`;
    };
    const suiteTokSign = tok.suiteUncachedDeltaPct > 0 ? '+' : '';
    const hasRuntime = rt.unguidedMedianMs > 0 || rt.guidedMedianMs > 0;
    const hasTokens = tok.unguidedTotalMedian > 0 || tok.guidedTotalMedian > 0;
    container.innerHTML = `
        <!-- Card 1: Overall Uplift & Adoption -->
        <article class="header-meta-item dog-ear-card narrative-card">
            <div class="meta-item-header">
                <span class="meta-label">Pass rate</span>
                ${ratePill(upliftDelta, 'pass rate change')}
            </div>
            <div class="sparkline-container">
                ${renderSparkline(unguidedPassRate, guidedPassRate)}
                <span class="sparkline-labels"><span class="visually-hidden">Unguided </span>${unguidedPassRate}% <span aria-hidden="true">→</span><span class="visually-hidden">guided</span> <strong>${guidedPassRate}%</strong> <span class="narrative-subtext">(${fraction(unguidedStats.passed, unguidedStats.total)} → ${fraction(guidedStats.passed, guidedStats.total)} checks)</span></span>
            </div>
            <div class="narrative-metrics-list">
                <div class="narrative-metric-row">
                    <span>Tool activation</span>
                    <strong>${toolActivationRate}% (${tasksWithTools.size}/${tasksCount} tasks)</strong>
                </div>
                <div class="narrative-metric-row">
                    <span>Guidance consumed</span>
                    <strong>${guideUsageRate}% (${tasksWithGuides.size}/${tasksCount} tasks)</strong>
                </div>
                ${validPairsCount < tasksCount ? `<div class="narrative-metric-row"> <span>Valid task pairs</span> <strong class="text-warning">${validPairsCount} / ${tasksCount}</strong> </div>` : ''}
                <div class="narrative-metric-row narrative-note">
                    <span>Graded checks per mode differ when a run fails before grading (excluded from check totals).</span>
                </div>
                ${summary.expectedTotalRuns !== undefined ? ` <div class="narrative-metric-row"> <span>Expected runs</span> <strong>${summary.expectedTotalRuns}${summary.taskCount ? ` (${summary.taskCount} × ${summary.runCountPerTask})` : ''}</strong> </div> ` : ''}
                ${(summary.unguidedEarlyFailures !== undefined || summary.guidedEarlyFailures !== undefined || totalEarlyFailures > 0) ? `<div class="narrative-metric-row"> <span>Infra errors (excluded)</span> <strong class="${totalEarlyFailures > 0 ? 'text-warning' : 'text-success'}">${totalEarlyFailureRate}% (${totalEarlyFailures} invalid run${totalEarlyFailures === 1 ? '' : 's'})</strong> </div>` : ''}
                ${unguidedLeaksCount > 0 ? `<div class="narrative-metric-row"> <span>Unguided leaks</span> <strong class="text-leak">${unguidedLeakRate}% (${unguidedLeaksCount} run${unguidedLeaksCount === 1 ? '' : 's'})</strong> </div>` : ''}
            </div>
        </article>

        <!-- Card 2: Cross-Cutting Accessibility Subscore -->
        <article class="header-meta-item dog-ear-card narrative-card">
            <div class="meta-item-header">
                <span class="meta-label">Accessibility subscore</span>
                ${ratePill(a11yUpliftPp, 'accessibility subscore change')}
            </div>
            <div class="sparkline-container">
                ${renderSparkline(a11yStats.unguidedRate, a11yStats.guidedRate)}
                <span class="sparkline-labels"><span class="visually-hidden">Unguided </span>${a11yStats.unguidedRate}% <span aria-hidden="true">→</span><span class="visually-hidden">guided</span> <strong>${a11yStats.guidedRate}%</strong> <span class="narrative-subtext">(${fraction(a11yStats.unguidedPassed, a11yStats.unguidedTotal)} → ${fraction(a11yStats.guidedPassed, a11yStats.guidedTotal)} checks, <a href="#guide-section" class="a11y-guides-jump" data-filter-a11y-guides="true">${a11yStats.guideCount} guides <span aria-hidden="true">→</span></a>)</span></span>
            </div>
            <div class="a11y-dimensions-grid">
                ${a11yDimensionsHtml}
            </div>
        </article>

        <!-- Card 3: Completion Time (U → G) -->
        <article class="header-meta-item dog-ear-card narrative-card">
            <div class="meta-item-header">
                <span class="meta-label"><span aria-hidden="true">⏱</span> Median agent time</span>
                ${hasRuntime ? deltaPill(rt.medianDeltaPct, { less: 'faster', more: 'slower', noun: 'median agent time' }) : ''}
            </div>
            <div class="narrative-hero-pair">
                <span><span class="visually-hidden">Unguided </span>${formatDuration(rt.unguidedMedianMs)}</span>
                <span class="pair-arrow" aria-hidden="true">→</span>
                <strong><span class="visually-hidden">guided </span>${formatDuration(rt.guidedMedianMs)}</strong>
            </div>
            <div class="narrative-metrics-list">
                <div class="narrative-metric-row">
                    <span>Mean task duration</span>
                    <strong>${formatDuration(rt.unguidedMeanMs)} → ${formatDuration(rt.guidedMeanMs)}</strong>
                </div>
                <div class="narrative-metric-row">
                    <span>Tasks faster or equal</span>
                    <strong>${rt.fasterTaskPct}% (${rt.fasterTasksCount}/${rt.pairedTaskCount} tasks)</strong>
                </div>
                <div class="narrative-metric-row">
                    <span>Timed-out runs (≥10 min)</span>
                    <strong>${rt.unguidedTimeouts} unguided → ${rt.guidedTimeouts} guided</strong>
                </div>
            </div>
        </article>

        <!-- Card 4: Token Efficiency (U → G) -->
        <article class="header-meta-item dog-ear-card narrative-card">
            <div class="meta-item-header">
                <span class="meta-label"><span aria-hidden="true">🪙</span> Median uncached tokens</span>
                ${hasTokens ? deltaPill(tok.uncachedMedianDeltaPct, { less: 'fewer', more: 'more', noun: 'uncached tokens' }) : ''}
            </div>
            <div class="narrative-hero-pair">
                <span><span class="visually-hidden">Unguided </span>${formatTokens(tok.unguidedUncachedMedian)}</span>
                <span class="pair-arrow" aria-hidden="true">→</span>
                <strong><span class="visually-hidden">guided </span>${formatTokens(tok.guidedUncachedMedian)}</strong>
            </div>
            <div class="narrative-metrics-list">
                <div class="narrative-metric-row">
                    <span>Suite uncached</span>
                    <strong>${formatTokens(tok.unguidedUncachedTotal)} → ${formatTokens(tok.guidedUncachedTotal)} (${suiteTokSign}${tok.suiteUncachedDeltaPct}%)</strong>
                </div>
                <div class="narrative-metric-row">
                    <span>Suite total, incl. cache</span>
                    <strong>${formatTokens(tok.unguidedTotal)} → ${formatTokens(tok.guidedTotal)} (${tok.guidedCachedSharePct}% cached)</strong>
                </div>
                <div class="narrative-metric-row">
                    <span>Tasks with fewer or equal</span>
                    <strong>${tok.fewerUncachedTokensTaskPct}% (${tok.fewerUncachedTasksCount}/${tok.pairedTaskCount} tasks)</strong>
                </div>
            </div>
        </article>
    `;
    const jumpLink = container.querySelector('a[data-filter-a11y-guides]');
    jumpLink?.addEventListener('click', (e) => {
        e.preventDefault();
        const modeA11yBtn = document.getElementById('dash-mode-a11y-btn');
        if (modeA11yBtn instanceof HTMLElement) { modeA11yBtn.click(); }
        currentTaskSort = 'uplift';
        currentTaskSortDir = 'desc';
        const url = new URL(window.location.href);
        url.searchParams.set('sort', 'uplift-desc');
        window.history.replaceState({}, '', url);
        if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
        const guideSection = document.getElementById('guide-section');
        guideSection?.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
    });
    return extracted;
}
/** @typedef {{ appName: string, guide: string, scenarioName: string, category: string, categoryLabel: string, featureIds: string[], unguidedRuns: DashboardRunResult[] | undefined, guidedRuns: DashboardRunResult[] | undefined, unguidedAvg: number | null, guidedAvg: number | null, uplift: number | null, a11yUnguidedAvg: number | null, a11yGuidedAvg: number | null, a11yUplift: number | null, a11yCheckCount: number, uRuntimeMs: number, gRuntimeMs: number, runtimeDeltaMs: number | null, uUncachedTokens: number, gUncachedTokens: number, uncachedDeltaTokens: number | null, infraErrorCount: number, hasInfraError: boolean, hasBuildFailure: boolean, leakCount: number, hasLeak: boolean, hasFailure: boolean }} ScenarioItem */
const YIELD_BUDGET_MS = 50;
/** @returns {Promise<void>} */
function yieldToMain() {
    const scheduler = /** @type {{ scheduler?: { yield?: () => Promise<void> } }} */ (/** @type {unknown} */ (globalThis)).scheduler;
    if (scheduler?.yield) return scheduler.yield();
    return new Promise(resolve => setTimeout(resolve, 0));
}

const HINT_TEXT = {
    infra: 'Infrastructure or CLI errors stop a run before grading. Those runs are excluded from pass rates.',
    build: "The agent produced a broken app or build, so grading failed. Open the task to see each run's failure reason.",
    leak: "The unguided agent accessed Modern Web Guidance and this task's guide, so the run isn't a clean baseline.",
    invalid: 'Excluded from the rollup because one or both sides have 0 valid runs.',
};
/** @type {WeakMap<DashboardEvalsReport, Promise<ScenarioItem[]>>} */
const scenarioCache = new WeakMap();
/**
 * Built accordions for the current data, metric mode, and suite. A sort change only reorders these
 * nodes, which is cheap and keeps any panels the user already opened (and their loaded details).
 * @type {{ data: DashboardEvalsReport | null, mode: string | null, testId: string | null, nodes: Map<string, HTMLElement> }}
 */
const accordionCache = { data: null, mode: null, testId: null, nodes: new Map() };
let gridRenderSeq = 0;
/** The most recent renderGrid() call (see renderGridIdle). @type {Promise<void>} */
let latestGridRender = Promise.resolve();
/**
 * Builds the task list. A sort or mode click during a yielding render starts a newer render, and
 * the older one returns early without finishing; callers that need the finished list (deep links,
 * loading reservations) await renderGridIdle() instead of their own call.
 * @param {DashboardEvalsReport} data
 * @param {string} testId
 * @returns {Promise<void>}
 */
function renderGrid(data, testId) {
    const render = renderGridOnce(data, testId);
    latestGridRender = render;
    return render;
}

/** @returns {Promise<void>} */
async function renderGridIdle() {
    for (;;) {
        const render = latestGridRender;
        try { await render; } catch (error) { if (render === latestGridRender) throw error; continue; }
        if (render === latestGridRender) return;
    }
}
/** @param {DashboardEvalsReport} data
 * @param {string} testId */
function rerenderGrid(data, testId) {
    renderGrid(data, testId).catch((/** @type {unknown} */ error) => { console.error('Error rendering tasks:', error); });
}

/** @param {DashboardEvalsReport} data
 * @returns {Promise<ScenarioItem[]>} */
async function computeScenarios(data) {
    const results = data.results;

    // Extract dimensions dynamically from data keys
    const keys = Object.keys(results);
    const partsMap = keys.map(k => k.split(' - '));
    const validParts = partsMap.filter(p => p.length === 3);

    const sortedAppNames = [...new Set(validParts.map(p => p[0]))].sort();
    const sortedGuides = [...new Set(validParts.map(p => p[1]))].sort((a, b) => {
        const featA = window.__featuresMapping?.[a]?.[0] || '';
        const featB = window.__featuresMapping?.[b]?.[0] || '';
        if (featA !== featB) {
            return featA.localeCompare(featB);
        }
        return a.localeCompare(b);
    });

    /** @type {ScenarioItem[]} */
    const scenarios = [];

    let deadline = performance.now() + YIELD_BUDGET_MS;
    for (const appName of sortedAppNames) {
        for (const guide of sortedGuides) {
            const scenarioName = `${appName} - ${guide}`;
            const unguidedKey = `${scenarioName} - unguided`;
            const guidedKey = `${scenarioName} - guided`;

            const unguidedRuns = results[unguidedKey];
            const guidedRuns = results[guidedKey];

            if (!unguidedRuns && !guidedRuns) continue;

            /**
             * @param {DashboardRunResult[] | undefined} runs
             * @returns {{ rate: number | null, exact: number | null }}
             */
            const getAvg = (runs) => {
                if (!runs || runs.length === 0) return { rate: null, exact: null };
                const totalPassed = runs.reduce((acc, run) => acc + getRunStats(run.results).passed, 0);
                const totalChecks = runs.reduce((acc, run) => acc + getRunStats(run.results).total, 0);
                if (totalChecks <= 0) return { rate: null, exact: null };
                const exact = (totalPassed / totalChecks) * 100;
                return { rate: Math.round(exact), exact };
            };
            /** @param {DashboardRunResult[] | undefined} runs
 * @returns {{ rate: number | null, exact: number | null, count: number }} */
            const getA11yAvg = (runs) => {
                if (!runs || runs.length === 0) return { rate: null, exact: null, count: 0 };
                let passed = 0;
                let total = 0;
                let validRuns = 0;
                let maxChecksInRun = 0;
                runs.forEach(run => {
                    if (isEarlyFailureRun(run.results)) return;
                    validRuns++;
                    const s = getA11yRunStats(run.results, guide, run.discipline);
                    passed += s.passed;
                    total += s.total;
                    if (s.total > maxChecksInRun) maxChecksInRun = s.total;
                });
                if (validRuns === 0 || total === 0) {
                    return { rate: null, exact: null, count: maxChecksInRun };
                }
                const exact = (passed / total) * 100;
                return { rate: Math.round(exact), exact, count: maxChecksInRun };
            };

            /** @param {DashboardRunResult[] | undefined} runs
 * @returns {number} */
            const getAvgRuntime = (runs) => {
                if (!runs || runs.length === 0) return 0;
                let sum = 0;
                let count = 0;
                runs.forEach(r => {
                    if (isEarlyFailureRun(r.results)) return;
                    const ms = getAgentRuntimeMs(r);
                    if (ms > 0) { sum += ms; count++; }
                });
                return count > 0 ? Math.round(sum / count) : 0;
            };
            /** @param {DashboardRunResult[] | undefined} runs
 * @returns {number} */
            const getAvgUncached = (runs) => {
                if (!runs || runs.length === 0) return 0;
                let sum = 0;
                let count = 0;
                runs.forEach(r => {
                    if (isEarlyFailureRun(r.results)) return;
                    const tb = getTokenBreakdown(r.tokenUsage);
                    if (tb.total > 0) { sum += tb.uncached; count++; }
                });
                return count > 0 ? Math.round(sum / count) : 0;
            };
            const uAvgObj = getAvg(unguidedRuns);
            const gAvgObj = getAvg(guidedRuns);
            const unguidedAvg = uAvgObj.rate;
            const guidedAvg = gAvgObj.rate;
            const uplift = (uAvgObj.exact !== null && gAvgObj.exact !== null)
                ? Math.round(gAvgObj.exact - uAvgObj.exact)
                : null;
            const uA11y = getA11yAvg(unguidedRuns);
            const gA11y = getA11yAvg(guidedRuns);
            const a11yCheckCount = Math.max(uA11y.count, gA11y.count);
            const a11yUnguidedAvg = uA11y.rate;
            const a11yGuidedAvg = gA11y.rate;
            const a11yUplift = (uA11y.exact !== null && gA11y.exact !== null)
                ? Math.round(gA11y.exact - uA11y.exact)
                : null;
            const uRuntimeMs = getAvgRuntime(unguidedRuns);
            const gRuntimeMs = getAvgRuntime(guidedRuns);
            const runtimeDeltaMs = (uRuntimeMs > 0 && gRuntimeMs > 0) ? gRuntimeMs - uRuntimeMs : null;
            const uUncachedTokens = getAvgUncached(unguidedRuns);
            const gUncachedTokens = getAvgUncached(guidedRuns);
            const uncachedDeltaTokens = (uUncachedTokens > 0 && gUncachedTokens > 0) ? gUncachedTokens - uUncachedTokens : null;

            /**
             * @param {DashboardRunResult[] | undefined} runs
             * @returns {number}
             */
            const countInfraErrors = (runs) => (runs || []).filter(r => isEarlyFailureRun(r.results)).length;
            const infraErrorCount = countInfraErrors(unguidedRuns) + countInfraErrors(guidedRuns);
            const hasInfraError = infraErrorCount > 0;
            const hasBuildFailure = [...(unguidedRuns || []), ...(guidedRuns || [])].some(r => r.results?.some(c => c.failureReason));
            const leakCount = (unguidedRuns || []).filter(r => isUnguidedLeakRun(r, guide)).length;
            const hasLeak = leakCount > 0;
            const hasFailure = hasInfraError || hasBuildFailure;
            const categoryMap = await loadGuideCategoryMap();
            const category = categoryMap.get(guide) || 'other';
            const categoryLabel = formatCategoryLabel(category);
            const featuresMap = (typeof window !== 'undefined' && window.__featuresMapping) || {};
            const featureIds = Array.isArray(featuresMap[guide]) ? featuresMap[guide] : [];
            scenarios.push({
                appName,
                guide,
                scenarioName,
                category,
                categoryLabel,
                featureIds,
                unguidedRuns,
                guidedRuns,
                unguidedAvg,
                guidedAvg,
                uplift,
                a11yUnguidedAvg,
                a11yGuidedAvg,
                a11yUplift,
                a11yCheckCount,
                uRuntimeMs,
                gRuntimeMs,
                runtimeDeltaMs,
                uUncachedTokens,
                gUncachedTokens,
                uncachedDeltaTokens,
                infraErrorCount,
                hasInfraError,
                hasBuildFailure,
                leakCount,
                hasLeak,
                hasFailure
            });
            if (performance.now() >= deadline) { await yieldToMain(); deadline = performance.now() + YIELD_BUDGET_MS; }
        }
    }
    return scenarios;
}

/** @param {string} a
 * @param {string} b */
function compareCategories(a, b) {
    if (a === b) return 0;
    if (a === 'discipline') return -1;
    if (b === 'discipline') return 1;
    if (a === 'other') return 1;
    if (b === 'other') return -1;
    return formatCategoryLabel(a).localeCompare(formatCategoryLabel(b));
}

/** @param {ScenarioItem[]} baseScenarios */
function renderEvalFilterControls(baseScenarios) {
    const datalist = document.getElementById('eval-features-datalist');
    if (datalist) {
        const allFeatures = [...new Set(baseScenarios.flatMap(s => s.featureIds))].sort();
        datalist.innerHTML = allFeatures.map(f => `<option value="${escapeHtml(f)}">`).join('');
    }
    const pillsContainer = document.getElementById('eval-category-pills');
    if (pillsContainer) {
        /** @type {Map<string, number>} */
        const counts = new Map();
        for (const s of baseScenarios) {
            counts.set(s.category, (counts.get(s.category) || 0) + 1);
        }
        const categories = Array.from(counts.keys()).sort(compareCategories);
        if (currentCategoryFilter !== 'all' && !counts.has(currentCategoryFilter)) {
            currentCategoryFilter = 'all';
        }
        const pills = [
            `<button type="button" class="category-pill${currentCategoryFilter === 'all' ? ' active' : ''}" data-category="all" aria-pressed="${currentCategoryFilter === 'all'}">All <span class="pill-count">${baseScenarios.length}</span></button>`,
            ...categories.map(cat => {
                const active = currentCategoryFilter === cat;
                return `<button type="button" class="category-pill${active ? ' active' : ''}" data-category="${escapeHtml(cat)}" aria-pressed="${active}">${escapeHtml(formatCategoryLabel(cat))} <span class="pill-count">${counts.get(cat)}</span></button>`;
            })
        ];
        pillsContainer.innerHTML = pills.join('');
        pillsContainer.querySelectorAll('.category-pill').forEach(btn => {
            btn.addEventListener('click', () => {
                const cat = btn.getAttribute('data-category') || 'all';
                currentCategoryFilter = (currentCategoryFilter === cat && cat !== 'all') ? 'all' : cat;
                if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
            });
        });
    }
}

/** @returns {HTMLElement} */
function buildEvalsTableHeader() {
    const header = document.createElement('div');
    header.className = 'evals-table-header';
    const isA11yMode = currentMetricMode === 'a11y';
    /** @param {'default' | 'uplift' | 'a11y' | 'time' | 'tokens'} col
     * @param {string} label
     * @param {string} [sub] */
    const sortBtn = (col, label, sub = '') => {
        const isSorted = currentTaskSort === col && col !== 'default';
        const arrow = isSorted ? (currentTaskSortDir === 'asc' ? ' ↑' : ' ↓') : '';
        const ariaSort = isSorted ? (currentTaskSortDir === 'asc' ? 'ascending' : 'descending') : 'none';
        return `<button type="button" class="eval-col-sort-btn${isSorted ? ' active' : ''}" data-sort="${col}" aria-sort="${ariaSort}"><span>${label}${arrow}</span>${sub ? `<span class="eval-col-sub">${sub}</span>` : ''}</button>`;
    };
    header.innerHTML = `
        <div class="eval-col-task">${sortBtn('default', 'Guide / Task')}</div>
        ${isA11yMode ? '' : `<div class="eval-col-a11y">${sortBtn('a11y', 'A11y')}</div>`}
        <div class="eval-col-time">${sortBtn('time', 'Time', 'Unguided / Guided')}</div>
        <div class="eval-col-tokens">${sortBtn('tokens', 'Tokens', 'Unguided / Guided')}</div>
        <div class="eval-col-dumbbell"><span>Pass rate</span><span class="eval-col-sub">Unguided → Guided</span></div>
        <div class="eval-col-uplift">${sortBtn('uplift', 'Uplift')}</div>
    `;
    header.querySelectorAll('.eval-col-sort-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const col = /** @type {'default' | 'uplift' | 'a11y' | 'time' | 'tokens'} */ (btn.getAttribute('data-sort') || 'default');
            if (col === 'default') {
                currentTaskSort = 'default';
                currentTaskSortDir = 'desc';
            } else if (currentTaskSort === col) {
                currentTaskSortDir = currentTaskSortDir === 'desc' ? 'asc' : 'desc';
            } else {
                currentTaskSort = col;
                currentTaskSortDir = (col === 'time' || col === 'tokens') ? 'asc' : 'desc';
            }
            const url = new URL(window.location.href);
            if (currentTaskSort === 'default') {
                url.searchParams.delete('sort');
            } else {
                url.searchParams.set('sort', `${currentTaskSort}-${currentTaskSortDir}`);
            }
            window.history.replaceState({}, '', url);
            if (allTestData && currentTestID) { rerenderGrid(allTestData, currentTestID); }
        });
    });
    return header;
}

/** @param {DashboardEvalsReport} data
 * @param {string} testId */
async function renderGridOnce(data, testId) {
    const seq = ++gridRenderSeq;
    const guideGrid = document.getElementById('guide-grid') || document.getElementById('dashboard-grid');
    let scenariosPromise = scenarioCache.get(data);
    if (!scenariosPromise) {
        scenariosPromise = computeScenarios(data);
        scenarioCache.set(data, scenariosPromise);
        scenariosPromise.catch(() => scenarioCache.delete(data));
    }
    const scenarios = await scenariosPromise;
    if (seq !== gridRenderSeq) return;
    const baseScenarios = currentMetricMode === 'a11y'
        ? scenarios.filter(s => s.a11yCheckCount > 0)
        : scenarios.slice();
    renderEvalFilterControls(baseScenarios);

    const filteredScenarios = baseScenarios.filter(s => {
        if (currentCategoryFilter !== 'all' && s.category !== currentCategoryFilter) return false;
        if (currentTextFilter) {
            const hay = `${s.guide} ${s.appName} ${s.categoryLabel} ${s.featureIds.join(' ')}`.toLowerCase();
            if (!hay.includes(currentTextFilter)) return false;
        }
        if (currentFeatureFilter) {
            if (!s.featureIds.some(f => f.toLowerCase().includes(currentFeatureFilter))) return false;
        }
        return true;
    });

    const countEl = document.getElementById('evals-count');
    if (countEl) {
        countEl.textContent = filteredScenarios.length === baseScenarios.length
            ? `${baseScenarios.length} evals`
            : `${filteredScenarios.length} of ${baseScenarios.length} evals`;
    }
    const sortResetBtn = document.getElementById('eval-sort-reset');
    if (sortResetBtn) {
        sortResetBtn.hidden = currentTaskSort === 'default';
    }

    const dir = currentTaskSortDir === 'asc' ? 1 : -1;
    if (currentTaskSort === 'uplift') {
        filteredScenarios.sort((a, b) => {
            const av = currentMetricMode === 'a11y' ? a.a11yUplift : a.uplift;
            const bv = currentMetricMode === 'a11y' ? b.a11yUplift : b.uplift;
            if (av === null && bv === null) return 0;
            if (av === null) return 1;
            if (bv === null) return -1;
            return (av - bv) * dir;
        });
    } else if (currentTaskSort === 'a11y') {
        filteredScenarios.sort((a, b) => {
            if (a.a11yCheckCount === 0 && b.a11yCheckCount === 0) return 0;
            if (a.a11yCheckCount === 0) return 1;
            if (b.a11yCheckCount === 0) return -1;
            return ((a.a11yUplift ?? -999) - (b.a11yUplift ?? -999)) * dir || (b.a11yCheckCount - a.a11yCheckCount);
        });
    } else if (currentTaskSort === 'time') {
        filteredScenarios.sort((a, b) => {
            if (a.runtimeDeltaMs === null && b.runtimeDeltaMs === null) return 0;
            if (a.runtimeDeltaMs === null) return 1;
            if (b.runtimeDeltaMs === null) return -1;
            return (a.runtimeDeltaMs - b.runtimeDeltaMs) * dir;
        });
    } else if (currentTaskSort === 'tokens') {
        filteredScenarios.sort((a, b) => {
            if (a.uncachedDeltaTokens === null && b.uncachedDeltaTokens === null) return 0;
            if (a.uncachedDeltaTokens === null) return 1;
            if (b.uncachedDeltaTokens === null) return -1;
            return (a.uncachedDeltaTokens - b.uncachedDeltaTokens) * dir;
        });
    } else {
        filteredScenarios.sort((a, b) => compareCategories(a.category, b.category) || a.guide.localeCompare(b.guide) || a.appName.localeCompare(b.appName));
    }

    sortedScenarios = filteredScenarios.map(item => item.scenarioName);
    const cacheKeyMode = `${currentMetricMode}|${currentTaskSort === 'default' ? 'grouped' : 'flat'}`;
    if (accordionCache.data !== data || accordionCache.mode !== cacheKeyMode || accordionCache.testId !== testId) {
        accordionCache.data = data;
        accordionCache.mode = cacheKeyMode;
        accordionCache.testId = testId;
        accordionCache.nodes = new Map();
    }
    if (!guideGrid) return;
    guideGrid.classList.toggle('is-a11y-mode', currentMetricMode === 'a11y');
    guideGrid.replaceChildren();
    guideGrid.append(buildEvalsTableHeader());

    if (filteredScenarios.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'evals-empty-state';
        empty.textContent = 'No matching evals.';
        guideGrid.append(empty);
        return;
    }

    let fragment = document.createDocumentFragment();
    let deadline = performance.now() + YIELD_BUDGET_MS;

    if (currentTaskSort === 'default' && currentCategoryFilter === 'all') {
        /** @type {Map<string, ScenarioItem[]>} */
        const byCat = new Map();
        for (const item of filteredScenarios) {
            const list = byCat.get(item.category) || [];
            list.push(item);
            byCat.set(item.category, list);
        }
        for (const [cat, items] of byCat.entries()) {
            const section = document.createElement('div');
            section.className = 'eval-category-section';
            if (collapsedCategories.has(cat)) section.classList.add('collapsed');
            const validUplifts = items
                .map(i => currentMetricMode === 'a11y' ? i.a11yUplift : i.uplift)
                .filter((/** @type {number | null} */ v) => v !== null);
            const avgUplift = validUplifts.length > 0
                ? Math.round(validUplifts.reduce((sum, v) => sum + v, 0) / validUplifts.length)
                : null;
            const catHeader = document.createElement('button');
            catHeader.type = 'button';
            catHeader.className = 'eval-category-header';
            catHeader.setAttribute('aria-expanded', collapsedCategories.has(cat) ? 'false' : 'true');
            catHeader.innerHTML = `
                <span class="eval-category-title"><span class="chevron" aria-hidden="true">▼</span> ${escapeHtml(formatCategoryLabel(cat))}</span>
                <span class="eval-category-meta">${items.length} ${items.length === 1 ? 'eval' : 'evals'}${avgUplift !== null ? ` · <strong class="${avgUplift > 0 ? 'positive' : avgUplift < 0 ? 'negative' : ''}">${avgUplift >= 0 ? '+' : ''}${avgUplift} pp avg</strong>` : ''}</span>
            `;
            const body = document.createElement('div');
            body.className = 'eval-category-body';
            catHeader.addEventListener('click', () => {
                const isCollapsed = section.classList.toggle('collapsed');
                if (isCollapsed) collapsedCategories.add(cat); else collapsedCategories.delete(cat);
                catHeader.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            });
            for (const item of items) {
                let accordion = accordionCache.nodes.get(item.scenarioName);
                if (!accordion) { accordion = buildAccordion(item, testId); accordionCache.nodes.set(item.scenarioName, accordion); }
                body.append(accordion);
            }
            section.append(catHeader, body);
            fragment.append(section);
            if (performance.now() >= deadline) {
                guideGrid.append(fragment);
                await yieldToMain();
                if (seq !== gridRenderSeq) return;
                fragment = document.createDocumentFragment();
                deadline = performance.now() + YIELD_BUDGET_MS;
            }
        }
    } else {
        for (const item of filteredScenarios) {
            let accordion = accordionCache.nodes.get(item.scenarioName);
            if (!accordion) { accordion = buildAccordion(item, testId); accordionCache.nodes.set(item.scenarioName, accordion); }
            fragment.append(accordion);
            if (performance.now() >= deadline) {
                guideGrid.append(fragment);
                await yieldToMain();
                if (seq !== gridRenderSeq) return;
                fragment = document.createDocumentFragment();
                deadline = performance.now() + YIELD_BUDGET_MS;
            }
        }
    }
    guideGrid.append(fragment);
}

/** @param {ScenarioItem} item
 * @param {string} testId
 * @returns {HTMLElement} */
function buildAccordion(item, testId) {
    const {
        appName, guide, scenarioName, categoryLabel, featureIds, unguidedRuns, guidedRuns,
        unguidedAvg, guidedAvg, uplift,
        a11yUnguidedAvg, a11yGuidedAvg, a11yUplift, a11yCheckCount,
        uRuntimeMs, gRuntimeMs, uUncachedTokens, gUncachedTokens,
        infraErrorCount, hasInfraError, hasBuildFailure, leakCount, hasFailure
    } = item;
    const displayU = currentMetricMode === 'a11y' ? a11yUnguidedAvg : unguidedAvg;
    const displayG = currentMetricMode === 'a11y' ? a11yGuidedAvg : guidedAvg;
    const displayUplift = currentMetricMode === 'a11y' ? a11yUplift : uplift;
    const displayValidPair = displayU !== null && displayG !== null;
    const accordion = document.createElement('div');
    accordion.className = 'task-accordion';
    accordion.id = `item-${scenarioName.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}`;
    accordion.setAttribute('data-guide', guide);
    accordion.setAttribute('data-task', appName);
    const minVal = Math.min(displayU ?? 0, displayG ?? 0);
    const maxVal = Math.max(displayU ?? 0, displayG ?? 0);
    const scale = (/** @type {number} */ val) => `${val}%`;
    const modeParam = currentMetricMode === 'a11y' ? '&mode=a11y' : '';
    const trendUrl = `guide.html?guide=${encodeURIComponent(guide)}&task=${encodeURIComponent(appName)}&testId=${encodeURIComponent(testId)}&source=${encodeURIComponent(api.source)}${modeParam}`;
    const appSuffixHtml = appName && appName !== 'daily-grind'
        ? ` <span class="task-app-tag">(${escapeHtml(appName)})</span>`
        : '';
    const trendLinkHtml = `<a href="${trendUrl}" class="trend-link" aria-label="View trend over time for ${escapeHtml(guide)} (${escapeHtml(appName)})"> <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"> <line x1="7" y1="17" x2="17" y2="7"></line> <polyline points="7 7 17 7 17 17"></polyline> </svg> </a>`;
    const primaryFeatureId = featureIds[0] || '';
    const featureChipHtml = primaryFeatureId && primaryFeatureId !== guide
        ? `<span class="feature-chip">${escapeHtml(primaryFeatureId)}</span>`
        : '';
    const rowCategoryHtml = currentTaskSort !== 'default'
        ? `<span class="row-category-tag">${escapeHtml(categoryLabel)}</span>`
        : '';
    const a11yColHtml = currentMetricMode === 'a11y' ? '' : (
        a11yCheckCount > 0
            ? `<div class="task-a11y-col"><span class="visually-hidden">Accessibility checks: ${a11yCheckCount} checks, unguided ${a11yUnguidedAvg}%, guided ${a11yGuidedAvg}%, change </span><span class="metric-before">${a11yCheckCount} ${a11yCheckCount === 1 ? 'check' : 'checks'}</span><span class="metric-after ${a11yUplift !== null && a11yUplift > 0 ? 'positive' : a11yUplift !== null && a11yUplift < 0 ? 'negative' : ''}">${a11yUplift !== null ? `${a11yUplift >= 0 ? '+' : ''}${a11yUplift} pp` : '—'}</span></div>`
            : `<div class="task-a11y-col"><span class="metric-empty">—</span></div>`
    );
    const hasRuntime = uRuntimeMs > 0 || gRuntimeMs > 0;
    const hasTokens = uUncachedTokens > 0 || gUncachedTokens > 0;
    const timeColHtml = hasRuntime
        ? `<div class="task-metric-stack"><span class="visually-hidden">Average completion time, unguided to guided: </span><span class="metric-before">${formatDuration(uRuntimeMs)}</span><span class="metric-after">${formatDuration(gRuntimeMs)}</span></div>`
        : '<div class="task-metric-stack"><span class="metric-empty">—</span></div>';
    const tokensColHtml = hasTokens
        ? `<div class="task-metric-stack"><span class="visually-hidden">Average uncached tokens, unguided to guided: </span><span class="metric-before">${formatTokens(uUncachedTokens)}</span><span class="metric-after">${formatTokens(gUncachedTokens)}</span></div>`
        : '<div class="task-metric-stack"><span class="metric-empty">—</span></div>';
    const contentId = `${accordion.id}-content`;
    /** @type {string[]} */
    const hintPopovers = [];
    /** @param {string} kind
 * @param {string} className
 * @param {string} label
 * @param {string} hintText */
    const hintButton = (kind, className, label, hintText) => {
        const hintId = `${accordion.id}-hint-${kind}`;
        hintPopovers.push(`<div id="${hintId}" popover="hint" class="hint-popover" style="position-anchor: --${hintId};">${escapeHtml(hintText)}</div>`);
        return `<button type="button" class="${className ? `${className} ` : ''}hint-trigger" interestfor="${hintId}" style="anchor-name: --${hintId};">${escapeHtml(label)}</button>`;
    };
    const infraBadgeHtml = hasInfraError
        ? hintButton('infra', 'generation-failed-badge infra-error-badge', `${infraErrorCount} Infra Error${infraErrorCount === 1 ? '' : 's'}`, HINT_TEXT.infra)
        : '';
    const buildBadgeHtml = hasBuildFailure
        ? hintButton('build', 'generation-failed-badge', 'Build Failed', HINT_TEXT.build)
        : '';
    const leakBadgeHtml = leakCount > 0
        ? hintButton('leak', 'generation-failed-badge leak-badge', leakCount > 1 ? `${leakCount} Unguided Leaks` : 'Unguided Leak', HINT_TEXT.leak)
        : '';
    const invalidBadgeHtml = displayUplift === null
        ? hintButton('invalid', '', 'INVALID', HINT_TEXT.invalid)
        : '';
    const badgesHtml = [featureChipHtml, rowCategoryHtml, infraBadgeHtml, buildBadgeHtml, leakBadgeHtml].filter(Boolean).join('');
    accordion.innerHTML = ` <div class="task-accordion-header"> <div class="left-section"> <div class="task-title-row"> <h3 class="task-accordion-heading"> <button type="button" class="task-toggle" aria-expanded="false" aria-controls="${contentId}"> <span class="chevron" aria-hidden="true">▶</span>
                        <span class="task-title${hasFailure ? ' has-failure' : ''}">${escapeHtml(guide)}${appSuffixHtml}</span>
                    </button>
                </h3>
                ${trendLinkHtml}
            </div>
            ${badgesHtml ? `<div class="task-badges-row">${badgesHtml}</div>` : ''}
            </div>
            ${a11yColHtml}
            ${timeColHtml}
            ${tokensColHtml}
            <div class="mini-dumbbell-track" aria-hidden="true">
                ${displayValidPair ? `<div class="connector${displayUplift !== null && displayUplift < 0 ? ' regressed' : ''}" style="left: ${scale(minVal)}; width: ${scale(maxVal - minVal)};"></div>` : ''}
                ${displayU !== null ? `<div class="dot unguided" style="left: ${scale(displayU)};"></div>` : ''}
                ${displayG !== null ? `<div class="dot guided" style="left: ${scale(displayG)};"></div>` : ''}
            </div>
            ${displayUplift !== null ? `<div class="uplift-score ${displayUplift < 0 ? 'negative' : (displayUplift === 0 ? 'flat' : '')}"> <span class="visually-hidden">Unguided ${displayU}%, guided ${displayG}%, change </span>${displayUplift >= 0 ? '+' : ''}${displayUplift} pp </div>` : ` <div class="uplift-score invalid"> ${invalidBadgeHtml}
            </div>
            `} </div> <div class="task-accordion-content" id="${contentId}" hidden="until-found"> <div class="task-accordion-body"> <div class="task-details-grid"> <div class="task-prompt-slot"><div class="expansion-loading">Loading details...</div></div> ${buildTruthMatrixHtml(scenarioName, unguidedRuns, guidedRuns)}
                </div>
            </div>
        </div>
        ${hintPopovers.join('')}
    `;

    const header = $('.task-accordion-header', accordion);
    const toggleBtn = $('.task-toggle', accordion);
    const content = $('.task-accordion-content', accordion);

    const toggleAccordion = async () => {
        const isOpen = accordion.classList.toggle('open');
        toggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        if (isOpen) { content.removeAttribute('hidden'); } else { content.setAttribute('hidden', 'until-found'); }

        if (isOpen && content.querySelector('.expansion-loading') && content.dataset.loading !== 'true') {
            content.dataset.loading = 'true';
            try { await fillAccordionDetails(content, scenarioName, unguidedRuns, guidedRuns, testId); } finally { delete content.dataset.loading; }
        }
    };
    content.addEventListener('beforematch', () => {
        if (!accordion.classList.contains('open')) { toggleAccordion(); }
    });

    header.addEventListener('click', (e) => { const target = e.target; if (target instanceof Element && target.closest('a, .hint-trigger')) return; toggleAccordion(); });
    return accordion;
}
/** @param {string} scenarioName
 * @param {DashboardRunResult[] | undefined} unguidedRuns
 * @param {DashboardRunResult[] | undefined} guidedRuns
 * @returns {string} */
function buildTruthMatrixHtml(scenarioName, unguidedRuns, guidedRuns) {
    const sampleRun = (unguidedRuns && unguidedRuns[0]) || (guidedRuns && guidedRuns[0]);
    const maxUnguided = unguidedRuns ? unguidedRuns.length : 0;
    const maxGuided = guidedRuns ? guidedRuns.length : 0;
    const maxRuns = Math.max(maxUnguided, maxGuided);
    const assertionMap = new Map();
    /** @param {import('../harness/lib/metrics.ts').RunResult[] | undefined} runs
 * @param {'unguided' | 'guided'} type */
    const processResultsToMap = (runs, type) => {
        if (!runs) return;
        runs.forEach((run, runIndex) => {
            if (run && run.results) {
                run.results.forEach(check => {
                    if (check.isEarlyFailure) return;
                    const existing = assertionMap.get(check.message) || {
                        unguided: [],
                        guided: [],
                        error: null,
                        errorLocation: null,
                        pageSnapshot: null,
                        browserErrors: null,
                    };
                    existing[type][runIndex] = check.passed;
                    if (!check.passed) {
                        if (check.error) existing.error = check.error;
                        if (check.errorLocation) existing.errorLocation = check.errorLocation;
                        if (check.pageSnapshot) existing.pageSnapshot = check.pageSnapshot;
                        if (check.browserErrors) existing.browserErrors = check.browserErrors;
                    }
                    assertionMap.set(check.message, existing);
                });
            }
        });
    };
    processResultsToMap(unguidedRuns, 'unguided');
    processResultsToMap(guidedRuns, 'guided');
    /** @param {import('../harness/lib/metrics.ts').RunResult[] | undefined} runs */
    const isRunEarlyFailure = (runs) => runs && runs.some(r => isEarlyFailureRun(r.results));
    const uFailed = isRunEarlyFailure(unguidedRuns);
    const gFailed = isRunEarlyFailure(guidedRuns);
    const scenarioGuide = parseResultKey(`${scenarioName} - unguided`)?.guide || '';
    let truthMatrixHtml = `<div class="truth-matrix-wrap" role="region" aria-label="Assertion results for ${escapeHtml(scenarioName)}" tabindex="0"><table class="truth-matrix"><caption class="visually-hidden">Grader assertion results for ${escapeHtml(scenarioName)}, unguided vs. guided</caption><thead>`;
    if (maxRuns > 1) {
        truthMatrixHtml += `<tr> <th scope="colgroup" class="center${uFailed ? ' text-warning' : ''}" colspan="${maxRuns}">Unguided</th> <th scope="colgroup" class="center${gFailed ? ' text-warning' : ''}" colspan="${maxRuns}">Guided</th> <th scope="col" rowspan="2">Assertion Requirement</th> </tr> <tr>`;
        for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th scope="col" class="center">#${i+1}</th>`;
        for (let i = 0; i < maxRuns; i++) truthMatrixHtml += `<th scope="col" class="center">#${i+1}</th>`;
        truthMatrixHtml += `</tr>`;
    } else {
        truthMatrixHtml += `<tr> <th scope="col" class="center${uFailed ? ' text-warning' : ''}">Unguided</th> <th scope="col" class="center${gFailed ? ' text-warning' : ''}">Guided</th> <th scope="col">Assertion Requirement</th> </tr>`;
    }
    truthMatrixHtml += `</thead><tbody>`;

    const guideName = scenarioGuide || scenarioName.split(' - ')[1] || '';
    if (assertionMap.size === 0) {
        const totalCols = maxRuns > 1 ? (maxRuns * 2 + 1) : 3;
        truthMatrixHtml += `<tr><td colspan="${totalCols}" class="center text-warning">No grader assertions recorded (all runs encountered infrastructure errors before grading).</td></tr>`;
    }

    const passSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg><span class="visually-hidden">Pass</span>';
    const failSvg = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle;" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg><span class="visually-hidden">Fail</span>';
    const passCell = (/** @type {boolean | undefined} */ pass) => `<td class="center ${pass !== undefined ? (pass ? 'pass' : 'fail') : ''}">${pass !== undefined ? (pass ? passSvg : failSvg) : '-'}</td>`;
    assertionMap.forEach((status, message) => {
        const a11yInfo = classifyAccessibilityCheck(sampleRun?.discipline || '', guideName, message);
        const subCatMeta = a11yInfo.subCategory ? A11Y_SUBCATEGORY_MAP[a11yInfo.subCategory] : null;
        const a11yBadge = a11yInfo.isAccessibility && subCatMeta
            ? ` <span class="a11y-check-badge">A11y · ${escapeHtml(subCatMeta.shortLabel)}</span>`
            : '';
        truthMatrixHtml += `<tr class="${a11yInfo.isAccessibility ? 'a11y-assertion-row' : ''}">`;
        for (let i = 0; i < maxRuns; i++) truthMatrixHtml += passCell(status.unguided[i]);
        for (let i = 0; i < maxRuns; i++) truthMatrixHtml += passCell(status.guided[i]);
        let diagnosticsHtml = '';
        if (status.error) {
            const loc = status.errorLocation ? ` <span class="assertion-error-loc">(${escapeHtml(status.errorLocation)})</span>` : '';
            diagnosticsHtml += `<div class="assertion-error">${escapeHtml(status.error.length > 300 ? status.error.substring(0, 300) + '...' : status.error)}${loc}</div>`;
        }
        if (status.pageSnapshot) {
            diagnosticsHtml += `<details class="assertion-diagnostic"><summary>Page Snapshot</summary><pre>${escapeHtml(status.pageSnapshot)}</pre></details>`;
        }
        if (status.browserErrors) {
            diagnosticsHtml += `<details class="assertion-diagnostic browser-errors"><summary>Browser Errors</summary><pre>${escapeHtml(status.browserErrors)}</pre></details>`;
        }
        truthMatrixHtml += `<td> ${escapeHtml(message)}${a11yBadge} ${diagnosticsHtml} </td></tr>`;
    });
    truthMatrixHtml += '</tbody></table></div>';
    return truthMatrixHtml;
}

/**
 * @param {HTMLElement} container
 * @param {string} scenarioName
 * @param {DashboardRunResult[] | undefined} unguidedRuns
 * @param {DashboardRunResult[] | undefined} guidedRuns
 * @param {string} testId
 */
async function fillAccordionDetails(container, scenarioName, unguidedRuns, guidedRuns, testId) {
    try {
        let promptHtml = '<div style="color: var(--text-secondary); margin-bottom: 20px;">Prompt fetch deferred or failed.</div>';
        let baseApp = 'n/a';

        // Fetch prompt from the first run (unguided or guided)
        const sampleRun = (unguidedRuns && unguidedRuns[0]) || (guidedRuns && guidedRuns[0]);
        if (sampleRun && sampleRun.taskName) {
            try {
                const typeLabel = (unguidedRuns && unguidedRuns[0]) ? 'unguided' : 'guided';
                const paths = await getResultPaths(testId, sampleRun, `${scenarioName} - ${typeLabel}`);
                if (!paths) return;
                const { usedBasePath } = paths;

                let promptText = '';
                try {
                    const runScriptText = await api.getFileText(`${usedBasePath}/run.mjs`);
                    const match = runScriptText.match(/\.\.\.\[([\s\S]+?)\]/);
                    if (match) {
                        const arrayStr = `[${match[1]}]`;
                        const arr = JSON.parse(arrayStr);
                        promptText = arr[1];
                        const baseAppPath = arr[4];
                        if (baseAppPath) baseApp = sampleRun.baseApp || baseAppPath.split('/').pop();
                    }
                } catch (e) {
                    console.log('Falling back to living guide file:', e);
                }

                // Fallback to HEAD guide if run.mjs parsing fails
                if (!promptText) {
                    const isNegative = sampleRun.taskName.endsWith('-negative');
                    const taskPath = `tasks/${isNegative ? 'negative/' : ''}${sampleRun.taskName}.md`;
                    const text = await api.getFileText(taskPath);

                    const frontmatterMatch = text.match(/^---([\s\S]+?)---/);
                    if (frontmatterMatch) {
                        const yaml = frontmatterMatch[1];
                        const baseAppMatch = yaml.match(/base_app:\s*([^\n\r]+)/);
                        if (baseAppMatch) baseApp = baseAppMatch[1].trim();
                    }
                    promptText = text.replace(/^---[\s\S]+?---\n+/, '');
                }

                promptHtml = `
                    <div class="task-prompt-container">
                        <div class="task-prompt-meta">
                            <span class="task-prompt-meta-label">Base App:</span>
                            <span class="task-prompt-meta-value">${escapeHtml(baseApp)}</span>
                        </div>
                        <div class="task-prompt-quote">
                            <div class="quote-icon">“</div>
                            <p class="task-prompt-text">${formatPromptText(promptText)}</p>
                        </div>
                    </div>
                `;
            } catch (e) {
                console.log('Task prompt fetch failed:', e);
            }
        }

        const maxUnguided = unguidedRuns ? unguidedRuns.length : 0;
        const maxGuided = guidedRuns ? guidedRuns.length : 0;
        const maxRuns = Math.max(maxUnguided, maxGuided);
        const scenarioGuide = parseResultKey(`${scenarioName} - unguided`)?.guide || '';


        // Compute run cards for separate horizontal grid
        // Compute column chips for the footer transposed layout (Percent + Traj + Diff Table + Log)
        /**
         * @param {string} g
         * @param {DashboardRunResult} run
         */
        const renderGuideChip = (g, run) => {
            const isExpectedGuide = g === run.guideName;
            const hasExpectedPrefix = run.expectedToolPrefixes && run.expectedToolPrefixes.some((/** @type {string} */ p) => g.startsWith(p));
            const isGreen = isExpectedGuide || hasExpectedPrefix;
            const className = isGreen ? 'matching-guide' : 'default-guide';
            const style = 'padding: 2px 4px; border-radius: 4px; font-family: monospace; text-decoration: none;';

            const url = `guide.html?guide=${encodeURIComponent(g)}&testId=${encodeURIComponent(testId)}&source=${encodeURIComponent(api.source)}`;
            return `<a href="${url}" class="${className}" style="${style}">${escapeHtml(g)}<span class="visually-hidden"> (view guide trend)</span></a>`;
        };

        /**
         * @param {DashboardRunResult[] | undefined} runs
         * @param {string} typeLabel
         */
        const getTfootChips = async (runs, typeLabel) => {
             const chips = [];
             for (let i = 0; i < maxRuns; i++) {
                 if (!runs || i >= runs.length) {
                     chips.push('-');
                     continue;
                 }
                 const run = runs[i];
                 const s = getRunStats(run.results);
                 const paths = await getResultPaths(testId, run, `${scenarioName} - ${typeLabel.toLowerCase()}`);
                 if (!paths) {
                     chips.push('-');
                     continue;
                 }
                 const { setupPath, resultPath, usedBasePath } = paths;
                 /** @type {string[]} */
                 let files = [];
                 try { files = (await api.getRunFiles(usedBasePath)) || []; } catch (e) {}
                 if (files.length === 0) files = run.files || [];

                 const patchFile = files.includes('agent.patch') ? 'agent.patch' : null;
                 const sessionFile = files.find(f => f.startsWith('session-') && f.endsWith('.html'));
                 const logFile = files.includes('mcp-server.log') ? 'mcp-server.log' : (files.includes('modern-web.log') ? 'modern-web.log' : null);
                 const jsonFile = files.find(f => f.endsWith('_results.json'));
                 const runtimeFile = files.includes('runtime.json') ? 'runtime.json' : null;
                 const isEarlyFailure = isEarlyFailureRun(run.results);
                 const isLeak = typeLabel === 'Unguided' && isUnguidedLeakRun(run, scenarioGuide);
                 const earlyFailureMsg = isEarlyFailure ? (run.results?.find(c => c.isEarlyFailure)?.message || 'Infrastructure Error') : '';
                 const buildFailureReason = !isEarlyFailure ? (run.results?.find(c => c.failureReason)?.failureReason || '') : '';
                 const failureFile = isEarlyFailure ? (files.includes('generation_failed.json') ? 'generation_failed.json' : (files.includes('agent_stderr.log') ? 'agent_stderr.log' : null)) : null;
                 const isLocalServer = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                 const appUrl = (api.source === 'remote' && !isLocalServer)
                     ? `https://storage.mtls.cloud.google.com/guidance-evals/${resultPath.split('?')[0]}`
                      : api.getAbsoluteUrl ? api.getAbsoluteUrl(resultPath) : `${usedBasePath}/index.html`;

                 const taskRuntime = getAgentRuntimeMs(run) || null;
                 const tb = getTokenBreakdown(run.tokenUsage);

                 chips.push(`
                     <div class="tfoot-chip">
                         ${isEarlyFailure
                             ? `<details class="tfoot-chip-details"><summary class="tfoot-chip-error">ERROR</summary><p class="tfoot-chip-msg">${escapeHtml(earlyFailureMsg)}</p></details>`
                             : `<span class="tfoot-chip-rate" style="--rate-color: ${getColor(s.rate)};">${s.rate}%</span>`
                         }
                         ${isLeak ? `<span class="run-chip-leak">Unguided Leak<span class="visually-hidden">: accessed modern-web-guidance and ${escapeHtml(scenarioGuide)}</span></span>` : ''}
                         ${buildFailureReason ? `<details class="tfoot-chip-details"><summary class="tfoot-chip-build-failed">Build Failed</summary><p class="tfoot-chip-msg">${escapeHtml(buildFailureReason)}</p></details>` : ''}
                         ${taskRuntime ? `<span class="run-chip-meta"><span class="visually-hidden">Agent time: </span>${formatDuration(taskRuntime)}</span>` : ''}
                         ${tb.total > 0 ? `<span class="run-chip-meta small">${formatTokens(tb.uncached)} uncached<span class="visually-hidden">, ${tb.total.toLocaleString()} total, ${tb.cachedPct}% cached</span></span>` : ''}
                         <div class="tfoot-chip-actions">
                             ${sessionFile ? `<button type="button" class="tfoot-action-btn" data-action="trajectory" data-base-path="${escapeHtml(usedBasePath)}" data-session-file="${escapeHtml(sessionFile)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg> Traj</button>` : ''}
                             ${patchFile ? `<button type="button" class="tfoot-action-btn" data-action="content" data-file-name="${escapeHtml(`${usedBasePath}/${patchFile}`)}" data-file-path="${escapeHtml(`${usedBasePath}/${patchFile}`)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5V13c0 .1.03.18.08.25L7.33 8 2.08 2.75A.5.5 0 0 0 2.5 2zm11 11a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.85-.35L7.83 8l5.32 5.32c.07.07.13.1.18.12l.17.06zM7.5 9.41l-.91-.91L7.5 7.59l.91.91-.91.91z"/></svg> Diff</button>` : `<button type="button" class="tfoot-action-btn" data-action="diff" data-setup-path="${escapeHtml(setupPath)}" data-result-path="${escapeHtml(resultPath)}" data-scenario-name="${escapeHtml(scenarioName)}" data-run-number="${run.runNumber}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M1 2.5A1.5 1.5 0 0 1 2.5 1h11A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11zM2.5 2a.5.5 0 0 0-.5.5V13c0 .1.03.18.08.25L7.33 8 2.08 2.75A.5.5 0 0 0 2.5 2zm11 11a.5.5 0 0 0 .5-.5V2.5a.5.5 0 0 0-.85-.35L7.83 8l5.32 5.32c.07.07.13.1.18.12l.17.06zM7.5 9.41l-.91-.91L7.5 7.59l.91.91-.91.91z"/></svg> Diff</button>`}
                             <button type="button" class="tfoot-action-btn" data-action="app" data-app-url="${escapeHtml(appUrl)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M14 11v3h-12v-12h3v-1h-4v14h14v-4h-1zm-4-10v1h3.3l-5.6 5.6.7.7 5.6-5.6v3.3h1v-5h-5z"/></svg> App</button>
                             ${jsonFile ? `<button type="button" class="tfoot-action-btn" data-action="content" data-file-name="${escapeHtml(`${usedBasePath}/${jsonFile}`)}" data-file-path="${escapeHtml(`${usedBasePath}/${jsonFile}`)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M4.5 2A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 11.5 2h-7zm0 1h7a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5z"/><path d="M4.5 5.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5zm0 3a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z"/></svg> JSON</button>` : ''}
                             ${runtimeFile ? `<button type="button" class="tfoot-action-btn" data-action="content" data-file-name="${escapeHtml(`${usedBasePath}/${runtimeFile}`)}" data-file-path="${escapeHtml(`${usedBasePath}/${runtimeFile}`)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/><path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/></svg> Runtime</button>` : ''}
                             ${logFile ? `<button type="button" class="tfoot-action-btn" data-action="content" data-file-name="${escapeHtml(`${usedBasePath}/${logFile}`)}" data-file-path="${escapeHtml(`${usedBasePath}/${logFile}`)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2.5 1.5A1.5 1.5 0 0 1 4 0h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V1.5zM4 1a.5.5 0 0 0-.5.5V14a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V1.5a.5.5 0 0 0-.5-.5H4z"/><path fill-rule="evenodd" d="M4 4.5h5v1H4v-1zm0 2h8v1H4v-1zm0 2h8v1H4v-1z"/></svg> Log</button>` : ''}
                             ${failureFile ? `<button type="button" class="tfoot-action-btn" data-action="content" data-file-name="${escapeHtml(`${usedBasePath}/${failureFile}`)}" data-file-path="${escapeHtml(`${usedBasePath}/${failureFile}`)}"><svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path fill-rule="evenodd" d="M2.5 1.5A1.5 1.5 0 0 1 4 0h8a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H4a1.5 1.5 0 0 1-1.5-1.5V1.5zM4 1a.5.5 0 0 0-.5.5V14a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V1.5a.5.5 0 0 0-.5-.5H4z"/><path fill-rule="evenodd" d="M4 4.5h5v1H4v-1zm0 2h8v1H4v-1zm0 2h8v1H4v-1z"/></svg> Failure Log</button>` : ''}
                         </div>
                     </div>
                 `);
             }
             return chips;
        };

        // Compute separate horizontal run boxes for Tools Used & Guides Used Only
        /**
         * @param {DashboardRunResult[] | undefined} runs
         * @param {string} typeLabel
         */
        const getRunCards = async (runs, typeLabel) => {
             let html = '';
             for (let i = 0; i < maxRuns; i++) {
                 if (!runs || i >= runs.length) continue;
                 const run = runs[i];
                 const paths = await getResultPaths(testId, run, `${scenarioName} - ${typeLabel.toLowerCase()}`);
                  if (!paths) continue;
                  const { usedBasePath } = paths;
                 let files = run.files || [];
                 if (files.length === 0) {
                     try { files = (await api.getRunFiles(usedBasePath)) || []; } catch (e) {}
                 }
                 const toolsUsed = run.guidanceToolsUsed || [];
                 const guidesUsed = run.guidesUsed || (run.guideUsed && run.guideUsed.guidesUsed) || [];
                 const retrievedGuides = run.retrievedGuides || [];
                 const fileReadGuides = run.fileReadGuides || [];

                 if (toolsUsed.length === 0 && guidesUsed.length === 0 && retrievedGuides.length === 0 && fileReadGuides.length === 0) continue;

                 html += `
                     <div class="run-card">
                         <span class="run-card-title">${typeLabel} Run ${i + 1}</span>

                         ${toolsUsed.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">Tools Used:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
${toolsUsed.map((/** @type {string} */ t) => {
                                      const isCorrectTool = run.expectedToolPrefixes && run.expectedToolPrefixes.some((/** @type {string} */ p) => t.startsWith(p));
                                      const className = isCorrectTool ? "matching-guide" : "default-guide";
                                      const style = "padding: 2px 4px; border-radius: 4px; font-family: monospace;";

                                      return `<span class="${className}" style="${style}">${escapeHtml(t)}</span>`;
                                  }).join('')}
                             </div>
                         </div>` : ''}

                         ${retrievedGuides.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">Retrieved Guides:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
                                 ${retrievedGuides.map(g => renderGuideChip(g, run)).join('')}
                             </div>
                         </div>` : ''}

                         ${fileReadGuides.length > 0 ? `
                         <div class="run-card-row">
                             <span class="run-card-label">File Read Guides:</span>
                             <div class="run-card-row-inner" style="flex-wrap: wrap;">
                                 ${fileReadGuides.map(g => renderGuideChip(g, run)).join('')}
                             </div>
                         </div>` : ''}
                     </div>
                 `;
             }
             return html;
        };

        const unguidedChips = await getTfootChips(unguidedRuns, 'Unguided');
        const guidedChips = await getTfootChips(guidedRuns, 'Guided');

        let tfootHtml = '<tfoot><tr>';
        if (maxRuns > 1) {
            unguidedChips.forEach(c => tfootHtml += `<td class="center" style="vertical-align: top;">${c}</td>`);
            guidedChips.forEach(c => tfootHtml += `<td class="center" style="vertical-align: top;">${c}</td>`);
        } else {
            tfootHtml += `<td class="center" style="vertical-align: top;">${unguidedChips[0]}</td><td class="center" style="vertical-align: top;">${guidedChips[0]}</td>`;
        }
        const unguidedCards = await getRunCards(unguidedRuns, 'Unguided');
        const guidedCards = await getRunCards(guidedRuns, 'Guided');
        tfootHtml += `<td>
<div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 12px;">${unguidedCards}${guidedCards}</div>
</td></tr></tfoot>`;

        const promptSlot = container.querySelector('.task-prompt-slot');
        if (promptSlot) promptSlot.innerHTML = promptHtml;
        container.querySelector('table.truth-matrix')?.insertAdjacentHTML('beforeend', tfootHtml);
        container.querySelectorAll('.tfoot-chip-details').forEach(details => {
            details.addEventListener('toggle', () => {
                const msg = details.querySelector('.tfoot-chip-msg');
                if (!(details instanceof HTMLDetailsElement) || !(msg instanceof HTMLElement) || !details.open) return;
                if (msg.scrollHeight > msg.clientHeight) {
                    msg.tabIndex = 0;
                    msg.setAttribute('role', 'region');
                    msg.setAttribute('aria-label', `${details.querySelector('summary')?.textContent || 'Failure'} message`);
                } else { msg.removeAttribute('tabindex'); msg.removeAttribute('role'); msg.removeAttribute('aria-label'); }
            });
        });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const errorHtml = `<div style="color: var(--accent-failure);">Error loading details: ${escapeHtml(msg)}</div>`;
        const promptSlot = container.querySelector('.task-prompt-slot');
        if (promptSlot) promptSlot.innerHTML = errorHtml;
        else container.innerHTML = errorHtml;
    }
}

/**
 * @param {string} text
 */
function formatPromptText(text) {
    const escaped = escapeHtml(text) || '';
    const target = "\n\nDon't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.";
    const escapedTarget = escapeHtml(target) || '';

    if (escaped.includes(escapedTarget)) {
        return escaped.replace(escapedTarget, `<span style="font-size: 80%; opacity: 0.7;">${escapedTarget}</span>`);
    }
    return escaped;
}

/** @param {string} titleText
 * @returns {HTMLElement} the modal body */
function openFrameModal(titleText) {
    const modal = $('dialog#modal');
    const body = $('#modal-body');
    $('#modal-title').textContent = titleText;
    modal.dataset.view = 'content';
    modal.classList.add('frame-modal');
    $('.modal-content').classList.add('frame-modal');
    const loading = document.createElement('div');
    loading.className = 'modal-status-msg';
    loading.textContent = 'Loading…';
    body.replaceChildren(renderBackButton(), loading);
    if (!modal.open) modal.showModal();
    return body;
}
/** @param {{ src?: string, srcdoc?: string, title: string, sandbox: string }} options */
function createSandboxedFrame({ src, srcdoc, title, sandbox }) {
    const frame = document.createElement('iframe');
    frame.className = 'artifact-frame';
    frame.setAttribute('sandbox', sandbox);
    frame.title = title;
    if (srcdoc !== undefined) frame.srcdoc = srcdoc;
    else if (src) frame.src = src;
    return frame;
}
/** @param {HTMLElement} body
 * @param {string} prefix
 * @param {unknown} e */
function showFrameError(body, prefix, e) {
    const error = document.createElement('div');
    error.className = 'modal-error-msg';
    error.textContent = `${prefix}: ${e instanceof Error ? e.message : String(e)}`;
    body.replaceChildren(renderBackButton(), error);
}
const TRAJECTORY_CLOSE_MESSAGE = 'mwg-dashboard:close-modal';
const TRAJECTORY_ESC_BRIDGE = `<script>addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented) parent.postMessage({ type: '${TRAJECTORY_CLOSE_MESSAGE}' }, '*'); });</script>`;
/** @param {string} html */
function withEscBridge(html) {
    const doctype = html.match(/^\s*(?:<!--[\s\S]*?-->\s*)*<!doctype[^>]*>/i);
    if (!doctype) return TRAJECTORY_ESC_BRIDGE + html;
    return doctype[0] + TRAJECTORY_ESC_BRIDGE + html.slice(doctype[0].length);
}
/**
 * @param {string} usedBasePath
 * @param {string} sessionFile
 */
async function openTrajectory(usedBasePath, sessionFile) {
    const body = openFrameModal(sessionFile);
    const placeholder = body.lastElementChild;
    const modal = $('dialog#modal');
    try {
        const html = await api.getFileText(`${usedBasePath}/${sessionFile}`);
        if (!modal.open || !placeholder || !body.contains(placeholder)) return;
        const frame = createSandboxedFrame({
            srcdoc: withEscBridge(html),
            title: `Agent trajectory: ${sessionFile}`,
            sandbox: 'allow-scripts',
        });
        frame.dataset.escBridge = '';
        body.replaceChildren(renderBackButton(), frame);
    } catch (e) {
        if (!modal.open || !placeholder || !body.contains(placeholder)) return;
        console.error('Error loading trajectory:', e);
        showFrameError(body, 'Error loading trajectory', e);
    }
}

/** @param {string} appUrl */
function openApp(appUrl) {
    const url = new URL(appUrl, window.location.href);
    if (url.origin !== window.location.origin) { window.open(url.href, '_blank', 'noopener,noreferrer'); return; }
    const body = openFrameModal('Agent-built app');
    const hint = document.createElement('p');
    hint.className = 'frame-esc-hint';
    hint.textContent = 'Keyboard: inside the app, press Shift+Tab to move focus back out, then Esc to close.';
    body.replaceChildren(renderBackButton(), hint, createSandboxedFrame({ src: url.href, title: 'Agent-built app preview (sandboxed)', sandbox: 'allow-scripts allow-forms', }));
}
// Global helper to open details from task list
window.openDetailsFromTask = (/** @type {string} */ scenarioName, /** @type {string} */ testId) => {
    if (!allTestData) return;
    // Attempt to find runData. We might need to fetch it or pass it.
    // If we assume `allTestData` is available globally (it is), we can find it.
    // Wait, and we need to call showDetails. Let's see if we can find any runType for this scenario to pass to showDetails.
    // showDetails expects testName like "AppName - GuideName - RunType".
    // Let's pass "AppName - GuideName - guided" as a default to showDetails if it exists, or unguided.
    const guidedKey = `${scenarioName} - guided`;
    const unguidedKey = `${scenarioName} - unguided`;
    const finalKey = allTestData.results[guidedKey] ? guidedKey : unguidedKey;
    if (allTestData.results[finalKey]) {
        showDetails(finalKey, allTestData.results[finalKey], allTestData.stats[finalKey], testId);
    } else {
        alert('Could not find run data for this task.');
    }
};

// Exposed for mwg-suite-page.spec.js, which opens trajectories directly; all in-page
// buttons go through data-action delegation instead.
window.openTrajectory = openTrajectory;

/**
 * @param {string} testName
 * @param {DashboardRunResult[]} runs
 * @param {import('../harness/lib/metrics.ts').Metrics['testStats'][string]} stats
 * @param {string} testId
 */
async function showDetails(testName, runs, stats, testId) {
    const modal = $('dialog#modal');
    if (modal.open) modal.close();

    // Update URL without reloading
    const url = new URL(window.location.href);
    url.searchParams.set('testName', testName);
    window.history.replaceState({ testName }, '', url);

    // Store for back navigation
    currentDetails = { testName, runs, stats, testId };

    const parsed = parseResultKey(testName);
    const scenarioName = parsed ? `${parsed.task} - ${parsed.guide}` : testName.replace(/ - (guided|unguided)$/, '');
    const accordionId = `item-${scenarioName.replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase()}`;
    const accordionEl = (parsed && document.querySelector(`.task-accordion[data-guide="${CSS.escape(parsed.guide)}"][data-task="${CSS.escape(parsed.task)}"]`))
        || document.getElementById(accordionId);

    if (accordionEl) {
        accordionEl.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
        if (!accordionEl.classList.contains('open')) {
            const header = $('.task-accordion-header', accordionEl);
            header.click();
        }
    }
}

function renderBackButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '← Back';
    btn.className = 'secondary-btn modal-back-btn';
    btn.onclick = () => {
        const modal = $('dialog#modal');
        if (modal && modal.open) {
            modal.close();
        }
        if (currentDetails) {
            showDetails(currentDetails.testName, currentDetails.runs, currentDetails.stats, currentDetails.testId);
        }
    };
    return btn;
}

/**
 * @param {string} fileName
 * @param {string} filePath
 */
async function viewContent(fileName, filePath) {
    const title = $('#modal-title');
    const body = $('#modal-body');
    const modal = $('dialog#modal');

    title.textContent = fileName;
    modal.dataset.view = 'content';
    if (!modal.open) modal.showModal();
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Loading content...</div>';

    body.innerHTML = '';
    body.appendChild(renderBackButton());

    const pre = document.createElement('pre');
    pre.className = 'log-content';
    pre.tabIndex = 0;
    body.appendChild(pre);

    try {
        const text = await api.getFileText(filePath);

        if (fileName.endsWith('diff.txt') || fileName.endsWith('.patch')) {
            body.innerHTML = '';
            body.appendChild(renderBackButton());

            const files = text.split(/^diff --git /m);
            let anyRendered = false;

            for (let i = 0; i < files.length; i++) {
                let fileDiff = files[i].trim();
                if (!fileDiff) continue;

                // Extract a nice file header
                const lines = fileDiff.split('\n');
                let fileHeader = lines[0];
                if (fileHeader.startsWith('a/')) {
                    fileHeader = fileHeader.split(' b/')[0].replace(/^a\//, '');
                }

                const details = document.createElement('details');
                details.className = 'diff-file-details';
                details.style.marginBottom = '12px'; // Keep margin for spacing
                details.open = true;

                const summary = document.createElement('summary');
                summary.className = 'diff-file-summary';
                summary.textContent = fileHeader;
                details.appendChild(summary);

                const preEl = document.createElement('pre');
                preEl.className = 'diff-container diff-file-pre';
                preEl.tabIndex = 0;
                preEl.style.padding = '0';
                preEl.style.fontSize = '0.75rem';

            const codeEl = document.createElement('code');
            codeEl.textContent = 'diff --git ' + fileDiff;
            preEl.append(codeEl);

                details.appendChild(preEl);
                body.appendChild(details);
                anyRendered = true;
            }

            if (anyRendered) return; // intercepted successfully
        }

        const lines = text.split('\n');
        const truncated = lines.length > 5000;
        const content = truncated ? lines.slice(0, 5000).join('\n') + '\n\n...[truncated for display]...' : text;
        const inner = document.createElement(fileName.endsWith('.log') ? 'samp' : 'code');
        inner.textContent = content;
        pre.replaceChildren(inner);
        pre.className = '';

    } catch (e) {
        body.innerHTML = '';
        body.appendChild(renderBackButton());
        const error = document.createElement('div');
        error.style.color = 'var(--accent-failure)';
        error.style.padding = '20px';
        const msg = e instanceof Error ? e.message : String(e);
        error.textContent = `Error loading file: ${msg}`;
        body.appendChild(error);
    }
}

/**
 * @param {string} setupPath
 * @param {string} resultPath
 * @param {string} testName
 * @param {number} runNumber
 */
async function viewDiff(setupPath, resultPath, testName, runNumber) {
    const url = new URL(window.location.href);
    url.searchParams.set('view', 'diff');
    url.searchParams.set('run', String(runNumber));
    window.history.replaceState({}, '', url);

    const modal = $('dialog#modal');
    const title = $('#modal-title');
    const body = $('#modal-body');
    const contentDiv = $('.modal-content');

    modal.dataset.runNumber = String(runNumber);

    let fileName = '';
    if (resultPath && resultPath.includes('/guided/')) {
        fileName = resultPath.split('/guided/')[1];
    } else if (resultPath && resultPath.includes('/unguided/')) {
        fileName = resultPath.split('/unguided/')[1];
    } else if (setupPath && setupPath.includes('/base_app/')) {
        fileName = setupPath.split('/base_app/')[1];
    } else if (resultPath) {
        fileName = resultPath.split('/').pop() || '';
    }
    title.textContent = fileName;
    body.innerHTML = '<div style="text-align:center; padding: 20px;">Computing diff...</div>';

    // Optional: Make modal wider for diff
    modal.classList.add('diff-modal');
    contentDiv.classList.add('diff-modal');
    modal.dataset.view = 'diff';
    if (!modal.open) modal.showModal();

    try {
        let setupText = null;
        try {
            setupText = await api.getFileText(setupPath);
        } catch (e) {
            // If setup is missing (404), treat as null to show banner
            // If it's a real error, throw
            const msg = e instanceof Error ? e.message : String(e);
            if (!msg.includes('404')) {
                throw new Error(`Failed to load setup file: ${setupPath}`);
            }
        }

        const resultText = await api.getFileText(resultPath);

        let diffHtml = '<div class="diff-container" tabindex="0">';

        if (setupText === null) {
            diffHtml += `<div class="diff-missing-banner"> <strong>Original file not found.</strong> Displaying current file content below.
            </div>`;
            diffHtml += `<pre class="diff-fallback-pre"><code>${escapeHtml(resultText)}</code></pre>`;
        } else {
            // @ts-expect-error global library
            const diff = Diff.diffLines(setupText, resultText);

            diff.forEach((/** @type {import('diff').Change} */ part, /** @type {number} */ index) => {
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
        }

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
        const msg = e instanceof Error ? e.message : String(e);
        error.textContent = `Error loading diff: ${msg}`;
        body.appendChild(error);
        contentDiv.classList.remove('diff-modal');
    }
}

/**
 * Slices precomputed suite-wide `chartData` to the scenarios in `disciplineResults`
 * so `renderDashboardDumbbellChart` reuses the `extractSuiteSummary` walk.
 * @param {ReturnType<typeof calculateChartData>} chartData
 * @param {Record<string, DashboardRunResult[]>} disciplineResults
 * @returns {ReturnType<typeof calculateChartData>}
 */
function sliceChartDataForDiscipline(chartData, disciplineResults) {
    /** @type {Set<string>} */
    const scenarios = new Set();
    for (const key of Object.keys(disciplineResults)) {
        const parsed = parseResultKey(key);
        if (parsed) scenarios.add(`${parsed.task} (${parsed.guide})`);
    }
    /** @type {number[]} */
    const indices = [];
    chartData.labels.forEach((label, idx) => {
        if (scenarios.has(label)) indices.push(idx);
    });
    const pick = /** @template T @param {T[]} arr */ (arr) => indices.map(i => arr[i]);
    return {
        labels: pick(chartData.labels),
        guided: pick(chartData.guided),
        unguided: pick(chartData.unguided),
        guided_tokens: pick(chartData.guided_tokens),
        unguided_tokens: pick(chartData.unguided_tokens),
        guided_uncached_tokens: pick(chartData.guided_uncached_tokens),
        unguided_uncached_tokens: pick(chartData.unguided_uncached_tokens),
        guided_cached_pct: pick(chartData.guided_cached_pct),
        unguided_cached_pct: pick(chartData.unguided_cached_pct),
        guided_runtime_ms: pick(chartData.guided_runtime_ms),
        unguided_runtime_ms: pick(chartData.unguided_runtime_ms),
        guided_failed: pick(chartData.guided_failed),
        unguided_failed: pick(chartData.unguided_failed),
        guided_err_rate: pick(chartData.guided_err_rate),
        unguided_err_rate: pick(chartData.unguided_err_rate)
    };
}

/**
 * @param {DashboardEvalsReport} data
 * @param {import('./summary-extractor.js').SuiteSummary | null} [summary]
 */
function renderDashboardDumbbellChart(data, summary = currentSuiteSummary) {
    const results = data.results;


    const chartSection = document.getElementById('chart-section');
    chartSection?.removeAttribute('aria-busy');
    if (Object.keys(results).length < 1) {
        if (chartSection) chartSection.classList.add('hidden');
        return;
    }
    if (chartSection) chartSection.classList.remove('hidden');

    const container = document.getElementById('dumbbell-chart');
    if (!container) return;
    hideDumbbellTooltip();
    container.innerHTML = ''; // Clear old content

    container.style.display = 'block';
    container.style.columns = '20rem 2';
    container.style.gap = '16px';
    container.style.width = '100%';

    /** @type {Record<string, Record<string, DashboardRunResult[]>>} */
    const groupedByDiscipline = {};
    Object.keys(results).forEach(key => {
        const runs = results[key];
        const sampleRun = runs[0];
        const discipline = (sampleRun && sampleRun.discipline) || 'Uncategorized';

        if (!groupedByDiscipline[discipline]) {
            groupedByDiscipline[discipline] = {};
        }
        groupedByDiscipline[discipline][key] = runs;
    });

    // Sort disciplines by number of features (descending) to help balance columns
    const disciplines = Object.keys(groupedByDiscipline).sort((a, b) => {
        const countA = Object.keys(groupedByDiscipline[a]).length;
        const countB = Object.keys(groupedByDiscipline[b]).length;
        return countB - countA;
    });

    disciplines.forEach(discipline => {
        const disciplineResults = groupedByDiscipline[discipline];
        const {
            labels,
            guided,
            unguided,
            guided_tokens,
            unguided_tokens,
            guided_uncached_tokens,
            unguided_uncached_tokens,
            guided_cached_pct,
            unguided_cached_pct,
            guided_runtime_ms,
            unguided_runtime_ms,
            guided_failed,
            unguided_failed,
            guided_err_rate,
            unguided_err_rate
        } = currentMetricMode !== 'a11y' && summary?.chartData
            ? sliceChartDataForDiscipline(summary.chartData, disciplineResults)
            : calculateChartData(disciplineResults, { onlyA11y: currentMetricMode === 'a11y' });

        if (labels.length === 0) return;

        const chartDiv = document.createElement('div');
        chartDiv.className = 'discipline-chart-segment';

        const titleEl = document.createElement('div');
        titleEl.className = 'meta-label';
        titleEl.textContent = currentMetricMode === 'a11y' ? `${discipline} (Accessibility Checks)` : discipline;
        titleEl.style.padding = '12px 16px 0'; // Padding top and horizontal
        chartDiv.appendChild(titleEl);

        const svgContainer = document.createElement('div');
        svgContainer.className = 'chart-svg-container';
        chartDiv.appendChild(svgContainer);

        container.appendChild(chartDiv);

        const handlePointClick = (/** @type {number} */ index, /** @type {string} */ type) => {
            const scenarioName = labels[index];
            const runType = type.toLowerCase();
            const originalKey = Object.keys(disciplineResults).find(key => {
                const parsed = parseResultKey(key);
                if (!parsed) return false;
                return `${parsed.task} (${parsed.guide})` === scenarioName && parsed.runType === runType;
            });

            if (originalKey) {
                const parsed = parseResultKey(originalKey);
                if (parsed) {
                    const { guide, task } = parsed;
                    const accordionEl = (task && document.querySelector(`.task-accordion[data-guide="${CSS.escape(guide)}"][data-task="${CSS.escape(task)}"]`))
                        || document.querySelector(`.task-accordion[data-guide="${CSS.escape(guide)}"]`);
                    if (accordionEl) {
                        accordionEl.scrollIntoView({ behavior: getScrollBehavior(), block: 'start' });
                        if (!accordionEl.classList.contains('open')) {
                            const header = $('.task-accordion-header', accordionEl);
                            if (header) header.click();
                        }
                    }
                }
            }
        };

        const datasets = [
            {
                label: 'Unguided',
                data: unguided,
                tokens: unguided_tokens,
                uncachedTokens: unguided_uncached_tokens,
                cachedPct: unguided_cached_pct,
                runtimeMs: unguided_runtime_ms,
                failed: unguided_failed,
                errRate: unguided_err_rate,
                onClick: handlePointClick
            },
            {
                label: 'Guided',
                data: guided,
                tokens: guided_tokens,
                uncachedTokens: guided_uncached_tokens,
                cachedPct: guided_cached_pct,
                runtimeMs: guided_runtime_ms,
                failed: guided_failed,
                errRate: guided_err_rate,
                onClick: handlePointClick
            }
        ];

        const chart = new DumbbellChart(svgContainer, {
            size: 500,
            rowHeight: 28,
            margin: { top: 5, right: 200, bottom: 40, left: 30 },
            hideLegend: true,
            itemHref: (item) => {
                const url = new URL(window.location.href);
                if (item.taskName) url.searchParams.set('task', item.taskName);
                url.hash = `guide-${encodeURIComponent(item.useCaseId)}`;
                return `${url.search}${url.hash}`;
            }
        });
        chart.render({ labels, datasets });
    });
    if (container.childElementCount === 0) {
        container.style.columns = 'none';
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-chart-msg';
        emptyMsg.textContent = currentMetricMode === 'a11y'
            ? 'No accessibility checks recorded in this suite.'
            : 'No chart data available for this suite.';
        container.appendChild(emptyMsg);
    }
}

/**
 * @param {string} testId
 * @param {DashboardRunResult} run
 * @param {string} testName
 * @returns {Promise<{ setupPath: string, resultPath: string, usedBasePath: string } | null>}
 */
async function getResultPaths(testId, run, testName) {
    return await api.getResultInfo(testId, run, testName);
}
