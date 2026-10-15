// @ts-check

/**
 * @typedef {{
 *   id: string;
 *   label: string;
 *   file: string;
 *   path: string;
 * }} DemoFile
 * 
 * @typedef {{
 *   id: string;
 *   slug: string;
 *   category: string;
 *   categoryTitle: string;
 *   title: string;
 *   description: string;
 *   features: string[];
 *   dir: string;
 *   demos: DemoFile[];
 * }} DemoGuide
 * 
 * @typedef {{
 *   count: number;
 *   categories: string[];
 *   guides: DemoGuide[];
 * }} DemosManifest
 */

/** @type {DemosManifest | null} */
let manifestData = null;
/** @type {string} */
let activeCategory = 'all';
/** @type {string} */
let searchQuery = '';
/** @type {boolean} */
let autoLoadOnScroll = true;

/** @type {Map<string, string>} guideId -> active demoId (e.g. 'demo' | 'negative-demo') */
const activeVariants = new Map();

/** @type {IntersectionObserver | null} */
let iframeObserver = null;

// DOM Elements
const demosContainer = /** @type {HTMLElement} */ (document.getElementById('demos-container'));
const categoryPillsContainer = /** @type {HTMLElement} */ (document.getElementById('category-pills-container'));
const searchInput = /** @type {HTMLInputElement} */ (document.getElementById('demo-search-input'));
const clearSearchBtn = /** @type {HTMLButtonElement} */ (document.getElementById('clear-search-btn'));
const filteredCountBadge = /** @type {HTMLElement} */ (document.getElementById('filtered-count-badge'));
const totalCountElement = /** @type {HTMLElement} */ (document.getElementById('total-demos-count'));
const noResultsElement = /** @type {HTMLElement} */ (document.getElementById('no-results'));
const resetFilterBtn = /** @type {HTMLButtonElement} */ (document.getElementById('reset-filter-btn'));
const autoLoadToggle = /** @type {HTMLInputElement} */ (document.getElementById('autoload-toggle'));

/**
 * Initializes the demo gallery.
 */
async function init() {
  manifestData = await loadManifest();
  if (!manifestData || !manifestData.guides) {
    if (demosContainer) {
      demosContainer.innerHTML = '<p class="empty-state">Failed to load demo manifest.</p>';
    }
    return;
  }

  // Set default variant for each guide
  for (const guide of manifestData.guides) {
    const defaultDemo = guide.demos[0]?.id || 'demo';
    activeVariants.set(guide.id, defaultDemo);
  }

  if (totalCountElement) {
    totalCountElement.textContent = String(manifestData.count);
  }

  setupObserver();
  renderCategoryPills(manifestData);
  renderGallery(manifestData);
  setupEvents();
  updateFilteredCount();
}

/**
 * Loads the manifest either from window.__demosManifest or by fetching demos.gen.json.
 * @returns {Promise<DemosManifest | null>}
 */
async function loadManifest() {
  if (typeof window !== 'undefined' && /** @type {any} */ (window).__demosManifest) {
    return /** @type {any} */ (window).__demosManifest;
  }

  try {
    const resp = await fetch('demos.gen.json');
    if (resp.ok) {
      return await resp.json();
    }
  } catch (err) {
    console.error('Failed to fetch demos.gen.json:', err);
  }
  return null;
}

/**
 * Sets up IntersectionObserver for deferred iframe loading.
 */
function setupObserver() {
  if (typeof IntersectionObserver === 'undefined') {
    return;
  }

  iframeObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const wrapper = /** @type {HTMLElement} */ (entry.target);
        if (autoLoadOnScroll) {
          loadIframe(wrapper);
        }
      }
    }
  }, {
    rootMargin: '350px 0px',
    threshold: 0.01
  });
}

/**
 * Triggers loading of an iframe inside a wrapper.
 * @param {HTMLElement} wrapper
 */
function loadIframe(wrapper) {
  const iframe = wrapper.querySelector('iframe');
  const placeholder = wrapper.querySelector('.demo-iframe-placeholder');
  if (!iframe || iframe.src) return;

  const targetSrc = iframe.dataset.src;
  if (!targetSrc) return;

  iframe.src = targetSrc;
  iframe.onload = () => {
    if (placeholder) {
      placeholder.classList.add('hidden');
    }
  };

  if (iframeObserver) {
    iframeObserver.unobserve(wrapper);
  }
}

/**
 * Renders the top category pills for filtering.
 * @param {DemosManifest} data
 */
function renderCategoryPills(data) {
  if (!categoryPillsContainer) return;

  const pills = [];

  // "All" pill
  const allActive = activeCategory === 'all' ? 'active' : '';
  pills.push(`
    <button type="button" class="category-pill ${allActive}" data-category="all">
      <span>All</span>
      <span class="pill-count">${data.count}</span>
    </button>
  `);

  // Count guides per category
  /** @type {Record<string, { title: string; count: number }>} */
  const categoryStats = {};
  for (const guide of data.guides) {
    if (!categoryStats[guide.category]) {
      categoryStats[guide.category] = { title: guide.categoryTitle, count: 0 };
    }
    categoryStats[guide.category].count++;
  }

  for (const [catKey, info] of Object.entries(categoryStats)) {
    const isActive = activeCategory === catKey ? 'active' : '';
    pills.push(`
      <button type="button" class="category-pill ${isActive}" data-category="${escapeHtml(catKey)}">
        <span>${escapeHtml(info.title)}</span>
        <span class="pill-count">${info.count}</span>
      </button>
    `);
  }

  categoryPillsContainer.innerHTML = pills.join('');
}

/**
 * Renders the full gallery grouped by category.
 * @param {DemosManifest} data
 */
function renderGallery(data) {
  if (!demosContainer) return;

  // Group guides by category
  /** @type {Record<string, { title: string; guides: DemoGuide[] }>} */
  const grouped = {};
  for (const guide of data.guides) {
    if (!grouped[guide.category]) {
      grouped[guide.category] = {
        title: guide.categoryTitle,
        guides: []
      };
    }
    grouped[guide.category].guides.push(guide);
  }

  const sectionsHtml = [];

  for (const [catKey, group] of Object.entries(grouped)) {
    const cardsHtml = group.guides.map(guide => renderDemoCard(guide)).join('');

    sectionsHtml.push(`
      <section class="category-section" id="cat-${escapeHtml(catKey)}" data-category="${escapeHtml(catKey)}">
        <header class="category-header">
          <h2 class="category-header-title">
            <span>${escapeHtml(group.title)}</span>
            <span class="category-count">${group.guides.length}</span>
          </h2>
        </header>
        <div class="demos-grid">
          ${cardsHtml}
        </div>
      </section>
    `);
  }

  demosContainer.innerHTML = sectionsHtml.join('');

  // Observe all iframe wrappers
  if (iframeObserver) {
    const wrappers = demosContainer.querySelectorAll('.demo-iframe-wrapper');
    for (const wrapper of wrappers) {
      iframeObserver.observe(wrapper);
    }
  }
}

/**
 * Renders an individual demo card.
 * @param {DemoGuide} guide
 * @returns {string}
 */
function renderDemoCard(guide) {
  const activeVariantId = activeVariants.get(guide.id) || guide.demos[0]?.id || 'demo';
  const activeDemo = guide.demos.find(d => d.id === activeVariantId) || guide.demos[0];
  const demoUrl = activeDemo ? activeDemo.path : '';

  // Feature tags
  const featureBadges = (guide.features || []).map(f => `
    <button type="button" class="feature-tag" data-feature="${escapeHtml(f)}" title="Filter by feature: ${escapeHtml(f)}">
      ${escapeHtml(f)}
    </button>
  `).join('');

  // Variant selector buttons
  let variantSelectorHtml = '';
  if (guide.demos.length > 1) {
    const buttons = guide.demos.map(d => {
      const isSelected = d.id === activeVariantId;
      const isAntiPattern = d.id === 'negative-demo';
      const variantClass = isAntiPattern ? 'anti-pattern' : 'recommended';
      return `
        <button type="button" 
                class="variant-btn ${isSelected ? `active ${variantClass}` : ''}"
                data-guide-id="${escapeHtml(guide.id)}"
                data-demo-id="${escapeHtml(d.id)}"
                data-path="${escapeHtml(d.path)}">
          ${escapeHtml(d.label)}
        </button>
      `;
    }).join('');

    variantSelectorHtml = `<div class="variant-selector">${buttons}</div>`;
  }

  const isCurrentAntiPattern = activeVariantId === 'negative-demo';
  const statusDotClass = isCurrentAntiPattern ? 'anti-pattern' : '';
  const currentLabel = activeDemo ? activeDemo.label : 'Recommended';

  return `
    <article class="demo-card" 
             id="card-${escapeHtml(guide.id)}" 
             data-guide-id="${escapeHtml(guide.id)}"
             data-category="${escapeHtml(guide.category)}"
             data-title="${escapeHtml(guide.title.toLowerCase())}"
             data-desc="${escapeHtml(guide.description.toLowerCase())}"
             data-features="${escapeHtml(guide.features.join(' ').toLowerCase())}">
      <div class="demo-card-header">
        <div class="demo-card-top-row">
          <h3 class="demo-card-title">${escapeHtml(guide.title)}</h3>
          ${variantSelectorHtml}
        </div>
        <div class="demo-card-tags">
          <span class="category-tag">${escapeHtml(guide.categoryTitle)}</span>
          ${featureBadges}
        </div>
      </div>

      ${guide.description ? `
        <div class="demo-card-description" title="${escapeHtml(guide.description)}">
          ${escapeHtml(guide.description)}
        </div>
      ` : ''}

      <div class="demo-iframe-wrapper" id="wrapper-${escapeHtml(guide.id)}">
        <div class="demo-iframe-placeholder" data-guide-id="${escapeHtml(guide.id)}">
          <div class="demo-spinner"></div>
          <span>Loading preview...</span>
        </div>
        <iframe class="demo-iframe"
                data-src="${escapeHtml(demoUrl)}"
                sandbox="allow-scripts allow-forms allow-popups allow-modals"
                allow="clipboard-write; fullscreen"
                loading="lazy"
                title="${escapeHtml(guide.title)} Demo">
        </iframe>
      </div>

      <div class="demo-card-footer">
        <div class="demo-active-label">
          <span class="status-dot ${statusDotClass}" id="dot-${escapeHtml(guide.id)}"></span>
          <span id="label-${escapeHtml(guide.id)}">${escapeHtml(currentLabel)}</span>
        </div>

        <div class="demo-card-actions">
          <button type="button" class="action-icon-btn reload-btn" data-guide-id="${escapeHtml(guide.id)}" title="Reload iframe preview">
            🔄
          </button>
          <a href="guide.html?guide=${encodeURIComponent(guide.id)}" class="action-icon-btn" title="View historical performance trend in Evals">
            📈 Trend
          </a>
          <a href="${escapeHtml(demoUrl)}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="action-link-btn" 
             id="open-tab-${escapeHtml(guide.id)}"
             title="Open full page demo directly in a new tab">
            Open in new tab ↗
          </a>
        </div>
      </div>
    </article>
  `;
}

/**
 * Handles switching variants (e.g. Recommended vs Anti-Pattern) on a card.
 * @param {string} guideId
 * @param {string} demoId
 * @param {string} newPath
 */
function switchVariant(guideId, demoId, newPath) {
  activeVariants.set(guideId, demoId);

  const card = document.getElementById(`card-${guideId}`);
  if (!card) return;

  // Update variant buttons
  const buttons = card.querySelectorAll('.variant-btn');
  for (const btn of buttons) {
    const isThis = btn.getAttribute('data-demo-id') === demoId;
    btn.classList.toggle('active', isThis);
    if (isThis) {
      btn.classList.toggle('anti-pattern', demoId === 'negative-demo');
      btn.classList.toggle('recommended', demoId !== 'negative-demo');
    } else {
      btn.classList.remove('active', 'anti-pattern', 'recommended');
    }
  }

  // Update iframe
  const iframe = card.querySelector('iframe');
  const placeholder = card.querySelector('.demo-iframe-placeholder');
  if (iframe) {
    iframe.dataset.src = newPath;
    if (placeholder) {
      placeholder.classList.remove('hidden');
    }
    iframe.src = newPath;
    iframe.onload = () => {
      if (placeholder) placeholder.classList.add('hidden');
    };
  }

  // Update status dot & label
  const dot = document.getElementById(`dot-${guideId}`);
  const label = document.getElementById(`label-${guideId}`);
  if (dot) {
    dot.classList.toggle('anti-pattern', demoId === 'negative-demo');
  }
  if (label) {
    const activeDemo = manifestData?.guides.find(g => g.id === guideId)?.demos.find(d => d.id === demoId);
    label.textContent = activeDemo ? activeDemo.label : demoId;
  }

  // Update "Open in new tab" link
  const openLink = document.getElementById(`open-tab-${guideId}`);
  if (openLink) {
    openLink.setAttribute('href', newPath);
  }
}

/**
 * Reloads a card's iframe.
 * @param {string} guideId
 */
function reloadCardIframe(guideId) {
  const card = document.getElementById(`card-${guideId}`);
  if (!card) return;
  const iframe = card.querySelector('iframe');
  const placeholder = card.querySelector('.demo-iframe-placeholder');
  if (iframe && iframe.dataset.src) {
    if (placeholder) placeholder.classList.remove('hidden');
    iframe.src = iframe.dataset.src;
    iframe.onload = () => {
      if (placeholder) placeholder.classList.add('hidden');
    };
  }
}

/**
 * Applies search and category filters.
 */
function applyFilters() {
  const query = searchQuery.trim().toLowerCase();
  const cat = activeCategory;

  let visibleCount = 0;

  const sections = document.querySelectorAll('.category-section');
  for (const sec of sections) {
    const sectionCat = sec.getAttribute('data-category');
    if (cat !== 'all' && sectionCat !== cat) {
      sec.classList.add('hidden');
      continue;
    }

    let hasVisibleCardInSection = false;
    const cards = sec.querySelectorAll('.demo-card');
    for (const card of cards) {
      const cardTitle = card.getAttribute('data-title') || '';
      const cardDesc = card.getAttribute('data-desc') || '';
      const cardFeatures = card.getAttribute('data-features') || '';
      const cardId = card.getAttribute('data-guide-id') || '';

      const matchesQuery = !query || 
        cardTitle.includes(query) || 
        cardDesc.includes(query) || 
        cardFeatures.includes(query) || 
        cardId.includes(query);

      if (matchesQuery) {
        card.classList.remove('hidden');
        hasVisibleCardInSection = true;
        visibleCount++;
      } else {
        card.classList.add('hidden');
      }
    }

    if (hasVisibleCardInSection) {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  }

  // Update clear button
  if (clearSearchBtn) {
    clearSearchBtn.classList.toggle('visible', Boolean(query));
  }

  // Update empty state
  if (noResultsElement) {
    noResultsElement.classList.toggle('hidden', visibleCount > 0);
  }

  updateFilteredCount(visibleCount);
}

/**
 * Updates the filtered count badge.
 * @param {number} [count]
 */
function updateFilteredCount(count) {
  if (!filteredCountBadge || !manifestData) return;
  const total = manifestData.count;
  const current = typeof count === 'number' ? count : total;

  if (current === total && activeCategory === 'all' && !searchQuery.trim()) {
    filteredCountBadge.textContent = `Showing all ${total} guides`;
  } else {
    filteredCountBadge.textContent = `Showing ${current} of ${total} guides`;
  }
}

/**
 * Sets up user event listeners.
 */
function setupEvents() {
  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      searchQuery = searchInput.value;
      applyFilters();
    });
  }

  // Clear search button
  if (clearSearchBtn) {
    clearSearchBtn.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      searchQuery = '';
      applyFilters();
      if (searchInput) searchInput.focus();
    });
  }

  // Reset filter button in empty state
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      activeCategory = 'all';
      searchQuery = '';
      if (searchInput) searchInput.value = '';
      if (manifestData) renderCategoryPills(manifestData);
      applyFilters();
    });
  }

  // Auto-load toggle
  if (autoLoadToggle) {
    autoLoadToggle.addEventListener('change', () => {
      autoLoadOnScroll = autoLoadToggle.checked;
      if (autoLoadOnScroll && iframeObserver && demosContainer) {
        // Trigger check for currently visible items
        const wrappers = demosContainer.querySelectorAll('.demo-iframe-wrapper');
        for (const wrapper of wrappers) {
          iframeObserver.observe(wrapper);
        }
      }
    });
  }

  // Category pill clicks (event delegation)
  if (categoryPillsContainer) {
    categoryPillsContainer.addEventListener('click', (e) => {
      const pill = /** @type {HTMLElement} */ (e.target).closest('.category-pill');
      if (!pill) return;
      const cat = pill.getAttribute('data-category');
      if (!cat) return;

      activeCategory = cat;
      const allPills = categoryPillsContainer.querySelectorAll('.category-pill');
      for (const p of allPills) {
        p.classList.toggle('active', p.getAttribute('data-category') === cat);
      }

      applyFilters();

      // If a specific category was clicked, smoothly scroll to it
      if (cat !== 'all') {
        const sec = document.getElementById(`cat-${cat}`);
        if (sec) {
          sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  // Card clicks (event delegation for variant buttons, feature tags, reload, placeholder click)
  if (demosContainer) {
    demosContainer.addEventListener('click', (e) => {
      const target = /** @type {HTMLElement} */ (e.target);

      // Variant button click
      const variantBtn = target.closest('.variant-btn');
      if (variantBtn) {
        const guideId = variantBtn.getAttribute('data-guide-id');
        const demoId = variantBtn.getAttribute('data-demo-id');
        const path = variantBtn.getAttribute('data-path');
        if (guideId && demoId && path) {
          switchVariant(guideId, demoId, path);
        }
        return;
      }

      // Feature tag click -> filter by that feature
      const featureTag = target.closest('.feature-tag');
      if (featureTag) {
        const feature = featureTag.getAttribute('data-feature');
        if (feature && searchInput) {
          searchInput.value = feature;
          searchQuery = feature;
          applyFilters();
          searchInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        return;
      }

      // Reload button click
      const reloadBtn = target.closest('.reload-btn');
      if (reloadBtn) {
        const guideId = reloadBtn.getAttribute('data-guide-id');
        if (guideId) reloadCardIframe(guideId);
        return;
      }

      // Placeholder click (manual load)
      const placeholder = target.closest('.demo-iframe-placeholder');
      if (placeholder) {
        const wrapper = placeholder.closest('.demo-iframe-wrapper');
        if (wrapper) loadIframe(/** @type {HTMLElement} */ (wrapper));
        return;
      }
    });
  }
}

/**
 * Escapes HTML characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Kick off
init();
