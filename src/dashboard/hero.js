/**
 * Hero / headline takeaways for the landing page.
 */
import { getAccessToken, escapeHtml, getAgentBadge, parseSuiteDate, formatSuiteDate } from './utils.js';
import { ApiClient } from './api.js';

/** @typedef {import('./insights.js').HeadlineInsights} HeadlineInsights */
/** @typedef {import('./insights.js').RateComparison} RateComparison */

/** @type {Record<string, string>} */
const FAMILY_HINT = { antigravity_cli: 'Gemini' };

const api = new ApiClient();
const heroEl = /** @type {HTMLElement | null} */ (document.getElementById('hero'));
let heroLoadSeq = 0;

document.addEventListener('DOMContentLoaded', () => {
    if (!heroEl) return;
    void loadAndRender();

    const authBtn = document.getElementById('auth-btn');
    const heroAuthBtn = document.getElementById('hero-auth-btn');
    if (heroAuthBtn && authBtn) {
        heroAuthBtn.addEventListener('click', () => authBtn.click());
    }
    window.addEventListener('mwg:auth-changed', (e) => {
        const authenticated = Boolean(/** @type {CustomEvent<{ authenticated?: boolean }>} */ (e).detail?.authenticated);
        if (authenticated) {
            void loadAndRender();
        } else if (api.source === 'remote') {
            renderPending();
            setStatus('auth');
            setBusy(false);
        }
    });
});

async function loadAndRender() {
    if (!heroEl) return;
    const seq = ++heroLoadSeq;
    setBusy(true);
    setStatus(null);

    const isSignedOut = () => api.source === 'remote' && !getAccessToken();
    if (isSignedOut()) {
        renderPending();
        setStatus('auth');
        setBusy(false);
        return;
    }

    /** @param {HeadlineInsights} insights */
    const paint = (insights) => {
        if (seq !== heroLoadSeq) return;
        const signedOutNow = isSignedOut();
        if (!insights || !insights.families.length) {
            renderPending();
            setStatus(signedOutNow ? 'auth' : 'empty');
            return;
        }
        renderHero(insights);
        setStatus(signedOutNow ? 'auth-snapshot' : null);
    };

    try {
        const insights = await api.getHeadlineInsights({
            onUpdate: (final) => {
                if (seq !== heroLoadSeq) return;
                paint(final);
                setBusy(false);
            }
        });
        if (seq !== heroLoadSeq) return;
        if (api.source === 'local' && !insights.families.length) {
            const { suites = [] } = await api.getManifest();
            if (seq !== heroLoadSeq) return;
            if (suites.length === 0) {
                api.source = 'remote';
                if (!getAccessToken()) {
                    renderPending();
                    setStatus('auth');
                    setBusy(false);
                    return;
                }
                const remoteInsights = await api.getHeadlineInsights({
                    onUpdate: (final) => {
                        if (seq !== heroLoadSeq) return;
                        paint(final);
                        setBusy(false);
                    }
                });
                if (seq !== heroLoadSeq) return;
                paint(remoteInsights);
                if (remoteInsights.missingStats.length > 0) return;
                setBusy(false);
                return;
            }
        }
        paint(insights);
        if (insights.missingStats.length > 0) return;
    } catch (err) {
        if (seq !== heroLoadSeq) return;
        const signedOutNow = isSignedOut();
        if (!signedOutNow) console.error('Hero: failed to load headline insights', err);
        renderPending();
        setStatus(signedOutNow ? 'auth' : 'error');
    }
    if (seq === heroLoadSeq) {
        setBusy(false);
    }
}

/** @param {boolean} busy */
function setBusy(busy) {
    if (heroEl) heroEl.setAttribute('aria-busy', String(busy));
}

/** @param {'auth' | 'auth-snapshot' | 'empty' | 'error' | null} kind */
function setStatus(kind) {
    const el = document.getElementById('hero-status');
    const text = document.getElementById('hero-status-text');
    const btn = document.getElementById('hero-auth-btn');
    if (!el || !text || !btn) return;
    if (!kind) {
        el.hidden = true;
        text.textContent = '';
        return;
    }
    el.hidden = false;
    btn.hidden = !kind.startsWith('auth');
    /** @type {Record<string, string>} */
    const messages = {
        'auth': 'Results live in a private bucket. Sign in with Google to load the latest nightly numbers.',
        'auth-snapshot': 'Showing the last published snapshot. Sign in with Google to load the latest nightly numbers.',
        'empty': 'No nightly evaluation runs were found for this data source yet.',
        'error': 'Could not load the latest results. Reload to try again.'
    };
    text.textContent = messages[kind] || messages.error;
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
        el.textContent = recentN === 1 ? 'latest nightly run' : `most recent ${recentN} nightly runs`;
    }
    const o = insights.pooled?.overall;
    announce(o ? `Latest results loaded: ${signed(o.upliftPp, 0)} percentage points more checks passed with MWG.` : 'Latest results loaded.');
}

function renderPending() {
    const list = document.getElementById('hero-takeaways');
    if (list) {
        list.innerHTML = [
            pendingCard('overall', 'Change in aggregate pass rate of using best practices', 'percentage-point lift', true),
            pendingCard('a11y', 'Accessibility', '', false)
        ].join('');
    }
    const body = document.getElementById('agent-table-body');
    if (body) {
        body.innerHTML = `<tr><th scope="row">No data loaded</th><td data-label="Pass rate">${naCell()}</td><td data-label="Accessibility">${naCell()}</td><td data-label="Runs">${naCell()}</td></tr>`;
    }
    const eyebrow = document.getElementById('hero-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Nightly evaluations';
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
    const n = insights.pooled?.suiteCount || 0;
    const detail = n > 0 ? `<span class="eyebrow-detail"> · ${n} recent ${n === 1 ? 'run' : 'runs'} across ${insights.families.length} agent ${insights.families.length === 1 ? 'family' : 'families'}</span>` : '';
    el.innerHTML = `<span class="hero-live-dot" aria-hidden="true"></span>Nightly evaluations${detail}${latest ? ` · latest data <span class="nowrap">${escapeHtml(formatDate(latest))}</span>` : ''}`;
}

/** @param {number} uRate @param {number} gRate */
function renderTakeawayDumbbell(uRate, gRate) {
    const u = Math.max(0, Math.min(100, Math.round(uRate || 0)));
    const g = Math.max(0, Math.min(100, Math.round(gRate || 0)));
    const lo = Math.min(u, g);
    const span = Math.max(0, Math.abs(g - u));
    const compactCls = span < 30 ? ' is-compact' : '';
    const regressedCls = g < u ? ' regressed' : '';
    const uAlignCls = u <= g ? ' align-start' : ' align-end';
    const gAlignCls = g >= u ? ' align-end' : ' align-start';
    return `
        <div class="takeaway-dumbbell${compactCls}" aria-hidden="true">
            <div class="takeaway-dumbbell-endpoints">
                <div class="takeaway-endpoint unguided${uAlignCls}" style="--pos: ${u};">
                    <span class="endpoint-rate">${u}%</span>
                    <span class="endpoint-name">without MWG</span>
                </div>
                <div class="takeaway-endpoint guided${gAlignCls}" style="--pos: ${g};">
                    <strong class="endpoint-rate">${g}%</strong>
                    <span class="endpoint-name">with MWG</span>
                </div>
            </div>
            <div class="suite-dumbbell-track takeaway-track">
                <div class="connector${regressedCls}" style="left: ${lo}%; width: ${span}%;"></div>
                <div class="dot unguided" style="left: ${u}%;"></div>
                <div class="dot guided" style="left: ${g}%;"></div>
            </div>
            <div class="takeaway-dumbbell-scale">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
            </div>
        </div>`;
}

/** @param {HeadlineInsights} insights */
function renderTakeaways(insights) {
    const list = document.getElementById('hero-takeaways');
    if (!list) return;

    const pooled = insights.pooled;
    /** @type {string[]} */
    const cards = [];

    if (pooled?.overall) {
        const o = pooled.overall;
        const taskCounts = insights.families.flatMap(f => f.suites.map(s => s.taskCount || 0)).filter(n => n > 0);
        const yTasks = taskCounts.length > 0 ? Math.max(...taskCounts) : 0;
        const nRuns = pooled.suiteCount || 0;
        const mAgents = pooled.familyCount || insights.families.length;
        const scopeClause = yTasks > 0
            ? `, across ${yTasks} ${yTasks === 1 ? 'task' : 'tasks'} over ${nRuns} ${nRuns === 1 ? 'run' : 'runs'} and ${mAgents} ${mAgents === 1 ? 'agent' : 'agents'}.`
            : '';
        const overallShortText = `~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} checks · ${nRuns} nightly ${nRuns === 1 ? 'run' : 'runs'}`;
        cards.push(takeawayCard({
            metric: 'overall',
            primary: true,
            label: `Change in aggregate pass rate of using best practices${scopeClause}`,
            figure: `<span class="figure-val">${signed(o.upliftPp, 0)}</span><span class="unit"> pp</span>`,
            figureText: `${signed(o.upliftPp, 0)} percentage points`,
            statement: 'percentage-point lift',
            visual: renderTakeawayDumbbell(o.unguidedRate, o.guidedRate),
            short: `<span class="visually-hidden">${fmtPct(o.unguidedRate)} → ${fmtPct(o.guidedRate)} · </span><a href="#all-guides" class="takeaway-action-link" data-open-guides="all">${overallShortText} <span aria-hidden="true">→</span></a>`
        }));
    }

    if (!pooled?.a11y) {
        cards.push(pendingCard('a11y', 'Accessibility', '', false));
    } else {
        const a = pooled.a11y;
        const a11yShortText = `~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} a11y checks${a.guideCount ? ` across ${a.guideCount} guides` : ''}`;
        cards.push(takeawayCard({
            metric: 'a11y',
            primary: false,
            label: 'Accessibility',
            figure: `<span class="figure-val">${signed(a.upliftPp, 0)}</span><span class="unit"> pp</span> <span class="secondary-pair">(${fmtPct(a.unguidedRate)} → <strong>${fmtPct(a.guidedRate)}</strong>)</span>`,
            figureText: `${signed(a.upliftPp, 0)} percentage points (${fmtPct(a.unguidedRate)} to ${fmtPct(a.guidedRate)})`,
            short: `<a href="#a11y-guides" class="takeaway-action-link" data-open-guides="a11y">${a11yShortText} <span aria-hidden="true">→</span></a>`
        }));
    }

    list.innerHTML = cards.join('');
}

/**
 * @param {string} metric
 * @param {string} label
 * @param {string} statement
 * @param {boolean} [primary]
 */
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
    return `
        <li class="${roleCls}" data-metric="${c.metric}">
            <h3 class="takeaway-label">${c.label}</h3>
            <p class="takeaway-figure"><span aria-hidden="true">${c.figure}</span><span class="visually-hidden">${escapeHtml(c.figureText)}</span></p>
            ${c.statement ? `<p class="takeaway-statement">${c.statement}</p>` : ''}
            ${c.visual || ''}
            <p class="takeaway-qualifier takeaway-qualifier-short">${c.short}</p>
        </li>`;
}

/** @param {HeadlineInsights} insights */
function renderAgentTable(insights) {
    const body = document.getElementById('agent-table-body');
    const caption = document.getElementById('agent-table-caption');
    if (!body) return;

    const n = insights.options.perAgentRecentN;
    if (caption) {
        caption.textContent = `Latest ${n} nightly ${n === 1 ? 'run' : 'runs'} per agent family, pooled. Unguided → guided; change in percentage points (pp).`;
    }

    body.innerHTML = insights.families.map(f => {
        const metaParts = [
            `${f.suiteCount} ${f.suiteCount === 1 ? 'run' : 'runs'}`,
            f.models.length ? f.models.map(shortModelName).join(', ') : '',
            f.latest?.timestamp ? formatDateShort(f.latest.timestamp) : ''
        ].filter(Boolean).join(' · ');

        return `
            <tr>
                <th scope="row">${getAgentBadge(f.id)}${escapeHtml(f.label)}</th>
                <td data-label="Pass rate">${rateCell(f.overall)}</td>
                <td data-label="Accessibility">${rateCell(f.a11y)}</td>
                <td data-label="Runs"><span class="agent-meta-inline">${escapeHtml(metaParts)}</span></td>
            </tr>`;
    }).join('');
}

/** @param {RateComparison | null} r */
function rateCell(r) {
    if (!r || (r.guidedTotal === 0 && r.unguidedTotal === 0)) return naCell();
    return `
        <div class="metric-main">
            <span class="metric-pair">${fmtPct(r.unguidedRate)} → <strong>${fmtPct(r.guidedRate)}</strong></span>
            ${deltaChip(r.upliftPp)}
        </div>`;
}

function naCell() {
    return '<span class="na"><span aria-hidden="true">—</span><span class="visually-hidden">not available</span></span>';
}

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
function latestDateOf(insights) {
    // Keep the full instant: slicing to YYYY-MM-DD would show the UTC day, which can
    // disagree with the runs table (viewer's zone) for the ~07:00 UTC nightly runs.
    return insights.latestTimestamp || '';
}

/** @param {string} model */
function shortModelName(model) {
    return (model || '').replace(/^(claude-|gemini-)/i, '');
}

/** @param {string} iso */
function formatDateShort(iso) {
    const d = parseSuiteDate(iso);
    if (!d) return iso;
    return formatSuiteDate(d, { month: 'short', day: 'numeric' });
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

/** @param {number} v @param {number} digits */
function signed(v, digits) {
    const r = Math.sign(v || 0) * Number(Math.abs(v || 0).toFixed(digits));
    if (r > 0) return `+${r}`;
    if (r < 0) return `−${Math.abs(r)}`;
    return '0';
}

/** @param {number} v */
function fmtPct(v) {
    return `${Math.round(v || 0)}%`;
}

/** @param {string} iso */
function formatDate(iso) {
    const d = parseSuiteDate(iso);
    if (!d) return iso;
    return formatSuiteDate(d, { month: 'short', day: 'numeric', year: 'numeric' });
}
