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
const demoFilter = /** @type {HTMLInputElement} */ (document.getElementById('demo-filter'));
const featureFilter = /** @type {HTMLInputElement} */ (document.getElementById('feature-filter'));
const featuresDatalist = /** @type {HTMLDataListElement} */ (document.getElementById('features-datalist'));
const noResults = /** @type {HTMLElement} */ (document.getElementById('no-results'));

const resp = await fetch('../demos.gen.json');
if (!resp.ok) throw new Error(`Failed to load demos.gen.json: ${resp.status}`);
/** @type {{ guides: DemoGuide[]; features?: string[] }} */
const { guides, features: manifestFeatures } = await resp.json();

/** @type {Map<string, DemoGuide>} */
const guideMap = new Map(guides.map(g => [g.id, g]));

// Build feature guide counts and populate autocomplete datalist
/** @type {Map<string, number>} */
const featureCounts = new Map();
for (const guide of guides) {
  for (const feat of guide.features || []) {
    featureCounts.set(feat, (featureCounts.get(feat) || 0) + 1);
  }
}

const uniqueFeatures = manifestFeatures ?? Array.from(featureCounts.keys()).sort();
if (featuresDatalist) {
  for (const feat of uniqueFeatures) {
    const opt = document.createElement('option');
    opt.value = feat;
    const count = featureCounts.get(feat) ?? 0;
    opt.label = `${count} ${count === 1 ? 'guide' : 'guides'}`;
    featuresDatalist.append(opt);
  }
}

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

function updateActiveHash() {
  const hash = window.location.hash;
  for (const link of tocGrid.querySelectorAll('.toc-link')) {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  }
}
window.addEventListener('hashchange', updateActiveHash);
updateActiveHash();

function applyFilters() {
  const textQuery = demoFilter.value.trim().toLowerCase();
  const featQuery = featureFilter.value.trim().toLowerCase();

  let totalVisible = 0;

  // Filter cards & main sections
  const sections = /** @type {NodeListOf<HTMLElement>} */ (main.querySelectorAll('section.category'));
  for (const section of sections) {
    let sectionVisible = false;
    const cards = /** @type {NodeListOf<HTMLElement>} */ (section.querySelectorAll('article.card'));
    for (const card of cards) {
      const guide = guideMap.get(card.id);
      const textMatch = !textQuery || (card.dataset.search ?? '').includes(textQuery);
      const featMatch = !featQuery || (guide?.features || []).some(f => f.toLowerCase().includes(featQuery));
      const match = textMatch && featMatch;
      card.hidden = !match;
      if (match) {
        sectionVisible = true;
        totalVisible++;
      }

      // Highlight active matching feature tags
      for (const tag of card.querySelectorAll('.feature-tag')) {
        const tagText = tag.textContent?.toLowerCase() ?? '';
        tag.classList.toggle('active', Boolean(featQuery && tagText.includes(featQuery)));
      }
    }
    section.hidden = !sectionVisible;
  }

  // Filter TOC links & category columns
  const cols = /** @type {NodeListOf<HTMLElement>} */ (tocGrid.querySelectorAll('.toc-col'));
  for (const col of cols) {
    let colVisible = false;
    const links = /** @type {NodeListOf<HTMLElement>} */ (col.querySelectorAll('.toc-link'));
    for (const link of links) {
      const guideId = link.getAttribute('href')?.slice(1);
      const guide = guideId ? guideMap.get(guideId) : undefined;
      const textMatch = !textQuery || (link.textContent?.toLowerCase() ?? '').includes(textQuery) || (link.title?.toLowerCase() ?? '').includes(textQuery);
      const featMatch = !featQuery || (guide?.features || []).some(f => f.toLowerCase().includes(featQuery));
      const match = textMatch && featMatch;
      const parentLi = link.parentElement;
      if (parentLi) parentLi.hidden = !match;
      colVisible ||= match;
    }
    col.hidden = !colVisible;
  }

  if (noResults) {
    noResults.hidden = totalVisible > 0;
  }
}

demoFilter.addEventListener('input', applyFilters);
featureFilter.addEventListener('input', applyFilters);
featureFilter.addEventListener('change', applyFilters);

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

  const headerTop = document.createElement('div');
  headerTop.className = 'card-header-top';

  const guideId = document.createElement('span');
  guideId.className = 'guide-id';
  guideId.textContent = guide.id;
  guideId.title = `${guide.title}: ${guide.description}`;
  headerTop.append(guideId);

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
    headerTop.append(toggleGroup);
  }

  headerTop.append(openLink);
  header.append(headerTop);

  const desc = document.createElement('div');
  desc.className = 'card-desc';
  desc.textContent = guide.description;
  desc.title = guide.description;
  header.append(desc);

  const featWrap = document.createElement('div');
  featWrap.className = 'card-features';
  for (const feat of guide.features || []) {
    const tag = document.createElement('button');
    tag.type = 'button';
    tag.className = 'feature-tag';
    tag.textContent = feat;
    tag.title = `Filter by ${feat}`;
    tag.addEventListener('click', (e) => {
      e.stopPropagation();
      featureFilter.value = featureFilter.value === feat ? '' : feat;
      applyFilters();
    });
    featWrap.append(tag);
  }
  header.append(featWrap);

  header.addEventListener('click', (e) => {
    const target = /** @type {HTMLElement} */ (e.target);
    if (target.closest('button') || target.closest('a')) return;
    card.classList.toggle('expanded');
  });

  card.append(header, container);
  unloader.observe(card);
  return card;
}
