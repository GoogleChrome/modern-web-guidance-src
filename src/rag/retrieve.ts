import { getGuide, getUseCase } from "./guides.ts";
import { logToolResult } from "./logger.ts";
import { readMwgrc, normalizeBaselineTarget } from "../core/mwgrc.ts";
import type { OriginTrialMetadata, VolatileFeatureMetadata } from "../core/guide-validation.ts";

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
function formatOriginTrialGateMessage(guideId: string, originTrials: OriginTrialMetadata[]): string {
  const featureIds = originTrials.map((ot) => ot.id).filter(Boolean).join(", ");
  const uniqueUrls = [...new Set(originTrials.map((ot) => ot.chromestatus_url).filter(Boolean))].join(", ");
  const urlSuffix = uniqueUrls ? ` (${uniqueUrls})` : "";
  return `> [!CAUTION]
>
> **Origin Trial features require explicit project opt-in.** Never bypass this gate (do not run \`set-allow-origin-trials\` yourself, edit \`.mwgrc\`, or read raw \`.md\` guide files from disk), and never adopt ${featureIds} unless the user explicitly asked for it.
>
> Guide \`${guideId}\` covers an active Origin Trial (${featureIds})${urlSuffix}, which is experimental and subject to change. Ask the user if they want to opt in by running this command in their terminal:
>
> \`\`\`sh
> npx modern-web-guidance@latest set-allow-origin-trials
> \`\`\`
>
> If you still write ${featureIds} code without this guide, add a bullet for \`${guideId}\` under your final \`### Modern Web Guidance\` section disclosing that it was blocked by the Origin Trial gate (unlock with \`npx modern-web-guidance@latest set-allow-origin-trials\`) and that your ${featureIds} code was written from model memory and risks being outdated.`;
}

function formatVolatileFeatureGateMessage(guideId: string, volatileFeatures: VolatileFeatureMetadata[]): string {
  const featureIds = volatileFeatures.map((vf) => vf.id).filter(Boolean).join(", ");
  const noun = volatileFeatures.length === 1 ? "a volatile feature" : "volatile features";
  const verb = volatileFeatures.length === 1 ? "is" : "are";
  return `> [!CAUTION]
>
> **Volatile features require explicit project opt-in.** Never bypass this gate (do not run \`set-allow-volatile-features\` yourself, edit \`.mwgrc\`, or read raw \`.md\` guide files from disk), and never adopt ${featureIds} unless the user explicitly asked for it.
>
> Guide \`${guideId}\` covers ${noun} (${featureIds}), which ${verb} shipped in only a single browser engine and may still change. Ask the user if they want to opt in by running this command in their terminal:
>
> \`\`\`sh
> npx modern-web-guidance@latest set-allow-volatile-features
> \`\`\`
>
> If you still write ${featureIds} code without this guide, add a bullet for \`${guideId}\` under your final \`### Modern Web Guidance\` section disclosing that it was blocked by the volatile feature gate (unlock with \`npx modern-web-guidance@latest set-allow-volatile-features\`) and that your ${featureIds} code was written from model memory and risks being outdated.`;
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
      throw new OriginTrialGateError(formatOriginTrialGateMessage(useCaseId, originTrials));
    }
    if (volatileFeatures.length > 0 && config.allowVolatileFeatures !== true) {
      throw new VolatileFeatureGateError(formatVolatileFeatureGateMessage(useCaseId, volatileFeatures));
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
