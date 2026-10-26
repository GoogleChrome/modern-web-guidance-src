import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { outDir } from "../../core/paths.ts";
import { Agents } from "../../harness/config.ts";
import { buildBm25Index } from "../bm25.ts";
import {
  DEFAULT_WILD_VERSION,
  createQueryRecord,
  ensureWildDataset,
  filterDatasetBySplit,
  loadPublicDataset,
  parseManifestJson,
  parseQrelsJsonl,
  parseQueriesJsonl,
  serializeQrelsJsonl,
  serializeQueriesJsonl,
  sha256,
  validateQueryRecord,
  type QrelRecord,
} from "./dataset.ts";
import { extractCardHeadings, poolQueryCandidates, type CorpusForPooling } from "./judge-fill.ts";
import { buildJudgePrompt, parseJudgeResponse, type GuideCard } from "./judge-prompts.ts";
import { extractSearchQueriesFromTrajectory, mineLocalSuitesDir, resolveAgentFromSuiteId, sampleHarnessQueries } from "./mine-harness.ts";
import { compareDatasetSummaries, evaluateQuery, pairedBootstrapDelta, summarizeDataset } from "./metrics.ts";

describe("dataset parsers and serializers", () => {
  it("round-trips queries and qrels JSONL", () => {
    const queries = [
      { qid: "q1", query: "native modal dialog", stratum: "traffic", freq: 5, words: 3 },
      {
        qid: "q2",
        query: "autofill address form",
        expectedGuide: "autofill-address-form",
        agent: Agents.CLAUDE_CODE,
        words: 3,
        calledList: true,
        retriedSearch: false,
        retrievedGuides: ["autofill-address-form"],
      },
    ];
    const parsedQueries = parseQueriesJsonl(serializeQueriesJsonl(queries));
    assert.deepStrictEqual(parsedQueries.map((item) => item.qid), ["q1", "q2"]);
    assert.strictEqual(parsedQueries[1]?.agent, Agents.CLAUDE_CODE);
    assert.strictEqual(parsedQueries[1]?.calledList, true);
    assert.strictEqual(parsedQueries[1]?.retriedSearch, false);
    assert.deepStrictEqual(parsedQueries[1]?.retrievedGuides, ["autofill-address-form"]);

    const qrels = [
      {
        qid: "q1",
        query: "native modal dialog",
        scope: "in_domain" as const,
        needs: ["modal dialog"],
        grades: [{ id: "light-dismiss-a-dialog", grade: 2 as const, reason: "Covers dialog dismiss" }],
        judgeModel: "gemini-3.8-flash",
        rubricVersion: "v1",
      },
    ];
    const parsedQrels = parseQrelsJsonl(serializeQrelsJsonl(qrels));
    assert.strictEqual(parsedQrels.get("q1")?.grades[0]?.grade, 2);
  });

  it("rejects malformed records at the boundary", async (t) => {
    await t.test("duplicate qid", () => {
      assert.throws(
        () => parseQueriesJsonl('{"qid":"q1","query":"a"}\n{"qid":"q1","query":"b"}\n'),
        /Duplicate qid "q1"/
      );
    });
    await t.test("invalid agent", () => {
      assert.throws(
        () => parseQueriesJsonl('{"qid":"q1","query":"a","agent":"unknown_agent"}\n'),
        /Invalid agent/
      );
    });
    await t.test("out-of-range grade", () => {
      assert.throws(
        () =>
          parseQrelsJsonl(
            '{"qid":"q1","query":"a","scope":"in_domain","needs":[],"grades":[{"id":"g1","grade":3}],"judgeModel":"m","rubricVersion":"v1"}\n'
          ),
        /Invalid grade entry/
      );
    });
    await t.test("invalid calledList", () => {
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", calledList: "true" }),
        /Invalid calledList.*expected boolean/
      );
    });
    await t.test("invalid retriedSearch", () => {
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", retriedSearch: 1 }),
        /Invalid retriedSearch.*expected boolean/
      );
    });
    await t.test("invalid retrievedGuides", () => {
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", retrievedGuides: "guide" }),
        /Invalid retrievedGuides.*expected array of non-empty strings/
      );
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", retrievedGuides: [""] }),
        /Invalid retrievedGuides.*expected array of non-empty strings/
      );
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", retrievedGuides: [123] }),
        /Invalid retrievedGuides.*expected array of non-empty strings/
      );
    });
    await t.test("invalid split", () => {
      assert.throws(
        () => validateQueryRecord({ qid: "q1", query: "a", split: "other" }),
        /Invalid split.*expected "dev" or "test"/
      );
    });
    await t.test("valid split", () => {
      const qDev = validateQueryRecord({ qid: "q1", query: "a", split: "dev" });
      assert.strictEqual(qDev.split, "dev");
      const qTest = validateQueryRecord({ qid: "q2", query: "b", split: "test" });
      assert.strictEqual(qTest.split, "test");
    });
  });
});

describe("checked-in public datasets (harness & oos)", () => {
  it("loads harness dataset with 160 queries, matching qrels, and valid corpus expectedGuides", () => {
    const harness = loadPublicDataset("harness");
    assert.strictEqual(harness.queries.length, 160);
    assert.strictEqual(harness.qrels.size, 160);

    const guidesJson: { id: string }[] = JSON.parse(
      fs.readFileSync(path.join(outDir, "build/skills-cli/guides.json"), "utf8")
    );
    const validIds = new Set(guidesJson.map((g) => g.id));

    const missingQrelQids = harness.queries.filter((q) => !harness.qrels.has(q.qid)).map((q) => q.qid);
    assert.deepStrictEqual(missingQrelQids, []);

    const orphanedExpectedGuides = harness.queries
      .filter((q) => !q.expectedGuide || !validIds.has(q.expectedGuide))
      .map((q) => q.qid);
    assert.deepStrictEqual(orphanedExpectedGuides, []);
  });

  it("loads curated oos dataset with 50 far and 40 near out-of-domain queries", () => {
    const oos = loadPublicDataset("oos");
    assert.strictEqual(oos.queries.length, 90);
    assert.strictEqual(oos.qrels.size, 90);
    assert.strictEqual(oos.queries.filter((q) => q.stratum === "far").length, 50);
    assert.strictEqual(oos.queries.filter((q) => q.stratum === "near").length, 40);
    assert.ok([...oos.qrels.values()].every((r) => r.scope === "out_of_domain" && r.grades.length === 0));
  });
});

describe("ensureWildDataset cache verification", () => {
  it("loads from local cache when SHA-256 hashes match manifest.json and rejects tampered files", async (t) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rag-wild-test-"));
    t.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
    const vDir = path.join(tmpDir, "v99");
    fs.mkdirSync(vDir, { recursive: true });

    const queriesContent = serializeQueriesJsonl([{ qid: "w1", query: "popover api", words: 2 }]);
    const qrelsContent = serializeQrelsJsonl([
      {
        qid: "w1",
        query: "popover api",
        scope: "in_domain",
        needs: ["popover"],
        grades: [{ id: "html", grade: 2 }],
        judgeModel: "gemini-3.8-flash",
        rubricVersion: "v1",
      },
    ]);
    const manifest = {
      version: "v99",
      createdAt: "2026-10-13T00:00:00Z",
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
      files: {
        "wild-queries.jsonl": { rows: 1, sha256: sha256(queriesContent) },
        "wild-qrels.jsonl": { rows: 1, sha256: sha256(qrelsContent) },
      },
    };

    fs.writeFileSync(path.join(vDir, "wild-queries.jsonl"), queriesContent);
    fs.writeFileSync(path.join(vDir, "wild-qrels.jsonl"), qrelsContent);
    fs.writeFileSync(path.join(vDir, "manifest.json"), JSON.stringify(manifest));

    const parsedManifest = parseManifestJson(fs.readFileSync(path.join(vDir, "manifest.json"), "utf8"));
    assert.strictEqual(parsedManifest.version, "v99");

    const loaded = await ensureWildDataset("v99", { cacheDir: tmpDir, allowDownload: false });
    assert.strictEqual(loaded.queries.length, 1);
    assert.strictEqual(loaded.qrels.get("w1")?.grades[0]?.id, "html");

    fs.writeFileSync(path.join(vDir, "wild-queries.jsonl"), queriesContent + "\n");
    await assert.rejects(
      () => ensureWildDataset("v99", { cacheDir: tmpDir, allowDownload: false }),
      /SHA-256 mismatch/
    );
  });

  it("exports DEFAULT_WILD_VERSION as v2 and filters datasets by split", () => {
    assert.strictEqual(DEFAULT_WILD_VERSION, "v2");
    const mockDataset = {
      name: "wild-v2",
      queries: [
        createQueryRecord({ qid: "w1", query: "popover", split: "dev" }),
        createQueryRecord({ qid: "w2", query: "dialog", split: "test" }),
      ],
      qrels: new Map([
        ["w1", { qid: "w1", query: "popover", scope: "in_domain" as const, needs: [], grades: [], judgeModel: "m", rubricVersion: "v1" }],
        ["w2", { qid: "w2", query: "dialog", scope: "in_domain" as const, needs: [], grades: [], judgeModel: "m", rubricVersion: "v1" }],
      ]),
    };
    const devSplit = filterDatasetBySplit(mockDataset, "dev");
    assert.strictEqual(devSplit.name, "wild-v2-dev");
    assert.strictEqual(devSplit.queries.length, 1);
    assert.strictEqual(devSplit.queries[0].qid, "w1");
    assert.strictEqual(devSplit.qrels.size, 1);
    assert.strictEqual(devSplit.qrels.has("w1"), true);

    const testSplit = filterDatasetBySplit(mockDataset, "test");
    assert.strictEqual(testSplit.name, "wild-v2-test");
    assert.strictEqual(testSplit.queries.length, 1);
    assert.strictEqual(testSplit.queries[0].qid, "w2");
    assert.strictEqual(testSplit.qrels.size, 1);
    assert.strictEqual(testSplit.qrels.has("w2"), true);
  });
});

describe("judge-prompts", () => {
  const cards: GuideCard[] = [
    { id: "g1", title: "Guide One", description: "First guide", category: "css", headings: ["Usage"] },
    { id: "g2", title: "Guide Two", description: "Second guide", category: "html", headings: ["Markup"] },
  ];

  it("formats candidate cards into the judge prompt and validates complete responses", () => {
    const prompt = buildJudgePrompt("css hover state", cards);
    assert.ok(prompt.includes("### g1"));
    assert.ok(prompt.includes("### g2"));

    const fakeResponse = {
      candidates: [
        {
          content: {
            parts: [
              { thought: true, text: "thinking..." },
              {
                text: JSON.stringify({
                  scope: "in_domain",
                  needs: ["hover styling"],
                  grades: [
                    { id: "g1", grade: 2, reason: "Direct match" },
                    { id: "g2", grade: 0, reason: "Unrelated" },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    const parsed = parseJudgeResponse(fakeResponse, "css hover state", new Set(["g1", "g2"]));
    assert.strictEqual(parsed.scope, "in_domain");
    assert.deepStrictEqual(parsed.grades.map((g) => [g.id, g.grade]), [
      ["g1", 2],
      ["g2", 0],
    ]);
  });

  it("rejects judge responses that omit a candidate or invent an unknown candidate", () => {
    const omittedResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ scope: "in_domain", needs: ["x"], grades: [{ id: "g1", grade: 1 }] }) }],
          },
        },
      ],
    };
    assert.throws(
      () => parseJudgeResponse(omittedResponse, "query", new Set(["g1", "g2"])),
      /Judge omitted candidate "g2"/
    );
  });
});

describe("pooling and mining helpers", () => {
  it("extractCardHeadings strips boilerplate subheadings, ignores fenced code, and preserves all H2 sections before H3s on long guides", () => {
    const md = [
      "# Forms",
      "## Table of Contents",
      "## 1. Semantic Structure",
      "### Guidelines",
      "### Code Example",
      "### Selection Matrix",
      "## 2. Accessible Labeling",
      "### DOs",
      "### DON'Ts",
      "```bash",
      "## not a heading, just a shell comment",
      "```",
      "## 3. Autofill",
    ].join("\n");
    assert.deepStrictEqual(extractCardHeadings(md, 3), [
      "1. Semantic Structure",
      "2. Accessible Labeling",
      "3. Autofill",
    ]);
  });

  it("pools union of dense max, dense mean, BM25, and expectedGuide", () => {
    const cards = new Map<string, GuideCard>([
      ["g1", { id: "g1", title: "G1", description: "d1", category: "c", headings: [] }],
      ["g2", { id: "g2", title: "G2", description: "d2", category: "c", headings: [] }],
      ["g3", { id: "g3", title: "G3", description: "d3", category: "c", headings: [] }],
    ]);
    const corpus: CorpusForPooling = {
      cards,
      vectors: [
        { id: "g1", description: "d1", category: "c", featuresUsed: [], tokenCount: 100, vector: [1, 0], chunkContent: "alpha" },
        { id: "g2", description: "d2", category: "c", featuresUsed: [], tokenCount: 100, vector: [0, 1], chunkContent: "user-invalid validation" },
      ],
      bm25: buildBm25Index([
        { id: "g1", text: "alpha" },
        { id: "g2", text: "user-invalid validation" },
      ]),
    };

    const pooled = poolQueryCandidates("user-invalid", [1, 0], corpus, {
      poolDepth: 1,
      expectedGuide: "g3",
    });
    assert.deepStrictEqual([...pooled].sort(), ["g1", "g2", "g3"]);
  });

  it("extracts skill_search queries from trajectory summaries and stratifies by agent", () => {
    assert.strictEqual(resolveAgentFromSuiteId("nightly-2026-10-12-claude_code"), Agents.CLAUDE_CODE);
    const summary = {
      steps: [
        {
          action: {
            canonicalCategory: "skill_search",
            name: 'npx -y modern-web-guidance@latest search "view transitions cross document"',
          },
        },
        {
          action: {
            canonicalCategory: "skill_search",
            name: "modern-web-guidance search --json 'popover light dismiss'",
          },
        },
      ],
    };
    const mined = extractSearchQueriesFromTrajectory(summary, {
      suiteId: "s1",
      agent: Agents.CODEX_CLI,
      runDate: "2026-10-12",
      expectedGuide: "consistent-cross-document-transitions",
    });
    assert.deepStrictEqual(
      mined.map((m) => [m.searchIndex, m.query]),
      [
        [0, "view transitions cross document"],
        [1, "popover light dismiss"],
      ]
    );

    const sampled = sampleHarnessQueries(mined, new Set(["consistent-cross-document-transitions"]), { perAgentLimit: 5 });
    assert.strictEqual(sampled.length, 1);
    assert.strictEqual(sampled[0]?.query, "view transitions cross document");
  });

  it("computes nDCG@5, token budgets, OOS admission, and paired bootstrap deltas", () => {
    const q1 = { qid: "q1", query: "modal dialog", stratum: "traffic", words: 2, expectedGuide: "dialogs" };
    const q2 = { qid: "q2", query: "kubernetes ingress", stratum: "far", words: 2 };
    const qrel1: QrelRecord = {
      qid: "q1",
      query: "modal dialog",
      scope: "in_domain",
      needs: ["dialog"],
      grades: [
        { id: "dialogs", grade: 2 },
        { id: "popovers", grade: 1 },
      ],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };
    const qrel2: QrelRecord = {
      qid: "q2",
      query: "kubernetes ingress",
      scope: "out_of_domain",
      needs: [],
      grades: [],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };

    const evalPerfect = evaluateQuery(q1, qrel1, [
      { id: "dialogs", description: "d", category: "ui", tokenCount: 1200, similarity: 0.7 },
      { id: "popovers", description: "p", category: "ui", tokenCount: 800, similarity: 0.5 },
    ]);
    assert.strictEqual(evalPerfect.ndcg5, 1);
    assert.strictEqual(evalPerfect.success1, 1);
    assert.strictEqual(evalPerfect.hit1, 1);
    assert.strictEqual(evalPerfect.returnedTokens, 2000);
    assert.strictEqual(evalPerfect.unjudgedCount, 0);

    const ds = {
      name: "test",
      queries: [q1, q2],
      qrels: new Map([
        ["q1", qrel1],
        ["q2", qrel2],
      ]),
    };

    const baseSummary = summarizeDataset(
      ds,
      new Map([
        ["q1", [{ id: "popovers", description: "p", category: "ui", tokenCount: 800, similarity: 0.5 }]],
        ["q2", [{ id: "dialogs", description: "d", category: "ui", tokenCount: 1200, similarity: 0.35 }]],
      ])
    );
    const headSummary = summarizeDataset(
      ds,
      new Map([
        ["q1", [{ id: "dialogs", description: "d", category: "ui", tokenCount: 1200, similarity: 0.7 }]],
        ["q2", []],
      ])
    );

    const comp = compareDatasetSummaries(baseSummary, headSummary);
    assert.ok(comp.ndcg5Delta.delta > 0.4);
    assert.strictEqual(comp.wins, 1);
    assert.strictEqual(comp.losses, 0);
    assert.strictEqual(comp.oosNewlyRejected.length, 1);

    const boot = pairedBootstrapDelta([0.1, 0.2, 0.1, 0.2], [0.8, 0.9, 0.8, 0.9]);
    assert.strictEqual(boot.significant, true);
    assert.ok(boot.ciLow > 0.5);
  });

  it("caps discipline-guide grade at 1 when a leaf guide is graded 2", () => {
    const queryRec = { qid: "q_cap", query: "address autofill form", stratum: "traffic", words: 3 };
    const qrelWithLeafG2: QrelRecord = {
      qid: "q_cap",
      query: "address autofill form",
      scope: "in_domain",
      needs: ["address autofill"],
      grades: [
        { id: "forms", grade: 2 },
        { id: "autofill-address-form", grade: 2 },
      ],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };

    // When discipline guide "forms" is returned at rank 0:
    // It is capped to 1, so hit1 must be 0, success1 must be 1, disciplineTop1 must be 1.
    const evalFormsTop = evaluateQuery(queryRec, qrelWithLeafG2, [
      { id: "forms", description: "Forms discipline guide", category: "forms", tokenCount: 1500, similarity: 0.85 },
      { id: "autofill-address-form", description: "Autofill address leaf guide", category: "forms", tokenCount: 900, similarity: 0.80 },
    ]);
    assert.strictEqual(evalFormsTop.hit1, 0, "Discipline guide forms should be capped to 1 and not yield hit1");
    assert.strictEqual(evalFormsTop.success1, 1, "Discipline guide forms still counts as success1 (grade >= 1)");
    assert.strictEqual(evalFormsTop.disciplineTop1, 1);
    assert.strictEqual(evalFormsTop.disciplineTop5, 1);
    assert.strictEqual(evalFormsTop.leafRecall5, 1, "Leaf guide autofill-address-form returned in top 5 gives leafRecall5 = 1");

    // When leaf guide "autofill-address-form" is returned at rank 0:
    const evalLeafTop = evaluateQuery(queryRec, qrelWithLeafG2, [
      { id: "autofill-address-form", description: "Autofill address leaf guide", category: "forms", tokenCount: 900, similarity: 0.88 },
      { id: "forms", description: "Forms discipline guide", category: "forms", tokenCount: 1500, similarity: 0.70 },
    ]);
    assert.strictEqual(evalLeafTop.hit1, 1, "Dedicated leaf guide yields hit1 = 1");
    assert.strictEqual(evalLeafTop.disciplineTop1, 0);
    assert.strictEqual(evalLeafTop.disciplineTop5, 1);
    assert.strictEqual(evalLeafTop.leafRecall5, 1);

    // When no leaf guide is graded 2, discipline guide forms is NOT capped:
    const qrelNoLeafG2: QrelRecord = {
      qid: "q_cap",
      query: "address autofill form",
      scope: "in_domain",
      needs: ["address autofill"],
      grades: [
        { id: "forms", grade: 2 },
        { id: "autofill-address-form", grade: 1 },
      ],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };
    const evalNoCap = evaluateQuery(queryRec, qrelNoLeafG2, [
      { id: "forms", description: "Forms discipline guide", category: "forms", tokenCount: 1500, similarity: 0.85 },
    ]);
    assert.strictEqual(evalNoCap.hit1, 1, "Discipline guide is not capped when no leaf guide is graded 2");
    assert.strictEqual(evalNoCap.leafRecall5, undefined, "leafRecall5 is undefined when totalLeafG2 === 0");
  });

  it("computes leafRecall5, disciplineTop1Rate, and disciplineTop5Rate in summaries and comparisons", () => {
    const queryOne = { qid: "q1", query: "autofill address form", stratum: "traffic", words: 3 };
    const queryTwo = { qid: "q2", query: "accessible modal dialog", stratum: "traffic", words: 3 };

    const qrelOne: QrelRecord = {
      qid: "q1",
      query: "autofill address form",
      scope: "in_domain",
      needs: ["autofill"],
      grades: [
        { id: "forms", grade: 2 },
        { id: "autofill-address-form", grade: 2 },
      ],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };
    const qrelTwo: QrelRecord = {
      qid: "q2",
      query: "accessible modal dialog",
      scope: "in_domain",
      needs: ["dialog"],
      grades: [
        { id: "accessibility", grade: 2 },
        { id: "light-dismiss-a-dialog", grade: 2 },
      ],
      judgeModel: "gemini-3.8-flash",
      rubricVersion: "v1",
    };

    const datasetObj = {
      name: "disc-test",
      queries: [queryOne, queryTwo],
      qrels: new Map([
        ["q1", qrelOne],
        ["q2", qrelTwo],
      ]),
    };

    // Base: query 1 returns forms at top; query 2 returns accessibility at top
    const baseSummary = summarizeDataset(
      datasetObj,
      new Map([
        ["q1", [{ id: "forms", description: "d", category: "c", tokenCount: 1000, similarity: 0.8 }]],
        ["q2", [{ id: "accessibility", description: "d", category: "c", tokenCount: 1000, similarity: 0.8 }]],
      ])
    );
    assert.strictEqual(baseSummary.disciplineTop1Rate, 1.0);
    assert.strictEqual(baseSummary.disciplineTop5Rate, 1.0);
    assert.strictEqual(baseSummary.leafRecall5, 0.0);
    assert.strictEqual(baseSummary.hit1, 0.0);

    // Head: query 1 returns leaf guide at top; query 2 returns leaf guide at top
    const headSummary = summarizeDataset(
      datasetObj,
      new Map([
        ["q1", [{ id: "autofill-address-form", description: "d", category: "c", tokenCount: 800, similarity: 0.9 }]],
        ["q2", [{ id: "light-dismiss-a-dialog", description: "d", category: "c", tokenCount: 800, similarity: 0.9 }]],
      ])
    );
    assert.strictEqual(headSummary.disciplineTop1Rate, 0.0);
    assert.strictEqual(headSummary.disciplineTop5Rate, 0.0);
    assert.strictEqual(headSummary.leafRecall5, 1.0);
    assert.strictEqual(headSummary.hit1, 1.0);

    const comparison = compareDatasetSummaries(baseSummary, headSummary);
    assert.strictEqual(comparison.disciplineTop1Delta.delta, -1.0);
    assert.strictEqual(comparison.disciplineTop5Delta.delta, -1.0);
    assert.ok(comparison.leafRecall5Delta !== undefined);
    assert.strictEqual(comparison.leafRecall5Delta.delta, 1.0);
  });

  it("tracks trajectory behavioral fields calledList, retriedSearch, and retrievedGuides", () => {
    // 1. calledList and retriedSearch
    const summaryWithBehaviors = {
      steps: [
        {
          action: {
            canonicalCategory: "skill_search",
            name: 'npx -y modern-web-guidance search "first search"',
          },
        },
        {
          action: {
            canonicalCategory: "incidental_noise",
            name: "npx -y modern-web-guidance list",
          },
        },
        {
          action: {
            canonicalCategory: "skill_search",
            name: 'npx -y modern-web-guidance search "retry search"',
          },
        },
        {
          action: {
            canonicalCategory: "guide_retrieval",
            name: 'modern-web-guidance retrieve "light-dismiss-a-dialog"',
          },
        },
      ],
    };

    const mined = extractSearchQueriesFromTrajectory(summaryWithBehaviors, {
      suiteId: "s_behavior",
      agent: Agents.CLAUDE_CODE,
      runDate: "2026-10-19",
      expectedGuide: "light-dismiss-a-dialog",
    });

    assert.strictEqual(mined.length, 2);
    // First search was followed by list and another search before guide_retrieval
    assert.strictEqual(mined[0]?.calledList, true);
    assert.strictEqual(mined[0]?.retriedSearch, true);
    // Retried search before guide_retrieval is not credited with later retrieve:
    assert.strictEqual(mined[0]?.retrievedGuides, undefined);

    // Second search was not followed by list, and was followed directly by guide_retrieval
    assert.strictEqual(mined[1]?.calledList, undefined);
    assert.strictEqual(mined[1]?.retriedSearch, undefined);
    assert.deepStrictEqual(mined[1]?.retrievedGuides, ["light-dismiss-a-dialog"]);

    // 2. retrievedGuides from summary.retrievedGuides when present
    const summaryWithExplicitGuides = {
      retrievedGuides: ["autofill-address-form", "dialog-focus-management"],
      steps: [
        {
          action: {
            canonicalCategory: "skill_search",
            name: 'modern-web-guidance search "form autocomplete"',
          },
        },
      ],
    };
    const minedExplicit = extractSearchQueriesFromTrajectory(summaryWithExplicitGuides, {
      suiteId: "s_explicit",
      agent: Agents.CODEX_CLI,
      runDate: "2026-10-19",
      expectedGuide: "autofill-address-form",
    });
    assert.strictEqual(minedExplicit.length, 1);
    assert.deepStrictEqual(minedExplicit[0]?.retrievedGuides, [
      "autofill-address-form",
      "dialog-focus-management",
    ]);

    // 3. sampleHarnessQueries preserves calledList, retriedSearch, and retrievedGuides on QueryRecord
    const sampledWithBehaviors = sampleHarnessQueries(mined, new Set(["light-dismiss-a-dialog"]));
    assert.strictEqual(sampledWithBehaviors.length, 1);
    assert.strictEqual(sampledWithBehaviors[0]?.calledList, true);
    assert.strictEqual(sampledWithBehaviors[0]?.retriedSearch, true);
    assert.strictEqual(sampledWithBehaviors[0]?.retrievedGuides, undefined);

    const sampledExplicit = sampleHarnessQueries(minedExplicit, new Set(["autofill-address-form"]));
    assert.strictEqual(sampledExplicit.length, 1);
    assert.deepStrictEqual(sampledExplicit[0]?.retrievedGuides, [
      "autofill-address-form",
      "dialog-focus-management",
    ]);
  });

  it("extracts search queries and parses retrieval when action.name is Bash or npx and command is in params", () => {
    const summaryWithBashActions = {
      steps: [
        {
          action: {
            name: "Bash",
            canonicalCategory: "skill_search",
            params: {
              command: 'npx -y modern-web-guidance@latest search "form validation" --skill-version 1.0',
            },
          },
        },
        {
          action: {
            name: "Bash",
            canonicalCategory: "skill_search",
            params: {
              CommandLine: 'npx -y modern-web-guidance search "dialog autofocus" --limit 5',
            },
          },
        },
        {
          action: {
            name: "Bash",
            canonicalCategory: "guide_retrieval",
            params: {
              command: 'npx -y modern-web-guidance retrieve "dialog-focus-management"',
            },
          },
        },
      ],
    };

    const mined = extractSearchQueriesFromTrajectory(summaryWithBashActions, {
      suiteId: "s_bash",
      agent: Agents.CLAUDE_CODE,
      runDate: "2026-10-19",
      expectedGuide: "dialog-focus-management",
    });

    assert.strictEqual(mined.length, 2);
    assert.strictEqual(mined[0]?.query, "form validation");
    assert.strictEqual(mined[0]?.retriedSearch, true);
    assert.strictEqual(mined[0]?.retrievedGuides, undefined);

    assert.strictEqual(mined[1]?.query, "dialog autofocus");
    assert.strictEqual(mined[1]?.retriedSearch, undefined);
    assert.deepStrictEqual(mined[1]?.retrievedGuides, ["dialog-focus-management"]);
  });

  it("mines local suites directories supporting nested iteration folders and legacy layouts", (testContext) => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "mine-suites-test-"));
    testContext.after(() => fs.rmSync(tempDir, { recursive: true, force: true }));

    const suiteId = "nightly-2026-10-19-claude_code";
    const nestedSummaryPath = path.join(
      tempDir,
      suiteId,
      "1/accessible-generated-content/daily-grind/guided/trajectory_summary.json"
    );
    const legacySummaryPath = path.join(
      tempDir,
      suiteId,
      "autofill-address-form--basic/task/guided/trajectory_summary.json"
    );

    fs.mkdirSync(path.dirname(nestedSummaryPath), { recursive: true });
    fs.mkdirSync(path.dirname(legacySummaryPath), { recursive: true });

    const summaryContent = (searchQuery: string) =>
      JSON.stringify({
        steps: [
          {
            action: {
              canonicalCategory: "skill_search",
              name: "Bash",
              params: {
                command: `npx -y modern-web-guidance search "${searchQuery}"`,
              },
            },
          },
        ],
      });

    fs.writeFileSync(nestedSummaryPath, summaryContent("aria live polite announcement"), "utf8");
    fs.writeFileSync(legacySummaryPath, summaryContent("autofill autocomplete address"), "utf8");

    const mined = mineLocalSuitesDir(tempDir);
    assert.strictEqual(mined.length, 2);

    const nestedMined = mined.find((item) => item.expectedGuide === "accessible-generated-content");
    assert.ok(nestedMined, "Should find query for accessible-generated-content from nested layout");
    assert.strictEqual(nestedMined?.query, "aria live polite announcement");
    assert.strictEqual(nestedMined?.agent, Agents.CLAUDE_CODE);

    const legacyMined = mined.find((item) => item.expectedGuide === "autofill-address-form");
    assert.ok(legacyMined, "Should find query for autofill-address-form from legacy layout");
    assert.strictEqual(legacyMined?.query, "autofill autocomplete address");
    assert.strictEqual(legacyMined?.agent, Agents.CLAUDE_CODE);
  });
});
