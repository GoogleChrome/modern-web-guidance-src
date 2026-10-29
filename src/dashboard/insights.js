import { extractSuiteSummary } from './summary-extractor.js';
import { parseSuiteDate, toSuiteDateString } from './utils.js';
/** @typedef {import('./summary-extractor.js').SuiteSummary} SuiteSummary */
/** @typedef {Partial<SuiteSummary> & { testId: string }} ManifestSuite */
/** @typedef {Object} AgentFamilyDef
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} agents */
/** @type {AgentFamilyDef[]} */
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
/** @typedef {Object} RateComparison
 * @property {number} unguidedRate
 * @property {number} guidedRate
 * @property {number} upliftPp
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} guidedPassed
 * @property {number} guidedTotal */
/** @typedef {RateComparison & { guideCount: number }} A11yComparison */
/** @typedef {Object} SuiteRef
 * @property {string} testId
 * @property {string} timestamp
 * @property {string} agent
 * @property {string} model
 * @property {number} taskCount
 * @property {number} earlyFailureRate */
/** @typedef {Object} FamilyInsight
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} agents
 * @property {string[]} models
 * @property {SuiteRef[]} suites
 * @property {number} suiteCount
 * @property {SuiteRef} latest
 * @property {number} tasksEvaluated
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y */
/** @typedef {Object} PooledInsight
 * @property {number} suiteCount
 * @property {number} familyCount
 * @property {number} tasksEvaluated
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y */
/** @typedef {Object} HeadlineInsights
 * @property {{ perAgentRecentN: number, nightlyOnly: boolean, before: string | null }} options
 * @property {FamilyInsight[]} families
 * @property {PooledInsight | null} pooled
 * @property {string[]} suiteIds
 * @property {string | null} latestTimestamp
 * @property {string[]} missingStats */
/** @typedef {Object} InsightOptions
 * @property {number} [perAgentRecentN=1]
 * @property {boolean} [nightlyOnly=true]
 * @property {string | null} [before=null]
 * @property {AgentFamilyDef[]} [families=AGENT_FAMILIES] */
/** @param {number} value @param {number} [digits=1] */
function round(value, digits = 1) { const f = 10 ** digits; return Math.round(value * f) / f; }
/** @param {number} numerator @param {number} denominator */
function pct(numerator, denominator) { return denominator > 0 ? round((numerator / denominator) * 100) : 0; }
/** @param {ManifestSuite} suite */
export function getSuiteTimestamp(suite) { const date = parseSuiteDate(suite.timestamp, suite.testId || ''); return date ? toSuiteDateString(date) : ''; }
/** @param {ManifestSuite} suite */
export function isNightlySuite(suite) { return typeof suite.testId === 'string' && suite.testId.startsWith('nightly-'); }
/** @param {string | undefined} agent
 * @param {AgentFamilyDef[]} [families=AGENT_FAMILIES] */
export function getAgentFamily(agent, families = AGENT_FAMILIES) { if (!agent) return null; const needle = agent.toLowerCase(); return families.find(f => f.agents.includes(needle)) || null; }
/** @param {ManifestSuite} suite */
export function hasHeadlineStats(suite) { return Boolean(suite && suite.a11yStats); }
/** @param {Array<ManifestSuite | string>} suites
 * @param {InsightOptions} [options]
 * @returns {Map<AgentFamilyDef, ManifestSuite[]>} */
export function selectRecentSuites(suites, options = {}) {
    const { perAgentRecentN = 1, nightlyOnly = true, before = null, families = AGENT_FAMILIES } = options;
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
        /** @type {ManifestSuite[]} */
(byFamily.get(family)).push(suite);
    });
    byFamily.forEach((list, family) => {
        list.sort((a, b) => (Date.parse(getSuiteTimestamp(b)) - Date.parse(getSuiteTimestamp(a))) || b.testId.localeCompare(a.testId));
        byFamily.set(family, list.slice(0, perAgentRecentN));
    });
    return byFamily;
}
/** @param {Array<ManifestSuite | string>} suites
 * @param {(testId: string) => Promise<import('../harness/lib/metrics.ts').EvalsReport>} fetchEvals
 * @param {InsightOptions} [options] */
export async function hydrateMissingStats(suites, fetchEvals, options = {}) {
    const selected = selectRecentSuites(suites, options);
    /** @type {ManifestSuite[]} */
    const targets = [];
    selected.forEach(list => list.forEach(s => { if (!hasHeadlineStats(s)) targets.push(s); }));
    /** @type {string[]} */
    const hydrated = [];
    /** @type {string[]} */
    const failed = [];
    const concurrency = Math.min(4, targets.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (cursor < targets.length) {
            const suite = targets[cursor++];
            try {
                const evals = await fetchEvals(suite.testId);
                const summary = extractSuiteSummary(suite.testId, evals, suite.timestamp || null);
                if (summary) { Object.assign(suite, summary); hydrated.push(suite.testId); continue; }
            } catch {
            }
            failed.push(suite.testId);
        }
    }));
    return { hydrated, failed };
}
/** @param {ManifestSuite} suite @returns {SuiteRef} */
function toSuiteRef(suite) {
    const timestamp = getSuiteTimestamp(suite);
    return {
        testId: suite.testId,
        timestamp,
        agent: suite.agent || 'unknown',
        model: suite.model || 'unknown',
        taskCount: suite.taskCount || 0,
        earlyFailureRate: suite.earlyFailureRate || 0
    };
}
/** @param {{ unguidedPassed: number, unguidedTotal: number, guidedPassed: number, guidedTotal: number }} c @returns {RateComparison} */
function toRateComparison(c) {
    const rawU = c.unguidedTotal > 0 ? (c.unguidedPassed / c.unguidedTotal) * 100 : 0;
    const rawG = c.guidedTotal > 0 ? (c.guidedPassed / c.guidedTotal) * 100 : 0;
    return {
        unguidedRate: pct(c.unguidedPassed, c.unguidedTotal),
        guidedRate: pct(c.guidedPassed, c.guidedTotal),
        upliftPp: round(rawG - rawU),
        unguidedPassed: c.unguidedPassed,
        unguidedTotal: c.unguidedTotal,
        guidedPassed: c.guidedPassed,
        guidedTotal: c.guidedTotal
    };
}
/** @param {ManifestSuite[]} suites */
function accumulate(suites) {
    const acc = {
        overall: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11y: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11ySuites: 0,
        a11yGuideCount: 0,
        tasksEvaluated: 0
    };
    const distinctA11yGuides = new Set();
    suites.forEach(s => {
        acc.overall.unguidedPassed += s.unguidedStats?.passed || 0;
        acc.overall.unguidedTotal += s.unguidedStats?.total || 0;
        acc.overall.guidedPassed += s.guidedStats?.passed || 0;
        acc.overall.guidedTotal += s.guidedStats?.total || 0;
        acc.tasksEvaluated += s.taskCount || 0;
        if (s.a11yStats && (s.a11yStats.guidedTotal > 0 || s.a11yStats.unguidedTotal > 0)) {
            acc.a11ySuites += 1;
            acc.a11y.unguidedPassed += s.a11yStats.unguidedPassed;
            acc.a11y.unguidedTotal += s.a11yStats.unguidedTotal;
            acc.a11y.guidedPassed += s.a11yStats.guidedPassed;
            acc.a11y.guidedTotal += s.a11yStats.guidedTotal;
            acc.a11yGuideCount = Math.max(acc.a11yGuideCount, s.a11yStats.guideCount || 0);
            if (s.guides) {
                for (const [slug, gStats] of Object.entries(s.guides)) {
                    if (gStats?.a11y && (gStats.a11y.guidedTotal > 0 || gStats.a11y.unguidedTotal > 0)) { distinctA11yGuides.add(slug); }
                }
            }
        }
    });
    acc.a11yGuideCount = Math.max(acc.a11yGuideCount, distinctA11yGuides.size);
    return acc;
}
/** @param {Array<ManifestSuite | string>} suites
 * @param {InsightOptions} [options]
 * @returns {HeadlineInsights} */
export function computeHeadlineInsights(suites, options = {}) {
    const { perAgentRecentN = 1, nightlyOnly = true, before = null } = options;
    const selected = selectRecentSuites(suites, options);
    /** @type {FamilyInsight[]} */
    const families = [];
    /** @type {ManifestSuite[]} */
    const allSelected = [];
    selected.forEach((list, family) => {
        if (list.length === 0) return;
        allSelected.push(...list);
        const acc = accumulate(list);
        const refs = list.map(toSuiteRef);
        families.push({
            id: family.id,
            label: family.label,
            description: family.description,
            agents: Array.from(new Set(refs.map(r => r.agent))),
            models: Array.from(new Set(refs.map(r => r.model))),
            suites: refs,
            suiteCount: refs.length,
            latest: refs[0],
            tasksEvaluated: acc.tasksEvaluated,
            overall: toRateComparison(acc.overall),
            a11y: acc.a11ySuites > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null
        });
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
            a11y: acc.a11ySuites > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null
        };
    }
    const sortedAll = [...allSelected].sort((a, b) => (Date.parse(getSuiteTimestamp(b)) - Date.parse(getSuiteTimestamp(a))) || b.testId.localeCompare(a.testId));
    return {
        options: { perAgentRecentN, nightlyOnly, before },
        families,
        pooled,
        suiteIds: sortedAll.map(s => s.testId),
        latestTimestamp: sortedAll.length ? getSuiteTimestamp(sortedAll[0]) : null,
        missingStats: sortedAll.filter(s => !hasHeadlineStats(s)).map(s => s.testId)
    };
}
