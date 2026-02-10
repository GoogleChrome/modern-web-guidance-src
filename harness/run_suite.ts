import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config } from './config.ts';

const RUN_TYPES = ['guided', 'unguided'];

// Global log file stream
let logStream: fs.WriteStream | null = null;

async function main() {
  const baseDir = __dirname;
  const baseAppsDir = path.join(baseDir, 'base_apps');
  const resultsDir = path.join(baseDir, 'results');

  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // ===========================================================================
  // CLI Arguments Configuration
  // ===========================================================================
  // Available flags:
  //   --agent=<type>    : 'jetski' (default) or 'gemini-cli'
  //   --name=<string>    : Custom name for the test run (defaults to timestamp)
  //
  // Examples:
  //   pnpm suite --agent=gemini-cli --name=benchmark-v1
  //   pnpm task /path/to/dir "prompt" --agent=gemini-cli
  // ===========================================================================

  const VALID_AGENTS = ['jetski', 'gemini_cli'];

  const args = process.argv.slice(2);
  let agent = process.env.AGENT || 'jetski';
  let customTestName = null;
  let numRuns = config.numRuns;
  const positionalArgs = [];

  for (const arg of args) {
    if (arg.startsWith('--agent=')) {
      agent = arg.split('=')[1];
    } else if (arg.startsWith('--name=')) {
      customTestName = arg.split('=')[1];
    } else {
      positionalArgs.push(arg);
    }
  }

  if (!VALID_AGENTS.includes(agent)) {
    console.error(`\n❌ Error: Unknown agent '${agent}'. Supported agents: ${VALID_AGENTS.join(', ')}`);
    process.exit(1);
  }


  // Single task mode check
  const [argDir, argPrompt] = positionalArgs;

  if (argDir && argPrompt) {
    console.log(`\n=== Running Single Task ===`);
    console.log(`Agent: ${agent}`);
    console.log(`Directory: ${argDir}`);
    console.log(`Prompt: ${argPrompt}\n`);

    if (!fs.existsSync(argDir)) {
      console.log(`Creating directory: ${argDir}`);
      fs.mkdirSync(argDir, { recursive: true });
    }

    try {
      // Dispatch based on agent
      if (agent === 'gemini_cli') {
        // Use experimental-strip-types for running TS directly
        await runCommand('node', ['--experimental-strip-types', 'agents/gemini-cli-agent.ts', path.resolve(argDir), JSON.stringify(argPrompt), 'guided']);
      } else {
        await runCommand('node', ['--experimental-strip-types', 'agents/jetski-agent.ts', path.resolve(argDir), JSON.stringify(argPrompt), 'guided']);
      }
      console.log(`\n✅ Single task complete!`);
    } catch (error) {
      console.error(`❌ Single task failed:`, error);
    }
    return;
  }

  // Generate a unique testID with timestamp or use custom name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const testID = customTestName ? `test_${customTestName}` : `test_${timestamp}`;
  const testDir = path.join(resultsDir, testID);
  fs.mkdirSync(testDir, { recursive: true });

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  try {
    const endRun = 1 + numRuns;
    console.log(`\nStarting execution for ${numRuns} runs`);

    for (let runNumber = 1; runNumber < endRun; runNumber++) {

      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING RUN ${runNumber} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      const runDir = path.join(testDir, String(runNumber));
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      console.log(`Copying base apps to ${runDir}...`);
      await runCommand(`cp -R "${baseAppsDir}"/* "${runDir}/"`);
      console.log('✅ Base apps copied');

      for (const scenario of config.scenarios) {
        for (const promptType of config.promptTypes) {
          const promptPath = path.join(baseAppsDir, scenario, promptType, 'PROMPT.txt');
          if (!fs.existsSync(promptPath)) continue;

          let promptContent = fs.readFileSync(promptPath, 'utf8').trim();
          promptContent += ` Don't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

          for (const agentType of RUN_TYPES) {
            const targetDir = path.join(runDir, scenario, promptType, agentType);

            if (!fs.existsSync(targetDir)) {
              if (scenario === 'greenfield') {
                fs.mkdirSync(targetDir, { recursive: true });
              } else {
                continue;
              }
            }

            console.log(`\n>>> Running Scenario: ${scenario} | Prompt: ${promptType} | Agent: ${agentType} | Run: ${runNumber} | Agent: ${agent}`);
            try {
              // Dispatch to appropriate agent script based on agent
              if (agent === 'gemini_cli') {
                await runCommand('node', ['--experimental-strip-types', 'agents/gemini-cli-agent.ts', targetDir, JSON.stringify(promptContent), agentType]);
              } else {
                await runCommand('node', ['--experimental-strip-types', 'agents/jetski-agent.ts', targetDir, JSON.stringify(promptContent), agentType]);
              }
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
      } catch { }
    }

    if (!manifest.tests.some(t => t.id === testID)) {
      manifest.tests.push({ id: testID, timestamp: new Date().toISOString(), runCount: numRuns });
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

  console.log = function (...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalLog.apply(console, args);
    if (logStream) {
      logStream.write(`[LOG ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.error = function (...args: any[]) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalError.apply(console, args);
    if (logStream) {
      logStream.write(`[ERROR ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.warn = function (...args: any[]) {
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
