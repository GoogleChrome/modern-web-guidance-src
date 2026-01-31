const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

module.exports = function checkRedfield(dirPath, files) {
  const results = [];

  const htmlFile = files.find(f => f.endsWith('.html'));
  if (!htmlFile) {
    results.push({ id: 'html-exists', passed: false, message: 'No HTML file found' });
    return results;
  }

  const htmlContent = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
  const $ = cheerio.load(htmlContent);

  // 1. Declarative Interestfor
  const buttonInterestFor = $('button[interestfor]');
  results.push({
    id: 'redfield-declarative-interestfor',
    passed: buttonInterestFor.length > 0,
    message: 'Refactored to use declarative interestfor attribute'
  });

  const buttonInterestTarget = $('button[interesttarget]');
  results.push({
    id: 'redfield-no-interesttarget',
    passed: buttonInterestTarget.length === 0,
    message: 'No interesttarget attribute detected'
  });

  // 2. Imperative JS Removal (Heuristic)
  // We expect "less" imperative code or specific patterns to be gone.
  // The user says "Modernization: Agent removes imperative JavaScript code".
  // We can check if script tags are empty or if specific old functions are missing.
  // For now, let's verify that we DON'T see manual event listeners for mouseover/focus if interestfor is used.
  // But searching for 'addEventListener' might be too broad.
  // Let's rely on the positive presence of the new API as likely indicator of success, 
  // plus maybe checking for the POLYFILL only.

  const jsFiles = files.filter(f => f.endsWith('.js'));
  const inlineScripts = [];
  $('script').each((i, el) => {
    const content = $(el).html();
    if (content && content.trim()) {
      inlineScripts.push(content);
    }
  });

  let interestForFeatureDetected = false;
  let imperativePatternFound = false;

  const checkContent = (content) => {
    // Check for interestfor polyfill / feature detection
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content)) {
      interestForFeatureDetected = true;
    }

    // Heuristic: If we see addEventListener('mouseover') or 'mouseenter' it MIGHT be the old way.
    // This is weak, but let's try.
    if (/\.addEventListener\(\s*["']mouseover["']\s*\)/.test(content)) {
      imperativePatternFound = true;
    }
  };

  jsFiles.forEach(file => {
    const content = fs.readFileSync(path.join(dirPath, file), 'utf8');
    checkContent(content);
  });

  inlineScripts.forEach(content => {
    checkContent(content);
  });

  results.push({
    id: 'redfield-polyfill-present',
    passed: interestForFeatureDetected,
    message: 'Check for interestfor feature detection'
  });

  // This is a "soft" check - having imperative code might be necessary for other things, 
  // but we warn if it looks like the old mousover handlers are still there.
  results.push({
    id: 'redfield-imperative-reduced',
    passed: !imperativePatternFound,
    message: 'No addEventListener("mouseover") detected'
  });

  return results;
};
