import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export async function checkLegacyPatterns(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const inlineScripts: string[] = [];
  $('script').each((_i, el) => {
    const content = $(el).html();
    if (content && content.trim()) {
      inlineScripts.push(content);
    }
  });

  let imperativePatternFound = false;

  const checkContent = (content: string) => {
    // Heuristic: If we see addEventListener('mouseover') or 'mouseenter' it MIGHT be the old way.
    if (/\.addEventListener\(\s*["']mouseover["']\s*\)/.test(content)) {
      imperativePatternFound = true;
    }
  };

  jsFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    checkContent(content);
  });

  inlineScripts.forEach(content => {
    checkContent(content);
  });

  results.push({
    id: 'imperative-mouseover-reduced',
    passed: !imperativePatternFound,
    message: 'No addEventListener("mouseover") detected'
  });

  return results;
};
