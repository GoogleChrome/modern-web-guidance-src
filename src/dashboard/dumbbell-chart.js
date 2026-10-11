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
 * @property {(index: number, label: string) => void} [onClick]
 */

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
      ...options
    };

    this.container.style.overflowY = "auto";
    this.container.style.overflowX = "hidden";
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.tooltip = document.getElementById('dumbbell-tooltip');
    if (!this.tooltip && document.body) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'dumbbell-tooltip';
      this.tooltip.className = 'chart-tooltip';
      document.body.appendChild(this.tooltip);
    }
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
            originalIndex: i
        });
    });

    const featureNames = Object.keys(groups).sort();
    
    // Calculate natural CONTENT height (excluding margins)
    let naturalContentHeight = 0;
    featureNames.forEach(f => {
        const count = groups[f].length;
        naturalContentHeight += this.options.rowHeight + (count - 1) * offsetStep;
    });

    const verticalMargins = this.options.margin.top + this.options.margin.bottom;
    let totalNaturalHeight = verticalMargins + naturalContentHeight;
    let finalSvgHeight = totalNaturalHeight;

    if (this.options.maxHeight && totalNaturalHeight > this.options.maxHeight && naturalContentHeight > 0) {
        const availableContentHeight = this.options.maxHeight - verticalMargins;
        const compressionFactor = availableContentHeight / naturalContentHeight;
        this.options.rowHeight *= compressionFactor;
        offsetStep *= compressionFactor;
        finalSvgHeight = this.options.maxHeight;
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
      
      const unguidedCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      unguidedCircle.setAttribute("cx", "5");
      unguidedCircle.setAttribute("cy", "-5");
      unguidedCircle.setAttribute("r", "5");
      unguidedCircle.setAttribute("fill", "transparent");
      unguidedCircle.setAttribute("stroke", "var(--color-outline)");
      unguidedCircle.setAttribute("stroke-width", "2");

      const uText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      uText.setAttribute("x", "15");
      uText.setAttribute("fill", "var(--color-on-surface)");
      uText.setAttribute("font-size", "12");
      uText.textContent = "Unguided";
      
      const guidedCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      guidedCircle.setAttribute("cx", "80");
      guidedCircle.setAttribute("cy", "-5");
      guidedCircle.setAttribute("r", "5");
      guidedCircle.setAttribute("fill", "var(--color-primary)");

      const gText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      gText.setAttribute("x", "90");
      gText.setAttribute("fill", "var(--color-on-surface)");
      gText.setAttribute("font-size", "12");
      gText.textContent = "Guided";

      legendG.appendChild(unguidedCircle);
      legendG.appendChild(uText);
      legendG.appendChild(guidedCircle);
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
        tickText.setAttribute("font-size", "10");
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
      const rowHeight = this.options.rowHeight + (items.length - 1) * offsetStep;
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
        text.setAttribute("fill", hasFailure ? "var(--color-accent-failure, #da3633)" : "var(--color-on-surface-variant)");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-family", "var(--font-sans)");
        text.setAttribute("font-weight", hasFailure ? "bold" : "600");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = featureName;
        if (hasFailure) {
          // Red alone would be color-only; give AT (and the hover title) the reason.
          const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
          title.textContent = `${featureName}: at least one run failed before grading`;
          text.appendChild(title);
          text.setAttribute("aria-label", `${featureName} (had failed runs)`);
        }
        
        // Add hover effects to highlight the row
        text.style.cursor = "pointer";
        text.onmouseenter = () => rowBg.setAttribute("fill", "rgba(0, 0, 0, 0.05)");
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

          // Connecting Line (The Delta)
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", uX.toString());
          line.setAttribute("y1", y.toString());
          line.setAttribute("x2", gX.toString());
          line.setAttribute("y2", y.toString());
          line.setAttribute("stroke", lineColor);
          line.setAttribute("stroke-width", "1.5");
          line.setAttribute("stroke-linecap", "round");

          svg.appendChild(line);

          // Unguided Dot (Baseline)
          const uDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          uDot.setAttribute("cx", uX.toString());
          uDot.setAttribute("cy", y.toString());
          uDot.setAttribute("r", "3");
          uDot.setAttribute("fill", "var(--color-surface-container-lowest)");
          uDot.setAttribute("stroke", item.uFailed ? "var(--color-accent-failure, #da3633)" : "var(--color-outline)");
          uDot.setAttribute("stroke-width", "1.5");
          svg.appendChild(uDot);

          // Guided Dot (Outcome)
          const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          gDot.setAttribute("cx", gX.toString());
          gDot.setAttribute("cy", y.toString());
          gDot.setAttribute("r", "3");
          gDot.setAttribute("fill", item.gFailed ? "var(--color-accent-failure, #da3633)" : "var(--color-primary)");
          svg.appendChild(gDot);

          // Hit area for tooltip (covers the specific sub-line)
          const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          hitArea.setAttribute("x", leftAxis.toString()); // only over the chart area
          hitArea.setAttribute("y", (y - (offsetStep / 2)).toString());
          hitArea.setAttribute("width", (width - this.options.margin.left - this.options.margin.right).toString());
          hitArea.setAttribute("height", offsetStep.toString());
          hitArea.setAttribute("fill", "transparent");
          hitArea.style.cursor = "pointer";
          
          hitArea.onmousemove = (e) => {
            if (!this.tooltip) return;
            const delta = Math.round(gVal - uVal);
            const deltaColor = delta >= 0 ? "var(--color-accent-success)" : "var(--color-accent-failure)";
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
            const uncachedDeltaColor = uncachedDeltaPct <= 0 ? "var(--color-accent-success, #22c55e)" : "var(--color-on-surface-variant)";

            const runtimeDeltaPct = uRuntimeMs > 0 ? Math.round(((gRuntimeMs - uRuntimeMs) / uRuntimeMs) * 100) : 0;
            const runtimeDeltaSign = runtimeDeltaPct > 0 ? "+" : "";
            const runtimeDeltaColor = runtimeDeltaPct <= 0 ? "var(--color-accent-success, #22c55e)" : "var(--color-on-surface-variant)";

            const fmtTime = (/** @type {number} */ ms) => {
              if (!ms || ms <= 0) return '-';
              const sec = Math.round(ms / 1000);
              return sec >= 60 ? `${Math.floor(sec / 60)}m ${sec % 60}s` : `${sec}s`;
            };

            this.tooltip.style.display = 'block';
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';

            this.tooltip.innerHTML = `
                <div style="display: flex; gap: 24px; align-items: flex-start; justify-content: space-between; min-width: 310px; color: var(--color-on-surface);">
                    <!-- Left Column -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                         <div style="font-weight: bold; font-size: 0.875rem; white-space: nowrap; color: ${item.uFailed || item.gFailed ? 'var(--color-accent-failure, #da3633)' : 'inherit'};">${item.useCaseId} (${item.taskName})</div>
                          <div style="font-size: 0.7rem; color: var(--color-on-surface-variant);">feature: ${featureName}</div>
                         ${(uRuntimeMs > 0 || gRuntimeMs > 0 || uTokens > 0 || gTokens > 0) ? `
                         <div style="font-size: 0.7rem; color: var(--color-on-surface-variant); margin-top: 6px; display: flex; flex-direction: column; gap: 3px;">
                            ${(uRuntimeMs > 0 || gRuntimeMs > 0) ? `
                            <div>Time (U → G): <strong>${fmtTime(uRuntimeMs)} → ${fmtTime(gRuntimeMs)}</strong> <span style="color: ${runtimeDeltaColor}; font-weight: 600;">(${runtimeDeltaSign}${runtimeDeltaPct}%)</span></div>
                            ` : ''}
                            ${(uUncached > 0 || gUncached > 0) ? `
                            <div>Uncached Tokens: <strong>${uUncached.toLocaleString()} → ${gUncached.toLocaleString()}</strong> <span style="color: ${uncachedDeltaColor}; font-weight: 600;">(${uncachedDeltaSign}${uncachedDeltaPct}%)</span></div>
                            ` : ''}
                            ${(uTokens > 0 || gTokens > 0) ? `
                            <div>Total Tokens: <strong>${uTokens.toLocaleString()} → ${gTokens.toLocaleString()}</strong>${gCachedPct > 0 ? ` <span style="opacity: 0.85;">(${gCachedPct}% cached)</span>` : ''}</div>
                            ` : ''}
                         </div>
                         ` : ''}
                    </div>
                    <!-- Right Column -->
                    <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-end; font-size: 0.75rem;">
                         <div style="font-weight: bold; color: ${deltaColor}; font-size: 0.875rem;">Uplift: ${deltaSign}${delta}%</div>
                         <div style="white-space: nowrap; color: ${item.gFailed ? 'var(--color-accent-failure, #da3633)' : 'inherit'};">Guided: ${Math.round(gVal)}% ${item.gFailed ? '(Failed)' : ''}</div>
                         <div style="white-space: nowrap; color: ${item.uFailed ? 'var(--color-accent-failure, #da3633)' : 'inherit'};">Unguided: ${Math.round(uVal)}% ${item.uFailed ? '(Failed)' : ''}</div>
                     </div>
                </div>
            `;
          };
          
          hitArea.onmouseleave = () => { if (this.tooltip) this.tooltip.style.display = 'none'; };
          if (guidedSet.onClick) {
              hitArea.onclick = () => guidedSet.onClick ? guidedSet.onClick(item.originalIndex, 'Guided') : null;
          }
          svg.appendChild(hitArea);
      });

      currentY += rowHeight; // Shift Y down for the next feature row
    });
    
    return height; // Return height so parent can use it to avoid cutting things off!
  }
}
