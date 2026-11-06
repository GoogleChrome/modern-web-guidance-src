import {
  test,
  expect,
  getTargetFiles,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';

// @ts-ignore - import.meta.url is supported by Playwright/Node ESM runner
const targetFiles: string[] = getTargetFiles(import.meta.url);

function getHtmlDocs() {
  return getHtmlDocuments(targetFiles);
}

function getAllElements(selector: string): any[] {
  return getHtmlDocs().flatMap((d) => Array.from(d.document.querySelectorAll(selector)));
}

test.describe('optimize-image-priority Target Grader', () => {
  test('Hero LCP image exists and has fetchpriority="high"', () => {
    const heroImgs = getAllElements('.hero img, header.hero img');
    const hasHighPriorityHero = heroImgs.some(
      (img) => img.getAttribute('fetchpriority')?.toLowerCase() === 'high'
    );
    expect(hasHighPriorityHero).toBe(true);
  });

  test('Hero LCP image does NOT have loading="lazy"', () => {
    const heroImgs = getAllElements('.hero img, header.hero img');
    const validHeroImg =
      heroImgs.length > 0 &&
      heroImgs.every((img) => img.getAttribute('loading')?.toLowerCase() !== 'lazy');
    expect(validHeroImg).toBe(true);
  });

  test('At least one and no more than two img elements have fetchpriority="high"', () => {
    const allImgs = getAllElements('img');
    const highPriorityCount = allImgs.filter(
      (img) => img.getAttribute('fetchpriority')?.toLowerCase() === 'high'
    ).length;
    expect(highPriorityCount >= 1 && highPriorityCount <= 2).toBe(true);
  });

  test('Any initially hidden above-the-fold images have fetchpriority="low" while visible hero images are prioritized', () => {
    const heroImgs = getAllElements('.hero img, header.hero img');
    const hiddenAboveFoldImgs = getAllElements(
      'nav [hidden] img, nav .dropdown img, nav .mega-menu img, dialog img, .modal img, .carousel [hidden] img, .carousel .inactive img'
    );
    const isValid =
      heroImgs.length > 0 &&
      hiddenAboveFoldImgs.every(
        (img) => img.getAttribute('fetchpriority')?.toLowerCase() === 'low'
      );
    expect(isValid).toBe(true);
  });

  test('Below-the-fold card images use loading="lazy"', () => {
    const belowFoldImgs = getAllElements('.card img, main img, footer img');
    const allLazy =
      belowFoldImgs.length > 0 &&
      belowFoldImgs.every((img) => img.getAttribute('loading')?.toLowerCase() === 'lazy');
    expect(allLazy).toBe(true);
  });

  test('Below-the-fold card images do NOT have the fetchpriority attribute', () => {
    const belowFoldImgs = getAllElements('.card img, main img, footer img');
    const noneHaveFetchPriority =
      belowFoldImgs.length > 0 &&
      belowFoldImgs.every((img) => !img.hasAttribute('fetchpriority'));
    expect(noneHaveFetchPriority).toBe(true);
  });

  test('No img elements use deprecated importance attribute or invalid loading="auto" attribute', () => {
    const allImgs = getAllElements('img');
    const allClean =
      allImgs.length > 0 &&
      allImgs.every(
        (img) =>
          !img.hasAttribute('importance') &&
          img.getAttribute('loading')?.toLowerCase() !== 'auto'
      );
    expect(allClean).toBe(true);
  });
});
