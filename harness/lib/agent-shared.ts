import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

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
 * Updates the MCP configuration file to enable MCP servers.
 * 
 * @param configPath Full path to the MCP configuration file
 * @param serversToEnable List of enabled MCP server names
 * @param modernWebServerPath Path to the Modern Web MCP server
 * @param apiKey The API key for the MCP server
 * @param agent The agent type
 * @returns True if the config was written successfully, false otherwise.
 */
export function updateMcpConfig(
  configPath: string,
  serversToEnable: string[],
  modernWebServerPath: string,
  apiKey: string,
  agent: string
): boolean {
  const mcpConfig: { mcpServers: Record<string, any> } = { mcpServers: {} };

  for (const serverName of serversToEnable) {
    if (serverName === 'modern-web') {
      if (!modernWebServerPath || !fs.existsSync(modernWebServerPath)) {
        throw new Error(`Example MCP server path not found: ${modernWebServerPath}`);
      }
      mcpConfig.mcpServers['modern-web'] = {
        command: 'node',
        args: [modernWebServerPath]
      };
    } else if (serverName === 'google-developer-knowledge-mcp') {
      if (!apiKey) {
        throw new Error('MCP_API_KEY is required for google-developer-knowledge-mcp but was not provided.');
      }
      const url = 'https://developerknowledge.googleapis.com/mcp';

      // Jetski requires 'serverUrl' for the urlKey header
      const urlKey = agent === 'jetski' ? 'serverUrl' : 'url';

      mcpConfig.mcpServers['google-developer-knowledge-mcp'] = {
        [urlKey]: url,
        headers: {
          'X-Goog-Api-Key': apiKey
        }
      };
    } else {
      console.warn(`Warning: Unknown MCP server name '${serverName}' in config. Skipping.`);
    }
  }

  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    console.log(`Enabled MCP servers in ${configPath}: ${Object.keys(mcpConfig.mcpServers).join(', ')}`);
    return true;
  } catch (e) {
    console.error(`Failed to write MCP config to ${configPath}:`, e);
    return false;
  }
}

export function copyGeminiContext(projectRoot: string, homeDir: string): boolean {
  const geminiMdSource = path.join(projectRoot, 'harness', 'GEMINI.md');
  const geminiDir = path.join(homeDir, '.gemini');
  const geminiMdDest = path.join(geminiDir, 'GEMINI.md');

  if (!fs.existsSync(geminiMdSource)) {
    console.warn(`Warning: GEMINI.md not found at ${geminiMdSource}`);
    return false;
  }

  try {
    if (!fs.existsSync(geminiDir)) {
      fs.mkdirSync(geminiDir, { recursive: true });
    }
    fs.copyFileSync(geminiMdSource, geminiMdDest);
    console.log(`Copied GEMINI.md to ${geminiMdDest}`);
    return true;
  } catch (e: any) {
    console.warn(`Warning: Failed to copy GEMINI.md: ${e.message}`);
    return false;
  }
}

/**
 * Sleeps for the specified number of milliseconds.
 * @param ms Number of milliseconds to sleep
 */
export async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Kills any process running on the specified port.
 * @param port The port number to check and kill processes on
 */
export function killProcessOnPort(port: number | string): void {
  try {
    const pid = execSync(`lsof -t -i :${port}`).toString().trim();
    if (pid) {
      console.log(`Killing process ${pid} on port ${port}...`);
      execSync(`kill -9 ${pid}`);
    }
  } catch {
    // Ignore error if no process found (grep/lsof returns exit code 1 if empty)
  }
}

export interface AgentArgs {
  userPrompt: string;
  runType: string; // 'guided' or 'unguided'
  absoluteTargetDir: string;
  projectRoot: string;
}

/**
 * Parses command line arguments for agents.
 * Usage: node <agent-script> <directory> <prompt> [runType]
 * 
 * @param scriptName Name of the script for usage message
 * @returns Parsed arguments
 */
export function parseAgentArgs(scriptName: string): AgentArgs {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error(`Usage: node ${scriptName} <directory> <prompt> [runType]`);
    process.exit(1);
  }
  const [targetDirectory, userPrompt, runType] = args;
  const absoluteTargetDir = path.resolve(targetDirectory);
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '../..');

  return {
    userPrompt,
    runType,
    absoluteTargetDir,
    projectRoot
  };
}
