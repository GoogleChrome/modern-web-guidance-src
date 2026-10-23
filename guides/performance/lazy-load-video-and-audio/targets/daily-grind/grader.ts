import {
  test,
  expect,
  getTargetFiles,
  getJsProject,
  getHtmlDocuments,
} from '../../../../../src/grading/test-fixture.ts';
import { SyntaxKind, type Project } from 'ts-morph';

// @ts-ignore
const targetFiles: string[] = getTargetFiles(import.meta.url);

function hasMediaLoadingFeatureDetection(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  return sourceFiles.some((sf) => {
    // 1. Call expressions: Object.hasOwn(...) or .hasOwnProperty(...)
    const calls = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    const hasCall = calls.some((call) => {
      const expr = call.getExpression().getText();
      const args = call.getArguments().map((a) => a.getText());
      const isHasOwnOrProperty = expr.endsWith('hasOwn') || expr.endsWith('hasOwnProperty');
      const checksPrototype =
        args.some((a) => /HTML(?:Media|Video|Audio)Element\.prototype/.test(a)) ||
        /HTML(?:Media|Video|Audio)Element\.prototype/.test(expr);
      const checksLoading = args.some((a) => /['"`]loading['"`]/.test(a));
      return isHasOwnOrProperty && checksPrototype && checksLoading;
    });

    // 2. Binary expressions: 'loading' in HTMLMediaElement.prototype
    const binaryExprs = sf.getDescendantsOfKind(SyntaxKind.BinaryExpression);
    const hasBinary = binaryExprs.some((bin) => {
      return (
        bin.getOperatorToken().getText() === 'in' &&
        /['"`]loading['"`]/.test(bin.getLeft().getText()) &&
        /HTML(?:Media|Video|Audio)Element\.prototype/.test(bin.getRight().getText())
      );
    });

    // 3. Direct property access: HTMLMediaElement.prototype.loading
    const propAccesses = sf.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression);
    const hasPropAccess = propAccesses.some((prop) => {
      return (
        prop.getName() === 'loading' &&
        /HTML(?:Media|Video|Audio)Element\.prototype/.test(prop.getExpression().getText())
      );
    });

    return hasCall || hasBinary || hasPropAccess;
  });
}

function hasIntersectionObserverFallback(project: Project): boolean {
  const sourceFiles = project.getSourceFiles();
  if (sourceFiles.length === 0) return false;

  return sourceFiles.some((sf) => {
    const newExprs = sf.getDescendantsOfKind(SyntaxKind.NewExpression);
    const createsObserver = newExprs.some((n) =>
      n.getExpression().getText().endsWith('IntersectionObserver')
    );
    const callExprs = sf.getDescendantsOfKind(SyntaxKind.CallExpression);
    const callsObserve = callExprs.some((call) =>
      call.getExpression().getText().endsWith('.observe')
    );
    return createsObserver && callsObserve;
  });
}

test.describe('lazy-load-video-and-audio Target Grader', () => {
  // Requirement 1: Above-the-fold <video> elements located within the initial viewport do not set loading="lazy".
  test('above-the-fold video elements located within the initial viewport do not set loading="lazy"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allVideos = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('video')));
    const aboveTheFoldVideos = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('header video, .hero video, nav video'))
    );
    const hasLazyAboveTheFold = aboveTheFoldVideos.some(
      (v: any) => v.getAttribute('loading') === 'lazy'
    );
    expect(allVideos.length > 0 && !hasLazyAboveTheFold).toBe(true);
  });

  // Requirement 2: Offscreen <video> elements located below the fold set loading="lazy" to defer media and poster downloads until approaching the viewport.
  test('offscreen video elements located below the fold set loading="lazy"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const offscreenVideos = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('main video, section video')).filter(
        (v: any) => !v.closest('header, .hero, nav')
      )
    );
    const hasLazyOffscreenVideo =
      offscreenVideos.length > 0 &&
      offscreenVideos.every((v: any) => v.getAttribute('loading') === 'lazy');
    expect(hasLazyOffscreenVideo).toBe(true);
  });

  // Requirement 3: Every <video > element sets explicit width and height attributes and renders with non-zero bounding box dimensions to prevent layout shifts while the video loads (whether lazily or not).
  test('every video element sets explicit width and height attributes to prevent layout shifts', () => {
    const docs = getHtmlDocuments(targetFiles);
    const allVideos = docs.flatMap(({ document }) => Array.from(document.querySelectorAll('video')));
    const allVideosHaveExplicitDimensions =
      allVideos.length > 0 &&
      allVideos.every((v: any) => {
        const width = parseInt(v.getAttribute('width') || '0', 10);
        const height = parseInt(v.getAttribute('height') || '0', 10);
        return !Number.isNaN(width) && width > 0 && !Number.isNaN(height) && height > 0;
      });
    expect(allVideosHaveExplicitDimensions).toBe(true);
  });

  // Requirement 4: Offscreen <audio> elements located below the fold set loading="lazy" to defer audio downloads until approaching the viewport.
  test('offscreen audio elements located below the fold set loading="lazy"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const offscreenAudios = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('main audio, section audio, figure audio'))
    );
    const hasLazyOffscreenAudio =
      offscreenAudios.length > 0 &&
      offscreenAudios.every((a: any) => a.getAttribute('loading') === 'lazy');
    expect(hasLazyOffscreenAudio).toBe(true);
  });

  // Requirement 5: Every <audio loading="lazy"> element includes the controls attribute so the player is visibly rendered and can intersect the viewport.
  test('every audio loading="lazy" element includes the controls attribute', () => {
    const docs = getHtmlDocuments(targetFiles);
    const lazyAudios = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('audio[loading="lazy"]'))
    );
    const allLazyAudiosHaveControls =
      lazyAudios.length > 0 && lazyAudios.every((a: any) => a.hasAttribute('controls'));
    expect(allLazyAudiosHaveControls).toBe(true);
  });

  // Requirement 6a: Offscreen media elements pair loading="lazy" with a fallback strategy (such as preload="metadata" or preload="none").
  test('offscreen media elements pair loading="lazy" with preload="metadata" or preload="none"', () => {
    const docs = getHtmlDocuments(targetFiles);
    const lazyMedia = docs.flatMap(({ document }) =>
      Array.from(document.querySelectorAll('video[loading="lazy"], audio[loading="lazy"]')).filter(
        (el: any) => !el.hasAttribute('autoplay')
      )
    );
    const allLazyMediaHavePreloadFallback =
      lazyMedia.length > 0 &&
      lazyMedia.every((el: any) => {
        const preload = el.getAttribute('preload');
        return preload === 'none' || preload === 'metadata';
      });
    expect(allLazyMediaHavePreloadFallback).toBe(true);
  });

  // Requirement 6b: Fallback strategy is gated on HTMLMediaElement.prototype feature detection.
  test('lazy-loading fallback strategy detects loading feature support on HTMLMediaElement.prototype', () => {
    const project = getJsProject(targetFiles);
    expect(hasMediaLoadingFeatureDetection(project)).toBe(true);
  });

  // Requirement 6c: Fallback strategy uses an IntersectionObserver fallback for browsers without native media lazy-loading support.
  test('fallback strategy uses IntersectionObserver to observe and load offscreen media on viewport entry', () => {
    const project = getJsProject(targetFiles);
    expect(hasIntersectionObserverFallback(project)).toBe(true);
  });
});
