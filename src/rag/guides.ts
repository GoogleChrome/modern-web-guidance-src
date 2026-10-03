import { promises as fs, readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

import type { OriginTrialMetadata } from "../core/guide-validation.ts";

export interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount: number;
  originTrials?: OriginTrialMetadata[];
}

const BUNDLE_DIR = path.dirname(fileURLToPath(import.meta.url));

function resolveSkillsCliDataDir(): string {
  // In the shipped bundle (dist/skills-cli/skills/modern-web-guidance/), guides.json and vectors sit next to modern-web.mjs / search.mjs
  if (existsSync(path.join(BUNDLE_DIR, 'guides.json')) || existsSync(path.join(BUNDLE_DIR, 'use-cases.vectors.gen.json.gz'))) {
    return BUNDLE_DIR;
  }
  // In repo source mode (src/rag/), walk up to repo root (where pnpm-lock.yaml lives) and use out/build/skills-cli
  let dir = BUNDLE_DIR;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'pnpm-lock.yaml'))) {
      return path.join(dir, 'out/build/skills-cli');
    }
    dir = path.dirname(dir);
  }
  return BUNDLE_DIR;
}

function loadUseCases(): UseCase[] {
  const dataDir = resolveSkillsCliDataDir();
  const guidesJsonPath = path.join(dataDir, 'guides.json');
  if (!existsSync(guidesJsonPath)) {
    throw new Error(`guides.json not found at ${guidesJsonPath}. Run 'pnpm build' first.`);
  }
  return JSON.parse(readFileSync(guidesJsonPath, 'utf-8'));
}

export const USE_CASES: UseCase[] = loadUseCases();

export function getUseCase(useCaseId: string): UseCase | undefined {
  return USE_CASES.find((u) => u.id === useCaseId);
}

export function getUseCasesByCategory(category?: string): UseCase[] {
  if (!category) return USE_CASES;
  return USE_CASES.filter((u) => u.category === category);
}

export async function getGuide(useCaseId: string): Promise<string | null> {
  const useCase = getUseCase(useCaseId);
  if (!useCase) return null;
  const dataDir = resolveSkillsCliDataDir();
  const filePath = path.join(dataDir, "guides", useCase.category, `${useCaseId}.md`);

  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    // Re-throw real errors
    throw error;
  }
}

