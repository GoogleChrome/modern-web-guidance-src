import fs from "fs";
import path from "path";
import { execSync, exec } from "child_process";
import { parseArgs, promisify } from "util";

const execPromise = promisify(exec);

// 1. Parse CLI and environment inputs
const parsed = parseArgs({
  options: {
    "base-ref": { type: "string" },
    "baseline-dir": { type: "string" },
    "output-path": { type: "string" }
  }
});

const TARGET_REF = parsed.values["base-ref"] || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : "origin/main");
const BASELINE_DIR = parsed.values["baseline-dir"] || process.env.BASELINE_BUILD_DIR || "/tmp/guides-baseline";
const BRANCH_DIR = path.resolve(import.meta.dirname, "../build/guides");
const OUTPUT_PATH = parsed.values["output-path"] || process.env.REPORT_OUTPUT_PATH || "";

const TEMP_REPO_DIR = "/tmp/guides-baseline-repo";

function runCommand(cmd: string, cwd?: string): string {
  return execSync(cmd, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  let mergeBase = "";

  // A. Safe Baseline Workspace Generation
  try {
    // Resolve merge base to compare relative content accurately
    mergeBase = runCommand(`git merge-base ${TARGET_REF} HEAD`);
    console.log(`Resolved base git merge ancestor hash: ${mergeBase}`);

    // Clean up active baselines directly
    try {
      runCommand(`git worktree remove -f "${TEMP_REPO_DIR}"`);
    } catch (e) {}

    console.log(`Setting up detached baseline worktree at "${TEMP_REPO_DIR}" for hash "${mergeBase}"...`);
    runCommand(`git worktree add --detach "${TEMP_REPO_DIR}" "${mergeBase}"`);

    console.log("Compiling baseline visual guides in worktree...");
    execSync("pnpm install --frozen-lockfile", { cwd: TEMP_REPO_DIR, stdio: "inherit" });
    execSync("pnpm --filter serving build", { cwd: TEMP_REPO_DIR, stdio: "inherit" });

    console.log(`Syncing baseline guides compilation to: ${BASELINE_DIR}`);
    fs.rmSync(BASELINE_DIR, { recursive: true, force: true });
    fs.mkdirSync(BASELINE_DIR, { recursive: true });
    fs.cpSync(path.join(TEMP_REPO_DIR, "serving/build/guides"), BASELINE_DIR, { recursive: true });
    console.log("Baseline guides setup completed.");

  } catch (err: any) {
    console.error("Fatal: Failed to bootstrap baseline comparison guide assets.", err);
    process.exit(1);
  } finally {
    // Cleanup worktree sandbox directly
    try {
      console.log(`Removing baseline git worktree at "${TEMP_REPO_DIR}"...`);
      runCommand(`git worktree remove -f "${TEMP_REPO_DIR}"`);
    } catch (cleanErr: any) {
      console.warn("Cleanup warning:", cleanErr.message);
    }
  }

  console.log(`Comparing branch build at "${BRANCH_DIR}" against baseline at "${BASELINE_DIR}" (target ref: ${TARGET_REF})`);

  let modifiedGuides: string[] = [];

  // 2. Extract modified guides via git history relative to merge-base
  try {
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

  // Guide process definition that runs concurrently
  async function processGuide(guide: string) {
    const filename = `${guide}.md`;
    const beforeFile = path.join(BASELINE_DIR, filename);
    const afterFile = path.join(BRANCH_DIR, filename);

    let beforeExists = false;
    let afterExists = false;

    try {
      await fs.promises.access(beforeFile);
      beforeExists = true;
    } catch {}

    try {
      await fs.promises.access(afterFile);
      afterExists = true;
    } catch {}

    if (!beforeExists) {
      return {
        guide,
        status: "new" as const,
        diffSection: `### 🆕 [NEW] ${guide}\n\nGuide newly created in this Pull Request.\n`
      };
    }

    if (!afterExists) {
      return {
        guide,
        status: "deleted" as const,
        diffSection: `### 🗑️ [DELETED] ${guide}\n\nGuide deleted in this Pull Request.\n`
      };
    }

    // Concurrent async reads
    const [beforeText, afterText] = await Promise.all([
      fs.promises.readFile(beforeFile, "utf-8"),
      fs.promises.readFile(afterFile, "utf-8")
    ]);

    const normBefore = beforeText.replace(/\r\n/g, "\n").trim();
    const normAfter = afterText.replace(/\r\n/g, "\n").trim();

    if (normBefore === normAfter) {
      return {
        guide,
        status: "verbatim" as const,
        verbatimListLine: `- \`${guide}\`\n`
      };
    }

    const anchor = guide.replace(/\//g, "-");
    const editedListLine = `- [${guide}](#user-content-${anchor})\n`;
    let diffSection = "";

    try {
      await execPromise(`git diff --no-index --ignore-space-change --ignore-blank-lines "${beforeFile}" "${afterFile}"`);
      // If no difference was found under whitespace/blank lines options, treat as verbatim
      return {
        guide,
        status: "verbatim" as const,
        verbatimListLine: `- \`${guide}\` (whitespace changes only)\n`
      };
    } catch (err: any) {
      if (err.stdout) {
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
        diffSection = `<h3 id="${anchor}">${guide}</h3>\n\n\`\`\`diff\n${escapedDiff}\n\`\`\`\n`;
      } else {
        diffSection = `<h3 id="${anchor}">${guide}</h3>\n\n\`\`\`diff\nError displaying differences.\n\`\`\`\n`;
      }
    }

    return {
      guide,
      status: "edited" as const,
      editedListLine,
      diffSection
    };
  }

  // Limit concurrency to 10 concurrent processes to respect resource constraints
  const results = await mapLimit(modifiedGuides, 10, processGuide);

  let verbatimCount = 0;
  let editedCount = 0;
  let verbatimList = "";
  let editedList = "";
  const diffSections: string[] = [];

  for (const res of results) {
    if (res.status === "new" || res.status === "deleted") {
      if (res.diffSection) diffSections.push(res.diffSection);
    } else if (res.status === "verbatim") {
      verbatimCount++;
      if (res.verbatimListLine) verbatimList += res.verbatimListLine;
    } else if (res.status === "edited") {
      editedCount++;
      if (res.editedListLine) editedList += res.editedListLine;
      if (res.diffSection) diffSections.push(res.diffSection);
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
