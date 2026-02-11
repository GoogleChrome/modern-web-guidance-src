/**
 * Instant navigation for The Daily Grind
 *
 * Three-layer strategy for near-instant page loads:
 * 1. Speculation Rules API — tells the browser to prerender pages (Chrome 109+)
 * 2. Prefetch on hover/focus — fetches the HTML when the user shows intent
 * 3. Prefetch visible links on idle — background-fetches links in the viewport
 */

(function () {
  'use strict';

  // --- 1. Speculation Rules (prerender on hover) ---
  if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
    const rules = {
      prerender: [
        {
          source: 'document',
          where: {
            and: [
              { href_matches: '/*' },
              { not: { href_matches: '/logout' } }
            ]
          },
          eagerness: 'moderate' // prerender on hover/pointerdown
        }
      ]
    };
    const script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify(rules);
    document.head.appendChild(script);
  }

  // --- 2. Prefetch on hover/focus (fallback for browsers without speculation rules) ---
  var prefetched = new Set();

  function prefetchURL(url) {
    if (prefetched.has(url)) return;
    prefetched.add(url);
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    link.as = 'document';
    document.head.appendChild(link);
  }

  function isLocalLink(a) {
    return (
      a.href &&
      a.origin === location.origin &&
      !a.hash &&
      a.pathname !== location.pathname
    );
  }

  // Prefetch on pointer hover (with a small delay to avoid drive-by prefetches)
  document.addEventListener('pointerenter', function (e) {
    var a = e.target.closest('a');
    if (a && isLocalLink(a)) {
      prefetchURL(a.href);
    }
  }, { capture: true, passive: true });

  // Prefetch on focus (keyboard navigation)
  document.addEventListener('focusin', function (e) {
    var a = e.target.closest('a');
    if (a && isLocalLink(a)) {
      prefetchURL(a.href);
    }
  }, { capture: true, passive: true });

  // --- 3. Prefetch visible links when idle ---
  if ('IntersectionObserver' in window && 'requestIdleCallback' in window) {
    requestIdleCallback(function () {
      var links = document.querySelectorAll('a[href]');
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var a = entry.target;
            if (isLocalLink(a)) {
              prefetchURL(a.href);
            }
            observer.unobserve(a);
          }
        });
      });
      links.forEach(function (link) {
        if (isLocalLink(link)) {
          observer.observe(link);
        }
      });
    });
  }
})();
