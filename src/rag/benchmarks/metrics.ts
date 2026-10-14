import { createPrng, type Grade, type LoadedDataset, type QrelRecord, type QueryRecord, type QueryScope } from "./dataset.ts";
import type { UseCaseResult } from "../search.ts";

export const WIN_LOSS_NDCG_THRESHOLD = 0.05;
const CI_LOW_PERCENTILE = 0.025;
const CI_HIGH_PERCENTILE = 0.975;

export interface QueryEvalResult {
  qid: string;
  query: string;
  stratum: string;
  scope: QueryScope;
  expectedGuide?: string;
  returnedIds: string[];
  returnedTokens: number;
  /** Defined for `in_domain` queries that have at least one guide with grade >= 1 in their qrel pool. */
  ndcg5?: number;
  mrr5?: number;
  success1?: number;
  hit1?: number;
  recall5?: number;
  expectedHit1?: number;
  expectedHit5?: number;
  unjudgedCount: number;
}

export interface StratumSummary {
  count: number;
  answerableCount: number;
  oosCount: number;
  ndcg5?: number;
  success1?: number;
  oosAdmitRate?: number;
  avgTokens: number;
}

export interface DatasetSummary {
  dataset: string;
  totalQueries: number;
  answerableQueries: number;
  oosQueries: number;
  ndcg5: number;
  success1: number;
  hit1: number;
  mrr5: number;
  recall5: number;
  expectedHit1?: number;
  expectedHit5?: number;
  avgReturnedCount: number;
  avgTokensAnswerable: number;
  avgTokensAll: number;
  answerableEmptyRate: number;
  oosAdmitRate: number;
  oosNearAdmitRate?: number;
  oosFarAdmitRate?: number;
  avgOosTokens: number;
  unjudgedRate: number;
  byStratum: Record<string, StratumSummary>;
  perQuery: QueryEvalResult[];
}

export interface BootstrapDelta {
  baseMean: number;
  headMean: number;
  delta: number;
  ciLow: number;
  ciHigh: number;
  significant: boolean;
}

export interface QueryDiffExample {
  qid: string;
  query: string;
  stratum: string;
  baseNdcg5?: number;
  headNdcg5?: number;
  deltaNdcg5?: number;
  baseIds: string[];
  headIds: string[];
  baseTokens: number;
  headTokens: number;
}

export interface DatasetComparison {
  dataset: string;
  base: DatasetSummary;
  head: DatasetSummary;
  ndcg5Delta: BootstrapDelta;
  success1Delta: BootstrapDelta;
  tokensAnswerableDelta: BootstrapDelta;
  oosAdmitDelta?: BootstrapDelta;
  wins: number;
  losses: number;
  ties: number;
  topWins: QueryDiffExample[];
  topLosses: QueryDiffExample[];
  oosNewlyRejected: QueryDiffExample[];
  oosNewlyAdmitted: QueryDiffExample[];
}

function gain(grade: Grade): number {
  return (1 << grade) - 1;
}

function dcgAtK(grades: Grade[], k: number): number {
  let sum = 0;
  const limit = Math.min(grades.length, k);
  for (let i = 0; i < limit; i++) {
    const g = gain(grades[i]);
    if (g > 0) sum += g / Math.log2(i + 2);
  }
  return sum;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function evaluateQuery(
  q: QueryRecord,
  qrel: QrelRecord | undefined,
  results: UseCaseResult[],
  k = 5
): QueryEvalResult {
  const topK = results.slice(0, k);
  const returnedIds = topK.map((r) => r.id);
  const returnedTokens = topK.reduce((sum, r) => sum + (r.tokenCount || 0), 0);
  const rawScope: QueryScope =
    qrel?.scope ?? (q.stratum === "far" || q.stratum === "near" ? "out_of_domain" : "in_domain");
  const stratum = q.stratum ?? q.agent ?? "default";

  const gradeMap = new Map<string, Grade>();
  if (qrel) {
    for (const g of qrel.grades) gradeMap.set(g.id, g.grade);
  }

  let unjudgedCount = 0;
  if (rawScope === "in_domain") {
    for (const id of returnedIds) {
      if (!gradeMap.has(id)) unjudgedCount++;
    }
  }

  const expectedHit1 = q.expectedGuide ? (returnedIds[0] === q.expectedGuide ? 1 : 0) : undefined;
  const expectedHit5 = q.expectedGuide ? (returnedIds.includes(q.expectedGuide) ? 1 : 0) : undefined;

  const allGrades = qrel ? qrel.grades.map((g) => g.grade) : [];
  const positiveGrades = allGrades.filter((g) => g >= 1);
  if (rawScope === "out_of_domain" || positiveGrades.length === 0) {
    return {
      qid: q.qid,
      query: q.query,
      stratum,
      scope: "out_of_domain",
      expectedGuide: q.expectedGuide,
      returnedIds,
      returnedTokens,
      expectedHit1,
      expectedHit5,
      unjudgedCount: rawScope === "out_of_domain" ? 0 : unjudgedCount,
    };
  }

  const idealGrades = [...positiveGrades].sort((a, b) => b - a);
  const idcg = dcgAtK(idealGrades, k);
  const retrievedGrades: Grade[] = returnedIds.map((id) => gradeMap.get(id) ?? 0);
  const dcg = dcgAtK(retrievedGrades, k);
  const ndcg5 = idcg > 0 ? dcg / idcg : 0;

  const firstHitIdx = retrievedGrades.findIndex((g) => g >= 1);
  const mrr5 = firstHitIdx >= 0 ? 1 / (firstHitIdx + 1) : 0;
  const success1 = (retrievedGrades[0] ?? 0) >= 1 ? 1 : 0;
  const hit1 = (retrievedGrades[0] ?? 0) === 2 ? 1 : 0;

  const targetGrade: Grade = idealGrades[0] === 2 ? 2 : 1;
  const totalTargetGuides = allGrades.filter((g) => g >= targetGrade).length;
  const retrievedTargetGuides = retrievedGrades.filter((g) => g >= targetGrade).length;
  const recall5 = totalTargetGuides > 0 ? Math.min(1, retrievedTargetGuides / Math.min(k, totalTargetGuides)) : 0;

  return {
    qid: q.qid,
    query: q.query,
    stratum,
    scope: "in_domain",
    expectedGuide: q.expectedGuide,
    returnedIds,
    returnedTokens,
    ndcg5,
    mrr5,
    success1,
    hit1,
    recall5,
    expectedHit1,
    expectedHit5,
    unjudgedCount,
  };
}

export function summarizeDataset(
  dataset: LoadedDataset,
  resultsByQid: Map<string, UseCaseResult[]>,
  k = 5
): DatasetSummary {
  const perQuery = dataset.queries.map((q) =>
    evaluateQuery(q, dataset.qrels.get(q.qid), resultsByQid.get(q.qid) ?? [], k)
  );

  const answerable = perQuery.filter((r) => r.scope === "in_domain" && r.ndcg5 !== undefined);
  const oos = perQuery.filter((r) => r.scope === "out_of_domain");
  const withExpected = perQuery.filter((r) => r.expectedHit1 !== undefined);

  const totalInDomainReturned = answerable.reduce((s, r) => s + r.returnedIds.length, 0);
  const totalUnjudged = answerable.reduce((s, r) => s + r.unjudgedCount, 0);

  const oosNear = oos.filter((r) => r.stratum === "near");
  const oosFar = oos.filter((r) => r.stratum === "far");

  const byStratum: Record<string, StratumSummary> = {};
  for (const [name, items] of Object.entries(Object.groupBy(perQuery, (r) => r.stratum))) {
    if (!items) continue;
    const ans = items.filter((r) => r.scope === "in_domain" && r.ndcg5 !== undefined);
    const out = items.filter((r) => r.scope === "out_of_domain");
    byStratum[name] = {
      count: items.length,
      answerableCount: ans.length,
      oosCount: out.length,
      ndcg5: ans.length > 0 ? mean(ans.map((r) => r.ndcg5 ?? 0)) : undefined,
      success1: ans.length > 0 ? mean(ans.map((r) => r.success1 ?? 0)) : undefined,
      oosAdmitRate: out.length > 0 ? mean(out.map((r) => (r.returnedIds.length === 0 ? 0 : 1))) : undefined,
      avgTokens: mean(items.map((r) => r.returnedTokens)),
    };
  }

  return {
    dataset: dataset.name,
    totalQueries: perQuery.length,
    answerableQueries: answerable.length,
    oosQueries: oos.length,
    ndcg5: mean(answerable.map((r) => r.ndcg5 ?? 0)),
    success1: mean(answerable.map((r) => r.success1 ?? 0)),
    hit1: mean(answerable.map((r) => r.hit1 ?? 0)),
    mrr5: mean(answerable.map((r) => r.mrr5 ?? 0)),
    recall5: mean(answerable.map((r) => r.recall5 ?? 0)),
    expectedHit1: withExpected.length > 0 ? mean(withExpected.map((r) => r.expectedHit1 ?? 0)) : undefined,
    expectedHit5: withExpected.length > 0 ? mean(withExpected.map((r) => r.expectedHit5 ?? 0)) : undefined,
    avgReturnedCount: mean(answerable.map((r) => r.returnedIds.length)),
    avgTokensAnswerable: mean(answerable.map((r) => r.returnedTokens)),
    avgTokensAll: mean(perQuery.map((r) => r.returnedTokens)),
    answerableEmptyRate: mean(answerable.map((r) => (r.returnedIds.length === 0 ? 1 : 0))),
    oosAdmitRate: mean(oos.map((r) => (r.returnedIds.length === 0 ? 0 : 1))),
    oosNearAdmitRate: oosNear.length > 0 ? mean(oosNear.map((r) => (r.returnedIds.length === 0 ? 0 : 1))) : undefined,
    oosFarAdmitRate: oosFar.length > 0 ? mean(oosFar.map((r) => (r.returnedIds.length === 0 ? 0 : 1))) : undefined,
    avgOosTokens: mean(oos.map((r) => r.returnedTokens)),
    unjudgedRate: totalInDomainReturned > 0 ? totalUnjudged / totalInDomainReturned : 0,
    byStratum,
    perQuery,
  };
}

export function pairedBootstrapDelta(
  baseVals: number[],
  headVals: number[],
  iterations = 2000,
  seed = 42
): BootstrapDelta {
  if (baseVals.length !== headVals.length) {
    throw new Error(`pairedBootstrapDelta: length mismatch (${baseVals.length} vs ${headVals.length})`);
  }
  const n = baseVals.length;
  if (n === 0) {
    return { baseMean: 0, headMean: 0, delta: 0, ciLow: 0, ciHigh: 0, significant: false };
  }

  const baseMean = mean(baseVals);
  const headMean = mean(headVals);
  const delta = headMean - baseMean;

  const diffs = new Float64Array(n);
  for (let i = 0; i < n; i++) diffs[i] = headVals[i] - baseVals[i];

  const rng = createPrng(seed);
  const bootDeltas = new Float64Array(iterations);
  for (let b = 0; b < iterations; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += diffs[Math.floor(rng() * n)];
    }
    bootDeltas[b] = sum / n;
  }
  bootDeltas.sort();

  const ciLow = bootDeltas[Math.floor(iterations * CI_LOW_PERCENTILE)] ?? delta;
  const ciHigh = bootDeltas[Math.floor(iterations * CI_HIGH_PERCENTILE)] ?? delta;
  const significant = (ciLow > 0 && ciHigh > 0) || (ciLow < 0 && ciHigh < 0);

  return { baseMean, headMean, delta, ciLow, ciHigh, significant };
}

function toDiffExample(b: QueryEvalResult, h: QueryEvalResult, deltaNdcg5?: number): QueryDiffExample {
  return {
    qid: b.qid,
    query: b.query,
    stratum: b.stratum,
    baseNdcg5: b.ndcg5,
    headNdcg5: h.ndcg5,
    deltaNdcg5,
    baseIds: b.returnedIds,
    headIds: h.returnedIds,
    baseTokens: b.returnedTokens,
    headTokens: h.returnedTokens,
  };
}

export function compareDatasetSummaries(
  base: DatasetSummary,
  head: DatasetSummary,
  maxExamples = 5
): DatasetComparison {
  const headByQid = new Map(head.perQuery.map((r) => [r.qid, r]));

  const baseNdcg: number[] = [];
  const headNdcg: number[] = [];
  const baseSuccess: number[] = [];
  const headSuccess: number[] = [];
  const baseTokensAns: number[] = [];
  const headTokensAns: number[] = [];
  const baseOosAdmit: number[] = [];
  const headOosAdmit: number[] = [];

  let wins = 0;
  let losses = 0;
  let ties = 0;
  const answerableDiffs: QueryDiffExample[] = [];
  const oosNewlyRejected: QueryDiffExample[] = [];
  const oosNewlyAdmitted: QueryDiffExample[] = [];

  for (const b of base.perQuery) {
    const h = headByQid.get(b.qid);
    if (!h) continue;

    if (b.scope === "in_domain" && b.ndcg5 !== undefined && h.ndcg5 !== undefined) {
      baseNdcg.push(b.ndcg5);
      headNdcg.push(h.ndcg5);
      baseSuccess.push(b.success1 ?? 0);
      headSuccess.push(h.success1 ?? 0);
      baseTokensAns.push(b.returnedTokens);
      headTokensAns.push(h.returnedTokens);

      const d = h.ndcg5 - b.ndcg5;
      if (d >= WIN_LOSS_NDCG_THRESHOLD) wins++;
      else if (d <= -WIN_LOSS_NDCG_THRESHOLD) losses++;
      else ties++;

      if (Math.abs(d) >= WIN_LOSS_NDCG_THRESHOLD) {
        answerableDiffs.push(toDiffExample(b, h, d));
      }
    } else if (b.scope === "out_of_domain") {
      const bEmpty = b.returnedIds.length === 0;
      const hEmpty = h.returnedIds.length === 0;
      baseOosAdmit.push(bEmpty ? 0 : 1);
      headOosAdmit.push(hEmpty ? 0 : 1);
      if (!bEmpty && hEmpty) oosNewlyRejected.push(toDiffExample(b, h));
      else if (bEmpty && !hEmpty) oosNewlyAdmitted.push(toDiffExample(b, h));
    }
  }

  const topWins = answerableDiffs
    .filter((d) => (d.deltaNdcg5 ?? 0) > 0)
    .sort((a, b) => (b.deltaNdcg5 ?? 0) - (a.deltaNdcg5 ?? 0))
    .slice(0, maxExamples);

  const topLosses = answerableDiffs
    .filter((d) => (d.deltaNdcg5 ?? 0) < 0)
    .sort((a, b) => (a.deltaNdcg5 ?? 0) - (b.deltaNdcg5 ?? 0))
    .slice(0, maxExamples);

  return {
    dataset: base.dataset,
    base,
    head,
    ndcg5Delta: pairedBootstrapDelta(baseNdcg, headNdcg),
    success1Delta: pairedBootstrapDelta(baseSuccess, headSuccess),
    tokensAnswerableDelta: pairedBootstrapDelta(baseTokensAns, headTokensAns),
    oosAdmitDelta: baseOosAdmit.length > 0 ? pairedBootstrapDelta(baseOosAdmit, headOosAdmit) : undefined,
    wins,
    losses,
    ties,
    topWins,
    topLosses,
    oosNewlyRejected: oosNewlyRejected.slice(0, maxExamples),
    oosNewlyAdmitted: oosNewlyAdmitted.slice(0, maxExamples),
  };
}
