import { appendFileSync } from "fs";
import path from "path";
import { MODERN_WEB_LOG_FILE } from "../../constants.ts";

export function logToolResult(toolName: string, result: { id: string; distance?: string | number }[]) {
  try {
    const logDir = process.env.MODERN_WEB_LOG_DIR || process.cwd();
    const logPath = path.join(logDir, MODERN_WEB_LOG_FILE);
    const logEntry = {
      timestamp: new Date().toISOString(),
      tool: toolName,
      result
    };
    appendFileSync(logPath, JSON.stringify(logEntry) + "\n", "utf8");
  } catch (err) {
    console.error("Failed to log tool result:", err);
  }
}
