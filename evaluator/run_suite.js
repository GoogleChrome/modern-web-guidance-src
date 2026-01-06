const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');
const config = require('./config');

const SCENARIOS = ['greenfield', 'brownfield', 'redfield'];
const PROMPT_TYPES = ['specific', 'vague'];
const AGENT_TYPES = ['guided', 'unguided'];
const NUM_RUNS = 3;

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

  console.log(`\n=== Test Suite Starting with ID: ${testID} ===\n`);
  console.log(`Results will be saved to: ${testDir}\n`);

  // Artifact directories to reset
  const ARTIFACT_DIRS = [
    'brain',
    'browser_recordings',
    'code_tracker',
    'conversations',
    'implicit',
    'knowledge'
  ];
  const jetskiDir = config.jetskiDir;
  const backupBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jetski-artifacts-backup-'));

  console.log(`\n=== Backing up Artifacts ===`);
  console.log(`Source Root: ${jetskiDir}`);
  console.log(`Backup Root: ${backupBaseDir}`);

  try {
    for (const dirName of ARTIFACT_DIRS) {
      const sourcePath = path.join(jetskiDir, dirName);
      const destPath = path.join(backupBaseDir, dirName);
      if (fs.existsSync(sourcePath)) {
        console.log(`Backing up ${dirName}...`);
        await runCommand(`cp -R "${sourcePath}" "${destPath}"`);
      }
    }
    console.log('✅ Backup successful');

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

          promptContent += ` Don't bother doing any manual verification in a browser.`;

          for (const agentType of AGENT_TYPES) {
            updateMcpConfig(agentType);

            console.log('🧹 Clearing Artifacts for new run...');
            for (const dirName of ARTIFACT_DIRS) {
              const dirPath = path.join(jetskiDir, dirName);
              // Only clear if it exists
              if (fs.existsSync(dirPath)) {
                await runCommand(`rm -rf "${dirPath}/"*`);
              }
            }

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
              await runCommand('node', ['autorun.js', targetDir, JSON.stringify(promptContent)]);
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
      } catch (e) {
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
    console.log(`\n=== Restoring Artifacts ===`);

    try {
      if (typeof ARTIFACT_DIRS !== 'undefined' && typeof jetskiDir !== 'undefined' && typeof backupBaseDir !== 'undefined') {
        for (const dirName of ARTIFACT_DIRS) {
          const sourcePath = path.join(jetskiDir, dirName);
          const backupPath = path.join(backupBaseDir, dirName);

          // Remove current state
          if (fs.existsSync(sourcePath)) {
            await runCommand(`rm -rf "${sourcePath}"`);
          }

          // Restore from backup if it existed
          if (fs.existsSync(backupPath)) {
            await runCommand(`cp -R "${backupPath}" "${sourcePath}"`);
          }
        }
        console.log('✅ Restore successful');

        fs.rmSync(backupBaseDir, { recursive: true, force: true });
      }
    } catch (restoreErr) {
      console.error('CRITICAL: Failed to restore artifacts!', restoreErr);
      if (typeof backupBaseDir !== 'undefined') {
        console.error(`Backup should still be available at: ${backupBaseDir}`);
      }
    }
  }
}

main().catch(console.error);
