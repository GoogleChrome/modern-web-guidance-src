import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { defaultSuiteConfig } from '../config.ts';
import { collectResults } from '../lib/collection.ts';
import { guidesDir } from '../../lib/paths.ts';

const testDir = import.meta.dirname;

test('collectResults extracts explicit baseApp, taskName, and guide from new data structures', async (_t) => {
    // 1. Setup mock paths and unique names
    const resultsBase = path.resolve(testDir, 'fixtures-results-e2e');

    const guideName = '_e2e_test_guide_xyz';
    const actualBaseAppName = 'cards-app'; // Simulating unexpected split naming

    const performanceGuideDir = path.join(guidesDir, 'performance', guideName);
    const tasksDir = path.join(performanceGuideDir, 'tasks');
    const taskPath = path.join(tasksDir, 'task.md');

    try {
        // 2. Setup fake Guide grader file
        if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });
        const graderPath = path.join(performanceGuideDir, 'grader.ts');
        fs.writeFileSync(graderPath, '// mock grader file for Playwright');

        // 3. Setup Task frontmatter mapping base_app and grader
        fs.writeFileSync(taskPath, `---
base_app: ${actualBaseAppName}
---
- E2E Mock Prompt Instructions`);

        // 4. Setup mock task execution dir where results generated from agents are stored
        const runNumberDir = path.join(resultsBase, '1');
        const targetDir = path.join(runNumberDir, guideName, 'task', 'guided');
        fs.mkdirSync(targetDir, { recursive: true });

        // Target File checking
        fs.writeFileSync(path.join(targetDir, 'index.html'), '<html>Mock E2E HTML File</html>');

        // Resources used (needed for checkGuides logic during guided runs)
        fs.writeFileSync(path.join(targetDir, 'resources_used.json'), JSON.stringify([]));

        // 5. Short-circuit Playwright actual execution by providing cached grader results
        const mockPlaywrightOutput = {
            suites: [
                {
                    specs: [
                        {
                            title: 'E2E Validation test successfully validated HTML',
                            tests: [{ results: [{ status: 'passed' }] }]
                        }
                    ]
                }
            ]
        };
        fs.writeFileSync(path.join(targetDir, `${guideName}_results.json`), JSON.stringify(mockPlaywrightOutput));

        // 6. Execute system under test
        const { allResults, numRuns } = await collectResults(resultsBase, defaultSuiteConfig);

        // 7. Verify E2E extraction output
        assert.strictEqual(numRuns, 1, 'Expected 1 run detected');

        const testKey = `task - ${guideName} - guided`;
        assert.ok(allResults[testKey], `allResults must explicitly composite the key correctly: ${testKey}`);

        const runPayload = allResults[testKey][0];

        // Ensure variables correctly parsed to combat regressions seen in dashboard UI:
        assert.strictEqual(
            runPayload.baseApp,
            actualBaseAppName,
            'baseApp must resolve mapped value from explicit markdown frontmatter'
        );

        // Ensure grader JSON parsing works correctly from disk when present
        assert.strictEqual(runPayload.results.length, 1);
        assert.strictEqual(runPayload.results[0].passed, true);
        assert.strictEqual(runPayload.results[0].message, 'E2E Validation test successfully validated HTML');

    } finally {
        // Cleanup dynamically created e2e fixture files
        if (fs.existsSync(performanceGuideDir)) fs.rmSync(performanceGuideDir, { recursive: true, force: true });
        if (fs.existsSync(resultsBase)) fs.rmSync(resultsBase, { recursive: true, force: true });
    }
});
