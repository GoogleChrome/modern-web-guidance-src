const fs = require('fs');
const path = require('path');

module.exports = function checkRedfield(dirPath, files) {
  const results = [];

  // Redfield: Convert imperative tooltips to Declarative interestfor
  // Scan JS/JSX files for:
  // 1. interestfor prop
  // 2. Absence of onMouseOver / addEventListener('mouseover')

  // Filter for source files, excluding build artifacts
  const sourceFiles = files.filter(f => {
    if (!/\.(js|jsx|ts|tsx)$/.test(f)) return false;
    if (f.includes('dist/') || f.includes('build/') || f.includes('.next/') || f.includes('node_modules/')) return false;
    return true;
  });

  let interestForFound = false;
  let interestTargetFound = false;
  let imperativeFound = false;
  let polyfillFound = false;

  sourceFiles.forEach(f => {
    const content = fs.readFileSync(path.join(dirPath, f), 'utf8');

    // Check interestfor
    if (/<\w+\s+[^>]*\binterestfor\b/.test(content)) {
      interestForFound = true;
    }

    // Check imperative (React style or vanilla)
    // onMouseOver={...} or .addEventListener('mouseover')
    if (/onMouseOver=\{/.test(content) || /\.addEventListener\(\s*["']mouseover["']/.test(content)) {
      imperativeFound = true;
    }

    // Check feature detection/polyfill
    if (/\.hasOwnProperty\(\s*["']interestForElement["']\s*\)/.test(content) ||
      /['"]interestForElement['"]\s*in\s*/.test(content)) {
      polyfillFound = true;
    }

    // Check for interesttarget (obsolete)
    if (/<\w+\s+[^>]*\binteresttarget\b/.test(content)) {
      interestTargetFound = true;
    }
  });

  results.push({
    id: 'redfield-declarative-interestfor',
    passed: interestForFound,
    message: 'Refactored to use declarative interestfor prop'
  });

  results.push({
    id: 'redfield-no-interesttarget',
    passed: !interestTargetFound,
    message: 'No interesttarget attribute detected'
  });

  results.push({
    id: 'redfield-imperative-reduced',
    passed: !imperativeFound,
    message: 'No onMouseOver/imperative listeners detected'
  });

  results.push({
    id: 'redfield-polyfill-present',
    passed: polyfillFound,
    message: 'Check for interestfor feature detection'
  });

  return results;
};
