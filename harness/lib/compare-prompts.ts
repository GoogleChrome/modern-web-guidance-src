import type { GuideContext, RunContext } from './compare-evals.ts';

export function getCompliancePrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are a specialized Web Guidance Compliance Auditor. Your task is to evaluate whether two agent runs (Run A vs Run B) successfully discovered, retrieved, and adhered to the MANDATORY requirements in guide.md and expectations.md.

Specifically analyze:
1. **Starting Point & Eval Prompt Audit**: Inspect the initial eval prompt given to Run A vs Run B (Initial Eval / Task Prompts). Verify if both runs received the exact same initial instructions. If the initial prompts are identical, state clearly that both runs started from an identical prompt, so any divergence in behavior is due to agent decision-making or execution timeline differences (such as searching/retrieving the guide before vs after writing code).
2. **Chronological Execution & Sequencing Audit**: Check the step numbers and order of events in the Chronological Milestone Timeline. Did the agent search for and retrieve the mandatory guide *before* writing or modifying code? If an agent wrote code first (e.g. code mutation) and only searched for or retrieved the guide later (or not at all), flag this as a critical sequencing failure ("Premature coding before guide retrieval").
3. **Skill Discovery & Search**: Compare search queries used by Run A vs Run B. Did the search query accurately surface the guide, or did it miss due to vague/generic phrasing?
4. **Guide Retrieval & Reading**: Did the agent actually retrieve guide.md before implementing code changes?
5. **Mandatory Rule Adoption**: Compare agent thinking/reasoning steps against MANDATORY guide requirements. Did an agent explicitly ignore, bypass, or misunderstand a mandatory rule (e.g. opting for JS instead of CSS, omitting fallback, missing required HTML attributes)?
6. **Compliance Discrepancy**: Explain how guide compliance, step sequencing, and rule adoption directly account for the difference in score between Run A (${ctxA.score}%) and Run B (${ctxB.score}%).`;

  const timelineA = ctxA.preprocessed.taggedSteps.filter(s => s.category !== 'incidental_noise').map(s => `Step ${s.stepNumber}: [${s.category}] ${s.actionName} - ${s.thought?.slice(0, 80)}`);
  const timelineB = ctxB.preprocessed.taggedSteps.filter(s => s.category !== 'incidental_noise').map(s => `Step ${s.stepNumber}: [${s.category}] ${s.actionName} - ${s.thought?.slice(0, 80)}`);

  const prompt = `### Initial Eval / Task Prompts (Starting Points)
- Run A Initial Prompt: """${ctxA.initialPrompt}"""
- Run B Initial Prompt: """${ctxB.initialPrompt}"""

### Task Prompt
"""
${guideCtx.taskPrompt}
"""

### Reference Guidance (guide.md)
"""
${guideCtx.guideContent.slice(0, 4000)}
"""

### Expected Outcomes (expectations.md)
"""
${guideCtx.expectationsContent.slice(0, 3000)}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Chronological Milestone Timeline:
${JSON.stringify(timelineA, null, 2)}
- Search Queries: ${JSON.stringify(ctxA.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxA.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules:
${JSON.stringify(ctxA.preprocessed.mandatoryRulesAdopted, null, 2)}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Chronological Milestone Timeline:
${JSON.stringify(timelineB, null, 2)}
- Search Queries: ${JSON.stringify(ctxB.preprocessed.searchQueries)}
- Retrieved Guide IDs: ${JSON.stringify(ctxB.preprocessed.retrievedGuideIds)}
- Key Adopted Thoughts / Rules:
${JSON.stringify(ctxB.preprocessed.mandatoryRulesAdopted, null, 2)}
`;

  return { systemInstruction, prompt };
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
  const systemInstruction = `You are a Code & Execution Diagnostic Sub-Agent. Your task is to identify the precise technical reason why Run A failed Playwright tests that Run B passed (or vice versa), using factual evidence from starting prompts, execution sequencing, grader code, error traces, and exact code diffs.

Mandatory Audit Steps:
1. **Starting Point & Launch Prompt Audit**: Inspect the initial eval prompt (Initial Eval / Task Prompts). If both runs received identical starting instructions, do NOT claim the prompt was defective, truncated, or malformed. State clearly that both runs started from identical instructions.
2. **Execution Timeline & Sequencing Check**: Check the order of tool executions in Tagged Trajectory Steps Overview. Did the failing agent write or modify code *before* retrieving the required guide? Note if premature coding caused the agent to miss required identifiers, functions, or DOM structures.
3. **Grader & Error Trace Check**: Inspect \`grader.ts\` and the exact Playwright error logs. Did the test fail due to a strict locator mismatch (e.g. querying \`button\` when the agent created \`<a>\`), timing issues, missing required CSS rules, or missing functionality? State the exact line of \`grader.ts\` and the failure message.
4. **Base App Diff Audit**: Compare what Run A and Run B modified relative to the Base App. Do NOT attribute missing/extra styles in Run A to "corrupted code" or "botched search/replace" unless Run A actually deleted existing lines that were present in the Base App. Distinguish carefully between code deleted by Run A vs new code added exclusively by Run B.
5. **Execution vs. Trajectory Status**: Check whether the file modification tool calls (\`write_file\`, \`multi_replace_file_content\`, etc.) succeeded or returned errors in the trajectory. Do not claim the agent hallucinated or botched an edit if the tool reported \`status: success\` and produced valid HTML/CSS/JS.
6. **Friction Assessment**: Only cite context noise or retries as a contributing factor if trajectory logs explicitly show the model losing track of instructions, entering error recovery loops, or making blind retries. If the agent completed its edits cleanly on the first try but chose an incompatible HTML element (like \`<a>\` instead of \`<button>\`), state clearly that this was a locator alignment/implementation choice rather than context loss.`;

  const failedTracesA = (ctxA.resultsJson || []).filter((c: any) => !c.passed).map((c: any) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const failedTracesB = (ctxB.resultsJson || []).filter((c: any) => !c.passed).map((c: any) => ({
    assertion: c.message,
    location: c.location ? `Line ${c.location.line}` : 'Unknown',
    errors: c.errors || ['Unknown error']
  }));

  const prompt = `### Initial Eval / Task Prompts (Starting Points)
- Run A Initial Prompt: """${ctxA.initialPrompt}"""
- Run B Initial Prompt: """${ctxB.initialPrompt}"""

### Validation Logic (grader.ts)
"""
${guideCtx.graderContent.slice(0, 15000)}
"""

### Run A (${statusA} - Score: ${ctxA.score}%)
- Dir: ${ctxA.dir}
- Passed Assertions: ${JSON.stringify((ctxA.resultsJson || []).filter((c: any) => c.passed).map((c: any) => c.message))}
- Failed Test Traces:
${JSON.stringify(failedTracesA, null, 2)}
- Trajectory Tagged Steps Summary:
  - Code Mutations: ${ctxA.preprocessed.codeMutationCount}
  - Context Noise Steps: ${ctxA.preprocessed.noiseCount}
  - Error/Retry Loops: ${ctxA.preprocessed.errorLoopCount}

### Run B (${statusB} - Score: ${ctxB.score}%)
- Dir: ${ctxB.dir}
- Passed Assertions: ${JSON.stringify((ctxB.resultsJson || []).filter((c: any) => c.passed).map((c: any) => c.message))}
- Failed Test Traces:
${JSON.stringify(failedTracesB, null, 2)}
- Trajectory Tagged Steps Summary:
  - Code Mutations: ${ctxB.preprocessed.codeMutationCount}
  - Context Noise Steps: ${ctxB.preprocessed.noiseCount}
  - Error/Retry Loops: ${ctxB.preprocessed.errorLoopCount}

### Code Diffs (Unified Diff Format)

#### Diff 1: Base App vs Run A Output
"""
${diffBaseVsA.slice(0, 30000)}
"""

#### Diff 2: Base App vs Run B Output
"""
${diffBaseVsB.slice(0, 30000)}
"""

#### Diff 3: Run A Output vs Run B Output
"""
${diffAvsB.slice(0, 30000)}
"""

### Tagged Trajectory Steps Overview
#### Run A:
${JSON.stringify(ctxA.preprocessed.taggedSteps.map(s => ({ step: s.stepNumber, cat: s.category, action: s.actionName, thought: s.thought?.slice(0, 100) })), null, 2)}

#### Run B:
${JSON.stringify(ctxB.preprocessed.taggedSteps.map(s => ({ step: s.stepNumber, cat: s.category, action: s.actionName, thought: s.thought?.slice(0, 100) })), null, 2)}
`;

  return { systemInstruction, prompt };
}

export function getSynthesizerPrompts(
  guideCtx: GuideContext,
  ctxA: RunContext,
  ctxB: RunContext,
  complianceAnalysis: string,
  codeAndFrictionAnalysis: string,
  statusA: string,
  statusB: string
): { systemInstruction: string; prompt: string } {
  const systemInstruction = `You are an expert Lead Diagnostic Engineer synthesizing a variance diagnosis between two AI agent evaluation runs.

You MUST structure your report into exactly the following four sections in Markdown format. Do not alter section titles or their order:

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

  const prompt = `### Guide & Task Context
- Guide Name: ${guideCtx.guideName}
- Task Name: ${guideCtx.taskName}

### Run A (${statusA} - Score: ${ctxA.score}%, Dir: ${ctxA.dir})
- Initial Prompt: """${ctxA.initialPrompt}"""
### Run B (${statusB} - Score: ${ctxB.score}%, Dir: ${ctxB.dir})
- Initial Prompt: """${ctxB.initialPrompt}"""

### Sub-Agent 1: Guide Compliance Analysis
"""
${complianceAnalysis}
"""

### Sub-Agent 2: Code-to-Trajectory & Friction Analysis
"""
${codeAndFrictionAnalysis}
"""`;

  return { systemInstruction, prompt };
}
