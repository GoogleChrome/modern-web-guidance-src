// Instant navigation: prefetch on hover/viewport, cache pages, swap DOM instantly
(function () {
  const cache = new Map();
  const inflight = new Map();
  const parser = new DOMParser();

  // Cache the current page immediately so back-navigation is instant
  cache.set(location.href, document.documentElement.outerHTML);

  // Resolve a URL: try the original, then with .html suffix if needed
  async function fetchPage(url) {
    let res = await fetch(url);
    if (!res.ok && !url.endsWith('/') && !url.endsWith('.html')) {
      res = await fetch(url + '.html');
    }
    if (!res.ok) throw new Error(res.status);
    return res.text();
  }

  function prefetch(url) {
    if (cache.has(url) || inflight.has(url)) return;
    const p = fetchPage(url)
      .then(html => { cache.set(url, html); inflight.delete(url); })
      .catch(() => { inflight.delete(url); });
    inflight.set(url, p);
  }

  function isLocal(a) {
    return a.origin === location.origin &&
      !a.hasAttribute('download') &&
      a.target !== '_blank' &&
      !a.href.includes('#') &&
      a.pathname !== location.pathname;
  }

  // Prefetch on pointer hover (desktop) or touchstart (mobile)
  function onPointerEnter(e) {
    const a = e.target.closest('a');
    if (!a || !isLocal(a)) return;
    prefetch(a.href);
  }
  document.addEventListener('pointerenter', onPointerEnter, { capture: true, passive: true });
  document.addEventListener('touchstart', onPointerEnter, { capture: true, passive: true });

  // Prefetch links visible in the viewport via IntersectionObserver
  var observer;
  function observeLinks() {
    if (!('IntersectionObserver' in window)) return;
    if (observer) observer.disconnect();
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var a = entry.target;
          if (isLocal(a)) prefetch(a.href);
          observer.unobserve(a);
        }
      });
    }, { rootMargin: '200px' });
    document.querySelectorAll('a[href]').forEach(function (a) {
      if (isLocal(a)) observer.observe(a);
    });
  }
  observeLinks();

  // Intercept clicks for instant navigation
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || !isLocal(a) || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    navigate(a.href);
  });

  async function navigate(url) {
    // If not cached yet, fetch now
    if (!cache.has(url)) {
      if (inflight.has(url)) {
        await inflight.get(url);
      } else {
        prefetch(url);
        await inflight.get(url);
      }
    }

    var html = cache.get(url);
    if (!html) { location.href = url; return; }

    var doc = parser.parseFromString(html, 'text/html');

    // Swap title
    document.title = doc.title;

    // Swap body content
    document.body.innerHTML = doc.body.innerHTML;

    // Scroll to top
    window.scrollTo(0, 0);

    // Update URL
    history.pushState({}, '', url);

    // Cache the new page under its final URL
    cache.set(url, html);

    // Re-observe new links for prefetching
    observeLinks();
  }

  // Handle back/forward navigation
  window.addEventListener('popstate', function () {
    navigate(location.href);
  });
})();
