import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export async function checkLoadingPlaceholders(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 1. Check loading-placeholder attribute on <img>
  const imgWithPlaceholder = $('img[loading-placeholder]');
  results.push({
    id: 'img-loading-placeholder',
    passed: imgWithPlaceholder.length > 0,
    message: 'Found img with loading-placeholder attribute'
  });

  // 2. Check JS Feature Detection for loadingPlaceholder
  const jsFiles = files.filter((f) => f.endsWith('.js'));
  let loadingPlaceholderFeatureDetected = false;

  const checkContent = (content: string) => {
    // Match: 'loadingPlaceholder' in HTMLImageElement.prototype
    if (/['"]loadingPlaceholder['"]\s*in\s*HTMLImageElement\.prototype/.test(content)) {
      loadingPlaceholderFeatureDetected = true;
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
    id: 'js-loading-placeholder-support',
    passed: loadingPlaceholderFeatureDetected,
    message: 'JS contains loading-placeholder feature detection'
  });

  return results;
};
