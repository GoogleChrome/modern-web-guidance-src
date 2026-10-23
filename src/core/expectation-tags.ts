import fs from 'node:fs';
import { checkBaseline, resolveFeatureOrBcdBaseline } from './baseline.ts';

export const BASELINE_TARGETS = ['widely', 'newly', 'limited'] as const;
export type BaselineTarget = (typeof BASELINE_TARGETS)[number];
export type ExpectationSupportMode = 'unsupported';

/**
 * Parses expectations.md content into structured sections.
 * Supports both the legacy flat bullet format (all items treated as mustPass)
 * and the structured format with ## Must pass / ## Must fail / ## App-agnostic rules sections.
 */
export function parseExpectations(content: string): {
  mustPass: string[];
  mustFail: string[];
  appAgnostic: string[];
} {
  const hasStructuredHeadings = /^##\s+(Must pass|Must fail|App-agnostic rules)/im.test(content);

  if (!hasStructuredHeadings) {
    const bullets = content
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
    return { mustPass: bullets, mustFail: [], appAgnostic: [] };
  }

  const extract = (heading: string): string[] => {
    const pattern = new RegExp(`^##\\s+${heading}\\s*$`, 'im');
    const match = pattern.exec(content);
    if (!match) return [];
    const start = match.index + match[0].length;
    const rest = content.slice(start);
    const nextHeading = /^##\s/m.exec(rest);
    const section = nextHeading ? rest.slice(0, nextHeading.index) : rest;
    return section
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- '))
      .map(l => l.slice(2).trim());
  };

  return {
    mustPass: extract('Must pass'),
    mustFail: extract('Must fail'),
    appAgnostic: extract('App-agnostic rules'),
  };
}

/**
 * Parses an optional leading `[unsupported: <features>]` tag from an expectation bullet or test title.
 * Expectations assume all features are supported by default; `[unsupported: <features>]` scopes
 * fallback expectations to Baseline targets where at least one listed feature/BCD key is not supported.
 */
export function parseExpectationBaselineTag(bullet: string): {
  mode?: ExpectationSupportMode;
  features?: string[];
  targets?: BaselineTarget[];
  text: string;
  invalidTokens?: string[];
  rawTag?: string;
} {
  const trimmed = bullet.trim();
  const match = trimmed.match(/^\[(unsupported):\s*([^\]]*)\]\s*(.*)$/i);
  if (!match) {
    const unknownTagMatch = trimmed.match(/^(\[[a-z-]+:\s*[^\]]*\])\s*(.*)$/i);
    if (unknownTagMatch) {
      return {
        text: unknownTagMatch[2].trim(),
        invalidTokens: [unknownTagMatch[1].trim()],
        rawTag: unknownTagMatch[1].trim(),
      };
    }
    return { text: trimmed };
  }

  const mode: ExpectationSupportMode = 'unsupported';
  const rawTokens = match[2]
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
  const text = match[3].trim();

  if (rawTokens.length === 0) {
    return { mode, text, invalidTokens: ['(empty)'], rawTag: match[0].trim() };
  }

  const validFeatures: string[] = [];
  const invalidTokens: string[] = [];

  for (const token of rawTokens) {
    const baseline = resolveFeatureOrBcdBaseline(token);
    if (baseline !== undefined) {
      if (!validFeatures.includes(token)) {
        validFeatures.push(token);
      }
    } else {
      invalidTokens.push(token);
    }
  }

  let targets: BaselineTarget[] | undefined;
  if (validFeatures.length > 0 && invalidTokens.length === 0) {
    targets = BASELINE_TARGETS.filter(target =>
      validFeatures.some(token => !checkBaseline(target, token))
    );
  }

  return {
    mode,
    features: validFeatures.length > 0 ? validFeatures : undefined,
    targets,
    text,
    invalidTokens: invalidTokens.length > 0 ? invalidTokens : undefined,
    rawTag: `[unsupported: ${rawTokens.join(', ')}]`,
  };
}

/**
 * Validates that any `[unsupported: ...]` tags in `expectations.md` reference valid
 * `web-features` IDs or BCD keys, and flags unknown tags (such as `[supported: ...]`).
 */
export function validateExpectationsBaselineTags(content: string, relativePath: string): string[] {
  const errors: string[] = [];
  const parsed = parseExpectations(content);
  const allBullets = [...parsed.mustPass, ...parsed.mustFail, ...parsed.appAgnostic];

  for (const bullet of allBullets) {
    const tagInfo = parseExpectationBaselineTag(bullet);
    if (tagInfo.invalidTokens && tagInfo.invalidTokens.length > 0) {
      errors.push(
        `Invalid feature or BCD key(s) ${tagInfo.invalidTokens.map(t => `"${t}"`).join(', ')} in ${relativePath}: "${bullet}". Expectations assume support by default; only use [unsupported: <feature-id>] with a valid web-features ID or BCD key for fallback expectations.`
      );
    }
  }

  return errors;
}

/**
 * Computes all unique non-`widely` Baseline targets (`newly`, `limited`) needed to evaluate
 * the `[unsupported: ...]` feature tags in `expectations.md`
 * (accepts either raw markdown content or a file path).
 */
export function getBaselineTargetsForExpectations(
  expectationsContentOrPath: string
): Exclude<BaselineTarget, 'widely'>[] {
  const content =
    !expectationsContentOrPath.includes('\n') && fs.existsSync(expectationsContentOrPath)
      ? fs.readFileSync(expectationsContentOrPath, 'utf-8')
      : expectationsContentOrPath;
  if (!content) return [];

  const parsed = parseExpectations(content);
  const allBullets = [...parsed.mustPass, ...parsed.mustFail, ...parsed.appAgnostic];
  const nonWidely = new Set<Exclude<BaselineTarget, 'widely'>>();

  for (const bullet of allBullets) {
    const { features: tagFeatures } = parseExpectationBaselineTag(bullet);
    if (!tagFeatures) continue;
    for (const token of tagFeatures) {
      const baseline = resolveFeatureOrBcdBaseline(token);
      if (baseline === 'low') {
        nonWidely.add('newly');
      } else if (baseline === false) {
        nonWidely.add('limited');
      }
    }
  }

  return (['newly', 'limited'] as const).filter(t => nonWidely.has(t));
}
