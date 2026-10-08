import { getRunStats, parseResultKey, calculateChartData } from './utils.js';

/**
 * @typedef {Object} GuideSummary
 * @property {number} guidedPassed
 * @property {number} guidedTotal
 * @property {number} guidedRate
 * @property {number} unguidedPassed
 * @property {number} unguidedTotal
 * @property {number} unguidedRate
 * @property {number} uplift
 * @property {Record<string, GuideSummary>} [tasks] Per-task breakdown; only when the guide has more than one task.
 * @property {string} [taskName] The sole task's name, when the guide has exactly one.
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

    const distinctScenarios = new Set();
    /** @type {Record<string, { guided: {passed: number, total: number}, unguided: {passed: number, total: number} }>} */
    const suiteGuides = {};
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
                suiteGuides[parsedKey.guide][runType].passed += s.passed;
                suiteGuides[parsedKey.guide][runType].total += s.total;

                const taskStats = parsedKey.task && suiteGuideTasks[parsedKey.guide][parsedKey.task];
                if (taskStats) {
                    taskStats[runType].passed += s.passed;
                    taskStats[runType].total += s.total;
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
        const taskNames = Object.keys(suiteGuideTasks[guide] || {});

        // A guide with one task is fully described by its roll-up, so store just the name.
        if (taskNames.length === 1) {
            guidesFormatted[guide] = { ...stats, taskName: taskNames[0] };
            return;
        }
        if (taskNames.length === 0) {
            guidesFormatted[guide] = stats;
            return;
        }

        /** @type {Record<string, GuideSummary>} */
        const tasks = {};
        taskNames.forEach(task => { tasks[task] = formatStats(suiteGuideTasks[guide][task]); });
        guidesFormatted[guide] = { ...stats, tasks };
    });

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
        earlyFailureRate: earlyFailureRate,
        guides: guidesFormatted,
        chartData: chartData
    };
}
