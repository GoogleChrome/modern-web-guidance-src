import { features } from 'web-features';
import { getFeatureStatus } from '../mcp-server/data/baseline.ts';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: pnpm baselinestatus <query> [--json]');
  console.log('Example: pnpm baselinestatus overflow');
  console.log('Example: pnpm baselinestatus overflow --json');
  process.exit(0);
}

let query = '';
let jsonMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--json') {
    jsonMode = true;
  } else {
    query = args[i];
  }
}

const matches = Object.entries(features).filter(([id, data]) => {
  if (data.kind !== 'feature') return false;
  return id.toLowerCase().includes(query.toLowerCase());
});

if (matches.length === 0) {
  if (jsonMode) {
    console.log('[]');
  } else {
    console.log(`No features found matching "${query}".`);
  }
} else {
  const rows = matches.map(([id, data]) => {
    const featureData = data as any;
    const status = getFeatureStatus(id);
    const support = featureData.status?.support || {};
    
    return {
      featureId: id,
      name: featureData.name || '-',
      baselineSince: status?.releaseDate || '-',
      baseline: status?.shortLabel || 'unknown',
      chrome: String(support.chrome || '-'),
      edge: String(support.edge || '-'),
      firefox: String(support.firefox || '-'),
      safari: String(support.safari || '-'),
      safariIos: String(support.safari_ios || '-')
    };
  });

  if (jsonMode) {
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  }

  const hasSafariIosMismatch = rows.some(r => r.safari !== r.safariIos);

  const cols = [
    { key: 'featureId', label: 'web-feature-id' },
    { key: 'name', label: 'Feature name' },
    { key: 'baselineSince', label: 'Baseline since', align: 'right' },
    { key: 'baseline', label: 'Baseline' },
    { key: 'chrome', label: 'Chrome', align: 'right' },
    { key: 'edge', label: 'Edge', align: 'right' },
    { key: 'firefox', label: 'Firefox', align: 'right' },
    { key: 'safari', label: 'Safari', align: 'right' },
  ];

  if (hasSafariIosMismatch) {
    cols.push({ key: 'safariIos', label: 'Safari iOS', align: 'right' });
  }

  const widths: Record<string, number> = {};
  for (const col of cols) {
    widths[col.key] = Math.max(
      col.label.length,
      ...rows.map(r => String(r[col.key as keyof typeof r]).length)
    );
  }

  const pad = (str: string, width: number, align?: string) =>
    align === 'right' ? str.padStart(width, ' ') : str.padEnd(width, ' ');

  const header = '| ' + cols.map(c => pad(c.label, widths[c.key], c.align)).join(' | ') + ' |';
  const sep = '|' + cols.map(c => {
    const w = widths[c.key];
    return c.align === 'right' ? '-'.repeat(w + 1) + ':' : '-'.repeat(w + 2);
  }).join('|') + '|';

  console.log(header);
  console.log(sep);

  const style = (text: string, color: string) => process.stdout.isTTY ? `${color}${text}\x1b[0m` : text;
  const colors: Record<string, string> = {
    'Newly': '\x1b[34m',
    'Widely': '\x1b[32m',
    'Limited': '\x1b[38;5;208m'
  };

  for (const row of rows) {
    const line = cols.map(c => {
      const text = String(row[c.key as keyof typeof row]);
      const padded = pad(text, widths[c.key], c.align);
      if (c.key === 'baseline' && colors[text]) {
        return padded.replace(text, style(text, colors[text]));
      }
      return padded;
    }).join(' | ');
    console.log(`| ${line} |`);
  }
}
