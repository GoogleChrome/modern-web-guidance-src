import { ApiClient } from './api.js';
import { getRunStats, getColor } from './utils.js';

const api = new ApiClient();

export async function loadStabilityTrend(scenarioName, currentTestId) {
    const containerId = `stability-trend-${scenarioName.replace(/\s+/g, '-')}`;
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `<div class="stability-loading">Loading historical data...</div>`;

    try {
        const response = await fetch('/api/suites');
        if (!response.ok) throw new Error('Could not fetch suite manifest');
        const manifest = await response.json();

        const currentSuite = manifest.suites.find(s => s.id === currentTestId);
        const criteria = currentSuite ? { agent: currentSuite.agent, model: currentSuite.model, serving: currentSuite.serving } : null;

        let currentAssertions = [];
        let currentPromptText = '';
        try {
            const currentRes = await fetch(`${currentTestId}/evals.json`);
            if (currentRes.ok) {
                const currentData = await currentRes.json();
                const guidedKey = `${scenarioName} - guided`;
                const unguidedKey = `${scenarioName} - unguided`;
                const currentRunResults = currentData.results[guidedKey] || currentData.results[unguidedKey];
                if (currentRunResults && currentRunResults[0]) {
                    currentAssertions = currentRunResults[0].results.map(r => r.message).sort();
                }
            }
            
            const runScriptText = await api.getFileText(`${currentTestId}/run.mjs`);
            const match = runScriptText.match(/\.\.\.\[([\s\S]+?)\]/);
            if (match) {
                const arrayStr = `[${match[1]}]`;
                const arr = JSON.parse(arrayStr);
                currentPromptText = arr[1];
            }
        } catch (e) {}

        let history = [];
        for (const suite of manifest.suites) {
            if (criteria) {
                if (suite.agent !== criteria.agent || suite.model !== criteria.model || suite.serving !== criteria.serving) continue;
            }

            const res = await fetch(`${suite.id}/evals.json`);
            if (res.ok) {
                const data = await res.json();
                if (!data || !data.results) {
                    console.warn(`[StabilityTrend] Suite ${suite.id} has no results.`);
                    continue;
                }
                const guidedKey = `${scenarioName} - guided`;
                const unguidedKey = `${scenarioName} - unguided`;
                
                const guidedRun = data.results[guidedKey];
                const unguidedRun = data.results[unguidedKey];

                let guidedTrials = [];
                let unguidedTrials = [];

                if (guidedRun) {
                    for (const run of guidedRun) {
                        const historyAssertions = run.results.map(r => r.message).sort();
                        if (currentAssertions.length > 0 && currentAssertions.join('|') !== historyAssertions.join('|')) {
                             console.log(`[StabilityTrend] Skipping runs in suite ${suite.id} - Grader checks differ.`);
                             continue; // Skip if checks differ!
                        }
                        guidedTrials.push(getRunStats(run.results).rate);
                    }
                }

                if (unguidedRun) {
                    for (const run of unguidedRun) {
                        unguidedTrials.push(getRunStats(run.results).rate);
                    }
                }

                // Verify prompt text matches exactly across this suite!
                let historyPromptText = '';
                try {
                    const candidateRun = guidedRun[0] || unguidedRun[0];
                    const typeLabel = guidedRun[0] ? 'guided' : 'unguided';
                    const { usedBasePath } = await api.getResultInfo(suite.id, candidateRun, `${scenarioName} - ${typeLabel}`);
                    const runText = await api.getFileText(`${usedBasePath}/run.mjs`);
                    const match = runText.match(/\.\.\.\[([\s\S]+?)\]/);
                    if (match) {
                        const arrayStr = `[${match[1]}]`;
                        const arr = JSON.parse(arrayStr);
                        historyPromptText = arr[1];
                    }
                } catch (e) {}

                if (currentPromptText && historyPromptText && currentPromptText !== historyPromptText) {
                    console.log(`[StabilityTrend] Skipping suite ${suite.id} - Prompt text differs.`);
                    continue; 
                }

                if (guidedTrials.length > 0 || unguidedTrials.length > 0) {
                    console.log(`[StabilityTrend] Matched suite ${suite.id} - Prompt and Assertions identical! (Guided Trials: ${guidedTrials.length}, Unguided Trials: ${unguidedTrials.length})`);
                    
                    const gAvg = guidedTrials.length > 0 ? guidedTrials.reduce((a,b)=>a+b,0) / guidedTrials.length : null;
                    const uAvg = unguidedTrials.length > 0 ? unguidedTrials.reduce((a,b)=>a+b,0) / unguidedTrials.length : null;

                    history.push({
                        testId: suite.id,
                        timestamp: suite.timestamp,
                        guidedAvg: gAvg,
                        unguidedAvg: uAvg,
                        guidedTrials,
                        unguidedTrials,
                        isCurrent: suite.id === currentTestId
                    });
                }
            }
        }

        if (history.length === 0) {
            container.innerHTML = `<div class="stability-no-matches">No historical matches found for this task under identical parameters.</div>`;
            return;
        }

        history.sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        function formatShortTime(timestamp) {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            
            if (diffMs < 0) {
                const diffDays = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
                if (diffDays < 1) return 'today';
                return `+${diffDays}d`;
            }

            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (diffDays < 1) return 'today';
            return `${diffDays}d`;
        }

        const width = Math.min(800, Math.max(500, history.length * 50));
        const subHeight = 110; 
        const separation = 30;
        const totalHeight = subHeight * 2 + separation;
        const paddingX = 40;
        const paddingY = 20; // Internal graph padding inside subHeight
        const graphHeight = subHeight - 2 * paddingY;
        const graphWidth = width - 2 * paddingX;
        const stepX = history.length > 1 ? graphWidth / (history.length - 1) : 0;

        // Top graph (Unguided) - offset 0
        const uPoints = history.map((h, i) => h.unguidedAvg !== null ? `${paddingX + i * stepX},${paddingY + graphHeight - (h.unguidedAvg / 100 * graphHeight)}` : '').filter(Boolean).join(' ');

        // Bottom graph (Guided) - offset subHeight + separation
        const gOffset = subHeight + separation;
        const gPoints = history.map((h, i) => h.guidedAvg !== null ? `${paddingX + i * stepX},${gOffset + paddingY + graphHeight - (h.guidedAvg / 100 * graphHeight)}` : '').filter(Boolean).join(' ');

        let svgHtml = `
            <div class="stability-title">Reliability Trend Analysis</div>
            <div class="stability-legend">
                <span>Chronological outcomes across identical trials</span>
                <span class="stability-legend-item"><span class="stability-legend-dot guided"></span> Guided</span>
                <span class="stability-legend-item"><span class="stability-legend-dot unguided"></span> Unguided</span>
            </div>
            
            <div class="stability-graph-container">
                <svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" style="display: block;">
                    
                    <!-- Top Subplot (Unguided) -->
                    <line x1="${paddingX}" y1="${paddingY}" x2="${width - paddingX}" y2="${paddingY}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${paddingY + graphHeight / 2}" x2="${width - paddingX}" y2="${paddingY + graphHeight / 2}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${paddingY + graphHeight}" x2="${width - paddingX}" y2="${paddingY + graphHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                    
                    <text x="${paddingX - 10}" y="${paddingY + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">100%</text>
                    <text x="${paddingX - 10}" y="${paddingY + graphHeight / 2 + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">50%</text>
                    <text x="${paddingX - 10}" y="${paddingY + graphHeight + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">0%</text>

                    ${uPoints ? `<polyline points="${uPoints}" fill="none" stroke="oklch(65% 0.1 200)" stroke-width="1.5" stroke-dasharray="3" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                    <!-- Bottom Subplot (Guided) -->
                    <line x1="${paddingX}" y1="${gOffset + paddingY}" x2="${width - paddingX}" y2="${gOffset + paddingY}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${gOffset + paddingY + graphHeight / 2}" x2="${width - paddingX}" y2="${gOffset + paddingY + graphHeight / 2}" stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="4" />
                    <line x1="${paddingX}" y1="${gOffset + paddingY + graphHeight}" x2="${width - paddingX}" y2="${gOffset + paddingY + graphHeight}" stroke="rgba(255,255,255,0.15)" stroke-width="1" />
                    
                    <text x="${paddingX - 10}" y="${gOffset + paddingY + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">100%</text>
                    <text x="${paddingX - 10}" y="${gOffset + paddingY + graphHeight / 2 + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">50%</text>
                    <text x="${paddingX - 10}" y="${gOffset + paddingY + graphHeight + 4}" fill="var(--text-secondary)" font-size="0.75rem" text-anchor="end">0%</text>

                    ${gPoints ? `<polyline points="${gPoints}" fill="none" stroke="oklch(65% 0.25 290)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` : ''}

                    <!-- Vertical Grid Lines & Combined Data points -->
                    ${history.map((h, i) => {
                        const x = paddingX + i * stepX;
                        const displayId = formatShortTime(h.timestamp);
                        const strokeColor = h.isCurrent ? '#fff' : 'var(--bg-primary)';
                        const strokeWidth = h.isCurrent ? 3 : 2;

                        let uTrialPoints = '';
                        if (h.unguidedTrials) {
                            h.unguidedTrials.forEach(trialRate => {
                                const yU = paddingY + graphHeight - (trialRate / 100 * graphHeight);
                                uTrialPoints += `
                                    <circle cx="${x}" cy="${yU}" r="4" fill="rgba(255,255,255,0.3)" stroke="${strokeColor}" stroke-width="${strokeWidth}">
                                        <title>Suite: ${h.testId}\nUnguided Trial: ${trialRate}%</title>
                                    </circle>
                                `;
                            });
                        }

                        let gTrialPoints = '';
                        if (h.guidedTrials) {
                            h.guidedTrials.forEach(trialRate => {
                                const yG = gOffset + paddingY + graphHeight - (trialRate / 100 * graphHeight);
                                gTrialPoints += `
                                    <circle cx="${x}" cy="${yG}" r="5" fill="${getColor(trialRate)}" stroke="${strokeColor}" stroke-width="${strokeWidth}">
                                        <title>Suite: ${h.testId}\nGuided Trial: ${trialRate}%</title>
                                    </circle>
                                `;
                            });
                        }

                        return `
                            <g class="stability-point-group" onclick="window.location.href='dashboard.html?testId=${h.testId}&source=local'">
                                <line x1="${x}" y1="${paddingY}" x2="${x}" y2="${gOffset + paddingY + graphHeight}" stroke="${h.isCurrent ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}" stroke-width="${h.isCurrent ? 1.5 : 1}" />
                                ${uTrialPoints}
                                ${gTrialPoints}
                                <text x="${x}" y="${gOffset + paddingY + graphHeight + 20}" fill="${h.isCurrent ? '#fff' : 'var(--text-secondary)'}" font-size="0.7rem" font-weight="${h.isCurrent ? 'bold' : 'normal'}" text-anchor="middle">${displayId}</text>
                            </g>
                        `;
                    }).join('')}
                </svg>
            </div>
        `;
        container.innerHTML = svgHtml;

    } catch (e) {
        container.innerHTML = `<div class="stability-error">Error querying trend: ${e.message}</div>`;
    }
};
