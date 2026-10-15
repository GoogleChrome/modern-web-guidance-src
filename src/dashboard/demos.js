// @ts-check

/**
 * @typedef {{ id: string; path: string }} DemoFile
 * @typedef {{
 *   id: string;
 *   category: string;
 *   categoryTitle: string;
 *   title: string;
 *   description: string;
 *   features: string[];
 *   demos: DemoFile[];
 * }} DemoGuide
 */

/** Unload iframes once they're this far outside the viewport, to cap memory with ~180 demos. */
const UNLOAD_MARGIN = '200% 0px';

/** Demos run with an opaque origin (no allow-same-origin) so they can't reach dashboard storage. */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals';

const main = /** @type {HTMLElement} */ (document.getElementById('demos'));
const nav = /** @type {HTMLElement} */ (document.getElementById('category-nav'));
const filterInput = /** @type {HTMLInputElement} */ (document.getElementById('demo-filter'));
const countEl = /** @type {HTMLElement} */ (document.getElementById('demo-count'));

const resp = await fetch('demos.gen.json');
if (!resp.ok) throw new Error(`Failed to load demos.gen.json: ${resp.status}`);
/** @type {{ guides: DemoGuide[] }} */
const { guides } = await resp.json();

countEl.textContent = String(guides.length);

// Loading is native (`loading="lazy"`); the observer only unloads far-offscreen frames and restores them on return.
const unloader = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    const card = /** @type {HTMLElement} */ (target);
    const iframe = /** @type {HTMLIFrameElement} */ (card.querySelector('iframe'));
    const wanted = /** @type {string} */ (card.dataset.src);
    if (isIntersecting && iframe.getAttribute('src') !== wanted) {
      iframe.src = wanted;
    } else if (!isIntersecting && iframe.dataset.loaded) {
      delete iframe.dataset.loaded;
      iframe.src = 'about:blank';
    }
  }
}, { rootMargin: UNLOAD_MARGIN });

for (const [category, group] of Object.entries(Object.groupBy(guides, g => g.category))) {
  if (!group) continue;
  const section = document.createElement('section');
  section.className = 'category';
  section.id = `cat-${category}`;
  const h2 = document.createElement('h2');
  h2.textContent = `${group[0].categoryTitle} (${group.length})`;
  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...group.map(renderCard));
  section.append(h2, grid);
  main.append(section);

  const link = document.createElement('a');
  link.href = `#${section.id}`;
  link.textContent = group[0].categoryTitle;
  nav.append(link);
}

filterInput.addEventListener('input', () => {
  const query = filterInput.value.trim().toLowerCase();
  for (const section of main.querySelectorAll('section')) {
    let anyVisible = false;
    for (const card of section.querySelectorAll('article')) {
      const match = !query || (/** @type {HTMLElement} */ (card).dataset.search ?? '').includes(query);
      card.hidden = !match;
      anyVisible ||= match;
    }
    section.hidden = !anyVisible;
  }
});

/**
 * @param {DemoGuide} guide
 * @returns {HTMLElement}
 */
function renderCard(guide) {
  const [primary] = guide.demos;
  const negative = guide.demos.find(d => d.id === 'negative-demo');

  const card = document.createElement('article');
  card.className = 'card';
  card.dataset.src = primary.path;
  card.dataset.search = [guide.title, guide.id, guide.category, guide.description, ...guide.features].join(' ').toLowerCase();

  const header = document.createElement('div');
  header.className = 'card-header';

  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = guide.title;
  title.title = guide.description;
  header.append(title);

  const iframe = document.createElement('iframe');
  iframe.loading = 'lazy';
  iframe.setAttribute('sandbox', SANDBOX);
  iframe.title = `${guide.title} demo`;
  iframe.src = primary.path;
  iframe.addEventListener('load', () => {
    if (iframe.getAttribute('src') !== 'about:blank') iframe.dataset.loaded = 'true';
  });

  const openLink = document.createElement('a');
  openLink.href = primary.path;
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.textContent = 'Open ↗';
  openLink.title = 'Open in a new tab (for demos that need top-layer, fullscreen, or permissions)';

  if (negative) {
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'negative-toggle';
    toggle.textContent = 'anti-pattern';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.addEventListener('click', () => {
      const showNegative = toggle.getAttribute('aria-pressed') !== 'true';
      const path = showNegative ? negative.path : primary.path;
      toggle.setAttribute('aria-pressed', String(showNegative));
      card.classList.toggle('showing-negative', showNegative);
      card.dataset.src = path;
      iframe.src = path;
      openLink.href = path;
    });
    header.append(toggle);
  }

  header.append(openLink);
  card.append(header, iframe);
  unloader.observe(card);
  return card;
}
