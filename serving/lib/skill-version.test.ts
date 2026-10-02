import { describe, it } from "node:test";
import assert from "node:assert";
import { getSkillUpdateLevel } from "./skill-version.ts";

const NOW = new Date(2026, 4, 16).getTime(); // 2026_05_16

/** Version string for a commit `daysAgo` days before NOW. */
function version(daysAgo: number, sha = "abc1234"): string {
  const date = new Date(NOW - daysAgo * 24 * 60 * 60 * 1000);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}_${mm}_${dd}-${sha}`;
}

describe("getSkillUpdateLevel", () => {
  it("is silent when the versions match", () => {
    assert.strictEqual(getSkillUpdateLevel("2026_05_16-c5e78707", "2026_05_16-c5e78707", NOW), "none");
  });

  it("is silent when short SHA lengths differ for the same commit", () => {
    assert.strictEqual(getSkillUpdateLevel("2026_05_16-c5e7870", "2026_05_16-c5e78707", NOW), "none");
    assert.strictEqual(getSkillUpdateLevel("2026_05_16-c5e78707", "2026_05_16-c5e7870", NOW), "none");
  });

  it("is silent when the caller is newer than the bundled version", () => {
    assert.strictEqual(getSkillUpdateLevel(version(0), version(90), NOW), "none");
  });

  it("is silent when either version is missing or unparseable", () => {
    assert.strictEqual(getSkillUpdateLevel(null, version(0), NOW), "none");
    assert.strictEqual(getSkillUpdateLevel(version(90), null, NOW), "none");
    assert.strictEqual(getSkillUpdateLevel("SKILL_VERSION", version(0), NOW), "none");
  });

  it("is silent for all of the 5 day grace period", () => {
    const middayOfDayFive = NOW + 18 * 60 * 60 * 1000;
    assert.strictEqual(getSkillUpdateLevel(version(5), version(0), middayOfDayFive), "none");
  });

  it("warns once the caller is older than the grace period", () => {
    assert.strictEqual(getSkillUpdateLevel(version(6), version(0), NOW), "warn");
    assert.strictEqual(getSkillUpdateLevel(version(59), version(0), NOW), "warn");
  });

  it("insists once the caller is 60 days old", () => {
    assert.strictEqual(getSkillUpdateLevel(version(60), version(0), NOW), "insist");
  });

  it("warns across dates even when the SHAs share a prefix", () => {
    assert.strictEqual(getSkillUpdateLevel("2026_05_09-c5e7870", "2026_05_16-c5e78707", NOW), "warn");
  });
});
