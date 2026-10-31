import { escapeHtml, formatDuration, isElementFullyVisible, scrollSvgLinkIntoViewOnFocus, whenElementSettlesInView, SUPPORTS_ANCHOR_POSITIONING, placePopoverFallback } from './utils.js';
/**
 * @typedef {Object} DumbbellChartOptions
 * @property {number} [size]
 * @property {number} [rowHeight]
 * @property {{ top: number, right: number, bottom: number, left: number }} [margin]
 * @property {boolean} [hideLegend]
 * @property {boolean} [hideAxes]
 * @property {string} [title]
 * @property {boolean} [hideZeros]
 * @property {number | null} [height]
 * @property {number | null} [maxHeight]
 * @property {boolean} [hideSeparators]
 * @property {boolean} [hideLabels]
 * @property {((item: ChartGroupItem) => string) | null} [itemHref] link target for a row's hit
 *   area (defaults to `#guide-<guide>`); clicks still go through the dataset's onClick
 */

/**
 * @typedef {Object} ChartGroupItem
 * @property {string} useCaseId
 * @property {string} [taskName]
 * @property {number} uVal
 * @property {number} gVal
 * @property {number} uTokens
 * @property {number} gTokens
 * @property {number} uUncachedTokens
 * @property {number} gUncachedTokens
 * @property {number} uCachedPct
 * @property {number} gCachedPct
 * @property {number} uRuntimeMs
 * @property {number} gRuntimeMs
 * @property {boolean} uFailed
 * @property {boolean} gFailed
 * @property {number} uErr
 * @property {number} gErr
 * @property {number} originalIndex
 */

/**
 * @typedef {Object} ChartDataset
 * @property {string} label
 * @property {number[]} data
 * @property {number[]} [tokens]
 * @property {number[]} [uncachedTokens]
 * @property {number[]} [cachedPct]
 * @property {number[]} [runtimeMs]
 * @property {boolean[]} [failed]
 * @property {number[]} [errRate]
 * @property {(index: number, label: string) => void} [onClick]
 */

/** @type {Element | null} */
let activeHitArea = null;
let shownWithoutInvoker = false;
let touchShownHit = /** @type {Element | null} */ (null);
if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', (e) => { if (touchShownHit && !(e.target instanceof Node && touchShownHit.contains(e.target))) touchShownHit = null; }, { capture: true, passive: true });
}
const SUPPORTS_NATIVE_INTEREST = typeof CSS !== 'undefined' && CSS.supports('selector(:interest-source)');
/** @type {WeakMap<Element, () => { marks: Element[], hit: Element }>} */
const hitRenderers = new WeakMap();
const rowAnchor = typeof document === 'undefined' ? null : document.createElement('span');
if (rowAnchor) { rowAnchor.className = 'dc-anchor'; rowAnchor.setAttribute('aria-hidden', 'true'); }
/** @param {{ marks: Element[], hit: Element }} target */
function rowBox(target) {
  const h = target.hit.getBoundingClientRect();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  for (const m of target.marks) {
    const r = m.getBoundingClientRect();
    left = Math.min(left, r.left);
    right = Math.max(right, r.right);
    top = Math.min(top, r.top);
    bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return { left: h.left, right: h.right, top: h.top, bottom: h.bottom };
  return { left: left - 2, right: right + 2, top: top - 2, bottom: bottom + 2 };
}
/** @type {{ marks: Element[], hit: Element } | null} */
let activeTarget = null;
let pendingHit = /** @type {Element | null} */ (null);
/** @param {{ marks: Element[], hit: Element }} target */
function moveRowAnchor(target) {
  if (!rowAnchor) return;
  const container = target.hit.closest('svg')?.parentElement;
  if (!(container instanceof HTMLElement)) return;
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  if (rowAnchor.parentElement !== container) container.appendChild(rowAnchor);
  const c = container.getBoundingClientRect();
  const r = rowBox(target);
  rowAnchor.style.left = `${r.left - c.left + container.scrollLeft - container.clientLeft}px`;
  rowAnchor.style.top = `${r.top - c.top + container.scrollTop - container.clientTop}px`;
  rowAnchor.style.width = `${r.right - r.left}px`;
  rowAnchor.style.height = `${r.bottom - r.top}px`;
}
/** @param {HTMLElement} tip
 * @param {{ marks: Element[], hit: Element }} target */
function placeTooltipFallback(tip, target) {
  if (!isElementFullyVisible(target.hit)) { hideDumbbellTooltip(); return; }
  placePopoverFallback(tip, rowBox(target), { fallbackWidth: 330, fallbackHeight: 110 });
}
/** @type {number} */
let fallbackFrame = 0;
function onViewportChangeFallback() {
  if (fallbackFrame) return;
  fallbackFrame = window.requestAnimationFrame(() => {
    fallbackFrame = 0;
    const tip = document.getElementById('dumbbell-tooltip');
    if (!tip || !activeTarget || !isTooltipOpen(tip)) return;
    if (!activeTarget.hit.isConnected) { hideDumbbellTooltip(); return; }
    placeTooltipFallback(tip, activeTarget);
  });
}
if (typeof window !== 'undefined') {
  if (!SUPPORTS_ANCHOR_POSITIONING) {
    window.addEventListener('scroll', onViewportChangeFallback, { capture: true, passive: true });
    window.addEventListener('resize', onViewportChangeFallback, { passive: true });
  } else {
    window.addEventListener('resize', () => {
      const tip = document.getElementById('dumbbell-tooltip');
      if (tip && activeTarget && activeTarget.hit.isConnected && isTooltipOpen(tip)) moveRowAnchor(activeTarget);
    }, { passive: true });
  }
}
const SUPPORTS_HINT_POPOVER = (() => {
  if (typeof document === 'undefined') return false;
  const probe = document.createElement('div');
  probe.setAttribute('popover', 'hint');
  return probe.popover === 'hint';
})();
/** @param {HTMLElement} tip */
function isTooltipOpen(tip) {
  try { return tip.matches(':popover-open'); } catch { return tip.classList.contains(':popover-open') || tip.style.display === 'block'; }
}
function releaseActiveHitArea() {
  if (activeHitArea) { activeHitArea.removeAttribute('aria-describedby'); activeHitArea = null; }
  activeTarget = null;
  shownWithoutInvoker = false;
}
/** Closing is always immediate now that interestfor owns the hover delays. */
export function hideDumbbellTooltip() {
  const tip = document.getElementById('dumbbell-tooltip');
  if (!tip) return;
  pendingHit = null;
  releaseActiveHitArea();
  if (isTooltipOpen(tip)) { if (typeof tip.hidePopover === 'function') tip.hidePopover(); else tip.style.display = 'none'; }
}
/** @param {HTMLElement} tip
 * @param {Element} hit the SVG `<a>`
 * @param {{ open?: boolean }} [opts]
 * @returns {boolean} whether the hit area resolved to a row */
function showForHitArea(tip, hit, opts = {}) {
  const render = hitRenderers.get(hit);
  if (!render) return false;
  const target = render();
  if (!SUPPORTS_ANCHOR_POSITIONING && !isElementFullyVisible(target.hit)) {
    if (activeHitArea && activeHitArea !== hit) activeHitArea.removeAttribute('aria-describedby');
    if (isTooltipOpen(tip)) { if (typeof tip.hidePopover === 'function') tip.hidePopover(); else tip.style.display = 'none'; }
    pendingHit = hit;
    whenElementSettlesInView(target.hit, () => {
      pendingHit = null;
      showForHitArea(tip, hit, { open: true });
    }, () => pendingHit === hit && hit.matches(':focus, :hover'));
    return true;
  }
  if (pendingHit !== hit) pendingHit = null;
  if (activeHitArea && activeHitArea !== hit) activeHitArea.removeAttribute('aria-describedby');
  activeHitArea = hit;
  activeTarget = target;
  if (!SUPPORTS_NATIVE_INTEREST) hit.setAttribute('aria-describedby', 'dumbbell-tooltip');
  if (SUPPORTS_ANCHOR_POSITIONING) { tip.style.removeProperty('left'); tip.style.removeProperty('top'); moveRowAnchor(target); }
  if (opts.open && !isTooltipOpen(tip)) { if (typeof tip.showPopover === 'function') tip.showPopover(); else tip.style.display = 'block'; shownWithoutInvoker = true; }
  if (!SUPPORTS_ANCHOR_POSITIONING && isTooltipOpen(tip)) placeTooltipFallback(tip, target);
  return true;
}
/** @param {HTMLElement} tip */
function wireTooltip(tip) {
  tip.addEventListener('interest', (e) => {
    const source = /** @type {Event & { source?: Element | null }} */ (e).source;
    const hit = source?.closest('.dc-hit');
    if (!hit || !showForHitArea(tip, hit)) return;
    window.setTimeout(() => {
      if (activeHitArea === hit && !isTooltipOpen(tip)) showForHitArea(tip, hit, { open: true });
    });
  });
  tip.addEventListener('loseinterest', (e) => {
    const source = /** @type {Event & { source?: Element | null }} */ (e).source;
    const hit = source?.closest('.dc-hit');
    if (shownWithoutInvoker && (!hit || hit === activeHitArea)) hideDumbbellTooltip();
  });
  /** @type {Element | null} */
  let closingHit = null;
  tip.addEventListener('beforetoggle', (e) => {
    if (/** @type {ToggleEvent} */ (e).newState === 'closed') closingHit = activeHitArea;
  });
  tip.addEventListener('toggle', (e) => {
    const open = /** @type {ToggleEvent} */ (e).newState === 'open';
    if (open && !SUPPORTS_ANCHOR_POSITIONING && activeTarget) placeTooltipFallback(tip, activeTarget);
    if (!open && !isTooltipOpen(tip) && activeHitArea && activeHitArea === closingHit) releaseActiveHitArea();
  });
  if (!SUPPORTS_HINT_POPOVER) {
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideDumbbellTooltip(); });
  }
}
/**
 * @property {HTMLElement} container
 * @property {Required<DumbbellChartOptions>} options
 * @property {HTMLElement | null} tooltip
 * @property {SVGElement} svg
 */
export class DumbbellChart {
  /**
   * @param {string | HTMLElement} containerId
   * @param {DumbbellChartOptions} [options]
   */
  constructor(containerId, options = {}) {
    const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    if (!container) throw new Error(`Container not found: ${containerId}`);
    this.container = container;

    this.options = {
      size: options.size || 600,
      rowHeight: options.rowHeight || 30,
      margin: options.margin || { top: 40, right: 30, bottom: 40, left: 200 },
      hideLegend: options.hideLegend || false,
      hideAxes: options.hideAxes || false,
      title: options.title || '',
      hideZeros: options.hideZeros || false,
      height: options.height || null,
      maxHeight: options.maxHeight || null,
      hideSeparators: options.hideSeparators || false,
      hideLabels: options.hideLabels || false,
      itemHref: options.itemHref || null,
      ...options
    };

    this.container.style.overflowY = "auto";
    this.container.style.overflowX = "hidden";
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    if (this.options.hideLabels) { this.tooltip = null; return; }
    this.tooltip = document.getElementById('dumbbell-tooltip');
    if (!this.tooltip && document.body) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'dumbbell-tooltip';
      this.tooltip.className = 'chart-tooltip';
      this.tooltip.setAttribute('popover', 'hint');
      document.body.appendChild(this.tooltip);
    }
    if (!this.tooltip) return;
    this.tooltip.setAttribute('role', 'tooltip');
    if (this.tooltip.dataset.wired === 'true') return;
    this.tooltip.dataset.wired = 'true';
    wireTooltip(this.tooltip);
  }

  /**
   * @param {{
   *   labels: string[],
   *   datasets: ChartDataset[]
   * }} data
   * @returns {number}
   */
  render(data) {
    let offsetStep = 8;
    let baseRowHeight = this.options.rowHeight;
    this.init();

    const labels = data.labels || [];
    const datasets = data.datasets || [];
    
    if (labels.length === 0) return 0;

    const unguidedSet = /** @type {ChartDataset} */ (datasets.find(d => d.label.toLowerCase() === 'unguided') || { label: 'unguided', data: Array.from({ length: labels.length }).fill(0), tokens: Array.from({ length: labels.length }).fill(0) });
    const guidedSet = /** @type {ChartDataset} */ (datasets.find(d => d.label.toLowerCase() === 'guided') || { label: 'guided', data: Array.from({ length: labels.length }).fill(0), tokens: Array.from({ length: labels.length }).fill(0) });

    const width = this.options.size;

    // Group items by Feature Name (lookup from features-mapping.gen.js if available)
    /** @type {Record<string, ChartGroupItem[]>} */
    const groups = {};
    const featuresMap = window.__featuresMapping || {};

    labels.forEach((label, i) => {
        let taskName = label;
        let useCaseId = "";
        const match = label.match(/^(.*) \(([^)]+)\)$/);
        if (match) {
            taskName = match[1];
            useCaseId = match[2];
        } else {
            const parts = label.split(' - ');
            if (parts.length >= 2) {
                taskName = parts[0];
                useCaseId = parts.slice(1).join(' - ');
            }
        }

        // Use useCaseId (guide name) for lookup in featuresMap, fallback to useCaseId if no feature found, and finally taskName
        let featureName = useCaseId || taskName || 'Uncategorized';
        if (featuresMap[useCaseId] && featuresMap[useCaseId].length > 0) {
            featureName = featuresMap[useCaseId][0] || 'Uncategorized';
        }

        const uVal = unguidedSet.data[i] || 0;
        const gVal = guidedSet.data[i] || 0;
        const uTokens = unguidedSet.tokens ? (unguidedSet.tokens[i] || 0) : 0;
        const gTokens = guidedSet.tokens ? (guidedSet.tokens[i] || 0) : 0;
        const uUncachedTokens = unguidedSet.uncachedTokens ? (unguidedSet.uncachedTokens[i] || 0) : 0;
        const gUncachedTokens = guidedSet.uncachedTokens ? (guidedSet.uncachedTokens[i] || 0) : 0;
        const uCachedPct = unguidedSet.cachedPct ? (unguidedSet.cachedPct[i] || 0) : 0;
        const gCachedPct = guidedSet.cachedPct ? (guidedSet.cachedPct[i] || 0) : 0;
        const uRuntimeMs = unguidedSet.runtimeMs ? (unguidedSet.runtimeMs[i] || 0) : 0;
        const gRuntimeMs = guidedSet.runtimeMs ? (guidedSet.runtimeMs[i] || 0) : 0;
        const uFailed = unguidedSet.failed ? !!unguidedSet.failed[i] : false;
        const gFailed = guidedSet.failed ? !!guidedSet.failed[i] : false;
        const uErr = unguidedSet.errRate ? (unguidedSet.errRate[i] || 0) : 0;
        const gErr = guidedSet.errRate ? (guidedSet.errRate[i] || 0) : 0;
        
        if (this.options.hideZeros && uVal === 0 && gVal === 0) return;

        if (!groups[featureName]) groups[featureName] = [];
        groups[featureName].push({
            taskName,
            useCaseId,
            uVal,
            gVal,
            uTokens,
            gTokens,
            uUncachedTokens,
            gUncachedTokens,
            uCachedPct,
            gCachedPct,
            uRuntimeMs,
            gRuntimeMs,
            uFailed,
            gFailed,
            uErr,
            gErr,
            originalIndex: i
        });
    });

    const featureNames = Object.keys(groups).sort();
    
    // Calculate natural CONTENT height (excluding margins)
    let naturalContentHeight = 0;
    featureNames.forEach(f => {
        const count = groups[f].length;
        naturalContentHeight += baseRowHeight + (count - 1) * offsetStep;
    });

    const verticalMargins = this.options.margin.top + this.options.margin.bottom;
    let totalNaturalHeight = verticalMargins + naturalContentHeight;
    let finalSvgHeight = totalNaturalHeight;

    if (this.options.maxHeight && totalNaturalHeight > this.options.maxHeight && naturalContentHeight > 0) {
        const availableContentHeight = Math.max(16, this.options.maxHeight - verticalMargins);
        const compressionFactor = availableContentHeight / naturalContentHeight;
        baseRowHeight *= compressionFactor;
        offsetStep *= compressionFactor;
        finalSvgHeight = verticalMargins + availableContentHeight;
    }

    // If an explicit height is passed (like dashboard), use it. Otherwise use our tightly bounded finalSvgHeight.
    const height = this.options.height || finalSvgHeight;

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    if (!svg) throw new Error("Failed to create SVG element");
    this.svg = svg;
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", `${height}px`);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // If we have a maxHeight constraint (like tooltip), use 'none' so it locks to width without downscaling. Otherwise use meet.
    this.svg.setAttribute("preserveAspectRatio", (this.options.maxHeight || this.options.height) ? "none" : "xMidYMin meet");
    
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    this.svg.appendChild(defs);
    this.svg.style.display = "block";
    this.svg.style.fontFamily = "inherit";
    this.container.appendChild(this.svg);

    const chartWidth = width - this.options.margin.left - this.options.margin.right;
    const leftAxis = this.options.margin.left;
    const scale = (/** @type {number} */ val) => leftAxis + (val / 100) * chartWidth;



    // Legend
    if (!this.options.hideLegend) {
      const legendG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      // Move legend dynamically above the first element based on your top margin settings
      legendG.setAttribute("transform", `translate(${scale(100) + 20}, ${this.options.margin.top - 5})`);
      
      const unguidedTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      unguidedTick.setAttribute("x1", "5");
      unguidedTick.setAttribute("y1", "-10");
      unguidedTick.setAttribute("x2", "5");
      unguidedTick.setAttribute("y2", "0");
      unguidedTick.setAttribute("stroke", "var(--color-outline)");
      unguidedTick.setAttribute("stroke-width", "2");

      const uText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      uText.setAttribute("x", "13");
      uText.setAttribute("fill", "var(--color-on-surface)");
      uText.setAttribute("font-size", "0.75rem");
      uText.textContent = "Unguided";
      
      const guidedTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
      guidedTick.setAttribute("x1", "80");
      guidedTick.setAttribute("y1", "-11");
      guidedTick.setAttribute("x2", "80");
      guidedTick.setAttribute("y2", "1");
      guidedTick.setAttribute("stroke", "var(--color-primary)");
      guidedTick.setAttribute("stroke-width", "2.5");

      const gText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      gText.setAttribute("x", "88");
      gText.setAttribute("fill", "var(--color-on-surface)");
      gText.setAttribute("font-size", "0.75rem");
      gText.textContent = "Guided";

      legendG.appendChild(unguidedTick);
      legendG.appendChild(uText);
      legendG.appendChild(guidedTick);
      legendG.appendChild(gText);
      svg.appendChild(legendG);
    }

    // Axes & Grid
    const topAxisY = this.options.margin.top;
    const bottomAxisY = height - this.options.margin.bottom;
      
    if (!this.options.hideAxes) {
      [0, 25, 50, 75, 100].forEach(val => {
        const x = scale(val);
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", x.toString());
        tick.setAttribute("y1", topAxisY.toString());
        tick.setAttribute("x2", x.toString());
        tick.setAttribute("y2", bottomAxisY.toString());
        tick.setAttribute("stroke", "var(--color-outline-variant)");
        tick.setAttribute("stroke-width", "1");
        if (val !== 0 && val !== 100) tick.setAttribute("stroke-dasharray", "4 4");
        svg.appendChild(tick);
        
        const tickText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tickText.setAttribute("x", x.toString());
        tickText.setAttribute("y", (bottomAxisY + 20).toString());
        tickText.setAttribute("fill", "var(--color-on-surface-variant)");
        tickText.setAttribute("font-size", "0.75rem");
        tickText.setAttribute("text-anchor", "middle");
        tickText.textContent = val + "%";
        svg.appendChild(tickText);
      });
    }

    // We simplify to use the primary blue color for all guided elements

    // Data Rows
    let currentY = this.options.margin.top;

    featureNames.forEach((featureName, rowIndex) => {
      const items = groups[featureName];
      const rowHeight = baseRowHeight + (items.length - 1) * offsetStep;
      const rowY = currentY + (rowHeight / 2);

      // Faint horizontal separator
      if (rowIndex > 0 && !this.options.hideSeparators) {
        const sep = document.createElementNS("http://www.w3.org/2000/svg", "line");
        sep.setAttribute("x1", leftAxis.toString());
        sep.setAttribute("y1", currentY.toString());
        sep.setAttribute("x2", scale(100).toString());
        sep.setAttribute("y2", currentY.toString());
        sep.setAttribute("stroke", "var(--color-outline-variant)");
        sep.setAttribute("stroke-width", "1");
        svg.appendChild(sep);
      }

      // Label text for Feature (Feature Name only) - Moved to the right
      // Create background rect for the whole row
      const rowBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rowBg.setAttribute("x", "0");
      rowBg.setAttribute("y", currentY.toString());
      rowBg.setAttribute("width", width.toString());
      rowBg.setAttribute("height", rowHeight.toString());
      rowBg.setAttribute("fill", "transparent");
      svg.appendChild(rowBg);

      if (!this.options.hideLabels) {
        const hasFailure = items.some(item => item.uFailed || item.gFailed);
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", (scale(100) + 15).toString());
        text.setAttribute("y", rowY.toString());
        text.setAttribute("fill", hasFailure ? "var(--color-accent-warning)" : "var(--color-on-surface-variant)");
        text.setAttribute("font-size", "0.75rem");
        text.setAttribute("font-family", "var(--font-sans)");
        text.setAttribute("font-weight", hasFailure ? "bold" : "600");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = hasFailure ? `⚠ ${featureName}` : featureName;
        
        if (guidedSet.onClick && items.length > 0) { text.style.cursor = "pointer"; text.onclick = () => guidedSet.onClick?.(items[0].originalIndex, 'Guided'); }
        text.onmouseenter = () => rowBg.setAttribute("fill", "var(--hover-bg)");
        text.onmouseleave = () => rowBg.setAttribute("fill", "transparent");
        
        svg.appendChild(text);
      }

      const startOffset = -((items.length - 1) / 2) * offsetStep;

      items.forEach((item, itemIndex) => {
          const y = rowY + startOffset + (itemIndex * offsetStep);
          const uVal = item.uVal;
          const gVal = item.gVal;
          const uX = scale(uVal);
          const gX = scale(gVal);

          const isPositive = gVal >= uVal;
          const lineColor = isPositive ? "var(--color-primary)" : "var(--color-accent-failure)";
          const trackHeight = Math.min(4, Math.max(2, offsetStep * 0.45));
          const uHalf = Math.min(5, Math.max(2.75, offsetStep * 0.58));
          const gHalf = Math.min(6, Math.max(3.25, offsetStep * 0.72));
          const track = document.createElementNS("http://www.w3.org/2000/svg", "line");
          track.setAttribute("x1", leftAxis.toString());
          track.setAttribute("y1", y.toString());
          track.setAttribute("x2", scale(100).toString());
          track.setAttribute("y2", y.toString());
          track.setAttribute("stroke", "var(--color-surface-container)");
          track.setAttribute("stroke-width", trackHeight.toString());
          track.setAttribute("class", "dc-track");
          svg.appendChild(track);
          const bands = [
              { val: uVal, err: item.uErr, fill: "var(--color-outline)", opacity: "0.25" },
              { val: gVal, err: item.gErr, fill: "var(--color-accent-warning)", opacity: "0.35" }
          ];
          for (const b of bands) {
              if (b.err <= 0) continue;
              const pill = document.createElementNS("http://www.w3.org/2000/svg", "rect");
              const minVal = b.val * (1 - b.err / 100);
              pill.setAttribute("x", scale(minVal).toString());
              pill.setAttribute("y", (y - uHalf).toString());
              pill.setAttribute("width", ((b.err / 100) * chartWidth).toString());
              pill.setAttribute("height", (uHalf * 2).toString());
              pill.setAttribute("fill", b.fill);
              pill.setAttribute("opacity", b.opacity);
              pill.setAttribute("class", "dc-band");
              svg.appendChild(pill);
          }

          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", uX.toString());
          line.setAttribute("y1", y.toString());
          line.setAttribute("x2", gX.toString());
          line.setAttribute("y2", y.toString());
          line.setAttribute("stroke", lineColor);
          line.setAttribute("stroke-width", trackHeight.toString());
          line.setAttribute("class", isPositive ? "dc-connector" : "dc-connector regressed");
          if (!isPositive) line.setAttribute("stroke-dasharray", "4 2");
          svg.appendChild(line);

          const uTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
          uTick.setAttribute("x1", uX.toString());
          uTick.setAttribute("y1", (y - uHalf).toString());
          uTick.setAttribute("x2", uX.toString());
          uTick.setAttribute("y2", (y + uHalf).toString());
          uTick.setAttribute("stroke", item.uFailed ? "var(--color-accent-warning)" : "var(--color-outline)");
          uTick.setAttribute("stroke-width", "2");
          uTick.setAttribute("class", "dc-utick");
          svg.appendChild(uTick);
          const gTick = document.createElementNS("http://www.w3.org/2000/svg", "line");
          gTick.setAttribute("x1", gX.toString());
          gTick.setAttribute("y1", (y - gHalf).toString());
          gTick.setAttribute("x2", gX.toString());
          gTick.setAttribute("y2", (y + gHalf).toString());
          gTick.setAttribute("stroke", item.gFailed ? "var(--color-accent-warning)" : "var(--color-primary)");
          gTick.setAttribute("stroke-width", "2.5");
          gTick.setAttribute("class", "dc-gtick");
          svg.appendChild(gTick);
          const hitTop = itemIndex === 0 ? currentY : y - (offsetStep / 2);
          const hitBottom = itemIndex === items.length - 1 ? currentY + rowHeight : y + (offsetStep / 2);
          const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          hitRect.setAttribute("x", leftAxis.toString());
          hitRect.setAttribute("y", hitTop.toString());
          hitRect.setAttribute("width", (width - this.options.margin.left - this.options.margin.right).toString());
          hitRect.setAttribute("height", (hitBottom - hitTop).toString());
          hitRect.setAttribute("fill", "transparent");
          hitRect.style.cursor = "pointer";
          /** @type {SVGElement} */
          let hitArea = hitRect;
          if (!this.options.hideLabels) {
              hitArea = document.createElementNS("http://www.w3.org/2000/svg", "a");
              hitArea.setAttribute("class", "dc-hit");
              hitArea.setAttribute("href", this.options.itemHref ? this.options.itemHref(item) : `#guide-${encodeURIComponent(item.useCaseId || featureName)}`);
              hitArea.setAttribute("interestfor", "dumbbell-tooltip");
              const failedNote = (item.uFailed || item.gFailed) ? ', at least one run failed before grading' : '';
              hitArea.setAttribute("aria-label", `${item.useCaseId || featureName} (${item.taskName}): open task${failedNote}`);
              hitArea.appendChild(hitRect);
              scrollSvgLinkIntoViewOnFocus(hitArea, hitRect);
          }
          const renderTooltip = () => {
            const tip = this.tooltip;
            const target = { marks: [uTick, gTick], hit: hitRect };
            if (!tip) return target;
            const delta = Math.round(gVal - uVal);
            const deltaSign = delta > 0 ? "+" : "";
            
            const uTokens = item.uTokens || 0;
            const gTokens = item.gTokens || 0;
            const uUncached = item.uUncachedTokens || uTokens;
            const gUncached = item.gUncachedTokens || gTokens;
            const gCachedPct = item.gCachedPct || 0;
            const uRuntimeMs = item.uRuntimeMs || 0;
            const gRuntimeMs = item.gRuntimeMs || 0;
            const uncachedDeltaPct = uUncached > 0 ? Math.round(((gUncached - uUncached) / uUncached) * 100) : 0;
            const uncachedDeltaSign = uncachedDeltaPct > 0 ? "+" : "";
            const uncachedDeltaCls = uncachedDeltaPct <= 0 ? "text-success" : "";
            const runtimeDeltaPct = uRuntimeMs > 0 ? Math.round(((gRuntimeMs - uRuntimeMs) / uRuntimeMs) * 100) : 0;
            const runtimeDeltaSign = runtimeDeltaPct > 0 ? "+" : "";
            const runtimeDeltaCls = runtimeDeltaPct <= 0 ? "text-success" : "";
            const fmtTime = (/** @type {number} */ ms) => (ms && ms > 0) ? formatDuration(ms) : '-';
            tip.innerHTML = ` <div class="dumbbell-tooltip"> <div class="dumbbell-tooltip-left"> <div class="dumbbell-tooltip-title${item.uFailed || item.gFailed ? ' text-warning' : ''}">${escapeHtml(item.useCaseId)} (${escapeHtml(item.taskName)})</div> <div class="dumbbell-tooltip-feature">feature: ${escapeHtml(featureName)}</div> ${(uRuntimeMs > 0 || gRuntimeMs > 0 || uTokens > 0 || gTokens > 0) ? `
                         <div class="dumbbell-tooltip-metrics">
                            ${(uRuntimeMs > 0 || gRuntimeMs > 0) ? `<div>Time (U → G): <strong>${fmtTime(uRuntimeMs)} → ${fmtTime(gRuntimeMs)}</strong> <span class="${runtimeDeltaCls}">(${runtimeDeltaSign}${runtimeDeltaPct}%)</span></div>` : ''}
                            ${(uUncached > 0 || gUncached > 0) ? `<div>Uncached Tokens: <strong>${uUncached.toLocaleString()} → ${gUncached.toLocaleString()}</strong> <span class="${uncachedDeltaCls}">(${uncachedDeltaSign}${uncachedDeltaPct}%)</span></div>` : ''}
                            ${(uTokens > 0 || gTokens > 0) ? ` <div>Total Tokens: <strong>${uTokens.toLocaleString()} → ${gTokens.toLocaleString()}</strong>${gCachedPct > 0 ? ` <span>(${gCachedPct}% cached)</span>` : ''}</div> ` : ''}
                         </div>
                         ` : ''}
                    </div>
                    <div class="dumbbell-tooltip-right">
                         <div class="dumbbell-tooltip-uplift ${delta >= 0 ? 'positive' : 'negative'}">Uplift: ${deltaSign}${delta} pp</div>
                         <div class="dumbbell-tooltip-rate${item.gFailed ? ' text-warning' : ''}">Guided: ${Math.round(gVal)}% ${item.gErr > 0 ? `(${Math.round(gVal * (1 - item.gErr / 100))}%–${Math.round(gVal * (1 - item.gErr / 100) + item.gErr)}%, ${item.gErr}% err)` : (item.gFailed ? '(Infra Error excluded)' : '')}</div>
                         <div class="dumbbell-tooltip-rate${item.uFailed ? ' text-warning' : ''}">Unguided: ${Math.round(uVal)}% ${item.uErr > 0 ? `(${Math.round(uVal * (1 - item.uErr / 100))}%–${Math.round(uVal * (1 - item.uErr / 100) + item.uErr)}%, ${item.uErr}% err)` : (item.uFailed ? '(Infra Error excluded)' : '')}</div>
                     </div>
                </div>
            `;
            return target;
          };
          if (!this.options.hideLabels) {
            hitRenderers.set(hitArea, renderTooltip);
            hitArea.addEventListener('click', (e) => {
              const tip = this.tooltip;
              if (tip && /** @type {PointerEvent} */ (e).pointerType === 'touch' && touchShownHit !== hitArea) {
                e.preventDefault();
                showForHitArea(tip, hitArea, { open: true });
                touchShownHit = hitArea;
                return;
              }
              touchShownHit = null;
              if (guidedSet.onClick) { e.preventDefault(); hideDumbbellTooltip(); guidedSet.onClick(item.originalIndex, 'Guided'); }
            });
          } else if (guidedSet.onClick) {
              hitArea.onclick = () => guidedSet.onClick ? guidedSet.onClick(item.originalIndex, 'Guided') : null;
          }
          svg.appendChild(hitArea);
      });

      currentY += rowHeight; // Shift Y down for the next feature row
    });
    
    return height; // Return height so parent can use it to avoid cutting things off!
  }
}
