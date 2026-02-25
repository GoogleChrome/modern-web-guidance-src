import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { config, Agents } from './config.ts';

const RUN_TYPES = ['guided', 'unguided'];

// Global log file stream
let logStream: fs.WriteStream | null = null;

async function main() {
  const baseDir = __dirname;
  const baseAppsDir = path.join(baseDir, 'base_apps');
  const tasksDir = path.join(baseDir, 'tasks');
  const resultsDir = path.join(baseDir, 'results');

  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const agent = config.suite.agent;

  // Single task mode check
  const args = process.argv.slice(2);
  const positionalArgs = args.filter(arg => !arg.startsWith('--'));
  
  if (positionalArgs.length === 1) {
    const task = positionalArgs[0];
    const taskPath = path.join(tasksDir, `${task}.md`);

    if (!fs.existsSync(taskPath)) {
      console.error(`❌ Task '${task}' not found at ${taskPath}`);
      return;
    }

    const fileContent = fs.readFileSync(taskPath, 'utf8');
    const frontmatterMatch = fileContent.match(/^---\nbase_app:\s*(.+)\n---\n([\s\S]*)$/);
    
    if (!frontmatterMatch) {
      console.error(`❌ Invalid frontmatter format in ${taskPath}`);
      return;
    }

    const baseApp = frontmatterMatch[1].trim();
    let promptContent = frontmatterMatch[2].trim();

    const templateDir = path.join(baseAppsDir, baseApp);
    if (!fs.existsSync(templateDir)) {
      console.error(`❌ Template directory not found: ${templateDir}`);
      return;
    }

    console.log(`\n=== Running Single Task: ${task} ===`);
    console.log(`Agent: ${agent}`);
    console.log(`Template: ${baseApp}`);
    
    // Create a target directory in results/single_task
    const targetDir = path.join(resultsDir, 'single_task', task);
    console.log(`Target: ${targetDir}\n`);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    try {
      const agentScript = path.join(__dirname, 'agents',
        agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
          agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
            'jetski-agent.ts'
      );

      await runCommand('node', [
        '--experimental-strip-types', 
        agentScript, 
        JSON.stringify(promptContent), 
        'guided', // Default to guided for single task runs
        targetDir,
        templateDir
      ]);
      console.log(`\n✅ Single task complete! Results in ${targetDir}`);
    } catch (error) {
      console.error(`❌ Single task failed:`, error);
    }
    return;
  }

  // Generate a unique testID with timestamp or use custom name
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const testID = config.suite.name || `test_${timestamp}`;
  const testDir = path.join(resultsDir, testID);
  fs.mkdirSync(testDir, { recursive: true });

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);

  try {
    const endRun = 1 + config.suite.numRuns;
    console.log(`\nStarting execution for ${config.suite.numRuns} runs`);

    for (let runNumber = 1; runNumber < endRun; runNumber++) {

      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING RUN ${runNumber} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      const runDir = path.join(testDir, String(runNumber));
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      for (const task of config.suite.tasks) {
        // Read prompt from task
        const taskPath = path.join(tasksDir, `${task}.md`);
        if (!fs.existsSync(taskPath)) {
          console.warn(`Skipping task ${task}: ${taskPath} not found`);
          continue;
        }

        const fileContent = fs.readFileSync(taskPath, 'utf8');
        const frontmatterMatch = fileContent.match(/^---\nbase_app:\s*(.+)\n---\n([\s\S]*)$/);
        
        if (!frontmatterMatch) {
          console.warn(`Skipping task ${task}: Invalid frontmatter format in ${taskPath}`);
          continue;
        }

        const baseApp = frontmatterMatch[1].trim();
        let promptContent = frontmatterMatch[2].trim();

        // Append instruction to use stock photos if needed
        promptContent += ` Don't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

        for (const runType of RUN_TYPES) {
          const templateDir = path.join(baseAppsDir, baseApp);

          if (!fs.existsSync(templateDir)) {
            throw new Error(`Template directory not found: ${templateDir}`);
          }

          const targetDir = path.join(runDir, task, runType);
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
          }

          console.log(`\n>>> Running Task: ${task} | Template: ${baseApp} | Run Type: ${runType} | Run: ${runNumber} | Agent: ${agent}`);
          try {
          // Dispatch to appropriate agent script based on agent
            const agentArgs = [
              '--experimental-strip-types',
              path.join(__dirname, 'agents', agent === Agents.GEMINI_CLI ? 'gemini-cli-agent.ts' :
                agent === Agents.CLAUDE_CODE ? 'claude-code-agent.ts' :
                  'jetski-agent.ts'),
              JSON.stringify(promptContent),
              runType,
              targetDir,
              templateDir
            ];

            await runCommand('node', agentArgs);
            console.log(`✅ Completed: ${task}/${runType} (Run ${runNumber})`);
          } catch (error) {
            console.error(`❌ Failed: ${task}/${runType} (Run ${runNumber})`, error);
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
      manifest.tests.push({ id: testID, timestamp: new Date().toISOString(), runCount: config.suite.numRuns });
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
