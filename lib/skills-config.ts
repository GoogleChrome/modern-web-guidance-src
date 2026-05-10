import path from "node:path";

export interface StandaloneSkill {
  /** Unique name of the skill */
  name: string;
  /** Relative path from repository root to the SKILL.md file */
  sourcePath: string;
}

export interface MonoskillConfig {
  /** Name of the primary monoskill */
  name: string;
  /** Categories of use cases to bundle into this monoskill's vector store */
  bundledCategories: string[];
  /** Required keywords that must be explicitly present in the monoskill's description */
  requiredKeywords: string[];
}

export interface SkillsConfiguration {
  monoskill: MonoskillConfig;
  standaloneSkills: StandaloneSkill[];
}

export const config: SkillsConfiguration = {
  monoskill: {
    name: "modern-web-guidance",
    bundledCategories: [
      "accessibility",
      "built-in-ai",
      "css",
      "forms",
      "html",
      "javascript",
      "passkeys",
      "performance",
      "privacy",
      "security",
      "user-experience",
      "webmcp"
    ],
    requiredKeywords: [
      "passkeys",
      "built-in-ai",
      "webmcp"
    ]
  },
  standaloneSkills: [
    // Proposal A: Standalone, not bundled
    {
      name: "chrome-extensions",
      sourcePath: "skills-drafts/chrome-extensions/SKILL.md"
    },
    {
      name: "chrome-webstore",
      sourcePath: "skills-drafts/chrome-webstore/SKILL.md"
    },
    // Primary monoskill itself is also published as a skill definition
    {
      name: "modern-web-guidance",
      sourcePath: "guides/modern-web-guidance/SKILL.md"
    }
  ]
};
