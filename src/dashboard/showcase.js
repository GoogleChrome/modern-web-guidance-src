import { escapeHtml, formatDuration, formatTokens, getAgentBadge, getScrollBehavior } from './utils.js';
import { AGENT_FAMILIES } from './agents.js';
import { SHOWCASE_TASKS } from './showcase-config.js';
import { selectRecentSuites, getSuiteTimestamp } from './insights.js';
/** @typedef {import('./summary-extractor.js').ShowcaseModeRun & { rate: number }} ShowcaseModeRun */
/** @typedef {import('./summary-extractor.js').ShowcaseCheck & { index: number, flipped: boolean }} ShowcaseCheckItem */
/** @typedef {{ agentId: string, agentLabel: string, model: string, suiteId: string, date: string, unguided: ShowcaseModeRun, guided: ShowcaseModeRun, checks: ShowcaseCheckItem[] }} ShowcaseAgentPair */
/** @typedef {{ id: string, label: string, category: string, prompt: string, agents: Record<string, ShowcaseAgentPair> }} ShowcaseTask */
const AGENT_ORDER = AGENT_FAMILIES.map(f => f.id);
/** @type {Record<string, string>} */
const guideCategoryMap = {};
/** @type {Promise<void> | null} */
let guideCategoryPromise = null;
function ensureGuideCategoriesLoaded() {
    if (guideCategoryPromise || typeof fetch !== 'function') return;
    guideCategoryPromise = fetch('grouped-tasks.gen.json')
        .then(r => (r.ok ? r.json() : null))
        .then((/** @type {{ guides?: Record<string, Record<string, string[]>> } | null} */ data) => {
            if (!data?.guides) return;
            for (const [category, guides] of Object.entries(data.guides)) {
                for (const slug of Object.keys(guides)) {
                    guideCategoryMap[slug] = category;
                }
            }
            const sel = getCurrentSelection();
            if (sel) renderPromptBar(sel.task, sel.pair);
        })
        .catch(() => {});
}
/** @type {ShowcaseTask[]} */
let tasks = [];
/** @type {string} */
let activeTaskId = SHOWCASE_TASKS[0].id;
/** @type {string} */
let activeAgentId = AGENT_ORDER[0];
let checksExpanded = false;
let taskPillsListenersBound = false;
let agentPillsListenersBound = false;
const rootEl = /** @type {HTMLElement | null} */ (document.getElementById('ab-spotlight'));
if (rootEl) {
    ensureGuideCategoriesLoaded();
    renderPending({ loading: true });
}
/**
 * Renders the Spotlight from each agent family's latest nightly suite, unfiltered. Suites carry
 * per-check results for the featured tasks in `summary.showcase` (from the published manifest,
 * or from evals.json hydration). When no data is loaded yet, renders placeholders in place to
 * match the rest of the page and avoid layout shifts.
 * @param {import('./insights.js').ManifestSuite[]} suites
 * @param {{ hydrated?: boolean }} [options]
 */
export function updateShowcaseFromSuites(suites, { hydrated = false } = {}) {
    if (!rootEl) return;
    tasks = buildTasksFromRecentSuites(suites);
    if (tasks.length && !tasks.some(t => t.id === activeTaskId)) {
        activeTaskId = tasks[0].id;
    }
    const awaitingHydration = !hydrated && !tasks.length && hasUnhydratedRecentSuites(suites);
    if (awaitingHydration) {
        renderPending({ loading: true });
        rootEl.setAttribute('aria-busy', 'true');
        return;
    }
    renderAll();
    rootEl.setAttribute('aria-busy', 'false');
}

/** @param {import('./insights.js').ManifestSuite[]} suites */
function hasUnhydratedRecentSuites(suites) {
    const recent = selectRecentSuites(suites, { perAgentRecentN: 1 });
    return AGENT_FAMILIES.some(f => {
        const suite = recent.get(f)?.[0];
        return Boolean(suite && !suite.showcase);
    });
}

/**
 * @param {import('./insights.js').ManifestSuite[]} suites
 * @returns {ShowcaseTask[]}
 */
function buildTasksFromRecentSuites(suites) {
    const recent = selectRecentSuites(suites, { perAgentRecentN: 1 });
    // Keep agent order aligned with headline AGENT_FAMILIES.
    const families = AGENT_FAMILIES.filter(f => recent.has(f));
    if (!families.length) return [];
    /** @type {ShowcaseTask[]} */
    const result = [];
    for (const def of SHOWCASE_TASKS) {
        /** @type {Record<string, ShowcaseAgentPair>} */
        const agentPairs = {};
        let prompt = '';
        let discipline = '';
        for (const family of families) {
            const suite = recent.get(family)?.[0];
            const slice = suite?.showcase?.[def.id];
            if (!slice || !slice.guided || !slice.unguided) continue;
            if (!prompt && slice.prompt) prompt = slice.prompt;
            if (!discipline && slice.discipline) discipline = slice.discipline;
            const ts = getSuiteTimestamp(suite);
            const date = ts ? ts.slice(0, 10) : '';
            const toRun = (/** @type {import('./summary-extractor.js').ShowcaseModeRun} */ r) => ({
                ...r,
                rate: r.total > 0 ? Math.round((r.passed / r.total) * 100) : 0
            });
            const bothGraded = !slice.unguided.earlyFailure && !slice.guided.earlyFailure;
            const checks = (slice.checks || []).map((c, idx) => ({
                index: idx + 1,
                message: c.message,
                unguidedPassed: Boolean(c.unguidedPassed),
                guidedPassed: Boolean(c.guidedPassed),
                flipped: bothGraded && !c.unguidedPassed && Boolean(c.guidedPassed),
                isA11y: Boolean(c.isA11y),
                a11yLabel: c.a11yLabel ?? null
            }));
            agentPairs[family.id] = {
                agentId: family.id,
                agentLabel: family.label,
                model: suite?.model || '',
                suiteId: suite?.testId || '',
                date,
                unguided: toRun(slice.unguided),
                guided: toRun(slice.guided),
                checks
            };
        }
        if (Object.keys(agentPairs).length > 0) {
            if (discipline && !guideCategoryMap[def.id]) guideCategoryMap[def.id] = discipline;
            result.push({
                id: def.id,
                label: def.label,
                category: guideCategoryMap[def.id] || discipline || 'ui-behaviors',
                prompt,
                agents: agentPairs
            });
        }
    }
    return result;
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
    if (!sel) {
        renderPending();
        return;
    }
    renderTaskPills(sel.task);
    renderAgentPills(sel.task, sel.pair);
    renderPromptBar(sel.task, sel.pair);
    renderScorecard(sel.task, sel.pair);
    renderChecks(sel.task, sel.pair);
}
/** @param {{ loading?: boolean }} [options] */
function renderPending({ loading = false } = {}) {
    renderTaskPills(null);
    renderAgentPills(null, null);
    const promptEl = document.getElementById('ab-prompt-text');
    if (promptEl) {
        promptEl.textContent = loading ? 'Loading task prompt…' : 'Numbers appear once results are loaded.';
    }
    const metaEl = document.getElementById('ab-run-provenance');
    if (metaEl) metaEl.innerHTML = '<span class="ab-prov-item">Nightly evaluations</span>';
    const naScore = '<span class="ab-score-pct mid"><span aria-hidden="true">—</span><span class="visually-hidden">not available</span></span>';
    const uEl = document.getElementById('ab-score-unguided');
    const gEl = document.getElementById('ab-score-guided');
    if (uEl) {
        uEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge unguided"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span> ${naScore} </div> </div> <div class="ab-check-meter" aria-hidden="true"></div> `;
    }
    if (gEl) {
        gEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge guided"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span> ${naScore} </div> </div> <div class="ab-check-meter" aria-hidden="true"></div> `;
    }
    const checksEl = document.getElementById('ab-checks-content');
    if (checksEl) {
        const naCell = '<span aria-hidden="true">—</span><span class="visually-hidden">not available</span>';
        const rowMsg = loading ? 'Loading…' : 'No data loaded';
        checksEl.innerHTML = ` <div id="ab-checks-table-wrap" class="ab-checks-table-wrap" tabindex="0" role="region" aria-label="Deterministic grader checks"> <table class="ab-checks-table"> <caption class="visually-hidden">Playwright grader assertions comparing unguided and guided runs</caption> <thead> <tr> <th scope="col" class="ab-col-num">#</th> <th scope="col">Grader assertion</th> <th scope="col" class="ab-col-status">Without MWG</th> <th scope="col" class="ab-col-status">With MWG</th> </tr> </thead> <tbody> <tr class="ab-check-row"> <td class="ab-check-num">—</td> <th scope="row" class="ab-check-msg">${rowMsg}</th> <td class="ab-check-cell" data-label="Without MWG">${naCell}</td> <td class="ab-check-cell" data-label="With MWG">${naCell}</td> </tr> </tbody> </table> </div> `;
    }
}
/** @param {HTMLElement} container */
function syncTaskPillsScrollShadows(container) {
    const maxScroll = container.scrollWidth - container.clientWidth;
    container.classList.toggle('has-scroll-left', container.scrollLeft > 4);
    container.classList.toggle('has-scroll-right', maxScroll - container.scrollLeft > 4);
}
/** @param {ShowcaseTask | null} currentTask */
function renderTaskPills(currentTask) {
    const container = document.getElementById('ab-task-pills');
    if (!container) return;
    const list = tasks.length ? tasks : SHOWCASE_TASKS;
    const activeId = currentTask ? currentTask.id : activeTaskId;
    const existingPills = /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll('.ab-task-pill')));
    const sameTasks = existingPills.length === list.length &&
        existingPills.every((el, idx) => el.getAttribute('data-task-id') === list[idx].id);
    if (!sameTasks) {
        container.innerHTML = `<legend class="visually-hidden">Select evaluation task</legend>` + list.map(t => {
            return `<label class="ab-task-pill" data-task-id="${escapeHtml(t.id)}"><input type="radio" name="ab-task" value="${escapeHtml(t.id)}"><span>${escapeHtml(t.label)}</span><span class="ab-task-delta-slot"></span></label>`;
        }).join('');
    }
    container.querySelectorAll('.ab-task-pill').forEach(pill => {
        const taskId = pill.getAttribute('data-task-id');
        const task = tasks.find(t => t.id === taskId);
        const isCurrent = taskId === activeId;
        const input = pill.querySelector('input[type="radio"]');
        if (input instanceof HTMLInputElement) { input.checked = isCurrent; }
        const deltaSlot = pill.querySelector('.ab-task-delta-slot');
        if (deltaSlot) {
            const pair = task ? (task.agents[activeAgentId] || Object.values(task.agents)[0]) : null;
            const bothGraded = Boolean(pair && !pair.unguided.earlyFailure && !pair.guided.earlyFailure);
            const deltaChecks = (pair && bothGraded) ? pair.guided.passed - pair.unguided.passed : 0;
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
/** @param {ShowcaseTask | null} currentTask
 * @param {ShowcaseAgentPair | null} currentPair */
function renderAgentPills(currentTask, currentPair) {
    const container = document.getElementById('ab-agent-pills');
    if (!container) return;
    const orderedFamilies = currentTask
        ? AGENT_FAMILIES.filter(f => currentTask.agents[f.id])
        : AGENT_FAMILIES;
    const activeId = currentPair ? currentPair.agentId : activeAgentId;
    const existingPills = /** @type {HTMLElement[]} */ (Array.from(container.querySelectorAll('.ab-agent-pill')));
    const sameAgents = existingPills.length === orderedFamilies.length &&
        existingPills.every((el, idx) => el.getAttribute('data-agent-id') === orderedFamilies[idx].id);
    if (!sameAgents) {
        container.innerHTML = `<legend class="visually-hidden">Select coding agent</legend>` + orderedFamilies.map(f => {
            return `<label class="ab-agent-pill" data-agent-id="${escapeHtml(f.id)}"><input type="radio" name="ab-agent" value="${escapeHtml(f.id)}">${getAgentBadge(f.id)}${escapeHtml(f.label)}</label>`;
        }).join('');
    }
    container.querySelectorAll('.ab-agent-pill').forEach(pill => {
        const id = pill.getAttribute('data-agent-id');
        const input = pill.querySelector('input[type="radio"]');
        if (input instanceof HTMLInputElement) { input.checked = id === activeId; }
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
    const promptEl = document.getElementById('ab-prompt-text');
    const metaEl = document.getElementById('ab-run-provenance');
    if (promptEl) {
        promptEl.textContent = task.prompt ? `“${task.prompt}”` : 'Task prompt unavailable.';
    }
    if (metaEl) {
        const suiteHref = `dashboard.html?testId=${encodeURIComponent(pair.suiteId)}#guide-${encodeURIComponent(task.id)}`;
        const trendHref = `guide.html?guide=${encodeURIComponent(task.id)}&testId=${encodeURIComponent(pair.suiteId)}`;
        const rawGuides = pair.guided.guidesUsed.length ? pair.guided.guidesUsed : [task.id];
        const cleanGuides = rawGuides.map(g => g.replace(/;+$/, '')).filter(Boolean);
        const guideLinksHtml = cleanGuides.map(slug => {
            const cat = guideCategoryMap[slug] || task.category;
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
    const bothGraded = !u.earlyFailure && !g.earlyFailure;
    const deltaChecks = g.passed - u.passed;
    const deltaSign = deltaChecks > 0 ? `+${deltaChecks}` : (deltaChecks < 0 ? `−${Math.abs(deltaChecks)}` : '0');
    const deltaWord = Math.abs(deltaChecks) === 1 ? 'check' : 'checks';
    const deltaTone = deltaChecks > 0 ? 'good' : (deltaChecks < 0 ? 'cost' : 'flat');
    const deltaGlyph = deltaChecks > 0 ? '▲' : (deltaChecks < 0 ? '▼' : '•');
    const deltaBadgeHtml = bothGraded
        ? `<span class="delta ${deltaTone}"><span class="glyph" aria-hidden="true">${deltaGlyph}</span>${deltaSign} ${deltaWord}</span>`
        : '';
    const uMeterSegs = u.earlyFailure ? '' : pair.checks.map(c => {
        const st = c.unguidedPassed ? 'pass' : 'fail';
        return `<span class="ab-meter-seg ${st}"></span>`;
    }).join('');
    const gMeterSegs = g.earlyFailure ? '' : pair.checks.map(c => {
        const st = c.guidedPassed ? 'pass' : 'fail';
        return `<span class="ab-meter-seg ${st}${c.flipped ? ' is-flipped' : ''}"></span>`;
    }).join('');
    const uTone = u.earlyFailure ? 'low' : scoreTone(u.rate);
    const gTone = g.earlyFailure ? 'low' : scoreTone(g.rate);
    const uFailed = u.total - u.passed;
    const a11yActionHtml = '<span class="visually-hidden">: show accessibility assertions</span>';
    const uA11yHtml = u.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${u.a11yPassed < u.a11yTotal ? 'fail' : 'pass'}">A11y ${u.a11yPassed}/${u.a11yTotal}${a11yActionHtml}</button>`
        : '';
    const gA11yHtml = g.a11yTotal > 0
        ? `<button type="button" class="ab-score-a11y ${g.a11yPassed === g.a11yTotal ? 'pass' : 'fail'}">A11y ${g.a11yPassed}/${g.a11yTotal}${a11yActionHtml}</button>`
        : '';
    uEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge unguided"><span class="legend-dot unguided" aria-hidden="true"></span>Without MWG</span> <span class="ab-score-pct ${uTone}">${u.passed}<span class="ab-score-denom">/${u.total}</span></span> <span class="ab-pass-summary">${u.earlyFailure ? 'run failed before grading' : (uFailed > 0 ? `${uFailed} failed` : 'all passed')}</span> ${uA11yHtml} </div> <span class="ab-score-secondary">${formatDuration(u.runtimeMs)} · ${formatTokens(u.uncachedTokens)}</span> </div> <div class="ab-check-meter" role="img" aria-label="${u.passed} of ${u.total} grader checks passed">${uMeterSegs}</div> `;
    gEl.innerHTML = ` <div class="ab-score-header"> <div class="ab-score-header-main"> <span class="ab-mode-badge guided"><span class="legend-dot guided" aria-hidden="true"></span>With MWG</span> <span class="ab-score-pct ${gTone}">${g.passed}<span class="ab-score-denom">/${g.total}</span></span> ${deltaBadgeHtml} ${g.earlyFailure ? '<span class="ab-pass-summary">run failed before grading</span>' : ''} ${gA11yHtml} </div> <span class="ab-score-secondary">${formatDuration(g.runtimeMs)} · ${formatTokens(g.uncachedTokens)}</span> </div> <div class="ab-check-meter" role="img" aria-label="${g.passed} of ${g.total} grader checks passed">${gMeterSegs}</div> `;
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
    const ungradedCell = '<span aria-hidden="true">—</span><span class="visually-hidden">not graded</span>';
    const rowsHtml = totalChecks > 0 ? pair.checks.map(c => {
        const uBadge = pair.unguided.earlyFailure
            ? ungradedCell
            : (c.unguidedPassed
                ? '<span class="ab-check-status pass"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>'
                : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>');
        const gBadge = pair.guided.earlyFailure
            ? ungradedCell
            : (c.guidedPassed
                ? `<span class="ab-check-status pass${c.flipped ? ' is-flipped' : ''}"><span class="ab-status-glyph" aria-hidden="true">✓</span>Pass</span>`
                : '<span class="ab-check-status fail"><span class="ab-status-glyph" aria-hidden="true">✗</span>Fail</span>');
        const a11yTag = c.isA11y ? `<span class="ab-a11y-tag">A11y · ${escapeHtml(c.a11yLabel || 'Accessibility')}</span>` : '';
        return ` <tr class="ab-check-row${c.flipped ? ' is-flipped' : ''}"${c.isA11y ? ' data-a11y="true"' : ''}> <td class="ab-check-num">${c.index}</td> <th scope="row" class="ab-check-msg"> <span>${escapeHtml(cleanCheckMessage(c.message))}</span> ${a11yTag} </th> <td class="ab-check-cell" data-label="Without MWG">${uBadge}</td> <td class="ab-check-cell" data-label="With MWG">${gBadge}</td> </tr>`;
    }).join('') : ` <tr class="ab-check-row"> <td class="ab-check-num">—</td> <th scope="row" class="ab-check-msg">Run failed before grading</th> <td class="ab-check-cell" data-label="Without MWG">${ungradedCell}</td> <td class="ab-check-cell" data-label="With MWG">${ungradedCell}</td> </tr>`;
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
