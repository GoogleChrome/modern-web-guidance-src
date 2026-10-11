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
import { getAccessToken, escapeHtml, formatDuration, formatTokens } from './utils.js';
import { ApiClient } from './api.js';

/** @typedef {import('./insights.js').HeadlineInsights} HeadlineInsights */
/** @typedef {import('./insights.js').FamilyInsight} FamilyInsight */
/** @typedef {import('./insights.js').RateComparison} RateComparison */
/** @typedef {import('./insights.js').RuntimeInsight} RuntimeInsight */
/** @typedef {import('./insights.js').TokenInsight} TokenInsight */

/** Short parenthetical shown once in the lede for family names that are not self-explanatory. @type {Record<string, string>} */
const FAMILY_HINT = { antigravity_cli: 'Gemini' };

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
 * Loads the headline numbers through ApiClient.getHeadlineInsights(), which prefers the small
 * pre-computed headline-insights.gen.json, falls back to the full manifest, and hydrates
 * a11y/efficiency stats from evals.json for just the latest-N suites when the manifest predates
 * them. Two-phase paint: manifest-only numbers first, hydrated numbers via onUpdate.
 */
async function loadAndRender() {
    if (!heroEl) return;
    setBusy(true);
    setStatus(null);

    // The private bucket needs a Google token. Until the small headline/slim artifacts are
    // published public-read (see @data's Plan C), don't hit GCS signed-out: it only yields 401s.
    const signedOut = api.source === 'remote' && !getAccessToken();
    if (signedOut) {
        renderPending();
        setStatus('auth');
        setBusy(false);
        return;
    }

    /** @param {HeadlineInsights} insights */
    const paint = (insights) => {
        if (!insights || !insights.families.length) {
            renderPending();
            setStatus(signedOut ? 'auth' : 'empty');
            return;
        }
        renderHero(insights);
        setStatus(signedOut ? 'auth-snapshot' : null);
    };

    try {
        const insights = await api.getHeadlineInsights({
            onUpdate: (final) => { paint(final); setBusy(false); }
        });
        paint(insights);
        // Hydration is still running when the manifest lacked stats; keep aria-busy until onUpdate.
        if (insights.missingStats.length > 0) return;
    } catch (err) {
        if (!signedOut) console.error('Hero: failed to load headline insights', err);
        renderPending();
        setStatus(signedOut ? 'auth' : 'error');
    }
    setBusy(false);
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

/**
 * Announces a message through the always-present live region (a region that is
 * un-hidden and filled in the same tick is not reliably announced).
 * @param {string} message
 */
function announce(message) {
    const live = document.getElementById('hero-live');
    if (!live) return;
    live.textContent = '';
    requestAnimationFrame(() => { live.textContent = message; });
}

// ==========================================
// RENDERING
// ==========================================

/** @param {HeadlineInsights} insights */
function renderHero(insights) {
    renderEyebrow(insights);
    renderTakeaways(insights);
    renderAgentTable(insights);
    renderMethodNumbers(insights);
    const o = insights.pooled?.overall;
    announce(o ? `Latest results loaded: ${signed(o.upliftPp, 0)} percentage points more checks passed with MWG.` : 'Latest results loaded.');
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
        ].map(([metric, label, statement]) => pendingCard(metric, label, statement)).join('');
    }
    const body = document.getElementById('agent-table-body');
    if (body) {
        body.innerHTML = `<tr><th scope="row">No data loaded</th><td data-label="Pass rate">${naCell()}</td><td data-label="Accessibility">${naCell()}</td><td data-label="Median time">${naCell()}</td><td data-label="Median uncached tokens">${naCell()}</td><td data-label="Runs">${naCell()}</td></tr>`;
    }
    const eyebrow = document.getElementById('hero-eyebrow');
    if (eyebrow) eyebrow.textContent = 'Nightly evaluations';
}

/** @param {HeadlineInsights} insights */
function renderEyebrow(insights) {
    const agentsEl = document.getElementById('hero-lede-agents');
    if (agentsEl && insights.families.length) agentsEl.textContent = joinNames(insights.families.map(f => FAMILY_HINT[f.id] ? `${f.label} (${FAMILY_HINT[f.id]})` : f.label));
    const el = document.getElementById('hero-eyebrow');
    if (!el) return;
    const latest = latestDateOf(insights);
    const n = insights.pooled?.suiteCount || 0;
    // The run-count segment is hidden on phones (hero.css) — it is repeated in the first card's qualifier.
    const detail = n > 0 ? `<span class="eyebrow-detail"> · ${n} recent ${n === 1 ? 'run' : 'runs'} across ${insights.families.length} agent ${insights.families.length === 1 ? 'family' : 'families'}</span>` : '';
    el.innerHTML = `Nightly evaluations${detail}${latest ? ` · latest data <span class="nowrap">${escapeHtml(formatDate(latest))}</span>` : ''}`;
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
            qualifier: `<span class="range">${pct(o.unguidedRate)} → ${pct(o.guidedRate)}</span> of ~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} graded checks per mode (deterministic Playwright and static-analysis tests written from each guide's expectations). ${familyNames}; ${runsPhrase}.`,
            short: `<span class="range">${pct(o.unguidedRate)} → ${pct(o.guidedRate)}</span> of ~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} checks · ${insights.pooled?.suiteCount || 0} nightly runs, 3 agents`
        }));
    }

    // 2. Accessibility subscore (pooled)
    if (!pooled?.a11y) {
        cards.push(pendingCard('a11y', 'Accessibility', 'more accessibility checks passed with MWG'));
    } else {
        const a = pooled.a11y;
        cards.push(takeawayCard({
            metric: 'a11y',
            label: 'Accessibility',
            figure: `${signed(a.upliftPp, 0)}<span class="unit"> pp</span>`,
            figureText: `${signed(a.upliftPp, 0)} percentage points`,
            statement: 'more accessibility checks passed with MWG',
            qualifier: `<span class="range">${pct(a.unguidedRate)} → ${pct(a.guidedRate)}</span> on ~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} accessibility checks per mode${a.guideCount ? ` from ${a.guideCount} guides` : ''} (focus, ARIA, labels, keyboard, motion &amp; contrast). Same agents and runs.`,
            short: `<span class="range">${pct(a.unguidedRate)} → ${pct(a.guidedRate)}</span> on ~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} a11y checks · same runs`
        }));
    }

    // 3. Tokens: per family only (never pooled across families). Name winners and non-winners.
    const tokenFams = fams.filter(f => f.tokens);
    if (!tokenFams.length) {
        cards.push(pendingCard('tokens', 'Tokens', 'fewer uncached tokens per task for some agents'));
    } else {
        const winners = tokenFams.filter(f => tokDelta(f) < 0).sort((x, y) => tokDelta(x) - tokDelta(y));
        const others = tokenFams.filter(f => tokDelta(f) >= 0);
        if (winners.length) {
            const bestPct = roundAbs(tokDelta(winners[0]));
            const upTo = winners.length > 1 ? 'up to ' : '';
            cards.push(takeawayCard({
                metric: 'tokens',
                label: 'Tokens',
                figure: `${upTo ? '<span class="prefix">up to </span>' : ''}${bestPct}<span class="unit">% fewer</span>`,
                figureText: `${upTo}${bestPct} percent fewer`,
                statement: `uncached tokens per task with MWG on ${joinNames(winners.map(f => f.label))}`,
                qualifier: `Median per task: ${winnersDetail(winners, 'tokens')}. ${others.length ? `${joinNames(others.map(f => f.label))} used more uncached tokens overall (${othersDetail(others, 'tokens')})${dissentingModels(others, 'tokens', 'used', 'fewer') ? `, though ${dissentingModels(others, 'tokens', 'used', 'fewer')}` : ''}; raw totals rise far more because ${cachedShareRange(others)} of their tokens are cached prompt re-reads.` : ''}`,
                short: others.length ? `Median per task · ${othersDetail(others, 'tokens')} (more)` : 'Median per task'
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
    if (!timeFams.length) {
        cards.push(pendingCard('time', 'Time', 'faster task completion for some agents'));
    } else {
        const winners = timeFams.filter(f => rtDelta(f) < 0).sort((x, y) => rtDelta(x) - rtDelta(y));
        const others = timeFams.filter(f => rtDelta(f) >= 0);
        if (winners.length) {
            const bestPct = roundAbs(rtDelta(winners[0]));
            const upTo = winners.length > 1 ? 'up to ' : '';
            cards.push(takeawayCard({
                metric: 'time',
                label: 'Time',
                figure: `${upTo ? '<span class="prefix">up to </span>' : ''}${bestPct}<span class="unit">% faster</span>`,
                figureText: `${upTo}${bestPct} percent faster`,
                statement: `median task completion with MWG on ${joinNames(winners.map(f => f.label))}`,
                qualifier: `${winnersDetail(winners, 'runtime')}. ${others.length ? `${joinNames(others.map(f => f.label))} pay a per-task lookup cost: ${othersDetail(others, 'runtime')}${dissentingModels(others, 'runtime', 'finished', 'faster') ? ` (${dissentingModels(others, 'runtime', 'finished', 'faster')})` : ''}.` : ''}`,
                short: others.length ? `Median per task · ${othersShort(others)} (slower)` : 'Median per task'
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
 * Placeholder card used before numbers are available (pre sign-in, hydrating, empty source).
 * @param {string} metric
 * @param {string} label
 * @param {string} statement
 */
function pendingCard(metric, label, statement) {
    return takeawayCard({
        metric, label,
        figure: '<span class="unit">—</span>',
        figureText: 'not loaded',
        statement,
        qualifier: 'Numbers appear once results are loaded.'
    });
}

/**
 * @param {{ metric: string, label: string, figure: string, figureText: string, statement: string, qualifier: string, short?: string }} c
 *   `short` is a one-line qualifier used on narrow containers (phones) so all four figures fit one screen;
 *   the full qualifier is shown at ≥40rem (see hero.css).
 */
function takeawayCard(c) {
    const short = c.short || c.qualifier;
    return `
        <li class="takeaway" data-metric="${c.metric}">
            <h3 class="takeaway-label">${c.label}</h3>
            <p class="takeaway-figure"><span aria-hidden="true">${c.figure}</span><span class="visually-hidden">${escapeHtml(c.figureText)}</span></p>
            <p class="takeaway-statement">${c.statement}</p>
            <p class="takeaway-qualifier takeaway-qualifier-full">${c.qualifier}</p>
            <p class="takeaway-qualifier takeaway-qualifier-short">${short}</p>
        </li>`;
}

/** @param {HeadlineInsights} insights */
function renderAgentTable(insights) {
    const body = document.getElementById('agent-table-body');
    const caption = document.getElementById('agent-table-caption');
    if (!body) return;

    const n = insights.options.perAgentRecentN;
    if (caption) {
        caption.textContent = `Latest ${n} nightly ${n === 1 ? 'run' : 'runs'} per agent family, pooled. Unguided → guided; change in percentage points (pp) for pass rates and percent for time and tokens. Higher is better for pass rates; lower is better for time and tokens.`;
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
                <th scope="row">${escapeHtml(f.label)}</th>
                <td data-label="Pass rate">${rateCell(f.overall)}</td>
                <td data-label="Accessibility">${rateCell(f.a11y)}</td>
                <td data-label="Median time">${runtimeCell(f)}</td>
                <td data-label="Median uncached tokens">${tokenCell(f)}</td>
                <td data-label="Runs"><span class="agent-meta">${escapeHtml(meta)}</span></td>
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

/** @param {FamilyInsight} f */
function runtimeCell(f) {
    const rt = f.runtime;
    if (!rt || (rt.guidedMedianMs === 0 && rt.unguidedMedianMs === 0)) return naCell();
    return `
        <span class="metric-pair">${formatDuration(rt.unguidedMedianMs)} → <strong>${formatDuration(rt.guidedMedianMs)}</strong></span>
        ${deltaChip(rtDelta(f), '%', 'lower', ['faster', 'slower'])}
        <span class="metric-sub">${Math.round(rt.fasterTaskPct)}% of ${fmtInt(rt.pairedTaskCount)} paired tasks faster</span>${perModelLine(f, 'runtime')}`;
}

/** @param {FamilyInsight} f */
function tokenCell(f) {
    const tk = f.tokens;
    if (!tk || (tk.guidedUncachedMedian === 0 && tk.unguidedUncachedMedian === 0)) return naCell();
    const cached = tk.guidedCachedSharePct > 0 ? ` · ${Math.round(tk.guidedCachedSharePct)}% of raw total was cached` : '';
    return `
        <span class="metric-pair">${formatTokens(tk.unguidedUncachedMedian)} → <strong>${formatTokens(tk.guidedUncachedMedian)}</strong></span>
        ${deltaChip(tokDelta(f), '%', 'lower', ['fewer', 'more'])}
        <span class="metric-sub">${Math.round(tk.fewerTaskPct)}% of ${fmtInt(tk.pairedTaskCount)} paired tasks used fewer${cached}</span>${perModelLine(f, 'tokens')}`;
}

function naCell() {
    return '<span class="na"><span aria-hidden="true">—</span><span class="visually-hidden">not available</span></span>';
}

/**
 * Delta chip: arrow glyph + signed value + a visible valence word for time/tokens
 * ("14% faster", "10% more"), plus screen-reader text. Color is only a secondary cue.
 * @param {number} value
 * @param {'pp' | '%'} unit
 * @param {'higher' | 'lower'} goodWhen
 * @param {[string, string]} [words] Visible words for [decrease, increase], e.g. ['faster', 'slower'].
 */
function deltaChip(value, unit, goodWhen, words) {
    const rounded = Math.sign(value) * roundAbs(value);
    const isGood = goodWhen === 'higher' ? rounded > 0 : rounded < 0;
    const isFlat = rounded === 0;
    const cls = isFlat ? 'flat' : (isGood ? 'good' : 'cost');
    const glyph = isFlat ? '•' : (rounded > 0 ? '▲' : '▼');
    const unitText = unit === 'pp' ? ' pp' : '%';
    const visible = words
        ? (isFlat ? `no change` : `${Math.abs(rounded)}${unitText} ${rounded < 0 ? words[0] : words[1]}`)
        : `${signed(rounded, 0)}${unitText}`;
    const sr = isFlat ? 'no change' : `${rounded > 0 ? 'up' : 'down'} ${Math.abs(rounded)}${unit === 'pp' ? ' percentage points' : ' percent'}${isGood ? ', better' : ', worse'}`;
    return `<span class="delta ${cls}"><span class="glyph" aria-hidden="true">${glyph}</span><span aria-hidden="true">${visible}</span><span class="visually-hidden">${sr}</span></span>`;
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
            return `${f.label} ${signed(tokDelta(f), 0)}% (${Math.round(f.tokens.fewerTaskPct)}% of tasks)`;
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
            return `${f.label} ${signed(tokDelta(f), 0)}%`;
        }
        if (key === 'runtime' && f.runtime) {
            const deltaS = Math.round((f.runtime.guidedMedianMs - f.runtime.unguidedMedianMs) / 1000);
            return `${f.label} ${deltaS >= 0 ? '+' : '−'}${Math.abs(deltaS)}s at the median`;
        }
        return '';
    }).filter(Boolean).join(', ');
}

/**
 * Per-suite deltas grouped by model, e.g. [{ model: 'claude-sonnet-5-5', deltas: [-11, -13] }, ...].
 * Only meaningful when a family pools more than one model.
 * @param {FamilyInsight} f
 * @param {'runtime' | 'tokens'} key
 * @returns {{ model: string, deltas: number[] }[]}
 */
function perModelDeltas(f, key) {
    const points = key === 'runtime' ? (f.runtime?.perSuite || []) : (f.tokens?.perSuite || []);
    const modelById = new Map((f.suites || []).map(s => [s.testId, s.model]));
    /** @type {Map<string, number[]>} */
    const grouped = new Map();
    points.forEach(p => {
        const model = modelById.get(p.testId) || 'unknown';
        if (!grouped.has(model)) grouped.set(model, []);
        const raw = 'guidedMedianMs' in p ? pctChange(p.guidedMedianMs, p.unguidedMedianMs) : pctChange(p.guidedUncachedMedian, p.unguidedUncachedMedian);
        /** @type {number[]} */ (grouped.get(model)).push(raw);
    });
    return Array.from(grouped, ([model, deltas]) => ({ model, deltas }));
}

/**
 * "By model: claude-sonnet-5-5 −11%, −13% · claude-opus-5-5 +84%" when models are mixed; '' otherwise.
 * Surfaces when one model's runs go the other way from the pooled median, so a mix cannot hide it.
 * @param {FamilyInsight} f
 * @param {'runtime' | 'tokens'} key
 */
function perModelLine(f, key) {
    const groups = perModelDeltas(f, key);
    if (groups.length < 2) return '';
    const text = groups.map(g => `${g.model} ${g.deltas.map(d => `${signed(d, 0)}%`).join(', ')}`).join(' · ');
    return `<span class="metric-sub">By model: ${escapeHtml(text)}</span>`;
}

/**
 * For the takeaway qualifiers: names models whose every run went against the family's pooled sign,
 * e.g. "Claude Code's claude-sonnet-5-5 runs used 11–13% fewer". '' when nothing to report.
 * @param {FamilyInsight[]} fams Families on the "other" side of the headline.
 * @param {'runtime' | 'tokens'} key
 * @param {string} verb e.g. "used" / "finished"
 * @param {string} word e.g. "fewer" / "faster"
 */
function dissentingModels(fams, key, verb, word) {
    /** @type {string[]} */
    const notes = [];
    fams.forEach(f => {
        perModelDeltas(f, key).filter(g => g.deltas.length && g.deltas.every(d => d < 0)).forEach(g => {
            const mags = g.deltas.map(d => roundAbs(d));
            const lo = Math.min(...mags);
            const hi = Math.max(...mags);
            notes.push(`${f.label}'s ${g.model} ${g.deltas.length === 1 ? 'run' : 'runs'} ${verb} ${lo === hi ? `${hi}%` : `${lo}–${hi}%`} ${word}`);
        });
    });
    return notes.join('; ');
}

/**
 * One sentence on who saves time/tokens and who pays a lookup cost, from live data.
 * @param {FamilyInsight[]} fams
 */
function describeCost(fams) {
    const withRt = fams.filter(f => f.runtime);
    if (!withRt.length) return '';
    const savers = withRt.filter(f => rtDelta(f) < 0 && tokDelta(f) < 0).map(f => f.label);
    const fasterOnly = withRt.filter(f => rtDelta(f) < 0 && !(tokDelta(f) < 0)).map(f => f.label);
    const payers = withRt.filter(f => rtDelta(f) >= 0);
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

/**
 * Compact "Claude Code +5s, Codex CLI +17s" for the phone-sized qualifier.
 * @param {FamilyInsight[]} fams
 */
function othersShort(fams) {
    return fams.map(f => {
        if (!f.runtime) return '';
        const deltaS = Math.round((f.runtime.guidedMedianMs - f.runtime.unguidedMedianMs) / 1000);
        return `${f.label} ${deltaS >= 0 ? '+' : '−'}${Math.abs(deltaS)}s`;
    }).filter(Boolean).join(', ');
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
 * Percent change computed from the raw medians (never from a pre-rounded 1-dp field, which
 * would double-round: 4,972/5,616 is −11.47%, stored as −11.5, and must display as 11 not 12).
 * @param {number} guided
 * @param {number} unguided
 */
function pctChange(guided, unguided) {
    return unguided > 0 ? ((guided - unguided) / unguided) * 100 : 0;
}

/** @param {FamilyInsight} f */
function tokDelta(f) {
    return f.tokens ? pctChange(f.tokens.guidedUncachedMedian, f.tokens.unguidedUncachedMedian) : 0;
}

/** @param {FamilyInsight} f */
function rtDelta(f) {
    return f.runtime ? pctChange(f.runtime.guidedMedianMs, f.runtime.unguidedMedianMs) : 0;
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
