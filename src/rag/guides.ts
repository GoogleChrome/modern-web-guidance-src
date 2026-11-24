import { promises as fs, readFileSync, existsSync } from "fs";
import path from "path";
import type { OriginTrialMetadata, VolatileFeatureMetadata } from "../core/feature-gates.ts";
import { resolveSkillsCliDataDir } from "./data-dir.ts";

export { resolveSkillsCliDataDir };

export interface UseCase {
  id: string;
  description: string;
  category: string;
  featuresUsed: string[];
  tokenCount: number;
  originTrials?: OriginTrialMetadata[];
  volatileFeatures?: VolatileFeatureMetadata[];
}

function loadUseCases(): UseCase[] {
  const dataDir = resolveSkillsCliDataDir();
  const guidesJsonPath = path.join(dataDir, 'gen/guides.json');
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

