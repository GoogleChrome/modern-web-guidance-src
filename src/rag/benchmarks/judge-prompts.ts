import { isGrade, isQueryScope, isRecord, type GuideGrade, type QueryScope } from "./dataset.ts";

export const RUBRIC_VERSION = "v1";
export const DEFAULT_JUDGE_MODEL = "gemini-3.8-flash";

export interface GuideCard {
  id: string;
  title: string;
  description: string;
  category: string;
  headings: string[];
}

export interface ParsedJudgment {
  scope: QueryScope;
  needs: string[];
  grades: GuideGrade[];
}

export function formatGuideCard(card: GuideCard): string {
  return `### ${card.id}\nTitle: ${card.title}\nDescription: ${card.description}\nSections: ${card.headings.join(" | ")}`;
}

export function buildJudgePrompt(query: string, candidates: GuideCard[], referenceGrades?: GuideGrade[]): string {
  const refRelevant = (referenceGrades ?? []).filter((g) => g.grade >= 1);
  const refBlock =
    refRelevant.length > 0
      ? `\nAlready-graded relevant guides in the corpus for this query (for calibration only; only output grades for the candidate guides below):\n${refRelevant.map((g) => `- ${g.id}: grade ${g.grade}${g.reason ? ` (${g.reason})` : ""}`).join("\n")}\n`
      : "";
  return `You are grading a search engine for "Modern Web Guidance", a library of web-platform best-practice guides (HTML, CSS, JS, accessibility, performance, security, forms, UI patterns). Coding agents send it search queries while working on real projects.

Search query from an agent:
"""${query}"""

For EACH candidate guide below, grade how useful reading it would be to the agent that sent this query:
- 2 = directly addresses a central need of the query (the agent should definitely read it)
- 1 = useful for a secondary part of the query, or relevant background the agent would plausibly benefit from
- 0 = not useful for this query (topically adjacent or keyword overlap is NOT enough)

Queries often bundle several needs; a guide can earn 2 by fully covering one central need. Judge only from the guide cards; do not assume content not indicated.

Also classify the query:
- scope: "in_domain" if it asks about client-side web platform / frontend implementation that a web best-practices library could plausibly cover; "out_of_domain" if it is primarily backend, tooling, frameworks-internals, non-web, or business logic.
- needs: list the distinct needs in the query as short phrases (1-5 items).
${refBlock}
Candidate guides:
${candidates.map(formatGuideCard).join("\n\n")}`;
}

export const JUDGE_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scope: { type: "STRING", enum: ["in_domain", "out_of_domain"] },
    needs: { type: "ARRAY", items: { type: "STRING" } },
    grades: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          grade: { type: "INTEGER" },
          reason: { type: "STRING" },
        },
        required: ["id", "grade"],
      },
    },
  },
  required: ["scope", "needs", "grades"],
} as const;

export function buildGenerateContentRequest(query: string, candidates: GuideCard[], referenceGrades?: GuideGrade[]) {
  return {
    contents: [{ parts: [{ text: buildJudgePrompt(query, candidates, referenceGrades) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: JUDGE_RESPONSE_SCHEMA,
    },
  };
}

/**
 * Validates a Gemini `generateContent` JSON response against the exact candidate guide set.
 * Fails loudly if any candidate guide was omitted, duplicated, or assigned a grade outside 0|1|2.
 */
export function parseJudgeResponse(
  responseBody: unknown,
  query: string,
  candidateIds: ReadonlySet<string>
): ParsedJudgment {
  if (!isRecord(responseBody) || !Array.isArray(responseBody.candidates)) {
    throw new Error(`Malformed judge response for "${query}": ${JSON.stringify(responseBody).slice(0, 400)}`);
  }
  const firstCand: unknown = responseBody.candidates[0];
  const parts = isRecord(firstCand) && isRecord(firstCand.content) && Array.isArray(firstCand.content.parts)
    ? firstCand.content.parts
    : [];

  const text = parts
    .filter((p: unknown): p is Record<string, unknown> => isRecord(p) && !p.thought)
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");

  if (!text) {
    throw new Error(`Empty judge response text for "${query}"`);
  }

  const parsed: unknown = JSON.parse(text);
  if (
    !isRecord(parsed) ||
    !isQueryScope(parsed.scope) ||
    !Array.isArray(parsed.needs) ||
    !Array.isArray(parsed.grades)
  ) {
    throw new Error(`Judge JSON does not match schema for "${query}": ${text.slice(0, 400)}`);
  }

  const needs = parsed.needs.map((n: unknown) => {
    if (typeof n !== "string") throw new Error(`Invalid need in judge output for "${query}"`);
    return n;
  });

  const seenIds = new Set<string>();
  const grades: GuideGrade[] = parsed.grades.map((g: unknown) => {
    if (!isRecord(g) || typeof g.id !== "string" || !isGrade(g.grade)) {
      throw new Error(`Invalid grade entry in judge output for "${query}": ${JSON.stringify(g)}`);
    }
    if (!candidateIds.has(g.id)) {
      throw new Error(`Judge returned unknown candidate "${g.id}" for "${query}"`);
    }
    if (seenIds.has(g.id)) {
      throw new Error(`Judge returned duplicate candidate "${g.id}" for "${query}"`);
    }
    seenIds.add(g.id);
    return {
      id: g.id,
      grade: g.grade,
      reason: typeof g.reason === "string" ? g.reason : undefined,
    };
  });

  for (const id of candidateIds) {
    if (!seenIds.has(id)) {
      throw new Error(`Judge omitted candidate "${id}" for "${query}"`);
    }
  }

  return { scope: parsed.scope, needs, grades };
}
