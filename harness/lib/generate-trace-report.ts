import * as fs from 'fs';
import * as path from 'path';

// Usage: npx ts-node generate-trace-report.ts <template_path> <trace_zip_path> <output_path>
const [,, templatePath, tracePath, outputPath] = process.argv;
if (!templatePath || !tracePath || !outputPath) {
  console.error('Usage: npx ts-node generate-trace-report.ts <template_path> <trace_zip_path> <output_path>');
  process.exit(1);
}

// 1. Read trace file and convert to Base64
if (!fs.existsSync(tracePath)) {
  console.error(`Trace file not found: ${tracePath}`);
  process.exit(1);
}
const traceBase64 = fs.readFileSync(tracePath, 'base64');

// 2. Read the Trace Viewer template
if (!fs.existsSync(templatePath)) {
  console.error(`Template file not found: ${templatePath}`);
  process.exit(1);
}
let html = fs.readFileSync(templatePath, 'utf8');

// 3. Inject the data as a hidden DOM element ONLY at the end of the file
const element = `<div id="__inlinedTraceData" style="display:none;">${traceBase64}</div>`;
// This regex only matches </body> if it is at the very end of the file ($)
html = html.replace('<div id="root">', `${element}<div id="root">`);
fs.writeFileSync(outputPath, html);
console.log(`Standalone Trace Viewer created at: ${outputPath}`);
