/**
 * Use-case Evaluation Spotlight for the landing page (index.html).
 */
import { escapeHtml, formatDuration, formatTokens, getAgentBadge, getScrollBehavior } from './utils.js';

/** @typedef {{ passed: number, total: number, rate: number, a11yPassed: number, a11yTotal: number, runtimeMs: number, uncachedTokens: number, totalTokens: number, guidesUsed: string[], addedLines: number, removedLines: number }} ShowcaseModeRun */
/** @typedef {{ index: number, message: string, unguidedPassed: boolean, guidedPassed: boolean, flipped: boolean, isA11y: boolean, a11yLabel: string | null }} ShowcaseCheckItem */
/** @typedef {{ agentId: string, agentLabel: string, model: string, suiteId: string, date: string, unguided: ShowcaseModeRun, guided: ShowcaseModeRun, checks: ShowcaseCheckItem[] }} ShowcaseAgentPair */
/** @typedef {{ id: string, label: string, category: string, categoryLabel: string, featureSummary: string, prompt: string, baseApp: string, agents: Record<string, ShowcaseAgentPair> }} ShowcaseTask */
/** @typedef {{ generatedAt: string, tasks: ShowcaseTask[] }} ShowcasePayload */

const AGENT_ORDER = ['claude_code', 'antigravity_cli', 'codex_cli'];

/** @type {Record<string, string>} */
const SHORT_TASK_LABELS = {
    'highlight-text-ranges': 'Search highlights',
    'animate-to-from-top-layer': 'Top-layer motion',
    'flicker-free-client-side-ab-testing': 'Flicker-free A/B',
    'faster-spa-view-transitions': 'SPA view cache',
    'scrollspy': 'CSS scrollspy',
    'interest-triggered-tooltips': 'Interest tooltips'
};

/** @type {Record<string, string>} */
const GUIDE_CATEGORY_MAP = {
    'accessibility': 'accessibility', 'animate-to-from-top-layer': 'ui-behaviors', 'css': 'css',
    'dark-mode': 'visual-design', 'declarative-dialog-popover-control': 'ui-behaviors',
    'directional-navigation-transitions': 'ui-behaviors', 'faster-spa-view-transitions': 'performance',
    'flicker-free-client-side-ab-testing': 'performance', 'forms': 'forms',
    'highlight-text-ranges': 'ui-behaviors', 'html': 'html', 'interest-triggered-tooltips': 'ui-behaviors',
    'light-dismiss-a-dialog': 'ui-behaviors', 'motion': 'ui-behaviors',
    'move-dom-element-without-losing-state': 'ui-behaviors', 'optimize-image-priority': 'performance',
    'optimize-preload-priority': 'performance', 'performance': 'performance',
    'position-aware-tooltips': 'ui-atoms', 'same-document-transitions': 'ui-behaviors',
    'scrollspy': 'ui-components', 'search-hidden-content': 'ui-behaviors'
};

/** @type {Record<string, { unguided: string, guided: string }>} */
const TASK_APPROACH_CONTRAST = {
    'highlight-text-ranges': {
        unguided: 'Mutated DOM text nodes with <mark> wrappers on every keystroke instead of using the CSS Custom Highlight API.',
        guided: 'Zero-DOM-mutation highlights via CSS.highlights.set() and ::highlight(), with a feature-detected <mark> fallback.'
    },
    'animate-to-from-top-layer': {
        unguided: 'Standard opacity/transform transitions that snap shut on exit — missing @starting-style, allow-discrete, and reduced-motion guards.',
        guided: 'Smooth top-layer entry and exit transitions using @starting-style, transition-behavior: allow-discrete on display/overlay, and ::backdrop fade.'
    },
    'flicker-free-client-side-ab-testing': {
        unguided: 'Applied an unconditional opacity: 0 anti-flicker hack without blocking="render" or a safety timeout, penalizing every page load.',
        guided: 'Native <script async blocking="render"> in <head> with feature-detected timeout fallback (9/10 — missed only the mock CDN timing assertion).'
    },
    'faster-spa-view-transitions': {
        unguided: 'Toggled views without content-visibility: hidden, leaving inactive views exposed to the accessibility tree and losing focus state.',
        guided: 'Cached off-screen view layout state with content-visibility: hidden, paired with aria-hidden="true", focus management, and display: none fallback.'
    },
    'scrollspy': {
        unguided: 'Wired an unconditional JS scroll/IntersectionObserver loop without native scroll-target-group, :target-current, or non-color indicators.',
        guided: 'Native CSS scroll-target-group: auto + :target-current with non-color active indicator, scrollend ARIA sync, and conditional IO fallback.'
    },
    'interest-triggered-tooltips': {
        unguided: 'CSS :hover tooltips with pointer-events: none that fail WCAG 1.4.13 hover persistence, Escape dismissal, and viewport flip fallbacks.',
        guided: 'Declarative interestfor triggers with <div popover="hint">, CSS anchor(), position-try fallbacks, and WCAG 1.4.13 persistence (15/16 — omitted 1 of 3 polyfills).'
    }
};

/** @type {Record<string, Partial<{ unguided: string, guided: string }>>} */
const TASK_PAIR_OVERRIDES = {
    'animate-to-from-top-layer:antigravity_cli': {
        unguided: 'Applied @starting-style, transition-behavior: allow-discrete, and ::backdrop transitions (8/9), but omitted the prefers-reduced-motion guard.'
    },
    'animate-to-from-top-layer:codex_cli': {
        guided: 'Applied @starting-style, transition-behavior: allow-discrete, ::backdrop fade, and prefers-reduced-motion on <dialog> (6/9 — omitted [popover] entry/exit transitions).'
    },
    'flicker-free-client-side-ab-testing:codex_cli': {
        guided: 'Applied <script async blocking="render"> in <head> with feature detection (8/10), but omitted the fallback safety timeout and missed the variant timing check.'
    }
};

/**
 * @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair
 */
function getApproachContrast(task, pair) {
    const base = TASK_APPROACH_CONTRAST[task.id] || {
        unguided: 'Standard unguided implementation without MWG skill.',
        guided: `Guided implementation using ${task.featureSummary}.`
    };
    const override = TASK_PAIR_OVERRIDES[`${task.id}:${pair.agentId}`];
    return override ? { ...base, ...override } : base;
}

/** @type {ShowcaseTask[]} */
let tasks = [];
/** @type {string} */
let activeTaskId = 'highlight-text-ranges';
/** @type {string} */
let activeAgentId = 'claude_code';
let checksExpanded = false;

const rootEl = /** @type {HTMLElement | null} */ (document.getElementById('ab-spotlight'));

document.addEventListener('DOMContentLoaded', () => {
    if (!rootEl) return;
    void loadShowcase();
});

async function loadShowcase() {
    if (!rootEl) return;
    try {
        const res = await fetch('showcase-runs.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = /** @type {ShowcasePayload} */ (await res.json());
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        if (!tasks.length) return;
        if (!tasks.some(t => t.id === activeTaskId)) {
            activeTaskId = tasks[0].id;
        }
        renderAll();
        rootEl.setAttribute('aria-busy', 'false');
    } catch (err) {
        console.warn('A/B Spotlight: could not load showcase-runs.json', err);
        rootEl.hidden = true;
    }
}

/**
 * Returns the currently selected task and agent pair.
 * @returns {{ task: ShowcaseTask, pair: ShowcaseAgentPair } | null}
 */
function getCurrentSelection() {
    const task = tasks.find(t => t.id === activeTaskId) || tasks[0];
    if (!task) return null;
    const pair = task.agents[activeAgentId] || Object.values(task.agents)[0];
    if (!pair) return null;
    return { task, pair };
}

function renderAll() {
    const sel = getCurrentSelection();
    if (!sel) return;
    renderTaskPills(sel.task);
    renderAgentPills(sel.task, sel.pair);
    renderPromptBar(sel.task, sel.pair);
    renderScorecard(sel.task, sel.pair);
    renderChecks(sel.task, sel.pair);
}

let taskPillsListenersBound = false;

/**
 * Updates directional edge-fade classes on #ab-task-pills based on scroll position.
 * @param {HTMLElement} container
 */
function syncTaskPillsScrollShadows(container) {
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.classList.toggle('has-scroll-left', container.scrollLeft > 4);
    container.classList.toggle('has-scroll-right', maxScroll - container.scrollLeft > 4);
}

/**
 * @param {ShowcaseTask} currentTask
 */
function renderTaskPills(currentTask) {
    const container = document.getElementById('ab-task-pills');
    if (!container) return;

    const prevScrollLeft = container.scrollLeft;

    container.innerHTML = tasks.map(t => {
        const isCurrent = t.id === currentTask.id;
        const shortLabel = SHORT_TASK_LABELS[t.id] || t.label;
        const pair = t.agents[activeAgentId] || Object.values(t.agents)[0];
        const deltaChecks = pair ? pair.guided.passed - pair.unguided.passed : 0;
        const deltaHtml = (isCurrent && deltaChecks > 0)
            ? `<span class="ab-task-delta" aria-hidden="true" title="+${deltaChecks} passing checks with MWG">+${deltaChecks}</span>`
            : '';
        return `<button type="button" class="ab-task-pill" data-task-id="${escapeHtml(t.id)}" aria-pressed="${isCurrent}"><span>${escapeHtml(shortLabel)}</span>${deltaHtml}</button>`;
    }).join('');

    container.scrollLeft = prevScrollLeft;
    syncTaskPillsScrollShadows(container);

    if (!taskPillsListenersBound) {
        taskPillsListenersBound = true;
        container.addEventListener('scroll', () => syncTaskPillsScrollShadows(container), { passive: true });
        window.addEventListener('resize', () => syncTaskPillsScrollShadows(container), { passive: true });
    }

    container.querySelectorAll('.ab-task-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-task-id');
            if (id && id !== activeTaskId) {
                activeTaskId = id;
                checksExpanded = false;
                renderAll();
                const activeBtn = /** @type {HTMLElement | null} */ (container.querySelector('.ab-task-pill[aria-pressed="true"]'));
                if (activeBtn) {
                    activeBtn.focus({ preventScroll: true });
                    if (container.scrollWidth > container.clientWidth) {
                        const targetLeft = activeBtn.offsetLeft - (container.clientWidth / 2) + (activeBtn.offsetWidth / 2);
                        container.scrollTo({ left: Math.max(0, targetLeft), behavior: getScrollBehavior() });
                    }
                }
                announceSelection();
            }
        });
    });
}

/**
 * @param {ShowcaseTask} currentTask
 * @param {ShowcaseAgentPair} currentPair
 */
function renderAgentPills(currentTask, currentPair) {
    const container = document.getElementById('ab-agent-pills');
    if (!container) return;

    const orderedIds = AGENT_ORDER.filter(id => currentTask.agents[id]);
    container.innerHTML = orderedIds.map(id => {
        const pair = currentTask.agents[id];
        const isCurrent = id === currentPair.agentId;
        return `<button type="button" class="ab-agent-pill" data-agent-id="${escapeHtml(id)}" aria-pressed="${isCurrent}">${getAgentBadge(id)}${escapeHtml(pair.agentLabel)}</button>`;
    }).join('');

    container.querySelectorAll('.ab-agent-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-agent-id');
            if (id && id !== activeAgentId) {
                activeAgentId = id;
                renderAll();
                /** @type {HTMLElement | null} */ (container.querySelector('.ab-agent-pill[aria-pressed="true"]'))?.focus({ preventScroll: true });
                announceSelection();
            }
        });
    });
}

/**
 * @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair
 */
function renderPromptBar(task, pair) {
    const kickerEl = rootEl ? rootEl.querySelector('.ab-prompt-kicker') : null;
    if (kickerEl) {
        kickerEl.textContent = 'Task prompt';
    }
    const promptEl = document.getElementById('ab-prompt-text');
    const metaEl = document.getElementById('ab-run-provenance');
    if (promptEl) {
        promptEl.textContent = `“${task.prompt}”`;
    }
    if (metaEl) {
        const params = new URLSearchParams(window.location.search);
        const source = params.get('source');
        const sourceSuffix = source ? `&source=${encodeURIComponent(source)}` : '';
        const suiteHref = `dashboard.html?testId=${encodeURIComponent(pair.suiteId)}${sourceSuffix}#guide-${encodeURIComponent(task.id)}`;
        const trendHref = `guide.html?guide=${encodeURIComponent(task.id)}&testId=${encodeURIComponent(pair.suiteId)}${sourceSuffix}`;
        const rawGuides = pair.guided.guidesUsed.length ? pair.guided.guidesUsed : [task.id];
        const cleanGuides = rawGuides.map(g => g.replace(/;+$/, '')).filter(Boolean);
        const guideLinksHtml = cleanGuides.map(slug => {
            const cat = GUIDE_CATEGORY_MAP[slug] || task.category;
            const ghHref = `https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}/guide.md`;
            return `<a class="ab-prov-link" href="${ghHref}" target="_blank" rel="noopener">${escapeHtml(slug)}</a>`;
        }).join(', ');
        const guidePrefix = cleanGuides.length > 1 ? 'Guides:' : 'Guide:';

        metaEl.innerHTML = `
            <span class="ab-prov-item">${escapeHtml(pair.date)} nightly run (${escapeHtml(pair.model)})</span>
            <span class="ab-prov-sep" aria-hidden="true">·</span>
            <a class="ab-prov-link" href="${suiteHref}">Inspect suite</a>
            <span class="ab-prov-sep" aria-hidden="true">·</span>
            <a class="ab-prov-link" href="${trendHref}">Guide trend</a>
            <span class="ab-prov-sep" aria-hidden="true">·</span>
            <span class="ab-prov-item">${guidePrefix} ${guideLinksHtml}</span>
        `;
    }
}

/**
 * Strips verbose "Requirement N:" prefixes from check messages so they don't duplicate the # column.
 * @param {string} msg
 * @returns {string}
 */
function cleanCheckMessage(msg) {
    return msg.replace(/^Requirement\s+\d+[a-z]?:\s*/i, '');
}

/**
 * Expands the grader assertions table (if collapsed) and scrolls to the first accessibility row.
 * @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair
 */
function expandAndFocusA11yChecks(task, pair) {
    if (!checksExpanded) {
        checksExpanded = true;
        renderChecks(task, pair);
    }
    const firstA11yRow = document.querySelector('#ab-checks-content tr[data-a11y="true"]');
    if (firstA11yRow instanceof HTMLElement) {
        firstA11yRow.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' });
    }
    const wrap = document.querySelector('#ab-checks-content .ab-checks-table-wrap');
    if (wrap instanceof HTMLElement) {
        wrap.focus({ preventScroll: true });
    }
}

/**
 * @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair
 */
function renderScorecard(task, pair) {
    const uEl = document.getElementById('ab-score-unguided');
    const gEl = document.getElementById('ab-score-guided');
    if (!uEl || !gEl) return;

    const u = pair.unguided;
    const g = pair.guided;
    const deltaChecks = g.passed - u.passed;
    const deltaSign = deltaChecks > 0 ? `+${deltaChecks}` : String(deltaChecks);
    const deltaWord = Math.abs(deltaChecks) === 1 ? 'check' : 'checks';
    const contrast = getApproachContrast(task, pair);

    const uMeterSegs = pair.checks.map(c => {
        const st = c.unguidedPassed ? 'pass' : 'fail';
        const label = `Check #${c.index} (${c.unguidedPassed ? 'Pass' : 'Fail'}): ${c.message}`;
        return `<span class="ab-meter-seg ${st}" title="${escapeHtml(label)}"></span>`;
    }).join('');

    const gMeterSegs = pair.checks.map(c => {
        const st = c.guidedPassed ? 'pass' : 'fail';
        const label = `Check #${c.index} (${c.guidedPassed ? 'Pass' : 'Fail'}${c.flipped ? ' — flipped from Fail' : ''}): ${c.message}`;
        return `<span class="ab-meter-seg ${st}${c.flipped ? ' is-flipped' : ''}" title="${escapeHtml(label)}"></span>`;
    }).join('');

    const uTone = u.rate < 60 ? 'low' : 'mid';
    const uFailed = u.total - u.passed;
    const uA11yHtml = u.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${u.a11yPassed < u.a11yTotal ? 'fail' : 'pass'}" title="Show accessibility assertions">A11y ${u.a11yPassed}/${u.a11yTotal}</button>`
        : '';
    const gA11yHtml = g.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${g.a11yPassed === g.a11yTotal ? 'pass' : 'fail'}" title="Show accessibility assertions">A11y ${g.a11yPassed}/${g.a11yTotal}</button>`
        : '';

    uEl.innerHTML = `
        <div class="ab-score-header">
            <div class="ab-score-header-main">
                <span class="ab-mode-badge unguided"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span>
                <span class="ab-score-pct ${uTone}">${u.passed}<span class="ab-score-denom">/${u.total}</span></span>
                <span class="ab-pass-summary">${uFailed > 0 ? `${uFailed} failed` : 'all passed'}</span>
                ${uA11yHtml}
            </div>
            <span class="ab-score-secondary">${formatDuration(u.runtimeMs)} · ${formatTokens(u.uncachedTokens)}</span>
        </div>
        <div class="ab-check-meter" role="img" aria-label="${u.passed} of ${u.total} grader checks passed">${uMeterSegs}</div>
        <p class="ab-verdict-summary">${escapeHtml(contrast.unguided)}</p>
    `;

    gEl.innerHTML = `
        <div class="ab-score-header">
            <div class="ab-score-header-main">
                <span class="ab-mode-badge guided"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span>
                <span class="ab-score-pct high">${g.passed}<span class="ab-score-denom">/${g.total}</span></span>
                <span class="delta ${deltaChecks > 0 ? 'good' : 'flat'}"><span class="glyph" aria-hidden="true">${deltaChecks > 0 ? '▲' : '•'}</span>${deltaSign} ${deltaWord}</span>
                ${gA11yHtml}
            </div>
            <span class="ab-score-secondary">${formatDuration(g.runtimeMs)} · ${formatTokens(g.uncachedTokens)}</span>
        </div>
        <div class="ab-check-meter" role="img" aria-label="${g.passed} of ${g.total} grader checks passed">${gMeterSegs}</div>
        <p class="ab-verdict-summary">${escapeHtml(contrast.guided)}</p>
    `;

    rootEl?.querySelectorAll('.ab-score-a11y').forEach(btn => {
        btn.addEventListener('click', () => expandAndFocusA11yChecks(task, pair));
    });
}

/**
 * Renders the grader checks table for the selected use case and agent.
 * @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair
 */
function renderChecks(task, pair) {
    const container = document.getElementById('ab-checks-content');
    if (!container) return;

    const totalChecks = pair.checks.length;
    const previewCount = 3;
    const canCollapse = totalChecks > previewCount;
    const collapsed = canCollapse && !checksExpanded;
    const a11yTotal = pair.guided.a11yTotal || 0;

    const rowsHtml = pair.checks.map(c => {
        const uBadge = c.unguidedPassed
            ? '<span class="ab-check-status pass"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>'
            : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>';
        const gBadge = c.guidedPassed
            ? `<span class="ab-check-status pass${c.flipped ? ' is-flipped' : ''}"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>`
            : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>';
        const a11yTag = c.isA11y
            ? `<span class="ab-a11y-tag">A11y · ${escapeHtml(c.a11yLabel || 'Accessibility')}</span>`
            : '';

        return `
            <tr class="ab-check-row${c.flipped ? ' is-flipped' : ''}"${c.isA11y ? ' data-a11y="true"' : ''}>
                <td class="ab-check-num">${c.index}</td>
                <th scope="row" class="ab-check-msg">
                    <span>${escapeHtml(cleanCheckMessage(c.message))}</span>
                    ${a11yTag}
                </th>
                <td class="ab-check-cell" data-label="Without MWG">${uBadge}</td>
                <td class="ab-check-cell" data-label="With MWG">${gBadge}</td>
            </tr>`;
    }).join('');

    const collapsedLabel = a11yTotal > 0
        ? `Show all ${totalChecks} checks (${a11yTotal} a11y)`
        : `Show all ${totalChecks} checks`;
    const toggleHtml = canCollapse
        ? `<div class="ab-checks-toggle-bar">
             <button type="button" id="ab-checks-toggle" class="ab-checks-toggle" aria-expanded="${checksExpanded}" aria-controls="ab-checks-table-wrap">
               ${checksExpanded ? 'Show fewer checks' : collapsedLabel}
             </button>
           </div>`
        : '';

    container.innerHTML = `
        <div id="ab-checks-table-wrap" class="ab-checks-table-wrap${collapsed ? ' is-collapsed' : ''}" tabindex="0" role="region" aria-label="Deterministic grader checks for ${escapeHtml(task.label)}">
            <table class="ab-checks-table">
                <caption class="visually-hidden">Playwright grader assertions comparing unguided and guided runs for ${escapeHtml(task.label)} on ${escapeHtml(pair.agentLabel)}</caption>
                <thead>
                    <tr>
                        <th scope="col" class="ab-col-num">#</th>
                        <th scope="col">Grader assertion</th>
                        <th scope="col" class="ab-col-status">Without MWG</th>
                        <th scope="col" class="ab-col-status">With MWG</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
        ${toggleHtml}
    `;

    const toggleBtn = document.getElementById('ab-checks-toggle');
    toggleBtn?.addEventListener('click', () => {
        checksExpanded = !checksExpanded;
        renderChecks(task, pair);
        document.getElementById('ab-checks-toggle')?.focus();
    });
}

function announceSelection() {
    const liveEl = document.getElementById('hero-live');
    const sel = getCurrentSelection();
    if (!liveEl || !sel) return;
    const { task, pair } = sel;
    const delta = pair.guided.passed - pair.unguided.passed;
    const sign = delta > 0 ? `+${delta}` : String(delta);
    liveEl.textContent = `Showing ${task.label} on ${pair.agentLabel}: unguided ${pair.unguided.passed} of ${pair.unguided.total} checks passed, guided ${pair.guided.passed} of ${pair.guided.total} passed (${sign} checks).`;
}
