// @ts-check

/**
 * @typedef {{ id: string; path: string }} DemoFile
 * @typedef {{
 *   id: string;
 *   category: string;
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

const SVG_OPEN_IN_NEW = `
<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
  <path fill-rule="evenodd" d="M10.75 1a.75.75 0 0 0 0 1.5h1.69L6.22 8.72a.75.75 0 0 0 1.06 1.06l6.22-6.22v1.69a.75.75 0 0 0 1.5 0V1a.75.75 0 0 0-.75-.75h-4.5zM2.5 3A1.5 1.5 0 0 0 1 4.5v9A1.5 1.5 0 0 0 2.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-4.25a.75.75 0 0 0-1.5 0v4.25a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h4.25a.75.75 0 0 0 0-1.5H2.5z"/>
</svg>`.trim();

const main = /** @type {HTMLElement} */ (document.getElementById('demos'));
const tocGrid = /** @type {HTMLElement} */ (document.getElementById('toc-grid'));
const filterInput = /** @type {HTMLInputElement} */ (document.getElementById('demo-filter'));

const resp = await fetch('../demos.gen.json');
if (!resp.ok) throw new Error(`Failed to load demos.gen.json: ${resp.status}`);
/** @type {{ guides: DemoGuide[] }} */
const { guides } = await resp.json();

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

// Observe sections for active TOC highlighting
const tocObserver = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (isIntersecting) {
      const activeId = target.id;
      for (const header of tocGrid.querySelectorAll('.toc-cat-header')) {
        header.classList.toggle('active', header.getAttribute('href') === `#${activeId}`);
      }
    }
  }
}, { rootMargin: '-10% 0px -75% 0px' });

// Group and sort categories alphabetically
const grouped = Object.groupBy(guides, g => g.category);
const sortedCategories = Object.keys(grouped).sort();

for (const category of sortedCategories) {
  const group = grouped[category];
  if (!group || group.length === 0) continue;

  // Sort demos within category by id
  group.sort((a, b) => a.id.localeCompare(b.id));

  // Category section in main
  const section = document.createElement('section');
  section.className = 'category';
  section.id = `cat-${category}`;

  const h2 = document.createElement('h2');
  h2.textContent = category;

  const grid = document.createElement('div');
  grid.className = 'grid';
  grid.append(...group.map(renderCard));

  section.append(h2, grid);
  main.append(section);
  tocObserver.observe(section);

  // Category column in TOC
  const col = document.createElement('div');
  col.className = 'toc-col';
  col.dataset.category = category;

  const catHeader = document.createElement('a');
  catHeader.className = 'toc-cat-header';
  catHeader.href = `#${section.id}`;
  catHeader.textContent = category;

  const ul = document.createElement('ul');
  ul.className = 'toc-list';

  for (const guide of group) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.className = 'toc-link';
    a.href = `#${guide.id}`;
    a.textContent = guide.id;
    a.title = guide.description;
    li.append(a);
    ul.append(li);
  }

  col.append(catHeader, ul);
  tocGrid.append(col);
}

filterInput.addEventListener('input', () => {
  const query = filterInput.value.trim().toLowerCase();

  // Filter cards & main sections
  const sections = /** @type {NodeListOf<HTMLElement>} */ (main.querySelectorAll('section'));
  for (const section of sections) {
    let anyVisible = false;
    const cards = /** @type {NodeListOf<HTMLElement>} */ (section.querySelectorAll('article'));
    for (const card of cards) {
      const match = !query || (card.dataset.search ?? '').includes(query);
      card.hidden = !match;
      anyVisible ||= match;
    }
    section.hidden = !anyVisible;
  }

  // Filter TOC links & category columns
  const cols = /** @type {NodeListOf<HTMLElement>} */ (tocGrid.querySelectorAll('.toc-col'));
  for (const col of cols) {
    let anyLinkVisible = false;
    const links = /** @type {NodeListOf<HTMLElement>} */ (col.querySelectorAll('.toc-link'));
    for (const link of links) {
      const linkText = link.textContent?.toLowerCase() ?? '';
      const match = !query || linkText.includes(query);
      const parentLi = link.parentElement;
      if (parentLi) parentLi.hidden = !match;
      anyLinkVisible ||= match;
    }
    col.hidden = !anyLinkVisible;
  }
});

/**
 * @param {DemoGuide} guide
 * @returns {HTMLElement}
 */
function renderCard(guide) {
  const [primary] = guide.demos;
  const unsetDemo = guide.demos.find(d => d.id === 'negative-demo');

  // Relative to demos/index.html, guides are at ../guides/...
  const primaryUrl = `../${primary.path}`;
  const unsetUrl = unsetDemo ? `../${unsetDemo.path}` : '';

  const card = document.createElement('article');
  card.className = 'card';
  card.id = guide.id;
  card.dataset.src = primaryUrl;
  card.dataset.search = [guide.id, guide.title, guide.category, guide.description, ...guide.features].join(' ').toLowerCase();

  const header = document.createElement('div');
  header.className = 'card-header';

  const guideId = document.createElement('span');
  guideId.className = 'guide-id';
  guideId.textContent = guide.id;
  guideId.title = `${guide.title}: ${guide.description}`;
  header.append(guideId);

  const openLink = document.createElement('a');
  openLink.className = 'open-link';
  openLink.href = primaryUrl;
  openLink.target = '_blank';
  openLink.rel = 'noopener';
  openLink.title = 'Open in a new tab';
  openLink.setAttribute('aria-label', `Open ${guide.id} in a new tab`);
  openLink.innerHTML = SVG_OPEN_IN_NEW;

  const container = document.createElement('div');
  container.className = 'iframe-container';

  const iframe = document.createElement('iframe');
  iframe.loading = 'lazy';
  iframe.setAttribute('sandbox', SANDBOX);
  iframe.title = `${guide.id} demo`;
  iframe.src = primaryUrl;
  iframe.addEventListener('load', () => {
    if (iframe.getAttribute('src') !== 'about:blank') iframe.dataset.loaded = 'true';
  });
  container.append(iframe);

  if (unsetDemo) {
    const toggleGroup = document.createElement('div');
    toggleGroup.className = 'toggle-group';
    toggleGroup.setAttribute('role', 'group');
    toggleGroup.setAttribute('aria-label', 'Demo variant');

    const demoBtn = document.createElement('button');
    demoBtn.type = 'button';
    demoBtn.className = 'toggle-btn active';
    demoBtn.textContent = 'demo';
    demoBtn.setAttribute('aria-pressed', 'true');

    const unsetBtn = document.createElement('button');
    unsetBtn.type = 'button';
    unsetBtn.className = 'toggle-btn';
    unsetBtn.textContent = 'unset';
    unsetBtn.setAttribute('aria-pressed', 'false');

    const select = (/** @type {boolean} */ isUnset) => {
      demoBtn.classList.toggle('active', !isUnset);
      demoBtn.setAttribute('aria-pressed', String(!isUnset));
      unsetBtn.classList.toggle('active', isUnset);
      unsetBtn.classList.toggle('unset', isUnset);
      unsetBtn.setAttribute('aria-pressed', String(isUnset));

      const targetUrl = isUnset ? unsetUrl : primaryUrl;
      card.classList.toggle('showing-unset', isUnset);
      card.dataset.src = targetUrl;
      iframe.src = targetUrl;
      openLink.href = targetUrl;
    };

    demoBtn.addEventListener('click', () => select(false));
    unsetBtn.addEventListener('click', () => select(true));

    toggleGroup.append(demoBtn, unsetBtn);
    header.append(toggleGroup);
  }

  header.append(openLink);
  card.append(header, container);
  unloader.observe(card);
  return card;
}
