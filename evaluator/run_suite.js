const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const SCENARIOS = ['greenfield', 'brownfield', 'redfield'];
const PROMPT_TYPES = ['specific', 'vague'];
const AGENT_TYPES = ['guided', 'unguided'];

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

async function main() {
    const baseDir = __dirname;

    for (const scenario of SCENARIOS) {
        for (const promptType of PROMPT_TYPES) {
            // Locate the prompt file
            const promptPath = path.join(baseDir, scenario, promptType, 'PROMPT.txt');

            if (!fs.existsSync(promptPath)) {
                console.warn(`WARNING: Prompt file not found at ${promptPath}. Skipping this prompt type.`);
                continue;
            }

            const promptContent = fs.readFileSync(promptPath, 'utf8').trim();
            console.log(`\n=== Loaded Prompt for verify [${scenario} / ${promptType}] ===`);

            for (const agentType of AGENT_TYPES) {
                const targetDir = path.join(baseDir, scenario, promptType, agentType);
                
                // Ensure target directory exists
                if (!fs.existsSync(targetDir)) {
                     console.warn(`WARNING: Target directory not found at ${targetDir}. Skipping.`);
                     continue;
                }

                console.log(`\n>>> Running Scenario: ${scenario} | Prompt: ${promptType} | Agent: ${agentType}`);
                console.log(`Target Dir: ${targetDir}`);
                
                try {
                    await runCommand('node', ['autorun.js', targetDir, JSON.stringify(promptContent)]);
                    console.log(`✅ Completed: ${scenario}/${promptType}/${agentType}`);
                } catch (error) {
                    console.error(`❌ Failed: ${scenario}/${promptType}/${agentType}`, error);
                    // Decide if you want to stop on error or continue. 
                    // For now, let's continue but log the error.
                }
            }
        }
    }
}

main().catch(console.error);
