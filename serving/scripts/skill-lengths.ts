import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(__dirname, "../..");
const distSkillsCliDir = path.join(workspaceRoot, "dist/skills-cli");

interface FileInfo {
  relativePath: string;
  charCount: number;
  lineCount: number;
}

function main() {
  if (!fs.existsSync(distSkillsCliDir)) {
    console.error(`Directory not found: ${distSkillsCliDir}`);
    console.error("Please run 'pnpm build' first to generate dist/skills-cli.");
    process.exit(1);
  }

  const files = fs.readdirSync(distSkillsCliDir, { recursive: true }) as string[];
  const mdFiles = files.filter(f => {
    if (!f.endsWith(".md")) return false;
    const fullPath = path.join(distSkillsCliDir, f);
    if (!fs.statSync(fullPath).isFile()) return false;

    const parts = f.split(path.sep);
    const filename = parts[parts.length - 1];
    const isSkillFile = filename === "SKILL.md";
    const isInGuides = parts.includes("guides");
    const isInReferences = parts.includes("references");

    return isSkillFile || isInGuides || isInReferences;
  });

  const results: FileInfo[] = [];

  for (const file of mdFiles) {
    const fullPath = path.join(distSkillsCliDir, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    results.push({
      relativePath: file,
      charCount: content.length,
      lineCount: content.split(/\r?\n/).length,
    });
  }

  // Sort by charCount descending
  results.sort((a, b) => b.charCount - a.charCount);

  // Print as markdown table
  console.log("| Character Count | Line Count | File Path |");
  console.log("| --- | --- | --- |");
  for (const r of results) {
    console.log(`| ${r.charCount.toLocaleString()} | ${r.lineCount.toLocaleString()} | ${r.relativePath} |`);
  }
}

main();
