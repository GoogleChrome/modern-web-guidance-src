import { getGuide, getUseCase, USE_CASES } from "./guides.ts";
import { suggestGuideIds } from "./guide-ids.ts";
import { logToolResult } from "./logger.ts";
import { readMwgrc, normalizeBaselineTarget } from "../core/mwgrc.ts";
import { FEATURE_GATES } from "../core/feature-gates.ts";

export class FeatureGateError extends Error {
  readonly gateKey: "allowOriginTrials" | "allowVolatileFeatures";

  constructor(message: string, gateKey: "allowOriginTrials" | "allowVolatileFeatures") {
    super(message);
    this.name = "FeatureGateError";
    this.gateKey = gateKey;
  }
}

export class OriginTrialGateError extends FeatureGateError {
  constructor(message: string) {
    super(message, "allowOriginTrials");
    this.name = "OriginTrialGateError";
  }
}

export class VolatileFeatureGateError extends FeatureGateError {
  constructor(message: string) {
    super(message, "allowVolatileFeatures");
    this.name = "VolatileFeatureGateError";
  }
}

const MAX_ECHOED_ID_LENGTH = 80;

/** Concise error for a guide ID that does not exist, listing close matches (if any). */
export function formatUnknownGuideMessage(guideId: string, suggestions: string[]): string {
  const echoedId =
    guideId.length > MAX_ECHOED_ID_LENGTH ? `${guideId.slice(0, MAX_ECHOED_ID_LENGTH - 1)}…` : guideId;
  const hint = suggestions.length > 0 ? `Did you mean: ${suggestions.join(", ")}?` : "No similar guide IDs found.";
  return (
    `Unknown guide ID "${echoedId}". ${hint}\n` +
    `Run \`npx modern-web-guidance@latest search "<query>"\` to find valid guide IDs.`
  );
}

/** Thrown for a guide ID that does not exist; the message is concise and lists close matches. */
export class UnknownGuideError extends Error {
  readonly guideId: string;
  readonly suggestions: string[];

  constructor(guideId: string, suggestions: string[]) {
    super(formatUnknownGuideMessage(guideId, suggestions));
    this.name = "UnknownGuideError";
    this.guideId = guideId;
    this.suggestions = suggestions;
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
    throw new UnknownGuideError(
      useCaseId,
      suggestGuideIds(useCaseId, USE_CASES.map((u) => u.id))
    );
  }

  const originTrials = useCase.originTrials ?? [];
  const volatileFeatures = useCase.volatileFeatures ?? [];
  const config = readMwgrc(options?.cwd);

  if (originTrials.length > 0 || volatileFeatures.length > 0) {
    const gateChecks = [
      {
        spec: FEATURE_GATES["origin-trials"],
        items: originTrials,
        ErrorClass: OriginTrialGateError,
      },
      {
        spec: FEATURE_GATES["volatile-features"],
        items: volatileFeatures,
        ErrorClass: VolatileFeatureGateError,
      },
    ] as const;

    for (const { spec, items, ErrorClass } of gateChecks) {
      if (items.length > 0 && config[spec.optInKey] !== true) {
        const featureIds = items.map((f) => f.id).join(", ");
        throw new ErrorClass(
          formatGateMessage({
            guideId: useCaseId,
            featureIds,
            optInKey: spec.optInKey,
            cliCommand: spec.cliCommand,
            headingLabel: spec.headingLabel,
            guideSummary: spec.formatSummary(items as any),
            verb: items.length === 1 ? "is" : "are",
            riskAdjective: spec.riskAdjective,
            explicitOptOut: config[spec.optInKey] === false,
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
