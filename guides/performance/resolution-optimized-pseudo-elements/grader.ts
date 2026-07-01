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

  test('A pseudo-element (::before or ::after) is used on a target element', async ({ page }) => {
    const code = getFileContent();
    const hasPseudoInCode = code.includes('::before') || code.includes('::after') || code.includes(':before') || code.includes(':after');
    expect(hasPseudoInCode).toBe(true);
  });

  test('The pseudo-element has a standard image declaration acting as a fallback for the content or background-image property', async ({ page }) => {
    const code = getFileContent();
    const hasFallback = code.includes('url(') && (code.includes('::before') || code.includes('::after') || code.includes(':before') || code.includes(':after'));
    expect(hasFallback).toBe(true);
  });

  test('The pseudo-element uses the image-set() function for the same property, defined after the fallback', async ({ page }) => {
    const code = getFileContent();
    const fallbackIdx = Math.max(code.indexOf('background: url('), code.indexOf('background-image: url('), code.indexOf('content: url('));
    const imageSetIdx = Math.max(code.indexOf('image-set('), code.indexOf('-webkit-image-set('));
    
    expect(imageSetIdx > -1).toBe(true);
    if (fallbackIdx > -1) {
      expect(imageSetIdx > fallbackIdx).toBe(true);
    }
  });

  test('The image-set() function includes multiple pixel density descriptors (e.g., 1x and 2x)', async ({ page }) => {
    const code = getFileContent();
    const hasImageSet = code.includes('image-set(') || code.includes('-webkit-image-set(');
    const has1x = code.includes('1x');
    const has2x = code.includes('2x') || code.includes('dppx');
    expect(hasImageSet && has1x && has2x).toBe(true);
  });

});
