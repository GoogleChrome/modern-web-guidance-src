import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import config, { Agents } from '../config.ts';
import {
  cleanupIsolatedHome,
  parseAgentArgs,
  watchLogFile,
  exportTrajectories,
  runCliAgentCommand,
  createTrustedFolders,
  copyFileIfExists,
  setupIsolatedWorkDir,
  isEnoent,
  type GuideUsage
} from '../lib/agent-shared.ts';
import { MODERN_WEB_LOG_FILE } from '../../constants.ts';
import {
  type StandardizedStep,
  type TrajectorySummary,
  extractTimestamp,
  truncateMessage,
  finalizeTrajectorySummary,
  generateNormalizedTrajectory,
  readTrajectorySummary
} from '../lib/trajectory-normalizer.ts';

const JETSKI_ERROR_STATUS_CODES = new Set([2, 4, 5]);
const MAX_PAYLOAD_PREVIEW_LENGTH = 200;

const PROTO_WIRE_TYPE = {
  VARINT: 0,
  FIXED64: 1,
  LENGTH_DELIMITED: 2,
  FIXED32: 5
} as const;

const METADATA_TAG_USAGE = 9;
const USAGE_TAG_INPUT = 2;
const USAGE_TAG_OUTPUT = 3;
const USAGE_TAG_CACHED = 5;

const TRAJECTORY_GLOB = '*.db';

export function setupJetskiCliCredentials(tempHome: string): string {
  const originalHome = process.env.HOME || process.cwd();
  const jetskiSource = path.join(originalHome, '.gemini', 'jetski');
  const jetskiDest = path.join(tempHome, '.gemini', 'jetski');
  const geminiDest = path.join(tempHome, '.gemini');

  fs.mkdirSync(jetskiDest, { recursive: true });

  const filesToCopy = [
    'installation_id',
    'user_settings.pb',
  ];

  for (const file of filesToCopy) {
    copyFileIfExists(path.join(jetskiSource, file), path.join(jetskiDest, file));
  }

  process.env.JETSKI_DIR = jetskiDest;
  createTrustedFolders(geminiDest, [tempHome]);
  return jetskiDest;
}

export function getJetskiCliCommandAndArgs(prompt: string): { command: string; commandArgs: string[] } {
  const command = config.environment.jetskiCliBin;
  const model = process.env.JETSKI_MODEL;
  const commandArgs = [
    '-p', prompt,
    '--dangerously-skip-permissions',
    ...(model ? ['--model', model] : [])
  ];
  return { command, commandArgs };
}

function exportJetskiTrajectories(workDir: string, targetDir: string): void {
  const jetskiLogDir = path.join(path.dirname(workDir), '.gemini', 'jetski', 'brain');
  exportTrajectories(jetskiLogDir, '**/*.db', targetDir);
  exportTrajectories(jetskiLogDir, '**/modern-web.log', targetDir);
}

async function run() {
  const { userPrompt, runType, targetDir, templateDir } = parseAgentArgs('jetski-cli-agent.ts');
  const workDir = setupIsolatedWorkDir(Agents.JETSKI_CLI, templateDir, runType, targetDir);

  if (!workDir) {
    throw new Error('Failed to initialize working directory');
  }

  try {
    console.log(`Starting Jetski CLI agent in: ${workDir}`);

    const { command, commandArgs } = getJetskiCliCommandAndArgs(userPrompt);

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
      exportJetskiTrajectories(workDir, targetDir);
      await generateNormalizedTrajectory(targetDir, Agents.JETSKI_CLI, userPrompt);
    }

    console.log("Jetski CLI agent finished successfully.");
  } catch (err) {
    console.error("Error during Jetski CLI execution:", err);
    process.exitCode = 1;
  } finally {
    cleanupIsolatedHome(path.dirname(workDir));
  }
}

export function findJsonObjectsInString(str: string): any[] {
  const results: any[] = [];
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') {
      let openBraces = 0;
      let inString = false;
      let escape = false;
      let end = -1;

      for (let j = i; j < str.length; j++) {
        const char = str[j];
        if (escape) {
          escape = false;
          continue;
        }
        if (char === '\\') {
          escape = true;
          continue;
        }
        if (char === '"') {
          inString = !inString;
          continue;
        }
        if (!inString) {
          if (char === '{') openBraces++;
          else if (char === '}') {
            openBraces--;
            if (openBraces === 0) {
              end = j + 1;
              break;
            }
          }
        }
      }

      if (end !== -1) {
        const candidate = str.substring(i, end);
        try {
          results.push(JSON.parse(candidate));
          i = end - 1;
        } catch {}
      }
    }
  }
  return results;
}

export function parseProtobuf(buffer: Buffer): Record<number, any[]> {
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
    if (wireType === PROTO_WIRE_TYPE.VARINT) {
      let val = 0;
      let valShift = 0;
      while (pos < buffer.length) {
        const b = buffer[pos++];
        val += (b & 0x7f) * Math.pow(2, valShift);
        valShift += 7;
        if ((b & 0x80) === 0) break;
      }
      value = val;
    } else if (wireType === PROTO_WIRE_TYPE.LENGTH_DELIMITED) {
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
    } else if (wireType === PROTO_WIRE_TYPE.FIXED64) {
      pos += 8;
    } else if (wireType === PROTO_WIRE_TYPE.FIXED32) {
      pos += 4;
    } else {
      break;
    }

    if (!fields[fieldNum]) fields[fieldNum] = [];
    fields[fieldNum].push(value);
  }
  return fields;
}

function getSessionFiles(dir: string, recursive = false): string[] {
  const pattern = recursive ? `**/${TRAJECTORY_GLOB}` : TRAJECTORY_GLOB;
  try {
    const files = fs.globSync(pattern, { cwd: dir });
    return (files as string[]).filter(f => !f.endsWith('-shm') && !f.endsWith('-wal'));
  } catch (err) {
    if (!isEnoent(err)) throw err;
    return [];
  }
}

export function getProtoStrings(node: any, results: string[] = []): string[] {
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
  const steps: StandardizedStep[] = [];
  const seenJsonHashes = new Set<string>();
  let modelName = 'unknown';
  let totalTokens = 0;
  let totalCached = 0;
  let hasTokens = false;

  const files = getSessionFiles(dirPath);
  for (const file of files) {
    const fullPath = path.join(dirPath, file);
    let db: DatabaseSync | null = null;
    try {
      db = new DatabaseSync(fullPath, { readOnly: true });
      const rows = db.prepare('SELECT * FROM steps ORDER BY idx').all() as Array<{
        idx?: number;
        step_type?: number;
        status?: number;
        timestamp?: number | string;
        metadata?: Uint8Array;
        step_payload?: Uint8Array;
      }>;

      let fileInput = 0;
      let fileLastCached = 0;
      let fileOutput = 0;
      let fileHasTokens = false;

      for (const row of rows) {
        if (row.step_payload) {
          const payloadBuffer = Buffer.isBuffer(row.step_payload) ? row.step_payload : Buffer.from(row.step_payload);
          const payloadStr = payloadBuffer.toString('utf8');

          const objs = findJsonObjectsInString(payloadStr);
          const isErr = row.status !== undefined && JETSKI_ERROR_STATUS_CODES.has(row.status);
          for (const obj of objs) {
            if (!obj.toolAction && !obj.toolSummary && !obj.CommandLine && !obj.AbsolutePath && !obj.DirectoryPath && !obj.TargetFile) continue;
            const key = JSON.stringify({ cmd: obj.CommandLine, file: obj.AbsolutePath || obj.TargetFile || obj.DirectoryPath, act: obj.toolAction || obj.toolSummary });
            if (seenJsonHashes.has(key)) continue;
            seenJsonHashes.add(key);

            const timestamp = extractTimestamp(obj) || (row.timestamp ? new Date(row.timestamp).toISOString() : undefined);
            const subagentId = obj.Recipient || obj.recipient_id || obj.conversationId || undefined;

            if (obj.TargetFile || (obj.toolAction && (obj.toolAction.includes('Modifying') || obj.toolAction.includes('Updating') || obj.toolAction.includes('Writing')))) {
              const targetFile = obj.TargetFile || 'target_file';
              const toolName = obj.ReplacementChunks ? 'multi_replace_file_content' : (obj.CodeContent ? 'write_to_file' : 'replace_file_content');
              steps.push({
                stepNumber: 0,
                timestamp,
                subagentId,
                thought: obj.toolSummary || obj.toolAction || 'Modifying target file',
                action: {
                  type: 'write_file',
                  name: toolName,
                  params: {
                    targetFile,
                    content: truncateMessage(obj.CodeContent || obj.ReplacementChunks || '', MAX_PAYLOAD_PREVIEW_LENGTH)
                  }
                },
                outcome: { status: isErr ? 'error' : 'success' }
              });
            } else if (obj.CommandLine || (obj.toolAction && obj.toolAction.includes('Running command'))) {
              let actType: NonNullable<StandardizedStep['action']>['type'] = 'run_command';
              let actName = obj.CommandLine ? obj.CommandLine.split(' ')[0] : 'terminal_command';
              const params: Record<string, any> = { command: obj.CommandLine || obj.toolAction };

              if (/(?:modern-web-guidance|modern-web|\bgd\b)/.test(obj.CommandLine) && (obj.CommandLine.includes('search') || obj.CommandLine.includes('retrieve'))) {
                actType = 'web_search';
                actName = 'get_best_practices';
                const qMatch = obj.CommandLine.match(/(?:search|retrieve)\s+["']?([^"'\n]+)["']?/i);
                if (qMatch) {
                  params.query = qMatch[1];
                }
              }

              steps.push({
                stepNumber: 0,
                timestamp,
                subagentId,
                thought: obj.toolSummary || obj.toolAction || 'Running terminal command',
                action: {
                  type: actType,
                  name: actName,
                  params
                },
                outcome: { status: isErr ? 'error' : 'success' }
              });
            } else if (obj.AbsolutePath || (obj.toolAction && (obj.toolAction.includes('Viewing') || obj.toolAction.includes('Reading')))) {
              steps.push({
                stepNumber: 0,
                timestamp,
                subagentId,
                thought: obj.toolSummary || obj.toolAction || 'Exploring workspace structure',
                action: {
                  type: 'read_file',
                  name: 'view_file',
                  params: { path: obj.AbsolutePath || obj.toolSummary }
                },
                outcome: { status: isErr ? 'error' : 'success' }
              });
            } else if (obj.DirectoryPath || (obj.toolAction && obj.toolAction.includes('Listing'))) {
              steps.push({
                stepNumber: 0,
                timestamp,
                subagentId,
                thought: obj.toolSummary || obj.toolAction || 'Exploring workspace structure',
                action: {
                  type: 'read_file',
                  name: 'list_dir',
                  params: { path: obj.DirectoryPath }
                },
                outcome: { status: isErr ? 'error' : 'success' }
              });
            }
          }

          const proto = parseProtobuf(payloadBuffer);
          const strings = getProtoStrings(proto);

          for (const text of strings) {
            if (text.includes('retrieve')) {
              const match = text.match(/(?:--)?retrieve\s+["'\\]*([^"'\s\\]+)["'\\]*/i);
              if (match && match[1]) {
                const parts = match[1]
                  .split(',')
                  .map(s => s.trim().replace(/^["'\\]+|["'\\]+$/g, ''))
                  .filter(s => Boolean(s) && /^[a-zA-Z0-9_-]+$/.test(s) && s.toLowerCase() !== 'id');
                retrievedGuides.push(...parts);
              }
            }

            if (text.includes('/skills/') && text.endsWith('/guide.md')) {
              const match = text.match(/\/skills\/[^/]+\/([^/]+)\/guide\.md$/);
              if (match) {
                fileReadGuides.push(match[1]);
              }
            }
            if (text.includes('/skills/') && text.endsWith('/SKILL.md')) {
              const match = text.match(/\/skills\/([^/]+)\/SKILL\.md$/);
              if (match) {
                toolsUsed.push(match[1]);
              }
            }
          }
        }

        if (row.metadata) {
          const metadataBuffer = Buffer.isBuffer(row.metadata) ? row.metadata : Buffer.from(row.metadata);
          const proto = parseProtobuf(metadataBuffer);
          const usageNode = proto[METADATA_TAG_USAGE]?.[0];
          if (usageNode && typeof usageNode === 'object') {
            const input = (usageNode[USAGE_TAG_INPUT] && typeof usageNode[USAGE_TAG_INPUT][0] === 'number') ? usageNode[USAGE_TAG_INPUT][0] : 0;
            const output = (usageNode[USAGE_TAG_OUTPUT] && typeof usageNode[USAGE_TAG_OUTPUT][0] === 'number') ? usageNode[USAGE_TAG_OUTPUT][0] : 0;
            const cached = (usageNode[USAGE_TAG_CACHED] && typeof usageNode[USAGE_TAG_CACHED][0] === 'number') ? usageNode[USAGE_TAG_CACHED][0] : 0;
            if (input > 0 || output > 0 || cached > 0) {
              fileInput += input;
              fileLastCached = Math.max(fileLastCached, cached);
              fileOutput += output;
              fileHasTokens = true;
            }
          }
        }
      }

      if (fileHasTokens) {
        totalTokens += (fileInput + fileLastCached + fileOutput);
        totalCached += fileLastCached;
        hasTokens = true;
      }

      try {
        const genRows = db.prepare('SELECT data FROM gen_metadata').all() as Array<{ data?: Uint8Array }>;
        for (const row of genRows) {
          if (!row.data) continue;
          const genDataBuffer = Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data);
          const proto = parseProtobuf(genDataBuffer);
          const strings = getProtoStrings(proto);
          const modelCandidate = strings.find(s => /^gemini/i.test(s));
          if (modelCandidate) {
            modelName = modelCandidate;
            break;
          }
        }
      } catch {}
    } catch {} finally {
      db?.close();
    }
  }

  return {
    agent: Agents.JETSKI_CLI,
    steps,
    retrievedGuides: [...new Set(retrievedGuides)],
    fileReadGuides: [...new Set(fileReadGuides)],
    toolsUsed: [...new Set(toolsUsed)],
    model: modelName,
    tokenUsage: hasTokens ? { total: totalTokens, cached: totalCached } : undefined
  };
}

export async function parseJetskiTrajectory(dirPath: string): Promise<TrajectorySummary> {
  const summary = parseJetskiCliSession(dirPath);
  return finalizeTrajectorySummary(summary);
}

function getJetskiSummaryForDir(dir: string): TrajectorySummary {
  return readTrajectorySummary(dir) || parseJetskiCliSession(dir);
}

export async function collectJetskiCliGuidesFromTrajectory(dirPath: string, _serving?: string): Promise<GuideUsage> {
  const summary = getJetskiSummaryForDir(dirPath);
  return {
    retrievedGuides: summary?.retrievedGuides || [],
    fileReadGuides: summary?.fileReadGuides || []
  };
}

export function extractJetskiCliModel(resultsDir: string): string {
  const summary = getJetskiSummaryForDir(resultsDir);
  return summary?.model || 'unknown';
}

export function extractJetskiCliTokenUsage(dir: string): { total: number; cached: number } | undefined {
  const summary = getJetskiSummaryForDir(dir);
  return summary?.tokenUsage;
}

export function collectJetskiCliToolsFromTrajectory(dir: string): string[] {
  const summary = getJetskiSummaryForDir(dir);
  return summary?.toolsUsed || [];
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  run();
}
