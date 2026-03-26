import { getGuide } from "../mcp-server/data/modern-practices.ts";
import { logToolResult } from "./logger.ts";

export async function retrieveUseCase(useCaseId: string) {
  const guide = await getGuide(useCaseId);
  if (!guide) {
    throw new Error(`No guide found for use case: ${useCaseId}`);
  }
  
  // Log the result
  logToolResult("get_best_practices", [{ id: useCaseId }]);

  return guide;
}
