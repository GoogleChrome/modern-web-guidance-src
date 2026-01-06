let allTestData = {}; // Cache all test data by testID

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadAllTests();
        renderTestsList();
        renderTimelines();
        renderGrids();
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('empty-state').style.display = 'block';
    }

    // Refresh button
    document.getElementById('refresh-btn').onclick = async () => {
        allTestData = {};
        document.getElementById('tests-list').innerHTML = '<div style="text-align:center; padding: 20px;">Loading...</div>';
        try {
            await loadAllTests();
            renderTestsList();
            renderTimelines();
            renderGrids();
        } catch (error) {
            console.error('Error refreshing:', error);
        }
    };
});

async function loadAllTests() {
    try {
        const response = await fetch('results/tests.json');
        if (!response.ok) throw new Error('Manifest not found');
        const manifest = await response.json();

        if (!manifest.tests || manifest.tests.length === 0) {
            document.getElementById('empty-state').style.display = 'block';
            return;
        }

        document.getElementById('empty-state').style.display = 'none';
        document.getElementById('timeline-section').style.display = 'block';
        document.getElementById('grid-section').style.display = 'block';

        // Load all test data
        for (const testEntry of manifest.tests) {
            try {
                const response = await fetch(`results/${testEntry.id}/evals.json`);
                if (response.ok) {
                    allTestData[testEntry.id] = {
                        timestamp: testEntry.timestamp,
                        data: await response.json()
                    };
                }
            } catch (e) {
                console.warn(`Failed to load test ${testEntry.id}:`, e);
            }
        }
    } catch (error) {
        console.warn('No manifest found:', error);
        document.getElementById('empty-state').style.display = 'block';
    }
}

function renderTestsList() {
    const container = document.getElementById('tests-list');
    const testIds = Object.keys(allTestData).reverse(); // Most recent first

    if (testIds.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        return;
    }

    container.innerHTML = `
        <div class="tests-grid">
            ${testIds.map(testID => {
                const testInfo = allTestData[testID];
                const data = testInfo.data;
                const summary = data.summary;
                const timestamp = new Date(testInfo.timestamp).toLocaleString();
                
                return `
                    <a href="dashboard.html?testID=${testID}" class="test-card-link">
                        <div class="test-card-title">Test ${testID.replace('test_', '')}</div>
                        <div class="test-card-time">${timestamp}</div>
                        <div class="test-card-stats">
                            <div class="stat-mini">
                                <div class="stat-mini-label">Guided</div>
                                <div class="stat-mini-value" style="color: ${getColor(summary.guidedMedian)}">${summary.guidedMedian}%</div>
                            </div>
                            <div class="stat-mini">
                                <div class="stat-mini-label">Unguided</div>
                                <div class="stat-mini-value" style="color: ${getColor(summary.unguidedMedian)}">${summary.unguidedMedian}%</div>
                            </div>
                        </div>
                    </a>
                `;
            }).join('')}
        </div>
    `;
}

function renderTimelines() {
    const testIds = Object.keys(allTestData).sort((a, b) => {
        const timeA = new Date(allTestData[a].timestamp);
        const timeB = new Date(allTestData[b].timestamp);
        return timeA - timeB;
    });

    const guidedTimeline = document.getElementById('guided-timeline');
    const unguidedTimeline = document.getElementById('unguided-timeline');

    guidedTimeline.innerHTML = testIds.map(testID => {
        const data = allTestData[testID].data;
        const value = data.summary.guidedMedian;
        const timestamp = new Date(allTestData[testID].timestamp).toLocaleDateString();
        
        return `
            <div class="timeline-bar" title="${testID} - ${timestamp}: ${value}% Guided" onclick="window.location='dashboard.html?testID=${testID}'">
                <div class="timeline-bar-fill" style="height: ${Math.max(value * 2, 10)}px; background-color: ${getColor(value)}"></div>
                <div class="timeline-bar-label">${value}%</div>
            </div>
        `;
    }).join('');

    unguidedTimeline.innerHTML = testIds.map(testID => {
        const data = allTestData[testID].data;
        const value = data.summary.unguidedMedian;
        const timestamp = new Date(allTestData[testID].timestamp).toLocaleDateString();
        
        return `
            <div class="timeline-bar" title="${testID} - ${timestamp}: ${value}% Unguided" onclick="window.location='dashboard.html?testID=${testID}'">
                <div class="timeline-bar-fill" style="height: ${Math.max(value * 2, 10)}px; background-color: ${getColor(value)}"></div>
                <div class="timeline-bar-label">${value}%</div>
            </div>
        `;
    }).join('');
}

function renderGrids() {
    const testIds = Object.keys(allTestData).sort((a, b) => {
        const timeA = new Date(allTestData[a].timestamp);
        const timeB = new Date(allTestData[b].timestamp);
        return timeA - timeB;
    });

    const scenarios = ['greenfield', 'brownfield', 'redfield'];
    const prompts = ['specific', 'vague'];

    scenarios.forEach(scenario => {
        prompts.forEach(prompt => {
            const gridId = `grid-${scenario}-${prompt}`;
            const gridElement = document.getElementById(gridId);
            if (!gridElement) return;

            const agents = ['guided', 'unguided'];
            const cellsHtml = [];

            testIds.forEach(testID => {
                const data = allTestData[testID].data;
                const stats = data.stats;

                agents.forEach(agent => {
                    const testName = `${scenario} - ${prompt} - ${agent}`;
                    const testStats = stats[testName];
                    
                    if (testStats) {
                        const shortAgent = agent === 'guided' ? 'G' : 'U';
                        cellsHtml.push(`
                            <div class="test-grid-cell" 
                                 style="background-color: ${getColor(testStats.median)}" 
                                 title="${testName}: ${testStats.median}%"
                                 onclick="window.location='dashboard.html?testID=${testID}'">
                                ${shortAgent}${testStats.median}%
                            </div>
                        `);
                    }
                });
            });

            gridElement.innerHTML = cellsHtml.join('');
        });
    });
}

function getColor(percentage) {
    if (percentage >= 90) return 'var(--accent-success)'; // Green
    if (percentage >= 50) return '#dbab09'; // Yellow/Orange
    return 'var(--accent-failure)'; // Red
}
