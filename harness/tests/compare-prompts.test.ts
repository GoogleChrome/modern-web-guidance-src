import { test, describe } from "node:test";
import assert from "node:assert";
import { getCompliancePrompts, getCodeAndFrictionPrompts, getSynthesizerPrompts } from "../lib/compare-prompts.ts";
import type { GuideContext, RunContext } from "../lib/compare-evals.ts";

function createMockGuideContext(overrides?: Partial<GuideContext>): GuideContext {
  return {
    guideName: "anchor-positioning",
    taskName: "anchor-tooltip",
    guideContent: "# Anchor Positioning Guide\n".repeat(300),
    expectationsContent: "# Expectations\n".repeat(300),
    taskPrompt: "Create a tooltip anchored to a target element.",
    graderContent: "test(\"tooltip positions correctly\", async () => {});\n".repeat(500),
    baseAppContent: "<div id=\"target\">Target</div>",
    ...overrides
  };
}

function createMockRunContext(overrides?: Partial<RunContext>): RunContext {
  return {
    dir: "/tmp/results/trial-1/1/anchor-positioning/anchor-tooltip/guided",
    runNumber: 1,
    score: 85,
    resultsJson: [
      { message: "should position tooltip above", passed: true },
      {
        message: "should align with fallback",
        passed: false,
        location: { file: "grader.ts", line: 45, column: 3 },
        errors: ["Expected anchor center to align with target center"]
      }
    ],
    trajectorySummary: {
      agent: "claude-code",
      initialPrompt: "Create a tooltip anchored to a target element with fallback.",
      steps: []
    },
    codeOutput: "<div class=\"tooltip\">Content</div>",
    codePath: "index.html",
    preprocessed: {
      taggedSteps: [
        {
          stepNumber: 1,
          category: "skill_search",
          thought: "Searching for anchor positioning skill",
          actionName: "search",
          actionDetails: "{\"query\":\"anchor positioning\"}",
          isError: false,
          raw: { stepNumber: 1 }
        },
        {
          stepNumber: 2,
          category: "guide_retrieval",
          thought: "Retrieving guide anchor-positioning",
          actionName: "retrieve",
          actionDetails: "{\"id\":\"anchor-positioning\"}",
          isError: false,
          raw: { stepNumber: 2 }
        },
        {
          stepNumber: 3,
          category: "code_mutation",
          thought: "Writing index.html with position-anchor",
          actionName: "write_to_file",
          actionDetails: "{\"TargetFile\":\"index.html\"}",
          isError: false,
          raw: { stepNumber: 3 }
        }
      ],
      searchQueries: ["anchor positioning"],
      retrievedGuideIds: ["anchor-positioning"],
      mandatoryRulesAdopted: ["Must use position-anchor and anchor() fallback"],
      codeMutationCount: 1,
      noiseCount: 0,
      errorLoopCount: 0
    },
    initialPrompt: "Create a tooltip anchored to a target element with fallback.",
    ...overrides
  };
}

describe("compare-prompts pipeline", () => {
  test("getCompliancePrompts formats system instruction and prompt with truncated references", () => {
    const guideCtx = createMockGuideContext();
    const ctxA = createMockRunContext({ score: 100 });
    const ctxB = createMockRunContext({ score: 0 });

    const { systemInstruction, prompt } = getCompliancePrompts(guideCtx, ctxA, ctxB, "SUCCESSFUL", "FAILED");

    assert.ok(systemInstruction.includes("Web Guidance Compliance Auditor"));
    assert.ok(prompt.includes("### Initial Eval / Task Prompts (Starting Points)"));
    assert.ok(prompt.includes(ctxA.initialPrompt));
    assert.ok(prompt.includes(ctxB.initialPrompt));
    assert.ok(prompt.includes("anchor-positioning"));
    assert.ok(prompt.includes("Run A (SUCCESSFUL - Score: 100%)"));
    assert.ok(prompt.includes("Run B (FAILED - Score: 0%)"));
    assert.ok(prompt.length < guideCtx.guideContent.length + guideCtx.expectationsContent.length);
  });

  test("getCodeAndFrictionPrompts builds diffs and error traces correctly", () => {
    const guideCtx = createMockGuideContext();
    const ctxA = createMockRunContext({ score: 100 });
    const ctxB = createMockRunContext({ score: 50 });

    const diffBaseVsA = "--- Base\n+++ Run A\n+ added line A";
    const diffBaseVsB = "--- Base\n+++ Run B\n+ added line B";
    const diffAvsB = "--- Run A\n+++ Run B\n- diff";

    const { systemInstruction, prompt } = getCodeAndFrictionPrompts(
      guideCtx,
      ctxA,
      ctxB,
      diffBaseVsA,
      diffBaseVsB,
      diffAvsB,
      "SUCCESSFUL",
      "FAILED/POORER"
    );

    assert.ok(systemInstruction.includes("Code & Execution Diagnostic Sub-Agent"));
    assert.ok(prompt.includes("### Validation Logic (grader.ts)"));
    assert.ok(prompt.includes("#### Diff 1: Base App vs Run A Output"));
    assert.ok(prompt.includes("#### Diff 2: Base App vs Run B Output"));
    assert.ok(prompt.includes("#### Diff 3: Run A Output vs Run B Output"));
    assert.ok(prompt.includes("Expected anchor center to align with target center"));
    assert.ok(prompt.includes("Code Mutations: 1"));
  });

  test("getSynthesizerPrompts combines sub-agent analyses into synthesis prompt", () => {
    const guideCtx = createMockGuideContext();
    const ctxA = createMockRunContext({ score: 100 });
    const ctxB = createMockRunContext({ score: 0 });

    const complianceAnalysis = "Run A retrieved the guide before writing code; Run B skipped guide retrieval.";
    const codeAndFrictionAnalysis = "Run A used anchor-name; Run B attempted JS scroll listener.";

    const { systemInstruction, prompt } = getSynthesizerPrompts(
      guideCtx,
      ctxA,
      ctxB,
      complianceAnalysis,
      codeAndFrictionAnalysis,
      "SUCCESSFUL",
      "FAILED"
    );

    assert.ok(systemInstruction.includes("Lead Diagnostic Engineer synthesizing a variance diagnosis"));
    assert.ok(systemInstruction.includes("### 1. First Meaningful Divergence"));
    assert.ok(systemInstruction.includes("### 2. Root Cause & Friction Analysis"));
    assert.ok(systemInstruction.includes("### 3. Actionable Fix Recommendation"));
    assert.ok(systemInstruction.includes("### 4. Guide Compliance & Milestone Matrix"));

    assert.ok(prompt.includes("### Sub-Agent 1: Guide Compliance Analysis"));
    assert.ok(prompt.includes(complianceAnalysis));
    assert.ok(prompt.includes("### Sub-Agent 2: Code-to-Trajectory & Friction Analysis"));
    assert.ok(prompt.includes(codeAndFrictionAnalysis));
  });

  test("handles sparse and empty run contexts safely without exceptions", () => {
    const sparseGuide = createMockGuideContext({ guideContent: "", expectationsContent: "", graderContent: "" });
    const sparseRunA = createMockRunContext({ resultsJson: [], initialPrompt: "" });
    const sparseRunB = createMockRunContext({ resultsJson: [], initialPrompt: "" });

    assert.doesNotThrow(() => {
      getCompliancePrompts(sparseGuide, sparseRunA, sparseRunB, "COMPARED RUN", "COMPARED RUN");
      getCodeAndFrictionPrompts(sparseGuide, sparseRunA, sparseRunB, "", "", "", "COMPARED RUN", "COMPARED RUN");
      getSynthesizerPrompts(sparseGuide, sparseRunA, sparseRunB, "", "", "COMPARED RUN", "COMPARED RUN");
    });
  });
});
