import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



import { USE_CASES } from "./use-cases.gen.ts";



import type { UseCase } from "./use-cases.gen.ts";







export type { UseCase };

// Re-export USE_CASES so other files can use it
export { USE_CASES };

export function getUseCasesByCategory(category?: string): UseCase[] {
  if (!category) return USE_CASES;
  return USE_CASES.filter((u) => u.category === category);
}

export async function getGuide(useCaseId: string): Promise<string | null> {
  const useCase = USE_CASES.find((u) => u.id === useCaseId);
  if (!useCase) return null;

  const guidesDir = path.resolve(__dirname, "../guides");
  const filePath = path.join(guidesDir, useCase.category, `${useCaseId}.md`);

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
