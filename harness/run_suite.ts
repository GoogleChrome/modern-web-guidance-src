import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

const SCENARIOS = ['greenfield', 'brownfield', 'redfield'];
const PROMPT_TYPES = ['specific', 'vague'];
const AGENT_TYPES = ['guided', 'unguided'];
const NUM_RUNS = 3;

// Global log file stream
let logStream: fs.WriteStream | null = null;

async function main() {
  const baseDir = __dirname;
  const setupDir = path.join(baseDir, 'setup');
  const resultsDir = path.join(baseDir, 'results');

  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Generate a unique testID with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const testID = `test_${timestamp}`;
  const testDir = path.join(resultsDir, testID);
  fs.mkdirSync(testDir, { recursive: true });

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===
`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  // Single task mode check
  const [argDir, argPrompt] = process.argv.slice(2);
  if (argDir && argPrompt) {
    console.log(`\n=== Running Single Task ===`);
    console.log(`Directory: ${argDir}`);
    console.log(`Prompt: ${argPrompt}\n`);

    try {
      // Default to guided for single tasks
      // Using --experimental-strip-types to run the TS agent directly
      await runCommand('node', ['--experimental-strip-types', 'jetski-agent.ts', path.resolve(argDir), JSON.stringify(argPrompt), 'guided']);
      console.log(`\n✅ Single task complete!`);
    } catch (error) {
      console.error(`
❌ Single task failed:`, error);
    }
    restoreLogging(originalConsoleMethods);
    return;
  }

  try {
    const endRun = 1 + NUM_RUNS;
    console.log(`\nStarting execution for ${NUM_RUNS} runs`);

    for (let runNumber = 1; runNumber < endRun; runNumber++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING RUN ${runNumber} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      const runDir = path.join(testDir, String(runNumber));
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      console.log(`Copying setup to ${runDir}...`);
      await runCommand(`cp -R "${setupDir}"/* "${runDir}/"`);
      console.log('✅ Setup copied');

      for (const scenario of SCENARIOS) {
        for (const promptType of PROMPT_TYPES) {
          const promptPath = path.join(setupDir, scenario, promptType, 'PROMPT.txt');
          if (!fs.existsSync(promptPath)) continue;

          let promptContent = fs.readFileSync(promptPath, 'utf8').trim();
          promptContent += ` Don't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

          for (const agentType of AGENT_TYPES) {
            const targetDir = path.join(runDir, scenario, promptType, agentType);

            if (!fs.existsSync(targetDir)) {
              if (scenario === 'greenfield') {
                fs.mkdirSync(targetDir, { recursive: true });
              } else {
                continue;
              }
            }

            console.log(`\n>>> Running Scenario: ${scenario} | Prompt: ${promptType} | Agent: ${agentType} | Run: ${runNumber}`);
            try {
              // Pass agentType so jetski-agent.ts can configure its own isolated MCP
              await runCommand('node', ['--experimental-strip-types', 'jetski-agent.ts', targetDir, JSON.stringify(promptContent), agentType]);
              console.log(`✅ Completed: ${scenario}/${promptType}/${agentType} (Run ${runNumber})`);
            } catch (error) {
              console.error(`❌ Failed: ${scenario}/${promptType}/${agentType} (Run ${runNumber})`, error);
            }
          }
        }
      }
    }

    const manifestPath = path.join(resultsDir, 'tests.json');
    let manifest: { tests: any[] } = { tests: [] };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {}
    }

    if (!manifest.tests.some(t => t.id === testID)) {
      manifest.tests.push({ id: testID, timestamp: new Date().toISOString(), runCount: NUM_RUNS });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }

    console.log(`\n✅ Test suite complete! Results saved to: results/${testID}`);
  } catch (e) {
    console.error('❌ Error during suite execution:', e);
  } finally {
    restoreLogging(originalConsoleMethods);
  }
}

// Hook into console methods to also write to log file
function setupLogging(logFilePath: string) {
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalLog.apply(console, args);
    if (logStream) {
      logStream.write(`[LOG ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.error = function(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalError.apply(console, args);
    if (logStream) {
      logStream.write(`[ERROR ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.warn = function(...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalWarn.apply(console, args);
    if (logStream) {
      logStream.write(`[WARN ${new Date().toISOString()}] ${message}\n`);
    }
  };

  return { originalLog, originalError, originalWarn };
}

function restoreLogging(originals: any) {
  if (originals) {
    console.log = originals.originalLog;
    console.error = originals.originalError;
    console.warn = originals.originalWarn;
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

async function runCommand(command: string, args: string[] = []) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve(true);
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}


main().catch(console.error);
