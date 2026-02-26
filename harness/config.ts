import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Explicitly load .env from the project root
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../.env') });

export const Agents = {
  JETSKI: 'jetski',
  GEMINI_CLI: 'gemini_cli',
  CLAUDE_CODE: 'claude_code'
} as const;

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
  geminiCliBin: process.env.GEMINI_CLI_BIN || path.join(__dirname, 'node_modules/.bin/gemini'),
  geminiDir: process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini'),

  // Claude Code Configuration (through GCP Vertex AI)
  claudeCodeCliBin: process.env.CLAUDE_CODE_CLI_BIN || path.join(__dirname, 'node_modules/.bin/claude'),
  gcpCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(os.homedir(), '.config/gcloud/application_default_credentials.json'),

  // MCP Server Configuration
  modernWebServerPath: path.join(__dirname, '../serving/mcp-server/index.ts'), // For modern-web MCP server
  mcpApiKey: process.env.MCP_API_KEY || '', // For google-developer-knowledge MCP server
};

// *******************************
// *** Set suite configuration ***
// *** Run with: `pnpm suite`  ***
// *******************************
export const suiteConfig: SuiteConfig = {
  name: 'good-effort1',
  numRuns: 1,
  tasks: ['cards-render'],
  mcpServersToEnable: ['modern-web'], // Available servers: 'modern-web', 'google-developer-knowledge'
  enableSkills: false,
  agent: Agents.GEMINI_CLI,
};

// ************************************
// *** Set evaluation configuration ***
// *** Run with: `pnpm report`      ***
// ************************************
export const evalConfig: EvalConfig = {
  suiteName: 'good-effort1'
};

export interface EnvironmentConfig {
  jetskiDir: string;
  jetskiBin: string;
  jetskiDebugPort: number;
  jetskiProfileDir: string;
  geminiCliBin: string;
  geminiDir: string;
  claudeCodeCliBin: string;
  gcpCredentials: string;
  modernWebServerPath: string;
  mcpApiKey: string;
}

export interface SuiteConfig {
  name: string | null;
  numRuns: number;
  tasks: string[];
  mcpServersToEnable: string[];
  enableSkills: boolean;
  agent: string;
}

export interface EvalConfig {
  suiteName: string | null;
}

export const config = {
  environment: environmentConfig,
  suite: suiteConfig,
  eval: evalConfig,
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
