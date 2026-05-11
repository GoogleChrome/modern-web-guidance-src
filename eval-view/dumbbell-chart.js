export class DumbbellChart {
  constructor(containerId, options = {}) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
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

  render(data) {
    let offsetStep = 8;
    this.init();

    const labels = data.labels || [];
    const datasets = data.datasets || [];
    
    if (labels.length === 0) return;

    let unguidedSet = datasets.find(d => d.label.toLowerCase() === 'unguided') || { data: Array.from({ length: labels.length }).fill(0), tokens: Array.from({ length: labels.length }).fill(0) };
    let guidedSet = datasets.find(d => d.label.toLowerCase() === 'guided') || { data: Array.from({ length: labels.length }).fill(0), tokens: Array.from({ length: labels.length }).fill(0) };

    const width = this.options.size;

    // Group items by Feature Name (lookup from features_mapping.gen.js if available)
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
        
        if (this.options.hideZeros && uVal === 0 && gVal === 0) return;

        if (!groups[featureName]) groups[featureName] = [];
        groups[featureName].push({
            useCaseId,
            uVal,
            gVal,
            uTokens,
            gTokens,
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

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", `${height}px`);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // If we have a maxHeight constraint (like tooltip), use 'none' so it locks to width without downscaling. Otherwise use meet.
    this.svg.setAttribute("preserveAspectRatio", (this.options.maxHeight || this.options.height) ? "none" : "xMidYMin meet");
    
    // Add Gradients in defs
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    
    const gradients = [
        { id: "purple-neon", start: "oklch(65% 0.25 290)", end: "oklch(75% 0.15 210)" }, // Violet to Cyan
        { id: "purple-magik", start: "oklch(60% 0.28 320)", end: "oklch(70% 0.20 280)" }, // Magenta to Lavender
        { id: "purple-deep", start: "oklch(55% 0.25 295)", end: "oklch(65% 0.20 305)" }, // Vivid Grape to Orchid
        { id: "purple-gold", start: "oklch(60% 0.25 310)", end: "oklch(80% 0.15 85)" }   // Purp-Pink to Warm Amber 
    ];

    gradients.forEach(grad => {
        const linearGrad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
        linearGrad.setAttribute("id", grad.id);
        linearGrad.setAttribute("gradientUnits", "userSpaceOnUse");
        linearGrad.setAttribute("x1", "0%");
        linearGrad.setAttribute("y1", "0%");
        linearGrad.setAttribute("x2", "100%");
        linearGrad.setAttribute("y2", "0%");

        const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop1.setAttribute("offset", "0%");
        stop1.setAttribute("stop-color", grad.start);

        const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
        stop2.setAttribute("offset", "100%");
        stop2.setAttribute("stop-color", grad.end);

        linearGrad.appendChild(stop1);
        linearGrad.appendChild(stop2);
        defs.appendChild(linearGrad);
    });

    // Add Glow Filter for expensive token usage
    const filter = document.createElementNS("http://www.w3.org/2000/svg", "filter");
    filter.setAttribute("id", "red-glow");
    const shadow = document.createElementNS("http://www.w3.org/2000/svg", "feDropShadow");
    shadow.setAttribute("dx", "0");
    shadow.setAttribute("dy", "0");
    shadow.setAttribute("stdDeviation", "3");
    shadow.setAttribute("flood-color", "#da3633");
    shadow.setAttribute("flood-opacity", "0.8");
    filter.appendChild(shadow);
    defs.appendChild(filter);

    this.svg.appendChild(defs);
    this.svg.style.display = "block";
    this.svg.style.fontFamily = "inherit";
    this.container.appendChild(this.svg);

    const chartWidth = width - this.options.margin.left - this.options.margin.right;
    const leftAxis = this.options.margin.left;
    const scale = (val) => leftAxis + (val / 100) * chartWidth;



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
      unguidedCircle.setAttribute("stroke", "#8b949e");
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
      guidedCircle.setAttribute("fill", "oklch(65% 0.25 290)");

      const gText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      gText.setAttribute("x", "90");
      gText.setAttribute("fill", "var(--color-on-surface)");
      gText.setAttribute("font-size", "12");
      gText.textContent = "Guided";

      legendG.appendChild(unguidedCircle);
      legendG.appendChild(uText);
      legendG.appendChild(guidedCircle);
      legendG.appendChild(gText);
      this.svg.appendChild(legendG);
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
        this.svg.appendChild(tick);
        
        const tickText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tickText.setAttribute("x", x.toString());
        tickText.setAttribute("y", (bottomAxisY + 20).toString());
        tickText.setAttribute("fill", "var(--color-on-surface-variant)");
        tickText.setAttribute("font-size", "10");
        tickText.setAttribute("text-anchor", "middle");
        tickText.textContent = val + "%";
        this.svg.appendChild(tickText);
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
        sep.setAttribute("x1", leftAxis);
        sep.setAttribute("y1", currentY);
        sep.setAttribute("x2", scale(100));
        sep.setAttribute("y2", currentY);
        sep.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
        sep.setAttribute("stroke-width", "1");
        this.svg.appendChild(sep);
      }

      // Label text for Feature (Feature Name only) - Moved to the right
      // Create background rect for the whole row
      const rowBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rowBg.setAttribute("x", "0");
      rowBg.setAttribute("y", currentY.toString());
      rowBg.setAttribute("width", width.toString());
      rowBg.setAttribute("height", rowHeight.toString());
      rowBg.setAttribute("fill", "transparent");
      this.svg.appendChild(rowBg);

      if (!this.options.hideLabels) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", scale(100) + 15);
        text.setAttribute("y", rowY);
        text.setAttribute("fill", "var(--color-outline)");
        text.setAttribute("font-size", "11");
        text.setAttribute("font-family", "var(--font-sans)");
        text.setAttribute("font-weight", "600");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = featureName;
        
        // Add hover effects to highlight the row
        text.style.cursor = "pointer";
        text.onmouseenter = () => rowBg.setAttribute("fill", "rgba(0, 0, 0, 0.05)");
        text.onmouseleave = () => rowBg.setAttribute("fill", "transparent");
        
        this.svg.appendChild(text);
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
          line.setAttribute("x1", uX);
          line.setAttribute("y1", y);
          line.setAttribute("x2", gX);
          line.setAttribute("y2", y);
          line.setAttribute("stroke", lineColor);
          line.setAttribute("stroke-width", "1.5");
          line.setAttribute("stroke-linecap", "round");

          this.svg.appendChild(line);

          // Unguided Dot (Baseline)
          const uDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          uDot.setAttribute("cx", uX);
          uDot.setAttribute("cy", y);
          uDot.setAttribute("r", "3");
          uDot.setAttribute("fill", "var(--color-surface-container-lowest)");
          uDot.setAttribute("stroke", "var(--color-primary)");
          uDot.setAttribute("stroke-width", "1.5");
          this.svg.appendChild(uDot);

          // Guided Dot (Outcome)
          const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          gDot.setAttribute("cx", gX);
          gDot.setAttribute("cy", y);
          gDot.setAttribute("r", "3");
          gDot.setAttribute("fill", "var(--color-primary)");
          this.svg.appendChild(gDot);



          // Hit area for tooltip (covers the specific sub-line)
          const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          hitArea.setAttribute("x", leftAxis); // only over the chart area
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
            const tokenDelta = Math.round(gTokens - uTokens);
            const tokenDeltaSign = tokenDelta > 0 ? "+" : "";
            const tokenDeltaColor = tokenDelta <= 0 ? "#7ee787" : "#ffa198"; // Using fewer tokens is good (green)

            this.tooltip.style.display = 'block';
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';
            const costPct = uTokens > 0 ? Math.round((gTokens / uTokens) * 100) : 0;

            this.tooltip.innerHTML = `
                <div style="display: flex; gap: 24px; align-items: flex-start; justify-content: space-between; min-width: 280px; color: var(--color-on-surface);">
                    <!-- Left Column -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                         <div style="font-weight: bold; font-size: 14px; white-space: nowrap;">${item.useCaseId || "Default"}</div>
                          <div style="font-size: 11px; color: var(--color-outline);">feature: ${featureName}</div>
                         ${uTokens > 0 || gTokens > 0 ? `
                         <div style="font-size: 11px; color: #8b949e; margin-top: 8px;">
                            Avg Tokens:<br/>
                            Guided: <strong>${gTokens.toLocaleString()}</strong><br/>
                            Unguided: <strong>${uTokens.toLocaleString()}</strong><br/>
                            Diff: <strong style="color: ${tokenDeltaColor}">${tokenDeltaSign}${tokenDelta.toLocaleString()}</strong><br/>
                            Cost Ratio: <strong style="color: ${tokenDeltaColor}">${costPct}%</strong>
                         </div>
                         ` : ''}
                    </div>
                    <!-- Right Column -->
                    <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-end; font-size: 12px;">
                         <div style="font-weight: bold; color: ${deltaColor}; font-size: 14px;">Uplift: ${deltaSign}${delta}%</div>
                         <div style="white-space: nowrap;">Guided: ${Math.round(gVal)}%</div>
                         <div style="white-space: nowrap;">Unguided: ${Math.round(uVal)}%</div>
                    </div>
                </div>
            `;
          };
          
          hitArea.onmouseleave = () => { if (this.tooltip) this.tooltip.style.display = 'none'; };
          if (guidedSet.onClick) {
              hitArea.onclick = () => guidedSet.onClick(item.originalIndex, 'Guided');
          }
          this.svg.appendChild(hitArea);
      });

      currentY += rowHeight; // Shift Y down for the next feature row
    });
    
    return height; // Return height so parent can use it to avoid cutting things off!
  }
}
