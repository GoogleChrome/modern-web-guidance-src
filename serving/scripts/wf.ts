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
  console.log('| Feature ID | Name | Baseline | Chrome | Edge | Firefox | Safari | Safari iOS |');
  console.log('|---|---|---|---|---|---|---|---|');
  
  for (const [id, data] of matches) {
    const name = data.name || '-';
    const baseline = data.status?.baseline ?? 'unknown';
    const support = data.status?.support || {};
    
    const chrome = support.chrome || '-';
    const edge = support.edge || '-';
    const firefox = support.firefox || '-';
    const safari = support.safari || '-';
    const safari_ios = support.safari_ios || '-';
    
    console.log(`| \`${id}\` | ${name} | ${baseline} | ${chrome} | ${edge} | ${firefox} | ${safari} | ${safari_ios} |`);
  }
}
