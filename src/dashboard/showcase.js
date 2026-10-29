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
    'css-layout': 'css', 'dark-mode': 'visual-design', 'declarative-dialog-popover-control': 'ui-behaviors',
    'defer-rendering-heavy-content': 'performance', 'dialog': 'ui-components',
    'directional-navigation-transitions': 'ui-behaviors', 'faster-spa-view-transitions': 'performance',
    'flicker-free-client-side-ab-testing': 'performance', 'forms': 'forms',
    'highlight-text-ranges': 'ui-behaviors', 'hovercard': 'ui-components', 'html': 'html',
    'interest-triggered-tooltips': 'ui-behaviors', 'light-dismiss-a-dialog': 'ui-behaviors',
    'motion': 'ui-behaviors', 'move-dom-element-without-losing-state': 'ui-behaviors',
    'optimize-image-priority': 'performance', 'optimize-preload-priority': 'performance',
    'performance': 'performance', 'persistent-toast-notifications': 'ui-components',
    'position-aware-tooltips': 'ui-atoms', 'prevent-page-scroll-under-modal-dialog': 'ui-behaviors',
    'same-document-transitions': 'ui-behaviors', 'scrollspy': 'ui-components',
    'search-hidden-content': 'ui-behaviors'
};
/** @type {Record<string, { unguided: string, guided: string }>} */
const TASK_APPROACH_CONTRAST = {
    'highlight-text-ranges': {
        unguided: 'Mutated DOM text nodes with <mark> wrappers on every keystroke instead of using the CSS Custom Highlight API.',
        guided: 'Zero-DOM-mutation highlights via CSS.highlights.set() and ::highlight(), with a feature-detected <mark> fallback.'
    },
    'animate-to-from-top-layer': {
        unguided: 'Standard opacity/transform transitions that snap shut on exit, missing @starting-style, allow-discrete, and reduced-motion guards.',
        guided: 'Smooth top-layer entry and exit transitions using @starting-style, transition-behavior: allow-discrete on display/overlay, and ::backdrop fade.'
    },
    'flicker-free-client-side-ab-testing': {
        unguided: 'Applied an unconditional opacity: 0 anti-flicker hack without blocking="render" or a safety timeout, penalizing every page load.',
        guided: 'Native <script async blocking="render"> in <head> with feature-detected timeout fallback (9/10; missed only the mock CDN timing assertion).'
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
        guided: 'Declarative interestfor triggers with <div popover="hint">, CSS anchor(), position-try fallbacks, and WCAG 1.4.13 persistence (15/16; omitted 1 of 3 polyfills).'
    }
};
/** @type {Record<string, Partial<{ unguided: string, guided: string }>>} */
const TASK_PAIR_OVERRIDES = {
    'animate-to-from-top-layer:antigravity_cli': {
        unguided: 'Applied @starting-style, transition-behavior: allow-discrete, and ::backdrop transitions (8/9), but omitted the prefers-reduced-motion guard.'
    },
    'flicker-free-client-side-ab-testing:codex_cli': {
        guided: 'Applied <script async blocking="render"> in <head> with feature detection (8/10), but omitted the fallback safety timeout and missed the variant timing check.'
    },
    'faster-spa-view-transitions:claude_code': {
        guided: 'Retrieved both faster-spa-view-transitions and defer-rendering-heavy-content, applying content-visibility: auto instead of content-visibility: hidden on inactive views (3/6).'
    },
    'scrollspy:codex_cli': {
        guided: 'Applied native scroll-target-group: auto, :target-current, non-color indicators, scrollend ARIA sync, and IntersectionObserver fallback (10/11; missed only the fallback class selector).'
    },
    'interest-triggered-tooltips:antigravity_cli': {
        guided: 'Declarative interestfor triggers with <div popover="hint">, CSS anchor(), position-try fallbacks, and WCAG 1.4.13 persistence (14/16; paired anchor() with position-area and omitted 1 of 3 polyfills).'
    },
    'interest-triggered-tooltips:codex_cli': {
        guided: 'Declarative interestfor triggers with <div popover="hint">, position-try fallbacks, and WCAG 1.4.13 persistence (12/16; used position-area instead of anchor() and omitted 2 of 3 polyfills).'
    }
};
/** @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair */
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
document.addEventListener('DOMContentLoaded', () => { if (!rootEl) return; void loadShowcase(); });
async function loadShowcase() {
    if (!rootEl) return;
    try {
        const res = await fetch('showcase-runs.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = /** @type {ShowcasePayload} */ (await res.json());
        tasks = Array.isArray(data.tasks) ? data.tasks : [];
        if (!tasks.length) { rootEl.hidden = true; rootEl.setAttribute('aria-busy', 'false'); return; }
        if (!tasks.some(t => t.id === activeTaskId)) { activeTaskId = tasks[0].id; }
        renderAll();
        rootEl.setAttribute('aria-busy', 'false');
    } catch (err) { console.warn('A/B Spotlight: could not load showcase-runs.json', err); rootEl.hidden = true; }
}
/** @returns {{ task: ShowcaseTask, pair: ShowcaseAgentPair } | null} */
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
let agentPillsListenersBound = false;
/** @param {HTMLElement} container */
function syncTaskPillsScrollShadows(container) {
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.classList.toggle('has-scroll-left', container.scrollLeft > 4);
    container.classList.toggle('has-scroll-right', maxScroll - container.scrollLeft > 4);
}
/** @param {ShowcaseTask} currentTask */
function renderTaskPills(currentTask) {
    const container = document.getElementById('ab-task-pills');
    if (!container) return;
    const existingPills = /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll('.ab-task-pill')));
    const sameTasks = existingPills.length === tasks.length &&
        existingPills.every((el, idx) => el.getAttribute('data-task-id') === tasks[idx].id);
    if (!sameTasks) {
        container.innerHTML = `<legend class="visually-hidden">Select evaluation task</legend>` + tasks.map(t => {
            const shortLabel = SHORT_TASK_LABELS[t.id] || t.label;
            return `<label class="ab-task-pill" data-task-id="${escapeHtml(t.id)}"><input type="radio" name="ab-task" value="${escapeHtml(t.id)}"><span>${escapeHtml(shortLabel)}</span><span class="ab-task-delta-slot"></span></label>`;
        }).join('');
    }
    container.querySelectorAll('.ab-task-pill').forEach(pill => {
        const taskId = pill.getAttribute('data-task-id');
        const task = tasks.find(t => t.id === taskId);
        const isCurrent = taskId === currentTask.id;
        const input = pill.querySelector('input[type="radio"]');
        if (input instanceof HTMLInputElement) { input.checked = isCurrent; }
        const deltaSlot = pill.querySelector('.ab-task-delta-slot');
        if (deltaSlot && task) {
            const pair = task.agents[activeAgentId] || Object.values(task.agents)[0];
            const deltaChecks = pair ? pair.guided.passed - pair.unguided.passed : 0;
            deltaSlot.innerHTML = (isCurrent && deltaChecks > 0)
                ? `<span class="ab-task-delta"><span aria-hidden="true">+${deltaChecks}</span><span class="visually-hidden">, ${deltaChecks} more passing ${deltaChecks === 1 ? 'check' : 'checks'} with MWG</span></span>`
                : '';
        }
    });
    syncTaskPillsScrollShadows(container);
    if (!taskPillsListenersBound) {
        taskPillsListenersBound = true;
        let shadowRaf = 0;
        const scheduleShadowSync = () => {
            if (shadowRaf) return;
            shadowRaf = requestAnimationFrame(() => { shadowRaf = 0; syncTaskPillsScrollShadows(container); });
        };
        container.addEventListener('scroll', scheduleShadowSync, { passive: true });
        window.addEventListener('resize', scheduleShadowSync, { passive: true });
        container.addEventListener('change', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement) || target.name !== 'ab-task') return;
            const id = target.value;
            if (id && id !== activeTaskId) {
                activeTaskId = id;
                checksExpanded = false;
                renderAll();
                announceSelection();
            }
            const activePill = target.closest('.ab-task-pill');
            if (activePill instanceof HTMLElement && container.scrollWidth > container.clientWidth) {
                const targetLeft = activePill.offsetLeft - (container.clientWidth / 2) + (activePill.offsetWidth / 2);
                container.scrollTo({ left: Math.max(0, targetLeft), behavior: getScrollBehavior() });
            }
        });
    }
}
/** @param {ShowcaseTask} currentTask
 * @param {ShowcaseAgentPair} currentPair */
function renderAgentPills(currentTask, currentPair) {
    const container = document.getElementById('ab-agent-pills');
    if (!container) return;
    const orderedIds = AGENT_ORDER.filter(id => currentTask.agents[id]);
    const existingPills = /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll('.ab-agent-pill')));
    const sameAgents = existingPills.length === orderedIds.length &&
        existingPills.every((el, idx) => el.getAttribute('data-agent-id') === orderedIds[idx]);
    if (!sameAgents) {
        container.innerHTML = `<legend class="visually-hidden">Select coding agent</legend>` + orderedIds.map(id => {
            const pair = currentTask.agents[id];
            return `<label class="ab-agent-pill" data-agent-id="${escapeHtml(id)}"><input type="radio" name="ab-agent" value="${escapeHtml(id)}">${getAgentBadge(id)}${escapeHtml(pair.agentLabel)}</label>`;
        }).join('');
    }
    container.querySelectorAll('.ab-agent-pill').forEach(pill => {
        const id = pill.getAttribute('data-agent-id');
        const input = pill.querySelector('input[type="radio"]');
        if (input instanceof HTMLInputElement) { input.checked = id === currentPair.agentId; }
    });
    if (!agentPillsListenersBound) {
        agentPillsListenersBound = true;
        container.addEventListener('change', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement) || target.name !== 'ab-agent') return;
            const id = target.value;
            if (id && id !== activeAgentId) { activeAgentId = id; renderAll(); announceSelection(); }
        });
    }
}
/** @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair */
function renderPromptBar(task, pair) {
    const kickerEl = rootEl ? rootEl.querySelector('.ab-prompt-kicker') : null;
    if (kickerEl) { kickerEl.textContent = 'Task prompt'; }
    const promptEl = document.getElementById('ab-prompt-text');
    const metaEl = document.getElementById('ab-run-provenance');
    if (promptEl) {
        promptEl.textContent = `“${task.prompt}”`;
    }
    if (metaEl) {
        const suiteHref = `dashboard.html?testId=${encodeURIComponent(pair.suiteId)}#guide-${encodeURIComponent(task.id)}`;
        const trendHref = `guide.html?guide=${encodeURIComponent(task.id)}&testId=${encodeURIComponent(pair.suiteId)}`;
        const rawGuides = pair.guided.guidesUsed.length ? pair.guided.guidesUsed : [task.id];
        const cleanGuides = rawGuides.map(g => g.replace(/;+$/, '')).filter(Boolean);
        const guideLinksHtml = cleanGuides.map(slug => {
            const cat = GUIDE_CATEGORY_MAP[slug] || task.category;
            const ghHref = `https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/${encodeURIComponent(cat)}/${encodeURIComponent(slug)}/guide.md`;
            return `<a class="ab-prov-link" href="${ghHref}" target="_blank" rel="noopener">${escapeHtml(slug)}</a>`;
        }).join(', ');
        const guidePrefix = cleanGuides.length > 1 ? 'Guides:' : 'Guide:';
        metaEl.innerHTML = `<span class="ab-prov-item">${escapeHtml(pair.date)} nightly run (${escapeHtml(pair.model)})</span> <span class="ab-prov-sep" aria-hidden="true">·</span> <a class="ab-prov-link" href="${suiteHref}">Inspect suite</a> <span class="ab-prov-sep" aria-hidden="true">·</span> <a class="ab-prov-link" href="${trendHref}">Guide trend</a> <span class="ab-prov-sep" aria-hidden="true">·</span> <span class="ab-prov-item">${guidePrefix} ${guideLinksHtml}</span>`;
    }
}
/** @param {string} msg
 * @returns {string} */
function cleanCheckMessage(msg) { return msg.replace(/^Requirement\s+\d+[a-z]?:\s*/i, ''); }
/** @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair */
function expandAndFocusA11yChecks(task, pair) {
    if (!checksExpanded) { checksExpanded = true; renderChecks(task, pair); }
    const firstA11yRow = document.querySelector('#ab-checks-content tr[data-a11y="true"]');
    if (firstA11yRow instanceof HTMLElement) {
        firstA11yRow.scrollIntoView({ behavior: getScrollBehavior(), block: 'nearest' });
    }
    const wrap = document.querySelector('#ab-checks-content .ab-checks-table-wrap');
    if (wrap instanceof HTMLElement) {
        wrap.focus({ preventScroll: true });
    }
}
/** @param {number} rate */
function scoreTone(rate) { if (rate < 60) return 'low'; if (rate < 85) return 'mid'; return 'high'; }
/** @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair */
function renderScorecard(task, pair) {
    const uEl = document.getElementById('ab-score-unguided');
    const gEl = document.getElementById('ab-score-guided');
    if (!uEl || !gEl) return;
    const u = pair.unguided;
    const g = pair.guided;
    const deltaChecks = g.passed - u.passed;
    const deltaSign = deltaChecks > 0 ? `+${deltaChecks}` : (deltaChecks < 0 ? `−${Math.abs(deltaChecks)}` : '0');
    const deltaWord = Math.abs(deltaChecks) === 1 ? 'check' : 'checks';
    const deltaTone = deltaChecks > 0 ? 'good' : (deltaChecks < 0 ? 'cost' : 'flat');
    const deltaGlyph = deltaChecks > 0 ? '▲' : (deltaChecks < 0 ? '▼' : '•');
    const contrast = getApproachContrast(task, pair);
    const uMeterSegs = pair.checks.map(c => {
        const st = c.unguidedPassed ? 'pass' : 'fail';
        return `<span class="ab-meter-seg ${st}"></span>`;
    }).join('');
    const gMeterSegs = pair.checks.map(c => {
        const st = c.guidedPassed ? 'pass' : 'fail';
        return `<span class="ab-meter-seg ${st}${c.flipped ? ' is-flipped' : ''}"></span>`;
    }).join('');
    const uTone = scoreTone(u.rate);
    const gTone = scoreTone(g.rate);
    const uFailed = u.total - u.passed;
    const a11yActionHtml = '<span class="visually-hidden">: show accessibility assertions</span>';
    const uA11yHtml = u.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${u.a11yPassed < u.a11yTotal ? 'fail' : 'pass'}">A11y ${u.a11yPassed}/${u.a11yTotal}${a11yActionHtml}</button>`
        : '';
    const gA11yHtml = g.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${g.a11yPassed === g.a11yTotal ? 'pass' : 'fail'}">A11y ${g.a11yPassed}/${g.a11yTotal}${a11yActionHtml}</button>`
        : '';
    uEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge unguided"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span> <span class="ab-score-pct ${uTone}">${u.passed}<span class="ab-score-denom">/${u.total}</span></span> <span class="ab-pass-summary">${uFailed > 0 ? `${uFailed} failed` : 'all passed'}</span> ${uA11yHtml} </div> <span class="ab-score-secondary">${formatDuration(u.runtimeMs)} · ${formatTokens(u.uncachedTokens)}</span> </div> <div class="ab-check-meter" role="img" aria-label="${u.passed} of ${u.total} grader checks passed">${uMeterSegs}</div> <p class="ab-verdict-summary">${escapeHtml(contrast.unguided)}</p> `;
    gEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge guided"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span> <span class="ab-score-pct ${gTone}">${g.passed}<span class="ab-score-denom">/${g.total}</span></span> <span class="delta ${deltaTone}"><span class="glyph" aria-hidden="true">${deltaGlyph}</span>${deltaSign} ${deltaWord}</span> ${gA11yHtml} </div> <span class="ab-score-secondary">${formatDuration(g.runtimeMs)} · ${formatTokens(g.uncachedTokens)}</span> </div> <div class="ab-check-meter" role="img" aria-label="${g.passed} of ${g.total} grader checks passed">${gMeterSegs}</div> <p class="ab-verdict-summary">${escapeHtml(contrast.guided)}</p> `;
    rootEl?.querySelectorAll('.ab-score-a11y').forEach(btn => { btn.addEventListener('click', () => expandAndFocusA11yChecks(task, pair)); });
}
/** @param {ShowcaseTask} task
 * @param {ShowcaseAgentPair} pair */
function renderChecks(task, pair) {
    const container = document.getElementById('ab-checks-content');
    if (!container) return;
    const totalChecks = pair.checks.length;
    const previewCount = 3;
    const canCollapse = totalChecks > previewCount;
    const collapsed = canCollapse && !checksExpanded;
    const a11yTotal = pair.checks.filter(c => c.isA11y).length || pair.guided.a11yTotal || 0;
    const rowsHtml = pair.checks.map(c => {
        const uBadge = c.unguidedPassed
            ? '<span class="ab-check-status pass"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>'
            : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>';
        const gBadge = c.guidedPassed
            ? `<span class="ab-check-status pass${c.flipped ? ' is-flipped' : ''}"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>`: '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>'; const a11yTag = c.isA11y ?`<span class="ab-a11y-tag">A11y · ${escapeHtml(c.a11yLabel || 'Accessibility')}</span>`
            : '';
        return ` <tr class="ab-check-row${c.flipped ? ' is-flipped' : ''}"${c.isA11y ? ' data-a11y="true"' : ''}> <td class="ab-check-num">${c.index}</td> <th scope="row" class="ab-check-msg"> <span>${escapeHtml(cleanCheckMessage(c.message))}</span> ${a11yTag} </th> <td class="ab-check-cell" data-label="Without MWG">${uBadge}</td> <td class="ab-check-cell" data-label="With MWG">${gBadge}</td> </tr>`;
    }).join('');
    const collapsedLabel = a11yTotal > 0
        ? `Show all ${totalChecks} checks (${a11yTotal} a11y)`
        : `Show all ${totalChecks} checks`;
    const toggleHtml = canCollapse
        ? `<div class="ab-checks-toggle-bar"> <button type="button" id="ab-checks-toggle" class="ab-checks-toggle" aria-expanded="${checksExpanded}" aria-controls="ab-checks-table-wrap"> ${checksExpanded ? 'Show fewer checks' : collapsedLabel} </button> </div>`
        : '';
    container.innerHTML = ` <div id="ab-checks-table-wrap" class="ab-checks-table-wrap${collapsed ? ' is-collapsed' : ''}" tabindex="0" role="region" aria-label="Deterministic grader checks for ${escapeHtml(task.label)}"> <table class="ab-checks-table"> <caption class="visually-hidden">Playwright grader assertions comparing unguided and guided runs for ${escapeHtml(task.label)} on ${escapeHtml(pair.agentLabel)}</caption> <thead> <tr> <th scope="col" class="ab-col-num">#</th> <th scope="col">Grader assertion</th> <th scope="col" class="ab-col-status">Without MWG</th> <th scope="col" class="ab-col-status">With MWG</th> </tr> </thead> <tbody>${rowsHtml}</tbody> </table> </div> ${toggleHtml} `;
    const toggleBtn = document.getElementById('ab-checks-toggle');
    toggleBtn?.addEventListener('click', () => { checksExpanded = !checksExpanded; renderChecks(task, pair); document.getElementById('ab-checks-toggle')?.focus(); });
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
