import { test, describe } from "node:test";
import assert from "node:assert";
import {
  getComparisonPrompts,
  getCompliancePrompts,
  getCodeAndFrictionPrompts,
  getSynthesizerPrompts
} from "../lib/compare-prompts.ts";
import type { GuideContext, RunContext } from "../lib/compare-evals.ts";

function createMockGuideContext(overrides?: Partial<GuideContext>): GuideContext {
  return {
    guideName: "anchor-positioning",
    taskName: "anchor-tooltip",
    guideContent: "# Anchor Positioning Guide\n".repeat(600),
    expectationsContent: "# Expectations\n".repeat(600),
    taskPrompt: "Create a tooltip anchored to a target element.",
    graderContent: "test(\"tooltip positions correctly\", async () => {});\n".repeat(500),
    baseAppContent: "<div id=\"target\">Target</div>",
    ...overrides
  };
}

function createMockRunContext(overrides?: Partial<RunContext>): RunContext {
  return {
    dir: "/tmp/results/trial-1/1/anchor-positioning/anchor-tooltip/guided",
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
    codeOutput: "<div class=\"tooltip\">Content</div>",
    preprocessed: {
      taggedSteps: [
        {
          stepNumber: 1,
          category: "skill_search",
          thought: "Searching for anchor positioning skill",
          actionName: "search"
        },
        {
          stepNumber: 2,
          category: "guide_retrieval",
          thought: "Retrieving guide anchor-positioning",
          actionName: "retrieve"
        },
        {
          stepNumber: 3,
          category: "code_mutation",
          thought: "Writing index.html with position-anchor",
          actionName: "write_to_file"
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
  test("getComparisonPrompts formats unified system instruction and prompt with subagent tracks, strict payload constraint, and truncated references", () => {
    const guideCtx = createMockGuideContext();
    const ctxA = createMockRunContext({ score: 100 });
    const ctxB = createMockRunContext({ score: 50 });

    const diffBaseVsA = "--- Base\n+++ Run A\n+ added line A";
    const diffBaseVsB = "--- Base\n+++ Run B\n+ added line B";
    const diffAvsB = "--- Run A\n+++ Run B\n- diff";

    const { systemInstruction, prompt } = getComparisonPrompts(
      guideCtx,
      ctxA,
      ctxB,
      diffBaseVsA,
      diffBaseVsB,
      diffAvsB,
      "SUCCESSFUL",
      "FAILED/POORER"
    );

    // Subagent orchestration & strict payload-only constraints
    assert.ok(systemInstruction.includes("Audit Track 1 — Guide Compliance & Chronological Sequencing"));
    assert.ok(systemInstruction.includes("Audit Track 2 — Code Diffs, Grader Alignment & Execution Friction"));
    assert.ok(systemInstruction.includes("Strict Payload-Only Constraint"));
    assert.ok(systemInstruction.includes("### 1. First Meaningful Divergence"));
    assert.ok(systemInstruction.includes("### 2. Root Cause & Friction Analysis"));
    assert.ok(systemInstruction.includes("### 3. Actionable Fix Recommendation"));
    assert.ok(systemInstruction.includes("### 4. Guide Compliance & Milestone Matrix"));

    // Prompt contents
    assert.ok(prompt.includes("### Initial Eval / Task Prompts (Starting Points)"));
    assert.ok(prompt.includes(ctxA.initialPrompt));
    assert.ok(prompt.includes(ctxB.initialPrompt));
    assert.ok(prompt.includes("anchor-positioning"));
    assert.ok(prompt.includes("Run A (SUCCESSFUL - Score: 100%)"));
    assert.ok(prompt.includes("Run B (FAILED/POORER - Score: 50%)"));
    assert.ok(prompt.includes("### Validation Logic (grader.ts)"));
    assert.ok(prompt.includes("#### Diff 1: Base App vs Run A Output"));
    assert.ok(prompt.includes("#### Diff 2: Base App vs Run B Output"));
    assert.ok(prompt.includes("#### Diff 3: Run A Output vs Run B Output"));
    assert.ok(prompt.includes("Expected anchor center to align with target center"));
    assert.ok(prompt.includes("Code Mutations=1"));
    assert.ok(prompt.length < guideCtx.guideContent.length + guideCtx.expectationsContent.length + guideCtx.graderContent.length);
  });

  test("handles sparse and empty run contexts safely without exceptions", () => {
    const sparseGuide = createMockGuideContext({ guideContent: "", expectationsContent: "", graderContent: "" });
    const sparseRunA = createMockRunContext({ resultsJson: [], initialPrompt: "" });
    const sparseRunB = createMockRunContext({ resultsJson: [], initialPrompt: "" });

    assert.doesNotThrow(() => {
      getComparisonPrompts(sparseGuide, sparseRunA, sparseRunB, "", "", "", "COMPARED RUN", "COMPARED RUN");
      getCompliancePrompts(sparseGuide, sparseRunA, sparseRunB, "COMPARED RUN", "COMPARED RUN");
      getCodeAndFrictionPrompts(sparseGuide, sparseRunA, sparseRunB, "", "", "", "COMPARED RUN", "COMPARED RUN");
      getSynthesizerPrompts(sparseGuide, sparseRunA, sparseRunB, "", "", "COMPARED RUN", "COMPARED RUN");
    });
  });
});
