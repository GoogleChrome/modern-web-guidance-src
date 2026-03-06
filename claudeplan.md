 Plan: gd guide dev — Automated Guide Development Pipeline

 Context

 The guidance project has ~37 web development guides. Only 2 are fully complete (with grader, negative-demo, etc.). The development workflow currently requires running 4-6 separate
 commands manually:

 pnpm generate-negative <dir>   →  pnpm generate-grader <dir>
 →  pnpm grade <dir>  (calibrate)  →  fix & retry  →  repeat
 →  pnpm build:mcp  →  pnpm run-agent  →  pnpm grade <output>

 The skill-creator project demonstrated that a single orchestrating command — "point it at the thing and everything happens" — dramatically reduces friction. We want that automation
 for guide development, but with artifacts committed to source control rather than living in ephemeral workspaces.

 What We're Building

 A gd guide dev <dir> command that takes a guide directory from whatever state it's in to "grader calibrated and ready." It inventories existing artifacts, generates what's missing,
 validates the grader, retries on failure, and optionally runs an agent test — all in one command.

 Also: a gd guide dev-all batch mode that processes all incomplete guides.

 Files to Create/Modify

 ┌──────────────────────┬───────────────────────────────────────────────────────────────────────────────┐
 │         File         │                                    Action                                     │
 ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ guides/dev-guide.ts  │ Create — main orchestration logic                                             │
 ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ guides/run-grader.ts │ Modify — refactor testGrader to return results instead of process.exit()      │
 ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ guides/grader-gen.ts │ Modify — add generateGraderWithContext() variant that accepts failure details │
 ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ bin/gd.ts            │ Modify — add dev action, update help text and completions                     │
 ├──────────────────────┼───────────────────────────────────────────────────────────────────────────────┤
 │ package.json (root)  │ Modify — add dev-guide script                                                 │
 └──────────────────────┴───────────────────────────────────────────────────────────────────────────────┘

 Existing code to reuse

 - guides/grader-gen.ts → generateGrader(dir) — spawns Gemini CLI to create grader.ts
 - guides/negative-gen.ts → generateNegative(dir) — spawns Gemini CLI to create negative-demo.html
 - guides/run-grader.ts → testGrader(dir) — runs Playwright calibration (from commit 16b935f)
 - harness/lib/agent-shared.ts → createIsolatedHome(), cleanupIsolatedHome(), copyFileIfExists(), createTrustedFolders() — isolation utilities
 - harness/run_suite.ts → agent invocation pattern for the --test step

 ---
 Implementation: guides/dev-guide.ts

 Core function: devGuide(targetDir, options?)

 interface DevGuideOptions {
   maxRetries?: number;  // default: 2
   test?: boolean;       // default: false — run agent test after calibration
   verbose?: boolean;
 }

 Step 1: Inventory

 Check which artifacts exist in the guide directory.

 Required inputs (must exist, bail if missing):
 - guide.md — must have YAML frontmatter with name and description
 - demo.html

 Generated artifacts (create if missing):
 - expectations.md — if empty/missing, warn but continue (human-authored content)
 - negative-demo.html — generate via generateNegative(dir)
 - grader.ts — generate via generateGrader(dir)

 Print a status table:
 📋 Guide: light-dismiss-dialog
    guide.md           ✅
    demo.html          ✅
    expectations.md    ⚠️  empty
    negative-demo.html ⬜ will generate
    grader.ts          ⬜ will generate

 Step 2: Generate negative-demo.html (if missing)

 - Call generateNegative(dir) (existing function from negative-gen.ts)
 - Verify the file was created
 - If generation fails, log error and stop (grader-gen needs it)

 Step 3: Generate grader.ts (if missing or needs retry)

 - Call generateGrader(dir) (existing function from grader-gen.ts)
 - Verify the file was created

 Step 4: Calibrate — the retry loop

 This is the key new behavior. Run calibration and if it fails, retry grader generation with the failure context.

 for attempt in 1..maxRetries:
     result = testGrader(dir)  // returns CalibrationResult, not process.exit()
     if result.success:
         print "✅ Grader calibrated!"
         break
     else:
         print "Attempt {attempt} failed. Regenerating with failure context..."
         rm grader.ts
         generateGraderWithContext(dir, result)

 generateGraderWithContext appends calibration failure details to the agent prompt:

 "A previous attempt at generating grader.ts failed calibration:
 - demo.html failed these tests (they should pass): [list]
 - negative-demo.html passed these tests (they should fail): [list]
 Revise the grader to fix these issues."

 Step 5 (default, skip with --no-test flag): Agent test run

 When not skipped:

 1. Build MCP index — run pnpm build:mcp (needed for guided mode)
 2. Find or create test prompt — use prompts.md if it exists, otherwise derive a prompt from guide.md frontmatter description
 3. Create test-app directory — if test-app/ doesn't exist, create an empty one (blank slate for the agent)
 4. Run agent — spawn the configured agent (Gemini CLI by default) in both guided and unguided modes, using the existing agent infrastructure from harness/agents/
 5. Grade outputs — run the grader against both outputs
 6. Print comparison:
 Agent test results:
   Unguided: 3/9 checks passed (33%)
   Guided:   8/9 checks passed (89%)
   Guide impact: +56%

 This step reuses the existing harness infrastructure (run_suite.ts patterns, agent scripts, run-grader.ts grading) but orchestrated from the dev command rather than requiring manual
 config editing.

 Step 6: Summary

 Print final status:
 ✅ Guide: light-dismiss-dialog
    guide.md              ✅ exists
    demo.html             ✅ exists
    expectations.md       ⚠️  empty (consider adding assertions)
    negative-demo.html    ✅ generated
    grader.ts             ✅ calibrated (attempt 2 of 2)
    agent test (guided)   ✅ 8/9 passed (89%)
    agent test (unguided) ✅ 3/9 passed (33%)

 All generated files are in guides/user-experience/light-dismiss-dialog/
 Ready to review and commit.

 Batch function: devAll(options?)

 - Scan guides/performance/ and guides/user-experience/ for directories containing guide.md + demo.html
 - Filter to guides missing negative-demo.html or grader.ts
 - Print summary: "Found N incomplete guides"
 - Process sequentially (each generation spawns a Gemini CLI process)
 - Skip agent tests in batch mode (too expensive)
 - Print aggregate results:
 Batch complete: 12/15 guides calibrated
 Failed: complex-shapes, stencil-cutouts, visually-texture-content

 ---
 Required Refactoring

 testGrader in run-grader.ts (commit 16b935f)

 Currently calls process.exit(). Refactor to return a structured result:

 interface CalibrationResult {
   success: boolean;
   demo: { passed: number; failed: number; failingTests: string[] };
   negative: { passed: number; failed: number; passingTests: string[] };
 }

 The CLI entry point (run() at bottom of file) still calls process.exit() based on the returned result. The refactoring only changes the internal function signature.

 generateGraderWithContext in grader-gen.ts

 Add a new exported function (or an optional context parameter to the existing one) that appends failure details to the Gemini CLI prompt. The isolation setup, file copying, and
 cleanup logic are identical — only the prompt text differs.

 ---
 Modifications to bin/gd.ts

 Add to the guide workflow switch:

 case 'dev':
     const { devGuide } = await import('../guides/dev-guide.ts');
     const devOpts = { test: !passThroughArgs.includes('--no-test') };
     const devDir = passThroughArgs.find(a => !a.startsWith('--'));
     await devGuide(devDir, devOpts);
     inProcess = true;
     break;

 Update help text:
 Guide Commands (gd guide <action>):
   dev [dir] [--no-test] Auto-generate and calibrate guide artifacts
   grade [file|dir]     Run/calibrate grader
   gen-grader [dir]     Generate a new grader script
   gen-negative [dir]   Generate negative examples

 Update completion handler to include dev.

 Root package.json

 Add script alias:
 "dev-guide": "node --experimental-strip-types guides/dev-guide.ts"

 ---
 Verification

 1. Complete guide — Run on guides/performance/batch-analytics-events. Should report "all artifacts exist" and verify calibration passes. No files generated.
 2. Incomplete guide — Run on a guide with guide.md + demo.html but no grader/negative-demo (e.g. guides/user-experience/light-dismiss-dialog). Should generate both files and
 calibrate.
 3. Retry logic — Manually break a grader.ts (reverse an assertion) and run gd guide dev. Should detect calibration failure and regenerate.
 4. Agent test — Run gd guide dev guides/performance/batch-analytics-events --test. Should run guided + unguided agent tests and grade both.
 5. Batch mode — Run gd guide dev-all and verify it discovers and processes incomplete guides.
 6. Source control — After running, verify all generated files are in the guide directory (not /tmp), ready to git add.

