import { features } from 'web-features';
import { getFeatureStatus, mapBaseline } from '../mcp-server/data/baseline-utils.ts';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: pnpm baselinestatus <query> [--status <baseline>] [--json]');
  console.log('Example: pnpm baselinestatus overflow');
  console.log('Example: pnpm baselinestatus o --status low --json');
  process.exit(0);
}

let query = '';
let statusFilter: string | null = null;
let jsonMode = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--status') {
    statusFilter = args[i + 1];
    i++;
  } else if (args[i] === '--json') {
    jsonMode = true;
  } else {
    query = args[i];
  }
}

const matches = Object.entries(features).filter(([id, data]) => {
  if (data.kind !== 'feature') return false;
  const matchesQuery = id.toLowerCase().includes(query.toLowerCase());
  
  let targetStatus: string | boolean | undefined | null = statusFilter;
  if (statusFilter === 'false') targetStatus = false;
  if (statusFilter === 'unknown' || statusFilter === 'undefined') targetStatus = undefined;
  
  const matchesStatus = !statusFilter || data.status?.baseline === targetStatus;
  return matchesQuery && matchesStatus;
});

if (matches.length === 0) {
  if (jsonMode) {
    console.log('[]');
  } else {
    console.log(`No features found matching "${query}"${statusFilter ? ` with status "${statusFilter}"` : ''}.`);
  }
} else {
  const rows = matches.map(([id, data]) => {
    const status = getFeatureStatus(id);
    const baseline = mapBaseline(status?.baseline).replace(' availability', '').replace(' available', '');
    
    let baselineSince = '-';
    if (status?.baseline === 'low') {
      baselineSince = status.baseline_low_date || '-';
    } else if (status?.baseline === 'high') {
      baselineSince = status.baseline_high_date || status.baseline_low_date || '-';
    }

    const support = (data as any).status?.support || {};
    
    return {
      featureId: id,
      name: data.name || '-',
      baselineSince,
      baseline,
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

  const cols = [
    { key: 'featureId', label: 'web-feature-id' },
    { key: 'name', label: 'Feature name' },
    { key: 'baselineSince', label: 'Baseline since', align: 'right' },
    { key: 'baseline', label: 'Baseline' },
    { key: 'chrome', label: 'Chrome', align: 'right' },
    { key: 'edge', label: 'Edge', align: 'right' },
    { key: 'firefox', label: 'Firefox', align: 'right' },
    { key: 'safari', label: 'Safari', align: 'right' },
    { key: 'safariIos', label: 'Safari iOS', align: 'right' }
  ];

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
