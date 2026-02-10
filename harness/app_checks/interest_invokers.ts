import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export async function checkInterestInvokers(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 1. Declarative Interestfor (buttons with interestfor attribute)
  const buttonInterestFor = $('button[interestfor]');
  results.push({
    id: 'button-interestfor',
    passed: buttonInterestFor.length > 0,
    message: 'Found button with interestfor attribute'
  });

  // 2. Absence of deprecated interesttarget (buttons with interesttarget attribute)
  const buttonInterestTarget = $('button[interesttarget]');
  results.push({
    id: 'no-interesttarget',
    passed: buttonInterestTarget.length === 0,
    message: 'No deprecated interesttarget attribute found'
  });

  // 3. Check JS Polyfills / Feature Detection
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  let interestForFeatureDetected = false;

  const checkContent = (content: string) => {
    // Check for interestfor polyfill / feature detection
    // Match: .hasOwnProperty('interestForElement') or "interestForElement" with flexible quotes/spacing
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content)) {
      interestForFeatureDetected = true;
    }
  };

  jsFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    checkContent(content);
  });

  // Check inline scripts too
  $('script').each((_i, el) => {
    const content = $(el).html();
    if (content && content.trim()) {
      checkContent(content);
    }
  });

  results.push({
    id: 'js-interestfor-polyfill',
    passed: interestForFeatureDetected,
    message: 'JS contains interestfor feature detection'
  });

  return results;
};
