import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import * as esbuild from "esbuild";
import { classifyGuide, scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../mcp-server/data/baseline.ts";
import { rootDir } from "../../lib/paths.ts";

const SERVING_DIR = path.join(rootDir, "serving");
const ROOT_DIST_DIR = path.join(rootDir, "dist");
const PUBLISH_ROOT = path.join(ROOT_DIST_DIR, "skills-cli");

const DIST_DIR = path.join(PUBLISH_ROOT, "skills/modern-web-use-cases");

async function main() {
  console.log("Ensuring dist/ output directory exists...");
  fs.mkdirSync(PUBLISH_ROOT, { recursive: true });

  console.log("Generating guides and updating vector store...");
  // 1. Run build-guides.ts to update .modern-web-data and build/guides
  try {
    console.time("⏳ build-guides.ts");
    execSync("node --experimental-strip-types scripts/build-guides.ts", {
      cwd: SERVING_DIR,
      stdio: "inherit",
    });
    console.timeEnd("⏳ build-guides.ts");
  } catch (error) {
    console.error("Failed to build guides:", error);
    process.exit(1);
  }

  // Placing modern-web.mjs inside the skill directory instead of bin/ for self-containment!

  console.log("Copying installation manifests and metadata for AI tools...");
  fs.cpSync(path.join(SERVING_DIR, "skills-cli/template"), PUBLISH_ROOT, { recursive: true });


  console.log("Copying data files...");
  // 3. Copy vector_store
  const mcpDataDir = path.join(SERVING_DIR, "vector_store");
  const destMcpDataDir = path.join(PUBLISH_ROOT, "vector_store");
  if (fs.existsSync(mcpDataDir)) {
    fs.cpSync(mcpDataDir, destMcpDataDir, { recursive: true });
    console.log(`Copied ${mcpDataDir} to ${destMcpDataDir}`);
  } else {
    console.warn(`Warning: ${mcpDataDir} does not exist.`);
  }

  // 4. Copy build/guides
  const buildGuidesDir = path.join(SERVING_DIR, "build/guides");
  const destBuildGuidesDir = path.join(PUBLISH_ROOT, "guides");
  if (fs.existsSync(buildGuidesDir)) {
    fs.cpSync(buildGuidesDir, destBuildGuidesDir, { recursive: true });
    console.log(`Copied ${buildGuidesDir} to ${destBuildGuidesDir}`);
  } else {
    console.warn(`Warning: ${buildGuidesDir} does not exist.`);
  }

  console.log("Bundling modern-web.ts with esbuild...");
  // 5. Bundle modern-web.ts
  const entryPoint = path.join(SERVING_DIR, "bin/modern-web.ts");
  const outFile = path.join(PUBLISH_ROOT, "skills/modern-web-use-cases/modern-web.mjs");
  
  try {
    console.time("⏳ esbuild bundle");
    // We emit pure ESM (.mjs) using esbuild! Node 20+ handles import.meta.dirname & url natively!
    await esbuild.build({
      entryPoints: [entryPoint],
      bundle: true,
      platform: "node",
      format: "esm",
      loader: { ".node": "file" },
      external: ["@lancedb/lancedb", "@huggingface/transformers"],
      outfile: outFile,
    });
    console.timeEnd("⏳ esbuild bundle");

  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }



  console.log("Copying SKILL.md...");
  const skillMdSource = path.join(rootDir, "guides/modern-web-use-cases/SKILL.md");

  const skillMdDest = path.join(DIST_DIR, "SKILL.md");

  if (fs.existsSync(skillMdSource)) {
    fs.copyFileSync(skillMdSource, skillMdDest);
    console.log(`Copied SKILL.md to ${skillMdDest}`);
  } else {
    console.error(`Error: SKILL.md source not found at ${skillMdSource}`);
    process.exit(1);
  }

  updateReadmeWithFeaturesAndUseCases(PUBLISH_ROOT);

  let nodeModulesValid = false;
  if (fs.existsSync(path.join(PUBLISH_ROOT, "node_modules"))) {
    try {
      // npm ls will exit with code 0 if all dependencies are satisfied according to package.json!
      execSync("npm ls --depth=0", { cwd: PUBLISH_ROOT, stdio: "ignore" });
      nodeModulesValid = true;
    } catch {
      nodeModulesValid = false;
    }
  }

  const forcePublish = process.argv.includes("--force-publish") || !nodeModulesValid;

  if (!forcePublish) {
    console.log("Reusing valid node_modules in published root (npm ls passed). Pass --force-publish to overwrite.");
  } else {
    console.log("Installing dependencies and generating npm shrinkwrap in published root (so local dev matches publish)...");
    try {
      console.time("⏳ npm install & shrinkwrap");
      execSync("npm install --omit=dev", { cwd: PUBLISH_ROOT, stdio: "inherit" });
      execSync("npm shrinkwrap", { cwd: PUBLISH_ROOT, stdio: "inherit" });
      console.timeEnd("⏳ npm install & shrinkwrap");
    } catch (error) {
      console.error("Failed to run npm install or shrinkwrap:", error);
      process.exit(1);
    }
  }

  console.log("\nSuccess! standalone distribution generated in dist/skills-cli/");
}

function updateReadmeWithFeaturesAndUseCases(publishRoot: string) {
  console.log("Generating dynamic README content around features and use cases...");
  const readyGuides = scanAllGuides().filter(inv => classifyGuide(inv) === 'eval-ready');
  
  const useCaseGroupMap = new Map<string, { features: { id: string; name: string }[]; useCases: { id: string; description: string }[] }>();
  const allFeatureIds = new Set<string>();

  for (const guide of readyGuides) {
    const guidePath = path.join(guide.dir, "guide.md");
    if (!fs.existsSync(guidePath)) continue;
    
    let description = guide.name;
    try {
      const content = fs.readFileSync(guidePath, "utf-8");
      const { data } = matter(content);
      if (data.description) description = data.description;
    } catch {}

    const sortedFeatureIds = [...guide.featureIds].sort();
    const signature = sortedFeatureIds.join(',');

    sortedFeatureIds.forEach(id => allFeatureIds.add(id));

    if (!useCaseGroupMap.has(signature)) {
       const features = sortedFeatureIds.map(fId => ({ id: fId, name: getFeatureName(fId) }));
       useCaseGroupMap.set(signature, { features, useCases: [] });
    }
    useCaseGroupMap.get(signature)!.useCases.push({ id: guide.name, description });
  }

  // Sort groups alphabetically by the name of their first feature
  const sortedGroups = Array.from(useCaseGroupMap.values()).sort((a, b) => a.features[0].name.localeCompare(b.features[0].name));

  // Determine all features to generate the summary text
  const allFeaturesSorted = Array.from(allFeatureIds)
    .map(fId => ({ id: fId, name: getFeatureName(fId) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  let version = "unknown";
  try {
    const pkgJson = JSON.parse(fs.readFileSync(path.join(publishRoot, "package.json"), "utf8"));
    if (pkgJson.version) version = pkgJson.version;
  } catch {}

  let dynamicMd = `#### Skill Coverage in \`v${version}\`\n\n`;
  const featureNamesCsv = allFeaturesSorted.map(f => `\`${f.name.replace(/</g, '&lt;')}\``).join(', ');

  dynamicMd += `<details>\n<summary><strong>${allFeaturesSorted.length} web features with implementation guidance from Chrome's experts</strong>: ${featureNamesCsv}</summary>\n\n`;
  
  for (const group of sortedGroups) {
    const featureLinks = group.features.map(f => `[${f.name.replace(/</g, '&lt;')}](https://webstatus.dev/features/${f.id})`).join(', ');
    dynamicMd += `- **${featureLinks}**\n`;
    for (const uc of group.useCases) {
      dynamicMd += `  - **${uc.id}**: ${uc.description}\n`;
    }
  }
  dynamicMd += `</details>\n\n`;

  // Update README
  const readmePath = path.join(publishRoot, "README.md");
  if (fs.existsSync(readmePath)) {
    let readmeContent = fs.readFileSync(readmePath, "utf-8");
    readmeContent = readmeContent.replace('## Installation', dynamicMd + '\n\n## Installation');
    fs.writeFileSync(readmePath, readmeContent);
    console.log("README dynamically updated with features and use cases.");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(console.error);
}

export { main as buildDist };
