/**
 * Instant Navigation Module
 * - Prefetches internal links on hover and viewport intersection
 * - Performs SPA-style navigation using fetch + pushState
 * - Falls back to normal navigation for external links and /logout
 */
(function () {
  const pageCache = new Map();
  const prefetchedUrls = new Set();
  const parser = new DOMParser();

  // Prefetch a URL and cache the result
  function prefetchUrl(url) {
    if (prefetchedUrls.has(url)) return;
    prefetchedUrls.add(url);

    fetch(url, { priority: 'low' })
      .then(res => {
        if (res.ok) return res.text();
        throw new Error('fetch failed');
      })
      .then(html => {
        pageCache.set(url, html);
      })
      .catch(() => {
        prefetchedUrls.delete(url);
      });
  }

  // Check if a link is an internal same-origin navigation link
  function isInternalLink(anchor) {
    if (!anchor || !anchor.href) return false;
    if (anchor.target === '_blank') return false;
    if (anchor.hasAttribute('download')) return false;

    const url = new URL(anchor.href, location.origin);
    if (url.origin !== location.origin) return false;
    if (url.pathname === '/logout') return false;

    return true;
  }

  function getPathname(anchor) {
    return new URL(anchor.href, location.origin).pathname;
  }

  // Normalize a pathname to the actual file URL we fetch
  function resolveUrl(pathname) {
    if (pathname.endsWith('/')) {
      return pathname + 'index.html';
    }
    // Check if the last path segment has a file extension
    const lastSegment = pathname.split('/').pop();
    if (!lastSegment.includes('.')) {
      return pathname + '.html';
    }
    return pathname;
  }

  // Swap page content via fetched HTML
  async function navigateTo(url, pushState = true) {
    const fetchUrl = resolveUrl(url);
    const pageContent = document.getElementById('page-content');

    // Add loading class for quick fade
    if (pageContent) pageContent.classList.add('loading');

    let html = pageCache.get(fetchUrl);
    if (!html) {
      try {
        const res = await fetch(fetchUrl);
        if (!res.ok) {
          // Fallback to normal navigation
          location.href = url;
          return;
        }
        html = await res.text();
        pageCache.set(fetchUrl, html);
      } catch {
        location.href = url;
        return;
      }
    }

    // Parse the new document
    const doc = parser.parseFromString(html, 'text/html');
    const newContent = doc.getElementById('page-content');
    const newTitle = doc.querySelector('title');

    if (newContent && pageContent) {
      // Swap content
      pageContent.innerHTML = newContent.innerHTML;
      pageContent.className = '';

      // Update title
      if (newTitle) document.title = newTitle.textContent;

      // Push state
      if (pushState) {
        history.pushState({ path: url }, '', url);
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'instant' });

      // Re-observe new links for prefetching
      observeLinks();
    } else {
      // Fallback if page structure doesn't match
      location.href = url;
    }
  }

  // Handle popstate (browser back/forward)
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.path) {
      navigateTo(e.state.path, false);
    } else {
      navigateTo(location.pathname, false);
    }
  });

  // Set initial state
  history.replaceState({ path: location.pathname }, '', location.pathname);

  // Click handler for all internal links
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;
    if (!isInternalLink(anchor)) return;

    e.preventDefault();
    const pathname = getPathname(anchor);
    navigateTo(pathname);
  });

  // Prefetch on hover (mouse) and touch
  document.addEventListener('mouseover', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor || !isInternalLink(anchor)) return;
    prefetchUrl(resolveUrl(getPathname(anchor)));
  });

  document.addEventListener('touchstart', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor || !isInternalLink(anchor)) return;
    prefetchUrl(resolveUrl(getPathname(anchor)));
  }, { passive: true });

  // Use IntersectionObserver to prefetch links visible in the viewport
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const anchor = entry.target;
        if (isInternalLink(anchor)) {
          prefetchUrl(resolveUrl(getPathname(anchor)));
        }
        observer.unobserve(anchor);
      }
    });
  }, { rootMargin: '200px' });

  function observeLinks() {
    document.querySelectorAll('a[href]').forEach(anchor => {
      if (isInternalLink(anchor)) {
        observer.observe(anchor);
      }
    });
  }

  // Initial observation
  observeLinks();

  // Also eagerly prefetch nav links (they're always visible)
  document.querySelectorAll('nav a[href]').forEach(anchor => {
    if (isInternalLink(anchor)) {
      prefetchUrl(resolveUrl(getPathname(anchor)));
    }
  });
})();
