import { features } from 'web-features';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: node scripts/wf.ts <query> [--status <baseline>]');
  console.log('Example: node scripts/wf.ts overflow');
  console.log('Example: node scripts/wf.ts o --status low');
  process.exit(0);
}

let query = '';
let statusFilter: string | null = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--status') {
    statusFilter = args[i + 1];
    i++;
  } else {
    query = args[i];
  }
}

const matches = Object.entries(features).filter(([id, data]) => {
  const matchesQuery = id.toLowerCase().includes(query.toLowerCase());
  const matchesStatus = !statusFilter || data.status?.baseline === statusFilter;
  return matchesQuery && matchesStatus;
});

if (matches.length === 0) {
  console.log(`No features found matching "${query}"${statusFilter ? ` with status "${statusFilter}"` : ''}.`);
} else {
  const rows = matches.map(([id, data]) => {
    const name = data.name || '-';
    let baseline = String(data.status?.baseline ?? 'unknown');
    if (baseline === 'low') baseline = 'Newly';
    else if (baseline === 'high') baseline = 'Widely';
    else if (baseline === 'false') baseline = 'Limited';

    const support = data.status?.support || {};
    
    return {
      featureId: `\`${id}\``,
      name,
      baseline,
      chrome: String(support.chrome || '-'),
      edge: String(support.edge || '-'),
      firefox: String(support.firefox || '-'),
      safari: String(support.safari || '-'),
      safariIos: String(support.safari_ios || '-')
    };
  });

  const cols = [
    { key: 'featureId', label: 'Feature ID' },
    { key: 'name', label: 'Name' },
    { key: 'baseline', label: 'Baseline' },
    { key: 'chrome', label: 'Chrome' },
    { key: 'edge', label: 'Edge' },
    { key: 'firefox', label: 'Firefox' },
    { key: 'safari', label: 'Safari' },
    { key: 'safariIos', label: 'Safari iOS' }
  ];

  const widths: Record<string, number> = {};
  for (const col of cols) {
    widths[col.key] = Math.max(
      col.label.length,
      ...rows.map(r => r[col.key as keyof typeof r].length)
    );
  }

  const pad = (str: string, width: number) => str.padEnd(width, ' ');

  const header = '| ' + cols.map(c => pad(c.label, widths[c.key])).join(' | ') + ' |';
  const sep = '|' + cols.map(c => '-'.repeat(widths[c.key] + 2)).join('|') + '|';
  
  console.log(header);
  console.log(sep);
  
  for (const row of rows) {
    console.log('| ' + cols.map(c => pad(row[c.key as keyof typeof row], widths[c.key])).join(' | ') + ' |');
  }
}

