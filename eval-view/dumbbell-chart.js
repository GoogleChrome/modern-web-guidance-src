export class DumbbellChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      size: options.size || 600,
      rowHeight: options.rowHeight || 30,
      margin: options.margin || { top: 40, right: 30, bottom: 40, left: 200 },
      hideLegend: options.hideLegend || false,
      hideAxes: options.hideAxes || false,
      title: options.title || '',
      hideZeros: options.hideZeros || false,
      height: options.height || null,
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
    this.init();

    const labels = data.labels || [];
    const datasets = data.datasets || [];
    
    if (labels.length === 0) return;

    let unguidedSet = datasets.find(d => d.label.toLowerCase() === 'unguided') || { data: Array.from({ length: labels.length }).fill(0) };
    let guidedSet = datasets.find(d => d.label.toLowerCase() === 'guided') || { data: Array.from({ length: labels.length }).fill(0) };

    const width = this.options.size;

    // Group items by Feature Name (lookup from features_mapping.gen.js if available)
    const groups = {};
    const featuresMap = window.__featuresMapping || {};

    labels.forEach((label, i) => {
        let appName = label;
        let useCaseId = "";
        const match = label.match(/^(.*) \(([^)]+)\)$/);
        if (match) {
            appName = match[1];
            useCaseId = match[2];
        } else {
            const parts = label.split(' - ');
            if (parts.length >= 2) {
                appName = parts[0];
                useCaseId = parts.slice(1).join(' - ');
            }
        }

        const usecaseFolder = appName.replace(/-task$/, '');
        let featureName = appName; // fallback to task name if not found
        if (featuresMap[usecaseFolder] && featuresMap[usecaseFolder].length > 0) {
            featureName = featuresMap[usecaseFolder][0]; // take primary feature
        }

        const uVal = unguidedSet.data[i] || 0;
        const gVal = guidedSet.data[i] || 0;
        
        if (this.options.hideZeros && uVal === 0 && gVal === 0) return;

        if (!groups[featureName]) groups[featureName] = [];
        groups[featureName].push({
            useCaseId,
            uVal,
            gVal,
            originalIndex: i
        });
    });

    const featureNames = Object.keys(groups).sort();
    
    // Calculate total height dynamically based on the number of stacked dumbbells per feature
    let totalHeight = this.options.margin.top;
    featureNames.forEach(f => {
        const count = groups[f].length;
        totalHeight += this.options.rowHeight + (count - 1) * 10; // upgrade to 10px spacing
    });
    totalHeight += this.options.margin.bottom;

    const height = totalHeight;

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", this.options.height || height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // If fixed height is forced, we want it to stretch to fill it!
    this.svg.setAttribute("preserveAspectRatio", this.options.height ? "none" : "xMidYMin meet");
    
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
    this.svg.appendChild(defs);
    this.svg.style.display = "block";
    this.svg.style.fontFamily = "inherit";
    this.container.appendChild(this.svg);

    const chartWidth = width - this.options.margin.left - this.options.margin.right;
    const leftAxis = this.options.margin.left;
    const scale = (val) => leftAxis + (val / 100) * chartWidth;

    // Title
    if (this.options.title) {
        const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        titleText.setAttribute("x", (width / 2).toString());
        titleText.setAttribute("y", "20");
        titleText.setAttribute("fill", "#c9d1d9");
        titleText.setAttribute("font-size", "14");
        titleText.setAttribute("font-weight", "bold");
        titleText.setAttribute("text-anchor", "middle");
        titleText.textContent = this.options.title;
        this.svg.appendChild(titleText);
    }

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
      uText.setAttribute("fill", "#c9d1d9");
      uText.setAttribute("font-size", "12");
      uText.textContent = "Unguided";
      
      const guidedCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      guidedCircle.setAttribute("cx", "80");
      guidedCircle.setAttribute("cy", "-5");
      guidedCircle.setAttribute("r", "5");
      guidedCircle.setAttribute("fill", "oklch(65% 0.25 290)");

      const gText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      gText.setAttribute("x", "90");
      gText.setAttribute("fill", "#c9d1d9");
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
        tick.setAttribute("stroke", val === 0 || val === 100 ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)");
        tick.setAttribute("stroke-width", "1");
        if (val !== 0 && val !== 100) tick.setAttribute("stroke-dasharray", "4 4");
        this.svg.appendChild(tick);
        
        const tickText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tickText.setAttribute("x", x.toString());
        tickText.setAttribute("y", (bottomAxisY + 20).toString());
        tickText.setAttribute("fill", "rgba(255, 255, 255, 0.6)");
        tickText.setAttribute("font-size", "10");
        tickText.setAttribute("text-anchor", "middle");
        tickText.textContent = val + "%";
        this.svg.appendChild(tickText);
      });
    }

    // Use case colors/shades with gradients
    // We specify start and end colors so we can create a unique gradient per dumbbell that stretches perfectly!
    const useCaseColors = [
        { start: "oklch(65% 0.25 290)", end: "oklch(75% 0.15 210)", unguided: "rgba(255, 255, 255, 0.4)" }, // Violet to Cyan
        { start: "oklch(60% 0.28 320)", end: "oklch(70% 0.20 280)", unguided: "rgba(255, 255, 255, 0.4)" }, // Magenta to Lavender
        { start: "oklch(55% 0.25 295)", end: "oklch(65% 0.20 310)", unguided: "rgba(255, 255, 255, 0.4)" }, // Vivid Grape to Orchid
        { start: "oklch(70% 0.20 280)", end: "oklch(75% 0.15 270)", unguided: "rgba(255, 255, 255, 0.4)" }  // Lavender to Periwinkle
    ];

    // Data Rows
    let currentY = this.options.margin.top;

    featureNames.forEach((featureName, rowIndex) => {
      const items = groups[featureName];
      const rowHeight = this.options.rowHeight + (items.length - 1) * 10;
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
      if (!this.options.hideLabels) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", scale(100) + 15);
        text.setAttribute("y", rowY);
        text.setAttribute("fill", "#c9d1d9");
        text.setAttribute("font-size", "13");
        text.setAttribute("text-anchor", "start");
        text.setAttribute("alignment-baseline", "middle");
        text.textContent = featureName;
        this.svg.appendChild(text);
      }

      const offsetStep = 10;
      const startOffset = -((items.length - 1) / 2) * offsetStep;

      items.forEach((item, itemIndex) => {
          const y = rowY + startOffset + (itemIndex * offsetStep);
          const uVal = item.uVal;
          const gVal = item.gVal;
          const uX = scale(uVal);
          const gX = scale(gVal);

          const colorPalette = useCaseColors[itemIndex % useCaseColors.length];
          const isPositive = gVal >= uVal;
          
          // Create a dynamic linear gradient for EACH dumbbell so it stretches across its specific length!
          const gradId = `dumbbell-grad-${rowIndex}-${itemIndex}`;
          const linearGrad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
          linearGrad.setAttribute("id", gradId);
          linearGrad.setAttribute("gradientUnits", "userSpaceOnUse");
          // Set endpoints to the actual dumbbell coordinates so the gradient stretches!
          linearGrad.setAttribute("x1", uX);
          linearGrad.setAttribute("y1", y);
          linearGrad.setAttribute("x2", gX);
          linearGrad.setAttribute("y2", y);

          const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
          stop1.setAttribute("offset", "0%");
          stop1.setAttribute("stop-color", colorPalette.start);

          const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
          stop2.setAttribute("offset", "100%");
          stop2.setAttribute("stop-color", colorPalette.end);

          linearGrad.appendChild(stop1);
          linearGrad.appendChild(stop2);
          
          const defs = this.svg.querySelector('defs') || document.createElementNS("http://www.w3.org/2000/svg", "defs");
          if (!defs.parentNode) this.svg.prepend(defs);
          defs.appendChild(linearGrad);

          const dir = gX > uX ? -1 : 1;
          const canDrawArrow = Math.abs(gX - uX) > 15; // increased threshold a bit
          const arrowOffset =canDrawArrow ? 4 : 0;
          const lineEndX = gX + (arrowOffset * dir);

          const lineColor = isPositive ? `url(#${gradId})` : "#da3633"; // Fall back to red if regressed

          // Connecting Line (The Delta)
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", uX);
          line.setAttribute("y1", y);
          line.setAttribute("x2", canDrawArrow ? (lineEndX + (arrowOffset * dir)) : lineEndX);
          line.setAttribute("y2", y);
          line.setAttribute("stroke", lineColor);
          line.setAttribute("stroke-width", "3"); // slightly thinner to fit multiple
          line.setAttribute("stroke-linecap", "round");
          this.svg.appendChild(line);

          // To make it an "arrow", draw a triangle at the end - offset to sit clean of the dot
          if (canDrawArrow) {
            const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const arrowEndX = lineEndX; // Line stops where arrow head begins!
            poly.setAttribute("points", `${arrowEndX},${y} ${arrowEndX + (7 * dir)},${y - 3.5} ${arrowEndX + (7 * dir)},${y + 3.5}`);
            poly.setAttribute("fill", colorPalette.end); 
            this.svg.appendChild(poly);
          }

          // Unguided Dot (Baseline)
          const uDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          uDot.setAttribute("cx", uX);
          uDot.setAttribute("cy", y);
          uDot.setAttribute("r", "3");
          uDot.setAttribute("fill", "#161b22");
          uDot.setAttribute("stroke", colorPalette.unguided);
          uDot.setAttribute("stroke-width", "1.5");
          this.svg.appendChild(uDot);

          // Guided Dot (Outcome)
          const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          gDot.setAttribute("cx", gX);
          gDot.setAttribute("cy", y);
          gDot.setAttribute("r", "3");
          gDot.setAttribute("fill", lineColor);
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
            const deltaColor = delta >= 0 ? "#7ee787" : "#ffa198";
            const deltaSign = delta > 0 ? "+" : "";
            
            this.tooltip.style.display = 'block';
            this.tooltip.style.left = (e.clientX + 15) + 'px';
            this.tooltip.style.top = (e.clientY + 15) + 'px';
            this.tooltip.innerHTML = `
                <div style="display: flex; gap: 24px; align-items: flex-start; justify-content: space-between; min-width: 250px;">
                    <!-- Left Column -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                         <div style="color: #fff; font-weight: bold; font-size: 14px; white-space: nowrap;">${item.useCaseId || "Default"}</div>
                         <div style="font-size: 11px; color: #8b949e;">feature: ${featureName}</div>
                    </div>
                    <!-- Right Column -->
                    <div style="display: flex; flex-direction: column; gap: 2px; align-items: flex-end; font-size: 12px;">
                         <div style="font-weight: bold; color: ${deltaColor}; font-size: 14px;">Uplift: ${deltaSign}${delta}%</div>
                         <div style="color: #8b949e; white-space: nowrap;">Guided: ${Math.round(gVal)}%</div>
                         <div style="color: #8b949e; white-space: nowrap;">Unguided: ${Math.round(uVal)}%</div>
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
