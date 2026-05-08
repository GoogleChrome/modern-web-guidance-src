import test from "node:test";
import assert from "node:assert";
import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const ROOT_DIR = path.resolve(import.meta.dirname, "../.."); // guidance/

test("modern-web CLI version flags in development", async () => {
  const devBinaryPath = path.join(ROOT_DIR, "serving/bin/modern-web.ts");

  // Get expected version from git describe in dev environment
  let expectedGitVersion: string | null = null;
  try {
    const url = execSync("git config --get remote.origin.url", { cwd: ROOT_DIR, encoding: "utf8" }).trim();
    if (url.includes("GoogleChrome/guidance") || url.includes("GoogleChrome/modern-web-guidance")) {
      const tag = execSync('git describe --tags --abbrev=0 --match="v*.*.*"', { cwd: ROOT_DIR, encoding: "utf8" }).trim();
      expectedGitVersion = tag.startsWith("v") ? tag.slice(1) : tag;
    }
  } catch {}

  // If git tag isn't available or fails, it should fall back to serving/package.json version
  if (!expectedGitVersion) {
    const pkgJsonRaw = await fs.readFile(path.join(ROOT_DIR, "serving/package.json"), "utf8");
    expectedGitVersion = JSON.parse(pkgJsonRaw).version || "unknown";
  }

  const versionOutLong = execSync(`node --experimental-strip-types "${devBinaryPath}" --version`, { encoding: "utf8" }).trim();
  assert.strictEqual(versionOutLong, expectedGitVersion, "Development --version output should match tag/fallback version");

  const versionOutShort = execSync(`node --experimental-strip-types "${devBinaryPath}" -v`, { encoding: "utf8" }).trim();
  assert.strictEqual(versionOutShort, expectedGitVersion, "Development -v output should match tag/fallback version");
});

test("modern-web CLI version is realistic (not fallback 1.0.0, starts with 0.0. and last digit > 89)", async () => {
  const devBinaryPath = path.join(ROOT_DIR, "serving/bin/modern-web.ts");
  const versionOut = execSync(`node --experimental-strip-types "${devBinaryPath}" --version`, { encoding: "utf8" }).trim();

  assert.notStrictEqual(versionOut, "1.0.0", "Should not return the serving package fallback 1.0.0");
  assert.match(versionOut, /^0\.0\.\d+$/, "Should match semver pattern 0.0.x");

  const lastDigitStr = versionOut.split(".").pop();
  assert.ok(lastDigitStr, "Should have a patch version");
  const patchVersion = parseInt(lastDigitStr, 10);
  assert.ok(!isNaN(patchVersion), "Patch version should be a valid number");
  assert.ok(patchVersion > 89, `Version patch number (${patchVersion}) should be greater than 89`);
});
