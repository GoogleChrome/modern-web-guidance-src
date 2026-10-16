import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Gate0Entry } from './schema.ts';

interface PilotGate0RubricsData {
  pilotGate0Entries: Gate0Entry[];
  brownfieldGuideRubric: Record<string, string>;
}

function loadRubricsData(): PilotGate0RubricsData {
  const dir = dirname(fileURLToPath(import.meta.url));
  const fallbackPath = join(dir, 'pilot-gate0-rubrics.json');
  const publishedPath = join(dir, '../../analyzer-internal/findings/2026-10-15-gate0-published-171.json');

  let entries: Gate0Entry[] = [];
  let rubrics: Record<string, string> = {};

  if (existsSync(fallbackPath)) {
    try {
      const data = JSON.parse(readFileSync(fallbackPath, 'utf8')) as PilotGate0RubricsData;
      entries = data.pilotGate0Entries ?? [];
      rubrics = data.brownfieldGuideRubric ?? {};
    } catch {
      // Fallback read failed
    }
  }

  if (existsSync(publishedPath)) {
    try {
      const pub = JSON.parse(readFileSync(publishedPath, 'utf8')) as {
        guides?: Array<{
          guideId: string;
          guideHash: string;
          classification: Gate0Entry['classification'];
          brownfieldTarget: string;
          reason: string;
        }>;
      };
      if (Array.isArray(pub.guides)) {
        const publishedMap = new Map(entries.map((e) => [e.guideId, e]));
        for (const g of pub.guides) {
          if (!publishedMap.has(g.guideId)) {
            entries.push({
              guideId: g.guideId,
              guideHash: g.guideHash,
              classification: g.classification,
              brownfieldTarget: g.brownfieldTarget,
              reason: g.reason,
            });
          }
        }
      }
    } catch {
      // Published json read failed
    }
  }

  return { pilotGate0Entries: entries, brownfieldGuideRubric: rubrics };
}

const data = loadRubricsData();
export const PILOT_GATE0_ENTRIES: readonly Gate0Entry[] = data.pilotGate0Entries;
export const BROWNFIELD_GUIDE_RUBRIC: Readonly<Record<string, string>> = data.brownfieldGuideRubric;

export function getGate0Entry(guideId: string): Gate0Entry | undefined {
  return PILOT_GATE0_ENTRIES.find((entry) => entry.guideId === guideId);
}

export function getBrownfieldRubric(guideId: string): string | undefined {
  return BROWNFIELD_GUIDE_RUBRIC[guideId];
}
