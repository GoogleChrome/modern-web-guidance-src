import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildSkillsInstallNpxArgs } from "./skills-install-args.ts";

describe("buildSkillsInstallNpxArgs", () => {
  it("passes -y to both npx and skills add for the default install", () => {
    const args = buildSkillsInstallNpxArgs({ platform: "linux" });

    assert.deepEqual(args, [
      "-y",
      "skills",
      "add",
      "GoogleChrome/modern-web-guidance",
      "-y",
      "--skill",
      "modern-web-guidance",
    ]);

    // npx consumes the first -y; skills add must still receive its own.
    const skillsArgv = args.slice(args.indexOf("skills"));
    assert.ok(skillsArgv.includes("-y"), "skills add must receive -y for non-interactive installs");
    assert.equal(args.filter((a) => a === "-y").length, 2);
  });

  it("omits skills -y and --skill when --choose is set so the picker stays interactive", () => {
    const args = buildSkillsInstallNpxArgs({ choose: true, platform: "darwin" });

    assert.deepEqual(args, [
      "-y",
      "skills",
      "add",
      "GoogleChrome/modern-web-guidance",
    ]);

    const skillsArgv = args.slice(args.indexOf("skills"));
    assert.ok(!skillsArgv.includes("-y"));
    assert.ok(!skillsArgv.includes("--skill"));
  });

  it("adds --copy on Windows so installs avoid symlink EPERM failures", () => {
    const args = buildSkillsInstallNpxArgs({ platform: "win32" });

    assert.deepEqual(args, [
      "-y",
      "skills",
      "add",
      "GoogleChrome/modern-web-guidance",
      "-y",
      "--skill",
      "modern-web-guidance",
      "--copy",
    ]);
    assert.ok(args.includes("--copy"));
  });

  it("adds --copy on Windows even with --choose", () => {
    const args = buildSkillsInstallNpxArgs({ choose: true, platform: "win32" });

    assert.deepEqual(args, [
      "-y",
      "skills",
      "add",
      "GoogleChrome/modern-web-guidance",
      "--copy",
    ]);
  });

  it("does not add --copy on non-Windows platforms", () => {
    assert.ok(!buildSkillsInstallNpxArgs({ platform: "linux" }).includes("--copy"));
    assert.ok(!buildSkillsInstallNpxArgs({ platform: "darwin" }).includes("--copy"));
  });

  it("keeps each flag and value as separate argv entries (no shell-joined strings)", () => {
    const args = buildSkillsInstallNpxArgs({ platform: "linux" });
    // Regression: the old implementation built a single string and split on spaces,
    // which is fragile for Windows shell escaping. Prefer discrete argv tokens.
    assert.ok(args.every((arg) => !arg.includes(" ")));
    assert.equal(args[args.indexOf("--skill") + 1], "modern-web-guidance");
  });
});
