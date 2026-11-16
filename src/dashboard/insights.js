import { extractJobSummary } from './summary-extractor.js';
import { parseJobDateInfo } from './utils.js';
import { AGENT_FAMILIES } from './agents.js';
import { SHOWCASE_GUIDE_IDS, SHOWCASE_TASKS } from './showcase-config.js';
export { AGENT_FAMILIES };
/** @typedef {import('./summary-extractor.js').JobSummary} JobSummary */
/** @typedef {Partial<JobSummary> & { testId: string, source?: import('./api.js').DataSource, pageLoadStats?: { guidedFailed?: number, unguidedFailed?: number } }} ManifestJob */
/** @typedef {import('./agents.js').AgentFamilyDef} AgentFamilyDef */
/** @typedef {Object} RateComparison
 * @property {number | null} unguidedRate null when that side ran no checks
 * @property {number | null} guidedRate null when that side ran no checks
 * @property {number | null} upliftPp null unless both sides ran checks
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} guidedPassed
 * @property {number} guidedTotal */
/** @typedef {RateComparison & { guideCount: number }} A11yComparison */
/** @typedef {Object} JobRef
 * @property {string} testId
 * @property {string} timestamp
 * @property {string} agent
 * @property {string} model
 * @property {import('./api.js').DataSource | null} source
 * @property {number} taskCount
 * @property {number | null} pairedTaskCount
 * @property {number} maxRuns
 * @property {number} earlyFailureRate
 * @property {number | null} earlyFailureCount
 * @property {number} unguidedLeakRate
 * @property {number} pageLoadFailed
 * @property {boolean} [curated]
 * @property {import('./evals.d.ts').ReasoningEffort} [reasoningEffort] */
/** @typedef {Object} FamilySample
 * @property {number} attemptedTasks
 * @property {number} pairedTasks
 * @property {number} excludedTasks
 * @property {number} minTrialsPerTask
 * @property {number} maxTrialsPerTask
 * @property {number | null} infraErrorCount
 * @property {number} infraErrorRate
 * @property {number} unguidedLeakRate
 * @property {number} pageLoadFailed */
/** @typedef {Object} FamilyInsight
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {string[]} agents
 * @property {string[]} models
 * @property {JobRef[]} jobs
 * @property {number} jobCount
 * @property {JobRef} latest
 * @property {FamilySample} sample
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y */
/** @typedef {Object} PooledInsight
 * @property {number} jobCount
 * @property {number} familyCount
 * @property {RateComparison} overall
 * @property {A11yComparison | null} a11y */
/** @typedef {Object} HeadlineInsights
 * @property {{ perAgentRecentN: number, canonicalOnly?: boolean, nightlyOnly: boolean, before: string | null }} options
 * @property {FamilyInsight[]} families
 * @property {PooledInsight | null} pooled
 * @property {string[]} jobIds
 * @property {string | null} latestTimestamp
 * @property {number} maxJobsPerFamily
 * @property {string[]} missingStats */
/** @typedef {Object} InsightOptions
 * @property {number} [perAgentRecentN=1]
 * @property {boolean} [canonicalOnly=true]
 * @property {boolean} [nightlyOnly=true]
 * @property {number} [modelRecencyDays=7]
 * @property {string | null} [before=null]
 * @property {AgentFamilyDef[]} [families] */

/**
 * Maximum days between a model's newest job and the newest job for that agent family.
 * Prevents retired or one-off experimental models (e.g. Fable from weeks ago) from lingering
 * in the headline numbers forever alongside active evaluation models.
 */
export const MODEL_RECENCY_WINDOW_DAYS = 7;
/** @param {number} value @param {number} [digits=1] */
function round(value, digits = 1) { const f = 10 ** digits; return Math.round(value * f) / f; }
/** @param {number} numerator @param {number} denominator */
function pct(numerator, denominator) { return denominator > 0 ? round((numerator / denominator) * 100) : null; }
/** @param {ManifestJob} job */
export function getJobTimestamp(job) {
    const info = parseJobDateInfo(job.timestamp, job.testId || '');
    if (!info) return '';
    return info.dateOnly ? info.date.toISOString().slice(0, 10) : info.date.toISOString();
}
/** @param {ManifestJob} job */
export function isCanonicalJob(job) {
    if (!job || typeof job.testId !== 'string') return false;
    return Boolean(job.curated) || job.testId.startsWith('nightly-');
}
/** @param {string | undefined} agent
 * @param {AgentFamilyDef[]} [families=AGENT_FAMILIES] */
export function getAgentFamily(agent, families = AGENT_FAMILIES) { if (!agent) return null; const needle = agent.toLowerCase(); return families.find(f => f.agents.includes(needle)) || null; }
/** @param {ManifestJob} job */
// Also requires the A/B Spotlight slice, so manifests from older extractors get hydrated from evals.json.
export function hasHeadlineStats(job) {
    if (!job || !job.a11yStats || !job.showcase) return false;
    const keys = Object.keys(job.showcase);
    if (keys.some(k => !SHOWCASE_GUIDE_IDS.has(k))) return false;
    if (job.guides) {
        return SHOWCASE_TASKS.every(t => {
            const g = job.guides?.[t.id];
            if (!g) return true;
            const expectsSlice = g.guidedTotal === undefined || (g.guidedTotal > 0 && g.unguidedTotal > 0);
            return !expectsSlice || Boolean(job.showcase?.[t.id]);
        });
    }
    return keys.length === 0 || SHOWCASE_TASKS.every(t => Boolean(job.showcase?.[t.id]));
}
/** @param {ManifestJob[]} jobs
 * @param {InsightOptions} [options]
 * @returns {Map<AgentFamilyDef, ManifestJob[]>} */
function collectFamilyJobs(jobs, options = {}) {
    const { before = null, families = AGENT_FAMILIES } = options;
    const filterCanonical = options.canonicalOnly ?? options.nightlyOnly ?? true;
    const beforeMs = before ? Date.parse(before) : NaN;
    /** @type {Map<AgentFamilyDef, ManifestJob[]>} */
    const byFamily = new Map();
    families.forEach(f => byFamily.set(f, []));
    (jobs || []).forEach(job => {
        if (!job || !job.testId || !job.guidedStats) return;
        if (filterCanonical && !isCanonicalJob(job)) return;
        const family = getAgentFamily(job.agent, families);
        if (!family) return;
        const ts = getJobTimestamp(job);
        if (!ts) return;
        if (!Number.isNaN(beforeMs) && Date.parse(ts) >= beforeMs) return;
        /** @type {ManifestJob[]} */
        (byFamily.get(family)).push(job);
    });
    byFamily.forEach((list) => {
        list.sort((a, b) => (Date.parse(getJobTimestamp(b)) - Date.parse(getJobTimestamp(a))) || b.testId.localeCompare(a.testId));
    });
    return byFamily;
}
/**
 * For an agent family, selects the latest N canonical jobs per model, sorted newest-first.
 * When a model has multiple jobs (e.g. rolling nightly vs 1.0 baseline), the newest job wins.
 * Grouping is keyed by model name so new nightly jobs naturally supersede baseline jobs for
 * the same model without hiding sibling models (e.g. Sonnet does not hide Opus).
 * Only models evaluated within `modelRecencyDays` (default: 7) of the family's newest job
 * are included, preventing stale or retired one-off models from lingering in headline metrics.
 * @param {ManifestJob[]} list
 * @param {number} [n=1]
 * @param {Pick<InsightOptions, 'modelRecencyDays'>} [options={}]
 * @returns {ManifestJob[]}
 */
export function selectFamilyJobs(list, n = 1, options = {}) {
    const recencyDays = options.modelRecencyDays ?? MODEL_RECENCY_WINDOW_DAYS;
    const newestFamilyMs = list.length > 0 ? Date.parse(getJobTimestamp(list[0])) : NaN;
    const cutoffMs = Number.isNaN(newestFamilyMs) ? 0 : newestFamilyMs - recencyDays * 24 * 60 * 60 * 1000;

    /** @type {Map<string, ManifestJob[]>} */
    const byModel = new Map();
    for (const job of list) {
        const model = job.model || 'unknown';
        let modelList = byModel.get(model);
        if (!modelList) {
            const modelNewestMs = Date.parse(getJobTimestamp(job));
            if (!Number.isNaN(cutoffMs) && modelNewestMs < cutoffMs) continue;
            modelList = [];
            byModel.set(model, modelList);
        }
        modelList.push(job);
    }
    /** @type {ManifestJob[]} */
    const selected = [];
    for (const modelJobs of byModel.values()) {
        selected.push(...modelJobs.slice(0, n));
    }
    selected.sort((a, b) => (Date.parse(getJobTimestamp(b)) - Date.parse(getJobTimestamp(a))) || b.testId.localeCompare(a.testId));
    return selected;
}
/** @param {ManifestJob[]} jobs
 * @param {InsightOptions} [options]
 * @returns {Map<AgentFamilyDef, ManifestJob[]>} */
export function selectRecentJobs(jobs, options = {}) {
    const { perAgentRecentN = 1 } = options;
    const byFamily = collectFamilyJobs(jobs, options);
    byFamily.forEach((list, family) => {
        byFamily.set(family, selectFamilyJobs(list, perAgentRecentN, options));
    });
    return byFamily;
}
/** @param {ManifestJob[]} jobs
 * @param {(testId: string) => Promise<import('../harness/lib/metrics.ts').EvalsReport>} fetchEvals
 * @param {InsightOptions} [options] */
export async function hydrateMissingStats(jobs, fetchEvals, options = {}) {
    const selected = selectRecentJobs(jobs, options);
    /** @type {ManifestJob[]} */
    const targets = [];
    selected.forEach(list => list.forEach(j => { if (!hasHeadlineStats(j)) targets.push(j); }));
    /** @type {string[]} */
    const hydrated = [];
    /** @type {string[]} */
    const failed = [];
    const concurrency = Math.min(4, targets.length);
    let cursor = 0;
    await Promise.all(Array.from({ length: concurrency }, async () => {
        while (cursor < targets.length) {
            const job = targets[cursor++];
            try {
                const evals = await fetchEvals(job.testId);
                const summary = extractJobSummary(job.testId, evals, job.timestamp || null);
                if (summary) { Object.assign(job, summary); hydrated.push(job.testId); continue; }
            } catch (err) {
                console.warn(`Headline stats: could not hydrate ${job.testId}`, err);
            }
            failed.push(job.testId);
        }
    }));
    return { hydrated, failed };
}
/** @param {ManifestJob} job @returns {JobRef} */
function toJobRef(job) {
    const timestamp = getJobTimestamp(job);
    const taskCount = job.taskCount || 0;
    const pairedTaskCount = typeof job.pairedTaskCount === 'number' ? job.pairedTaskCount : null;
    const pageLoadFailed = (job.pageLoadStats?.guidedFailed || 0) + (job.pageLoadStats?.unguidedFailed || 0);
    return {
        testId: job.testId,
        timestamp,
        agent: job.agent || 'unknown',
        model: job.model || 'unknown',
        source: job.source || null,
        taskCount,
        pairedTaskCount,
        maxRuns: job.maxRuns || 1,
        earlyFailureRate: job.earlyFailureRate || 0,
        earlyFailureCount: typeof job.earlyFailureCount === 'number' ? job.earlyFailureCount : null,
        unguidedLeakRate: job.unguidedLeakRate || 0,
        pageLoadFailed,
        curated: Boolean(job.curated),
        reasoningEffort: job.reasoningEffort
    };
}
/** @param {JobRef[]} refs @returns {FamilySample} */
function summarizeSample(refs) {
    const attemptedTasks = refs.reduce((sum, r) => sum + Math.max(r.taskCount, r.pairedTaskCount ?? 0), 0);
    const pairedTasks = refs.reduce((sum, r) => sum + (r.pairedTaskCount ?? r.taskCount), 0);
    const excludedTasks = Math.max(0, attemptedTasks - pairedTasks);
    const trialCounts = refs.map(r => r.maxRuns);
    const hasInfraCounts = refs.every(r => r.earlyFailureCount !== null);
    const infraErrorCount = hasInfraCounts ? refs.reduce((sum, r) => sum + (r.earlyFailureCount || 0), 0) : null;
    const infraErrorRate = Math.round(refs.reduce((sum, r) => sum + r.earlyFailureRate, 0) / refs.length);
    const unguidedLeakRate = Math.round(refs.reduce((sum, r) => sum + r.unguidedLeakRate, 0) / refs.length);
    const pageLoadFailed = refs.reduce((sum, r) => sum + r.pageLoadFailed, 0);
    return {
        attemptedTasks,
        pairedTasks,
        excludedTasks,
        minTrialsPerTask: Math.min(...trialCounts),
        maxTrialsPerTask: Math.max(...trialCounts),
        infraErrorCount,
        infraErrorRate,
        unguidedLeakRate,
        pageLoadFailed
    };
}
/** @param {{ unguidedPassed: number, unguidedTotal: number, guidedPassed: number, guidedTotal: number }} c @returns {RateComparison} */
function toRateComparison(c) {
    // A side with no checks has no rate; treating it as 0% would fabricate uplift.
    const hasBoth = c.unguidedTotal > 0 && c.guidedTotal > 0;
    return {
        unguidedRate: pct(c.unguidedPassed, c.unguidedTotal),
        guidedRate: pct(c.guidedPassed, c.guidedTotal),
        upliftPp: hasBoth ? round(((c.guidedPassed / c.guidedTotal) - (c.unguidedPassed / c.unguidedTotal)) * 100) : null,
        unguidedPassed: c.unguidedPassed,
        unguidedTotal: c.unguidedTotal,
        guidedPassed: c.guidedPassed,
        guidedTotal: c.guidedTotal
    };
}
/** @param {ManifestJob[]} jobs */
function accumulate(jobs) {
    const acc = {
        overall: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11y: { unguidedPassed: 0, unguidedTotal: 0, guidedPassed: 0, guidedTotal: 0 },
        a11yJobs: 0,
        a11yGuideCount: 0
    };
    const distinctA11yGuides = new Set();
    // Fallback for older manifests that carry a11yStats.guideCount but no per-guide a11y breakdown.
    let maxJobGuideCount = 0;
    jobs.forEach(j => {
        acc.overall.unguidedPassed += j.unguidedStats?.passed || 0;
        acc.overall.unguidedTotal += j.unguidedStats?.total || 0;
        acc.overall.guidedPassed += j.guidedStats?.passed || 0;
        acc.overall.guidedTotal += j.guidedStats?.total || 0;
        if (j.a11yStats && (j.a11yStats.guidedTotal > 0 || j.a11yStats.unguidedTotal > 0)) {
            acc.a11yJobs += 1;
            acc.a11y.unguidedPassed += j.a11yStats.unguidedPassed;
            acc.a11y.unguidedTotal += j.a11yStats.unguidedTotal;
            acc.a11y.guidedPassed += j.a11yStats.guidedPassed;
            acc.a11y.guidedTotal += j.a11yStats.guidedTotal;
            maxJobGuideCount = Math.max(maxJobGuideCount, j.a11yStats.guideCount || 0);
            if (j.guides) {
                for (const [slug, gStats] of Object.entries(j.guides)) {
                    if (gStats?.a11y && (gStats.a11y.guidedTotal > 0 || gStats.a11y.unguidedTotal > 0)) { distinctA11yGuides.add(slug); }
                }
            }
        }
    });
    acc.a11yGuideCount = distinctA11yGuides.size > 0 ? distinctA11yGuides.size : maxJobGuideCount;
    return acc;
}
/** @param {ManifestJob[]} jobs
 * @param {InsightOptions} [options]
 * @returns {HeadlineInsights} */
export function computeHeadlineInsights(jobs, options = {}) {
    const { perAgentRecentN = 1, before = null } = options;
    const filterCanonical = options.canonicalOnly ?? options.nightlyOnly ?? true;
    const allByFamily = collectFamilyJobs(jobs, options);
    let maxJobsPerFamily = 0;
    /** @type {FamilyInsight[]} */
    const families = [];
    /** @type {ManifestJob[]} */
    const allSelected = [];
    allByFamily.forEach((fullList, family) => {
        const activeCounts = new Map();
        for (const j of selectFamilyJobs(fullList, Infinity, options)) {
            const m = j.model || 'unknown';
            activeCounts.set(m, (activeCounts.get(m) || 0) + 1);
        }
        for (const count of activeCounts.values()) {
            maxJobsPerFamily = Math.max(maxJobsPerFamily, count);
        }
        const list = selectFamilyJobs(fullList, perAgentRecentN, options);
        if (list.length === 0) return;
        allSelected.push(...list);
        const acc = accumulate(list);
        const refs = list.map(toJobRef);
        families.push({
            id: family.id,
            label: family.label,
            description: family.description,
            agents: Array.from(new Set(refs.map(r => r.agent))),
            models: Array.from(new Set(refs.map(r => r.model))),
            jobs: refs,
            jobCount: refs.length,
            latest: refs[0],
            sample: summarizeSample(refs),
            overall: toRateComparison(acc.overall),
            a11y: acc.a11yJobs > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null
        });
    });
    /** @type {PooledInsight | null} */
    let pooled = null;
    if (allSelected.length > 0) {
        const acc = accumulate(allSelected);
        pooled = {
            jobCount: allSelected.length,
            familyCount: families.length,
            overall: toRateComparison(acc.overall),
            a11y: acc.a11yJobs > 0 ? { ...toRateComparison(acc.a11y), guideCount: acc.a11yGuideCount } : null
        };
    }
    const sortedAll = [...allSelected].sort((a, b) => (Date.parse(getJobTimestamp(b)) - Date.parse(getJobTimestamp(a))) || b.testId.localeCompare(a.testId));
    return {
        options: { perAgentRecentN, canonicalOnly: filterCanonical, nightlyOnly: filterCanonical, before },
        families,
        pooled,
        jobIds: sortedAll.map(j => j.testId),
        latestTimestamp: sortedAll.length ? getJobTimestamp(sortedAll[0]) : null,
        maxJobsPerFamily,
        missingStats: sortedAll.filter(j => !hasHeadlineStats(j)).map(j => j.testId)
    };
}
