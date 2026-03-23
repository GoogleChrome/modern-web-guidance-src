import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.resolve(__dirname, "../.."); // guidance/
const SERVING_DIR = path.resolve(__dirname, ".."); // guidance/serving/
const DIST_DIR = path.join(ROOT_DIR, "dist/skills-cli/modern-web-use-cases");
const CLI_DIR = path.join(DIST_DIR, "cli");

async function main() {
  console.log("Generating guides and updating vector store...");
  // 1. Run build-guides.ts to update .modern-web-data and build/guides
  try {
    execSync("node --experimental-strip-types scripts/build-guides.ts", {
      cwd: SERVING_DIR,
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to build guides:", error);
    process.exit(1);
  }

  console.log(`Creating output directories in ${CLI_DIR}...`);
  // 2. Clear and create output directory
  if (fs.existsSync(CLI_DIR)) {
    fs.rmSync(CLI_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(CLI_DIR, { recursive: true });

  // Create deeper directory to mimic original path depth for relative path resolution
  const BUNDLE_OUT_DIR = path.join(CLI_DIR, "serving/bin");
  fs.mkdirSync(BUNDLE_OUT_DIR, { recursive: true });

  console.log("Copying data files...");
  // 3. Copy .modern-web-data
  const mcpDataDir = path.join(SERVING_DIR, ".modern-web-data");
  const destMcpDataDir = path.join(CLI_DIR, ".modern-web-data");
  if (fs.existsSync(mcpDataDir)) {
    fs.cpSync(mcpDataDir, destMcpDataDir, { recursive: true });
    console.log(`Copied ${mcpDataDir} to ${destMcpDataDir}`);
  } else {
    console.warn(`Warning: ${mcpDataDir} does not exist.`);
  }

  // 4. Copy build/guides
  const buildGuidesDir = path.join(SERVING_DIR, "build/guides");
  const destBuildGuidesDir = path.join(CLI_DIR, "build/guides");
  if (fs.existsSync(buildGuidesDir)) {
    fs.cpSync(buildGuidesDir, destBuildGuidesDir, { recursive: true });
    console.log(`Copied ${buildGuidesDir} to ${destBuildGuidesDir}`);
  } else {
    console.warn(`Warning: ${buildGuidesDir} does not exist.`);
  }

  console.log("Bundling modern-web.ts with esbuild...");
  // 5. Bundle modern-web.ts
  const entryPoint = path.join(SERVING_DIR, "bin/modern-web.ts");
  const outFile = path.join(BUNDLE_OUT_DIR, "modern-web.cjs");
  
  try {
    // Try to run npx esbuild or pnpm exec esbuild
    // We assume the user has esbuild accessible or npx works.
    execSync(`pnpm exec esbuild "${entryPoint}" --bundle --platform=node --format=cjs --loader:.node=file --define:import.meta.url="'__import_meta_url_placeholder__'" --external:@lancedb/lancedb --external:@huggingface/transformers --outfile="${outFile}"`, {
      stdio: "inherit",
    });
    console.log(`Bundled ${entryPoint} to ${outFile}`);

    console.log("Replacing import.meta.url placeholder in bundle...");
    let bundleContent = fs.readFileSync(outFile, "utf-8");
    bundleContent = bundleContent.replace(
      /(['"])__import_meta_url_placeholder__\1/g,
      "require('url').pathToFileURL(__filename).toString()"
    );
    fs.writeFileSync(outFile, bundleContent);
    console.log("Placeholder replaced successfully.");

    console.log("Generating package.json in output directory...");
    const packageJson = {
      name: "standalone-skills-cli",
      version: "1.0.0",
      type: "commonjs",
      dependencies: {
        "@huggingface/transformers": "^3.8.1",
        "@lancedb/lancedb": "^0.26.2"
      }
    };
    fs.writeFileSync(path.join(CLI_DIR, "package.json"), JSON.stringify(packageJson, null, 2));

    console.log("Downloading external dependencies via npm install...");
    execSync("npm install", {
      cwd: CLI_DIR,
      stdio: "inherit",
    });
    console.log("Dependencies downloaded successfully.");
  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }

  console.log("Copying SKILL.md...");
  const skillMdSource = path.join(ROOT_DIR, "skills-drafts/modern-web-use-cases/SKILL.md");
  const skillMdDest = path.join(DIST_DIR, "SKILL.md");

  if (fs.existsSync(skillMdSource)) {
    fs.copyFileSync(skillMdSource, skillMdDest);
    console.log(`Copied SKILL.md to ${skillMdDest}`);
  } else {
    console.error(`Error: SKILL.md source not found at ${skillMdSource}`);
    process.exit(1);
  }

  console.log("Generating installation manifests for AI tools...");
  
  // Gemini Extension Manifest
  const geminiExtensionJson = {
    name: "guidance-skills",
    description: "Paul Irish's agent skills and web development guidance.",
    version: "1.0.0",
    author: { name: "Paul Irish" }
  };
  fs.writeFileSync(path.join(ROOT_DIR, "dist/gemini-extension.json"), JSON.stringify(geminiExtensionJson, null, 2));

  // Claude Code Marketplace Manifest
  const claudePluginDir = path.join(ROOT_DIR, "dist/.claude-plugin");
  fs.mkdirSync(claudePluginDir, { recursive: true });
  
  const marketplaceJson = {
    name: "guidance",
    owner: { name: "Paul Irish" },
    plugins: [
      {
        name: "modern-web-use-cases",
        source: "./skills-cli/modern-web-use-cases",
        description: "Modern Web Use Cases guidance tool",
        version: "1.0.0"
      }
    ]
  };
  fs.writeFileSync(path.join(claudePluginDir, "marketplace.json"), JSON.stringify(marketplaceJson, null, 2));

  // Inner plugin.json for Claude discovery
  const pluginJson = {
    name: "modern-web-use-cases",
    description: "Modern Web Use Cases guidance tool",
    version: "1.0.0",
    author: { name: "Paul Irish" }
  };
  fs.writeFileSync(path.join(DIST_DIR, "plugin.json"), JSON.stringify(pluginJson, null, 2));

  // README.md
  const readmeContent = `# Modern Web Use Cases Skill\n\nA curated collection of web development agent skills and tools.\n\n## Installation\n\n### For Claude Code\n\`\`\`bash\n/plugin marketplace add GoogleChrome/skills-alpha\n/plugin install modern-web-use-cases@guidance\n/reload-plugins\n\`\`\`\n\n### For Gemini CLI\n\`\`\`bash\ngemini extensions install https://github.com/GoogleChrome/skills-alpha\n\`\`\`\n\n### For Vanilla Skills Pack\n\`\`\`bash\nnpx skills add GoogleChrome/skills-alpha\n\`\`\`\n`;
  fs.writeFileSync(path.join(ROOT_DIR, "dist/README.md"), readmeContent);

  // Root package.json for VS Code Extension
  const rootPackageJson = {
    name: "skills-alpha",
    displayName: "Chrome Web Development Skills",
    description: "Curated collection of agent skills for modern web development.",
    version: "1.0.0",
    publisher: "GoogleChrome",
    engines: {
      vscode: "^1.90.0"
    },
    categories: [
      "AI",
      "Other"
    ],
    contributes: {
      chatSkills: [
        {
          path: "./skills-cli/modern-web-use-cases/SKILL.md"
        }
      ]
    }
  };
  fs.writeFileSync(path.join(ROOT_DIR, "dist/package.json"), JSON.stringify(rootPackageJson, null, 2));

  console.log("\nSuccess! standalone distribution generated in dist/");
}

main().catch(console.error);
