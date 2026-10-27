import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { Storage } from "@google-cloud/storage";
import { outDir, suitesDir } from "../../core/paths.ts";
import { Agents } from "../../harness/config.ts";
import { isEnoent } from "../../harness/lib/agent-shared.ts";
import {
  createPrng,
  createQueryRecord,
  DEFAULT_GCP_PROJECT,
  DEFAULT_PUBLIC_DATA_DIR,
  isRecord,
  normalizeQuery,
  serializeQueriesJsonl,
  type QueryRecord,
} from "./dataset.ts";
import { fillMissingJudgmentsInFiles, loadCorpusForPooling } from "./judge-fill.ts";

export const DEFAULT_EVALS_BUCKET = "guidance-evals";
export const DEFAULT_PER_AGENT_LIMIT = 40;
export const DEFAULT_HARNESS_SEED = 99;
export const DEFAULT_MAX_RUNS = 30;

export interface MinedHarnessSearch {
  suiteId: string;
  agent: Agents;
  runDate: string;
  expectedGuide: string;
  searchIndex: number;
  query: string;
  calledList?: boolean;
  retriedSearch?: boolean;
  retrievedGuides?: string[];
}

export type MinedSearchQuery = MinedHarnessSearch;

const AGENT_PATTERNS: readonly [pattern: string, agent: Agents][] = [
  ["claude", Agents.CLAUDE_CODE],
  ["codex", Agents.CODEX_CLI],
  ["antigravity", Agents.ANTIGRAVITY_CLI],
  // Older nightly suite folders used the `-agy` suffix before standardizing on `jetski_cli`.
  ["jetski", Agents.JETSKI_CLI],
  ["-agy", Agents.JETSKI_CLI],
  ["gemini", Agents.GEMINI_CLI],
];

export function resolveAgentFromSuiteId(suiteId: string): Agents | undefined {
  const lower = suiteId.toLowerCase();
  return AGENT_PATTERNS.find(([pattern]) => lower.includes(pattern))?.[1];
}

const SEARCH_CMD_RE = /\bsearch\s+(?:--[a-z-]+(?:=\S+)?\s+)*(?:"([^"]+)"|'([^']+)'|(\S+))/i;

function getStepCommandText(step: unknown): string {
  if (!isRecord(step)) return "";
  if (isRecord(step.action)) {
    if (isRecord(step.action.params)) {
      if (typeof step.action.params.command === "string" && step.action.params.command.trim().length > 0) {
        return step.action.params.command;
      }
      if (typeof step.action.params.CommandLine === "string" && step.action.params.CommandLine.trim().length > 0) {
        return step.action.params.CommandLine;
      }
      if (typeof step.action.params.cmd === "string" && step.action.params.cmd.trim().length > 0) {
        return step.action.params.cmd;
      }
    }
    if (typeof step.action.command === "string" && step.action.command.trim().length > 0) {
      return step.action.command;
    }
    if (typeof step.action.CommandLine === "string" && step.action.CommandLine.trim().length > 0) {
      return step.action.CommandLine;
    }
  }
  if (typeof step.command === "string" && step.command.trim().length > 0) {
    return step.command;
  }
  if (typeof step.CommandLine === "string" && step.CommandLine.trim().length > 0) {
    return step.CommandLine;
  }
  if (isRecord(step.action) && typeof step.action.name === "string") {
    return step.action.name;
  }
  return "";
}

function isSkillSearchStep(step: unknown): boolean {
  if (!isRecord(step) || !isRecord(step.action)) return false;
  if (step.action.canonicalCategory === "skill_search") return true;
  const commandText = getStepCommandText(step);
  return commandText.includes("modern-web-guidance") && SEARCH_CMD_RE.test(commandText);
}

function isGuideRetrievalStep(step: unknown): boolean {
  if (!isRecord(step) || !isRecord(step.action)) return false;
  if (step.action.canonicalCategory === "guide_retrieval") return true;
  const commandText = getStepCommandText(step);
  return commandText.includes("modern-web-guidance") && /(?:--)?retrieve\b/i.test(commandText);
}

function isListStep(step: unknown): boolean {
  const commandText = getStepCommandText(step);
  return commandText.includes("modern-web-guidance") && /\blist\b/i.test(commandText);
}

function parseGuidesFromStep(step: unknown): string[] {
  if (!isRecord(step)) return [];
  const found: string[] = [];
  if (isRecord(step.action)) {
    if (isRecord(step.action.params)) {
      if (typeof step.action.params.guide === "string") found.push(step.action.params.guide);
      if (typeof step.action.params.use_case_id === "string") found.push(step.action.params.use_case_id);
    }
  }
  const commandText = getStepCommandText(step);
  if (commandText.includes("retrieve")) {
    const match = commandText.match(/(?:--)?retrieve\s+["'\\]*([^"'\s\\]+)["'\\]*/i);
    if (match?.[1]) {
      const parts = match[1]
        .split(",")
        .map((guideToken) => guideToken.trim().replace(/^["'\\]+|["'\\]+$/g, ""))
        .filter((guideToken) => Boolean(guideToken) && /^[a-zA-Z0-9_-]+$/.test(guideToken) && guideToken.toLowerCase() !== "id");
      found.push(...parts);
    }
  }
  return found;
}

/**
 * Extracts `modern-web-guidance search "..."` queries from a parsed `trajectory_summary.json`.
 */
export function extractSearchQueriesFromTrajectory(
  summary: unknown,
  meta: { suiteId: string; agent: Agents; runDate: string; expectedGuide: string }
): MinedHarnessSearch[] {
  if (!isRecord(summary) || !Array.isArray(summary.steps)) return [];
  const mined: MinedHarnessSearch[] = [];
  let searchIndex = 0;

  for (let stepIdx = 0; stepIdx < summary.steps.length; stepIdx++) {
    const step = summary.steps[stepIdx];
    if (!isRecord(step) || !isRecord(step.action)) continue;
    if (!isSkillSearchStep(step)) continue;
    const commandText = getStepCommandText(step);
    const match = commandText.match(SEARCH_CMD_RE);
    const rawQuery = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
    if (!rawQuery || rawQuery.startsWith("-")) continue;

    const subsequentSteps = summary.steps.slice(stepIdx + 1);

    const calledList = subsequentSteps.some(isListStep) ? true : undefined;

    let retriedSearch: boolean | undefined;
    for (const subStep of subsequentSteps) {
      if (isGuideRetrievalStep(subStep)) {
        break;
      }
      if (isSkillSearchStep(subStep)) {
        retriedSearch = true;
        break;
      }
    }

    const parsedGuides: string[] = [];
    for (const subStep of subsequentSteps) {
      if (isSkillSearchStep(subStep)) {
        break;
      }
      if (isGuideRetrievalStep(subStep)) {
        parsedGuides.push(...parseGuidesFromStep(subStep));
      }
    }

    let retrievedGuides: string[] | undefined;
    if (parsedGuides.length > 0) {
      retrievedGuides = [...new Set(parsedGuides)];
    } else if (!retriedSearch && Array.isArray(summary.retrievedGuides)) {
      retrievedGuides = summary.retrievedGuides.filter((guideId): guideId is string => typeof guideId === "string");
    }

    mined.push({
      suiteId: meta.suiteId,
      agent: meta.agent,
      runDate: meta.runDate,
      expectedGuide: meta.expectedGuide,
      searchIndex: searchIndex++,
      query: rawQuery,
      calledList,
      retriedSearch,
      retrievedGuides,
    });
  }

  return mined;
}

/**
 * Samples up to `perAgentLimit` distinct first-search queries per agent whose `expectedGuide`
 * exists in `validGuideIds`.
 */
export function sampleHarnessQueries(
  mined: MinedHarnessSearch[],
  validGuideIds: ReadonlySet<string>,
  options: { perAgentLimit?: number; seed?: number } = {}
): QueryRecord[] {
  const perAgentLimit = options.perAgentLimit ?? DEFAULT_PER_AGENT_LIMIT;
  const rand = createPrng(options.seed ?? DEFAULT_HARNESS_SEED);
  const eligible = mined.filter((m) => m.searchIndex === 0 && validGuideIds.has(m.expectedGuide));
  const grouped = Map.groupBy(eligible, (m) => m.agent);
  const agents = [...grouped.keys()].sort();
  const sampled: QueryRecord[] = [];

  for (const agent of agents) {
    const list = grouped.get(agent) ?? [];
    const seenNormalized = new Set<string>();
    const candidates = list.map((m) => ({ m, key: rand() })).sort((a, b) => a.key - b.key);

    let count = 0;
    for (const { m: item } of candidates) {
      if (count >= perAgentLimit) break;
      const norm = normalizeQuery(item.query);
      if (!norm || seenNormalized.has(norm)) continue;
      seenNormalized.add(norm);
      sampled.push(
        createQueryRecord({
          qid: `h${String(sampled.length).padStart(4, "0")}`,
          query: item.query,
          stratum: agent,
          expectedGuide: item.expectedGuide,
          agent,
          runDate: item.runDate,
          ...(item.calledList !== undefined ? { calledList: item.calledList } : {}),
          ...(item.retriedSearch !== undefined ? { retriedSearch: item.retriedSearch } : {}),
          ...(item.retrievedGuides !== undefined ? { retrievedGuides: [...item.retrievedGuides] } : {}),
        })
      );
      count++;
    }
  }

  return sampled;
}

export function mineLocalSuitesDir(dir: string): MinedHarnessSearch[] {
  let suiteEntries: fs.Dirent[];
  try {
    suiteEntries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    if (isEnoent(err)) return [];
    throw err;
  }

  const allMined: MinedHarnessSearch[] = [];
  for (const suite of suiteEntries) {
    if (!suite.isDirectory()) continue;
    const suiteId = suite.name;
    const agent = resolveAgentFromSuiteId(suiteId);
    if (!agent) continue;
    const runDate = suiteId.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? "unknown";
    const suitePath = path.join(dir, suiteId);

    let relativePaths: string[];
    try {
      relativePaths = fs
        .readdirSync(suitePath, { recursive: true })
        .map((entryPath) => String(entryPath).replaceAll("\\", "/"));
    } catch (err) {
      if (isEnoent(err)) continue;
      throw err;
    }

    for (const relPath of relativePaths) {
      if (!relPath.endsWith("/guided/trajectory_summary.json")) continue;
      const normalizedPath = "/" + relPath;
      const match = normalizedPath.match(/\/([^/]+)\/[^/]+\/guided\/trajectory_summary\.json$/);
      const segments = normalizedPath.split("/");
      const taskFolder = match?.[1] ?? segments.at(-4) ?? segments.at(-3) ?? "";
      const expectedGuide = taskFolder.replace(/--.*$/, "");
      if (!expectedGuide) continue;

      const summaryPath = path.join(suitePath, relPath);
      try {
        const summary: unknown = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
        allMined.push(...extractSearchQueriesFromTrajectory(summary, { suiteId, agent, runDate, expectedGuide }));
      } catch (err) {
        if (!isEnoent(err)) throw err;
      }
    }
  }
  return allMined;
}

async function downloadNightlySummariesFromGcs(
  cacheDir = path.join(outDir, "benchmarks/harness-cache"),
  maxRuns = DEFAULT_MAX_RUNS
): Promise<string> {
  fs.mkdirSync(cacheDir, { recursive: true });
  const storage = new Storage({ projectId: DEFAULT_GCP_PROJECT });
  const bucket = storage.bucket(DEFAULT_EVALS_BUCKET);

  const prefixes: string[] = [];
  let pageToken: string | undefined;
  do {
    const [, nextQuery, apiResponse] = await bucket.getFiles({
      delimiter: "/",
      autoPaginate: false,
      prefix: "nightly-",
      pageToken,
    });
    if (isRecord(apiResponse) && Array.isArray(apiResponse.prefixes)) {
      for (const p of apiResponse.prefixes) {
        if (typeof p === "string") prefixes.push(p);
      }
    }
    pageToken = isRecord(nextQuery) && typeof nextQuery.pageToken === "string" ? nextQuery.pageToken : undefined;
  } while (pageToken);

  const selectedSuites = prefixes
    .map((p) => p.replace(/\/$/, ""))
    .sort()
    .slice(-maxRuns);

  for (const suiteId of selectedSuites) {
    const [files] = await bucket.getFiles({ prefix: `${suiteId}/` });
    const summaryFiles = files.filter((f) => f.name.endsWith("/guided/trajectory_summary.json"));
    for (const file of summaryFiles) {
      const localPath = path.join(cacheDir, file.name);
      try {
        fs.statSync(localPath);
        continue;
      } catch (err) {
        if (!isEnoent(err)) throw err;
      }
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      const [bytes] = await file.download();
      fs.writeFileSync(localPath, bytes);
    }
  }

  return cacheDir;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      gcs: { type: "boolean", default: false },
      judge: { type: "boolean", default: false },
      batch: { type: "boolean", default: false },
    },
  });
  const sourceDir = values.gcs ? await downloadNightlySummariesFromGcs() : suitesDir;

  const corpus = loadCorpusForPooling();
  const mined = mineLocalSuitesDir(sourceDir);
  const sampled = sampleHarnessQueries(mined, new Set(corpus.cards.keys()));

  const queriesPath = path.join(DEFAULT_PUBLIC_DATA_DIR, "harness-queries.jsonl");
  const qrelsPath = path.join(DEFAULT_PUBLIC_DATA_DIR, "harness-qrels.jsonl");
  fs.writeFileSync(queriesPath, serializeQueriesJsonl(sampled));
  console.log(`Mined ${mined.length} total searches; wrote ${sampled.length} sampled harness queries to ${queriesPath}`);

  if (values.judge) {
    const count = await fillMissingJudgmentsInFiles(queriesPath, qrelsPath, { batch: values.batch });
    console.log(`Judged ${count} harness queries into ${qrelsPath}`);
  }
}
