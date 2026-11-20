import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSkillsRunner } from "./skills-runner.ts";

describe("getSkillsRunner", () => {
  it("selects pnpx for pnpm UA, yarn dlx for Yarn 2+, and npx -y for Yarn 1 even with devEngines", () => {
    const pnpmDir = fs.mkdtempSync(path.join(os.tmpdir(), "mwg-runner-y1-"));
    fs.writeFileSync(
      path.join(pnpmDir, "package.json"),
      JSON.stringify({ devEngines: { packageManager: { name: "pnpm" } } }),
    );
    try {
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "pnpm/10.30.3 npm/? node/v24.12.0 linux x64" }),
        { cmd: "pnpx", prefixArgs: [] },
      );
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "yarn/4.5.0 npm/? node/v24.12.0 linux x64" }),
        { cmd: "yarn", prefixArgs: ["dlx"] },
      );
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "yarn/1.22.19 npm/? node/v24.12.0 linux x64" }, pnpmDir),
        { cmd: "npx", prefixArgs: ["-y"] },
      );
    } finally {
      fs.rmSync(pnpmDir, { recursive: true, force: true });
    }
  });

  it("defaults to npx -y when UA is npm or absent without devEngines", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "mwg-runner-empty-"));
    try {
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "npm/10.9.0 node/v24.12.0 linux x64" }, emptyDir),
        { cmd: "npx", prefixArgs: ["-y"] },
      );
      assert.deepStrictEqual(getSkillsRunner({}, emptyDir), { cmd: "npx", prefixArgs: ["-y"] });
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("walks up to nearest package.json for devEngines.packageManager", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mwg-runner-walk-"));
    const subDir = path.join(root, "src");
    fs.mkdirSync(subDir);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ devEngines: { packageManager: { name: "pnpm", version: "^10.0.0" } } }),
    );
    try {
      assert.deepStrictEqual(getSkillsRunner({}, subDir), { cmd: "pnpx", prefixArgs: [] });
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "npm/12.0.2 node/v24.12.0 linux x64" }, subDir),
        { cmd: "pnpx", prefixArgs: [] },
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("skips devEngines override when onFail is warn or ignore", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mwg-runner-onfail-"));
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ devEngines: { packageManager: { name: "pnpm", onFail: "warn" } } }),
    );
    try {
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "npm/12.0.2 node/v24.12.0 linux x64" }, dir),
        { cmd: "npx", prefixArgs: ["-y"] },
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not override npm UA when devEngines array allows npm, and treats unversioned yarn as Yarn 2+", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mwg-runner-arr-"));
    try {
      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ devEngines: { packageManager: [{ name: "pnpm" }, { name: "npm" }] } }),
      );
      assert.deepStrictEqual(
        getSkillsRunner({ npm_config_user_agent: "npm/12.0.2 node/v24.12.0 linux x64" }, dir),
        { cmd: "npx", prefixArgs: ["-y"] },
      );
      assert.deepStrictEqual(getSkillsRunner({}, dir), { cmd: "pnpx", prefixArgs: [] });

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ devEngines: { packageManager: [{ name: "yarn" }] } }),
      );
      assert.deepStrictEqual(getSkillsRunner({}, dir), { cmd: "yarn", prefixArgs: ["dlx"] });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
