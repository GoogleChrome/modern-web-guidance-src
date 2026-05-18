import path from 'path';
import os from 'os';
import fs from 'fs';
import { pathToFileURL } from 'url';
import { rootDir, harnessDir } from '../lib/paths.ts';

// Disable telemetry globally for all evaluation and test harness runs
process.env.DISABLE_TELEMETRY = '1';

try {
  process.loadEnvFile(path.join(rootDir, '.env'));
} catch {
  // Ignore if missing
}

export const Agents = {
  JETSKI: 'jetski',
  JETSKI_CLI: 'jetski_cli',
  GEMINI_CLI: 'gemini_cli',
  CLAUDE_CODE: 'claude_code',
  CODEX_CLI: 'codex_cli'
} as const;

export const Serving = {
  SKILLS_CLI: 'skills_cli',
  SKILLS: 'skills',
  MCP: 'mcp',
  MEGASKILL: 'megaskill'
} as const;

export type Serving = typeof Serving[keyof typeof Serving];

// ******************************************
// *** Set environment configuration      ***
// *** Set env variables in modern-web-guidance-src/.env ***
// ******************************************
export const environmentConfig: EnvironmentConfig = {
  // Jetski Configuration
  jetskiDir: process.env.JETSKI_DIR || path.join(os.homedir(), '.gemini/jetski'),
  jetskiBin: process.env.JETSKI_BIN || '/Applications/Jetski.app/Contents/Resources/app/bin/jetski',
  jetskiCliBin: process.env.JETSKI_CLI_BIN || '/google/bin/releases/jetski-devs/tools/cli',
  jetskiDebugPort: parseInt(process.env.JETSKI_DEBUG_PORT || '9226'),
  jetskiProfileDir: process.env.JETSKI_PROFILE_DIR || path.join(os.homedir(), '.gemini/jetski-profile'),

  // Gemini CLI Configuration
  geminiCliBin: process.env.GEMINI_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/gemini'),
  geminiDir: process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini'),

  // Claude Code Configuration (through GCP Vertex AI)
  claudeCodeCliBin: process.env.CLAUDE_CODE_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/claude'),
  gcpCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(os.homedir(), '.config/gcloud/application_default_credentials.json'),

  // Codex Configuration
  codexCliBin: process.env.CODEX_CLI_BIN || path.join(harnessDir, 'node_modules/.bin/codex'),

  // MCP Server Configuration
  modernWebServerPath: path.join(rootDir, 'serving/mcp-server/index.ts'), // For modern-web-guidance MCP server
  mcpApiKey: process.env.MCP_API_KEY || '', // For google-developer-knowledge MCP server
};

export const defaultSuiteConfig: SuiteConfig = {
  name: null,
  numRuns: 1,
  tasks: [], // Empty = discover all tasks in harness/tasks/. Set explicitly to run a subset.
  mcpServersToEnable: ['modern-web-guidance'],
  skillsToEnable: ['modern-web-guidance'],
  serving: Serving.SKILLS_CLI,
  agent: Agents.GEMINI_CLI,
  workerCount: undefined,
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
  jetskiDir: string;
  jetskiBin: string;
  jetskiCliBin: string;
  jetskiDebugPort: number;
  jetskiProfileDir: string;
  geminiCliBin: string;
  geminiDir: string;
  claudeCodeCliBin: string;
  codexCliBin: string;
  gcpCredentials: string;
  modernWebServerPath: string;
  mcpApiKey: string;
}

export interface SuiteConfig {
  name: string | null;
  numRuns: number;
  tasks: string[];
  mcpServersToEnable: string[];
  skillsToEnable: string[];
  serving: Serving;
  agent: string;
  workerCount?: number;
}

export const config = {
  environment: environmentConfig,
};

// Validate critical paths exist during configuration
const criticalPaths = {
  'Jetski binary': config.environment.jetskiBin,
  'Jetski directory': config.environment.jetskiDir,
};

function validatePaths() {
  const warnings = [];

  for (const [name, dirPath] of Object.entries(criticalPaths)) {
    if (!fs.existsSync(dirPath as string)) {
      warnings.push(`⚠️  ${name} not found: ${dirPath}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach(w => console.warn(w));
    console.warn('\nPlease check your .env file or set the appropriate environment variables.\n');
  }
}

export default {
  ...config,
  validatePaths
};
