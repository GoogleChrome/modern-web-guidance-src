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
      this.tooltip.className = 'radar-tooltip';
      document.body.appendChild(this.tooltip);
    }
  }

  render(data) {
    this.init();

    const labels = data.labels || [];
    const datasets = data.datasets || [];
    
    if (labels.length === 0) return;

    let unguidedSet = datasets.find(d => d.label.toLowerCase() === 'unguided') || { data: new Array(labels.length).fill(0) };
    let guidedSet = datasets.find(d => d.label.toLowerCase() === 'guided') || { data: new Array(labels.length).fill(0) };

    const width = this.options.size;
    const height = Math.max(250, this.options.margin.top + (labels.length * this.options.rowHeight) + this.options.margin.bottom);

    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", height);
    this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    this.svg.style.display = "block";
    this.svg.style.fontFamily = "inherit";
    this.container.appendChild(this.svg);

    const chartWidth = width - this.options.margin.left - this.options.margin.right;
    const leftAxis = this.options.margin.left;
    const scale = (val) => leftAxis + (val / 100) * chartWidth;

    // Title
    if (this.options.title) {
        const titleText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        titleText.setAttribute("x", width / 2);
        titleText.setAttribute("y", 20);
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
      legendG.setAttribute("transform", `translate(${leftAxis}, 20)`);
      
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
      guidedCircle.setAttribute("fill", "#238636");

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
        tick.setAttribute("x1", x);
        tick.setAttribute("y1", topAxisY);
        tick.setAttribute("x2", x);
        tick.setAttribute("y2", bottomAxisY);
        tick.setAttribute("stroke", val === 0 || val === 100 ? "rgba(255, 255, 255, 0.3)" : "rgba(255, 255, 255, 0.1)");
        tick.setAttribute("stroke-width", "1");
        if (val !== 0 && val !== 100) tick.setAttribute("stroke-dasharray", "4 4");
        this.svg.appendChild(tick);
        
        const tickText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        tickText.setAttribute("x", x);
        tickText.setAttribute("y", bottomAxisY + 20);
        tickText.setAttribute("fill", "rgba(255, 255, 255, 0.6)");
        tickText.setAttribute("font-size", "10");
        tickText.setAttribute("text-anchor", "middle");
        tickText.textContent = val + "%";
        this.svg.appendChild(tickText);
      });
    }

    // Data Rows
    labels.forEach((label, i) => {
      let useCaseId = label;
      const match = label.match(/\(([^)]+)\)$/);
      if (match) useCaseId = match[1];

      const y = this.options.margin.top + (i * this.options.rowHeight) + (this.options.rowHeight / 2);

      const uVal = unguidedSet.data[i] || 0;
      const gVal = guidedSet.data[i] || 0;
      const uX = scale(uVal);
      const gX = scale(gVal);

      // Label text
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", leftAxis - 10);
      text.setAttribute("y", y);
      text.setAttribute("fill", "#c9d1d9");
      text.setAttribute("font-size", "12");
      text.setAttribute("text-anchor", "end");
      text.setAttribute("alignment-baseline", "middle");
      text.textContent = useCaseId;
      this.svg.appendChild(text);

      // Connecting Line (The Delta)
      const isPositive = gVal >= uVal;
      const lineColor = isPositive ? "#238636" : "#da3633"; // Green if positive, Red if negative
      
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", uX);
      line.setAttribute("y1", y);
      line.setAttribute("x2", gX);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", lineColor);
      line.setAttribute("stroke-width", "4");
      line.setAttribute("stroke-linecap", "round");
      this.svg.appendChild(line);

      // To make it an "arrow", draw a triangle at the end
      if (Math.abs(gX - uX) > 5) {
        const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        // simple arrowhead
        const dir = gX > uX ? -1 : 1;
        poly.setAttribute("points", `${gX},${y} ${gX + (5 * dir)},${y - 4} ${gX + (5 * dir)},${y + 4}`);
        poly.setAttribute("fill", lineColor);
        this.svg.appendChild(poly);
      }

      // Unguided Dot (Baseline)
      const uDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      uDot.setAttribute("cx", uX);
      uDot.setAttribute("cy", y);
      uDot.setAttribute("r", "5");
      uDot.setAttribute("fill", "#161b22"); // match bg so it's hollow
      uDot.setAttribute("stroke", "#8b949e"); // grey baseline
      uDot.setAttribute("stroke-width", "2");
      this.svg.appendChild(uDot);

      // Guided Dot (Outcome)
      const gDot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      gDot.setAttribute("cx", gX);
      gDot.setAttribute("cy", y);
      gDot.setAttribute("r", "5");
      gDot.setAttribute("fill", lineColor);
      this.svg.appendChild(gDot);

      // Hit area for tooltip
      const hitArea = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      hitArea.setAttribute("x", 0);
      hitArea.setAttribute("y", y - this.options.rowHeight / 2);
      hitArea.setAttribute("width", width);
      hitArea.setAttribute("height", this.options.rowHeight);
      hitArea.setAttribute("fill", "transparent");
      
      hitArea.onmousemove = (e) => {
        if (!this.tooltip) return;
        const delta = Math.round(gVal - uVal);
        const deltaColor = delta >= 0 ? "#7ee787" : "#ffa198";
        const deltaSign = delta > 0 ? "+" : "";
        
        this.tooltip.style.display = 'block';
        this.tooltip.style.left = (e.clientX + 15) + 'px';
        this.tooltip.style.top = (e.clientY + 15) + 'px';
        this.tooltip.innerHTML = `
            <div style="color: #fff; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${useCaseId}</div>
            <div style="margin-bottom: 6px; font-size: 14px;"><strong>Delta: </strong><span style="color: ${deltaColor}; font-weight: bold;">${deltaSign}${delta}%</span></div>
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; font-size: 12px; color: #8b949e;">
                <span>Unguided: ${Math.round(uVal)}%</span>
                <span>Guided: ${Math.round(gVal)}%</span>
            </div>
        `;
      };
      
      hitArea.onmouseleave = () => { if (this.tooltip) this.tooltip.style.display = 'none'; };
      if (guidedSet.onClick) {
          hitArea.style.cursor = "pointer";
          hitArea.onclick = () => guidedSet.onClick(i, 'Guided');
      }
      this.svg.appendChild(hitArea);
    });
  }
}
