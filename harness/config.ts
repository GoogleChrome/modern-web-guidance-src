import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';
import { rootDir, harnessDir } from '../lib/paths.ts';

// Disable telemetry for in-process harness code and direct child processes.
// Note: Agent CLIs execute tool calls in isolated subshells that don't inherit this env,
// so telemetry is also explicitly disabled in harness/npx-intercept.template.ts.
process.env.DISABLE_TELEMETRY = '1';

try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  // Ignore if missing
}

export const Agents = {
  JETSKI_CLI: 'jetski_cli',
  GEMINI_CLI: 'gemini_cli',
  CLAUDE_CODE: 'claude_code',
  CODEX_CLI: 'codex_cli',
  PI: 'pi'
} as const;

export type Agents = typeof Agents[keyof typeof Agents];

// ******************************************
// *** Set environment configuration      ***
// *** Set env variables in modern-web-guidance-src/.env ***
// ******************************************
export const environmentConfig: EnvironmentConfig = {
  // Jetski CLI Configuration
  jetskiCliBin: process.env.JETSKI_CLI_BIN || '/google/bin/releases/jetski-devs/tools/cli',

  // Gemini CLI Configuration
  geminiCliBin: process.env.GEMINI_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/gemini'),
  geminiDir: process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini'),

  // Claude Code Configuration (through GCP Vertex AI)
  claudeCodeCliBin: process.env.CLAUDE_CODE_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/claude'),
  gcpCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(os.homedir(), '.config/gcloud/application_default_credentials.json'),

  // Codex Configuration
  codexCliBin: process.env.CODEX_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/codex'),

  // Pi Configuration
  piBin: process.env.PI_BIN || 'pi',
};

export const defaultSuiteConfig: SuiteConfig = {
  name: null,
  numRuns: 1,
  tasks: [], // Empty = discover all tasks in harness/tasks/. Set explicitly to run a subset.
  skillsToEnable: ['modern-web-guidance'],
  agent: Agents.GEMINI_CLI,
  workerCount: undefined,
  includeTrace: false,
};

export function mergeSuiteConfig(overrides: Partial<SuiteConfig>): SuiteConfig {
  return { ...defaultSuiteConfig, ...overrides };
}

export async function resolveSuiteConfig(configPath?: string): Promise<SuiteConfig> {
  const resolvedConfigPath = configPath
    ? path.resolve(process.cwd(), configPath)
    : path.resolve(rootDir, 'config.ts');

  let overrides: any = {};
  try {
    const fileUrl = pathToFileURL(resolvedConfigPath).href;
    const customConfig = await import(fileUrl);
    overrides = customConfig.default || customConfig;
  } catch (err: any) {
    if (err.code === 'ERR_MODULE_NOT_FOUND') {
      if (configPath) {
        console.error(`⚠️ Specified config file not found: ${resolvedConfigPath}`);
        process.exit(1);
      }
    } else {
      throw err;
    }
  }

  return mergeSuiteConfig(overrides);
}

export interface EnvironmentConfig {
  jetskiCliBin: string;
  geminiCliBin: string;
  geminiDir: string;
  claudeCodeCliBin: string;
  codexCliBin: string;
  piBin: string;
  gcpCredentials: string;
}

export interface SuiteConfig {
  name: string | null;
  numRuns: number;
  tasks: string[];
  skillsToEnable: string[];
  agent: string;
  workerCount?: number;
  includeTrace?: boolean;
}

export const config = {
  environment: environmentConfig,
};

export default config;
