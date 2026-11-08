import fs from "node:fs";
import matter from "@11ty/gray-matter";
import { marked } from "marked";
import {
  scanAllGuides,
  getGuideMarkdownPath,
  extractH1Heading,
  stripAllComments,
  isDraftStub,
} from "./guide-validation.ts";
import { replaceMacros, type BuildTarget } from "./macros.ts";
import { getFeatureName } from "./baseline.ts";
import { config } from "./skills-config.ts";
import { computeChunkHash } from "../rag/guide-chunk-cache.ts";

export interface GuideChunk {
  guideId: string;
  category: string;
  embeddedText: string;
  hash: string;
}

export interface ParsedGuideFile {
  title: string;
  description: string;
  frontmatter: Record<string, unknown>;
  featureIds: string[];
  featuresUsed: string[];
  processedMarkdown: string;
  includedFiles: Set<string>;
}

export interface ParseGuideFileOptions {
  filePath: string;
  target?: BuildTarget;
  includedFiles?: Set<string>;
}

/**
 * Reads and parses a guide markdown file, validates frontmatter, expands macros,
 * and extracts normalized title, description, and feature IDs.
 *
 * Returns null if the guide is empty or a draft stub.
 */
export function parseGuideFile(
  options: ParseGuideFileOptions
): ParsedGuideFile | null {
  const { filePath, target = "skills-cli", includedFiles = new Set<string>() } = options;

  const content = fs.readFileSync(filePath, "utf-8");
  const { data, content: markdownBody, matter: frontmatter } = matter(content, {});

  if (stripAllComments(markdownBody).trim().length === 0 || isDraftStub(data.draft)) {
    return null;
  }
  if (!data.description || !frontmatter) {
    throw new Error(`Missing frontmatter or description in ${filePath}`);
  }

  const processedMarkdown = replaceMacros(markdownBody, filePath, {
    target,
    includedFiles,
  });
  const featureIds: string[] = data["web-feature-ids"] || [];
  const featuresUsed = featureIds.map(getFeatureName);

  const h1Title = extractH1Heading(processedMarkdown);
  const title = (
    (typeof data.title === "string" && data.title.trim()) ||
    h1Title ||
    ""
  ).trim();
  if (!title) {
    throw new Error(`Guide has no H1 heading or frontmatter title: ${filePath}`);
  }

  return {
    title,
    description: data.description,
    frontmatter: data,
    featureIds,
    featuresUsed,
    processedMarkdown,
    includedFiles,
  };
}

/**
 * Splits markdown content by headings, grouping consecutive headings without body text.
 */
export function chunkMarkdown(markdown: string): string[] {
  const tokens = marked.lexer(markdown);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let hasNonHeadingContent = false;

  for (const token of tokens) {
    if (token.type === "heading") {
      if (currentChunk.length > 0 && hasNonHeadingContent) {
        chunks.push(currentChunk.join("\n\n"));
        currentChunk = [];
        hasNonHeadingContent = false;
      }
      currentChunk.push(token.raw);
    } else {
      currentChunk.push(token.raw);
      if (token.type !== "space") {
        hasNonHeadingContent = true;
      }
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join("\n\n"));
  }

  return chunks.filter((chunk) => chunk.trim().length > 0);
}

/**
 * Formats a consistent header prepended to every guide chunk embedding input.
 */
export function formatChunkHeader(
  title: string,
  id: string,
  category: string,
  featureIds: string[]
): string {
  const header = `${title}\n${id} (${category})`;
  if (featureIds.length === 0) return header;

  const features = featureIds.map((rawFid) => {
    const name = getFeatureName(rawFid);
    const fid = rawFid.replace(/^tmp-/, "");
    const aliases = [...new Set([fid, fid.replaceAll("-", " ")])].filter(
      (a) => a.toLowerCase() !== name.toLowerCase()
    );
    return aliases.length > 0 ? `${name} (${aliases.join(", ")})` : name;
  });

  return `${header}\nFeatures: ${features.join(", ")}`;
}

export interface ExtractedGuideData {
  title: string;
  description: string;
  featureIds: string[];
  featuresUsed: string[];
  processedMarkdown: string;
  embeddedChunks: Array<{
    chunk: string;
    embeddedText: string;
    hash: string;
  }>;
}

export interface ExtractGuideChunksOptions {
  filePath: string;
  category: string;
  id: string;
  target?: BuildTarget;
  noChunking?: boolean;
  includedFiles?: Set<string>;
}

/**
 * Parses a guide markdown file via `parseGuideFile`, chunks the markdown (or preserves
 * single chunk if noChunking is true), formats the header, and generates embedded texts
 * with their deterministic chunk hashes.
 *
 * Returns null if the guide is a draft or empty stub.
 */
export function extractGuideChunks(
  options: ExtractGuideChunksOptions
): ExtractedGuideData | null {
  const {
    filePath,
    category,
    id,
    target = "skills-cli",
    noChunking = false,
    includedFiles,
  } = options;

  const parsed = parseGuideFile({ filePath, target, includedFiles });
  if (!parsed) {
    return null;
  }

  const { title, description, featureIds, featuresUsed, processedMarkdown } = parsed;

  const header = formatChunkHeader(title, id, category, featureIds);
  const summaryChunk = `# ${title}\n\n${description}`;

  const chunks = noChunking
    ? [`${summaryChunk}\n\n${processedMarkdown.trim().replace(/^#\s+[^\n]*\n?/, "")}`]
    : [...chunkMarkdown(processedMarkdown), summaryChunk];

  const embeddedChunks = chunks.map((chunk) => {
    const embeddedText = `${header}\n\n${chunk}`;
    const hash = computeChunkHash(embeddedText);
    return { chunk, embeddedText, hash };
  });

  return {
    title,
    description,
    featureIds,
    featuresUsed,
    processedMarkdown,
    embeddedChunks,
  };
}

/**
 * Scans all published guides in the corpus and generates the exact list of
 * chunks that need teacher embedding vectors.
 */
export function scanCorpusChunks(target: BuildTarget = "skills-cli"): GuideChunk[] {
  const readyGuides = scanAllGuides().filter((inv) => {
    const excluded = config.monoskill.excludeFromBundling || [];
    return inv.isPublished && !excluded.includes(inv.category) && !excluded.includes(inv.name);
  });

  const allChunks: GuideChunk[] = [];

  for (const inv of readyGuides) {
    const guidePath = getGuideMarkdownPath(inv);
    const extracted = extractGuideChunks({
      filePath: guidePath,
      category: inv.category,
      id: inv.name,
      target,
    });

    if (!extracted) {
      continue;
    }

    for (const ec of extracted.embeddedChunks) {
      allChunks.push({
        guideId: inv.name,
        category: inv.category,
        embeddedText: ec.embeddedText,
        hash: ec.hash,
      });
    }
  }

  return allChunks;
}
