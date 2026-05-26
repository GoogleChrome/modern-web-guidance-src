import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

export async function runSmokeTest() {
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'antigravity-cli-smoke-test-'));
  const targetFilePath = path.join(tempProjectDir, 'hello-antigravity.txt');
  const prompt = `Please create a file named '${targetFilePath}' containing exactly 'hello antigravity cli'. No other text or files are needed.`;
  
  console.log(`🚀 Starting Antigravity CLI smoke test in: ${tempProjectDir}`);
  
  // Create a mock suite config to satisfy getSuiteConfig
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    mcpServersToEnable: [],
    serving: 'skills_cli',
    agent: 'antigravity_cli'
  };

  try {
    const result = spawnSync('node', [
      '--experimental-strip-types',
      path.join(import.meta.dirname, 'agents/antigravity-cli-agent.ts'),
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
      console.error('❌ Antigravity CLI agent harness failed to execute.');
      process.exit(1);
    }

    // Verify the output
    const filePath = path.join(tempProjectDir, 'hello-antigravity.txt');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content === 'hello antigravity cli') {
        console.log('✅ Success: hello-antigravity.txt was created with correct content.');
        process.exit(0);
      } else {
        console.error(`❌ Failure: hello-antigravity.txt had incorrect content: "${content}"`);
        process.exit(1);
      }
    } else {
      console.error('❌ Failure: hello-antigravity.txt was not created.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ An error occurred during the Antigravity CLI smoke test:', err);
    process.exit(1);
  } finally {
    console.log(`🧹 Cleaning up: ${tempProjectDir}`);
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  runSmokeTest();
}
