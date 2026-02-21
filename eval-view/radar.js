/**
 * Custom Radar Chart implementation using SVG.
 * Lightweight, dependency-free, and styled for the Spike Eval Dashboard.
 */
export class RadarChart {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      size: options.size || 500,
      padding: options.padding || 60,
      levels: options.levels || 5,
      maxValue: options.maxValue || 100,
      ...options
    };

    this.init();
  }

  init() {
    this.container.innerHTML = '';
    this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("width", "100%");
    this.svg.setAttribute("height", "100%");
    this.svg.setAttribute("viewBox", `0 0 ${this.options.size} ${this.options.size}`);
    this.svg.style.overflow = "visible";
    this.container.appendChild(this.svg);

    this.center = this.options.size / 2;
    this.centerY = (this.options.size / 2) + 20; // Shift down slightly
    this.radius = (this.options.size / 2) - (this.options.padding + 20); // More padding

    // Tooltip setup
    this.tooltip = document.getElementById('radar-tooltip');
    if (!this.tooltip) {
      this.tooltip = document.createElement('div');
      this.tooltip.id = 'radar-tooltip';
      this.tooltip.className = 'radar-tooltip';
      document.body.appendChild(this.tooltip);
    }
  }

  render(data) {
    this.init(); // Clear and re-init

    const labels = data.labels;
    const datasets = data.datasets;
    const totalAxes = labels.length;
    const angleSlice = (Math.PI * 2) / totalAxes;

    // 1. Draw Background Levels (Concentric Polygons)
    for (let level = 1; level <= this.options.levels; level++) {
      const levelRadius = (this.radius / this.options.levels) * level;
      const points = [];
      for (let i = 0; i < totalAxes; i++) {
        const x = this.center + levelRadius * Math.cos(angleSlice * i - Math.PI / 2);
        const y = this.centerY + levelRadius * Math.sin(angleSlice * i - Math.PI / 2);
        points.push(`${x},${y}`);
      }

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", points.join(" "));
      polygon.setAttribute("fill", "none");
      polygon.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
      polygon.setAttribute("stroke-width", "1");
      this.svg.appendChild(polygon);

      // Level labels
      const labelText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      labelText.setAttribute("x", this.center + 5);
      labelText.setAttribute("y", this.centerY - levelRadius + 4);
      labelText.setAttribute("fill", "rgba(255, 255, 255, 0.3)");
      labelText.setAttribute("font-size", "10");
      labelText.textContent = Math.round((this.options.maxValue / this.options.levels) * level);
      this.svg.appendChild(labelText);
    }

    // 2. Draw Axes
    labels.forEach((label, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = this.center + this.radius * Math.cos(angle);
      const y = this.centerY + this.radius * Math.sin(angle);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", this.center);
      line.setAttribute("y1", this.centerY);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "rgba(255, 255, 255, 0.1)");
      line.setAttribute("stroke-width", "1");
      this.svg.appendChild(line);

      // Axis labels with smart positioning
      const labelOffset = 30; // Slightly reduced to avoid edges
      const labelX = this.center + (this.radius + labelOffset) * Math.cos(angle);
      const labelY = this.centerY + (this.radius + labelOffset) * Math.sin(angle);

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", labelX);
      text.setAttribute("y", labelY);

      // Smart alignment based on angle
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      if (Math.abs(cos) < 0.1) {
        text.setAttribute("text-anchor", "middle");
      } else if (cos > 0) {
        text.setAttribute("text-anchor", "start");
      } else {
        text.setAttribute("text-anchor", "end");
      }

      if (Math.abs(sin) < 0.1) {
        text.setAttribute("alignment-baseline", "middle");
      } else if (sin > 0) {
        text.setAttribute("alignment-baseline", "hanging");
      } else {
        text.setAttribute("alignment-baseline", "baseline");
      }

      text.setAttribute("fill", "#c9d1d9");
      text.setAttribute("font-size", "11"); // Slightly smaller
      text.setAttribute("font-weight", "500");
      text.textContent = label;

      text.onmouseover = () => {
        text.setAttribute("fill", "#fff");
        text.style.filter = "drop-shadow(0 0 4px rgba(255,255,255,0.4))";
      };
      text.onmouseout = () => {
        text.setAttribute("fill", "#c9d1d9");
        text.style.filter = "none";
      };

      text.onclick = () => {
        const guidedSet = datasets.find(d => d.label === 'Guided');
        if (guidedSet && guidedSet.onClick) {
          guidedSet.onClick(i, 'Guided');
        }
      };

      this.svg.appendChild(text);
    });

    // 3. Draw All Polygons First
    datasets.forEach(set => {
      const points = [];
      set.data.forEach((val, i) => {
        const r = (val / this.options.maxValue) * this.radius;
        const x = this.center + r * Math.cos(angleSlice * i - Math.PI / 2);
        const y = this.centerY + r * Math.sin(angleSlice * i - Math.PI / 2);
        points.push(`${x},${y}`);
      });

      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", points.join(" "));
      polygon.setAttribute("fill", set.backgroundColor);
      polygon.setAttribute("stroke", set.borderColor);
      polygon.setAttribute("stroke-width", "2");
      polygon.style.pointerEvents = "none"; // Don't block points
      polygon.innerHTML = `<animate attributeName="opacity" from="0" to="1" dur="0.5s" />`;
      this.svg.appendChild(polygon);
    });

    // 4. Draw Highlights & Points
    const axisDots = [];

    for (let i = 0; i < totalAxes; i++) {
      const angle = angleSlice * i - Math.PI / 2;
      const currentDots = [];
      axisDots.push(currentDots);

      datasets.forEach((set) => {
        const val = set.data[i];
        const r = (val / this.options.maxValue) * this.radius;
        const x = this.center + r * Math.cos(angle);
        const y = this.centerY + r * Math.sin(angle);

        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circle.setAttribute("cx", x);
        circle.setAttribute("cy", y);
        circle.setAttribute("r", "5");
        circle.setAttribute("fill", "#fff");
        circle.setAttribute("stroke", set.borderColor);
        circle.setAttribute("stroke-width", "2");
        circle.style.pointerEvents = "auto";

        if (set.onClick) {
          circle.onclick = (e) => {
            e.stopPropagation();
            set.onClick(i, set.label);
          };
        }

        currentDots.push({ element: circle, x, y, val, label: set.label, color: set.borderColor, onClick: set.onClick });
        this.svg.appendChild(circle);
      });
    }

    // Global Interaction Tracker (Radial Wedge Snap) for Tooltips
    const handleInteraction = (e) => {
      const rect = this.svg.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * this.options.size;
      const mouseY = ((e.clientY - rect.top) / rect.height) * this.options.size;

      const dx = mouseX - this.center;
      const dy = mouseY - this.centerY;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);

      // Tooltip distance threshold
      if (distFromCenter > this.radius + 60 || distFromCenter < 20) {
        hideTooltip();
        return;
      }

      let angle = Math.atan2(dy, dx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;

      const axisIndex = Math.round(angle / angleSlice) % totalAxes;
      showTooltip(axisIndex, e.clientX, e.clientY);
    };

    const showTooltip = (axisIndex, clientX, clientY) => {
      // Reset and highlight active axis dots
      axisDots.forEach((dots, i) => dots.forEach(d => {
        const isActive = i === axisIndex;
        d.element.setAttribute("r", isActive ? "7" : "5");
        d.element.setAttribute("stroke-width", isActive ? "3" : "2");
      }));

      this.tooltip.style.display = 'block';
      this.tooltip.style.left = (clientX + 15) + 'px';
      this.tooltip.style.top = (clientY + 15) + 'px';

      let content = `<div style="color: #fff; font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">${labels[axisIndex]}</div>`;

      datasets.forEach((set) => {
        const val = set.data[axisIndex];
        content += `
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 4px;">
                    <span style="color: ${set.borderColor}; font-size: 12px;">${set.label}:</span>
                    <span style="font-weight: bold; font-size: 14px;">${Math.round(val)}%</span>
                </div>
            `;
      });
      this.tooltip.innerHTML = content;
    };

    const hideTooltip = () => {
      axisDots.forEach(dots => dots.forEach(d => {
        d.element.setAttribute("r", "5");
        d.element.setAttribute("stroke-width", "2");
      }));
      this.tooltip.style.display = 'none';
    };

    this.svg.onmousemove = handleInteraction;
    this.svg.onmouseleave = hideTooltip;

    this.renderLegend(datasets);
  }

  renderLegend(datasets) {
    const legendG = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Horizontal centering logic for legend
    const itemWidth = 150;
    const approxItemWidth = 100; // Visual width of rect + text
    const totalWidth = (datasets.length - 1) * itemWidth + approxItemWidth;
    legendG.setAttribute("transform", `translate(${this.center - (totalWidth / 2)}, 10)`);

    datasets.forEach((set, i) => {
      const itemG = document.createElementNS("http://www.w3.org/2000/svg", "g");
      itemG.setAttribute("transform", `translate(${i * itemWidth}, 0)`);
      itemG.setAttribute("class", "radar-legend-item");

      // Outlined rectangle matching Chart.js legend style
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("width", "36");
      rect.setAttribute("height", "14");
      rect.setAttribute("fill", set.backgroundColor);
      rect.setAttribute("stroke", set.borderColor);
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("rx", "2");

      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", "44");
      text.setAttribute("y", "12");
      text.setAttribute("fill", "#c9d1d9");
      text.setAttribute("font-size", "13");
      text.setAttribute("font-weight", "500");
      text.textContent = set.label;

      itemG.appendChild(rect);
      itemG.appendChild(text);
      legendG.appendChild(itemG);
    });

    this.svg.appendChild(legendG);
  }
}
