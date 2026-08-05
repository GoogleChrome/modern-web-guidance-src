import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

export async function runJetskiCliSmokeTest() {
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jetski-cli-smoke-test-'));
  const prompt = "Please create a file named 'hello-cli.txt' containing exactly 'hello jetski cli'. No other text or files are needed.";
  
  console.log(`🚀 Starting Jetski CLI smoke test in: ${tempProjectDir}`);
  
  // Create a mock suite config to satisfy getSuiteConfig
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    mcpServersToEnable: [],
    serving: 'skills_cli',
    agent: 'jetski_cli'
  };
  
  try {
    const result = spawnSync('node', [
      '--experimental-strip-types',
      path.join(import.meta.dirname, 'agents/jetski-cli-agent.ts'),
      prompt,
      'unguided', // runType expects guided or unguided
      tempProjectDir, // targetDir
      tempProjectDir  // templateDir (both are temp dir for smoke test)
    ], {
      stdio: 'inherit',
      env: { 
        ...process.env,
        GD_SUITE_CONFIG: JSON.stringify(suiteConfig)
      }
    });

    if (result.status !== 0) {
      console.error('❌ Agent harness failed to execute.');
      process.exit(1);
    }

    // Verify the output file
    const filePath = path.join(tempProjectDir, 'hello-cli.txt');
    if (!fs.existsSync(filePath)) {
      console.error('❌ Failure: hello-cli.txt was not created.');
      process.exit(1);
    }
    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content !== 'hello jetski cli') {
      console.error(`❌ Failure: hello-cli.txt had incorrect content: "${content}"`);
      process.exit(1);
    }
    console.log('✅ Success: hello-cli.txt was created with correct content.');

    // Verify trajectory parsing and metric extraction
    const { parseJetskiCliSession } = await import('./agents/jetski-cli-agent.ts');
    const summary = parseJetskiCliSession(tempProjectDir);
    console.log('📊 Trajectory summary from smoke test:', summary);

    if (!summary.model || summary.model === 'unknown' || !/^gemini/i.test(summary.model)) {
      console.error(`❌ Failure: Model name was not properly extracted (got "${summary.model}").`);
      process.exit(1);
    }
    if (!summary.tokenUsage || summary.tokenUsage.total <= 0) {
      console.error('❌ Failure: Token usage was not extracted from trajectory.');
      process.exit(1);
    }
    console.log('✅ Success: Trajectory model and token usage extracted accurately.');
    process.exit(0);
  } catch (err) {
    console.error('❌ An error occurred during the smoke test:', err);
    process.exit(1);
  } finally {
    // Cleanup
    console.log(`🧹 Cleaning up: ${tempProjectDir}`);
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  runJetskiCliSmokeTest();
}
