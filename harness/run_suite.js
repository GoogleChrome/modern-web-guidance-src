import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execSync } from 'child_process';
import config from './config.js';

const SCENARIOS = ['greenfield', 'brownfield', 'redfield'];
const PROMPT_TYPES = ['specific', 'vague'];
const AGENT_TYPES = ['guided', 'unguided'];
const NUM_RUNS = 3;

// Global log file stream
let logStream = null;

// Hook into console methods to also write to log file
function setupLogging(logFilePath) {
  logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function(...args) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalLog.apply(console, args);
    if (logStream) {
      logStream.write(`[LOG ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.error = function(...args) {
    const message = args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    originalError.apply(console, args);
    if (logStream) {
      logStream.write(`[ERROR ${new Date().toISOString()}] ${message}\n`);
    }
  };

  console.warn = function(...args) {
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

function restoreLogging(originals) {
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

async function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
}

function updateMcpConfig(agentType) {
  const configPath = path.join(config.jetskiDir, 'mcp_config.json');
  let mcpConfig = { mcpServers: {} };

  try {
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, 'utf8');
      if (content.trim()) {
        mcpConfig = JSON.parse(content);
      }
    }
  } catch (e) {
    console.error('Failed to read MCP config:', e);
  }

  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

  const serverName = 'modern-web';
  // Only configure modern-web for guided agents
  if (agentType === 'guided') {
    mcpConfig.mcpServers[serverName] = {
      "command": "node",
      "args": [
        config.mcpServerPath
      ]
    };
    console.log('Enabled modern-web MCP server');
  } else {
    if (mcpConfig.mcpServers[serverName]) {
      delete mcpConfig.mcpServers[serverName];
      console.log('Disabled modern-web MCP server');
    }
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
  } catch (e) {
    console.error('Failed to write MCP config:', e);
  }
}


async function main() {
  const baseDir = __dirname;
  const setupDir = path.join(baseDir, 'setup');
  const resultsDir = path.join(baseDir, 'results');

  // Create results directory if it doesn't exist
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  // Generate a unique testID with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // e.g., 2026-01-06T09-11-03
  const testID = `test_${timestamp}`;
  const testDir = path.join(resultsDir, testID);
  fs.mkdirSync(testDir, { recursive: true });

  // Create a temporary home directory to isolate the agent profile
  const testHomeDir = `/tmp/ghh-${Math.random().toString(36).substring(7)}`;
  fs.mkdirSync(testHomeDir, { recursive: true });

  console.log(`Setting up isolated HOME at ${testHomeDir}...`);

  const appSupportSource = path.join(os.homedir(), 'Library/Application Support/Jetski');
  const appSupportDest = path.join(testHomeDir, 'Library/Application Support/Jetski');
  const geminiSource = path.join(os.homedir(), '.gemini/jetski');
  const geminiDest = path.join(testHomeDir, '.gemini/jetski');

  fs.mkdirSync(appSupportDest, { recursive: true });
  fs.mkdirSync(geminiDest, { recursive: true });

  // Copy minimal authentication state
  const filesToCopy = [
    'Cookies',
    'Preferences',
    'machineid',
    'Network Persistent State'
  ];

  for (const file of filesToCopy) {
    const src = path.join(appSupportSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(appSupportDest, file));
    }
  }

  // Copy Local Storage and User (excluding workspaceStorage)
  try {
    execSync(`rsync -a "${appSupportSource}/Local Storage/" "${appSupportDest}/Local Storage/"`);
    execSync(`rsync -a --exclude='workspaceStorage' "${appSupportSource}/User/" "${appSupportDest}/User/"`);
  } catch (err) {
    console.warn('Warning: Failed to copy some Application Support directories:', err.message);
  }

  // Copy essential .gemini state
  const geminiFiles = ['installation_id', 'user_settings.pb'];
  for (const file of geminiFiles) {
    const src = path.join(geminiSource, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(geminiDest, file));
    }
  }

  // Update config to use the new isolated directory
  process.env.HOME = testHomeDir;
  config.jetskiDir = geminiDest;
  process.env.JETSKI_DIR = config.jetskiDir;

  // Setup logging to file
  const logFilePath = path.join(testDir, 'test_suite.log');
  const originalConsoleMethods = setupLogging(logFilePath);

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===\n`);
  console.log(`Results will be saved to: ${testDir}\n`);
  console.log(`Log file: ${logFilePath}\n`);
  console.log(`Isolated HOME: ${testHomeDir}\n`);

  // Single task mode check
  const [argDir, argPrompt] = process.argv.slice(2);
  if (argDir && argPrompt) {
    console.log(`\n=== Running Single Task ===`);
    console.log(`Directory: ${argDir}`);
    console.log(`Prompt: ${argPrompt}\n`);
    
    try {
      updateMcpConfig('guided');
      await runCommand('node', ['jetski-agent.js', path.resolve(argDir), JSON.stringify(argPrompt)]);
      console.log(`\n✅ Single task complete!`);
    } catch (error) {
      console.error(`\n❌ Single task failed:`, error);
    }
    return; // Exit after single task
  }

  try {
    const endRun = 1 + NUM_RUNS;
    console.log(`\nStarting execution for ${NUM_RUNS} runs`);

    for (let runNumber = 1; runNumber < endRun; runNumber++) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`>>> STARTING RUN ${runNumber} <<<`);
      console.log(`${'='.repeat(60)}\n`);

      // Create run directory under testID
      const runDir = path.join(testDir, String(runNumber));
      if (!fs.existsSync(runDir)) {
        fs.mkdirSync(runDir, { recursive: true });
      }

      // Copy setup directory contents to run directory
      console.log(`Copying setup to ${runDir}...`);
      await runCommand(`cp -R "${setupDir}/"* "${runDir}/"`);
      console.log('✅ Setup copied');

      for (const scenario of SCENARIOS) {
        for (const promptType of PROMPT_TYPES) {
          const promptPath = path.join(setupDir, scenario, promptType, 'PROMPT.txt');

          if (!fs.existsSync(promptPath)) {
            console.warn(`WARNING: Prompt file not found at ${promptPath}. Skipping this prompt type.`);
            continue;
          }

          let promptContent = fs.readFileSync(promptPath, 'utf8').trim();
          console.log(`\n=== Loaded Prompt for verify [${scenario} / ${promptType}] ===`);

          promptContent += ` Don't bother doing any manual verification in a browser. If images are needed, prefer using some stock photos from the web rather than generating them with Nano Banana.`;

          for (const agentType of AGENT_TYPES) {
            updateMcpConfig(agentType);

            const targetDir = path.join(runDir, scenario, promptType, agentType);

            if (!fs.existsSync(targetDir)) {
              if (scenario === 'greenfield') {
                fs.mkdirSync(targetDir, { recursive: true });
              } else {
                console.warn(`WARNING: Target directory not found at ${targetDir}. Skipping.`);
                continue;
              }
            }

            console.log(`\n>>> Running Scenario: ${scenario} | Prompt: ${promptType} | Agent: ${agentType} | Run: ${runNumber}`);
            console.log(`Target Dir: ${targetDir}`);

            try {
              // autorun inherits the isolated HOME via process.env
              await runCommand('node', ['jetski-agent.js', targetDir, JSON.stringify(promptContent)]);
              console.log(`✅ Completed: ${scenario}/${promptType}/${agentType} (Run ${runNumber})`);
            } catch (error) {
              console.error(`❌ Failed: ${scenario}/${promptType}/${agentType} (Run ${runNumber})`, error);
            }
          }
        }
      }
    }

    // Save testID to manifest file
    const manifestPath = path.join(resultsDir, 'tests.json');
    let manifest = { tests: [] };
    if (fs.existsSync(manifestPath)) {
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      } catch {
        console.warn('Could not parse existing manifest, starting fresh');
      }
    }

    if (!manifest.tests.some(t => t.id === testID)) {
      manifest.tests.push({
        id: testID,
        timestamp: new Date().toISOString(),
        runCount: NUM_RUNS
      });
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`\n✅ Manifest updated: ${manifestPath}`);
    }

    console.log(`\n✅ Test suite complete! Results saved to: results/${testID}`);
  } catch (e) {
    console.error('❌ Error during suite execution:', e);
  } finally {
    console.log(`\n=== Cleaning up isolated HOME ===`);
    try {
      if (testHomeDir && fs.existsSync(testHomeDir)) {
        fs.rmSync(testHomeDir, { recursive: true, force: true });
        console.log('✅ Cleanup successful');
      }
    } catch (cleanupErr) {
      console.error('Failed to cleanup isolated HOME:', cleanupErr);
    }

    // Restore console methods and close log stream
    restoreLogging(originalConsoleMethods);
  }
}

main().catch(console.error);
