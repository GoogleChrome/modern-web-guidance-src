import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import matter from "gray-matter";
import { classifyGuide, scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../mcp-server/data/baseline.ts";

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/
const SERVING_DIR = path.resolve(import.meta.dirname, ".."); // guidance/serving/
const ROOT_DIST_DIR = path.join(ROOT_DIR, "dist");
const PUBLISH_ROOT = path.join(ROOT_DIST_DIR, "skills-cli");
const DIST_DIR = path.join(PUBLISH_ROOT, "skills/modern-web-use-cases");
const CLI_DIR = path.join(DIST_DIR, "cli");

async function main() {
  console.log("Cleaning previous dist/ output...");
  if (fs.existsSync(ROOT_DIST_DIR)) {
    fs.rmSync(ROOT_DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ROOT_DIST_DIR, { recursive: true });

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

  console.log("Copying installation manifests and metadata for AI tools...");
  fs.cpSync(path.join(SERVING_DIR, "skills-cli/template"), PUBLISH_ROOT, { recursive: true });

  console.log("Renaming vscode-ext-package.json to package.json for publishing...");
  fs.renameSync(path.join(PUBLISH_ROOT, "vscode-ext-package.json"), path.join(PUBLISH_ROOT, "package.json"));

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
    execSync(`pnpm exec esbuild "${entryPoint}" --bundle --platform=node --format=cjs --loader:.node=file --define:import.meta.url="'__import_meta_url_placeholder__'" --define:import.meta.dirname="__dirname" --external:@lancedb/lancedb --external:@huggingface/transformers --outfile="${outFile}"`, {
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

    console.log("Downloading external production dependencies via npm install...");
    execSync("npm install --omit=dev", {
      cwd: CLI_DIR,
      stdio: "inherit",
    });
    console.log("Dependencies downloaded successfully.");
  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }

  console.log("Copying SKILL.md...");
  const skillMdSource = path.join(ROOT_DIR, "guides/modern-web-use-cases/SKILL.md");
  const skillMdDest = path.join(DIST_DIR, "SKILL.md");

  if (fs.existsSync(skillMdSource)) {
    fs.copyFileSync(skillMdSource, skillMdDest);
    console.log(`Copied SKILL.md to ${skillMdDest}`);
  } else {
    console.error(`Error: SKILL.md source not found at ${skillMdSource}`);
    process.exit(1);
  }

  updateReadmeWithFeaturesAndUseCases(PUBLISH_ROOT);

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
  const featureNamesCsv = allFeaturesSorted.map(f => `${f.name.replace(/</g, '&lt;')}`).join(', ');

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

main().catch(console.error);
