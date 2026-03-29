import path from 'path';
import os from 'os';
import fs from 'fs';
import "dotenv/config";

import { rootDir, harnessDir } from '../lib/paths.ts';

// Explicitly load .env from the project root
import dotenv from 'dotenv';
dotenv.config({ path: path.join(rootDir, '.env') });

export const Agents = {
  JETSKI: 'jetski',
  GEMINI_CLI: 'gemini_cli',
  CLAUDE_CODE: 'claude_code',
  CODEX_CLI: 'codex_cli'
} as const;

export const Serving = {
  SKILLS_CLI: 'skills_cli',
  SKILLS: 'skills',
  MCP: 'mcp'
} as const;

export type Serving = typeof Serving[keyof typeof Serving];

// ******************************************
// *** Set environment configuration      ***
// *** Set env variables in guidance/.env ***
// ******************************************
export const environmentConfig: EnvironmentConfig = {
  // Jetski Configuration
  jetskiDir: process.env.JETSKI_DIR || path.join(os.homedir(), '.gemini/jetski'),
  jetskiBin: process.env.JETSKI_BIN || '/Applications/Jetski.app/Contents/Resources/app/bin/jetski',
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
  modernWebServerPath: path.join(rootDir, 'serving/mcp-server/index.ts'), // For modern-web MCP server
  mcpApiKey: process.env.MCP_API_KEY || '', // For google-developer-knowledge MCP server
};

export const suiteConfig: SuiteConfig = {
  name: `full-${new Date().toLocaleString('sv-SE', { timeZone: 'America/Los_Angeles' }).replace(' ', 'T').replace(/:/g, '-')}`,
  numRuns: 1,
  tasks: [], // Empty = discover all tasks in harness/tasks/. Set explicitly to run a subset.
  mcpServersToEnable: [], // Available servers: 'modern-web', 'google-developer-knowledge'
  serving: Serving.SKILLS_CLI,
  agent: Agents.GEMINI_CLI,
  negative: false, // When `true`, runs the suite on all tasks in `tasks/negative/`
};

export interface EnvironmentConfig {
  jetskiDir: string;
  jetskiBin: string;
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
  serving: Serving;
  agent: string;
  negative: boolean;
}

export const config = {
  environment: environmentConfig,
  suite: suiteConfig,
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
