import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { defaultSuiteConfig } from '../config.ts';
import { collectResults } from '../lib/collection.ts';
const testDir = import.meta.dirname;
const harnessDir = path.resolve(testDir, '..');

test('collectResults extracts explicit baseApp, taskName, and guide from new data structures', async (_t) => {
    // 1. Setup mock paths and unique names
    const tasksDir = path.resolve(harnessDir, 'tasks');
    const guidesDir = path.resolve(harnessDir, '../guides');
    const resultsBase = path.resolve(testDir, 'fixtures-results-e2e');

    const taskName = '_e2e_test_task_xyz';
    const guideName = '_e2e_test_guide_xyz';
    const actualBaseAppName = 'cards-app'; // Simulating unexpected split naming

    const taskPath = path.join(tasksDir, `${taskName}.md`);
    const guideDir = path.join(guidesDir, guideName);

    try {
        // 2. Setup Task frontmatter mapping base_app and grader
        if (!fs.existsSync(tasksDir)) fs.mkdirSync(tasksDir, { recursive: true });
        fs.writeFileSync(taskPath, `---
grader: ${guideName}
base_app: ${actualBaseAppName}
---
# E2E Mock Prompt Instructions`);

        // 3. Setup fake Guide grader file
        if (!fs.existsSync(guideDir)) fs.mkdirSync(guideDir, { recursive: true });
        const graderPath = path.join(guideDir, 'grader.ts');
        fs.writeFileSync(graderPath, '// mock grader file for Playwright');

        // 4. Setup mock task execution dir where results generated from agents are stored
        // Expected glob iteration from collection.ts: */*/ matching {taskName}/{runType}
        const runNumberDir = path.join(resultsBase, '1');
        const targetDir = path.join(runNumberDir, taskName, 'guided');
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

        // Note: The collection string title is still used for mapping to dashboard.js backwards compatibility
        const testKey = `${taskName} - ${guideName} - guided`;
        assert.ok(allResults[testKey], `allResults must explicitly composite the key correctly: ${testKey}`);

        const runPayload = allResults[testKey][0];

        // Ensure variables correctly parsed to combat regressions seen in dashboard UI:
        assert.strictEqual(
            runPayload.baseApp,
            actualBaseAppName,
            'baseApp must resolve mapped value from explicit markdown frontmatter'
        );
        assert.strictEqual(
            runPayload.taskName,
            taskName,
            'taskName must map to explicitly processed file/folder logic'
        );

        // Ensure grader JSON parsing works correctly from disk when present
        assert.strictEqual(runPayload.results.length, 1);
        assert.strictEqual(runPayload.results[0].passed, true);
        assert.strictEqual(runPayload.results[0].message, 'E2E Validation test successfully validated HTML');

    } finally {
        // Cleanup dynamically created e2e fixture files
        if (fs.existsSync(taskPath)) fs.rmSync(taskPath, { force: true });
        if (fs.existsSync(guideDir)) fs.rmSync(guideDir, { recursive: true, force: true });
        if (fs.existsSync(resultsBase)) fs.rmSync(resultsBase, { recursive: true, force: true });
    }
});
