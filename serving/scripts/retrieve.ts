import { getGuide } from "../mcp-server/data/modern-practices.ts";
import { logToolResult } from "../lib/logger.ts";

async function run() {
  const useCaseId = process.argv[2];
  if (!useCaseId) {
    console.error("Usage: node retrieve.ts <use_case_id>");
    process.exit(1);
  }

  try {
    const guide = await getGuide(useCaseId);
    if (!guide) {
      console.error(`No guide found for use case: ${useCaseId}`);
      process.exit(1);
    }
    logToolResult("get_best_practices", [{ id: useCaseId }]);
    console.log(guide);
  } catch (error) {
    console.error("Retrieve failed:", error);
    process.exit(1);
  }
}

run();
