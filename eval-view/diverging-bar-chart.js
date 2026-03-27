export class DivergingBarChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      size: options.size || 600,
      rowHeight: options.rowHeight || 30,
      margin: options.margin || { top: 30, right: 30, bottom: 30, left: 160 },
      hideLegend: options.hideLegend || false,
      hideAxes: options.hideAxes || false,
      ...options
    };

    // Make container scrollable if content overflows vertically
    this.container.style.overflowY = "auto";
    this.container.style.overflowX = "hidden";
    // Avoid restricting height strictly if we want the SVG to expand, or use fixed size
    this.init();
  }

  init() {
    this.container.innerHTML = '';
    // Tooltip setup
    this.tooltip = document.getElementById('diverging-tooltip');
    if (!this.tooltip && document.body) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'diverging-tooltip';
      this.tooltip.className = 'radar-tooltip'; // Reuse same styling as radar tooltip
      document.body.appendChild(this.tooltip);
    }
  }

  render(data) {
    this.init();

    const labels = data.labels || [];
    const datasets = data.datasets || [];
    
    if (labels.length === 0) return;

    // determine unguided vs guided
    let unguidedSet = datasets.find(d => d.label.toLowerCase() === 'unguided');
    let guidedSet = datasets.find(d => d.label.toLowerCase() === 'guided');
    
    if (!unguidedSet) unguidedSet = { data: new Array(labels.length).fill(0), backgroundColor: '#da3633', borderColor: '#da3633' };
    if (!guidedSet) guidedSet = { data: new Array(labels.length).fill(0), backgroundColor: '#238636', borderColor: '#238636' };

    const width = this.options.size;
    const height = Math.max(300, this.options.margin.top + (labels.length * this.options.rowHeight) + this.options.margin.bottom);

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    // Set a minimum height, or let it grow based on items
    this.svg.setAttribute("height", height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.style.display = "block";
    this.svg.style.fontFamily = "inherit";
    this.container.appendChild(this.svg);

    const chartWidth = width - this.options.margin.left - this.options.margin.right;
    const center = this.options.margin.left + (chartWidth / 2);
    // scale from 0 to 100 maps to 0 to chartWidth/2
    const scale = (val) => (val / 100) * (chartWidth / 2);

    // Legend
    if (!this.options.hideLegend) {
      const legendG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      legendG.setAttribute("transform", `translate(${center - 80}, 15)`);
      
      // Unguided legend
      const uRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      uRect.setAttribute("width", "14");
      uRect.setAttribute("height", "14");
      uRect.setAttribute("y", "-12");
      uRect.setAttribute("fill", unguidedSet.backgroundColor);
      uRect.setAttribute("stroke", unguidedSet.borderColor);
      
      const uText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      uText.setAttribute("x", "20");
      uText.setAttribute("fill", "#c9d1d9");
      uText.setAttribute("font-size", "12");
      uText.setAttribute("font-weight", "500");
      uText.textContent = unguidedSet.label || "Unguided";
      
      // Guided legend
      const gRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      gRect.setAttribute("width", "14");
      gRect.setAttribute("height", "14");
      gRect.setAttribute("x", "85");
      gRect.setAttribute("y", "-12");
      gRect.setAttribute("fill", guidedSet.backgroundColor);
      gRect.setAttribute("stroke", guidedSet.borderColor);
      
      const gText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      gText.setAttribute("x", "105");
      gText.setAttribute("fill", "#c9d1d9");
      gText.setAttribute("font-size", "12");
      gText.setAttribute("font-weight", "500");
      gText.textContent = guidedSet.label || "Guided";

      legendG.appendChild(uRect);
      legendG.appendChild(uText);
      legendG.appendChild(gRect);
      legendG.appendChild(gText);
      this.svg.appendChild(legendG);
    }

    // Axes
    if (!this.options.hideAxes) {
      const topAxisY = this.options.margin.top;
      const bottomAxisY = height - this.options.margin.bottom;
      
      // Zero line
      const zeroLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      zeroLine.setAttribute("x1", center);
      zeroLine.setAttribute("y1", topAxisY - 5);
      zeroLine.setAttribute("x2", center);
      zeroLine.setAttribute("y2", bottomAxisY + 5);
      zeroLine.setAttribute("stroke", "rgba(255, 255, 255, 0.4)");
      zeroLine.setAttribute("stroke-width", "2");
      zeroLine.setAttribute("stroke-dasharray", "4 4");
      this.svg.appendChild(zeroLine);

      // Ticks (-100, -50, 0, 50, 100)
      [-100, -50, 0, 50, 100].forEach(val => {
        const x = center + (val < 0 ? -scale(Math.abs(val)) : scale(val));
        const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
        tick.setAttribute("x1", x);
        tick.setAttribute("y1", topAxisY);
        tick.setAttribute("x2", x);
        tick.setAttribute("y2", bottomAxisY);
        tick.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
        tick.setAttribute("stroke-width", "1");
        this.svg.appendChild(tick);
        
        // Tick label
        const tickText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tickText.setAttribute("x", x);
        tickText.setAttribute("y", bottomAxisY + 15);
        tickText.setAttribute("fill", "rgba(255, 255, 255, 0.5)");
        tickText.setAttribute("font-size", "10");
        tickText.setAttribute("text-anchor", "middle");
        tickText.textContent = Math.abs(val) + "%";
        this.svg.appendChild(tickText);
      });
    }

    // Bars
    labels.forEach((label, i) => {
      let useCaseId = label;
      const match = label.match(/\(([^)]+)\)$/);
      if (match) {
        useCaseId = match[1];
      }

      const y = this.options.margin.top + (i * this.options.rowHeight) + (this.options.rowHeight / 2);
      const barHeight = this.options.rowHeight * 0.6;
      const barY = y - barHeight / 2;

      const uVal = unguidedSet.data[i] || 0;
      const gVal = guidedSet.data[i] || 0;
      const uWidth = scale(uVal);

      // Label text
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", center - uWidth - 10);
      text.setAttribute("y", y);
      text.setAttribute("fill", "#c9d1d9");
      text.setAttribute("font-size", "12");
      text.setAttribute("font-weight", "500");
      text.setAttribute("text-anchor", "end");
      text.setAttribute("alignment-baseline", "middle");
      text.textContent = useCaseId;
      
      text.style.cursor = "pointer";
      text.onmouseover = () => { text.setAttribute("fill", "#fff"); text.setAttribute("font-weight", "bold"); };
      text.onmouseout = () => { text.setAttribute("fill", "#c9d1d9"); text.setAttribute("font-weight", "500"); };
      if (guidedSet.onClick) {
        text.onclick = () => guidedSet.onClick(i, 'Guided');
      }

      this.svg.appendChild(text);

      // uVal, gVal, uWidth already defined above
      const uBar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      uBar.setAttribute("x", center - uWidth);
      uBar.setAttribute("y", barY);
      uBar.setAttribute("width", uWidth);
      uBar.setAttribute("height", barHeight);
      uBar.setAttribute("fill", unguidedSet.backgroundColor);
      uBar.setAttribute("stroke", unguidedSet.borderColor);
      uBar.setAttribute("rx", "2"); // subtle rounding
      uBar.style.cursor = "pointer";
      uBar.innerHTML = `<animate attributeName="width" from="0" to="${uWidth}" dur="0.4s" />`;
      if (unguidedSet.onClick) {
        uBar.onclick = (e) => { e.stopPropagation(); unguidedSet.onClick(i, unguidedSet.label); };
      }
      this.svg.appendChild(uBar);

      // Guided bar (Right)
      const gWidth = scale(gVal);
      const gBar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      gBar.setAttribute("x", center);
      gBar.setAttribute("y", barY);
      gBar.setAttribute("width", gWidth);
      gBar.setAttribute("height", barHeight);
      gBar.setAttribute("fill", guidedSet.backgroundColor);
      gBar.setAttribute("stroke", guidedSet.borderColor);
      gBar.setAttribute("rx", "2");
      gBar.style.cursor = "pointer";
      gBar.innerHTML = `<animate attributeName="width" from="0" to="${gWidth}" dur="0.4s" />`;
      if (guidedSet.onClick) {
        gBar.onclick = (e) => { e.stopPropagation(); guidedSet.onClick(i, guidedSet.label); };
      }
      this.svg.appendChild(gBar);

      // Add hit area for tooltip over the whole row
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("x", 0);
      hitArea.setAttribute("y", barY - 2);
      hitArea.setAttribute("width", width);
      hitArea.setAttribute("height", barHeight + 4);
      hitArea.setAttribute("fill", "transparent");
      
      const showTooltip = (e) => {
        if (!this.tooltip) return;
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (e.clientX + 15) + 'px';
        this.tooltip.style.top = (e.clientY + 15) + 'px';
        this.tooltip.innerHTML = `
            <div style="color: #fff; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${label}</div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 4px;">
                <span style="color: ${unguidedSet.borderColor}; font-size: 12px;">Unguided:</span>
                <span style="font-weight: bold; font-size: 14px;">${Math.round(uVal)}%</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 4px;">
                <span style="color: ${guidedSet.borderColor}; font-size: 12px;">Guided:</span>
                <span style="font-weight: bold; font-size: 14px;">${Math.round(gVal)}%</span>
            </div>
        `;
      };
      
      const hideTooltip = () => {
        if (this.tooltip) {
          this.tooltip.style.display = 'none';
        }
      };

      hitArea.onmousemove = showTooltip;
      hitArea.onmouseleave = hideTooltip;
      
      this.svg.appendChild(hitArea);
    });
  }
}
