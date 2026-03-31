import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// Import shared utilities (using relative paths from guides/)
import { validateMacros } from '../serving/mcp-server/lib/macros.ts';
import { validateFeature } from '../serving/mcp-server/data/baseline.ts';
import { rootDir, tasksDir, guidesDir } from './paths.ts';

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
export function getStatusName(guideBody: string, hasGrader: boolean, hasPrompts: boolean): ProjectStatus | null {
  if (guideBody.trim().length === 0) {
    return ProjectStatus.NeedsGuidance;
  }
  if (!hasGrader || !hasPrompts) {
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

  return { errors, data, body, filePath };
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
    const { hasGuide, hasDemo, hasGrader, hasPrompts } = inv;
    const relativeSubdir = path.relative(REPO_ROOT, subdir);
    const guideExists = hasGuide || inv.isStub;
    if (guideExists !== hasDemo) {
      const missingFile = guideExists ? 'demo.html' : 'guide.md';
      const msg = `❌ Error in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH guide.md and demo.html.`;
      console.error(msg);
      errors.push(msg);
      hasError = true;
    }

    if (hasGrader !== hasPrompts) {
      const missingFile = hasGrader ? 'prompts.md' : 'grader.ts';
      const guideHasContent = fs.existsSync(path.join(subdir, 'guide.md')) &&
        matter(fs.readFileSync(path.join(subdir, 'guide.md'), 'utf8')).content.trim().length > 0;
      if (guideHasContent) {
        const msg = `❌ Error in ${relativeSubdir}: Missing ${missingFile}. Must have BOTH grader.ts and prompts.md.`;
        console.error(msg);
        errors.push(msg);
        hasError = true;
      }
    }

    let guideErrors: string[] = [];
    let guideData: GuideData = {};
    let guideBody = '';

    if (hasGuide || inv.isStub) {
      const validation = validateGuide(path.join(subdir, 'guide.md'));
      guideErrors = validation.errors;
      guideData = validation.data;
      guideBody = validation.body;

      if (guideErrors.length > 0) {
        for (const error of guideErrors) {
          const msg = `❌ Error: ${error}`;
          console.error(msg);
          errors.push(msg);
        }
        hasError = true;
      }
    }

    const isIncomplete = (!hasGuide && !inv.isStub) || !hasDemo;
    const featureIds = isIncomplete ? inv.featureIds : (guideData['web-feature-ids'] || []) as string[];
    const statusName = !isIncomplete && guideErrors.length === 0 ? getStatusName(guideBody, hasGrader, hasPrompts) : null;
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

// --- Discovery Helpers (from harness/lib/utils.ts) ---

export const GUIDE_FILE = 'guide.md';
export const DEMO_FILE = 'demo.html';
export const EXPECTATIONS_FILE = 'expectations.md';
export const NEGATIVE_DEMO_FILE = 'negative-demo.html';
export const GRADER_FILE = 'grader.ts';
export const PROMPTS_FILE = 'prompts.md';

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
  hasPrompts: boolean;
  hasTask: boolean;
  featureIds: string[];
}

export interface TaskInfo {
  taskName: string;
  baseApp: string;
  prompt: string;
}

/**
 * Reads a file and trims its content. Returns empty string if file doesn't exist.
 */
export function readFileSafe(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8').trim();
  } catch {
    return '';
  }
}

/**
 * Builds a map of grader names to task information.
 */
export function getTaskMap(): Map<string, TaskInfo> {
  const taskMap = new Map<string, TaskInfo>();
  if (!fs.existsSync(tasksDir)) return taskMap;

  const taskFiles = fs.readdirSync(tasksDir).filter(f => f.endsWith('.md'));
  for (const file of taskFiles) {
    const rawContent = readFileSafe(path.join(tasksDir, file));
    if (!rawContent) continue;

    const { data, content } = matter(rawContent);
    if (data?.grader) {
      taskMap.set(data.grader, {
        taskName: file.replace(/\.md$/, ''),
        baseApp: data.base_app || 'daily-grind',
        prompt: content.trim()
      });
    }
  }
  return taskMap;
}

export function inventoryGuide(dir: string, taskMap: Map<string, TaskInfo>): GuideInventory {
  const name = path.basename(dir);
  const category = path.basename(path.dirname(dir));

  const expectationsContent = readFileSafe(path.join(dir, EXPECTATIONS_FILE));
  const hasExpectations = fs.existsSync(path.join(dir, EXPECTATIONS_FILE));

  const guideContent = readFileSafe(path.join(dir, GUIDE_FILE));
  let hasGuide = false;
  let isStub = false;

  if (guideContent) {
    const parsed = matter(guideContent);
    const hasFrontmatter = Object.keys(parsed.data).length > 0 || guideContent.startsWith('---');
    const hasContent = parsed.content.trim().length > 0;

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

  return {
    dir,
    name,
    category,
    hasGuide,
    isStub,
    hasDemo: readFileSafe(path.join(dir, DEMO_FILE)).length > 0,
    hasExpectations,
    expectationsEmpty: hasExpectations && expectationsContent.length === 0,
    hasNegativeDemo: fs.existsSync(path.join(dir, NEGATIVE_DEMO_FILE)),
    hasGrader: fs.existsSync(path.join(dir, GRADER_FILE)),
    hasPrompts: fs.existsSync(path.join(dir, PROMPTS_FILE)),
    hasTask: taskMap.has(name),
    featureIds,
  };
}

export type GuideStatus = 'eval-ready' | 'needs-test' | 'needs-calibration' | 'needs-expectations' | 'stub' | 'incomplete';

export function classifyGuide(inv: GuideInventory): GuideStatus {
  if (!inv.hasGuide && !inv.isStub) return 'incomplete';
  if (inv.isStub && !inv.hasGuide) return 'stub';
  if (!inv.hasDemo) return 'incomplete';
  if (!inv.hasExpectations || inv.expectationsEmpty) return 'needs-expectations';
  if (!inv.hasNegativeDemo || !inv.hasGrader) return 'needs-calibration';
  if (!inv.hasPrompts || !inv.hasTask) return 'needs-test';
  return 'eval-ready';
}

export function scanAllGuides(scanDir = guidesDir, taskMap = getTaskMap()): GuideInventory[] {
  const guides: GuideInventory[] = [];

  if (!fs.existsSync(guidesDir)) return guides;

  const categories = fs.readdirSync(scanDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name);

  for (const category of categories) {
    const categoryDir = path.join(scanDir, category);
    if (!fs.existsSync(categoryDir)) continue;
    for (const entry of fs.readdirSync(categoryDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      guides.push(inventoryGuide(path.join(categoryDir, entry.name), taskMap));
    }
  }
  return guides;
}
