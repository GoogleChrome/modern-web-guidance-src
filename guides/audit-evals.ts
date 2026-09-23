import fs from 'node:fs';
import path from 'node:path';
import { rootDir } from '../lib/paths.ts';
import { getDefaultSolutionAgent } from '../lib/guide-validation.ts';
import { Agents } from '../harness/config.ts';
import { cBold, cCyan, cDim, cGreen, cRed, cYellow } from '../lib/colors.ts';
import { runAgent, setupGuideDevWorkDir } from './lib/utils.ts';
import {
  discoverAuditCapsules,
  analyzeCapsuleStatically,
} from './lib/audit-static-analyzer.ts';
import {
  buildCapsuleContextFileContent,
  buildAuditorInitialPrompt,
  buildReviewerSubAgentPrompt,
  buildAuditorRefinementPrompt,
} from './audit-evals-prompts.ts';
import {
  buildDeterministicBaselineAssessment,
  ensureProposedExpectationDraft,
  normalizeGrade,
  writeAuditReports,
} from './lib/audit-report-generator.ts';
import type {
  AdversarialReviewResult,
  AdversarialTurnRecord,
  AuditScope,
  CapsuleAuditAssessment,
  CapsuleAuditResult,
  DiscoveredCapsule,
  ExpectationIssue,
  StaticAuditSignals,
} from './lib/audit-types.ts';

export interface AuditEvalsOptions {
  pattern?: string;
  targetApp?: string;
  scope?: AuditScope;
  concurrency?: number;
  maxTurns?: number;
  resume?: boolean;
  runId?: string;
  agent?: Agents;
  dryRun?: boolean;
  verbose?: boolean;
}

/**
 * Extracts and parses a JSON object from either a file in workDir or agent stdout.
 */
export function extractJsonFromAgentOutput<T>(
  workDir: string,
  expectedFilename: string,
  stdout: string
): T | null {
  const filePath = path.join(workDir, expectedFilename);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      // Fall through to stdout extraction
    }
  }

  if (!stdout) return null;

  // Try extracting ```json ... ``` block
  const fencedMatch = stdout.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    try {
      return JSON.parse(fencedMatch[1].trim()) as T;
    } catch {
      // Fall through
    }
  }

  // Try matching outermost { ... }
  const firstBrace = stdout.indexOf('{');
  const lastBrace = stdout.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(stdout.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Sanitizes and validates an LLM-returned assessment object, enforcing HIGH/MEDIUM/LOW grades
 * and ensuring proposedExpectationDraft is populated.
 */
function sanitizeAssessment(
  raw: Partial<CapsuleAuditAssessment> | null,
  fallback: CapsuleAuditAssessment,
  scope: AuditScope = 'both'
): CapsuleAuditAssessment {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const expectationIssues: ExpectationIssue[] =
    scope === 'grader'
      ? []
      : Array.isArray(raw.expectationIssues)
        ? raw.expectationIssues.map((e, idx) => {
            const item: ExpectationIssue = {
              id: e.id || `E${idx + 1}`,
              category: e.category || 'MISSING_CORE_REQUIREMENT',
              grade: normalizeGrade(e.grade),
              citation: e.citation || 'expectations.md',
              quoteOrRule: e.quoteOrRule || '',
              counterexampleProof: e.counterexampleProof || '',
              remedy: e.remedy || '',
              proposedExpectationDraft: e.proposedExpectationDraft,
            };
            item.proposedExpectationDraft = ensureProposedExpectationDraft(item);
            return item;
          })
        : fallback.expectationIssues;

  const graderIssues =
    scope === 'expectations'
      ? []
      : Array.isArray(raw.graderIssues)
        ? raw.graderIssues.map((g, idx) => ({
            id: g.id || `G${idx + 1}`,
            category: g.category || 'FALSE_NEGATIVE_UNPROMPTED_LOCATOR',
            grade: normalizeGrade(g.grade),
            citation: g.citation || 'grader.ts',
            offendingCode: g.offendingCode || '',
            counterexampleProof: g.counterexampleProof || '',
            remedy: g.remedy || '',
          }))
        : fallback.graderIssues;

  const overallPriority = normalizeGrade(raw.overallPriority ?? fallback.overallPriority);
  const expectationCoverageScore =
    scope === 'grader'
      ? 100
      : typeof raw.expectationCoverageScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.expectationCoverageScore)))
        : fallback.expectationCoverageScore;
  const graderFidelityScore =
    scope === 'expectations'
      ? 100
      : typeof raw.graderFidelityScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(raw.graderFidelityScore)))
        : fallback.graderFidelityScore;

  return {
    overallPriority,
    expectationCoverageScore,
    graderFidelityScore,
    expectationIssues,
    graderIssues,
    executiveSummary: raw.executiveSummary || fallback.executiveSummary,
  };
}

/**
 * Runs the 3-turn Adversarial Auditor <-> Review SubAgent loop for a single capsule.
 */
export async function runAdversarialAuditLoopForCapsule(
  capsule: DiscoveredCapsule,
  staticSignals: StaticAuditSignals,
  options: {
    agent: Agents;
    maxTurns: number;
    scope?: AuditScope;
    dryRun?: boolean;
    verbose?: boolean;
  }
): Promise<{
  finalAssessment: CapsuleAuditAssessment;
  turnsTaken: number;
  consensusReached: boolean;
  adversarialHistory: AdversarialTurnRecord[];
}> {
  const scope: AuditScope = options.scope ?? 'both';
  const baseline = buildDeterministicBaselineAssessment(capsule, staticSignals, scope);

  if (options.dryRun) {
    return {
      finalAssessment: baseline,
      turnsTaken: 1,
      consensusReached: true,
      adversarialHistory: [
        {
          turnNumber: 1,
          assessment: baseline,
          review: {
            agreed: true,
            summary: 'Dry-run static assessment.',
            critiques: [],
          },
        },
      ],
    };
  }

  const slug = capsule.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '-');
  const workDir = setupGuideDevWorkDir(`audit-${slug}`, undefined, options.agent);
  const adversarialHistory: AdversarialTurnRecord[] = [];
  const cappedMaxTurns = Math.max(1, Math.min(3, options.maxTurns));

  try {
    const guideMd = fs.existsSync(capsule.guideFilePath)
      ? fs.readFileSync(capsule.guideFilePath, 'utf8')
      : '';
    const expectationsMd = fs.existsSync(capsule.expectationsFilePath)
      ? fs.readFileSync(capsule.expectationsFilePath, 'utf8')
      : '';
    const taskMd = fs.existsSync(capsule.taskFilePath)
      ? fs.readFileSync(capsule.taskFilePath, 'utf8')
      : '';
    const graderTs = fs.existsSync(capsule.graderFilePath)
      ? fs.readFileSync(capsule.graderFilePath, 'utf8')
      : '';

    const contextMd = buildCapsuleContextFileContent(
      capsule,
      guideMd,
      expectationsMd,
      taskMd,
      graderTs,
      staticSignals
    );
    fs.writeFileSync(path.join(workDir, 'capsule-context.md'), contextMd, 'utf8');

    // Turn 1: Initial Assessment by Lead Auditor Agent
    if (options.verbose) {
      console.log(cDim(`    [${capsule.capsuleId}] Turn 1: Running Auditor Agent (scope: ${scope})...`));
    }
    const initialPrompt = buildAuditorInitialPrompt('audit-assessment.json', scope);
    const initialStdout = await runAgent(options.agent, initialPrompt, workDir, {
      captureOutput: true,
    });
    const rawInitial = extractJsonFromAgentOutput<CapsuleAuditAssessment>(
      workDir,
      'audit-assessment.json',
      initialStdout
    );
    let currentAssessment = sanitizeAssessment(rawInitial, baseline, scope);
    fs.writeFileSync(
      path.join(workDir, 'audit-assessment.json'),
      JSON.stringify(currentAssessment, null, 2),
      'utf8'
    );

    let consensusReached = false;
    let turnsTaken = 1;

    for (let turn = 1; turn <= cappedMaxTurns; turn++) {
      turnsTaken = turn;
      if (options.verbose) {
        console.log(
          cDim(`    [${capsule.capsuleId}] Turn ${turn}: Running Assessment Review SubAgent...`)
        );
      }

      const reviewFile = `review-result-t${turn}.json`;
      const reviewPrompt = buildReviewerSubAgentPrompt(
        turn,
        'audit-assessment.json',
        reviewFile,
        scope
      );
      const reviewStdout = await runAgent(options.agent, reviewPrompt, workDir, {
        captureOutput: true,
      });

      const rawReview = extractJsonFromAgentOutput<AdversarialReviewResult>(
        workDir,
        reviewFile,
        reviewStdout
      );

      const reviewResult: AdversarialReviewResult = {
        agreed: rawReview ? Boolean(rawReview.agreed) : true,
        summary: rawReview?.summary || 'Review completed.',
        critiques: Array.isArray(rawReview?.critiques) ? rawReview!.critiques : [],
      };

      if (reviewResult.critiques.length === 0) {
        reviewResult.agreed = true;
      }

      adversarialHistory.push({
        turnNumber: turn,
        assessment: currentAssessment,
        review: reviewResult,
      });

      if (reviewResult.agreed) {
        consensusReached = true;
        if (options.verbose) {
          console.log(
            cGreen(`    [${capsule.capsuleId}] Consensus reached on turn ${turn}!`)
          );
        }
        break;
      }

      if (turn < cappedMaxTurns) {
        if (options.verbose) {
          console.log(
            cYellow(
              `    [${capsule.capsuleId}] Reviewer raised ${reviewResult.critiques.length} critique(s). Refining assessment (Turn ${turn + 1})...`
            )
          );
        }
        fs.writeFileSync(
          path.join(workDir, 'review-result.json'),
          JSON.stringify(reviewResult, null, 2),
          'utf8'
        );
        const refinePrompt = buildAuditorRefinementPrompt(
          turn + 1,
          'audit-assessment.json',
          'review-result.json',
          scope
        );
        const refineStdout = await runAgent(options.agent, refinePrompt, workDir, {
          captureOutput: true,
        });
        const rawRefined = extractJsonFromAgentOutput<CapsuleAuditAssessment>(
          workDir,
          'audit-assessment.json',
          refineStdout
        );
        currentAssessment = sanitizeAssessment(rawRefined, currentAssessment, scope);
        fs.writeFileSync(
          path.join(workDir, 'audit-assessment.json'),
          JSON.stringify(currentAssessment, null, 2),
          'utf8'
        );
      }
    }

    return {
      finalAssessment: currentAssessment,
      turnsTaken,
      consensusReached,
      adversarialHistory,
    };
  } finally {
    try {
      const tempHome = path.dirname(workDir);
      fs.rmSync(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 300 });
    } catch {
      // Ignore sandbox cleanup warnings
    }
  }
}

/**
 * Resolves the run directory under harness/results/eval-audits/<runId>.
 */
export function resolveAuditRunDir(options: { resume?: boolean; runId?: string }): {
  runId: string;
  runDir: string;
} {
  const baseAuditDir = path.join(rootDir, 'harness', 'results', 'eval-audits');
  fs.mkdirSync(baseAuditDir, { recursive: true });

  if (options.runId) {
    return {
      runId: options.runId,
      runDir: path.join(baseAuditDir, options.runId),
    };
  }

  if (options.resume) {
    const existing = fs
      .readdirSync(baseAuditDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => ({
        name: d.name,
        mtime: fs.statSync(path.join(baseAuditDir, d.name)).mtimeMs,
      }))
      .sort((a, b) => b.mtime - a.mtime);

    if (existing.length > 0) {
      const latestRunId = existing[0].name;
      return {
        runId: latestRunId,
        runDir: path.join(baseAuditDir, latestRunId),
      };
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const newRunId = `audit-${timestamp}`;
  return {
    runId: newRunId,
    runDir: path.join(baseAuditDir, newRunId),
  };
}

/**
 * Main entry point to run the expectations and grader fidelity audit across guides.
 */
export async function runAuditEvals(options: AuditEvalsOptions = {}): Promise<{
  summaryPath: string;
  htmlPath: string;
  jsonPath: string;
  results: CapsuleAuditResult[];
}> {
  const effectiveAgent = options.agent ?? (getDefaultSolutionAgent() as Agents);
  const concurrency = Math.max(1, options.concurrency ?? 2);
  const maxTurns = Math.max(1, Math.min(3, options.maxTurns ?? 3));
  const scope: AuditScope = options.scope ?? 'both';

  const { runId, runDir } = resolveAuditRunDir({
    resume: options.resume,
    runId: options.runId,
  });
  const itemsDir = path.join(runDir, 'items');
  fs.mkdirSync(itemsDir, { recursive: true });

  const capsules = discoverAuditCapsules({
    pattern: options.pattern,
    targetApp: options.targetApp,
  });

  console.log(
    `\n🔍 ${cBold('Guide Expectations & Grader Fidelity Auditor')} (${cCyan(runId)})`
  );
  console.log(
    `   Filter: ${cCyan(options.pattern || '* (all guides)')} | Scope: ${cCyan(scope)} | Found: ${cBold(String(capsules.length))} capsule(s)`
  );
  console.log(
    `   Agent: ${cCyan(effectiveAgent)} | Concurrency: ${concurrency} | Max Adversarial Turns: ${maxTurns}${options.dryRun ? cYellow(' [DRY-RUN STATIC MODE]') : ''}\n`
  );

  if (capsules.length === 0) {
    console.warn(cYellow('No matching guide capsules found.'));
    const { summaryPath, htmlPath, jsonPath } = writeAuditReports(runDir, [], runId);
    return { summaryPath, htmlPath, jsonPath, results: [] };
  }

  const completedResults: CapsuleAuditResult[] = [];
  const pendingCapsules: DiscoveredCapsule[] = [];

  for (const capsule of capsules) {
    const slug = capsule.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
    const checkpointFile = path.join(itemsDir, `${slug}.json`);
    if (options.resume && fs.existsSync(checkpointFile)) {
      try {
        const cached = JSON.parse(
          fs.readFileSync(checkpointFile, 'utf8')
        ) as CapsuleAuditResult;
        completedResults.push(cached);
        console.log(
          `  ⏭️  [Resumed] ${cCyan(capsule.capsuleId.padEnd(42))} Priority: ${cached.finalAssessment.overallPriority}`
        );
        continue;
      } catch {
        // Re-run if checkpoint file was corrupted
      }
    }
    pendingCapsules.push(capsule);
  }

  // Write initial summary if any resumed results exist
  if (completedResults.length > 0) {
    writeAuditReports(runDir, completedResults, runId);
  }

  let currentIndex = 0;
  const totalCount = capsules.length;

  async function worker(): Promise<void> {
    while (currentIndex < pendingCapsules.length) {
      const idx = currentIndex++;
      const capsule = pendingCapsules[idx];
      const overallIdx = completedResults.length + 1;
      const startTime = Date.now();

      console.log(
        `  ⏳ [${overallIdx}/${totalCount}] Auditing ${cBold(capsule.capsuleId)} (${cDim(capsule.guideFormat)}, scope: ${cCyan(scope)})...`
      );

      try {
        const staticSignals = await analyzeCapsuleStatically(capsule, scope);
        const { finalAssessment, turnsTaken, consensusReached, adversarialHistory } =
          await runAdversarialAuditLoopForCapsule(capsule, staticSignals, {
            agent: effectiveAgent,
            maxTurns,
            scope,
            dryRun: options.dryRun,
            verbose: options.verbose,
          });

        const durationMs = Date.now() - startTime;
        const result: CapsuleAuditResult = {
          capsuleId: capsule.capsuleId,
          guideId: capsule.guideId,
          category: capsule.category,
          guideName: capsule.guideName,
          guideFormat: capsule.guideFormat,
          targetApp: capsule.targetApp,
          auditScope: scope,
          guideFilePath: capsule.guideFilePath,
          expectationsFilePath: capsule.expectationsFilePath,
          graderFilePath: capsule.graderFilePath,
          taskFilePath: capsule.taskFilePath,
          demoFilePath: capsule.demoFilePath,
          timestamp: new Date().toISOString(),
          durationMs,
          turnsTaken,
          consensusReached,
          staticSignals,
          finalAssessment,
          adversarialHistory,
        };

        const slug = capsule.capsuleId.replace(/[^a-zA-Z0-9_-]/g, '__');
        const checkpointFile = path.join(itemsDir, `${slug}.json`);
        fs.writeFileSync(checkpointFile, JSON.stringify(result, null, 2), 'utf8');

        completedResults.push(result);
        writeAuditReports(runDir, completedResults, runId);

        const pBadge =
          finalAssessment.overallPriority === 'HIGH'
            ? cRed('HIGH')
            : finalAssessment.overallPriority === 'MEDIUM'
              ? cYellow('MEDIUM')
              : cGreen('LOW');
        const verifBadge = consensusReached
          ? cGreen(`Agreed (${turnsTaken}t)`)
          : cYellow(`Capped (${turnsTaken}t)`);

        console.log(
          `  ✅ [${completedResults.length}/${totalCount}] ${cBold(capsule.capsuleId.padEnd(40))} Priority: ${pBadge} | Exp: ${finalAssessment.expectationCoverageScore}% | Grader: ${finalAssessment.graderFidelityScore}% | ${verifBadge}`
        );
      } catch (err) {
        console.error(
          cRed(`  ❌ Error auditing ${capsule.capsuleId}: ${(err as Error).message}`)
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, pendingCapsules.length) }, () =>
    worker()
  );
  await Promise.all(workers);

  const { summaryPath, htmlPath, jsonPath } = writeAuditReports(runDir, completedResults, runId);

  console.log(`\n🎉 ${cBold('Audit Complete!')}`);
  console.log(`   🌐 HTML Report:      ${cCyan(htmlPath)}`);
  console.log(`   📄 Summary Markdown: ${cCyan(summaryPath)}`);
  console.log(`   📊 JSON Results:     ${cCyan(jsonPath)}\n`);

  return { summaryPath, htmlPath, jsonPath, results: completedResults };
}
