import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import * as esbuild from "esbuild";
import { scanAllGuides, scanDisciplineSkills } from "../../lib/guide-validation.ts";
import { getFeatureName } from "../lib/baseline.ts";
import { rootDir } from "../../lib/paths.ts";
import { processGuides } from "../scripts/build-guides.ts";
import { replaceMacros } from "../lib/macros.ts";



const SERVING_DIR = path.join(rootDir, "serving");
const ROOT_DIST_DIR = path.join(rootDir, "dist");

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

function convertSkillToUseNpx(skillDest: string) {
  let skillText = fs.readFileSync(skillDest, 'utf-8');

  function replace(from: string, to: string) {
    if (!skillText.includes(from)) {
      throw new Error(`expected: '${from}', but not found`);
    }

    skillText = skillText.replaceAll(from, to);
  }

  replace(`node <modern-web-directory>/modern-web.mjs search "<query>"`, `npx -p modern-web-guidance@latest -- modern-web search "<query>"`);
  replace(`node <modern-web-directory>/modern-web.mjs retrieve "<id>"`, `npx -p modern-web-guidance@latest -- modern-web retrieve "<id>"`);
  fs.writeFileSync(skillDest, skillText);
}

export function processSkills(publishRoot: string, distDir: string, npx: boolean) {
  console.log("Scanning for skills (SKILL.md) in guides/...");
  const skills = scanDisciplineSkills();

  for (const skill of skills) {
    const skillName = skill.name;
    const source = path.join(skill.dir, "SKILL.md");
    const skillDestDir = path.join(publishRoot, "skills", skillName);
    
    fs.mkdirSync(skillDestDir, { recursive: true });
    
    const target = npx ? 'skills-cli-npx' : 'skills-cli';
    const content = replaceMacros(fs.readFileSync(source, 'utf8'), source, { target });
    fs.writeFileSync(path.join(skillDestDir, "SKILL.md"), content);
    
    console.log(`Processed and copied skill ${skillName} (SKILL.md) to ${skillDestDir}`);
  }

  if (npx) {
    const skillDest = path.join(distDir, "SKILL.md");
    convertSkillToUseNpx(skillDest);
  }

  console.log(`Successfully copied ${skills.length} skills to distribution.`);
  return { skillsCount: skills.length, skillNames: skills.map(s => s.name) };
}

async function main(opts: {publishRoot: string, version?: string, npx?: boolean}): Promise<BuildResult | undefined> {
  const {publishRoot, version, npx} = opts;

  fs.rmSync(publishRoot, { recursive: true, force: true });
  fs.mkdirSync(publishRoot, {recursive: true});

  const DIST_DIR = path.join(publishRoot, "skills/modern-web");

  fs.mkdirSync(ROOT_DIST_DIR, { recursive: true });
  const lockFilePath = path.join(ROOT_DIST_DIR, "build-dist.lock");

  await acquireLock(lockFilePath);

  try {
    console.log("Ensuring dist/ output directory exists...");
    fs.mkdirSync(publishRoot, { recursive: true });

  console.log("Generating guides and updating vector store...");
  try {
    console.time("⏳ processGuides");
    await processGuides({
      outputDir: DIST_DIR,
      target: npx ? 'skills-cli-npx' : 'skills-cli',
    });
    console.timeEnd("⏳ processGuides");
  } catch (error) {
    console.error("Failed to build guides:", error);
    process.exit(1);
  }

  // Placing modern-web.mjs inside the skill directory instead of bin/ for self-containment!

  console.log("Copying installation manifests and metadata for AI tools...");
  fs.cpSync(path.join(SERVING_DIR, "skills-cli/template"), publishRoot, { recursive: true });

  if (version) {
    console.log(`Updating version to ${version} in distribution files...`);
    updateVersionsInDir(publishRoot, version);
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
      outfile: path.join(publishRoot, "skills/modern-web/search.mjs"),
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
    fs.writeFileSync(path.join(publishRoot, "search.meta.json"), JSON.stringify(resultSearch.metafile, null, 2));
    console.log(`Generated metafile for search.mjs at ${path.join(publishRoot, "search.meta.json")}`);

    console.log("Bundling modern-web.mjs...");
    const resultModernWeb = await esbuild.build({
      entryPoints: [path.join(SERVING_DIR, "bin/modern-web.ts")],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: path.join(publishRoot, "skills/modern-web/modern-web.mjs"),
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
      path.join(publishRoot, "THIRD_PARTY_NOTICES")
    );

    const metaFile = path.join(publishRoot, "search.meta.json");
    if (fs.existsSync(metaFile)) {
      fs.unlinkSync(metaFile);
      console.log(`Removed intermediate metafile ${metaFile}`);
    }

  } catch (error) {
    console.error("Failed to bundle with esbuild:", error);
    process.exit(1);
  }



  const { skillsCount, skillNames } = processSkills(publishRoot, DIST_DIR, !!npx);

  const { featuresCount, useCasesCount } = updateReadmeWithFeaturesAndUseCases(publishRoot);

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
  const guidesDir = path.join(publishRoot, 'skills/modern-web/guides');
  const readyGuides = scanAllGuides().filter(inv => {
    if (!inv.hasGuide) return false;

    const guideBuildPath = path.join(guidesDir, inv.category, `${inv.name}.md`);
    return fs.existsSync(guideBuildPath);
  });

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

function getLatestVersion() {
  const getLatestGitTag = () => execSync('git describe --tags --abbrev=0 --match="v*.*.*"', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  const tag = getLatestGitTag();
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let version;
  // Not sure why but in CI the `git describe` command fails. Even though we fetched tags. shrug.
  try {
    version = getLatestVersion();
  } catch (err) {
    console.error(err);
  }

  (async () => {
    try {
      await main({publishRoot: path.join(ROOT_DIST_DIR, "skills-cli-npx"), version, npx: true});
      await main({publishRoot: path.join(ROOT_DIST_DIR, "skills-cli"), version});
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

export { main as buildDist };
