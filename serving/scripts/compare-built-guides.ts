import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { parseArgs } from "util";
import { fileURLToPath } from "node:url";

interface CompareConfig {
  targetRef: string;
  baselineDir: string;
  branchDir: string;
  outputPath: string;
  tempRepoDir: string;
}

// Duplicate process environments to isolate git index settings inside child sandboxes
const safeEnv = { ...process.env };
delete safeEnv.GIT_DIR;
delete safeEnv.GIT_WORK_TREE;

function runCommand(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, env: safeEnv, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function parseConfig(): CompareConfig {
  const parsed = parseArgs({
    options: {
      "base-ref": { type: "string" },
      "baseline-dir": { type: "string" },
      "output-path": { type: "string" }
    }
  });

  return {
    targetRef: parsed.values["base-ref"] || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main"),
    baselineDir: parsed.values["baseline-dir"] || process.env.BASELINE_BUILD_DIR || "/tmp/guides-baseline",
    branchDir: path.resolve(import.meta.dirname, "../build/guides"),
    outputPath: parsed.values["output-path"] || process.env.REPORT_OUTPUT_PATH || "",
    tempRepoDir: "/tmp/guides-baseline-repo"
  };
}

function setupBaselineWorkspace(config: CompareConfig) {
  const { targetRef, tempRepoDir, baselineDir } = config;

  const mergeBase = runCommand(`git merge-base ${targetRef} HEAD`);
  console.log(`Resolved base git merge ancestor hash: ${mergeBase}`);

  // Clean up active baseline repositories directly if lingering from previous runs
  try {
    runCommand(`git worktree remove -f "${tempRepoDir}"`);
  } catch (e) {}

  try {
    console.log(`Setting up detached baseline worktree at "${tempRepoDir}" for hash "${mergeBase}"...`);
    runCommand(`git worktree add --detach "${tempRepoDir}" "${mergeBase}"`);

    console.log("Compiling baseline visual guides in worktree...");
    execSync("pnpm install --frozen-lockfile", { cwd: tempRepoDir, env: safeEnv, stdio: "inherit" });
    execSync("pnpm --filter serving build", { cwd: tempRepoDir, env: safeEnv, stdio: "inherit" });

    console.log(`Syncing baseline guides compilation to: ${baselineDir}`);
    fs.rmSync(baselineDir, { recursive: true, force: true });
    fs.mkdirSync(baselineDir, { recursive: true });
    fs.cpSync(path.join(tempRepoDir, "serving/build/guides"), baselineDir, { recursive: true });
    console.log("Baseline guides setup completed.");
  } catch (err) {
    console.error("Fatal: Failed to bootstrap baseline comparison guide assets.", err);
    process.exit(1);
  } finally {
    try {
      console.log(`Removing baseline git worktree at "${tempRepoDir}"...`);
      runCommand(`git worktree remove -f "${tempRepoDir}"`);
    } catch (cleanErr: any) {
      console.warn("Cleanup warning:", cleanErr.message);
    }
  }
}

function getModifiedGuides(targetRef: string): string[] {
  try {
    const mergeBase = runCommand(`git merge-base ${targetRef} HEAD`);
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
    const modified = Array.from(guideSet);
    console.log(`Git detected ${modified.length} modified guides.`);
    return modified;
  } catch (err) {
    console.error("Fatal: Failed to resolve Git merge differences. Guide comparison runs require a non-shallow target merge tree.", err);
    process.exit(1);
  }
}

export function compareGuides(modifiedGuides: string[], baselineDir: string, branchDir: string): string {
  let verbatimCount = 0;
  let editedCount = 0;
  let verbatimList = "";
  let editedList = "";
  const diffSections: string[] = [];

  for (const guide of modifiedGuides) {
    const filename = guide.endsWith("SKILL.md") ? guide : `${guide}.md`;
    const beforeFile = path.join(baselineDir, filename);
    const afterFile = path.join(branchDir, filename);

    // BAN TOCTOU: Read file paths directly and handle file missing ENOENT states in catch blocks
    let beforeText = "";
    try {
      beforeText = fs.readFileSync(beforeFile, "utf-8");
    } catch (e: any) {
      if (e.code === "ENOENT") {
        diffSections.push(`### 🆕 [NEW] ${guide}\n\nGuide newly created in this Pull Request.\n`);
        continue;
      }
      throw e;
    }

    let afterText = "";
    try {
      afterText = fs.readFileSync(afterFile, "utf-8");
    } catch (e: any) {
      if (e.code === "ENOENT") {
        diffSections.push(`### 🗑️ [DELETED] ${guide}\n\nGuide deleted in this Pull Request.\n`);
        continue;
      }
      throw e;
    }

    const normBefore = beforeText.replace(/\r\n/g, "\n").trim();
    const normAfter = afterText.replace(/\r\n/g, "\n").trim();

    if (normBefore === normAfter) {
      verbatimCount++;
      verbatimList += `- \`${guide}\`\n`;
    } else {
      try {
        execSync(`git diff --no-index --ignore-space-change --ignore-blank-lines "${beforeFile}" "${afterFile}"`, { env: safeEnv, encoding: "utf-8" });
        // If no difference is resolved, classify as verbatim changes only
        verbatimCount++;
        verbatimList += `- \`${guide}\` (whitespace changes only)\n`;
      } catch (err: any) {
        const anchor = guide.replace(/\//g, "-");
        if (err.stdout) {
          editedCount++;
          editedList += `- [${guide}](#user-content-${anchor})\n`;

          const formattedDiff = err.stdout
            .split("\n")
            .slice(4)
            .map((line: string) => {
              if (line.startsWith("+")) return line.startsWith("+++") ? line : `+ ${line.slice(1)}`;
              if (line.startsWith("-")) return line.startsWith("---") ? line : `- ${line.slice(1)}`;
              return line;
            })
            .join("\n");

          const escapedDiff = formattedDiff.replace(/`/g, "`\u200b");
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

  return md;
}

function writeReport(outputPath: string, report: string) {
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, report);
    console.log(`Output report successfully built at: ${outputPath}`);
  } else {
    console.log(report);
  }
}

function cleanupWorkspace(baselineDir: string) {
  try {
    fs.rmSync(baselineDir, { recursive: true, force: true });
    console.log(`Cleaning up temporary baseline guides folder at "${baselineDir}"...`);
  } catch (e) {}
}

function main() {
  const config = parseConfig();
  setupBaselineWorkspace(config);

  try {
    const modifiedGuides = getModifiedGuides(config.targetRef);
    if (modifiedGuides.length === 0) {
      writeReport(config.outputPath, "### 📝 Built Guides Diff Review\n\nNo modified guides detected compared to baseline.");
      return;
    }

    const report = compareGuides(modifiedGuides, config.baselineDir, config.branchDir);
    writeReport(config.outputPath, report);
  } finally {
    cleanupWorkspace(config.baselineDir);
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
