import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { outDir } from "../../core/paths.ts";
import { Agents } from "../../harness/config.ts";
import {
  ensureWildDataset,
  loadPublicDataset,
  parseManifestJson,
  parseQrelsJsonl,
  parseQueriesJsonl,
  serializeQrelsJsonl,
  serializeQueriesJsonl,
  sha256,
  type QrelRecord,
} from "./dataset.ts";
import { extractCardHeadings, poolQueryCandidates, type CorpusForPooling } from "./judge-fill.ts";
import { buildJudgePrompt, parseJudgeResponse, type GuideCard } from "./judge-prompts.ts";
import { extractSearchQueriesFromTrajectory, resolveAgentFromSuiteId, sampleHarnessQueries } from "./mine-harness.ts";
import { compareDatasetSummaries, evaluateQuery, pairedBootstrapDelta, summarizeDataset } from "./metrics.ts";
import { sampleWildQueries } from "./refresh-wild.ts";

describe("dataset parsers and serializers", () => {
  it("round-trips queries and qrels JSONL", () => {
    const queries = [
      { qid: "q1", query: "native modal dialog", stratum: "traffic", freq: 5, words: 3 },
      { qid: "q2", query: "autofill address form", expectedGuide: "autofill-address-form", agent: Agents.CLAUDE_CODE, words: 3 },
    ];
    const parsedQueries = parseQueriesJsonl(serializeQueriesJsonl(queries));
    assert.deepStrictEqual(parsedQueries.map((q) => q.qid), ["q1", "q2"]);
    assert.strictEqual(parsedQueries[1]?.agent, Agents.CLAUDE_CODE);

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

describe("pooling, mining, and wild sampling helpers", () => {
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

  it("pools union of dense max, dense mean, and expectedGuide", () => {
    const cards = new Map<string, GuideCard>([
      ["g1", { id: "g1", title: "G1", description: "d1", category: "c", headings: [] }],
      ["g2", { id: "g2", title: "G2", description: "d2", category: "c", headings: [] }],
      ["g3", { id: "g3", title: "G3", description: "d3", category: "c", headings: [] }],
    ]);
    const corpus: CorpusForPooling = {
      cards,
      vectors: [
        { id: "g1", description: "d1", category: "c", featuresUsed: [], tokenCount: 100, vector: [1, 0] },
        { id: "g1", description: "d1", category: "c", featuresUsed: [], tokenCount: 100, vector: [0, 0] },
        { id: "g2", description: "d2", category: "c", featuresUsed: [], tokenCount: 100, vector: [0.8, 0] },
      ],
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

  it("samples traffic and low-similarity wild strata while excluding existing queries", () => {
    const events = [
      { query: "modal dialog", topSimilarity: 0.65 },
      { query: "modal dialog", topSimilarity: 0.65 },
      { query: "anchor positioning", topSimilarity: 0.55 },
      { query: "prisma schema migration", topSimilarity: 0.31 },
    ];
    const sampled = sampleWildQueries(events, new Set(["modal dialog"]), {
      trafficCount: 1,
      lowSimCount: 1,
    });
    assert.deepStrictEqual(
      sampled.map((s) => [s.query, s.stratum]),
      [
        ["anchor positioning", "traffic"],
        ["prisma schema migration", "lowsim"],
      ]
    );
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
});
