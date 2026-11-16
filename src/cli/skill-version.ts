/**
 * Skill versions look like `2026_05_16-c5e78707`: the date of the commit that last
 * touched SKILL.md, plus its short SHA. The agent passes its own version to the CLI,
 * which compares it against the `skill-version.txt` bundled in the npm package.
 */

export type SkillUpdateLevel = 'none' | 'warn' | 'insist';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const CLAUDE_MARKETPLACE_FREEZE_DATE = new Date(2026, 9, 12);

function parseVersionDate(version: string | null): Date | null {
  const match = version?.match(/^(\d{4})_(\d{2})_(\d{2})/);
  if (!match) return null;

  const [_, year, month, day] = match;
  return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
}

/**
 * Anthropic stopped updating third-party plugins in `claude-plugins-official` on
 * 2026-10-12 (`v0.0.194` / `2026_10_12-dacb5911`), stranding existing installs.
 */
export function isFrozenClaudeMarketplaceVersion(callerVersion: string | null): boolean {
  const callerDate = parseVersionDate(callerVersion);
  return callerDate !== null && callerDate <= CLAUDE_MARKETPLACE_FREEZE_DATE;
}

/**
 * How loudly to tell the caller their SKILL.md is out of date:
 * 'warn' after 5 days, 'insist' after 60.
 */
export function getSkillUpdateLevel(
  callerVersion: string | null,
  latestVersion: string | null,
  now: number = Date.now(),
): SkillUpdateLevel {
  const callerDate = parseVersionDate(callerVersion);
  const latestDate = parseVersionDate(latestVersion);

  // Dates only: short SHA lengths vary between builds, and the caller can be ahead of us.
  if (!callerDate || !latestDate || callerDate >= latestDate) return 'none';

  // Whole days, so the grace period covers all of day 5 rather than expiring at midnight.
  const diffDays = Math.floor((now - callerDate.getTime()) / MS_PER_DAY);
  if (diffDays <= 5) return 'none';

  return diffDays >= 60 ? 'insist' : 'warn';
}
