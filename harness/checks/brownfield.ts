import fs from 'fs';
import path from 'path';
import * as cheerio from "cheerio";
import type { ScenarioCheck } from '../lib/metrics.ts';

export default async function checkBrownfield(dirPath: string, files: string[]): Promise<ScenarioCheck[]> {
  const results: ScenarioCheck[] = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 1. Check for <script type="speculationrules">
  const speculationRulesScript = $('script[type="speculationrules"]');
  results.push({
    id: 'speculationrules-script',
    passed: speculationRulesScript.length > 0,
    message: 'Found <script type="speculationrules">'
  });

  // 2. Speculation rules exclude /logout
  let excludesLogout = false;
  if (speculationRulesScript.length > 0) {
    try {
      const content = speculationRulesScript.html();
      if (content) {
        const json = JSON.parse(content);

        // Helper to recursively search for "not" -> "href_matches": "/logout"
        const hasLogoutExclusion = (obj: any): boolean => {
          if (!obj || typeof obj !== 'object') return false;

          // Check if this object is a "not" clause targeting logout
          if (obj.href_matches === '/logout') {
            return false;
          }

          for (const key in obj) {
            const value = obj[key];

            if (key === 'not') {
              // Check if the value (condition) matches /logout
              if (value && typeof value === 'object') {
                const matches = value.href_matches;
                if (matches === '/logout') return true;
                if (Array.isArray(matches) && matches.includes('/logout')) return true;
              }
            }

            if (hasLogoutExclusion(value)) return true;
          }
          return false;
        };

        excludesLogout = hasLogoutExclusion(json);
      }
    } catch {
      // Failed to parse or process
      excludesLogout = false;
    }
  }

  results.push({
    id: 'speculationrules-exclude-logout',
    passed: excludesLogout,
    message: 'Speculation rules exclude /logout'
  });

  // 3. No deprecated <link rel="prerender"> tag found
  const linkPrerender = $('link[rel="prerender"]');
  results.push({
    id: 'no-deprecated-prerender',
    passed: linkPrerender.length === 0,
    message: 'No deprecated <link rel="prerender"> tag found'
  });

  return results;
};
