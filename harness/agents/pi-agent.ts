import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand } from '../lib/agent-shared.ts';

import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import { generateNormalizedTrajectory } from '../lib/trajectory-parser.ts';

const TRAJECTORY_GLOB = '*.jsonl';

function getSessionFiles(dir: string): string[] {
  return fs.globSync(TRAJECTORY_GLOB, { cwd: dir });
}

// Usage: node pi-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string, targetDir?: string): string {
  const tempHome = createIsolatedHome('ghh-pi', targetDir);
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const piSource = path.join(os.homedir(), '.pi');
  const piDest = path.join(tempHome, '.pi');
  const piDestAgent = path.join(piDest, 'agent');

  fs.mkdirSync(piDestAgent, { recursive: true });

  // Copy necessary auth and configuration files
  const filesToCopy = [
    'settings.json',
    'trust.json',
    'auth.json',  // Copy auth.json to provide API credentials in isolated env
    'models-store.json'  // Copy models store so Pi knows about available models
  ];

  for (const file of filesToCopy) {
    const src = path.join(piSource, 'agent', file);
    copyFileIfExists(src, path.join(piDestAgent, file));
  }

  // Set environment variables
  process.env.HOME = tempHome;
  process.env.PI_CODING_AGENT_DIR = path.join(tempHome, '.pi', 'agent');

  // Add context and resources for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.CLAUDE_CODE, approach === Serving.SKILLS_CLI, suiteConfig.skillsToEnable);
      // Pi uses .agents/skills/ directory structure
      const skillsSrc = path.join(tempHome, '.claude', 'skills');
      const skillsDest = path.join(tempHome, '.agents', 'skills');
      if (fs.existsSync(skillsSrc)) {
        fs.mkdirSync(skillsDest, { recursive: true });
        fs.cpSync(skillsSrc, skillsDest, { recursive: true });
      }
    } else if (approach === Serving.MCP) {
      // Pi doesn't have native MCP support per documentation
      // "No MCP. Build CLI tools with READMEs (see Skills), or build an extension"
      console.warn('Warning: MCP serving mode is not natively supported by Pi. Consider using SKILLS_CLI mode instead.');
    }
  }

  return workDir;
}

/**
 * Executes the Pi CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('pi-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Pi agent in ${workDir}`);

    const command = config.environment.piBin || 'pi';
    
    // Determine model from environment or suite config
    let modelArg: string[] = [];
    const piModel = process.env.PI_MODEL || process.env.PROMPT_MODEL;
    if (piModel) {
      modelArg = ['--model', piModel];
    }

    // Allow overriding --no-session via env var for trajectory testing
    const noSession = process.env.PI_NO_SESSION !== 'false';
    const sessionArgs = noSession ? ['--no-session'] : [];

    const commandArgs = [
      '-p', // print mode: non-interactive, process and exit
      ...sessionArgs, // ephemeral mode: don't save session (unless disabled)
      '--offline', // disable network operations for update checks
      ...modelArg,
      userPrompt
    ];

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    process.env.PI_CODING_AGENT = 'true';
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Pi'
      );
    } finally {
      stopWatchingMcpLog();
    }

    // Capture trajectory from pi session directory
    const sessionsDir = path.join(path.dirname(workDir), '.pi', 'agent', 'sessions');
    exportTrajectories(sessionsDir, '*.jsonl', targetDir);

    console.log("Pi agent finished successfully.");

    await generateNormalizedTrajectory(targetDir, Agents.PI, getSuiteConfig().serving);

  } catch (err) {
    console.error("Error during Pi execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export function extractPiModel(resultsDir: string): string {
  const sessionFiles = getSessionFiles(resultsDir);
  if (sessionFiles.length === 0) return 'unknown';

  const counts: Record<string, number> = {};
  for (const file of sessionFiles) {
    const sessionPath = path.join(resultsDir, file);
    try {
      const content = fs.readFileSync(sessionPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          let model: string | undefined;
          if (msg.type === 'message' && msg.message?.model) {
            model = msg.message.model;
          } else if (msg.type === 'model_change' && msg.modelId) {
            model = msg.modelId;
          }
          // Fallback for older formats
          if (!model && msg.metadata?.model) {
            model = msg.metadata.model;
          }

          if (model) {
            counts[model] = (counts[model] || 0) + 1;
          }
        } catch {
          // Ignore parse errors
        }
      }
    } catch (e) {
      console.warn(`Failed to extract model from ${sessionPath}:`, e);
    }
  }

  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (topModel) return topModel[0];

  return 'unknown';
}

export function extractPiTokenUsage(dir: string): { total: number; cached: number } | undefined {
  let total = 0;
  let cached = 0;
  let hasData = false;
  try {
    const sessionFiles = getSessionFiles(dir);
    for (const file of sessionFiles) {
      try {
        const sessionPath = path.join(dir, file);
        const content = fs.readFileSync(sessionPath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          try {
            const msg = JSON.parse(line);
            const usage = msg.message?.usage || msg.metadata?.usage || msg.usage;
            if (usage) {
              total += usage.totalTokens || 0;
              if (usage.cacheRead !== undefined) {
                cached += usage.cacheRead;
              }
              hasData = true;
            }
          } catch {
            // Ignore parse errors
          }
        }
      } catch {
        // Ignore file read errors
      }
    }
  } catch {
    // Ignore
  }
  return hasData ? { total, cached } : undefined;
}

export function collectPiToolsFromTrajectory(dir: string): string[] {
  const toolsUsed: string[] = [];
  const sessionFiles = getSessionFiles(dir);
  const firstSession = sessionFiles[0];
  if (!firstSession) return toolsUsed;

  try {
    const sessionPath = path.join(dir, firstSession);
    const content = fs.readFileSync(sessionPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        const assistantMsg = msg.type === 'message' ? msg.message : msg;
        
        if (assistantMsg?.role === 'assistant') {
          // New format: content array contains toolCall objects
          const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
          // Legacy format fallback: root tool_calls array
          if (assistantMsg.tool_calls) {
            toolCalls.push(...assistantMsg.tool_calls);
          }

          for (const tc of toolCalls) {
            const toolName = tc.function?.name || tc.name;
            if (toolName === 'read' || toolName === 'write' || toolName === 'edit' || toolName === 'bash') {
              // Built-in Pi tools
              continue;
            } else if (toolName === 'modern-web-guidance' || toolName?.includes('get_best_practices')) {
              toolsUsed.push('modern-web-guidance');
            } else if (toolName) {
              toolsUsed.push(toolName);
            }
          }
        }
      } catch {
        // Ignore parse errors
      }
    }
  } catch (e) {
    console.error(`Failed to collect tools used for Pi:`, e);
  }

  return Array.from(new Set(toolsUsed));
}


export function collectPiGuidesFromTrajectory(dirPath: string, _serving: string): Promise<{ retrievedGuides: string[]; fileReadGuides: string[] }> {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  try {
    const sessionFiles = getSessionFiles(dirPath);

    for (const file of sessionFiles) {
      const sessionPath = path.join(dirPath, file);
      const content = fs.readFileSync(sessionPath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          const assistantMsg = entry.type === 'message' ? entry.message : entry;

          if (assistantMsg?.role === 'assistant') {
            const toolCalls = assistantMsg.content?.filter((c: any) => c.type === 'toolCall') || [];
            if (assistantMsg.tool_calls) {
              toolCalls.push(...assistantMsg.tool_calls);
            }

            for (const contentItem of toolCalls) {
              const args = contentItem.arguments || {};
              const toolName = contentItem.function?.name || contentItem.name;

              // Check for read tool accessing skill files
              if (toolName === 'read' && (args.path || args.file_path)) {
                  const filePath = (args.path || args.file_path) as string;
                  if (filePath.includes('/skills/') || filePath.includes('.agents/skills/')) {
                    // Match guide.md files in guides/{category}/{guide-name}/guide.md structure
                    const match = filePath.match(/\/skills\/[^/]+\/guides\/[^/]+\/([^/]+)\/guide\.md$/) ||
                                  // Match .md files in references/{category}/{guide-name}.md structure  
                                  filePath.match(/\/skills\/[^/]+\/references\/[^/]+\/([^/]+)\.md$/) ||
                                  // Fallback: match {guide-name}.md in any skills subdirectory (but not guide.md itself)
                                  filePath.match(/\/skills\/[^/]+\/(?:[^/]+\/)*([^/]+)\.md$/);
                    if (match && match[1] !== 'guide') {
                      fileReadGuides.push(match[1]);
                    }
                  }
                } else if (toolName === 'bash' && args.command) {
                  const command = args.command as string;
                  const match = command.match(/(?:--)?retrieve\s+["']?([^"'\s]+)["']?/);
                  if (match) {
                    retrievedGuides.push(...match[1].split(',').map(s => s.trim()));
                  }
                }
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } catch (e) {
    console.error(`Error reading session files in ${dirPath}:`, e);
  }
  return Promise.resolve({
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)]
  });
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
