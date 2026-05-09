import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// Environment / inputs
const TARGET_REF = process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main";
const BASELINE_DIR = process.env.BASELINE_BUILD_DIR || "/tmp/guides-baseline";
const BRANCH_DIR = path.resolve(import.meta.dirname, "../build/guides");
const OUTPUT_PATH = process.env.REPORT_OUTPUT_PATH || "";

function runCommand(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

async function main() {
  console.log(`Comparing branch build at "${BRANCH_DIR}" against baseline at "${BASELINE_DIR}" (target ref: ${TARGET_REF})`);

  let modifiedGuides: string[] = [];

  // 1. Extract modified guides via git history
  try {
    // Resolve common ancestor to avoid showing differences from master ahead shifts
    const mergeBase = runCommand(`git merge-base ${TARGET_REF} HEAD`);
    const gitDiff = runCommand(`git diff --name-only ${mergeBase} HEAD`);
    
    const lines = gitDiff.split("\n");
    const guideSet = new Set<string>();

    for (const file of lines) {
      if (file.startsWith("guides/")) {
        const parts = file.split("/");
        if (parts.length >= 3 && parts[1] !== "lib") {
          guideSet.add(`${parts[1]}/${parts[2]}`);
        }
      }
    }
    modifiedGuides = Array.from(guideSet);
    console.log(`Git detected ${modifiedGuides.length} modified guides.`);
  } catch (err: any) {
    console.error("Fatal: Failed to resolve Git merge differences. Guide comparison runs require a non-shallow target merge tree.", err);
    process.exit(1);
  }

  if (modifiedGuides.length === 0) {
    const report = `### 📝 Built Guides Diff Review\n\nNo modified guides detected compared to baseline.`;
    if (OUTPUT_PATH) {
      fs.writeFileSync(OUTPUT_PATH, report);
    } else {
      console.log(report);
    }
    process.exit(0);
  }

  let verbatimCount = 0;
  let editedCount = 0;
  let verbatimList = "";
  let editedList = "";
  const diffSections: string[] = [];

  for (const guide of modifiedGuides) {
    const filename = `${guide}.md`;
    const beforeFile = path.join(BASELINE_DIR, filename);
    const afterFile = path.join(BRANCH_DIR, filename);

    if (!fs.existsSync(beforeFile)) {
      diffSections.push(`### 🆕 [NEW] ${guide}\n\nGuide newly created in this Pull Request.\n`);
      continue;
    }

    if (!fs.existsSync(afterFile)) {
      diffSections.push(`### 🗑️ [DELETED] ${guide}\n\nGuide deleted in this Pull Request.\n`);
      continue;
    }

    const beforeText = fs.readFileSync(beforeFile, "utf-8").replace(/\r\n/g, "\n").trim();
    const afterText = fs.readFileSync(afterFile, "utf-8").replace(/\r\n/g, "\n").trim();

    if (beforeText === afterText) {
      verbatimCount++;
      verbatimList += `- \`${guide}\`\n`;
    } else {
      editedCount++;
      const anchor = guide.replace(/\//g, "-");
      editedList += `- [${guide}](#user-content-${anchor})\n`;

      try {
        execSync(`git diff --no-index "${beforeFile}" "${afterFile}"`, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
      } catch (err: any) {
        if (err.stdout) {
          const formattedDiff = err.stdout
            .split("\n")
            .slice(4) // Skip git diff command and index header lines
            .map((line: string) => {
              if (line.startsWith("+")) return line.startsWith("+++") ? line : `+ ${line.slice(1)}`;
              if (line.startsWith("-")) return line.startsWith("---") ? line : `- ${line.slice(1)}`;
              return line;
            })
            .join("\n");

          const escapedDiff = formattedDiff
            .replace(/`/g, "`\u200b");

          diffSections.push(`<h3 id="${anchor}">${guide}</h3>\n\n\`\`\`diff\n${escapedDiff}\n\`\`\`\n`);
        } else {
          diffSections.push(`<h3 id="${anchor}">${guide}</h3>\n\n\`\`\`diff\nError displaying differences.\n\`\`\`\n`);
        }
      }
    }
  }

  let md = `## 📝 Compiled Guides Diff Review\n\n`;
  md += `Comparison check highlighting macro expansions and red-team layout differences in this Pull Request vs. standard baseline.\n\n`;
  md += `### Summary\n`;
  md += `- **Verbatim (Macro rendering parity):** ${verbatimCount} guides\n`;
  md += `- **Refactored & Improved (Visual diffs):** ${editedCount} guides\n\n`;

  if (verbatimCount > 0) {
    md += `<details>\n<summary><b>View Verbatim Guides (${verbatimCount})</b></summary>\n\n`;
    md += verbatimList;
    md += `\n</details>\n\n`;
  }

  if (editedCount > 0) {
    md += `### Modified Visual Diffs\n\n`;
    md += editedList;
    md += `\n---\n\n`;
    md += diffSections.join("\n---\n\n");
  }

  if (OUTPUT_PATH) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, md);
    console.log(`Output report successfully built at: ${OUTPUT_PATH}`);
  } else {
    console.log(md);
  }
}

main().catch(err => {
  console.error("Execution failure:", err);
  process.exit(1);
});
