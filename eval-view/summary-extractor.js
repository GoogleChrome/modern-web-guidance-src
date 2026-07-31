// @ts-nocheck
import { getRunStats, parseResultKey, calculateChartData } from './utils.js';

/**
 * Extracts a compact summary object from an evals.json payload.
 *
 * @param {string} testId
 * @param {any} evalsData
 * @param {string|null} [forcedTimestamp=null]
 * @returns {Record<string, any>|null}
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
    const suiteGuides = {};

    scenarioKeys.forEach(key => {
        const parsedKey = parseResultKey(key);
        const runs = results[key] || [];
        if (runs.length > maxRuns) maxRuns = runs.length;

        const isGuided = key.endsWith(' - guided');
        const isUnguided = key.endsWith(' - unguided');

        if (parsedKey) {
            distinctScenarios.add(parsedKey.task);
            const { guide } = parsedKey;
            if (!suiteGuides[guide]) {
                suiteGuides[guide] = {
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
                suiteGuides[parsedKey.guide][parsedKey.runType].passed += s.passed;
                suiteGuides[parsedKey.guide][parsedKey.runType].total += s.total;
            }
        });
    });

    const guidesFormatted = {};
    Object.keys(suiteGuides).forEach(guide => {
        const g = suiteGuides[guide];
        const guidedRate = g.guided.total > 0 ? Math.round((g.guided.passed / g.guided.total) * 100) : 0;
        const unguidedRate = g.unguided.total > 0 ? Math.round((g.unguided.passed / g.unguided.total) * 100) : 0;
        guidesFormatted[guide] = {
            guidedPassed: g.guided.passed,
            guidedTotal: g.guided.total,
            guidedRate,
            unguidedPassed: g.unguided.passed,
            unguidedTotal: g.unguided.total,
            unguidedRate,
            uplift: guidedRate - unguidedRate,
            guided: g.guided,
            unguided: g.unguided
        };
    });

    const taskCount = evalsData.summary && evalsData.summary.taskCount ? evalsData.summary.taskCount : distinctScenarios.size;
    const earlyFailureRate = evalsData.summary?.unguidedEarlyFailureRate || 0;

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
