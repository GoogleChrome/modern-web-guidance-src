import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Configuration module that loads settings from environment variables
 * with sensible defaults. This allows the project to work on different
 * machines without requiring hardcoded paths.
 */

interface Config {
  jetskiDir: string;
  jetskiBin: string;
  jetskiDebugPort: number;
  jetskiProfileDir: string;
  geminiCliBin: string;
  geminiDir: string;
  mcpServerPath: string;
  mcpApiKey: string;
  numRuns: number;
  scenarios: string[];
  promptTypes: string[];
}

const config: Config = {
  // Jetski Configuration
  jetskiDir: process.env.JETSKI_DIR || path.join(os.homedir(), '.gemini/jetski'),
  jetskiBin: process.env.JETSKI_BIN || '/Applications/Jetski.app/Contents/Resources/app/bin/jetski',
  jetskiDebugPort: parseInt(process.env.JETSKI_DEBUG_PORT || '9226'),
  jetskiProfileDir: process.env.JETSKI_PROFILE_DIR || path.join(os.homedir(), '.gemini/jetski-profile'),

  // Gemini CLI Configuration
  geminiCliBin: process.env.GEMINI_CLI_BIN || 'gemini',
  geminiDir: process.env.GEMINI_DIR || path.join(os.homedir(), '.gemini'),

  // MCP Server Configuration
  mcpServerPath: path.join(__dirname, '../serving/mcp-server/index.ts'),
  mcpApiKey: process.env.MCP_API_KEY || '',

  // Suite Configuration
  numRuns: 3,
  scenarios: ['brownfield', 'greenfield', 'redfield'],
  promptTypes: ['specific', 'vague'],
};

// Validate critical paths exist during configuration
const criticalPaths = {
  'Jetski binary': config.jetskiBin,
  'Jetski directory': config.jetskiDir,
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

export { config };
