import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import * as esbuild from "esbuild";
import { config } from "../../lib/skills-config.ts";
import { rootDir } from "../../lib/paths.ts";
import { processGuides } from "../scripts/build-guides.ts";
import { replaceMacros } from "../lib/macros.ts";
import { updateReadmeWithFeaturesAndUseCases } from "./build-readme.ts";

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

  // VSCode
  const vscodePath = path.join(publishCliDir, "package.json");
  const vscodeData = JSON.parse(fs.readFileSync(vscodePath, 'utf8'));
  vscodeData.version = newVersion;
  fs.writeFileSync(vscodePath, JSON.stringify(vscodeData, null, 2) + '\n');

  // Claude Plugin
  const claudePluginPath = path.join(publishCliDir, ".claude-plugin/plugin.json");
  const claudePluginData = JSON.parse(fs.readFileSync(claudePluginPath, 'utf8'));
  claudePluginData.version = newVersion;
  fs.writeFileSync(claudePluginPath, JSON.stringify(claudePluginData, null, 2) + '\n');

  // Claude Marketplace
  const marketplacePath = path.join(publishCliDir, ".claude-plugin/marketplace.json");
  const marketplaceData = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
  marketplaceData.plugins[0].version = newVersion;
  fs.writeFileSync(marketplacePath, JSON.stringify(marketplaceData, null, 2) + '\n');


  // Cursor Plugin
  const cursorPluginPath = path.join(publishCliDir, ".cursor-plugin/plugin.json");
  const cursorPluginData = JSON.parse(fs.readFileSync(cursorPluginPath, 'utf8'));
  cursorPluginData.version = newVersion;
  fs.writeFileSync(cursorPluginPath, JSON.stringify(cursorPluginData, null, 2) + '\n');

}

export function processSkills(publishRoot: string) {
  console.log("Processing standalone skills from configuration...");
  const skills = config.standaloneSkills;

  for (const skill of skills) {
    const skillName = skill.name;
    const source = path.join(rootDir, skill.sourcePath);
    const skillDestDir = path.join(publishRoot, "skills", skillName);

    fs.mkdirSync(skillDestDir, { recursive: true });

    const target = 'skills-cli';

    // Copy sibling directories and files (e.g., references)
    const sourceDir = path.dirname(source);
    if (fs.existsSync(sourceDir)) {
      const entries = fs.readdirSync(sourceDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === "SKILL.md") continue;
        const entrySrc = path.join(sourceDir, entry.name);
        const entryDest = path.join(skillDestDir, entry.name);
        fs.cpSync(entrySrc, entryDest, { recursive: true });
      }
    }

    // Versioning.
    //
    // - This identifier only changes when the SKILL.md does.
    // - skill-version.txt is published to npm, and the modern-web-guidance CLI uses
    //   it to know what version is the latest.
    // - We replace "--skill-version SKILL_VERSION" in SKILL.md, such that agents will
    //   call npx and pass along the agent's version.
    // - If they differ, the CLI tool logs a warning to stderr with instructions on how
    //   to update.
    const skillVersion = execSync(
      'git log -1 --date=format:"%Y_%m_%d" --pretty=format:"%cd-%h" SKILL.md',
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], cwd: sourceDir }
    ).trim();
    fs.writeFileSync(path.join(skillDestDir, 'skill-version.txt'), skillVersion);

    const content = replaceMacros(fs.readFileSync(source, 'utf8'), source, { target })
      .replaceAll('SKILL_VERSION', skillVersion);
    fs.writeFileSync(path.join(skillDestDir, "SKILL.md"), content);
  }

  return { skillsCount: skills.length, skillNames: skills.map(s => s.name) };
}

async function main(opts: { publishRoot: string, version?: string}): Promise<BuildResult | undefined> {
  const { publishRoot, version} = opts;

  const DIST_DIR = path.join(publishRoot, "skills/modern-web-guidance");

  // TODO(paulirish): Refactor this build script to be less convoluted:
  // 1. Separate cache checking from execution in processGuides.
  // 2. Use better function names (e.g. prepareGuidesAndEmbeddings, isCacheValid).
  // 3. Avoid the double-call pattern to processGuides.

  // Wipe publishRoot completely to ensure a clean build.
  fs.rmSync(publishRoot, { recursive: true, force: true });
  fs.mkdirSync(publishRoot, { recursive: true });

  // Restore the fresh vectors/guides from .cache/ into DIST_DIR.
  await processGuides({
    outputDir: DIST_DIR,
    target: 'skills-cli',
  });

  fs.mkdirSync(ROOT_DIST_DIR, { recursive: true });
  const lockFilePath = path.join(ROOT_DIST_DIR, "build-dist.lock");

  await acquireLock(lockFilePath);

  try {
    fs.cpSync(path.join(SERVING_DIR, "skills-cli/template"), publishRoot, { recursive: true });

    if (version) {
      updateVersionsInDir(publishRoot, version);
    }

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
        outfile: path.join(publishRoot, "skills/modern-web-guidance/search.mjs"),
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
        outfile: path.join(publishRoot, "skills/modern-web-guidance/modern-web.mjs"),
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

      generateThirdPartyNotices(
        [resultSearch.metafile, resultModernWeb.metafile],
        path.join(publishRoot, "THIRD_PARTY_NOTICES")
      );

      const metaFile = path.join(publishRoot, "search.meta.json");
      if (fs.existsSync(metaFile)) {
        fs.unlinkSync(metaFile);
      }

    } catch (error) {
      console.error("Failed to bundle with esbuild:", error);
      process.exit(1);
    }

    const { skillsCount, skillNames } = processSkills(publishRoot);
    const { featuresCount, useCasesCount } = updateReadmeWithFeaturesAndUseCases(publishRoot);

    console.log(`\nSuccess! standalone distribution generated in ${publishRoot}`);
    return { featuresCount, useCasesCount, skillsCount, skillNames };
  } finally {
    if (fs.existsSync(lockFilePath)) {
      fs.unlinkSync(lockFilePath);
    }
  }
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
}

function getLatestVersion() {
  const getLatestGitTag = () => execSync('git tag -l "v*.*.*" --merged HEAD --sort=-v:refname | head -n 1 | grep .', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  const tag = getLatestGitTag();
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  return version;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let version;
  // Not sure why but in CI this command sometimes fails. Even though we fetched tags. shrug.
  try {
    version = getLatestVersion();
  } catch (err) {
    console.error(err);
  }

  (async () => {
    try {
      await main({ publishRoot: path.join(ROOT_DIST_DIR, "skills-cli"), version });
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  })();
}

export { main as buildDist };
