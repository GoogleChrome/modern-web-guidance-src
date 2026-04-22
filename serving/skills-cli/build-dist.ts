import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import * as esbuild from "esbuild";
import { scanAllGuides } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";
import { rootDir } from "../../lib/paths.ts";

const SERVING_DIR = path.join(rootDir, "serving");
const ROOT_DIST_DIR = path.join(rootDir, "dist");
const PUBLISH_ROOT = path.join(ROOT_DIST_DIR, "skills-cli");

const DIST_DIR = path.join(PUBLISH_ROOT, "skills/modern-web-use-cases");

interface BuildResult {
  featuresCount: number;
  useCasesCount: number;
  skillsCount: number;
  skillNames: string[];
}

async function acquireLock(lockFilePath: string) {
  while (fs.existsSync(lockFilePath)) {
    try {
      const pid = parseInt(fs.readFileSync(lockFilePath, 'utf-8'), 10);
      process.kill(pid, 0);
    } catch (e: any) {
      if (e.code === 'ESRCH') {
        fs.unlinkSync(lockFilePath);
        break;
      }
    }
    console.log(" Another build is in progress. Waiting...");
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  fs.writeFileSync(lockFilePath, process.pid.toString());
}

function updateVersionsInDir(publishCliDir: string, newVersion: string) {
  // Gemini
  const geminiPath = path.join(publishCliDir, "gemini-extension.json");
  const geminiData = JSON.parse(fs.readFileSync(geminiPath, 'utf8'));
  geminiData.version = newVersion;
  fs.writeFileSync(geminiPath, JSON.stringify(geminiData, null, 2) + '\n');
  console.log(`Updated ${geminiPath}`);

  // VSCode
  const vscodePath = path.join(publishCliDir, "package.json");
  const vscodeData = JSON.parse(fs.readFileSync(vscodePath, 'utf8'));
  vscodeData.version = newVersion;
  fs.writeFileSync(vscodePath, JSON.stringify(vscodeData, null, 2) + '\n');
  console.log(`Updated ${vscodePath}`);

  // Claude Plugin
  const claudePluginPath = path.join(publishCliDir, ".claude-plugin/plugin.json");
  const claudePluginData = JSON.parse(fs.readFileSync(claudePluginPath, 'utf8'));
  claudePluginData.version = newVersion;
  fs.writeFileSync(claudePluginPath, JSON.stringify(claudePluginData, null, 2) + '\n');
  console.log(`Updated ${claudePluginPath}`);

  // Claude Marketplace
  const marketplacePath = path.join(publishCliDir, ".claude-plugin/marketplace.json");
  const marketplaceData = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
  marketplaceData.plugins[0].version = newVersion;
  fs.writeFileSync(marketplacePath, JSON.stringify(marketplaceData, null, 2) + '\n');
  console.log(`Updated ${marketplacePath}`);
}

async function main(version?: string): Promise<BuildResult | undefined> {
  fs.mkdirSync(ROOT_DIST_DIR, { recursive: true });
  const lockFilePath = path.join(ROOT_DIST_DIR, "build-dist.lock");

  await acquireLock(lockFilePath);

  try {
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

  if (version) {
    console.log(`Updating version to ${version} in distribution files...`);
    updateVersionsInDir(PUBLISH_ROOT, version);
  }


  console.log("Copying data files...");

  // 4. Copy build/guides
  const buildGuidesDir = path.join(SERVING_DIR, "build/guides");
  const destBuildGuidesDir = path.join(DIST_DIR, "guides");
  if (fs.existsSync(buildGuidesDir)) {
    fs.cpSync(buildGuidesDir, destBuildGuidesDir, { recursive: true });
    console.log(`Copied ${buildGuidesDir} to ${destBuildGuidesDir}`);
  } else {
    console.warn(`Warning: ${buildGuidesDir} does not exist.`);
  }

  console.log("Copying pure JS vector file...");
  const vectorsFile = path.join(SERVING_DIR, "lib/use-cases.vectors.gen.json.gz");
  const destVectorsFile = path.join(DIST_DIR, "use-cases.vectors.gen.json.gz");
  if (fs.existsSync(vectorsFile)) {
    fs.cpSync(vectorsFile, destVectorsFile);
    console.log(`Copied ${vectorsFile} to ${destVectorsFile}`);
  }

  console.log("Copying TFJS model files...");
  const tfjsModelDir = path.join(SERVING_DIR, "lib/tfjs_model_minilm");
  const destTfjsModelDir = path.join(DIST_DIR, "tfjs_model_minilm");
  if (fs.existsSync(tfjsModelDir)) {
    fs.cpSync(tfjsModelDir, destTfjsModelDir, {
      recursive: true,
      filter: (src) => {
        const stat = fs.statSync(src);
        if (stat.isDirectory()) return true;
        const basename = path.basename(src);
        return basename === "model.json" || basename.startsWith("group1-shard");
      }
    });
    console.log(`Copied ${tfjsModelDir} to ${destTfjsModelDir}`);
  }

  try {
    console.log("Bundling search.mjs...");
    // To analyze bundle size breakdown, assign build()s return to `result` and use `esbuild.analyzeMetafile(result.metafile)`
    const resultSearch = await esbuild.build({
      entryPoints: [path.join(SERVING_DIR, "lib/search.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(PUBLISH_ROOT, "skills/modern-web-use-cases/search.mjs"),
      banner: {
        js: `// @ts-nocheck\nimport { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
      },
      external: ["sharp", "iconv-lite", "@img/colour", "tr46", "whatwg-url", "webidl-conversions"],
      sourcemap: true,
      loader: { ".node": "file" },
      metafile: true,
      minify: true,
      alias: {
        // Force transformers to use the ESM entry point to avoid CommonJS issues in the bundle
        "@huggingface/transformers": path.resolve(SERVING_DIR, "../node_modules/.pnpm/@huggingface+transformers@3.8.1/node_modules/@huggingface/transformers/src/tokenizers.js"),
        // We leverage Transformers.js only for tokenization. But it is a large dependency and
        // tries to do a lot more, including loading native dependencies (onnxruntime-node) that
        // we have no use for. We use this dummy shim to ensure we can use the library without
        // pulling in native binaries.
        "onnxruntime-node": path.resolve(SERVING_DIR, "lib/dummy-onnx.ts"),
      },
      plugins: [{
        // TFJS deep imports fail in pure Node ESM because they lack extensions.
        // In raw Node runs, tfjs-kernels.ts uses require() to load the CommonJS version (all kernels).
        // For the production bundle, we use this plugin to swap it with tfjs-kernels-precise.ts
        // which only registers the specific kernels we need, keeping the bundle small.
        name: 'use-precise-kernels',
        setup(build) {
          build.onResolve({ filter: /tfjs-kernels\.ts$/ }, _args => {
            return { path: path.resolve(SERVING_DIR, "lib/tfjs-kernels-precise.ts") }
          })
        },
      }],
    });

    console.log("Bundling modern-web.mjs...");
    const resultModernWeb = await esbuild.build({
      entryPoints: [path.join(SERVING_DIR, "bin/modern-web.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(PUBLISH_ROOT, "skills/modern-web-use-cases/modern-web.mjs"),
      plugins: [{
        name: 'rewrite-search',
        setup(build) {
          build.onResolve({ filter: /search\.ts$/ }, _args => {
            return { path: './search.mjs', external: true }
          })
        },
      }],
      loader: { ".node": "file" },
      metafile: true,
    });

    console.log("Generating THIRD_PARTY_NOTICES...");
    generateThirdPartyNotices(
      [resultSearch.metafile, resultModernWeb.metafile],
      path.join(PUBLISH_ROOT, "THIRD_PARTY_NOTICES")
    );

  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }



  console.log("Scanning for skills (SKILL.md) in guides/...");
  const guidesDirInRoot = path.join(rootDir, "guides");
  const candidates = fs.readdirSync(guidesDirInRoot, { withFileTypes: true })
    .filter(d => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'node_modules')
    .map(d => d.name);

  let skillsCount = 0;
  const skillNames: string[] = [];
  for (const candidate of candidates) {
    const skillSource = path.join(guidesDirInRoot, candidate, "SKILL.md");
    if (fs.existsSync(skillSource)) {
      const skillDestDir = path.join(PUBLISH_ROOT, "skills", candidate);
      const skillDest = path.join(skillDestDir, "SKILL.md");
      fs.mkdirSync(skillDestDir, { recursive: true });
      fs.copyFileSync(skillSource, skillDest);
      console.log(`Copied skill ${candidate} (SKILL.md) to ${skillDestDir}`);
      skillsCount++;
      skillNames.push(candidate);
    }
  }
  console.log(`Successfully copied ${skillsCount} skills to distribution.`);

  const { featuresCount, useCasesCount } = updateReadmeWithFeaturesAndUseCases(PUBLISH_ROOT);

  console.log("\nSuccess! standalone distribution generated in dist/skills-cli/");
  return { featuresCount, useCasesCount, skillsCount, skillNames };
  } finally {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  }
}

function updateReadmeWithFeaturesAndUseCases(publishRoot: string) {
  console.log("Generating dynamic README content around features and use cases...");
  const readyGuides = scanAllGuides().filter(inv => inv.hasGuide);

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

  return { featuresCount: allFeaturesSorted.length, useCasesCount: readyGuides.length };
}

function generateThirdPartyNotices(metafiles: esbuild.Metafile[], outputFilePath: string) {
  const allowedLicenses = ['MIT', 'Apache 2.0', 'Apache-2.0', 'BSD-3-Clause', 'BSD-2-Clause', 'ISC', '0BSD'];
  const paths = new Set<string>();
  
  for (const metafile of metafiles) for (const p of Object.keys(metafile.inputs)) paths.add(p);

  const nodeModules = new Map<string, string>();
  for (const filePath of paths) {
    if (!filePath.includes('node_modules')) continue;

    const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(SERVING_DIR, filePath);
    let dir = path.dirname(absolutePath);
    let pkgJsonPath;

    while (dir.startsWith(rootDir) && dir !== rootDir) {
      const candidate = path.join(dir, 'package.json');
      if (fs.existsSync(candidate)) {
        pkgJsonPath = candidate;
        break;
      }
      dir = path.dirname(dir);
    }

    if (pkgJsonPath && pkgJsonPath.includes('node_modules')) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      if (pkg.name && pkg.name !== 'guidance') nodeModules.set(pkg.name, path.dirname(pkgJsonPath));
    }
  }

  const divider = '\n\n-------------------- DEPENDENCY DIVIDER --------------------\n\n';

  const stringifiedDependencies = Array.from(nodeModules.keys()).sort().map(name => {
    const nodeModulePath = nodeModules.get(name)!;
    const dependency = JSON.parse(fs.readFileSync(path.join(nodeModulePath, 'package.json'), 'utf-8'));
    
    const licenseFilePaths = ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'LICENSE.MIT', 'LICENSE.APACHE'].map(f => path.join(nodeModulePath, f));
    const licenseFile = licenseFilePaths.find(f => fs.existsSync(f));
    if (licenseFile) dependency.licenseText = fs.readFileSync(licenseFile, 'utf-8');
    
    const license = dependency.license ?? 'N/A';
    if (!allowedLicenses.includes(license)) throw new Error(`Unapproved license for dependency ${name}: ${license}`);

    let url = dependency.homepage ?? dependency.repository;
    if (url && typeof url === 'object') url = url.url;

    return [
      `Name: ${dependency.name ?? 'N/A'}`,
      `URL: ${url ?? 'N/A'}`,
      `Version: ${dependency.version ?? 'N/A'}`,
      `License: ${license}`,
      ...(dependency.licenseText ? ['', dependency.licenseText.replaceAll('\r', '')] : [])
    ].join('\n');
  }).join(divider);

  fs.writeFileSync(outputFilePath, stringifiedDependencies);
  console.log(`Generated THIRD_PARTY_NOTICES at ${outputFilePath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { main as buildDist };
