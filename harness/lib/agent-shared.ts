import fs from 'fs';
import path from 'path';

/**
 * Creates a unique isolated HOME directory in /tmp.
 * @param prefix The prefix for the directory name
 * @returns The path to the created directory.
 */
export function createIsolatedHome(prefix: string): string {
  // Use /tmp/ deliberately because os.tmpdir() on macOS can return paths that are 
  // too long for valid Unix socket paths, which causes issues for some JetSki/VS Code components.
  const tempHome = `/tmp/${prefix}-${Math.random().toString(36).substring(7)}`;
  fs.mkdirSync(tempHome, { recursive: true });
  console.log(`Setting up isolated HOME at ${tempHome}...`);
  return tempHome;
}

/**
 * Clean up the isolated HOME directory.
 * @param homeDir Path to the directory to remove.
 */
export function cleanupIsolatedHome(homeDir: string): void {
  if (homeDir && fs.existsSync(homeDir)) {
    console.log(`\n=== Cleaning up isolated HOME ===`);
    try {
      fs.rmSync(homeDir, { recursive: true, force: true });
      console.log('✅ Cleanup successful');
    } catch (cleanupErr) {
      console.error('Failed to cleanup isolated HOME:', cleanupErr);
    }
  }
}

/**
 * Helper to copy a file if it exists.
 * @param src Source path
 * @param dest Destination path
 */
export function copyFileIfExists(src: string, dest: string): void {
  if (fs.existsSync(src)) {
    try {
      fs.copyFileSync(src, dest);
    } catch (e) {
      console.warn(`Warning: Failed to copy ${src} to ${dest}:`, e);
    }
  }
}

/**
 * Creates a trustedFolders.json file to avoid "untrusted folder" errors.
 * @param contentsDir Directory to write the trustedFolders.json file to (e.g. .gemini or within .gemini/jetski)
 * @param folders List of absolute paths to trust
 */
export function createTrustedFolders(contentsDir: string, folders: string[]): void {
  const trustedFolders: Record<string, string> = {};
  for (const folder of folders) {
    trustedFolders[folder] = "TRUST_FOLDER";
  }

  try {
    fs.mkdirSync(contentsDir, { recursive: true });
    fs.writeFileSync(
      path.join(contentsDir, 'trustedFolders.json'),
      JSON.stringify(trustedFolders, null, 2)
    );
    console.log(`Created trustedFolders.json in ${contentsDir}`);
  } catch (e) {
    console.error('Failed to create trustedFolders.json:', e);
  }
}

/**
 * Updates the MCP configuration file to enable or disable the Google Developer Knowledge MCP server.
 * @param configFullPath Full path to the MCP configuration file
 * @param runType 'guided' or 'unguided'
 * @param apiKey The API key for the MCP server
 */
export function updateMcpConfig(configFullPath: string, runType: string, apiKey: string, agent: string): void {
  let mcpConfig: { mcpServers?: Record<string, any> } = { mcpServers: {} };

  try {
    if (fs.existsSync(configFullPath)) {
      const content = fs.readFileSync(configFullPath, 'utf8');
      if (content.trim()) {
        mcpConfig = JSON.parse(content);
      }
    }
  } catch (e) {
    console.error(`Failed to read MCP config at ${configFullPath}:`, e);
  }

  if (!mcpConfig.mcpServers) mcpConfig.mcpServers = {};

  const serverName = 'google-developer-knowledge-mcp';
  // Note: 'guided' enables the server, anything else (like 'unguided') disables it.
  if (runType === 'guided') {
    if (agent === 'gemini_cli') {
      mcpConfig.mcpServers[serverName] = {
        "url": "https://developerknowledge.googleapis.com/mcp",
        "headers": {
          "X-Goog-Api-Key": apiKey
        }
      };
    } else if (agent === 'jetski') {
      mcpConfig.mcpServers[serverName] = {
        "serverUrl": "https://developerknowledge.googleapis.com/mcp",
        "headers": {
          "X-Goog-Api-Key": apiKey
        }
      };
    }
    console.log(`Enabled ${serverName} MCP server in ${configFullPath}`);
  } else {
    // For unguided runs (or any other type), clear all MCP servers to ensure a clean slate.
    mcpConfig.mcpServers = {};
    console.log(`Cleared all MCP servers in ${configFullPath} (runType: ${runType})`);
  }

  try {
    fs.writeFileSync(configFullPath, JSON.stringify(mcpConfig, null, 2));
  } catch (e) {
    console.error(`Failed to write MCP config to ${configFullPath}:`, e);
  }
}

export function copyGeminiContext(projectRoot: string, targetDir: string): void {
  const geminiMdSource = path.join(projectRoot, 'harness', 'GEMINI.md');
  const agentDir = path.join(targetDir, '.agent');
  const geminiMdDest = path.join(agentDir, 'GEMINI.md');

  if (fs.existsSync(geminiMdSource)) {
    try {
      if (!fs.existsSync(agentDir)) {
        fs.mkdirSync(agentDir, { recursive: true });
      }
      fs.copyFileSync(geminiMdSource, geminiMdDest);
      console.log(`Copied GEMINI.md to ${geminiMdDest}`);
    } catch (e: any) {
      console.warn(`Warning: Failed to copy GEMINI.md: ${e.message}`);
    }
  } else {
    console.warn(`Warning: GEMINI.md not found at ${geminiMdSource}`);
  }
}
