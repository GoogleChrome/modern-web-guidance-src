const path = require('path');
const os = require('os');

/**
 * Configuration module that loads settings from environment variables
 * with sensible defaults. This allows the project to work on different
 * machines without requiring hardcoded paths.
 */

// Load .env file if it exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv is optional - continue if not installed
}

const config = {
  // Jetski Configuration
  jetskiDir: process.env.JETSKI_DIR || path.join(os.homedir(), '.gemini/jetski'),
  jetskiBin: process.env.JETSKI_BIN || '/Applications/Jetski.app/Contents/Resources/app/bin/jetski',
  jetskiDebugPort: parseInt(process.env.JETSKI_DEBUG_PORT) || 9222,

  // MCP Server Configuration
  mcpServerPath: process.env.MCP_SERVER_PATH || path.join(os.homedir(), 'git/modern-web-mcp/build/index.js'),
};

// Validate critical paths exist during configuration
const criticalPaths = {
  'Jetski binary': config.jetskiBin,
  'Jetski directory': config.jetskiDir,
};

function validatePaths() {
  const fs = require('fs');
  const warnings = [];

  for (const [name, dirPath] of Object.entries(criticalPaths)) {
    if (!fs.existsSync(dirPath)) {
      warnings.push(`⚠️  ${name} not found: ${dirPath}`);
    }
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Configuration Warnings:');
    warnings.forEach(w => console.warn(w));
    console.warn('\nPlease check your .env file or set the appropriate environment variables.\n');
  }
}

module.exports = {
  ...config,
  validatePaths
};
