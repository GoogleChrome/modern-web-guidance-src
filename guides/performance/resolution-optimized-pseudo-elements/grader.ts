import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const targetFile = process.env.TARGET_FILE;
if (!targetFile) {
  throw new Error('TARGET_FILE environment variable is required');
}

function getFileContent(): string {
  const filePath = path.resolve(targetFile!);
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf8');
  }
  return '';
}

function getPseudoElementRuleBodies(code: string): string[] {
  const clean = code.replace(/\/\*[\s\S]*?\*\//g, '');
  const bodies: string[] = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(clean)) !== null) {
    const selector = m[1].trim();
    if (/::?(?:before|after)\b/i.test(selector)) {
      bodies.push(m[2]);
    }
  }
  return bodies;
}

test.describe('Resolution Optimized Pseudo Elements Grader', () => {

  test('A pseudo-element (::before or ::after) is used on a target element', async () => {
    const code = getFileContent();
    const bodies = getPseudoElementRuleBodies(code);
    expect(bodies.length).toBeGreaterThan(0);
  });

  test('The pseudo-element uses the image-set() function for its content or background-image property', async () => {
    const code = getFileContent();
    const bodies = getPseudoElementRuleBodies(code);
    const hasImageSetOnPseudo = bodies.some((body) =>
      /(?:content|background|background-image)\s*:\s*[^;]*(-webkit-)?image-set\(/i.test(body)
    );
    expect(hasImageSetOnPseudo).toBe(true);
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async () => {
    const code = getFileContent();
    const bodies = getPseudoElementRuleBodies(code);
    const hasDensities = bodies.some((body) => {
      const m = body.match(/(-webkit-)?image-set\(([\s\S]*?)\)\s*;/i);
      const target = m ? m[2] : body;
      return (
        /(-webkit-)?image-set\(/i.test(body) &&
        /\b1x\b|\b1dppx\b/i.test(target) &&
        /\b2x\b|\b2dppx\b/i.test(target)
      );
    });
    expect(hasDensities).toBe(true);
  });

});
