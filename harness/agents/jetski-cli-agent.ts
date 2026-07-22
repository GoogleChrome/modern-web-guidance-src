import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import config, { Agents, Serving } from '../config.ts';
import { getSuiteConfig, updateMcpConfig, createIsolatedHome, cleanupIsolatedHome, copyFileIfExists, parseAgentArgs, createWorkDir, copySkills, watchLogFile, exportTrajectories, runCliAgentCommand, type GuidedUsage } from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';

export const TRAJECTORY_SUMMARY_FILE = 'trajectory_summary.json';

export interface TrajectorySummary {
  retrievedGuides: string[];
  fileReadGuides: string[];
  toolsUsed: string[];
  model?: string;
  tokenUsage?: { total: number; cached: number };
}

export function writeTrajectorySummary(targetDir: string, summary: TrajectorySummary): void {
  fs.writeFileSync(path.join(targetDir, TRAJECTORY_SUMMARY_FILE), JSON.stringify(summary, null, 2), 'utf8');
}

export function readTrajectorySummary(dir: string): TrajectorySummary | null {
  const summaryPath = path.join(dir, TRAJECTORY_SUMMARY_FILE);
  if (fs.existsSync(summaryPath)) {
    try {
      return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch {}
  }
  return null;
}

// Usage: node jetski-cli-agent.ts <prompt> <runType> <targetDir> <templateDir>
/**
 * Sets up an isolated HOME and work directory to ensure test isolation.
 * @returns {string} The path to the temporary work directory.
 */
function setupIsolatedWorkDir(templateDir: string, runType: string, targetDir?: string): string {
  const tempHome = createIsolatedHome('ghh-jetski-cli', targetDir);
  const workDir = createWorkDir(templateDir, tempHome, runType);

  const jetskiSource = path.join(os.homedir(), '.gemini', 'jetski');
  const jetskiDest = path.join(tempHome, '.gemini', 'jetski');

  fs.mkdirSync(jetskiDest, { recursive: true });

  // Copy necessary auth and identification files
  const filesToCopy = [
    'installation_id',
    'user_settings.pb'
  ];

  for (const file of filesToCopy) {
    const src = path.join(jetskiSource, file);
    copyFileIfExists(src, path.join(jetskiDest, file));
  }

  // Set environment variables
  process.env.HOME = tempHome;
  process.env.JETSKI_DIR = jetskiDest;

  // Add GEMINI context and MCP servers for guided runs
  if (runType === 'guided') {
    const suiteConfig = getSuiteConfig();
    const approach = suiteConfig.serving;

    if (approach === Serving.SKILLS_CLI || approach === Serving.SKILLS) {
      copySkills(tempHome, Agents.JETSKI_CLI, approach === Serving.SKILLS_CLI, suiteConfig.skillsToEnable);
    } else if (approach === Serving.MCP) {
      updateMcpConfig(
        path.join(jetskiDest, 'mcp_config.json'),
        suiteConfig.mcpServersToEnable,
        config.environment.modernWebServerPath,
        config.environment.mcpApiKey,
        Agents.JETSKI_CLI
      );
    }
  }

  return workDir;
}

/**
 * Executes the Jetski CLI command and captures output.
 */
async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(templateDir, runType, targetDir);

  if (!workDir || !fs.existsSync(workDir)) {
    throw new Error(`Failed to initialize working directory: ${workDir}`);
  }

  try {
    console.log(`Starting Jetski CLI agent in ${workDir}`);

    const command = config.environment.jetskiCliBin;
    const model = process.env.JETSKI_MODEL;
    const commandArgs = [
      '-p', userPrompt,
      '--dangerously-skip-permissions',
      ...(model ? ['--model', model] : [])
    ];

    console.log(`Executing: ${command} ${commandArgs.join(' ')}`);

    process.env.MODERN_WEB_LOG_DIR = targetDir;
    let stopWatchingMcpLog = () => { };

    try {
      stopWatchingMcpLog = watchLogFile(path.join(targetDir, MODERN_WEB_LOG_FILE));

      await runCliAgentCommand(
        command,
        commandArgs,
        workDir,
        targetDir,
        'Jetski CLI'
      );
    } finally {
      stopWatchingMcpLog();
    }

    // Capture trajectory
    const conversationsDir = path.join(path.dirname(workDir), '.gemini', 'jetski', 'conversations');
    exportTrajectories(conversationsDir, '*.pb', targetDir);
    exportTrajectories(conversationsDir, '*.db', targetDir);

    try {
      const summary = parseJetskiCliSession(targetDir);
      writeTrajectorySummary(targetDir, summary);
    } catch (e) {
      console.warn(`Failed to generate trajectory summary in ${targetDir}:`, e);
    }

    console.log("Jetski CLI agent finished successfully.");

  } catch (err) {
    console.error("Error during Jetski CLI execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

function parseProtobuf(buffer: Buffer): Record<number, any[]> {
  let pos = 0;
  const fields: Record<number, any[]> = {};

  while (pos < buffer.length) {
    let tagHeader = 0;
    let shift = 0;
    while (pos < buffer.length) {
      const b = buffer[pos++];
      tagHeader |= (b & 0x7f) << shift;
      shift += 7;
      if ((b & 0x80) === 0) break;
    }
    const wireType = tagHeader & 0x07;
    const fieldNum = tagHeader >> 3;
    if (fieldNum === 0) break;

    let value: any;
    if (wireType === 0) { // Varint
      let val = 0;
      let valShift = 0;
      while (pos < buffer.length) {
        const b = buffer[pos++];
        val += (b & 0x7f) * Math.pow(2, valShift);
        valShift += 7;
        if ((b & 0x80) === 0) break;
      }
      value = val;
    } else if (wireType === 2) { // Length-delimited
      let len = 0;
      let lenShift = 0;
      while (pos < buffer.length) {
        const b = buffer[pos++];
        len += (b & 0x7f) * Math.pow(2, lenShift);
        lenShift += 7;
        if ((b & 0x80) === 0) break;
      }
      const data = buffer.subarray(pos, pos + len);
      pos += len;

      let nested: Record<number, any[]> | null = null;
      try {
        nested = parseProtobuf(data);
        if (Object.keys(nested).length === 0) nested = null;
      } catch {}

      const str = data.toString('utf8');
      const isClean = /^[\x20-\x7E\t\r\n]+$/.test(str) && str.length > 0;
      value = nested || (isClean ? str : data);
    } else if (wireType === 1) {
      pos += 8;
    } else if (wireType === 5) {
      pos += 4;
    } else {
      break;
    }

    if (!fields[fieldNum]) fields[fieldNum] = [];
    fields[fieldNum].push(value);
  }
  return fields;
}

const TRAJECTORY_GLOB = '*.db';

function getSessionFiles(dir: string, recursive = false): string[] {
  if (!fs.existsSync(dir)) return [];
  const pattern = recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB;
  const files = fs.globSync(pattern, { cwd: dir });
  return (files as string[]).filter(f => !f.endsWith('-shm') && !f.endsWith('-wal'));
}

function getProtoStrings(node: any, results: string[] = []): string[] {
  if (!node) return results;
  if (typeof node === 'string') {
    results.push(node);
  } else if (Array.isArray(node)) {
    for (const item of node) getProtoStrings(item, results);
  } else if (typeof node === 'object' && !(node instanceof Uint8Array)) {
    for (const k of Object.keys(node)) {
      getProtoStrings(node[k], results);
    }
  }
  return results;
}

export function parseJetskiCliSession(dirPath: string): TrajectorySummary {
  const retrievedGuides: string[] = [];
  const fileReadGuides: string[] = [];
  const toolsUsed: string[] = [];
  let modelName = 'unknown';
  let totalInput = 0;
  let totalOutput = 0;
  let totalCached = 0;
  let hasTokens = false;

  const files = getSessionFiles(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    try {
      const db = new DatabaseSync(fullPath, { readOnly: true });
      const rows = db.prepare('SELECT step_type, metadata, step_payload FROM steps').all() as Array<{ step_type?: number; metadata?: Uint8Array; step_payload?: Uint8Array }>;
      for (const row of rows) {
        // Decode Protobuf step_payload for specific tool execution step types
        if (row.step_payload) {
          const proto = parseProtobuf(Buffer.from(row.step_payload));
          const strings = getProtoStrings(proto);

          // 1. Shell commands (step_type = 21: RUN_COMMAND)
          if (row.step_type === 21) {
            for (const text of strings) {
              if (text.includes('retrieve')) {
                const match = text.match(/(?:--)?retrieve\s+["'\\]*([^"'\s\\]+)["'\\]*/i);
                if (match && match[1]) {
                  const parts = match[1].split(',').map(s => s.trim().replace(/^["'\\]+|["'\\]+$/g, '')).filter(s => Boolean(s) && /^[a-zA-Z0-9_-]+$/.test(s) && s.toLowerCase() !== 'id');
                  retrievedGuides.push(...parts);
                }
              }
            }
          }

          // 2. File reads (step_type = 8: VIEW_FILE)
          if (row.step_type === 8) {
            for (const filePath of strings) {
              if (filePath.includes('/skills/') && filePath.endsWith('/guide.md')) {
                const match = filePath.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
                if (match) {
                  fileReadGuides.push(match[1]);
                }
              }
              if (filePath.includes('/skills/') && filePath.endsWith('/SKILL.md')) {
                const match = filePath.match(/\/skills\/([^/]+)\/SKILL\.md$/);
                if (match) {
                  toolsUsed.push(match[1]);
                }
              }
            }
          }
        }

        // Protobuf token extraction from metadata tag 9
        if (row.metadata) {
          const proto = parseProtobuf(Buffer.from(row.metadata));
          if (proto[9]) {
            for (const item of proto[9]) {
              if (typeof item === 'object' && item !== null) {
                const input = (item[2] && typeof item[2][0] === 'number') ? item[2][0] : 0;
                const output = (item[3] && typeof item[3][0] === 'number') ? item[3][0] : 0;
                const cached = (item[5] && typeof item[5][0] === 'number') ? item[5][0] : 0;
                if (input > 0 || output > 0 || cached > 0) {
                  totalInput += input;
                  totalOutput += output;
                  totalCached += cached;
                  hasTokens = true;
                }
              }
            }
          }
        }
      }

      // Extract model name from gen_metadata (Protobuf Tag 1 -> Tag 21)
      try {
        const genRows = db.prepare('SELECT data FROM gen_metadata').all() as Array<{ data?: Uint8Array }>;
        for (const row of genRows) {
          if (!row.data) continue;
          const proto = parseProtobuf(Buffer.from(row.data));
          if (proto[1]) {
            for (const item of proto[1]) {
              if (typeof item === 'object' && item !== null && item[21] && typeof item[21][0] === 'string') {
                modelName = item[21][0];
                break;
              }
            }
          }
          if (modelName !== 'unknown') break;
        }
      } catch {}

      db.close();
    } catch {}
  }

  const totalTokens = (hasTokens && totalInput > 0 && totalOutput === 0 && totalCached > 0 && totalInput >= totalCached) 
    ? totalInput 
    : totalInput + totalOutput + totalCached;

  return {
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)],
    toolsUsed: [...new Set(toolsUsed)],
    model: modelName,
    tokenUsage: hasTokens ? { total: totalTokens, cached: totalCached } : undefined
  };
}

export async function collectJetskiCliGuidesFromTrajectory(dirPath: string, _serving: string): Promise<GuidedUsage> {
  const summary = readTrajectorySummary(dirPath);
  return {
    retrievedGuides: summary?.retrievedGuides || [],
    fileReadGuides: summary?.fileReadGuides || []
  };
}

export function extractJetskiCliModel(resultsDir: string): string {
  const counts: Record<string, number> = {};

  if (fs.existsSync(resultsDir)) {
    const summaryFiles = fs.globSync(`**/${TRAJECTORY_SUMMARY_FILE}`, { cwd: resultsDir });
    for (const file of summaryFiles) {
      try {
        const s: TrajectorySummary = JSON.parse(fs.readFileSync(path.join(resultsDir, file), 'utf8'));
        if (s.model && s.model !== 'unknown') {
          counts[s.model] = (counts[s.model] || 0) + 1;
        }
      } catch {}
    }
  }

  const topModel = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return topModel ? topModel[0] : 'unknown';
}

export function extractJetskiCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summary = readTrajectorySummary(dir);
  return summary?.tokenUsage;
}

export function collectJetskiCliToolsFromTrajectory(dir: string): string[] {
  const summary = readTrajectorySummary(dir);
  return summary?.toolsUsed || [];
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
