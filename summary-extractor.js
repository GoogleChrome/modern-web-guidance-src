import { getRunStats, isEarlyFailureRun, isUnguidedLeakRun, getEligibleScenarioIds, parseResultKey, calculateChartData, median, getTokenBreakdown, getAgentRuntimeMs } from './utils.js';
import { A11Y_SUBCATEGORIES, classifyScenarioCheck } from './a11y-classifier.js';
import { SHOWCASE_GUIDE_IDS } from './showcase-config.js';
const TIMEOUT_MS = 600000;

/**
 * @typedef {Object} GuideSummary
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number | null} uplift null unless both sides ran checks
 * @property {SubCategoryA11yStats} [a11y]
 * @property {Record<string, GuideSummary>} [tasks]
 * @property {string} [taskName]
 */
/** @typedef {Object} SubCategoryA11yStats
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number | null} uplift */
/** @typedef {Object} SuiteA11yStats
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number | null} uplift
 * @property {number} guideCount
 * @property {Record<import('./a11y-classifier.js').A11ySubCategory, SubCategoryA11yStats>} bySubCategory */
/**
 * @typedef {Object} SuiteEfficiencyStats
 * @property {{
 *   guidedMedianMs: number,
 *   unguidedMedianMs: number,
 *   guidedMeanMs: number,
 *   unguidedMeanMs: number,
 *   medianDeltaPct: number,
 *   fasterTaskPct: number,
 *   fasterTasksCount: number,
 *   pairedTaskCount: number,
 *   guidedTimeouts: number,
 *   unguidedTimeouts: number
 * }} runtime
 * @property {{
 *   guidedUncachedMedian: number,
 *   unguidedUncachedMedian: number,
 *   uncachedMedianDelta: number,
 *   uncachedMedianDeltaPct: number,
 *   guidedTotalMedian: number,
 *   unguidedTotalMedian: number,
 *   guidedUncachedTotal: number,
 *   unguidedUncachedTotal: number,
 *   suiteUncachedDeltaPct: number,
 *   guidedTotal: number,
 *   unguidedTotal: number,
 *   guidedCachedSharePct: number,
 *   fewerUncachedTokensTaskPct: number,
 *   fewerUncachedTasksCount: number,
 *   pairedTaskCount: number
 * }} tokens
 */

/**
 * @typedef {Object} ShowcaseModeRun
 * @property {number} passed
 * @property {number} total
 * @property {number} a11yPassed
 * @property {number} a11yTotal
 * @property {number} runtimeMs
 * @property {number} uncachedTokens
 * @property {number} totalTokens
 * @property {string[]} guidesUsed
 * @property {boolean} earlyFailure true when the run failed before grading
 */
/**
 * @typedef {Object} ShowcaseCheck
 * @property {string} message
 * @property {boolean} unguidedPassed
 * @property {boolean} guidedPassed
 * @property {boolean} isA11y
 * @property {string | null} a11yLabel
 */
/**
 * Compact per-check results for a featured A/B Spotlight task (see showcase-config.js), taken
 * from the first run of each mode so the published manifest can drive the Spotlight directly.
 * @typedef {Object} ShowcaseSlice
 * @property {string} prompt
 * @property {string} discipline
 * @property {ShowcaseModeRun} unguided
 * @property {ShowcaseModeRun} guided
 * @property {ShowcaseCheck[]} checks
 */

/**
 * @typedef {Object} SuiteSummary
 * @property {string} testId
 * @property {string} timestamp
 * @property {string} agent
 * @property {string} serving
 * @property {string} model
 * @property {number} taskCount
 * @property {number} maxRuns
 * @property {{ passed: number, total: number }} guidedStats
 * @property {{ passed: number, total: number }} unguidedStats
 * @property {SuiteA11yStats} a11yStats
 * @property {SuiteEfficiencyStats} efficiencyStats
 * @property {number} earlyFailureRate
 * @property {number} [guidedErrorRate]
 * @property {number} [unguidedErrorRate]
 * @property {number} [unguidedLeakRate]
 * @property {Record<string, GuideSummary>} guides
 * @property {Record<string, ShowcaseSlice>} showcase featured Spotlight tasks present in this suite
 * @property {ReturnType<typeof calculateChartData>} chartData
 */

/**
 * Extracts a compact summary object from an evals.json payload.
 * @param {string} testId
 * @param {Partial<import('../harness/lib/metrics.ts').EvalsReport> & { enableSkills?: boolean }} evalsData
 * @param {string|null} [forcedTimestamp=null]
 * @returns {SuiteSummary|null}
 */
export function extractSuiteSummary(testId, evalsData, forcedTimestamp = null) {
    if (!evalsData) return null;

    let serving = 'unknown';
    if (evalsData.serving !== undefined) {
        serving = evalsData.serving;
    } else if (evalsData.enableSkills !== undefined) {
        serving = evalsData.enableSkills ? 'skills' : 'mcp';
    }

    const results = evalsData.results || {};
    const scenarioKeys = Object.keys(results);
    const eligibleScenarios = getEligibleScenarioIds(results);

    let guidedPassed = 0;
    let guidedTotal = 0;
    let unguidedPassed = 0;
    let unguidedTotal = 0;
    let maxRuns = 1;
    let totalAllRuns = 0;
    let guidedTotalRuns = 0;
    let guidedEarlyFailures = 0;
    let unguidedTotalRuns = 0;
    let unguidedEarlyFailures = 0;
    let unguidedLeaks = 0;

    let a11yGuidedPassed = 0;
    let a11yGuidedTotal = 0;
    let a11yUnguidedPassed = 0;
    let a11yUnguidedTotal = 0;
    const a11yGuides = new Set();
    /** @type {Record<import('./a11y-classifier.js').A11ySubCategory, { guided: { passed: number, total: number }, unguided: { passed: number, total: number } }>} */
    const subCatTallies = /** @type {any} */ ({});
    A11Y_SUBCATEGORIES.forEach(sc => {
        subCatTallies[sc.id] = {
            guided: { passed: 0, total: 0 },
            unguided: { passed: 0, total: 0 }
        };
    });
    /** @type {number[]} */
    const guidedRuntimes = [];
    /** @type {number[]} */
    const unguidedRuntimes = [];
    let guidedTimeouts = 0;
    let unguidedTimeouts = 0;
    /** @type {number[]} */
    const guidedUncachedTokens = [];
    /** @type {number[]} */
    const unguidedUncachedTokens = [];
    /** @type {number[]} */
    const guidedTotalTokens = [];
    /** @type {number[]} */
    const unguidedTotalTokens = [];
    let guidedTotalTokenSum = 0;
    let guidedCachedTokenSum = 0;
    let unguidedTotalTokenSum = 0;
    let unguidedCachedTokenSum = 0;
    /** @type {Record<string, { guidedMs: number[], unguidedMs: number[], guidedUncached: number[], unguidedUncached: number[] }>} */
    const pairedTaskEfficiency = {};
    const distinctScenarios = new Set();
    /** @type {Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>} */
    const suiteGuides = {};
    /** @type {Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>} */
    const suiteGuideA11y = {};
    /** @type {Record<string, Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>>} */
    const suiteGuideTaskA11y = {};
    /**
     * Per-task totals, so multi-target guides stay distinguishable after summing to guide level.
     * @type {Record<string, Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>>}
     */
    const suiteGuideTasks = {};
    /** First run of each mode for featured Spotlight guides, locked to the first task seen per guide.
     * @type {Record<string, { task: string, guided?: import('../harness/lib/metrics.ts').RunResult, unguided?: import('../harness/lib/metrics.ts').RunResult }>} */
    const showcaseRuns = {};

    scenarioKeys.forEach(key => {
        const parsedKey = parseResultKey(key);
        const runs = results[key] || [];
        totalAllRuns += runs.length;
        if (runs.length > maxRuns) maxRuns = runs.length;

        const isGuided = key.endsWith(' - guided');
        const isUnguided = key.endsWith(' - unguided');

        if (parsedKey) {
            distinctScenarios.add(parsedKey.task);
            const { guide, task } = parsedKey;
            if (!suiteGuides[guide]) {
                suiteGuides[guide] = {
                    guided: { passed: 0, total: 0 },
                    unguided: { passed: 0, total: 0 }
                };
            }
            if (!suiteGuideTasks[guide]) suiteGuideTasks[guide] = {};
            if (task && !suiteGuideTasks[guide][task]) {
                suiteGuideTasks[guide][task] = {
                    guided: { passed: 0, total: 0 },
                    unguided: { passed: 0, total: 0 }
                };
            }
            const pairKey = `${task}|||${guide}`;
            if (!pairedTaskEfficiency[pairKey]) {
                pairedTaskEfficiency[pairKey] = {
                    guidedMs: [],
                    unguidedMs: [],
                    guidedUncached: [],
                    unguidedUncached: []
                };
            }
        }

        const isEligibleScenario = parsedKey ? eligibleScenarios.has(`${parsedKey.task} - ${parsedKey.guide}`) : true;

        if (isGuided) guidedTotalRuns += runs.length;
        else if (isUnguided) unguidedTotalRuns += runs.length;

        if (parsedKey && SHOWCASE_GUIDE_IDS.has(parsedKey.guide) && (parsedKey.runType === 'guided' || parsedKey.runType === 'unguided') && runs.length) {
            const firstRun = runs.reduce((a, b) => ((b.runNumber ?? 0) < (a.runNumber ?? 0) ? b : a));
            const entry = (showcaseRuns[parsedKey.guide] ||= { task: parsedKey.task });
            if (entry.task === parsedKey.task) entry[parsedKey.runType] = firstRun;
        }
        runs.forEach((/** @type {import('../harness/lib/metrics.ts').RunResult & { discipline?: string }} */ run) => {
            if (isEarlyFailureRun(run.results)) {
                if (isGuided) guidedEarlyFailures++;
                else if (isUnguided) unguidedEarlyFailures++;
            }
            if (isUnguided && isUnguidedLeakRun(run, parsedKey?.guide)) {
                unguidedLeaks++;
            }

            if (isEligibleScenario) {
                const s = getRunStats(run.results);
                if (isGuided) { guidedPassed += s.passed; guidedTotal += s.total; } else if (isUnguided) { unguidedPassed += s.passed; unguidedTotal += s.total; }
                if (parsedKey && (parsedKey.runType === 'guided' || parsedKey.runType === 'unguided')) {
                    const runType = /** @type {'guided' | 'unguided'} */ (parsedKey.runType);
                    const { guide, task } = parsedKey;
                    suiteGuides[guide][runType].passed += s.passed;
                    suiteGuides[guide][runType].total += s.total;

                    const taskStats = task && suiteGuideTasks[guide][task];
                    if (taskStats) { taskStats[runType].passed += s.passed; taskStats[runType].total += s.total; }
                    // Skip early-failure runs (zeroed by getRunStats) so a11y totals stay in sync with overall totals.
                    if (s.total > 0) (run.results || []).forEach(check => {
                        const cls = classifyScenarioCheck(check, guide, run.discipline);
                        if (cls.isAccessibility && cls.subCategory) {
                            a11yGuides.add(guide);
                            if (!suiteGuideA11y[guide]) {
                                suiteGuideA11y[guide] = {
                                    guided: { passed: 0, total: 0 },
                                    unguided: { passed: 0, total: 0 }
                                };
                            }
                            suiteGuideA11y[guide][runType].total += 1;
                            if (check.passed) suiteGuideA11y[guide][runType].passed += 1;
                            if (task) {
                                if (!suiteGuideTaskA11y[guide]) suiteGuideTaskA11y[guide] = {};
                                if (!suiteGuideTaskA11y[guide][task]) {
                                    suiteGuideTaskA11y[guide][task] = {
                                        guided: { passed: 0, total: 0 },
                                        unguided: { passed: 0, total: 0 }
                                    };
                                }
                                suiteGuideTaskA11y[guide][task][runType].total += 1;
                                if (check.passed) suiteGuideTaskA11y[guide][task][runType].passed += 1;
                            }
                            if (runType === 'guided') { a11yGuidedTotal += 1; if (check.passed) a11yGuidedPassed += 1; } else { a11yUnguidedTotal += 1; if (check.passed) a11yUnguidedPassed += 1; }
                            const bucket = subCatTallies[cls.subCategory];
                            if (bucket) { bucket[runType].total += 1; if (check.passed) bucket[runType].passed += 1; }
                        }
                    });
                }
            }

            if (parsedKey && (parsedKey.runType === 'guided' || parsedKey.runType === 'unguided')) {
                const runType = /** @type {'guided' | 'unguided'} */ (parsedKey.runType);
                const { guide, task } = parsedKey;
                const runtimeMs = getAgentRuntimeMs(run);
                const earlyFailed = isEarlyFailureRun(run.results);
                const timedOut = runtimeMs >= TIMEOUT_MS ||
                    (earlyFailed && (run.results || []).some(c => /timeout/i.test(c.message || '')));
                if (timedOut) { if (runType === 'guided') guidedTimeouts += 1; else unguidedTimeouts += 1; }
                if (isEligibleScenario && !earlyFailed) {
                    const pairKey = `${task}|||${guide}`;
                    const pairBucket = pairedTaskEfficiency[pairKey];
                    if (runtimeMs > 0) {
                        if (runType === 'guided') { guidedRuntimes.push(runtimeMs); if (pairBucket) pairBucket.guidedMs.push(runtimeMs); } else { unguidedRuntimes.push(runtimeMs); if (pairBucket) pairBucket.unguidedMs.push(runtimeMs); }
                    }

                    const tb = getTokenBreakdown(run.tokenUsage);
                    if (tb.total > 0) {
                        if (runType === 'guided') {
                            guidedUncachedTokens.push(tb.uncached);
                            guidedTotalTokens.push(tb.total);
                            guidedTotalTokenSum += tb.total;
                            guidedCachedTokenSum += tb.cached;
                            if (pairBucket) pairBucket.guidedUncached.push(tb.uncached);
                        } else {
                            unguidedUncachedTokens.push(tb.uncached);
                            unguidedTotalTokens.push(tb.total);
                            unguidedTotalTokenSum += tb.total;
                            unguidedCachedTokenSum += tb.cached;
                            if (pairBucket) pairBucket.unguidedUncached.push(tb.uncached);
                        }
                    }
                }
            }
        });
    });

    /**
     * @param {{ guided: {passed: number, total: number}, unguided: {passed: number, total: number} }} t
     * @returns {GuideSummary}
     */
    const formatStats = (t) => {
        const gExact = t.guided.total > 0 ? (t.guided.passed / t.guided.total) * 100 : 0;
        const uExact = t.unguided.total > 0 ? (t.unguided.passed / t.unguided.total) * 100 : 0;
        const guidedRate = Math.round(gExact);
        const unguidedRate = Math.round(uExact);
        return {
            guidedPassed: t.guided.passed,
            guidedTotal: t.guided.total,
            guidedRate,
            unguidedPassed: t.unguided.passed,
            unguidedTotal: t.unguided.total,
            unguidedRate,
            // A side with no checks has no rate, so there is nothing to compare against.
            uplift: (t.guided.total > 0 && t.unguided.total > 0) ? Math.round(gExact - uExact) : null
        };
    };

    /** @type {Record<string, GuideSummary>} */
    const guidesFormatted = {};
    Object.keys(suiteGuides).forEach(guide => {
        const stats = formatStats(suiteGuides[guide]);
        const a11y = suiteGuideA11y[guide] ? formatStats(suiteGuideA11y[guide]) : undefined;
        const base = a11y ? { ...stats, a11y } : stats;
        const taskNames = Object.keys(suiteGuideTasks[guide] || {});

        // A guide with one task is fully described by its roll-up, so store just the name.
        if (taskNames.length === 1) {
            guidesFormatted[guide] = { ...base, taskName: taskNames[0] };
            return;
        }
        if (taskNames.length === 0) {
            guidesFormatted[guide] = base;
            return;
        }

        /** @type {Record<string, GuideSummary>} */
        const tasks = {};
        taskNames.forEach(task => {
            const taskStats = formatStats(suiteGuideTasks[guide][task]);
            const taskA11y = suiteGuideTaskA11y[guide]?.[task];
            tasks[task] = (taskA11y && (taskA11y.guided.total > 0 || taskA11y.unguided.total > 0))
                ? { ...taskStats, a11y: formatStats(taskA11y) }
                : taskStats;
        });
        guidesFormatted[guide] = { ...base, tasks };
    });
    /** @type {Record<import('./a11y-classifier.js').A11ySubCategory, SubCategoryA11yStats>} */
    const bySubCategory = /** @type {any} */ ({});
    A11Y_SUBCATEGORIES.forEach(sc => {
        bySubCategory[sc.id] = formatStats(subCatTallies[sc.id]);
    });

    const a11yStats = {
        ...formatStats({
            guided: { passed: a11yGuidedPassed, total: a11yGuidedTotal },
            unguided: { passed: a11yUnguidedPassed, total: a11yUnguidedTotal }
        }),
        guideCount: a11yGuides.size,
        bySubCategory
    };
    const guidedMedianMs = Math.round(median(guidedRuntimes));
    const unguidedMedianMs = Math.round(median(unguidedRuntimes));
    const guidedMeanMs = guidedRuntimes.length > 0 ? Math.round(guidedRuntimes.reduce((a, b) => a + b, 0) / guidedRuntimes.length) : 0;
    const unguidedMeanMs = unguidedRuntimes.length > 0 ? Math.round(unguidedRuntimes.reduce((a, b) => a + b, 0) / unguidedRuntimes.length) : 0;
    const medianDeltaPct = unguidedMedianMs > 0 ? Math.round(((guidedMedianMs - unguidedMedianMs) / unguidedMedianMs) * 100) : 0;
    let pairedRuntimeCount = 0;
    let fasterGuidedCount = 0;
    let pairedTokensCount = 0;
    let fewerUncachedCount = 0;
    Object.values(pairedTaskEfficiency).forEach(pair => {
        if (pair.guidedMs.length > 0 && pair.unguidedMs.length > 0) {
            pairedRuntimeCount += 1;
            const gAvg = pair.guidedMs.reduce((a, b) => a + b, 0) / pair.guidedMs.length;
            const uAvg = pair.unguidedMs.reduce((a, b) => a + b, 0) / pair.unguidedMs.length;
            if (gAvg <= uAvg) fasterGuidedCount += 1;
        }
        if (pair.guidedUncached.length > 0 && pair.unguidedUncached.length > 0) {
            pairedTokensCount += 1;
            const gAvg = pair.guidedUncached.reduce((a, b) => a + b, 0) / pair.guidedUncached.length;
            const uAvg = pair.unguidedUncached.reduce((a, b) => a + b, 0) / pair.unguidedUncached.length;
            if (gAvg <= uAvg) fewerUncachedCount += 1;
        }
    });
    const guidedUncachedMedian = Math.round(median(guidedUncachedTokens));
    const unguidedUncachedMedian = Math.round(median(unguidedUncachedTokens));
    const uncachedMedianDelta = guidedUncachedMedian - unguidedUncachedMedian;
    const uncachedMedianDeltaPct = unguidedUncachedMedian > 0 ? Math.round(((guidedUncachedMedian - unguidedUncachedMedian) / unguidedUncachedMedian) * 100) : 0;
    const guidedTotalMedian = Math.round(median(guidedTotalTokens));
    const unguidedTotalMedian = Math.round(median(unguidedTotalTokens));
    const guidedUncachedTotal = Math.max(0, guidedTotalTokenSum - guidedCachedTokenSum);
    const unguidedUncachedTotal = Math.max(0, unguidedTotalTokenSum - unguidedCachedTokenSum);
    const suiteUncachedDeltaPct = unguidedUncachedTotal > 0 ? Math.round(((guidedUncachedTotal - unguidedUncachedTotal) / unguidedUncachedTotal) * 100) : 0;
    const efficiencyStats = {
        runtime: {
            guidedMedianMs,
            unguidedMedianMs,
            guidedMeanMs,
            unguidedMeanMs,
            medianDeltaPct,
            fasterTaskPct: pairedRuntimeCount > 0 ? Math.round((fasterGuidedCount / pairedRuntimeCount) * 100) : 0,
            fasterTasksCount: fasterGuidedCount,
            pairedTaskCount: pairedRuntimeCount,
            guidedTimeouts,
            unguidedTimeouts
        },
        tokens: {
            guidedUncachedMedian,
            unguidedUncachedMedian,
            uncachedMedianDelta,
            uncachedMedianDeltaPct,
            guidedTotalMedian,
            unguidedTotalMedian,
            guidedUncachedTotal,
            unguidedUncachedTotal,
            suiteUncachedDeltaPct,
            guidedTotal: guidedTotalTokenSum,
            unguidedTotal: unguidedTotalTokenSum,
            guidedCachedSharePct: guidedTotalTokenSum > 0 ? Math.round((guidedCachedTokenSum / guidedTotalTokenSum) * 100) : 0,
            fewerUncachedTokensTaskPct: pairedTokensCount > 0 ? Math.round((fewerUncachedCount / pairedTokensCount) * 100) : 0,
            fewerUncachedTasksCount: fewerUncachedCount,
            pairedTaskCount: pairedTokensCount
        }
    };
    const taskCount = evalsData.summary && evalsData.summary.taskCount ? evalsData.summary.taskCount : distinctScenarios.size;
    const gFailures = evalsData.summary?.guidedEarlyFailures ?? guidedEarlyFailures;
    const uFailures = evalsData.summary?.unguidedEarlyFailures ?? unguidedEarlyFailures;
    const summaryEarlyFailures = gFailures + uFailures;
    const earlyFailureRate = totalAllRuns > 0 ? Math.round((summaryEarlyFailures / totalAllRuns) * 100) : 0;
    const guidedErrorRate = guidedTotalRuns > 0 ? Math.round((gFailures / guidedTotalRuns) * 100) : 0;
    const unguidedErrorRate = unguidedTotalRuns > 0 ? Math.round((uFailures / unguidedTotalRuns) * 100) : 0;
    const unguidedLeakRate = unguidedTotalRuns > 0 ? Math.round((unguidedLeaks / unguidedTotalRuns) * 100) : 0;

    const chartData = calculateChartData(results, eligibleScenarios);
    const showcase = buildShowcaseSlices(showcaseRuns);

    return {
        testId: testId,
        timestamp: evalsData.timestamp || forcedTimestamp || new Date().toISOString(),
        agent: evalsData.agent || 'unknown',
        serving: serving,
        model: evalsData.model || 'unknown',
        taskCount: taskCount,
        maxRuns: maxRuns,
        guidedStats: { passed: guidedPassed, total: guidedTotal },
        unguidedStats: { passed: unguidedPassed, total: unguidedTotal },
        a11yStats,
        efficiencyStats,
        earlyFailureRate: earlyFailureRate,
        guidedErrorRate: guidedErrorRate,
        unguidedErrorRate: unguidedErrorRate,
        ...(unguidedLeakRate > 0 ? { unguidedLeakRate } : {}),
        guides: guidesFormatted,
        showcase,
        chartData: chartData
    };
}

/**
 * @param {Record<string, { guided?: import('../harness/lib/metrics.ts').RunResult, unguided?: import('../harness/lib/metrics.ts').RunResult }>} runsByGuide
 * @returns {Record<string, ShowcaseSlice>}
 */
function buildShowcaseSlices(runsByGuide) {
    /** @type {Record<string, ShowcaseSlice>} */
    const slices = {};
    for (const [guide, { guided, unguided }] of Object.entries(runsByGuide)) {
        if (!guided || !unguided) continue;
        /** @param {import('../harness/lib/metrics.ts').RunResult & { discipline?: string }} run */
        const classify = (run) => (run.results || [])
            .filter(c => !c.isEarlyFailure)
            .map(c => ({ check: c, cls: classifyScenarioCheck(c, guide, run.discipline) }));
        /** @param {import('../harness/lib/metrics.ts').RunResult & { guidesUsed?: string[] }} run @returns {ShowcaseModeRun} */
        const toModeRun = (run) => {
            const stats = getRunStats(run.results);
            const a11y = classify(run).filter(x => x.cls.isAccessibility);
            const tb = getTokenBreakdown(run.tokenUsage);
            return {
                passed: stats.passed,
                total: stats.total,
                a11yPassed: a11y.filter(x => x.check.passed).length,
                a11yTotal: a11y.length,
                runtimeMs: getAgentRuntimeMs(run),
                uncachedTokens: tb.uncached,
                totalTokens: tb.total,
                guidesUsed: Array.isArray(run.guidesUsed) ? run.guidesUsed : [],
                earlyFailure: isEarlyFailureRun(run.results)
            };
        };
        // Align checks across modes by id (falling back to message); order follows whichever run was graded.
        const gChecks = classify(guided);
        const uChecks = classify(unguided);
        const keyOf = (/** @type {{ id?: string, message?: string }} */ c) => c.id || c.message || '';
        const uPassedByKey = new Map(uChecks.map(x => [keyOf(x.check), Boolean(x.check.passed)]));
        const gPassedByKey = new Map(gChecks.map(x => [keyOf(x.check), Boolean(x.check.passed)]));
        const ordered = gChecks.length ? gChecks : uChecks;
        const subLabels = new Map(A11Y_SUBCATEGORIES.map(sc => [sc.id, sc.shortLabel]));
        /** @type {ShowcaseCheck[]} */
        const checks = ordered.map(({ check, cls }) => ({
            message: check.message || '',
            unguidedPassed: uPassedByKey.get(keyOf(check)) ?? false,
            guidedPassed: gPassedByKey.get(keyOf(check)) ?? false,
            isA11y: cls.isAccessibility,
            a11yLabel: cls.subCategory ? (subLabels.get(cls.subCategory) ?? null) : null
        }));
        const meta = /** @type {{ prompt?: string, discipline?: string }} */ (guided);
        slices[guide] = {
            prompt: meta.prompt || /** @type {{ prompt?: string }} */ (unguided).prompt || '',
            discipline: meta.discipline || '',
            unguided: toModeRun(unguided),
            guided: toModeRun(guided),
            checks
        };
    }
    return slices;
}
