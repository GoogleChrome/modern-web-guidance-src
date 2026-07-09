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

test.describe('Resolution Optimized Pseudo Elements Grader', () => {

  test('A pseudo-element (::before or ::after) is used on a target element', async () => {
    const code = getFileContent();
    const hasPseudoInCode = code.includes('::before') || code.includes('::after') || code.includes(':before') || code.includes(':after');
    expect(hasPseudoInCode).toBe(true);
  });

  test('The pseudo-element has a standard image declaration acting as a fallback for the content or background-image property', async () => {
    const code = getFileContent();
    const hasFallback = /url\([^)]+\)/i.test(code) && (code.includes('::before') || code.includes('::after') || code.includes(':before') || code.includes(':after'));
    expect(hasFallback).toBe(true);
  });

  test('The pseudo-element uses the image-set() function for the same property, defined after the fallback', async () => {
    const code = getFileContent();
    const fallbackMatch = code.match(/(content|background|background-image):\s*url\([^)]+\)/i);
    const imageSetMatch = code.match(/(content|background|background-image):\s*(-webkit-)?image-set\(/i);
    
    expect(!!imageSetMatch).toBe(true);
    if (fallbackMatch && imageSetMatch) {
      expect(imageSetMatch.index!).toBeGreaterThan(fallbackMatch.index!);
    }
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async () => {
    const code = getFileContent();
    const hasImageSet = code.includes('image-set(') || code.includes('-webkit-image-set(');
    const has1x = code.includes('1x');
    const has2x = code.includes('2x') || code.includes('dppx');
    expect(hasImageSet && has1x && has2x).toBe(true);
  });

});
