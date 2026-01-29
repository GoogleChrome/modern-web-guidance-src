const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

module.exports = function checkBrownfield(dirPath, files) {
  const results = [];

  // Brownfield: Speculation Rules
  // These are typically injected into index.html OR injected via JS.
  // Best practice in Vite/React is often still putting it in index.html for static analysis,
  // or using a library.
  // We will check index.html first.

  const htmlFile = files.find(f => f.endsWith('.html'));
  let speculationRulesFound = false;
  let excludesLogout = false;
  let hasPrerender = false;

  if (htmlFile) {
    const content = fs.readFileSync(path.join(dirPath, htmlFile), 'utf8');
    const $ = cheerio.load(content);
    const script = $('script[type="speculationrules"]');

    if (script.length > 0) {
      speculationRulesFound = true;
      try {
        const json = JSON.parse(script.html());

        // Helper to recursively search for "not" -> "href_matches": "/logout"
        const hasLogoutExclusion = (obj) => {
          if (!obj || typeof obj !== 'object') return false;

          for (const key in obj) {
            // Check if we found a "not" clause
            if (key === 'not') {
              const condition = obj[key];
              if (condition && typeof condition === 'object') {
                const matches = condition.href_matches;
                if (matches === '/logout') return true;
                if (Array.isArray(matches) && matches.includes('/logout')) return true;
              }
            }
            // Recurse into children
            if (hasLogoutExclusion(obj[key])) return true;
          }
          return false;
        };

        excludesLogout = hasLogoutExclusion(json);
      } catch (e) {
        // Failed to parse, assume false
      }
    }

    if ($('link[rel="prerender"]').length > 0) {
      hasPrerender = true;
    }
  }

  // Also check if any JS/JSX file injects it (unlikely but possible)
  // or if they used a Prerender component (unlikely for speculation rules standard)

  results.push({
    id: 'speculationrules-script',
    passed: speculationRulesFound,
    message: 'Found <script type="speculationrules">'
  });

  results.push({
    id: 'speculationrules-exclude-logout',
    passed: excludesLogout,
    message: 'Speculation rules exclude /logout'
  });

  results.push({
    id: 'no-deprecated-prerender',
    passed: !hasPrerender,
    message: 'No deprecated <link rel="prerender"> tag found'
  });

  return results;
};
