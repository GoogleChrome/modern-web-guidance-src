/**
 * Hero / headline takeaways for the landing page.
 *
 * Loads the suites manifest (same sources as landing.js: local dev server,
 * static suites.gen.json, or the private GCS bucket after Google sign-in),
 * reduces it to headline insights via `computeHeadlineInsights()` from
 * ./insights.js, and renders the two quality takeaway cards, the per-agent
 * comparison table, and the numbers inside the "How we measure" disclosure.
 *
 * The hero never touches the browse UI below it (landing.js owns that).
 */
import { getAccessToken, escapeHtml, getAgentBadge } from './utils.js';
import { ApiClient } from './api.js';

/** @typedef {import('./insights.js').HeadlineInsights} HeadlineInsights */
/** @typedef {import('./insights.js').FamilyInsight} FamilyInsight */
/** @typedef {import('./insights.js').RateComparison} RateComparison */

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
        const noSourceParam = !new URLSearchParams(window.location.search).get('source');
        if (api.source === 'local' && noSourceParam && !insights.families.length) {
            const { suites = [] } = await api.getManifest('full');
            if (suites.length === 0) {
                api.source = 'remote';
                if (!getAccessToken()) {
                    renderPending();
                    setStatus('auth');
                    setBusy(false);
                    return;
                }
                const remoteInsights = await api.getHeadlineInsights({
                    onUpdate: (final) => { paint(final); setBusy(false); }
                });
                paint(remoteInsights);
                if (remoteInsights.missingStats.length > 0) return;
                setBusy(false);
                return;
            }
        }
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
            pendingCard('overall', 'Web best practices pass rate', 'pass-rate lift across all tasks', true),
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

/**
 * Renders the visual dumbbell bar + self-labeled unguided → guided rate pair inside the primary hero takeaway.
 * @param {number} uRate
 * @param {number} gRate
 */
function renderTakeawayDumbbell(uRate, gRate) {
    const u = Math.max(0, Math.min(100, Math.round(uRate || 0)));
    const g = Math.max(0, Math.min(100, Math.round(gRate || 0)));
    const lo = Math.min(u, g);
    const span = Math.max(0, Math.abs(g - u));
    return `
        <div class="takeaway-dumbbell" aria-hidden="true">
            <div class="suite-dumbbell-track takeaway-track">
                <div class="connector" style="left: ${lo}%; width: ${span}%;"></div>
                <div class="dot unguided" style="left: ${u}%;"></div>
                <div class="dot guided" style="left: ${g}%;"></div>
            </div>
            <div class="takeaway-dumbbell-rates">
                <span class="rate-u">${u}% without MWG</span>
                <span class="rate-arrow">→</span>
                <strong class="rate-g">${g}% with MWG</strong>
            </div>
        </div>`;
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

    // 1. Primary focal figure: Web best practices (overall pass rate, pooled across families)
    if (pooled?.overall) {
        const o = pooled.overall;
        const overallShortText = `~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} checks · ${insights.pooled?.suiteCount || 0} nightly runs`;
        cards.push(takeawayCard({
            metric: 'overall',
            primary: true,
            label: 'Web best practices pass rate',
            figure: `<span class="figure-val">${signed(o.upliftPp, 0)}</span><span class="unit"> pp</span>`,
            figureText: `${signed(o.upliftPp, 0)} percentage points`,
            statement: 'pass-rate lift across all tasks',
            visual: renderTakeawayDumbbell(o.unguidedRate, o.guidedRate),
            qualifier: `<span class="range">${fmtPct(o.unguidedRate)} → ${fmtPct(o.guidedRate)}</span> of ~${fmtCompact(Math.min(o.unguidedTotal, o.guidedTotal))} graded checks per mode. ${familyNames}; ${runsPhrase}.`,
            short: `<span class="visually-hidden">${fmtPct(o.unguidedRate)} → ${fmtPct(o.guidedRate)} · </span><a href="#all-guides" class="takeaway-action-link" data-open-guides="all">${overallShortText} <span aria-hidden="true">→</span></a>`
        }));
    }

    // 2. Quiet secondary stat: Accessibility subscore (pooled)
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
            qualifier: `<span class="range">${fmtPct(a.unguidedRate)} → ${fmtPct(a.guidedRate)}</span> across ~${fmtCompact(Math.min(a.unguidedTotal, a.guidedTotal))} accessibility checks${a.guideCount ? ` in ${a.guideCount} guides` : ''}.`,
            short: `<a href="#a11y-guides" class="takeaway-action-link" data-open-guides="a11y">${a11yShortText} <span aria-hidden="true">→</span></a>`
        }));
    }

    list.innerHTML = cards.join('');
}

/**
 * Placeholder card used before numbers are available (pre sign-in, hydrating, empty source).
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
        qualifier: 'Numbers appear once results are loaded.'
    });
}

/**
 * @param {{ metric: string, primary?: boolean, label: string, figure: string, figureText: string, statement?: string, visual?: string, qualifier: string, short?: string }} c
 *   `short` is a compact visual/scannable summary; `qualifier` is the full screen-reader / detailed text.
 */
function takeawayCard(c) {
    const short = c.short || c.qualifier;
    const roleCls = c.primary ? 'takeaway takeaway-primary' : 'takeaway takeaway-secondary';
    return `
        <li class="${roleCls}" data-metric="${c.metric}">
            <h3 class="takeaway-label">${c.label}</h3>
            <p class="takeaway-figure"><span aria-hidden="true">${c.figure}</span><span class="visually-hidden">${escapeHtml(c.figureText)}</span></p>
            ${c.statement ? `<p class="takeaway-statement">${c.statement}</p>` : ''}
            ${c.visual || ''}
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
        caption.textContent = `Latest ${n} nightly ${n === 1 ? 'run' : 'runs'} per agent family, pooled. Unguided → guided; change in percentage points (pp).`;
    }

    body.innerHTML = insights.families.map(f => {
        const metaParts = [
            `${f.suiteCount} ${f.suiteCount === 1 ? 'run' : 'runs'}`,
            f.models.length ? f.models.map(shortModelName).join(', ') : '',
            f.latest?.date ? formatDateShort(f.latest.date) : ''
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
            ${deltaChip(r.upliftPp, 'pp', 'higher')}
        </div>`;
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
 * Shortens model identifiers when displayed inside a family row where the vendor is already known.
 * @param {string} model
 */
function shortModelName(model) {
    return (model || '').replace(/^(claude-|gemini-)/i, '');
}

/**
 * Compact date ("Oct 9") for secondary row metadata.
 * @param {string} iso
 */
function formatDateShort(iso) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
 * Rounds the magnitude (half away from zero).
 * @param {number} v
 */
function roundAbs(v) {
    return Math.round(Math.abs(v || 0));
}

/** @param {number} v */
function fmtPct(v) {
    return `${Math.round(v || 0)}%`;
}

/** @param {string} iso */
function formatDate(iso) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
