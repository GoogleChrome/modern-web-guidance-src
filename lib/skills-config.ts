/**
 * Central configuration for skills bundling and publishing.
 * 💡 TIP: Run `node --experimental-strip-types serving/scripts/audit-build.ts` 
 * to preview exactly how this configuration maps across the repository files.
 */
export interface StandaloneSkill {
  /** Unique name of the skill */
  name: string;
  /** Relative path from repository root to the SKILL.md file */
  sourcePath: string;
}

export interface MonoskillConfig {
  /** Name of the primary monoskill */
  name: string;
  /** Optional: categories or specific guides inside guides/ to explicitly omit from vector store bundling */
  excludeFromBundling?: string[];
}

export interface SkillsConfiguration {
  monoskill: MonoskillConfig;
  standaloneSkills: StandaloneSkill[];
}

export const config: SkillsConfiguration = {
  monoskill: {
    name: "modern-web-guidance"
  },
  standaloneSkills: [
    // Proposal A: Standalone, not bundled
    {
      name: "chrome-extensions",
      sourcePath: "skills-src/chrome-extensions/SKILL.md"
    },
    // Primary monoskill itself is also published as a skill definition
    {
      name: "modern-web-guidance",
      sourcePath: "guides/modern-web-guidance/SKILL.md"
    }
  ]
};
