/**
 * Hero / headline takeaways for the landing page.
 *
 * Loads the suites manifest (same sources as landing.js: local dev server,
 * static suites.gen.json, or the private GCS bucket after Google sign-in),
 * reduces it to headline insights via `computeHeadlineInsights()` from
 * ./insights.js, and renders the four takeaway cards, the per-agent
 * comparison table, and the numbers inside the "How we measure" disclosure.
 *
 * The hero never touches the browse UI below it (landing.js owns that).
 */
import { authenticatedFetch, getAccessToken, escapeHtml, formatDuration, formatTokens, isLocalDashboardHost } from './utils.js';
import { ApiClient } from './api.js';
import { computeHeadlineInsights, hydrateMissingStats } from './insights.js';

/** @typedef {import('./insights.js').HeadlineInsights} HeadlineInsights */
/** @typedef {import('./insights.js').FamilyInsight} FamilyInsight */
/** @typedef {import('./insights.js').RateComparison} RateComparison */
/** @typedef {import('./insights.js').RuntimeInsight} RuntimeInsight */
/** @typedef {import('./insights.js').TokenInsight} TokenInsight */
/** @typedef {import('./insights.js').ManifestSuite} ManifestSuite */

const GCS_MANIFEST_URL = 'https://storage.googleapis.com/storage/v1/b/guidance-evals/o/suites.gen.json?alt=media';

/**
 * Optional pre-computed snapshot (same shape as `computeHeadlineInsights()` output) that a
 * build step can publish next to index.html so the public page has real numbers before
 * sign-in. Silently ignored when absent.
 */
const SNAPSHOT_URL = 'headline-insights.gen.json';

const api = new ApiClient();
const heroEl = /** @type {HTMLElement | null} */ (document.getElementById('hero'));

document.addEventListener('DOMContentLoaded', () => {
    if (!heroEl) return;
    void loadAndRender();

    // Remote data needs a Google access token. landing.js owns the sign-in
    // button; the hero just mirrors it and reacts once a token shows up.
    const authBtn = document.getElementById('auth-btn');
    const heroAuthBtn = document.getElementById('hero-auth-btn');
    if (heroAuthBtn && authBtn) {
        heroAuthBtn.addEventListener('click', () => authBtn.click());
    }
    if (authBtn) {
        authBtn.addEventListener('click', () => waitForToken().then(ok => { if (ok) void loadAndRender(); }));
    }
});

/**
 * Resolves true when an access token becomes available (polls the shared state in utils.js).
 * @param {number} [timeoutMs]
 * @returns {Promise<boolean>}
 */
function waitForToken(timeoutMs = 120000) {
    const start = Date.now();
    return new Promise(resolve => {
        const tick = () => {
            if (getAccessToken()) return resolve(true);
            if (Date.now() - start > timeoutMs) return resolve(false);
            setTimeout(tick, 400);
        };
        tick();
    });
}

/**
 * Fetches manifest entries for the active data source.
 * @returns {Promise<{ suites: ManifestSuite[], needsAuth: boolean }>}
 */
async function fetchManifest() {
    if (api.source === 'remote') {
        if (!getAccessToken()) return { suites: [], needsAuth: true };
        const res = await authenticatedFetch(`${GCS_MANIFEST_URL}&t=${Date.now()}`);
        if (res.status === 401 || res.status === 403) return { suites: [], needsAuth: true };
        if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
        const data = await res.json();
        return { suites: Array.isArray(data) ? data : (data.suites || []), needsAuth: false };
    }

    // Local dev server first; fall back to the static manifest (static mode / Pages preview).
    if (api.source === 'local' && isLocalDashboardHost()) {
        try {
            const res = await fetch(`/api/suites?t=${Date.now()}`);
            if (res.ok) {
                const data = await res.json();
                return { suites: data.suites || [], needsAuth: false };
            }
        } catch {
            /* fall through to static */
        }
    }
    const res = await fetch(`${api.source === 'static' ? 'suites.gen.json' : '/suites.gen.json'}?t=${Date.now()}`);
    if (!res.ok) throw new Error(`Manifest request failed (${res.status})`);
    const data = await res.json();
    return { suites: Array.isArray(data) ? data : (data.suites || []), needsAuth: false };
}

/**
 * @returns {Promise<HeadlineInsights | null>}
 */
async function fetchSnapshot() {
    try {
        const res = await fetch(SNAPSHOT_URL, { cache: 'no-cache' });
        if (!res.ok) return null;
        const data = await res.json();
        return data && Array.isArray(data.families) && data.families.length ? data : null;
    } catch {
        return null;
    }
}

async function loadAndRender() {
    if (!heroEl) return;
    setBusy(true);
    setStatus(null);

    try {
        const { suites, needsAuth } = await fetchManifest().catch(err => {
            console.warn('Hero: manifest unavailable', err);
            return { suites: /** @type {ManifestSuite[]} */ ([]), needsAuth: false };
        });

        /** @type {HeadlineInsights | null} */
        let insights = null;
        if (suites.length > 0) {
            // Manifests written before a11y/efficiency stats existed are hydrated from evals.json
            // for just the suites the hero needs (latest N per family).
            await hydrateMissingStats(suites, id => api.getEvals(id)).catch(() => ({ hydrated: [], failed: [] }));
            insights = computeHeadlineInsights(suites);
            if (!insights.families.length) insights = null;
        }

        if (!insights) {
            const snapshot = await fetchSnapshot();
            if (snapshot) {
                renderHero(snapshot, { snapshot: true });
                setStatus(needsAuth ? 'auth-snapshot' : null);
                return;
            }
            renderPending();
            setStatus(needsAuth ? 'auth' : 'empty');
            return;
        }

        renderHero(insights, { snapshot: false });
    } catch (err) {
        console.error('Hero: failed to render', err);
        renderPending();
        setStatus('error');
    } finally {
        setBusy(false);
    }
}

/** @param {boolean} busy */
function setBusy(busy) {
    if (!heroEl) return;
    heroEl.setAttribute('aria-busy', String(busy));
}

/**
 * @param {'auth' | 'auth-snapshot' | 'empty' | 'error' | null} kind
 */
function setStatus(kind) {
    const el = document.getElementById('hero-status');
    const text = document.getElementById('hero-status-text');
    const btn = document.getElementById('hero-auth-btn');
    if (!el || !text || !btn) return;
    if (!kind) {
        el.hidden = true;
        return;
    }
    el.hidden = false;
    btn.hidden = !kind.startsWith('auth');
    switch (kind) {
        case 'auth':
            text.textContent = 'Results live in a private bucket. Sign in with Google to load the latest nightly numbers.';
            break;
        case 'auth-snapshot':
            text.textContent = 'Showing the last published snapshot. Sign in with Google to load the latest nightly numbers.';
            break;
        case 'empty':
            text.textContent = 'No nightly evaluation runs were found for this data source yet.';
            break;
        case 'error':
        default:
            text.textContent = 'Could not load the latest results. Reload to try again.';
            break;
    }
}

// ==========================================
// RENDERING
// ==========================================

/**
 * @param {HeadlineInsights} insights
 * @param {{ snapshot: boolean }} opts
 */
function renderHero(insights, opts) {
    renderEyebrow(insights, opts);
    renderTakeaways(insights);
    renderAgentTable(insights);
    renderMethodNumbers(insights);
}

/** Placeholder content when no numbers are available (pre sign-in, empty source, error). */
function renderPending() {
    const list = document.getElementById('hero-takeaways');
    if (list) {
        list.innerHTML = [
            ['overall', 'Web best practices', 'more best-practice checks passed with MWG'],
            ['a11y', 'Accessibility', 'more accessibility checks passed with MWG'],
            ['tokens', 'Tokens', 'fewer uncached tokens per task for some agents'],
            ['time', 'Time', 'faster task completion for some agents']
        ].map(([metric, label, statement]) => takeawayCard({
            metric, label,
            figure: '<span class="unit">—</span>',
            figureText: 'not loaded',
            statement,
            qualifier: 'Numbers appear once results are loaded.'
        })).join('');
    }
    const body = document.getElementById('agent-table-body');
    if (body) {
        body.innerHTML = `<tr><th scope="row">No data loaded</th><td data-label="Pass rate">${naCell()}</td><td data-label="Accessibility">${naCell()}</td><td data-label="Median time">${naCell()}</td><td data-label="Median uncached tokens">${naCell()}</td></tr>`;
    }
    const eyebrow = document.getElementById('hero-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Nightly evaluations';
}

/**
 * @param {HeadlineInsights} insights
 * @param {{ snapshot: boolean }} opts
 */
function renderEyebrow(insights, opts) {
    const agentsEl = document.getElementById('hero-lede-agents');
    if (agentsEl && insights.families.length) agentsEl.textContent = joinNames(insights.families.map(f => f.label));
    const el = document.getElementById('hero-eyebrow');
    if (!el) return;
    const latest = latestDateOf(insights);
    const n = insights.pooled?.suiteCount || 0;
    const parts = ['Nightly evaluations'];
    if (n > 0) parts.push(`${n} recent ${n === 1 ? 'run' : 'runs'} across ${insights.families.length} agent ${insights.families.length === 1 ? 'family' : 'families'}`);
    if (latest) parts.push(`${opts.snapshot ? 'snapshot through' : 'latest data'} ${formatDate(latest)}`);
    el.textContent = parts.join(' · ');
}

/** @param {HeadlineInsights} insights */
function renderTakeaways(insights) {
    const list = document.getElementById('hero-takeaways');
    if (!list) return;

    const pooled = insights.pooled;
    const fams = insights.families;
    const familyNames = joinNames(fams.map(f => f.label));
    const runsPhrase = describeRuns(insights);

    /** @type {string[]} */
    const cards = [];

    // 1. Web best practices (overall pass rate, pooled across families)
    if (pooled?.overall) {
        const o = pooled.overall;
        cards.push(takeawayCard({
            metric: 'overall',
            label: 'Web best practices',
            figure: `${signed(o.upliftPp, 0)}<span class="unit"> pp</span>`,
            figureText: `${signed(o.upliftPp, 0)} percentage points`,
            statement: 'more best-practice checks passed with MWG',
            qualifier: `<span class="range">${pct(o.unguidedRate)} → ${pct(o.guidedRate)}</span> of ~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} graded checks per mode. ${familyNames}; ${runsPhrase}.`
        }));
    }

    // 2. Accessibility subscore (pooled)
    if (pooled?.a11y) {
        const a = pooled.a11y;
        cards.push(takeawayCard({
            metric: 'a11y',
            label: 'Accessibility',
            figure: `${signed(a.upliftPp, 0)}<span class="unit"> pp</span>`,
            figureText: `${signed(a.upliftPp, 0)} percentage points`,
            statement: 'more accessibility checks passed with MWG',
            qualifier: `<span class="range">${pct(a.unguidedRate)} → ${pct(a.guidedRate)}</span> on ~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} accessibility checks per mode${a.guideCount ? ` from ${a.guideCount} guides` : ''} (focus, ARIA, labels, keyboard, motion &amp; contrast). Same agents and runs.`
        }));
    }

    // 3. Tokens: per family only (never pooled across families). Name winners and non-winners.
    const tokenFams = fams.filter(f => f.tokens);
    if (tokenFams.length) {
        const winners = tokenFams.filter(f => (f.tokens?.deltaPct ?? 0) < 0).sort((x, y) => (x.tokens?.deltaPct ?? 0) - (y.tokens?.deltaPct ?? 0));
        const others = tokenFams.filter(f => (f.tokens?.deltaPct ?? 0) >= 0);
        if (winners.length) {
            const bestPct = roundAbs(winners[0].tokens?.deltaPct ?? 0);
            cards.push(takeawayCard({
                metric: 'tokens',
                label: 'Tokens',
                figure: `<span class="prefix">up to </span>${bestPct}<span class="unit">% fewer</span>`,
                figureText: `up to ${bestPct} percent fewer`,
                statement: `uncached tokens per task with MWG on ${joinNames(winners.map(f => f.label))}`,
                qualifier: `Median per task: ${winnersDetail(winners, 'tokens')}. ${others.length ? `${joinNames(others.map(f => f.label))} used more uncached tokens (${othersDetail(others, 'tokens')}); their raw totals rise far more because ${cachedShareRange(others)} of their tokens are cached prompt re-reads.` : ''}`
            }));
        } else {
            cards.push(takeawayCard({
                metric: 'tokens',
                label: 'Tokens',
                figure: '<span class="unit">No reduction</span>',
                figureText: 'No reduction',
                statement: 'in median uncached tokens for the agents measured',
                qualifier: `${othersDetail(others, 'tokens')}.`
            }));
        }
    }

    // 4. Time: per family only.
    const timeFams = fams.filter(f => f.runtime);
    if (timeFams.length) {
        const winners = timeFams.filter(f => (f.runtime?.deltaPct ?? 0) < 0).sort((x, y) => (x.runtime?.deltaPct ?? 0) - (y.runtime?.deltaPct ?? 0));
        const others = timeFams.filter(f => (f.runtime?.deltaPct ?? 0) >= 0);
        if (winners.length) {
            const bestPct = roundAbs(winners[0].runtime?.deltaPct ?? 0);
            cards.push(takeawayCard({
                metric: 'time',
                label: 'Time',
                figure: `<span class="prefix">up to </span>${bestPct}<span class="unit">% faster</span>`,
                figureText: `up to ${bestPct} percent faster`,
                statement: `median task completion with MWG on ${joinNames(winners.map(f => f.label))}`,
                qualifier: `${winnersDetail(winners, 'runtime')}. ${others.length ? `${joinNames(others.map(f => f.label))} pay a per-task lookup cost: ${othersDetail(others, 'runtime')}.` : ''}`
            }));
        } else {
            cards.push(takeawayCard({
                metric: 'time',
                label: 'Time',
                figure: '<span class="unit">No speedup</span>',
                figureText: 'No speedup',
                statement: 'in median task time for the agents measured',
                qualifier: `${othersDetail(others, 'runtime')}.`
            }));
        }
    }

    list.innerHTML = cards.join('');
}

/**
 * @param {{ metric: string, label: string, figure: string, figureText: string, statement: string, qualifier: string }} c
 */
function takeawayCard(c) {
    return `
        <li class="takeaway" data-metric="${c.metric}">
            <h3 class="takeaway-label">${c.label}</h3>
            <p class="takeaway-figure"><span aria-hidden="true">${c.figure}</span><span class="visually-hidden">${escapeHtml(c.figureText)}</span></p>
            <p class="takeaway-statement">${c.statement}</p>
            <p class="takeaway-qualifier">${c.qualifier}</p>
        </li>`;
}

/** @param {HeadlineInsights} insights */
function renderAgentTable(insights) {
    const body = document.getElementById('agent-table-body');
    const caption = document.getElementById('agent-table-caption');
    if (!body) return;

    const n = insights.options.perAgentRecentN;
    if (caption) {
        caption.textContent = `Latest ${n} nightly ${n === 1 ? 'run' : 'runs'} per agent family, pooled. Unguided → guided; change in percentage points (pp) for pass rates and percent for time and tokens.`;
    }

    const costEl = document.getElementById('hero-agents-cost');
    if (costEl) costEl.textContent = describeCost(insights.families);

    body.innerHTML = insights.families.map(f => {
        const meta = [
            f.models.length ? f.models.join(', ') : '',
            `${f.suiteCount} ${f.suiteCount === 1 ? 'run' : 'runs'}${taskRange(f)}`,
            f.latest?.date ? `latest ${formatDate(f.latest.date)}` : ''
        ].filter(Boolean).join(' · ');

        return `
            <tr>
                <th scope="row">${escapeHtml(f.label)}<span class="agent-meta">${escapeHtml(meta)}</span></th>
                <td data-label="Pass rate">${rateCell(f.overall)}</td>
                <td data-label="Accessibility">${rateCell(f.a11y)}</td>
                <td data-label="Median time">${runtimeCell(f.runtime)}</td>
                <td data-label="Median uncached tokens">${tokenCell(f.tokens)}</td>
            </tr>`;
    }).join('');
}

/** @param {RateComparison | null} r */
function rateCell(r) {
    if (!r || (r.guidedTotal === 0 && r.unguidedTotal === 0)) return naCell();
    return `
        <span class="metric-pair">${pct(r.unguidedRate)} → <strong>${pct(r.guidedRate)}</strong></span>
        ${deltaChip(r.upliftPp, 'pp', 'higher')}`;
}

/** @param {RuntimeInsight | null} rt */
function runtimeCell(rt) {
    if (!rt || (rt.guidedMedianMs === 0 && rt.unguidedMedianMs === 0)) return naCell();
    return `
        <span class="metric-pair">${formatDuration(rt.unguidedMedianMs)} → <strong>${formatDuration(rt.guidedMedianMs)}</strong></span>
        ${deltaChip(rt.deltaPct, '%', 'lower')}
        <span class="metric-sub">${Math.round(rt.fasterTaskPct)}% of ${fmtInt(rt.pairedTaskCount)} paired tasks faster${consistency(rt.suitesFaster, rt.perSuite.length, 'faster')}</span>`;
}

/** @param {TokenInsight | null} tk */
function tokenCell(tk) {
    if (!tk || (tk.guidedUncachedMedian === 0 && tk.unguidedUncachedMedian === 0)) return naCell();
    const cached = tk.guidedCachedSharePct > 0 ? ` · ${Math.round(tk.guidedCachedSharePct)}% of raw total was cached` : '';
    return `
        <span class="metric-pair">${formatTokens(tk.unguidedUncachedMedian)} → <strong>${formatTokens(tk.guidedUncachedMedian)}</strong></span>
        ${deltaChip(tk.deltaPct, '%', 'lower')}
        <span class="metric-sub">${Math.round(tk.fewerTaskPct)}% of ${fmtInt(tk.pairedTaskCount)} paired tasks used fewer${consistency(tk.suitesFewer, tk.perSuite.length, 'fewer')}${cached}</span>`;
}

/**
 * "(lower in 2 of 3 runs)" when the recent runs disagree; empty when they all agree.
 * @param {number} agreeing
 * @param {number} total
 * @param {string} word
 */
function consistency(agreeing, total, word) {
    if (total <= 1 || agreeing === total || agreeing === 0) return '';
    return ` · ${word} in ${agreeing} of ${total} runs`;
}

function naCell() {
    return '<span class="na"><span aria-hidden="true">—</span><span class="visually-hidden">not available</span></span>';
}

/**
 * Delta chip with sign + arrow glyph + screen-reader text; color is only a secondary cue.
 * @param {number} value
 * @param {'pp' | '%'} unit
 * @param {'higher' | 'lower'} goodWhen
 */
function deltaChip(value, unit, goodWhen) {
    const rounded = Math.sign(value) * roundAbs(value);
    const isGood = goodWhen === 'higher' ? rounded > 0 : rounded < 0;
    const isFlat = rounded === 0;
    const cls = isFlat ? 'flat' : (isGood ? 'good' : 'cost');
    const glyph = isFlat ? '•' : (rounded > 0 ? '▲' : '▼');
    const sr = isFlat ? 'no change' : `${rounded > 0 ? 'up' : 'down'} ${Math.abs(rounded)}${unit === 'pp' ? ' percentage points' : ' percent'}`;
    return `<span class="delta ${cls}"><span class="glyph" aria-hidden="true">${glyph}</span><span aria-hidden="true">${signed(rounded, 0)}${unit === 'pp' ? ' pp' : '%'}</span><span class="visually-hidden">${sr}</span></span>`;
}

/** @param {HeadlineInsights} insights */
function renderMethodNumbers(insights) {
    const el = document.getElementById('method-recent-n');
    if (el) el.textContent = String(insights.options.perAgentRecentN);
}

// ==========================================
// HELPERS
// ==========================================

/** @param {HeadlineInsights} insights */
function latestDateOf(insights) {
    return insights.latestTimestamp ? insights.latestTimestamp.slice(0, 10) : '';
}

/** @param {HeadlineInsights} insights */
function describeRuns(insights) {
    const n = insights.options.perAgentRecentN;
    const total = insights.pooled?.suiteCount || 0;
    const latest = latestDateOf(insights);
    return `latest ${n} nightly ${n === 1 ? 'run' : 'runs'} each (${total} total${latest ? `, through ${formatDate(latest)}` : ''})`;
}

/**
 * @param {FamilyInsight[]} fams
 * @param {'tokens' | 'runtime'} key
 */
function winnersDetail(fams, key) {
    return fams.map(f => {
        if (key === 'tokens' && f.tokens) {
            return `${f.label} ${signed(f.tokens.deltaPct, 0)}% (${Math.round(f.tokens.fewerTaskPct)}% of tasks)`;
        }
        if (key === 'runtime' && f.runtime) {
            return `${f.label} ${formatDuration(f.runtime.unguidedMedianMs)} → ${formatDuration(f.runtime.guidedMedianMs)} median (${Math.round(f.runtime.fasterTaskPct)}% of tasks faster)`;
        }
        return '';
    }).filter(Boolean).join('; ');
}

/**
 * @param {FamilyInsight[]} fams
 * @param {'tokens' | 'runtime'} key
 */
function othersDetail(fams, key) {
    return fams.map(f => {
        if (key === 'tokens' && f.tokens) {
            return `${f.label} ${signed(f.tokens.deltaPct, 0)}%`;
        }
        if (key === 'runtime' && f.runtime) {
            const deltaS = Math.round((f.runtime.guidedMedianMs - f.runtime.unguidedMedianMs) / 1000);
            return `${f.label} ${deltaS >= 0 ? '+' : '−'}${Math.abs(deltaS)}s at the median`;
        }
        return '';
    }).filter(Boolean).join(', ');
}

/**
 * One sentence on who saves time/tokens and who pays a lookup cost, from live data.
 * @param {FamilyInsight[]} fams
 */
function describeCost(fams) {
    const withRt = fams.filter(f => f.runtime);
    if (!withRt.length) return '';
    const savers = withRt.filter(f => (f.runtime?.deltaPct ?? 0) < 0 && (f.tokens?.deltaPct ?? 0) < 0).map(f => f.label);
    const fasterOnly = withRt.filter(f => (f.runtime?.deltaPct ?? 0) < 0 && !((f.tokens?.deltaPct ?? 0) < 0)).map(f => f.label);
    const payers = withRt.filter(f => (f.runtime?.deltaPct ?? 0) >= 0);
    /** @type {string[]} */
    const parts = [];
    if (savers.length) parts.push(`Time and token savings show up for ${joinNames(savers)}`);
    if (fasterOnly.length) parts.push(`${joinNames(fasterOnly)} ${fasterOnly.length === 1 ? 'finishes' : 'finish'} faster but ${fasterOnly.length === 1 ? 'uses' : 'use'} more uncached tokens`);
    if (payers.length) {
        const secs = payers.map(f => Math.round(((f.runtime?.guidedMedianMs ?? 0) - (f.runtime?.unguidedMedianMs ?? 0)) / 1000));
        const lo = Math.min(...secs);
        const hi = Math.max(...secs);
        const range = lo === hi ? `about ${hi}s` : `${lo}–${hi}s`;
        parts.push(`${joinNames(payers.map(f => f.label))} ${payers.length === 1 ? 'pays' : 'pay'} a per-task lookup cost (${range} at the median)`);
    }
    return parts.length ? `${parts.join('; ')}.` : '';
}

/**
 * "145–153 tasks per run" (or "153 tasks" when every run had the same count).
 * @param {FamilyInsight} f
 */
function taskRange(f) {
    const counts = (f.suites || []).map(s => s.taskCount).filter(n => n > 0);
    if (!counts.length) return '';
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    return lo === hi ? ` · ${hi} tasks per run` : ` · ${lo}–${hi} tasks per run`;
}

/**
 * "86–96%" cached share across the given families (guided), or a single value.
 * @param {FamilyInsight[]} fams
 */
function cachedShareRange(fams) {
    const shares = fams.map(f => Math.round(f.tokens?.guidedCachedSharePct ?? 0)).filter(n => n > 0);
    if (!shares.length) return 'most';
    const lo = Math.min(...shares);
    const hi = Math.max(...shares);
    return lo === hi ? `${hi}%` : `${lo}–${hi}%`;
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

/**
 * @param {number} v
 * @param {number} digits
 */
function signed(v, digits) {
    const r = Math.sign(v || 0) * Number(Math.abs(v || 0).toFixed(digits));
    if (r > 0) return `+${r}`;
    if (r < 0) return `−${Math.abs(r)}`;
    return '0';
}

/**
 * Rounds the magnitude (half away from zero) so a −13.5% delta and an "up to 14%" headline never disagree.
 * @param {number} v
 */
function roundAbs(v) {
    return Math.round(Math.abs(v || 0));
}

/** @param {number} v */
function pct(v) {
    return `${Math.round(v || 0)}%`;
}

/** @param {number} v */
function fmtInt(v) {
    return new Intl.NumberFormat('en-US').format(Math.round(v || 0));
}

/** @param {string} iso */
function formatDate(iso) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
