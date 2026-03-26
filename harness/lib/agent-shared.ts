import fs from 'fs';
import path from 'path';
import { execSync, spawn, type SpawnOptions } from 'child_process';
import { Agents } from '../config.ts';
import { classifyGuide, scanAllGuides } from './utils.ts';
import { rootDir, guidesDir } from '../../lib/paths.ts';

/**
 * Promisified version of child_process.spawn.
 */
export function spawnAsync(command: string, args: string[], options: SpawnOptions = {}): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    child.on('close', (code) => resolve(code ?? 1));
    child.on('error', reject);
  });
}

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
    console.log(`\nCleaning up isolated HOME.`);
    try {
      fs.rmSync(homeDir, { recursive: true, force: true });
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
 * @param contentsDir Directory to write the trustedFolders.json file to (e.g. .gemini or .gemini/jetski)
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
    } else if (serverName === 'google-developer-knowledge') {
      if (!apiKey) {
        throw new Error('MCP_API_KEY is required for google-developer-knowledge but was not provided.');
      }
      const url = 'https://developerknowledge.googleapis.com/mcp';

      if (agent === 'jetski') {
        mcpConfig.mcpServers['google-developer-knowledge'] = {
          serverUrl: url,
          headers: {
            'X-Goog-Api-Key': apiKey
          }
        };
      } else if (agent === 'claude_code') {
        mcpConfig.mcpServers['google-developer-knowledge'] = {
          type: 'http',
          url: url,
          headers: {
            'X-Goog-Api-Key': apiKey
          }
        };
      } else { // Gemini CLI
        mcpConfig.mcpServers['google-developer-knowledge'] = {
          httpUrl: url,
          headers: {
            'X-Goog-Api-Key': apiKey
          }
        };
      }
    } else {
      console.warn(`Warning: Unknown MCP server name '${serverName}' in config. Skipping.`);
    }
  }

  try {
    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    if (agent === Agents.CODEX_CLI) {
      let tomlContent = '';
      for (const [serverName, serverConfig] of Object.entries(mcpConfig.mcpServers)) {
        tomlContent += `[mcp_servers.${serverName}]\n`;
        for (const [key, value] of Object.entries(serverConfig as Record<string, any>)) {
          if (Array.isArray(value)) {
            tomlContent += `${key} = [${value.map((v: any) => `"${v}"`).join(', ')}]\n`;
          } else {
            tomlContent += `${key} = "${value}"\n`;
          }
        }
        tomlContent += '\n';
      }
      fs.writeFileSync(configPath, tomlContent);
    } else {
      fs.writeFileSync(configPath, JSON.stringify(mcpConfig, null, 2));
    }
    if (serversToEnable.length > 0) {
      console.log(`Added MCP server config(s) to ${configPath}: ${Object.keys(mcpConfig.mcpServers).join(', ')}`);
    } else {
      console.log(`No MCP servers enabled in ${configPath}`);
    }
    return true;
  } catch (e) {
    console.error(`Failed to write MCP config to ${configPath}:`, e);
    return false;
  }
}

/**
 * Copies the guides directory to the isolated home directory for the agent.
 * Copies SKILL.md for categories and guide.md for "ready" guides.
 * @param homeDir Path to the isolated home directory
 * @param agent The agent type
 * @returns True if successful, false otherwise
 */
export function copySkills(homeDir: string, agent: string, cli: boolean): boolean {
  const guidesSource = guidesDir;

  let destDir = '';
  if (agent === Agents.CLAUDE_CODE) {
    destDir = path.join(homeDir, '.claude', 'skills');
  } else if (agent === Agents.CODEX_CLI) {
    destDir = path.join(homeDir, '.agents', 'skills');
  } else if (agent === Agents.JETSKI) {
    destDir = path.join(homeDir, '.gemini', 'jetski', 'skills');
  } else {
    destDir = path.join(homeDir, '.gemini', 'skills');
  }

  try {
    fs.mkdirSync(destDir, { recursive: true });

    if (cli) { // Skills-cli mode
      const distSource = path.join(rootDir, 'dist/skills-cli/skills/modern-web-use-cases');
      if (!fs.existsSync(distSource)) {
        console.log(`skills-cli distribution not found at ${distSource}. Running 'pnpm --filter modern-web-mcp build-dist' automatically...`);
        try {
          execSync('pnpm --filter modern-web-mcp build-dist', {
            cwd: rootDir,
            stdio: 'inherit'
          });
          console.log("Distribution generated successfully.");
        } catch (e: any) {
          console.error(`Failed to auto-generate skills-cli distribution: ${e.message}`);
          return false;
        }
      }

      try {
        const destSkillDir = path.join(destDir, 'modern-web-use-cases');
        fs.mkdirSync(destSkillDir, { recursive: true });

        if (fs.existsSync(distSource)) {
          // Clear dest first to ensure clean state
          if (fs.existsSync(destSkillDir)) {
            fs.rmSync(destSkillDir, { recursive: true, force: true });
            fs.mkdirSync(destSkillDir, { recursive: true });
          }
          fs.cpSync(distSource, destSkillDir, { recursive: true });
        } else {
          console.error(`Standalone skills-cli distribution still not found after generation run!`);
          return false;
        }
      } catch (e: any) {
        console.error(`Failed to copy standalone skills-cli: ${e.message}`);
        return false;
      }
    } else { // Skills-discipline mode
      if (!fs.existsSync(guidesSource)) {
        console.warn(`Warning: Guides directory not found at ${guidesSource}`);
        return false;
      }

      // 1. Scan top-level directories for SKILL.md and copy them
      const topLevelDirs = fs.readdirSync(guidesSource, { withFileTypes: true })
        .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules');

      for (const dir of topLevelDirs) {
        const categorySrc = path.join(guidesSource, dir.name);
        const categoryDest = path.join(destDir, dir.name);
        const skillPath = path.join(categorySrc, 'SKILL.md');

        if (fs.existsSync(skillPath)) {
          fs.mkdirSync(categoryDest, { recursive: true });
          fs.copyFileSync(skillPath, path.join(categoryDest, 'SKILL.md'));
        }
      }

      // 2. Scan and copy guide.md for eval-ready guides
      const allGuides = scanAllGuides();

      for (const inv of allGuides) {
        if (classifyGuide(inv) === 'eval-ready') {
          const catDest = path.join(destDir, inv.category);
          const guideDest = path.join(catDest, inv.name);
          fs.mkdirSync(guideDest, { recursive: true });

          const guideFileSrc = path.join(inv.dir, 'guide.md');
          const guideFileDest = path.join(guideDest, 'guide.md');
          fs.copyFileSync(guideFileSrc, guideFileDest);
        }
      }
    }

    console.log(`Copied Skills to ${destDir}`);
    return true;
  } catch (e: any) {
    console.error(`Failed to copy guides: ${e.message}`);
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
  runType: string;
  targetDir: string;
  templateDir: string;
}

/**
 * Parses command line arguments for agents.
 * Usage: node <agent-script> <prompt> <runType> <targetDir> <templateDir>
 * 
 * @param scriptName Name of the script for usage message
 * @returns Parsed arguments
 */
export function parseAgentArgs(scriptName: string): AgentArgs {
  const args = process.argv.slice(2);
  if (args.length < 4) {
    // Single task scenario (no template directory is passed)
    if (args.length === 3) {
      args.push('');
    } else {
      console.error(`Usage: node ${scriptName} <prompt> <runType> <targetDir> <templateDir>`);
      process.exit(1);
    }
  }
  const [userPrompt, runType, targetDirectoryRaw, templateDirRaw] = args;
  const targetDir = path.resolve(targetDirectoryRaw);
  let templateDir = '';
  if (templateDirRaw !== '') {
    templateDir = path.resolve(templateDirRaw);
  }

  return {
    userPrompt,
    runType,
    targetDir,
    templateDir
  };
}

/**
 * Creates the working directory for the agent.
 * @param templateDir Path to the template directory
 * @param homeDir Path to the isolated home directory
 * @param runType The type of run
 * @returns The path to the working directory within the isolated home
 */
export function createWorkDir(templateDir: string, homeDir: string, runType: string): string {
  // For the single task run, there is no template
  // Create the empty work dir with the runType as the directory name
  if (templateDir === '') {
    const workDir = path.join(homeDir, runType);
    fs.mkdirSync(workDir, { recursive: true });
    return workDir;
  }
  // For the suite run, copy the template directory to the isolated home directory, following symlinks
  execSync(`cp -RL "${templateDir}" "${homeDir}/"`);
  console.log(`Copied ${templateDir} to ${homeDir}...`);
  return path.join(homeDir, path.basename(templateDir));
}

/**
 * Copies results from the working directory to the target directory.
 * @param workDir The working directory where execution happened
 * @param targetDir The target directory to copy results to
 * @param subPath Optional sub-path within workDir to copy from (e.g. if you only want specific files)
 */
export function copyResultsToTarget(workDir: string, targetDir: string, subPath: string = '.'): void {
  const sourceDir = path.join(workDir, subPath);
  execSync(`cp -R "${sourceDir}/." "${targetDir}/"`);
  console.log(`Copied results from ${sourceDir} to: ${targetDir}`);
}

/**
 * Watches a log file and prints new lines to stdout.
 * @param logPath The path to the log file
 * @returns A function to stop watching
 */
export function watchLogFile(logPath: string): () => void {
  let prevData = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  const interval = setInterval(() => {
    if (!fs.existsSync(logPath)) return;
    try {
      const currentData = fs.readFileSync(logPath, 'utf8');
      if (currentData.length > prevData.length) {
        const newLogs = currentData.slice(prevData.length).trim();
        if (newLogs) {
          const formattedLogs = newLogs.split('\n').map(line => `\x1b[33m[Modern Web Log]:\x1b[0m ${line}`).join('\n');
          console.log(formattedLogs);
        }
        prevData = currentData;
      }
    } catch (e) {
      console.error('Failed to read log file:', e);
    }
  }, 500);
  return () => clearInterval(interval);
}

const DEFAULT_PROD_BASE = 'https://trajectory-dev.corp.goog/';

/**
 * Finds trajectory files, copies them to the target directory, and generates HTML exports.
 * @param sourceDir Directory to search for trajectory files
 * @param pattern Glob pattern for trajectory files (relative to sourceDir)
 * @param targetDir Directory to copy files and HTML exports to
 */
export function exportTrajectories(sourceDir: string, pattern: string, targetDir: string): void {
  if (!fs.existsSync(sourceDir)) return;

  // fs.globSync is available in Node 22+
  const files = fs.globSync(pattern, { cwd: sourceDir });
  
  for (const relativeSrc of files as string[]) {
    const srcFile = path.join(sourceDir, relativeSrc);
    const fileName = path.basename(srcFile);
    const destFile = path.join(targetDir, fileName);
    
    try {
      fs.copyFileSync(srcFile, destFile);
      console.log(`Copied trajectory: ${fileName} to ${targetDir}`);

      const trajectoryId = fileName.replace(/\.(json|pb)$/, '');
      const fileBuffer = fs.readFileSync(srcFile);
      const htmlContent = generateExportHtml(new Uint8Array(fileBuffer), fileName);
      const htmlFileName = trajectoryId.startsWith('session-') ? `${trajectoryId}.html` : `session-${trajectoryId}.html`;
      const htmlDest = path.join(targetDir, htmlFileName);
      fs.writeFileSync(htmlDest, htmlContent, 'utf8');
      console.log(`Generated HTML export: ${htmlFileName}`);
    } catch (e) {
      console.error(`Failed to export trajectory ${fileName}:`, e);
    }
  }
}

/**
 * Runs a CLI agent command, capturing output to the terminal and to log files.
 * @param command The binary to run
 * @param commandArgs The arguments
 * @param workDir The working directory
 * @param targetDir The target directory for logs and results
 * @param agentName Name of the agent (for error messages)
 */
export async function runCliAgentCommand(
  command: string,
  commandArgs: string[],
  workDir: string,
  targetDir: string,
  agentName: string
): Promise<void> {
  const child = spawn(command, commandArgs, {
    cwd: workDir,
    env: { ...process.env }, // Pass through environment variables (including new HOME)
    stdio: ['ignore', 'pipe', 'pipe'] // 'pipe' captures output for log files but does NOT print to terminal natively
  });

  let stdoutData = '';
  let stderrData = '';

  child.stdout?.on('data', (data) => {
    const chunk = data.toString();
    stdoutData += chunk;
    // Manually mirror to console so we can see progress while capturing
    process.stdout.write(chunk);
  });

  child.stderr?.on('data', (data) => {
    const chunk = data.toString();
    stderrData += chunk;
    // Manually mirror to console so we can see progress while capturing
    process.stderr.write(chunk);
  });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`${agentName} exited with code ${exitCode}`);
  }

  copyResultsToTarget(workDir, targetDir);

  // Save output to chat_log.txt
  const chatLogPath = path.join(targetDir, 'chat_log.txt');
  fs.writeFileSync(chatLogPath, stdoutData, 'utf8');
  console.log(`Saved output to: ${chatLogPath}`);

  // Save stderr to agent_stderr.log to surface unexpected problems
  if (stderrData.length > 0) {
    const stderrLogPath = path.join(targetDir, 'agent_stderr.log');
    fs.writeFileSync(stderrLogPath, stderrData, 'utf8');
    console.log(`Saved stderr to: ${stderrLogPath}`);
  }
}

/**
 * Generates an HTML file that can load and display a trajectory file (JSON/PB) 
 * by embedding it as base64 and posting it to the trajectory viewer iframe.
 * @param fileBuffer Binary content of the trajectory file
 * @param fileName Name of the trajectory file
 * @param prodBase Base URL of the trajectory viewer
 * @returns HTML content
 */
export function generateExportHtml(fileBuffer: Uint8Array, fileName: string, prodBase = DEFAULT_PROD_BASE): string {
    const trajectoryId = fileName.replace(/\.(json|pb)$/, '');
    const title = `Trajectory - ${trajectoryId}`;

    // Node.js environment: Buffer is faster than manual conversion
    const base64String = Buffer.from(fileBuffer).toString('base64');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta content="width=device-width, initial-scale=1.0" name="viewport">
    <title>${title}</title>
    <style>
        body, html { margin: 0; padding: 0; height: 100vh; overflow: hidden; background: #0f172a; font-family: sans-serif; }
        iframe { border: none; width: 100%; height: 100%; display: none; }
        .loading {
            display: flex; align-items: center; justify-content: center; height: 100%; color: #94a3b8;
            flex-direction: column; gap: 1rem;
        }
        .spinner {
            width: 40px; height: 40px; border: 4px solid #1e293b; border-top: 4px solid #3b82f6;
            border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div id="loading-state" class="loading">
        <div class="spinner"></div>
        <div>Loading Trajectory Browser...</div>
    </div>
    <iframe id="viewer-frame" src="${prodBase}index.html"></iframe>

    <script id="trajectory-data" type="application/base64">
        ${base64String}
    </script>
    <script>
        const fileName = ${JSON.stringify(fileName)};
        const b64Data = document.getElementById('trajectory-data').textContent.trim();
        const binaryStr = atob(b64Data);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
        }

        const frame = document.getElementById('viewer-frame');
        const loading = document.getElementById('loading-state');

        window.addEventListener('message', (event) => {
            if (event.data && event.data.type === 'READY') {
                frame.style.display = 'block';
                loading.style.display = 'none';
                frame.contentWindow.postMessage({
                    type: 'LOAD_RAW_FILE',
                    fileBuffer: bytes.buffer,
                    fileName
                }, '*', [bytes.buffer]);
            }
        });

        // Fallback if production is unreachable or slow
        setTimeout(() => {
            if (loading.style.display !== 'none') {
                loading.textContent = "Unable to load viewer. Ensure you are connected to the network or look for CSP errors.";
            }
        }, 8000);
    </script>
</body>
</html>`;
}

