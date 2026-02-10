import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export async function checkCssFeatures(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  const cssFiles = files.filter((f) => f.endsWith('.css'));
  let viewTimelineFound = false;
  let reducedMotionFound = false;

  const checkContent = (content: string) => {
    if (content.includes('animation-timeline: view()') || content.includes('animation-timeline:view()')) {
      viewTimelineFound = true;
    }
    if (content.includes('@media (prefers-reduced-motion')) {
      reducedMotionFound = true;
    }
  };

  cssFiles.forEach((file) => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    checkContent(content);
  });

  // Check inline styles in HTML
  $('style').each((_i, el) => {
    const content = $(el).html();
    if (content && content.trim()) {
      checkContent(content);
    }
  });

  results.push({
    id: 'css-view-timeline',
    passed: viewTimelineFound,
    message: 'CSS uses animation-timeline: view()'
  });

  results.push({
    id: 'css-reduced-motion',
    passed: reducedMotionFound,
    message: 'CSS respects prefers-reduced-motion'
  });

  return results;
};
