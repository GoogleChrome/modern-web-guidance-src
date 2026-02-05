import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export default async function checkRedfield(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find((f) => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 1. Declarative Interestfor
  const buttonInterestFor = $('button[interestfor]');
  results.push({
    id: 'redfield-declarative-interestfor',
    passed: buttonInterestFor.length > 0,
    message: 'Refactored to use declarative interestfor attribute'
  });

  const buttonInterestTarget = $('button[interesttarget]');
  results.push({
    id: 'redfield-no-interesttarget',
    passed: buttonInterestTarget.length === 0,
    message: 'No interesttarget attribute detected'
  });

  // 2. Imperative JS Removal (Heuristic)
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  const inlineScripts: string[] = [];
  $('script').each((_i, el) => {
    const content = $(el).html();
    if (content && content.trim()) {
      inlineScripts.push(content);
    }
  });

  let interestForFeatureDetected = false;
  let imperativePatternFound = false;

  const checkContent = (content: string) => {
    // Check for interestfor polyfill / feature detection
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content)) {
      interestForFeatureDetected = true;
    }

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
    id: 'redfield-polyfill-present',
    passed: interestForFeatureDetected,
    message: 'Check for interestfor feature detection'
  });

  results.push({
    id: 'redfield-imperative-reduced',
    passed: !imperativePatternFound,
    message: 'No addEventListener("mouseover") detected'
  });

  return results;
};
