import { getAccessToken, isSignInEnabled, escapeHtml, getAgentBadge, formatSuiteDate } from './utils.js';
import { computeHeadlineInsights, hydrateMissingStats } from './insights.js';
import { AGENT_FAMILIES } from './agents.js';
import { isLocalServer } from './data-source.js';
/** @typedef {import('./insights.js').FamilyInsight} FamilyInsight */
/** @typedef {import('./insights.js').HeadlineInsights} HeadlineInsights */
/** @typedef {import('./insights.js').ManifestSuite} ManifestSuite */
/** @typedef {import('./insights.js').RateComparison} RateComparison */
const MAX_MULTI_NIGHTS = 5;
/** @type {Record<string, string>} */
const FAMILY_HINT = { antigravity_cli: 'Gemini' };
const heroEl = /** @type {HTMLElement | null} */ (document.getElementById('hero'));
let heroLoadSeq = 0;
let currentRecentN = 1;
/** @type {{ suites: ManifestSuite[], fetchEvals?: (testId: string) => Promise<import('../harness/lib/metrics.ts').EvalsReport>, onHydrated?: () => void, source?: import('./data-source.js').DataSource } | null} */
let latestHeroInput = null;
document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('auth-btn');
    const heroAuthBtn = document.getElementById('hero-auth-btn');
    if (heroAuthBtn && authBtn) { heroAuthBtn.addEventListener('click', () => authBtn.click()); }
    const methodAgents = document.getElementById('method-agents');
    if (methodAgents) methodAgents.textContent = `: ${joinNames(AGENT_FAMILIES.map(f => f.label))}`;
    const windowToggle = document.getElementById('agents-window-toggle');
    if (windowToggle) {
        windowToggle.addEventListener('change', (e) => {
            const target = e.target;
            if (!(target instanceof HTMLInputElement) || target.name !== 'agents-window') return;
            currentRecentN = Math.max(1, parseInt(target.value, 10) || 1);
            if (latestHeroInput) updateHeroFromSuites(latestHeroInput.suites, latestHeroInput);
        });
    }
});
/**
 * @param {ManifestSuite[]} suites
 * @param {{ fetchEvals?: (testId: string) => Promise<import('../harness/lib/metrics.ts').EvalsReport>, onHydrated?: () => void, source?: import('./data-source.js').DataSource }} [options]
 */
export function updateHeroFromSuites(suites, { fetchEvals, onHydrated, source } = {}) {
    if (!heroEl) return;
    latestHeroInput = { suites, fetchEvals, onHydrated, source };
    const seq = ++heroLoadSeq;
    const isSignedOut = () => (!isLocalServer() || suites.length === 0) && !getAccessToken();
    const emptyStatus = () => {
        if (source === 'public') return suites.length === 0 ? 'public-empty' : 'empty';
        return isSignedOut() ? 'auth' : 'empty';
    };
    if (suites.length === 0 && isSignedOut()) {
        syncWindowToggle(0);
        renderPending();
        setStatus(emptyStatus());
        setBusy(false);
        return;
    }
    let insightOptions = { perAgentRecentN: currentRecentN };
    let insights = computeHeadlineInsights(suites, insightOptions);
    if (insights.maxSuitesPerFamily < 2 && currentRecentN !== 1) {
        currentRecentN = 1;
        insightOptions = { perAgentRecentN: 1 };
        insights = computeHeadlineInsights(suites, insightOptions);
    } else if (currentRecentN > 1) {
        const clamped = Math.min(MAX_MULTI_NIGHTS, insights.maxSuitesPerFamily);
        if (currentRecentN !== clamped) {
            currentRecentN = clamped;
            insightOptions = { perAgentRecentN: currentRecentN };
            insights = computeHeadlineInsights(suites, insightOptions);
        }
    }
    syncWindowToggle(insights.maxSuitesPerFamily);
    if (!insights.families.length) {
        renderPending();
        setStatus(emptyStatus());
        setBusy(false);
        return;
    }
    renderHero(insights);
    setStatus(null);
    if (insights.missingStats.length > 0 && fetchEvals) {
        setBusy(true);
        void hydrateMissingStats(suites, fetchEvals, insightOptions)
            .then(() => {
                if (seq !== heroLoadSeq) return;
                renderHero(computeHeadlineInsights(suites, insightOptions));
                setBusy(false);
                if (onHydrated) onHydrated();
            })
            .catch(() => {
                if (seq === heroLoadSeq) setBusy(false);
            });
    } else {
        setBusy(false);
    }
}
/** @param {number} maxSuitesPerFamily */
function syncWindowToggle(maxSuitesPerFamily) {
    const toggle = document.getElementById('agents-window-toggle');
    const multiRadio = document.getElementById('agents-window-multi');
    const multiLabel = document.getElementById('agents-window-multi-label');
    if (!toggle) return;
    const canToggle = maxSuitesPerFamily >= 2;
    toggle.hidden = !canToggle;
    if (!canToggle) return;
    const multiN = Math.min(MAX_MULTI_NIGHTS, maxSuitesPerFamily);
    if (multiRadio instanceof HTMLInputElement) multiRadio.value = String(multiN);
    if (multiLabel) multiLabel.textContent = `Last ${multiN} nights`;
    const activeVal = currentRecentN > 1 ? String(multiN) : '1';
    toggle.querySelectorAll('input[name="agents-window"]').forEach(el => {
        if (el instanceof HTMLInputElement) el.checked = el.value === activeVal;
    });
}
/** @param {boolean} busy */
function setBusy(busy) { if (heroEl) heroEl.setAttribute('aria-busy', String(busy)); }
/** @param {'auth' | 'empty' | 'public-empty' | null} kind */
function setStatus(kind) {
    const el = document.getElementById('hero-status');
    const text = document.getElementById('hero-status-text');
    const btn = document.getElementById('hero-auth-btn');
    if (!el || !text || !btn) return;
    if (!kind) { el.hidden = true; text.textContent = ''; return; }
    el.hidden = false;
    // The sign-in CTA stays for an empty public copy when ?show_login is set so Googlers
    // can reach internal runs, unless a token is already held (clicking it would sign out).
    btn.hidden = kind === 'empty' || Boolean(getAccessToken()) || !isSignInEnabled();
    const messages = {
        'auth': 'Results live in a private bucket. Sign in with Google to load the latest numbers.',
        'empty': 'No evaluation runs were found for this data source yet.',
        'public-empty': 'No published results yet. Googlers can sign in to see internal runs.'
    };
    text.textContent = messages[kind];
    announce(text.textContent);
}
/** @param {string} message */
function announce(message) {
    const live = document.getElementById('hero-live');
    if (!live) return;
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
}
/** @param {HeadlineInsights} insights */
function renderHero(insights) {
    renderEyebrow(insights);
    renderTakeaways(insights);
    renderAgentTable(insights);
    const el = document.getElementById('method-recent-n');
    const recentN = insights.options.perAgentRecentN;
    if (el) {
        el.textContent = recentN === 1 ? 'latest run per model' : `most recent ${recentN} runs per model`;
    }
    const o = insights.pooled?.overall;
    announce(o && o.upliftPp !== null ? `Latest results loaded: ${signed(o.upliftPp, 0)} percentage points more checks passed with MWG.` : 'Latest results loaded.');
}
function renderPending() {
    const list = document.getElementById('hero-takeaways');
    if (list) {
        list.innerHTML = [
            pendingCard('overall', 'Best-practice pass rate', 'pass-rate lift', true),
            pendingCard('a11y', 'Automated accessibility checks', 'Not a full WCAG audit', false)
        ].join('');
    }
    const body = document.getElementById('agent-table-body');
    if (body) {
        body.innerHTML = `<tr><th scope="row">No data loaded</th><td data-label="Pass rate">${naCell()}</td><td data-label="Accessibility">${naCell()}</td><td data-label="Sample">${naCell()}</td></tr>`;
    }
    const eyebrow = document.getElementById('hero-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Latest runs per model (last 7 days; nightly or 1.0 baseline)';
}
/** @param {HeadlineInsights} insights */
function renderEyebrow(insights) {
    const agentsEl = document.getElementById('hero-lede-agents');
    if (agentsEl && insights.families.length) {
        agentsEl.innerHTML = joinNames(insights.families.map(f => {
            const label = FAMILY_HINT[f.id] ? `${escapeHtml(f.label)} (${escapeHtml(FAMILY_HINT[f.id])})` : escapeHtml(f.label);
            return `<span class="nowrap">${getAgentBadge(f.id)}${label}</span>`;
        }));
    }
    const el = document.getElementById('hero-eyebrow');
    if (!el) return;
    const latest = latestDateOf(insights);
    const recentN = insights.options.perAgentRecentN;
    const label = recentN === 1 ? 'Latest run per model (last 7 days; nightly or 1.0 baseline)' : `Most recent ${recentN} runs per model`;
    el.innerHTML = `<span class="hero-live-dot" aria-hidden="true"></span>${escapeHtml(label)}${latest ? ` · <span class="nowrap">${escapeHtml(formatDate(latest))}</span>` : ''}`;
}
/** @param {number | null} uRate @param {number | null} gRate */
function renderTakeawayDumbbell(uRate, gRate) {
    const u = Math.max(0, Math.min(100, Math.round(uRate || 0)));
    const g = Math.max(0, Math.min(100, Math.round(gRate || 0)));
    const lo = Math.min(u, g);
    const span = Math.max(0, Math.abs(g - u));
    const compactCls = span < 30 ? ' is-compact' : '';
    const regressedCls = g < u ? ' regressed' : '';
    const uAlignCls = u <= g ? ' align-start' : ' align-end';
    const gAlignCls = g >= u ? ' align-end' : ' align-start';
    return ` <div class="takeaway-dumbbell${compactCls}" aria-hidden="true"> <div class="takeaway-dumbbell-endpoints"> <div class="takeaway-endpoint unguided${uAlignCls}" style="--pos: ${u};"> <span class="endpoint-rate">${u}%</span> <span class="endpoint-name">without MWG</span> </div> <div class="takeaway-endpoint guided${gAlignCls}" style="--pos: ${g};"> <strong class="endpoint-rate">${g}%</strong> <span class="endpoint-name">with MWG</span> </div> </div> <div class="suite-dumbbell-track takeaway-track"> <div class="connector${regressedCls}" style="left: ${lo}%; width: ${span}%;"></div> <div class="dot unguided" style="left: ${u}%;"></div> <div class="dot guided" style="left: ${g}%;"></div> </div> <div class="takeaway-dumbbell-scale"> <span>0%</span> <span>50%</span> <span>100%</span> </div> </div>`;
}
/** @param {HeadlineInsights} insights */
function renderTakeaways(insights) {
    const list = document.getElementById('hero-takeaways');
    if (!list) return;
    const pooled = insights.pooled;
    /** @type {string[]} */
    const cards = [];
    if (pooled?.overall && pooled.overall.upliftPp !== null) {
        const o = pooled.overall;
        const recentN = insights.options.perAgentRecentN;
        const mAgents = pooled.familyCount || insights.families.length;
        const statement = taskStatement(insights, recentN);
        const suitesSuffix = recentN > 1 || pooled.suiteCount > mAgents ? ` · ${pooled.suiteCount} ${pooled.suiteCount === 1 ? 'suite' : 'suites'}` : '';
        const overallShortText = `~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} checks · ${mAgents} ${mAgents === 1 ? 'agent' : 'agents'}${suitesSuffix}`;
        cards.push(takeawayCard({
            metric: 'overall',
            primary: true,
            label: 'Best-practice pass rate',
            figure: `<span class="figure-val">${signed(o.upliftPp, 0)}</span><span class="unit"> pp</span>`,
            figureText: `${signed(o.upliftPp, 0)} percentage points`,
            statement,
            visual: renderTakeawayDumbbell(o.unguidedRate, o.guidedRate),
            short: `<span class="visually-hidden">${fmtPct(o.unguidedRate)} → ${fmtPct(o.guidedRate)} · </span><a href="#all-guides" class="takeaway-action-link" data-open-guides="all">${overallShortText} <span aria-hidden="true">→</span></a>`
        }));
    } else {
        cards.push(pendingCard('overall', 'Best-practice pass rate', 'pass-rate lift', true));
    }
    if (!pooled?.a11y || pooled.a11y.upliftPp === null) { cards.push(pendingCard('a11y', 'Automated accessibility checks', 'Not a full WCAG audit', false)); } else {
        const a = pooled.a11y;
        const a11yShortText = `~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} checks${a.guideCount ? ` · ${a.guideCount} ${a.guideCount === 1 ? 'guide' : 'guides'}` : ''} · 5 dimensions`;
        cards.push(takeawayCard({
            metric: 'a11y',
            primary: false,
            label: 'Automated accessibility checks',
            figure: `<span class="figure-val">${signed(a.upliftPp, 0)}</span><span class="unit"> pp</span> <span class="secondary-pair">(${fmtPct(a.unguidedRate)} → <strong>${fmtPct(a.guidedRate)}</strong>)</span>`,
            figureText: `${signed(a.upliftPp, 0)} percentage points (${fmtPct(a.unguidedRate)} to ${fmtPct(a.guidedRate)})`,
            statement: 'Not a full WCAG audit',
            short: `<a href="#a11y-guides" class="takeaway-action-link" data-open-guides="a11y">${a11yShortText} <span aria-hidden="true">→</span></a>`
        }));
    }
    list.innerHTML = cards.join('');
}
/** @param {string} metric
 * @param {string} label
 * @param {string} statement
 * @param {boolean} [primary] */
function pendingCard(metric, label, statement, primary = false) {
    return takeawayCard({
        metric,
        primary,
        label,
        figure: '<span class="unit">—</span>',
        figureText: 'not loaded',
        statement,
        short: 'Numbers appear once results are loaded.'
    });
}
/** @param {{ metric: string, primary?: boolean, label: string, figure: string, figureText: string, statement?: string, visual?: string, short: string }} c */
function takeawayCard(c) {
    const roleCls = c.primary ? 'takeaway takeaway-primary' : 'takeaway takeaway-secondary';
    return ` <li class="${roleCls}" data-metric="${c.metric}"> <h3 class="takeaway-label">${c.label}</h3> <p class="takeaway-figure"><span aria-hidden="true">${c.figure}</span><span class="visually-hidden">${escapeHtml(c.figureText)}</span></p> ${c.statement ? `<p class="takeaway-statement">${c.statement}</p>` : ''}
            ${c.visual || ''} <p class="takeaway-qualifier takeaway-qualifier-short">${c.short}</p> </li>`;
}
/** @param {HeadlineInsights} insights @param {number} recentN */
function taskStatement(insights, recentN) {
    const counts = insights.families.map(f => f.sample.pairedTasks).filter(n => n > 0);
    if (counts.length === 0) return 'pass-rate lift';
    const total = counts.reduce((sum, n) => sum + n, 0);
    if (recentN > 1 || (insights.pooled?.suiteCount || 0) > insights.families.length) {
        return `lift across ${fmtInt(total)} task ${total === 1 ? 'run' : 'runs'}`;
    }
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (min !== max) return `lift across ${fmtInt(min)}–${fmtInt(max)} tasks`;
    return `lift across ${fmtInt(max)} ${max === 1 ? 'task' : 'tasks'}`;
}
/** @param {HeadlineInsights} insights */
function renderAgentTable(insights) {
    const body = document.getElementById('agent-table-body');
    const caption = document.getElementById('agent-table-caption');
    const windowNote = document.getElementById('hero-agents-window-note');
    if (!body) return;
    const n = insights.options.perAgentRecentN;
    if (caption) {
        caption.textContent = n === 1
            ? 'Latest run per model (last 7 days; nightly or 1.0 baseline) by agent family. Unguided → guided; change in percentage points (pp).'
            : `Most recent ${n} runs per model by agent family, pooled. Unguided → guided; change in percentage points (pp).`;
    }
    if (windowNote) {
        windowNote.textContent = n === 1
            ? 'Latest run per model (models run in the last 7 days; nightly or 1.0 baseline).'
            : `Last ${n} runs per model pooled.`;
    }
    body.innerHTML = insights.families.map(f => {
        const overall = rateCell(f, f.overall, false);
        const a11y = rateCell(f, f.a11y, true);
        return ` <tr> <th scope="row">${getAgentBadge(f.id)}${escapeHtml(f.label)}</th> <td data-label="Pass rate"${overall.attrs}>${overall.html}</td> <td data-label="Accessibility"${a11y.attrs}>${a11y.html}</td> <td data-label="Sample">${sampleCell(f)}</td> </tr>`;
    }).join('');
}
/** @param {FamilyInsight} f @param {boolean} isA11y */
function singleSuiteHref(f, isA11y) {
    if (f.suiteCount !== 1 || !f.latest.source) return '';
    const base = `dashboard.html?testId=${encodeURIComponent(f.latest.testId)}&source=${encodeURIComponent(f.latest.source)}`;
    return isA11y ? `${base}&mode=a11y&sort=a11y-desc` : base;
}
/** @param {RateComparison} r */
function checksCountText(r) {
    const u = r.unguidedTotal || 0;
    const g = r.guidedTotal || 0;
    if (u === 0 && g === 0) return '';
    if (u === g) return `${fmtInt(g)} ${g === 1 ? 'check' : 'checks'}`;
    return `${fmtInt(u)} / ${fmtInt(g)} checks`;
}
/** @param {FamilyInsight} f @param {RateComparison | null} r @param {boolean} isA11y
 * @returns {{ attrs: string, html: string }} */
function rateCell(f, r, isA11y) {
    if (!r || (r.guidedTotal === 0 && r.unguidedTotal === 0)) return { attrs: '', html: naCell() };
    const checksText = checksCountText(r);
    const stackHtml = ` <div class="agent-cell-stack"> <div class="metric-main"> <span class="metric-pair">${fmtPct(r.unguidedRate)} → <strong>${fmtPct(r.guidedRate)}</strong></span> ${r.upliftPp === null ? naCell() : deltaChip(r.upliftPp)} </div> <span class="metric-sub">${escapeHtml(checksText)}</span> </div>`;
    const href = singleSuiteHref(f, isA11y);
    const subParts = isA11y
        ? ['Automated accessibility checks', f.a11y?.guideCount ? `${f.a11y.guideCount} ${f.a11y.guideCount === 1 ? 'guide' : 'guides'}` : '']
        : ['Pass rate', sampleSummaryText(f)];
    const uDetail = r.unguidedTotal > 0 ? `${fmtInt(r.unguidedPassed)}/${fmtInt(r.unguidedTotal)} checks` : '';
    const gDetail = r.guidedTotal > 0 ? `${fmtInt(r.guidedPassed)}/${fmtInt(r.guidedTotal)} checks` : '';
    const upliftRounded = r.upliftPp === null ? '' : String(Math.sign(r.upliftPp) * Math.round(Math.abs(r.upliftPp)));
    const attrs = ` data-barbell-title="${escapeHtml(f.label)}" data-barbell-sub="${escapeHtml(subParts.filter(Boolean).join(' · '))}" data-barbell-kind="${isA11y ? 'agent-a11y' : 'agent-overall'}" data-barbell-u="${r.unguidedRate === null ? '' : Math.round(r.unguidedRate)}" data-barbell-g="${r.guidedRate === null ? '' : Math.round(r.guidedRate)}" data-barbell-uplift="${upliftRounded}" data-barbell-u-detail="${escapeHtml(uDetail)}" data-barbell-g-detail="${escapeHtml(gDetail)}"`;
    const html = href
        ? `<a href="${escapeHtml(href)}" class="agent-rate-trigger" interestfor="barbell-tooltip">${stackHtml}</a>`
        : `<button type="button" class="agent-rate-trigger" interestfor="barbell-tooltip">${stackHtml}</button>`;
    return { attrs, html };
}
/** @param {FamilyInsight} f */
function sampleTasksLabel(f) {
    const s = f.sample;
    if (s.excludedTasks > 0) return `${fmtInt(s.pairedTasks)}/${fmtInt(s.attemptedTasks)} tasks`;
    if (s.pairedTasks > 0) return `${fmtInt(s.pairedTasks)} ${s.pairedTasks === 1 ? 'task' : 'tasks'}`;
    return '';
}
/** @param {FamilyInsight} f */
function sampleRunsPerTaskLabel(f) {
    const s = f.sample;
    if (s.pairedTasks === 0 && s.attemptedTasks === 0) return '';
    return s.minMaxRuns === s.maxMaxRuns ? `×${s.maxMaxRuns}/task` : `×${s.minMaxRuns}–${s.maxMaxRuns}/task`;
}
/** @param {FamilyInsight} f */
function sampleSummaryText(f) {
    const allNightly = f.suites.every(s => !s.curated && s.testId.startsWith('nightly-'));
    return [
        f.suiteCount > 1 ? `${f.suiteCount} ${allNightly ? 'nights' : 'runs'}` : '',
        sampleTasksLabel(f),
        sampleRunsPerTaskLabel(f)
    ].filter(Boolean).join(' · ');
}
/** @param {FamilyInsight} f */
function sampleCell(f) {
    const s = f.sample;
    const allNightly = f.suites.every(suite => !suite.curated && suite.testId.startsWith('nightly-'));
    const countNoun = allNightly ? (f.suiteCount === 1 ? 'night' : 'nights') : (f.suiteCount === 1 ? 'run' : 'runs');
    const primaryParts = [
        f.suiteCount > 1 ? `<span class="sample-nights">${f.suiteCount} ${countNoun}</span>` : '',
        escapeHtml(sampleTasksLabel(f)),
        escapeHtml(sampleRunsPerTaskLabel(f)),
        s.earlyFailureCount !== null && s.earlyFailureCount > 0
            ? `<span class="sample-warn">${escapeHtml(`${fmtInt(s.earlyFailureCount)} err`)}</span>`
            : (s.earlyFailureRate > 0 ? `<span class="sample-warn">${escapeHtml(`${s.earlyFailureRate}% err`)}</span>` : ''),
        s.pageLoadFailed > 0 ? `<span class="sample-warn">${escapeHtml(`${fmtInt(s.pageLoadFailed)} page-load`)}</span>` : '',
        s.unguidedLeakRate > 0 ? `<span class="sample-leak">${escapeHtml(`${s.unguidedLeakRate}% leak`)}</span>` : ''
    ].filter(Boolean);
    const runsListHtml = f.suites.map(suite => {
        const model = shortModelName(suite.model);
        const effort = suite.reasoningEffort?.level ? ` (${suite.reasoningEffort.level})` : '';
        const date = formatDateShort(suite.timestamp);
        const badge = suite.curated ? ' <span class="run-kind-badge curated">1.0 baseline</span>' : '';
        return `<span class="sample-run-pill">${escapeHtml(model)}${escapeHtml(effort)} · <time>${escapeHtml(date)}</time>${badge}</span>`;
    }).join(' · ');
    return ` <div class="agent-cell-stack"> <span class="agent-sample-main">${primaryParts.join(' · ')}</span> ${runsListHtml ? `<span class="metric-sub">${runsListHtml}</span>` : ''} </div>`;
}
/** @param {number} v */
function fmtInt(v) { return Math.round(v || 0).toLocaleString('en-US'); }
function naCell() { return '<span class="na"><span aria-hidden="true">—</span><span class="visually-hidden">not available</span></span>'; }
/** @param {number} value */
function deltaChip(value) {
    const rounded = Math.sign(value) * Math.round(Math.abs(value || 0));
    const isFlat = rounded === 0;
    const isGood = rounded > 0;
    const cls = isFlat ? 'flat' : (isGood ? 'good' : 'cost');
    const glyph = isFlat ? '•' : (rounded > 0 ? '▲' : '▼');
    const visible = `${signed(rounded, 0)} pp`;
    const sr = isFlat ? 'no change' : `${rounded > 0 ? 'up' : 'down'} ${Math.abs(rounded)} percentage points${isGood ? ', better' : ', worse'}`;
    return `<span class="delta ${cls}"><span class="glyph" aria-hidden="true">${glyph}</span><span aria-hidden="true">${visible}</span><span class="visually-hidden">${sr}</span></span>`;
}
/** @param {HeadlineInsights} insights */
function latestDateOf(insights) { return insights.latestTimestamp || ''; }
/** @param {string} model */
function shortModelName(model) { return (model || '').replace(/^(claude-|gemini-)/i, ''); }
/** @param {string} iso */
function formatDateShort(iso) {
    const formatted = formatSuiteDate(iso, { month: 'short', day: 'numeric' });
    return formatted === '-' ? iso : formatted;
}
/** @param {number} v */
function fmtCompact(v) {
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.round(v || 0)).toLowerCase();
}
/** @param {string[]} names */
function joinNames(names) {
    if (names.length <= 1) return names.join('');
    if (names.length === 2) return `${names[0]} and ${names[1]}`;
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}
/** @param {number | null} v @param {number} digits */
function signed(v, digits) {
    if (v === null) return '—';
    const r = Math.sign(v || 0) * Number(Math.abs(v || 0).toFixed(digits));
    if (r > 0) return `+${r}`;
    if (r < 0) return `−${Math.abs(r)}`;
    return '0';
}
/** @param {number | null} v */
function fmtPct(v) {
    if (v === null) return '—';
    return `${Math.round(v || 0)}%`;
}
/** @param {string} iso */
function formatDate(iso) {
    const formatted = formatSuiteDate(iso, { month: 'short', day: 'numeric', year: 'numeric' });
    return formatted === '-' ? iso : formatted;
}
