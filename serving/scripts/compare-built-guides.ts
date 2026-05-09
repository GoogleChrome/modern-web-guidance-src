import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { parseArgs } from "util";
import { fileURLToPath } from "node:url";

// 1. Parse and resolve CLI / GHA environment inputs
const { values } = parseArgs({
  options: {
    "base-ref": { type: "string" },
    "baseline-dir": { type: "string" },
    "output-path": { type: "string" }
  }
});

const TARGET_REF = values["base-ref"] || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
const BASELINE_DIR = values["baseline-dir"] || process.env.BASELINE_BUILD_DIR || "/tmp/guides-baseline";
const BRANCH_DIR = path.resolve(import.meta.dirname, "../build/guides");
const OUTPUT_PATH = values["output-path"] || process.env.REPORT_OUTPUT_PATH || "";
const TEMP_REPO_DIR = "/tmp/guides-baseline-repo";

// Decoupled safe execution environment mapping
const safeEnv = { ...process.env };
delete safeEnv.GIT_DIR;
delete safeEnv.GIT_WORK_TREE;

let mergeBase = "";

function runCommand(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, env: safeEnv, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function setupBaselineWorkspace() {
  mergeBase = runCommand(`git merge-base ${TARGET_REF} HEAD`);
  console.log(`Resolved base git merge ancestor: ${mergeBase}`);

  try {
    runCommand(`git worktree remove -f "${TEMP_REPO_DIR}"`);
  } catch (e) {}

  try {
    console.log(`Setting up baseline worktree at "${TEMP_REPO_DIR}"...`);
    runCommand(`git worktree add --detach "${TEMP_REPO_DIR}" "${mergeBase}"`);

    console.log("Compiling baseline visual guides...");
    execSync("pnpm install --frozen-lockfile", { cwd: TEMP_REPO_DIR, env: safeEnv, stdio: "inherit" });
    execSync("pnpm --filter serving build", { cwd: TEMP_REPO_DIR, env: safeEnv, stdio: "inherit" });

    fs.rmSync(BASELINE_DIR, { recursive: true, force: true });
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.cpSync(path.join(TEMP_REPO_DIR, "serving/build/guides"), BASELINE_DIR, { recursive: true });
  } catch (err) {
    console.error("Fatal: Failed to bootstrap baseline comparison guide assets.", err);
    process.exit(1);
  } finally {
    try {
      runCommand(`git worktree remove -f "${TEMP_REPO_DIR}"`);
    } catch (e) {}
  }
}

function getModifiedGuides(): string[] {
  try {
    const modified = Array.from(new Set(
      runCommand(`git diff --name-only ${mergeBase} HEAD`)
        .split("\n")
        .filter(f => f.startsWith("guides/"))
        .map(f => f.split("/"))
        .filter(parts => parts.length >= 3 && parts[1] !== "lib")
        .map(parts => `${parts[1]}/${parts[2]}`)
    ));
    console.log(`Git detected ${modified.length} modified guides.`);
    return modified;
  } catch (err) {
    console.error("Fatal: Failed to resolve Git merge differences.", err);
    process.exit(1);
  }
}

const readOrNull = (p: string): string | null => { try { return fs.readFileSync(p, "utf-8"); } catch { return null; } };

export function compareGuides(modifiedGuides: string[], baseline: string = BASELINE_DIR, branch: string = BRANCH_DIR): string {
  let [verbatimCount, editedCount] = [0, 0];
  let [verbatimList, editedList] = ["", ""];
  const diffSections: string[] = [];

  for (const guide of modifiedGuides) {
    const filename = guide.endsWith("SKILL.md") ? guide : `${guide}.md`;
    const beforeFile = path.join(baseline, filename);
    const afterFile = path.join(branch, filename);

    const beforeText = readOrNull(beforeFile);
    if (beforeText === null) {
      diffSections.push(`### 🆕 [NEW] ${guide}\n\nGuide newly created in this PR.\n`);
      continue;
    }

    const afterText = readOrNull(afterFile);
    if (afterText === null) {
      diffSections.push(`### 🗑️ [DELETED] ${guide}\n\nGuide deleted in this PR.\n`);
      continue;
    }

    if (beforeText.replace(/\r\n/g, "\n").trim() === afterText.replace(/\r\n/g, "\n").trim()) {
      verbatimCount++;
      verbatimList += `- \`${guide}\`\n`;
    } else {
      const anchor = guide.replace(/\//g, "-");
      try {
        execSync(`git diff --no-index --ignore-space-change --ignore-blank-lines "${beforeFile}" "${afterFile}"`, { env: safeEnv, encoding: "utf-8" });
        // If no difference is resolved, classify as verbatim changes only
        verbatimCount++;
        verbatimList += `- \`${guide}\` (whitespace changes only)\n`;
      } catch (err: any) {
        editedCount++;
        editedList += `- [${guide}](#user-content-${anchor})\n`;
        const diff = err.stdout
          ? err.stdout.split("\n").slice(4).map((l: string) => l.startsWith("+") && !l.startsWith("+++") ? `+ ${l.slice(1)}` : l.startsWith("-") && !l.startsWith("---") ? `- ${l.slice(1)}` : l).join("\n").replace(/`/g, "`\u200b")
          : "Error displaying differences.";
        diffSections.push(`<h3 id="${anchor}">${guide}</h3>\n\n\`\`\`diff\n${diff}\n\`\`\`\n`);
      }
    }
  }

  let md = `## 📝 Built Guides Diff\n\n`;
  md += `To observe the effect of macro expansions, etc.  in this Pull Request vs. merge-base.\n\n### Summary\n`;
  md += `- **Verbatim (Macro rendering parity):** ${verbatimCount} guides\n`;
  md += `- **Refactored & Improved (Visual diffs):** ${editedCount} guides\n\n`;

  if (verbatimCount > 0) {
    md += `<details>\n<summary><b>View Verbatim Guides (${verbatimCount})</b></summary>\n\n${verbatimList}\n</details>\n\n`;
  }
  if (editedCount > 0) {
    md += `### Modified Visual Diffs\n\n${editedList}\n---\n\n${diffSections.join("\n---\n\n")}`;
  }
  return md;
}

function writeReport(report: string) {
  if (OUTPUT_PATH) {
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, report);
    console.log(`Output report successfully built at: ${OUTPUT_PATH}`);
  } else {
    console.log(report);
  }
}

function cleanupWorkspace() {
  try {
    fs.rmSync(BASELINE_DIR, { recursive: true, force: true });
  } catch (e) {}
}

function main() {
  setupBaselineWorkspace();

  try {
    const modifiedGuides = getModifiedGuides();
    if (modifiedGuides.length === 0) {
      writeReport("### 📝 Built Guides Diff Review\n\nNo modified guides detected compared to baseline.");
      return;
    }

    const report = compareGuides(modifiedGuides);
    writeReport(report);
  } finally {
    cleanupWorkspace();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (err: any) {
    console.error("Execution failure:", err);
    process.exit(1);
  }
}
