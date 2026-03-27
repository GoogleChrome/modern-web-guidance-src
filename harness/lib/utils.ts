import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { tasksDir, guidesDir } from '../../lib/paths.ts';

// Constants
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
  console.log(dir);
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
