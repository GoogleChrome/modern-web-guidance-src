import type { GuideContext, RunContext, TaggedStep } from './compare-evals.ts';

export const MAX_GUIDE_PROMPT_CHARS = 8000;
export const MAX_EXPECTATIONS_PROMPT_CHARS = 6000;
export const MAX_GRADER_PROMPT_CHARS = 12000;
export const MAX_DIFF_PROMPT_CHARS = 15000;
export const MAX_INLINE_STEPS_PER_RUN = 80;
export const MAX_TOTAL_COMBINED_PROMPT_BYTES = 92000;
const MAX_PROMPT_FIELD_CHARS = 1500;
const MAX_FAILED_TRACES_CHARS = 2500;

function truncateAtLineBoundary(text: string, limit: number): string {
  if (!text || text.length <= limit) return text;
  const truncated = text.slice(0, limit);
  const lastNewline = truncated.lastIndexOf('\n');
  const safeCut = lastNewline > limit * 0.8 ? truncated.slice(0, lastNewline) : truncated;
  return `${safeCut}\n\n[... Truncated for prompt length budget (${text.length - safeCut.length} characters omitted; full text in comparison_context.md) ...]`;
}

export function formatCappedStepsOverview(
  steps: TaggedStep[],
  maxSteps = MAX_INLINE_STEPS_PER_RUN
): string {
  const nonNoise = steps.filter(s => s.category !== 'incidental_noise');
  const noise = steps.filter(s => s.category === 'incidental_noise');

  let selected: TaggedStep[];
  let omittedNoiseCount = 0;

  if (steps.length <= maxSteps) {
    selected = steps;
  } else if (nonNoise.length >= maxSteps) {
    selected = nonNoise.slice(0, maxSteps);
    omittedNoiseCount = noise.length;
  } else {
    const allowedNoiseCount = maxSteps - nonNoise.length;
    const selectedNoise = noise.slice(0, allowedNoiseCount);
    omittedNoiseCount = noise.length - selectedNoise.length;
    selected = [...nonNoise, ...selectedNoise].sort((a, b) => a.stepNumber - b.stepNumber);
  }

  const omittedTotal = steps.length - selected.length;
  const lines = selected.map(
    s => `- Step ${s.stepNumber} [${s.category}] ${s.actionName || 'action'}: ${(s.thought || '').replace(/\s+/g, ' ').slice(0, 65)}`
  );

  if (omittedTotal > 0) {
    lines.push(`[... ${omittedTotal} steps omitted from inline overview (${omittedNoiseCount} incidental_noise steps); see full trajectory in comparison_context.md ...]`);
  }
  return lines.join('\n');
}

export function getComparisonPrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  diffBaseVsA: string,
  diffBaseVsB: string,
  diffAvsB: string,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an expert Lead Diagnostic Engineer performing a variance diagnosis between two AI agent evaluation runs (Run A vs Run B).

### Execution & Orchestration Protocol
1. **Subagent Delegation (When Available)**:
   When subagent tools are available in your runtime, use your subagents to independently audit the two orthogonal diagnostic axes in parallel before synthesizing:
   - **Audit Track 1 — Guide Compliance & Chronological Sequencing**:
     - Verify whether Run A and Run B received identical initial evaluation prompts. If identical, state clearly that both runs started from an identical prompt.
     - Check step numbers and chronological order: did the agent search for and retrieve \`guide.md\` *before* mutating code (\`code_mutation\`)? Flag any code edits made prior to guide retrieval as "Premature coding before guide retrieval".
     - Compare search queries, retrieved guide IDs, and adoption of MANDATORY requirements from \`guide.md\` and \`expectations.md\`.
   - **Audit Track 2 — Code Diffs, Grader Alignment & Execution Friction**:
     - Inspect \`grader.ts\` and exact Playwright failure traces/locations to pinpoint the exact locator, DOM structure, CSS rule, or timing mismatch.
     - Compare Base App vs Run A and Base App vs Run B diffs. Distinguish between existing Base App lines deleted by a run vs new lines added exclusively by the other run.
     - Check trajectory tool outcomes (\`status: success\` vs \`status: error\`) and error retry loops. Only cite context noise or tool friction if trajectory logs show actual errors or blind retries.
   If subagents are unavailable, execute both audit tracks systematically yourself and synthesize the results.

2. **Strict Payload-Only Constraint (MANDATORY)**:
   - Diagnose **strictly** from the provided prompt payload and the uncapped reference files written inside your current isolated comparison workspace (\`comparison_context.md\`, \`guide.md\`, \`expectations.md\`, \`grader.ts\`, \`diff_base_vs_a.patch\`, \`diff_base_vs_b.patch\`, \`diff_a_vs_b.patch\`, \`run_a_trajectory.json\`, \`run_b_trajectory.json\`).
   - **DO NOT** read, search, or inspect the main repository (\`guides/\`, \`tasks/\`, \`harness/\`, \`base-apps/\`, etc.) or run repository-wide search tools outside your current working directory. Never confuse current repository \`HEAD\` or live guides with what Run A and Run B actually produced.

3. **Required Output Format (No Preamble)**:
   - Output **ONLY** the final Markdown report starting directly with \`### 1. First Meaningful Divergence\`. Do not emit conversational narration (such as "I will start the investigation...") before the first heading.
   - Structure your report into **exactly** the following four sections in Markdown format:

### 1. First Meaningful Divergence
- **Step Number**: Specify exact step number for Trial A and Trial B if they differ (e.g., Trial A Step 4, Trial B Step 7, or Step 0/Launch if initial eval prompt differed right at initialization)
- **Event Type**: [Starting Prompt / Harness Launch | Skill Search | Guide Retrieval | Mandatory Rule Adoption | Code Implementation | Error Recovery]
- **Divergence Summary**: Direct, objective explanation of why this specific step represents the root divergence point based on factual starting prompts, tool outputs, execution timeline (e.g. writing code before retrieving the guide vs after), and code choices. Do NOT claim a prompt was truncated or malformed unless the initial prompt text itself was actually defective.

### 2. Root Cause & Friction Analysis
- **Problem Classification**: List ALL that apply from: [Guide not retrieved | Guide not followed | Grader too strict | System error]
  - **Classification Definitions**:
    - **Guide not retrieved**: The agent failed to search for or retrieve the mandatory guide before implementing code changes.
    - **Guide not followed**: The outcome or implementation code produced by the agent does not meet the requirements or intentions of the guide.
    - **Grader too strict**: The outcome meets the intentions of the guide, but the test harness or Playwright grader still fails it (e.g. rigid element tag requirement like \`<button>\` vs \`<a>\`, or checking computed style directly on an element when the agent used a valid pseudo-element).
    - **System error**: Anything else, such as the eval failing to complete, unparseable logs, harness runtime crash, or API failure.
  *(Note: If more than one category applies, list all applicable categories separated by commas, e.g. "Classification: [Grader too strict], [Guide not followed]").*
- **Technical Breakdown**:
  - Provide an objective, strictly fact-grounded breakdown detailing why each classified category applies.
  - Highlight execution sequencing issues if applicable (e.g. agent mutating files before reading guidance).
  - State the exact locator, API, or DOM mismatch that triggered any Playwright failures, referencing specific lines in \`grader.ts\` and error logs.
  - Do NOT fabricate narrative claims about context loss or botched edits unless trajectory logs show explicit tool errors or loops.

### 3. Actionable Fix Recommendation
Provide clear, concrete recommendations on whether to update:
- **Harness / Launch Prompt**: (only if the eval harness spawned the run with an actually broken or mismatched starting prompt)
- **Guide (guide.md)**: (e.g. add MANDATORY keyword, clarify code example)
- **Prompt (tasks/task.md)**: (e.g. add declarative constraint, clarify trigger element type)
- **Grader (grader.ts)**: (e.g. relax rigid locator like \`button:visible\` to \`button:visible, a:visible, [role="button"]:visible\`, or inspect pseudo-elements)
- **Agent/Model Non-Determinism**: (only if initial prompt, guide, and task instructions were clear and valid, but model still behaved inconsistently or executed tools in the wrong order)

### 4. Guide Compliance & Milestone Matrix
Provide a Markdown table summarizing key milestones:
| Milestone / Metric | Run A (Score: ${ctxA.score}%) | Run B (Score: ${ctxB.score}%) | Status |
| :--- | :--- | :--- | :---: |
| **Initial Eval / Starting Prompt** | ... | ... | ... |
| **Skill Search Query** | ... | ... | ... |
| **Guide Retrieval** | ... | ... | ... |
| **Mandatory Rule Adoption** | ... | ... | ... |
| **Context Noise / Retries** | ... | ... | ... |`;

  const failedTracesA = (ctxA.resultsJson || []).filter((c) => !c.passed).map((c) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const failedTracesB = (ctxB.resultsJson || []).filter((c) => !c.passed).map((c) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const prompt = `### Guide & Task Metadata
- Guide Name: ${guideCtx.guideName}
- Task Name: ${guideCtx.taskName}

### Initial Eval / Task Prompts (Starting Points)
- Run A Initial Prompt: """${truncateAtLineBoundary(ctxA.initialPrompt, MAX_PROMPT_FIELD_CHARS)}"""
- Run B Initial Prompt: """${truncateAtLineBoundary(ctxB.initialPrompt, MAX_PROMPT_FIELD_CHARS)}"""

### Task Prompt
"""
${truncateAtLineBoundary(guideCtx.taskPrompt, MAX_PROMPT_FIELD_CHARS)}
"""

### Reference Guidance (guide.md)
"""
${truncateAtLineBoundary(guideCtx.guideContent, MAX_GUIDE_PROMPT_CHARS)}
"""

### Expected Outcomes (expectations.md)
"""
${truncateAtLineBoundary(guideCtx.expectationsContent, MAX_EXPECTATIONS_PROMPT_CHARS)}
"""

### Validation Logic (grader.ts)
"""
${truncateAtLineBoundary(guideCtx.graderContent, MAX_GRADER_PROMPT_CHARS)}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Dir: ${ctxA.dir}
- Search Queries: ${JSON.stringify(ctxA.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxA.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules: ${JSON.stringify(ctxA.preprocessed.mandatoryRulesAdopted.slice(0, 15))}
- Passed Assertions: ${JSON.stringify((ctxA.resultsJson || []).filter((c) => c.passed).map((c) => c.message))}
- Failed Test Traces:
${truncateAtLineBoundary(JSON.stringify(failedTracesA, null, 2), MAX_FAILED_TRACES_CHARS)}
- Trajectory Metrics: Code Mutations=${ctxA.preprocessed.codeMutationCount}, Noise Steps=${ctxA.preprocessed.noiseCount}, Error/Retry Loops=${ctxA.preprocessed.errorLoopCount}
- Tagged Trajectory Steps Overview (Run A):
${formatCappedStepsOverview(ctxA.preprocessed.taggedSteps)}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Dir: ${ctxB.dir}
- Search Queries: ${JSON.stringify(ctxB.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxB.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules: ${JSON.stringify(ctxB.preprocessed.mandatoryRulesAdopted.slice(0, 15))}
- Passed Assertions: ${JSON.stringify((ctxB.resultsJson || []).filter((c) => c.passed).map((c) => c.message))}
- Failed Test Traces:
${truncateAtLineBoundary(JSON.stringify(failedTracesB, null, 2), MAX_FAILED_TRACES_CHARS)}
- Trajectory Metrics: Code Mutations=${ctxB.preprocessed.codeMutationCount}, Noise Steps=${ctxB.preprocessed.noiseCount}, Error/Retry Loops=${ctxB.preprocessed.errorLoopCount}
- Tagged Trajectory Steps Overview (Run B):
${formatCappedStepsOverview(ctxB.preprocessed.taggedSteps)}

### Code Diffs (Unified Diff Format)

#### Diff 1: Base App vs Run A Output
"""
${truncateAtLineBoundary(diffBaseVsA, MAX_DIFF_PROMPT_CHARS)}
"""

#### Diff 2: Base App vs Run B Output
"""
${truncateAtLineBoundary(diffBaseVsB, MAX_DIFF_PROMPT_CHARS)}
"""

#### Diff 3: Run A Output vs Run B Output
"""
${truncateAtLineBoundary(diffAvsB, MAX_DIFF_PROMPT_CHARS)}
"""
`;

  const maxPromptBytes = MAX_TOTAL_COMBINED_PROMPT_BYTES - Buffer.byteLength(systemInstruction, 'utf8') - 1024;
  const boundedPrompt =
    Buffer.byteLength(prompt, 'utf8') > maxPromptBytes
      ? truncateAtLineBoundary(prompt, maxPromptBytes)
      : prompt;

  return { systemInstruction, prompt: boundedPrompt };
}

export function getCompliancePrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  return getComparisonPrompts(guideCtx, ctxA, ctxB, '', '', '', statusA, statusB);
}

export function getCodeAndFrictionPrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  diffBaseVsA: string,
  diffBaseVsB: string,
  diffAvsB: string,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  return getComparisonPrompts(guideCtx, ctxA, ctxB, diffBaseVsA, diffBaseVsB, diffAvsB, statusA, statusB);
}

export function getSynthesizerPrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  _complianceAnalysis: string,
  _codeAndFrictionAnalysis: string,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  return getComparisonPrompts(guideCtx, ctxA, ctxB, '', '', '', statusA, statusB);
}

