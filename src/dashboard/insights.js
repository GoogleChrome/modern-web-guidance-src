/**
 * Headline insights for the eval dashboard landing page.
 *
 * Pure functions that turn suite manifest entries (`suites.gen.json` / `/api/suites`,
 * i.e. the output of `extractSuiteSummary`) into the handful of numbers the hero
 * section shows: pass-rate uplift, accessibility uplift, runtime and token deltas,
 * per agent family and pooled.
 *
 * Methodology (keep in sync with the "How we measure" disclosure in the UI):
 * - Only nightly suites (`nightly-<date>-<agent>`) are considered, and only the latest
 *   `perAgentRecentN` per agent family, so numbers track the current state of MWG and
 *   the agents rather than months-old history.
 * - Pass rates are micro-averages over attributed grader checks, pooled across the
 *   selected suites (sum of passed / sum of total). Uplift is in percentage POINTS.
 * - "% of paired tasks faster / using fewer tokens" and the median runtime / token
 *   comparisons are pooled over every paired task of the selected suites (per-task values
 *   come from each suite's `chartData`). A task is paired when the same task has both an
 *   unguided and a guided run with a recorded value. If a suite predates per-task data,
 *   medians fall back to the latest suite and `medianSource` is `'latest'`.
 * - Runtime is agent time only (grader time excluded); tokens are "uncached"
 *   (`total - cached`), the fair cross-agent metric. Runs with no recorded tokens
 *   (e.g. timed-out attempts) are excluded from token pairs.
 * - Pooled cross-family medians are deliberately NOT computed: mixing 20s Claude tasks
 *   with 400s Antigravity tasks yields a composition artifact, not a finding.
 */

import { extractSuiteSummary } from './summary-extractor.js';
import { median } from './utils.js';

/**
 * @typedef {import('./summary-extractor.js').SuiteSummary} SuiteSummary
 */

/**
 * A manifest entry. Older manifests lack `a11yStats` / `efficiencyStats`
 * (see {@link hydrateMissingStats}), and legacy entries may be bare strings.
 * @typedef {Partial<SuiteSummary> & { testId: string }} ManifestSuite
 */

/**
 * @typedef {Object} AgentFamilyDef
 * @property {string} id Stable key, e.g. `antigravity_cli`.
 * @property {string} label Human label, e.g. `Antigravity CLI`.
 * @property {string} description Lineage note shown next to the label.
 * @property {string[]} agents Raw `agent` values folded into this family.
 */

/**
 * Agent families shown on the landing page. `antigravity_cli` succeeded `jetski_cli`
 * (same Gemini-based agent harness; the nightly schedule switched on 2026-10-01), so both
 * are one family for time series and headline purposes. NOTE: `gemini_cli` is a DIFFERENT
 * harness agent (the standalone Gemini CLI, ad-hoc suites only) and is deliberately not pooled.
 * @type {AgentFamilyDef[]}
 */
export const AGENT_FAMILIES = [
    { id: 'claude_code', label: 'Claude Code', description: 'claude_code', agents: ['claude_code', 'claude'] },
    { id: 'codex_cli', label: 'Codex CLI', description: 'codex_cli', agents: ['codex_cli', 'codex'] },
    {
        id: 'antigravity_cli',
        label: 'Antigravity CLI',
        description: 'antigravity_cli (succeeded jetski_cli)',
        agents: ['antigravity_cli', 'jetski_cli']
    }
];

/**
 * @typedef {Object} RateComparison
 * @property {number} unguidedRate Percent, 1 decimal.
 * @property {number} guidedRate Percent, 1 decimal.
 * @property {number} upliftPp Percentage points (guided - unguided), 1 decimal.
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 */

/**
 * @typedef {RateComparison & { guideCount: number }} A11yComparison
 * `guideCount` is the max number of guides contributing accessibility checks in any selected suite.
 */

/**
 * @typedef {Object} SuiteRef
 * @property {string} testId
 * @property {string} timestamp ISO timestamp of the suite.
 * @property {string} date `YYYY-MM-DD` derived from the timestamp.
 * @property {string} agent
 * @property {string} model
 * @property {number} taskCount
 * @property {number} earlyFailureRate Percent of runs that failed before grading (0 when unknown).
 */

/**
 * @typedef {Object} RuntimeSuitePoint
 * @property {string} testId
 * @property {string} date
 * @property {number} unguidedMedianMs
 * @property {number} guidedMedianMs
 * @property {number} deltaPct Percent change of the guided median vs. unguided, 1 decimal.
 * @property {number} fasterTaskPct Percent of paired tasks faster when guided (integer, from the suite).
 */

/**
 * Runtime comparison for one family. Pooled values come from every paired task in the
 * selected suites (per-task values are read from each suite's `chartData`); when a suite
 * lacks per-task data the pooled fields fall back to the latest suite's medians and
 * `medianSource` says so.
 *
 * @typedef {Object} RuntimeInsight
 * @property {number} unguidedMedianMs Pooled median of unguided agent time across paired tasks.
 * @property {number} guidedMedianMs Pooled median of guided agent time across paired tasks.
 * @property {number} deltaPct Percent change of the guided median vs. unguided, 1 decimal.
 * @property {number} pairedMedianDeltaMs Median of per-task (guided - unguided) differences (0 when not pooled).
 * @property {'pooled' | 'latest'} medianSource
 * @property {number} fasterTaskPct Percent of paired tasks faster when guided, pooled, 1 decimal.
 * @property {number} fasterTasksCount
 * @property {number} pairedTaskCount
 * @property {RuntimeSuitePoint} latest Per-suite medians of the latest selected suite.
 * @property {RuntimeSuitePoint[]} perSuite Newest first.
 * @property {number} suitesFaster Number of selected suites whose guided median was lower.
 * @property {'faster' | 'slower' | 'mixed'} direction `faster`/`slower` only when every selected suite agrees.
 */

/**
 * @typedef {Object} TokenSuitePoint
 * @property {string} testId
 * @property {string} date
 * @property {number} unguidedUncachedMedian
 * @property {number} guidedUncachedMedian
 * @property {number} deltaPct Percent change of the guided uncached median vs. unguided, 1 decimal.
 * @property {number} unguidedTotalMedian
 * @property {number} guidedTotalMedian
 * @property {number} totalDeltaPct
 * @property {number} unguidedCachedSharePct
 * @property {number} guidedCachedSharePct
 * @property {number} fewerTaskPct Percent of paired tasks using fewer uncached tokens when guided (integer, from the suite).
 */

/**
 * Token comparison for one family (uncached tokens = total - cached). Runs that recorded
 * no tokens (e.g. timed-out attempts) are excluded from pairs, so medians are survivor-only.
 *
 * @typedef {Object} TokenInsight
 * @property {number} unguidedUncachedMedian Pooled median across paired tasks.
 * @property {number} guidedUncachedMedian Pooled median across paired tasks.
 * @property {number} deltaPct Percent change of the guided uncached median vs. unguided, 1 decimal.
 * @property {number} pairedMedianDelta Median of per-task (guided - unguided) uncached differences (0 when not pooled).
 * @property {number} unguidedTotalMedian Pooled median of total (cached + uncached) tokens.
 * @property {number} guidedTotalMedian
 * @property {number} totalDeltaPct
 * @property {'pooled' | 'latest'} medianSource
 * @property {number} fewerTaskPct Percent of paired tasks using fewer uncached tokens when guided, pooled, 1 decimal.
 * @property {number} fewerTasksCount
 * @property {number} pairedTaskCount
 * @property {number} unguidedCachedSharePct Pooled cached share of all unguided tokens, 1 decimal.
 * @property {number} guidedCachedSharePct Pooled cached share of all guided tokens, 1 decimal.
 * @property {TokenSuitePoint} latest
 * @property {TokenSuitePoint[]} perSuite Newest first.
 * @property {number} suitesFewer Number of selected suites whose guided uncached median was lower.
 * @property {'fewer' | 'more' | 'mixed'} direction
 */

/**
 * @typedef {Object} FamilyInsight
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} agents Raw agent ids observed in the selected suites.
 * @property {string[]} models Models observed in the selected suites.
 * @property {SuiteRef[]} suites Newest first.
 * @property {number} suiteCount
 * @property {SuiteRef} latest
 * @property {number} tasksEvaluated Sum of `taskCount` across selected suites.
 * @property {number} maxEarlyFailureRate Highest per-suite early-failure rate among selected suites (caveat flag).
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y Null when no selected suite carries `a11yStats`.
 * @property {RuntimeInsight | null} runtime Null when no selected suite carries `efficiencyStats`.
 * @property {TokenInsight | null} tokens
 */

/**
 * @typedef {Object} PooledInsight
 * @property {number} suiteCount
 * @property {number} familyCount
 * @property {number} tasksEvaluated
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y
 * @property {{ fasterTaskPct: number, fasterTasksCount: number, pairedTaskCount: number, familiesFaster: number } | null} runtime
 *   No pooled medians: they are not derivable from per-suite medians. `familiesFaster` counts families whose latest suite had a lower guided median.
 * @property {{ fewerTaskPct: number, fewerTasksCount: number, pairedTaskCount: number, familiesFewer: number } | null} tokens
 */

/**
 * @typedef {Object} HeadlineInsights
 * @property {{ perAgentRecentN: number, nightlyOnly: boolean, before: string | null }} options
 * @property {FamilyInsight[]} families Ordered like `AGENT_FAMILIES`; families with no suites are omitted.
 * @property {PooledInsight | null} pooled Null when no suites were selected.
 * @property {string[]} suiteIds All selected suites, newest first.
 * @property {string | null} latestTimestamp
 * @property {string | null} earliestTimestamp
 * @property {string[]} missingStats Selected suites lacking `a11yStats` or `efficiencyStats` (see {@link hydrateMissingStats}).
 */

/**
 * @typedef {Object} InsightOptions
 * @property {number} [perAgentRecentN=3] Latest N suites per family.
 * @property {boolean} [nightlyOnly=true] Restrict to suites whose id starts with `nightly-`.
 * @property {string | null} [before=null] ISO date/time; only suites with `timestamp < before` are used (reproducibility / fact-checking).
 * @property {AgentFamilyDef[]} [families=AGENT_FAMILIES]
 */

/**
 * @param {number} value
 * @param {number} [digits=1]
 * @returns {number}
 */
function round(value, digits = 1) {
    const f = 10 ** digits;
    return Math.round(value * f) / f;
}

/**
 * @param {number} numerator
 * @param {number} denominator
 * @returns {number} Percent with 1 decimal, 0 when the denominator is 0.
 */
function pct(numerator, denominator) {
    return denominator > 0 ? round((numerator / denominator) * 100) : 0;
}

/**
 * @param {number} guided
 * @param {number} unguided
 * @returns {number} Percent change, 1 decimal, 0 when unguided is 0.
 */
function deltaPct(guided, unguided) {
    return unguided > 0 ? round(((guided - unguided) / unguided) * 100) : 0;
}

/**
 * Returns the suite's ISO timestamp, falling back to the date encoded in a nightly id.
 * @param {ManifestSuite} suite
 * @returns {string}
 */
export function getSuiteTimestamp(suite) {
    if (suite.timestamp && !Number.isNaN(Date.parse(suite.timestamp))) return suite.timestamp;
    const m = /(\d{4}-\d{2}-\d{2})[_T](\d{2})-(\d{2})-(\d{2})/.exec(suite.testId || '');
    if (m) return `${m[1]}T${m[2]}:${m[3]}:${m[4]}.000Z`;
    return '';
}

/**
 * @param {ManifestSuite} suite
 * @returns {boolean}
 */
export function isNightlySuite(suite) {
    return typeof suite.testId === 'string' && suite.testId.startsWith('nightly-');
}

/**
 * @param {string | undefined} agent
 * @param {AgentFamilyDef[]} [families=AGENT_FAMILIES]
 * @returns {AgentFamilyDef | null}
 */
export function getAgentFamily(agent, families = AGENT_FAMILIES) {
    if (!agent) return null;
    const needle = agent.toLowerCase();
    return families.find(f => f.agents.includes(needle)) || null;
}

/**
 * @param {ManifestSuite} suite
 * @returns {boolean} True when the entry carries the fields the hero needs.
 */
export function hasHeadlineStats(suite) {
    return Boolean(suite.a11yStats && suite.efficiencyStats);
}

/**
 * Selects the latest N nightly suites per agent family (newest first within each family).
 *
 * @param {Array<ManifestSuite | string>} suites
 * @param {InsightOptions} [options]
 * @returns {Map<AgentFamilyDef, ManifestSuite[]>} Insertion order follows `families`.
 */
export function selectRecentSuites(suites, options = {}) {
    const { perAgentRecentN = 3, nightlyOnly = true, before = null, families = AGENT_FAMILIES } = options;
    const beforeMs = before ? Date.parse(before) : NaN;

    /** @type {Map<AgentFamilyDef, ManifestSuite[]>} */
    const byFamily = new Map();
    families.forEach(f => byFamily.set(f, []));

    (suites || []).forEach(entry => {
        /** @type {ManifestSuite | null} */
        const suite = typeof entry === 'string' ? { testId: entry } : entry;
        if (!suite || !suite.testId || !suite.guidedStats) return;
        if (nightlyOnly && !isNightlySuite(suite)) return;
        const family = getAgentFamily(suite.agent, families);
        if (!family) return;
        const ts = getSuiteTimestamp(suite);
        if (!ts) return;
        if (!Number.isNaN(beforeMs) && Date.parse(ts) >= beforeMs) return;
        /** @type {ManifestSuite[]} */ (byFamily.get(family)).push(suite);
    });

    byFamily.forEach((list, family) => {
        list.sort((a, b) => Date.parse(getSuiteTimestamp(b)) - Date.parse(getSuiteTimestamp(a)));
        byFamily.set(family, list.slice(0, perAgentRecentN));
    });
    return byFamily;
}

/**
 * Client-side fallback for manifests written before `a11yStats` / `efficiencyStats` existed:
 * fetches `evals.json` for the selected suites that lack them and recomputes the summary
 * in place (mutating the manifest entries), so `computeHeadlineInsights` can run unchanged.
 *
 * @param {Array<ManifestSuite | string>} suites Full manifest; only selected entries are hydrated.
 * @param {(testId: string) => Promise<import('../harness/lib/metrics.ts').EvalsReport>} fetchEvals
 *   e.g. `(id) => api.getEvals(id)`.
 * @param {InsightOptions} [options]
 * @returns {Promise<{ hydrated: string[], failed: string[] }>}
 */
export async function hydrateMissingStats(suites, fetchEvals, options = {}) {
    const selected = selectRecentSuites(suites, options);
    /** @type {ManifestSuite[]} */
    const targets = [];
    selected.forEach(list => list.forEach(s => { if (!hasHeadlineStats(s)) targets.push(s); }));

    /** @type {string[]} */
    const hydrated = [];
    /** @type {string[]} */
    const failed = [];
    await Promise.all(targets.map(async suite => {
        try {
            const evals = await fetchEvals(suite.testId);
            const summary = extractSuiteSummary(suite.testId, evals, suite.timestamp || null);
            if (summary) {
                Object.assign(suite, summary);
                hydrated.push(suite.testId);
                return;
            }
        } catch {
            // fall through
        }
        failed.push(suite.testId);
    }));
    return { hydrated, failed };
}

/**
 * @param {ManifestSuite} suite
 * @returns {SuiteRef}
 */
function toSuiteRef(suite) {
    const timestamp = getSuiteTimestamp(suite);
    return {
        testId: suite.testId,
        timestamp,
        date: timestamp.slice(0, 10),
        agent: suite.agent || 'unknown',
        model: suite.model || 'unknown',
        taskCount: suite.taskCount || 0,
        earlyFailureRate: suite.earlyFailureRate || 0
    };
}

/**
 * @param {{ unguidedPassed: number, unguidedTotal: number, guidedPassed: number, guidedTotal: number }} c
 * @returns {RateComparison}
 */
function toRateComparison(c) {
    const unguidedRate = pct(c.unguidedPassed, c.unguidedTotal);
    const guidedRate = pct(c.guidedPassed, c.guidedTotal);
    const rawU = c.unguidedTotal > 0 ? (c.unguidedPassed / c.unguidedTotal) * 100 : 0;
    const rawG = c.guidedTotal > 0 ? (c.guidedPassed / c.guidedTotal) * 100 : 0;
    return {
        unguidedRate,
        guidedRate,
        upliftPp: round(rawG - rawU),
        unguidedPassed: c.unguidedPassed,
        unguidedTotal: c.unguidedTotal,
        guidedPassed: c.guidedPassed,
        guidedTotal: c.guidedTotal
    };
}

/**
 * Accumulates the poolable counters of a list of suites.
 * @param {ManifestSuite[]} suites
 */
function accumulate(suites) {
    const acc = {
        overall: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11y: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11ySuites: 0,
        a11yGuideCount: 0,
        runtime: { fasterTasksCount: 0, pairedTaskCount: 0 },
        tokens: { fewerTasksCount: 0, pairedTaskCount: 0, unguidedTotal: 0, unguidedUncachedTotal: 0, guidedTotal: 0, guidedUncachedTotal: 0 },
        efficiencySuites: 0,
        tasksEvaluated: 0,
        maxEarlyFailureRate: 0
    };
    suites.forEach(s => {
        acc.overall.unguidedPassed += s.unguidedStats?.passed || 0;
        acc.overall.unguidedTotal += s.unguidedStats?.total || 0;
        acc.overall.guidedPassed += s.guidedStats?.passed || 0;
        acc.overall.guidedTotal += s.guidedStats?.total || 0;
        acc.tasksEvaluated += s.taskCount || 0;
        acc.maxEarlyFailureRate = Math.max(acc.maxEarlyFailureRate, s.earlyFailureRate || 0);
        if (s.a11yStats) {
            acc.a11ySuites += 1;
            acc.a11y.unguidedPassed += s.a11yStats.unguidedPassed;
            acc.a11y.unguidedTotal += s.a11yStats.unguidedTotal;
            acc.a11y.guidedPassed += s.a11yStats.guidedPassed;
            acc.a11y.guidedTotal += s.a11yStats.guidedTotal;
            acc.a11yGuideCount = Math.max(acc.a11yGuideCount, s.a11yStats.guideCount || 0);
        }
        if (s.efficiencyStats) {
            acc.efficiencySuites += 1;
            const rt = s.efficiencyStats.runtime;
            const tk = s.efficiencyStats.tokens;
            acc.runtime.fasterTasksCount += rt.fasterTasksCount || 0;
            acc.runtime.pairedTaskCount += rt.pairedTaskCount || 0;
            acc.tokens.fewerTasksCount += tk.fewerUncachedTasksCount || 0;
            // Older WIP manifests lack tokens.pairedTaskCount; derive it from the percentage.
            const pairedTokens = typeof tk.pairedTaskCount === 'number'
                ? tk.pairedTaskCount
                : (tk.fewerUncachedTokensTaskPct > 0 ? Math.round((tk.fewerUncachedTasksCount || 0) * 100 / tk.fewerUncachedTokensTaskPct) : 0);
            acc.tokens.pairedTaskCount += pairedTokens;
            acc.tokens.unguidedTotal += tk.unguidedTotal || 0;
            acc.tokens.unguidedUncachedTotal += tk.unguidedUncachedTotal || 0;
            acc.tokens.guidedTotal += tk.guidedTotal || 0;
            acc.tokens.guidedUncachedTotal += tk.guidedUncachedTotal || 0;
        }
    });
    return acc;
}

/**
 * @param {ManifestSuite} s
 * @returns {RuntimeSuitePoint}
 */
function toRuntimePoint(s) {
    const rt = /** @type {import('./summary-extractor.js').SuiteEfficiencyStats} */ (s.efficiencyStats).runtime;
    return {
        testId: s.testId,
        date: getSuiteTimestamp(s).slice(0, 10),
        unguidedMedianMs: rt.unguidedMedianMs,
        guidedMedianMs: rt.guidedMedianMs,
        deltaPct: deltaPct(rt.guidedMedianMs, rt.unguidedMedianMs),
        fasterTaskPct: rt.fasterTaskPct
    };
}

/**
 * @param {ManifestSuite} s
 * @returns {TokenSuitePoint}
 */
function toTokenPoint(s) {
    const tk = /** @type {import('./summary-extractor.js').SuiteEfficiencyStats} */ (s.efficiencyStats).tokens;
    return {
        testId: s.testId,
        date: getSuiteTimestamp(s).slice(0, 10),
        unguidedUncachedMedian: tk.unguidedUncachedMedian,
        guidedUncachedMedian: tk.guidedUncachedMedian,
        deltaPct: deltaPct(tk.guidedUncachedMedian, tk.unguidedUncachedMedian),
        unguidedTotalMedian: tk.unguidedTotalMedian,
        guidedTotalMedian: tk.guidedTotalMedian,
        totalDeltaPct: deltaPct(tk.guidedTotalMedian, tk.unguidedTotalMedian),
        unguidedCachedSharePct: tk.unguidedCachedSharePct,
        guidedCachedSharePct: tk.guidedCachedSharePct,
        fewerTaskPct: tk.fewerUncachedTokensTaskPct
    };
}

/**
 * Per-task paired values of one suite, read from `chartData` (one entry per task label).
 * A task is paired when both modes recorded a value > 0.
 * @param {ManifestSuite} s
 * @returns {{ runtime: Array<[number, number]>, tokens: Array<[number, number]>, totals: Array<[number, number]> } | null}
 *   Tuples are `[unguided, guided]`; null when the suite has no per-task runtime/token arrays.
 */
function pairedTaskValues(s) {
    const cd = s.chartData;
    if (!cd || !Array.isArray(cd.guided_runtime_ms) || !Array.isArray(cd.guided_uncached_tokens)) return null;
    /** @type {Array<[number, number]>} */
    const runtime = [];
    /** @type {Array<[number, number]>} */
    const tokens = [];
    /** @type {Array<[number, number]>} */
    const totals = [];
    const n = cd.labels.length;
    for (let i = 0; i < n; i++) {
        const uMs = cd.unguided_runtime_ms[i] || 0;
        const gMs = cd.guided_runtime_ms[i] || 0;
        if (uMs > 0 && gMs > 0) runtime.push([uMs, gMs]);
        const uTok = cd.unguided_uncached_tokens[i] || 0;
        const gTok = cd.guided_uncached_tokens[i] || 0;
        const uTot = cd.unguided_tokens[i] || 0;
        const gTot = cd.guided_tokens[i] || 0;
        if (uTot > 0 && gTot > 0) {
            tokens.push([uTok, gTok]);
            totals.push([uTot, gTot]);
        }
    }
    return { runtime, tokens, totals };
}

/**
 * @param {AgentFamilyDef} family
 * @param {ManifestSuite[]} suites Newest first.
 * @returns {FamilyInsight}
 */
function buildFamilyInsight(family, suites) {
    const acc = accumulate(suites);
    const withEfficiency = suites.filter(s => s.efficiencyStats);

    /** @type {RuntimeInsight | null} */
    let runtime = null;
    /** @type {TokenInsight | null} */
    let tokens = null;
    if (withEfficiency.length > 0) {
        const rtPoints = withEfficiency.map(toRuntimePoint);
        const tkPoints = withEfficiency.map(toTokenPoint);
        const suitesFaster = rtPoints.filter(p => p.guidedMedianMs < p.unguidedMedianMs).length;
        const suitesFewer = tkPoints.filter(p => p.guidedUncachedMedian < p.unguidedUncachedMedian).length;

        // Pool per-task pairs across suites when every selected suite carries chartData runtime/token arrays.
        const perSuitePairs = withEfficiency.map(pairedTaskValues);
        const canPool = perSuitePairs.every(p => p !== null);

        if (canPool) {
            const rtPairs = perSuitePairs.flatMap(p => /** @type {NonNullable<typeof p>} */ (p).runtime);
            const tkPairs = perSuitePairs.flatMap(p => /** @type {NonNullable<typeof p>} */ (p).tokens);
            const totPairs = perSuitePairs.flatMap(p => /** @type {NonNullable<typeof p>} */ (p).totals);

            const uMs = Math.round(median(rtPairs.map(p => p[0])));
            const gMs = Math.round(median(rtPairs.map(p => p[1])));
            const fasterCount = rtPairs.filter(p => p[1] <= p[0]).length;
            runtime = {
                unguidedMedianMs: uMs,
                guidedMedianMs: gMs,
                deltaPct: deltaPct(gMs, uMs),
                pairedMedianDeltaMs: Math.round(median(rtPairs.map(p => p[1] - p[0]))),
                medianSource: 'pooled',
                fasterTaskPct: pct(fasterCount, rtPairs.length),
                fasterTasksCount: fasterCount,
                pairedTaskCount: rtPairs.length,
                latest: rtPoints[0],
                perSuite: rtPoints,
                suitesFaster,
                direction: suitesFaster === rtPoints.length ? 'faster' : (suitesFaster === 0 ? 'slower' : 'mixed')
            };

            const uTok = Math.round(median(tkPairs.map(p => p[0])));
            const gTok = Math.round(median(tkPairs.map(p => p[1])));
            const uTot = Math.round(median(totPairs.map(p => p[0])));
            const gTot = Math.round(median(totPairs.map(p => p[1])));
            const fewerCount = tkPairs.filter(p => p[1] <= p[0]).length;
            tokens = {
                unguidedUncachedMedian: uTok,
                guidedUncachedMedian: gTok,
                deltaPct: deltaPct(gTok, uTok),
                pairedMedianDelta: Math.round(median(tkPairs.map(p => p[1] - p[0]))),
                unguidedTotalMedian: uTot,
                guidedTotalMedian: gTot,
                totalDeltaPct: deltaPct(gTot, uTot),
                medianSource: 'pooled',
                fewerTaskPct: pct(fewerCount, tkPairs.length),
                fewerTasksCount: fewerCount,
                pairedTaskCount: tkPairs.length,
                unguidedCachedSharePct: pct(acc.tokens.unguidedTotal - acc.tokens.unguidedUncachedTotal, acc.tokens.unguidedTotal),
                guidedCachedSharePct: pct(acc.tokens.guidedTotal - acc.tokens.guidedUncachedTotal, acc.tokens.guidedTotal),
                latest: tkPoints[0],
                perSuite: tkPoints,
                suitesFewer,
                direction: suitesFewer === tkPoints.length ? 'fewer' : (suitesFewer === 0 ? 'more' : 'mixed')
            };
        } else {
            // No per-task data: medians from the latest suite, paired counts summed from efficiencyStats.
            runtime = {
                unguidedMedianMs: rtPoints[0].unguidedMedianMs,
                guidedMedianMs: rtPoints[0].guidedMedianMs,
                deltaPct: rtPoints[0].deltaPct,
                pairedMedianDeltaMs: 0,
                medianSource: 'latest',
                fasterTaskPct: pct(acc.runtime.fasterTasksCount, acc.runtime.pairedTaskCount),
                fasterTasksCount: acc.runtime.fasterTasksCount,
                pairedTaskCount: acc.runtime.pairedTaskCount,
                latest: rtPoints[0],
                perSuite: rtPoints,
                suitesFaster,
                direction: suitesFaster === rtPoints.length ? 'faster' : (suitesFaster === 0 ? 'slower' : 'mixed')
            };
            tokens = {
                unguidedUncachedMedian: tkPoints[0].unguidedUncachedMedian,
                guidedUncachedMedian: tkPoints[0].guidedUncachedMedian,
                deltaPct: tkPoints[0].deltaPct,
                pairedMedianDelta: 0,
                unguidedTotalMedian: tkPoints[0].unguidedTotalMedian,
                guidedTotalMedian: tkPoints[0].guidedTotalMedian,
                totalDeltaPct: tkPoints[0].totalDeltaPct,
                medianSource: 'latest',
                fewerTaskPct: pct(acc.tokens.fewerTasksCount, acc.tokens.pairedTaskCount),
                fewerTasksCount: acc.tokens.fewerTasksCount,
                pairedTaskCount: acc.tokens.pairedTaskCount,
                unguidedCachedSharePct: pct(acc.tokens.unguidedTotal - acc.tokens.unguidedUncachedTotal, acc.tokens.unguidedTotal),
                guidedCachedSharePct: pct(acc.tokens.guidedTotal - acc.tokens.guidedUncachedTotal, acc.tokens.guidedTotal),
                latest: tkPoints[0],
                perSuite: tkPoints,
                suitesFewer,
                direction: suitesFewer === tkPoints.length ? 'fewer' : (suitesFewer === 0 ? 'more' : 'mixed')
            };
        }
    }

    const refs = suites.map(toSuiteRef);
    return {
        id: family.id,
        label: family.label,
        description: family.description,
        agents: Array.from(new Set(refs.map(r => r.agent))),
        models: Array.from(new Set(refs.map(r => r.model))),
        suites: refs,
        suiteCount: refs.length,
        latest: refs[0],
        tasksEvaluated: acc.tasksEvaluated,
        maxEarlyFailureRate: acc.maxEarlyFailureRate,
        overall: toRateComparison(acc.overall),
        a11y: acc.a11ySuites > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null,
        runtime,
        tokens
    };
}

/**
 * Computes the landing-page headline numbers from manifest entries.
 *
 * @param {Array<ManifestSuite | string>} suites Manifest entries (`suites.gen.json` array or `/api/suites`'s `suites`).
 * @param {InsightOptions} [options]
 * @returns {HeadlineInsights}
 */
export function computeHeadlineInsights(suites, options = {}) {
    const { perAgentRecentN = 3, nightlyOnly = true, before = null } = options;
    const selected = selectRecentSuites(suites, options);

    /** @type {FamilyInsight[]} */
    const families = [];
    /** @type {ManifestSuite[]} */
    const allSelected = [];
    selected.forEach((list, family) => {
        if (list.length === 0) return;
        allSelected.push(...list);
        families.push(buildFamilyInsight(family, list));
    });

    /** @type {PooledInsight | null} */
    let pooled = null;
    if (allSelected.length > 0) {
        const acc = accumulate(allSelected);
        pooled = {
            suiteCount: allSelected.length,
            familyCount: families.length,
            tasksEvaluated: acc.tasksEvaluated,
            overall: toRateComparison(acc.overall),
            a11y: acc.a11ySuites > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null,
            runtime: acc.efficiencySuites > 0 ? {
                fasterTaskPct: pct(acc.runtime.fasterTasksCount, acc.runtime.pairedTaskCount),
                fasterTasksCount: acc.runtime.fasterTasksCount,
                pairedTaskCount: acc.runtime.pairedTaskCount,
                familiesFaster: families.filter(f => f.runtime && f.runtime.guidedMedianMs < f.runtime.unguidedMedianMs).length
            } : null,
            tokens: acc.efficiencySuites > 0 ? {
                fewerTaskPct: pct(acc.tokens.fewerTasksCount, acc.tokens.pairedTaskCount),
                fewerTasksCount: acc.tokens.fewerTasksCount,
                pairedTaskCount: acc.tokens.pairedTaskCount,
                familiesFewer: families.filter(f => f.tokens && f.tokens.guidedUncachedMedian < f.tokens.unguidedUncachedMedian).length
            } : null
        };
    }

    const sortedAll = [...allSelected].sort((a, b) => Date.parse(getSuiteTimestamp(b)) - Date.parse(getSuiteTimestamp(a)));
    return {
        options: { perAgentRecentN, nightlyOnly, before },
        families,
        pooled,
        suiteIds: sortedAll.map(s => s.testId),
        latestTimestamp: sortedAll.length ? getSuiteTimestamp(sortedAll[0]) : null,
        earliestTimestamp: sortedAll.length ? getSuiteTimestamp(sortedAll[sortedAll.length - 1]) : null,
        missingStats: sortedAll.filter(s => !hasHeadlineStats(s)).map(s => s.testId)
    };
}
