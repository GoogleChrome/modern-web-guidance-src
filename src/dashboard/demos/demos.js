// @ts-check

import { $ } from '../utils.js';

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
 * @typedef {Node | string | null | undefined | false} Child
 */

/** Unload iframes once they're this far outside the viewport, to cap memory with ~180 demos. */
const UNLOAD_MARGIN = '200% 0px';

/** Demos run with an opaque origin (no allow-same-origin) so they can't reach dashboard storage. */
const SANDBOX = 'allow-scripts allow-forms allow-popups allow-modals';

/**
 * createElement shorthand. Attributes go through setAttribute and string children become text nodes, so nothing is
 * ever parsed as HTML. Arrays of children are flattened one level; null/undefined/false children are skipped.
 * @template {keyof HTMLElementTagNameMap} K
 * @param {K} tag
 * @param {Record<string, string>} [attrs]
 * @param {...(Child | Child[])} children
 * @returns {HTMLElementTagNameMap[K]}
 */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  el.append(...children.flat().filter(/** @returns {c is Node | string} */ c => c != null && c !== false));
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const openInNewIcon = document.createElementNS(SVG_NS, 'svg');
openInNewIcon.setAttribute('viewBox', '0 0 16 16');
openInNewIcon.setAttribute('fill', 'currentColor');
openInNewIcon.setAttribute('aria-hidden', 'true');
const openInNewPath = document.createElementNS(SVG_NS, 'path');
openInNewPath.setAttribute('fill-rule', 'evenodd');
openInNewPath.setAttribute('d', 'M10.75 1a.75.75 0 0 0 0 1.5h1.69L6.22 8.72a.75.75 0 0 0 1.06 1.06l6.22-6.22v1.69a.75.75 0 0 0 1.5 0V1a.75.75 0 0 0-.75-.75h-4.5zM2.5 3A1.5 1.5 0 0 0 1 4.5v9A1.5 1.5 0 0 0 2.5 15h9a1.5 1.5 0 0 0 1.5-1.5v-4.25a.75.75 0 0 0-1.5 0v4.25a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h4.25a.75.75 0 0 0 0-1.5H2.5z');
openInNewIcon.append(openInNewPath);

const main = $('#demos');
const tocGrid = $('#toc-grid');
const demoFilter = /** @type {HTMLInputElement} */ ($('#demo-filter'));
const featureFilter = /** @type {HTMLInputElement} */ ($('#feature-filter'));
const noResults = $('#no-results');

const resp = await fetch('../demos.gen.json');
if (!resp.ok) throw new Error(`Failed to load demos.gen.json: ${resp.status}`);
/** @type {{ guides: DemoGuide[]; features: string[] }} */
const { guides, features } = await resp.json();

/**
 * @param {DemoGuide} guide
 */
function renderCard(guide) {
  const [primary] = guide.demos;
  const unsetDemo = guide.demos.find(d => d.id === 'negative-demo');
  // Relative to demos/index.html, guides are at ../guides/...
  const src = `../${primary.path}`;

  return h('article', { class: 'card', id: guide.id, 'data-src': src },
    h('div', { class: 'card-header', 'data-action': 'expand' },
      h('div', { class: 'card-header-top' },
        h('span', { class: 'guide-id', title: `${guide.title}: ${guide.description}` }, guide.id),
        unsetDemo && h('div', { class: 'toggle-group', role: 'group', 'aria-label': 'Demo variant' },
          h('button', { type: 'button', class: 'toggle-btn active', 'data-action': 'variant', 'data-src': src, 'aria-pressed': 'true' }, 'demo'),
          h('button', { type: 'button', class: 'toggle-btn unset', 'data-action': 'variant', 'data-src': `../${unsetDemo.path}`, 'aria-pressed': 'false' }, 'unset'),
        ),
        h('a', { class: 'open-link', href: src, target: '_blank', rel: 'noopener', title: 'Open in a new tab', 'aria-label': `Open ${guide.id} in a new tab` },
          openInNewIcon.cloneNode(true),
        ),
      ),
      h('div', { class: 'card-desc', title: guide.description }, guide.description),
      h('div', { class: 'card-features' },
        guide.features.map(f => h('button', { type: 'button', class: 'feature-tag', 'data-action': 'feature', title: `Filter by ${f}` }, f)),
      ),
    ),
    h('div', { class: 'iframe-container' },
      h('iframe', { loading: 'lazy', sandbox: SANDBOX, title: `${guide.id} demo`, src }),
    ),
  );
}

const views = guides.map(guide => ({
  guide,
  searchText: [guide.id, guide.title, guide.category, guide.description, ...guide.features].join(' ').toLowerCase(),
  card: renderCard(guide),
  tocItem: h('li', {}, h('a', { class: 'toc-link', href: `#${guide.id}`, title: guide.description }, guide.id)),
}));

// The manifest is already sorted by category, then id; groupBy preserves that order.
const categories = Object.entries(Object.groupBy(views, v => v.guide.category)).map(([name, items = []]) => ({
  name,
  items,
  section: h('section', { class: 'category', id: `cat-${name}` },
    h('h2', {}, name),
    h('div', { class: 'grid' }, items.map(v => v.card)),
  ),
  tocCol: h('div', { class: 'toc-col' },
    h('a', { class: 'toc-cat-header', href: `#cat-${name}` }, name),
    h('ul', { class: 'toc-list' }, items.map(v => v.tocItem)),
  ),
}));

main.append(...categories.map(c => c.section));
tocGrid.append(...categories.map(c => c.tocCol));
$('#features-datalist').append(...features.map(feat => {
  const count = guides.filter(g => g.features.includes(feat)).length;
  return h('option', { value: feat, label: `${count} ${count === 1 ? 'guide' : 'guides'}` });
}));

// Loading is native (`loading="lazy"`); the observer only unloads far-offscreen frames and restores them on return.
const unloader = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    const card = /** @type {HTMLElement} */ (target);
    const iframe = $('iframe', card);
    const wanted = /** @type {string} */ (card.dataset.src);
    if (isIntersecting && iframe.getAttribute('src') !== wanted) {
      iframe.src = wanted;
    } else if (!isIntersecting && iframe.getAttribute('src') !== 'about:blank') {
      iframe.src = 'about:blank';
    }
  }
}, { rootMargin: UNLOAD_MARGIN });
for (const { card } of views) unloader.observe(card);

const tocObserver = new IntersectionObserver(entries => {
  for (const { target, isIntersecting } of entries) {
    if (!isIntersecting) continue;
    for (const header of tocGrid.querySelectorAll('.toc-cat-header')) {
      header.classList.toggle('active', header.getAttribute('href') === `#${target.id}`);
    }
  }
}, { rootMargin: '-10% 0px -75% 0px' });
for (const { section } of categories) tocObserver.observe(section);

/** @type {Record<string, (el: HTMLElement, card: HTMLElement) => void>} */
const clickActions = {
  expand: (_, card) => card.classList.toggle('expanded'),
  variant: (btn, card) => {
    const src = /** @type {string} */ (btn.dataset.src);
    for (const b of card.querySelectorAll('.toggle-btn')) {
      b.classList.toggle('active', b === btn);
      b.setAttribute('aria-pressed', String(b === btn));
    }
    card.classList.toggle('showing-unset', btn.classList.contains('unset'));
    card.dataset.src = src;
    $('iframe', card).src = src;
    $('a.open-link', card).href = src;
  },
  feature: btn => {
    const feat = btn.textContent ?? '';
    featureFilter.value = featureFilter.value === feat ? '' : feat;
    applyFilters();
  },
};

// One delegated listener for every card. The innermost [data-action] wins, so a tag/toggle click doesn't also expand
// the header. Links (open-in-new-tab) keep their default behavior.
main.addEventListener('click', e => {
  const target = /** @type {Element} */ (e.target);
  if (target.closest('a')) return;
  const actionEl = /** @type {HTMLElement | null} */ (target.closest('[data-action]'));
  const card = /** @type {HTMLElement | null} */ (actionEl?.closest('.card'));
  if (!actionEl || !card) return;
  clickActions[/** @type {string} */ (actionEl.dataset.action)](actionEl, card);
});

function updateActiveHash() {
  const hash = window.location.hash;
  for (const link of tocGrid.querySelectorAll('.toc-link')) {
    link.classList.toggle('active', link.getAttribute('href') === hash);
  }
}
window.addEventListener('hashchange', updateActiveHash);
updateActiveHash();

$('header.demos-header h1').addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
    updateActiveHash();
  }
});

function applyFilters() {
  const textQuery = demoFilter.value.trim().toLowerCase();
  const featQuery = featureFilter.value.trim().toLowerCase();
  let anyVisible = false;

  for (const { items, section, tocCol } of categories) {
    let categoryVisible = false;
    for (const { guide, searchText, card, tocItem } of items) {
      const match = (!textQuery || searchText.includes(textQuery)) &&
                    (!featQuery || guide.features.some(f => f.toLowerCase().includes(featQuery)));
      card.hidden = !match;
      tocItem.hidden = !match;
      categoryVisible ||= match;

      for (const tag of card.querySelectorAll('.feature-tag')) {
        tag.classList.toggle('active', Boolean(featQuery && tag.textContent?.toLowerCase().includes(featQuery)));
      }
    }
    section.hidden = !categoryVisible;
    tocCol.hidden = !categoryVisible;
    anyVisible ||= categoryVisible;
  }
  noResults.hidden = anyVisible;
}

demoFilter.addEventListener('input', applyFilters);
featureFilter.addEventListener('input', applyFilters);
featureFilter.addEventListener('change', applyFilters);
