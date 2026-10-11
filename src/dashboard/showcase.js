/**
 * Use-case Evaluation Spotlight for the landing page (index.html).
 *
 * Loads real Unguided vs. Guided task pairs extracted from the latest nightly
 * evaluation suites (`./showcase-runs.json`) across Claude Code, Antigravity CLI,
 * and Codex CLI. Highlights the task prompt, side-by-side pass rates, approach
 * summary, and the deterministic grader assertions for each use case.
 */
import { escapeHtml, formatDuration, formatTokens, getAgentBadge } from './utils.js';

/**
 * @typedef {Object} ShowcaseModeRun
 * @property {number} passed
 * @property {number} total
 * @property {number} rate
 * @property {number} a11yPassed
 * @property {number} a11yTotal
 * @property {number} runtimeMs
 * @property {number} uncachedTokens
 * @property {number} totalTokens
 * @property {string[]} guidesUsed
 * @property {number} addedLines
 * @property {number} removedLines
 */

/**
 * @typedef {Object} ShowcaseCheckItem
 * @property {number} index
 * @property {string} message
 * @property {boolean} unguidedPassed
 * @property {boolean} guidedPassed
 * @property {boolean} flipped
 * @property {boolean} isA11y
 * @property {string | null} a11yLabel
 */

/**
 * @typedef {Object} ShowcaseAgentPair
 * @property {string} agentId
 * @property {string} agentLabel
 * @property {string} model
 * @property {string} suiteId
 * @property {string} date
 * @property {ShowcaseModeRun} unguided
 * @property {ShowcaseModeRun} guided
 * @property {ShowcaseCheckItem[]} checks
 */

/**
 * @typedef {Object} ShowcaseTask
 * @property {string} id
 * @property {string} label
 * @property {string} category
 * @property {string} categoryLabel
 * @property {string} featureSummary
 * @property {string} prompt
 * @property {string} baseApp
 * @property {Record<string, ShowcaseAgentPair>} agents
 */

/**
 * @typedef {Object} ShowcasePayload
 * @property {string} generatedAt
 * @property {ShowcaseTask[]} tasks
 */

const AGENT_ORDER = ['claude_code', 'antigravity_cli', 'codex_cli'];

/**
 * Concise task tab labels so the horizontal task bar scans cleanly without wrapping.
 * @type {Record<string, string>}
 */
const SHORT_TASK_LABELS = {
    'swipe-to-remove': 'Swipe-to-remove',
    'branded-select-styling': 'Custom select',
    'highlight-text-ranges': 'Search highlights',
    'interest-triggered-tooltips': 'Interest tooltips',
    'navigation-drawer': 'Nav drawer',
    'dynamic-sibling-animations': 'Staggered motion'
};

/**
 * Concise 1-line summary contrasting what agents typically build unguided vs. guided on each task.
 * @type {Record<string, { unguided: string, guided: string }>}
 */
const TASK_APPROACH_CONTRAST = {
    'swipe-to-remove': {
        unguided: 'Hand-rolled pointermove JS drag transforms — no CSS scroll-snap, no accessible Remove button, no focus ring.',
        guided: 'Native CSS scroll-snap-type: x mandatory track, IntersectionObserver commit thresholds, WAAPI collapse, and accessible Remove button.'
    },
    'branded-select-styling': {
        unguided: 'Styled a legacy <select> (or custom <div> dropdown) without appearance: base-select, ::picker(select), or <selectedcontent>.',
        guided: 'Native CSS customizable <select> using appearance: base-select, ::picker(select), <selectedcontent>, and option::checkmark.'
    },
    'highlight-text-ranges': {
        unguided: 'Mutated DOM nodes or skipped CSS.highlights registration instead of using the CSS Custom Highlight API.',
        guided: 'Zero-DOM-mutation highlights via CSS.highlights.set(), new Highlight(range) on text nodes, and ::highlight() styling.'
    },
    'interest-triggered-tooltips': {
        unguided: 'Custom hover tooltips without declarative interestfor, popover="hint", CSS anchor(), or WCAG 1.4.13 hover persistence.',
        guided: 'Declarative interestfor triggers with <div popover="hint">, CSS position-anchor + anchor(), and position-try fallbacks.'
    },
    'navigation-drawer': {
        unguided: 'Custom drawer missing popover="manual" top-layer promotion, background inert lock, or reduced-motion scroll guards.',
        guided: 'Top-layer popover="manual" drawer with scroll-snap-type: x mandatory, background inert lock, aria-expanded, and scroll-linked backdrop.'
    },
    'dynamic-sibling-animations': {
        unguided: 'Hardcoded :nth-child() delays instead of CSS sibling-index() and omitted custom-property fallback.',
        guided: 'Dynamic calc(sibling-index() * 100ms) stagger delay with @supports custom-property fallback and reduced-motion guard.'
    }
};

/** @type {ShowcaseTask[]} */
let tasks = [];
/** @type {string} */
let activeTaskId = 'swipe-to-remove';
/** @type {string} */
let activeAgentId = 'claude_code';
/** @type {boolean} */
let promptExpanded = false;
/** @type {boolean} */
let checksExpanded = false;

const rootEl = /** @type {HTMLElement | null} */ (document.getElementById('ab-spotlight'));

document.addEventListener('DOMContentLoaded', () => {
    if (!rootEl) return;
    setupPromptToggle();
    void loadShowcase();
});

function setupPromptToggle() {
    const toggleBtn = document.getElementById('ab-prompt-toggle');
    if (!toggleBtn) return;
    toggleBtn.addEventListener('click', () => {
        promptExpanded = !promptExpanded;
        const sel = getCurrentSelection();
        if (sel) renderPromptBar(sel.task, sel.pair);
    });
}

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

/**
 * @param {ShowcaseTask} currentTask
 */
function renderTaskPills(currentTask) {
    const container = document.getElementById('ab-task-pills');
    if (!container) return;

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

    container.querySelectorAll('.ab-task-pill').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-task-id');
            if (id && id !== activeTaskId) {
                activeTaskId = id;
                promptExpanded = false;
                checksExpanded = false;
                renderAll();
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
    const toggleBtn = document.getElementById('ab-prompt-toggle');
    const metaEl = document.getElementById('ab-run-provenance');
    if (promptEl) {
        promptEl.textContent = `“${task.prompt}”`;
        const isLong = task.prompt.length > 240;
        promptEl.classList.toggle('clamped', isLong && !promptExpanded);
        if (toggleBtn) {
            toggleBtn.hidden = !isLong;
            toggleBtn.setAttribute('aria-expanded', String(promptExpanded));
            toggleBtn.textContent = promptExpanded ? 'Collapse' : 'Full prompt';
        }
    }
    if (metaEl) {
        const suiteHref = `dashboard.html?testId=${encodeURIComponent(pair.suiteId)}`;
        const guideHref = `guide.html?guide=${encodeURIComponent(task.id)}`;
        const retrieved = pair.guided.guidesUsed.length
            ? pair.guided.guidesUsed.join(', ')
            : task.id;
        metaEl.innerHTML = `
            <span class="ab-prov-item">${escapeHtml(pair.date)} nightly run (${escapeHtml(pair.model)})</span>
            <span class="ab-prov-sep" aria-hidden="true">·</span>
            <a class="ab-prov-link" href="${suiteHref}">Inspect suite</a>
            <span class="ab-prov-sep" aria-hidden="true">·</span>
            <a class="ab-prov-link" href="${guideHref}">Guide: ${escapeHtml(retrieved)}</a>
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
    const contrast = TASK_APPROACH_CONTRAST[task.id] || {
        unguided: 'Standard unguided implementation without MWG skill.',
        guided: `Guided implementation using ${task.featureSummary}.`
    };

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
        ? `<span class="ab-score-a11y ${u.a11yPassed < u.a11yTotal ? 'fail' : 'pass'}">A11y ${u.a11yPassed}/${u.a11yTotal}</span>`
        : '';
    const gA11yHtml = g.a11yTotal > 0
        ? `<span class="ab-score-a11y ${g.a11yPassed === g.a11yTotal ? 'pass' : 'fail'}">A11y ${g.a11yPassed}/${g.a11yTotal}</span>`
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

    const rowsHtml = pair.checks.map(c => {
        const uBadge = c.unguidedPassed
            ? '<span class="ab-check-status pass"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>'
            : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>';
        const gBadge = c.guidedPassed
            ? `<span class="ab-check-status pass${c.flipped ? ' is-flipped' : ''}"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>`
            : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>';
        const a11yTag = c.isA11y
            ? `<span class="ab-a11y-tag">${escapeHtml(c.a11yLabel || 'Accessibility')}</span>`
            : '';

        return `
            <tr class="ab-check-row${c.flipped ? ' is-flipped' : ''}">
                <td class="ab-check-num">${c.index}</td>
                <th scope="row" class="ab-check-msg">
                    <span>${escapeHtml(cleanCheckMessage(c.message))}</span>
                    ${a11yTag}
                </th>
                <td class="ab-check-cell" data-label="Without MWG">${uBadge}</td>
                <td class="ab-check-cell" data-label="With MWG">${gBadge}</td>
            </tr>`;
    }).join('');

    const toggleHtml = canCollapse
        ? `<div class="ab-checks-toggle-bar">
             <button type="button" id="ab-checks-toggle" class="ab-checks-toggle" aria-expanded="${checksExpanded}">
               ${checksExpanded ? 'Show fewer checks' : `Show all ${totalChecks} checks`}
             </button>
           </div>`
        : '';

    container.innerHTML = `
        <div class="ab-checks-table-wrap${collapsed ? ' is-collapsed' : ''}" tabindex="0" role="region" aria-label="Deterministic grader checks for ${escapeHtml(task.label)}">
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
