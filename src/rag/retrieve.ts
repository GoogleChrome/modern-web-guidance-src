import { getGuide, getUseCase } from "./guides.ts";
import { logToolResult } from "./logger.ts";
import { readMwgrc } from "./mwgrc.ts";
import type { OriginTrialMetadata } from "../core/guide-validation.ts";

export class OriginTrialGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OriginTrialGateError";
  }
}

function formatOriginTrialGateMessage(guideId: string, originTrials: OriginTrialMetadata[]): string {
  const featureIds = originTrials.map((ot) => ot.id).filter(Boolean).join(", ");
  const chromestatusUrls = originTrials.map((ot) => ot.chromestatus_url).filter(Boolean).join(", ");
  return `> [!CAUTION]
>
> **Origin Trial features MUST be explicitly authorized by a direct user request.** Never enable Origin Trial guidance or implement experimental Origin Trial APIs (${featureIds}) autonomously (i.e., do not attempt to bypass this gate or write Origin Trial code from memory unless the user has explicitly opted in).
>
> Guide \`${guideId}\` depends on an active Origin Trial (${chromestatusUrls}), which is experimental, subject to change, and requires manual token registration.
>
> Ask the user if they want to opt in to Origin Trial guidance for this project. To authorize it, the user must run this command themselves in their terminal:
>
> \`\`\`sh
> npx modern-web-guidance set-allow-origin-trials
> \`\`\``;
}

export async function retrieveUseCase(useCaseId: string, options?: { cwd?: string }): Promise<string> {
  const useCase = getUseCase(useCaseId);
  if (!useCase) {
    throw new Error(`No guide found for use case: ${useCaseId}`);
  }

  const originTrials = useCase.originTrials || [];

  if (originTrials.length > 0 && readMwgrc(options?.cwd).allowOriginTrials !== true) {
    throw new OriginTrialGateError(formatOriginTrialGateMessage(useCaseId, originTrials));
  }

  const guide = await getGuide(useCaseId);
  if (!guide) {
    throw new Error(`No guide found for use case: ${useCaseId}`);
  }

  logToolResult("get_best_practices", [{ id: useCaseId }]);

  return guide;
}
