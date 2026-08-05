import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Agents } from './config.ts';

/**
 * Maps agent names to their harness file and default configuration.
 */
const AGENT_CONFIGS: Record<string, { file: string; agent: string }> = {
  'jetski': { file: 'jetski-agent.ts', agent: Agents.JETSKI },
  'jetski-cli': { file: 'jetski-cli-agent.ts', agent: Agents.JETSKI_CLI },
  'gemini-cli': { file: 'gemini-cli-agent.ts', agent: Agents.GEMINI_CLI },
  'claude-code': { file: 'claude-code-agent.ts', agent: Agents.CLAUDE_CODE },
  'codex-cli': { file: 'codex-cli-agent.ts', agent: Agents.CODEX_CLI },
  'pi': { file: 'pi-agent.ts', agent: Agents.PI },
};

export interface SmokeTestOptions {
  agent?: string;
  runType?: 'guided' | 'unguided';
  outputFile?: string;
  outputContent?: string;
  prompt?: string;
}

export async function runSmokeTest(options: SmokeTestOptions = {}): Promise<void> {
  const agentName = options.agent || process.env.SMOKE_AGENT || 'pi';
  const agentConfig = AGENT_CONFIGS[agentName];
  
  if (!agentConfig) {
    console.error(`❌ Unknown agent: ${agentName}`);
    console.error(`Available agents: ${Object.keys(AGENT_CONFIGS).join(', ')}`);
    process.exit(1);
  }
  
  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), `${agentName}-smoke-test-`));
  const outputFile = options.outputFile || `${agentName.replace(/-/g, '')}-output.txt`;
  const outputContent = options.outputContent || `hello ${agentName.replace(/-/g, ' ')}`;
  const prompt = options.prompt || `Please create a file named '${outputFile}' containing exactly '${outputContent}'. No other text or files are needed.`;
  const runType = options.runType || 'unguided';
  
  console.log(`🚀 Starting smoke test for ${agentName} in: ${tempProjectDir}`);
  
  // Create a mock suite config to satisfy getSuiteConfig
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    mcpServersToEnable: [],
    skillsToEnable: [],
    serving: 'skills_cli',
    agent: agentConfig.agent
  };
  
  try {
    const result = spawnSync('node', [
      '--experimental-strip-types',
      path.join(import.meta.dirname, 'agents', agentConfig.file),
      prompt,
      runType,
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

    // Verify the output
    const filePath = path.join(tempProjectDir, outputFile);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8').trim();
      if (content === outputContent) {
        console.log(`✅ Success: ${outputFile} was created with correct content.`);
      } else {
        console.error(`❌ Failure: ${outputFile} had incorrect content: "${content}"`);
        console.error(`Expected: "${outputContent}"`);
        process.exit(1);
      }
    } else {
      console.error(`❌ Failure: ${outputFile} was not created.`);
      process.exit(1);
    }

    // Verify trajectory parsing and metric extraction
    const { extractModelFromResults, extractTokenUsageFromResults } = await import('./lib/collection.ts');
    const model = extractModelFromResults(tempProjectDir, agentConfig.agent);
    const tokenUsage = extractTokenUsageFromResults(tempProjectDir, agentConfig.agent);
    
    console.log(`📊 Trajectory summary from smoke test: Model=${model}, Tokens=${JSON.stringify(tokenUsage)}`);

    if (!model || model === 'unknown') {
      console.error(`❌ Failure: Model name was not properly extracted (got "${model}").`);
      process.exit(1);
    }
    
    // We only enforce token usage for agents that we know extract it correctly, 
    // but the main branch explicitly added this for jetski-cli. Since all modern ones 
    // should have it, let's enforce it generally or just for jetski-cli if others are flaky.
    // For now we enforce total > 0.
    if (!tokenUsage || tokenUsage.total <= 0) {
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
  // Parse command line args: node quick-smoke.ts [agent] [guided|unguided]
  const args = process.argv.slice(2);
  const agent = args[0];
  const runType = args[1] as 'guided' | 'unguided' | undefined;
  
  runSmokeTest({ agent, runType });
}
