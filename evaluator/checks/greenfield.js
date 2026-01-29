const fs = require('fs');
const path = require('path');

module.exports = function checkGreenfield(dirPath, files) {
  const results = [];

  // Helper to read all JS/JSX/TSX files
  const searchFiles = files.filter(f => /\.(js|jsx|ts|tsx)$/.test(f));

  // Also read index.html just in case
  const htmlFiles = files.filter(f => f.endsWith('.html'));
  const allFiles = [...searchFiles, ...htmlFiles];

  let imgWithPlaceholderFound = false;
  let interestTargetFound = false;
  let noInterestTarget = true; // For React, we WANT interesttarget usually, wait. 
  // Original check: 
  // 3. Check interestfor (not interesttarget) -> "Found button with interestfor attribute"
  // "No deprecated interesttarget attribute found"
  // WAIT. The prompt said "Details button that shows an ingredients tooltip".
  // The guidance for "interest" is evolving.
  // Use Case "tooltip":
  // OLD API: `interesttarget`
  // NEW API: `interesttarget` is actually the CURRENT proposal (as of late 2024/2025? or `interestfor`?)
  // Let's check the original check logic again.
  // Original check said: "Check interestfor (not interesttarget)"
  // "Found button with interestfor attribute"
  // "No deprecated interesttarget attribute found"
  // So it seems the harness expects `interestfor`.
  // I will stick to `interestfor` if that's what the previous check enforced, OR check `modern-web` if I could (but I can't easily right now).
  // I'll stick to expected `interestfor` as "modern" per the old harness, UNLESS I know better.
  // Actually, the user asked to "adapt the guidance".
  // Let's stick to `interesttarget` if that is what is currently "modern" or `interestfor`?
  // The original check called `interesttarget` "deprecated". So I will enforce `interestfor`.

  // 4. Feature Detection logic
  let interestFeatureDetected = false;
  let loadingPlaceholderFeatureDetected = false;
  let viewTimelineFound = false;
  let reducedMotionFound = false;

  const contentMap = new Map();
  allFiles.forEach(f => {
    try {
      contentMap.set(f, fs.readFileSync(path.join(dirPath, f), 'utf8'));
    } catch (e) {
      // ignore directory read errors if any
    }
  });

  // Check Content
  contentMap.forEach((content, file) => {
    // React Props often look like: interestfor={...} or just interestfor
    // Regex for <img ... loading-placeholder ... >
    // We match: <img [^>]*loading-placeholder
    // OR <Image ... loading-placeholder
    if (/<\w+\s+[^>]*\bloading-placeholder\b/.test(content)) {
      imgWithPlaceholderFound = true;
    }

    // Check interestfor
    if (/<\w+\s+[^>]*\binterestfor\b/.test(content)) {
      interestTargetFound = true; // Named variable slightly confusingly, but this tracks "good" one
    }

    // Check interesttarget (deprecated)
    if (/<\w+\s+[^>]*\binteresttarget\b/.test(content)) {
      noInterestTarget = false;
    }

    // Feature Detection
    // .hasOwnProperty('interestForElement') OR "interestForElement" in ...
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content) ||
      /['"]interestForElement['"]\s*in\s*/.test(content)) {
      interestFeatureDetected = true;
    }

    // loadingPlaceholder detection
    if (/['"]loadingPlaceholder['"]\s*in\s*HTMLImageElement\.prototype/.test(content)) {
      loadingPlaceholderFeatureDetected = true;
    }

    // CSS Checks (can be in CSS or standard JS imports or styled-components strings)
    if (content.includes('animation-timeline: view()') || content.includes('animation-timeline:view()')) {
      viewTimelineFound = true;
    }
    if (content.includes('@media (prefers-reduced-motion')) {
      reducedMotionFound = true;
    }
  });

  // Also check CSS files for CSS checks
  const cssFiles = files.filter(f => f.endsWith('.css'));
  cssFiles.forEach(f => {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf8');
    if (content.includes('animation-timeline: view()') || content.includes('animation-timeline:view()')) {
      viewTimelineFound = true;
    }
    if (content.includes('@media (prefers-reduced-motion')) {
      reducedMotionFound = true;
    }
  });

  results.push({
    id: 'img-loading-placeholder',
    passed: imgWithPlaceholderFound,
    message: 'Found component with loading-placeholder prop'
  });

  results.push({
    id: 'button-interestfor',
    passed: interestTargetFound,
    message: 'Found component with interestfor prop'
  });

  results.push({
    id: 'no-interesttarget',
    passed: noInterestTarget,
    message: 'No deprecated interesttarget prop found'
  });

  results.push({
    id: 'js-interestfor-polyfill',
    passed: interestFeatureDetected,
    message: 'JS contains interestfor feature detection'
  });

  results.push({
    id: 'js-loading-placeholder-support',
    passed: loadingPlaceholderFeatureDetected,
    message: 'JS contains loading-placeholder feature detection'
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
