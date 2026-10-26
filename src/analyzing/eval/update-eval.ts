/* oxlint-disable max-lines-per-function, max-depth */
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { parse as parseCss } from 'cssomnom';
import {
  ALL_RULES,
  QUALIFIED_GUIDE_IDS,
  QUALIFIED_RULES,
} from '../rules/index.ts';
import {
  createInMemoryProject,
  scanFiles,
} from '../scanners/index.ts';
import { wilsonInterval, type BinomialInterval } from './stats.ts';
import {
  GEMINI_API_BASE,
  JUDGE_MODEL,
  fetchWithRetry,
  getGeminiApiKey,
  loadGuideSummaryFromMarkdown,
  repoDir,
  type RepoConfigEntry,
} from './detection-eval.ts';
import type { AnalyzerFinding } from '../schema.ts';

const WORKTREE_ROOT = resolve(import.meta.dirname, '../../..');
const GUIDES_DIR = join(WORKTREE_ROOT, 'guides');
const CACHE_ROOT = join(homedir(), '.cache', 'repos');

import {
  UPDATE_SIMULATION_PROMPT_VERSION,
  UPDATE_SIMULATION_PROMPT,
  UPDATE_SIMULATION_RESPONSE_SCHEMA,
  UPDATE_SIMULATION_THINKING_BUDGET,
  formatUpdateSimulationPrompt,
} from './prompts.ts';

export {
  UPDATE_SIMULATION_PROMPT_VERSION,
  UPDATE_SIMULATION_PROMPT,
  UPDATE_SIMULATION_RESPONSE_SCHEMA,
  UPDATE_SIMULATION_THINKING_BUDGET,
  formatUpdateSimulationPrompt,
};

export interface UpdatePatch {
  /** Relative or absolute path to the file being patched */
  readonly filePath: string;
  /** Original file content before updating */
  readonly originalContent: string;
  /** Patched file content produced by the modernization agent */
  readonly patchedContent: string;
  /** Target guide ID being addressed */
  readonly guideId: string;
  /** Specific rule ID that triggered the finding */
  readonly ruleId?: string;
  /** Working directory containing repo context (optional) */
  readonly cwd?: string;
  /** Original window content before updating (if windowed evaluation) */
  readonly originalWindow?: string;
  /** Patched window content produced by the modernization agent (if windowed evaluation) */
  readonly patchedWindow?: string;
}

export interface FindingEliminatedCheckResult {
  readonly passed: boolean;
  readonly findingsRemaining: number;
  readonly failureReason?: string;
}

export interface ModernSyntaxCheckResult {
  readonly passed: boolean;
  readonly syntaxClean: boolean;
  readonly structuralIntegrityPassed: boolean;
  readonly modernFeatureVerified: boolean;
  readonly invariantPassed?: boolean;
  readonly diagnostics: readonly string[];
  readonly failureReason?: string;
}

export interface BehavioralCheckResult {
  readonly passed: boolean;
  readonly status: 'PASSED' | 'FAILED' | 'SKIPPED_NO_TEST_HARNESS';
  readonly failureReason?: string;
}

export interface UpdateValidationResult {
  readonly resolved: boolean;
  readonly staticResolved: boolean;
  readonly guideId: string;
  readonly ruleId?: string;
  readonly filePath: string;
  readonly findingEliminatedCheck: FindingEliminatedCheckResult;
  readonly modernSyntaxCheck: ModernSyntaxCheckResult;
  readonly behavioralCheck: BehavioralCheckResult;
  readonly summary: string;
}

export interface UpdateValidationOptions {
  readonly behavioralCheck?: (patch: UpdatePatch) => Promise<boolean> | boolean;
}

/**
 * Checks whether the modern platform feature prescribed by guide.md
 * is explicitly present in the patched content (Table 2.3 of research report).
 */
export function stripComments(content: string): string {
  return content
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
}

export interface SeededAgentFailureFixture {
  readonly id: string;
  readonly guideId: string;
  readonly filePath: string;
  readonly originalContent: string;
  readonly badPatch: string;
  readonly expectedFailureReason: string;
}

// Load extracted test fixtures and modern feature patterns from external JSON.
// Code contains 0 hardcoded LLM fixture strings or pattern maps.
const updateEvalData = JSON.parse(
  readFileSync(new URL('./update-eval-data.json', import.meta.url), 'utf8'),
) as {
  readonly seededFixtures: SeededFixture[];
  readonly seededAgentFailureFixtures?: SeededAgentFailureFixture[];
  readonly modernFeaturePatterns: Record<string, string>;
};

export function getSeededAgentFailureTestCases(): SeededAgentFailureFixture[] {
  return updateEvalData.seededAgentFailureFixtures ?? [];
}

/**
 * Checks whether the modern platform feature prescribed by guide.md
 * is explicitly present in the patched content (Table 2.3 of research report).
 * All comments are stripped first to prevent comment-only spoofs.
 */
export function checkModernFeaturePresent(
  guideId: string,
  patchedContent: string,
  filePath = '',
): boolean {
  const uncommented = stripComments(patchedContent);

  // Special case for branded-select-styling package.json dependency removal
  if (guideId === 'branded-select-styling') {
    const isBaseSelect = /base-select\b|::picker\s*\(\s*select\s*\)/i.test(uncommented);
    const isCleanPackageJson =
      filePath.endsWith('package.json') &&
      !uncommented.includes('"select2"') &&
      !uncommented.includes('"chosen-js"');
    if (isBaseSelect || isCleanPackageJson) return true;
  }

  const patternStr = updateEvalData.modernFeaturePatterns[guideId];
  if (!patternStr) {
    throw new Error(`Missing Check 2c modern feature validator for guideId: ${guideId}`);
  }

  const regex = new RegExp(patternStr, 'i');
  return regex.test(uncommented);
}

/**
 * Check 2a: Checks syntax and parse validity across JS/TS, HTML, CSS, and JSON.
 */
export function checkSyntaxCleanliness(
  filePath: string,
  content: string,
): { clean: boolean; diagnostics: string[] } {
  const diagnostics: string[] = [];
  if (!content || content.trim().length === 0) {
    return { clean: false, diagnostics: ['Content is empty'] };
  }

  const lower = filePath.toLowerCase();

  // 1. JS / TS / JSX / TSX
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs')
  ) {
    const project = createInMemoryProject();
    const fileName = filePath ? basename(filePath) : 'test-eval.ts';
    const sourceFile = project.createSourceFile(fileName, content, {
      overwrite: true,
    });
    try {
      const diags = sourceFile.getPreEmitDiagnostics();
      const syntaxDiags = diags.filter(
        (d) => d.getCode() >= 1000 && d.getCode() < 2000,
      );
      if (syntaxDiags.length > 0) {
        for (const d of syntaxDiags) {
          const msg =
            typeof d.getMessageText() === 'string'
              ? (d.getMessageText() as string)
              : JSON.stringify(d.getMessageText());
          diagnostics.push(`TS${d.getCode()}: ${msg}`);
        }
        return { clean: false, diagnostics };
      }
    } finally {
      project.removeSourceFile(sourceFile);
    }
    return { clean: true, diagnostics: [] };
  }

  // 2. HTML
  if (
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.vue') ||
    lower.endsWith('.svelte')
  ) {
    try {
      const { document } = parseHTML(content);
      if (!document) {
        return { clean: false, diagnostics: ['Failed to parse HTML document'] };
      }
    } catch (err: unknown) {
      return {
        clean: false,
        diagnostics: [err instanceof Error ? err.message : String(err)],
      };
    }
    return { clean: true, diagnostics: [] };
  }

  // 3. CSS
  if (lower.endsWith('.css')) {
    // Check balanced braces
    const openBraces = (content.match(/\{/g) ?? []).length;
    const closeBraces = (content.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
      return {
        clean: false,
        diagnostics: [
          `Unbalanced CSS braces: ${openBraces} '{' vs ${closeBraces} '}'`,
        ],
      };
    }
    try {
      parseCss(content);
    } catch (err: unknown) {
      return {
        clean: false,
        diagnostics: [err instanceof Error ? err.message : String(err)],
      };
    }
    return { clean: true, diagnostics: [] };
  }

  // 4. JSON
  if (lower.endsWith('.json')) {
    try {
      JSON.parse(content);
    } catch (err: unknown) {
      return {
        clean: false,
        diagnostics: [err instanceof Error ? err.message : String(err)],
      };
    }
    return { clean: true, diagnostics: [] };
  }

  return { clean: true, diagnostics: [] };
}

/**
 * Check 2b: Anti-Gutting & Structural Integrity Guard guarding against gutting or empty implementations.
 * Verifies that the patch does not delete all executable code or exported declarations.
 * Eliminates the legacy 40% line-count threshold so that replacing a 43-line workaround
 * with a concise 5-line standard platform feature is properly recognized as success.
 */
export function checkStructuralIntegrity(
  originalContent: string,
  patchedContent: string,
  filePath: string,
): { passed: boolean; failureReason?: string } {
  const uncommented = stripComments(patchedContent).trim();
  if (uncommented.length === 0) {
    return {
      passed: false,
      failureReason:
        'Structural gutting detected: patched content contains no executable code or markup',
    };
  }

  const lower = filePath.toLowerCase();

  // 1. JS / TS / JSX / TSX
  if (
    lower.endsWith('.js') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.mjs') ||
    lower.endsWith('.cjs')
  ) {
    const project = createInMemoryProject();
    const fileName = filePath ? basename(filePath) : 'eval.ts';
    const origSf = project.createSourceFile('orig-' + fileName, originalContent, {
      overwrite: true,
    });
    const patchedSf = project.createSourceFile('patched-' + fileName, patchedContent, {
      overwrite: true,
    });

    try {
      if (patchedSf.getStatements().length === 0) {
        return {
          passed: false,
          failureReason:
            'Structural gutting detected: no AST statements found in patched JS/TS content',
        };
      }

      // Check if original had top-level export declarations
      const origExports =
        origSf.getExportedDeclarations().size + origSf.getExportAssignments().length;
      const patchedExports =
        patchedSf.getExportedDeclarations().size + patchedSf.getExportAssignments().length;

      if (origExports > 0 && patchedExports === 0) {
        return {
          passed: false,
          failureReason:
            'Structural gutting detected: all exported module symbols were removed from JS/TS patch',
        };
      }
    } finally {
      project.removeSourceFile(origSf);
      project.removeSourceFile(patchedSf);
    }

    return { passed: true };
  }

  // 2. CSS
  if (lower.endsWith('.css')) {
    try {
      const ast = parseCss(patchedContent);
      if (!ast.rules || ast.rules.length === 0) {
        return {
          passed: false,
          failureReason:
            'Structural gutting detected: no CSS rules found in patched stylesheet',
        };
      }
    } catch {
      // Malformed CSS will be caught by Check 2a syntax check
    }
    return { passed: true };
  }

  // 3. HTML / Templates
  if (
    lower.endsWith('.html') ||
    lower.endsWith('.htm') ||
    lower.endsWith('.vue') ||
    lower.endsWith('.svelte')
  ) {
    try {
      const { document } = parseHTML(patchedContent);
      const hasNodes =
        Boolean(document.firstElementChild) ||
        (document.body && document.body.childNodes.length > 0) ||
        (document.head && document.head.childNodes.length > 0) ||
        document.childNodes.length > 0;
      if (!hasNodes) {
        return {
          passed: false,
          failureReason:
            'Structural gutting detected: no markup elements or nodes found in patched HTML',
        };
      }
    } catch {
      /* ignore html parse errors */
    }
    return { passed: true };
  }

  // 4. JSON
  if (lower.endsWith('.json')) {
    try {
      const obj = JSON.parse(patchedContent);
      if (typeof obj === 'object' && obj !== null && Object.keys(obj).length === 0) {
        const origObj = JSON.parse(originalContent);
        if (typeof origObj === 'object' && origObj !== null && Object.keys(origObj).length > 0) {
          return {
            passed: false,
            failureReason:
              'Structural gutting detected: all keys removed from JSON object',
          };
        }
      }
    } catch {
      /* ignore json parse errors */
    }
    return { passed: true };
  }

  return { passed: true };
}

/**
 * Verifies that modernized code does not introduce the 3 agent failure modes:
 * 1. Unrequested dual-path fallback bloat (@supports / typeof fallback when original had none).
 * 2. Coupled-property breakage (e.g., migrating transform -> scale/translate/rotate, but leaving transition/will-change on transform).
 * 3. Cross-layer contract mismatch (e.g., using commandfor targeting a <div> without popover attribute).
 */
export function checkAgentModernizationInvariants(
  guideId: string,
  originalContent: string,
  patchedContent: string,
  _filePath: string = '',
): { passed: boolean; failureReason?: string } {
  // 1. Unrequested dual-path fallback bloat
  if (guideId !== 'atrule-support-conditionals') {
    const origHasSupports = /@supports\b/i.test(originalContent);
    const patchedHasSupports = /@supports\b/i.test(patchedContent);
    if (!origHasSupports && patchedHasSupports) {
      return {
        passed: false,
        failureReason:
          'Unrequested fallback bloat: patch introduced @supports dual-path fallback where original had none',
      };
    }
  }

  // 2. Coupled-property breakage
  if (guideId === 'individual-transform-properties') {
    const patchedHasCoupledTransition =
      /transition\s*:[^;}]*\btransform\b/i.test(patchedContent) ||
      /will-change\s*:[^;}]*\btransform\b/i.test(patchedContent);
    const patchedHasIndividualTransform =
      /(?:^|[^-\w])(?:scale|translate|rotate)\s*:/i.test(patchedContent);
    const patchedHasTransformProperty =
      /(?:^|[^-\w])transform\s*:/i.test(patchedContent);

    if (
      patchedHasCoupledTransition &&
      patchedHasIndividualTransform &&
      !patchedHasTransformProperty
    ) {
      return {
        passed: false,
        failureReason:
          'Coupled-property breakage: replaced transform with individual transform properties but retained transition/will-change on transform',
      };
    }
  }

  // 3. Cross-layer contract mismatch
  if (guideId === 'declarative-dialog-popover-control') {
    const commandForMatch = patchedContent.match(
      /\bcommandfor\s*=\s*["']([^"']+)["']/i,
    );
    if (commandForMatch) {
      const targetId = commandForMatch[1];
      // Check if target element exists in patchedContent as a non-dialog container (<div, <section, <article, <aside) with that id
      const containerRegex = new RegExp(
        `<(div|section|article|aside)\\b[^>]*\\bid\\s*=\\s*["']${targetId}["'][^>]*>`,
        'i',
      );
      const containerMatch = patchedContent.match(containerRegex);
      if (containerMatch) {
        const openingTag = containerMatch[0];
        const tagName = containerMatch[1].toLowerCase();
        // If it's a container and does not have the popover attribute
        if (!/\bpopover\b/i.test(openingTag)) {
          return {
            passed: false,
            failureReason: `Cross-layer contract mismatch: commandfor targets element with id "${targetId}" which is a <${tagName}> without a popover attribute`,
          };
        }
      }
    }
  }

  return { passed: true };
}

/**
 * Evaluates a candidate update patch through the 3-Gate Update Grader pipeline.
 */
export async function evaluateAgentUpdate(
  patch: UpdatePatch,
  options?: UpdateValidationOptions,
): Promise<UpdateValidationResult> {
  // Check 1: Finding Eliminated (Negative Guard)
  const rulesToRun = ALL_RULES.filter(
    (r) =>
      r.guideId === patch.guideId &&
      (!patch.ruleId || r.id === patch.ruleId),
  );

  // Check 1: Finding Eliminated (Negative Guard)
  let check1Passed = false;
  let findingsRemaining = 0;
  let failureReason: string | undefined;

  if (
    patch.originalWindow !== undefined &&
    patch.patchedWindow !== undefined &&
    patch.originalContent.includes(patch.originalWindow)
  ) {
    // Windowed patch evaluation with full-file context splicing:
    // 1. Verify scanFiles on patchedWindow has 0 findings
    const windowFindings = scanFiles(
      new Map([[patch.filePath, patch.patchedWindow]]),
      rulesToRun,
    );
    const targetWindowFindings = patch.ruleId
      ? windowFindings.filter((f) => f.ruleId === patch.ruleId)
      : windowFindings.filter((f) => f.guideId === patch.guideId);

    // 2. Scan original window to determine how many findings were initially in the window
    const origWindowFindings = scanFiles(
      new Map([[patch.filePath, patch.originalWindow]]),
      rulesToRun,
    );
    const targetOrigWindowFindings = patch.ruleId
      ? origWindowFindings.filter((f) => f.ruleId === patch.ruleId)
      : origWindowFindings.filter((f) => f.guideId === patch.guideId);

    // 3. Splice patchedWindow into originalContent (preserving surrounding module/markup context)
    const splicedContent = patch.originalContent.replace(
      patch.originalWindow,
      patch.patchedWindow,
    );
    const splicedFindings = scanFiles(
      new Map([[patch.filePath, splicedContent]]),
      rulesToRun,
    );
    const targetSplicedFindings = patch.ruleId
      ? splicedFindings.filter((f) => f.ruleId === patch.ruleId)
      : splicedFindings.filter((f) => f.guideId === patch.guideId);

    const origFullFindings = scanFiles(
      new Map([[patch.filePath, patch.originalContent]]),
      rulesToRun,
    );
    const targetOrigFullFindings = patch.ruleId
      ? origFullFindings.filter((f) => f.ruleId === patch.ruleId)
      : origFullFindings.filter((f) => f.guideId === patch.guideId);

    const reduction = targetOrigFullFindings.length - targetSplicedFindings.length;
    const expectedReduction = Math.max(1, targetOrigWindowFindings.length);

    findingsRemaining = targetWindowFindings.length;
    check1Passed =
      targetWindowFindings.length === 0 &&
      (targetOrigFullFindings.length === 0 ||
        reduction >= expectedReduction ||
        targetSplicedFindings.length === 0);

    if (!check1Passed) {
      if (targetWindowFindings.length > 0) {
        failureReason = `Legacy finding still present in patched window (${targetWindowFindings.length} remaining)`;
      } else {
        failureReason = `Legacy finding was not eliminated from spliced file context (expected reduction of ${expectedReduction}, observed ${reduction})`;
      }
    }
  } else {
    // Full file evaluation (fixtures and standalone patches)
    const contentToScanForGate1 = patch.patchedWindow ?? patch.patchedContent;
    const fileMap = new Map<string, string>([
      [patch.filePath, contentToScanForGate1],
    ]);
    const findings = scanFiles(fileMap, rulesToRun);
    const targetFindings = patch.ruleId
      ? findings.filter((f) => f.ruleId === patch.ruleId)
      : findings.filter((f) => f.guideId === patch.guideId);

    findingsRemaining = targetFindings.length;
    check1Passed = targetFindings.length === 0;
    if (!check1Passed) {
      failureReason = `Legacy finding still present in patched file (${targetFindings.length} remaining)`;
    }
  }

  const findingEliminatedCheck: FindingEliminatedCheckResult = {
    passed: check1Passed,
    findingsRemaining,
    failureReason,
  };

  if (!findingEliminatedCheck.passed) {
    const modernSyntaxCheck: ModernSyntaxCheckResult = {
      passed: false,
      syntaxClean: false,
      structuralIntegrityPassed: false,
      modernFeatureVerified: false,
      diagnostics: [],
      failureReason: 'Check 2 skipped because Check 1 failed',
    };
    const behavioralCheck: BehavioralCheckResult = {
      passed: false,
      status: 'SKIPPED_NO_TEST_HARNESS',
      failureReason: 'Check 3 skipped because Check 1 failed',
    };
    return {
      resolved: false,
      staticResolved: false,
      guideId: patch.guideId,
      ruleId: patch.ruleId,
      filePath: patch.filePath,
      findingEliminatedCheck,
      modernSyntaxCheck,
      behavioralCheck,
      summary: `CHECK_1_FAILED: ${findingEliminatedCheck.failureReason}`,
    };
  }

  // Check 2: Modern Replacement Verified (Anti-Deletion & Positive Feature Guard)
  const syntaxCheck = checkSyntaxCleanliness(
    patch.filePath,
    patch.patchedContent,
  );
  const structuralCheck =
    patch.originalWindow && patch.patchedWindow
      ? checkStructuralIntegrity(
          patch.originalWindow,
          patch.patchedWindow,
          patch.filePath,
        )
      : checkStructuralIntegrity(
          patch.originalContent,
          patch.patchedContent,
          patch.filePath,
        );
  const modernFeaturePresent =
    checkModernFeaturePresent(
      patch.guideId,
      patch.patchedContent,
      patch.filePath,
    ) ||
    (patch.patchedWindow
      ? checkModernFeaturePresent(
          patch.guideId,
          patch.patchedWindow,
          patch.filePath,
        )
      : false);

  const invariantCheck = checkAgentModernizationInvariants(
    patch.guideId,
    patch.originalContent,
    patch.patchedContent,
    patch.filePath,
  );

  const check2Passed =
    syntaxCheck.clean &&
    structuralCheck.passed &&
    modernFeaturePresent &&
    invariantCheck.passed;

  let check2Reason: string | undefined;
  if (!syntaxCheck.clean) {
    check2Reason = `Syntax/Parse errors: ${syntaxCheck.diagnostics.join('; ')}`;
  } else if (!structuralCheck.passed) {
    check2Reason = structuralCheck.failureReason;
  } else if (!modernFeaturePresent) {
    check2Reason = `Missing required modern platform feature for guide "${patch.guideId}"`;
  } else if (!invariantCheck.passed) {
    check2Reason = invariantCheck.failureReason;
  }

  const modernSyntaxCheck: ModernSyntaxCheckResult = {
    passed: check2Passed,
    syntaxClean: syntaxCheck.clean,
    structuralIntegrityPassed: structuralCheck.passed,
    modernFeatureVerified: modernFeaturePresent,
    invariantPassed: invariantCheck.passed,
    diagnostics: syntaxCheck.diagnostics,
    failureReason: check2Reason,
  };

  if (!modernSyntaxCheck.passed) {
    const behavioralCheck: BehavioralCheckResult = {
      passed: false,
      status: 'SKIPPED_NO_TEST_HARNESS',
      failureReason: 'Check 3 skipped because Check 2 failed',
    };
    return {
      resolved: false,
      staticResolved: false,
      guideId: patch.guideId,
      ruleId: patch.ruleId,
      filePath: patch.filePath,
      findingEliminatedCheck,
      modernSyntaxCheck,
      behavioralCheck,
      summary: `CHECK_2_FAILED: ${modernSyntaxCheck.failureReason}`,
    };
  }

  // Check 3: Behavioral & Invariant Check (fails closed / skipped when no test harness)
  let check3Passed = false;
  let check3Status: 'PASSED' | 'FAILED' | 'SKIPPED_NO_TEST_HARNESS' = 'SKIPPED_NO_TEST_HARNESS';
  let check3Reason: string | undefined = 'Check 3 skipped: no test harness or behavioral check provided';

  if (options?.behavioralCheck) {
    try {
      const ok = await options.behavioralCheck(patch);
      if (!ok) {
        check3Passed = false;
        check3Status = 'FAILED';
        check3Reason = 'Custom behavioral assertion failed on patched code';
      } else {
        check3Passed = true;
        check3Status = 'PASSED';
        check3Reason = undefined;
      }
    } catch (err: unknown) {
      check3Passed = false;
      check3Status = 'FAILED';
      check3Reason =
        err instanceof Error ? err.message : String(err);
    }
  }

  const behavioralCheck: BehavioralCheckResult = {
    passed: check3Passed,
    status: check3Status,
    failureReason: check3Reason,
  };

  const staticResolved = findingEliminatedCheck.passed && modernSyntaxCheck.passed;
  const resolved = staticResolved && behavioralCheck.passed;

  let summary: string;
  if (resolved) {
    summary = 'RESOLVED: All 3 checks passed';
  } else if (staticResolved) {
    summary = 'STATIC_RESOLVED: Checks 1 & 2 passed (Check 3 skipped: no test harness)';
  } else {
    summary = `CHECK_3_FAILED: ${behavioralCheck.failureReason}`;
  }

  return {
    resolved,
    staticResolved,
    guideId: patch.guideId,
    ruleId: patch.ruleId,
    filePath: patch.filePath,
    findingEliminatedCheck,
    modernSyntaxCheck,
    behavioralCheck,
    summary,
  };
}

export interface SeededFixture {
  readonly guideId: string;
  readonly filePath: string;
  readonly originalContent: string;
  readonly noOpPatch: string;
  readonly deletionPatch: string;
  readonly brokenSyntaxOrEvasionPatch: string;
  readonly goodPatch: string;
}

/**
 * Returns canonical seeded fixtures across seeded guides for adversarial sensitivity testing.
 * Fixtures are stored externally in update-eval-data.json (code has 0 hardcoded test fixture prose).
 */
export function getSeededSensitivityTestCases(): SeededFixture[] {
  return updateEvalData.seededFixtures;
}

export interface BadPatchSensitivityReport {
  readonly totalTested: number;
  readonly badPatchesTotal: number;
  readonly badPatchesRejected: number;
  readonly badPatchRejectionRate: number;
  readonly goodPatchesTotal: number;
  readonly goodPatchesPassed: number;
  readonly goodPatchPassRate: number;
  readonly violations: readonly string[];
}

/**
 * Executes the Seeded Bad-Patch Sensitivity Suite across seeded guides.
 * Verifies badPatchRejectionRate === 1.0 (100% rejection, 0 false passes).
 */
export async function runBadPatchSensitivitySuite(
  fixtures = getSeededSensitivityTestCases(),
): Promise<BadPatchSensitivityReport> {
  const violations: string[] = [];
  let badPatchesTotal = 0;
  let badPatchesRejected = 0;
  let goodPatchesTotal = 0;
  let goodPatchesPassed = 0;

  for (const f of fixtures) {
    // 1. Test No-Op Patch (should fail Check 1)
    badPatchesTotal++;
    const noOpRes = await evaluateAgentUpdate({
      filePath: f.filePath,
      originalContent: f.originalContent,
      patchedContent: f.noOpPatch,
      guideId: f.guideId,
    });
    if (noOpRes.resolved) {
      violations.push(
        `False pass on No-Op patch for guide "${f.guideId}" (${f.filePath})`,
      );
    } else {
      badPatchesRejected++;
    }

    // 2. Test Deletion / Gutting Patch (should fail Check 2b / 2c )
    badPatchesTotal++;
    const delRes = await evaluateAgentUpdate({
      filePath: f.filePath,
      originalContent: f.originalContent,
      patchedContent: f.deletionPatch,
      guideId: f.guideId,
    });
    if (delRes.resolved) {
      violations.push(
        `False pass on Deletion/Gutting patch for guide "${f.guideId}" (${f.filePath})`,
      );
    } else {
      badPatchesRejected++;
    }

    // 3. Test Broken-Syntax / Evasion Patch (should fail Check 2a or 2c)
    badPatchesTotal++;
    const brokenRes = await evaluateAgentUpdate({
      filePath: f.filePath,
      originalContent: f.originalContent,
      patchedContent: f.brokenSyntaxOrEvasionPatch,
      guideId: f.guideId,
    });
    if (brokenRes.resolved) {
      violations.push(
        `False pass on Broken/Evasion patch for guide "${f.guideId}" (${f.filePath})`,
      );
    } else {
      badPatchesRejected++;
    }

    // 4. Test Valid Good Patch (should pass all 3 gates)
    goodPatchesTotal++;
    const goodRes = await evaluateAgentUpdate(
      {
        filePath: f.filePath,
        originalContent: f.originalContent,
        patchedContent: f.goodPatch,
        guideId: f.guideId,
      },
      { behavioralCheck: () => true },
    );
    if (goodRes.resolved) {
      goodPatchesPassed++;
    } else {
      violations.push(
        `Good reference patch failed on guide "${f.guideId}": ${goodRes.summary}`,
      );
    }
  }

  const badPatchRejectionRate =
    badPatchesTotal > 0 ? badPatchesRejected / badPatchesTotal : 0;
  const goodPatchPassRate =
    goodPatchesTotal > 0 ? goodPatchesPassed / goodPatchesTotal : 0;

  return {
    totalTested: badPatchesTotal + goodPatchesTotal,
    badPatchesTotal,
    badPatchesRejected,
    badPatchRejectionRate,
    goodPatchesTotal,
    goodPatchesPassed,
    goodPatchPassRate,
    violations,
  };
}

export interface FixScorecardItem {
  readonly cardId?: string;
  readonly guideId: string;
  readonly repo: string;
  readonly file: string;
  readonly line: number;
  readonly resolved: boolean;
  readonly staticResolved?: boolean;
  readonly explanation?: string;
  readonly check1Passed: boolean;
  readonly check2Passed: boolean;
  readonly check3Passed: boolean;
  readonly gate1Passed?: boolean;
  readonly gate2Passed?: boolean;
  readonly gate3Passed?: boolean;
  readonly summary: string;
}

export interface FixScorecardReport {
  readonly timestamp: string;
  readonly commit: string;
  readonly totalEvaluated: number;
  readonly totalResolved: number;
  readonly totalStaticResolved: number;
  readonly resolutionRate: number;
  readonly staticResolutionRate: number;
  readonly wilson95: BinomialInterval;
  readonly staticWilson95: BinomialInterval;
  readonly badPatchRejectionRate: number;
  readonly perGuideResolution: Record<
    string,
    { evaluated: number; resolved: number; staticResolved?: number; rate: number }
  >;
  readonly results: readonly FixScorecardItem[];
}

/**
 * Locates the actual line number of a finding within the original file content.
 * Solves the issue where multi-hundred-line stylesheets or files have a finding
 * reported at line 1 while the actual matched CSS/code rule is located further down.
 */
export function locateFindingLineInContent(
  originalContent: string,
  findingLine: number,
  codeSnippet: string,
): number {
  const contentLines = originalContent.split('\n');
  if (contentLines.length <= 1) return 1;

  // 1. Try cursor line number from snippet header if > 1
  const cursorNumMatch = codeSnippet.match(/^>\s*(\d+)\s*\|/m);
  if (cursorNumMatch) {
    const parsedLine = parseInt(cursorNumMatch[1], 10);
    if (parsedLine > 1 && parsedLine <= contentLines.length) {
      return parsedLine;
    }
  }

  // 2. If findingLine > 1 and within bounds, check if content around findingLine matches snippet
  if (findingLine > 1 && findingLine <= contentLines.length) {
    return findingLine;
  }

  // 3. Fallback: locate first distinctive non-empty line of codeSnippet in originalContent
  const snippetLines = codeSnippet
    .split('\n')
    .map((l) => l.replace(/^>?\s*\d+\s*\|\s*/, '').trim())
    .filter(
      (l) =>
        l.length >= 4 &&
        !l.startsWith('//') &&
        !l.startsWith('/*') &&
        l !== '{' &&
        l !== '}',
    );

  for (const sLine of snippetLines) {
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i].includes(sLine)) {
        return i + 1; // 1-based line number
      }
    }
  }

  return Math.max(1, findingLine);
}

/**
 * Prompts Gemini to produce a synthetic modernization patch for a code window in a single-shot simulation.
 *
 * NOTE: This function provides single-shot LLM simulation (using SYNTHETIC_FIX_SIMULATION_PROMPT)
 * for fix generation during analyzer evaluation and testing. In full multi-turn agentic workflows,
 * fixes are produced by interactive subagents.
 */
export async function simulateSingleShotWindowFix(params: {
  guideId: string;
  guideMarkdown: string;
  findingMessage: string;
  filePath: string;
  line: number;
  windowText: string;
  apiKey?: string;
  fetchFn?: typeof fetch;
}): Promise<{ patchedWindow: string; explanation: string }> {
  const apiKey = params.apiKey ?? getGeminiApiKey();
  const customFetch = params.fetchFn ?? fetch;

  const userPrompt = formatUpdateSimulationPrompt(params);

  const body = {
    systemInstruction: {
      parts: [{ text: UPDATE_SIMULATION_PROMPT }],
    },
    contents: [
      {
        role: 'user',
        parts: [{ text: userPrompt }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: UPDATE_SIMULATION_RESPONSE_SCHEMA,
      temperature: 0.0,
      thinkingConfig: { thinkingBudget: UPDATE_SIMULATION_THINKING_BUDGET },
    },
  };

  const url = `${GEMINI_API_BASE}/models/${JUDGE_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    customFetch,
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Gemini fix generation failed with HTTP ${res.status}: ${errText}`,
    );
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const parsed = JSON.parse(rawText) as {
    patchedWindow?: string;
    explanation?: string;
  };

  return {
    patchedWindow: parsed.patchedWindow ?? params.windowText,
    explanation: parsed.explanation ?? 'No explanation provided',
  };
}

/**
 * End-to-End Agentic Modernization Runner for Update Eval.
 */
export async function runFixEvaluationCli(): Promise<void> {
  console.log('============================================================');
  console.log('       UPDATE EVAL: 3-CHECK MODERNIZATION VALIDATION        ');
  console.log('============================================================');

  // 1. Run Preflight Seeded Bad-Patch Sensitivity Suite
  console.log('\n[1/3] Running Seeded Bad-Patch Sensitivity Suite...');
  const sensitivity = await runBadPatchSensitivitySuite();
  console.log(
    `Seeded Bad Patches: ${sensitivity.badPatchesRejected}/${sensitivity.badPatchesTotal} rejected (${(sensitivity.badPatchRejectionRate * 100).toFixed(1)}%)`,
  );
  console.log(
    `Reference Good Patches: ${sensitivity.goodPatchesPassed}/${sensitivity.goodPatchesTotal} passed (${(sensitivity.goodPatchPassRate * 100).toFixed(1)}%)`,
  );

  if (sensitivity.badPatchRejectionRate < 1.0) {
    console.error('CRITICAL: Sensitivity suite failed badPatchRejectionRate === 1.0 requirement!');
    for (const v of sensitivity.violations) {
      console.error(` - ${v}`);
    }
    process.exit(1);
  }

  // 2. Sample held-out findings from the qualified guides
  console.log(`\n[2/3] Sampling held-out findings across ${QUALIFIED_GUIDE_IDS.length} qualified guides...`);
  const evalDataDir = process.env.ANALYZER_EVAL_DATA_DIR;
  if (!evalDataDir) {
    throw new Error(
      'ANALYZER_EVAL_DATA_DIR environment variable is not set. Please set the ANALYZER_EVAL_DATA_DIR environment variable to the path of the evaluation data directory.',
    );
  }
  const reposPath = join(evalDataDir, 'repos.json');
  const reposRaw = JSON.parse(await readFile(reposPath, 'utf8')) as RepoConfigEntry[];
  const gradingRepos = reposRaw.filter((r) => r.split === 'held-out');

  const filesByRepo = new Map<string, Map<string, string>>();
  // Scan grading repos to collect candidate findings for the 25 qualified guides
  const candidateFindings: AnalyzerFinding[] = [];
  const qualifiedGuideSet = new Set(QUALIFIED_GUIDE_IDS);
  const targetRules = QUALIFIED_RULES;

  for (const repoEntry of gradingRepos) {
    const dir = repoDir(repoEntry, CACHE_ROOT);
    try {
      const { readdir, readFile } = await import('node:fs/promises');
      const { stat } = await import('node:fs/promises');

      async function walk(currentDir: string, baseDir: string, map: Map<string, string>) {
        if (map.size >= 120) return;
        const entries = await readdir(currentDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
          const full = join(currentDir, e.name);
          if (e.isDirectory()) {
            await walk(full, baseDir, map);
          } else if (e.isFile()) {
            const rel = full.slice(baseDir.length + 1);
            if (/\.(js|ts|jsx|tsx|css|html|json)$/i.test(rel)) {
              try {
                const s = await stat(full);
                if (s.size < 200000) {
                  const content = await readFile(full, 'utf8');
                  map.set(rel, content);
                }
              } catch {
                /* ignore unreadable file */
              }
            }
          }
        }
      }

      const fileMap = new Map<string, string>();
      await walk(dir, dir, fileMap);
      filesByRepo.set(repoEntry.repo, fileMap);

      const findings = scanFiles(fileMap, targetRules, { repo: repoEntry.repo });
      for (const f of findings) {
        if (qualifiedGuideSet.has(f.guideId)) {
          candidateFindings.push(f);
        }
      }
    } catch {
      /* ignore unreadable repo */
    }
  }

  // Sample up to 2 distinct findings per qualified guide
  const findingsByGuide = new Map<string, AnalyzerFinding[]>();
  const seenCardIds = new Set<string>();
  const seenLocations = new Set<string>();

  for (const f of candidateFindings) {
    const list = findingsByGuide.get(f.guideId) ?? [];
    if (list.length >= 2) continue;

    const locKey = `${f.repo}:${f.file}:${f.line}`;
    if (seenCardIds.has(f.cardId) || seenLocations.has(locKey)) {
      continue;
    }

    seenCardIds.add(f.cardId);
    seenLocations.add(locKey);
    list.push(f);
    findingsByGuide.set(f.guideId, list);
  }

  // If a guide had 0 findings in grading scan, use its reference fixture as held-out instance
  const fixtures = getSeededSensitivityTestCases();
  for (const gid of QUALIFIED_GUIDE_IDS) {
    const list = findingsByGuide.get(gid) ?? [];
    if (list.length === 0) {
      const fix = fixtures.find((fx) => fx.guideId === gid);
      if (fix) {
        findingsByGuide.set(gid, [
          {
            cardId: `fixture-${gid}`,
            ruleId: gid,
            guideId: gid,
            guideHash: '123456789012',
            repo: 'guidance-reference',
            commit: 'head',
            file: fix.filePath,
            line: 2,
            message: `Legacy pattern detected for ${gid}`,
            codeSnippet: fix.originalContent,
            contextSlice: fix.originalContent,
          },
        ]);
      }
    }
  }

  const allSampledFindings: AnalyzerFinding[] = [];
  for (const gid of QUALIFIED_GUIDE_IDS) {
    const list = findingsByGuide.get(gid) ?? [];
    allSampledFindings.push(...list);
  }

  console.log(
    `Total held-out findings sampled for evaluation: ${allSampledFindings.length} across ${QUALIFIED_GUIDE_IDS.length} qualified guides.`,
  );

  // 3. Run Agentic Fixes and Validate Through 3-Gate Harness
  console.log('\n[3/3] Running agentic fixes and 3-gate verification...');
  const results: FixScorecardItem[] = [];
  const perGuideCounts: Record<
    string,
    { evaluated: number; resolved: number; staticResolved: number; rate: number }
  > = {};
  for (const gid of QUALIFIED_GUIDE_IDS) {
    perGuideCounts[gid] = { evaluated: 0, resolved: 0, staticResolved: 0, rate: 0 };
  }

  let totalResolved = 0;
  let totalStaticResolved = 0;

  for (let i = 0; i < allSampledFindings.length; i++) {
    const finding = allSampledFindings[i];
    process.stdout.write(
      `[${i + 1}/${allSampledFindings.length}] Fixing ${finding.guideId} in ${finding.repo}:${finding.file}:${finding.line}... `,
    );

    let originalContent = '';
    const repoFiles = filesByRepo.get(finding.repo);
    if (repoFiles && repoFiles.has(finding.file)) {
      originalContent = repoFiles.get(finding.file) ?? '';
    } else {
      const fix = fixtures.find((fx) => fx.guideId === finding.guideId);
      originalContent = fix ? fix.originalContent : finding.codeSnippet;
    }

    const lines = originalContent.split('\n');
    const targetLine = locateFindingLineInContent(
      originalContent,
      finding.line,
      finding.codeSnippet,
    );
    let windowStart = 1;
    let windowEnd = lines.length;
    let windowText = originalContent;

    if (lines.length > 100) {
      windowStart = Math.max(1, targetLine - 35);
      windowEnd = Math.min(lines.length, targetLine + 35);
      windowText = lines.slice(windowStart - 1, windowEnd).join('\n');
    }

    let guideMd = '';
    try {
      guideMd = await readFile(join(GUIDES_DIR, finding.guideId, 'guide.md'), 'utf8');
    } catch {
      const s = await loadGuideSummaryFromMarkdown(finding.guideId);
      guideMd = `# ${finding.guideId}\nProblem: ${s.problem}\nBefore: ${s.before}\nNow: ${s.now}`;
    }

    let patchedContent = originalContent;
    let patchedWindow = windowText;
    let explanation = '';
    try {
      const fixRes = await simulateSingleShotWindowFix({
        guideId: finding.guideId,
        guideMarkdown: guideMd,
        findingMessage: finding.message,
        filePath: finding.file,
        line: targetLine,
        windowText,
      });
      explanation = fixRes.explanation;
      patchedWindow = fixRes.patchedWindow;
      if (lines.length <= 100) {
        patchedContent = fixRes.patchedWindow;
      } else {
        const beforeLines = lines.slice(0, windowStart - 1).join('\n');
        const afterLines = lines.slice(windowEnd).join('\n');
        patchedContent =
          (beforeLines ? beforeLines + '\n' : '') +
          fixRes.patchedWindow +
          (afterLines ? '\n' + afterLines : '');
      }
    } catch (err: unknown) {
      explanation = `LLM Fix error: ${err instanceof Error ? err.message : String(err)}`;
    }

    const val = await evaluateAgentUpdate({
      filePath: finding.file,
      originalContent,
      patchedContent,
      guideId: finding.guideId,
      ruleId: finding.ruleId,
      originalWindow: windowText,
      patchedWindow,
    });

    const isResolved = val.resolved;
    if (isResolved) {
      totalResolved++;
      perGuideCounts[finding.guideId].resolved++;
      console.log('✓ RESOLVED');
    } else if (val.staticResolved) {
      console.log('✓ STATIC_RESOLVED (no test harness)');
    } else {
      console.log(`✗ ${val.summary}`);
    }

    if (val.staticResolved) {
      totalStaticResolved++;
      perGuideCounts[finding.guideId].staticResolved =
        (perGuideCounts[finding.guideId].staticResolved ?? 0) + 1;
    }

    perGuideCounts[finding.guideId].evaluated++;

    results.push({
      cardId: finding.cardId,
      guideId: finding.guideId,
      repo: finding.repo,
      file: finding.file,
      line: finding.line,
      resolved: isResolved,
      staticResolved: val.staticResolved,
      explanation,
      check1Passed: val.findingEliminatedCheck.passed,
      check2Passed: val.modernSyntaxCheck.passed,
      check3Passed: val.behavioralCheck.passed,
      gate1Passed: val.findingEliminatedCheck.passed,
      gate2Passed: val.modernSyntaxCheck.passed,
      gate3Passed: val.behavioralCheck.passed,
      summary: val.summary,
    });
  }

  for (const gid of QUALIFIED_GUIDE_IDS) {
    const e = perGuideCounts[gid].evaluated;
    const r = perGuideCounts[gid].resolved;
    perGuideCounts[gid].rate = e > 0 ? Number((r / e).toFixed(4)) : 0;
  }

  const resolutionRate =
    allSampledFindings.length > 0
      ? totalResolved / allSampledFindings.length
      : 0;
  const wilson = wilsonInterval(totalResolved, allSampledFindings.length, 1.95996);

  const staticResolutionRate =
    allSampledFindings.length > 0
      ? totalStaticResolved / allSampledFindings.length
      : 0;
  const staticWilson = wilsonInterval(totalStaticResolved, allSampledFindings.length, 1.95996);

  // Commit hash
  let commitHash = 'unknown';
  try {
    const { execSync } = await import('node:child_process');
    commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    /* ignore git failure */
  }

  const report: FixScorecardReport = {
    timestamp: new Date().toISOString(),
    commit: commitHash,
    totalEvaluated: allSampledFindings.length,
    totalResolved,
    totalStaticResolved,
    resolutionRate: Number(resolutionRate.toFixed(4)),
    staticResolutionRate: Number(staticResolutionRate.toFixed(4)),
    wilson95: wilson,
    staticWilson95: staticWilson,
    badPatchRejectionRate: sensitivity.badPatchRejectionRate,
    perGuideResolution: perGuideCounts,
    results,
  };

  const dateStr = report.timestamp.slice(0, 10);
  const outPath = join(
    evalDataDir,
    'findings',
    `${dateStr}-fix-scorecard.json`,
  );
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('\n============================================================');
  console.log('                 FIX EVALUATION SUMMARY                     ');
  console.log('============================================================');
  console.log(
    `Total Evaluated:        ${allSampledFindings.length} findings across ${QUALIFIED_GUIDE_IDS.length} qualified guides`,
  );
  console.log(
    `Total Resolved:         ${totalResolved} / ${allSampledFindings.length} (${(resolutionRate * 100).toFixed(1)}%)`,
  );
  console.log(
    `95% Wilson CI:          [${(wilson.lower * 100).toFixed(1)}% - ${(wilson.upper * 100).toFixed(1)}%]`,
  );
  console.log(
    `Bad-Patch Rejection:    ${(sensitivity.badPatchRejectionRate * 100).toFixed(1)}% (100% required)`,
  );
  console.log(`Saved report to:        ${outPath}`);
  console.log('============================================================\n');

  // Record to PROGRESS.md in evaluation data directory
  const progressPath = join(evalDataDir, 'PROGRESS.md');
  try {
    let progressContent = await readFile(progressPath, 'utf8');
    const n = allSampledFindings.length;
    const guideCount = QUALIFIED_GUIDE_IDS.length;
    const resPercent = `${(resolutionRate * 100).toFixed(1)}% [${(wilson.lower * 100).toFixed(1)}% - ${(wilson.upper * 100).toFixed(1)}%] (n=${n})`;
    const staticResPercent = `${(staticResolutionRate * 100).toFixed(1)}% (n=${n})`;
    const qualifiedResPercent = `${(resolutionRate * 100).toFixed(1)}% (qualified)`;
    const badPatchRejPercent = `${(sensitivity.badPatchRejectionRate * 100).toFixed(1)}% (${sensitivity.badPatchesRejected}/${sensitivity.badPatchesTotal})`;
    const row = `| \`${commitHash}\` | ${dateStr} | \`update-eval\` | \`held-out\` | \`${guideCount}-guides\` | gemini-3.8-flash | ${staticResPercent} | ${qualifiedResPercent} | - | - | - | ${(sensitivity.badPatchRejectionRate * 100).toFixed(1)}% | Update Eval agentic modernization evaluation: resolution=${resPercent}, badPatchRejectionRate=${badPatchRejPercent}, ${guideCount} qualified guides |`;
    if (!progressContent.includes(`Update Eval agentic modernization evaluation: resolution=${resPercent}`)) {
      progressContent = progressContent.trimEnd() + '\n' + row + '\n';
      await writeFile(progressPath, progressContent, 'utf8');
      console.log('Appended Update Eval row to PROGRESS.md');
    }
  } catch (err: unknown) {
    console.error('Failed to append to PROGRESS.md:', err);
  }
}

// Run CLI directly if invoked from command line
if (process.argv[1]?.endsWith('update-eval.ts') || process.argv[1]?.endsWith('update-eval.js')) {
  runFixEvaluationCli().catch((err) => {
    console.error('Update eval CLI error:', err);
    process.exit(1);
  });
}
