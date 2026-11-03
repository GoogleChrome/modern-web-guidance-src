import { getGuide, getUseCase } from "./guides.ts";
import { logToolResult } from "./logger.ts";
import { readMwgrc, normalizeBaselineTarget } from "../core/mwgrc.ts";

export class OriginTrialGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OriginTrialGateError";
  }
}

export class VolatileFeatureGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VolatileFeatureGateError";
  }
}

export function formatBaselineTargetBanner(rawBaseline: string | undefined): string {
  const normalized = normalizeBaselineTarget(rawBaseline);
  if (!normalized || normalized === "widely") {
    return "";
  }
  if (normalized === "newly") {
    return `> [!IMPORTANT]\n> **Project Baseline Target (\`.mwgrc\`):** \`newly\` (Baseline Newly available). Features that are **Baseline Newly available** or **Widely available** satisfy this project's browser support target — **omit** compatibility fallbacks, \`@supports not (...)\` blocks, and polyfills for them. Only implement fallbacks for features with **Limited availability**.\n\n`;
  }
  if (normalized === "limited") {
    return `> [!IMPORTANT]\n> **Project Baseline Target (\`.mwgrc\`):** \`limited\` (Limited availability). All features covered in this guide (including **Limited availability** and **Newly available** features) satisfy this project's browser support target. **Skip the \`## Fallback strategies\` section** — **do not** add compatibility fallbacks, \`@supports not (...)\` blocks, or polyfills.\n\n`;
  }
  return `> [!IMPORTANT]\n> **Project Baseline Target (\`.mwgrc\`):** \`Baseline ${normalized}\`. Features with a "Baseline since" date of \`${normalized}-12-31\` or earlier satisfy this project's browser support target — **omit** compatibility fallbacks, \`@supports not (...)\` blocks, and polyfills for them.\n\n`;
}

interface GateMessageParams {
  guideId: string;
  featureIds: string;
  optInKey: "allowOriginTrials" | "allowVolatileFeatures";
  cliCommand: "set-allow-origin-trials" | "set-allow-volatile-features";
  headingLabel: string;
  guideSummary: string;
  verb: "is" | "are";
  riskAdjective: string;
  explicitOptOut: boolean;
}

function formatGateMessage({
  guideId,
  featureIds,
  optInKey,
  cliCommand,
  headingLabel,
  guideSummary,
  verb,
  riskAdjective,
  explicitOptOut,
}: GateMessageParams): string {
  const fullCommand = `npx modern-web-guidance@latest ${cliCommand}`;
  if (explicitOptOut) {
    return `> [!CAUTION]
>
> **Project policy explicitly disables ${headingLabel} (\`.mwgrc\` sets \`"${optInKey}": false\`).** Never bypass this gate (do not edit \`.mwgrc\`, run \`${cliCommand}\` yourself, or read raw \`.md\` guide files from disk), and do not adopt ${featureIds}.
>
> Guide \`${guideId}\` covers ${guideSummary}, which ${verb} disabled by this project's \`.mwgrc\` configuration. Implement a standard cross-browser approach instead, and add a bullet for \`${guideId}\` under \`### Modern Web Guidance\` noting that ${featureIds} ${verb} disabled by \`.mwgrc\` (a human developer can enable it via \`${fullCommand}\`).`;
  }
  return `> [!CAUTION]
>
> **${headingLabel.charAt(0).toUpperCase()}${headingLabel.slice(1)} require explicit project opt-in.** Never bypass this gate (do not run \`${cliCommand}\` yourself, edit \`.mwgrc\`, or read raw \`.md\` guide files from disk). Only adopt ${featureIds} without this guide if the user explicitly named that specific API/feature — if the user only described a general product or UX goal, implement a standard cross-browser solution instead without using ${featureIds}.
>
> Guide \`${guideId}\` covers ${guideSummary}, which ${verb} ${riskAdjective} and may still change. Ask the user if they want to opt in by running this command in their terminal:
>
> \`\`\`sh
> ${fullCommand}
> \`\`\`
>
> If you still write ${featureIds} code without this guide (whether from model memory or external documentation), you MUST still add a bullet for \`${guideId}\` under your final \`### Modern Web Guidance\` section including the exact unlock command \`${fullCommand}\` and noting that unverified ${featureIds} code risks being outdated or incomplete.`;
}

export async function retrieveUseCase(useCaseId: string, options?: { cwd?: string }): Promise<string> {
  const useCase = getUseCase(useCaseId);
  if (!useCase) {
    throw new Error(`No guide found for use case: ${useCaseId}`);
  }

  const originTrials = useCase.originTrials ?? [];
  const volatileFeatures = useCase.volatileFeatures ?? [];
  const config = readMwgrc(options?.cwd);

  if (originTrials.length > 0 || volatileFeatures.length > 0) {
    if (originTrials.length > 0 && config.allowOriginTrials !== true) {
      const featureIds = originTrials.map((ot) => ot.id).filter(Boolean).join(", ");
      const uniqueUrls = [...new Set(originTrials.map((ot) => ot.chromestatus_url).filter(Boolean))].join(", ");
      const urlSuffix = uniqueUrls ? ` (${uniqueUrls})` : "";
      const singular = originTrials.length === 1;
      throw new OriginTrialGateError(
        formatGateMessage({
          guideId: useCaseId,
          featureIds,
          optInKey: "allowOriginTrials",
          cliCommand: "set-allow-origin-trials",
          headingLabel: "Origin Trial features",
          guideSummary: `${singular ? "an active Origin Trial" : "active Origin Trials"} (${featureIds})${urlSuffix}`,
          verb: singular ? "is" : "are",
          riskAdjective: "experimental",
          explicitOptOut: config.allowOriginTrials === false,
        }),
      );
    }
    if (volatileFeatures.length > 0 && config.allowVolatileFeatures !== true) {
      const featureIds = volatileFeatures.map((vf) => vf.id).filter(Boolean).join(", ");
      const singular = volatileFeatures.length === 1;
      throw new VolatileFeatureGateError(
        formatGateMessage({
          guideId: useCaseId,
          featureIds,
          optInKey: "allowVolatileFeatures",
          cliCommand: "set-allow-volatile-features",
          headingLabel: "volatile features",
          guideSummary: `${singular ? "a volatile feature" : "volatile features"} (${featureIds})`,
          verb: singular ? "is" : "are",
          riskAdjective: "shipped in only a single browser engine",
          explicitOptOut: config.allowVolatileFeatures === false,
        }),
      );
    }
    }
  }

  const guide = await getGuide(useCaseId);
  if (!guide) {
    throw new Error(`No guide found for use case: ${useCaseId}`);
  }

  logToolResult("get_best_practices", [{ id: useCaseId }]);

  const banner = formatBaselineTargetBanner(
    typeof config.baseline === "string" ? config.baseline : undefined
  );
  return banner + guide;
}
