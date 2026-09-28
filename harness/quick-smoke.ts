import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { Agents } from './config.ts';
import { applyPatchSync } from '../lib/patch-utils.ts';

/**
 * Maps agent names to their harness file and default configuration.
 */
const AGENT_CONFIGS: Record<string, { file: string; agent: string }> = {
  'jetski-cli': { file: 'jetski-cli-agent.ts', agent: Agents.JETSKI_CLI },
  'gemini-cli': { file: 'gemini-cli-agent.ts', agent: Agents.GEMINI_CLI },
  'claude-code': { file: 'claude-code-agent.ts', agent: Agents.CLAUDE_CODE },
  'codex-cli': { file: 'codex-cli-agent.ts', agent: Agents.CODEX_CLI },
  'pi': { file: 'pi-agent.ts', agent: Agents.PI },
};

const RUN_TYPES = ['guided', 'unguided'] as const;
type RunType = typeof RUN_TYPES[number];

/** Patch file written by the agent harness when results are stored patch-only. */
const AGENT_PATCH_FILE = 'agent.patch';

export interface SmokeTestOptions {
  agent?: string;
  runType?: RunType;
  outputFile?: string;
  outputContent?: string;
  prompt?: string;
}

/**
 * Materializes agent results in `resultDir` so they can be inspected as plain files.
 *
 * Agents execute inside an isolated HOME, so `copyResultsToTarget` hands results back in one of
 * two shapes: workspace files copied directly (legacy task layout), or an `agent.patch` capturing
 * the diff. Applying the patch normalizes the patch-only case to the file case, which mirrors how
 * the real eval pipeline grades a run.
 *
 * @returns true if a patch was applied.
 */
export function materializeAgentResults(resultDir: string): boolean {
  const patchPath = path.join(resultDir, AGENT_PATCH_FILE);
  if (!fs.existsSync(patchPath)) return false;

  const result = applyPatchSync(resultDir, patchPath);
  if (!result.success) {
    throw new Error(`Failed to apply ${AGENT_PATCH_FILE}: ${result.error}`);
  }
  console.log(`📦 Applied ${AGENT_PATCH_FILE} to materialize agent results.`);
  return true;
}

/**
 * Runs a single-task smoke test against an agent harness.
 * @throws if the agent fails to execute or produces unexpected output.
 */
export async function runSmokeTest(options: SmokeTestOptions = {}): Promise<void> {
  const agentName = options.agent || process.env.SMOKE_AGENT || 'pi';
  const agentConfig = AGENT_CONFIGS[agentName];

  if (!agentConfig) {
    throw new Error(
      `Unknown agent: ${agentName}. Available agents: ${Object.keys(AGENT_CONFIGS).join(', ')}`
    );
  }

  const runType = options.runType || 'unguided';
  if (!RUN_TYPES.includes(runType)) {
    throw new Error(`Unknown run type: ${runType}. Expected one of: ${RUN_TYPES.join(', ')}`);
  }

  const tempProjectDir = fs.mkdtempSync(path.join(os.tmpdir(), `${agentName}-smoke-test-`));
  const outputFile = options.outputFile || `${agentName.replace(/-/g, '')}-output.txt`;
  const outputContent = options.outputContent || `hello ${agentName.replace(/-/g, ' ')}`;
  const prompt = options.prompt || `Please create a file named '${outputFile}' containing exactly '${outputContent}'. No other text or files are needed.`;

  console.log(`🚀 Starting smoke test for ${agentName} in: ${tempProjectDir}`);

  // Create a mock suite config to satisfy getSuiteConfig
  const suiteConfig = {
    name: 'smoke-test',
    numRuns: 1,
    tasks: [],
    skillsToEnable: [],
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
      throw new Error('Agent harness failed to execute.');
    }

    materializeAgentResults(tempProjectDir);

    // Verify the output
    const filePath = path.join(tempProjectDir, outputFile);
    if (!fs.existsSync(filePath)) {
      throw new Error(`${outputFile} was not created.`);
    }

    const content = fs.readFileSync(filePath, 'utf8').trim();
    if (content !== outputContent) {
      throw new Error(`${outputFile} had incorrect content: "${content}". Expected: "${outputContent}"`);
    }
    console.log(`✅ Success: ${outputFile} was created with correct content.`);

    // Verify trajectory parsing and metric extraction
    const { extractModelFromResults, extractTokenUsageFromResults } = await import('./lib/collection.ts');
    const model = extractModelFromResults(tempProjectDir);
    const tokenUsage = extractTokenUsageFromResults(tempProjectDir);

    console.log(`📊 Trajectory summary from smoke test: Model=${model}, Tokens=${JSON.stringify(tokenUsage)}`);

    if (!model || model === 'unknown') {
      throw new Error(`Model name was not properly extracted (got "${model}").`);
    }

    if (!tokenUsage || tokenUsage.total <= 0) {
      throw new Error('Token usage was not extracted from trajectory.');
    }
    console.log('✅ Success: Trajectory model and token usage extracted accurately.');
  } finally {
    // Cleanup. Must not be bypassed by process.exit(), so callers handle exit codes.
    console.log(`🧹 Cleaning up: ${tempProjectDir}`);
    fs.rmSync(tempProjectDir, { recursive: true, force: true });
  }
}

if (import.meta.url.startsWith('file:') && process.argv[1] === fileURLToPath(import.meta.url)) {
  // Parse command line args: node quick-smoke.ts [agent] [guided|unguided]
  const args = process.argv.slice(2);
  const agent = args[0];
  const runType = args[1] as RunType | undefined;

  runSmokeTest({ agent, runType })
    .then(() => process.exit(0))
    .catch((err: unknown) => {
      console.error(`❌ ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    });
}
