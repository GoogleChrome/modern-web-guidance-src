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
}

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

  for (const step of summary.steps) {
    if (!isRecord(step) || !isRecord(step.action)) continue;
    const action = step.action;
    if (action.canonicalCategory !== "skill_search" || typeof action.name !== "string") continue;
    const match = action.name.match(SEARCH_CMD_RE);
    const rawQuery = (match?.[1] ?? match?.[2] ?? match?.[3] ?? "").trim();
    if (!rawQuery || rawQuery.startsWith("-")) continue;

    mined.push({
      suiteId: meta.suiteId,
      agent: meta.agent,
      runDate: meta.runDate,
      expectedGuide: meta.expectedGuide,
      searchIndex: searchIndex++,
      query: rawQuery,
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
    for (const { m } of candidates) {
      if (count >= perAgentLimit) break;
      const norm = normalizeQuery(m.query);
      if (!norm || seenNormalized.has(norm)) continue;
      seenNormalized.add(norm);
      sampled.push(
        createQueryRecord({
          qid: `h${String(sampled.length).padStart(4, "0")}`,
          query: m.query,
          stratum: agent,
          expectedGuide: m.expectedGuide,
          agent,
          runDate: m.runDate,
        })
      );
      count++;
    }
  }

  return sampled;
}

function mineLocalSuitesDir(dir: string): MinedHarnessSearch[] {
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

    for (const taskEntry of fs.readdirSync(suitePath, { withFileTypes: true })) {
      if (!taskEntry.isDirectory()) continue;
      const expectedGuide = taskEntry.name.replace(/--.*$/, "");
      const summaryPath = path.join(suitePath, taskEntry.name, "task/guided/trajectory_summary.json");
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
