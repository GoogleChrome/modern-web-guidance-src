import { getRunStats, parseResultKey, calculateChartData, median, getTokenBreakdown, getRunDurationMs } from './utils.js';
import { A11Y_SUBCATEGORIES, classifyScenarioCheck } from './a11y-classifier.js';

/**
 * @typedef {Object} GuideSummary
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number} uplift
 * @property {SubCategoryA11yStats} [a11y] Cross-cutting accessibility check breakdown for this guide.
 * @property {Record<string, GuideSummary>} [tasks] Per-task breakdown; only when the guide has more than one task.
 * @property {string} [taskName] The sole task's name, when the guide has exactly one.
 */

/**
 * @typedef {Object} SubCategoryA11yStats
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number} uplift
 */

/**
 * @typedef {Object} SuiteA11yStats
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number} uplift
 * @property {number} guideCount
 * @property {Record<import('./a11y-classifier.js').A11ySubCategory, SubCategoryA11yStats>} bySubCategory
 */

/**
 * @typedef {Object} SuiteEfficiencyStats
 * @property {{
 *   guidedMedianMs: number,
 *   unguidedMedianMs: number,
 *   guidedMeanMs: number,
 *   unguidedMeanMs: number,
 *   medianDeltaMs: number,
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
 *   totalMedianDelta: number,
 *   totalMedianDeltaPct: number,
 *   guidedUncachedTotal: number,
 *   unguidedUncachedTotal: number,
 *   suiteUncachedDeltaPct: number,
 *   guidedTotal: number,
 *   unguidedTotal: number,
 *   guidedCachedSharePct: number,
 *   unguidedCachedSharePct: number,
 *   fewerUncachedTokensTaskPct: number,
 *   fewerUncachedTasksCount: number
 * }} tokens
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
 * @property {Record<string, GuideSummary>} guides
 * @property {ReturnType<typeof calculateChartData>} chartData
 */

/**
 * Extracts a compact summary object from an evals.json payload.
 *
 * @param {string} testId
 * @param {import('../harness/lib/metrics.ts').EvalsReport & { enableSkills?: boolean }} evalsData
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

    let guidedPassed = 0;
    let guidedTotal = 0;
    let unguidedPassed = 0;
    let unguidedTotal = 0;
    let maxRuns = 1;

    // Cross-cutting accessibility counters
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

    // Efficiency tracking
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
    /**
     * Per-task totals, so multi-target guides stay distinguishable after summing to guide level.
     * @type {Record<string, Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>>}
     */
    const suiteGuideTasks = {};

    scenarioKeys.forEach(key => {
        const parsedKey = parseResultKey(key);
        const runs = results[key] || [];
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

        runs.forEach(run => {
            const s = getRunStats(run.results);
            if (isGuided) {
                guidedPassed += s.passed;
                guidedTotal += s.total;
            } else if (isUnguided) {
                unguidedPassed += s.passed;
                unguidedTotal += s.total;
            }

            if (parsedKey && (parsedKey.runType === 'guided' || parsedKey.runType === 'unguided')) {
                const runType = /** @type {'guided' | 'unguided'} */ (parsedKey.runType);
                const { guide, task } = parsedKey;
                suiteGuides[guide][runType].passed += s.passed;
                suiteGuides[guide][runType].total += s.total;

                const taskStats = task && suiteGuideTasks[guide][task];
                if (taskStats) {
                    taskStats[runType].passed += s.passed;
                    taskStats[runType].total += s.total;
                }

                // Accessibility check classification
                (run.results || []).forEach(check => {
                    const cls = classifyScenarioCheck(check, guide);
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

                        if (runType === 'guided') {
                            a11yGuidedTotal += 1;
                            if (check.passed) a11yGuidedPassed += 1;
                        } else {
                            a11yUnguidedTotal += 1;
                            if (check.passed) a11yUnguidedPassed += 1;
                        }
                        const bucket = subCatTallies[cls.subCategory];
                        if (bucket) {
                            bucket[runType].total += 1;
                            if (check.passed) bucket[runType].passed += 1;
                        }
                    }
                });

                // Runtime & token tracking
                const pairKey = `${task}|||${guide}`;
                const pairBucket = pairedTaskEfficiency[pairKey];
                const runtimeMs = getRunDurationMs(run);
                if (runtimeMs > 0) {
                    if (runType === 'guided') {
                        guidedRuntimes.push(runtimeMs);
                        if (runtimeMs >= 300000) guidedTimeouts += 1;
                        if (pairBucket) pairBucket.guidedMs.push(runtimeMs);
                    } else {
                        unguidedRuntimes.push(runtimeMs);
                        if (runtimeMs >= 300000) unguidedTimeouts += 1;
                        if (pairBucket) pairBucket.unguidedMs.push(runtimeMs);
                    }
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
        });
    });

    /**
     * @param {{ guided: {passed: number, total: number}, unguided: {passed: number, total: number} }} stats
     * @returns {GuideSummary}
     */
    const formatStats = (stats) => {
        const guidedRate = stats.guided.total > 0 ? Math.round((stats.guided.passed / stats.guided.total) * 100) : 0;
        const unguidedRate = stats.unguided.total > 0 ? Math.round((stats.unguided.passed / stats.unguided.total) * 100) : 0;
        return {
            guidedPassed: stats.guided.passed,
            guidedTotal: stats.guided.total,
            guidedRate,
            unguidedPassed: stats.unguided.passed,
            unguidedTotal: stats.unguided.total,
            unguidedRate,
            uplift: guidedRate - unguidedRate
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
        taskNames.forEach(task => { tasks[task] = formatStats(suiteGuideTasks[guide][task]); });
        guidesFormatted[guide] = { ...base, tasks };
    });

    // Build a11yStats
    const a11yGuidedRate = a11yGuidedTotal > 0 ? Math.round((a11yGuidedPassed / a11yGuidedTotal) * 100) : 0;
    const a11yUnguidedRate = a11yUnguidedTotal > 0 ? Math.round((a11yUnguidedPassed / a11yUnguidedTotal) * 100) : 0;
    /** @type {Record<import('./a11y-classifier.js').A11ySubCategory, SubCategoryA11yStats>} */
    const bySubCategory = /** @type {any} */ ({});
    A11Y_SUBCATEGORIES.forEach(sc => {
        bySubCategory[sc.id] = formatStats(subCatTallies[sc.id]);
    });

    const a11yStats = {
        guidedPassed: a11yGuidedPassed,
        guidedTotal: a11yGuidedTotal,
        guidedRate: a11yGuidedRate,
        unguidedPassed: a11yUnguidedPassed,
        unguidedTotal: a11yUnguidedTotal,
        unguidedRate: a11yUnguidedRate,
        uplift: a11yGuidedRate - a11yUnguidedRate,
        guideCount: a11yGuides.size,
        bySubCategory
    };

    // Build efficiencyStats
    const guidedMedianMs = Math.round(median(guidedRuntimes));
    const unguidedMedianMs = Math.round(median(unguidedRuntimes));
    const guidedMeanMs = guidedRuntimes.length > 0 ? Math.round(guidedRuntimes.reduce((a, b) => a + b, 0) / guidedRuntimes.length) : 0;
    const unguidedMeanMs = unguidedRuntimes.length > 0 ? Math.round(unguidedRuntimes.reduce((a, b) => a + b, 0) / unguidedRuntimes.length) : 0;
    const medianDeltaMs = guidedMedianMs - unguidedMedianMs;
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
    const totalMedianDelta = guidedTotalMedian - unguidedTotalMedian;
    const totalMedianDeltaPct = unguidedTotalMedian > 0 ? Math.round(((guidedTotalMedian - unguidedTotalMedian) / unguidedTotalMedian) * 100) : 0;

    const guidedUncachedTotal = Math.max(0, guidedTotalTokenSum - guidedCachedTokenSum);
    const unguidedUncachedTotal = Math.max(0, unguidedTotalTokenSum - unguidedCachedTokenSum);
    const suiteUncachedDeltaPct = unguidedUncachedTotal > 0 ? Math.round(((guidedUncachedTotal - unguidedUncachedTotal) / unguidedUncachedTotal) * 100) : 0;

    const efficiencyStats = {
        runtime: {
            guidedMedianMs,
            unguidedMedianMs,
            guidedMeanMs,
            unguidedMeanMs,
            medianDeltaMs,
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
            totalMedianDelta,
            totalMedianDeltaPct,
            guidedUncachedTotal,
            unguidedUncachedTotal,
            suiteUncachedDeltaPct,
            guidedTotal: guidedTotalTokenSum,
            unguidedTotal: unguidedTotalTokenSum,
            guidedCachedSharePct: guidedTotalTokenSum > 0 ? Math.round((guidedCachedTokenSum / guidedTotalTokenSum) * 100) : 0,
            unguidedCachedSharePct: unguidedTotalTokenSum > 0 ? Math.round((unguidedCachedTokenSum / unguidedTotalTokenSum) * 100) : 0,
            fewerUncachedTokensTaskPct: pairedTokensCount > 0 ? Math.round((fewerUncachedCount / pairedTokensCount) * 100) : 0,
            fewerUncachedTasksCount: fewerUncachedCount
        }
    };

    const taskCount = evalsData.summary && evalsData.summary.taskCount ? evalsData.summary.taskCount : distinctScenarios.size;
    const totalEarlyFailures = (evalsData.summary?.unguidedEarlyFailures || 0) + (evalsData.summary?.guidedEarlyFailures || 0);
    let totalAllRuns = 0;
    scenarioKeys.forEach(k => { totalAllRuns += (results[k] || []).length; });
    const earlyFailureRate = totalAllRuns > 0 ? Math.round((totalEarlyFailures / totalAllRuns) * 100) : 0;

    const chartData = calculateChartData(results);

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
        guides: guidesFormatted,
        chartData: chartData
    };
}
