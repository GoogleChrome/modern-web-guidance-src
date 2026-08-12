import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import { marked } from 'marked';

import { validateMacros } from '../serving/lib/macros.ts';
import { validateFeature } from '../serving/lib/baseline.ts';
import { rootDir, guidesDir } from './paths.ts';
import { Agents } from '../harness/config.ts';

const REPO_ROOT = rootDir;

export const ProjectStatus = {
  NeedsGuidance: 'Needs guidance',
  NeedsEvals: 'Needs evals',
  NeedsUseCases: 'Needs use cases',
  NeedsInvestigation: 'Needs investigation',
} as const;

export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export interface PreparedGuide {
  name: string;
  description: string;
  featureIds: string[];
  relativeSubdir: string;
  statusName: ProjectStatus | null;
}

export interface GuideInventoryResult {
  errors: string[];
  hasError: boolean;
  featuresWithActiveUseCases: Set<string>;
  featuresWithAnyUseCases: Set<string>;
  preparedGuides: PreparedGuide[];
  incompleteSubdirs: string[];
}

interface GuideData {
  name?: string;
  description?: string;
  'web-feature-ids'?: string[];
  [key: string]: any;
}

interface ValidationResult {
  errors: string[];
  data: GuideData;
  body: string;
  filePath: string;
}

/**
 * Determines the project status name for a use case based on its completeness.
 * Returns null when the use case is complete.
 */
export function getStatusName(guideBody: string, hasGrader: boolean, hasTask: boolean): ProjectStatus | null {
  if (guideBody.trim().length === 0) {
    return ProjectStatus.NeedsGuidance;
  }
  if (!hasGrader || !hasTask) {
    return ProjectStatus.NeedsEvals;
  }
  return null;
}

/**
 * Validate a guide file's frontmatter and content.
 */
export function validateGuide(filePath: string): ValidationResult {
  const errors: string[] = [];
  const relativePath = path.relative(REPO_ROOT, filePath);

  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return {
      errors: [`Could not read file: ${e}`],
      data: {},
      body: '',
      filePath
    };
  }

  const { data: rawData, content: body } = matter(content);
  const data = rawData as GuideData;

  if (!data.name) {
    errors.push(`Missing "name" in frontmatter for ${relativePath}.`);
  } else {
    const dirName = path.basename(path.dirname(filePath));
    if (data.name !== dirName) {
      errors.push(`Guide name "${data.name}" in frontmatter does not match directory name "${dirName}" (${relativePath}).`);
    }
  }

  if (!data.description) {
    errors.push(`Missing "description" in frontmatter for ${relativePath}.`);
  }

  const featureIds = data['web-feature-ids'];
  if (featureIds === undefined) {
    errors.push(
      `Missing "web-feature-ids" in frontmatter for ${relativePath}.`,
    );
  } else if (!Array.isArray(featureIds)) {
    errors.push(`"web-feature-ids" must be an array in ${relativePath}.`);
  } else {
    for (const id of featureIds) {
      const result = validateFeature(id);
      if (!result.isValid) {
        errors.push(`${result.errorMessage} (${relativePath}).`);
      }
    }
  }

  errors.push(...validateMacros(body, relativePath));
  errors.push(...validateHtmlTags(body, relativePath));

  return { errors, data, body, filePath };
}

/**
 * Parses expectations.md content into structured sections.
 * Supports both the legacy flat bullet format (all items treated as mustPass)
 * and the new structured format with ## Must pass / ## Must fail / ## App-agnostic rules sections.
 */
export function parseExpectations(content: string): {
  mustPass: string[];
  mustFail: string[];
  appAgnostic: string[];
} {
  const hasStructuredHeadings = /^##\s+(Must pass|Must fail|App-agnostic rules)/im.test(content);

  if (!hasStructuredHeadings) {
    // Legacy format: treat all bullet items as mustPass
    const bullets = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
    return { mustPass: bullets, mustFail: [], appAgnostic: [] };
  }

  const extract = (heading: string): string[] => {
    const pattern = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
    const match = pattern.exec(content);
    if (!match) return [];
    const start = match.index + match[0].length;
    const rest = content.slice(start);
    const nextHeading = /^##\s/m.exec(rest);
    const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    return section
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
  };

  return {
    mustPass: extract('Must pass'),
    mustFail: extract('Must fail'),
    appAgnostic: extract('App-agnostic rules'),
  };
}

/**
 * Processes guide inventory entries: validates frontmatter, checks for missing
 * paired files, and collects feature ID sets. Returns structured data for the
 * GitHub sync step without making any API calls.
 */
export function processGuideInventory(guides: GuideInventory[]): GuideInventoryResult {
  const errors: string[] = [];
  let hasError = false;
  const featuresWithActiveUseCases = new Set<string>();
  const featuresWithAnyUseCases = new Set<string>();
  const preparedGuides: PreparedGuide[] = [];
  const incompleteSubdirs: string[] = [];

  for (const inv of guides) {
    const subdir = inv.dir;
    const { hasGuide, hasDemo, hasGrader, hasTask, isDisciplineSkill, targets } = inv;
    const hasTargets = !!targets && targets.length > 0;
    const relativeSubdir = path.relative(REPO_ROOT, subdir);
    const guideExists = hasGuide || inv.isStub;
    const isDisciplineGuide = inv.name === inv.category || ['css-layout', 'passkeys'].includes(inv.name);
    
    // Discipline skills don't need demo.html; a frontmatter-only stub
    // (a proposed use case) doesn't need one either
    // Guides with multi-app targets don't need a top-level demo.html
    if (!isDisciplineSkill && !isDisciplineGuide && !hasTargets && ((hasGuide && !hasDemo) || (hasDemo && !guideExists))) {
      const missingFile = guideExists ? DEMO_FILE : GUIDE_FILE;
      const msg = `❌ Error in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH ${GUIDE_FILE} and ${DEMO_FILE}.`;
      console.error(msg);
      errors.push(msg);
      hasError = true;
    }

    if (hasGrader !== hasTask) {
      const missingFile = hasGrader ? TASK_FILE : GRADER_FILE;
      const guideHasContent = fs.existsSync(path.join(subdir, GUIDE_FILE)) &&
        matter(fs.readFileSync(path.join(subdir, GUIDE_FILE), 'utf8')).content.trim().length > 0;
      if (guideHasContent) {
        const msg = `❌ Error in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH ${GRADER_FILE} and ${TASK_FILE}.`;
        console.error(msg);
        errors.push(msg);
        hasError = true;
      }
    }

    let guideErrors: string[] = [];
    let guideData: GuideData = {};
    let guideBody = '';

    if (hasGuide || inv.isStub) {
      const validation = validateGuide(getGuideMarkdownPath(inv));
      guideErrors = validation.errors;
      guideData = validation.data;
      guideBody = validation.body;

      if (isDisciplineSkill || isDisciplineGuide || !hasGuide) {
        // Discipline skills/guides and stubs don't require the same frontmatter as use cases
        guideErrors = guideErrors.filter(e => !e.includes('Missing "web-feature-ids"') && !e.includes('Missing "description"'));
      }

      if (guideErrors.length > 0) {
        for (const error of guideErrors) {
          const msg = `❌ Error: ${error}`;
          console.error(msg);
          errors.push(msg);
        }
        hasError = true;
      }
    }

    const isIncomplete = (!hasGuide && !inv.isStub) || (hasGuide && !hasDemo);
    const featureIds = isIncomplete ? inv.featureIds : (guideData['web-feature-ids'] || []) as string[];
    const statusName = !isIncomplete && guideErrors.length === 0 ? getStatusName(guideBody, hasGrader, hasTask) : null;
    const isActive = isIncomplete || guideErrors.length > 0 || statusName !== null;

    for (const id of featureIds) {
      featuresWithAnyUseCases.add(id);
      if (isActive) featuresWithActiveUseCases.add(id);
    }

    if (isIncomplete) {
      incompleteSubdirs.push(relativeSubdir);
      continue;
    }

    if (guideErrors.length > 0) continue;

    preparedGuides.push({
      name: guideData.name!,
      description: guideData.description || '',
      featureIds,
      relativeSubdir,
      statusName,
    });
  }

  return { errors, hasError, featuresWithActiveUseCases, featuresWithAnyUseCases, preparedGuides, incompleteSubdirs };
}

function readFileSafe(filePath: string): string {
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  return '';
}

export const GUIDE_FILE = 'guide.md';
export const SKILL_FILE = 'SKILL.md';
export const DEMO_FILE = 'demo.html';
export const EXPECTATIONS_FILE = 'expectations.md';
export const NEGATIVE_DEMO_FILE = 'negative-demo.html';
export const GRADER_FILE = 'grader.ts';
export const TASK_FILE = 'task.md';
export const REPORT_FILE = 'report.md';

export const SUPPORTED_BASE_APPS = ['daily-grind', 'devtools-times'] as const;
export type SupportedBaseApp = (typeof SUPPORTED_BASE_APPS)[number];

export function getSupportedBaseApps(): string[] {
  return Array.from(SUPPORTED_BASE_APPS);
}

export const TARGETS_DIR = 'targets';
export const PATCHES_DIR = 'patches';

export type SolutionAgent =
  | typeof Agents.GEMINI_CLI
  | typeof Agents.JETSKI_CLI
  | typeof Agents.CLAUDE_CODE
  | typeof Agents.CODEX_CLI;

export function getDefaultSolutionAgent(): SolutionAgent {
  return process.env.GD_DEV_USE_JETSKI === '1' ? Agents.JETSKI_CLI : Agents.GEMINI_CLI;
}

export function getActiveSolutionAgents(targetDir?: string): SolutionAgent[] {
  const hasGemini = Boolean(targetDir && fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.GEMINI_CLI])));
  const hasJetski = Boolean(targetDir && fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.JETSKI_CLI])));
  const primary: SolutionAgent = hasGemini ? Agents.GEMINI_CLI : (hasJetski ? Agents.JETSKI_CLI : getDefaultSolutionAgent());
  return [primary, Agents.CLAUDE_CODE, Agents.CODEX_CLI];
}

export const SOLUTION_PATCH_FILES: Record<SolutionAgent, string> = {
  [Agents.GEMINI_CLI]: path.join(PATCHES_DIR, 'gemini-solution.patch'),
  [Agents.JETSKI_CLI]: path.join(PATCHES_DIR, 'jetski-solution.patch'),
  [Agents.CLAUDE_CODE]: path.join(PATCHES_DIR, 'claude-solution.patch'),
  [Agents.CODEX_CLI]: path.join(PATCHES_DIR, 'codex-solution.patch'),
};
export const ZERO_PASSRATE_PATCH_FILE = path.join(PATCHES_DIR, 'zero-passrate.patch');

export interface TargetInventory {
  name: string;
  dir: string;
  hasSolution: boolean;
  hasZeroPassrate: boolean;
  hasGrader: boolean;
  hasTask: boolean;
}

export interface GuideInventory {
  dir: string;
  name: string;
  category: string;
  hasGuide: boolean;
  isStub: boolean;
  hasDemo: boolean;
  hasExpectations: boolean;
  expectationsEmpty: boolean;
  hasNegativeDemo: boolean;
  hasGrader: boolean;
  hasTask: boolean;
  featureIds: string[];
  isDisciplineSkill: boolean;
  targets?: TargetInventory[];
}

/**
 * Returns the path to the main markdown file for a guide (guide.md or SKILL.md).
 */
export function getGuideMarkdownPath(inv: GuideInventory): string {
  return path.join(inv.dir, inv.isDisciplineSkill ? SKILL_FILE : GUIDE_FILE);
}

/**
 * Returns true if the directory represents a discipline-level skill (e.g. guides/css/).
 */
export function isDisciplineSkillDir(dir: string): boolean {
  const parentDir = path.dirname(dir);
  return path.basename(parentDir) === 'guides' && fs.existsSync(path.join(dir, SKILL_FILE));
}

export interface TaskInfo {
  baseApp: string;
  prompt: string;
  guideDir: string;
}

/**
 * Builds a map of guide names to task information.
 * Scans all guide directories for `task.md`.
 */
export function getTaskMap(): Map<string, TaskInfo> {
  const taskMap = new Map<string, TaskInfo>();
  if (!fs.existsSync(guidesDir)) return taskMap;

  function processTasks(guideName: string, tasksDir: string, guideDir: string) {
    for (const taskEntry of fs.readdirSync(tasksDir, { withFileTypes: true })) {
      if (taskEntry.isDirectory() || !taskEntry.name.endsWith('.md')) continue;
      const taskFileName = taskEntry.name;
      const taskName = path.basename(taskFileName, '.md');
      const taskPath = path.join(tasksDir, taskFileName);

      const rawContent = readFileSafe(taskPath);
      if (!rawContent) continue;

      const { data, content } = matter(rawContent);

      const firstLine = content.split('\n').find((l: string) => l.trim().startsWith('- '));
      const prompt = firstLine ? firstLine.replace(/^-\s*/, '').trim() : content.trim();

      const info: TaskInfo = {
        baseApp: data?.base_app || 'daily-grind',
        prompt: prompt,
        guideDir: guideDir,
      };

      taskMap.set(`${guideName}/${taskName}`, info);
    }
  }

  function processBaseAppTasks(guideName: string, targetsDir: string, guideDir: string) {
    const supportedBaseApps = getSupportedBaseApps();

    for (const entry of fs.readdirSync(targetsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || !supportedBaseApps.includes(entry.name)) continue;
      const baseAppName = entry.name;
      const taskPath = path.join(targetsDir, baseAppName, TASK_FILE);

      const rawContent = readFileSafe(taskPath);
      if (!rawContent) continue;

      const { content } = matter(rawContent);
      const firstLine = content.split('\n').find((l: string) => l.trim().startsWith('- '));
      const prompt = firstLine ? firstLine.replace(/^-\s*/, '').trim() : content.trim();

      const info: TaskInfo = {
        baseApp: baseAppName,
        prompt: prompt,
        guideDir: guideDir,
      };

      taskMap.set(`${guideName}/${baseAppName}`, info);
    }
  }

  const disciplines = fs.readdirSync(guidesDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name);

  for (const discipline of disciplines) {
    const disciplineDir = path.join(guidesDir, discipline);
    if (!fs.existsSync(disciplineDir)) continue;

    // Check subdirectories (guides)
    for (const entry of fs.readdirSync(disciplineDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const guideName = entry.name;
      const targetsDir = path.join(disciplineDir, guideName, TARGETS_DIR);
      const tasksDir = path.join(disciplineDir, guideName, 'tasks');
      if (fs.existsSync(targetsDir)) {
        processBaseAppTasks(guideName, targetsDir, path.join(disciplineDir, guideName));
      }
      if (fs.existsSync(tasksDir)) {
        processTasks(guideName, tasksDir, path.join(disciplineDir, guideName));
      }
    }
  }
  return taskMap;
}

export function inventoryGuide(dir: string, options?: { useTargetEvals?: boolean }): GuideInventory {
  const name = path.basename(dir);
  const category = path.basename(path.dirname(dir));
  const isDisciplineSkill = isDisciplineSkillDir(dir);

  const expectationsContent = readFileSafe(path.join(dir, EXPECTATIONS_FILE));
  const hasExpectations = fs.existsSync(path.join(dir, EXPECTATIONS_FILE));

  const guideFilePath = path.join(dir, isDisciplineSkill ? SKILL_FILE : GUIDE_FILE);
  const guideContent = readFileSafe(guideFilePath);
  let hasGuide = false;
  let isStub = false;

  if (guideContent) {
    const parsed = matter(guideContent);
    const hasFrontmatter = Object.keys(parsed.data).length > 0 || guideContent.startsWith('---');
    const hasContent = parsed.content.replace(/<!--[\s\S]*?-->/g, '').trim().length > 0;

    if (hasFrontmatter) {
      isStub = true;
      if (hasContent) {
        hasGuide = true;
      }
    } else if (hasContent) {
      hasGuide = true;
    }
  }

  const featureIds = guideContent ? (matter(guideContent).data['web-feature-ids'] || []) : [];

  const targetsDir = path.join(dir, TARGETS_DIR);
  const hasTargets = fs.existsSync(targetsDir) && fs.statSync(targetsDir).isDirectory();
  const tasksDir = path.join(dir, 'tasks');
  const hasTasksDir = fs.existsSync(tasksDir) && fs.statSync(tasksDir).isDirectory();
  const useTargets = !!(options?.useTargetEvals || (hasTargets && !hasTasksDir));
  const targets: TargetInventory[] = [];

  const hasDemo = readFileSafe(path.join(dir, DEMO_FILE)).length > 0;
  let hasNegativeDemo = false;
  let hasGrader = false;
  let hasTask = false;

  if (useTargets) {
    const supportedBaseApps = getSupportedBaseApps();
    const appsToInventory = options?.useTargetEvals
      ? supportedBaseApps
      : (fs.existsSync(targetsDir)
          ? fs.readdirSync(targetsDir, { withFileTypes: true })
              .filter(e => e.isDirectory() && !e.name.startsWith('.') && supportedBaseApps.includes(e.name))
              .map(e => e.name)
          : []);

    for (const baseApp of appsToInventory) {
      const targetDir = path.join(targetsDir, baseApp);
      const exists = fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory();
      const hasPrimarySolution =
        fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.GEMINI_CLI])) ||
        fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.JETSKI_CLI]));
      const appInv: TargetInventory = {
        name: baseApp,
        dir: targetDir,
        hasSolution: exists &&
          hasPrimarySolution &&
          fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.CLAUDE_CODE])) &&
          fs.existsSync(path.join(targetDir, SOLUTION_PATCH_FILES[Agents.CODEX_CLI])),
        hasZeroPassrate: exists && fs.existsSync(path.join(targetDir, ZERO_PASSRATE_PATCH_FILE)),
        hasGrader: exists && fs.existsSync(path.join(targetDir, GRADER_FILE)),
        hasTask: exists && fs.existsSync(path.join(targetDir, TASK_FILE)),
      };
      targets.push(appInv);
    }

    if (targets.length > 0) {
      hasGrader = targets.every((a) => a.hasGrader);
      hasTask = targets.every((a) => a.hasTask);
    }
  } else {
    hasNegativeDemo = fs.existsSync(path.join(dir, NEGATIVE_DEMO_FILE));
    hasGrader = fs.existsSync(path.join(dir, GRADER_FILE));
    hasTask = fs.existsSync(path.join(dir, 'tasks', TASK_FILE));
  }

  return {
    dir,
    name,
    category,
    hasGuide,
    isStub,
    hasDemo,
    hasExpectations,
    expectationsEmpty: hasExpectations && expectationsContent.length === 0,
    hasNegativeDemo,
    hasGrader,
    hasTask,
    featureIds,
    isDisciplineSkill,
    targets: useTargets ? targets : undefined,
  };
}

export type GuideStatus = 'eval-ready' | 'needs-test' | 'needs-calibration' | 'needs-expectations' | 'stub' | 'incomplete';

export function classifyGuide(inv: GuideInventory): GuideStatus {
  if (!inv.hasGuide && !inv.isStub) return 'incomplete';
  if (inv.isStub && !inv.hasGuide) return 'stub';
  if (!inv.hasExpectations || inv.expectationsEmpty) return 'needs-expectations';

  if (inv.targets && inv.targets.length > 0) {
    const allHaveSolutions = inv.targets.every(t => t.hasSolution);
    const allHaveZeroPassrate = inv.targets.every(t => t.hasZeroPassrate);
    const allHaveGraders = inv.targets.every(t => t.hasGrader);
    const allHaveTasks = inv.targets.every(t => t.hasTask);

    if (!allHaveSolutions) return 'incomplete';
    if (!allHaveZeroPassrate || !allHaveGraders) return 'needs-calibration';
    if (!allHaveTasks) return 'needs-test';
    return 'eval-ready';
  } else {
    if (!inv.hasDemo) return 'incomplete';
    if (!inv.hasNegativeDemo || !inv.hasGrader) return 'needs-calibration';
    if (!inv.hasTask) return 'needs-test';
    return 'eval-ready';
  }
}

export function scanAllGuides(scanDir = guidesDir): GuideInventory[] {
  const guides: GuideInventory[] = [];

  if (!fs.existsSync(guidesDir)) return guides;

  const categories = fs.readdirSync(scanDir, { withFileTypes: true })
     .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
     .map(d => d.name);

  for (const category of categories) {
    const categoryDir = path.join(scanDir, category);
    if (!fs.existsSync(categoryDir)) continue;

    // Scan subdirectories
    for (const entry of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || ['node_modules', 'test-app-results', 'grade-report', 'test-results'].includes(entry.name)) continue;
      guides.push(inventoryGuide(path.join(categoryDir, entry.name)));
    }
  }
  return guides;
}

export function scanDisciplineSkills(scanDir = guidesDir): GuideInventory[] {
  const skills: GuideInventory[] = [];

  if (!fs.existsSync(scanDir)) return skills;

  // Read top-level directories in guides/
  const categories = fs.readdirSync(scanDir, { withFileTypes: true })
     .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
     .map(d => d.name);

  for (const category of categories) {
    const categoryDir = path.join(scanDir, category);
    
    // If the category directory itself contains a SKILL.md, it's a discipline skill
    if (fs.existsSync(path.join(categoryDir, SKILL_FILE))) {
      skills.push(inventoryGuide(categoryDir));
    }
  }

  return skills;
}

let cachedGuidesMap: Map<string, GuideInventory> | null = null;

export function getGuidesMap(): Map<string, GuideInventory> {
  if (!cachedGuidesMap) {
    const allItems = [...scanAllGuides(), ...scanDisciplineSkills()];
    cachedGuidesMap = new Map(allItems.map(g => [g.name, g]));
  }
  return cachedGuidesMap;
}

export function resetGuidesMap() {
  cachedGuidesMap = null;
}

// Safe typographic inline tags that don't represent interactive elements or cause layout breakage.
const ALLOWED_HTML_TAGS = new Set(['kbd', 'br', 'wbr']);

export function validateHtmlTags(body: string, relativePath: string): string[] {
  const errors: string[] = [];

  try {
    const tokens = marked.lexer(body);
    findInvalidHtmlTokens(tokens, errors, relativePath, body);
  } catch (e) {
    errors.push(`Failed to parse markdown with marked lexer for HTML validation in ${relativePath}: ${e}`);
  }

  return errors;
}

function findInvalidHtmlTokens(tokens: any[], errors: string[], relativePath: string, content: string) {
  for (const token of tokens) {
    if (token.type === 'html') {
      const raw = token.raw.trim();

      // Allow HTML comments
      if (raw.startsWith('<!--') && raw.endsWith('-->')) {
        continue;
      }

      // Parse tag name
      const match = raw.match(/^<\/?([a-zA-Z0-9:-]+)(?:\s+[^>]*)?\/?>$/);
      if (match) {
        const tagName = match[1].toLowerCase();
        if (!ALLOWED_HTML_TAGS.has(tagName)) {
          // Find line number in content
          const offset = content.indexOf(token.raw);
          const line = offset !== -1 ? content.slice(0, offset).split('\n').length : -1;
          const lineSuffix = line !== -1 ? ` on line ${line}` : '';
          errors.push(`Unescaped HTML tag <${tagName}> found${lineSuffix} in ${relativePath}. Use backticks or escape angle brackets if it is a tag name reference.`);
        }
      } else {
        // If it does not match a standard tag, but is still parsed as HTML token, warn/fail
        const offset = content.indexOf(token.raw);
        const line = offset !== -1 ? content.slice(0, offset).split('\n').length : -1;
        const lineSuffix = line !== -1 ? ` on line ${line}` : '';
        errors.push(`Potentially invalid or unescaped HTML block/tag "${raw}" found${lineSuffix} in ${relativePath}.`);
      }
    }

    if (token.tokens) {
      findInvalidHtmlTokens(token.tokens, errors, relativePath, content);
    }
    if (token.items) {
      for (const item of token.items) {
        if (item.tokens) {
          findInvalidHtmlTokens(item.tokens, errors, relativePath, content);
        }
      }
    }
  }
}

