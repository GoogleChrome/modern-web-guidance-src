const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

module.exports = function checkGreenfield(dirPath, files) {
  const results = [];

  // 1. Load HTML
  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 2. Check loading-placeholder
  const imgWithPlaceholder = $('img[loading-placeholder]');
  results.push({
    id: 'img-loading-placeholder',
    passed: imgWithPlaceholder.length > 0,
    message: 'Found img with loading-placeholder attribute'
  });

  // 3. Check interestfor (not interesttarget)
  const buttonInterestFor = $('button[interestfor]');
  const buttonInterestTarget = $('button[interesttarget]');

  results.push({
    id: 'button-interestfor',
    passed: buttonInterestFor.length > 0,
    message: 'Found button with interestfor attribute'
  });

  results.push({
    id: 'no-interesttarget',
    passed: buttonInterestTarget.length === 0,
    message: 'No deprecated interesttarget attribute found'
  });

  // 4. Check JS Polyfills
  const jsFiles = files.filter(f => f.endsWith('.js'));
  let interestForFeatureDetected = false;
  let loadingPlaceholderFeatureDetected = false;

  const checkContent = (content) => {
    // Check for interestfor feature detection
    // Match: .hasOwnProperty('interestForElement') or "interestForElement" with flexible quotes/spacing
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content)) {
      interestForFeatureDetected = true;
    }

    // Check for loading-placeholder feature detection
    // Match: 'loadingPlaceholder' in HTMLImageElement.prototype
    if (/['"]loadingPlaceholder['"]\s*in\s*HTMLImageElement\.prototype/.test(content)) {
      loadingPlaceholderFeatureDetected = true;
    }
  };

  jsFiles.forEach(file => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    checkContent(content);
  });

  // Check inline scripts too
  $('script').each((i, el) => {
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

  results.push({
    id: 'js-loading-placeholder-support',
    passed: loadingPlaceholderFeatureDetected,
    message: 'JS contains loading-placeholder feature detection'
  });

  // 5. Check CSS Features
  const cssFiles = files.filter(f => f.endsWith('.css'));
  let viewTimelineFound = false;
  let reducedMotionFound = false;

  cssFiles.forEach(file => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');

    if (content.includes('animation-timeline: view()') || content.includes('animation-timeline:view()')) {
      viewTimelineFound = true;
    }

    if (content.includes('@media (prefers-reduced-motion')) {
      reducedMotionFound = true;
    }
  });

  // Check inline styles in HTML
  $('style').each((i, el) => {
    const content = $(el).html();
    if (content) {
      if (content.includes('animation-timeline: view()') || content.includes('animation-timeline:view()')) {
        viewTimelineFound = true;
      }
      if (content.includes('@media (prefers-reduced-motion')) {
        reducedMotionFound = true;
      }
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
