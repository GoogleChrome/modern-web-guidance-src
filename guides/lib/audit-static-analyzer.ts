import fs from 'node:fs';
import path from 'node:path';
import { guidesDir } from '../../lib/paths.ts';
import {
  GUIDE_FILE,
  EXPECTATIONS_FILE,
  GRADER_FILE,
  TASK_FILE,
  DEMO_FILE,
  TARGETS_DIR,
  getSupportedBaseApps,
  isDisciplineGuide,
} from '../../lib/guide-validation.ts';
import { validateGraderExpectationCoverage } from '../../lib/grader-coverage.ts';
import type {
  DiscoveredCapsule,
  GuideFormatLabel,
  StaticAuditSignals,
  UnpromptedLocatorSignal,
  StaticFileRegexSignal,
  ProseExpectationSignal,
} from './audit-types.ts';

/**
 * Converts a simple glob/wildcard pattern (e.g. "css/*", "*intrinsic*", "forms/autofill-*")
 * into a RegExp and tests against both guideId ("css/animate-to-intrinsic-sizes") and guideName.
 */
export function matchesWildcardPattern(guideId: string, guideName: string, pattern?: string): boolean {
  if (!pattern || pattern.trim() === '' || pattern.trim() === '*') {
    return true;
  }
  const cleanPattern = pattern.trim();
  const escaped = cleanPattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  const regex = new RegExp(`^${escaped}$`, 'i');
  return regex.test(guideId) || regex.test(guideName);
}

/**
 * Discovers all evaluatable guide capsules across guidesDir matching optional wildcard pattern and target filter.
 * Auto-detects "legacy - top level guide" vs "new - low level guide (<app>)".
 */
export function discoverAuditCapsules(options?: {
  pattern?: string;
  targetApp?: string;
  scanDir?: string;
  scope?: 'expectations' | 'grader' | 'both';
}): DiscoveredCapsule[] {
  const rootScanDir = options?.scanDir ?? guidesDir;
  if (!fs.existsSync(rootScanDir)) return [];

  const capsules: DiscoveredCapsule[] = [];
  const categories = fs
    .readdirSync(rootScanDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map((d) => d.name)
    .sort();

  const supportedApps = getSupportedBaseApps();

  for (const category of categories) {
    const categoryDir = path.join(rootScanDir, category);
    const entries = fs
      .readdirSync(categoryDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
      .map((d) => d.name)
      .sort();

    for (const guideName of entries) {
      if (isDisciplineGuide(guideName, category)) {
        continue;
      }

      const guideId = `${category}/${guideName}`;
      if (!matchesWildcardPattern(guideId, guideName, options?.pattern)) {
        continue;
      }

      const guideDirAbs = path.join(categoryDir, guideName);
      const guideFilePath = path.join(guideDirAbs, GUIDE_FILE);
      const expectationsFilePath = path.join(guideDirAbs, EXPECTATIONS_FILE);

      if (!fs.existsSync(guideFilePath) || !fs.existsSync(expectationsFilePath)) {
        continue;
      }

      const targetsDirAbs = path.join(guideDirAbs, TARGETS_DIR);
      const topLevelGraderPath = path.join(guideDirAbs, GRADER_FILE);

      // When auditing expectations only, expectations.md lives once at the guide root (site-agnostic),
      // so we emit exactly one capsule per guideId regardless of how many target apps exist.
      if (options?.scope === 'expectations') {
        let representativeGraderPath = topLevelGraderPath;
        let representativeTaskPath = path.join(guideDirAbs, 'tasks', TASK_FILE);
        let guideFormat: GuideFormatLabel = 'legacy - top level guide';

        if (fs.existsSync(targetsDirAbs) && fs.statSync(targetsDirAbs).isDirectory()) {
          const targetDirs = fs
            .readdirSync(targetsDirAbs, { withFileTypes: true })
            .filter((d) => d.isDirectory() && !d.name.startsWith('.') && supportedApps.includes(d.name))
            .map((d) => d.name)
            .sort();
          if (targetDirs.length > 0) {
            const firstApp = targetDirs[0];
            guideFormat = `new - low level guide (${firstApp})`;
            representativeGraderPath = path.join(targetsDirAbs, firstApp, GRADER_FILE);
            representativeTaskPath = path.join(targetsDirAbs, firstApp, TASK_FILE);
          }
        }

        const demoPath = path.join(guideDirAbs, DEMO_FILE);
        capsules.push({
          capsuleId: guideId,
          guideId,
          category,
          guideName,
          guideFormat,
          guideDirAbs,
          guideFilePath,
          expectationsFilePath,
          graderFilePath: representativeGraderPath,
          taskFilePath: representativeTaskPath,
          demoFilePath: fs.existsSync(demoPath) ? demoPath : undefined,
        });
        continue;
      }

      // Check for target-specific capsules ("new - low level guide")
      let foundTargetCapsules = false;
      if (fs.existsSync(targetsDirAbs) && fs.statSync(targetsDirAbs).isDirectory()) {
        const targetDirs = fs
          .readdirSync(targetsDirAbs, { withFileTypes: true })
          .filter((d) => d.isDirectory() && !d.name.startsWith('.') && supportedApps.includes(d.name))
          .map((d) => d.name)
          .sort();

        for (const appName of targetDirs) {
          if (options?.targetApp && options.targetApp !== appName) {
            continue;
          }
          const targetGraderPath = path.join(targetsDirAbs, appName, GRADER_FILE);
          const targetTaskPath = path.join(targetsDirAbs, appName, TASK_FILE);
          if (fs.existsSync(targetGraderPath)) {
            foundTargetCapsules = true;
            const guideFormat: GuideFormatLabel = `new - low level guide (${appName})`;
            capsules.push({
              capsuleId: `${guideId}__${appName}`,
              guideId,
              category,
              guideName,
              guideFormat,
              targetApp: appName,
              guideDirAbs,
              guideFilePath,
              expectationsFilePath,
              graderFilePath: targetGraderPath,
              taskFilePath: fs.existsSync(targetTaskPath)
                ? targetTaskPath
                : path.join(guideDirAbs, 'tasks', TASK_FILE),
            });
          }
        }
      }

      // If no target capsules matched/existed, check top-level grader ("legacy - top level guide")
      if (!foundTargetCapsules && fs.existsSync(topLevelGraderPath)) {
        if (options?.targetApp && options.targetApp !== 'legacy') {
          continue;
        }
        const topTaskPath = path.join(guideDirAbs, 'tasks', TASK_FILE);
        const demoPath = path.join(guideDirAbs, DEMO_FILE);
        capsules.push({
          capsuleId: guideId,
          guideId,
          category,
          guideName,
          guideFormat: 'legacy - top level guide',
          guideDirAbs,
          guideFilePath,
          expectationsFilePath,
          graderFilePath: topLevelGraderPath,
          taskFilePath: topTaskPath,
          demoFilePath: fs.existsSync(demoPath) ? demoPath : undefined,
        });
      }
    }
  }

  return capsules;
}

/**
 * Extracts hardcoded ID (#foo) or class (.bar) selectors from Playwright locator/query calls in grader.ts
 * and checks whether they are explicitly mentioned in task.md.
 */
export function extractUnpromptedLocators(
  graderContent: string,
  taskContent: string,
  demoContent = ''
): UnpromptedLocatorSignal[] {
  const signals: UnpromptedLocatorSignal[] = [];
  const lines = graderContent.split('\n');

  // Match locator('...'), querySelector('...'), querySelectorAll('...'), $('...'), $$('...')
  const selectorCallRegex =
    /\b(?:locator|querySelector|querySelectorAll|\$\$?)\s*\(\s*(['"`])([^'"`]+)\1/g;

  // Match specific ID or class tokens within a selector string (e.g. #faq-trigger, .faq-item)
  const idOrClassTokenRegex = /(#[a-zA-Z0-9_-]+|\.[a-zA-Z0-9_-]+)/g;

  const seenTokens = new Set<string>();

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;

    let callMatch: RegExpExecArray | null;
    selectorCallRegex.lastIndex = 0;
    while ((callMatch = selectorCallRegex.exec(line)) !== null) {
      const selectorStr = callMatch[2];
      let tokenMatch: RegExpExecArray | null;
      idOrClassTokenRegex.lastIndex = 0;
      while ((tokenMatch = idOrClassTokenRegex.exec(selectorStr)) !== null) {
        const token = tokenMatch[1];
        // Ignore pseudo-classes or numeric decimals that might look like classes
        if (token.length <= 2 || /^\.\d/.test(token)) continue;
        const key = `${token}@${idx + 1}`;
        if (seenTokens.has(key)) continue;
        seenTokens.add(key);

        const inTaskMd = taskContent.includes(token) || taskContent.includes(token.slice(1));
        const inDemoHtml = demoContent.includes(token.slice(1));

        if (!inTaskMd) {
          signals.push({
            selector: token,
            lineNumber: idx + 1,
            lineSnippet: trimmed,
            inTaskMd,
            inDemoHtml,
          });
        }
      }
    }
  });

  return signals;
}

/**
 * Scans grader.ts for fs.readFileSync calls and regex/string checks on raw file content.
 */
export function extractStaticFileRegexSignals(graderContent: string): {
  fsReadFileSyncLines: number[];
  staticRegexChecks: StaticFileRegexSignal[];
} {
  const lines = graderContent.split('\n');
  const fsReadFileSyncLines: number[] = [];
  const staticRegexChecks: StaticFileRegexSignal[] = [];

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    if (/\bfs\.readFileSync\b|\breadFileSync\b/.test(line)) {
      fsReadFileSyncLines.push(lineNum);
    }

    // Check for regex .test(...) or .match(...) on html/file content variables
    const isRegexTestOnStaticVar =
      /\/.*\/[gimsuy]*\.test\s*\(\s*(?:html|content|source|raw|code|file)/i.test(line) ||
      /\b(?:html|source|raw|fileContent)\.includes\s*\(/i.test(line);

    if (isRegexTestOnStaticVar) {
      staticRegexChecks.push({
        lineNumber: lineNum,
        lineSnippet: line.trim(),
      });
    }
  });

  return { fsReadFileSyncLines, staticRegexChecks };
}

/**
 * Scans expectations.md for bullets requiring comments or documentation prose rather than behavior.
 */
export function extractProseExpectations(expectationsContent: string): ProseExpectationSignal[] {
  const signals: ProseExpectationSignal[] = [];
  const lines = expectationsContent.split('\n');
  const proseKeywords = [
    /\bcode comments?\b/i,
    /\bcomments?\s+explicitly\s+state\b/i,
    /\bimplementation\s+notes\s+that\b/i,
    /\bguide\s+or\s+code\s+comments\b/i,
    /\bdocumented\s+in\s+comments\b/i,
  ];

  let bulletIdx = 0;
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^([-*]|\d+[.)])\s+/.test(trimmed)) {
      bulletIdx++;
      for (const kw of proseKeywords) {
        const m = trimmed.match(kw);
        if (m) {
          signals.push({
            bulletIndex: bulletIdx,
            lineNumber: idx + 1,
            text: trimmed,
            matchedKeyword: m[0],
          });
          break;
        }
      }
    }
  });

  return signals;
}

let embedderMutex: Promise<void> = Promise.resolve();

/**
 * Runs deterministic static pre-analysis on a discovered capsule.
 */
export async function analyzeCapsuleStatically(
  capsule: DiscoveredCapsule,
  scope: 'expectations' | 'grader' | 'both' = 'both'
): Promise<StaticAuditSignals> {
  const realLog = console.log;
  const realWarn = console.warn;

  let embeddingCoverage = {
    isComplete: true,
    graderPath: capsule.graderFilePath,
    expectationsPath: capsule.expectationsFilePath,
    matches: [] as any[],
    missing: [] as any[],
  };

  if (scope !== 'expectations') {
    // Serialize calls to validateGraderExpectationCoverage so TfjsEmbedder.init() never races on console.log
    const runCoverage = async () => {
      try {
        embeddingCoverage = await validateGraderExpectationCoverage(
          capsule.expectationsFilePath,
          capsule.graderFilePath
        );
      } finally {
        console.log = realLog;
        console.warn = realWarn;
      }
    };
    embedderMutex = embedderMutex.then(runCoverage, runCoverage);
    await embedderMutex;
  }

  const graderContent = fs.existsSync(capsule.graderFilePath)
    ? fs.readFileSync(capsule.graderFilePath, 'utf8')
    : '';
  const taskContent = fs.existsSync(capsule.taskFilePath)
    ? fs.readFileSync(capsule.taskFilePath, 'utf8')
    : '';
  const demoContent =
    capsule.demoFilePath && fs.existsSync(capsule.demoFilePath)
      ? fs.readFileSync(capsule.demoFilePath, 'utf8')
      : '';
  const expectationsContent = fs.existsSync(capsule.expectationsFilePath)
    ? fs.readFileSync(capsule.expectationsFilePath, 'utf8')
    : '';

  const { fsReadFileSyncLines, staticRegexChecks } =
    extractStaticFileRegexSignals(graderContent);
  const unpromptedLocators = extractUnpromptedLocators(graderContent, taskContent, demoContent);
  const proseExpectationSignals = extractProseExpectations(expectationsContent);

  return {
    embeddingCoverage,
    fsReadFileSyncLines,
    staticRegexChecks,
    unpromptedLocators,
    proseExpectationSignals,
  };
}
