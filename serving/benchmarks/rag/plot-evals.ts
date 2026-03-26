import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const resultsPath = path.resolve(__dirname, '../data/eval-results.json');
const outputPath = path.resolve(__dirname, '../data/eval-plot.html');

if (!fs.existsSync(resultsPath)) {
  console.error(`Results file not found at ${resultsPath}`);
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(resultsPath, 'utf8'));

// Group and aggregate by model
const models = [...new Set(data.map((d: any) => d.model))];

const aggregated = models.map((model: any) => {
  const modelData = data.filter((d: any) => d.model === model);
  const count = modelData.length;
  
  return {
    model,
    iterations: count,
    avgTop1: modelData.reduce((acc: number, d: any) => acc + d.top1HitRate, 0) / count,
    avgTop3: modelData.reduce((acc: number, d: any) => acc + d.top3HitRate, 0) / count,
    avgMRR: modelData.reduce((acc: number, d: any) => acc + d.meanReciprocalRank, 0) / count,
    totalQueries: modelData.reduce((acc: number, d: any) => acc + d.totalQueries, 0)
  };
});

console.log('\n--- Aggregated Evaluation Results (Averages) ---\n');
console.table(aggregated.map(d => ({
  Model: d.model,
  'Avg Top-1': (d.avgTop1 * 100).toFixed(1) + '%',
  'Avg Top-3': (d.avgTop3 * 100).toFixed(1) + '%',
  'Avg MRR': d.avgMRR.toFixed(3),
  'Iter': d.iterations
})));

const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Model Performance Distribution</title>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <style>
        body { font-family: -apple-system, system-ui, sans-serif; padding: 40px; background: #f8f9fa; color: #212529; }
        .chart-container { max-width: 1000px; margin: 0 auto 40px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        h1 { text-align: center; margin-bottom: 40px; }
        .error-banner { display: none; background: #dc3545; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; text-align: center; font-weight: bold; }
    </style>
</head>
<body>
    <div id="cors-banner" class="error-banner">
        ⚠️ CORS Error: Cannot fetch local JSON file when opening via file:// protocol. <br>
        Please run <code>npm run plot:serve</code> to view this chart correctly.
    </div>
    
    <h1>Model Performance Distribution (Scatter Box Plot)</h1>
    
    <div id="top1Plot" class="chart-container"></div>
    <div id="mrrPlot" class="chart-container"></div>

    <script>
        async function renderPlots() {
            try {
                const response = await fetch('./eval-results.json');
                if (!response.ok) throw new Error('Failed to fetch data');
                const data = await response.json();
                
                const models = [...new Set(data.map(d => d.model))];
                
                function createBoxPlot(metric, elementId, title) {
                    const traces = models.map(model => {
                        const values = data.filter(d => d.model === model).map(d => d[metric]);
                        return {
                            y: values,
                            name: model,
                            type: 'box',
                            boxpoints: 'all',
                            jitter: 0.3,
                            pointpos: -1.8,
                            marker: { size: 4 },
                            line: { width: 2 }
                        };
                    });

                    const layout = {
                        title: title,
                        yaxis: { title: 'Score', range: [Math.min(...data.map(d => d[metric])) * 0.95, 1.01] },
                        showlegend: false,
                        paper_bgcolor: 'rgba(0,0,0,0)',
                        plot_bgcolor: 'rgba(0,0,0,0)',
                        margin: { t: 50, b: 150, l: 60, r: 30 }
                    };

                    Plotly.newPlot(elementId, traces, layout);
                }

                createBoxPlot('top1HitRate', 'top1Plot', 'Top-1 Hit Rate Distribution');
                createBoxPlot('meanReciprocalRank', 'mrrPlot', 'MRR Distribution');
            } catch (e) {
                console.error(e);
                document.getElementById('cors-banner').style.display = 'block';
            }
        }
        
        renderPlots();
    </script>
</body>
</html>
`;

fs.writeFileSync(outputPath, htmlContent);
console.log(`HTML plot generated at: ${outputPath}`);
