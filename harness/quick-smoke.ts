import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSmokeTest() {
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jetski-smoke-test-'));
  const prompt = "Please create a file named 'hello.txt' containing exactly 'hello world'. No other text or files are needed.";
  
  console.log(`🚀 Starting smoke test in: ${tempProjectDir}`);
  
  try {
    const result = spawnSync('node', [
      '--experimental-strip-types',
      path.join(__dirname, 'agents/jetski-agent.ts'),
      prompt,
      'guided', // runType expects guided or unguided
      tempProjectDir, // targetDir
      tempProjectDir  // templateDir (both are temp dir for smoke test)
    ], {
      stdio: 'inherit',
      env: { ...process.env }
    });

    if (result.status !== 0) {
      console.error('❌ Agent harness failed to execute.');
      process.exit(1);
    }

    // Verify the output
    const filePath = path.join(tempProjectDir, 'hello.txt');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content === 'hello world') {
        console.log('✅ Success: hello.txt was created with correct content.');
        process.exit(0);
      } else {
        console.error(`❌ Failure: hello.txt had incorrect content: "${content}"`);
        process.exit(1);
      }
    } else {
      console.error('❌ Failure: hello.txt was not created.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ An error occurred during the smoke test:', err);
    process.exit(1);
  } finally {
    // Cleanup
    console.log(`🧹 Cleaning up: ${tempProjectDir}`);
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

runSmokeTest();
